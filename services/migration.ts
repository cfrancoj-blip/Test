
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file services/migration.ts
 * @description Inicializador de Estado e Sanitizador de Schema.
 */

import { logger, getTodayUTCIso } from '../utils';
import { AppState } from '../state';

/**
 * Migra os bitmasks mensais de 6 bits/dia (v8) para 9 bits/dia (v9).
 */
function migrateBitmasksV8toV9(logs: Map<string, bigint>): Map<string, bigint> {
    const newMap = new Map<string, bigint>();
    
    for (const [key, oldLog] of logs.entries()) {
        let newLog = 0n;
        // Processa cada um dos 31 dias possíveis no log mensal
        for (let day = 1; day <= 31; day++) {
            // Offsets antigos (V8): Manhã=0, Tarde=2, Noite=4
            // Offsets novos (V9): Manhã=0, Tarde=3, Noite=6
            const oldDayBase = BigInt((day - 1) * 6);
            const newDayBase = BigInt((day - 1) * 9);

            for (let pIdx = 0; pIdx < 3; pIdx++) {
                const oldBitPos = oldDayBase + BigInt(pIdx * 2);
                const status = (oldLog >> oldBitPos) & 3n;
                
                const newBitPos = newDayBase + BigInt(pIdx * 3);
                newLog |= (status << newBitPos);
                // O bit de lápide (newBitPos + 2) é inicializado como 0 automaticamente
            }
        }
        newMap.set(key, newLog);
    }
    
    return newMap;
}

export function migrateState(loadedState: any, targetVersion: number): AppState {
    // 1. FRESH INSTALL / NULL STATE
    if (!loadedState) {
        return { 
            version: targetVersion, 
            habits: [], 
            dailyData: {}, 
            archives: {}, 
            dailyDiagnoses: {}, 
            lastModified: Date.now(), 
            notificationsShown: [], 
            pending21DayHabitIds: [], 
            pendingConsolidationHabitIds: [], 
            hasOnboarded: true,
            syncLogs: [],
            monthlyLogs: new Map(),
            aiDailyCount: 0,
            aiQuotaDate: getTodayUTCIso(),
            lastAIContextHash: null
        } as AppState;
    }

    const state = loadedState as AppState;
    const currentVersion = state.version || 0;

    // 2. SCHEMA HYDRATION (Map/BigInt Reconstruction)
    if (state.monthlyLogs && !(state.monthlyLogs instanceof Map)) {
        try {
            const entries = Array.isArray(state.monthlyLogs) 
                ? state.monthlyLogs 
                : Object.entries(state.monthlyLogs);
                
            state.monthlyLogs = new Map(entries.map(([k, v]: [string, any]) => {
                let val = v;
                if (v && typeof v === 'object' && v.__type === 'bigint') {
                    val = BigInt(v.val);
                } else if (typeof v !== 'bigint') {
                    val = BigInt(v);
                }
                return [k, val];
            }));
        } catch (e) {
            logger.warn("[Migration] Failed to hydrate monthlyLogs", e);
            state.monthlyLogs = new Map();
        }
    } else if (!state.monthlyLogs) {
        state.monthlyLogs = new Map();
    }

    // 3. SCHEMA UPGRADE: V8 -> V9 (9-bit Bitmask Expansion)
    if (currentVersion < 9 && state.monthlyLogs.size > 0) {
        logger.info(`[Migration] Upgrading bitmasks from v${currentVersion} to v9...`);
        try {
            state.monthlyLogs = migrateBitmasksV8toV9(state.monthlyLogs);
            logger.info("[Migration] Bitmask expansion successful.");
        } catch (err) {
            logger.error("[Migration] Bitmask expansion failed!", err);
        }
    }

    // 4. SCHEMA UPGRADE: V9 -> V10 (AI Quota & Hash)
    // Inicializa campos de quota se não existirem
    if (state.aiDailyCount === undefined) {
        (state as any).aiDailyCount = 0;
        (state as any).aiQuotaDate = getTodayUTCIso();
        (state as any).lastAIContextHash = null;
    }

    if (state.hasOnboarded === undefined) {
        (state as any).hasOnboarded = true;
    }

    if (!state.syncLogs) {
        (state as any).syncLogs = [];
    } else {
        (state as any).syncLogs = state.syncLogs.map((log: any) => ({
            time: log.time,
            msg: log.msg,
            type: log.type
        }));
    }

    // Force target version
    (state as any).version = targetVersion;
    
    return state;
}
