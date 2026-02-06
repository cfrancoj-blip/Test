/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file services/dataMerge.ts
 * @description Algoritmo de Reconciliação de Estado (Smart Merge / CRDT-lite).
 */

import { AppState, HabitDailyInfo, Habit, HabitSchedule } from '../state';
import { logger } from '../utils';
import { HabitService } from './HabitService';

function isValidBigIntString(value: string): boolean {
    if (!value) return false;
    const normalized = value.startsWith('0x') ? value.slice(2) : value;
    if (!/^[0-9a-f]+$/i.test(normalized)) return false;
    if (normalized.length > 64) return false;
    return true;
}

function safeBigIntFromUnknown(value: any): bigint | null {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
        return BigInt(value);
    }
    if (typeof value === 'string') {
        if (!isValidBigIntString(value)) return null;
        const hexClean = value.startsWith('0x') ? value : '0x' + value;
        return BigInt(hexClean);
    }
    if (value && typeof value === 'object' && 'val' in value) {
        return safeBigIntFromUnknown((value as any).val);
    }
    return null;
}

/**
 * Hidrata monthlyLogs garantindo que BigInts e Maps sejam reconstruídos corretamente.
 */
function hydrateLogs(appState: AppState) {
    if (appState.monthlyLogs && !(appState.monthlyLogs instanceof Map)) {
        const entries = Array.isArray(appState.monthlyLogs) 
            ? appState.monthlyLogs 
            : Object.entries(appState.monthlyLogs);
            
        const map = new Map<string, bigint>();
        entries.forEach((item: any) => {
            const [key, val] = item as [string, any];
            
            try {
                const hydrated = safeBigIntFromUnknown(val);
                if (hydrated !== null) map.set(key, hydrated);
                else logger.warn(`[Merge] Invalid bigint value for ${key}`);
            } catch(e) {
                logger.warn(`[Merge] Failed to hydrate bitmask for ${key}`, e);
            }
        });
        (appState as any).monthlyLogs = map;
    }
}

/**
 * Mescla o histórico de agendamentos de um hábito usando Last-Write-Wins (LWW) por entrada.
 * O vencedor (determinado pelo lastModified global) tem prioridade sobre as definições de agendamento.
 * Isso garante que se um usuário alterou um endDate ou meta, a versão mais recente prevaleça.
 */
function mergeHabitHistories(winnerHistory: HabitSchedule[], loserHistory: HabitSchedule[]): HabitSchedule[] {
    const historyMap = new Map<string, HabitSchedule>();
    
    // 1. Carrega o histórico do perdedor como base
    loserHistory.forEach(s => historyMap.set(s.startDate, { ...s }));
    
    // 2. O vencedor sobrescreve entradas com a mesma data de início (LWW absoluto)
    // Se o vencedor definiu um endDate, isso será preservado.
    winnerHistory.forEach(s => historyMap.set(s.startDate, { ...s }));
    
    return Array.from(historyMap.values()).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * Mescla registros diários (Notas e Overrides).
 */
function mergeDayRecord(source: Record<string, HabitDailyInfo>, target: Record<string, HabitDailyInfo>) {
    for (const habitId in source) {
        if (!target[habitId]) {
            target[habitId] = source[habitId];
            continue;
        }

        const sourceInstances = source[habitId].instances || {};
        const targetInstances = target[habitId].instances || {};

        for (const time in sourceInstances) {
            const srcInst = sourceInstances[time as any];
            const tgtInst = targetInstances[time as any];
            if (!srcInst) continue;
            if (!tgtInst) {
                targetInstances[time as any] = srcInst;
            } else {
                if ((srcInst.note?.length || 0) > (tgtInst.note?.length || 0)) {
                    tgtInst.note = srcInst.note;
                }
                if (srcInst.goalOverride !== undefined) {
                    tgtInst.goalOverride = srcInst.goalOverride;
                }
            }
        }
        if (source[habitId].dailySchedule) target[habitId].dailySchedule = source[habitId].dailySchedule;
    }
}

export async function mergeStates(local: AppState, incoming: AppState): Promise<AppState> {
    [local, incoming].forEach(hydrateLogs);

    const localTs = local.lastModified || 0;
    const incomingTs = incoming.lastModified || 0;
    
    // LÓGICA DE VENCEDOR: Maior timestamp vence (LWW).
    // Proteção: Se um lado está vazio e o outro não, o populado vence para evitar wipe acidental.
    let winner: AppState;
    let loser: AppState;

    if (local.habits.length === 0 && incoming.habits.length > 0) {
        winner = incoming;
        loser = local;
    } else if (incoming.habits.length === 0 && local.habits.length > 0) {
        winner = local;
        loser = incoming;
    } else {
        winner = localTs >= incomingTs ? local : incoming;
        loser = localTs >= incomingTs ? incoming : local;
    }
    
    const merged: AppState = structuredClone(winner);
    const mergedHabitsMap = new Map<string, Habit>();
    
    merged.habits.forEach(h => mergedHabitsMap.set(h.id, h));
    
    loser.habits.forEach(loserHabit => {
        const winnerHabit = mergedHabitsMap.get(loserHabit.id);
        if (!winnerHabit) {
            mergedHabitsMap.set(loserHabit.id, loserHabit);
        } else {
            // Mescla histórico com prioridade para o vencedor
            winnerHabit.scheduleHistory = mergeHabitHistories(winnerHabit.scheduleHistory, loserHabit.scheduleHistory);
            
            // Tombstone de deleção: data mais tardia vence (ação mais recente)
            if (loserHabit.deletedOn) {
                if (!winnerHabit.deletedOn || loserHabit.deletedOn > winnerHabit.deletedOn) {
                    winnerHabit.deletedOn = loserHabit.deletedOn;
                }
            }

            // Graduação: data mais antiga vence (primeira vez que o usuário conquistou)
            if (loserHabit.graduatedOn) {
                if (!winnerHabit.graduatedOn || loserHabit.graduatedOn < winnerHabit.graduatedOn) {
                    winnerHabit.graduatedOn = loserHabit.graduatedOn;
                }
            }
        }
    });

    (merged as any).habits = Array.from(mergedHabitsMap.values());

    for (const date in loser.dailyData) {
        if (!merged.dailyData[date]) (merged.dailyData as any)[date] = loser.dailyData[date];
        else mergeDayRecord(loser.dailyData[date], (merged.dailyData as any)[date]);
    }

    // BITMASK MERGE: LWW granular por bloco de 3 bits
    merged.monthlyLogs = HabitService.mergeLogs(winner.monthlyLogs, loser.monthlyLogs);
    
    // O timestamp final deve ser incrementado para garantir propagação
    merged.lastModified = Math.max(localTs, incomingTs, Date.now()) + 1;

    return merged;
}