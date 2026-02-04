/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file services/persistence.ts
 * @description Camada de Persistência e Gerenciamento de Ciclo de Vida de Dados (Storage Engine).
 */

import { state, AppState, Habit, HabitDailyInfo, APP_VERSION, getPersistableState, clearAllCaches } from '../state';
import { migrateState } from './migration';
import { HabitService } from './HabitService';
import { clearHabitDomCache } from '../render';
import { logger } from '../utils';

const DB_NAME = 'AskesisDB', DB_VERSION = 1, STORE_NAME = 'app_state';
const STATE_JSON_KEY = 'askesis_core_json';
const STATE_BINARY_KEY = 'askesis_logs_binary';

const DB_OPEN_TIMEOUT_MS = 15000, IDB_SAVE_DEBOUNCE_MS = 800;
let dbPromise: Promise<IDBDatabase> | null = null;
let saveTimeout: number | undefined;
let activeSavePromise: Promise<void> | null = null;
let pendingSaveResolve: (() => void) | null = null;

function getDB(): Promise<IDBDatabase> {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => { dbPromise = null; reject(new Error("Timeout IDB")); }, DB_OPEN_TIMEOUT_MS);
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = (e.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
            };
            request.onsuccess = (e) => {
                clearTimeout(timeoutId);
                const db = (e.target as IDBOpenDBRequest).result;
                db.onclose = db.onversionchange = () => dbPromise = null;
                resolve(db);
            };
            request.onerror = () => { clearTimeout(timeoutId); dbPromise = null; reject(request.error); };
        });
    }
    return dbPromise;
}

/**
 * Grava um estado específico no IndexedDB.
 * Otimizado para separar JSON leve de binários pesados (Hex-Strings).
 */
async function saveSplitState(main: AppState): Promise<void> {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        
        const logs = main.monthlyLogs;
        const jsonState = { ...main };
        // Remove logs do objeto principal para não duplicar no armazenamento
        delete (jsonState as any).monthlyLogs;
        
        store.put(jsonState, STATE_JSON_KEY);
        
        if (logs && logs.size > 0) {
            const serializedLogs: Record<string, string> = {};
            logs.forEach((v, k) => {
                serializedLogs[k] = v.toString(16);
            });
            store.put(serializedLogs, STATE_BINARY_KEY);
        }
        
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

let syncHandler: ((state: AppState, immediate?: boolean) => void) | null = null;
export const registerSyncHandler = (h: (s: AppState, immediate?: boolean) => void) => syncHandler = h;

function pruneOrphanedDailyData(habits: readonly Habit[], dailyData: Record<string, Record<string, HabitDailyInfo>>) {
    if (habits.length === 0) return; 
    const validIds = new Set(habits.map(h => h.id));
    for (const date in dailyData) {
        for (const id in dailyData[date]) {
            if (!validIds.has(id)) {
                delete dailyData[date][id];
            }
        }
        if (Object.keys(dailyData[date]).length === 0) delete dailyData[date];
    }
}

async function saveStateInternal(immediate = false, suppressSync = false) {
    if (activeSavePromise) await activeSavePromise;

    activeSavePromise = (async () => {
        // Incrementa o timestamp para indicar mudança LOCAL
        state.lastModified = Math.max(Date.now(), state.lastModified + 1);
        const structuredData = getPersistableState();
        try {
            await saveSplitState(structuredData);
        } catch (e) { 
            logger.error("IDB Save Failed:", e); 
        }
        
        if (!suppressSync) {
            syncHandler?.(structuredData, immediate);
        }
    })();

    try {
        await activeSavePromise;
    } finally {
        activeSavePromise = null;
    }
}

export function cancelPendingSave() {
    if (saveTimeout !== undefined) {
        clearTimeout(saveTimeout);
        saveTimeout = undefined;
    }
    if (pendingSaveResolve) {
        pendingSaveResolve();
        pendingSaveResolve = null;
    }
}

export async function flushSaveBuffer(): Promise<void> {
    if (saveTimeout !== undefined) {
        clearTimeout(saveTimeout);
        saveTimeout = undefined;
        const resolve = pendingSaveResolve;
        pendingSaveResolve = null;
        await saveStateInternal(true);
        resolve?.();
    }
}

export async function saveState(immediate = false, suppressSync = false): Promise<void> {
    if (saveTimeout !== undefined) {
        clearTimeout(saveTimeout);
        saveTimeout = undefined;
    }

    if (immediate) {
        const resolve = pendingSaveResolve;
        pendingSaveResolve = null;
        await saveStateInternal(true, suppressSync);
        resolve?.();
    } else {
        return new Promise((resolve) => {
            const oldResolve = pendingSaveResolve;
            pendingSaveResolve = () => {
                oldResolve?.();
                resolve();
            };

            saveTimeout = self.setTimeout(async () => {
                saveTimeout = undefined;
                const currentResolve = pendingSaveResolve;
                pendingSaveResolve = null;
                await saveStateInternal(false, suppressSync);
                currentResolve?.();
            }, IDB_SAVE_DEBOUNCE_MS);
        });
    }
}

/**
 * Gravação Imediata (Data Landing).
 * Usado para dados vindo da nuvem: grava no disco exatamente o que recebeu, 
 * sem alterar o timestamp lastModified original da nuvem.
 */
export const persistStateLocally = async (data: AppState) => {
    if (activeSavePromise) await activeSavePromise;
    try {
        await saveSplitState(data);
    } catch (e) {
        logger.error("[Persistence] Immediate Cloud Persistence Failed:", e);
    }
};

export async function loadState(cloudState?: AppState): Promise<AppState | null> {
    let mainState = cloudState;
    let binaryLogsData: any;

    // 1. Load from IDB if no Cloud State provided
    if (!mainState) {
        try {
            const db = await getDB();
            await new Promise<void>((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                
                const reqMain = store.get(STATE_JSON_KEY);
                const reqLogs = store.get(STATE_BINARY_KEY);
                
                tx.oncomplete = () => {
                    mainState = reqMain.result;
                    binaryLogsData = reqLogs.result;
                    resolve();
                };
                tx.onerror = () => resolve();
            });
        } catch (e) {
            logger.warn("[Persistence] Failed to read state from IDB", e);
        }
    }

    if (mainState) {
        // 2. CRITICAL FIX: Pre-Migration Hydration
        // Se temos logs binários do IDB, precisamos injetá-los no objeto ANTES da migração.
        // Se a migração rodar num objeto sem logs, ela pode assumir que é um estado novo 
        // e ignorar a atualização necessária dos bitmasks (ex: v8 -> v9), corrompendo os dados.
        if (binaryLogsData && !mainState.monthlyLogs) {
            (mainState as any).monthlyLogs = binaryLogsData;
        }

        // 3. Migrate State (Handles Schema Upgrades & Bitmask Expansion)
        let migrated = migrateState(mainState, APP_VERSION);
        
        // 4. Hydrate Result into Global State
        state.monthlyLogs = migrated.monthlyLogs;
        // CRITICAL: Reset Lazy Sharding cache whenever state is replaced from storage/cloud.
        HabitService.resetCache();
        
        // Fallback robusto: se a migração falhou em hidratar o Map, tenta recuperar dos dados brutos
        if ((!state.monthlyLogs || state.monthlyLogs.size === 0) && binaryLogsData) {
             if (typeof binaryLogsData === 'object' && !Array.isArray(binaryLogsData)) {
                state.monthlyLogs = new Map();
                Object.entries(binaryLogsData as Record<string, string>).forEach(([k, v]) => {
                    state.monthlyLogs.set(k, BigInt("0x" + v));
                });
            }
        }

        state.habits = [...(migrated.habits || [])];
        state.lastModified = migrated.lastModified || Date.now();
        state.dailyData = migrated.dailyData || {};
        state.archives = migrated.archives || {};
        state.dailyDiagnoses = migrated.dailyDiagnoses || {};
        state.notificationsShown = [...(migrated.notificationsShown || [])];
        state.pending21DayHabitIds = [...(migrated.pending21DayHabitIds || [])];
        state.pendingConsolidationHabitIds = [...(migrated.pendingConsolidationHabitIds || [])];
        state.hasOnboarded = migrated.hasOnboarded ?? true;
        state.syncLogs = (migrated.syncLogs || []).map((log: any) => ({
            time: log.time,
            msg: log.msg,
            type: log.type
        }));

        if (state.syncLogs.length > 50) {
            state.syncLogs = state.syncLogs.slice(-50);
        }

        // Clear Caches
        clearAllCaches();
        
        clearHabitDomCache();
        Object.assign(state.uiDirtyState, { calendarVisuals: true, habitListStructure: true, chartData: true });
        
        const runCleanup = () => pruneOrphanedDailyData(state.habits, state.dailyData);
        if ('scheduler' in window && (window as any).scheduler) {
             (window as any).scheduler.postTask(runCleanup, { priority: 'background' });
        } else if ('requestIdleCallback' in window) {
            requestIdleCallback(() => runCleanup());
        } else {
            setTimeout(runCleanup, 50);
        }

        document.dispatchEvent(new CustomEvent('render-app'));
        return migrated;
    }
    return null;
}

export const clearLocalPersistence = async () => {
    cancelPendingSave();
    try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        await new Promise(r => tx.oncomplete = r);
    } catch (e) {
        logger.warn("IDB clear failed", e);
    }
    // Use HabitService to clear logs and cache consistently
    HabitService.clearAllLogs();
};