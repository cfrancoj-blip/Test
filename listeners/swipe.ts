
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners/swipe.ts
 * @description Motor de Gestos Isolado (Swipe Only).
 * 
 * [ISOLATION PRINCIPLE]:
 * Este módulo gerencia exclusivamente o ciclo de vida do gesto horizontal.
 * A rolagem vertical agora é nativa (via touch-action: pan-y no CSS), 
 * então este módulo apenas detecta swipes e cancela se o navegador assumir o scroll.
 */

import { triggerHaptic } from '../utils';
import { DOM_SELECTORS, CSS_CLASSES } from '../render/constants';
import { renderApp } from '../render';
import { state } from '../state';
import { startDragSession, isDragging as isDragActive } from './drag'; 
import {
    SWIPE_ACTION_THRESHOLD,
    SWIPE_BLOCK_CLICK_MS
} from '../constants';

// CONFIGURAÇÃO FÍSICA
const DIRECTION_LOCKED_THRESHOLD = 5; 
// Tolerância aumentada para evitar cancelamento prematuro em dedos trêmulos
const LONG_PRESS_DRIFT_TOLERANCE = 40; 
const ACTION_THRESHOLD = SWIPE_ACTION_THRESHOLD;
const LONG_PRESS_DELAY = 500; 

// STATE MACHINE (Módulo Local)
const SwipeMachine = {
    state: 'IDLE' as 'IDLE' | 'DETECTING' | 'SWIPING' | 'LOCKED_OUT',
    container: null as HTMLElement | null,
    card: null as HTMLElement | null,
    content: null as HTMLElement | null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    pointerId: -1,
    rafId: 0,
    
    // State Flags
    wasOpenLeft: false,
    wasOpenRight: false,
    
    // Progressive Haptics
    lastFeedbackStep: 0,
    limitVibrationTimer: 0, 
    
    // Long Press
    longPressTimer: 0,
    initialEvent: null as PointerEvent | null,
    
    // Cached Layout
    actionWidth: 60,
    hasTypedOM: false
};

// --- CORE UTILS ---

function updateLayoutMetrics() {
    const root = getComputedStyle(document.documentElement);
    SwipeMachine.actionWidth = parseInt(root.getPropertyValue('--swipe-action-width')) || 60;
    SwipeMachine.hasTypedOM = typeof window !== 'undefined' && !!(window.CSS && (window as any).CSSTranslate && CSS.px);
}

const _stopLimitVibration = () => {
    if (SwipeMachine.limitVibrationTimer) {
        clearInterval(SwipeMachine.limitVibrationTimer);
        SwipeMachine.limitVibrationTimer = 0;
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(0);
    }
};

// --- TOUCH GUARD (Anti-Scroll Stealing) ---
// CRÍTICO: Este listener impede o navegador de iniciar o scroll nativo (que causaria pointercancel)
// enquanto o dedo está dentro da zona de tolerância do Long Press.
const _activeTouchGuard = (e: TouchEvent) => {
    if (SwipeMachine.state !== 'DETECTING') return;

    const touch = e.touches[0];
    if (!touch) return;

    const dx = touch.clientX - SwipeMachine.startX;
    const dy = touch.clientY - SwipeMachine.startY;
    
    // Se o movimento for pequeno (dentro da tolerância), chamamos preventDefault.
    // Isso diz ao navegador: "Espere! Não role a tela ainda, o usuário pode estar segurando."
    // Se o usuário mover MAIS que isso, paramos de chamar preventDefault, e o navegador assume o scroll.
    if (Math.abs(dx) < LONG_PRESS_DRIFT_TOLERANCE && Math.abs(dy) < LONG_PRESS_DRIFT_TOLERANCE) {
        if (e.cancelable) e.preventDefault();
    }
};

// --- VISUAL ENGINE ---

const _renderFrame = () => {
    if (!SwipeMachine.content) {
        SwipeMachine.rafId = 0;
        return;
    }

    // RENDER: SWIPE HORIZONTAL
    if (SwipeMachine.state === 'SWIPING') {
        let tx = (SwipeMachine.currentX - SwipeMachine.startX) | 0;
        
        if (SwipeMachine.wasOpenLeft) tx += SwipeMachine.actionWidth;
        if (SwipeMachine.wasOpenRight) tx -= SwipeMachine.actionWidth;

        const absX = Math.abs(tx);
        const actionPoint = SwipeMachine.actionWidth; 
        
        let visualX = tx;

        // HAPTICS & VISUAL LOGIC
        if (absX >= actionPoint) {
            const excess = absX - actionPoint;
            const resistanceFactor = 0.25; 
            const maxVisualOvershoot = 20; 
            const visualOvershoot = Math.min(excess * resistanceFactor, maxVisualOvershoot);
            const sign = tx > 0 ? 1 : -1;
            visualX = (actionPoint + visualOvershoot) * sign;

            if (!SwipeMachine.limitVibrationTimer) {
                triggerHaptic('heavy');
                SwipeMachine.limitVibrationTimer = window.setInterval(() => {
                    triggerHaptic('medium'); 
                }, 80); 
            }
        } else {
            _stopLimitVibration();
            const HAPTIC_GRAIN = 8; 
            const currentStep = Math.floor(absX / HAPTIC_GRAIN);
            if (currentStep !== SwipeMachine.lastFeedbackStep) {
                if (currentStep > SwipeMachine.lastFeedbackStep) {
                    const ratio = absX / actionPoint;
                    if (ratio > 0.6) triggerHaptic('light'); 
                    else triggerHaptic('selection');
                }
                SwipeMachine.lastFeedbackStep = currentStep;
            }
        }

        if (SwipeMachine.hasTypedOM && SwipeMachine.content.attributeStyleMap) {
            SwipeMachine.content.attributeStyleMap.set('transform', new (window as any).CSSTranslate(CSS.px(visualX), CSS.px(0)));
        } else {
            SwipeMachine.content.style.transform = `translateX(${visualX}px)`;
        }
    }
    
    SwipeMachine.rafId = 0;
};

// --- LIFECYCLE MANAGEMENT ---

const _cleanListeners = () => {
    window.removeEventListener('pointermove', _onPointerMove);
    window.removeEventListener('pointerup', _onPointerUp);
    window.removeEventListener('pointercancel', _forceReset);
    window.removeEventListener('blur', _forceReset);
    window.removeEventListener('touchmove', _activeTouchGuard);
};

const _forceReset = () => {
    if (SwipeMachine.rafId) cancelAnimationFrame(SwipeMachine.rafId);
    if (SwipeMachine.longPressTimer) clearTimeout(SwipeMachine.longPressTimer);
    _stopLimitVibration();
    
    if (SwipeMachine.container) {
        SwipeMachine.container.classList.remove('is-locking-scroll');
    }

    const { card, content, pointerId } = SwipeMachine;
    if (card) {
        card.classList.remove(CSS_CLASSES.IS_SWIPING);
        card.classList.remove('is-pressing');
        
        // Libera captura se existir
        if (pointerId !== -1) {
            try { card.releasePointerCapture(pointerId); } catch(e){}
        }
    }
    if (content) {
        if (SwipeMachine.hasTypedOM && content.attributeStyleMap) {
            content.attributeStyleMap.clear();
        } else {
            content.style.transform = '';
        }
    }
    
    document.body.classList.remove('is-interaction-active');
    
    SwipeMachine.state = 'IDLE';
    SwipeMachine.card = null;
    SwipeMachine.content = null;
    SwipeMachine.initialEvent = null;
    SwipeMachine.pointerId = -1;
    SwipeMachine.rafId = 0;
    
    if (state.uiDirtyState.habitListStructure && !isDragActive()) {
        requestAnimationFrame(() => renderApp());
    }
    
    _cleanListeners();
};

const _finalizeAction = (finalDeltaX: number) => {
    if (!SwipeMachine.card) return;
    
    const { card, wasOpenLeft, wasOpenRight } = SwipeMachine;
    const threshold = ACTION_THRESHOLD;

    if (wasOpenLeft) {
        if (finalDeltaX < -threshold) card.classList.remove(CSS_CLASSES.IS_OPEN_LEFT);
    } else if (wasOpenRight) {
        if (finalDeltaX > threshold) card.classList.remove(CSS_CLASSES.IS_OPEN_RIGHT);
    } else {
        if (finalDeltaX > threshold) {
            card.classList.add(CSS_CLASSES.IS_OPEN_LEFT);
        } else if (finalDeltaX < -threshold) {
            card.classList.add(CSS_CLASSES.IS_OPEN_RIGHT);
        }
    }
};

// --- GESTURE HANDLERS ---

const _triggerDrag = () => {
    SwipeMachine.longPressTimer = 0;
    _stopLimitVibration();
    
    if (SwipeMachine.state !== 'DETECTING' || !SwipeMachine.card || !SwipeMachine.content || !SwipeMachine.initialEvent) return;

    // DEFERRED CAPTURE: O momento da verdade.
    // O usuário segurou tempo suficiente. Agora "roubamos" o ponteiro do navegador.
    // A partir daqui, movimentos verticais não rolarão a página, mas moverão o cartão.
    try {
        SwipeMachine.card.setPointerCapture(SwipeMachine.pointerId);
    } catch (e) {
        // Se falhar (ponteiro perdido), abortamos para evitar estado inconsistente
        _forceReset();
        return;
    }

    triggerHaptic('medium');
    
    // Inicia a sessão de Drag, passando o controle para listeners/drag.ts
    startDragSession(SwipeMachine.card, SwipeMachine.content, SwipeMachine.initialEvent);
    
    // Limpeza local (o drag tem seu próprio ciclo de vida)
    _cleanListeners();
    SwipeMachine.state = 'IDLE';
    
    if (SwipeMachine.container) SwipeMachine.container.classList.remove('is-locking-scroll');
    SwipeMachine.card.classList.remove(CSS_CLASSES.IS_SWIPING);
    SwipeMachine.card.classList.remove('is-pressing');
    
    if (SwipeMachine.hasTypedOM && SwipeMachine.content.attributeStyleMap) {
        SwipeMachine.content.attributeStyleMap.clear();
    } else {
        SwipeMachine.content.style.transform = '';
    }
};

const _onPointerMove = (e: PointerEvent) => {
    if (SwipeMachine.state === 'IDLE' || SwipeMachine.state === 'LOCKED_OUT') return;
    
    if (isDragActive()) {
        _forceReset();
        return;
    }

    const x = e.clientX | 0;
    const y = e.clientY | 0;
    const dx = x - SwipeMachine.startX;
    const dy = y - SwipeMachine.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    SwipeMachine.currentX = x;
    SwipeMachine.currentY = y;

    // PHASE: DETECTING
    if (SwipeMachine.state === 'DETECTING') {
        if (SwipeMachine.longPressTimer !== 0) {
            // Se detectar Swipe Horizontal claro
            if (absDx > DIRECTION_LOCKED_THRESHOLD && absDx > absDy) {
                if (SwipeMachine.longPressTimer) clearTimeout(SwipeMachine.longPressTimer);
                window.removeEventListener('touchmove', _activeTouchGuard);
                
                // DEFERRED CAPTURE (Swipe Variant):
                // Também capturamos aqui para garantir que o swipe não seja interrompido por scroll diagonal.
                try {
                    if (SwipeMachine.card) SwipeMachine.card.setPointerCapture(e.pointerId);
                } catch(err) {}

                SwipeMachine.state = 'SWIPING';
                document.body.classList.add('is-interaction-active');
                if (SwipeMachine.card) {
                    SwipeMachine.card.classList.remove('is-pressing'); 
                    SwipeMachine.card.classList.add(CSS_CLASSES.IS_SWIPING);
                }
                return;
            }
            return;
        }
    }

    // PHASE: SWIPING
    if (SwipeMachine.state === 'SWIPING') {
        if (!SwipeMachine.rafId) {
            SwipeMachine.rafId = requestAnimationFrame(_renderFrame);
        }
    }
};

const _onPointerUp = (e: PointerEvent) => {
    if (SwipeMachine.longPressTimer) clearTimeout(SwipeMachine.longPressTimer);
    _stopLimitVibration();

    if (SwipeMachine.state === 'SWIPING') {
        const dx = SwipeMachine.currentX - SwipeMachine.startX;
        _finalizeAction(dx);
        
        const blockClick = (ev: MouseEvent) => {
            const t = ev.target as HTMLElement;
            if (!t.closest(DOM_SELECTORS.SWIPE_DELETE_BTN) && !t.closest(DOM_SELECTORS.SWIPE_NOTE_BTN)) {
                ev.stopPropagation(); ev.preventDefault();
            }
            window.removeEventListener('click', blockClick, true);
        };
        if (Math.abs(dx) > ACTION_THRESHOLD) {
            window.addEventListener('click', blockClick, true);
            setTimeout(() => window.removeEventListener('click', blockClick, true), SWIPE_BLOCK_CLICK_MS);
        }
    }

    _forceReset();
};

// --- INITIALIZER ---

export function setupSwipeHandler(container: HTMLElement) {
    updateLayoutMetrics();
    SwipeMachine.container = container;
    
    container.addEventListener('contextmenu', (e) => {
        if (e.cancelable) {
            e.preventDefault();
        }
    });
    
    container.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || isDragActive()) return;
        
        _forceReset();

        const cw = (e.target as HTMLElement).closest<HTMLElement>(DOM_SELECTORS.HABIT_CONTENT_WRAPPER);
        const card = cw?.closest<HTMLElement>(DOM_SELECTORS.HABIT_CARD);
        if (!card || !cw) return;

        card.classList.add('is-pressing');
        
        // NOTE: NÃO chamamos setPointerCapture aqui.
        // Deixamos o ponteiro "solto" para permitir que o navegador detecte scroll nativo
        // se o usuário mover o dedo rapidamente.
        // A captura acontecerá apenas em _triggerDrag (Long Press) ou ao confirmar Swipe.

        const openCards = container.querySelectorAll(`.${CSS_CLASSES.IS_OPEN_LEFT}, .${CSS_CLASSES.IS_OPEN_RIGHT}`);
        openCards.forEach(c => {
            if (c !== card) c.classList.remove(CSS_CLASSES.IS_OPEN_LEFT, CSS_CLASSES.IS_OPEN_RIGHT);
        });

        SwipeMachine.state = 'DETECTING';
        SwipeMachine.card = card;
        SwipeMachine.content = cw;
        SwipeMachine.initialEvent = e;
        SwipeMachine.startX = SwipeMachine.currentX = e.clientX | 0;
        SwipeMachine.startY = SwipeMachine.currentY = e.clientY | 0;
        SwipeMachine.pointerId = e.pointerId; 
        SwipeMachine.wasOpenLeft = card.classList.contains(CSS_CLASSES.IS_OPEN_LEFT);
        SwipeMachine.wasOpenRight = card.classList.contains(CSS_CLASSES.IS_OPEN_RIGHT);
        
        SwipeMachine.lastFeedbackStep = 0;
        SwipeMachine.limitVibrationTimer = 0;

        SwipeMachine.longPressTimer = window.setTimeout(_triggerDrag, LONG_PRESS_DELAY);

        window.addEventListener('pointermove', _onPointerMove, { passive: false });
        window.addEventListener('pointerup', _onPointerUp);
        window.addEventListener('pointercancel', _forceReset);
        window.addEventListener('blur', _forceReset);
        
        // ATIVA O TOUCH GUARD: Bloqueia micro-scrolls nativos durante a detecção
        window.addEventListener('touchmove', _activeTouchGuard, { passive: false });
    });
}
