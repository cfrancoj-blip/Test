import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, getPersistableState } from '../state';
import { createTestHabit, clearTestState } from '../tests/test-utils';
import { HabitService } from './HabitService';

vi.mock('../render/ui', () => ({
    ui: { syncStatus: { textContent: '' } }
}));

vi.mock('../render', () => ({
    renderApp: vi.fn(),
    updateNotificationUI: vi.fn()
}));

vi.mock('../i18n', () => ({
    t: (key: string) => key
}));

vi.mock('./api', () => ({
    hasLocalSyncKey: vi.fn(),
    getSyncKey: vi.fn(),
    apiFetch: vi.fn()
}));

vi.mock('./persistence', () => ({
    loadState: vi.fn(async () => null),
    persistStateLocally: vi.fn(async () => {})
}));

vi.mock('./dataMerge', () => ({
    mergeStates: vi.fn(async (_local: any, remote: any) => remote)
}));

class MockWorker {
    onmessage: ((e: MessageEvent) => void) | null = null;
    onerror: ((e: Event) => void) | null = null;

    postMessage(msg: any) {
        const { id, type, payload } = msg;
        if (type === 'encrypt') {
            this.onmessage?.({ data: { id, status: 'success', result: `enc:${JSON.stringify(payload)}` } } as MessageEvent);
            return;
        }
        if (type === 'decrypt') {
            if (payload === 'coreEnc') {
                this.onmessage?.({ data: { id, status: 'success', result: { version: 10, habits: [], dailyData: {}, dailyDiagnoses: {}, notificationsShown: [], hasOnboarded: true, quoteState: undefined } } } as MessageEvent);
                return;
            }
            if (payload === 'logsEnc') {
                this.onmessage?.({ data: { id, status: 'success', result: [['h1_2024-01', '0x1']] } } as MessageEvent);
                return;
            }
            this.onmessage?.({ data: { id, status: 'success', result: payload } } as MessageEvent);
            return;
        }
        this.onmessage?.({ data: { id, status: 'success', result: payload } } as MessageEvent);
    }
}

beforeEach(() => {
    clearTestState();
    vi.clearAllMocks();
    // @ts-expect-error - test override
    globalThis.Worker = MockWorker;
});

describe('cloud sync basics', () => {
    it('envia shards core e logs quando ha mudancas', async () => {
        const { apiFetch, getSyncKey, hasLocalSyncKey } = await import('./api');
        vi.mocked(hasLocalSyncKey).mockReturnValue(true);
        vi.mocked(getSyncKey).mockReturnValue('k');
        vi.mocked(apiFetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as any);

        const habitId = createTestHabit({ name: 'H', time: 'Morning', goalType: 'check' });
        HabitService.setStatus(habitId, '2024-01-01', 'Morning', 1);
        state.lastModified = 123;

        const snapshot = getPersistableState();
        const { syncStateWithCloud } = await import('./cloud');
        syncStateWithCloud(snapshot, true);

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(apiFetch).toHaveBeenCalled();
        const [, opts] = vi.mocked(apiFetch).mock.calls[0];
        const payload = JSON.parse(opts!.body as string);
        expect(payload.lastModified).toBe(123);
        expect(Object.keys(payload.shards)).toContain('core');
        expect(Object.keys(payload.shards)).toContain('logs:2024-01');
    });

    it('faz merge e aplica estado remoto mais recente', async () => {
        const { apiFetch, getSyncKey, hasLocalSyncKey } = await import('./api');
        const { mergeStates } = await import('./dataMerge');
        const { loadState, persistStateLocally } = await import('./persistence');
        const { renderApp } = await import('../render');

        vi.mocked(hasLocalSyncKey).mockReturnValue(true);
        vi.mocked(getSyncKey).mockReturnValue('k');
        vi.mocked(apiFetch).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ lastModified: '2000', core: 'coreEnc', 'logs:2024-01': 'logsEnc' })
        } as any);

        state.lastModified = 1000;

        const { fetchStateFromCloud } = await import('./cloud');
        await fetchStateFromCloud();

        expect(mergeStates).toHaveBeenCalled();
        expect(persistStateLocally).toHaveBeenCalled();
        expect(loadState).toHaveBeenCalled();
        expect(renderApp).toHaveBeenCalled();
    });
});
