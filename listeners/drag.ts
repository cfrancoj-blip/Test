
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners/drag.ts
 * @description Motor Isolado de Drag & Drop (Synthetic Physics).
 * 
 * [ISOLATION PRINCIPLE]:
 * Este módulo não monitora eventos passivos. Ele é ativado explicitamente
 * pelo módulo de Swipe (Long Press) e assume controle total da UI
 * até que o gesto termine.
 */

import { handleHabitDrop, reorderHabit } from '../services/habitActions';
import { TimeOfDay, state } from '../state';
import { getEffectiveScheduleForHabitOnDate } from '../services/selectors';
import { triggerHaptic } from '../utils';
import { DOM_SELECTORS, CSS_CLASSES } from '../render/constants';
import { renderApp } from '../render';
import { DRAG_SCROLL_ZONE_PX, DRAG_MAX_SCROLL_SPEED, DRAG_DROP_INDICATOR_GAP } from '../constants';

const SCROLL_ZONE_PX = DRAG_SCROLL_ZONE_PX;
const MAX_SCROLL_SPEED = DRAG_MAX_SCROLL_SPEED;
const DROP_INDICATOR_GAP = DRAG_DROP_INDICATOR_GAP;
const DRAGGABLE_SELECTOR = `${DOM_SELECTORS.HABIT_CARD}:not(.${CSS_CLASSES.DRAGGING})`;

// STATE MACHINE
const DragMachine = {
    isActive: false,
    container: null as HTMLElement | null,
    containerRect: null as DOMRect | null,
    
    // Source
    sourceEl: null as HTMLElement | null,
    sourceId: null as string | null,
    sourceTime: null as TimeOfDay | null,
    activePointerId: -1, // NOVO: Rastreia o ID do ponteiro para captura
    cachedSchedule: null as readonly TimeOfDay[] | null,
    
    // Visuals
    ghostEl: null as HTMLElement | null,
    indicator: null as HTMLElement | null,
    grabOffsetX: 0,
    grabOffsetY: 0,
    
    // Targets
    targetZone: null as HTMLElement | null,
    targetCard: null as HTMLElement | null,
    insertPos: null as 'before' | 'after' | null,
    renderedZone: null as HTMLElement | null,
    
    // Logic
    isValidDrop: false,
    scrollSpeed: 0,
    rafId: 0,
    
    // Typed OM
    hasTypedOM: typeof window !== 'undefined' && !!(window.CSS && (window as any).CSSTranslate && CSS.px)
};

export const isDragging = () => DragMachine.isActive;

// --- SCROLL LOCKER (LEGACY TOUCH SUPPORT) ---
// Em navegadores modernos (Chrome Android), pointer capture pode não ser suficiente 
// se touch-action: pan-y estiver ativo no início do gesto.
// Adicionamos um listener de 'touchmove' não-passivo para matar o scroll nativo com preventDefault.
const _preventTouchScroll = (e: TouchEvent) => {
    if (DragMachine.isActive) {
        e.preventDefault();
    }
};

// --- DOM UTILS ---

function _cleanupListeners() {
    window.removeEventListener('pointermove', _onPointerMove);
    window.removeEventListener('pointerup', _onPointerUp);
    window.removeEventListener('pointercancel', _forceReset);
    window.removeEventListener('blur', _forceReset);
    // Remove o bloqueador de scroll nativo
    window.removeEventListener('touchmove', _preventTouchScroll);
}

const _forceReset = (arg?: boolean | Event) => {
    // Handle overload: boolean (manual call) or Event (listener call)
    const dropSuccess = arg === true;

    // 1. Release Pointer Capture (CRITICAL FIX)
    if (DragMachine.sourceEl && DragMachine.activePointerId !== -1) {
        try {
            DragMachine.sourceEl.releasePointerCapture(DragMachine.activePointerId);
        } catch (e) {
            // Ignora erro se o ponteiro já não existir
        }
    }

    // 2. Stop Loops
    if (DragMachine.rafId) cancelAnimationFrame(DragMachine.rafId);
    
    // 3. Clean Global UI (AGGRESSIVE CLEANUP)
    document.body.classList.remove('is-dragging-active', 'is-interaction-active');
    
    if (DragMachine.container) DragMachine.container.classList.remove('is-dragging');
    
    // 4. Clean Elements
    // UX FIX [2025-06-08]: Se o drop foi bem-sucedido (dropSuccess=true), NÃO removemos a classe .dragging imediatamente.
    // Isso mantém o cartão invisível (opacity: 0) enquanto a lógica de negócio processa a mudança e dispara o re-render.
    // Se o drop falhou ou foi cancelado, removemos a classe para que o cartão "reapareça" instantaneamente no local original.
    if (DragMachine.sourceEl && !dropSuccess) {
        DragMachine.sourceEl.classList.remove(CSS_CLASSES.DRAGGING);
    }

    if (DragMachine.renderedZone) DragMachine.renderedZone.classList.remove(CSS_CLASSES.DRAG_OVER, CSS_CLASSES.INVALID_DROP);
    DragMachine.ghostEl?.remove();
    DragMachine.indicator?.remove();
    
    // 5. Reset State
    DragMachine.isActive = false;
    DragMachine.sourceEl = null;
    DragMachine.activePointerId = -1;
    DragMachine.ghostEl = null;
    DragMachine.targetZone = null;
    DragMachine.targetCard = null;
    DragMachine.renderedZone = null;
    DragMachine.scrollSpeed = 0;
    
    // 6. Render Recovery
    if (state.uiDirtyState.habitListStructure) {
        requestAnimationFrame(() => renderApp());
    }
    
    _cleanupListeners();
};

function getDragAfterElement(container: HTMLElement, y: number): HTMLElement | null {
    const draggableElements = container.querySelectorAll(DRAGGABLE_SELECTOR);
    let closestEl: HTMLElement | null = null;
    let closestOffset = Number.NEGATIVE_INFINITY;

    for (const child of draggableElements) {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closestOffset) {
            closestOffset = offset;
            closestEl = child as HTMLElement;
        }
    }
    return closestEl;
}

function _resolveDropZone(x: number, y: number): HTMLElement | null {
    // Poke through the ghost
    const prevDisplay = DragMachine.ghostEl?.style.display;
    if (DragMachine.ghostEl) DragMachine.ghostEl.style.display = 'none';
    
    const el = document.elementFromPoint(x, y) as HTMLElement;
    
    if (DragMachine.ghostEl) DragMachine.ghostEl.style.display = prevDisplay || '';

    if (!el) return null;
    
    // Try to find a Drop Zone
    let dropZone = el.closest<HTMLElement>(DOM_SELECTORS.DROP_ZONE);
    if (dropZone) return dropZone;

    // Fallback: Check parent wrapper if hitting time marker or padding
    const wrapper = el.closest<HTMLElement>('.habit-group-wrapper');
    return wrapper ? wrapper.querySelector<HTMLElement>(DOM_SELECTORS.DROP_ZONE) : null;
}

// --- PHYSICS LOOP ---

function _computeScrollSpeed(y: number): number {
    if (!DragMachine.containerRect) return 0;
    const { top, height } = DragMachine.containerRect;
    const bottom = top + height;
    
    if (y < top + SCROLL_ZONE_PX) {
        const ratio = (top + SCROLL_ZONE_PX - y) / SCROLL_ZONE_PX;
        return -Math.max(2, ratio * MAX_SCROLL_SPEED);
    }
    if (y > bottom - SCROLL_ZONE_PX) {
        const ratio = (y - (bottom - SCROLL_ZONE_PX)) / SCROLL_ZONE_PX;
        return Math.max(2, ratio * MAX_SCROLL_SPEED);
    }
    return 0;
}

function _renderFrame() {
    if (!DragMachine.isActive) return;

    // 1. Auto Scroll with Bounds Check
    if (DragMachine.scrollSpeed !== 0 && DragMachine.container) {
        const { scrollTop, scrollHeight, clientHeight } = DragMachine.container;
        const maxScroll = scrollHeight - clientHeight;
        
        // BOUNCE PROTECTION: Só rola se houver espaço. 
        // Evita "pulos" quando tenta forçar scroll além do limite (que em overflow: hidden pode causar problemas de repaint).
        // FIX [2025-06-16]: Aumentado buffer de 1px para 5px para absorver imprecisões de sub-pixel em telas High DPI.
        const SCROLL_BUFFER = 5;

        if (DragMachine.scrollSpeed > 0) { // Scrolling Down
            if (scrollTop < maxScroll - SCROLL_BUFFER) {
                DragMachine.container.scrollBy(0, DragMachine.scrollSpeed);
            }
        } else { // Scrolling Up
            if (scrollTop > SCROLL_BUFFER) {
                DragMachine.container.scrollBy(0, DragMachine.scrollSpeed);
            }
        }
    }

    // 2. Zone Highlights
    if (DragMachine.renderedZone !== DragMachine.targetZone) {
        if (DragMachine.renderedZone) {
            DragMachine.renderedZone.classList.remove(CSS_CLASSES.DRAG_OVER, CSS_CLASSES.INVALID_DROP);
            // Ensure indicator is removed from old zone
            if (DragMachine.indicator && DragMachine.indicator.parentElement === DragMachine.renderedZone) {
                DragMachine.indicator.remove();
            }
        }
        DragMachine.renderedZone = DragMachine.targetZone;
    }

    if (DragMachine.targetZone && DragMachine.indicator) {
        const isSelfZone = DragMachine.targetZone.dataset.time === DragMachine.sourceTime;
        const showDragOver = DragMachine.isValidDrop && !isSelfZone;
        const showInvalid = !DragMachine.isValidDrop;

        if (DragMachine.targetZone.classList.contains(CSS_CLASSES.DRAG_OVER) !== showDragOver) {
            DragMachine.targetZone.classList.toggle(CSS_CLASSES.DRAG_OVER, showDragOver);
        }
        if (DragMachine.targetZone.classList.contains(CSS_CLASSES.INVALID_DROP) !== showInvalid) {
            DragMachine.targetZone.classList.toggle(CSS_CLASSES.INVALID_DROP, showInvalid);
        }

        // 3. Indicator Positioning
        if (DragMachine.indicator.parentElement !== DragMachine.targetZone) {
            DragMachine.targetZone.appendChild(DragMachine.indicator);
        }

        if (DragMachine.isValidDrop) {
            DragMachine.indicator.classList.add('visible');
            let topPos = 0;
            if (DragMachine.targetCard) {
                if (DragMachine.insertPos === 'before') {
                    topPos = DragMachine.targetCard.offsetTop - DROP_INDICATOR_GAP;
                } else {
                    topPos = DragMachine.targetCard.offsetTop + DragMachine.targetCard.offsetHeight + DROP_INDICATOR_GAP;
                }
            } else {
                // Empty zone or append to end
                if (DragMachine.targetZone.children.length === 0) {
                    topPos = DROP_INDICATOR_GAP;
                } else {
                    const lastChild = DragMachine.targetZone.lastElementChild as HTMLElement;
                    // Ignore indicator itself if it's the last child
                    if (lastChild && lastChild !== DragMachine.indicator) {
                         topPos = lastChild.offsetTop + lastChild.offsetHeight + DROP_INDICATOR_GAP;
                    }
                }
            }
            
            if (DragMachine.hasTypedOM && DragMachine.indicator.attributeStyleMap) {
                DragMachine.indicator.attributeStyleMap.set('transform', new (window as any).CSSTranslate(CSS.px(0), CSS.px(topPos), CSS.px(0)));
            } else {
                DragMachine.indicator.style.transform = `translate3d(0, ${topPos}px, 0)`;
            }
        } else {
            DragMachine.indicator.classList.remove('visible');
        }
    }

    DragMachine.rafId = requestAnimationFrame(_renderFrame);
}

// --- HANDLERS ---

const _onPointerMove = (e: PointerEvent) => {
    if (!DragMachine.isActive) return;
    
    // SAFETY CHECK: Se nenhum botão estiver pressionado, perdemos o 'mouseup'.
    // Isso acontece se o cursor sair da janela e soltar, ou em algumas falhas de touch.
    // Forçamos o reset para não deixar o card "preso" ao mouse.
    if (e.buttons === 0) {
        _onPointerUp(e);
        return;
    }

    e.preventDefault();

    const clientX = e.clientX;
    const clientY = e.clientY;

    // A. Move Ghost
    if (DragMachine.ghostEl) {
        const pageX = clientX + window.scrollX;
        const pageY = clientY + window.scrollY;
        const x = pageX - DragMachine.grabOffsetX;
        const y = pageY - DragMachine.grabOffsetY;

        if (DragMachine.hasTypedOM && DragMachine.ghostEl.attributeStyleMap) {
            DragMachine.ghostEl.attributeStyleMap.set('transform', new (window as any).CSSTranslate(CSS.px(x), CSS.px(y)));
        } else {
            DragMachine.ghostEl.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.05)`;
        }
    }

    // B. Logic
    DragMachine.scrollSpeed = _computeScrollSpeed(clientY);
    const dropZone = _resolveDropZone(clientX, clientY);

    if (!dropZone) {
        DragMachine.targetZone = null;
        DragMachine.isValidDrop = false;
        return;
    }

    const targetTime = dropZone.dataset.time as TimeOfDay;
    const isSameGroup = targetTime === DragMachine.sourceTime;
    
    // Check if habit already exists in target time (unless it's the same group - reordering)
    let isValid = true;
    if (!isSameGroup && DragMachine.cachedSchedule?.includes(targetTime)) {
        isValid = false;
    }

    DragMachine.targetZone = dropZone;
    DragMachine.isValidDrop = isValid;

    if (isValid) {
        const afterElement = getDragAfterElement(dropZone, clientY);
        if (afterElement) {
            DragMachine.targetCard = afterElement;
            DragMachine.insertPos = 'before';
        } else {
            // FIX [2025-06-08]: Robust Fallback for Last Element
            // CSS :last-child fails if the last element is the dragging one (which is structurally the last child).
            // We use JS filtering to get the true last visual element.
            const allCards = Array.from(dropZone.querySelectorAll(DOM_SELECTORS.HABIT_CARD));
            const staticCards = allCards.filter(c => !c.classList.contains(CSS_CLASSES.DRAGGING));
            const lastChild = staticCards.length > 0 ? staticCards[staticCards.length - 1] as HTMLElement : null;
            
            if (lastChild) {
                DragMachine.targetCard = lastChild;
                DragMachine.insertPos = 'after';
            } else {
                DragMachine.targetCard = null;
                DragMachine.insertPos = null;
            }
        }
    } else {
        DragMachine.targetCard = null;
    }
};

const _onPointerUp = (e: PointerEvent) => {
    if (!DragMachine.isActive) return;
    
    let dropSuccess = false;

    if (DragMachine.isValidDrop && DragMachine.targetZone && DragMachine.sourceId && DragMachine.sourceTime) {
        const targetTime = DragMachine.targetZone.dataset.time as TimeOfDay;
        const isReorder = DragMachine.sourceTime === targetTime;
        
        let reorderInfo = undefined;
        if (DragMachine.targetCard && DragMachine.targetCard.dataset.habitId) {
            reorderInfo = {
                id: DragMachine.targetCard.dataset.habitId,
                pos: DragMachine.insertPos || 'after'
            };
        }

        if (isReorder) {
            if (reorderInfo) {
                triggerHaptic('medium');
                reorderHabit(DragMachine.sourceId, reorderInfo.id, reorderInfo.pos as 'before' | 'after');
                // SUCESSO: Marcamos true apenas se uma ação real foi disparada para reconstruir a lista.
                dropSuccess = true;
            } else {
                // FALHA/NO-OP: Tentou reordenar mas não encontrou alvo válido (ex: lista de 1 item, ou arrastou pra si mesmo).
                // Marcamos false para remover a classe .dragging imediatamente e restaurar a visibilidade.
                dropSuccess = false;
            }
        } else {
            triggerHaptic('medium');
            handleHabitDrop(
                DragMachine.sourceId,
                DragMachine.sourceTime,
                targetTime,
                reorderInfo
            );
            dropSuccess = true;
        }
    }
    
    _forceReset(dropSuccess);
};

// --- PUBLIC API ---

export function startDragSession(card: HTMLElement, content: HTMLElement, startEvent: PointerEvent) {
    // 1. Hard Reset Previous State
    _forceReset();

    if (!card.dataset.habitId || !card.dataset.time || !DragMachine.container) return;

    // ANDROID FIX [2026-02-06]: REGISTRAR TOUCHMOVE PREVENTION IMEDIATAMENTE.
    // No Android Chromium, touch-action CSS é avaliado no touchstart e não pode ser alterado
    // depois. A ÚNICA forma de impedir scroll nativo mid-gesture é via preventDefault()
    // em touchmove com listener non-passive. Registramos ANTES de qualquer DOM manipulation
    // para não deixar nenhum frame sem proteção.
    window.addEventListener('touchmove', _preventTouchScroll, { passive: false });
    
    // 2. Initialize State (ANDROID FIX: isActive ANTES do setup para que _preventTouchScroll funcione)
    DragMachine.isActive = true;
    DragMachine.sourceEl = card;
    DragMachine.sourceId = card.dataset.habitId;
    DragMachine.sourceTime = card.dataset.time as TimeOfDay;
    DragMachine.activePointerId = startEvent.pointerId; // Guarda o ID para captura
    DragMachine.containerRect = DragMachine.container.getBoundingClientRect();
    
    // CRITICAL: POINTER CAPTURE
    // Isso garante que todos os eventos pointermove vão para o card (sourceEl),
    // mesmo se o dedo sair do elemento ou passar por cima de outros.
    try {
        card.setPointerCapture(startEvent.pointerId);
    } catch (e) {
        // Se falhar (ex: evento não confiável), o drag ainda tenta funcionar com os listeners globais
        console.warn("Drag capture failed", e);
    }
    
    const habit = state.habits.find(h => h.id === DragMachine.sourceId);
    if (habit) {
        DragMachine.cachedSchedule = getEffectiveScheduleForHabitOnDate(habit, state.selectedDate);
    }

    // 3. Create Ghost
    const rect = content.getBoundingClientRect();
    const ghost = content.cloneNode(true) as HTMLElement;
    ghost.classList.add(CSS_CLASSES.DRAG_IMAGE_GHOST);
    
    // Copy computed styles for fidelity
    const styles = window.getComputedStyle(content);
    ghost.style.backgroundColor = styles.backgroundColor;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    
    // Position Override (Critical to make it visible, overriding -9999px from CSS class)
    ghost.style.position = 'absolute';
    ghost.style.top = '0';
    ghost.style.left = '0';
    ghost.style.margin = '0';
    ghost.style.zIndex = '10000';
    ghost.style.pointerEvents = 'none'; // Critical for elementFromPoint
    
    // Position
    DragMachine.grabOffsetX = startEvent.clientX - rect.left;
    DragMachine.grabOffsetY = startEvent.clientY - rect.top;
    
    const startX = startEvent.clientX + window.scrollX - DragMachine.grabOffsetX;
    const startY = startEvent.clientY + window.scrollY - DragMachine.grabOffsetY;
    
    if (DragMachine.hasTypedOM && ghost.attributeStyleMap) {
        ghost.attributeStyleMap.set('transform', new (window as any).CSSTranslate(CSS.px(startX), CSS.px(startY)));
    } else {
        ghost.style.transform = `translate3d(${startX}px, ${startY}px, 0) scale(1.05)`;
    }

    document.body.appendChild(ghost);
    DragMachine.ghostEl = ghost;

    // 4. Create Indicator
    DragMachine.indicator = document.createElement('div');
    DragMachine.indicator.className = 'drop-indicator';

    // 5. Update UI Classes & Start Loop
    
    // SYNCHRONOUS LOCK [2025-06-08]: 
    // Aplicamos as classes de bloqueio imediatamente (sem requestAnimationFrame).
    // Isso previne que o navegador processe eventos de rolagem nativos no próximo frame
    // antes que overflow:hidden entre em vigor. Essencial para listas longas.
    card.classList.add(CSS_CLASSES.DRAGGING);
    // FORCE LAYOUT REFLOW: Garante que 'touch-action: none' (do CSS) seja aplicado 
    // imediatamente pelo navegador antes do próximo evento de toque, prevenindo scroll nativo.
    void card.offsetWidth; 

    document.body.classList.add('is-dragging-active');
    if (DragMachine.container) DragMachine.container.classList.add('is-dragging');
    
    requestAnimationFrame(_renderFrame);

    // 6. Attach Listeners
    window.addEventListener('pointermove', _onPointerMove, { passive: false });
    window.addEventListener('pointerup', _onPointerUp);
    window.addEventListener('pointercancel', _forceReset);
    window.addEventListener('blur', _forceReset);
    
    // NOTA: touchmove prevention já foi registrado no início de startDragSession().
    // Isso é intencional — no Android, qualquer gap sem preventDefault() no touchmove
    // permite que o navegador inicie scroll nativo e dispare pointercancel.
}

export function setupDragHandler(container: HTMLElement) {
    DragMachine.container = container;
}
