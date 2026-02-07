
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file render/habits.ts
 * @description Motor de Renderização de Cartões de Hábito (Virtual DOM-lite).
 */

import { state, Habit, HabitDayData, STREAK_CONSOLIDATED, STREAK_SEMI_CONSOLIDATED, TimeOfDay, getHabitDailyInfoForDate, TIMES_OF_DAY, HabitDailyInfo, HABIT_STATE } from '../state';
import { calculateHabitStreak, getActiveHabitsForDate, getSmartGoalForHabit, getHabitDisplayInfo, getHabitPropertiesForDate } from '../services/selectors';
import { ui } from './ui';
import { t, formatInteger } from '../i18n';
import { UI_ICONS, getTimeOfDayIcon } from './icons';
import { setTextContent } from './dom';
import { CSS_CLASSES, DOM_SELECTORS } from './constants';
import { parseUTCIsoDate } from '../utils';
import { HabitService } from '../services/HabitService';

const habitElementCache = new Map<string, HTMLElement>();
const habitsByTimePool: Record<TimeOfDay, Habit[]> = { 'Morning': [], 'Afternoon': [], 'Evening': [] };
const groupDomCache = new Map<TimeOfDay, { wrapper: HTMLElement; group: HTMLElement; marker: HTMLElement }>();

type CardElements = {
    icon: HTMLElement; contentWrapper: HTMLElement; name: HTMLElement; subtitle: HTMLElement;
    details: HTMLElement; consolidationMsg: HTMLElement; noteBtn: HTMLElement; deleteBtn: HTMLElement;
    goal: HTMLElement; goalProgress?: HTMLElement; goalUnit?: HTMLElement;
    goalDecBtn?: HTMLButtonElement; goalIncBtn?: HTMLButtonElement; cachedIconHtml?: string;
};
const cardElementsCache = new WeakMap<HTMLElement, CardElements>();

function getGroupDOM(time: TimeOfDay) {
    let cached = groupDomCache.get(time);
    if (!cached && ui.habitContainer) {
        const wrapper = ui.habitContainer.querySelector<HTMLElement>(`.habit-group-wrapper[data-time-wrapper="${time}"]`);
        const group = wrapper?.querySelector<HTMLElement>(`.${CSS_CLASSES.HABIT_GROUP}[data-time="${time}"]`);
        const marker = wrapper?.querySelector<HTMLElement>('.time-marker');
        if (wrapper && group && marker) {
            cached = { wrapper, group, marker };
            groupDomCache.set(time, cached);
        }
    }
    return cached;
}

// TEMPLATES
let goalControlsTemplate: HTMLElement | null = null;
const statusTemplates: Record<string, HTMLElement> = {};
let habitCardTemplate: HTMLElement | null = null;
let placeholderTemplate: HTMLElement | null = null;

const getGoalControlsTemplate = () => goalControlsTemplate || (goalControlsTemplate = (() => {
    const div = document.createElement('div');
    div.className = CSS_CLASSES.HABIT_GOAL_CONTROLS;
    div.innerHTML = `<button type="button" class="${CSS_CLASSES.GOAL_CONTROL_BTN}" data-action="decrement">-</button><div class="${CSS_CLASSES.GOAL_VALUE_WRAPPER}"><div class="progress"></div><div class="unit"></div></div><button type="button" class="${CSS_CLASSES.GOAL_CONTROL_BTN}" data-action="increment">+</button>`;
    return div;
})());

const getStatusWrapperTemplate = (cls: string, icon: string) => statusTemplates[cls] || (statusTemplates[cls] = (() => {
    const w = document.createElement('div'); w.className = cls; w.innerHTML = icon; return w;
})());

const getPlaceholderTemplate = () => placeholderTemplate || (placeholderTemplate = (() => {
    const p = document.createElement('div'); p.className = CSS_CLASSES.EMPTY_GROUP_PLACEHOLDER;
    p.setAttribute('role', 'button'); p.setAttribute('tabindex', '0'); return p;
})());

const getHabitCardTemplate = () => habitCardTemplate || (habitCardTemplate = (() => {
    const li = document.createElement('li'); li.className = CSS_CLASSES.HABIT_CARD;
    // REMOVED: draggable="true" - Agora gerenciado via Pointer Events no listeners/swipe.ts
    li.innerHTML = `<div class="habit-actions-left"><button type="button" class="${CSS_CLASSES.SWIPE_DELETE_BTN}">${UI_ICONS.swipeDelete}</button></div><div class="habit-actions-right"><button type="button" class="${CSS_CLASSES.SWIPE_NOTE_BTN}">${UI_ICONS.swipeNote}</button></div><div class="${CSS_CLASSES.HABIT_CONTENT_WRAPPER}" role="button" tabindex="0"><div class="habit-icon"></div><div class="${CSS_CLASSES.HABIT_DETAILS}"><div class="name"></div><div class="subtitle"></div><div class="consolidation-message" hidden></div></div><div class="habit-goal"></div><div class="ripple-container"></div></div>`;
    return li;
})());

// Otimiza a criação de chaves de cache para evitar repetição de string literal.
const _getCacheKey = (habitId: string, time: TimeOfDay): string => `${habitId}|${time}`;

export const clearHabitDomCache = () => habitElementCache.clear();
export const getCachedHabitCard = (id: string, t: TimeOfDay) => habitElementCache.get(_getCacheKey(id, t));

function _renderPendingGoalControls(habit: Habit, time: TimeOfDay, dayData: HabitDayData | undefined, els: CardElements) {
    const schedule = getHabitPropertiesForDate(habit, state.selectedDate);
    if (!schedule) { if (els.goal.hasChildNodes()) els.goal.replaceChildren(); return; }

    if (schedule.goal.type === 'check') { if (els.goal.hasChildNodes()) els.goal.replaceChildren(); return; }
    
    // 1. Ensure Container Exists
    let controls = els.goal.querySelector(`.${CSS_CLASSES.HABIT_GOAL_CONTROLS}`);
    if (!controls) {
        els.goal.replaceChildren(getGoalControlsTemplate().cloneNode(true));
        controls = els.goal.firstElementChild;
        // Reset cache references as they are invalid now
        els.goalDecBtn = els.goalIncBtn = els.goalProgress = els.goalUnit = undefined;
    }

    // 2. Ensure Inner Elements Integrity (Self-Healing DOM)
    // Se o usuário usou o Direct Input, o conteúdo do wrapper foi substituído por um <input>.
    // Precisamos restaurar a estrutura <div>.progress</div> se ela não existir.
    const wrapper = controls!.querySelector(`.${CSS_CLASSES.GOAL_VALUE_WRAPPER}`) as HTMLElement;
    const progressEl = wrapper.querySelector('.progress');
    
    if (!progressEl) {
        // ROBUSTNESS: Restaura estrutura destruída
        wrapper.innerHTML = `<div class="progress"></div><div class="unit"></div>`;
        els.goalProgress = wrapper.querySelector('.progress') as HTMLElement;
        els.goalUnit = wrapper.querySelector('.unit') as HTMLElement;
    } else if (!els.goalProgress || !els.goalProgress.isConnected) {
        // Re-bind se o cache estiver estragado
        els.goalProgress = progressEl as HTMLElement;
        els.goalUnit = wrapper.querySelector('.unit') as HTMLElement;
    }

    // 3. Ensure Buttons
    if (!els.goalDecBtn || !els.goalDecBtn.isConnected) els.goalDecBtn = controls!.querySelector(`[data-action="decrement"]`) as HTMLButtonElement;
    if (!els.goalIncBtn || !els.goalIncBtn.isConnected) els.goalIncBtn = controls!.querySelector(`[data-action="increment"]`) as HTMLButtonElement;

    // 4. Update Values
    const cur = dayData?.goalOverride ?? getSmartGoalForHabit(habit, state.selectedDate, time);
    if (els.goalDecBtn) els.goalDecBtn.disabled = cur <= 1;
    if (els.goalProgress) setTextContent(els.goalProgress, formatInteger(cur));
    
    if (els.goalUnit) setTextContent(els.goalUnit, t(schedule.goal.unitKey || 'unitCheck', { count: cur }));
}

export function updateHabitCardElement(card: HTMLElement, habit: Habit, time: TimeOfDay, preInfo?: Record<string, HabitDailyInfo>, options?: { animate?: boolean }) {
    const els = cardElementsCache.get(card)!;
    
    // 1. LEITURA DE STATUS VIA BITMASK (Fonte da Verdade)
    const bitStatus = HabitService.getStatus(habit.id, state.selectedDate, time);
    let status: string = CSS_CLASSES.PENDING;
    
    if (bitStatus === HABIT_STATE.DONE || bitStatus === HABIT_STATE.DONE_PLUS) {
        status = CSS_CLASSES.COMPLETED;
    } else if (bitStatus === HABIT_STATE.DEFERRED) {
        status = CSS_CLASSES.SNOOZED;
    }

    // ARETE LOGIC: Exposição de Estado 'Done+' (Superação) no DOM para estilização CSS.
    // Evita Layout Thrashing checando o atributo antes de setar.
    if (bitStatus === HABIT_STATE.DONE_PLUS) {
        if (card.dataset.arete !== 'true') card.dataset.arete = 'true';
    } else {
        if (card.dataset.arete) card.removeAttribute('data-arete');
    }

    // 2. LEITURA DE DADOS RICOS (Legado JSON - Notas/Override)
    // Usado APENAS para metadados, nunca para status de conclusão.
    const info = (preInfo || getHabitDailyInfoForDate(state.selectedDate))[habit.id]?.instances?.[time];
    
    const streak = calculateHabitStreak(habit, state.selectedDate);
    const { name, subtitle } = getHabitDisplayInfo(habit, state.selectedDate);

    if (!card.classList.contains(status)) {
        card.classList.remove(CSS_CLASSES.PENDING, CSS_CLASSES.COMPLETED, CSS_CLASSES.SNOOZED);
        card.classList.add(status);
        if (status === CSS_CLASSES.COMPLETED && options?.animate) {
            els.icon.classList.remove('animate-pop'); void els.icon.offsetWidth; els.icon.classList.add('animate-pop');
        }
    }

    const schedule = getHabitPropertiesForDate(habit, state.selectedDate);
    if (!schedule) return;

    // SECURITY FIX: Only allow SVG icons via innerHTML; escape anything else
    if (els.cachedIconHtml !== schedule.icon) {
        const safeIcon = schedule.icon && schedule.icon.trim().startsWith('<svg') ? schedule.icon : (schedule.icon || '');
        els.icon.innerHTML = els.cachedIconHtml = safeIcon;
    }
    els.icon.style.color = schedule.color;
    // RESTORED [2025-06-15]: Match Explore Modal style (Color + Opacity 30 for background)
    els.icon.style.backgroundColor = schedule.color + '30';
    
    const isCons = streak >= STREAK_CONSOLIDATED, isSemi = streak >= STREAK_SEMI_CONSOLIDATED && !isCons;
    card.classList.toggle('consolidated', isCons); card.classList.toggle('semi-consolidated', isSemi);
    
    setTextContent(els.name, name); setTextContent(els.subtitle, subtitle);
    const msg = isCons ? t('habitConsolidatedMessage') : (isSemi ? t('habitSemiConsolidatedMessage') : '');
    setTextContent(els.consolidationMsg, msg); els.consolidationMsg.hidden = !msg;

    const hasN = !!info?.note;
    if (els.noteBtn.dataset.hasNote !== String(hasN)) {
        els.noteBtn.innerHTML = hasN ? UI_ICONS.swipeNoteHasNote : UI_ICONS.swipeNote;
        els.noteBtn.dataset.hasNote = String(hasN);
    }

    if (status === CSS_CLASSES.COMPLETED) els.goal.replaceChildren(getStatusWrapperTemplate('completed-wrapper', UI_ICONS.check).cloneNode(true));
    else if (status === CSS_CLASSES.SNOOZED) els.goal.replaceChildren(getStatusWrapperTemplate('snoozed-wrapper', UI_ICONS.snoozed).cloneNode(true));
    else _renderPendingGoalControls(habit, time, info, els);
}

function createHabitCardElement(habit: Habit, time: TimeOfDay, preInfo?: Record<string, HabitDailyInfo>): HTMLElement {
    const card = getHabitCardTemplate().cloneNode(true) as HTMLElement;
    card.dataset.habitId = habit.id; card.dataset.time = time;
    const key = _getCacheKey(habit.id, time);
    habitElementCache.set(key, card);

    const al = card.firstElementChild!, ar = al.nextElementSibling!, cw = ar.nextElementSibling!;
    const det = cw.children[1] as HTMLElement, goal = cw.children[2] as HTMLElement;
    cardElementsCache.set(card, {
        icon: cw.children[0] as HTMLElement, contentWrapper: cw as HTMLElement,
        name: det.children[0] as HTMLElement, subtitle: det.children[1] as HTMLElement,
        details: det, consolidationMsg: det.children[2] as HTMLElement,
        noteBtn: ar.firstElementChild as HTMLElement, deleteBtn: al.firstElementChild as HTMLElement, goal
    });
    updateHabitCardElement(card, habit, time, preInfo);
    return card;
}

export function renderHabits() {
    // FIX: INTERACTION LOCK. Adiciona verificação de is-dragging-active.
    // Se o usuário está arrastando (Drag Mode), NÃO podemos re-renderizar a lista, 
    // pois isso destruiria o elemento DOM que está sendo arrastado e que o motor de física segue.
    if (document.body.classList.contains('is-interaction-active') || document.body.classList.contains('is-dragging-active') || !state.uiDirtyState.habitListStructure) return;
    
    const selDate = parseUTCIsoDate(state.selectedDate), dInfo = getHabitDailyInfoForDate(state.selectedDate);
    const active = getActiveHabitsForDate(state.selectedDate, selDate);
    
    TIMES_OF_DAY.forEach(t => habitsByTimePool[t].length = 0);
    for (let i = 0; i < active.length; i++) {
        const { habit, schedule } = active[i];
        for (let j = 0; j < schedule.length; j++) habitsByTimePool[schedule[j]].push(habit);
    }

    const empty = TIMES_OF_DAY.filter(t => habitsByTimePool[t].length === 0);
    const activeKeysThisRender = new Set<string>();

    TIMES_OF_DAY.forEach(time => {
        const dom = getGroupDOM(time); if (!dom) return;
        const habits = habitsByTimePool[time], hasH = habits.length > 0;
        
        dom.marker.style.display = hasH ? '' : 'none';
        if (hasH) dom.marker.innerHTML = getTimeOfDayIcon(time);

        const newChildren: HTMLElement[] = [];
        if (hasH) {
            for (let i = 0; i < habits.length; i++) {
                const habit = habits[i];
                const key = _getCacheKey(habit.id, time);
                activeKeysThisRender.add(key);

                let card = habitElementCache.get(key);
                if (card) {
                    // FIX: Não remove classes de estado persistente (IS_OPEN_*) ou interação ativa (IS_SWIPING)
                    card.classList.remove(CSS_CLASSES.DRAGGING);
                    updateHabitCardElement(card, habit, time, dInfo);
                } else {
                    card = createHabitCardElement(habit, time, dInfo);
                }
                newChildren.push(card);
            }
        }

        const isSmart = time === empty[0];
        dom.wrapper.classList.toggle('has-habits', hasH);
        dom.wrapper.classList.toggle('is-collapsible', !hasH && !isSmart);

        if (!hasH) {
            let ph = dom.group.querySelector<HTMLElement>(DOM_SELECTORS.EMPTY_GROUP_PLACEHOLDER);
            if (!ph) {
                ph = getPlaceholderTemplate().cloneNode(true) as HTMLElement;
            }
            ph.dataset.time = time;
            ph.classList.toggle('show-smart-placeholder', isSmart);
            const iconHtml = isSmart ? `<span class="placeholder-icon-generic">${empty.map(getTimeOfDayIcon).join('<span class="icon-separator">/</span>')}</span><span class="placeholder-icon-specific">${getTimeOfDayIcon(time)}</span>` : `<span class="placeholder-icon-specific">${getTimeOfDayIcon(time)}</span>`;
            ph.innerHTML = `<div class="time-of-day-icon">${iconHtml}</div><span class="placeholder-arrow">→</span><span>${t('dragToAddHabit')}</span>`;
            newChildren.push(ph);
        }
        
        dom.group.replaceChildren(...newChildren);
    });

    for (const key of habitElementCache.keys()) {
        if (!activeKeysThisRender.has(key)) {
            habitElementCache.delete(key);
        }
    }

    state.uiDirtyState.habitListStructure = false;
}
