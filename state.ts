
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file state.ts
 * @description Definição do Estado Global e Estruturas de Dados (Single Source of Truth).
 */

import { getTodayUTCIso, parseUTCIsoDate, toUTCIsoDateString, logger } from './utils';
import { CACHE_HABIT_APPEARANCE_DAYS, CACHE_STREAKS_YEARS } from './constants';

// --- TYPES & INTERFACES ---

export type StoicVirtue = 'Wisdom' | 'Courage' | 'Justice' | 'Temperance';
export type StoicLevel = 1 | 2 | 3;
export type StoicDiscipline = 'Desire' | 'Action' | 'Assent';
export type GovernanceSphere = 'Biological' | 'Structural' | 'Social' | 'Mental';
export type HabitNature = 'Addition' | 'Subtraction';

export interface HabitPhilosophy {
  readonly sphere: GovernanceSphere;
  readonly level: StoicLevel;
  readonly virtue: StoicVirtue;
  readonly discipline: StoicDiscipline;
  readonly nature: HabitNature;
  readonly conscienceKey: string;
  readonly stoicConcept: string;
  readonly masterQuoteId: string;
}

export type Frequency =
    | { readonly type: 'daily' }
    | { readonly type: 'interval'; readonly unit: 'days' | 'weeks'; readonly amount: number }
    | { readonly type: 'specific_days_of_week'; readonly days: readonly number[] };

export interface HabitDayData {
    goalOverride?: number;
    note?: string;
}

export type HabitDailyInstances = Partial<Record<TimeOfDay, HabitDayData>>;

export interface HabitDailyInfo {
    instances: HabitDailyInstances;
    dailySchedule: TimeOfDay[] | undefined;
}

export interface HabitGoal { 
    readonly type: 'pages' | 'minutes' | 'check'; 
    readonly total?: number; 
    readonly unitKey?: string;
}

export interface HabitSchedule {
    readonly startDate: string;
    endDate?: string; 
    readonly icon: string;
    readonly color: string;
    readonly goal: HabitGoal;
    readonly philosophy?: HabitPhilosophy;
    readonly name?: string;
    readonly subtitle?: string;
    readonly nameKey?: string;
    readonly subtitleKey?: string;
    readonly times: readonly TimeOfDay[];
    readonly frequency: Frequency;
    readonly scheduleAnchor: string;
}

export interface Habit {
    readonly id: string;
    createdOn: string; 
    graduatedOn?: string; 
    deletedOn?: string; // LOGICAL DELETION (Tombstone)
    deletedName?: string;
    scheduleHistory: HabitSchedule[];
}

export interface DailyStoicDiagnosis {
    readonly level: StoicLevel;
    readonly themes: readonly string[];
    readonly timestamp: number;
}

export interface QuoteDisplayState {
    readonly currentId: string;
    readonly displayedAt: number;
    readonly lockedContext: string;
}

export interface SyncLog {
    time: number;
    msg: string;
    type: 'success' | 'error' | 'info';
}

export interface AppState {
    readonly version: number;
    lastModified: number; 
    readonly habits: readonly Habit[];
    readonly dailyData: Record<string, Record<string, HabitDailyInfo>>;
    readonly archives: Record<string, string | Uint8Array>; 
    readonly dailyDiagnoses: Record<string, DailyStoicDiagnosis>;
    readonly notificationsShown: string[];
    readonly pending21DayHabitIds: string[];
    readonly pendingConsolidationHabitIds: string[];
    readonly quoteState?: QuoteDisplayState;
    readonly hasOnboarded: boolean; 
    readonly syncLogs: SyncLog[];
    monthlyLogs: Map<string, bigint>; // Bitmask Storage
    
    // AI Quota & Caching
    aiDailyCount: number;
    aiQuotaDate: string;
    lastAIContextHash: string | null;
}

export interface HabitTemplate {
    icon: string;
    color: string;
    times: TimeOfDay[];
    goal: HabitGoal;
    frequency: Frequency;
    name?: string;
    nameKey?: string;
    subtitleKey?: string;
    philosophy?: HabitPhilosophy;
}

export interface PredefinedHabit extends HabitTemplate {
    nameKey: string;
    subtitleKey: string;
    isDefault?: boolean;
}

// --- CONSTANTS ---
export const APP_VERSION = 10; // Bump version for new state fields
export const STREAK_SEMI_CONSOLIDATED = 21;
export const STREAK_CONSOLIDATED = 66;
export const MAX_HABIT_NAME_LENGTH = 50;
export const AI_DAILY_LIMIT = 4;

export const HABIT_STATE = {
    NULL: 0,
    DONE: 1,
    DEFERRED: 2,
    DONE_PLUS: 3
} as const;

export const PERIOD_OFFSET: Record<TimeOfDay, number> = {
    'Morning': 0,
    'Afternoon': 3,
    'Evening': 6
};

export const FREQUENCIES: { labelKey: string, value: Frequency }[] = [
    { labelKey: 'freqDaily', value: { type: 'daily' } },
    { labelKey: 'freqSpecificDaysOfWeek', value: { type: 'specific_days_of_week', days: [] } },
    { labelKey: 'freqEvery', value: { type: 'interval', unit: 'days', amount: 2 } }
];

export const STREAK_LOOKBACK_DAYS = 730;

export const TIMES_OF_DAY = ['Morning', 'Afternoon', 'Evening'] as const;
export type TimeOfDay = typeof TIMES_OF_DAY[number];

export const LANGUAGES = [
    { code: 'pt', nameKey: 'langPortuguese' },
    { code: 'en', nameKey: 'langEnglish' },
    { code: 'es', nameKey: 'langSpanish' }
] as const;
export type Language = typeof LANGUAGES[number];

// --- APPLICATION STATE ---
export const state: {
    version: number;
    habits: Habit[];
    lastModified: number;
    dailyData: Record<string, Record<string, HabitDailyInfo>>;
    archives: Record<string, string | Uint8Array>;
    dailyDiagnoses: Record<string, DailyStoicDiagnosis>;
    unarchivedCache: Map<string, Record<string, Record<string, HabitDailyInfo>>>;
    streaksCache: Map<string, Map<string, number>>;
    habitAppearanceCache: Map<string, Map<string, boolean>>;
    scheduleCache: Map<string, Map<string, HabitSchedule | null>>;
    activeHabitsCache: Map<string, Array<{ habit: Habit; schedule: TimeOfDay[] }>>;
    daySummaryCache: Map<string, any>;
    selectedDate: string;
    activeLanguageCode: Language['code'];
    pending21DayHabitIds: string[];
    pendingConsolidationHabitIds: string[];
    notificationsShown: string[];
    hasOnboarded: boolean; 
    syncLogs: SyncLog[];
    quoteState?: QuoteDisplayState;
    aiState: 'idle' | 'loading' | 'completed' | 'error';
    aiReqId: number;
    hasSeenAIResult: boolean;
    lastAIResult: string | null;
    lastAIError?: string;
    syncState: 'syncInitial' | 'syncSaving' | 'syncSynced' | 'syncError';
    initialSyncDone: boolean; // PROTEÇÃO DE BOOT
    fullCalendar: { year: number; month: number; };
    uiDirtyState: { calendarVisuals: boolean; habitListStructure: boolean; chartData: boolean; };
    monthlyLogs: Map<string, bigint>;
    editingHabit?: { isNew: boolean; habitId?: string; originalData?: any; formData: HabitTemplate; targetDate: string };
    confirmAction: (() => void) | null;
    confirmEditAction: (() => void) | null;
    editingNoteFor: { habitId: string; date: string; time: TimeOfDay } | null;
    pendingHabitTime: TimeOfDay | null;
    calendarDates: string[];
    // AI Quota Fields
    aiDailyCount: number;
    aiQuotaDate: string;
    lastAIContextHash: string | null;
} = {
    version: APP_VERSION,
    habits: [],
    lastModified: 0,
    dailyData: {},
    archives: {},
    dailyDiagnoses: {},
    unarchivedCache: new Map(),
    streaksCache: new Map(),
    habitAppearanceCache: new Map(),
    scheduleCache: new Map(),
    activeHabitsCache: new Map(),
    daySummaryCache: new Map(),
    selectedDate: getTodayUTCIso(),
    activeLanguageCode: 'pt',
    pending21DayHabitIds: [],
    pendingConsolidationHabitIds: [],
    notificationsShown: [],
    hasOnboarded: false,
    syncLogs: [],
    aiState: 'idle',
    aiReqId: 0,
    hasSeenAIResult: true,
    lastAIResult: null,
    syncState: 'syncInitial',
    initialSyncDone: false, // Inicia como falso até o fetch cloud completar
    fullCalendar: { year: new Date().getUTCFullYear(), month: new Date().getUTCMonth() },
    uiDirtyState: { calendarVisuals: true, habitListStructure: true, chartData: true },
    monthlyLogs: new Map(),
    confirmAction: null,
    confirmEditAction: null,
    editingNoteFor: null,
    pendingHabitTime: null,
    calendarDates: [],
    aiDailyCount: 0,
    aiQuotaDate: getTodayUTCIso(),
    lastAIContextHash: null
};

class CacheManager {
    clearActiveHabits() {
        state.activeHabitsCache.clear();
    }

    clearSchedule() {
        state.scheduleCache.clear();
    }

    clearAll() {
        state.streaksCache.clear();
        state.scheduleCache.clear();
        state.activeHabitsCache.clear();
        state.unarchivedCache.clear();
        state.habitAppearanceCache.clear();
        state.daySummaryCache.clear();
    }

    invalidateForDate(dateISO: string) {
        state.daySummaryCache.delete(dateISO);
        state.activeHabitsCache.delete(dateISO);
        this.invalidateDateKeyInCacheMap(state.streaksCache, dateISO);
        this.invalidateDateKeyInCacheMap(state.habitAppearanceCache, dateISO);
        this.invalidateDateKeyInCacheMap(state.scheduleCache, dateISO);
    }

    private invalidateDateKeyInCacheMap<T>(cache: Map<string, Map<string, T>>, dateISO: string) {
        cache.forEach((dateMap) => dateMap.delete(dateISO));
    }
}

const cacheManager = new CacheManager();

/**
 * Extrai o estado atual para um formato serializável (JSON-safe para sync).
 */
export function getPersistableState(): AppState {
    return {
        version: APP_VERSION,
        lastModified: state.lastModified,
        habits: state.habits,
        dailyData: state.dailyData,
        archives: state.archives,
        dailyDiagnoses: state.dailyDiagnoses,
        notificationsShown: state.notificationsShown,
        pending21DayHabitIds: state.pending21DayHabitIds,
        pendingConsolidationHabitIds: state.pendingConsolidationHabitIds,
        quoteState: state.quoteState,
        hasOnboarded: state.hasOnboarded,
        syncLogs: state.syncLogs,
        monthlyLogs: state.monthlyLogs,
        aiDailyCount: state.aiDailyCount,
        aiQuotaDate: state.aiQuotaDate,
        lastAIContextHash: state.lastAIContextHash
    };
}

export function clearActiveHabitsCache() {
    cacheManager.clearActiveHabits();
}

export function clearAllCaches() {
    cacheManager.clearAll();
}

export function getHabitDailyInfoForDate(dateISO: string): Record<string, HabitDailyInfo> {
    if (!state.dailyData[dateISO]) {
        state.dailyData[dateISO] = {};
    }
    return state.dailyData[dateISO];
}

export function ensureHabitDailyInfo(dateISO: string, habitId: string): HabitDailyInfo {
    const dayData = getHabitDailyInfoForDate(dateISO);
    if (!dayData[habitId]) {
        dayData[habitId] = { instances: {}, dailySchedule: undefined };
    }
    return dayData[habitId];
}

export function ensureHabitInstanceData(dateISO: string, habitId: string, time: TimeOfDay): HabitDayData {
    const habitInfo = ensureHabitDailyInfo(dateISO, habitId);
    if (!habitInfo.instances[time]) {
        habitInfo.instances[time] = {};
    }
    return habitInfo.instances[time]!;
}

export function clearScheduleCache() {
    cacheManager.clearSchedule();
}

export function invalidateCachesForDateChange(dateISO: string) {
    cacheManager.invalidateForDate(dateISO);
}

export function isChartDataDirty(): boolean {
    return state.uiDirtyState.chartData;
}

export function invalidateChartCache() {
    state.uiDirtyState.chartData = true;
}

/**
 * Limpa entradas antigas do habitAppearanceCache (mais de 90 dias).
 * Implementa rolling window cache para evitar memory leak.
 */
export function pruneHabitAppearanceCache(): void {
    try {
        const today = parseUTCIsoDate(getTodayUTCIso());
        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - CACHE_HABIT_APPEARANCE_DAYS);
        const cutoffDate = toUTCIsoDateString(ninetyDaysAgo);
        
        state.habitAppearanceCache.forEach((dateMap, habitId) => {
            dateMap.forEach((_, dateISO) => {
                if (dateISO < cutoffDate) {
                    dateMap.delete(dateISO);
                }
            });
            if (dateMap.size === 0) {
                state.habitAppearanceCache.delete(habitId);
            }
        });
    } catch (error) {
        logger.warn('[Cache] Error pruning habitAppearanceCache:', error);
    }
}

/**
 * Limpa entradas antigas do streaksCache (mais de 1 ano).
 */
export function pruneStreaksCache(): void {
    try {
        const today = new Date(parseUTCIsoDate(getTodayUTCIso()));
        const oneYearAgo = new Date(today);
        oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - CACHE_STREAKS_YEARS);
        const cutoffDate = toUTCIsoDateString(oneYearAgo);
        
        state.streaksCache.forEach((dateMap, habitId) => {
            dateMap.forEach((_, dateISO) => {
                if (dateISO < cutoffDate) {
                    dateMap.delete(dateISO);
                }
            });
            if (dateMap.size === 0) {
                state.streaksCache.delete(habitId);
            }
        });
    } catch (error) {
        logger.warn('[Cache] Error pruning streaksCache:', error);
    }
}
