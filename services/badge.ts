
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file services/badge.ts
 * @description Controlador de Integração com o Sistema Operacional (App Badging API).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo roda na thread principal, mas utiliza APIs assíncronas do navegador
 * para não bloquear a renderização.
 * 
 * ARQUITETURA (Progressive Enhancement):
 * - **Responsabilidade Única:** Sincronizar o contador de pendências do estado interno
 *   com o ícone do aplicativo no OS (Homescreen/Dock).
 * - **Falha Silenciosa:** Como é uma funcionalidade decorativa ("Delighter"), falhas não
 *   devem interromper o fluxo do usuário.
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `services/selectors.ts`: Lógica de cálculo de pendências.
 */

import { calculateDaySummary } from './selectors';
import { getTodayUTCIso, logger } from '../utils';

// [2025-01-15] TYPE SAFETY: Definição de interface local para a Badging API.
// Evita o uso repetido de 'as any' e fornece autocompletar/verificação se o TS for atualizado.
// Esta API ainda é considerada experimental em alguns contextos.
interface NavigatorWithBadging extends Navigator {
    setAppBadge(contents?: number): Promise<void>;
    clearAppBadge(): Promise<void>;
}

/**
 * Atualiza o emblema do ícone do aplicativo com o número atual de hábitos pendentes para hoje.
 * Se a contagem for zero, o emblema é limpo.
 * Esta função verifica o suporte do navegador antes de tentar definir o emblema.
 */
export async function updateAppBadge(): Promise<void> {
    // PROGRESSIVE ENHANCEMENT: Verifica suporte antes de executar.
    // Evita erros em navegadores que não suportam PWA Badging (ex: Firefox Desktop antigo).
    if ('setAppBadge' in navigator && 'clearAppBadge' in navigator) {
        try {
            // REFACTOR [2025-03-05]: Remove a função local redundante e usa a função
            // centralizada e cacheada 'calculateDaySummary' para obter a contagem de pendentes.
            // PERFORMANCE: calculateDaySummary usa cache interno (memoization), então o custo é O(1) na maioria das chamadas.
            const { pending: count } = calculateDaySummary(getTodayUTCIso());
            const nav = navigator as NavigatorWithBadging;

            if (count > 0) {
                await nav.setAppBadge(count);
            } else {
                await nav.clearAppBadge();
            }
        } catch (error) {
            // ROBUSTEZ: Falha silenciosa ou log discreto é aceitável para funcionalidades de UI progressivas.
            // Não queremos alertar o usuário se o OS rejeitar o badge (ex: permissões).
            logger.error('Failed to set app badge:', error);
        }
    }
}
