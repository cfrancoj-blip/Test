/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file render/dom.ts
 * @description Abstrações de Baixo Nível para Manipulação do DOM (DOM Utils).
 */

import { t } from '../i18n';

/**
 * OTIMIZAÇÃO DE PERFORMANCE: Helper para atualizar texto do DOM.
 */
export function setTextContent(element: Element | null, text: string) {
    if (!element) return;
    if (element.firstChild && element.firstChild.nodeType === 3 && !element.firstChild.nextSibling) {
        if (element.firstChild.nodeValue !== text) {
            element.firstChild.nodeValue = text;
        }
    } else {
        if (element.textContent !== text) {
            element.textContent = text;
        }
    }
}

/**
 * Atualiza os atributos ARIA para o componente 'Reel Rotary'.
 */
export function updateReelRotaryARIA(viewportEl: HTMLElement, currentIndex: number, options: readonly string[] | string[], labelKey: string) {
    if (!viewportEl) return;
    viewportEl.setAttribute('role', 'slider');
    viewportEl.setAttribute('aria-label', t(labelKey));
    viewportEl.setAttribute('aria-valuemin', '1');
    viewportEl.setAttribute('aria-valuemax', String(options.length));
    viewportEl.setAttribute('aria-valuenow', String(currentIndex + 1));
    viewportEl.setAttribute('aria-valuetext', options[currentIndex] || '');
    viewportEl.setAttribute('tabindex', '0');
}