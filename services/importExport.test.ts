import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../render', () => ({
    closeModal: vi.fn(),
    showConfirmationModal: vi.fn(),
    renderAINotificationState: vi.fn(),
    clearHabitDomCache: vi.fn(),
    updateDayVisuals: vi.fn(),
    openModal: vi.fn()
}));

vi.mock('../render/ui', () => ({
    ui: { manageModal: document.createElement('div') }
}));

vi.mock('../i18n', () => ({
    t: (key: string) => key,
    getTimeOfDayName: (time: string) => time,
    formatDate: () => 'date',
    formatList: (items: string[]) => items.join(', '),
    getAiLanguageName: () => 'pt'
}));

vi.mock('./persistence', () => ({
    loadState: vi.fn(async () => null),
    saveState: vi.fn(async () => {}),
    clearLocalPersistence: vi.fn(async () => {})
}));

vi.mock('./cloud', () => ({
    runWorkerTask: vi.fn(async () => ({})),
    addSyncLog: vi.fn()
}));

vi.mock('./api', () => ({
    apiFetch: vi.fn(async () => ({ ok: true, status: 200, text: async () => '' })),
    clearKey: vi.fn()
}));

describe('import/export round-trip', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rehidrata monthlyLogsSerialized antes do loadState', async () => {
        const { importData } = await import('./habitActions');
        const { loadState } = await import('./persistence');

        const originalCreate = document.createElement.bind(document);
        let fileInput: HTMLInputElement | null = null;
        vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
            const el = originalCreate(tag);
            if (tag === 'input') fileInput = el as HTMLInputElement;
            return el;
        });

        importData();

        const payload = {
            version: 10,
            habits: [{ id: 'h1', createdOn: '2024-01-01', scheduleHistory: [] }],
            monthlyLogsSerialized: [['h1_2024-01', '0x1']]
        };

        const file = new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' });
        (fileInput as any).files = [file];

        await (fileInput as unknown as HTMLInputElement)?.onchange?.({ target: fileInput } as any);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(loadState).toHaveBeenCalled();
        const arg = (loadState as any).mock.calls[0][0];
        expect(arg.monthlyLogs).toEqual({ 'h1_2024-01': '0x1' });
    });
});
