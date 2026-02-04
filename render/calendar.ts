/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file render/calendar.ts
 * @description Motor de Renderização do Calendário (Strip & Almanac) com Suporte a Infinite Scroll e Teleport.
 */

import { state } from '../state';
import { calculateDaySummary } from '../services/selectors';
import { ui } from './ui';
import { getTodayUTCIso, toUTCIsoDateString, parseUTCIsoDate, addDays, pad2 } from '../utils';
import { formatInteger, getLocaleDayName } from '../i18n'; 
import { setTextContent } from './dom';
import { CSS_CLASSES } from './constants';
import { CALENDAR_INITIAL_BUFFER_DAYS, CALENDAR_MAX_DOM_NODES } from '../constants';

// --- CONFIGURAÇÃO SWEET SPOT ---
const INITIAL_BUFFER_DAYS = CALENDAR_INITIAL_BUFFER_DAYS;
const MAX_DOM_NODES = CALENDAR_MAX_DOM_NODES;

let dayItemTemplate: HTMLElement | null = null;
let fullCalendarDayTemplate: HTMLElement | null = null;
type DayCacheEntry = { el: HTMLElement; ringEl: HTMLElement; numEl: HTMLElement };
const dayElementCache = new Map<string, DayCacheEntry>();

const OPTS_ARIA = { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' } as const;

// --- TEMPLATES (Lazy Init) ---

const getDayItemTemplate = () => dayItemTemplate || (dayItemTemplate = (() => {
    const el = document.createElement('div'); el.className = CSS_CLASSES.DAY_ITEM; el.setAttribute('role', 'button');
    el.innerHTML = `<span class="${CSS_CLASSES.DAY_NAME}"></span><div class="${CSS_CLASSES.DAY_PROGRESS_RING}"><span class="${CSS_CLASSES.DAY_NUMBER}"></span></div>`;
    return el;
})());

const getFullCalendarDayTemplate = () => fullCalendarDayTemplate || (fullCalendarDayTemplate = (() => {
    const el = document.createElement('div'); el.className = 'full-calendar-day'; el.setAttribute('role', 'button');
    el.innerHTML = `<div class="${CSS_CLASSES.DAY_PROGRESS_RING}"><span class="${CSS_CLASSES.DAY_NUMBER}"></span></div>`;
    return el;
})());

// --- CORE RENDERING (STRIP) ---

function applyDayVisuals(el: HTMLElement, dateISO: string, dateObj?: Date, ringEl?: HTMLElement, numEl?: HTMLElement) {
    const ring = ringEl ?? (el.querySelector(`.${CSS_CLASSES.DAY_PROGRESS_RING}`) as HTMLElement);
    const num = numEl ?? (ring.firstElementChild as HTMLElement);
    
    const { completedPercent, snoozedPercent, showPlusIndicator } = calculateDaySummary(dateISO, dateObj);
    
    ring.style.setProperty('--completed-percent', `${completedPercent}%`);
    ring.style.setProperty('--snoozed-percent', `${snoozedPercent}%`);
    
    if (showPlusIndicator) num.classList.add('has-plus');
    else num.classList.remove('has-plus');
}

function createDayElement(dateISO: string, isSelected: boolean, isToday: boolean): HTMLElement {
    const el = getDayItemTemplate().cloneNode(true) as HTMLElement;
    const dateObj = parseUTCIsoDate(dateISO);
    
    el.dataset.date = dateISO; 
    
    const dayNameEl = el.firstElementChild as HTMLElement;
    const ringEl = dayNameEl.nextElementSibling as HTMLElement;
    const numEl = ringEl.firstElementChild as HTMLElement;

    setTextContent(dayNameEl, getLocaleDayName(dateObj));
    setTextContent(numEl, formatInteger(dateObj.getUTCDate()));
    
    if (isSelected) el.classList.add(CSS_CLASSES.SELECTED);
    if (isToday) el.classList.add(CSS_CLASSES.TODAY);

    applyDayVisuals(el, dateISO, dateObj, ringEl, numEl);

    el.setAttribute('aria-label', dateObj.toLocaleDateString(state.activeLanguageCode, OPTS_ARIA));
    if (isSelected) {
        el.setAttribute('aria-current', 'date');
        el.setAttribute('tabindex', '0');
    } else {
        el.setAttribute('tabindex', '-1');
    }

    dayElementCache.set(dateISO, { el, ringEl, numEl });

    return el;
}

export function updateDayVisuals(dateISO: string) {
    if (!ui.calendarStrip) return;
    
    let entry = dayElementCache.get(dateISO);

    if (!entry || !entry.el.isConnected) {
        const el = ui.calendarStrip.querySelector(`[data-date="${dateISO}"]`) as HTMLElement | null;
        if (el) {
            const ringEl = el.querySelector(`.${CSS_CLASSES.DAY_PROGRESS_RING}`) as HTMLElement;
            const numEl = ringEl?.firstElementChild as HTMLElement;
            entry = ringEl && numEl ? { el, ringEl, numEl } : undefined;
            if (entry) dayElementCache.set(dateISO, entry);
        }
    }

    if (entry) applyDayVisuals(entry.el, dateISO, undefined, entry.ringEl, entry.numEl);

    if (ui.fullCalendarGrid && ui.fullCalendarGrid.children.length > 0) {
        const fullEl = ui.fullCalendarGrid.querySelector(`[data-date="${dateISO}"]`) as HTMLElement | null;
        if (fullEl) {
            const ring = fullEl.firstElementChild as HTMLElement;
            const num = ring?.firstElementChild as HTMLElement;
            if (ring && num) applyDayVisuals(fullEl, dateISO, undefined, ring, num);
        }
    }
}

export function renderCalendar() {
    if (!ui.calendarStrip) return;

    if (!state.uiDirtyState.calendarVisuals && ui.calendarStrip.children.length > 0) return;

    const centerDateISO = state.selectedDate || getTodayUTCIso();
    const centerDate = parseUTCIsoDate(centerDateISO);
    const todayISO = getTodayUTCIso();
    
    const frag = document.createDocumentFragment();

    for (let i = -INITIAL_BUFFER_DAYS; i <= INITIAL_BUFFER_DAYS; i++) {
        const d = addDays(centerDate, i);
        const iso = toUTCIsoDateString(d);
        const el = createDayElement(iso, iso === centerDateISO, iso === todayISO);
        frag.appendChild(el);
    }

    ui.calendarStrip.innerHTML = '';
    dayElementCache.clear();
    ui.calendarStrip.appendChild(frag);
    
    state.uiDirtyState.calendarVisuals = false;
    
    requestAnimationFrame(() => scrollToSelectedDate(false));
}

/**
 * [INFINITE SCROLL] Adiciona um dia ao final da lista (Futuro).
 * OTIMIZAÇÃO: Remove nós antigos do topo se exceder MAX_DOM_NODES.
 */
export function appendDayToStrip(lastDateISO: string, container: Node = ui.calendarStrip): string {
    const nextDate = addDays(parseUTCIsoDate(lastDateISO), 1);
    const iso = toUTCIsoDateString(nextDate);
    const todayISO = getTodayUTCIso();
    
    const el = createDayElement(iso, iso === state.selectedDate, iso === todayISO);
    container.appendChild(el);

    // [GARBAGE COLLECTION] Mantém o DOM leve
    if (container === ui.calendarStrip && ui.calendarStrip.children.length > MAX_DOM_NODES) {
        const removed = ui.calendarStrip.firstElementChild as HTMLElement | null;
        if (removed?.dataset.date) dayElementCache.delete(removed.dataset.date);
        removed?.remove();
    }

    return iso;
}

/**
 * [INFINITE SCROLL] Adiciona um dia ao início da lista (Passado).
 * OTIMIZAÇÃO: Remove nós futuros do final se exceder MAX_DOM_NODES.
 */
export function prependDayToStrip(firstDateISO: string, container: Node = ui.calendarStrip): string {
    const prevDate = addDays(parseUTCIsoDate(firstDateISO), -1);
    const iso = toUTCIsoDateString(prevDate);
    const todayISO = getTodayUTCIso();

    const el = createDayElement(iso, iso === state.selectedDate, iso === todayISO);
    
    if (container instanceof DocumentFragment) {
        container.prepend(el);
    } else {
        (container as HTMLElement).insertBefore(el, (container as HTMLElement).firstElementChild);
    }

    // [GARBAGE COLLECTION] Mantém o DOM leve
    if (container === ui.calendarStrip && ui.calendarStrip.children.length > MAX_DOM_NODES) {
        const removed = ui.calendarStrip.lastElementChild as HTMLElement | null;
        if (removed?.dataset.date) dayElementCache.delete(removed.dataset.date);
        removed?.remove();
    }

    return iso;
}

// --- FULL CALENDAR (ALMANAC) ---

export function renderFullCalendar() {
    if (!ui.fullCalendarGrid || !state.fullCalendar) return;

    const { year, month } = state.fullCalendar;
    
    ui.fullCalendarMonthYear.textContent = new Date(Date.UTC(year, month, 1))
        .toLocaleDateString(state.activeLanguageCode, { month: 'long', year: 'numeric', timeZone: 'UTC' });

    const frag = document.createDocumentFragment();
    const first = new Date(Date.UTC(year, month, 1));
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const startDayOfWeek = first.getUTCDay(); // 0 = Domingo
    const prevMonthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();

    // Dias do mês anterior (Cinza)
    for (let i = 0; i < startDayOfWeek; i++) {
        const d = prevMonthDays - startDayOfWeek + 1 + i;
        const el = getFullCalendarDayTemplate().cloneNode(true) as HTMLElement;
        el.classList.add('other-month');
        el.setAttribute('aria-disabled', 'true');
        el.setAttribute('tabindex', '-1');
        (el.firstElementChild!.firstElementChild as HTMLElement).textContent = formatInteger(d);
        frag.appendChild(el);
    }

    // Dias do mês atual
    const todayISO = getTodayUTCIso();
    const prefix = `${year}-${pad2(month + 1)}-`;

    for (let i = 1; i <= daysInMonth; i++) {
        const iso = prefix + pad2(i);
        const dateObj = parseUTCIsoDate(iso);
        const el = getFullCalendarDayTemplate().cloneNode(true) as HTMLElement;
        const ring = el.firstElementChild as HTMLElement;
        const num = ring.firstElementChild as HTMLElement;
        
        num.textContent = formatInteger(i);
        el.dataset.date = iso;
        el.setAttribute('aria-label', dateObj.toLocaleDateString(state.activeLanguageCode, OPTS_ARIA));

        const { completedPercent, snoozedPercent, showPlusIndicator } = calculateDaySummary(iso, dateObj);
        
        if (completedPercent > 0) ring.style.setProperty('--completed-percent', `${completedPercent}%`);
        if (snoozedPercent > 0) ring.style.setProperty('--snoozed-percent', `${snoozedPercent}%`);
        if (showPlusIndicator) num.classList.add('has-plus');

        if (iso === state.selectedDate) {
            el.classList.add(CSS_CLASSES.SELECTED);
            el.setAttribute('aria-current', 'date');
            el.setAttribute('tabindex', '0');
        } else {
            el.setAttribute('tabindex', '-1');
        }
        if (iso === todayISO) el.classList.add(CSS_CLASSES.TODAY);

        frag.appendChild(el);
    }

    ui.fullCalendarGrid.innerHTML = '';
    ui.fullCalendarGrid.appendChild(frag);
}

/**
 * Rola a fita para posicionar o elemento selecionado.
 * LÓGICA CONTEXTUAL: "Hoje" alinha à direita (histórico), outros centralizam.
 */
export function scrollToSelectedDate(smooth = true) {
    if (!ui.calendarStrip) return;
    
    requestAnimationFrame(() => {
        const selectedEl = ui.calendarStrip.querySelector(`.${CSS_CLASSES.SELECTED}`) as HTMLElement;
        
        if (selectedEl) {
            const stripWidth = ui.calendarStrip.clientWidth;
            const elLeft = selectedEl.offsetLeft;
            const elWidth = selectedEl.offsetWidth;
            const isToday = selectedEl.classList.contains(CSS_CLASSES.TODAY);
            
            let targetScroll;

            if (isToday) {
                // ALIGN END (Right): Prioriza o passado imediato
                const paddingRight = 10;
                targetScroll = (elLeft + elWidth) - stripWidth + paddingRight;
            } else {
                // ALIGN CENTER: Contexto balanceado
                targetScroll = elLeft - (stripWidth / 2) + (elWidth / 2);
            }
            
            ui.calendarStrip.scrollTo({
                left: targetScroll,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
    });
}