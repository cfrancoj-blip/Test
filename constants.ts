/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file constants.ts
 * @description Constantes globais de comportamento (timings/limites).
 */

export const NETWORK_DEBOUNCE_MS = 500;
export const PERMISSION_DELAY_MS = 500;
export const INTERACTION_DELAY_MS = 50;

export const CALENDAR_INITIAL_BUFFER_DAYS = 15;
export const CALENDAR_MAX_DOM_NODES = 200;

export const CALENDAR_SCROLL_THRESHOLD_PX = 350;
export const CALENDAR_BASE_BATCH_SIZE = 15;
export const CALENDAR_TURBO_BATCH_SIZE = 30;
export const CALENDAR_TURBO_TIME_WINDOW_MS = 1500;

export const QUOTE_COLLAPSE_DEBOUNCE_MS = 120;

export const BOOT_RELOAD_DELAY_MS = 500;
export const BOOT_SYNC_TIMEOUT_MS = 5000;
export const LANG_LOAD_TIMEOUT_MS = 5000;
export const SYNC_ENABLE_RETRY_MS = 500;
export const SYNC_COPY_FEEDBACK_MS = 1500;
export const SYNC_INPUT_FOCUS_MS = 100;
export const CALENDAR_LONG_PRESS_MS = 500;

export const CHART_DAYS = 30;
export const CHART_INITIAL_SCORE = 100;
export const CHART_MAX_DAILY_CHANGE_RATE = 0.025;
export const CHART_PLUS_BONUS_MULTIPLIER = 1.5;
export const CHART_SVG_HEIGHT = 75;
export const CHART_PADDING = { top: 5, right: 0, bottom: 5, left: 3 } as const;
export const CHART_MIN_VISUAL_AMPLITUDE = 2.0;
export const CHART_SAFETY_PADDING_RATIO = 0.25;
export const CHART_FALLBACK_WIDTH = 300;
export const CHART_CONTAINER_PADDING_PX = 32;
export const CHART_INTERSECTION_THRESHOLD = 0.1;
export const CHART_CURVE_TENSION = 0.25;

export const HAPTIC_PATTERNS = {
	selection: 8,
	light: 12,
	medium: 20,
	heavy: 40,
	success: [15, 50, 15],
	error: [40, 60, 15]
} as const;

export const SWIPE_INTENT_THRESHOLD = 5;
export const SWIPE_ACTION_THRESHOLD = 10;
export const SWIPE_HAPTIC_THRESHOLD = 15;
export const SWIPE_BLOCK_CLICK_MS = 150;

export const DRAG_SCROLL_ZONE_PX = 80;
export const DRAG_MAX_SCROLL_SPEED = 15;
export const DRAG_DROP_INDICATOR_GAP = 4;

export const CLOUD_SYNC_DEBOUNCE_MS = 2000;
export const CLOUD_SYNC_LOG_MAX_ENTRIES = 50;
export const CLOUD_SYNC_LOG_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const CLOUD_HASH_CACHE_MAX_ENTRIES = 2000;
export const CLOUD_WORKER_TIMEOUT_MS = 15000;

export const CACHE_HABIT_APPEARANCE_DAYS = 90;
export const CACHE_STREAKS_YEARS = 1;

export const ARCHIVE_DAYS_THRESHOLD = 90;

export const ARCHIVE_IDLE_FALLBACK_MS = 5000;

export const API_TIMEOUT_MS = 12000;
export const API_MAX_RETRIES = 2;
export const API_RETRY_DELAY_MS = 500;

export const QUOTE_WEIGHTS = {
	AI_MATCH: 50,
	SPHERE_MATCH: 40,
	RECOVERY: 35,
	PERFORMANCE: 30,
	MOMENTUM: 25,
	TIME_OF_DAY: 15,
	VIRTUE_ALIGN: 10,
	RECENTLY_SHOWN: -100
} as const;

export const QUOTE_MIN_DISPLAY_DURATION_MS = 20 * 60 * 1000;
export const QUOTE_TRIUMPH_ENTER = 0.80;
export const QUOTE_TRIUMPH_EXIT = 0.70;
export const QUOTE_STRUGGLE_ENTER = 0.25;
export const QUOTE_STRUGGLE_EXIT = 0.15;
export const QUOTE_HISTORY_LOOKBACK = 10;
export const QUOTE_HISTORY_GOOD_THRESHOLD = 0.5;
