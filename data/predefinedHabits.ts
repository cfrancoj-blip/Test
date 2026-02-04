/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file data/predefinedHabits.ts
 * @description Catálogo estático de templates de hábitos pré-configurados.
 */

import { PredefinedHabit } from '../state';
import { HABIT_ICONS } from './icons';

// PERFORMANCE: Constantes reutilizáveis para reduzir o Heap Footprint e ruído visual.
const GOAL_CHECK = Object.freeze({ type: 'check', unitKey: 'unitCheck' }) as any;
const FREQ_DAILY = Object.freeze({ type: 'daily' }) as any;

export const PREDEFINED_HABITS: readonly PredefinedHabit[] = Object.freeze([
    // --- STOIC FOUNDATIONS ---
    {
        nameKey: 'predefinedHabitSustenanceName',
        subtitleKey: 'predefinedHabitSustenanceSubtitle',
        icon: HABIT_ICONS.sustenance,
        color: '#3498DB',
        times: ['Morning'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        isDefault: true,
        philosophy: {
            sphere: 'Biological',
            level: 1,
            virtue: 'Temperance',
            discipline: 'Desire',
            nature: 'Addition',
            conscienceKey: "habit.sustento.conscience",
            stoicConcept: "Sophrosyne / Diaita",
            masterQuoteId: "cit_musonio_rufo_nutricao_01"
        }
    },
    {
        nameKey: 'predefinedHabitInhibitionName',
        subtitleKey: 'predefinedHabitInhibitionSubtitle',
        icon: HABIT_ICONS.snowflake,
        color: '#95A5A6',
        times: ['Morning'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Biological',
            level: 1,
            virtue: 'Courage',
            discipline: 'Desire',
            nature: 'Addition',
            conscienceKey: "habit.inhibition.conscience",
            stoicConcept: "Askesis / Ponos",
            masterQuoteId: "cit_seneca_inibicao_01"
        }
    },
    {
        nameKey: 'predefinedHabitDignityName',
        subtitleKey: 'predefinedHabitDignitySubtitle',
        icon: HABIT_ICONS.dignity,
        color: '#8E44AD',
        times: ['Morning'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Biological',
            level: 1,
            virtue: 'Justice',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.dignity.conscience",
            stoicConcept: "Eustatheia / Dignitas",
            masterQuoteId: "cit_marco_compostura_01"
        }
    },
    {
        nameKey: 'predefinedHabitPresenceName',
        subtitleKey: 'predefinedHabitPresenceSubtitle',
        icon: HABIT_ICONS.presence,
        color: '#5DADE2',
        times: ['Morning'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Biological',
            level: 1,
            virtue: 'Temperance',
            discipline: 'Desire',
            nature: 'Addition',
            conscienceKey: "habit.presence.conscience",
            stoicConcept: "Prosoche / Pneuma",
            masterQuoteId: "cit_marco_presenca_01"
        }
    },
    {
        nameKey: 'predefinedHabitAbstentionName',
        subtitleKey: 'predefinedHabitAbstentionSubtitle',
        icon: HABIT_ICONS.abstention,
        color: '#BDC3C7',
        times: ['Morning'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 1,
            virtue: 'Temperance',
            discipline: 'Desire',
            nature: 'Subtraction',
            conscienceKey: "habit.abstention.conscience",
            stoicConcept: "Abstine / Sophrosyne",
            masterQuoteId: "cit_epicteto_abstine_01"
        }
    },
    {
        nameKey: 'predefinedHabitDiscernmentName',
        subtitleKey: 'predefinedHabitDiscernmentSubtitle',
        icon: HABIT_ICONS.discernment,
        color: '#f1c40f',
        times: ['Morning'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 1,
            virtue: 'Wisdom',
            discipline: 'Assent',
            nature: 'Addition',
            conscienceKey: "habit.discernment.conscience",
            stoicConcept: "Dichotomy of Control / Prohairesis",
            masterQuoteId: "cit_epicteto_controle_01"
        }
    },
    {
        nameKey: 'predefinedHabitAnticipationName',
        subtitleKey: 'predefinedHabitAnticipationSubtitle',
        icon: HABIT_ICONS.anticipation,
        color: '#922B21',
        times: ['Morning'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 1,
            virtue: 'Courage',
            discipline: 'Desire',
            nature: 'Addition',
            conscienceKey: "habit.anticipation.conscience",
            stoicConcept: "Premeditatio Malorum",
            masterQuoteId: "cit_seneca_antecipacao_01"
        }
    },
    
    // --- MOVEMENT & BODY ---
    {
        nameKey: 'predefinedHabitMovementName',
        subtitleKey: 'predefinedHabitMovementSubtitle',
        icon: HABIT_ICONS.movement,
        color: '#E67E22',
        times: ['Afternoon'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Structural',
            level: 1,
            virtue: 'Courage',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.movement.conscience",
            stoicConcept: "Gymnazein / Officium",
            masterQuoteId: "cit_socrates_movimento_01"
        }
    },
    {
        nameKey: 'predefinedHabitExerciseName',
        subtitleKey: 'predefinedHabitExerciseSubtitle',
        icon: HABIT_ICONS.exercise,
        color: '#2ECC71',
        times: ['Afternoon'],
        goal: { type: 'minutes', total: 30, unitKey: 'unitMin' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Biological',
            level: 1,
            virtue: 'Courage',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.exercise.conscience",
            stoicConcept: "Ponos / Gymnazein",
            masterQuoteId: "cit_socrates_movimento_01"
        }
    },
    {
        nameKey: 'predefinedHabitStretchName',
        subtitleKey: 'predefinedHabitStretchSubtitle',
        icon: HABIT_ICONS.stretch,
        color: '#FADBD8',
        times: ['Morning'],
        goal: { type: 'minutes', total: 5, unitKey: 'unitMin' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Biological',
            level: 1,
            virtue: 'Temperance',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.exercise.conscience",
            stoicConcept: "Tasis",
            masterQuoteId: "cit_socrates_movimento_01"
        }
    },
    {
        nameKey: 'predefinedHabitYogaName',
        subtitleKey: 'predefinedHabitYogaSubtitle',
        icon: HABIT_ICONS.yoga,
        color: '#5DADE2',
        times: ['Morning'],
        goal: { type: 'minutes', total: 15, unitKey: 'unitMin' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Biological',
            level: 1,
            virtue: 'Temperance',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.yoga.conscience",
            stoicConcept: "Askesis",
            masterQuoteId: "cit_seneca_inibicao_01"
        }
    },

    // --- MIND & STUDY ---
    {
        nameKey: 'predefinedHabitReadName',
        subtitleKey: 'predefinedHabitReadSubtitle',
        icon: HABIT_ICONS.read,
        color: '#e74c3c',
        times: ['Evening'],
        goal: { type: 'pages', total: 10, unitKey: 'unitPage' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 2,
            virtue: 'Wisdom',
            discipline: 'Assent',
            nature: 'Addition',
            conscienceKey: "habit.read.conscience",
            stoicConcept: "Lectio",
            masterQuoteId: "cit_seneca_leitura_01"
        }
    },
    {
        nameKey: 'predefinedHabitMeditateName',
        subtitleKey: 'predefinedHabitMeditateSubtitle',
        icon: HABIT_ICONS.meditate,
        color: '#BB8FCE',
        times: ['Morning'],
        goal: { type: 'minutes', total: 10, unitKey: 'unitMin' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 1,
            virtue: 'Temperance',
            discipline: 'Desire',
            nature: 'Addition',
            conscienceKey: "habit.meditate.conscience",
            stoicConcept: "Prosoche",
            masterQuoteId: "cit_marco_presenca_01"
        }
    },

    // --- SOCIAL & DUTY ---
    {
        nameKey: 'predefinedHabitZealName',
        subtitleKey: 'predefinedHabitZealSubtitle',
        icon: HABIT_ICONS.zeal,
        color: '#58D68D',
        times: ['Afternoon'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Social',
            level: 1,
            virtue: 'Justice',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.zeal.conscience",
            stoicConcept: "Oikeiosis / Cosmopolitanism",
            masterQuoteId: "cit_marco_zelo_01"
        }
    },

    // --- REFLECTION & PLANNING ---
    {
        nameKey: 'predefinedHabitJournalName',
        subtitleKey: 'predefinedHabitJournalSubtitle',
        icon: HABIT_ICONS.journal,
        color: '#A1887F',
        times: ['Evening'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 1,
            virtue: 'Wisdom',
            discipline: 'Assent',
            nature: 'Addition',
            conscienceKey: "habit.journal.conscience",
            stoicConcept: "Hypomnemata",
            masterQuoteId: "cit_marco_escrita_01"
        }
    },
    {
        nameKey: 'predefinedHabitPlanDayName',
        subtitleKey: 'predefinedHabitPlanDaySubtitle',
        icon: HABIT_ICONS.planDay,
        color: '#007AFF',
        times: ['Morning'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Structural',
            level: 1,
            virtue: 'Wisdom',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.plan.conscience",
            stoicConcept: "Taxis",
            masterQuoteId: "cit_seneca_tempo_01"
        }
    },
    {
        nameKey: 'predefinedHabitGratitudeName',
        subtitleKey: 'predefinedHabitGratitudeSubtitle',
        icon: HABIT_ICONS.gratitude,
        color: '#E84393',
        times: ['Evening'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 1,
            virtue: 'Justice',
            discipline: 'Desire',
            nature: 'Addition',
            conscienceKey: "habit.gratitude.conscience",
            stoicConcept: "Eucharistia",
            masterQuoteId: "cit_epicteto_gratidao_01"
        }
    },
    {
        nameKey: 'predefinedHabitCadenciaName',
        subtitleKey: 'predefinedHabitCadenciaSubtitle',
        icon: HABIT_ICONS.sunMoon,
        color: '#F1C40F',
        times: ['Morning'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Biological',
            level: 1,
            virtue: 'Wisdom',
            discipline: 'Desire',
            nature: 'Addition',
            conscienceKey: "habit.cadencia.conscience",
            stoicConcept: "Logos / Kata Physin",
            masterQuoteId: "cit_seneca_cadencia_01"
        }
    },
    {
        nameKey: 'predefinedHabitReflectDayName',
        subtitleKey: 'predefinedHabitReflectDaySubtitle',
        icon: HABIT_ICONS.reflectDay,
        color: '#FADBD8',
        times: ['Evening'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 1,
            virtue: 'Wisdom',
            discipline: 'Assent',
            nature: 'Addition',
            conscienceKey: "habit.reflect.conscience",
            stoicConcept: "Exetasis",
            masterQuoteId: "quote_ma_001"
        }
    },
    {
        nameKey: 'predefinedHabitStoicismName',
        subtitleKey: 'predefinedHabitStoicismSubtitle',
        icon: HABIT_ICONS.stoicism,
        color: '#7F8C8D',
        times: ['Morning'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 2,
            virtue: 'Wisdom',
            discipline: 'Assent',
            nature: 'Addition',
            conscienceKey: "habit.stoicism.conscience",
            stoicConcept: "Prokopton",
            masterQuoteId: "cit_epicteto_controle_01"
        }
    },

    // --- GENERAL & CREATIVE ---
    {
        nameKey: 'predefinedHabitLanguageName',
        subtitleKey: 'predefinedHabitLanguageSubtitle',
        icon: HABIT_ICONS.language,
        color: '#1ABC9C',
        times: ['Afternoon'],
        goal: { type: 'minutes', total: 20, unitKey: 'unitMin' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 2,
            virtue: 'Wisdom',
            discipline: 'Assent',
            nature: 'Addition',
            conscienceKey: "habit.language.conscience",
            stoicConcept: "Logos",
            masterQuoteId: "cit_socrates_aprendizado_01"
        }
    },
    {
        nameKey: 'predefinedHabitOrganizeName',
        subtitleKey: 'predefinedHabitOrganizeSubtitle',
        icon: HABIT_ICONS.organize,
        color: '#BDC3C7',
        times: ['Evening'],
        goal: { type: 'minutes', total: 15, unitKey: 'unitMin' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Structural',
            level: 1,
            virtue: 'Temperance',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.organize.conscience",
            stoicConcept: "Kosmos",
            masterQuoteId: "cit_marco_ordem_01"
        }
    },
    {
        nameKey: 'predefinedHabitCreativeHobbyName',
        subtitleKey: 'predefinedHabitCreativeHobbySubtitle',
        icon: HABIT_ICONS.creativeHobby,
        color: '#e84393',
        times: ['Afternoon'],
        goal: { type: 'minutes', total: 30, unitKey: 'unitMin' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 2,
            virtue: 'Wisdom',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.hobby.conscience",
            stoicConcept: "Techne",
            masterQuoteId: "cit_marco_ordem_01"
        }
    },
    {
        nameKey: 'predefinedHabitTalkFriendName',
        subtitleKey: 'predefinedHabitTalkFriendSubtitle',
        icon: HABIT_ICONS.talkFriend,
        color: '#3498db',
        times: ['Afternoon'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Social',
            level: 2,
            virtue: 'Justice',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.friend.conscience",
            stoicConcept: "Philia",
            masterQuoteId: "cit_hierocles_circulos_01"
        }
    },
    {
        nameKey: 'predefinedHabitInstrumentName',
        subtitleKey: 'predefinedHabitInstrumentSubtitle',
        icon: HABIT_ICONS.instrument,
        color: '#e67e22',
        times: ['Evening'],
        goal: { type: 'minutes', total: 20, unitKey: 'unitMin' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 2,
            virtue: 'Temperance',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.instrument.conscience",
            stoicConcept: "Harmonia",
            masterQuoteId: "cit_marco_ordem_01"
        }
    },
    {
        nameKey: 'predefinedHabitPlantsName',
        subtitleKey: 'predefinedHabitPlantsSubtitle',
        icon: HABIT_ICONS.plants,
        color: '#27ae60',
        times: ['Morning'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Biological',
            level: 1,
            virtue: 'Justice',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.plants.conscience",
            stoicConcept: "Physis",
            masterQuoteId: "cit_zeno_natureza_01"
        }
    },
    {
        nameKey: 'predefinedHabitFinancesName',
        subtitleKey: 'predefinedHabitFinancesSubtitle',
        icon: HABIT_ICONS.finances,
        color: '#34495e',
        times: ['Evening'],
        goal: { type: 'minutes', total: 10, unitKey: 'unitMin' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Structural',
            level: 2,
            virtue: 'Temperance',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.finances.conscience",
            stoicConcept: "Oikonomia",
            masterQuoteId: "cit_epicteto_abstine_01"
        }
    },
    {
        nameKey: 'predefinedHabitTeaName',
        subtitleKey: 'predefinedHabitTeaSubtitle',
        icon: HABIT_ICONS.tea,
        color: '#16a085',
        times: ['Evening'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Biological',
            level: 1,
            virtue: 'Temperance',
            discipline: 'Desire',
            nature: 'Addition',
            conscienceKey: "habit.tea.conscience",
            stoicConcept: "Ataraxia",
            masterQuoteId: "cit_marco_presenca_01"
        }
    },
    {
        nameKey: 'predefinedHabitPodcastName',
        subtitleKey: 'predefinedHabitPodcastSubtitle',
        icon: HABIT_ICONS.podcast,
        color: '#007aff',
        times: ['Afternoon'],
        goal: { type: 'minutes', total: 25, unitKey: 'unitMin' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 2,
            virtue: 'Wisdom',
            discipline: 'Assent',
            nature: 'Addition',
            conscienceKey: "habit.podcast.conscience",
            stoicConcept: "Akroasis",
            masterQuoteId: "cit_socrates_aprendizado_01"
        }
    },
    {
        nameKey: 'predefinedHabitEmailsName',
        subtitleKey: 'predefinedHabitEmailsSubtitle',
        icon: HABIT_ICONS.emails,
        color: '#f39c12',
        times: ['Morning'],
        goal: { type: 'minutes', total: 5, unitKey: 'unitMin' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Structural',
            level: 1,
            virtue: 'Justice',
            discipline: 'Action',
            nature: 'Subtraction',
            conscienceKey: "habit.emails.conscience",
            stoicConcept: "Katharsis / Taxis",
            masterQuoteId: "cit_seneca_tempo_01"
        }
    },
    {
        nameKey: 'predefinedHabitSkincareName',
        subtitleKey: 'predefinedHabitSkincareSubtitle',
        icon: HABIT_ICONS.skincare,
        color: '#d35400',
        times: ['Evening'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Biological',
            level: 1,
            virtue: 'Temperance',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.skincare.conscience",
            stoicConcept: "Therapeia",
            masterQuoteId: "cit_marco_compostura_01"
        }
    },
    {
        nameKey: 'predefinedHabitDrawName',
        subtitleKey: 'predefinedHabitDrawSubtitle',
        icon: HABIT_ICONS.draw,
        color: '#8e44ad',
        times: ['Afternoon'],
        goal: { type: 'minutes', total: 15, unitKey: 'unitMin' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 2,
            virtue: 'Wisdom',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.draw.conscience",
            stoicConcept: "Mimesis",
            masterQuoteId: "cit_marco_ordem_01"
        }
    },
    {
        nameKey: 'predefinedHabitFamilyTimeName',
        subtitleKey: 'predefinedHabitFamilyTimeSubtitle',
        icon: HABIT_ICONS.familyTime,
        color: '#f1c40f',
        times: ['Evening'],
        goal: { type: 'minutes', total: 30, unitKey: 'unitMin' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Social',
            level: 1,
            virtue: 'Justice',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.family.conscience",
            stoicConcept: "Oikeiosis / Storge",
            masterQuoteId: "cit_hierocles_circulos_01"
        }
    },
    {
        nameKey: 'predefinedHabitNewsName',
        subtitleKey: 'predefinedHabitNewsSubtitle',
        icon: HABIT_ICONS.news,
        color: '#7f8c8d',
        times: ['Morning'],
        goal: { type: 'minutes', total: 10, unitKey: 'unitMin' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Social',
            level: 2,
            virtue: 'Wisdom',
            discipline: 'Assent',
            nature: 'Addition',
            conscienceKey: "habit.news.conscience",
            stoicConcept: "Kosmopolites",
            masterQuoteId: "cit_epicteto_controle_01"
        }
    },
    {
        nameKey: 'predefinedHabitCookHealthyName',
        subtitleKey: 'predefinedHabitCookHealthySubtitle',
        icon: HABIT_ICONS.cookHealthy,
        color: '#27ae60',
        times: ['Evening'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Biological',
            level: 1,
            virtue: 'Temperance',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.cook.conscience",
            stoicConcept: "Dieta",
            masterQuoteId: "cit_musonio_rufo_nutricao_01"
        }
    },
    {
        nameKey: 'predefinedHabitLearnSkillName',
        subtitleKey: 'predefinedHabitLearnSkillSubtitle',
        icon: HABIT_ICONS.learnSkill,
        color: '#e74c3c',
        times: ['Afternoon'],
        goal: { type: 'minutes', total: 20, unitKey: 'unitMin' },
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 2,
            virtue: 'Wisdom',
            discipline: 'Assent',
            nature: 'Addition',
            conscienceKey: "habit.learn.conscience",
            stoicConcept: "Episteme",
            masterQuoteId: "cit_socrates_aprendizado_01"
        }
    },
    {
        nameKey: 'predefinedHabitPhotographyName',
        subtitleKey: 'predefinedHabitPhotographySubtitle',
        icon: HABIT_ICONS.photography,
        color: '#95a5a6',
        times: ['Afternoon'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Mental',
            level: 2,
            virtue: 'Wisdom',
            discipline: 'Assent',
            nature: 'Addition',
            conscienceKey: "habit.photo.conscience",
            stoicConcept: "Phantasia",
            masterQuoteId: "cit_marco_presenca_01"
        }
    },
    {
        nameKey: 'predefinedHabitVolunteerName',
        subtitleKey: 'predefinedHabitVolunteerSubtitle',
        icon: HABIT_ICONS.gratitude,
        color: '#e74c3c',
        times: ['Afternoon'],
        goal: GOAL_CHECK,
        frequency: FREQ_DAILY,
        philosophy: {
            sphere: 'Social',
            level: 2,
            virtue: 'Justice',
            discipline: 'Action',
            nature: 'Addition',
            conscienceKey: "habit.volunteer.conscience",
            stoicConcept: "Koinonia",
            masterQuoteId: "cit_marco_zelo_01"
        }
    }
]);