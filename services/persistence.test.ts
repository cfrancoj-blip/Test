/**
 * @file services/persistence.test.ts
 * @description Testes para a camada de persistência (IndexedDB split-storage).
 * P0 - Crítico: Core da camada de storage.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { state, getPersistableState, clearAllCaches, APP_VERSION } from '../state';
import { clearTestState, createTestHabit } from '../tests/test-utils';
import { HabitService } from './HabitService';

// Mock do render module para evitar dependências de DOM
vi.mock('../render', () => ({
    clearHabitDomCache: vi.fn(),
    renderAINotificationState: vi.fn(),
    updateDayVisuals: vi.fn(),
    closeModal: vi.fn(),
    showConfirmationModal: vi.fn(),
    openModal: vi.fn(),
}));

describe('💾 Persistência e Storage (persistence.ts)', () => {

    beforeEach(() => {
        clearTestState();
        state.initialSyncDone = true;
    });

    describe('getPersistableState', () => {
        it('deve retornar snapshot serializável do estado', () => {
            createTestHabit({ name: 'Meditar', time: 'Morning' });
            state.lastModified = 12345;

            const persistable = getPersistableState();

            expect(persistable.version).toBe(APP_VERSION);
            expect(persistable.habits).toHaveLength(1);
            expect(persistable.habits[0].scheduleHistory[0].name).toBe('Meditar');
            expect(persistable.lastModified).toBe(12345);
        });

        it('deve incluir monthlyLogs no snapshot', () => {
            const habitId = createTestHabit({ name: 'Exercício', time: 'Morning' });
            HabitService.setStatus(habitId, '2025-01-15', 'Morning', 1);

            const persistable = getPersistableState();
            expect(persistable.monthlyLogs).toBeInstanceOf(Map);
        });

        it('deve incluir dailyData e archives', () => {
            state.dailyData['2025-01-15'] = {
                'id1': { instances: { Morning: { note: 'Nota teste' } }, dailySchedule: undefined }
            };
            state.archives['2024'] = 'compressed-data';

            const persistable = getPersistableState();
            expect(persistable.dailyData['2025-01-15']).toBeDefined();
            expect(persistable.archives['2024']).toBe('compressed-data');
        });
    });

    describe('clearAllCaches', () => {
        it('deve limpar todos os caches de estado', () => {
            // Popula caches
            state.streaksCache.set('h1', new Map([['2025-01-01', 5]]));
            state.habitAppearanceCache.set('h1', new Map([['2025-01-01', true]]));
            state.scheduleCache.set('h1', new Map());
            state.activeHabitsCache.set('2025-01-01', []);
            state.daySummaryCache.set('2025-01-01', { total: 1, completed: 1, snoozed: 0, pending: 0, completedPercent: 100, snoozedPercent: 0, showPlusIndicator: false });

            clearAllCaches();

            expect(state.streaksCache.size).toBe(0);
            expect(state.habitAppearanceCache.size).toBe(0);
            expect(state.scheduleCache.size).toBe(0);
            expect(state.activeHabitsCache.size).toBe(0);
            expect(state.daySummaryCache.size).toBe(0);
        });
    });

    describe('Estado estrutural (state.ts)', () => {
        it('deve ter todos os campos obrigatórios após clearTestState', () => {
            expect(state.habits).toEqual([]);
            expect(state.monthlyLogs).toBeInstanceOf(Map);
            expect(state.dailyData).toEqual({});
            expect(state.archives).toEqual({});
            expect(state.streaksCache).toBeInstanceOf(Map);
            expect(state.habitAppearanceCache).toBeInstanceOf(Map);
            expect(state.scheduleCache).toBeInstanceOf(Map);
            expect(state.activeHabitsCache).toBeInstanceOf(Map);
            expect(state.daySummaryCache).toBeInstanceOf(Map);
            expect(state.syncLogs).toEqual([]);
        });

        it('deve permitir múltiplos hábitos sem interferência', () => {
            const id1 = createTestHabit({ name: 'Ler', time: 'Morning' });
            const id2 = createTestHabit({ name: 'Meditar', time: 'Evening' });
            const id3 = createTestHabit({ name: 'Exercício', time: 'Afternoon' });

            expect(state.habits).toHaveLength(3);
            expect(state.habits[0].id).toBe(id1);
            expect(state.habits[1].id).toBe(id2);
            expect(state.habits[2].id).toBe(id3);

            // Status independentes
            HabitService.setStatus(id1, '2025-01-15', 'Morning', 1);
            HabitService.setStatus(id2, '2025-01-15', 'Evening', 2);

            expect(HabitService.getStatus(id1, '2025-01-15', 'Morning')).toBe(1);
            expect(HabitService.getStatus(id2, '2025-01-15', 'Evening')).toBe(2);
            expect(HabitService.getStatus(id3, '2025-01-15', 'Afternoon')).toBe(0);
        });

        it('deve manter integridade de dailyData após operações CRUD', () => {
            const habitId = createTestHabit({ name: 'Teste', time: 'Morning' });
            const date = '2025-01-15';

            // Criar
            state.dailyData[date] = {};
            state.dailyData[date][habitId] = {
                instances: { Morning: { note: 'Nota original' } },
                dailySchedule: undefined
            };

            expect(state.dailyData[date][habitId].instances.Morning?.note).toBe('Nota original');

            // Atualizar
            state.dailyData[date][habitId].instances.Morning!.note = 'Nota atualizada';
            expect(state.dailyData[date][habitId].instances.Morning?.note).toBe('Nota atualizada');

            // Deletar
            delete state.dailyData[date][habitId];
            expect(state.dailyData[date][habitId]).toBeUndefined();
        });
    });
});
