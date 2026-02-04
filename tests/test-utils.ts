/**
 * @file test-utils.ts
 * @description Utilitários e helpers para facilitar os testes
 */

import { state, Habit, HabitSchedule, TimeOfDay, HABIT_STATE } from '../state';
import { HabitService } from '../services/HabitService';
import { generateUUID, getTodayUTCIso } from '../utils';

export interface SimpleHabitData {
  name: string;
  time: TimeOfDay;
  icon?: string;
  color?: string;
  goalType?: 'check' | 'pages' | 'minutes';
  goalTotal?: number;
  subtitle?: string;
}

/**
 * Cria um hábito de teste com estrutura simplificada
 */
export function createTestHabit(data: SimpleHabitData): string {
  const habitId = generateUUID();
  
  const schedule: HabitSchedule = {
    startDate: getTodayUTCIso(),
    icon: data.icon || '⭐',
    color: data.color || '#3498db',
    goal: {
      type: data.goalType || 'check',
      total: data.goalTotal
    },
    name: data.name,
    subtitle: data.subtitle,
    times: [data.time],
    frequency: { type: 'daily' },
    scheduleAnchor: getTodayUTCIso()
  };
  
  const habit: Habit = {
    id: habitId,
    createdOn: getTodayUTCIso(),
    scheduleHistory: [schedule]
  };
  
  state.habits.push(habit);
  return habitId;
}

/**
 * Alterna o status de um hábito (simula cliques)
 */
export function toggleTestHabitStatus(
  habitId: string, 
  date: string, 
  time: TimeOfDay
): void {
  const current = HabitService.getStatus(habitId, date, time);
  const next = (current + 1) % 4; // Cycle: NULL → DONE → DEFERRED → DONE_PLUS → NULL
  HabitService.setStatus(habitId, date, time, next);
}

/**
 * Obtém o nome de um hábito
 */
export function getHabitName(habitId: string): string | undefined {
  const habit = state.habits.find(h => h.id === habitId);
  return habit?.scheduleHistory[0]?.name;
}

/**
 * Obtém o turno de um hábito
 */
export function getHabitTime(habitId: string): TimeOfDay | undefined {
  const habit = state.habits.find(h => h.id === habitId);
  return habit?.scheduleHistory[0]?.times[0];
}

/**
 * Adiciona uma nota a um hábito em um dia específico
 */
export function addTestNote(habitId: string, date: string, time: TimeOfDay, note: string): void {
  if (!state.dailyData[date]) {
    state.dailyData[date] = {};
  }
  
  if (!state.dailyData[date][habitId]) {
    state.dailyData[date][habitId] = { 
      instances: {},
      dailySchedule: undefined
    };
  }
  
  if (!state.dailyData[date][habitId].instances[time]) {
    state.dailyData[date][habitId].instances[time] = {};
  }
  
  state.dailyData[date][habitId].instances[time]!.note = note;
}

/**
 * Obtém a nota de um hábito
 */
export function getTestNote(habitId: string, date: string, time: TimeOfDay): string | undefined {
  return state.dailyData[date]?.[habitId]?.instances[time]?.note;
}

/**
 * Deleta um hábito (marca como deletado)
 */
export function deleteTestHabit(habitId: string): void {
  const habit = state.habits.find(h => h.id === habitId);
  if (habit) {
    habit.deletedOn = getTodayUTCIso();
  }
}

/**
 * Limpa completamente o estado para testes
 */
export function clearTestState(): void {
  state.habits = [];
  state.monthlyLogs = new Map();
  state.dailyData = {};
  state.archives = {};
  state.dailyDiagnoses = {};
  state.lastModified = 0;
  state.unarchivedCache = new Map();
  state.streaksCache = new Map();
  state.habitAppearanceCache = new Map();
  state.scheduleCache = new Map();
  state.activeHabitsCache = new Map();
  state.daySummaryCache = new Map();
  state.pending21DayHabitIds = [];
  state.pendingConsolidationHabitIds = [];
  state.notificationsShown = [];
  state.hasOnboarded = false;
  state.syncLogs = [];
  state.quoteState = undefined;
  state.selectedDate = getTodayUTCIso();
  state.activeLanguageCode = 'pt';
  state.aiState = 'idle';
  state.aiReqId = 0;
  state.hasSeenAIResult = true;
  state.lastAIResult = null;
  state.lastAIError = undefined;
  state.syncState = 'syncInitial';
  state.initialSyncDone = false;
  state.fullCalendar = { year: new Date().getUTCFullYear(), month: new Date().getUTCMonth() };
  state.uiDirtyState = { calendarVisuals: true, habitListStructure: true, chartData: true };
  state.calendarDates = [];
  HabitService.resetCache();
}

/**
 * Cria um elemento DOM simples para testes de render
 */
export function createTestHabitCard(habit: Habit, date: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'habit-card';
  card.setAttribute('data-habit-id', habit.id);
  card.setAttribute('data-date', date);
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'listitem');
  
  const schedule = habit.scheduleHistory[0];
  card.setAttribute('aria-label', `${schedule.name || 'Hábito'}, status pendente`);
  
  const icon = document.createElement('span');
  icon.className = 'habit-icon';
  icon.textContent = schedule.icon;
  
  const name = document.createElement('span');
  name.className = 'habit-name';
  name.textContent = schedule.name || '';
  
  card.appendChild(icon);
  card.appendChild(name);
  
  return card;
}

/**
 * Simula múltiplos cliques em um hábito para testar ciclo de status
 */
export function clickTestHabit(habitId: string, date: string, time: TimeOfDay, times: number = 1): void {
  for (let i = 0; i < times; i++) {
    toggleTestHabitStatus(habitId, date, time);
  }
}

/**
 * Popula um período de tempo com dados de hábito
 */
export function populateTestPeriod(
  habitId: string,
  startDate: string,
  endDate: string,
  time: TimeOfDay,
  status: number = HABIT_STATE.DONE
): void {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    HabitService.setStatus(habitId, dateStr, time, status);
    current.setDate(current.getDate() + 1);
  }
}

/**
 * Verifica se um hábito existe e está ativo
 */
export function isHabitActive(habitId: string): boolean {
  const habit = state.habits.find(h => h.id === habitId);
  return !!(habit && !habit.deletedOn);
}

/**
 * Obtém todos os hábitos ativos
 */
export function getActiveTestHabits(): Habit[] {
  return state.habits.filter(h => !h.deletedOn);
}
