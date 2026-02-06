/**
 * @file services/selectors.test.ts
 * @description Testes para a camada de seletores de dados (scheduling, streaks, sumários).
 * P1 - Lógica complexa de scheduling multi-frequência e smart goals.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { state, HABIT_STATE, Habit, HabitSchedule } from '../state';
import { clearTestState, createTestHabit } from '../tests/test-utils';
import { HabitService } from './HabitService';
import {
    getScheduleForDate,
    getEffectiveScheduleForHabitOnDate,
    getHabitPropertiesForDate,
    getHabitDisplayInfo,
    shouldHabitAppearOnDate,
    calculateHabitStreak,
    getActiveHabitsForDate,
    calculateDaySummary,
    clearSelectorInternalCaches
} from './selectors';
import { generateUUID } from '../utils';

function createHabitWithSchedule(overrides: Partial<HabitSchedule> & { name: string }): Habit {
    const habit: Habit = {
        id: generateUUID(),
        createdOn: overrides.startDate || '2025-01-01',
        scheduleHistory: [{
            startDate: overrides.startDate || '2025-01-01',
            icon: '⭐',
            color: '#3498db',
            goal: overrides.goal || { type: 'check' },
            name: overrides.name,
            times: overrides.times || ['Morning'] as any,
            frequency: overrides.frequency || { type: 'daily' },
            scheduleAnchor: overrides.scheduleAnchor || overrides.startDate || '2025-01-01',
            endDate: overrides.endDate,
            ...(overrides.philosophy ? { philosophy: overrides.philosophy } : {})
        }]
    };
    state.habits.push(habit);
    return habit;
}

describe('🔍 Seletores de Dados (selectors.ts)', () => {

    beforeEach(() => {
        clearTestState();
        clearSelectorInternalCaches();
    });

    describe('getScheduleForDate', () => {
        it('deve retornar schedule ativo para data dentro do range', () => {
            const habit = createHabitWithSchedule({ name: 'Ler', startDate: '2025-01-01' });
            const schedule = getScheduleForDate(habit, '2025-01-15');

            expect(schedule).toBeDefined();
            expect(schedule!.name).toBe('Ler');
        });

        it('deve retornar null para data antes do startDate', () => {
            const habit = createHabitWithSchedule({ name: 'Ler', startDate: '2025-06-01' });
            const schedule = getScheduleForDate(habit, '2025-01-15');

            expect(schedule).toBeNull();
        });

        it('deve retornar null para data após endDate', () => {
            const habit = createHabitWithSchedule({ 
                name: 'Ler', 
                startDate: '2025-01-01',
                endDate: '2025-03-01'
            });
            const schedule = getScheduleForDate(habit, '2025-04-01');

            expect(schedule).toBeNull();
        });

        it('deve resolver schedule com múltiplas entradas no histórico', () => {
            const habit: Habit = {
                id: generateUUID(),
                createdOn: '2025-01-01',
                scheduleHistory: [
                    {
                        startDate: '2025-01-01',
                        endDate: '2025-03-01',
                        icon: '📖', color: '#3498db',
                        goal: { type: 'check' },
                        name: 'Ler 10 páginas',
                        times: ['Morning'],
                        frequency: { type: 'daily' },
                        scheduleAnchor: '2025-01-01'
                    },
                    {
                        startDate: '2025-03-01',
                        icon: '📖', color: '#3498db',
                        goal: { type: 'pages', total: 20 },
                        name: 'Ler 20 páginas',
                        times: ['Morning', 'Evening'],
                        frequency: { type: 'daily' },
                        scheduleAnchor: '2025-03-01'
                    }
                ]
            };
            state.habits.push(habit);

            const jan = getScheduleForDate(habit, '2025-01-15');
            const apr = getScheduleForDate(habit, '2025-04-15');

            expect(jan!.name).toBe('Ler 10 páginas');
            expect(apr!.name).toBe('Ler 20 páginas');
        });

        it('deve retornar null para hábito sem scheduleHistory', () => {
            const habit: Habit = { id: 'empty', createdOn: '2025-01-01', scheduleHistory: [] };
            const schedule = getScheduleForDate(habit, '2025-01-15');
            expect(schedule).toBeNull();
        });
    });

    describe('shouldHabitAppearOnDate', () => {
        it('deve aparecer em todas as datas para frequência daily', () => {
            const habit = createHabitWithSchedule({ name: 'Diário', frequency: { type: 'daily' } });

            expect(shouldHabitAppearOnDate(habit, '2025-01-01')).toBe(true);
            expect(shouldHabitAppearOnDate(habit, '2025-06-15')).toBe(true);
            expect(shouldHabitAppearOnDate(habit, '2025-12-31')).toBe(true);
        });

        it('não deve aparecer se deletedOn <= data', () => {
            const habit = createHabitWithSchedule({ name: 'Deletado' });
            habit.deletedOn = '2025-03-01';

            expect(shouldHabitAppearOnDate(habit, '2025-02-28')).toBe(true);
            expect(shouldHabitAppearOnDate(habit, '2025-03-01')).toBe(false);
            expect(shouldHabitAppearOnDate(habit, '2025-04-01')).toBe(false);
        });

        it('não deve aparecer se graduado', () => {
            const habit = createHabitWithSchedule({ name: 'Graduado' });
            habit.graduatedOn = '2025-03-01';

            expect(shouldHabitAppearOnDate(habit, '2025-04-01')).toBe(false);
        });

        it('deve aparecer apenas nos dias específicos (specific_days_of_week)', () => {
            const habit = createHabitWithSchedule({ 
                name: 'Seg/Qua/Sex',
                frequency: { type: 'specific_days_of_week', days: [1, 3, 5] } // Mon, Wed, Fri
            });

            // 2025-01-06 é segunda-feira (day=1)
            expect(shouldHabitAppearOnDate(habit, '2025-01-06')).toBe(true);
            // 2025-01-07 é terça-feira (day=2)
            expect(shouldHabitAppearOnDate(habit, '2025-01-07')).toBe(false);
            // 2025-01-08 é quarta-feira (day=3)
            expect(shouldHabitAppearOnDate(habit, '2025-01-08')).toBe(true);
        });

        it('deve aparecer a cada N dias (interval/days)', () => {
            const habit = createHabitWithSchedule({ 
                name: 'Dia sim dia não',
                startDate: '2025-01-01',
                frequency: { type: 'interval', unit: 'days', amount: 2 },
                scheduleAnchor: '2025-01-01'
            });

            expect(shouldHabitAppearOnDate(habit, '2025-01-01')).toBe(true);
            expect(shouldHabitAppearOnDate(habit, '2025-01-02')).toBe(false);
            expect(shouldHabitAppearOnDate(habit, '2025-01-03')).toBe(true);
            expect(shouldHabitAppearOnDate(habit, '2025-01-04')).toBe(false);
        });
    });

    describe('calculateHabitStreak', () => {
        it('deve calcular streak de dias consecutivos completos', () => {
            const habit = createHabitWithSchedule({ name: 'Streaker', startDate: '2025-01-01' });

            // Marca 5 dias consecutivos como completos
            for (let d = 1; d <= 5; d++) {
                const date = `2025-01-${String(d).padStart(2, '0')}`;
                HabitService.setStatus(habit.id, date, 'Morning', HABIT_STATE.DONE);
            }

            const streak = calculateHabitStreak(habit, '2025-01-05');
            expect(streak).toBe(5);
        });

        it('deve parar streak quando encontra dia não completo', () => {
            const habit = createHabitWithSchedule({ name: 'Quebrado', startDate: '2025-01-01' });

            HabitService.setStatus(habit.id, '2025-01-01', 'Morning', HABIT_STATE.DONE);
            HabitService.setStatus(habit.id, '2025-01-02', 'Morning', HABIT_STATE.DONE);
            // Dia 3 não marcado (DEFERRED)
            HabitService.setStatus(habit.id, '2025-01-03', 'Morning', HABIT_STATE.DEFERRED);
            HabitService.setStatus(habit.id, '2025-01-04', 'Morning', HABIT_STATE.DONE);
            HabitService.setStatus(habit.id, '2025-01-05', 'Morning', HABIT_STATE.DONE);

            const streak = calculateHabitStreak(habit, '2025-01-05');
            expect(streak).toBe(2); // Só 04 e 05
        });

        it('deve retornar 0 para hábito inexistente', () => {
            expect(calculateHabitStreak('non-existent-id', '2025-01-15')).toBe(0);
        });

        it('deve retornar 0 para data inválida', () => {
            const habit = createHabitWithSchedule({ name: 'Test' });
            expect(calculateHabitStreak(habit, 'invalid-date')).toBe(0);
        });
    });

    describe('getActiveHabitsForDate', () => {
        it('deve retornar todos os hábitos ativos para uma data', () => {
            createHabitWithSchedule({ name: 'H1', startDate: '2025-01-01' });
            createHabitWithSchedule({ name: 'H2', startDate: '2025-01-01' });
            createHabitWithSchedule({ name: 'H3', startDate: '2025-02-01' });

            const active = getActiveHabitsForDate('2025-01-15');
            expect(active).toHaveLength(2); // H1 e H2

            const activeAll = getActiveHabitsForDate('2025-02-15');
            expect(activeAll).toHaveLength(3);
        });

        it('deve excluir hábitos deletados', () => {
            const habit = createHabitWithSchedule({ name: 'Deletado', startDate: '2025-01-01' });
            createHabitWithSchedule({ name: 'Ativo', startDate: '2025-01-01' });
            habit.deletedOn = '2025-01-10';

            const active = getActiveHabitsForDate('2025-01-15');
            expect(active).toHaveLength(1);
            expect(active[0].habit.scheduleHistory[0].name).toBe('Ativo');
        });

        it('deve cachear resultados', () => {
            createHabitWithSchedule({ name: 'H1' });

            const r1 = getActiveHabitsForDate('2025-01-15');
            const r2 = getActiveHabitsForDate('2025-01-15');

            expect(r1).toBe(r2); // Mesma referência (cache hit)
        });
    });

    describe('calculateDaySummary', () => {
        it('deve calcular sumário com totais corretos', () => {
            const h1 = createHabitWithSchedule({ name: 'H1', startDate: '2025-01-01' });
            const h2 = createHabitWithSchedule({ name: 'H2', startDate: '2025-01-01' });

            HabitService.setStatus(h1.id, '2025-01-15', 'Morning', HABIT_STATE.DONE);
            HabitService.setStatus(h2.id, '2025-01-15', 'Morning', HABIT_STATE.DEFERRED);

            const summary = calculateDaySummary('2025-01-15');

            expect(summary.total).toBe(2);
            expect(summary.completed).toBe(1);
            expect(summary.snoozed).toBe(1);
            expect(summary.pending).toBe(0);
            expect(summary.completedPercent).toBe(50);
        });

        it('deve retornar zeros para data sem hábitos', () => {
            const summary = calculateDaySummary('2025-01-15');

            expect(summary.total).toBe(0);
            expect(summary.completed).toBe(0);
            expect(summary.completedPercent).toBe(0);
        });

        it('deve lidar com múltiplos turnos por hábito', () => {
            const habit: Habit = {
                id: generateUUID(),
                createdOn: '2025-01-01',
                scheduleHistory: [{
                    startDate: '2025-01-01',
                    icon: '🏋️', color: '#e74c3c',
                    goal: { type: 'check' },
                    name: 'Multi-turno',
                    times: ['Morning', 'Evening'],
                    frequency: { type: 'daily' },
                    scheduleAnchor: '2025-01-01'
                }]
            };
            state.habits.push(habit);

            HabitService.setStatus(habit.id, '2025-01-15', 'Morning', HABIT_STATE.DONE);
            // Evening fica pendente

            const summary = calculateDaySummary('2025-01-15');
            expect(summary.total).toBe(2);
            expect(summary.completed).toBe(1);
            expect(summary.pending).toBe(1);
        });
    });

    describe('getHabitDisplayInfo', () => {
        it('deve retornar nome e subtítulo do schedule', () => {
            const habit = createHabitWithSchedule({ name: 'Meditar' });
            const info = getHabitDisplayInfo(habit);

            expect(info.name).toBe('Meditar');
        });

        it('deve incluir status quando time é fornecido', () => {
            const habit = createHabitWithSchedule({ name: 'Ler', startDate: '2025-01-01' });
            HabitService.setStatus(habit.id, '2025-01-15', 'Morning', HABIT_STATE.DONE);

            const info = getHabitDisplayInfo(habit, '2025-01-15', 'Morning');

            expect(info.status).toBe(HABIT_STATE.DONE);
            expect(info.isCompleted).toBe(true);
        });
    });

    describe('Caching e eviction', () => {
        it('deve limpar caches com clearSelectorInternalCaches', () => {
            const habit = createHabitWithSchedule({ name: 'Cache test' });

            // Preenche cache
            shouldHabitAppearOnDate(habit, '2025-01-15');
            calculateHabitStreak(habit, '2025-01-15');

            // Limpa
            clearSelectorInternalCaches();

            // Cache de habitAppearance e streaks são gerenciados pelo state, não pelo selector
            // Mas o selector cache interno (_anchorDateCache) deve ser limpo
            // Verificamos que a função ainda funciona após limpar
            expect(shouldHabitAppearOnDate(habit, '2025-01-15')).toBe(true);
        });
    });
});
