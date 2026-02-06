/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners.ts
 * @description Ponto de Entrada para Inicialização de Eventos (Event Bootstrapper).
 */

import { ui } from './render/ui';
import { renderApp, renderAINotificationState, updateNotificationUI, initModalEngine, getCachedHabitCard, updateHabitCardElement, updateDayVisuals } from './render';
import { setupModalListeners } from './listeners/modals';
import { setupCardListeners } from './listeners/cards';
import { setupDragHandler } from './listeners/drag';
import { setupSwipeHandler } from './listeners/swipe';
import { setupCalendarListeners } from './listeners/calendar';
import { setupChartListeners } from './listeners/chart';
import { pushToOneSignal, getTodayUTCIso, resetTodayCache, createDebounced, logger } from './utils';
import { state, getPersistableState, invalidateCachesForDateChange } from './state';
import { syncStateWithCloud } from './services/cloud';
import { checkAndAnalyzeDayContext } from './services/analysis';
import { NETWORK_DEBOUNCE_MS, PERMISSION_DELAY_MS, INTERACTION_DELAY_MS } from './constants';

let areListenersAttached = false;
let visibilityRafId: number | null = null;
let isHandlingVisibility = false;

const _handlePermissionChange = () => {
    window.setTimeout(updateNotificationUI, PERMISSION_DELAY_MS);
};

const _handleOneSignalInit = (OneSignal: OneSignalLike) => {
    OneSignal.Notifications.addEventListener('permissionChange', _handlePermissionChange);
    updateNotificationUI();
};

const _handleNetworkChange = createDebounced(() => {
    const isOnline = navigator.onLine;
    const wasOffline = document.body.classList.contains('is-offline');
    document.body.classList.toggle('is-offline', !isOnline);
    if (wasOffline === isOnline) renderAINotificationState();
    if (isOnline) {
        logger.info('[Network] Online stable. Flushing pending sync.');
        syncStateWithCloud(getPersistableState());
    }
}, NETWORK_DEBOUNCE_MS);

const _handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return;
    if (isHandlingVisibility) return;
    isHandlingVisibility = true;

    try {
        _handleNetworkChange();
        const cachedToday = getTodayUTCIso();
        resetTodayCache();
        const realToday = getTodayUTCIso();
        if (cachedToday !== realToday) {
            if (state.selectedDate === cachedToday) state.selectedDate = realToday;
            document.dispatchEvent(new CustomEvent('dayChanged'));
            isHandlingVisibility = false;
        } else {
            if (visibilityRafId) cancelAnimationFrame(visibilityRafId);
            visibilityRafId = requestAnimationFrame(() => {
                try {
                    renderApp();
                } finally {
                    visibilityRafId = null;
                    isHandlingVisibility = false;
                }
            });
        }
    } catch (e) {
        isHandlingVisibility = false;
        throw e;
    }
};

const _handleServiceWorkerMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === 'REQUEST_SYNC') {
        logger.info('[SW Message] Sincronização solicitada pelo Service Worker.');
        syncStateWithCloud(getPersistableState(), true);
    }
};

const _handleCardUpdate = (e: Event) => {
    const { habitId, time, date } = (e as CustomEvent).detail;
    const habit = state.habits.find(h => h.id === habitId);
    let cardElement = getCachedHabitCard(habitId, time);
    if (!cardElement) cardElement = document.querySelector(`.habit-card[data-habit-id="${habitId}"][data-time="${time}"]`) as HTMLElement;
    if (habit && cardElement) {
        const shouldAnimate = e.type === 'card-status-changed';
        updateHabitCardElement(cardElement, habit, time, undefined, { animate: shouldAnimate });
    }
    const targetDate = date || state.selectedDate;
    invalidateCachesForDateChange(targetDate);
    updateDayVisuals(targetDate);
};

export function setupEventListeners() {
    if (areListenersAttached) return;
    areListenersAttached = true;

    initModalEngine();
    setupModalListeners();
    setupCardListeners();
    setupCalendarListeners();
    
    pushToOneSignal(_handleOneSignalInit);

    document.addEventListener('render-app', renderApp);
    document.addEventListener('request-analysis', (e: Event) => {
        const ce = e as CustomEvent;
        if (ce.detail?.date) checkAndAnalyzeDayContext(ce.detail.date);
    });

    document.addEventListener('card-status-changed', _handleCardUpdate);
    document.addEventListener('card-goal-changed', _handleCardUpdate);

    window.addEventListener('online', _handleNetworkChange);
    window.addEventListener('offline', _handleNetworkChange);
    document.addEventListener('visibilitychange', _handleVisibilityChange);
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', _handleServiceWorkerMessage);
    }

    document.body.classList.toggle('is-offline', !navigator.onLine);

    const setupHeavyInteractions = () => {
        try {
            const container = ui.habitContainer;
            setupDragHandler(container);
            setupSwipeHandler(container);
            setupChartListeners();
        } catch (e) {}
    };

    if ('scheduler' in window && (window as any).scheduler) {
        (window as any).scheduler.postTask(setupHeavyInteractions, { priority: 'user-visible' });
    } else {
        setTimeout(setupHeavyInteractions, INTERACTION_DELAY_MS);
    }
}