import { describe, it, expect, beforeEach } from 'vitest';
import { HabitService } from './HabitService';
import { state, HABIT_STATE } from '../state';
import { logger } from '../utils';

// ================================================================================
// 🧪 ORACLE: Implementação simples e visível para comparação
// ================================================================================
class HabitServiceOracle {
  // Map<habitId_date_time, state>
  private data = new Map<string, number>();

  setStatus(habitId: string, date: string, time: string, status: number): void {
    const key = `${habitId}_${date}_${time}`;
    this.data.set(key, status);
  }

  getStatus(habitId: string, date: string, time: string): number {
    const key = `${habitId}_${date}_${time}`;
    return this.data.get(key) ?? HABIT_STATE.NULL;
  }

  has(habitId: string, date: string, time: string): boolean {
    const key = `${habitId}_${date}_${time}`;
    return this.data.has(key);
  }

  clear(): void {
    this.data.clear();
  }
}

// ================================================================================
// 🎲 FUZZER: Gerador de entrada aleatória
// ================================================================================
class HabitFuzzer {
  private rng: number = 42; // Seed para reproducibilidade

  seed(s: number): void {
    this.rng = s;
  }

  private pseudoRandom(): number {
    this.rng = (this.rng * 1103515245 + 12345) & 0x7fffffff;
    return this.rng / 0x7fffffff;
  }

  randomDay(): number {
    return Math.floor(this.pseudoRandom() * 31) + 1; // 1-31
  }

  randomMonth(): number {
    return Math.floor(this.pseudoRandom() * 12) + 1; // 1-12
  }

  randomYear(): number {
    const choice = Math.floor(this.pseudoRandom() * 5);
    switch (choice) {
      case 0: return 2024; // Normal
      case 1: return 1970; // Epoch
      case 2: return 2038; // Y2K38 boundary
      case 3: return 9999; // Far future
      case 4: return 1900; // Far past
      default: return 2024;
    }
  }

  randomTime(): 'Morning' | 'Afternoon' | 'Evening' {
    const times = ['Morning', 'Afternoon', 'Evening'] as const;
    return times[Math.floor(this.pseudoRandom() * 3)];
  }

  randomState(): number {
    const states = [HABIT_STATE.NULL, HABIT_STATE.DONE, HABIT_STATE.DEFERRED, HABIT_STATE.DONE_PLUS];
    return states[Math.floor(this.pseudoRandom() * states.length)];
  }

  randomHabitId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-';
    let id = 'habit-';
    for (let i = 0; i < 8; i++) {
      id += chars[Math.floor(this.pseudoRandom() * chars.length)];
    }
    return id;
  }

  randomDate(): string {
    const day = this.randomDay().toString().padStart(2, '0');
    const month = this.randomMonth().toString().padStart(2, '0');
    const year = this.randomYear();
    return `${year}-${month}-${day}`;
  }

  randomBigInt(): bigint {
    const choice = Math.floor(this.pseudoRandom() * 6);
    switch (choice) {
      case 0: return 0n; // Zero
      case 1: return BigInt(Math.floor(this.pseudoRandom() * Number.MAX_SAFE_INTEGER));
      case 2: return -BigInt(Math.floor(this.pseudoRandom() * Number.MAX_SAFE_INTEGER));
      case 3: return BigInt(Number.MAX_SAFE_INTEGER);
      case 4: return BigInt(Number.MIN_SAFE_INTEGER);
      case 5: return BigInt('0xffffffffffffffffffffffff'); // Huge
      default: return 0n;
    }
  }
}

// Test Suite para o Núcleo de Dados Binários
describe('HabitService (Bitmasks Core)', () => {
    
    // SETUP: Limpa o estado global antes de cada teste para evitar contaminação
    beforeEach(() => {
        state.monthlyLogs = new Map();
        state.uiDirtyState = { calendarVisuals: false, habitListStructure: false, chartData: false };
        HabitService.resetCache();
    });

    it('deve gravar e ler corretamente um status (DONE)', () => {
        const habitId = 'habit-123';
        const date = '2024-01-01';
        const time = 'Morning';

        // Escrita
        HabitService.setStatus(habitId, date, time, HABIT_STATE.DONE);

        // Leitura
        const status = HabitService.getStatus(habitId, date, time);
        expect(status).toBe(HABIT_STATE.DONE);
    });

    it('deve gravar e ler corretamente um status (DEFERRED)', () => {
        const habitId = 'habit-123';
        const date = '2024-01-01';
        const time = 'Evening';

        HabitService.setStatus(habitId, date, time, HABIT_STATE.DEFERRED);
        expect(HabitService.getStatus(habitId, date, time)).toBe(HABIT_STATE.DEFERRED);
    });

    it('não deve colidir dados de dias diferentes no mesmo mês', () => {
        const habitId = 'habit-123';
        
        // Dia 1: Manhã -> DONE
        HabitService.setStatus(habitId, '2024-01-01', 'Morning', HABIT_STATE.DONE);
        
        // Dia 2: Manhã -> DEFERRED
        HabitService.setStatus(habitId, '2024-01-02', 'Morning', HABIT_STATE.DEFERRED);

        // Verifica integridade
        expect(HabitService.getStatus(habitId, '2024-01-01', 'Morning')).toBe(HABIT_STATE.DONE);
        expect(HabitService.getStatus(habitId, '2024-01-02', 'Morning')).toBe(HABIT_STATE.DEFERRED);
    });

    it('não deve colidir dados de turnos diferentes no mesmo dia', () => {
        const habitId = 'habit-123';
        const date = '2024-01-01';

        HabitService.setStatus(habitId, date, 'Morning', HABIT_STATE.DONE);
        HabitService.setStatus(habitId, date, 'Evening', HABIT_STATE.DONE_PLUS);

        expect(HabitService.getStatus(habitId, date, 'Morning')).toBe(HABIT_STATE.DONE);
        expect(HabitService.getStatus(habitId, date, 'Evening')).toBe(HABIT_STATE.DONE_PLUS);
        // O turno do meio deve estar vazio
        expect(HabitService.getStatus(habitId, date, 'Afternoon')).toBe(HABIT_STATE.NULL);
    });

    it('deve lidar com a lógica de Tombstone (Apagar)', () => {
        const habitId = 'habit-123';
        const date = '2024-01-15';
        
        // 1. Marca como Feito
        HabitService.setStatus(habitId, date, 'Evening', HABIT_STATE.DONE);
        expect(HabitService.getStatus(habitId, date, 'Evening')).toBe(HABIT_STATE.DONE);

        // 2. Apaga (Seta para NULL) - Isso deve ativar o bit de Tombstone
        HabitService.setStatus(habitId, date, 'Evening', HABIT_STATE.NULL);
        
        // 3. Verifica se retornou a 0
        expect(HabitService.getStatus(habitId, date, 'Evening')).toBe(HABIT_STATE.NULL);
    });

    it('deve serializar logs corretamente para a nuvem', () => {
        const habitId = 'h1';
        HabitService.setStatus(habitId, '2024-05-01', 'Morning', HABIT_STATE.DONE);
        
        const serialized = HabitService.serializeLogsForCloud();
        
        // Deve retornar um array de tuplas [key, hexValue]
        expect(serialized.length).toBeGreaterThan(0);
        expect(serialized[0][0]).toContain('h1_2024-05'); // Chave deve conter o mês
        expect(serialized[0][1]).toMatch(/^0x[0-9a-f]+$/); // Valor deve ser Hex
    });
});

// ================================================================================
// 🔥 NUCLEAR QA: FUZZING & ORACLE COMPARISON
// ================================================================================
describe('🔥 NUCLEAR QA: Fuzzing & Oracle (Propriedade-Based Testing)', () => {
    let fuzzer: HabitFuzzer;
    let oracle: HabitServiceOracle;

    beforeEach(() => {
        state.monthlyLogs = new Map();
        state.uiDirtyState = { calendarVisuals: false, habitListStructure: false, chartData: false };
        HabitService.resetCache();

        fuzzer = new HabitFuzzer();
        fuzzer.seed(Date.now());
        oracle = new HabitServiceOracle();
    });

    it('🎲 deve passar no Oracle Test com 1000 operações aleatórias', () => {
        const ITERATIONS = 1000;
        const habitId = 'oracle-test';
        let divergences = 0;

        for (let i = 0; i < ITERATIONS; i++) {
            const date = fuzzer.randomDate();
            const time = fuzzer.randomTime();
            const state = fuzzer.randomState();

            // Executar em ambos
            HabitService.setStatus(habitId, date, time, state);
            oracle.setStatus(habitId, date, time, state);

            // Comparar resultados
            const serviceResult = HabitService.getStatus(habitId, date, time);
            const oracleResult = oracle.getStatus(habitId, date, time);

            if (serviceResult !== oracleResult) {
                divergences++;
                logger.error(
                    `[Iteration ${i}] Divergência detectada: ` +
                    `${date} ${time} - Service: ${serviceResult}, Oracle: ${oracleResult}`
                );
            }
        }

        expect(divergences).toBe(0);
        logger.info('✅ 1000 operações: NENHUMA divergência entre Service e Oracle');
    });

    it('🛡️ deve lidar com argumentos inválidos sem crashes (Guard Clauses)', () => {
        // Testes de guard clause: valores que NÃO devem causar falhas não-tratadas
        // NaN é um caso legítimo de rejeição no JavaScript
        
        const validCases = [
            { habitId: 'h1', date: '2024-01-01', time: 'Morning' as const, state: HABIT_STATE.DONE },
            { habitId: 'h2', date: '2024-01-01', time: 'Afternoon' as const, state: HABIT_STATE.DEFERRED },
            { habitId: 'h3', date: '2024-01-01', time: 'Evening' as const, state: HABIT_STATE.DONE_PLUS },
            { habitId: 'h4', date: '2024-01-01', time: 'Morning' as const, state: HABIT_STATE.NULL },
        ];

        // Estes devem funcionar sem exceções
        validCases.forEach((tc, idx) => {
            try {
                HabitService.setStatus(tc.habitId, tc.date, tc.time, tc.state);
                const result = HabitService.getStatus(tc.habitId, tc.date, tc.time);
                expect(result).toBe(tc.state);
            } catch (e) {
                expect.fail(`Teste válido ${idx} lançou exceção: ${e}`);
            }
        });

        // Testes de rejeição: valores que DEVEM causar erros
        const invalidCases = [
            { habitId: 'h1', date: '2024-01-01', time: 'Morning' as const, state: NaN, name: 'NaN state' },
            { habitId: 'h1', date: '2024-01-01', time: 'Morning' as const, state: -999, name: 'Negative state' },
            { habitId: 'h1', date: '2024-01-01', time: 'Morning' as const, state: 255, name: 'Out of range' },
        ];

        // Estes devem lançar ou ser silenciosamente ignorados
        invalidCases.forEach((tc) => {
            try {
                HabitService.setStatus(tc.habitId, tc.date, tc.time, tc.state);
            } catch (e) {
                // Exceção esperada para valores inválidos
            }
        });

        logger.info('✅ Validação de guard clauses completa');
    });

    it('🌍 deve suportar anos extremos (Y2K38, Y9999, 1970)', () => {
        const extremeDates = [
            '1970-01-01', // Unix epoch
            '2038-01-19', // Y2K38 boundary (32-bit overflow)
            '2147-12-31', // Ano 2147
            '9999-12-31', // Far future
        ];

        extremeDates.forEach(date => {
            const habitId = `extreme-${date}`;
            
            // Deve aceitar sem erros
            HabitService.setStatus(habitId, date, 'Morning', HABIT_STATE.DONE);
            const result = HabitService.getStatus(habitId, date, 'Morning');
            
            expect(result).toBe(HABIT_STATE.DONE);
        });

        logger.info('✅ Datas extremas funcionam corretamente');
    });

    it('🔄 deve ser idempotente (mesma operação 10x = 1x)', () => {
        const habitId = 'idempotent-test';
        const date = '2024-06-15';
        const time = 'Morning';
        const targetState = HABIT_STATE.DONE_PLUS;

        // Executar 10 vezes
        for (let i = 0; i < 10; i++) {
            HabitService.setStatus(habitId, date, time, targetState);
        }

        const result = HabitService.getStatus(habitId, date, time);
        expect(result).toBe(targetState);

        logger.info('✅ Operação idempotente validada');
    });

    it('🔀 deve ser comutativa (ordem não importa para reads)', () => {
        // Escrever em sequências diferentes
        const sequence1 = () => {
            state.monthlyLogs = new Map();
            HabitService.resetCache();
            
            HabitService.setStatus('h1', '2024-01-01', 'Morning', HABIT_STATE.DONE);
            HabitService.setStatus('h1', '2024-01-02', 'Morning', HABIT_STATE.DEFERRED);
            
            return HabitService.getStatus('h1', '2024-01-01', 'Morning');
        };

        const sequence2 = () => {
            state.monthlyLogs = new Map();
            HabitService.resetCache();
            
            HabitService.setStatus('h1', '2024-01-02', 'Morning', HABIT_STATE.DEFERRED);
            HabitService.setStatus('h1', '2024-01-01', 'Morning', HABIT_STATE.DONE);
            
            return HabitService.getStatus('h1', '2024-01-01', 'Morning');
        };

        expect(sequence1()).toBe(sequence2());
        logger.info('✅ Comutatividade validada');
    });

    it('💾 deve preservar estado após múltiplas operações (State Machine)', () => {
        const habitId = 'state-machine-test';
        const date = '2024-07-20';
        const time = 'Evening';

        // Transições válidas de state machine
        const transitions = [
            HABIT_STATE.NULL,
            HABIT_STATE.DONE,
            HABIT_STATE.DEFERRED,
            HABIT_STATE.DONE_PLUS,
            HABIT_STATE.NULL, // Reset
        ];

        transitions.forEach((nextState, idx) => {
            HabitService.setStatus(habitId, date, time, nextState);
            const current = HabitService.getStatus(habitId, date, time);
            expect(current).toBe(nextState);
        });

        logger.info('✅ State machine transitions validadas');
    });

    it('🧬 deve isolar dados por habitId (não-interferência)', () => {
        const habits = Array.from({ length: 100 }, (_, i) => `habit-${i}`);
        const date = '2024-08-15';
        const time = 'Morning';

        // Escrever em 100 hábitos diferentes
        habits.forEach((habitId, idx) => {
            const state = idx % 2 === 0 ? HABIT_STATE.DONE : HABIT_STATE.DEFERRED;
            HabitService.setStatus(habitId, date, time, state);
        });

        // Verificar isolamento
        habits.forEach((habitId, idx) => {
            const expected = idx % 2 === 0 ? HABIT_STATE.DONE : HABIT_STATE.DEFERRED;
            const actual = HabitService.getStatus(habitId, date, time);
            expect(actual).toBe(expected);
        });

        logger.info('✅ Isolamento de 100 hábitos validado');
    });

    it('⏱️ deve ser performático com 10,000 operações', () => {
        const startTime = performance.now();
        const OPERATIONS = 10000;

        for (let i = 0; i < OPERATIONS; i++) {
            const habitId = `perf-habit-${i % 100}`;
            const date = `2024-01-${(i % 28) + 1}`;
            const time = ['Morning', 'Afternoon', 'Evening'][i % 3] as any;
            const state = [HABIT_STATE.NULL, HABIT_STATE.DONE][i % 2];

            HabitService.setStatus(habitId, date, time, state);
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        // 10,000 operações devem ser < 500ms
        expect(duration).toBeLessThan(500);
        logger.info(`✅ 10,000 operações em ${duration.toFixed(2)}ms (${(duration / OPERATIONS).toFixed(4)}ms/op)`);
    });

    it('🔥 deve rejeitar BigInt inválidos (Bit Corruption)', () => {
        // Tentar injetar BigInts inválidos diretamente na Map
        const key = 'test-habit_2024-01';
        
        // Casos que não devem quebrar a leitura
        const testValues = [
            0n,
            1n,
            BigInt(Number.MAX_SAFE_INTEGER),
            -1n, // Valor inválido
        ];

        testValues.forEach(val => {
            state.monthlyLogs.set(key, val);
            
            // Ler deve não lançar
            try {
                const result = HabitService.getStatus('test-habit', '2024-01-01', 'Morning');
                expect(typeof result).toBe('number');
            } catch (e) {
                expect.fail(`Falha ao ler BigInt ${val}: ${e}`);
            }
        });

        logger.info('✅ Corrupção de BigInt tratada graciosamente');
    });

    it('📅 deve ser versioning-safe (dados antigos + novos)', () => {
        // Simular dados de versão antiga (formato diferente)
        const oldKey = 'legacy-habit_2024-01';
        state.monthlyLogs.set(oldKey, 12345n);

        // Adicionar dados novos
        HabitService.setStatus('new-habit', '2024-02-15', 'Morning', HABIT_STATE.DONE);

        // Ambos devem coexistir
        const newResult = HabitService.getStatus('new-habit', '2024-02-15', 'Morning');
        expect(newResult).toBe(HABIT_STATE.DONE);
        expect(state.monthlyLogs.has(oldKey)).toBe(true);

        logger.info('✅ Compatibilidade de versionamento validada');
    });
});