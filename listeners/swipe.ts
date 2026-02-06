
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
const DIRECTION_LOCKED_THRESHOLD = 5; // Pixels para definir intenção direcional
const LONG_PRESS_DRIFT_TOLERANCE = 24; 
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
    limitVibrationTimer: 0, // Timer para vibração contínua no limite
    
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
        // Para a vibração do navegador imediatamente se possível
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(0);
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
        
        // Ajusta offset se já estava aberto
        if (SwipeMachine.wasOpenLeft) tx += SwipeMachine.actionWidth;
        if (SwipeMachine.wasOpenRight) tx -= SwipeMachine.actionWidth;

        const absX = Math.abs(tx);
        const actionPoint = SwipeMachine.actionWidth; 
        
        let visualX = tx;

        // HAPTICS & VISUAL LOGIC
        if (absX >= actionPoint) {
            // LIMIT REACHED: Aplica resistência elástica (Rubber Banding)
            // Em vez de travar (clamp), permitimos passar um pouco com resistência.
            
            const excess = absX - actionPoint;
            const resistanceFactor = 0.25; // 1px de movimento visual a cada 4px de movimento real
            const maxVisualOvershoot = 20; // Máximo que pode esticar visualmente
            
            // Fórmula de amortecimento linear com teto
            const visualOvershoot = Math.min(excess * resistanceFactor, maxVisualOvershoot);
            
            // Recalcula a posição visual aplicando o sinal original
            const sign = tx > 0 ? 1 : -1;
            visualX = (actionPoint + visualOvershoot) * sign;

            // Vibração Contínua (Tensão Máxima)
            if (!SwipeMachine.limitVibrationTimer) {
                triggerHaptic('heavy');
                SwipeMachine.limitVibrationTimer = window.setInterval(() => {
                    triggerHaptic('medium'); 
                }, 80); 
            }
        } else {
            // Zona Normal (Abaixo do limite)
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

        // Aplica a transformação visual (pode incluir o overshoot elástico)
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
};

const _forceReset = () => {
    // 1. Stop Loops & Timers
    if (SwipeMachine.rafId) cancelAnimationFrame(SwipeMachine.rafId);
    if (SwipeMachine.longPressTimer) clearTimeout(SwipeMachine.longPressTimer);
    _stopLimitVibration();
    
    // 2. Clean DOM State
    // SCROLL LOCK FIX: Garante que a trava do container seja removida (caso tenha sido aplicada pelo Drag)
    if (SwipeMachine.container) {
        SwipeMachine.container.classList.remove('is-locking-scroll');
    }

    const { card, content, pointerId } = SwipeMachine;
    if (card) {
        card.classList.remove(CSS_CLASSES.IS_SWIPING);
        // Remove Press State (Visual feedback)
        card.classList.remove('is-pressing');
        
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
    
    // 3. Global Cleanup
    document.body.classList.remove('is-interaction-active');
    
    // 4. Reset Memory State
    SwipeMachine.state = 'IDLE';
    SwipeMachine.card = null;
    SwipeMachine.content = null;
    SwipeMachine.initialEvent = null;
    SwipeMachine.pointerId = -1;
    SwipeMachine.rafId = 0;
    
    // 5. Render Recovery
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

    triggerHaptic('medium');
    startDragSession(SwipeMachine.card, SwipeMachine.content, SwipeMachine.initialEvent);
    
    // Force reset cleans up classes and listeners, but we are now in Drag mode.
    // Drag mode has its own cleanup.
    // We just need to stop *Swipe* listeners and clear the scroll lock class (drag mode has its own lock)
    _cleanListeners();
    SwipeMachine.state = 'IDLE';
    
    // Clean swipe states
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
        // --- ZONA DE PROTEÇÃO DE LONG PRESS ---
        if (SwipeMachine.longPressTimer !== 0) {
            // SCROLL LOCK BREAK [2025-06-09]:
            // Se o usuário mover verticalmente mais que um limiar curto (ex: 15px),
            // entendemos como INTENÇÃO DE SCROLL explícita.
            
            const SCROLL_INTENT_THRESHOLD = 15;
            
            if (absDy > SCROLL_INTENT_THRESHOLD) {
                // Abort Long Press -> Revert to Browser Scroll
                clearTimeout(SwipeMachine.longPressTimer);
                SwipeMachine.longPressTimer = 0;
                
                if (SwipeMachine.card) {
                    SwipeMachine.card.classList.remove('is-pressing');
                    try {
                        // CRITICAL: Libera a captura para que o navegador processe o restante do gesto (rolagem)
                        // ou pare de enviar eventos para cá.
                        SwipeMachine.card.releasePointerCapture(e.pointerId);
                    } catch (err) {}
                }
                
                _forceReset();
                return;
            }
            
            // Se mover horizontalmente, inicia Swipe
            if (absDx > DIRECTION_LOCKED_THRESHOLD) {
                // Horizontal -> Start Swipe
                if (SwipeMachine.longPressTimer) clearTimeout(SwipeMachine.longPressTimer);
                
                SwipeMachine.state = 'SWIPING';
                document.body.classList.add('is-interaction-active');
                if (SwipeMachine.card) {
                    SwipeMachine.card.classList.remove('is-pressing'); // Remove press state
                    SwipeMachine.card.classList.add(CSS_CLASSES.IS_SWIPING);
                    // Maintain Capture
                }
                return;
            }
            
            // Se estiver dentro da tolerância, não faz nada (continua esperando timer com CAPTURA ATIVA)
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
    
    // PREVENT CONTEXT MENU (Android Fix for Long Press Drop)
    // O Chrome no Android dispara 'contextmenu' no long press, o que cancela o evento de ponteiro.
    // Prevenimos isso para permitir que nossa lógica de Long Press (Drag) funcione.
    container.addEventListener('contextmenu', (e) => {
        // Apenas previne se cancelável e se parece ser um gesto de toque/long press
        if (e.cancelable) {
            e.preventDefault();
        }
    });
    
    container.addEventListener('pointerdown', (e) => {
        // Ignora cliques com botão direito ou se já estiver arrastando
        if (e.button !== 0 || isDragActive()) return;
        
        // Garante reset de estado anterior
        _forceReset();

        const cw = (e.target as HTMLElement).closest<HTMLElement>(DOM_SELECTORS.HABIT_CONTENT_WRAPPER);
        const card = cw?.closest<HTMLElement>(DOM_SELECTORS.HABIT_CARD);
        if (!card || !cw) return;

        // SCROLL LOCK INIT [2025-06-09] (HYBRID):
        // 1. NÃO aplica overflow:hidden no container imediatamente. Isso matava a rolagem normal.
        // 2. Aplica classe visual ao cartão.
        card.classList.add('is-pressing');
        
        // 3. Captura o ponteiro. Isso impede que o navegador inicie rolagem nativa Imediatamente,
        // dando chance ao JS de detectar "Hold" ou "Swipe".
        // Se o usuário mover verticalmente depois, liberamos a captura no `pointermove`.
        try {
            card.setPointerCapture(e.pointerId);
        } catch (err) {
            // Falha silenciosa se captura não for permitida
        }

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
    });
}
