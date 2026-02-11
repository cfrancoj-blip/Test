

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file services/analysis.ts
 * @description Serviço isolado para análise de contexto diário via IA.
 */

import { state, getHabitDailyInfoForDate, TimeOfDay } from '../state';
import { runWorkerTask } from './cloud';
import { apiFetch } from './api';
import { t, getAiLanguageName } from '../i18n';
import { logger, MS_PER_DAY } from '../utils';
import { saveState } from './persistence';

const _analysisInFlight = new Map<string, Promise<any>>();
const MIN_AI_CONTEXT_DAYS = 7;
const AI_MIN_INTERVAL_DAYS = 7;

function _hasSufficientHistory(dateISO: string): boolean {
    let count = 0;
    for (const dayKey of Object.keys(state.dailyData)) {
        if (dayKey > dateISO) continue;
        const day = state.dailyData[dayKey];
        const hasInstances = !!day && Object.values(day).some(info => info && Object.keys(info.instances || {}).length > 0);
        if (hasInstances) {
            count++;
            if (count >= MIN_AI_CONTEXT_DAYS) return true;
        }
    }
    return false;
}

function _hasRecentAiAnalysis(): boolean {
    const now = Date.now();
    let latest = 0;
    for (const diagnosis of Object.values(state.dailyDiagnoses)) {
        if (diagnosis?.timestamp && diagnosis.timestamp > latest) {
            latest = diagnosis.timestamp;
        }
    }
    if (!latest) return false;
    return (now - latest) < (AI_MIN_INTERVAL_DAYS * MS_PER_DAY);
}

export async function checkAndAnalyzeDayContext(dateISO: string) {
    if (state.dailyDiagnoses[dateISO] || _analysisInFlight.has(dateISO)) {
        return _analysisInFlight.get(dateISO);
    }

    const task = async () => {
        try {
            let notes = ''; 
            const day = getHabitDailyInfoForDate(dateISO);
            Object.keys(day).forEach(id => Object.keys(day[id].instances).forEach(t => { 
                const n = day[id].instances[t as TimeOfDay]?.note; 
                if (n) notes += `- ${n}\n`; 
            }));
            
            if (!notes.trim() || !navigator.onLine) return;
            if (!_hasSufficientHistory(dateISO)) return;
            if (_hasRecentAiAnalysis()) return;

            const promptPayload = { 
                notes, 
                themeList: t('aiThemeList'), 
                languageName: getAiLanguageName(), 
                translations: { 
                    aiPromptQuote: t('aiPromptQuote'), 
                    aiSystemInstructionQuote: t('aiSystemInstructionQuote') 
                } 
            };
            
            const { prompt, systemInstruction } = await runWorkerTask<any>('build-quote-analysis-prompt', promptPayload);

            const res = await apiFetch('/api/analyze', { 
                method: 'POST', 
                body: JSON.stringify({ prompt, systemInstruction }) 
            });

            if (!res.ok) {
                throw new Error(`Analyze request failed (${res.status})`);
            }
            
            const rawText = await res.text();
            const jsonStr = rawText.replace(/```json|```/g, '').trim();
            const json = JSON.parse(jsonStr);
            
            if (json?.analysis) { 
                state.dailyDiagnoses[dateISO] = { 
                    level: json.analysis.determined_level, 
                    themes: json.relevant_themes, 
                    timestamp: Date.now() 
                }; 
                saveState(); 
            }
        } catch (e) { 
            logger.error("Context analysis failed", e);
            state.dailyDiagnoses[dateISO] = { level: 'error', themes: [], timestamp: Date.now() };
        } finally { 
            _analysisInFlight.delete(dateISO); 
        }
    };
    
    const p = task(); 
    _analysisInFlight.set(dateISO, p); 
    return p;
}
