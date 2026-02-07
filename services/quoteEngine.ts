
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file services/quoteEngine.ts
 * @description Motor de Recomendação Contextual para Citações Estoicas (The Stoic Oracle).
 * 
 * ARQUITETURA:
 * Sistema de pontuação ponderada (Weighted Scoring System).
 * O objetivo é entregar o "remédio" correto para o estado atual da alma do usuário.
 * 
 * V7.2 UPDATES [2025-05-14] - ROBUST SAGE:
 * - Crash Guard: Validação estrita de datas para evitar seeds NaN.
 * - True Urgency: Implementação real do estado 'urgency' para noites improdutivas.
 * - Case Insensitive: Normalização de tags da IA.
 * - Historical Determinism: O passado é imutável.
 */

// AUDIT FIX: Removed unused 'getHabitDailyInfoForDate'
import { state, Habit, StoicVirtue, GovernanceSphere, HABIT_STATE } from '../state';
import { Quote, StoicTag } from '../data/quotes';
import { calculateDaySummary, getEffectiveScheduleForHabitOnDate, calculateHabitStreak, getScheduleForDate } from './selectors';
import { toUTCIsoDateString, parseUTCIsoDate, getTodayUTCIso } from '../utils';
import { HabitService } from './HabitService';
import {
    QUOTE_WEIGHTS,
    QUOTE_MIN_DISPLAY_DURATION_MS,
    QUOTE_TRIUMPH_ENTER,
    QUOTE_TRIUMPH_EXIT,
    QUOTE_STRUGGLE_ENTER,
    QUOTE_STRUGGLE_EXIT,
    QUOTE_HISTORY_LOOKBACK,
    QUOTE_HISTORY_GOOD_THRESHOLD
} from '../constants';

type PerformanceState = 'neutral' | 'struggle' | 'urgency' | 'triumph' | 'defeat';

// --- TYPES ---

interface ContextVector {
    timeOfDay: 'morning' | 'afternoon' | 'evening';
    dominantVirtues: Set<StoicVirtue>;
    neglectedSphere: GovernanceSphere | null; 
    isRecovery: boolean; 
    performanceState: PerformanceState;
    momentumState: 'building' | 'unbroken' | 'broken' | 'none';
    aiThemes: Set<string>;
    lastShownId?: string;
    isMajorShift?: boolean; 
}

// --- HELPERS ---

function _getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
}

function _stringHash(str: string): number {
    let hash = 5381;
    let i = str.length;
    while(i) {
        hash = (hash * 33) ^ str.charCodeAt(--i);
    }
    return hash >>> 0; 
}

function _analyzeRecentHistory(todayISO: string): number {
    const today = parseUTCIsoDate(todayISO);
    let validDays = 0;
    let successfulDays = 0;

    for (let i = 1; i <= QUOTE_HISTORY_LOOKBACK; i++) {
        const pastDate = new Date(today);
        pastDate.setUTCDate(today.getUTCDate() - i);
        const pastISO = toUTCIsoDateString(pastDate);

        const summary = calculateDaySummary(pastISO);

        if (summary.total > 0) {
            validDays++;
            if ((summary.completed / summary.total) >= QUOTE_HISTORY_GOOD_THRESHOLD) {
                successfulDays++;
            }
        }
    }

    if (validDays === 0) return 1.0;
    return successfulDays / validDays;
}

function _getDominantVirtues(habits: Habit[], dateISO: string): Set<StoicVirtue> {
    const counts: Record<string, number> = {};
    
    // @fix: Get philosophy from the habit's schedule for the given date.
    habits.forEach(h => {
        const habitSchedule = getScheduleForDate(h, dateISO);
        if (habitSchedule?.times.length > 0 && habitSchedule.philosophy) {
            const v = habitSchedule.philosophy.virtue;
            counts[v] = (counts[v] || 0) + 1;
        }
    });

    let max = 0;
    Object.values(counts).forEach(c => { if (c > max) max = c; });
    
    const dominant = new Set<StoicVirtue>();
    if (max > 0) {
        Object.entries(counts).forEach(([virtue, count]) => {
            if (count === max) dominant.add(virtue as StoicVirtue);
        });
    }
    return dominant;
}

function _getNeglectedSphere(habits: Habit[], dateISO: string): GovernanceSphere | null {
    const sphereStats: Record<string, { total: number, done: number }> = {};
    
    // @fix: Get philosophy from the habit's schedule for the given date.
    habits.forEach(h => {
        const habitSchedule = getScheduleForDate(h, dateISO);
        
        if (habitSchedule?.philosophy) {
            const sph = habitSchedule.philosophy.sphere;
            if (!sphereStats[sph]) sphereStats[sph] = { total: 0, done: 0 };
            
            // AUDIT FIX: Use effective schedule to account for day overrides/moves.
            // Previously iterated habitSchedule.times, which missed dynamic changes.
            const effectiveTimes = getEffectiveScheduleForHabitOnDate(h, dateISO);
            
            effectiveTimes.forEach(time => {
                sphereStats[sph].total++;
                // FIX: Use HabitService for status check with habit object passed
                const status = HabitService.getStatus(h.id, dateISO, time);
                if (status === HABIT_STATE.DONE || status === HABIT_STATE.DONE_PLUS) sphereStats[sph].done++;
            });
        }
    });

    let worstRatio = 1.0;
    let worstSphere: GovernanceSphere | null = null;

    Object.entries(sphereStats).forEach(([sphere, stats]) => {
        if (stats.total > 0) {
            const ratio = stats.done / stats.total;
            if (ratio < 1 && ratio <= worstRatio) {
                worstRatio = ratio;
                worstSphere = sphere as GovernanceSphere;
            }
        }
    });

    return (worstRatio < 0.5) ? worstSphere : null;
}

function _checkRecovery(dateISO: string): boolean {
    const todaySummary = calculateDaySummary(dateISO);
    
    if (todaySummary.total > 0 && (todaySummary.completed / todaySummary.total) < 0.2) {
        return false;
    }

    const todayDate = parseUTCIsoDate(dateISO);
    const yesterdayDate = new Date(todayDate.getTime() - 86400000);
    const yesterdayISO = toUTCIsoDateString(yesterdayDate);
    
    const yesterdaySummary = calculateDaySummary(yesterdayISO);
    
    if (yesterdaySummary.total > 0 && 
        (yesterdaySummary.completed / yesterdaySummary.total) < 0.4 &&
        todaySummary.completed > 0) {
        return true;
    }
    
    return false;
}

function _getMomentumState(habits: Habit[], dateISO: string): 'building' | 'unbroken' | 'broken' | 'none' {
    let maxStreak = 0;
    for (const h of habits) {
        const streak = calculateHabitStreak(h, dateISO);
        if (streak > maxStreak) maxStreak = streak;
    }
    if (maxStreak > 10) return 'unbroken'; 
    if (maxStreak > 3) return 'building'; 
    return 'none';
}

function _getPerformanceStateWithHysteresis(dateISO: string, lastContextHash?: string): PerformanceState {
    const summary = calculateDaySummary(dateISO);
    const timeOfDay = _getTimeOfDay();
    
    if (summary.total === 0) return 'neutral';

    const completionRate = summary.completed / summary.total;
    const snoozeRate = summary.snoozed / summary.total;
    
    if (completionRate >= QUOTE_TRIUMPH_ENTER) return 'triumph'; 
    if (snoozeRate > QUOTE_STRUGGLE_ENTER) return 'struggle';
    
    const isToday = dateISO === getTodayUTCIso();
    if (isToday && timeOfDay === 'evening' && completionRate < 0.1 && snoozeRate < 0.1) {
        return 'urgency'; 
    }
    
    if (completionRate < 0.2 && snoozeRate < 0.2) {
        const historyConsistency = _analyzeRecentHistory(dateISO);
        if (historyConsistency < 0.4) {
            return 'defeat';
        }
        return 'neutral';
    }
    
    let previousState: PerformanceState = 'neutral';
    if (lastContextHash && lastContextHash.includes('-')) {
        const parts = lastContextHash.split('-');
        if (parts[4]) previousState = parts[4] as PerformanceState;
    }

    if (previousState === 'triumph' && completionRate >= QUOTE_TRIUMPH_EXIT) return 'triumph';
    if (previousState === 'struggle' && snoozeRate > QUOTE_STRUGGLE_EXIT) return 'struggle';

    return 'neutral';
}

function _gatherContext(dateISO: string): ContextVector {
    const quoteState = state.quoteState;
    const diagnosis = state.dailyDiagnoses[dateISO];
    
    const aiThemes = new Set(
        (diagnosis ? diagnosis.themes : []).map(t => t.toLowerCase())
    );
    
    const dominantVirtues = _getDominantVirtues(state.habits, dateISO);
    const neglectedSphere = _getNeglectedSphere(state.habits, dateISO);
    const isRecovery = _checkRecovery(dateISO);
    
    const momentumState = _getMomentumState(state.habits, dateISO);
    const timeOfDay = _getTimeOfDay();
    const performanceState = _getPerformanceStateWithHysteresis(dateISO, quoteState?.lockedContext);

    let isMajorShift = false;
    if (quoteState && quoteState.lockedContext) {
        const parts = quoteState.lockedContext.split('-');
        const oldState = parts[4] as PerformanceState;
        
        if (oldState !== performanceState && (performanceState === 'triumph' || performanceState === 'defeat' || performanceState === 'urgency')) {
            isMajorShift = true;
        }
        if (parts[3] !== timeOfDay) {
            isMajorShift = true;
        }
    } else {
        isMajorShift = true;
    }

    return {
        timeOfDay,
        dominantVirtues,
        neglectedSphere,
        isRecovery,
        performanceState,
        momentumState,
        aiThemes,
        lastShownId: quoteState?.currentId,
        isMajorShift
    };
}

function _scoreQuote(quote: Quote, context: ContextVector): number {
    let score = 1.0; 

    // Helper DRY para aplicar regra baseada em tags
    const applyTagRule = (condition: boolean, tagsToCheck: StoicTag[], weight: number) => {
        if (condition) {
            for (const tag of tagsToCheck) {
                if (quote.metadata.tags.includes(tag)) {
                    score += weight;
                    return; // Aplica o peso apenas uma vez por regra
                }
            }
        }
    };

    // 0. ANTI-REPETITION
    if (context.lastShownId === quote.id) {
        score += QUOTE_WEIGHTS.RECENTLY_SHOWN;
    }

    // 1. AI BOOST
    if (context.aiThemes.size > 0) {
        const matches = quote.metadata.tags.filter(tag => context.aiThemes.has(tag));
        score += matches.length * QUOTE_WEIGHTS.AI_MATCH;
    }

    // 2. SPHERE SENSITIVITY
    if (context.neglectedSphere && quote.metadata.sphere === context.neglectedSphere) {
        score += QUOTE_WEIGHTS.SPHERE_MATCH;
    }

    // 3. RECOVERY
    applyTagRule(context.isRecovery, ['resilience', 'growth', 'hope'], QUOTE_WEIGHTS.RECOVERY);

    // 4. TIME OF DAY
    if (context.timeOfDay === 'morning') applyTagRule(true, ['morning'], QUOTE_WEIGHTS.TIME_OF_DAY);
    if (context.timeOfDay === 'evening') applyTagRule(true, ['evening', 'reflection', 'rest'], QUOTE_WEIGHTS.TIME_OF_DAY);

    // 5. VIRTUE RESONANCE
    if (context.dominantVirtues.has(quote.metadata.virtue)) {
        score += QUOTE_WEIGHTS.VIRTUE_ALIGN;
    }

    // 6. PERFORMANCE REACTION
    // AUDIT FIX: Renamed shadowed variable 'state' to 'perfState'
    const perfState = context.performanceState;
    if (perfState === 'defeat') {
        applyTagRule(true, ['resilience', 'acceptance', 'fate'], QUOTE_WEIGHTS.PERFORMANCE);
    } else if (perfState === 'triumph') {
        applyTagRule(true, ['humility', 'temperance', 'death'], QUOTE_WEIGHTS.PERFORMANCE);
    } else if (perfState === 'struggle') {
        applyTagRule(true, ['discipline', 'action', 'focus'], QUOTE_WEIGHTS.PERFORMANCE);
    } else if (perfState === 'urgency') {
        if (quote.metadata.tags.includes('urgency') || quote.metadata.tags.includes('time') || 
            quote.metadata.tags.includes('action') || quote.metadata.tags.includes('death')) {
            score += QUOTE_WEIGHTS.PERFORMANCE * 1.2;
        }
    }

    // 7. MOMENTUM CONTEXT
    applyTagRule(context.momentumState === 'unbroken', ['consistency', 'habit'], QUOTE_WEIGHTS.MOMENTUM);

    return score;
}

// --- PUBLIC API ---

// @fix: Accept readonly Quote[] in selectBestQuote to allow usage with frozen arrays from data/quotes.
export function selectBestQuote(quotes: readonly Quote[], dateISO: string): Quote {
    if (!quotes || quotes.length === 0) {
        throw new Error("No quotes provided to engine.");
    }

    if (!dateISO || isNaN(Date.parse(dateISO))) {
        dateISO = getTodayUTCIso();
    }

    const context = _gatherContext(dateISO);
    const isToday = dateISO === getTodayUTCIso();

    // STICKINESS CHECK (Today Only)
    if (isToday && state.quoteState && !context.isMajorShift) {
        const elapsed = Date.now() - state.quoteState.displayedAt;
        if (elapsed < QUOTE_MIN_DISPLAY_DURATION_MS) {
            const current = quotes.find(q => q.id === state.quoteState!.currentId);
            if (current) return current;
        }
    }
    
    const scoredQuotes = quotes.map(q => ({
        quote: q,
        score: _scoreQuote(q, context)
    }));

    scoredQuotes.sort((a, b) => b.score - a.score);

    const topScore = scoredQuotes[0].score;
    const threshold = topScore > 10 ? topScore * 0.7 : 0;
    let candidates = scoredQuotes.filter(item => item.score >= threshold);
    if (candidates.length > 5) candidates = candidates.slice(0, 5); 
    
    const virtueStr = Array.from(context.dominantVirtues).sort().join('');
    const sphereStr = context.neglectedSphere || 'none';
    
    const signature = `${dateISO}-${context.timeOfDay}-${context.performanceState}-${virtueStr}-${sphereStr}`;
    
    const year = parseInt(dateISO.substring(0, 4), 10);
    const day = parseInt(dateISO.substring(8, 10), 10);
    
    const rotationHour = isToday ? new Date().getHours() : 12;
    const safeYear = isNaN(year) ? 2024 : year;
    const safeDay = isNaN(day) ? 1 : day;

    const seed = Math.abs(_stringHash(signature) + (safeYear * safeDay) + rotationHour); 
    const rnd = (seed % 1000) / 1000;
    
    const selectedIndex = Math.floor(rnd * candidates.length);
    const selectedQuote = candidates[selectedIndex].quote;

    if (isToday) {
        state.quoteState = {
            currentId: selectedQuote.id,
            displayedAt: Date.now(),
            lockedContext: signature
        };
    }
    
    return selectedQuote;
}
