
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners/modals.ts
 * @description Controlador de Interação de Modais (Forms, Configurações, Diálogos).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo gerencia o ciclo de vida de interações complexas que pausam o fluxo principal da aplicação.
 * 
 * ARQUITETURA (Static Dispatch & Zero-Allocation):
 * - **Static Handlers:** Todos os listeners são definidos no nível do módulo. Zero closures em `setupModalListeners`.
 * - **Validation Optimization:** Separação estrita entre validação lógica (Input Loop) e feedback visual (RAF).
 * - **Event Delegation:** Delegação eficiente para listas e grids.
 */

import { ui } from '../render/ui';
import { 
    state, 
    LANGUAGES, 
    invalidateChartCache, 
    FREQUENCIES,
    TimeOfDay,
    MAX_HABIT_NAME_LENGTH
} from '../state';
import { PREDEFINED_HABITS } from '../data/predefinedHabits';
import {
    openModal,
    closeModal,
    setupManageModal,
    renderExploreHabits,
    showConfirmationModal,
    renderLanguageFilter,
    renderAINotificationState,
    openEditModal,
    updateNotificationUI,
    renderFrequencyOptions,
    renderIconPicker,
    renderColorPicker,
    renderFullCalendar,
    renderApp,
    viewTransitionRender,
} from '../render';
import {
    saveHabitFromModal,
    requestHabitEndingFromModal,
    requestHabitPermanentDeletion,
    resetApplicationData,
    handleSaveNote,
    graduateHabit,
    performAIAnalysis,
    exportData,
    importData,
    consumeAndFormatCelebrations,
} from '../services/habitActions';
import { t, setLanguage } from '../i18n';
import { setupReelRotary } from '../render/rotary';
import { simpleMarkdownToHTML, pushToOneSignal, getContrastColor, addDays, parseUTCIsoDate, toUTCIsoDateString, triggerHaptic, logger, escapeHTML, sanitizeText } from '../utils';
import { setTextContent } from '../render/dom';

// --- STATIC HELPERS ---

function _navigateToDateFromAlmanac(dateISO: string) {
    state.selectedDate = dateISO;
    
    closeModal(ui.fullCalendarModal);
    
    state.uiDirtyState.calendarVisuals = true;
    state.uiDirtyState.habitListStructure = true;
    invalidateChartCache();
    
    viewTransitionRender();

    requestAnimationFrame(() => {
        const selectedEl = ui.calendarStrip.querySelector('.day-item.selected');
        selectedEl?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
    });
}

// --- VALIDATION LOGIC (Decoupled) ---

/**
 * Valida o nome do hábito e atualiza a UI.
 * PERFORMANCE: Evita Layout Thrashing (offsetWidth) no loop de input.
 * Apenas atualiza o texto de erro se o *tipo* de erro mudar.
 */
function _validateAndFeedback(newName: string): boolean {
    const formNoticeEl = ui.editHabitForm.querySelector<HTMLElement>('.form-notice')!;
    const habitNameInput = ui.editHabitForm.elements.namedItem('habit-name') as HTMLInputElement;
    
    const trimmedName = newName.trim();
    let errorKey: string | null = null;
    const isBlockingError = trimmedName.length === 0;

    if (isBlockingError) {
        errorKey = 'noticeNameCannotBeEmpty';
    } else if (trimmedName.length > MAX_HABIT_NAME_LENGTH) {
        errorKey = 'noticeNameTooLong'; // Apenas um aviso não-bloqueante
    }

    const isValid = !isBlockingError;

    // UI Updates (DOM Writes)
    if (!errorKey) {
        if (formNoticeEl.classList.contains('visible')) {
            formNoticeEl.classList.remove('visible');
            habitNameInput.classList.remove('shake');
        }
    } else {
        const errorText = t(errorKey);
        if (formNoticeEl.textContent !== errorText) {
            formNoticeEl.textContent = errorText;
        }
        
        if (!formNoticeEl.classList.contains('visible')) {
            formNoticeEl.classList.add('visible');
            
            if (isBlockingError) {
                requestAnimationFrame(() => {
                    habitNameInput.classList.add('shake');
                    habitNameInput.addEventListener('animationend', () => habitNameInput.classList.remove('shake'), { once: true });
                });
            }
        }
    }
    
    ui.editHabitSaveBtn.disabled = isBlockingError;
    return isValid;
}

// --- STATIC EVENT HANDLERS ---

const _handleManageHabitsClick = () => {
    if (ui.manageModal.classList.contains('visible')) return;
    
    triggerHaptic('light');
    setupManageModal();
    updateNotificationUI();
    openModal(ui.manageModal);
};

const _handleFabClick = () => {
    if (ui.exploreModal.classList.contains('visible')) return;

    triggerHaptic('light');
    renderExploreHabits();
    openModal(ui.exploreModal);
};

const _handleHabitListClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>('button');
    if (!button) return;

    const habitId = button.closest<HTMLLIElement>('li.habit-list-item')?.dataset.habitId;
    if (!habitId) return;

    if (ui.confirmModal.classList.contains('visible')) return;

    triggerHaptic('light');

    if (button.classList.contains('end-habit-btn')) {
        requestHabitEndingFromModal(habitId);
    } else if (button.classList.contains('permanent-delete-habit-btn')) {
        requestHabitPermanentDeletion(habitId);
    } else if (button.classList.contains('graduate-habit-btn')) {
        graduateHabit(habitId);
    }
};

const _handleManageModalClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.id === 'export-data-btn') {
        exportData();
    } else if (target.id === 'import-data-btn') {
        importData();
    }
};

const _handleResetAppClick = () => {
    if (ui.confirmModal.classList.contains('visible')) return;

    triggerHaptic('light');
    showConfirmationModal(
        t('confirmResetApp'),
        resetApplicationData,
        { 
            confirmText: t('modalManageResetButton'), 
            title: t('modalManageReset'),
            confirmButtonStyle: 'danger'
        }
    );
};

const _handleNotificationToggleChange = () => {
    pushToOneSignal(async (OneSignal: OneSignalLike) => {
        const wantsEnabled = ui.notificationToggle.checked;
        if (wantsEnabled) {
            await OneSignal.Notifications.requestPermission();
        } else {
            await OneSignal.User.PushSubscription.optOut();
        }
        ui.notificationToggle.disabled = true;
        setTextContent(ui.notificationStatusDesc, t('notificationChangePending'));
    });
};

const _handleExploreHabitListClick = (e: MouseEvent) => {
    const item = (e.target as HTMLElement).closest<HTMLElement>('.explore-habit-item');
    if (!item) return;
    triggerHaptic('light');
    const index = parseInt(item.dataset.index!, 10);
    const habitTemplate = PREDEFINED_HABITS[index];
    if (habitTemplate) {
        closeModal(ui.exploreModal);
        // LÓGICA RADICAL: Sempre abre o modal de edição para criar um NOVO hábito a partir do modelo,
        // mesmo que um com nome parecido já exista. Elimina a ambiguidade.
        // CALLBACK: Se cancelar (back/close), reabre o modal de Explorar.
        openEditModal(habitTemplate, undefined, () => openModal(ui.exploreModal));
    }
};

const _handleExploreHabitListKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const item = (e.target as HTMLElement).closest<HTMLElement>('.explore-habit-item');
        if (item) {
            item.click();
        }
    }
};

const _handleCreateCustomHabitClick = () => {
    triggerHaptic('light');
    closeModal(ui.exploreModal);
    // CALLBACK: Se cancelar (back/close), reabre o modal de Explorar.
    openEditModal(null, undefined, () => openModal(ui.exploreModal));
};

const _handleAiEvalClick = async () => {
    // UNIFIED STATE CHECK: Confia em state.aiState e na visibilidade do modal.
    if (state.aiState === 'loading' || ui.aiModal.classList.contains('visible') || ui.aiOptionsModal.classList.contains('visible')) {
        return;
    }
    
    triggerHaptic('light');

    if (!navigator.onLine) {
        try {
            const { STOIC_QUOTES } = await import('../data/quotes');
            const offlineQuotes = STOIC_QUOTES.filter(q => 
                q.metadata.tags.includes('control') || 
                q.metadata.tags.includes('acceptance') ||
                q.metadata.tags.includes('perception')
            );
            const sourceArray = offlineQuotes.length > 0 ? offlineQuotes : STOIC_QUOTES;
            const randomQuote = sourceArray[Math.floor(Math.random() * sourceArray.length)];
            const lang = state.activeLanguageCode as 'pt'|'en'|'es';
            const quoteText = escapeHTML(randomQuote.original_text[lang]);
            const author = escapeHTML(t(randomQuote.author));

            const message = `
                <div class="offline-header">
                    <h3 class="offline-title">${escapeHTML(t('aiOfflineTitle'))}</h3>
                    <p class="offline-desc">${escapeHTML(t('aiOfflineMessage'))}</p>
                </div>
                <div class="offline-quote-box">
                    <blockquote class="offline-quote-text">
                        "${quoteText}"
                    </blockquote>
                    <div class="offline-quote-author">
                        — ${author}
                    </div>
                </div>
            `;
            ui.aiResponse.innerHTML = message;
            openModal(ui.aiModal);
        } catch (e) {
            logger.error("Failed to load offline quote", e);
        }
        return;
    }

    let message = '';
    
    const allCelebrations = consumeAndFormatCelebrations();

    if (allCelebrations) {
        message = simpleMarkdownToHTML(allCelebrations);
        renderAINotificationState();
    } else if ((state.aiState === 'completed' || state.aiState === 'error') && !state.hasSeenAIResult && state.lastAIResult) {
        message = simpleMarkdownToHTML(state.lastAIResult);
    }
    
    if (message) {
        ui.aiResponse.innerHTML = message;
        openModal(ui.aiModal, undefined, () => {
            state.hasSeenAIResult = true;
            renderAINotificationState();
        });
    } else {
        openModal(ui.aiOptionsModal);
    }
};

const _handleAiOptionsClick = (e: MouseEvent) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('.ai-option-btn');
    if (!button) return;
    triggerHaptic('light');
    const analysisType = button.dataset.analysisType as 'monthly' | 'quarterly' | 'historical';
    performAIAnalysis(analysisType);
};

const _handleConfirmClick = () => {
    triggerHaptic('light');
    const action = state.confirmAction;
    
    try {
        action?.();
    } catch (e) {
        logger.error("Action execution failed", e);
    }

    state.confirmAction = null;
    state.confirmEditAction = null;
    
    // Sem suppressCallbacks: onCancel roda como safety-net para ActionContext.reset()
    closeModal(ui.confirmModal);
};

const _handleEditClick = () => {
    triggerHaptic('light');
    const editAction = state.confirmEditAction;
    
    try {
        editAction?.();
    } catch (e) {
        logger.error("Edit Action execution failed", e);
    }

    state.confirmAction = null;
    state.confirmEditAction = null;
    
    closeModal(ui.confirmModal);
};

const _handleFullCalendarPrevClick = () => {
    if (!state.fullCalendar) return;
    let { month, year } = state.fullCalendar;
    month--;
    if (month < 0) { month = 11; year--; }
    state.fullCalendar = { month, year };
    renderFullCalendar();
    triggerHaptic('light');
};

const _handleFullCalendarNextClick = () => {
    if (!state.fullCalendar) return;
    let { month, year } = state.fullCalendar;
    month++;
    if (month > 11) { month = 0; year++; }
    state.fullCalendar = { month, year };
    renderFullCalendar();
    triggerHaptic('light');
};

const _handleFullCalendarGridClick = (e: MouseEvent) => {
    const dayEl = (e.target as HTMLElement).closest<HTMLElement>('.full-calendar-day');
    if (dayEl && dayEl.dataset.date && !dayEl.classList.contains('other-month')) {
        triggerHaptic('selection');
        _navigateToDateFromAlmanac(dayEl.dataset.date);
    }
};

const _handleFullCalendarGridKeydown = (e: KeyboardEvent) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) {
        return;
    }
    e.preventDefault();

    if (e.key === 'Enter' || e.key === ' ') {
        _navigateToDateFromAlmanac(state.selectedDate);
        return;
    }

    const currentSelectedDate = parseUTCIsoDate(state.selectedDate);
    let newDate: Date;

    switch (e.key) {
        case 'ArrowRight': newDate = addDays(currentSelectedDate, 1); break;
        case 'ArrowLeft': newDate = addDays(currentSelectedDate, -1); break;
        case 'ArrowUp': newDate = addDays(currentSelectedDate, -7); break;
        case 'ArrowDown': newDate = addDays(currentSelectedDate, 7); break;
        default: return;
    }

    state.selectedDate = toUTCIsoDateString(newDate);

    if (newDate.getUTCMonth() !== state.fullCalendar.month || newDate.getUTCFullYear() !== state.fullCalendar.year) {
        state.fullCalendar.month = newDate.getUTCMonth();
        state.fullCalendar.year = newDate.getUTCFullYear();
    }
    
    renderFullCalendar();
    
    requestAnimationFrame(() => {
        const newSelectedEl = ui.fullCalendarGrid.querySelector<HTMLElement>(`.full-calendar-day[data-date="${state.selectedDate}"]`);
        newSelectedEl?.focus();
    });
};

const _handleHabitNameInput = () => {
    if (!state.editingHabit) return;
    
    const habitNameInput = ui.editHabitForm.elements.namedItem('habit-name') as HTMLInputElement;
    const rawName = habitNameInput.value;
    const newName = sanitizeText(rawName, MAX_HABIT_NAME_LENGTH);
    if (newName !== rawName) habitNameInput.value = newName;

    if (state.editingHabit.formData.nameKey) {
        delete state.editingHabit.formData.nameKey;
        state.editingHabit.formData.subtitleKey = 'customHabitSubtitle';
        if (ui.habitSubtitleDisplay) {
            setTextContent(ui.habitSubtitleDisplay, t('customHabitSubtitle'));
        }
    }

    state.editingHabit.formData.name = newName;
    
    _validateAndFeedback(newName);
};

const _handleIconPickerClick = () => {
    renderIconPicker();
    openModal(ui.iconPickerModal);
};

const _handleIconGridClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const item = target.closest<HTMLButtonElement>('.icon-picker-item');
    if (item && state.editingHabit) {
        triggerHaptic('light');
        const iconSVG = item.dataset.iconSvg!;
        state.editingHabit.formData.icon = iconSVG;
        ui.habitIconPickerBtn.innerHTML = iconSVG;
        closeModal(ui.iconPickerModal);
    }
};

const _handleColorGridClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const swatch = target.closest<HTMLButtonElement>('.color-swatch');
    if (swatch && state.editingHabit) {
        triggerHaptic('light');
        const color = swatch.dataset.color!;
        
        state.editingHabit.formData.color = color;

        const iconColor = getContrastColor(color);
        ui.habitIconPickerBtn.style.backgroundColor = color;
        ui.habitIconPickerBtn.style.color = iconColor;
        
        ui.colorPickerGrid.querySelector('.selected')?.classList.remove('selected');
        swatch.classList.add('selected');

        ui.iconPickerGrid.style.setProperty('--current-habit-bg-color', color);
        ui.iconPickerGrid.style.setProperty('--current-habit-fg-color', iconColor);

        ui.iconPickerModal.classList.remove('is-picking-color');
        
        closeModal(ui.colorPickerModal, true);
    }
};

const _handleChangeColorClick = () => {
    renderColorPicker();
    ui.iconPickerModal.classList.add('is-picking-color');
    openModal(ui.colorPickerModal, undefined, () => {
        ui.iconPickerModal.classList.remove('is-picking-color');
        renderIconPicker();
    });
};

const _handleTimeContainerClick = (e: MouseEvent) => {
    if (!state.editingHabit) return;
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('.segmented-control-option');
    if (!button) return;

    triggerHaptic('light');
    const time = button.dataset.time as TimeOfDay; 
    const currentlySelected = state.editingHabit.formData.times.includes(time);

    if (currentlySelected) {
        state.editingHabit.formData.times = state.editingHabit.formData.times.filter(t => t !== time);
        button.classList.remove('selected');
    } else {
        state.editingHabit.formData.times.push(time);
        button.classList.add('selected');
    }
};

const _handleFrequencyChange = (e: Event) => {
    const target = e.target as HTMLElement;
    if (!state.editingHabit) return;

    if (target.matches('input[name="frequency-type"]')) {
        const radio = target as HTMLInputElement;
        const type = radio.value as 'daily' | 'interval' | 'specific_days_of_week';
        
        switch (type) {
            case 'daily':
                state.editingHabit.formData.frequency = { type: 'daily' };
                break;
            case 'specific_days_of_week':
                const currentFreq = state.editingHabit.formData.frequency;
                const days = currentFreq.type === 'specific_days_of_week' ? currentFreq.days : [];
                state.editingHabit.formData.frequency = { type: 'specific_days_of_week', days };
                break;
            case 'interval':
                const intervalFreqTpl = FREQUENCIES.find(f => f.value.type === 'interval')!.value as { type: 'interval', unit: 'days' | 'weeks', amount: number };
                const currentIntervalFreq = state.editingHabit.formData.frequency;
                const amount = (currentIntervalFreq.type === 'interval' ? currentIntervalFreq.amount : intervalFreqTpl.amount);
                const unit = (currentIntervalFreq.type === 'interval' ? currentIntervalFreq.unit : intervalFreqTpl.unit);
                state.editingHabit.formData.frequency = { type: 'interval', amount, unit };
                break;
        }
        renderFrequencyOptions();
    } else if (target.closest('.weekday-picker input')) {
        const days = Array.from(ui.frequencyOptionsContainer.querySelectorAll<HTMLInputElement>('.weekday-picker input:checked'))
            .map(el => parseInt(el.dataset.day!, 10));
        state.editingHabit.formData.frequency = { type: 'specific_days_of_week', days };
    }
};

const _handleFrequencyClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const btn = target.closest<HTMLButtonElement>('.stepper-btn, .unit-toggle-btn');
    if (!btn || !state.editingHabit || state.editingHabit.formData.frequency.type !== 'interval') return;

    const action = btn.dataset.action;
    const currentFreq = state.editingHabit.formData.frequency;
    let { amount, unit } = currentFreq;

    if (action === 'interval-decrement') amount = Math.max(1, amount - 1);
    if (action === 'interval-increment') amount = Math.min(99, amount + 1);
    if (action === 'interval-unit-toggle') unit = unit === 'days' ? 'weeks' : 'days';

    state.editingHabit.formData.frequency = { type: 'interval', amount, unit };
    renderFrequencyOptions();
};

export function setupModalListeners() {
    // Main Actions
    ui.manageHabitsBtn.addEventListener('click', _handleManageHabitsClick);
    ui.fabAddHabit.addEventListener('click', _handleFabClick);
    ui.habitList.addEventListener('click', _handleHabitListClick);
    ui.manageModal.addEventListener('click', _handleManageModalClick);
    ui.resetAppBtn.addEventListener('click', _handleResetAppClick);
    ui.notificationToggle.addEventListener('change', _handleNotificationToggleChange);

    // Rotary Config
    setupReelRotary({
        viewportEl: ui.languageViewport,
        reelEl: ui.languageReel,
        prevBtn: ui.languagePrevBtn,
        nextBtn: ui.languageNextBtn,
        optionsCount: LANGUAGES.length,
        getInitialIndex: () => LANGUAGES.findIndex(l => l.code === state.activeLanguageCode),
        onIndexChange: async (index) => {
            const newLang = LANGUAGES[index].code;
            if (newLang !== state.activeLanguageCode) {
                await setLanguage(newLang);
            }
        },
        render: renderLanguageFilter,
    });

    // Explore / Create
    ui.exploreHabitList.addEventListener('click', _handleExploreHabitListClick);
    ui.exploreHabitList.addEventListener('keydown', _handleExploreHabitListKeydown);
    ui.createCustomHabitBtn.addEventListener('click', _handleCreateCustomHabitClick);

    // AI
    ui.aiEvalBtn.addEventListener('click', _handleAiEvalClick);
    ui.aiOptionsModal.addEventListener('click', _handleAiOptionsClick);

    // Dialogs
    ui.confirmModalConfirmBtn.addEventListener('click', _handleConfirmClick);
    ui.confirmModalEditBtn.addEventListener('click', _handleEditClick);
    ui.saveNoteBtn.addEventListener('click', () => { triggerHaptic('light'); handleSaveNote(); });

    // Full Calendar
    ui.fullCalendarPrevBtn.addEventListener('click', _handleFullCalendarPrevClick);
    ui.fullCalendarNextBtn.addEventListener('click', _handleFullCalendarNextClick);
    ui.fullCalendarGrid.addEventListener('click', _handleFullCalendarGridClick);
    ui.fullCalendarGrid.addEventListener('keydown', _handleFullCalendarGridKeydown);

    // Habit Editing Form
    ui.editHabitSaveBtn.addEventListener('click', () => { triggerHaptic('light'); saveHabitFromModal(); });
    
    // Performance Optimized Input Handler
    const habitNameInput = ui.editHabitForm.elements.namedItem('habit-name') as HTMLInputElement;
    // BROWSER LEVEL GUARD: Define maxLength no DOM para prevenir colagem excessiva
    habitNameInput.maxLength = MAX_HABIT_NAME_LENGTH;
    habitNameInput.addEventListener('input', _handleHabitNameInput);

    // Pickers
    ui.habitIconPickerBtn.addEventListener('click', _handleIconPickerClick);
    ui.iconPickerGrid.addEventListener('click', _handleIconGridClick);
    ui.colorPickerGrid.addEventListener('click', _handleColorGridClick);
    ui.changeColorFromPickerBtn.addEventListener('click', _handleChangeColorClick);
    ui.habitTimeContainer.addEventListener('click', _handleTimeContainerClick);
    
    // Frequency Controls
    ui.frequencyOptionsContainer.addEventListener('change', _handleFrequencyChange);
    ui.frequencyOptionsContainer.addEventListener('click', _handleFrequencyClick);
}
