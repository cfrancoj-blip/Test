/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file cloud.ts
 * @description Orquestrador de Sincronização e Ponte para Web Workers (Main Thread Client).
 */

import { AppState, state, getPersistableState } from '../state';
import { loadState, persistStateLocally } from './persistence';
import { pushToOneSignal, generateUUID, createDebounced, logger } from '../utils';
import { ui } from '../render/ui';
import { t } from '../i18n';
import { hasLocalSyncKey, getSyncKey, apiFetch } from './api';
import { renderApp, updateNotificationUI } from '../render';
import { mergeStates } from './dataMerge';
import { HabitService } from './HabitService';
import {
    CLOUD_SYNC_DEBOUNCE_MS,
    CLOUD_SYNC_LOG_MAX_ENTRIES,
    CLOUD_SYNC_LOG_MAX_AGE_MS,
    CLOUD_HASH_CACHE_MAX_ENTRIES,
    CLOUD_WORKER_TIMEOUT_MS
} from '../constants';

// PERFORMANCE: Debounce para evitar salvar na nuvem a cada pequena alteração
const DEBOUNCE_DELAY = CLOUD_SYNC_DEBOUNCE_MS; 
const HASH_STORAGE_KEY = 'askesis_sync_hashes';
const SYNC_LOG_MAX_ENTRIES = CLOUD_SYNC_LOG_MAX_ENTRIES;
const SYNC_LOG_MAX_AGE_MS = CLOUD_SYNC_LOG_MAX_AGE_MS;
const HASH_CACHE_MAX_ENTRIES = CLOUD_HASH_CACHE_MAX_ENTRIES;
const WORKER_TIMEOUT_MS = CLOUD_WORKER_TIMEOUT_MS;

let isSyncInProgress = false;
let pendingSyncState: AppState | null = null;
const debouncedSync = createDebounced(() => { if (!isSyncInProgress) performSync(); }, DEBOUNCE_DELAY);

// --- WORKER INFRASTRUCTURE ---
let syncWorker: Worker | null = null;
const workerCallbacks = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>();

function getWorker(): Worker {
    if (!syncWorker) {
        syncWorker = new Worker('./sync-worker.js', { type: 'module' });
        syncWorker.onmessage = (e) => {
            const { id, status, result, error } = e.data;
            const callback = workerCallbacks.get(id);
            if (callback) {
                if (status === 'success') {
                    callback.resolve(result);
                } else {
                    callback.reject(new Error(error));
                }
                workerCallbacks.delete(id);
            }
        };
        
        syncWorker.onerror = (e) => {
            logger.error("Critical Worker Error:", e);
            workerCallbacks.forEach(({ reject }) => reject(new Error('Worker crashed')));
            workerCallbacks.clear();
            syncWorker = null;
        };
    }
    return syncWorker;
}

export function runWorkerTask<T>(type: 'encrypt' | 'decrypt' | 'build-ai-prompt' | 'build-quote-analysis-prompt' | 'prune-habit' | 'archive', payload: any, key?: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const id = generateUUID();
        const timeoutId = window.setTimeout(() => {
            workerCallbacks.delete(id);
            reject(new Error('Worker timeout'));
        }, WORKER_TIMEOUT_MS);
        workerCallbacks.set(id, { 
            resolve: (val) => { clearTimeout(timeoutId); resolve(val); }, 
            reject: (err) => { clearTimeout(timeoutId); reject(err); } 
        });
        try {
            getWorker().postMessage({ id, type, payload, key });
        } catch (err) {
            clearTimeout(timeoutId);
            workerCallbacks.delete(id);
            reject(err);
        }
    });
}

function splitIntoShards(appState: AppState): Record<string, any> {
    const shards: Record<string, any> = {};
    // Core: Dados leves e críticos para o boot
    shards['core'] = {
        version: appState.version,
        habits: appState.habits,
        dailyData: appState.dailyData,
        dailyDiagnoses: appState.dailyDiagnoses,
        notificationsShown: appState.notificationsShown,
        hasOnboarded: appState.hasOnboarded,
        quoteState: appState.quoteState
    };
    
    // Logs: Shards granulares mensais (Bitmasks)
    // Usa o cache do HabitService para obter os dados já agrupados
    const groupedLogs = HabitService.getLogsGroupedByMonth();
    for (const month in groupedLogs) { 
        shards[`logs:${month}`] = groupedLogs[month]; 
    }
    
    // Arquivos: Shards anuais (Dados frios)
    for (const year in appState.archives) { 
        shards[`archive:${year}`] = appState.archives[year]; 
    }
    
    return shards;
}

// PERF: Carrega hashes do localStorage para evitar re-upload no boot (Cold Start Optimization)
const lastSyncedHashes: Map<string, string> = (() => {
    try {
        const raw = localStorage.getItem(HASH_STORAGE_KEY);
        if (raw) {
            const loaded = new Map(JSON.parse(raw));
            return loaded;
        }
    } catch (e) {
        logger.warn("[Sync] Falha ao carregar cache de hashes", e);
    }
    return new Map();
})();

// Normaliza tamanho do cache após o load (evita crescimento indefinido no boot)
pruneHashCache();

function persistHashCache() {
    try {
        pruneHashCache();
        localStorage.setItem(HASH_STORAGE_KEY, JSON.stringify(Array.from(lastSyncedHashes.entries())));
    } catch (e) {
        logger.error("[Sync] Falha ao salvar cache de hashes", e);
    }
}

function pruneHashCache() {
    if (lastSyncedHashes.size <= HASH_CACHE_MAX_ENTRIES) return;
    while (lastSyncedHashes.size > HASH_CACHE_MAX_ENTRIES) {
        const firstKey = lastSyncedHashes.keys().next().value;
        if (firstKey === undefined) break;
        lastSyncedHashes.delete(firstKey);
    }
}

export function clearSyncHashCache() {
    lastSyncedHashes.clear();
    localStorage.removeItem(HASH_STORAGE_KEY);
    logger.info("[Sync] Hash cache cleared.");
}

function murmurHash3(key: string, seed: number = 0): string {
    let remainder = key.length & 3, bytes = key.length - remainder, h1 = seed, c1 = 0xcc9e2d51, c2 = 0x1b873593, i = 0;
    while (i < bytes) {
        let k1 = ((key.charCodeAt(i) & 0xff)) | ((key.charCodeAt(++i) & 0xff) << 8) | ((key.charCodeAt(++i) & 0xff) << 16) | ((key.charCodeAt(++i) & 0xff) << 24);
        ++i;
        k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
        k1 = (k1 << 15) | (k1 >>> 17);
        k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;
        h1 ^= k1; h1 = (h1 << 13) | (h1 >>> 19); h1 = (((h1 * 5) + 0xe6546b64)) & 0xffffffff;
    }
    let k2 = 0;
    switch (remainder) {
        case 3: k2 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
        case 2: k2 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
        case 1: k2 ^= (key.charCodeAt(i) & 0xff);
            k2 = (((k2 & 0xffff) * c1) + ((((k2 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
            k2 = (k2 << 15) | (k2 >>> 17);
            k2 = (((k2 & 0xffff) * c2) + ((((k2 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
            h1 ^= k2;
    }
    h1 ^= key.length; h1 ^= h1 >>> 16;
    h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
    h1 ^= h1 >>> 13; h1 = (((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16)) & 0xffffffff;
    h1 ^= h1 >>> 16;
    return (h1 >>> 0).toString(16);
}

export function addSyncLog(msg: string, type: 'success' | 'error' | 'info' = 'info') {
    if (!state.syncLogs) state.syncLogs = [];
    state.syncLogs.push({ time: Date.now(), msg, type });
    pruneSyncLogs();
    logger.info(`[Sync Log] ${msg}`);
}

function pruneSyncLogs() {
    if (!state.syncLogs || state.syncLogs.length === 0) return;
    const cutoff = Date.now() - SYNC_LOG_MAX_AGE_MS;
    while (state.syncLogs.length > 0 && state.syncLogs[0].time < cutoff) state.syncLogs.shift();
    while (state.syncLogs.length > SYNC_LOG_MAX_ENTRIES) state.syncLogs.shift();
}

export function setSyncStatus(statusKey: 'syncSaving' | 'syncSynced' | 'syncError' | 'syncInitial') {
    state.syncState = statusKey;
    if (ui.syncStatus) {
        ui.syncStatus.textContent = t(statusKey);
    }
}

async function resolveConflictWithServerState(serverShards: Record<string, string>) {
    const syncKey = getSyncKey();
    if (!syncKey) return setSyncStatus('syncError');
    
    try {
        addSyncLog("Conflito detectado. Mesclando dados...", "info");
        const remoteShards: Record<string, any> = {};
        for (const key in serverShards) {
            if (key === 'lastModified') continue;
            try {
                const decrypted = await runWorkerTask<any>('decrypt', serverShards[key], syncKey);
                remoteShards[key] = decrypted;
            } catch (err) {
                logger.warn(`[Sync] Failed to decrypt shard ${key}, skipping.`, err);
            }
        }

        const remoteState: any = {
            version: remoteShards['core']?.version || 0,
            lastModified: parseInt(serverShards.lastModified || '0', 10),
            habits: remoteShards['core']?.habits || [],
            dailyData: remoteShards['core']?.dailyData || {},
            dailyDiagnoses: remoteShards['core']?.dailyDiagnoses || {},
            archives: {},
            monthlyLogs: new Map(),
            notificationsShown: remoteShards['core']?.notificationsShown || [],
            hasOnboarded: remoteShards['core']?.hasOnboarded ?? true,
            quoteState: remoteShards['core']?.quoteState
        };

        for (const key in remoteShards) {
            if (key.startsWith('archive:')) { remoteState.archives[key.replace('archive:', '')] = remoteShards[key]; }
            if (key.startsWith('logs:')) { 
                remoteShards[key].forEach(([k, v]: [string, string]) => {
                    try {
                        remoteState.monthlyLogs.set(k, BigInt(v));
                    } catch (e) {
                        logger.warn(`[Sync] Invalid log value for ${k}, skipping.`, e);
                    }
                }); 
            }
        }

        const localState = getPersistableState();
        const mergedState = await mergeStates(localState, remoteState);
        
        await persistStateLocally(mergedState);
        await loadState(mergedState);
        renderApp();
        
        setSyncStatus('syncSynced'); 
        addSyncLog("Mesclagem concluída.", "success");
        clearSyncHashCache(); 
        syncStateWithCloud(mergedState, true);
    } catch (error: any) {
        addSyncLog(`Erro na resolução: ${error.message}`, "error");
        setSyncStatus('syncError');
    }
}

async function performSync() {
    if (isSyncInProgress || !pendingSyncState) return;
    isSyncInProgress = true;
    const appState = pendingSyncState;
    pendingSyncState = null; 
    const syncKey = getSyncKey();
    if (!syncKey) { setSyncStatus('syncError'); isSyncInProgress = false; return; }

    try {
        const rawShards = splitIntoShards(appState);
        const encryptedShards: Record<string, string> = {};
        
        const pendingHashUpdates = new Map<string, string>();
        let changeCount = 0;

        for (const shardName in rawShards) {
            const currentHash = murmurHash3(JSON.stringify(rawShards[shardName]));
            const lastHash = lastSyncedHashes.get(shardName);
            
            if (currentHash !== lastHash) {
                const encrypted = await runWorkerTask<string>('encrypt', rawShards[shardName], syncKey);
                encryptedShards[shardName] = encrypted;
                pendingHashUpdates.set(shardName, currentHash);
                changeCount++;
            }
        }

        if (changeCount === 0) {
            setSyncStatus('syncSynced');
            isSyncInProgress = false;
            return;
        }

        addSyncLog(`Sincronizando ${changeCount} pacotes...`, "info");
        const safeTs = appState.lastModified || Date.now();
        
        const payload = { lastModified: safeTs, shards: encryptedShards };
        const response = await apiFetch('/api/sync', { 
            method: 'POST', 
            body: JSON.stringify(payload) 
        }, true);

        if (response.status === 409) {
            clearSyncHashCache();
            await resolveConflictWithServerState(await response.json());
        } else if (response.ok) {
            try {
                const payload = await response.json();
                if (payload?.fallback) {
                    addSyncLog("Fallback sem Lua aplicado.", "info");
                }
            } catch (e) { logger.warn('[Sync] Failed to parse POST response body', e); }
            addSyncLog("Nuvem atualizada.", "success");
            setSyncStatus('syncSynced');
            pendingHashUpdates.forEach((hash, shard) => lastSyncedHashes.set(shard, hash));
            persistHashCache();
            document.dispatchEvent(new CustomEvent('habitsChanged')); 
        } else {
            const errorData = await response.json().catch(() => ({} as any));
            const code = errorData.code ? ` [${errorData.code}]` : '';
            const detail = errorData.detail ? ` (${errorData.detail}${errorData.detailType ? `:${errorData.detailType}` : ''})` : '';
            const raw = errorData.raw ? ` raw=${JSON.stringify(errorData.raw)}` : '';
            throw new Error((errorData.error || `Erro ${response.status}`) + code + detail + raw);
        }
    } catch (error: any) {
        addSyncLog(`Falha no envio: ${error.message}`, "error");
        setSyncStatus('syncError');
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            navigator.serviceWorker.ready.then(reg => (reg as any).sync?.register('sync-cloud-pending')).catch(() => {});
        }
    } finally {
        isSyncInProgress = false;
        if (pendingSyncState) setTimeout(performSync, 500);
    }
}

export function syncStateWithCloud(appState: AppState, immediate = false) {
    if (!hasLocalSyncKey()) return;
    pendingSyncState = structuredClone(appState); 
    setSyncStatus('syncSaving');
    if (isSyncInProgress) return;
    if (immediate) {
        debouncedSync.cancel();
        performSync();
    } else {
        debouncedSync();
    }
}

async function reconstructStateFromShards(shards: Record<string, string>): Promise<AppState | undefined> {
    const syncKey = getSyncKey();
    if (!syncKey) return undefined;
    try {
        const decryptedShards: Record<string, any> = {};
        for (const key in shards) {
            if (key === 'lastModified') continue;
            try {
                decryptedShards[key] = await runWorkerTask<any>('decrypt', shards[key], syncKey);
                lastSyncedHashes.set(key, murmurHash3(JSON.stringify(decryptedShards[key])));
            } catch (e) {
                logger.warn(`[Sync] Skip decrypt ${key}`, e);
            }
        }
        
        persistHashCache();

        const core = decryptedShards['core'];
        if (core && (!Array.isArray(core.habits) || !core.habits.every((h: any) => h && typeof h.id === 'string' && Array.isArray(h.scheduleHistory)))) {
            logger.error('[Sync] Decrypted core data has invalid structure. Aborting reconstruction.');
            return undefined;
        }

        const result: any = {
            version: core?.version || 0,
            lastModified: parseInt(shards.lastModified || '0', 10),
            habits: core?.habits || [],
            dailyData: core?.dailyData || {},
            dailyDiagnoses: core?.dailyDiagnoses || {},
            archives: {},
            monthlyLogs: new Map(),
            notificationsShown: core?.notificationsShown || [],
            hasOnboarded: core?.hasOnboarded ?? true,
            quoteState: core?.quoteState
        };
        for (const key in decryptedShards) {
            if (key.startsWith('archive:')) { result.archives[key.replace('archive:', '')] = decryptedShards[key]; }
            if (key.startsWith('logs:')) { 
                decryptedShards[key].forEach(([k, v]: [string, string]) => {
                    try {
                        result.monthlyLogs.set(k, BigInt(v));
                    } catch (e) {
                        logger.warn(`[Sync] Invalid log value for ${k}, skipping.`, e);
                    }
                }); 
            }
        }
        return result;
    } catch (e) {
        logger.error("State reconstruction failed:", e);
        return undefined;
    }
}

export async function downloadRemoteState(): Promise<AppState | undefined> {
    addSyncLog("Baixando dados remotos...", "info");
    const response = await apiFetch('/api/sync', {}, true);
    if (response.status === 304) { addSyncLog("Sem novidades na nuvem.", "info"); return undefined; }
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({} as any));
        const code = errorData.code ? ` [${errorData.code}]` : '';
        const detail = errorData.detail ? ` (${errorData.detail}${errorData.detailType ? `:${errorData.detailType}` : ''})` : '';
        const raw = errorData.raw ? ` raw=${JSON.stringify(errorData.raw)}` : '';
        throw new Error((errorData.error || "Falha na conexão com a nuvem") + code + detail + raw);
    }
    const shards = await response.json();
    if (!shards || Object.keys(shards).length === 0) { addSyncLog("Cofre vazio na nuvem.", "info"); return undefined; }
    addSyncLog("Dados baixados com sucesso.", "success");
    return await reconstructStateFromShards(shards);
}

export async function fetchStateFromCloud(): Promise<AppState | undefined> {
    if (!hasLocalSyncKey()) {
        state.initialSyncDone = true;
        return undefined;
    }
    setSyncStatus('syncSaving'); 
    try {
        const response = await apiFetch('/api/sync', {}, true);
        if (response.status === 304) { 
            state.initialSyncDone = true;
            setSyncStatus('syncSynced'); 
            return undefined; 
        }
        if (!response.ok) throw new Error("Cloud fetch failed with status " + response.status);
        const shards = await response.json();
        if (!shards || Object.keys(shards).length === 0) {
            state.initialSyncDone = true;
            return undefined;
        }
        const remoteState = await reconstructStateFromShards(shards);
        if (!remoteState) {
            state.initialSyncDone = true;
            return undefined;
        }
        const localState = getPersistableState();
        const remoteModified = remoteState.lastModified || 0, localModified = localState.lastModified || 0;
        
        if (remoteModified > localModified) {
            addSyncLog("Atualização remota detectada.", "info");
            const mergedState = await mergeStates(localState, remoteState);
            await persistStateLocally(mergedState);
            await loadState(mergedState);
            renderApp();
        } else if (localModified > remoteModified) {
            addSyncLog("Sincronizando mudanças locais...", "info");
            syncStateWithCloud(localState, true);
        } else {
            setSyncStatus('syncSynced');
        }
        return remoteState;
    } catch (error) {
        logger.warn("[Cloud] Boot sync failed (Offline or Error). Proceeding locally.", error);
        setSyncStatus('syncError');
        return undefined;
    } finally {
        state.initialSyncDone = true;
    }
}