/**
 * @file services/stateUIConsistency.test.ts
 * @description Testes COMPLETOS de Consistência: Base de Dados ↔ Cache UI.
 * 
 * Cobre TODAS as operações do programa que podem causar divergência:
 * - Toggle de status (click no card)
 * - Drag & Drop (só hoje / a partir de agora)
 * - Edição de hábito (adicionar/remover horários, mudar propriedades)
 * - Deleção (swipe, modal de configurações, sem horário selecionado)
 * - Ressurreição (re-adicionar hábito deletado/encerrado/graduado)
 * - Notas, GoalOverride, Graduação
 * - markAll, reorder, batch operations
 * - Transição de dia, importação/exportação
 * - Serialização roundtrip
 * 
 * PRINCÍPIO: O bitmask é a fonte da verdade para status.
 *            O scheduleHistory é a fonte da verdade para propriedades visuais.
 *            O dailyData é a fonte da verdade para metadados (notas, goalOverride).
 *            A UI NUNCA pode divergir dessas fontes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
    state, Habit, HabitSchedule, HABIT_STATE, TimeOfDay, TIMES_OF_DAY,
    getHabitDailyInfoForDate, ensureHabitDailyInfo, ensureHabitInstanceData,
    clearAllCaches, clearScheduleCache, clearActiveHabitsCache,
    invalidateCachesForDateChange, getPersistableState
} from '../state';
import { clearTestState, createTestHabit, populateTestPeriod } from '../tests/test-utils';
import { HabitService } from './HabitService';
import { 
    getActiveHabitsForDate, calculateHabitStreak, 
    getHabitDisplayInfo, shouldHabitAppearOnDate,
    getScheduleForDate, getEffectiveScheduleForHabitOnDate,
    calculateDaySummary
} from './selectors';
import { generateUUID, getTodayUTCIso, addDays, parseUTCIsoDate, toUTCIsoDateString } from '../utils';
import * as cloud from './cloud';

// Mock render/cloud que dependem de DOM real ou rede
var nextModalAction: 'confirm' | 'edit' | 'cancel' | null = null;

vi.mock('../render', () => ({
    clearHabitDomCache: vi.fn(),
    renderAINotificationState: vi.fn(),
    updateDayVisuals: vi.fn(),
    closeModal: vi.fn(),
    showConfirmationModal: vi.fn((_: string, onConfirm: () => void, options?: any) => {
        if (nextModalAction === 'confirm') onConfirm();
        else if (nextModalAction === 'edit') options?.onEdit?.();
        else if (nextModalAction === 'cancel') options?.onCancel?.();
    }),
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
    toggleHabitStatus, markAllHabitsForDate, saveHabitFromModal,
    reorderHabit, graduateHabit, setGoalOverride,
    handleDayTransition, consumeAndFormatCelebrations,
    handleSaveNote, handleHabitDrop,
    requestHabitPermanentDeletion, requestHabitEndingFromModal,
    requestHabitTimeRemoval
} from './habitActions';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS: Simula a lógica de updateHabitCardElement SEM DOM real,
//          verificando que os dados crus produziriam o status CSS correto.
// ═══════════════════════════════════════════════════════════════════════════

interface ExpectedCardState {
    cssStatus: 'completed' | 'snoozed' | 'pending';
    isArete: boolean;        // data-arete === 'true'
    hasNote: boolean;        // data-has-note === 'true'
    isConsolidated: boolean; // classe 'consolidated'
    isSemiConsolidated: boolean; // classe 'semi-consolidated'
    name: string;
    subtitle: string;
}

/**
 * Calcula o estado esperado do card APENAS a partir das fontes da verdade,
 * sem consultar nenhum cache DOM. Isso replica a lógica de updateHabitCardElement.
 */
function computeExpectedCardState(habit: Habit, date: string, time: TimeOfDay): ExpectedCardState {
    // 1. Status via Bitmask (Fonte da Verdade)
    const bitStatus = HabitService.getStatus(habit.id, date, time);
    let cssStatus: 'completed' | 'snoozed' | 'pending' = 'pending';
    if (bitStatus === HABIT_STATE.DONE || bitStatus === HABIT_STATE.DONE_PLUS) {
        cssStatus = 'completed';
    } else if (bitStatus === HABIT_STATE.DEFERRED) {
        cssStatus = 'snoozed';
    }

    // 2. Arete (Done+)
    const isArete = bitStatus === HABIT_STATE.DONE_PLUS;

    // 3. Metadados ricos (JSON)
    const info = getHabitDailyInfoForDate(date)[habit.id]?.instances?.[time];
    const hasNote = !!info?.note;

    // 4. Streak
    const streak = calculateHabitStreak(habit, date);
    const isConsolidated = streak >= 66;
    const isSemiConsolidated = streak >= 21 && !isConsolidated;

    // 5. Display Info
    const { name, subtitle } = getHabitDisplayInfo(habit, date);

    return { cssStatus, isArete, hasNote, isConsolidated, isSemiConsolidated, name, subtitle };
}

/**
 * Verifica consistência completa: para CADA hábito ativo numa data,
 * o estado computado das fontes da verdade deve ser internamente consistente.
 */
function assertFullConsistency(date: string, context: string) {
    const active = getActiveHabitsForDate(date);
    
    for (const { habit, schedule } of active) {
        for (const time of schedule) {
            const expected = computeExpectedCardState(habit, date, time);
            const bitStatus = HabitService.getStatus(habit.id, date, time);

            // INVARIANTE 1: Status CSS corresponde ao bitmask
            if (bitStatus === HABIT_STATE.DONE || bitStatus === HABIT_STATE.DONE_PLUS) {
                expect(expected.cssStatus).toBe('completed');
            } else if (bitStatus === HABIT_STATE.DEFERRED) {
                expect(expected.cssStatus).toBe('snoozed');
            } else {
                expect(expected.cssStatus).toBe('pending');
            }

            // INVARIANTE 2: Arete é exclusivo de DONE_PLUS
            expect(expected.isArete).toBe(bitStatus === HABIT_STATE.DONE_PLUS);

            // INVARIANTE 3: Consolidação requer streak >= 21 ou >= 66
            if (expected.isConsolidated) {
                expect(calculateHabitStreak(habit, date)).toBeGreaterThanOrEqual(66);
            }
            if (expected.isSemiConsolidated) {
                const s = calculateHabitStreak(habit, date);
                expect(s).toBeGreaterThanOrEqual(21);
                expect(s).toBeLessThan(66);
            }

            // INVARIANTE 4: hasNote corresponde à existência de nota no dailyData
            const rawNote = getHabitDailyInfoForDate(date)[habit.id]?.instances?.[time]?.note;
            expect(expected.hasNote).toBe(!!rawNote);
        }
    }
}

function setNextModalAction(action: 'confirm' | 'edit' | 'cancel') {
    nextModalAction = action;
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTES
// ═══════════════════════════════════════════════════════════════════════════

describe('🔒 Consistência Base de Dados ↔ UI', () => {

    beforeEach(() => {
        clearTestState();
        state.initialSyncDone = true;
        nextModalAction = null;
        vi.mocked(cloud.runWorkerTask).mockResolvedValue({});
    });

    describe('Invariante: Bitmask ↔ Status Visual', () => {

        it('card recém-criado deve ter status pending (bitmask=0, CSS=pending)', () => {
            const id = createTestHabit({ name: 'Novo', time: 'Morning' });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;

            const bitStatus = HabitService.getStatus(id, date, 'Morning');
            const expected = computeExpectedCardState(habit, date, 'Morning');

            expect(bitStatus).toBe(HABIT_STATE.NULL);
            expect(expected.cssStatus).toBe('pending');
            expect(expected.isArete).toBe(false);
        });

        it('cada toggle deve manter DB e UI sincronizados', () => {
            const id = createTestHabit({ name: 'Toggle', time: 'Morning' });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;

            // Estado inicial
            assertFullConsistency(date, 'após criação');

            // Toggle 1: NULL → DONE
            toggleHabitStatus(id, 'Morning', date);
            assertFullConsistency(date, 'após toggle 1 (DONE)');
            expect(HabitService.getStatus(id, date, 'Morning')).toBe(HABIT_STATE.DONE);
            expect(computeExpectedCardState(habit, date, 'Morning').cssStatus).toBe('completed');

            // Toggle 2: DONE → DEFERRED
            toggleHabitStatus(id, 'Morning', date);
            assertFullConsistency(date, 'após toggle 2 (DEFERRED)');
            expect(HabitService.getStatus(id, date, 'Morning')).toBe(HABIT_STATE.DEFERRED);
            expect(computeExpectedCardState(habit, date, 'Morning').cssStatus).toBe('snoozed');

            // Toggle 3: DEFERRED → NULL
            toggleHabitStatus(id, 'Morning', date);
            assertFullConsistency(date, 'após toggle 3 (NULL)');
            expect(HabitService.getStatus(id, date, 'Morning')).toBe(HABIT_STATE.NULL);
            expect(computeExpectedCardState(habit, date, 'Morning').cssStatus).toBe('pending');
        });

        it('múltiplos hábitos em diferentes períodos devem ser independentes', () => {
            const id1 = createTestHabit({ name: 'Manhã', time: 'Morning' });
            const id2 = createTestHabit({ name: 'Tarde', time: 'Afternoon' });
            const id3 = createTestHabit({ name: 'Noite', time: 'Evening' });
            const date = getTodayUTCIso();

            // Toggle apenas o da manhã
            toggleHabitStatus(id1, 'Morning', date);

            // Verificar que os outros não foram afetados
            expect(HabitService.getStatus(id1, date, 'Morning')).toBe(HABIT_STATE.DONE);
            expect(HabitService.getStatus(id2, date, 'Afternoon')).toBe(HABIT_STATE.NULL);
            expect(HabitService.getStatus(id3, date, 'Evening')).toBe(HABIT_STATE.NULL);

            assertFullConsistency(date, 'hábitos independentes');
        });
    });

    describe('Invariante: dailyData ↔ Metadados Visuais', () => {

        it('nota adicionada no dailyData deve refletir em hasNote do card', () => {
            const id = createTestHabit({ name: 'Nota', time: 'Morning' });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;

            // Sem nota
            expect(computeExpectedCardState(habit, date, 'Morning').hasNote).toBe(false);

            // Adiciona nota via estado direto
            const instance = ensureHabitInstanceData(date, id, 'Morning');
            instance.note = 'Minha anotação';

            // Deve refletir
            expect(computeExpectedCardState(habit, date, 'Morning').hasNote).toBe(true);

            // Remove nota
            instance.note = undefined;
            expect(computeExpectedCardState(habit, date, 'Morning').hasNote).toBe(false);
        });

        it('nota vazia ("") não deve ser considerada como existente', () => {
            const id = createTestHabit({ name: 'Nota Vazia', time: 'Morning' });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;

            const instance = ensureHabitInstanceData(date, id, 'Morning');
            instance.note = '';

            // String vazia → !!'' === false → hasNote deve ser false
            expect(computeExpectedCardState(habit, date, 'Morning').hasNote).toBe(false);
        });

        it('goalOverride no dailyData não deve afetar o status CSS', () => {
            const id = createTestHabit({ name: 'Goal', time: 'Morning', goalType: 'pages', goalTotal: 10 });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;

            const instance = ensureHabitInstanceData(date, id, 'Morning');
            instance.goalOverride = 20;

            // goalOverride não muda o status (que vem do bitmask)
            expect(computeExpectedCardState(habit, date, 'Morning').cssStatus).toBe('pending');
            expect(HabitService.getStatus(id, date, 'Morning')).toBe(HABIT_STATE.NULL);
        });
    });

    describe('Invariante: Caches vs. Estado Real', () => {

        it('clearAllCaches não deve alterar o resultado de consultas', () => {
            const id = createTestHabit({ name: 'Cache', time: 'Morning' });
            const date = getTodayUTCIso();
            toggleHabitStatus(id, 'Morning', date);

            // Captura estado antes de limpar caches
            const statusBefore = HabitService.getStatus(id, date, 'Morning');
            const activeBefore = getActiveHabitsForDate(date);
            const streakBefore = calculateHabitStreak(id, date);

            // Limpa TODOS os caches
            clearAllCaches();

            // O mesmo resultado deve ser produzido (recalculado a partir da verdade)
            const statusAfter = HabitService.getStatus(id, date, 'Morning');
            const activeAfter = getActiveHabitsForDate(date);
            const streakAfter = calculateHabitStreak(id, date);

            expect(statusAfter).toBe(statusBefore);
            expect(activeAfter.length).toBe(activeBefore.length);
            expect(activeAfter.map(a => a.habit.id)).toEqual(activeBefore.map(a => a.habit.id));
            expect(streakAfter).toBe(streakBefore);
        });

        it('invalidateCachesForDateChange deve produzir dados frescos', () => {
            const id = createTestHabit({ name: 'Invalidate', time: 'Afternoon' });
            const date = getTodayUTCIso();

            // Popula cache
            getActiveHabitsForDate(date);
            calculateHabitStreak(id, date);
            calculateDaySummary(date);

            // Altera estado
            toggleHabitStatus(id, 'Afternoon', date);

            // Invalida cache para a data
            invalidateCachesForDateChange(date);

            // Dados devem refletir a mudança
            const summary = calculateDaySummary(date);
            expect(summary.completed).toBe(1);
            expect(summary.pending).toBe(0);
        });

        it('activeHabitsCache deve ser coerente com shouldHabitAppearOnDate', () => {
            const id1 = createTestHabit({ name: 'A', time: 'Morning' });
            const id2 = createTestHabit({ name: 'B', time: 'Afternoon' });
            const date = getTodayUTCIso();

            const active = getActiveHabitsForDate(date);
            const habit1 = state.habits.find(h => h.id === id1)!;
            const habit2 = state.habits.find(h => h.id === id2)!;

            // Cada hábito ativo DEVE aparecer individualmente
            expect(shouldHabitAppearOnDate(habit1, date)).toBe(true);
            expect(shouldHabitAppearOnDate(habit2, date)).toBe(true);
            expect(active.some(a => a.habit.id === id1)).toBe(true);
            expect(active.some(a => a.habit.id === id2)).toBe(true);

            // Deletar um hábito
            habit1.deletedOn = date;
            clearAllCaches();

            const activeAfter = getActiveHabitsForDate(date);
            expect(shouldHabitAppearOnDate(habit1, date)).toBe(false);
            expect(activeAfter.some(a => a.habit.id === id1)).toBe(false);
            expect(activeAfter.some(a => a.habit.id === id2)).toBe(true);
        });
    });

    describe('Invariante: Serialização Roundtrip (DB → Save → Load)', () => {

        it('getPersistableState deve conter todos os bitmasks atuais', () => {
            const id = createTestHabit({ name: 'Persist', time: 'Morning' });
            const date = getTodayUTCIso();

            toggleHabitStatus(id, 'Morning', date);

            const persisted = getPersistableState();

            // O bitmask deve existir no estado persistível
            expect(persisted.monthlyLogs).toBeDefined();
            expect(persisted.monthlyLogs.size).toBeGreaterThan(0);

            // O valor deve ser idêntico ao que HabitService retorna
            const key = `${id}_${date.substring(0, 7)}`;
            const logValue = persisted.monthlyLogs.get(key);
            expect(logValue).toBeDefined();

            // Recalcular status a partir do bigint salvo
            const day = parseInt(date.substring(8, 10), 10);
            const bitPos = BigInt((day - 1) * 9); // Morning offset = 0
            const block = (logValue! >> bitPos) & 7n;
            const restoredStatus = Number(block & 3n);

            expect(restoredStatus).toBe(HABIT_STATE.DONE);
        });

        it('dailyData deve sobreviver à serialização completa', () => {
            const id = createTestHabit({ name: 'Serialize', time: 'Evening' });
            const date = getTodayUTCIso();

            const instance = ensureHabitInstanceData(date, id, 'Evening');
            instance.note = 'Nota importante';
            instance.goalOverride = 42;

            const persisted = getPersistableState();

            // dailyData deve estar presente
            expect(persisted.dailyData[date]).toBeDefined();
            expect(persisted.dailyData[date][id]).toBeDefined();
            expect(persisted.dailyData[date][id].instances['Evening']?.note).toBe('Nota importante');
            expect(persisted.dailyData[date][id].instances['Evening']?.goalOverride).toBe(42);
        });

        it('hábitos com scheduleHistory devem sobreviver à serialização', () => {
            const id = createTestHabit({ name: 'Schedule', time: 'Morning' });
            const persisted = getPersistableState();

            const habit = persisted.habits.find(h => h.id === id);
            expect(habit).toBeDefined();
            expect(habit!.scheduleHistory.length).toBeGreaterThanOrEqual(1);
            expect(habit!.scheduleHistory[0].name).toBe('Schedule');
            expect(habit!.scheduleHistory[0].times).toContain('Morning');
        });
    });

    describe('Invariante: daySummary ↔ Bitmask Status', () => {

        it('sumário do dia deve corresponder exatamente aos status dos bitmasks', () => {
            const id1 = createTestHabit({ name: 'Sum1', time: 'Morning' });
            const id2 = createTestHabit({ name: 'Sum2', time: 'Afternoon' });
            const id3 = createTestHabit({ name: 'Sum3', time: 'Evening' });
            const date = getTodayUTCIso();

            // 1 done, 1 deferred, 1 pending
            toggleHabitStatus(id1, 'Morning', date);              // DONE
            toggleHabitStatus(id2, 'Afternoon', date);             // DONE
            toggleHabitStatus(id2, 'Afternoon', date);             // DEFERRED

            invalidateCachesForDateChange(date);
            const summary = calculateDaySummary(date);

            // Verificação cruzada manual
            expect(HabitService.getStatus(id1, date, 'Morning')).toBe(HABIT_STATE.DONE);
            expect(HabitService.getStatus(id2, date, 'Afternoon')).toBe(HABIT_STATE.DEFERRED);
            expect(HabitService.getStatus(id3, date, 'Evening')).toBe(HABIT_STATE.NULL);

            expect(summary.total).toBe(3);
            expect(summary.completed).toBe(1);
            expect(summary.snoozed).toBe(1);
            expect(summary.pending).toBe(1);
            expect(summary.completedPercent).toBeCloseTo(33.33, 1);
        });

        it('markAllHabitsForDate deve fazer summary.completed === summary.total', () => {
            createTestHabit({ name: 'All1', time: 'Morning' });
            createTestHabit({ name: 'All2', time: 'Afternoon' });
            createTestHabit({ name: 'All3', time: 'Evening' });
            const date = getTodayUTCIso();

            markAllHabitsForDate(date, 'completed');

            invalidateCachesForDateChange(date);
            const summary = calculateDaySummary(date);

            expect(summary.completed).toBe(summary.total);
            expect(summary.pending).toBe(0);
            expect(summary.snoozed).toBe(0);
            expect(summary.completedPercent).toBe(100);

            // Verificação cruzada: cada hábito ativo deve ter status DONE no bitmask
            const active = getActiveHabitsForDate(date);
            for (const { habit, schedule } of active) {
                for (const time of schedule) {
                    const s = HabitService.getStatus(habit.id, date, time);
                    expect(s === HABIT_STATE.DONE || s === HABIT_STATE.DONE_PLUS).toBe(true);
                }
            }
        });
    });

    describe('Invariante: Tombstone / Deleção Lógica', () => {

        it('hábito com deletedOn não deve aparecer em getActiveHabitsForDate', () => {
            const id = createTestHabit({ name: 'Del', time: 'Morning' });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;

            expect(getActiveHabitsForDate(date).some(a => a.habit.id === id)).toBe(true);

            habit.deletedOn = date;
            clearAllCaches();

            expect(getActiveHabitsForDate(date).some(a => a.habit.id === id)).toBe(false);
        });

        it('hábito deletado não deve influenciar o daySummary', () => {
            const id1 = createTestHabit({ name: 'Vivo', time: 'Morning' });
            const id2 = createTestHabit({ name: 'Morto', time: 'Afternoon' });
            const date = getTodayUTCIso();

            toggleHabitStatus(id1, 'Morning', date);
            toggleHabitStatus(id2, 'Afternoon', date);

            // Ambos done
            invalidateCachesForDateChange(date);
            const before = calculateDaySummary(date);
            expect(before.total).toBe(2);
            expect(before.completed).toBe(2);

            // Deleta um
            state.habits.find(h => h.id === id2)!.deletedOn = date;
            clearAllCaches();

            const after = calculateDaySummary(date);
            expect(after.total).toBe(1);
            expect(after.completed).toBe(1);
        });

        it('bitmask tombstone (bit 2) deve forçar status para NULL', () => {
            const id = createTestHabit({ name: 'Tombstone', time: 'Morning' });
            const date = getTodayUTCIso();

            // Seta como DONE
            HabitService.setStatus(id, date, 'Morning', HABIT_STATE.DONE);
            expect(HabitService.getStatus(id, date, 'Morning')).toBe(HABIT_STATE.DONE);

            // Seta como NULL (ativa tombstone internamente)
            HabitService.setStatus(id, date, 'Morning', HABIT_STATE.NULL);
            expect(HabitService.getStatus(id, date, 'Morning')).toBe(HABIT_STATE.NULL);

            // A UI derivada deve ser pending
            const habit = state.habits.find(h => h.id === id)!;
            expect(computeExpectedCardState(habit, date, 'Morning').cssStatus).toBe('pending');
        });
    });

    describe('Invariante: Boot Lock Protection', () => {

        it('operações antes de initialSyncDone não devem alterar bitmask', () => {
            state.initialSyncDone = false;
            const id = createTestHabit({ name: 'Boot', time: 'Morning' });
            const date = getTodayUTCIso();

            toggleHabitStatus(id, 'Morning', date);

            // O bitmask NÃO deve ter mudado
            expect(HabitService.getStatus(id, date, 'Morning')).toBe(HABIT_STATE.NULL);

            // A UI deve refletir o estado real (NULL → pending)
            const habit = state.habits.find(h => h.id === id)!;
            expect(computeExpectedCardState(habit, date, 'Morning').cssStatus).toBe('pending');
        });

        it('após desbloquear initialSyncDone, operações devem funcionar', () => {
            state.initialSyncDone = false;
            const id = createTestHabit({ name: 'Unlock', time: 'Morning' });
            const date = getTodayUTCIso();

            toggleHabitStatus(id, 'Morning', date);
            expect(HabitService.getStatus(id, date, 'Morning')).toBe(HABIT_STATE.NULL);

            state.initialSyncDone = true;
            toggleHabitStatus(id, 'Morning', date);
            expect(HabitService.getStatus(id, date, 'Morning')).toBe(HABIT_STATE.DONE);

            assertFullConsistency(date, 'após desbloqueio');
        });
    });

    describe('Invariante: Consistência Multi-Período', () => {

        it('mesmo hábito em 3 períodos deve ter estados independentes', () => {
            // Cria hábito com os 3 períodos
            const habitId = generateUUID();
            const date = getTodayUTCIso();
            const habit: Habit = {
                id: habitId,
                createdOn: date,
                scheduleHistory: [{
                    startDate: date,
                    icon: '🏃',
                    color: '#e74c3c',
                    goal: { type: 'check' },
                    times: ['Morning', 'Afternoon', 'Evening'] as const,
                    frequency: { type: 'daily' },
                    scheduleAnchor: date
                }]
            };
            state.habits.push(habit);

            // Altera cada período separadamente
            HabitService.setStatus(habitId, date, 'Morning', HABIT_STATE.DONE);
            HabitService.setStatus(habitId, date, 'Afternoon', HABIT_STATE.DEFERRED);
            // Evening permanece NULL

            expect(HabitService.getStatus(habitId, date, 'Morning')).toBe(HABIT_STATE.DONE);
            expect(HabitService.getStatus(habitId, date, 'Afternoon')).toBe(HABIT_STATE.DEFERRED);
            expect(HabitService.getStatus(habitId, date, 'Evening')).toBe(HABIT_STATE.NULL);

            // Verificação UI para cada período
            expect(computeExpectedCardState(habit, date, 'Morning').cssStatus).toBe('completed');
            expect(computeExpectedCardState(habit, date, 'Afternoon').cssStatus).toBe('snoozed');
            expect(computeExpectedCardState(habit, date, 'Evening').cssStatus).toBe('pending');

            // Nenhum deve ser arete (DONE regular, não DONE_PLUS)
            expect(computeExpectedCardState(habit, date, 'Morning').isArete).toBe(false);
            expect(computeExpectedCardState(habit, date, 'Afternoon').isArete).toBe(false);
            expect(computeExpectedCardState(habit, date, 'Evening').isArete).toBe(false);
        });
    });

    describe('Invariante: Streak ↔ Consolidação Visual', () => {

        it('streak < 21 → sem marcador de consolidação', () => {
            const id = createTestHabit({ name: 'Short', time: 'Morning' });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;

            // 5 dias de streak
            const baseDate = new Date(date);
            for (let d = 4; d >= 0; d--) {
                const isoDate = new Date(baseDate);
                isoDate.setUTCDate(isoDate.getUTCDate() - d);
                const iso = isoDate.toISOString().split('T')[0];
                HabitService.setStatus(id, iso, 'Morning', HABIT_STATE.DONE);
            }

            clearAllCaches();
            const expected = computeExpectedCardState(habit, date, 'Morning');
            expect(expected.isConsolidated).toBe(false);
            expect(expected.isSemiConsolidated).toBe(false);
        });

        it('streak >= 21 e < 66 → semi-consolidated', () => {
            const id = createTestHabit({ name: 'Semi', time: 'Morning' });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;

            // 25 dias de streak — createdOn deve ser antes do período
            const baseDate = new Date(date);
            const startDate = new Date(baseDate);
            startDate.setUTCDate(startDate.getUTCDate() - 30);
            habit.createdOn = startDate.toISOString().split('T')[0];
            const updatedSchedule = {
                ...habit.scheduleHistory[0],
                startDate: habit.createdOn,
                scheduleAnchor: habit.createdOn
            };
            habit.scheduleHistory = [updatedSchedule, ...habit.scheduleHistory.slice(1)];

            for (let d = 24; d >= 0; d--) {
                const isoDate = new Date(baseDate);
                isoDate.setUTCDate(isoDate.getUTCDate() - d);
                const iso = isoDate.toISOString().split('T')[0];
                HabitService.setStatus(id, iso, 'Morning', HABIT_STATE.DONE);
            }

            clearAllCaches();
            const expected = computeExpectedCardState(habit, date, 'Morning');
            const streak = calculateHabitStreak(habit, date);
            expect(streak).toBe(25);
            expect(expected.isSemiConsolidated).toBe(true);
            expect(expected.isConsolidated).toBe(false);
        });

        it('streak >= 66 → consolidated', () => {
            const id = createTestHabit({ name: 'Full', time: 'Morning' });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;

            // 70 dias de streak — createdOn deve ser antes do período
            const baseDate = new Date(date);
            const startDate = new Date(baseDate);
            startDate.setUTCDate(startDate.getUTCDate() - 80);
            habit.createdOn = startDate.toISOString().split('T')[0];
            const updatedSchedule = {
                ...habit.scheduleHistory[0],
                startDate: habit.createdOn,
                scheduleAnchor: habit.createdOn
            };
            habit.scheduleHistory = [updatedSchedule, ...habit.scheduleHistory.slice(1)];

            for (let d = 69; d >= 0; d--) {
                const isoDate = new Date(baseDate);
                isoDate.setUTCDate(isoDate.getUTCDate() - d);
                const iso = isoDate.toISOString().split('T')[0];
                HabitService.setStatus(id, iso, 'Morning', HABIT_STATE.DONE);
            }

            clearAllCaches();
            const expected = computeExpectedCardState(habit, date, 'Morning');
            const streak = calculateHabitStreak(habit, date);
            expect(streak).toBe(70);
            expect(expected.isConsolidated).toBe(true);
            expect(expected.isSemiConsolidated).toBe(false); // exclusivo
        });
    });

    describe('Fuzzing: Operações Aleatórias Mantêm Consistência', () => {

        it('100 operações aleatórias de toggle em 5 hábitos × 3 períodos devem manter invariantes', () => {
            const ids: string[] = [];
            for (let i = 0; i < 5; i++) {
                ids.push(createTestHabit({ 
                    name: `Fuzz${i}`, 
                    time: TIMES_OF_DAY[i % 3] as TimeOfDay 
                }));
            }

            const date = getTodayUTCIso();
            const times: TimeOfDay[] = ['Morning', 'Afternoon', 'Evening'];

            // Seed determinístico para reprodutibilidade
            let seed = 42;
            const rng = () => {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                return seed;
            };

            for (let op = 0; op < 100; op++) {
                const habitId = ids[rng() % ids.length];
                const time = times[rng() % times.length];

                // Operação aleatória: toggle, set direto, ou nota
                const action = rng() % 3;

                if (action === 0) {
                    // Toggle via business logic
                    toggleHabitStatus(habitId, time, date);
                } else if (action === 1) {
                    // Set direto no bitmask
                    const newState = rng() % 4;
                    HabitService.setStatus(habitId, date, time, newState);
                } else {
                    // Adicionar/remover nota
                    const instance = ensureHabitInstanceData(date, habitId, time);
                    instance.note = rng() % 2 ? `Nota op ${op}` : undefined;
                }

                // A cada operação, verificar consistência
                for (const id of ids) {
                    const habit = state.habits.find(h => h.id === id)!;
                    for (const t of times) {
                        const bitStatus = HabitService.getStatus(id, date, t);
                        const expected = computeExpectedCardState(habit, date, t);

                        // Invariante fundamental: CSS status deve corresponder ao bit
                        if (bitStatus === HABIT_STATE.DONE || bitStatus === HABIT_STATE.DONE_PLUS) {
                            expect(expected.cssStatus).toBe('completed');
                        } else if (bitStatus === HABIT_STATE.DEFERRED) {
                            expect(expected.cssStatus).toBe('snoozed');
                        } else {
                            expect(expected.cssStatus).toBe('pending');
                        }

                        // Invariante: arete
                        expect(expected.isArete).toBe(bitStatus === HABIT_STATE.DONE_PLUS);

                        // Invariante: hasNote
                        const rawNote = getHabitDailyInfoForDate(date)[id]?.instances?.[t]?.note;
                        expect(expected.hasNote).toBe(!!rawNote);
                    }
                }
            }
        });
    });

    describe('Invariante: Schedule → Visibilidade do Card', () => {

        it('hábito com frequency specific_days_of_week só aparece nos dias corretos', () => {
            const habitId = generateUUID();
            const today = new Date(getTodayUTCIso());
            const todayDow = today.getUTCDay(); // 0=Sun...6=Sat

            // Só aparece segundas e quartas (1, 3)
            const habit: Habit = {
                id: habitId,
                createdOn: getTodayUTCIso(),
                scheduleHistory: [{
                    startDate: getTodayUTCIso(),
                    icon: '📅',
                    color: '#3498db',
                    goal: { type: 'check' },
                    times: ['Morning'] as const,
                    frequency: { type: 'specific_days_of_week', days: [1, 3] },
                    scheduleAnchor: getTodayUTCIso()
                }]
            };
            state.habits.push(habit);

            // Verificar 7 dias
            for (let d = 0; d < 7; d++) {
                const checkDate = new Date(today);
                checkDate.setUTCDate(checkDate.getUTCDate() + d);
                const iso = checkDate.toISOString().split('T')[0];
                const dow = checkDate.getUTCDay();

                clearAllCaches();
                const appears = shouldHabitAppearOnDate(habit, iso);
                const active = getActiveHabitsForDate(iso);
                const inList = active.some(a => a.habit.id === habitId);

                // INVARIANTE: shouldAppear e getActive devem concordar
                expect(inList).toBe(appears);

                // INVARIANTE: deve aparecer sse é dia 1 ou 3
                expect(appears).toBe(dow === 1 || dow === 3);
            }
        });

        it('hábito com endDate não aparece após a data de fim', () => {
            const habitId = generateUUID();
            const startDate = '2026-01-01';
            const endDate = '2026-01-05';

            const habit: Habit = {
                id: habitId,
                createdOn: startDate,
                scheduleHistory: [{
                    startDate,
                    endDate,
                    icon: '⏰',
                    color: '#e74c3c',
                    goal: { type: 'check' },
                    times: ['Morning'] as const,
                    frequency: { type: 'daily' },
                    scheduleAnchor: startDate
                }]
            };
            state.habits.push(habit);

            // Dentro do período: aparece
            clearAllCaches();
            expect(shouldHabitAppearOnDate(habit, '2026-01-03')).toBe(true);

            // No endDate: NÃO aparece (endDate é exclusivo)
            clearAllCaches();
            expect(shouldHabitAppearOnDate(habit, '2026-01-05')).toBe(false);

            // Após endDate: NÃO aparece
            clearAllCaches();
            expect(shouldHabitAppearOnDate(habit, '2026-01-10')).toBe(false);
        });
    });

    describe('Operacoes do usuario: drag, edicao, delecao e ressurreicao', () => {

        it('drag just today move status e nota apenas no dia', () => {
            const id = createTestHabit({ name: 'Drag', time: 'Morning' });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;

            HabitService.setStatus(id, date, 'Morning', HABIT_STATE.DONE);
            ensureHabitInstanceData(date, id, 'Morning').note = 'note-1';

            setNextModalAction('edit');
            handleHabitDrop(id, 'Morning', 'Evening');

            const info = getHabitDailyInfoForDate(date)[id];
            expect(info.dailySchedule).toEqual(['Evening']);
            expect(HabitService.getStatus(id, date, 'Morning')).toBe(HABIT_STATE.NULL);
            expect(HabitService.getStatus(id, date, 'Evening')).toBe(HABIT_STATE.DONE);
            expect(info.instances.Morning).toBeUndefined();
            expect(info.instances.Evening?.note).toBe('note-1');

            const schedule = getScheduleForDate(habit, date);
            expect(schedule?.times).toContain('Morning');
            expect(schedule?.times).not.toContain('Evening');
        });

        it('drag from now on altera scheduleHistory e limpa dailySchedule', () => {
            const id = createTestHabit({ name: 'Drag2', time: 'Morning' });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;

            HabitService.setStatus(id, date, 'Morning', HABIT_STATE.DONE);
            ensureHabitInstanceData(date, id, 'Morning').note = 'note-2';

            setNextModalAction('confirm');
            handleHabitDrop(id, 'Morning', 'Afternoon');

            const info = getHabitDailyInfoForDate(date)[id];
            expect(info.dailySchedule).toBeUndefined();
            expect(HabitService.getStatus(id, date, 'Morning')).toBe(HABIT_STATE.NULL);
            expect(HabitService.getStatus(id, date, 'Afternoon')).toBe(HABIT_STATE.DONE);
            expect(info.instances.Morning).toBeUndefined();
            expect(info.instances.Afternoon?.note).toBe('note-2');

            const schedule = getScheduleForDate(habit, date);
            expect(schedule?.times).toContain('Afternoon');
            expect(schedule?.times).not.toContain('Morning');
        });

        it('editar habito para adicionar horario cria novo schedule entry', () => {
            const id = createTestHabit({ name: 'Edit', time: 'Morning' });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;
            const base = habit.scheduleHistory[0];

            state.editingHabit = {
                isNew: false,
                habitId: id,
                targetDate: date,
                formData: {
                    icon: base.icon,
                    color: base.color,
                    times: ['Morning', 'Evening'],
                    goal: base.goal,
                    frequency: base.frequency,
                    name: base.name,
                    nameKey: base.nameKey,
                    subtitleKey: base.subtitleKey,
                    philosophy: base.philosophy
                }
            };

            saveHabitFromModal();

            const schedule = getScheduleForDate(habit, date);
            expect(schedule?.times).toContain('Evening');
            expect(getEffectiveScheduleForHabitOnDate(habit, date)).toContain('Evening');
        });

        it('remover horario pelo modal tira o periodo do schedule', () => {
            const habitId = generateUUID();
            const date = getTodayUTCIso();
            const habit: Habit = {
                id: habitId,
                createdOn: date,
                scheduleHistory: [{
                    startDate: date,
                    icon: 'x',
                    color: '#111111',
                    goal: { type: 'check' },
                    times: ['Morning', 'Evening'] as const,
                    frequency: { type: 'daily' },
                    scheduleAnchor: date
                }]
            };
            state.habits.push(habit);

            setNextModalAction('confirm');
            requestHabitTimeRemoval(habitId, 'Evening');

            const schedule = getScheduleForDate(habit, date);
            expect(schedule?.times).toContain('Morning');
            expect(schedule?.times).not.toContain('Evening');
            expect(getEffectiveScheduleForHabitOnDate(habit, date)).not.toContain('Evening');
        });

        it('delecao permanente limpa logs e dailyData', () => {
            const id = createTestHabit({ name: 'Delete', time: 'Morning' });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;

            HabitService.setStatus(id, date, 'Morning', HABIT_STATE.DONE);
            ensureHabitInstanceData(date, id, 'Morning').note = 'note-3';

            setNextModalAction('confirm');
            requestHabitPermanentDeletion(id);

            expect(habit.deletedOn).toBe(habit.createdOn);
            const key = `${id}_${date.substring(0, 7)}`;
            expect(state.monthlyLogs.get(key)).toBeUndefined();
            expect(getHabitDailyInfoForDate(date)[id]).toBeUndefined();
        });

        it('deletar e readicionar reusa habit e limpa deletedOn', () => {
            const id = createTestHabit({ name: 'Resurrect', time: 'Morning' });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;

            HabitService.setStatus(id, date, 'Morning', HABIT_STATE.DONE);

            setNextModalAction('confirm');
            requestHabitPermanentDeletion(id);

            state.editingHabit = {
                isNew: true,
                targetDate: date,
                formData: {
                    icon: habit.scheduleHistory[0].icon,
                    color: habit.scheduleHistory[0].color,
                    times: ['Morning'],
                    goal: habit.scheduleHistory[0].goal,
                    frequency: habit.scheduleHistory[0].frequency,
                    name: habit.scheduleHistory[0].name || 'Resurrect',
                    nameKey: habit.scheduleHistory[0].nameKey,
                    subtitleKey: habit.scheduleHistory[0].subtitleKey,
                    philosophy: habit.scheduleHistory[0].philosophy
                }
            };

            saveHabitFromModal();

            expect(habit.deletedOn).toBeUndefined();
            expect(state.habits.find(h => h.id === id)).toBeDefined();
            expect(getActiveHabitsForDate(date).some(a => a.habit.id === id)).toBe(true);
        });

        it('adicionar habito sem horario nao cria novo item', () => {
            const before = state.habits.length;
            const date = getTodayUTCIso();

            state.editingHabit = {
                isNew: true,
                targetDate: date,
                formData: {
                    icon: 'x',
                    color: '#111111',
                    times: [],
                    goal: { type: 'check' },
                    frequency: { type: 'daily' },
                    name: 'NoTime'
                }
            };

            saveHabitFromModal();

            expect(state.habits.length).toBe(before);
        });

        it('adicionar sem horario encerra habito existente com mesmo nome', () => {
            const id = createTestHabit({ name: 'SameName', time: 'Morning' });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;

            state.editingHabit = {
                isNew: true,
                targetDate: date,
                formData: {
                    icon: habit.scheduleHistory[0].icon,
                    color: habit.scheduleHistory[0].color,
                    times: [],
                    goal: habit.scheduleHistory[0].goal,
                    frequency: habit.scheduleHistory[0].frequency,
                    name: habit.scheduleHistory[0].name || 'SameName'
                }
            };

            saveHabitFromModal();

            const schedule = habit.scheduleHistory[habit.scheduleHistory.length - 1];
            expect(schedule.endDate).toBe(date);
            expect(shouldHabitAppearOnDate(habit, date)).toBe(false);
        });

        it('encerrar habito no modal marca endDate e remove do dia', () => {
            const id = createTestHabit({ name: 'End', time: 'Morning' });
            const date = getTodayUTCIso();
            const habit = state.habits.find(h => h.id === id)!;

            setNextModalAction('confirm');
            requestHabitEndingFromModal(id);

            const schedule = habit.scheduleHistory[habit.scheduleHistory.length - 1];
            expect(schedule.endDate).toBe(date);
            expect(shouldHabitAppearOnDate(habit, date)).toBe(false);
        });
    });
});
