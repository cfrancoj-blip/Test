
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file data/icons.ts
 * @description Repositório de Strings SVG Estáticas (Vectores Otimizados - SOTA).
 * 
 * [ISOMORPHIC CONTEXT]:
 * Este arquivo contém APENAS dados primitivos (strings).
 * 
 * ARQUITETURA (Deep Vectorization & Nano-Optimization):
 * - **Static Concatenation:** Uso de Template Literals para zero overhead de função na inicialização.
 * - **Geometry Reuse:** Constantes `D_...` para paths compartilhados.
 */

// --- BOILERPLATE CONSTANTS ---
const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
const PATH_OPEN = '<path d="';
const SVG_CLOSE = '"/></svg>';
const makeIcon = (d: string) => `${SVG_OPEN}${PATH_OPEN}${d}${SVG_CLOSE}`;
const makeFilledIcon = (d: string, fill = 'currentColor') => `${SVG_OPEN}<path fill="${fill}" d="${d}"/></svg>`;

// --- SHARED GEOMETRIES (Raw Path Data - Nano Optimized) ---

// Caneta/Lápis
const D_PEN = 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7m.5-8.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z';
// Página com dobra
const D_PAGE = 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zv6h6';
// Lixeira
const D_TRASH = 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2';
// Círculo Outline
const D_CIRCLE_OUTLINE = 'M12 2a10 10 0 100 20 10 10 0 000-20';
// Sol
const D_SUN = 'M12 7a5 5 0 100 10 5 5 0 000-10m0-6v2m0 18v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M1 12h2m18 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4';
// Lua
const D_MOON = 'M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z';
// Gota
const D_DROP = 'M12 22a7 7 0 007-7c0-2.3-1.3-4.9-3.4-7.4C13.8 5.1 12 2.8 12 2.8s-1.8 2.3-3.6 4.8C6.3 10.1 5 12.7 5 15a7 7 0 007 7z';

export const HABIT_ICONS = {
    read: makeIcon('M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z'),
    meditate: makeIcon('M8.2 16.2c-1.3-1.3-2.2-3-2.2-4.9C6 9.4 7.1 7.8 8.8 6.8M15.8 16.2c1.3-1.3 2.2-3 2.2-4.9 0-1.9-1.1-3.5-2.8-4.5M12 13a3 3 0 100-6 3 3 0 000 6zM12 21a9 9 0 009-9M3 12a9 9 0 019-9'),
    water: makeIcon(D_DROP),
    exercise: makeIcon('M22 12h-4l-3 9L9 3l-3 9H2'),
    stretch: makeIcon('M12 4a1 1 0 100 2 1 1 0 000-2M9 20l3-6 3 6M6 12l6-2 6 2'),
    journal: makeIcon(D_PAGE + 'M16 13H8M16 17H8'),
    language: makeIcon('M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'),
    organize: makeIcon('M21 16V8a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.3 7 12 12 20.7 7M12 22.1V12'),
    walk: makeIcon('M14.9 14.3c.3-.5.3-1.1 0-1.6l-4-6c-.6-1-1.8-1.2-2.8-.6-.9.6-1.2 1.8-.6 2.8l4 6c.6 1 1.8 1.2 2.8.6.2-.1.3-.3.4-.4zM12 12l-2-2M10.1 18.7c.3-.5.3-1.1 0-1.6l-4-6c-.6-1-1.8-1.2-2.8-.6-.9.6-1.2 1.8-.6 2.8l4 6c.6 1 1.8 1.2 2.8.6.2-.1.3-.3.4-.4zz'),
    planDay: makeIcon('M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20m-3.54 3.54L12 12l3.54-3.54M12 12l-3.54 3.54L12 12z'),
    creativeHobby: makeIcon('M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z'),
    gratitude: makeIcon('M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1.1L12 21.2l7.8-7.8 1.1-1.1a5.5 5.5 0 000-7.8z'),
    talkFriend: makeIcon('M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z'),
    instrument: makeIcon('M9 18V5l12-2v13M6 21a3 3 0 100-6 3 3 0 000 6M18 19a3 3 0 100-6 3 3 0 000 6'),
    plants: makeIcon('M7 20h10M12 4v16M10 4c-2.5 1.5-4 4-4 7M14 4c2.5 1.5 4 4 4 7'),
    finances: makeIcon('M18 20V10M12 20V4M6 20V14'),
    tea: makeIcon('M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zm4-6v2m4-2v2m4-2v2m4-2v2m4-2v2'),
    podcast: makeIcon('M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8'),
    emails: makeIcon('M22 12h-6l-2 3h-4l-2-3H2M5.5 5.1L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.5-6.9A2 2 0 0016.8 4H7.2a2 2 0 00-1.8 1.1z'),
    skincare: makeIcon('M17.66 7.34C16.5 5.88 14.37 5 12 5s-4.5.88-5.66 2.34A8 8 0 004 12c0 4.42 3.58 8 8 8s8-3.58 8-8a8 8 0 00-2.34-4.66z'),
    sunlight: makeIcon(D_SUN),
    draw: makeIcon('M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.6 7.6M11 13a2 2 0 100-4 2 2 0 000 4'),
    familyTime: makeIcon('M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8'),
    news: makeIcon('M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2Zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2M18 14h-8M15 18h-5M10 6h8v4h-8V6Z'),
    cookHealthy: makeIcon('M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3'),
    learnSkill: makeIcon('M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.8-3.8a6 6 0 01-7.9 7.9l-6.9 6.9a2.1 2.1 0 01-3-3l6.9-6.9a6 6 0 017.9-7.9l-3.8 3.8z'),
    photography: makeIcon('M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8'),
    yoga: makeIcon('M12 6a2 2 0 100-4 2 2 0 000 4M15 22v-4a2 2 0 00-2-2h-2a2 2 0 00-2 2v4M9 13l-2-2M15 13l2-2'),
    reflectDay: makeIcon(D_MOON),
    custom: makeIcon('M12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2z'),
    stoicism: makeIcon('M4 22h16M7 21V10M17 21V10M12 21V10M4 10h16M4 7h16M4 4h16'),
    wind: makeIcon('M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2'),
    sustenance: makeIcon(D_DROP),
    snowflake: makeIcon('M2 12h20M12 2v20M20 20L4 4m16 0L4 20M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41M12 2.2V4.5M12 19.5v2.3M2.2 12h2.3M19.5 12h2.3'),
    dignity: makeIcon('M12 2L2 7l10 15 10-15L12 2z'),
    sunMoon: makeIcon('M20 15.31L23.31 12 20 8.69V4h-4.69L12 0.69 8.69 4H4v4.69L0.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z M12 6v12c3.31 0 6-2.69 6-6s-2.69-6-6-6z'),
    presence: makeIcon('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z'),
    abstention: makeIcon('M7 11v-1a5 5 0 1110 0v1h2v11H5V11h2zm2 0h6v-1a3 3 0 10-6 0v1z'),
    movement: makeIcon('M13 6v12l8.5-6L13 6z M4 6v12l8.5-6L4 6z'),
    discernment: makeIcon('M12 21v-6M12 15l-6-6M12 15l6-6M6 9l-3-3M6 9l3-3M18 9l-3-3M18 9l3-3'),
    zeal: makeIcon('M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2c2 3.33 2 14.67 0 18-2-3.33-2-14.67 0-18z'),
    anticipation: makeIcon('M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z'),
} as const;

export const UI_ICONS = {
    settings: makeIcon('M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'),
    ai: makeIcon('M12 8V4H8M6 8h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2M2 14h2M20 14h2M15 13v2M9 13v2'),
    check: makeIcon('M20 6L9 17l-5-5'),
    snoozed: makeIcon('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2'),
    swipeDelete: makeIcon(D_TRASH),
    swipeNote: makeIcon(D_PAGE),
    swipeNoteHasNote: makeFilledIcon(D_PAGE),
    editAction: makeIcon(D_PEN),
    graduateAction: makeIcon('M22 10v6M2 10l10-5 10 5-10 5zM6 12v5c3 3 9 3 12 0v-5'),
    endAction: makeIcon(D_CIRCLE_OUTLINE + 'M15 9l-6 6M9 9l6 6'),
    deletePermanentAction: makeIcon(D_TRASH),
    edit: makeIcon(D_PEN),
    colorPicker: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path fill="#e74c3c" d="M12 12 L12 2 A10 10 0 0 1 22 12 Z"/><path fill="#f1c40f" d="M12 12 L2 12 A10 10 0 0 1 12 2 Z"/><path fill="#2ecc71" d="M12 12 L12 22 A10 10 0 0 1 2 12 Z"/><path fill="#3498db" d="M12 12 L22 12 A10 10 0 0 1 12 22 Z"/></svg>',
    morning: makeIcon('M12 9V7M4.2 10.2l1.4 1.4M19.8 10.2l-1.4 1.4M1 18h2m18 0h2M17 18a5 5 0 00-10 0M2 22h20'),
    afternoon: makeIcon(D_SUN),
    evening: makeIcon(D_MOON),
    calendar: makeIcon('M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18'),
    backArrow: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
} as const;

export type HabitIconKey = keyof typeof HABIT_ICONS;
export type UiIconKey = keyof typeof UI_ICONS;
