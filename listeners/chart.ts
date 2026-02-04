/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners/chart.ts
 * @description Controlador de Interação do Gráfico de Evolução (Tooltips).
 */

import { ui } from '../render/ui';
import { chartInteractionState, CHART_PADDING, SVG_HEIGHT } from '../render/chart';
import { t, formatDate, formatDecimal } from '../i18n';
import { setTextContent } from '../render/dom';

// --- CONSTANTS ---
// PERF: Hoisted Intl Options to avoid GC in hot path.
const OPTS_TOOLTIP_DATE: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' };

// --- STATE MACHINE (Isolated for Interaction) ---
let rafId: number | null = null;
let inputClientX = 0;
let cachedDot: HTMLElement | null = null;

function updateTooltipPosition() {
    rafId = null;
    const { wrapper, tooltip, indicator, tooltipDate, tooltipScoreLabel, tooltipScoreValue, tooltipHabits } = ui.chart;
    
    const { lastChartData, chartMinVal, chartValueRange, hasTypedOM } = chartInteractionState;

    if (!wrapper || !tooltip || !indicator || !tooltipDate || !tooltipScoreLabel || !tooltipScoreValue || !tooltipHabits) return;
    if (lastChartData.length === 0 || !wrapper.isConnected) return;

    if (!chartInteractionState.cachedChartRect) {
        chartInteractionState.cachedChartRect = wrapper.getBoundingClientRect();
    }

    const svgWidth = chartInteractionState.cachedChartRect.width;
    if (svgWidth === 0) return;

    const paddingLeft = CHART_PADDING.left;
    const chartWidth = svgWidth - paddingLeft - CHART_PADDING.right;
    const len = lastChartData.length;
    
    const x = inputClientX - chartInteractionState.cachedChartRect.left;
    const pos = (x - paddingLeft) / chartWidth;
    const rawIndex = (pos * (len - 1) + 0.5) | 0;
    const pointIndex = rawIndex < 0 ? 0 : (rawIndex >= len ? len - 1 : rawIndex);

    if (pointIndex !== chartInteractionState.lastRenderedPointIndex) {
        chartInteractionState.lastRenderedPointIndex = pointIndex;
        
        const point = lastChartData[pointIndex];
        const chartHeight = SVG_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;
    
        const pointX = paddingLeft + (pointIndex / (len - 1)) * chartWidth;
        const pointY = CHART_PADDING.top + chartHeight - ((point.value - chartMinVal) / chartValueRange) * chartHeight;

        if (hasTypedOM && indicator.attributeStyleMap) {
            indicator.style.opacity = '1';
            indicator.attributeStyleMap.set('transform', new (window as any).CSSTranslate(CSS.px(pointX), CSS.px(0)));
        } else {
            indicator.style.opacity = '1';
            indicator.style.transform = `translateX(${pointX}px)`;
        }

        // PERF: DOM Query Cache
        if (!cachedDot) cachedDot = indicator.querySelector<HTMLElement>('.chart-indicator-dot');
        if (cachedDot) cachedDot.style.top = `${pointY}px`;
        
        const formattedDate = formatDate(point.timestamp, OPTS_TOOLTIP_DATE);
        
        setTextContent(tooltipDate, formattedDate);
        setTextContent(tooltipScoreLabel, t('chartTooltipScore') + ': ');
        setTextContent(tooltipScoreValue, formatDecimal(point.value));
        setTextContent(tooltipHabits, t('chartTooltipCompleted', { completed: point.completedCount, total: point.scheduledCount }));

        if (!tooltip.classList.contains('visible')) {
            tooltip.classList.add('visible');
        }
        
        let translateX = '-50%';
        if (pointX < 50) translateX = '0%';
        else if (pointX > svgWidth - 50) translateX = '-100%';

        tooltip.style.transform = `translate3d(calc(${pointX}px + ${translateX}), calc(${SVG_HEIGHT / 2}px - 50%), 0)`;
    }
}

export function setupChartListeners() {
    const { wrapper, tooltip, indicator } = ui.chart;
    if (!wrapper || !tooltip || !indicator) return;

    const handlePointerMove = (e: PointerEvent) => {
        inputClientX = e.clientX;
        if (!rafId) {
            rafId = requestAnimationFrame(updateTooltipPosition);
        }
    };

    const handlePointerLeave = () => {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        tooltip.classList.remove('visible');
        indicator.style.opacity = '0';
        chartInteractionState.lastRenderedPointIndex = -1;
    };

    wrapper.addEventListener('pointermove', handlePointerMove);
    wrapper.addEventListener('pointerleave', handlePointerLeave);
    wrapper.addEventListener('pointercancel', handlePointerLeave);
}