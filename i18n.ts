/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file i18n.ts
 * @description Motor de Internacionalização (i18n) e Formatação de Texto/Data/Números.
 * 
 * [MAIN THREAD CONTEXT]:
 * Executa na thread principal. Otimizado para "Zero-Allocation" nos hot-paths.
 * 
 * ARQUITETURA (Pure Logic Layer):
 * - REFACTOR [2025-03-22]: Desacoplado de `render/` para evitar ciclos.
 * - PERF [2025-04-10]: Lookup Tables (O(1)) para TimeOfDay e Weekdays.
 * - SOPA [2025-04-13]: Hub Central de Localização (Strings, Plurais, Datas, Listas, Números, Collation).
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `state.ts`: Acesso ao idioma ativo.
 * - `locales/*.json`: Arquivos de tradução.
 */

import { state, TimeOfDay, LANGUAGES } from './state';
import { pushToOneSignal, logger } from './utils';
import { LANG_LOAD_TIMEOUT_MS } from './constants';

// INTERFACE ABSTRATA: Permite que o cache aceite tanto a classe nativa quanto o mock de fallback sem erros de tipo.
interface ListFormatter {
    format(list: Iterable<string>): string;
}

type PluralableTranslation = { one?: string; other: string; [key: string]: string | undefined };
type TranslationValue = string | PluralableTranslation;
type Translations = Record<string, TranslationValue>;

// --- CACHE DE API INTL (Performance Crítica) ---
// A criação de instâncias Intl é custosa. Mantemos caches para reutilização.
const pluralRulesCache: Record<string, Intl.PluralRules> = {};
const collatorCache: Record<string, Intl.Collator> = {};

// DUAL-LAYER CACHE STRATEGY [2025-04-13]:
// 1. WeakMap: Fast-path para objetos de opções reutilizados (Hoisted Constants). Chave = Referência do Objeto.
// 2. Map (String): Fallback para objetos literais inline. Chave = Serialização das opções.
const dateTimeWeakCache = new Map<string, WeakMap<object, Intl.DateTimeFormat>>();
const dateTimeStringCache = new Map<string, Intl.DateTimeFormat>();

// MEMORY GUARD: Limite de cache para evitar leaks em sessões longas.
const MAX_CACHE_SIZE = 100;

const listFormatCache: Record<string, ListFormatter> = {};

// NUMERIC CACHE [2025-04-14]: Cache para formatadores numéricos (Int, Decimal, Evolution).
// Evita recriar Intl.NumberFormat em loops de renderização de gráficos.
type NumberFormatBundle = { int: Intl.NumberFormat; dec: Intl.NumberFormat; evo: Intl.NumberFormat };
type NumberFormatType = keyof NumberFormatBundle;
const numberFormatCache: Record<string, NumberFormatBundle> = {};

// PERFORMANCE: Cache imutável para nomes de dias da semana por idioma.
// Permite acesso O(1) em loops de calendário.
const weekdayCache: Record<string, string[]> = {};

const loadedTranslations: Record<string, Translations> = {};

// CONCURRENCY: Map de Promises em voo para deduplicação de rede.
const inflightRequests = new Map<string, Promise<boolean>>();

// CONSTANTS: Opções estáticas.
const DAY_FORMAT_OPTS: Intl.DateTimeFormatOptions = { weekday: 'short', timeZone: 'UTC' };
// Reference week: Jan 4 1970 was Sunday. Array 0-6 corresponds to Sun-Sat.
const WEEKDAY_REF_DATES = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(1970, 0, 4 + i)));

// PERFORMANCE: Lookup Table para TimeOfDay.
const TIME_OF_DAY_KEYS: Record<TimeOfDay, string> = {
    'Morning': 'filterMorning',
    'Afternoon': 'filterAfternoon',
    'Evening': 'filterEvening'
};

// PERFORMANCE: Hot-Cache (Ponteiros diretos para uso síncrono rápido).
let currentDict: Translations | null = null;
let fallbackDict: Translations | null = null; // Granular Fallback (ex: ES -> PT)
let currentPluralRules: Intl.PluralRules | null = null;
let currentCollator: Intl.Collator | null = null;
let currentListFormat: ListFormatter | null = null;
let currentNumberFormat: NumberFormatBundle | null = null;
let currentWeekdayNames: string[] = []; // Cache array access is faster than Intl calls
let currentLangCode: string | null = null;

// CONCURRENCY: ID da última requisição.
let latestLangRequestId = 0;

// PERFORMANCE: Pre-compiled Regex.
const INTERPOLATION_REGEX = /{([^{}]+)}/g;

// NETWORK TIMEOUT: Evita Zombie State.

/**
 * Carrega o arquivo JSON de tradução.
 * Implementa padrão Promise Singleton para evitar Race Conditions de rede.
 * RELIABILITY: Adicionado AbortController para timeout.
 */
function loadLanguage(langCode: string): Promise<boolean> {
    // 1. Check Memory Cache (Sync)
    if (loadedTranslations[langCode]) {
        return Promise.resolve(true);
    }

    // 2. Check In-Flight Requests (Async Dedup)
    if (inflightRequests.has(langCode)) {
        return inflightRequests.get(langCode)!;
    }

    // 3. Initiate Network Request with Timeout
    const promise = (async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), LANG_LOAD_TIMEOUT_MS);

        try {
            const response = await fetch(`./locales/${langCode}.json`, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`Status: ${response.status}`);
            }
            const translations = await response.json();
            loadedTranslations[langCode] = translations;
            return true;
        } catch (error) {
            clearTimeout(timeoutId);
            logger.error(`Could not load translations for ${langCode}:`, error);
            
            // Fallback Recovery: Garante que PT (base) esteja carregado para o fallbackDict
            // SECURITY: Evita recursão infinita se 'pt' também falhar.
            if (langCode !== 'pt' && !loadedTranslations['pt']) {
                try {
                    // Tentativa única de carregar o fallback
                    logger.warn("Attempting to load fallback 'pt'");
                    await loadLanguage('pt'); 
                } catch (fallbackError) {
                    logger.error(`CRITICAL: Could not load fallback language 'pt'.`, fallbackError);
                }
            }
            return false;
        } finally {
            inflightRequests.delete(langCode);
        }
    })();

    inflightRequests.set(langCode, promise);
    return promise;
}

function triggerBackgroundLoad(langCode: string) {
    loadLanguage(langCode).then(success => {
        if (success && state.activeLanguageCode === langCode) {
            updateHotCache(langCode);
            document.dispatchEvent(new CustomEvent('language-changed'));
        }
    });
}

/**
 * INTERNAL HELPER: Atualiza os caches quentes quando o idioma muda.
 * Centraliza a lógica de sincronização.
 */
function updateHotCache(langCode: string) {
    currentLangCode = langCode;
    
    // 1. Dictionary & Fallback Strategy
    if (loadedTranslations[langCode]) {
        currentDict = loadedTranslations[langCode];
        if (langCode !== 'pt' && loadedTranslations['pt']) {
            fallbackDict = loadedTranslations['pt'];
        } else {
            fallbackDict = null;
        }
    } else {
        currentDict = loadedTranslations['pt'] || null;
        fallbackDict = null;
        triggerBackgroundLoad(langCode);
    }
    
    // 2. Plural Rules (Crash Guard)
    if (!pluralRulesCache[langCode]) {
        try {
            pluralRulesCache[langCode] = new Intl.PluralRules(langCode);
        } catch (e) {
            try {
                pluralRulesCache[langCode] = new Intl.PluralRules('pt');
            } catch (e2) {
                // Fallback final para evitar crash: Mock que retorna sempre 'other'
                pluralRulesCache[langCode] = { select: () => 'other' } as unknown as Intl.PluralRules;
            }
        }
    }
    currentPluralRules = pluralRulesCache[langCode];

    // 3. Collator (Sorting)
    if (!collatorCache[langCode]) {
        try {
            collatorCache[langCode] = new Intl.Collator(langCode, { sensitivity: 'base', numeric: true });
        } catch (e) {
            collatorCache[langCode] = new Intl.Collator('pt'); // Se falhar aqui, o browser está quebrado
        }
    }
    currentCollator = collatorCache[langCode];

    // 4. List Format (Arrays)
    if (!listFormatCache[langCode]) {
        try {
            // @fix: Cast Intl to any to support ListFormat which might be missing in TS libs
            listFormatCache[langCode] = new (Intl as any).ListFormat(langCode, { style: 'long', type: 'conjunction' });
        } catch (e) {
            // ROBUSTEZ: Fallback seguro se a API não existir (Browser antigo).
            listFormatCache[langCode] = { 
                format: (list: Iterable<string>) => Array.from(list).join(', ') 
            }; 
        }
    }
    currentListFormat = listFormatCache[langCode];

    // 5. Number Formats (Integer, Decimal & Evolution)
    if (!numberFormatCache[langCode]) {
        try {
            numberFormatCache[langCode] = {
                int: new Intl.NumberFormat(langCode, { maximumFractionDigits: 0 }),
                dec: new Intl.NumberFormat(langCode, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                evo: new Intl.NumberFormat(langCode, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
            };
        } catch (e) {
            // Fallback seguro com as mesmas opções de formatação
            const optsInt = { maximumFractionDigits: 0 };
            const optsDec = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
            const optsEvo = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
            
            // Se 'pt' também falhar, usa padrão do sistema (undefined locale)
            try {
                numberFormatCache[langCode] = { 
                    int: new Intl.NumberFormat('pt', optsInt), 
                    dec: new Intl.NumberFormat('pt', optsDec), 
                    evo: new Intl.NumberFormat('pt', optsEvo) 
                };
            } catch (e2) {
                numberFormatCache[langCode] = { 
                    int: new Intl.NumberFormat(undefined, optsInt), 
                    dec: new Intl.NumberFormat(undefined, optsDec), 
                    evo: new Intl.NumberFormat(undefined, optsEvo) 
                };
            }
        }
    }
    currentNumberFormat = numberFormatCache[langCode];

    // 6. Weekday Names (Fast Lookup Cache)
    if (!weekdayCache[langCode]) {
        try {
            const dayFormatter = new Intl.DateTimeFormat(langCode, DAY_FORMAT_OPTS);
            weekdayCache[langCode] = WEEKDAY_REF_DATES.map(date => 
                dayFormatter.format(date).toUpperCase()
            );
        } catch (e) {
            weekdayCache[langCode] = weekdayCache['pt'] || []; 
        }
    }
    currentWeekdayNames = weekdayCache[langCode];
}

/**
 * Traduz uma chave para o idioma ativo.
 * [HOT PATH]: Otimizado para zero alocação desnecessária.
 */
export function t(key: string, options?: { [key: string]: string | number | undefined }): string {
    // Sync check
    if (state.activeLanguageCode !== currentLangCode) {
        updateHotCache(state.activeLanguageCode);
    }

    if (!currentDict) return key;

    let translationValue = currentDict[key];

    // RESILIENCE: Dictionary Fallback (Granular)
    if (translationValue === undefined && fallbackDict) {
        translationValue = fallbackDict[key];
    }

    if (translationValue === undefined) {
        return key;
    }

    let translationString: string;

    if (typeof translationValue === 'string') {
        translationString = translationValue;
    } else {
        // Pluralization
        if (options?.count !== undefined) {
            // CRASH GUARD: Ensure rules exist
            const rules = currentPluralRules || pluralRulesCache['pt'] || new Intl.PluralRules('en'); 
            const pluralKey = rules.select(options.count as number);
            
            const foundString = translationValue[pluralKey] || translationValue.other;
            if (!foundString) return key;
            
            translationString = foundString;
        } else {
            return key;
        }
    }

    if (options) {
        // Fast path
        if (!translationString.includes('{')) {
            return translationString;
        }
        return translationString.replace(INTERPOLATION_REGEX, (_match, k) => {
            const value = options[k];
            return value !== undefined ? String(value) : _match;
        });
    }

    return translationString;
}

/**
 * Compara duas strings usando as regras do idioma ativo.
 * Otimizado para uso em `array.sort()`.
 */
export function compareStrings(a: string, b: string): number {
    if (state.activeLanguageCode !== currentLangCode) {
        updateHotCache(state.activeLanguageCode);
    }
    return currentCollator ? currentCollator.compare(a, b) : a.localeCompare(b);
}

/**
 * Formata uma data usando as regras do idioma ativo.
 * Implementa estratégia de cache de dupla camada (WeakMap -> StringMap) para Alocação Zero.
 */
export function formatDate(date: Date | number | null | undefined, options: Intl.DateTimeFormatOptions): string {
    if (date === null || date === undefined) return '---';

    // CRITICAL GUARD: Check for invalid date before passing to Intl.
    // Intl.DateTimeFormat throws RangeError on invalid dates, which can crash the render loop.
    // CHAOS FIX: Ensure dateObj is actually a Date instance to prevent runtime crash if 'date' is a string/object (Data Rot).
    let dateObj: Date;
    if (typeof date === 'number') {
        dateObj = new Date(date);
    } else if (date instanceof Date) {
        dateObj = date;
    } else {
        // Fallback for corrupted data types (e.g. string from JSON without parsing)
        dateObj = new Date(date as any);
    }

    if (isNaN(dateObj.getTime())) {
        return '---';
    }

    if (state.activeLanguageCode !== currentLangCode) {
        updateHotCache(state.activeLanguageCode);
    }

    // 1. WeakMap Lookup (Fast Path / Zero Allocation)
    // Funciona perfeitamente quando o chamador usa constantes hoistadas (ex: OPTS_ARIA_DATE).
    // Evita completamente a serialização de strings.
    let weakCache = dateTimeWeakCache.get(currentLangCode!);
    if (!weakCache) {
        weakCache = new WeakMap();
        dateTimeWeakCache.set(currentLangCode!, weakCache);
    }
    
    let formatter = weakCache.get(options);
    if (formatter) return formatter.format(dateObj);

    // 2. String Key Generation (Slow Path / Fallback)
    // Necessário para objetos literais criados inline (ex: { month: 'short' }).
    // Ainda assim, cacheia o resultado no StringMap para reutilização futura do mesmo formato estrutural.
    const keys = Object.keys(options).sort();
    let optionsKey = '';
    for (const key of keys) {
        optionsKey += `${key}:${options[key as keyof Intl.DateTimeFormatOptions]};`;
    }
    const stringKey = `${currentLangCode}|${optionsKey}`;

    // 3. String Cache Lookup
    formatter = dateTimeStringCache.get(stringKey);
    if (!formatter) {
        // MEMORY LEAK GUARD: Limpa o cache se crescer demais (ex: widgets dinâmicos infinitos).
        if (dateTimeStringCache.size > MAX_CACHE_SIZE) {
            dateTimeStringCache.clear();
        }
        formatter = new Intl.DateTimeFormat(currentLangCode!, options);
        dateTimeStringCache.set(stringKey, formatter);
    }

    // 4. Populate WeakMap (Optimization for future)
    // Se este objeto de opção específico for reutilizado (loop), na próxima vez pegaremos no passo 1.
    weakCache.set(options, formatter);
    
    return formatter.format(dateObj);
}

/**
 * REFACTOR [MAINTAINABILITY]: Helper interno para formatação de números.
 * Centraliza a lógica de verificação de idioma e acesso ao cache, eliminando redundância.
 */
function _formatNumber(num: number, type: NumberFormatType): string {
    if (state.activeLanguageCode !== currentLangCode) {
        updateHotCache(state.activeLanguageCode);
    }
    return currentNumberFormat![type].format(num);
}

/**
 * Formata um número inteiro usando as regras do locale ativo.
 * Ex: 1000 -> "1.000" (PT) ou "1,000" (EN).
 */
export const formatInteger = (num: number) => _formatNumber(num, 'int');

/**
 * Formata um número decimal (fixo em 2 casas) usando as regras do locale ativo.
 * Ex: 10.5 -> "10,50" (PT) ou "10.50" (EN).
 */
export const formatDecimal = (num: number) => _formatNumber(num, 'dec');

/**
 * Formata um número de evolução/porcentagem (fixo em 1 casa) usando as regras do locale ativo.
 * Ex: 12.5 -> "12,5" (PT) ou "12.5" (EN).
 */
export const formatEvolution = (num: number) => _formatNumber(num, 'evo');

/**
 * Formata uma lista de strings (ex: "A, B e C") usando as regras do idioma ativo.
 */
export function formatList(list: string[]): string {
    if (list.length === 0) return '';
    if (state.activeLanguageCode !== currentLangCode) {
        updateHotCache(state.activeLanguageCode);
    }
    return currentListFormat ? currentListFormat.format(list) : list.join(', ');
}

/**
 * Gets localized time of day name using optimized lookup table.
 */
export function getTimeOfDayName(time: TimeOfDay): string {
    // PERFORMANCE: Static object lookup instead of string concatenation.
    return t(TIME_OF_DAY_KEYS[time] || `filter${time}`);
}

/**
 * Gets localized day name (e.g. "SEG") from cached array.
 * PERFORMANCE: Array access O(1) instead of Date/Intl instantiation.
 */
export function getLocaleDayName(date: Date): string {
    if (state.activeLanguageCode !== currentLangCode) {
        updateHotCache(state.activeLanguageCode);
    }
    // getUTCDay() returns 0 for Sunday, matches array index
    return currentWeekdayNames[date.getUTCDay()] || '';
}

/**
 * Obtém o nome localizado do idioma ativo para ser usado nos prompts da IA.
 */
export function getAiLanguageName(): string {
    if (state.activeLanguageCode !== currentLangCode) {
        updateHotCache(state.activeLanguageCode);
    }
    return t(LANGUAGES.find(l => l.code === state.activeLanguageCode)?.nameKey || 'langEnglish');
}

export async function setLanguage(langCode: 'pt' | 'en' | 'es') {
    // Redundancy Guard
    if (state.activeLanguageCode === langCode && loadedTranslations[langCode]) {
        return;
    }

    const requestId = ++latestLangRequestId;
    const success = await loadLanguage(langCode);
    
    if (requestId !== latestLangRequestId) {
        return;
    }

    if (success) {
        state.activeLanguageCode = langCode;
        updateHotCache(langCode);

        // Side Effects
        document.documentElement.lang = langCode;
        localStorage.setItem('habitTrackerLanguage', langCode);
        
        pushToOneSignal((OneSignal: OneSignalLike) => {
            OneSignal.User.setLanguage(langCode);
        });

        // Dirty Checking flags
        state.uiDirtyState.calendarVisuals = true;
        state.uiDirtyState.habitListStructure = true;
        state.uiDirtyState.chartData = true;

        document.dispatchEvent(new CustomEvent('language-changed'));
    } else {
        logger.warn(`setLanguage aborted: Failed to load ${langCode}`);
    }
}