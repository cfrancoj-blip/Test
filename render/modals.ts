
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file render/modals.ts
 * @description Motor de Renderização de Modais e Diálogos (UI Overlay Layer).
 */

import { state, Habit, HabitTemplate, Frequency, PredefinedHabit, TimeOfDay, STREAK_CONSOLIDATED, TIMES_OF_DAY, FREQUENCIES, LANGUAGES, getHabitDailyInfoForDate, MAX_HABIT_NAME_LENGTH } from '../state';
import { PREDEFINED_HABITS } from '../data/predefinedHabits';
import { getScheduleForDate, calculateHabitStreak, getHabitDisplayInfo } from '../services/selectors';
import { ui } from './ui';
import { t, compareStrings, formatDate, formatInteger, getTimeOfDayName } from '../i18n';
import { HABIT_ICONS, UI_ICONS, getTimeOfDayIcon } from './icons';
import { setTextContent, updateReelRotaryARIA } from './dom';
import { MODAL_COLORS, EXPLORE_STAGGER_DELAY_MS } from './constants';
import { escapeHTML, getContrastColor, parseUTCIsoDate, getTodayUTCIso, getSafeDate, triggerHaptic } from '../utils';

interface ModalContext { element: HTMLElement; previousFocus: HTMLElement | null; onClose?: () => void; firstFocusable?: HTMLElement; lastFocusable?: HTMLElement; }
const modalStack: ModalContext[] = [];
const OPTS_NOTES = { day: 'numeric', month: 'long', timeZone: 'UTC' } as const;

function _getLeastUsedColor(): string {
    const counts = new Map<string, number>(MODAL_COLORS.map(c => [c, 0]));
    state.habits.forEach(h => {
        const lastSchedule = h.scheduleHistory[h.scheduleHistory.length - 1];
        if (!h.graduatedOn && lastSchedule && counts.has(lastSchedule.color)) {
            counts.set(lastSchedule.color, counts.get(lastSchedule.color)! + 1);
        }
    });
    let min = Math.min(...counts.values());
    const candidates = MODAL_COLORS.filter(c => counts.get(c) === min);
    return candidates[state.habits.length % candidates.length];
}

export function initModalEngine() {
    document.addEventListener('keydown', e => {
        const ctx = modalStack[modalStack.length - 1]; if (!ctx) return;
        if (e.key === 'Escape') {
            triggerHaptic('light');
            closeModal(ctx.element);
        }
        else if (e.key === 'Tab') {
            const { firstFocusable: f, lastFocusable: l } = ctx;
            if (f && l) {
                if (e.shiftKey && document.activeElement === f) { l.focus(); e.preventDefault(); }
                else if (!e.shiftKey && document.activeElement === l) { f.focus(); e.preventDefault(); }
            }
        }
    });
    document.addEventListener('click', e => {
        const ctx = modalStack[modalStack.length - 1]; if (!ctx) return;
        if (e.target === ctx.element) {
            triggerHaptic('light');
            closeModal(ctx.element);
        }
    });
}

export function openModal(modal: HTMLElement, focusEl?: HTMLElement, onClose?: () => void) {
    const ctx: ModalContext = { element: modal, previousFocus: document.activeElement as HTMLElement, onClose };
    
    const header = modal.querySelector('.modal-header');
    if (header) {
        const spacer = header.querySelector('.modal-header-spacer');
        if (spacer && !spacer.previousElementSibling?.classList.contains('modal-back-btn')) {
            const backBtn = document.createElement('button');
            backBtn.className = 'modal-back-btn';
            backBtn.innerHTML = UI_ICONS.backArrow;
            backBtn.setAttribute('aria-label', t('aria_go_back'));
            backBtn.addEventListener('click', () => {
                triggerHaptic('light');
                closeModal(modal);
            });
            spacer.replaceWith(backBtn);
        }
    }
    
    modal.classList.add('visible');
    const fobs = modal.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (fobs.length) { ctx.firstFocusable = fobs[0]; ctx.lastFocusable = fobs[fobs.length - 1]; setTimeout(() => (focusEl || fobs[0]).focus(), 100); }
    modalStack.push(ctx); ui.appContainer.setAttribute('inert', '');
}

export function closeModal(modal: HTMLElement, suppressCallbacks = false) {
    const idx = modalStack.findIndex(c => c.element === modal); if (idx === -1) return;
    const [ctx] = modalStack.splice(idx, 1); modal.classList.remove('visible');
    if (modalStack.length === 0) ui.appContainer.removeAttribute('inert');
    
    const header = modal.querySelector('.modal-header');
    const backBtn = header?.querySelector('.modal-back-btn');
    if (header && backBtn) {
        const spacer = document.createElement('div');
        spacer.className = 'modal-header-spacer';
        backBtn.replaceWith(spacer);
    }

    if (!suppressCallbacks) ctx.onClose?.(); 
    ctx.previousFocus?.focus();
}

export function setupManageModal() {
    if (!state.uiDirtyState.habitListStructure && ui.habitList.children.length > 0) return;
    // FILTER: Hide logically deleted habits
    const activeHabits = state.habits.filter(h => !h.deletedOn);

    if (activeHabits.length === 0) { 
        ui.habitList.classList.add('hidden'); 
        ui.noHabitsMessage.classList.remove('hidden'); 
        return; 
    }
    
    ui.habitList.classList.remove('hidden'); 
    ui.noHabitsMessage.classList.add('hidden');
    
    const items = activeHabits.map(h => {
        const { name, subtitle } = getHabitDisplayInfo(h);
        const st = h.graduatedOn ? 'graduated' : (h.scheduleHistory[h.scheduleHistory.length-1].endDate ? 'ended' : 'active');
        return { h, st, name, subtitle };
    }).sort((a, b) => {
        const order = { active: 0, graduated: 1, ended: 2 };
        // @ts-ignore
        return (order[a.st] - order[b.st]) || compareStrings(a.name, b.name);
    });
    
    const today = getTodayUTCIso();
    
    ui.habitList.innerHTML = items.map(({ h, st, name, subtitle }) => {
        const lastSchedule = h.scheduleHistory[h.scheduleHistory.length - 1];
        const safeName = escapeHTML(name);
        const safeSubtitle = subtitle ? escapeHTML(subtitle) : '';
        const ariaGraduate = escapeHTML(t('aria_graduate', { name }));
        const ariaEnd = escapeHTML(t('aria_end', { name }));
        const ariaDelete = escapeHTML(t('aria_delete_permanent', { name }));
        return `<li class="habit-list-item ${st}" data-habit-id="${h.id}"><span class="habit-main-info"><span class="habit-icon-slot" style="color:${escapeHTML(lastSchedule.color)}">${lastSchedule.icon && lastSchedule.icon.trim().startsWith('<svg') ? lastSchedule.icon : escapeHTML(lastSchedule.icon || '')}</span><div style="display:flex;flex-direction:column;flex-grow:1;"><span class="habit-name">${safeName}</span>${subtitle ? `<span class="habit-subtitle" style="font-size:11px;color:var(--text-tertiary)">${safeSubtitle}</span>` : ''}</div>${st !== 'active' ? `<span class="habit-name-status">${t(st === 'graduated' ? 'modalStatusGraduated' : 'modalStatusEnded')}</span>` : ''}</span><div class="habit-list-actions">${st === 'active' ? `${calculateHabitStreak(h, today) >= STREAK_CONSOLIDATED ? `<button class="graduate-habit-btn" aria-label="${ariaGraduate}">${UI_ICONS.graduateAction}</button>` : `<button class="end-habit-btn" aria-label="${ariaEnd}">${UI_ICONS.endAction}</button>`}` : `<button class="permanent-delete-habit-btn" aria-label="${ariaDelete}">${UI_ICONS.deletePermanentAction}</button>`}</div></li>`;
    }).join('');

    state.uiDirtyState.habitListStructure = false;
}

export function showConfirmationModal(text: string, onConfirm: () => void, opts?: any) {
    ui.confirmModalText.innerHTML = text;
    state.confirmAction = onConfirm;
    state.confirmEditAction = opts?.onEdit || null;
    setTextContent(ui.confirmModal.querySelector('h2'), opts?.title || t('modalConfirmTitle'));
    ui.confirmModalConfirmBtn.className = `btn ${opts?.confirmButtonStyle === 'danger' ? 'btn--danger' : 'btn--primary'}`;
    setTextContent(ui.confirmModalConfirmBtn, opts?.confirmText || t('confirmButton'));
    ui.confirmModalEditBtn.classList.toggle('hidden', !opts?.onEdit);
    if (opts?.editText) setTextContent(ui.confirmModalEditBtn, opts.editText);

    const onCancel = () => {
        state.confirmAction = null;
        state.confirmEditAction = null;
        opts?.onCancel?.(); 
    };

    openModal(ui.confirmModal, undefined, onCancel);
}

export function openNotesModal(habitId: string, date: string, time: TimeOfDay) {
    const h = state.habits.find(x => x.id === habitId); if (!h) return;
    state.editingNoteFor = { habitId, date, time };
    setTextContent(ui.notesModalTitle, getHabitDisplayInfo(h, date).name);
    setTextContent(ui.notesModalSubtitle, `${formatDate(parseUTCIsoDate(date), OPTS_NOTES)} - ${getTimeOfDayName(time)}`);
    ui.notesTextarea.value = getHabitDailyInfoForDate(date)[habitId]?.instances[time]?.note || '';
    openModal(ui.notesModal, ui.notesTextarea, () => state.editingNoteFor = null);
}

export function renderIconPicker() {
    if (!state.editingHabit) return;
    const { color: bg } = state.editingHabit.formData, fg = getContrastColor(bg);
    ui.iconPickerGrid.style.setProperty('--current-habit-bg-color', bg);
    ui.iconPickerGrid.style.setProperty('--current-habit-fg-color', fg);
    ui.iconPickerGrid.innerHTML = Object.values(HABIT_ICONS).map(svg => `<button type="button" class="icon-picker-item" data-icon-svg="${escapeHTML(svg)}">${svg}</button>`).join('');
    ui.iconPickerModal.querySelector<HTMLElement>('#change-color-from-picker-btn')!.innerHTML = UI_ICONS.colorPicker;
}

export function renderColorPicker() {
    const cur = state.editingHabit?.formData.color;
    ui.colorPickerGrid.innerHTML = MODAL_COLORS.map(c => `<button type="button" class="color-swatch ${cur === c ? 'selected' : ''}" style="background-color:${c}" data-color="${c}"></button>`).join('');
}

export function renderFrequencyOptions() {
    if (!state.editingHabit) return;
    const f = state.editingHabit.formData.frequency, isD = f.type === 'daily', isS = f.type === 'specific_days_of_week', isI = f.type === 'interval';
    const days = [0,1,2,3,4,5,6]; if (state.activeLanguageCode !== 'pt') days.push(days.shift()!);
    const sel = isS ? new Set(f.days) : new Set();
    const am = isI ? f.amount : 2, un = isI ? f.unit : 'days';

    ui.frequencyOptionsContainer.innerHTML = `<div class="form-section frequency-options"><div class="form-row"><label><input type="radio" name="frequency-type" value="daily" ${isD ? 'checked' : ''}>${t('freqDaily')}</label></div><div class="form-row form-row--vertical"><label><input type="radio" name="frequency-type" value="specific_days_of_week" ${isS ? 'checked' : ''}>${t('freqSpecificDaysOfWeek')}</label><div class="frequency-details ${isS ? 'visible' : ''}"><div class="weekday-picker">${days.map(d => `<label><input type="checkbox" class="visually-hidden" data-day="${d}" ${sel.has(d) ? 'checked' : ''}><span class="weekday-button">${t(`weekday${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]}`).charAt(0)}</span></label>`).join('')}</div></div></div><div class="form-row form-row--vertical"><label><input type="radio" name="frequency-type" value="interval" ${isI ? 'checked' : ''}>${t('freqEvery')}</label><div class="frequency-details ${isI ? 'visible' : ''}"><div class="interval-control-group"><button type="button" class="stepper-btn" data-action="interval-decrement">-</button><span class="interval-amount-display">${formatInteger(am)}</span><button type="button" class="stepper-btn" data-action="interval-increment">+</button><button type="button" class="unit-toggle-btn" data-action="interval-unit-toggle">${t(un === 'days' ? 'unitDays' : 'unitWeeks', { count: am })}</button></div></div></div></div>`;
}

export function refreshEditModalUI() {
    if (!state.editingHabit) return;
    renderFrequencyOptions();
    const fd = state.editingHabit.formData;
    ui.habitTimeContainer.innerHTML = `<div class="segmented-control">${TIMES_OF_DAY.map(time => `<button type="button" class="segmented-control-option ${fd.times.includes(time) ? 'selected' : ''}" data-time="${time}">${getTimeOfDayIcon(time)}${getTimeOfDayName(time)}</button>`).join('')}</div>`;
    const nameIn = ui.editHabitForm.elements.namedItem('habit-name') as HTMLInputElement;
    if (nameIn) { 
        nameIn.placeholder = t('modalEditFormNameLabel');
        nameIn.maxLength = MAX_HABIT_NAME_LENGTH;
        if (fd.nameKey) nameIn.value = t(fd.nameKey); 
    }
    
    let ce = ui.habitConscienceDisplay;
    if (!ce && ui.editHabitForm) { ce = document.createElement('div'); ce.id = 'habit-conscience-display'; ce.className = 'habit-conscience-text'; ui.editHabitForm.querySelector('.habit-identity-section')?.insertAdjacentElement('afterend', ce); }
    if (ce) { const p = fd.philosophy; if (p?.conscienceKey) { setTextContent(ce, t(p.conscienceKey)); ce.style.display = 'block'; } else ce.style.display = 'none'; }
}

export function openEditModal(habit: any, targetDateOverride?: string, onClose?: () => void) {
    const isN = !habit || !habit.id;
    const safe = getSafeDate(targetDateOverride || state.selectedDate);

    let fd: HabitTemplate;
    if (isN) {
        // Para novos hábitos (a partir de template ou customizado), não há risco de mutação
        fd = { icon: HABIT_ICONS.custom, color: _getLeastUsedColor(), times: ['Morning'], goal: { type: 'check' }, frequency: { type: 'daily' }, name: '', subtitleKey: 'customHabitSubtitle', ...habit };
        if (state.pendingHabitTime) {
            fd.times = [state.pendingHabitTime];
        }
    } else {
        // Para edição, cria cópias defensivas para isolar o formulário do estado original
        const scheduleToEdit = getScheduleForDate(habit, safe) || habit.scheduleHistory[0];
        
        const originalFrequency = scheduleToEdit.frequency;
        const newFrequency: Frequency = originalFrequency.type === 'specific_days_of_week' 
            ? { ...originalFrequency, days: [...originalFrequency.days] } 
            : { ...originalFrequency };

        fd = {
            ...(scheduleToEdit as any), // Cast para evitar erro de tipo com name/nameKey
            times: [...scheduleToEdit.times],
            frequency: newFrequency,
            goal: { ...scheduleToEdit.goal }
        };
    }

    state.pendingHabitTime = null;

    state.editingHabit = { isNew: isN, habitId: isN ? undefined : habit.id, originalData: isN ? undefined : habit, formData: fd, targetDate: safe };
    const ni = ui.editHabitForm.elements.namedItem('habit-name') as HTMLInputElement;
    if (ni) {
        ni.maxLength = MAX_HABIT_NAME_LENGTH;
        ni.value = isN ? (fd.nameKey ? t(fd.nameKey) : '') : getHabitDisplayInfo(habit, safe).name;
    }
    const btn = ui.habitIconPickerBtn; btn.innerHTML = fd.icon; btn.style.backgroundColor = fd.color; btn.style.color = getContrastColor(fd.color);
    
    const subtitle = isN 
        ? (fd.subtitleKey ? t(fd.subtitleKey) : '') 
        : getHabitDisplayInfo(habit, safe).subtitle;
    if (ui.habitSubtitleDisplay) {
        setTextContent(ui.habitSubtitleDisplay, subtitle);
    }
    
    const overlay = btn.nextElementSibling as HTMLElement;
    if (overlay && overlay.classList.contains('edit-icon-overlay')) {
        overlay.innerHTML = HABIT_ICONS.learnSkill;
    }

    refreshEditModalUI(); openModal(ui.editHabitModal, undefined, onClose);
}

export function renderExploreHabits() {
    ui.exploreHabitList.innerHTML = PREDEFINED_HABITS.map((h, i) => 
        `<div 
            class="explore-habit-item" 
            data-index="${i}" 
            role="button" 
            tabindex="0"
            style="--delay: ${i * EXPLORE_STAGGER_DELAY_MS}ms;"
        >
            <div class="explore-habit-icon" style="background-color:${h.color}30;color:${h.color}">${h.icon}</div>
            <div class="explore-habit-details">
                <div class="name">${t(h.nameKey)}</div>
                <div class="subtitle">${t(h.subtitleKey)}</div>
            </div>
        </div>`
    ).join('');
}

export function renderLanguageFilter() {
    const idx = LANGUAGES.findIndex(l => l.code === state.activeLanguageCode), names = LANGUAGES.map(l => t(l.nameKey));
    if (ui.languageViewport.classList.contains('is-interacting')) return;
    const w = (ui.languageReel.querySelector('.reel-option') as HTMLElement)?.offsetWidth || 95;
    ui.languageReel.style.transform = `translateX(${-idx * w}px)`;
    updateReelRotaryARIA(ui.languageViewport, idx, names, 'language_ariaLabel');
}
