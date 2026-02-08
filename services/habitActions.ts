
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file habitActions.ts
 * @description Controlador de Lógica de Negócios (Business Logic Controller).
 */

import { 
    state, Habit, HabitSchedule, TimeOfDay, ensureHabitDailyInfo, 
    ensureHabitInstanceData, clearScheduleCache,
    clearActiveHabitsCache, clearAllCaches, invalidateCachesForDateChange, getPersistableState,
    HabitDayData, STREAK_SEMI_CONSOLIDATED, STREAK_CONSOLIDATED, MAX_HABIT_NAME_LENGTH,
    getHabitDailyInfoForDate, AppState, HABIT_STATE, AI_DAILY_LIMIT,
    pruneHabitAppearanceCache, pruneStreaksCache, HabitDailyInfo
} from '../state';
import { saveState, loadState, clearLocalPersistence } from './persistence';
import { PREDEFINED_HABITS } from '../data/predefinedHabits';
import { 
    getEffectiveScheduleForHabitOnDate, clearSelectorInternalCaches,
    calculateHabitStreak, shouldHabitAppearOnDate, getHabitDisplayInfo,
    getHabitPropertiesForDate
} from './selectors';
import { 
    generateUUID, getTodayUTCIso, parseUTCIsoDate, triggerHaptic,
    getSafeDate, addDays, toUTCIsoDateString, logger, sanitizeText, escapeHTML
} from '../utils';
import { ARCHIVE_IDLE_FALLBACK_MS, ARCHIVE_DAYS_THRESHOLD } from '../constants';
import { 
    closeModal, showConfirmationModal, renderAINotificationState,
    clearHabitDomCache, updateDayVisuals, openModal
} from '../render';
import { ui } from '../render/ui';
import { t, getTimeOfDayName, formatDate, formatList, getAiLanguageName } from '../i18n'; 
import { runWorkerTask, addSyncLog } from './cloud';
import { apiFetch, clearKey } from './api';
import { HabitService } from './HabitService';

const BATCH_IDS_POOL: string[] = [];
const BATCH_HABITS_POOL: Habit[] = [];

let _isBatchOpActive = false;

const ActionContext = {
    isLocked: false,
    drop: null as any,
    removal: null as any,
    ending: null as any,
    deletion: null as any,
    reset() {
        this.isLocked = false;
        this.drop = this.removal = this.ending = this.deletion = null;
    }
};

/**
 * BOOT LOCK PROTECTION: Durante o boot, usamos timestamp incremental simples.
 * Após o sync, usamos o relógio real para garantir LWW.
 */
function _bumpLastModified() {
    if (!state.initialSyncDone) {
        state.lastModified = state.lastModified + 1;
    } else {
        state.lastModified = Math.max(Date.now(), (state.lastModified || 0) + 1);
    }
}

function _notifyChanges(fullRebuild = false, immediate = false) {
    if (fullRebuild) {
        clearScheduleCache();
        clearHabitDomCache();
        clearSelectorInternalCaches();
        // FIX [2025-06-13]: Limpa cache de sumário diário (anéis) em mudanças estruturais.
        // Garante que a adição de hábitos no passado atualize visualmente todos os dias afetados.
        state.daySummaryCache.clear();
        state.uiDirtyState.chartData = true;
    }
    clearActiveHabitsCache();
    state.uiDirtyState.habitListStructure = state.uiDirtyState.calendarVisuals = true;
    
    _bumpLastModified();

    document.body.classList.remove('is-interaction-active', 'is-dragging-active');
    saveState(immediate);
    requestAnimationFrame(() => {
        ['render-app', 'habitsChanged'].forEach(ev => document.dispatchEvent(new CustomEvent(ev)));
    });
}

function _notifyPartialUIRefresh(date: string) {
    // [OPTIMIZATION 2025-06-07] Surgical Update:
    // Em vez de marcar o calendário inteiro como sujo (uiDirtyState.calendarVisuals = true),
    // invalidamos os caches de dados e chamamos updateDayVisuals() diretamente para o dia afetado.
    // Isso evita o reflow global da fita do calendário.
    invalidateCachesForDateChange(date);
    
    _bumpLastModified();

    saveState();
    
    // Trigger visual updates in the next frame
    requestAnimationFrame(() => {
        updateDayVisuals(date);
        // Os eventos abaixo ainda são necessários para charts, badges, etc.
        ['render-app', 'habitsChanged'].forEach(ev => document.dispatchEvent(new CustomEvent(ev)));
    });
}

function _lockActionHabit(habitId: string): Habit | null {
    if (ActionContext.isLocked) return null;
    ActionContext.isLocked = true;
    const h = state.habits.find(x => x.id === habitId);
    if (!h) ActionContext.reset();
    return h ?? null;
}

function _requestFutureScheduleChange(habitId: string, targetDate: string, updateFn: (s: HabitSchedule) => HabitSchedule, immediate = false) {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return;

    // CACHE PURGE: Qualquer mudança de agendamento invalida o cache de "Aparição" e "Streaks" deste hábito.
    // Isso é CRÍTICO para "Ressurreição" de hábitos deletados, pois o cache antigo pode conter 'false'.
    state.habitAppearanceCache.delete(habitId);
    state.streaksCache.delete(habitId);

    const history = habit.scheduleHistory;
    if (history.length === 0) return;

    const earliest = history.reduce((min, s) => (s.startDate < min.startDate ? s : min), history[0]);
    if (targetDate < earliest.startDate) {
        const newEntry = updateFn({
            ...earliest,
            startDate: targetDate,
            endDate: earliest.startDate,
            scheduleAnchor: targetDate
        });
        history.push(newEntry);
        history.sort((a, b) => a.startDate.localeCompare(b.startDate));
        habit.graduatedOn = undefined;
        _notifyChanges(true, immediate);
        return;
    }
    const idx = history.findIndex(s => targetDate >= s.startDate && (!s.endDate || targetDate < s.endDate));

    if (idx !== -1) {
        const cur = history[idx];
        if (cur.startDate === targetDate) history[idx] = updateFn({ ...cur });
        else { cur.endDate = targetDate; history.push(updateFn({ ...cur, startDate: targetDate, endDate: undefined })); }
    } else {
        const last = history[history.length - 1];
        if (last) { if (last.endDate && last.endDate > targetDate) last.endDate = targetDate; history.push(updateFn({ ...last, startDate: targetDate, endDate: undefined })); }
    }
    history.sort((a, b) => a.startDate.localeCompare(b.startDate));
    habit.graduatedOn = undefined;
    _notifyChanges(true, immediate);
}

function _checkStreakMilestones(habit: Habit, dateISO: string) {
    const streak = calculateHabitStreak(habit, dateISO);
    const m = streak === STREAK_SEMI_CONSOLIDATED ? state.pending21DayHabitIds : (streak === STREAK_CONSOLIDATED ? state.pendingConsolidationHabitIds : null);
    if (m && !state.notificationsShown.includes(`${habit.id}-${streak}`) && !m.includes(habit.id)) {
        m.push(habit.id);
        renderAINotificationState();
    }
}

const _applyDropJustToday = () => {
    const ctx = ActionContext.drop, target = getSafeDate(state.selectedDate);
    if (!ctx) return ActionContext.reset();
    const habit = state.habits.find(h => h.id === ctx.habitId);
    if (habit) {
        const info = ensureHabitDailyInfo(target, ctx.habitId), sch = [...getEffectiveScheduleForHabitOnDate(habit, target)];
        const fIdx = sch.indexOf(ctx.fromTime);
        if (fIdx > -1) sch.splice(fIdx, 1);
        if (!sch.includes(ctx.toTime)) sch.push(ctx.toTime);
        const currentBit = HabitService.getStatus(ctx.habitId, target, ctx.fromTime);
        if (currentBit !== HABIT_STATE.NULL) { HabitService.setStatus(ctx.habitId, target, ctx.toTime, currentBit); HabitService.setStatus(ctx.habitId, target, ctx.fromTime, HABIT_STATE.NULL); }
        if (info.instances[ctx.fromTime as TimeOfDay]) { info.instances[ctx.toTime as TimeOfDay] = info.instances[ctx.fromTime as TimeOfDay]; delete info.instances[ctx.fromTime as TimeOfDay]; }
        info.dailySchedule = sch;
        if (ctx.reorderInfo) reorderHabit(ctx.habitId, ctx.reorderInfo.id, ctx.reorderInfo.pos, true);
        _notifyChanges(false);
    }
    ActionContext.reset();
};

const _applyDropFromNowOn = () => {
    const ctx = ActionContext.drop, target = getSafeDate(state.selectedDate);
    if (!ctx) return ActionContext.reset();
    const info = ensureHabitDailyInfo(target, ctx.habitId);
    info.dailySchedule = undefined;
    const currentBit = HabitService.getStatus(ctx.habitId, target, ctx.fromTime);
    if (currentBit !== HABIT_STATE.NULL) { HabitService.setStatus(ctx.habitId, target, ctx.toTime, currentBit); HabitService.setStatus(ctx.habitId, target, ctx.fromTime, HABIT_STATE.NULL); }
    if (info.instances[ctx.fromTime as TimeOfDay]) { info.instances[ctx.toTime as TimeOfDay] = info.instances[ctx.fromTime as TimeOfDay]; delete info.instances[ctx.fromTime as TimeOfDay]; }
    if (ctx.reorderInfo) reorderHabit(ctx.habitId, ctx.reorderInfo.id, ctx.reorderInfo.pos, true);
    _requestFutureScheduleChange(ctx.habitId, target, (s) => {
        const times = [...s.times], fIdx = times.indexOf(ctx.fromTime);
        if (fIdx > -1) times.splice(fIdx, 1);
        if (!times.includes(ctx.toTime)) times.push(ctx.toTime);
        return { ...s, times: times as readonly TimeOfDay[] };
    });
    ActionContext.reset();
};

const _applyHabitDeletion = async () => {
    const ctx = ActionContext.deletion;
    if (!ctx) return;
    const habit = state.habits.find(h => h.id === ctx.habitId);
    if (!habit) return ActionContext.reset();

    // 1. Marcação Lógica para Sync (Tombstone do Objeto Hábito)
    // Para Hard Delete, definimos a data de deleção para o início da existência do hábito (ou antes),
    // garantindo que ele não apareça em nenhum filtro de data (shouldHabitAppearOnDate).
    const lastSchedule = habit.scheduleHistory[habit.scheduleHistory.length - 1];
    habit.deletedName = lastSchedule?.nameKey ? t(lastSchedule.nameKey) : lastSchedule?.name;
    habit.deletedOn = habit.createdOn;
    habit.graduatedOn = undefined;
    habit.scheduleHistory = [];
    
    // 2. Limpeza Profunda de Logs (Bitmasks)
    HabitService.pruneLogsForHabit(habit.id);

    // 3. Limpeza Profunda de Dados Diários (Notas/Overrides em Memória)
    Object.keys(state.dailyData).forEach(date => {
        if (state.dailyData[date][habit.id]) {
            delete state.dailyData[date][habit.id];
            if (Object.keys(state.dailyData[date]).length === 0) {
                delete state.dailyData[date];
            }
        }
    });

    // Cleanup de Cache de Aparição e Streaks
    state.streaksCache.delete(habit.id);
    state.habitAppearanceCache.delete(habit.id);

    // 4. Limpeza Profunda de Arquivos Mortos (Background Worker)
    runWorkerTask<Record<string, any>>('prune-habit', { 
        habitId: habit.id, 
        archives: state.archives 
    }).then(updatedArchives => {
        Object.keys(updatedArchives).forEach(year => {
            if (updatedArchives[year] === "") delete state.archives[year];
            else state.archives[year] = updatedArchives[year];
        });
        state.unarchivedCache.clear();
        saveState();
    }).catch(e => logger.error("Archive pruning failed", e));

    _notifyChanges(true, true);
    ActionContext.reset();
};

export function performArchivalCheck() {
    const run = async () => {
        const threshold = toUTCIsoDateString(addDays(parseUTCIsoDate(getTodayUTCIso()), -ARCHIVE_DAYS_THRESHOLD)), buckets: Record<string, any> = {}, toRem: string[] = [];
        Object.keys(state.dailyData).forEach(d => {
            if (d < threshold) {
                const y = d.substring(0, 4);
                buckets[y] ??= { additions: {}, base: state.unarchivedCache.get(y) || state.archives[y] };
                buckets[y].additions[d] = state.dailyData[d];
                toRem.push(d);
            }
        });
        if (toRem.length === 0) return;
        try {
            const up = await runWorkerTask<Record<string, string>>('archive', buckets);
            Object.keys(up).forEach(y => { state.archives[y] = up[y]; state.unarchivedCache.delete(y); Object.keys(buckets[y].additions).forEach(k => delete state.dailyData[k]); });
            await saveState();
        } catch (e) { logger.error('Archive worker failed', e); }
    };
    if ('requestIdleCallback' in window) requestIdleCallback(() => run()); else setTimeout(run, ARCHIVE_IDLE_FALLBACK_MS);
}

export function reorderHabit(movedHabitId: string, targetHabitId: string, pos: 'before' | 'after', skip = false) {
    const h = state.habits, mIdx = h.findIndex(x => x.id === movedHabitId), tIdx = h.findIndex(x => x.id === targetHabitId);
    if (mIdx === -1 || tIdx === -1) return;
    const [item] = h.splice(mIdx, 1);
    h.splice(pos === 'before' ? (mIdx < tIdx ? tIdx - 1 : tIdx) : (mIdx < tIdx ? tIdx : tIdx + 1), 0, item);
    if (!skip) _notifyChanges(false);
}

export function saveHabitFromModal() {
    if (!state.editingHabit) return;
    const { isNew, habitId, formData, targetDate } = state.editingHabit;
    if (formData.name) {
        formData.name = sanitizeText(formData.name, MAX_HABIT_NAME_LENGTH);
    }
    const nameToUse = formData.nameKey ? t(formData.nameKey) : formData.name!;
    if (!nameToUse) return;
    const cleanFormData = {
        ...formData,
        times: [...formData.times],
        goal: { ...formData.goal },
        frequency: formData.frequency.type === 'specific_days_of_week' ? { ...formData.frequency, days: [...formData.frequency.days] } : { ...formData.frequency }
    };
    
    // NAVIGATION FIX [2025-06-14]: Suppress onClose callback (reopen Explore) on successful save.
    // The user has completed their action, so we shouldn't force them back to the list.
    closeModal(ui.editHabitModal, true);

    // EMPTY TIMES FIX [2025-02-07]: Se nenhum horário foi selecionado, não adicionar/ressuscitar
    // o hábito. Se já existia e está ativo, encerrá-lo. Caso contrário, não fazer nada.
    if (cleanFormData.times.length === 0) {
        if (isNew) {
            // Verifica se existe um hábito ativo com este nome para encerrá-lo
            const activeHabit = state.habits.find(h => {
                if (h.deletedOn || h.graduatedOn) return false;
                const info = getHabitDisplayInfo(h, targetDate);
                const lastName = h.scheduleHistory[h.scheduleHistory.length - 1]?.name || info.name;
                if ((lastName || '').trim().toLowerCase() !== nameToUse.trim().toLowerCase()) return false;
                const lastSchedule = h.scheduleHistory[h.scheduleHistory.length - 1];
                return !lastSchedule.endDate || lastSchedule.endDate > targetDate;
            });
            if (activeHabit) {
                _requestFutureScheduleChange(activeHabit.id, targetDate, s => ({ ...s, endDate: targetDate }), true);
            }
        } else {
            // Edição de hábito existente: encerrar o hábito
            const h = state.habits.find(x => x.id === habitId);
            if (h) {
                _requestFutureScheduleChange(h.id, targetDate, s => ({ ...s, endDate: targetDate }), true);
            }
        }
        return;
    }
    
    if (isNew) {
        // RESURRECTION LOGIC:
        // Reuse an existing habit with the same name to avoid duplicates.
        const candidates = state.habits.filter(h => {
               const info = getHabitDisplayInfo(h, targetDate);
               const lastName = h.scheduleHistory[h.scheduleHistory.length - 1]?.name || h.deletedName || info.name;
             return (lastName || '').trim().toLowerCase() === nameToUse.trim().toLowerCase();
        });

        // Pick priority:
        // 1. Active (not deleted, not graduated, covers targetDate or has no endDate)
        let existingHabit = candidates.find(h =>
            !h.deletedOn && !h.graduatedOn && 
            (!h.scheduleHistory[h.scheduleHistory.length-1].endDate || h.scheduleHistory[h.scheduleHistory.length-1].endDate! > targetDate)
        );
        
        if (!existingHabit && candidates.length > 0) {
            const sorted = [...candidates].sort((a, b) => {
                const aLast = a.scheduleHistory[a.scheduleHistory.length - 1];
                const bLast = b.scheduleHistory[b.scheduleHistory.length - 1];
                const aKey = aLast?.startDate || a.createdOn;
                const bKey = bLast?.startDate || b.createdOn;
                return bKey.localeCompare(aKey);
            });
            existingHabit = sorted[0];
        }

        if (existingHabit) {
            // Restore Logical state
            const wasDeleted = !!existingHabit.deletedOn;
            if (existingHabit.deletedOn) existingHabit.deletedOn = undefined;
            if (existingHabit.graduatedOn) existingHabit.graduatedOn = undefined;
            if (existingHabit.deletedName) existingHabit.deletedName = undefined;
            if (targetDate < existingHabit.createdOn) existingHabit.createdOn = targetDate;

            if (wasDeleted) {
                existingHabit.scheduleHistory = [];
            }

            if (existingHabit.scheduleHistory.length === 0) {
                existingHabit.scheduleHistory.push({
                    startDate: targetDate,
                    times: cleanFormData.times as readonly TimeOfDay[],
                    frequency: cleanFormData.frequency,
                    name: cleanFormData.name,
                    nameKey: cleanFormData.nameKey,
                    subtitleKey: cleanFormData.subtitleKey,
                    scheduleAnchor: targetDate,
                    icon: cleanFormData.icon,
                    color: cleanFormData.color,
                    goal: cleanFormData.goal,
                    philosophy: cleanFormData.philosophy
                });
                existingHabit.createdOn = targetDate;
                _notifyChanges(true);
            } else {
                _requestFutureScheduleChange(existingHabit.id, targetDate, (s) => ({ 
                    ...s, 
                    icon: cleanFormData.icon, 
                    color: cleanFormData.color, 
                    goal: cleanFormData.goal, 
                    philosophy: cleanFormData.philosophy ?? s.philosophy, 
                    name: cleanFormData.name, 
                    nameKey: cleanFormData.nameKey, 
                    subtitleKey: cleanFormData.subtitleKey, 
                    times: cleanFormData.times as readonly TimeOfDay[], 
                    frequency: cleanFormData.frequency,
                    endDate: undefined // RESURRECTION FIX: Explicitly clear endDate on resurrected entry
                }), false);

                // RESURRECTION FIX [2025-06-17]: Remove stale schedule entries left over from
                // the previous "ending" action. When a habit was ended (creating a split entry with
                // endDate) and then deleted, those old ending entries remain in scheduleHistory.
                // After resurrection via _requestFutureScheduleChange (which adds a new open-ended
                // entry at targetDate), entries AFTER the resurrection point are orphaned and cause
                // the Manage Habits modal to show "Encerrado" instead of "Ativo" because
                // setupManageModal checks scheduleHistory[last].endDate.
                existingHabit.scheduleHistory = existingHabit.scheduleHistory.filter(s => {
                    if (s.startDate > targetDate) return false; // Remove entries after resurrection point
                    if (s.startDate === targetDate && s.endDate) return false; // Remove stale same-date entries with endDate
                    return true;
                });
            }
        } else {
            state.habits.push({ id: generateUUID(), createdOn: targetDate, scheduleHistory: [{ startDate: targetDate, times: cleanFormData.times as readonly TimeOfDay[], frequency: cleanFormData.frequency, name: cleanFormData.name, nameKey: cleanFormData.nameKey, subtitleKey: cleanFormData.subtitleKey, scheduleAnchor: targetDate, icon: cleanFormData.icon, color: cleanFormData.color, goal: cleanFormData.goal, philosophy: cleanFormData.philosophy }] });
            _notifyChanges(true);
        }
    } else {
        const h = state.habits.find(x => x.id === habitId);
        if (!h) return;
        ensureHabitDailyInfo(targetDate, h.id).dailySchedule = undefined;
        if (targetDate < h.createdOn) h.createdOn = targetDate;
        _requestFutureScheduleChange(h.id, targetDate, (s) => ({ ...s, icon: cleanFormData.icon, color: cleanFormData.color, goal: cleanFormData.goal, philosophy: cleanFormData.philosophy ?? s.philosophy, name: cleanFormData.name, nameKey: cleanFormData.nameKey, subtitleKey: cleanFormData.subtitleKey, times: cleanFormData.times as readonly TimeOfDay[], frequency: cleanFormData.frequency }), false);
    }
}

// SIMPLES HASHING FUNCTION (Fowler-Noll-Vo)
function fnv1aHash(str: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(16);
}

export async function performAIAnalysis(type: 'monthly' | 'quarterly' | 'historical') {
    if (state.aiState === 'loading') return;
    
    // --- 1. QUOTA CHECK & RESET ---
    const todayISO = getTodayUTCIso();
    if (state.aiQuotaDate !== todayISO) {
        state.aiDailyCount = 0;
        state.aiQuotaDate = todayISO;
    }

    if (state.aiDailyCount >= AI_DAILY_LIMIT) {
        showConfirmationModal(t('aiLimitReached', { count: AI_DAILY_LIMIT }), () => {}, { 
            title: t('aiLimitTitle'), 
            confirmText: t('closeButton'),
            hideCancel: true 
        });
        return;
    }

    const id = ++state.aiReqId; 
    state.aiState = 'loading'; 
    state.hasSeenAIResult = false;
    renderAINotificationState(); 
    closeModal(ui.aiOptionsModal);
    addSyncLog(`Iniciando análise IA (${type})...`, 'info');

    try {
        const trans: Record<string, string> = { promptTemplate: t(type === 'monthly' ? 'aiPromptMonthly' : (type === 'quarterly' ? 'aiPromptQuarterly' : 'aiPromptGeneral')), aiDaysUnit: t('unitDays', { count: 2 }) };
        ['aiPromptGraduatedSection', 'aiPromptNoData', 'aiPromptNone', 'aiSystemInstruction', 'aiPromptHabitDetails', 'aiVirtue', 'aiDiscipline', 'aiSphere', 'stoicVirtueWisdom', 'stoicVirtueCourage', 'stoicVirtueJustice', 'stoicVirtueTemperance', 'stoicDisciplineDesire', 'stoicDisciplineAction', 'stoicDisciplineAssent', 'governanceSphereBiological', 'governanceSphereStructural', 'governanceSphereSocial', 'governanceSphereMental', 'aiPromptNotesSectionHeader', 'aiStreakLabel', 'aiSuccessRateLabelMonthly', 'aiSuccessRateLabelQuarterly', 'aiSuccessRateLabelHistorical', 'aiHistoryChange', 'aiHistoryChangeFrequency', 'aiHistoryChangeGoal', 'aiHistoryChangeTimes'].forEach(k => trans[k] = t(k));
        PREDEFINED_HABITS.forEach(h => trans[h.nameKey] = t(h.nameKey));
        const logsSerialized = HabitService.serializeLogsForCloud();
        
        // TOKEN OPTIMIZATION: Filter dailyData based on analysis type to fit context window
        let lookbackDays = 30;
        if (type === 'quarterly') lookbackDays = 90;
        if (type === 'historical') lookbackDays = 365;
        
        const todayDate = parseUTCIsoDate(todayISO);
        const cutoffDate = addDays(todayDate, -lookbackDays);
        const cutoffISO = toUTCIsoDateString(cutoffDate);
        
        const filteredDailyData: Record<string, Record<string, HabitDailyInfo>> = {};
        Object.keys(state.dailyData).forEach(key => {
            if (key >= cutoffISO) filteredDailyData[key] = state.dailyData[key];
        });

        // --- 2. GENERATE CONTENT & HASH ---
        const workerPayload = { analysisType: type, habits: state.habits, dailyData: filteredDailyData, archives: state.archives, monthlyLogsSerialized: logsSerialized, languageName: getAiLanguageName(), translations: trans, todayISO };
        const { prompt, systemInstruction } = await runWorkerTask<any>('build-ai-prompt', workerPayload);
        
        // Compute Content-Hash (Cheap and Fast)
        const currentContentHash = fnv1aHash(prompt + systemInstruction + type);
        
        // --- 3. DEDUPLICATION CHECK ---
        if (currentContentHash === state.lastAIContextHash && state.lastAIResult) {
            addSyncLog("Dados não mudaram. Usando análise em cache.", 'success');
            state.aiState = 'completed';
            // Do NOT increment quota
            saveState();
            renderAINotificationState();
            return; // EXIT EARLY
        }

        if (id !== state.aiReqId) return;
        
        const res = await apiFetch('/api/analyze', { method: 'POST', body: JSON.stringify({ prompt, systemInstruction }) });
        
        if (!res.ok) {
            let errorDetail = `Status ${res.status}`;
            try {
                const errorJson = await res.json();
                if (errorJson.error) errorDetail = errorJson.error;
                // FIX: Include technical details for debugging
                if (errorJson.details) errorDetail += `: ${errorJson.details}`;
            } catch (e) { }
            throw new Error(`AI Request: ${errorDetail}`);
        }
        
        if (id === state.aiReqId) { 
            state.lastAIResult = await res.text(); 
            state.aiState = 'completed'; 
            state.lastAIContextHash = currentContentHash;
            state.aiDailyCount++; // Increment Quota only on success
            addSyncLog("Análise IA concluída.", 'success'); 
        }
    } catch (e) { 
        if (id === state.aiReqId) { 
            const errStr = e instanceof Error ? e.message : String(e);
            state.lastAIError = errStr; 
            state.aiState = 'error'; 
            state.lastAIResult = t('aiErrorGeneric'); 
            addSyncLog("Erro na análise IA.", 'error'); 
            
            // Handle 429/Quota/Overload gracefully with Friendly Message
            if (errStr.includes('429') || errStr.includes('Quota') || errStr.includes('RESOURCE_EXHAUSTED')) {
                ui.aiResponse.innerHTML = `<div class="ai-error-message"><h3>${escapeHTML(t('aiServerBusyTitle'))}</h3><p>${escapeHTML(t('aiServerBusy'))}</p></div>`;
            } else {
                // Show detailed error in UI for user feedback
                // SECURITY FIX: escapeHTML on errStr to prevent XSS via crafted API error messages
                ui.aiResponse.innerHTML = `<div class="ai-error-message"><h3>${t('aiLimitTitle') === 'Daily Limit Reached' ? 'Error' : 'Erro'}</h3><p>${escapeHTML(t('aiErrorGeneric'))}</p><div class="debug-info"><small>${escapeHTML(errStr)}</small></div></div>`;
            }
            
            // UX FIX: Provide close handler to clear notification state
            openModal(ui.aiModal, undefined, () => {
                state.hasSeenAIResult = true;
                renderAINotificationState();
            });
        } 
    } finally { 
        if (id === state.aiReqId) { 
            saveState(); 
            renderAINotificationState(); 
        } 
    }
}

export function importData() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'application/json';
    input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
        try {
            const data = JSON.parse(await file.text());
            if (data.habits && data.version && Array.isArray(data.habits) && data.habits.every((h: any) => h?.id && Array.isArray(h?.scheduleHistory))) {
                // SECURITY FIX: Sanitize imported habit data to prevent Stored XSS via malicious JSON.
                // Icon fields are rendered via innerHTML — only allow known SVG patterns.
                const SVG_TAG_REGEX = /^<svg[\s>]/i;
                data.habits.forEach((h: any) => {
                    if (Array.isArray(h.scheduleHistory)) {
                        h.scheduleHistory.forEach((s: any) => {
                            if (s.icon && typeof s.icon === 'string' && !SVG_TAG_REGEX.test(s.icon.trim())) {
                                s.icon = '❓'; // Replace non-SVG icon with safe fallback
                            }
                            if (s.name && typeof s.name === 'string') s.name = sanitizeText(s.name, 60);
                            if (s.color && typeof s.color === 'string' && !/^#[0-9a-fA-F]{3,8}$/.test(s.color)) {
                                s.color = '#808080'; // Replace invalid color
                            }
                        });
                    }
                });
                // FIX: Rehidratar monthlyLogsSerialized antes do loadState
                // exportData() serializa os bitmask logs como [key, hex][] em monthlyLogsSerialized,
                // mas JSON.stringify(Map) produz '{}'. Precisamos injetar os logs de volta.
                if (Array.isArray(data.monthlyLogsSerialized) && data.monthlyLogsSerialized.length > 0) {
                    const logsMap: Record<string, string> = {};
                    data.monthlyLogsSerialized.forEach(([k, v]: [string, string]) => { logsMap[k] = v; });
                    data.monthlyLogs = logsMap;
                }
                await loadState(data); await saveState(); ['render-app', 'habitsChanged'].forEach(ev => document.dispatchEvent(new CustomEvent(ev))); closeModal(ui.manageModal); showConfirmationModal(t('importSuccess'), () => {}, { title: t('privacyLabel'), confirmText: 'OK', hideCancel: true });
            } else throw 0;
        } catch { showConfirmationModal(t('importError'), () => {}, { title: t('importError'), confirmText: 'OK', hideCancel: true, confirmButtonStyle: 'danger' }); }
    };
    input.click();
}

export function toggleHabitStatus(habitId: string, time: TimeOfDay, dateISO: string) {
    // BOOT LOCK: Previne escrita até que o sync inicial (se houver) termine
    if (!state.initialSyncDone) return;
    if (!state.habits.some(h => h.id === habitId)) return;

    const currentStatus = HabitService.getStatus(habitId, dateISO, time);
    let nextStatus: number = HABIT_STATE.DONE;
    if (currentStatus === HABIT_STATE.DONE || currentStatus === HABIT_STATE.DONE_PLUS) nextStatus = HABIT_STATE.DEFERRED;
    else if (currentStatus === HABIT_STATE.DEFERRED) nextStatus = HABIT_STATE.NULL;
    HabitService.setStatus(habitId, dateISO, time, nextStatus);
    // saveState() é chamado por _notifyPartialUIRefresh abaixo — não duplicar
    const h = state.habits.find(x => x.id === habitId);
    if (nextStatus === HABIT_STATE.DONE) { if (h) _checkStreakMilestones(h, dateISO); triggerHaptic('light'); }
    else if (nextStatus === HABIT_STATE.DEFERRED) triggerHaptic('medium');
    else triggerHaptic('selection');
    document.dispatchEvent(new CustomEvent('card-status-changed', { detail: { habitId, time, date: dateISO } }));
    _notifyPartialUIRefresh(dateISO);
}

export function markAllHabitsForDate(dateISO: string, status: 'completed' | 'snoozed'): boolean {
    if (_isBatchOpActive) return false;
    // BOOT LOCK
    if (!state.initialSyncDone) return false;

    _isBatchOpActive = true;
    const dateObj = parseUTCIsoDate(dateISO);
    let changed = false; BATCH_IDS_POOL.length = BATCH_HABITS_POOL.length = 0;
    try {
        state.habits.forEach(h => {
            if (!shouldHabitAppearOnDate(h, dateISO, dateObj)) return;
            const sch = getEffectiveScheduleForHabitOnDate(h, dateISO); 
            if (!sch.length) return;
            let bitStatus: number = (status === 'completed') ? HABIT_STATE.DONE : HABIT_STATE.DEFERRED;
            let habitChanged = false;
            sch.forEach(t => { if (HabitService.getStatus(h.id, dateISO, t) !== bitStatus) { HabitService.setStatus(h.id, dateISO, t, bitStatus); habitChanged = true; } });
            if (habitChanged) { changed = true; BATCH_IDS_POOL.push(h.id); BATCH_HABITS_POOL.push(h); }
        });
        if (changed) { 
            invalidateCachesForDateChange(dateISO); 
            if (status === 'completed') BATCH_HABITS_POOL.forEach(h => _checkStreakMilestones(h, dateISO)); 
            
            // BATCH OPTIMIZATION: Para mudanças em massa (Completar Dia), ainda usamos o refresh completo 
            // ou podemos chamar updateDayVisuals se quisermos (já que todos os IDs afetados são do mesmo dia).
            // Como afeta potencialmente todo o gráfico e visual do dia, usar _notifyChanges com updateDayVisuals é seguro.
            requestAnimationFrame(() => updateDayVisuals(dateISO));
            _notifyChanges(false); 
        }
    } finally { _isBatchOpActive = false; }
    return changed;
}

export function handleHabitDrop(habitId: string, fromTime: TimeOfDay, toTime: TimeOfDay, reorderInfo?: any) {
    // BOOT LOCK
    if (!state.initialSyncDone) return;

    const h = _lockActionHabit(habitId); if (!h) return;
    ActionContext.drop = { habitId, fromTime, toTime, reorderInfo };
    
    // VISUAL FIX [2025-06-08]: Callback onCancel para restaurar a visibilidade do cartão.
    // Se o usuário cancela a mudança de horário (Move), o cartão deve reaparecer na lista.
    // Como o drag o deixou com 'opacity: 0', precisamos forçar uma re-renderização ou limpeza da classe.
    const onCancel = () => {
        ActionContext.reset();
        // FORCE RENDER: Marca a estrutura como suja e dispara render para limpar classe .dragging
        state.uiDirtyState.habitListStructure = true;
        document.dispatchEvent(new CustomEvent('render-app'));
    };

    showConfirmationModal(
        t('confirmHabitMove', { habitName: getHabitDisplayInfo(h, state.selectedDate).name, oldTime: getTimeOfDayName(fromTime), newTime: getTimeOfDayName(toTime) }), 
        _applyDropFromNowOn, 
        { 
            title: t('modalMoveHabitTitle'), 
            confirmText: t('buttonFromNowOn'), 
            editText: t('buttonJustToday'), 
            onEdit: _applyDropJustToday, 
            onCancel 
        }
    );
}

export function requestHabitEndingFromModal(habitId: string, targetDateOverride?: string) {
    if (!state.initialSyncDone) return;
    const h = _lockActionHabit(habitId), target = getSafeDate(targetDateOverride || state.selectedDate); if (!h) return;
    ActionContext.ending = { habitId, targetDate: target };
    showConfirmationModal(t('confirmEndHabit', { habitName: getHabitDisplayInfo(h, target).name, date: formatDate(parseUTCIsoDate(target), { day: 'numeric', month: 'long', timeZone: 'UTC' }) }), 
        () => { _requestFutureScheduleChange(habitId, target, s => ({ ...s, endDate: target }), true); ActionContext.reset(); }, { confirmButtonStyle: 'danger', confirmText: t('endButton'), onCancel: () => ActionContext.reset() });
}

export function requestHabitPermanentDeletion(habitId: string) {
    if (!state.initialSyncDone) return;
    if (_lockActionHabit(habitId)) {
        ActionContext.deletion = { habitId };
        showConfirmationModal(t('confirmPermanentDelete', { habitName: getHabitDisplayInfo(state.habits.find(x => x.id === habitId)!).name }), _applyHabitDeletion, { confirmButtonStyle: 'danger', confirmText: t('deleteButton'), onCancel: () => ActionContext.reset() });
    }
}
export function graduateHabit(habitId: string) { if (!state.initialSyncDone) return; const h = state.habits.find(x => x.id === habitId); if (h) { h.graduatedOn = getSafeDate(state.selectedDate); _notifyChanges(true, true); triggerHaptic('success'); } }
export async function resetApplicationData() { 
    state.habits = [];
    state.dailyData = {};
    state.archives = {};
    state.notificationsShown = [];
    state.pending21DayHabitIds = [];
    state.pendingConsolidationHabitIds = [];
    state.monthlyLogs = new Map();
    clearAllCaches();
    state.uiDirtyState = { calendarVisuals: true, habitListStructure: true, chartData: true };
    HabitService.resetCache();
    state.aiDailyCount = 0; state.lastAIContextHash = null;
    document.dispatchEvent(new CustomEvent('render-app'));
    try { await clearLocalPersistence(); } catch (e) { logger.error('Clear persistence failed', e); } finally { clearKey(); window.location.reload(); } 
}
export function handleSaveNote() { if (!state.editingNoteFor) return; const { habitId, date, time } = state.editingNoteFor, val = sanitizeText(ui.notesTextarea.value), inst = ensureHabitInstanceData(date, habitId, time); if ((inst.note || '') !== val) { inst.note = val || undefined; state.uiDirtyState.habitListStructure = true; saveState(); document.dispatchEvent(new CustomEvent('render-app')); } closeModal(ui.notesModal); }
export function setGoalOverride(habitId: string, d: string, t: TimeOfDay, v: number) { 
    // BOOT LOCK
    if (!state.initialSyncDone) return;

    try {
        const h = state.habits.find(x => x.id === habitId); if (!h) return;
        ensureHabitInstanceData(d, habitId, t).goalOverride = v;
        const currentStatus = HabitService.getStatus(habitId, d, t);
        if (currentStatus === HABIT_STATE.DONE || currentStatus === HABIT_STATE.DONE_PLUS) {
             const props = getHabitPropertiesForDate(h, d);
             if (props?.goal?.total && v > props.goal.total) { if (currentStatus !== HABIT_STATE.DONE_PLUS) HabitService.setStatus(habitId, d, t, HABIT_STATE.DONE_PLUS); }
             else { if (currentStatus !== HABIT_STATE.DONE) HabitService.setStatus(habitId, d, t, HABIT_STATE.DONE); }
        }
        saveState(); document.dispatchEvent(new CustomEvent('card-goal-changed', { detail: { habitId, time: t, date: d } })); _notifyPartialUIRefresh(d); 
    } catch (e) { logger.error('setGoalOverride failed', e); } 
}
export function requestHabitTimeRemoval(habitId: string, time: TimeOfDay, targetDateOverride?: string) {
    if (!state.initialSyncDone) return;
    const h = _lockActionHabit(habitId), target = getSafeDate(targetDateOverride || state.selectedDate); if (!h) return;
    ActionContext.removal = { habitId, time, targetDate: target };
    showConfirmationModal(t('confirmRemoveTimePermanent', { habitName: getHabitDisplayInfo(h, target).name, time: getTimeOfDayName(time) }), () => { ensureHabitDailyInfo(target, habitId).dailySchedule = undefined; _requestFutureScheduleChange(habitId, target, s => ({ ...s, times: s.times.filter(x => x !== time) as readonly TimeOfDay[] }), true); ActionContext.reset(); }, { title: t('modalRemoveTimeTitle'), confirmText: t('deleteButton'), confirmButtonStyle: 'danger', onCancel: () => ActionContext.reset() });
}
export function exportData() {
    const stateToExport = getPersistableState();
    const logs = HabitService.serializeLogsForCloud(); 
    if (logs.length > 0) (stateToExport as any).monthlyLogsSerialized = logs;
    const blob = new Blob([JSON.stringify(stateToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `askesis-backup-${getTodayUTCIso()}.json`; a.click(); URL.revokeObjectURL(url);
}
export function handleDayTransition() { 
    const today = getTodayUTCIso(); 
    clearActiveHabitsCache(); 
    
    // Limpeza de caches antigos para prevenir Memory Leaks
    pruneHabitAppearanceCache();
    pruneStreaksCache();

    state.uiDirtyState.calendarVisuals = state.uiDirtyState.habitListStructure = state.uiDirtyState.chartData = true; 
    state.calendarDates = []; 
    if (state.selectedDate !== today) state.selectedDate = today; 
    document.dispatchEvent(new CustomEvent('render-app')); 
}

function _processAndFormatCelebrations(pendingIds: string[], translationKey: 'aiCelebration21Day' | 'aiCelebration66Day', streakMilestone: number): string {
    if (pendingIds.length === 0) return '';
    const habitNamesList = pendingIds.map(id => state.habits.find(h => h.id === id)).filter(Boolean).map(h => getHabitDisplayInfo(h!).name);
    const habitNames = formatList(habitNamesList);
    pendingIds.forEach(id => { 
        const celebrationId = `${id}-${streakMilestone}`; 
        if (!state.notificationsShown.includes(celebrationId)) state.notificationsShown.push(celebrationId);
    });
    return t(translationKey, { count: pendingIds.length, habitNames });
}

export function consumeAndFormatCelebrations(): string {
    const celebration21DayText = _processAndFormatCelebrations(state.pending21DayHabitIds, 'aiCelebration21Day', STREAK_SEMI_CONSOLIDATED);
    const celebration66DayText = _processAndFormatCelebrations(state.pendingConsolidationHabitIds, 'aiCelebration66Day', STREAK_CONSOLIDATED);
    const allCelebrations = [celebration66DayText, celebration21DayText].filter(Boolean).join('\n\n');
    if (allCelebrations) { state.pending21DayHabitIds = []; state.pendingConsolidationHabitIds = []; saveState(); }
    return allCelebrations;
}
