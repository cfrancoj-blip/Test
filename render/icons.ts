
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file render/icons.ts
 * @description Repositório de Strings SVG Estáticas (Vectores Otimizados - SOTA).
 * 
 * [ISOMORPHIC CONTEXT]:
 * Este arquivo contém APENAS dados primitivos (strings).
 * É garantido que é seguro para importação em qualquer contexto (Main Thread, Worker, Node.js).
 * 
 * ARQUITETURA (Deep Vectorization & Nano-Optimization):
 * - **Static Resolution:** Strings são pré-concatenadas para evitar chamadas de função `mkPath` em runtime.
 * - **Single DOM Node:** Ícones renderizados como um único elemento `<path>`.
 */

import type { TimeOfDay } from '../state';
import { UI_ICONS } from '../data/icons';

// Re-exporta para manter compatibilidade com módulos de renderização
export * from '../data/icons';

// PERFORMANCE: Lookup Table O(1) em vez de switch/case.
// Em hot paths de renderização, acesso a propriedade de objeto é mais otimizável pelo V8.
const TIME_ICONS: Record<TimeOfDay, string> = {
    'Morning': UI_ICONS.morning,
    'Afternoon': UI_ICONS.afternoon,
    'Evening': UI_ICONS.evening
};

export function getTimeOfDayIcon(time: TimeOfDay): string {
    // Retorna o ícone mapeado ou 'Morning' como fallback de segurança (type-safety runtime)
    return TIME_ICONS[time] ?? UI_ICONS.morning;
}
