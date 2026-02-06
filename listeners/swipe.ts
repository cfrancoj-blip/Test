
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners/swipe.ts
 * @description Motor de Gestos Híbrido (Long Press + Swipe).
 * 
 * [ESTRATÉGIA DE INTERAÇÃO]:
 * Tocar no corpo inicia um Long Press (500ms) para arrastar.
 *    - Usa 'Active Touch Guard' para diferenciar Scroll vs Hold.
 *    - Feedback visual (.is-charging) informa o usuário.
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
const ACTION_THRESHOLD = SWIPE_ACTION_THRESHOLD;
const LONG_PRESS_DELAY = 500;
const HOLD_TOLERANCE_PX = 10; // Tolerância de tremor para Long Press

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
    
    // Timers
    longPressTimer: 0,
    
    // Progressive Haptics
    lastFeedbackStep: 0,
    limitVibrationTimer: 0, 
    
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

// --- TOUCH GUARD (Para Long Press no Corpo) ---
// Impede o scroll nativo se o usuário estiver tentando segurar o cartão imóvel
const _activeTouchGuard = (e: TouchEvent) => {
    if (SwipeMachine.state !== 'DETECTING') return;

    const touch = e.touches[0];
    if (!touch) return;

    const dx = touch.clientX - SwipeMachine.startX;
    const dy = touch.clientY - SwipeMachine.startY;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // Se estiver dentro da tolerância de "Segurar", bloqueia o scroll
    if (dist < HOLD_TOLERANCE_PX) {
        if (e.cancelable) e.preventDefault();
    } else {
        // Se moveu muito, cancela o Long Press
        if (Math.abs(dy) > Math.abs(dx)) {
            // É scroll vertical -> Cancela Long Press
            _cancelLongPress();
        }
    }
};

const _cancelLongPress = () => {
    if (SwipeMachine.longPressTimer) {
        clearTimeout(SwipeMachine.longPressTimer);
        SwipeMachine.longPressTimer = 0;
    }
    if (SwipeMachine.card) {
        SwipeMachine.card.classList.remove('is-charging');
        SwipeMachine.card.classList.remove('is-pressing');
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
    _cancelLongPress();
    _stopLimitVibration();
    
    if (SwipeMachine.container) {
        SwipeMachine.container.classList.remove('is-locking-scroll');
    }

    const { card, content, pointerId } = SwipeMachine;
    if (card) {
        card.classList.remove(CSS_CLASSES.IS_SWIPING);
        card.classList.remove('is-pressing'); 
        card.classList.remove('is-charging');
        
        if (pointerId !== -1) {
            try { 
                if (card.hasPointerCapture(pointerId)) card.releasePointerCapture(pointerId); 
            } catch(e){}
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

// BRIDGE TOUCHMOVE BLOCKER [2026-02-06]:
// No Android Chromium, o navegador decide o gesto (scroll vs manipulação JS) no 'touchstart'.
// Como touch-action: pan-y estava ativo no touchstart (500ms atrás no long press),
// o navegador reserva o direito de rolar verticalmente e dispara 'pointercancel'.
// A ÚNICA forma de cancelar isso mid-gesture é via preventDefault() em touchmove.
// Este listener "ponte" fica ativo durante a transição swipe→drag para garantir
// que nenhum touchmove escape sem preventDefault() durante o setup.
const _bridgeTouchBlock = (e: TouchEvent) => {
    if (e.cancelable) e.preventDefault();
};

const _triggerDrag = () => {
    SwipeMachine.longPressTimer = 0;
    _stopLimitVibration();
    
    if (!SwipeMachine.card || !SwipeMachine.content || !SwipeMachine.initialEvent) return;

    // ANDROID FIX [2026-02-06]: Registrar bloqueador de touchmove ANTES de qualquer coisa.
    // Isso garante que, mesmo durante o setup do drag, o navegador não consiga iniciar
    // um scroll nativo vertical que dispararia 'pointercancel'.
    window.addEventListener('touchmove', _bridgeTouchBlock, { passive: false });
    
    // ANDROID FIX [2026-02-06]: Aplicar lock de scroll no container imediatamente.
    // Mesmo que touch-action via CSS não tenha efeito retroativo no Android,
    // overflow:hidden impede o container de scrollar e ajuda a evitar pointercancel.
    if (SwipeMachine.container) {
        SwipeMachine.container.classList.add('is-locking-scroll');
    }

    try {
        SwipeMachine.card.setPointerCapture(SwipeMachine.pointerId);
    } catch (e) {
        window.removeEventListener('touchmove', _bridgeTouchBlock);
        if (SwipeMachine.container) SwipeMachine.container.classList.remove('is-locking-scroll');
        _forceReset();
        return;
    }

    triggerHaptic('medium');
    
    // Limpa feedback visual
    SwipeMachine.card.classList.remove('is-charging');
    
    // Inicia a sessão de Drag
    startDragSession(SwipeMachine.card, SwipeMachine.content, SwipeMachine.initialEvent);
    
    // Remove o bloqueador ponte - o drag.ts agora tem seu próprio listener ativo
    window.removeEventListener('touchmove', _bridgeTouchBlock);
    
    _cleanListeners();
    SwipeMachine.state = 'IDLE';
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
        
        // Se houver movimento significativo...
        if (absDx > DIRECTION_LOCKED_THRESHOLD || absDy > DIRECTION_LOCKED_THRESHOLD) {
            
            // ...e for claramente horizontal -> SWIPE
            if (absDx > absDy) {
                _cancelLongPress();
                try {
                    if (SwipeMachine.card) SwipeMachine.card.setPointerCapture(e.pointerId);
                } catch(err) {}

                SwipeMachine.state = 'SWIPING';
                document.body.classList.add('is-interaction-active');
                if (SwipeMachine.card) {
                    SwipeMachine.card.classList.add(CSS_CLASSES.IS_SWIPING);
                }
            } 
            // ...e for vertical -> SCROLL NATIVO (Cancela nossa lógica)
            else {
                _cancelLongPress();
                SwipeMachine.state = 'LOCKED_OUT';
            }
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
    _cancelLongPress();
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

        const target = e.target as HTMLElement;
        const cw = target.closest<HTMLElement>(DOM_SELECTORS.HABIT_CONTENT_WRAPPER);
        const card = cw?.closest<HTMLElement>(DOM_SELECTORS.HABIT_CARD);
        if (!card || !cw) return;

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

        const openCards = container.querySelectorAll(`.${CSS_CLASSES.IS_OPEN_LEFT}, .${CSS_CLASSES.IS_OPEN_RIGHT}`);
        openCards.forEach(c => {
            if (c !== card) c.classList.remove(CSS_CLASSES.IS_OPEN_LEFT, CSS_CLASSES.IS_OPEN_RIGHT);
        });

        // Detecção de Swipe, Scroll ou Long Press
        SwipeMachine.state = 'DETECTING';
        
        // Inicia Timer de Long Press
        SwipeMachine.longPressTimer = window.setTimeout(_triggerDrag, LONG_PRESS_DELAY);
        
        // Visual Feedback
        card.classList.add('is-pressing');
        card.classList.add('is-charging');
        
        window.addEventListener('pointermove', _onPointerMove, { passive: false });
        window.addEventListener('pointerup', _onPointerUp);
        window.addEventListener('pointercancel', _forceReset);
        window.addEventListener('blur', _forceReset);
        
        // Touch Guard para garantir Long Press sem scroll
        window.addEventListener('touchmove', _activeTouchGuard, { passive: false });
    });
}
