/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { ui } from "../render/ui";
import { t } from "../i18n";
import { downloadRemoteState, syncStateWithCloud, setSyncStatus, clearSyncHashCache, addSyncLog } from "../services/cloud";
import { loadState, saveState } from "../services/persistence";
import { renderApp, openSyncDebugModal, clearHabitDomCache } from "../render";
import { showConfirmationModal } from "../render/modals";
import { storeKey, clearKey, hasLocalSyncKey, getSyncKey, isValidKeyFormat } from "../services/api";
import { generateUUID } from "../utils";
import { SYNC_ENABLE_RETRY_MS, SYNC_COPY_FEEDBACK_MS, SYNC_INPUT_FOCUS_MS } from "../constants";
import { getPersistableState, state, clearActiveHabitsCache } from "../state";
import { mergeStates } from "../services/dataMerge";

function showView(view: 'inactive' | 'enterKey' | 'displayKey' | 'active') {
    ui.syncInactiveView.style.display = 'none';
    ui.syncEnterKeyView.style.display = 'none';
    ui.syncDisplayKeyView.style.display = 'none';
    ui.syncActiveView.style.display = 'none';
    if (ui.syncErrorMsg) ui.syncErrorMsg.classList.add('hidden');
    switch (view) {
        case 'inactive': ui.syncInactiveView.style.display = 'flex'; break;
        case 'enterKey': ui.syncEnterKeyView.style.display = 'flex'; break;
        case 'displayKey': 
            ui.syncDisplayKeyView.style.display = 'flex'; 
            const context = ui.syncDisplayKeyView.dataset.context;
            ui.keySavedBtn.textContent = (context === 'view') ? t('closeButton') : t('syncKeySaved');
            break;
        case 'active': ui.syncActiveView.style.display = 'flex'; break;
    }
}

function _toggleButtons(buttons: HTMLButtonElement[], disabled: boolean) {
    for (let i = 0; i < buttons.length; i++) { buttons[i].disabled = disabled; }
}

async function _processKey(key: string) {
    const buttons = [ui.submitKeyBtn, ui.cancelEnterKeyBtn];
    _toggleButtons(buttons, true);
    if (ui.syncErrorMsg) ui.syncErrorMsg.classList.add('hidden');
    const originalBtnText = ui.submitKeyBtn.textContent;
    ui.submitKeyBtn.textContent = t('syncVerifying');
    const originalKey = getSyncKey();
    
    try {
        clearSyncHashCache();
        storeKey(key);
        
        const cloudState = await downloadRemoteState();

        // SEGURANÇA: Só carregamos se houver hábitos na nuvem.
        // Se a nuvem estiver vazia, forçamos um PUSH dos dados locais para não perder o progresso atual.
        if (cloudState && cloudState.habits && cloudState.habits.length > 0) {
            addSyncLog("Dados encontrados na nuvem. Mesclando...", "info");
            const localState = getPersistableState();
            const mergedState = await mergeStates(localState, cloudState);
            await loadState(mergedState);
            clearActiveHabitsCache();
            clearHabitDomCache();
            state.uiDirtyState.habitListStructure = state.uiDirtyState.calendarVisuals = state.uiDirtyState.chartData = true;
            await saveState(true);
            renderApp();
            setSyncStatus('syncSynced');
            syncStateWithCloud(mergedState, true);
        } else {
            addSyncLog("Cofre nuvem vazio. Inicializando com dados locais.", "info");
            setSyncStatus('syncSynced');
            syncStateWithCloud(getPersistableState(), true);
        }
        _refreshViewState(); 
    } catch (error: any) {
        if (originalKey) storeKey(originalKey);
        else clearKey();
        if (ui.syncErrorMsg) {
            let msg = error.message || "Erro desconhecido";
            if (msg.includes('401') || msg.includes('Auth')) msg = "Chave Inválida ou Não Encontrada";
            ui.syncErrorMsg.textContent = msg;
            ui.syncErrorMsg.classList.remove('hidden');
        }
        setSyncStatus('syncError');
        addSyncLog(`Falha na ativação: ${error.message}`, "error");
    } finally {
        ui.submitKeyBtn.textContent = originalBtnText;
        _toggleButtons(buttons, false);
    }
}

const _handleEnableSync = () => {
    try {
        ui.enableSyncBtn.disabled = true;
        if (ui.syncErrorMsg) ui.syncErrorMsg.classList.add('hidden');
        const newKey = generateUUID();
        clearSyncHashCache();
        storeKey(newKey);
        setSyncStatus('syncSynced');
        ui.syncKeyText.textContent = newKey;
        ui.syncDisplayKeyView.dataset.context = 'setup';
        showView('displayKey');
        syncStateWithCloud(getPersistableState(), true);
        setTimeout(() => ui.enableSyncBtn.disabled = false, SYNC_ENABLE_RETRY_MS);
    } catch (e: any) {
        ui.enableSyncBtn.disabled = false;
        if (ui.syncErrorMsg) {
            ui.syncErrorMsg.textContent = e.message || "Erro ao gerar chave";
            ui.syncErrorMsg.classList.remove('hidden');
        }
    }
};

const _handleEnterKeyView = () => { showView('enterKey'); setTimeout(() => ui.syncKeyInput.focus(), SYNC_INPUT_FOCUS_MS); };
const _handleCancelEnterKey = () => { ui.syncKeyInput.value = ''; if (ui.syncErrorMsg) ui.syncErrorMsg.classList.add('hidden'); _refreshViewState(); };
const _handleSubmitKey = () => {
    const key = ui.syncKeyInput.value.trim();
    if (!key) return;
    if (ui.syncErrorMsg) ui.syncErrorMsg.classList.add('hidden');
    if (!isValidKeyFormat(key)) {
        showConfirmationModal(t('confirmInvalidKeyBody'), () => _processKey(key), { title: t('confirmInvalidKeyTitle'), confirmText: t('confirmButton'), cancelText: t('cancelButton') });
    } else { _processKey(key); }
};
const _handleKeySaved = () => showView('active');
const _handleCopyKey = () => {
    const key = ui.syncKeyText.textContent;
    if(key) {
        navigator.clipboard.writeText(key).then(() => {
            const originalText = ui.copyKeyBtn.innerHTML;
            ui.copyKeyBtn.innerHTML = '✓';
            setTimeout(() => { ui.copyKeyBtn.innerHTML = originalText; }, SYNC_COPY_FEEDBACK_MS);
        }).catch(() => alert("Copie manualmente: " + key));
    }
};
const _handleViewKey = () => { const key = getSyncKey(); if (key) { ui.syncKeyText.textContent = key; ui.syncDisplayKeyView.dataset.context = 'view'; showView('displayKey'); } };
const _handleDisableSync = () => { showConfirmationModal(t('confirmSyncDisable'), () => { clearKey(); setSyncStatus('syncInitial'); showView('inactive'); }, { title: t('syncDisableTitle'), confirmText: t('syncDisableConfirm'), confirmButtonStyle: 'danger' }); };
const _handleDiagnostics = (e: Event) => { openSyncDebugModal(); };

function _refreshViewState() {
    const hasKey = hasLocalSyncKey();
    if (hasKey) { showView('active'); if (state.syncState === 'syncInitial') { setSyncStatus('syncSynced'); } }
    else { showView('inactive'); setSyncStatus('syncInitial'); }
}

export function initSync() {
    if (ui.enableSyncBtn) ui.enableSyncBtn.addEventListener('click', _handleEnableSync);
    if (ui.enterKeyViewBtn) ui.enterKeyViewBtn.addEventListener('click', _handleEnterKeyView);
    if (ui.cancelEnterKeyBtn) ui.cancelEnterKeyBtn.addEventListener('click', _handleCancelEnterKey);
    if (ui.submitKeyBtn) ui.submitKeyBtn.addEventListener('click', _handleSubmitKey);
    if (ui.keySavedBtn) ui.keySavedBtn.addEventListener('click', _handleKeySaved);
    if (ui.copyKeyBtn) ui.copyKeyBtn.addEventListener('click', _handleCopyKey);
    if (ui.viewKeyBtn) ui.viewKeyBtn.addEventListener('click', _handleViewKey);
    if (ui.disableSyncBtn) ui.disableSyncBtn.addEventListener('click', _handleDisableSync);
    if (ui.syncStatus) ui.syncStatus.addEventListener('pointerdown', _handleDiagnostics);
    _refreshViewState();
}