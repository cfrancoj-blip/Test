/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file services/HabitService.ts
 * @description Motor de Operações Binárias para Logs de Hábitos (Esquema 9-bit / Tombstone).
 */

import { state, PERIOD_OFFSET, TimeOfDay } from '../state';
import { logger } from '../utils';

export class HabitService {

    // --- LAZY SHARDING CACHE ---
    // Armazena as strings serializadas (Hex) agrupadas por mês.
    // Evita reprocessar meses que não sofreram alterações.
    private static shardCache = new Map<string, [string, string][]>();
    
    // Rastreia quais meses foram tocados desde o último sync/geração.
    private static dirtyMonths = new Set<string>();

    /**
     * Limpa o cache completamente.
     * Deve ser chamado sempre que o estado global (state.monthlyLogs) for substituído (ex: Load/Import).
     */
    static resetCache() {
        this.shardCache.clear();
        this.dirtyMonths.clear();
    }

    private static markDirty(month: string) {
        this.dirtyMonths.add(month);
    }

    private static getLogKey(habitId: string, dateISO: string): string {
        return `${habitId}_${dateISO.substring(0, 7)}`; // ID_YYYY-MM
    }

    /**
     * Valida se um valor BigInt é um log de bitmask válido para um mês.
     */
    static isValidLog(val: any): val is bigint {
        return typeof val === 'bigint';
    }

    /**
     * Leitura Otimizada com lógica de Lápide (Tombstone).
     * Se o bit de lápide (bit 2 do bloco de 3) for 1, o status é forçado para NULL (0).
     */
    static getStatus(habitId: string, dateISO: string, time: TimeOfDay): number {
        const key = this.getLogKey(habitId, dateISO);
        const log = state.monthlyLogs?.get(key);
        
        if (log !== undefined) {
            const day = parseInt(dateISO.substring(8, 10), 10);
            const bitPos = BigInt(((day - 1) * 9) + PERIOD_OFFSET[time]);
            const block = (log >> bitPos) & 7n; // Lê o bloco de 3 bits
            
            // Verifica bit de Lápide (Exclusão)
            if ((block >> 2n) & 1n) return 0; 
            
            return Number(block & 3n); // Retorna os 2 bits de status
        }
        return 0;
    }

    /**
     * Escrita Otimizada. 
     * Ao definir como NULL (0), ativa o bit de Lápide para propagar a exclusão.
     */
    static setStatus(habitId: string, dateISO: string, time: TimeOfDay, newState: number) {
        if (!state.monthlyLogs) state.monthlyLogs = new Map();

        const key = this.getLogKey(habitId, dateISO);
        const day = parseInt(dateISO.substring(8, 10), 10);
        
        const bitPos = BigInt(((day - 1) * 9) + PERIOD_OFFSET[time]);
        const clearMask = ~(7n << bitPos); // Máscara para limpar 3 bits
        
        let currentLog = state.monthlyLogs.get(key) || 0n;
        
        let valToStore = 0n;
        if (newState === 0) {
            // Caso especial: Exclusão manual (Undo)
            // Define Tombstone=1 e Status=00 -> Binário 100 -> Decimal 4
            valToStore = 4n; 
        } else {
            // Registro normal: Tombstone=0 e Status=newState
            valToStore = BigInt(newState);
        }
        
        const newLog = (currentLog & clearMask) | (valToStore << bitPos);
        
        state.monthlyLogs.set(key, newLog);
        
        // LAZY SHARDING: Marca o mês como sujo
        this.markDirty(dateISO.substring(0, 7));
        
        state.uiDirtyState.chartData = true;
    }

    /**
     * EXPURGO PROFUNDO (Hard Delete).
     * Remove fisicamente todas as entradas de log associadas a um ID de hábito.
     * Isso libera memória e garante que "Apagar" realmente signifique apagar o histórico.
     */
    static pruneLogsForHabit(habitId: string) {
        if (!state.monthlyLogs) return;
        
        const prefix = habitId + '_';
        // As chaves são compostas por "ID_ANO-MES".
        for (const key of state.monthlyLogs.keys()) {
            if (key.startsWith(prefix)) {
                // Extrai o mês (parte final após o ID) para marcar como dirty
                // ID pode conter underscores, mas o formato é sufixado por _YYYY-MM (7 chars)
                const month = key.slice(-7);
                this.markDirty(month);
                
                state.monthlyLogs.delete(key);
            }
        }
        state.uiDirtyState.chartData = true;
    }

    /**
     * Agrupa logs por mês para criação de shards granulares.
     * IMPLEMENTAÇÃO LAZY: Só regenera shards para meses marcados como 'dirty'.
     */
    static getLogsGroupedByMonth(): Record<string, [string, string][]> {
        // Se o mapa principal estiver vazio ou nulo, limpa tudo.
        if (!state.monthlyLogs || state.monthlyLogs.size === 0) {
            this.resetCache();
            return {};
        }

        // FAST PATH: Se nada mudou e temos cache, retorna o cache diretamente.
        if (this.dirtyMonths.size === 0 && this.shardCache.size > 0) {
            return Object.fromEntries(this.shardCache);
        }

        const tempRegen = new Map<string, [string, string][]>();

        // Varredura para regenerar apenas o necessário
        // Nota: Iterar sobre o mapa é rápido; a serialização (toString(16)) é que é custosa.
        for (const [key, val] of state.monthlyLogs.entries()) {
            const month = key.slice(-7); // Extrai YYYY-MM
            
            // Só processa se o mês estiver sujo OU se não estiver no cache (primeira execução)
            if (this.dirtyMonths.has(month) || !this.shardCache.has(month)) {
                if (!tempRegen.has(month)) tempRegen.set(month, []);
                tempRegen.get(month)!.push([key, "0x" + val.toString(16)]);
            }
        }

        // Atualiza o Cache
        // 1. Adiciona/Atualiza meses regenerados
        for (const [month, data] of tempRegen) {
            this.shardCache.set(month, data);
        }
        
        // 2. Remove do cache meses que estavam sujos mas não existem mais no mapa (foram deletados)
        for (const month of this.dirtyMonths) {
            if (!tempRegen.has(month)) {
                this.shardCache.delete(month);
            }
        }

        this.dirtyMonths.clear();
        return Object.fromEntries(this.shardCache);
    }

    /**
     * Serialização para Cloud (Hexadecimal).
     * Usa a lógica cacheada de getLogsGroupedByMonth para eficiência.
     */
    static serializeLogsForCloud(): [string, string][] {
        const grouped = this.getLogsGroupedByMonth();
        return Object.values(grouped).flat();
    }

    /**
     * Deserialização.
     */
    static deserializeLogsFromCloud(serialized: [string, string][]) {
        if (!Array.isArray(serialized)) return;
        serialized.forEach(([key, hexVal]) => {
            try {
                const hexClean = hexVal.startsWith("0x") ? hexVal : "0x" + hexVal;
                state.monthlyLogs.set(key, BigInt(hexClean));
                    } catch (e) {
                        logger.warn(`[HabitService] Skipping invalid hex log: ${key}`);
            }
        });
        // Como estamos injetando dados externos, invalidamos o cache para garantir consistência.
        this.resetCache();
    }
    
    /**
     * INTELLIGENT MERGE (CRDT-Lite para Bitmasks).
     */
    static mergeLogs(winnerMap: Map<string, bigint> | undefined, loserMap: Map<string, bigint> | undefined): Map<string, bigint> {
        const result = new Map<string, bigint>(winnerMap || []);
        if (!loserMap) return result;

        for (const [key, loserVal] of loserMap.entries()) {
            const winnerVal = result.get(key) || 0n;
            let mergedVal = 0n;

            // 31 dias * 3 períodos = 93 blocos de 3 bits
            for (let i = 0n; i < 93n; i++) {
                const shift = i * 3n;
                const winnerBlock = (winnerVal >> shift) & 7n;
                const loserBlock = (loserVal >> shift) & 7n;

                let finalBlock = 0n;

                // CRDT LOGIC: Tombstone Priority > Data Priority > Empty
                const winnerTomb = (winnerBlock & 4n) === 4n;
                const loserTomb = (loserBlock & 4n) === 4n;

                if (winnerTomb || loserTomb) {
                    finalBlock = 4n; 
                } else if (winnerBlock !== 0n && loserBlock !== 0n) {
                    // CRDT: Winner-takes-precedence when both have data.
                    // OR would create invalid states (e.g., DONE|DEFERRED = DONE_PLUS).
                    finalBlock = winnerBlock;
                } else {
                    // One is 0n, the other has data — pick the non-zero one.
                    finalBlock = winnerBlock || loserBlock;
                }

                mergedVal |= (finalBlock << shift);
            }
            result.set(key, mergedVal);
        }
        return result;
    }

    static clearAllLogs() {
        state.monthlyLogs = new Map();
        this.resetCache();
        state.uiDirtyState.chartData = true;
    }
}