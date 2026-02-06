
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners/swipe.ts
 * @description Motor de Gestos Unificado (Swipe & Drag Trigger).
 * 
 * [ARQUITETURA DE RESOLUÇÃO DE CONFLITO SCROLL vs DRAG]:
 * 1. Fase DETECTING: O usuário tocou, mas não sabemos se quer Scroll, Swipe ou Drag.
 * 2. Active Touch Guard: Um listener 'touchmove' (não-passivo) monitora micro-movimentos.
 *    - Se mover pouco (< 10px): Chamamos preventDefault() para impedir o scroll nativo de roubar o evento.
 *    - Se mover muito rápido: Deixamos o navegador assumir o scroll.
 * 3. Long Press: Se o usuário mantiver o dedo estável (protegido pelo Guard) por 500ms,
 *    ativamos o Drag e capturamos o ponteiro definitivamente.
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

// ZONA DE PROTEÇÃO:
// Quantos pixels o usuário pode mover o dedo sem cancelar o Long Press?
// Aumentamos para 15px para tolerar "dedos trêmulos" durante o hold.
const HOLD_TOLERANCE_PX = 15;

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
    startTime: 0,
    
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

// --- TOUCH GUARD (A Mágica Anti-Drop) ---
// Este listener roda em modo { passive: false }, permitindo bloquear o scroll nativo.
const _activeTouchGuard = (e: TouchEvent) => {
    if (SwipeMachine.state !== 'DETECTING') return;

    const touch = e.touches[0];
    if (!touch) return;

    const dx = touch.clientX - SwipeMachine.startX;
    const dy = touch.clientY - SwipeMachine.startY;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // LÓGICA CRÍTICA:
    // Se o movimento está dentro da tolerância de "estar segurando",
    // bloqueamos o navegador de iniciar o scroll. Isso evita o evento 'pointercancel'.
    if (dist < HOLD_TOLERANCE_PX) {
        if (e.cancelable) e.preventDefault();
    } else {
        // Se o usuário moveu muito, assumimos que ele DESISTIU do hold e quer rolar/swipar.
        // Não chamamos preventDefault(), permitindo que o navegador role a página se for vertical,
        // ou que nossa lógica de Swipe assuma se for horizontal.
        
        // Se for vertical excessivo, cancelamos o timer de long press para economizar recursos
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > HOLD_TOLERANCE_PX) {
            if (SwipeMachine.longPressTimer) {
                clearTimeout(SwipeMachine.longPressTimer);
                SwipeMachine.longPressTimer = 0;
                // Remove feedback visual
                if (SwipeMachine.card) SwipeMachine.card.classList.remove('is-charging');
            }
        }
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
        
        // VISUAL FEEDBACK: Remove charging/pressing state
        card.classList.remove('is-pressing'); 
        card.classList.remove('is-charging');
        
        // Libera captura se existir e se ainda formos donos dela
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

const _triggerDrag = () => {
    SwipeMachine.longPressTimer = 0;
    _stopLimitVibration();
    
    // Verificação de segurança: O estado ainda é válido?
    if (SwipeMachine.state !== 'DETECTING' || !SwipeMachine.card || !SwipeMachine.content || !SwipeMachine.initialEvent) return;

    // DEFERRED CAPTURE: O momento da verdade.
    // O usuário segurou tempo suficiente. Agora "roubamos" o ponteiro do navegador.
    // Isso garante que, a partir daqui, movimentos verticais serão Drag e não Scroll.
    try {
        SwipeMachine.card.setPointerCapture(SwipeMachine.pointerId);
    } catch (e) {
        // Se falhar (ex: usuário soltou no último milissegundo), abortamos.
        _forceReset();
        return;
    }

    triggerHaptic('medium');
    
    // VISUAL: Transição de 'Charging' para 'Dragging'
    SwipeMachine.card.classList.remove('is-charging');
    
    // Passa o controle para o motor de Drag
    // Importante: Drag assume o controle dos eventos a partir daqui.
    startDragSession(SwipeMachine.card, SwipeMachine.content, SwipeMachine.initialEvent);
    
    // Limpeza local deste módulo (listeners de swipe não são mais necessários)
    _cleanListeners();
    
    // Reset parcial para não interferir no Drag
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
        if (SwipeMachine.longPressTimer !== 0) {
            
            // DETECÇÃO DE SWIPE HORIZONTAL
            // Se o movimento horizontal for dominante e significativo,
            // cancelamos o Long Press e iniciamos o Swipe.
            if (absDx > DIRECTION_LOCKED_THRESHOLD && absDx > absDy) {
                if (SwipeMachine.longPressTimer) clearTimeout(SwipeMachine.longPressTimer);
                window.removeEventListener('touchmove', _activeTouchGuard);
                
                // Captura para garantir fluidez no Swipe
                try {
                    if (SwipeMachine.card) SwipeMachine.card.setPointerCapture(e.pointerId);
                } catch(err) {}

                SwipeMachine.state = 'SWIPING';
                document.body.classList.add('is-interaction-active');
                if (SwipeMachine.card) {
                    SwipeMachine.card.classList.remove('is-pressing'); 
                    SwipeMachine.card.classList.remove('is-charging');
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
        
        // Bloqueio de clique acidental após swipe
        const blockClick = (ev: MouseEvent) => {
            const t = ev.target as HTMLElement;
            // Permite clique nos botões de ação revelados
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

        // VISUAL: Feedback imediato de clique
        card.classList.add('is-pressing');
        // VISUAL: Feedback de "carregando" (pavio/respiração)
        card.classList.add('is-charging');
        
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
        SwipeMachine.startTime = Date.now(); 
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
