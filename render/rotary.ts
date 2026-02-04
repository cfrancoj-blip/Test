
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file render/rotary.ts
 * @description Componente de Interface "Reel Rotary" (Seletor Giratório/Carrossel).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo gerencia interações de toque e mouse de alta frequência (gestos).
 * Deve manter 60fps cravados durante o arrasto ("scrubbing").
 * 
 * ARQUITETURA (Physics-based UI):
 * - **Responsabilidade Única:** Encapsular a lógica de física, gestos e renderização do seletor circular.
 * - **Geometry Caching:** Utiliza `ResizeObserver` para monitorar dimensões sem causar "Layout Thrashing"
 *   (leituras síncronas de DOM) dentro do loop de eventos `pointermove`.
 * - **SNIPER OPTIMIZATION (CSS Typed OM):** Usa `attributeStyleMap` para definir transformações. 
 *   Isso evita a serialização de strings no JS e o parsing no CSS Engine, comunicando valores brutos
 *   diretamente ao compositor do navegador.
 * 
 * DECISÕES TÉCNICAS:
 * 1. **CSS Transforms:** Movimentação via `translateX` para garantir composição na GPU.
 * 2. **State Tracking:** A posição visual é rastreada em JS (`currentVisualX`), eliminando a necessidade de ler a matriz CSS.
 */

interface RotaryConfig {
    viewportEl: HTMLElement;
    reelEl: HTMLElement;
    prevBtn: HTMLButtonElement;
    nextBtn: HTMLButtonElement;
    optionsCount: number;
    getInitialIndex: () => number;
    onIndexChange: (index: number) => Promise<void> | void;
    render: () => void;
}

export function setupReelRotary({
    viewportEl,
    reelEl,
    prevBtn,
    nextBtn,
    optionsCount,
    getInitialIndex,
    onIndexChange,
    render,
}: RotaryConfig) {

    let currentIndex = getInitialIndex();
    
    // STATE TRACKING: Mantém a posição visual atual em memória.
    // Evita ler o DOM (getComputedStyle) que causa Layout Thrashing.
    let currentVisualX = 0;

    // PERFORMANCE [2025-02-23]: Cache da largura do item via ResizeObserver.
    let cachedItemWidth = 95; // Valor inicial seguro
    
    // SNIPER OPTIMIZATION: Feature Detection for Typed OM
    const hasTypedOM = typeof window !== 'undefined' && !!(reelEl.attributeStyleMap && (window as any).CSSTranslate && window.CSS && CSS.px);

    // Helper para atualizar a posição visual logicamente e no DOM
    const updatePosition = (index: number, animate: boolean) => {
        // Integer math for pixel alignment
        const targetX = -(index * cachedItemWidth) | 0;
        currentVisualX = targetX;
        
        if (!animate) {
            reelEl.style.transition = 'none';
        } else {
            reelEl.style.transition = '';
        }
        
        // BLEEDING-EDGE PERF (CSS Typed OM):
        // Comunicação direta com o compositor da GPU para animações de "snap".
        if (hasTypedOM && reelEl.attributeStyleMap) {
            reelEl.attributeStyleMap.set('transform', new (window as any).CSSTranslate(CSS.px(targetX), CSS.px(0)));
        } else {
            reelEl.style.transform = `translateX(${targetX}px)`;
        }
    };

    const handleIndexChange = async (direction: 'next' | 'prev') => {
        let nextIndex;
        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % optionsCount;
        } else {
            // Aritmética modular segura para números negativos
            nextIndex = (currentIndex - 1 + optionsCount) % optionsCount;
        }
        await onIndexChange(nextIndex);
        
        currentIndex = getInitialIndex(); // Re-sincroniza
        render(); // Snap to grid
        // Atualiza o tracker visual após a renderização
        updatePosition(currentIndex, true);
    };

    prevBtn.addEventListener('click', () => handleIndexChange('prev'));
    nextBtn.addEventListener('click', () => handleIndexChange('next'));

    viewportEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') handleIndexChange('next');
        else if (e.key === 'ArrowLeft') handleIndexChange('prev');
    });

    // Variáveis de estado para o gesto de swipe
    let startX = 0;
    let isSwiping = false;
    let startTransformX = 0;
    
    // RESIZE OBSERVER LOOP FIX: Debounce logic via RAF
    let resizeRaf = 0;
    const resizeObserver = new ResizeObserver(entries => {
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
            for (const entry of entries) {
                const firstChild = entry.target.firstElementChild;
                if (firstChild) {
                    cachedItemWidth = firstChild.clientWidth;
                    // Re-alinha ao redimensionar
                    updatePosition(currentIndex, false);
                }
            }
        });
    });
    
    resizeObserver.observe(reelEl);
    
    const SWIPE_THRESHOLD = 40;

    /**
     * [MAIN THREAD HOT PATH]: Executado a cada movimento do ponteiro (~120Hz).
     * Deve ser zero-allocation e zero-layout-read.
     */
    const pointerMove = (e: PointerEvent) => {
        if (!isSwiping) return;
        
        e.preventDefault();
        
        const diffX = (e.clientX - startX) | 0; // Force int
        
        // Use cached state instead of DOM read
        const newTranslateX = (startTransformX + diffX) | 0;
        
        // Clamping (Limites)
        const minTranslateX = -((optionsCount - 1) * cachedItemWidth);
        const maxTranslateX = 0;
        
        // Math.max/min são rápidos em V8
        const clampedTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, newTranslateX));
        
        // Update State Tracker
        currentVisualX = clampedTranslateX;
        
        // BLEEDING-EDGE PERF (CSS Typed OM):
        // No "hot path" do gesto, evitamos criar e parsear strings de `transform`,
        // escrevendo os valores numéricos diretamente no motor de composição para fluidez máxima.
        if (hasTypedOM && reelEl.attributeStyleMap) {
            reelEl.attributeStyleMap.set('transform', new (window as any).CSSTranslate(CSS.px(clampedTranslateX), CSS.px(0)));
        } else {
            reelEl.style.transform = `translateX(${clampedTranslateX}px)`;
        }
    };

    const endSwipe = (e: PointerEvent) => {
        // Redundancy check: Listeners already removed in pointerUp, but good for safety
        window.removeEventListener('pointermove', pointerMove);
        window.removeEventListener('pointerup', pointerUp);
        window.removeEventListener('pointercancel', endSwipe);
        
        if (!isSwiping) return;
        isSwiping = false;
        
        // CHAOS FIX: Release Locks (redundant but safe)
        viewportEl.classList.remove('is-interacting');
        document.body.classList.remove('is-interaction-active');
        
        try {
            if (viewportEl.hasPointerCapture(e.pointerId)) {
                viewportEl.releasePointerCapture(e.pointerId);
            }
        } catch (err) {
            // Ignore
        }
        
        // Restaura transição para snap
        requestAnimationFrame(() => {
            reelEl.style.transition = '';
        });

        currentIndex = getInitialIndex();
        render(); // Update ARIA and state logic
        updatePosition(currentIndex, true); // Visual Snap
    };

    const pointerUp = async (e: PointerEvent) => {
        if (!isSwiping) return;
        
        // CHAOS FIX [2025-06-03]: CRITICAL ORDERING.
        // 1. Remove listeners immediately to prevent 'pointermove' from re-triggering and re-locking during async await.
        window.removeEventListener('pointermove', pointerMove);
        window.removeEventListener('pointerup', pointerUp);
        // Leave pointercancel for endSwipe cleanup just in case
        
        const diffX = e.clientX - startX;

        // 2. Early Lock Release.
        // Remove global lock to allow 'renderHabits' (triggered by setLanguage) to run during the await.
        document.body.classList.remove('is-interaction-active');
        
        if (Math.abs(diffX) > SWIPE_THRESHOLD) {
            if (diffX < 0) { // Esquerda (Next)
                await onIndexChange((currentIndex + 1) % optionsCount);
            } else { // Direita (Prev)
                await onIndexChange((currentIndex - 1 + optionsCount) % optionsCount);
            }
        }
        
        endSwipe(e);
    };

    viewportEl.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.button !== 0) return;

        startX = e.clientX;
        isSwiping = true;
        currentIndex = getInitialIndex();
        
        viewportEl.setPointerCapture(e.pointerId);
        
        // CHAOS FIX: Acquire Locks
        // 1. Local Lock: Prevents render/modals.ts from overwriting position
        viewportEl.classList.add('is-interacting');
        // 2. Global Lock: Pauses heavy rendering (charts, etc) for smoothness
        document.body.classList.add('is-interaction-active');

        // OPTIMIZATION: Use memory state instead of getComputedStyle.
        // Reading getComputedStyle here would force a synchronous reflow (Layout Thrashing).
        // Since we control the transform, we rely on currentVisualX.
        startTransformX = currentVisualX;
        
        // Disable transition for direct 1:1 movement
        reelEl.style.transition = 'none';
        
        window.addEventListener('pointermove', pointerMove, { passive: false }); 
        window.addEventListener('pointerup', pointerUp);
        window.addEventListener('pointercancel', endSwipe);
    });
    
    // Inicialização da posição visual
    updatePosition(currentIndex, false);
}
