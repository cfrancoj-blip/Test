/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners/calendar.ts
 * @description Controlador de Interação do Calendário (Gestos e Infinite Scroll).
 */

import { ui } from '../render/ui';
import { state } from '../state';
import { renderApp, renderFullCalendar, openModal, closeModal } from '../render';
import { appendDayToStrip, prependDayToStrip, scrollToSelectedDate } from '../render/calendar';
import { parseUTCIsoDate, triggerHaptic, getTodayUTCIso } from '../utils';
import { CSS_CLASSES, DOM_SELECTORS } from '../render/constants';
import {
    CALENDAR_SCROLL_THRESHOLD_PX,
    CALENDAR_BASE_BATCH_SIZE,
    CALENDAR_TURBO_BATCH_SIZE,
    CALENDAR_TURBO_TIME_WINDOW_MS,
    CALENDAR_MAX_DOM_NODES,
    CALENDAR_LONG_PRESS_MS
} from '../constants';
import { markAllHabitsForDate } from '../services/habitActions';

// --- CONFIGURAÇÃO ADAPTATIVA ---
const SCROLL_THRESHOLD_PX = CALENDAR_SCROLL_THRESHOLD_PX; // Pixels antes da borda para disparar
const BASE_BATCH_SIZE = CALENDAR_BASE_BATCH_SIZE;      // Modo Padrão: Navegação casual
const TURBO_BATCH_SIZE = CALENDAR_TURBO_BATCH_SIZE;     // Modo Turbo: Navegação rápida ("Viagem no tempo")
const TURBO_TIME_WINDOW_MS = CALENDAR_TURBO_TIME_WINDOW_MS; // Janela de tempo para ativar o Turbo
const DOM_CAP = CALENDAR_MAX_DOM_NODES;       // Limite de nós no DOM

// --- STATE MACHINE ---
const CalendarGestureState = {
    isScrolling: false,
    scrollRafId: 0,
    // Long press logic
    pressTimerId: 0,
    isLongPress: false,
    activeDateISO: null as string | null,
    // Heurística de Engajamento
    lastFetchTime: 0
};

// --- SCROLL LOGIC (ADAPTIVE INFINITE) ---

const _handleScroll = () => {
    if (CalendarGestureState.isScrolling) return;
    CalendarGestureState.isScrolling = true;

    CalendarGestureState.scrollRafId = requestAnimationFrame(() => {
        const strip = ui.calendarStrip;
        if (!strip) { 
            CalendarGestureState.isScrolling = false; 
            CalendarGestureState.scrollRafId = 0;
            return; 
        }

        const scrollLeft = strip.scrollLeft;
        const scrollWidth = strip.scrollWidth;
        const clientWidth = strip.clientWidth;
        const maxScroll = scrollWidth - clientWidth; // Distância máxima rolável

        // HEURÍSTICA ADAPTATIVA:
        // Determina a intenção do usuário baseada na velocidade de consumo de dados.
        const now = Date.now();
        const isTurbo = (now - CalendarGestureState.lastFetchTime) < TURBO_TIME_WINDOW_MS;
        const currentBatch = isTurbo ? TURBO_BATCH_SIZE : BASE_BATCH_SIZE;

        // 1. Chegou no início (Passado) -> Prepend
        if (scrollLeft < SCROLL_THRESHOLD_PX) {
            CalendarGestureState.lastFetchTime = now;
            
            const firstEl = strip.firstElementChild as HTMLElement;
            if (firstEl && firstEl.dataset.date) {
                let currentFirstISO = firstEl.dataset.date;
                
                // Batch Creation in Fragment (Otimização de Reflow)
                const frag = document.createDocumentFragment();
                for (let i = 0; i < currentBatch; i++) {
                    currentFirstISO = prependDayToStrip(currentFirstISO, frag);
                }
                
                // SCROLL ANCHORING: Medir largura antiga para ajustar scroll
                const oldWidth = strip.scrollWidth;
                strip.insertBefore(frag, strip.firstElementChild);
                const newWidth = strip.scrollWidth;
                
                // Ajusta o scroll para manter o usuário parado visualmente (Anti-Jumping)
                strip.scrollLeft += (newWidth - oldWidth);

                // DOM CAP: Remove do final se muito grande para poupar memória
                if (strip.children.length > DOM_CAP) {
                    for (let i = 0; i < currentBatch; i++) strip.lastElementChild?.remove();
                }
            }
        }
        
        // 2. Chegou no final (Futuro) -> Append
        else if (maxScroll - scrollLeft < SCROLL_THRESHOLD_PX) {
            CalendarGestureState.lastFetchTime = now;
            
            const lastEl = strip.lastElementChild as HTMLElement;
            if (lastEl && lastEl.dataset.date) {
                let currentLastISO = lastEl.dataset.date;
                
                const frag = document.createDocumentFragment();
                for (let i = 0; i < currentBatch; i++) {
                    currentLastISO = appendDayToStrip(currentLastISO, frag);
                }
                strip.appendChild(frag);

                // DOM CAP: Remove do início
                if (strip.children.length > DOM_CAP) {
                    const removeCount = currentBatch;
                    // Ao remover do início, o scrollLeft muda automaticamente.
                    // Precisamos compensar essa mudança para manter a posição relativa.
                    const oldWidth = strip.scrollWidth;
                    for (let i = 0; i < removeCount; i++) strip.firstElementChild?.remove();
                    const newWidth = strip.scrollWidth;
                    
                    strip.scrollLeft -= (oldWidth - newWidth);
                }
            }
        }

        CalendarGestureState.isScrolling = false;
        CalendarGestureState.scrollRafId = 0;
    });
};

// --- CLICK & GESTURE HANDLERS ---

const _handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const item = (e.target as HTMLElement).closest<HTMLElement>(DOM_SELECTORS.DAY_ITEM);
    if (!item || !item.dataset.date) return;

    CalendarGestureState.isLongPress = false;
    CalendarGestureState.activeDateISO = item.dataset.date;
    item.classList.add('is-pressing');

    CalendarGestureState.pressTimerId = window.setTimeout(() => {
        CalendarGestureState.isLongPress = true;
        triggerHaptic('medium');
        item.classList.remove('is-pressing');
        _openQuickActions(item);
    }, CALENDAR_LONG_PRESS_MS);

    const cancel = () => {
        clearTimeout(CalendarGestureState.pressTimerId);
        item.classList.remove('is-pressing');
        window.removeEventListener('pointerup', cancel);
        window.removeEventListener('pointercancel', cancel);
    };
    window.addEventListener('pointerup', cancel, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
};

const _handleStripClick = (e: MouseEvent) => {
    if (CalendarGestureState.isLongPress) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }

    const item = (e.target as HTMLElement).closest<HTMLElement>(DOM_SELECTORS.DAY_ITEM);
    
    if (item && item.dataset.date) {
        const clickedDate = item.dataset.date;
        
        if (state.selectedDate !== clickedDate) {
            triggerHaptic('selection');
            state.selectedDate = clickedDate;
            
            const prev = ui.calendarStrip.querySelector(`.${CSS_CLASSES.SELECTED}`);
            if (prev) {
                prev.classList.remove(CSS_CLASSES.SELECTED);
                prev.setAttribute('aria-current', 'false');
                prev.setAttribute('tabindex', '-1');
            }
            item.classList.add(CSS_CLASSES.SELECTED);
            item.setAttribute('aria-current', 'date');
            item.setAttribute('tabindex', '0');
            
            // Render App Content (Habits)
            state.uiDirtyState.habitListStructure = true;
            state.uiDirtyState.chartData = true;
            document.dispatchEvent(new CustomEvent('render-app'));
        }
    }
};

const _openQuickActions = (anchorEl: HTMLElement) => {
    const dateISO = anchorEl.dataset.date;
    if (!dateISO) return;
    
    const rect = anchorEl.getBoundingClientRect();
    const modal = ui.calendarQuickActions;
    const content = modal.querySelector<HTMLElement>('.quick-actions-content');
    if (!content) return;

    const top = rect.bottom + 8;
    const center = rect.left + rect.width / 2;
    
    modal.style.setProperty('--actions-top', `${top}px`);
    modal.style.setProperty('--actions-left', `${center}px`);
    content.style.setProperty('--translate-x', '-50%'); 

    openModal(modal);
};

const _handleResetToToday = () => {
    triggerHaptic('light');
    const today = getTodayUTCIso();
    
    const todayEl = ui.calendarStrip.querySelector(`.${CSS_CLASSES.TODAY}`);
    
    if (todayEl && state.selectedDate === today) {
        scrollToSelectedDate(true);
    } else {
        // Reset Total: Limpa e recria em volta de hoje
        state.selectedDate = today;
        state.uiDirtyState.calendarVisuals = true; 
        state.uiDirtyState.habitListStructure = true;
        renderApp();
    }
};

// --- SETUP ---

export function setupCalendarListeners() {
    // Strip Interactions
    ui.calendarStrip.addEventListener('pointerdown', _handlePointerDown);
    ui.calendarStrip.addEventListener('click', _handleStripClick);
    ui.calendarStrip.addEventListener('scroll', _handleScroll, { passive: true });
    
    // Navigation Buttons
    ui.headerTitle.addEventListener('click', _handleResetToToday);
    ui.navArrowPast.addEventListener('click', _handleResetToToday);
    ui.navArrowFuture.addEventListener('click', _handleResetToToday);

    // Quick Actions Logic
    const _handleQuickAction = (action: 'completed' | 'snoozed' | 'almanac') => {
        const date = CalendarGestureState.activeDateISO;
        closeModal(ui.calendarQuickActions);
        
        if (action === 'almanac') {
            triggerHaptic('light');
            if (date) {
                const d = parseUTCIsoDate(date);
                state.fullCalendar = { year: d.getUTCFullYear(), month: d.getUTCMonth() };
            }
            renderFullCalendar();
            openModal(ui.fullCalendarModal);
            return;
        }

        if (date) {
            triggerHaptic(action === 'completed' ? 'success' : 'medium');
            markAllHabitsForDate(date, action);
        }
    };

    ui.quickActionDone.addEventListener('click', () => _handleQuickAction('completed'));
    ui.quickActionSnooze.addEventListener('click', () => _handleQuickAction('snoozed'));
    ui.quickActionAlmanac.addEventListener('click', () => _handleQuickAction('almanac'));
}