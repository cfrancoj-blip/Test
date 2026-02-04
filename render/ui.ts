
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file render/ui.ts
 * @description Registro Central de Referências DOM (UI Registry).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo atua como um cache inteligente (Lazy-Loaded) para referências de elementos DOM.
 * 
 * ARQUITETURA (Lazy Singleton & O(1) Access):
 * - **Lazy Access:** Elementos só são consultados no DOM (`querySelector`) na primeira vez que são acessados.
 * - **Memoization:** Referências são cacheadas em `uiCache`, tornando acessos subsequentes instantâneos.
 * - **Type Safety:** Interface `UIElements` garante autocompletar e verificação de tipos em todo o projeto.
 */

export interface UIElements {
    appContainer: HTMLElement;
    calendarStrip: HTMLElement;
    headerTitle: HTMLElement;
    headerTitleDesktop: HTMLElement;
    headerTitleMobile: HTMLElement;
    navArrowPast: HTMLElement;
    navArrowFuture: HTMLElement;
    stoicQuoteDisplay: HTMLElement;
    habitContainer: HTMLElement;
    chartContainer: HTMLElement;
    manageHabitsBtn: HTMLButtonElement;
    fabAddHabit: HTMLButtonElement;
    manageModal: HTMLElement;
    manageModalTitle: HTMLElement;
    habitListTitle: HTMLElement;
    exploreModal: HTMLElement;
    exploreHabitList: HTMLElement;
    createCustomHabitBtn: HTMLButtonElement;
    aiEvalBtn: HTMLButtonElement;
    aiModal: HTMLElement;
    aiOptionsModal: HTMLElement;
    confirmModal: HTMLElement;
    habitList: HTMLElement;
    noHabitsMessage: HTMLElement;
    aiResponse: HTMLElement;
    confirmModalText: HTMLElement;
    confirmModalConfirmBtn: HTMLButtonElement;
    confirmModalEditBtn: HTMLButtonElement;
    notesModal: HTMLElement;
    notesModalTitle: HTMLElement;
    notesModalSubtitle: HTMLElement;
    notesTextarea: HTMLTextAreaElement;
    saveNoteBtn: HTMLButtonElement;
    resetAppBtn: HTMLButtonElement;
    languagePrevBtn: HTMLButtonElement;
    languageViewport: HTMLElement;
    languageReel: HTMLElement;
    languageNextBtn: HTMLButtonElement;
    editHabitModal: HTMLElement;
    editHabitModalTitle: HTMLElement;
    editHabitForm: HTMLFormElement;
    habitSubtitleDisplay: HTMLElement;
    editHabitSaveBtn: HTMLButtonElement;
    habitTimeContainer: HTMLElement;
    frequencyOptionsContainer: HTMLElement;
    syncStatus: HTMLElement;
    syncSection: HTMLElement;
    syncInactiveView: HTMLElement;
    enableSyncBtn: HTMLButtonElement;
    enterKeyViewBtn: HTMLButtonElement;
    syncEnterKeyView: HTMLElement;
    syncKeyInput: HTMLInputElement;
    cancelEnterKeyBtn: HTMLButtonElement;
    submitKeyBtn: HTMLButtonElement;
    syncDisplayKeyView: HTMLElement;
    syncKeyText: HTMLElement;
    copyKeyBtn: HTMLButtonElement;
    keySavedBtn: HTMLButtonElement;
    syncActiveView: HTMLElement;
    viewKeyBtn: HTMLButtonElement;
    disableSyncBtn: HTMLButtonElement;
    notificationToggle: HTMLInputElement;
    notificationToggleLabel: HTMLLabelElement;
    notificationStatusDesc: HTMLElement;
    iconPickerModal: HTMLElement;
    iconPickerGrid: HTMLElement;
    habitIconPickerBtn: HTMLButtonElement;
    colorPickerModal: HTMLElement;
    colorPickerGrid: HTMLElement;
    changeColorFromPickerBtn: HTMLButtonElement;
    fullCalendarModal: HTMLElement;
    fullCalendarHeader: HTMLElement;
    fullCalendarMonthYear: HTMLElement;
    fullCalendarPrevBtn: HTMLButtonElement;
    fullCalendarNextBtn: HTMLButtonElement;
    fullCalendarWeekdays: HTMLElement;
    fullCalendarGrid: HTMLElement;
    calendarQuickActions: HTMLElement;
    quickActionDone: HTMLButtonElement;
    quickActionSnooze: HTMLButtonElement;
    quickActionAlmanac: HTMLButtonElement;
    labelLanguage: HTMLElement;
    labelSync: HTMLElement;
    labelNotifications: HTMLElement;
    labelReset: HTMLElement;
    labelPrivacy: HTMLElement;
    exportDataBtn: HTMLButtonElement;
    importDataBtn: HTMLButtonElement;
    syncInactiveDesc: HTMLElement;
    labelEnterKey: HTMLElement;
    syncWarningText: HTMLElement;
    syncActiveDesc: HTMLElement;
    iconPickerTitle: HTMLElement;
    colorPickerTitle: HTMLElement;
    syncErrorMsg: HTMLElement;
    
    // Dynamic Injected Elements
    habitConscienceDisplay: HTMLElement;
    
    chart: {
        title: HTMLElement;
        subtitle: HTMLElement;
        emptyState: HTMLElement;
        dataView: HTMLElement;
        wrapper: HTMLElement;
        svg: SVGSVGElement;
        areaPath: SVGPathElement;
        linePath: SVGPathElement;
        tooltip: HTMLElement;
        tooltipDate: HTMLElement;
        tooltipScoreLabel: HTMLElement;
        tooltipScoreValue: HTMLElement;
        tooltipHabits: HTMLElement;
        indicator: HTMLElement;
        evolutionIndicator: HTMLElement;
        axisStart: HTMLElement;
        axisEnd: HTMLElement;
    }
}

// MEMORY: Cache "Flat" para acesso O(1).
// Usamos 'any' internamente para evitar overhead de tipos complexos no runtime.
const uiCache: Record<string, Element> = {};
const chartCache: Record<string, Element> = {};

/**
 * Utilitário de consulta DOM otimizado (Micro-optimization).
 * @param selector String seletora CSS.
 * @param isOptional Se true, suprime erro caso elemento não seja encontrado.
 */
function queryElement(selector: string, isOptional = false): Element | null {
    // PERFORMANCE OPTIMIZATION: Hybrid Selector Strategy.
    // Detectamos seletores de ID simples para usar o caminho rápido (Fast Path).
    const isSimpleId = selector.charCodeAt(0) === 35 /* # */ && !/[\s.\[]/.test(selector);
    
    const element = isSimpleId
        ? document.getElementById(selector.slice(1))
        : document.querySelector(selector);

    if (!element && !isOptional) {
        throw new Error(`UI element "${selector}" not found.`);
    }
    return element as Element;
}

/**
 * Configura um getter lazy no objeto alvo.
 * @param target Objeto onde a propriedade será definida.
 * @param prop Nome da propriedade.
 * @param selector Seletor CSS.
 * @param cache Objeto de cache a ser usado.
 * @param isOptional Se true, permite que o elemento não exista no DOM inicialmente.
 */
function defineLazy(target: any, prop: string, selector: string, cache: Record<string, Element>, isOptional = false) {
    Object.defineProperty(target, prop, {
        get: function() {
            // Check cache direct property access (Fastest in V8)
            if (cache[prop] === undefined) {
                const el = queryElement(selector, isOptional);
                if (el) cache[prop] = el;
                return el;
            }
            return cache[prop];
        },
        enumerable: true,
        configurable: false
    });
}

// Inicializa o objeto UI
export const ui = {} as UIElements;

// --- ROOT ELEMENTS DEFINITION ---
// Batch definition avoids creating intermediate objects.
defineLazy(ui, 'appContainer', '.app-container', uiCache);
defineLazy(ui, 'calendarStrip', '#calendar-strip', uiCache);
defineLazy(ui, 'headerTitle', '#header-title', uiCache);
defineLazy(ui, 'headerTitleDesktop', '#header-title .header-title-desktop', uiCache);
defineLazy(ui, 'headerTitleMobile', '#header-title .header-title-mobile', uiCache);
defineLazy(ui, 'navArrowPast', '#nav-arrow-past', uiCache);
defineLazy(ui, 'navArrowFuture', '#nav-arrow-future', uiCache);
defineLazy(ui, 'stoicQuoteDisplay', '#stoic-quote-display', uiCache);
defineLazy(ui, 'habitContainer', '#habit-container', uiCache);
defineLazy(ui, 'chartContainer', '#chart-container', uiCache);
defineLazy(ui, 'manageHabitsBtn', '#manage-habits-btn', uiCache);
defineLazy(ui, 'fabAddHabit', '#fab-add-habit', uiCache);
defineLazy(ui, 'manageModal', '#manage-modal', uiCache);
defineLazy(ui, 'manageModalTitle', '#manage-modal-title', uiCache);
defineLazy(ui, 'habitListTitle', '#habit-list-title', uiCache);
defineLazy(ui, 'exploreModal', '#explore-modal', uiCache);
defineLazy(ui, 'exploreHabitList', '#explore-habit-list', uiCache);
defineLazy(ui, 'createCustomHabitBtn', '#create-custom-habit-btn', uiCache);
defineLazy(ui, 'aiEvalBtn', '#ai-eval-btn', uiCache);
defineLazy(ui, 'aiModal', '#ai-modal', uiCache);
defineLazy(ui, 'aiOptionsModal', '#ai-options-modal', uiCache);
defineLazy(ui, 'confirmModal', '#confirm-modal', uiCache);
defineLazy(ui, 'habitList', '#habit-list', uiCache);
defineLazy(ui, 'noHabitsMessage', '#no-habits-message', uiCache);
defineLazy(ui, 'aiResponse', '#ai-response', uiCache);
defineLazy(ui, 'confirmModalText', '#confirm-modal-text', uiCache);
defineLazy(ui, 'confirmModalConfirmBtn', '#confirm-modal-confirm-btn', uiCache);
defineLazy(ui, 'confirmModalEditBtn', '#confirm-modal-edit-btn', uiCache);
defineLazy(ui, 'notesModal', '#notes-modal', uiCache);
defineLazy(ui, 'notesModalTitle', '#notes-modal-title', uiCache);
defineLazy(ui, 'notesModalSubtitle', '#notes-modal-subtitle', uiCache);
defineLazy(ui, 'notesTextarea', '#notes-textarea', uiCache);
defineLazy(ui, 'saveNoteBtn', '#save-note-btn', uiCache);
defineLazy(ui, 'resetAppBtn', '#reset-app-btn', uiCache);
defineLazy(ui, 'languagePrevBtn', '#language-prev', uiCache);
defineLazy(ui, 'languageViewport', '#language-viewport', uiCache);
defineLazy(ui, 'languageReel', '#language-reel', uiCache);
defineLazy(ui, 'languageNextBtn', '#language-next', uiCache);
defineLazy(ui, 'editHabitModal', '#edit-habit-modal', uiCache);
defineLazy(ui, 'editHabitModalTitle', '#edit-habit-modal-title', uiCache);
defineLazy(ui, 'editHabitForm', '#edit-habit-form', uiCache);
defineLazy(ui, 'habitSubtitleDisplay', '#habit-subtitle-display', uiCache);
defineLazy(ui, 'editHabitSaveBtn', '#edit-habit-save-btn', uiCache);
defineLazy(ui, 'habitTimeContainer', '#habit-time-container', uiCache);
defineLazy(ui, 'frequencyOptionsContainer', '#frequency-options-container', uiCache);
defineLazy(ui, 'syncStatus', '#sync-status', uiCache);
defineLazy(ui, 'syncSection', '#sync-section', uiCache);
defineLazy(ui, 'syncInactiveView', '#sync-inactive-view', uiCache);
defineLazy(ui, 'enableSyncBtn', '#enable-sync-btn', uiCache);
defineLazy(ui, 'enterKeyViewBtn', '#enter-key-view-btn', uiCache);
defineLazy(ui, 'syncEnterKeyView', '#sync-enter-key-view', uiCache);
defineLazy(ui, 'syncKeyInput', '#sync-key-input', uiCache);
defineLazy(ui, 'cancelEnterKeyBtn', '#cancel-enter-key-btn', uiCache);
defineLazy(ui, 'submitKeyBtn', '#submit-key-btn', uiCache);
defineLazy(ui, 'syncDisplayKeyView', '#sync-display-key-view', uiCache);
defineLazy(ui, 'syncKeyText', '#sync-key-text', uiCache);
defineLazy(ui, 'copyKeyBtn', '#copy-key-btn', uiCache);
defineLazy(ui, 'keySavedBtn', '#key-saved-btn', uiCache);
defineLazy(ui, 'syncActiveView', '#sync-active-view', uiCache);
defineLazy(ui, 'viewKeyBtn', '#view-key-btn', uiCache);
defineLazy(ui, 'disableSyncBtn', '#disable-sync-btn', uiCache);
defineLazy(ui, 'notificationToggle', '#notification-toggle', uiCache);
defineLazy(ui, 'notificationToggleLabel', '#notification-toggle-label', uiCache);
defineLazy(ui, 'notificationStatusDesc', '#notification-status-desc', uiCache);
defineLazy(ui, 'iconPickerModal', '#icon-picker-modal', uiCache);
defineLazy(ui, 'iconPickerGrid', '#icon-picker-grid', uiCache);
defineLazy(ui, 'habitIconPickerBtn', '#habit-icon-picker-btn', uiCache);
defineLazy(ui, 'colorPickerModal', '#color-picker-modal', uiCache);
defineLazy(ui, 'colorPickerGrid', '#color-picker-grid', uiCache);
defineLazy(ui, 'changeColorFromPickerBtn', '#change-color-from-picker-btn', uiCache);
defineLazy(ui, 'fullCalendarModal', '#full-calendar-modal', uiCache);
defineLazy(ui, 'fullCalendarHeader', '#full-calendar-header', uiCache);
defineLazy(ui, 'fullCalendarMonthYear', '#full-calendar-month-year', uiCache);
defineLazy(ui, 'fullCalendarPrevBtn', '#full-calendar-prev', uiCache);
defineLazy(ui, 'fullCalendarNextBtn', '#full-calendar-next', uiCache);
defineLazy(ui, 'fullCalendarWeekdays', '#full-calendar-weekdays', uiCache);
defineLazy(ui, 'fullCalendarGrid', '#full-calendar-grid', uiCache);
defineLazy(ui, 'calendarQuickActions', '#calendar-quick-actions', uiCache);
defineLazy(ui, 'quickActionDone', '#quick-action-done', uiCache);
defineLazy(ui, 'quickActionSnooze', '#quick-action-snooze', uiCache);
defineLazy(ui, 'quickActionAlmanac', '#quick-action-almanac', uiCache);
defineLazy(ui, 'labelLanguage', '#label-language', uiCache);
defineLazy(ui, 'labelSync', '#label-sync', uiCache);
defineLazy(ui, 'labelNotifications', '#label-notifications', uiCache);
defineLazy(ui, 'labelReset', '#label-reset', uiCache);
defineLazy(ui, 'labelPrivacy', '#label-privacy', uiCache);
defineLazy(ui, 'exportDataBtn', '#export-data-btn', uiCache);
defineLazy(ui, 'importDataBtn', '#import-data-btn', uiCache);
defineLazy(ui, 'syncInactiveDesc', '#sync-inactive-desc', uiCache);
defineLazy(ui, 'labelEnterKey', '#label-enter-key', uiCache);
defineLazy(ui, 'syncWarningText', '#sync-warning-text', uiCache);
defineLazy(ui, 'syncActiveDesc', '#sync-active-desc', uiCache);
defineLazy(ui, 'iconPickerTitle', '#icon-picker-modal-title', uiCache);
defineLazy(ui, 'colorPickerTitle', '#color-picker-modal-title', uiCache);
defineLazy(ui, 'habitConscienceDisplay', '#habit-conscience-display', uiCache, true);
defineLazy(ui, 'syncErrorMsg', '#sync-error-msg', uiCache);

// --- CHART ELEMENTS SUB-OBJECT ---
ui.chart = {} as UIElements['chart'];
defineLazy(ui.chart, 'title', '#chart-container .chart-title', chartCache);
defineLazy(ui.chart, 'subtitle', '#chart-container .app-subtitle', chartCache);
defineLazy(ui.chart, 'emptyState', '#chart-container .chart-empty-state', chartCache);
defineLazy(ui.chart, 'dataView', '#chart-container .chart-data-view', chartCache);
defineLazy(ui.chart, 'wrapper', '#chart-container .chart-wrapper', chartCache);
defineLazy(ui.chart, 'svg', '.chart-svg', chartCache);
defineLazy(ui.chart, 'areaPath', '.chart-area', chartCache);
defineLazy(ui.chart, 'linePath', '.chart-line', chartCache);
defineLazy(ui.chart, 'tooltip', '#chart-container .chart-tooltip', chartCache);
defineLazy(ui.chart, 'tooltipDate', '#chart-container .tooltip-date', chartCache);
defineLazy(ui.chart, 'tooltipScoreLabel', '#chart-container .tooltip-score-label', chartCache);
defineLazy(ui.chart, 'tooltipScoreValue', '#chart-container .tooltip-score-value', chartCache);
defineLazy(ui.chart, 'tooltipHabits', '#chart-container .tooltip-habits li', chartCache);
defineLazy(ui.chart, 'indicator', '#chart-container .chart-indicator', chartCache);
defineLazy(ui.chart, 'evolutionIndicator', '#chart-container .chart-evolution-indicator', chartCache);
defineLazy(ui.chart, 'axisStart', '#chart-container .chart-axis-labels span:first-child', chartCache);
defineLazy(ui.chart, 'axisEnd', '#chart-container .chart-axis-labels span:last-child', chartCache);