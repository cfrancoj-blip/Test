/**
 * @file services/habitActions.test.ts
 * @description Testes para o controlador de lógica de negócios.
 * P2 - Business logic: toggle, markAll, import/export, reorder, graduation, transitions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, HABIT_STATE, Habit } from '../state';
import { clearTestState, createTestHabit, populateTestPeriod } from '../tests/test-utils';
import { HabitService } from './HabitService';
import { generateUUID, getTodayUTCIso } from '../utils';

// Mock rich modules to avoid DOM/render dependencies
vi.mock('../render', () => ({
    clearHabitDomCache: vi.fn(),
    renderAINotificationState: vi.fn(),
    updateDayVisuals: vi.fn(),
    closeModal: vi.fn(),
    showConfirmationModal: vi.fn(),
    openModal: vi.fn(),
}));

vi.mock('../render/ui', () => ({
    ui: {
        editHabitModal: {},
        aiOptionsModal: {},
        aiModal: {},
        aiResponse: { innerHTML: '' },
        manageModal: {},
        notesModal: {},
        notesTextarea: { value: '' }
    }
}));

vi.mock('./cloud', () => ({
    runWorkerTask: vi.fn().mockResolvedValue({}),
    addSyncLog: vi.fn(),
}));

vi.mock('./api', () => ({
    apiFetch: vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    clearKey: vi.fn(),
}));

import {
    toggleHabitStatus,
    markAllHabitsForDate,
    reorderHabit,
    graduateHabit,
    handleDayTransition,
    consumeAndFormatCelebrations,
    exportData
} from './habitActions';

describe('⚙️ Lógica de Negócios (habitActions.ts)', () => {

    beforeEach(() => {
        clearTestState();
        state.initialSyncDone = true; // Desbloqueia operações
    });

    describe('toggleHabitStatus', () => {
        it('deve ciclar: NULL → DONE → DEFERRED → NULL', () => {
            const id = createTestHabit({ name: 'Toggle', time: 'Morning' });
            const date = getTodayUTCIso();

            // Inicial: NULL (0)
            expect(HabitService.getStatus(id, date, 'Morning')).toBe(HABIT_STATE.NULL);

            // Click 1: DONE (1)
            toggleHabitStatus(id, 'Morning', date);
            const s1 = HabitService.getStatus(id, date, 'Morning');
            expect(s1).toBe(HABIT_STATE.DONE);

            // Click 2: DEFERRED (2)  
            toggleHabitStatus(id, 'Morning', date);
            const s2 = HabitService.getStatus(id, date, 'Morning');
            expect(s2).toBe(HABIT_STATE.DEFERRED);

            // Click 3: NULL (0) 
            toggleHabitStatus(id, 'Morning', date);
            const s3 = HabitService.getStatus(id, date, 'Morning');
            expect(s3).toBe(HABIT_STATE.NULL);
        });

        it('não deve operar antes do sync inicial (boot lock)', () => {
            state.initialSyncDone = false;
            const id = createTestHabit({ name: 'Locked', time: 'Morning' });
            const date = getTodayUTCIso();

            toggleHabitStatus(id, 'Morning', date);
            expect(HabitService.getStatus(id, date, 'Morning')).toBe(HABIT_STATE.NULL);
        });

        it('deve disparar evento card-status-changed', () => {
            const id = createTestHabit({ name: 'Evento', time: 'Morning' });
            const date = getTodayUTCIso();

            const listener = vi.fn();
            document.addEventListener('card-status-changed', listener);

            toggleHabitStatus(id, 'Morning', date);

            expect(listener).toHaveBeenCalled();
            document.removeEventListener('card-status-changed', listener);
        });
    });

    describe('markAllHabitsForDate', () => {
        it('deve marcar todos os hábitos como completos', () => {
            const id1 = createTestHabit({ name: 'H1', time: 'Morning' });
            const id2 = createTestHabit({ name: 'H2', time: 'Morning' });
            const date = getTodayUTCIso();

            const changed = markAllHabitsForDate(date, 'completed');

            expect(changed).toBe(true);
            expect(HabitService.getStatus(id1, date, 'Morning')).toBe(HABIT_STATE.DONE);
            expect(HabitService.getStatus(id2, date, 'Morning')).toBe(HABIT_STATE.DONE);
        });

        it('deve marcar todos como adiados', () => {
            const id1 = createTestHabit({ name: 'H1', time: 'Morning' });
            const date = getTodayUTCIso();

            markAllHabitsForDate(date, 'snoozed');

            expect(HabitService.getStatus(id1, date, 'Morning')).toBe(HABIT_STATE.DEFERRED);
        });

        it('não deve operar antes do sync inicial', () => {
            state.initialSyncDone = false;
            createTestHabit({ name: 'H1', time: 'Morning' });

            const result = markAllHabitsForDate(getTodayUTCIso(), 'completed');
            expect(result).toBe(false);
        });
    });

    describe('reorderHabit', () => {
        it('deve mover hábito antes de outro', () => {
            const id1 = createTestHabit({ name: 'First', time: 'Morning' });
            const id2 = createTestHabit({ name: 'Second', time: 'Morning' });
            const id3 = createTestHabit({ name: 'Third', time: 'Morning' });

            reorderHabit(id3, id1, 'before');

            expect(state.habits[0].id).toBe(id3);
            expect(state.habits[1].id).toBe(id1);
            expect(state.habits[2].id).toBe(id2);
        });

        it('deve mover hábito depois de outro', () => {
            const id1 = createTestHabit({ name: 'First', time: 'Morning' });
            const id2 = createTestHabit({ name: 'Second', time: 'Morning' });
            const id3 = createTestHabit({ name: 'Third', time: 'Morning' });

            reorderHabit(id1, id3, 'after');

            expect(state.habits[0].id).toBe(id2);
            expect(state.habits[1].id).toBe(id3);
            expect(state.habits[2].id).toBe(id1);
        });

        it('não deve falhar com IDs inexistentes', () => {
            createTestHabit({ name: 'Existing', time: 'Morning' });

            // Não deve lançar erro
            reorderHabit('non-existent', 'also-non-existent', 'before');
            expect(state.habits).toHaveLength(1);
        });
    });

    describe('graduateHabit', () => {
        it('deve marcar hábito como graduado', () => {
            const id = createTestHabit({ name: 'Graduated', time: 'Morning' });
            state.selectedDate = '2025-06-15';

            graduateHabit(id);

            const habit = state.habits.find(h => h.id === id)!;
            expect(habit.graduatedOn).toBeDefined();
        });

        it('não deve graduar antes do sync inicial', () => {
            state.initialSyncDone = false;
            const id = createTestHabit({ name: 'Not yet', time: 'Morning' });

            graduateHabit(id);

            expect(state.habits.find(h => h.id === id)!.graduatedOn).toBeUndefined();
        });
    });

    describe('handleDayTransition', () => {
        it('deve limpar caches e atualizar UI dirty flags', () => {
            // Popula caches
            state.activeHabitsCache.set('2025-01-01', []);
            state.calendarDates = ['2025-01-01'];

            handleDayTransition();

            expect(state.activeHabitsCache.size).toBe(0);
            expect(state.calendarDates).toEqual([]);
            expect(state.uiDirtyState.calendarVisuals).toBe(true);
            expect(state.uiDirtyState.habitListStructure).toBe(true);
            expect(state.uiDirtyState.chartData).toBe(true);
        });
    });

    describe('consumeAndFormatCelebrations', () => {
        it('deve retornar string vazia quando não há celebrações', () => {
            expect(consumeAndFormatCelebrations()).toBe('');
        });

        it('deve formatar celebração de 21 dias e limpar fila', () => {
            const id = createTestHabit({ name: 'Consistente', time: 'Morning' });
            state.pending21DayHabitIds.push(id);

            const text = consumeAndFormatCelebrations();

            expect(text).toBeTruthy();
            expect(state.pending21DayHabitIds).toHaveLength(0);
        });

        it('deve formatar celebração de 66 dias', () => {
            const id = createTestHabit({ name: 'Consolidado', time: 'Morning' });
            state.pendingConsolidationHabitIds.push(id);

            const text = consumeAndFormatCelebrations();

            expect(text).toBeTruthy();
            expect(state.pendingConsolidationHabitIds).toHaveLength(0);
        });

        it('deve registrar IDs em notificationsShown para evitar repetição', () => {
            const id = createTestHabit({ name: 'Once', time: 'Morning' });
            state.pending21DayHabitIds.push(id);

            consumeAndFormatCelebrations();

            expect(state.notificationsShown).toContain(`${id}-21`);
        });
    });

    describe('exportData', () => {
        it('deve criar link de download com dados serializados', () => {
            createTestHabit({ name: 'Export test', time: 'Morning' });
            
            const createElementSpy = vi.spyOn(document, 'createElement');
            const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
            const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');

            exportData();

            // Verifica que um <a> foi criado
            expect(createElementSpy).toHaveBeenCalledWith('a');
            
            createElementSpy.mockRestore();
            revokeObjectURLSpy.mockRestore();
            createObjectURLSpy.mockRestore();
        });
    });
});
