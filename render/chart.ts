/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file render/chart.ts
 * @description Motor de Renderização de Gráficos SVG (Evolução de Hábitos).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo roda na thread principal e manipula o DOM (SVG) diretamente.
 * Deve manter 60fps durante interações (tooltip) e minimizar o tempo de bloqueio durante atualizações de dados.
 * 
 * ARQUITETURA (SVG & Geometry Caching):
 * - **Responsabilidade Única:** Visualizar a consistência dos hábitos nos últimos 30 dias (Pontuação Composta).
 * - **Zero Allocations (Render Loop):** Utiliza Object Pooling para os pontos de dados e Memoization 
 *   para evitar recálculos matemáticos se os dados não mudaram.
 * - **SNIPER OPTIMIZATION (Typed OM):** Posicionamento do Tooltip via `attributeStyleMap` para evitar serialização de strings.
 * 
 * DECISÕES TÉCNICAS:
 * 1. **Raw Math vs Abstractions:** Funções de escala (d3-scale style) foram removidas em favor de matemática in-line.
 * 2. **Smi Optimization:** Loops de cálculo usam inteiros e lógica flat.
 * 3. **Curve Smoothing:** Algoritmo Catmull-Rom to Cubic Bezier para renderização orgânica sem custo de CPU.
 */

import { state, isChartDataDirty } from '../state';
import { calculateDaySummary } from '../services/selectors';
import { ui } from './ui';
import { t, formatDate, formatDecimal, formatEvolution } from '../i18n';
import { getTodayUTCIso, parseUTCIsoDate, toUTCIsoDateString, MS_PER_DAY, logger } from '../utils';
import { setTextContent } from './dom';
import {
    CHART_DAYS,
    CHART_INITIAL_SCORE,
    CHART_MAX_DAILY_CHANGE_RATE,
    CHART_PLUS_BONUS_MULTIPLIER,
    CHART_SVG_HEIGHT,
    CHART_PADDING,
    CHART_MIN_VISUAL_AMPLITUDE,
    CHART_SAFETY_PADDING_RATIO,
    CHART_FALLBACK_WIDTH,
    CHART_CONTAINER_PADDING_PX,
    CHART_INTERSECTION_THRESHOLD,
    CHART_CURVE_TENSION
} from '../constants';

// Re-exports for listeners/chart.ts
export const SVG_HEIGHT = CHART_SVG_HEIGHT;
export { CHART_PADDING };

// PERFORMANCE [2025-04-13]: Hoisted Intl Options.
const OPTS_AXIS_LABEL_SHORT: Intl.DateTimeFormatOptions = { 
    month: 'short', 
    day: 'numeric', 
    timeZone: 'UTC'
};

const OPTS_AXIS_LABEL_WITH_YEAR: Intl.DateTimeFormatOptions = { 
    month: 'short', 
    day: 'numeric', 
    timeZone: 'UTC',
    year: '2-digit'
};

type ChartDataPoint = {
    date: string;
    timestamp: number;
    value: number;
    completedCount: number;
    scheduledCount: number;
};

// --- OBJECT POOL (PERFORMANCE) ---
const chartDataPool: ChartDataPoint[] = Array.from({ length: CHART_DAYS }, () => ({
    date: '',
    timestamp: 0,
    value: 0,
    completedCount: 0,
    scheduledCount: 0,
}));

// --- SHARED STATE for Interaction & Rendering ---
export const chartInteractionState = {
    lastChartData: [] as ChartDataPoint[],
    cachedChartRect: null as DOMRect | null,
    chartMinVal: 0,
    chartValueRange: 100,
    lastRenderedPointIndex: -1,
    hasTypedOM: typeof window !== 'undefined' && !!(window.CSS && (window as any).CSSTranslate && CSS.px)
};

// MEMOIZATION STATE
let renderedDataRef: ChartDataPoint[] | null = null;
let renderedWidth = 0;

// Controle de visibilidade e observadores
let isChartVisible = true;
let isChartDirty = false;
let chartObserver: IntersectionObserver | null = null;
let resizeObserver: ResizeObserver | null = null;
let observersInitialized = false;
let resizeRaf = 0; // Prevent stacked RAFs

function calculateChartData(): ChartDataPoint[] {
    try {
        const endDate = parseUTCIsoDate(state.selectedDate);
        if (isNaN(endDate.getTime())) {
            throw new Error("Invalid selectedDate for chart calculation");
        }

        let currentTimestamp = endDate.getTime() - ((CHART_DAYS - 1) * MS_PER_DAY);
        const iteratorDate = new Date(currentTimestamp);
        const todayISO = getTodayUTCIso();
        let previousDayValue = CHART_INITIAL_SCORE;

        for (let i = 0; i < CHART_DAYS; i = (i + 1) | 0) {
            iteratorDate.setTime(currentTimestamp);
            const currentDateISO = toUTCIsoDateString(iteratorDate);
            const summary = calculateDaySummary(currentDateISO, iteratorDate);
            const { total: scheduledCount, completed: completedCount, pending: pendingCount, showPlusIndicator } = summary;
            const isToday = currentDateISO === todayISO;
            const isFuture = currentDateISO > todayISO;

            let currentValue: number;
            if (isFuture || (isToday && pendingCount > 0)) {
                currentValue = previousDayValue;
            } else if (scheduledCount > 0) {
                const completionRatio = completedCount / scheduledCount;
                let performanceFactor = (completionRatio - 0.5) * 2;
                if (showPlusIndicator) {
                    performanceFactor = 1.0 * CHART_PLUS_BONUS_MULTIPLIER;
                }
                const dailyChange = performanceFactor * CHART_MAX_DAILY_CHANGE_RATE;
                currentValue = previousDayValue * (1 + dailyChange);
            } else {
                currentValue = previousDayValue;
            }
            
            const point = chartDataPool[i];
            point.date = currentDateISO;
            point.timestamp = currentTimestamp;
            point.value = currentValue;
            point.completedCount = completedCount;
            point.scheduledCount = scheduledCount;

            previousDayValue = currentValue;
            currentTimestamp += MS_PER_DAY;
        }
        
        return chartDataPool;
    } catch (e) {
        logger.error("Critical error in calculateChartData:", e);
        return [];
    }
}

function _generateChartPaths(chartData: ChartDataPoint[], chartWidthPx: number): { areaPathData: string, linePathData: string } {
    const len = chartData.length;
    if (len === 0) return { areaPathData: '', linePathData: '' };

    let dataMin = Infinity, dataMax = -Infinity;
    for (let i = 0; i < len; i = (i + 1) | 0) {
        const val = chartData[i].value;
        if (val < dataMin) dataMin = val;
        if (val > dataMax) dataMax = val;
    }

    const MIN_VISUAL_AMPLITUDE = CHART_MIN_VISUAL_AMPLITUDE;
    let spread = dataMax - dataMin;

    if (spread < MIN_VISUAL_AMPLITUDE) {
        const center = (dataMin + dataMax) / 2;
        dataMin = center - (MIN_VISUAL_AMPLITUDE / 2);
        dataMax = center + (MIN_VISUAL_AMPLITUDE / 2);
        spread = MIN_VISUAL_AMPLITUDE;
    }

    const safetyPadding = spread * CHART_SAFETY_PADDING_RATIO;
    const minVal = dataMin - safetyPadding;
    const maxVal = dataMax + safetyPadding;
    const valueRange = maxVal - minVal;
    
    chartInteractionState.chartMinVal = minVal;
    chartInteractionState.chartValueRange = valueRange > 0 ? valueRange : 1;

    const newViewBox = `0 0 ${chartWidthPx} ${SVG_HEIGHT}`;
    if (ui.chart.svg.getAttribute('viewBox') !== newViewBox) {
        ui.chart.svg.setAttribute('viewBox', newViewBox);
    }

    const paddingLeft = CHART_PADDING.left, paddingTop = CHART_PADDING.top;
    const chartW = chartWidthPx - paddingLeft - CHART_PADDING.right;
    const chartH = SVG_HEIGHT - paddingTop - CHART_PADDING.bottom;
    const xStep = chartW / (len - 1), yFactor = chartH / chartInteractionState.chartValueRange, yBase = paddingTop + chartH;

    const firstVal = chartData[0].value;
    const firstX = paddingLeft;
    const firstY = yBase - ((firstVal - minVal) * yFactor);
    let linePathData = 'M ' + firstX + ' ' + firstY;
    const k = CHART_CURVE_TENSION; 

    for (let i = 0; i < len - 1; i = (i + 1) | 0) {
        const p0Val = chartData[i > 0 ? i - 1 : i].value;
        const p0x = paddingLeft + (i > 0 ? i - 1 : i) * xStep;
        const p0y = yBase - ((p0Val - minVal) * yFactor);
        const p1Val = chartData[i].value;
        const p1x = paddingLeft + i * xStep;
        const p1y = yBase - ((p1Val - minVal) * yFactor);
        const p2Val = chartData[i + 1].value;
        const p2x = paddingLeft + (i + 1) * xStep;
        const p2y = yBase - ((p2Val - minVal) * yFactor);
        const p3Val = chartData[i + 2 < len ? i + 2 : i + 1].value;
        const p3x = paddingLeft + (i + 2 < len ? i + 2 : i + 1) * xStep;
        const p3y = yBase - ((p3Val - minVal) * yFactor);

        const cp1x = p1x + (p2x - p0x) * k, cp1y = p1y + (p2y - p0y) * k;
        const cp2x = p2x - (p3x - p1x) * k, cp2y = p2y - (p3y - p1y) * k;

        linePathData += ' C ' + cp1x + ' ' + cp1y + ', ' + cp2x + ' ' + cp2y + ', ' + p2x + ' ' + p2y;
    }

    const areaBaseY = yBase - ((minVal - minVal) * yFactor);
    const lastX = paddingLeft + (len - 1) * xStep;
    const areaPathData = linePathData + ' V ' + areaBaseY + ' L ' + firstX + ' ' + areaBaseY + ' Z';
    
    return { areaPathData, linePathData };
}

function _updateAxisLabels(chartData: ChartDataPoint[]) {
    const { axisStart, axisEnd } = ui.chart;
    const firstDateMs = chartData[0].timestamp;
    const lastDateMs = chartData[chartData.length - 1].timestamp;

    const currentYear = new Date().getUTCFullYear();
    const firstYear = new Date(firstDateMs).getUTCFullYear();
    const lastYear = new Date(lastDateMs).getUTCFullYear();
    
    const firstLabel = formatDate(firstDateMs, (firstYear !== currentYear) ? OPTS_AXIS_LABEL_WITH_YEAR : OPTS_AXIS_LABEL_SHORT);
    const lastLabel = formatDate(lastDateMs, (lastYear !== currentYear) ? OPTS_AXIS_LABEL_WITH_YEAR : OPTS_AXIS_LABEL_SHORT);

    setTextContent(axisStart, firstLabel);
    setTextContent(axisEnd, lastLabel);
}

function _updateEvolutionIndicator(chartData: ChartDataPoint[]) {
    const { evolutionIndicator } = ui.chart;
    const lastPoint = chartData[chartData.length - 1];
    
    let referencePoint = chartData[0];
    const len = chartData.length;
    for (let i = 0; i < len; i = (i + 1) | 0) {
        if (chartData[i].scheduledCount > 0) {
            referencePoint = chartData[i];
            break;
        }
    }

    const evolution = ((lastPoint.value - referencePoint.value) / referencePoint.value) * 100;
    
    const newClass = `chart-evolution-indicator ${evolution >= 0 ? 'positive' : 'negative'}`;
    if (evolutionIndicator.className !== newClass) evolutionIndicator.className = newClass;
    setTextContent(evolutionIndicator, `${evolution > 0 ? '+' : ''}${formatEvolution(evolution)}%`);
}

function _updateChartDOM(chartData: ChartDataPoint[]) {
    const { areaPath, linePath } = ui.chart;
    if (!areaPath || !linePath || !chartData || chartData.length === 0) return;

    let svgWidth = ui.chart.wrapper.getBoundingClientRect().width;
    if (!svgWidth && ui.chartContainer.clientWidth > 0) svgWidth = ui.chartContainer.clientWidth - CHART_CONTAINER_PADDING_PX;
    if (!svgWidth) svgWidth = CHART_FALLBACK_WIDTH;

    if (chartData === renderedDataRef && svgWidth === renderedWidth) return;

    const { areaPathData, linePathData } = _generateChartPaths(chartData, svgWidth);
    
    areaPath.setAttribute('d', areaPathData);
    linePath.setAttribute('d', linePathData);
    
    _updateAxisLabels(chartData);
    _updateEvolutionIndicator(chartData);

    renderedDataRef = chartData;
    renderedWidth = svgWidth;
    chartInteractionState.cachedChartRect = null;
}

function initChartObservers() {
    if (observersInitialized || !ui.chartContainer) return;
    observersInitialized = true;

    chartObserver = new IntersectionObserver((entries) => {
        isChartVisible = entries[0].isIntersecting;
        if (isChartVisible && isChartDirty) {
            isChartDirty = false;
            _updateChartDOM(chartInteractionState.lastChartData);
        }
    }, { threshold: CHART_INTERSECTION_THRESHOLD });
    chartObserver.observe(ui.chartContainer);

    resizeObserver = new ResizeObserver(() => {
        // PERF FIX [2025-06-05]: Debounce the resize handler with requestAnimationFrame.
        // This prevents the "ResizeObserver loop completed with undelivered notifications" error
        // by deferring the DOM update to the next frame, breaking the synchronous feedback loop
        // where updating the chart might trigger another resize event immediately.
        if (resizeRaf) cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
            if (!isChartVisible) return;
            chartInteractionState.cachedChartRect = null;
            _updateChartDOM(chartInteractionState.lastChartData);
        });
    });
    resizeObserver.observe(ui.chartContainer);
}

export function renderChart() {
    try {
        initChartObservers();

        if (isChartDataDirty() || chartInteractionState.lastChartData.some(d => d.date === '')) {
            chartInteractionState.lastChartData = calculateChartData();
            chartInteractionState.lastRenderedPointIndex = -1; 
            renderedDataRef = null;
        }

        const isEmpty = chartInteractionState.lastChartData.length < 2 || chartInteractionState.lastChartData.every(d => d.scheduledCount === 0);
        ui.chartContainer.classList.toggle('is-empty', isEmpty);

        if (ui.chart.title) {
            const newTitle = t('appName');
            if (ui.chart.title.innerHTML !== newTitle) ui.chart.title.innerHTML = newTitle;
        }
        if (ui.chart.subtitle) {
            const summary = calculateDaySummary(state.selectedDate);
            const hasCompletedHabits = summary.completed > 0;
            const newSubtitleKey = hasCompletedHabits ? 'chartSubtitleProgress' : 'appSubtitle';
            const newSubtitle = t(newSubtitleKey);
            if (ui.chart.subtitle.textContent !== newSubtitle) ui.chart.subtitle.textContent = newSubtitle;
        }
        
        if (isEmpty) {
            if (ui.chart.emptyState) {
                const newEmptyText = t('chartEmptyState');
                if (ui.chart.emptyState.textContent !== newEmptyText) ui.chart.emptyState.textContent = newEmptyText;
            }
            return;
        }

        if (isChartVisible) {
            _updateChartDOM(chartInteractionState.lastChartData);
            isChartDirty = false;
        } else {
            isChartDirty = true;
        }
    } catch (e) {
        logger.error("Failed to render chart:", e);
        ui.chartContainer.classList.add('is-empty');
    }
}