
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file services/analytics.ts
 * @description Wrapper for Vercel Analytics.
 * 
 * [ISOLATION LAYER]:
 * This file exists to wrap the bare module import "@vercel/analytics".
 * Importing this file via a relative path (e.g. import('./services/analytics')) ensures 
 * that bundlers (like esbuild) correctly resolve and bundle the dependency chunks, 
 * avoiding runtime errors with bare specifiers in the browser during development.
 */

import { inject } from '@vercel/analytics';
import { logger } from '../utils';

export function initAnalytics() {
    try {
        inject();
    } catch (e) {
        logger.warn('Analytics injection failed:', e);
    }
}
