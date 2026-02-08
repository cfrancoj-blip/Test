
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners/cards.ts
 * @description Controlador de Interação de Itens da Lista (Cartões de Hábito).
 */

import { ui } from '../render/ui';
import { state, TimeOfDay } from '../state';
import { getCurrentGoalForInstance, getEffectiveScheduleForHabitOnDate } from '../services/selectors';
import { openNotesModal, renderExploreHabits, openModal } from '../render';
import { toggleHabitStatus, setGoalOverride, requestHabitTimeRemoval, requestHabitEndingFromModal } from '../services/habitActions';
import { triggerHaptic } from '../utils';
import { DOM_SELECTORS, CSS_CLASSES } from '../render/constants';

const GOAL_STEP = 5, MAX_GOAL = 9999;
const SELECTOR = `${DOM_SELECTORS.HABIT_CONTENT_WRAPPER}, ${DOM_SELECTORS.GOAL_CONTROL_BTN}, ${DOM_SELECTORS.GOAL_VALUE_WRAPPER}, ${DOM_SELECTORS.SWIPE_DELETE_BTN}, ${DOM_SELECTORS.SWIPE_NOTE_BTN}, ${DOM_SELECTORS.EMPTY_GROUP_PLACEHOLDER}`;

/**
 * Cria o efeito visual de ripple (onda) na posição do clique.
 */
const createRipple = (e: MouseEvent, container: HTMLElement) => {
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    
    const rect = container.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    
    container.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
};

// Helper for Direct Input Logic
const _handleGoalInput = (wrapper: HTMLElement, hId: string, time: TimeOfDay) => {
    // Prevent double activation
    if (wrapper.querySelector('input')) return;

    const habit = state.habits.find(h => h.id === hId);
    if (!habit) return;

    const currentVal = getCurrentGoalForInstance(habit, state.selectedDate, time);
    const originalHTML = wrapper.innerHTML;

    // Create Input
    wrapper.innerHTML = '';
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(currentVal);
    input.className = 'goal-input-inline';
    input.min = '1';
    input.max = String(MAX_GOAL);
    
    // Stop propagation on input click to prevent bubbling
    input.addEventListener('click', (e) => e.stopPropagation());

    const saveAndClose = () => {
        let newVal = parseInt(input.value, 10);
        if (isNaN(newVal) || newVal < 1) newVal = 1;
        if (newVal > MAX_GOAL) newVal = MAX_GOAL;

        if (newVal !== currentVal) {
            setGoalOverride(hId, state.selectedDate, time, newVal);
            triggerHaptic('medium');
        } else {
            // Restore visual if no change (re-render handles it usually via updateHabitCardElement logic, but we restore here just in case)
            wrapper.innerHTML = originalHTML;
        }
    };

    input.addEventListener('blur', saveAndClose);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });

    wrapper.appendChild(input);
    input.focus();
};

const _handleContainerClick = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>(SELECTOR);
    if (!el) return;

    if (el.classList.contains(CSS_CLASSES.EMPTY_GROUP_PLACEHOLDER)) {
        const time = el.dataset.time
            || el.closest<HTMLElement>('[data-time]')?.dataset.time
            || el.closest<HTMLElement>('[data-time-wrapper]')?.dataset.timeWrapper;
        state.pendingHabitTime = (time as TimeOfDay) || null;
        triggerHaptic('light'); renderExploreHabits(); openModal(ui.exploreModal); return;
    }

    const card = el.closest<HTMLElement>(DOM_SELECTORS.HABIT_CARD);
    const { habitId: hId, time } = card?.dataset || {};
    if (!hId || !time) return;
    const t = time as TimeOfDay;

    if (el.classList.contains(CSS_CLASSES.SWIPE_DELETE_BTN)) {
        triggerHaptic('light');
        const h = state.habits.find(x => x.id === hId);
        if (h && getEffectiveScheduleForHabitOnDate(h, state.selectedDate).length <= 1) requestHabitEndingFromModal(hId);
        else requestHabitTimeRemoval(hId, t);
        return;
    }

    if (el.classList.contains(CSS_CLASSES.SWIPE_NOTE_BTN)) {
        triggerHaptic('light'); openNotesModal(hId, state.selectedDate, t); return;
    }

    // DIRECT INPUT (Edit Goal Value)
    if (el.classList.contains(CSS_CLASSES.GOAL_VALUE_WRAPPER)) {
        e.stopPropagation();
        _handleGoalInput(el, hId, t);
        return;
    }

    if (el.classList.contains(CSS_CLASSES.GOAL_CONTROL_BTN)) {
        e.stopPropagation();
        const habit = state.habits.find(h => h.id === hId);
        if (!habit) return;
        const act = el.dataset.action, cur = getCurrentGoalForInstance(habit, state.selectedDate, t);
        const next = act === 'increment' ? Math.min(MAX_GOAL, cur + GOAL_STEP) : Math.max(1, cur - GOAL_STEP);
        
        // VISUAL FEEDBACK FIX [2025-06-03]: Add animation class to wrapper
        const wrapper = el.parentElement?.querySelector(`.${CSS_CLASSES.GOAL_VALUE_WRAPPER}`);
        if (wrapper) {
            wrapper.classList.remove('increase', 'decrease');
            void (wrapper as HTMLElement).offsetWidth; // Force Reflow
            wrapper.classList.add(next > cur ? 'increase' : 'decrease');
            // Cleanup class to allow re-triggering later
            setTimeout(() => wrapper.classList.remove('increase', 'decrease'), 700);
        }

        setGoalOverride(hId, state.selectedDate, t, next);
        triggerHaptic('light'); return;
    }

    if (el.classList.contains(CSS_CLASSES.HABIT_CONTENT_WRAPPER)) {
        if (card!.classList.contains(CSS_CLASSES.IS_OPEN_LEFT) || card!.classList.contains(CSS_CLASSES.IS_OPEN_RIGHT)) {
            card!.classList.remove(CSS_CLASSES.IS_OPEN_LEFT, CSS_CLASSES.IS_OPEN_RIGHT); return;
        }

        // --- EFEITO VISUAL RIPPLE ---
        const rippleContainer = el.querySelector('.ripple-container') as HTMLElement;
        if (rippleContainer) {
            createRipple(e, rippleContainer);
        }

        triggerHaptic('light');

        // --- AÇÃO IMEDIATA ---
        toggleHabitStatus(hId, t, state.selectedDate);
    }
};

export function setupCardListeners() {
    ui.habitContainer.addEventListener('click', _handleContainerClick);
}
