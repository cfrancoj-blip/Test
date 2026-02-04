
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @file render/constants.ts
 * @description Single Source of Truth para Contratos de Interface (CSS Classes & Selectors).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este arquivo define as constantes de string usadas para manipulação de DOM e estilização.
 * 
 * ARQUITETURA (Type Safety & Performance):
 * - **Acoplamento Forte:** Estas constantes representam o "contrato" entre o TypeScript e o CSS (`index.css`).
 * - **Zero Allocations:** Ao usar constantes exportadas em vez de strings literais ('habit-card'),
 *   evitamos a alocação de novas strings na memória durante loops de renderização (Hot Paths).
 * - **Pre-computation:** Seletores complexos são pré-concatenados para evitar overhead de CPU em runtime.
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `index.css`: Alterar uma classe aqui SEM alterar no CSS quebrará o layout ou a interatividade.
 */

// DO NOT REFACTOR: Mantenha sincronizado estritamente com `index.css`.
// A mudança de nomes aqui exige refatoração global no CSS.
export const CSS_CLASSES = {
    // Habit Card Components
    HABIT_CARD: 'habit-card',
    HABIT_CONTENT_WRAPPER: 'habit-content-wrapper',
    HABIT_DETAILS: 'habit-details',
    HABIT_GOAL_CONTROLS: 'habit-goal-controls',
    GOAL_VALUE_WRAPPER: 'goal-value-wrapper',
    GOAL_CONTROL_BTN: 'goal-control-btn',
    
    // Actions
    SWIPE_DELETE_BTN: 'swipe-delete-btn',
    SWIPE_NOTE_BTN: 'swipe-note-btn',
    
    // Calendar
    DAY_ITEM: 'day-item',
    DAY_NAME: 'day-name',
    DAY_NUMBER: 'day-number',
    DAY_PROGRESS_RING: 'day-progress-ring',
    
    // Drag & Drop / Layout
    HABIT_GROUP: 'habit-group',
    DROP_ZONE: 'drop-zone', // Usualmente a mesma coisa que habit-group no contexto de drop
    EMPTY_GROUP_PLACEHOLDER: 'empty-group-placeholder',
    DRAG_IMAGE_GHOST: 'drag-image-ghost',
    
    // States
    SELECTED: 'selected',
    TODAY: 'today',
    COMPLETED: 'completed',
    SNOOZED: 'snoozed',
    PENDING: 'pending',
    DRAGGING: 'dragging',
    IS_SWIPING: 'is-swiping',
    IS_OPEN_LEFT: 'is-open-left',
    IS_OPEN_RIGHT: 'is-open-right',
    INVALID_DROP: 'invalid-drop',
    DRAG_OVER: 'drag-over'
} as const;

// PERFORMANCE: Seletores pré-calculados para uso em querySelector/closest.
// Evita a concatenação de strings repetitiva (`.` + className) dentro de loops de eventos (ex: Drag & Drop, Swipe).
// Em um loop de 60fps, concatenar strings gera lixo desnecessário para o GC.
export const DOM_SELECTORS = {
    HABIT_CARD: `.${CSS_CLASSES.HABIT_CARD}`,
    HABIT_CONTENT_WRAPPER: `.${CSS_CLASSES.HABIT_CONTENT_WRAPPER}`,
    GOAL_VALUE_WRAPPER: `.${CSS_CLASSES.GOAL_VALUE_WRAPPER}`,
    GOAL_CONTROL_BTN: `.${CSS_CLASSES.GOAL_CONTROL_BTN}`,
    SWIPE_DELETE_BTN: `.${CSS_CLASSES.SWIPE_DELETE_BTN}`,
    SWIPE_NOTE_BTN: `.${CSS_CLASSES.SWIPE_NOTE_BTN}`,
    HABIT_GOAL_CONTROLS: `.${CSS_CLASSES.HABIT_GOAL_CONTROLS}`,
    DAY_ITEM: `.${CSS_CLASSES.DAY_ITEM}`,
    DROP_ZONE: `.${CSS_CLASSES.DROP_ZONE}`,
    EMPTY_GROUP_PLACEHOLDER: `.${CSS_CLASSES.EMPTY_GROUP_PLACEHOLDER}`
} as const;

// UI constants (modals/explore)
export const MODAL_COLORS = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#9b59b6', '#1abc9c', '#34495e', '#e67e22', '#e84393', '#7f8c8d', '#26A69A', '#FFA726', '#5C6BC0', '#EC407A', '#9CCC65'] as const;
export const EXPLORE_STAGGER_DELAY_MS = 50;
