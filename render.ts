/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file render.ts
 * @description Orquestrador de Renderização (View Orchestrator / Facade).
 */

import { state, LANGUAGES } from './state';
import { parseUTCIsoDate, toUTCIsoDateString, addDays, pushToOneSignal, getTodayUTCIso, createDebounced } from './utils';
import { QUOTE_COLLAPSE_DEBOUNCE_MS } from './constants';
import { ui } from './render/ui';
import { t, setLanguage, formatDate } from './i18n'; 
import { UI_ICONS } from './render/icons';
import { STOIC_QUOTES, type Quote } from './data/quotes';
import { selectBestQuote } from './services/quoteEngine'; 
import { calculateDaySummary } from './services/selectors';

// Importa os renderizadores especializados
import { setTextContent, updateReelRotaryARIA } from './render/dom';
import { renderCalendar, renderFullCalendar } from './render/calendar';
import { renderHabits } from './render/habits';
import { renderChart } from './render/chart';
import { setupManageModal, refreshEditModalUI, renderLanguageFilter, renderIconPicker, renderFrequencyOptions, openModal, showConfirmationModal } from './render/modals';

// Re-exporta tudo para manter compatibilidade
export * from './render/dom';
export * from './render/calendar';
export * from './render/habits';
export * from './render/modals';
export * from './render/chart';

/**
 * Monitor de Sincronização: Abre um diálogo com o histórico técnico de operações.
 * Essencial para o usuário validar se o "outro sistema" recebeu os dados.
 */
export function openSyncDebugModal() {
    const logs = state.syncLogs || [];
    if (logs.length === 0) {
        return showConfirmationModal("Nenhum log de sincronização disponível ainda.", () => {}, { title: "Monitor de Sync", hideCancel: true });
    }

    const logHtml = logs.slice().reverse().map(log => {
        const time = new Date(log.time).toLocaleTimeString();
        const color = log.type === 'error' ? '#ff6b6b' : (log.type === 'success' ? '#27ae60' : 'var(--text-secondary)');
        return `<div style="font-family:monospace; font-size:11px; padding:6px 0; border-bottom:1px solid var(--border-color); color:${color}">
            <span style="opacity:0.5">[${time}]</span> ${log.msg}
        </div>`;
    }).join('');

    const containerHtml = `
        <div style="max-height: 300px; overflow-y: auto; padding-right: 10px;">
            ${logHtml}
        </div>
    `;

    showConfirmationModal(containerHtml, () => {}, { 
        title: "Monitor de Sincronização", 
        confirmText: "Fechar",
        hideCancel: true 
    });
}

// --- HELPERS STATE ---
let _lastTitleDate: string | null = null;
let _lastTitleLang: string | null = null;
let _cachedQuoteState: { id: string, contextKey: string } | null = null;
let _cachedRefToday: string | null = null;
let _cachedYesterdayISO: string | null = null;
let _cachedTomorrowISO: string | null = null;

const OPTS_HEADER_DESKTOP: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', timeZone: 'UTC' };
const OPTS_HEADER_ARIA: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' };
const OPTS_HEADER_MOBILE_NUMERIC: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', timeZone: 'UTC' };

function _ensureRelativeDateCache(todayISO: string) {
    if (_cachedRefToday !== todayISO) {
        _cachedRefToday = todayISO;
        const todayDate = parseUTCIsoDate(todayISO);
        _cachedYesterdayISO = toUTCIsoDateString(addDays(todayDate, -1));
        _cachedTomorrowISO = toUTCIsoDateString(addDays(todayDate, 1));
    }
}

function _updateHeaderTitle() {
    if (_lastTitleDate === state.selectedDate && _lastTitleLang === state.activeLanguageCode) return;
    const todayISO = getTodayUTCIso();
    _ensureRelativeDateCache(todayISO);
    const selected = state.selectedDate;
    let titleKey: string | null = null;
    if (selected === todayISO) titleKey = 'headerTitleToday';
    else if (selected === _cachedYesterdayISO) titleKey = 'headerTitleYesterday';
    else if (selected === _cachedTomorrowISO) titleKey = 'headerTitleTomorrow';

    let desktopTitle: string, mobileTitle: string;
    const date = parseUTCIsoDate(selected);
    const numericDateStr = formatDate(date, OPTS_HEADER_MOBILE_NUMERIC);
    
    if (titleKey) {
        const localizedTitle = t(titleKey);
        desktopTitle = localizedTitle;
        mobileTitle = (selected === todayISO) ? localizedTitle : numericDateStr;
    } else {
        mobileTitle = numericDateStr;
        desktopTitle = formatDate(date, OPTS_HEADER_DESKTOP);
    }
    
    setTextContent(ui.headerTitleDesktop, desktopTitle);
    setTextContent(ui.headerTitleMobile, mobileTitle);
    ui.headerTitle.setAttribute('aria-label', formatDate(date, OPTS_HEADER_ARIA));

    ui.navArrowPast.classList.toggle('hidden', !(selected < todayISO));
    ui.navArrowFuture.classList.toggle('hidden', !(selected > todayISO));

    _lastTitleDate = selected;
    _lastTitleLang = state.activeLanguageCode;
}

function _renderHeaderIcons() {
    if (!ui.manageHabitsBtn.hasChildNodes()) ui.manageHabitsBtn.innerHTML = UI_ICONS.settings;
    const defaultIconSpan = ui.aiEvalBtn.querySelector('.default-icon');
    if (defaultIconSpan && !defaultIconSpan.hasChildNodes()) defaultIconSpan.innerHTML = UI_ICONS.ai;
}

export function updateUIText() {
    const appNameHtml = t('appName');
    const tempEl = document.createElement('div');
    tempEl.innerHTML = appNameHtml;
    document.title = tempEl.textContent || 'Askesis';

    ui.fabAddHabit.setAttribute('aria-label', t('fabAddHabit_ariaLabel'));
    ui.manageHabitsBtn.setAttribute('aria-label', t('manageHabits_ariaLabel'));
    ui.aiEvalBtn.setAttribute('aria-label', t('aiEval_ariaLabel'));
    
    setTextContent(ui.exploreModal.querySelector('h2'), t('modalExploreTitle'));
    setTextContent(ui.createCustomHabitBtn, t('modalExploreCreateCustom'));
    setTextContent(ui.exploreModal.querySelector('.modal-close-btn'), t('closeButton'));
    setTextContent(ui.manageModalTitle, t('modalManageTitle'));
    setTextContent(ui.habitListTitle, t('modalManageHabitsSubtitle'));
    setTextContent(ui.labelLanguage, t('modalManageLanguage'));
    ui.languagePrevBtn.setAttribute('aria-label', t('languagePrev_ariaLabel'));
    ui.languageNextBtn.setAttribute('aria-label', t('languageNext_ariaLabel'));
    setTextContent(ui.labelSync, t('syncLabel'));
    setTextContent(ui.labelNotifications, t('modalManageNotifications'));
    setTextContent(ui.labelReset, t('modalManageReset'));
    setTextContent(ui.resetAppBtn, t('modalManageResetButton'));
    setTextContent(ui.manageModal.querySelector('.modal-close-btn'), t('cancelButton'));
    setTextContent(ui.labelPrivacy, t('privacyLabel'));
    setTextContent(ui.exportDataBtn, t('exportButton'));
    setTextContent(ui.importDataBtn, t('importButton'));
    setTextContent(ui.syncInactiveDesc, t('syncInactiveDesc'));
    setTextContent(ui.enableSyncBtn, t('syncEnable'));
    setTextContent(ui.enterKeyViewBtn, t('syncEnterKey'));
    setTextContent(ui.labelEnterKey, t('syncLabelEnterKey'));
    setTextContent(ui.cancelEnterKeyBtn, t('cancelButton'));
    setTextContent(ui.submitKeyBtn, t('syncSubmitKey'));
    if (ui.syncWarningText.innerHTML !== t('syncWarning')) ui.syncWarningText.innerHTML = t('syncWarning');
    setTextContent(ui.keySavedBtn, ui.syncDisplayKeyView.dataset.context === 'view' ? t('closeButton') : t('syncKeySaved'));
    setTextContent(ui.syncActiveDesc, t('syncActiveDesc'));
    setTextContent(ui.viewKeyBtn, t('syncViewKey'));
    setTextContent(ui.disableSyncBtn, t('syncDisable'));
    setTextContent(ui.aiModal.querySelector('h2'), t('modalAITitle'));
    setTextContent(ui.aiModal.querySelector('.modal-close-btn'), t('closeButton'));
    setTextContent(ui.aiOptionsModal.querySelector('h2'), t('modalAIOptionsTitle'));
    
    const updateAiBtn = (type: string, titleKey: string, descKey: string) => {
        const btn = ui.aiOptionsModal.querySelector<HTMLElement>(`[data-analysis-type="${type}"]`);
        if (btn) {
            setTextContent(btn.querySelector('.ai-option-title'), t(titleKey));
            setTextContent(btn.querySelector('.ai-option-desc'), t(descKey));
        }
    };
    updateAiBtn('monthly', 'aiOptionMonthlyTitle', 'aiOptionMonthlyDesc');
    updateAiBtn('quarterly', 'aiOptionQuarterlyTitle', 'aiOptionQuarterlyDesc');
    updateAiBtn('historical', 'aiOptionHistoricalTitle', 'aiOptionHistoricalDesc');
    setTextContent(ui.confirmModal.querySelector('h2'), t('modalConfirmTitle'));
    setTextContent(ui.confirmModal.querySelector('.modal-close-btn'), t('cancelButton'));
    setTextContent(ui.confirmModalConfirmBtn, t('confirmButton'));
    setTextContent(ui.notesModal.querySelector('.modal-close-btn'), t('cancelButton'));
    setTextContent(ui.saveNoteBtn, t('modalNotesSaveButton'));
    ui.notesTextarea.placeholder = t('modalNotesTextareaPlaceholder');
    setTextContent(ui.iconPickerTitle, t('modalIconPickerTitle'));
    setTextContent(ui.iconPickerModal.querySelector('.modal-close-btn'), t('cancelButton'));
    setTextContent(ui.colorPickerTitle, t('modalColorPickerTitle'));
    setTextContent(ui.colorPickerModal.querySelector('.modal-close-btn'), t('cancelButton'));

    const setBtnHtml = (btn: HTMLButtonElement, icon: string, text: string) => {
        const html = `${icon} ${text}`;
        if (btn.innerHTML !== html) btn.innerHTML = html;
    };
    setBtnHtml(ui.quickActionDone, UI_ICONS.check, t('quickActionMarkAllDone'));
    setBtnHtml(ui.quickActionSnooze, UI_ICONS.snoozed, t('quickActionMarkAllSnoozed'));
    setBtnHtml(ui.quickActionAlmanac, UI_ICONS.calendar, t('quickActionOpenAlmanac'));
    setTextContent(ui.noHabitsMessage, t('modalManageNoHabits'));
    if (state.editingHabit) refreshEditModalUI();
}

/**
 * Executa renderApp() dentro de uma View Transition nativa (se suportada).
 * O navegador captura um snapshot do DOM antes, aplica as mudanças, e anima
 * a transição via GPU usando os pseudo-elementos ::view-transition-*.
 * Em navegadores sem suporte, executa renderApp() normalmente (graceful degradation).
 */
export function viewTransitionRender() {
    if ('startViewTransition' in document) {
        (document as any).startViewTransition(() => renderApp());
    } else {
        renderApp();
    }
}

export function renderApp() {
    _renderHeaderIcons();
    _updateHeaderTitle();
    renderCalendar();
    renderHabits();

    if ('scheduler' in window && (window as any).scheduler) {
        (window as any).scheduler.postTask(() => {
            renderAINotificationState();
            renderChart();
            (window as any).scheduler!.postTask(() => renderStoicQuote(), { priority: 'background' });
        }, { priority: 'user-visible' });
    } else {
        requestAnimationFrame(() => {
            renderAINotificationState();
            renderChart();
            if ('requestIdleCallback' in window) requestIdleCallback(() => renderStoicQuote());
            else setTimeout(renderStoicQuote, 50);
        });
    }
    if (ui.manageModal.classList.contains('visible')) setupManageModal();
}

export function updateNotificationUI() {
    const isPendingChange = ui.notificationToggle.disabled && !ui.notificationToggleLabel.classList.contains('disabled');
    if (isPendingChange) {
        setTextContent(ui.notificationStatusDesc, t('notificationChangePending'));
        return;
    }
    pushToOneSignal((OneSignal: OneSignalLike) => {
        const isPushEnabled = OneSignal.User.PushSubscription.optedIn;
        const permission = OneSignal.Notifications.permission;
        if (ui.notificationToggle.checked !== isPushEnabled) ui.notificationToggle.checked = isPushEnabled;
        const isDenied = permission === 'denied';
        if (ui.notificationToggle.disabled !== isDenied) {
            ui.notificationToggle.disabled = isDenied;
            ui.notificationToggleLabel.classList.toggle('disabled', isDenied);
        }
        let statusTextKey = 'notificationStatusOptedOut';
        if (isDenied) statusTextKey = 'notificationStatusDisabled';
        else if (isPushEnabled) statusTextKey = 'notificationStatusEnabled';
        setTextContent(ui.notificationStatusDesc, t(statusTextKey));
    });
}

export function initLanguageFilter() {
    const langNames = LANGUAGES.map(lang => t(lang.nameKey));
    ui.languageReel.innerHTML = langNames.map(name => `<span class="reel-option">${name}</span>`).join('');
    updateReelRotaryARIA(ui.languageViewport, LANGUAGES.findIndex(l => l.code === state.activeLanguageCode), langNames, 'language_ariaLabel');
}

export function renderAINotificationState() {
    const hasCelebrations = state.pending21DayHabitIds.length > 0 || state.pendingConsolidationHabitIds.length > 0;
    const hasUnseenResult = (state.aiState === 'completed' || state.aiState === 'error') && !state.hasSeenAIResult;
    ui.aiEvalBtn.classList.toggle('loading', state.aiState === 'loading');
    ui.aiEvalBtn.disabled = state.aiState === 'loading';
    ui.aiEvalBtn.classList.toggle('offline', !navigator.onLine);
    ui.aiEvalBtn.classList.toggle('has-notification', hasCelebrations || hasUnseenResult);
}

let _quoteCollapseListener: ((e: Event) => void) | null = null;
let _quoteCollapseScrollHandler: (() => void) | null = null;

const _collapseExpandedQuote = () => {
    if (ui.stoicQuoteDisplay.querySelector('.quote-expanded')) {
        _cachedQuoteState = null;
        renderStoicQuote();
    }
};
function _setupQuoteAutoCollapse() {
    if (_quoteCollapseListener) return;
    _quoteCollapseListener = (e: Event) => {
        if ((e.target as HTMLElement).closest('.stoic-quote')) return;
        _collapseExpandedQuote();
    };
    _quoteCollapseScrollHandler = createDebounced(_collapseExpandedQuote, QUOTE_COLLAPSE_DEBOUNCE_MS);
    document.addEventListener('click', _quoteCollapseListener, { capture: true });
    ui.habitContainer.addEventListener('scroll', _quoteCollapseScrollHandler, { passive: true });
}

export function renderStoicQuote() {
    if (!state.dailyDiagnoses[state.selectedDate]) {
        document.dispatchEvent(new CustomEvent('request-analysis', { detail: { date: state.selectedDate } }));
    }
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'Morning' : (hour < 18 ? 'Afternoon' : 'Evening');
    const summary = calculateDaySummary(state.selectedDate);
    const performanceSig = `${summary.completed}/${summary.total}`;
    const currentContextKey = `${state.selectedDate}|${state.activeLanguageCode}|${timeOfDay}|${performanceSig}`;

    if (_cachedQuoteState && _cachedQuoteState.contextKey === currentContextKey) return;

    let selectedQuote: Quote;
    try {
        selectedQuote = selectBestQuote(STOIC_QUOTES, state.selectedDate);
    } catch (e) {
        selectedQuote = STOIC_QUOTES[0];
    }

    _cachedQuoteState = { id: selectedQuote.id, contextKey: currentContextKey };
    const diagnosis = state.dailyDiagnoses[state.selectedDate];
    const userLevel = diagnosis ? diagnosis.level : 1;
    const lang = state.activeLanguageCode as 'pt' | 'en' | 'es';
    const adaptationText = selectedQuote.adaptations[`level_${userLevel}` as keyof typeof selectedQuote.adaptations][lang];
    
    const container = ui.stoicQuoteDisplay;
    container.classList.remove('visible');
    container.innerHTML = '';
    
    const adaptationSpan = document.createElement('span');
    adaptationSpan.className = 'quote-adaptation';
    adaptationSpan.textContent = adaptationText + ' ';
    
    const expander = document.createElement('button');
    expander.className = 'quote-expander';
    expander.textContent = '...';
    expander.setAttribute('aria-label', t('expandQuote'));

    expander.onclick = (e) => {
        e.stopPropagation();
        container.innerHTML = '';
        const originalSpan = document.createElement('span');
        originalSpan.className = 'quote-expanded';
        originalSpan.style.fontStyle = 'italic';
        originalSpan.textContent = `"${selectedQuote.original_text[lang]}" — ${t(selectedQuote.author)}`;
        container.appendChild(originalSpan);
        _setupQuoteAutoCollapse();
    };

    container.appendChild(adaptationSpan);
    container.appendChild(expander);

    requestAnimationFrame(() => {
        if (!adaptationSpan.isConnected) return;
        const rects = adaptationSpan.getClientRects();
        let isSingleLine = rects.length === 1;
        if (rects.length > 1 && Math.abs(rects[rects.length - 1].top - rects[0].top) < 5) isSingleLine = true;
        container.style.justifyContent = isSingleLine ? 'flex-end' : 'flex-start';
        container.style.textAlign = isSingleLine ? 'right' : 'left';
        container.classList.add('visible');
    });
}

document.addEventListener('language-changed', () => {
    initLanguageFilter();
    renderLanguageFilter();
    updateUIText();
    if (ui.syncStatus) setTextContent(ui.syncStatus, t(state.syncState));
    renderApp();
});

document.addEventListener('habitsChanged', () => {
    _cachedQuoteState = null;
    if ('requestIdleCallback' in window) requestIdleCallback(() => renderStoicQuote());
    else setTimeout(renderStoicQuote, 1000);
});

export async function initI18n() {
    const savedLang = localStorage.getItem('habitTrackerLanguage');
    const browserLang = navigator.language.split('-')[0];
    let initialLang: 'pt' | 'en' | 'es' = (savedLang && ['pt', 'en', 'es'].includes(savedLang)) 
        ? savedLang as 'pt' | 'en' | 'es' 
        : (['pt', 'en', 'es'].includes(browserLang) ? browserLang as 'pt' | 'en' | 'es' : 'pt');
    await setLanguage(initialLang);
}
