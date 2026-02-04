
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { StoicVirtue, StoicLevel, StoicDiscipline, GovernanceSphere } from '../state';

// --- TYPE DEFINITIONS ---

export type CoercionType = 'Dogmatic' | 'Inspirational' | 'Reflective' | 'Directive';

export type StoicTag = 
    | 'action' | 'resilience' | 'control' | 'time' | 'gratitude' | 'discipline' 
    | 'temperance' | 'nature' | 'learning' | 'humility' | 'reality' | 'suffering' 
    | 'focus' | 'virtue' | 'death' | 'anxiety' | 'community' | 'perception' 
    | 'change' | 'wisdom' | 'perspective' | 'responsibility' | 'morning' | 'evening' 
    | 'reflection' | 'duty' | 'rest' | 'consistency' | 'presence' | 'fate' 
    | 'simplicity' | 'healing' | 'mindset' | 'life' | 'love' | 'laziness' 
    | 'preparation' | 'prudence' | 'peace' | 'courage' | 'confidence' | 'growth' 
    | 'character' | 'solitude' | 'justice' | 'silence' | 'optimism' | 'creativity' 
    | 'passion' | 'reason' | 'history' | 'wealth' | 'happiness' | 'leadership' 
    | 'truth' | 'freedom' | 'acceptance' | 'integrity' | 'minimalism' | 'purpose' 
    | 'legacy' | 'fear' | 'belief' | 'identity' | 'practice' | 'authenticity' 
    | 'example' | 'desire' | 'habit' | 'listening' | 'values' | 'criticism' 
    | 'urgency' | 'patience' | 'strength' | 'honor' | 'essentialism' | 'flow' 
    | 'health' | 'hope' | 'speech' | 'body' | 'mindfulness' | 'friendship' 
    | 'anger' | 'kindness' | 'chaos' | 'judgment'
    | 'poverty' | 'discomfort'
    | 'breath'
    | 'pain' | 'endurance' | 'cold' | 'potential'
    | 'clarity' | 'order' | 'harmony'
    | 'fortune' | 'conscience' | 'role'
    | 'will' | 'recovery'
    | 'emotion' | 'consequences'
    | 'cosmopolitanism'
    | 'trust' | 'loyalty' | 'heart'
    | 'impermanence' | 'flux' | 'loss'
    | 'attention' | 'self-control'
    | 'forgiveness' | 'pleasure' | 'distraction'
    | 'praise' | 'influence'
    | 'present' | 'imagination' | 'procrastination' | 'future'
    | 'amor fati' | 'conversion' | 'stability' | 'equality' | 'social';

export interface Quote {
    id: string;
    author: string;
    original_text: {
        pt: string;
        en: string;
        es: string;
    };
    source: string;
    metadata: {
        virtue: StoicVirtue;
        level: StoicLevel;
        discipline: StoicDiscipline;
        sphere: GovernanceSphere;
        tags: StoicTag[];
        coercion_type: CoercionType;
    };
    adaptations: {
        level_1: { pt: string; en: string; es: string };
        level_2: { pt: string; en: string; es: string };
        level_3: { pt: string; en: string; es: string };
    };
}

// --- CATEGORY 1: MIND & PERCEPTION (Wisdom) ---
const MIND_QUOTES: Quote[] = [
    {
        id: "quote_ma_001",
        author: "marcusAurelius",
        original_text: {
            pt: "A felicidade da sua vida depende da qualidade dos seus pensamentos.",
            en: "The happiness of your life depends upon the quality of your thoughts.",
            es: "La felicidad de tu vida depende de la calidad de tus pensamientos.",
        },
        source: "Meditações, V.16",
        metadata: {
            virtue: "Wisdom",
            level: 1,
            discipline: "Assent",
            sphere: "Mental",
            tags: ["happiness", "mindset", "control", "perception", "morning", "focus", "mindfulness"],
            coercion_type: "Dogmatic"
        },
        adaptations: {
            level_1: {
                pt: "Vigie seus pensamentos. Eles criam sua paz.",
                en: "Watch your thoughts. They create your peace.",
                es: "Vigila tus pensamientos. Crean tu paz."
            },
            level_2: {
                pt: "Sua felicidade é um reflexo direto de seus pensamentos. Escolha-os com sabedoria.",
                en: "Your happiness is a direct reflection of your thoughts. Choose them wisely.",
                es: "Tu felicidad es un reflejo directo de tus pensamientos. Elígelos sabiamente."
            },
            level_3: {
                pt: "Pensamentos de qualidade, vida feliz.",
                en: "Quality thoughts, happy life.",
                es: "Pensamientos de calidad, vida feliz."
            }
        }
    },
    {
        id: "quote_ep_001",
        author: "epictetus",
        original_text: {
            pt: "Não é o que acontece com você, mas como você reage a isso que importa.",
            en: "It's not what happens to you, but how you react to it that matters.",
            es: "No es lo que te sucede, sino cómo reaccionas a ello lo que importa.",
        },
        source: "Enchiridion, V",
        metadata: {
            virtue: "Wisdom",
            level: 1,
            discipline: "Assent",
            sphere: "Mental",
            tags: ["control", "resilience", "perception", "judgment", "anger", "acceptance"],
            coercion_type: "Dogmatic"
        },
        adaptations: {
            level_1: {
                pt: "Não reaja. Escolha sua resposta.",
                en: "Don't react. Choose your response.",
                es: "No reacciones. Elige tu respuesta."
            },
            level_2: {
                pt: "Você não controla os eventos, mas controla sua resposta a eles. Aí reside sua força.",
                en: "You don't control events, but you control your response to them. Therein lies your strength.",
                es: "No controlas los eventos, pero controlas tu respuesta a ellos. Ahí reside tu fuerza."
            },
            level_3: {
                pt: "A reação, não o evento.",
                en: "The reaction, not the event.",
                es: "La reacción, not el evento."
            }
        }
    },
    {
        id: "quote_se_001",
        author: "seneca",
        original_text: {
            pt: "Sofremos mais na imaginação do que na realidade.",
            en: "We suffer more often in imagination than in reality.",
            es: "Sufrimos más a menudo en la imaginación que en la realidad.",
        },
        source: "Cartas a Lucílio, XIII",
        metadata: {
            virtue: "Temperance",
            level: 2,
            discipline: "Desire",
            sphere: "Mental",
            tags: ["anxiety", "fear", "perception", "mindset", "evening", "rest", "acceptance"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "Sofremos na imaginação. Foque no real.",
                en: "We suffer in imagination. Focus on the real.",
                es: "Sufrimos en la imaginación. Enfócate en lo real."
            },
            level_2: {
                pt: "Separe o que é real do que é apenas ansiedade. A maior parte do seu sofrimento é autoinfligida.",
                en: "Separate what is real from what is merely anxiety. Most of your suffering is self-inflicted.",
                es: "Separa lo que es real de lo que es simplemente ansiedad. La mayor parte de tu sufrimiento es autoinfligido."
            },
            level_3: {
                pt: "Imaginação fere mais que a realidade.",
                en: "Imagination hurts more than reality.",
                es: "La imaginación duele más que la realidad."
            }
        }
    },
    {
        id: "cit_epicteto_controle_01",
        author: "epictetus",
        original_text: {
            pt: "Algumas coisas estão sob nosso controle e outras não. Sob nosso controle estão opinião, busca, desejo, aversão e, numa palavra, tudo o que é nossa própria ação.",
            en: "Some things are in our control and others not. Things in our control are opinion, pursuit, desire, aversion, and, in a word, whatever are our own actions.",
            es: "Algunas cosas están bajo nuestro control y otras no. Bajo nuestro control están la opinión, la búsqueda, el deseo, la aversión y, en una palabra, cualquier cosa que sea nuestra propia acción.",
        },
        source: "Enchiridion, I",
        metadata: {
            virtue: "Wisdom",
            level: 1,
            discipline: "Assent",
            sphere: "Mental",
            tags: ["control", "perception", "wisdom", "freedom", "morning", "acceptance", "action"],
            coercion_type: "Dogmatic"
        },
        adaptations: {
            level_1: {
                pt: "Foque no que controla. Ignore o resto.",
                en: "Focus on what you control. Ignore the rest.",
                es: "Enfócate en lo que controlas. Igora el resto."
            },
            level_2: {
                pt: "A liberdade começa com a distinção entre o que depende de nós e o que não depende. Ignore o resto.",
                en: "Freedom begins with the distinction between what depends on us and what does not. Ignore the rest.",
                es: "La libertad comienza con la distinción entre lo que depende de nosotros y lo que no. Ignora el resto."
            },
            level_3: {
                pt: "Distingua e renuncie.",
                en: "Distinguish and renounce.",
                es: "Distingue y renuncia."
            }
        }
    },
    {
        id: "cit_seneca_antecipacao_01",
        author: "seneca",
        original_text: {
            pt: "Aquele que antecipou a chegada dos problemas tira-lhes o poder quando eles chegam.",
            en: "The man who has anticipated the coming of troubles takes away their power when they arrive.",
            es: "El que ha anticipado la llegada de los problemas les quita el poder cuando llegan.",
        },
        source: "Consolação a Márcia, IX",
        metadata: {
            virtue: "Courage",
            level: 1,
            discipline: "Desire",
            sphere: "Mental",
            tags: ["preparation", "resilience", "anxiety", "fate", "morning", "humility"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Preveja o mal. Elimine a surpresa.",
                en: "Foresee the bad. Eliminate surprise.",
                es: "Prevé el mal. Elimina la sorpresa."
            },
            level_2: {
                pt: "Visualize os desafios antes que aconteçam. O golpe previsto é menos doloroso.",
                en: "Visualize challenges before they happen. The foreseen blow is less painful.",
                es: "Visualiza los desafíos antes de que sucedan. El golpe previsto es menos doloroso."
            },
            level_3: {
                pt: "Premeditatio Malorum.",
                en: "Premeditatio Malorum.",
                es: "Premeditatio Malorum."
            }
        }
    },
    {
        id: "cit_seneca_leitura_01",
        author: "seneca",
        original_text: {
            pt: "Você deve permanecer entre um número limitado de grandes pensadores e digerir suas obras se quiser derivar ideias que se firmem em sua mente.",
            en: "You must linger among a limited number of master-thinkers, and digest their works, if you would derive ideas which shall win firm hold in your mind.",
            es: "Debes permanecer entre un número limitado de grandes pensadores y digerir sus obras si quieres derivar ideas que se afirmen en tu mente.",
        },
        source: "Cartas a Lucílio, II",
        metadata: {
            virtue: "Wisdom",
            level: 2,
            discipline: "Assent",
            sphere: "Mental",
            tags: ["learning", "focus", "wisdom", "mindset", "discipline"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Leia para mudar, não para decorar.",
                en: "Read to change, not to memorize.",
                es: "Lee para cambiar, no para memorizar."
            },
            level_2: {
                pt: "Evite a leitura dispersa. Aprofunde-se nos mestres que nutrem a alma e fortalecem a razão.",
                en: "Avoid scattered reading. Go deep into the masters who nourish the soul and strengthen reason.",
                es: "Evita la lectura dispersa. Profundiza en los maestros que nutren el alma y fortalecen la razón."
            },
            level_3: {
                pt: "Lectio: Leitura profunda.",
                en: "Lectio: Deep reading.",
                es: "Lectio: Lectura profunda."
            }
        }
    },
    {
        id: "cit_marco_escrita_01",
        author: "marcusAurelius",
        original_text: {
            pt: "Nada tem tanto poder para expandir a mente como a capacidade de investigar sistematicamente e verdadeiramente tudo o que vem sob sua observação na vida.",
            en: "Nothing has such power to broaden the mind as the ability to investigate systematically and truly all that comes under thy observation in life.",
            es: "Nada tiene tanto poder para expandir la mente como la capacidad de investigar sistemática y verdaderamente todo lo que viene bajo tu observación en la vida.",
        },
        source: "Meditações, III.11",
        metadata: {
            virtue: "Wisdom",
            level: 1,
            discipline: "Assent",
            sphere: "Mental",
            tags: ["reflection", "growth", "wisdom", "clarity", "evening", "focus"],
            coercion_type: "Inspirational"
        },
        adaptations: {
            level_1: {
                pt: "Escreva. Organize sua mente.",
                en: "Write. Organize your mind.",
                es: "Escribe. Organiza tu mente."
            },
            level_2: {
                pt: "O diário é a ferramenta do filósofo. Ao registrar seus pensamentos, você os examina e os purifica.",
                en: "The journal is the philosopher's tool. By recording your thoughts, you examine and purify them.",
                es: "El diario es la herramienta del filósofo. Al registrar tus pensamientos, los examinas y los purificas."
            },
            level_3: {
                pt: "Hypomnemata: Notas para si.",
                en: "Hypomnemata: Notes to oneself.",
                es: "Hypomnemata: Notes para uno mismo."
            }
        }
    },
    {
        id: "cit_socrates_aprendizado_01",
        author: "socrates",
        original_text: {
            pt: "Só sei que nada sei.",
            en: "I know only that I know nothing.",
            es: "Solo sé que no sé nada.",
        },
        source: "Platão, Apologia",
        metadata: {
            virtue: "Wisdom",
            level: 1,
            discipline: "Assent",
            sphere: "Mental",
            tags: ["learning", "humility", "wisdom", "growth"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "Admita a ignorância. Aprenda.",
                en: "Admit ignorance. Learn.",
                es: "Admite la ignorancia. Aprende."
            },
            level_2: {
                pt: "A mente que se fecha para aprender, morre. Mantenha a curiosidade viva e a humildade intelectual.",
                en: "The mind that closes to learning dies. Keep curiosity alive and intellectual humility.",
                es: "La mente que se cierra al aprendizaje muere. Mantén viva la curiosidad y la humildad intelectual."
            },
            level_3: {
                pt: "Episteme: Conhecimento Real.",
                en: "Episteme: True Knowledge.",
                es: "Episteme: Conocimiento Verdadero."
            }
        }
    },
    {
        id: "cit_seneca_reflexao_01",
        author: "seneca",
        original_text: {
            pt: "Quando a luz for retirada... examinarei todo o meu dia e revisarei meus atos e palavras. Nada esconderei de mim mesmo.",
            en: "When the light has been removed... I examine my entire day and go back over what I've done and said, hiding nothing from myself.",
            es: "Cuando se haya retirado la luz... examinaré todo mi día y repasaré mis hechos y dichos. Nada me ocultaré a mí mismo."
        },
        source: "Sobre a Ira, III.36",
        metadata: {
            virtue: "Wisdom",
            level: 1,
            discipline: "Assent",
            sphere: "Mental",
            tags: ["evening", "reflection", "conscience", "growth", "integrity"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Julgue seu dia. Corrija-se.",
                en: "Judge your day. Correct yourself.",
                es: "Juzga tu día. Corrígete."
            },
            level_2: {
                pt: "O tribunal da consciência deve ser visitado todas as noites. Seja seu próprio juiz, mas também seu próprio guia.",
                en: "The court of conscience must be visited every night. Be your own judge, but also your own guide.",
                es: "El tribunal de la conciencia debe ser visitado cada noche. Sé tu propio juez, pero también tu propio guía."
            },
            level_3: {
                pt: "Examine seu dia.",
                en: "Examine your day.",
                es: "Examina tu día."
            }
        }
    },
    {
        id: "cit_epicteto_atencao_01",
        author: "epictetus",
        original_text: {
            pt: "Quando você relaxa sua atenção por um tempo, não pense que a recuperará sempre que desejar.",
            en: "When you let your attention slide for a bit, do not think you will get back a grip on it whenever you wish.",
            es: "Cuando relajas tu atención por un tiempo, no pienses que la recuperarás cuando desees."
        },
        source: "Discursos, IV.12",
        metadata: {
            virtue: "Temperance",
            level: 2,
            discipline: "Assent",
            sphere: "Mental",
            tags: ["focus", "mindfulness", "discipline", "attention", "habit"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Atenção total. O descuido custa caro.",
                en: "Full attention. Carelessness costs.",
                es: "Atención total. El descuido cuesta."
            },
            level_2: {
                pt: "La 'Prosoche' (atenção plena) deve ser constante. Uma exceção abre a porta para o vício.",
                en: "'Prosoche' (mindfulness) must be constant. An exception opens the door to vice.",
                es: "La 'Prosoche' (atención plena) debe ser constante. Una excepción abre la puerta al vicio."
            },
            level_3: {
                pt: "Atenção constante.",
                en: "Constant attention.",
                es: "Atención constante."
            }
        }
    },
    {
        id: "cit_epicteto_tolo_01",
        author: "epictetus",
        original_text: {
            pt: "Se você quer progredir, contente-se em parecer tolo e estúpido nas coisas externas.",
            en: "If you want to improve, be content to be thought foolish and stupid.",
            es: "Si quieres progresar, conténtate con parecer tonto y estúpido en las cosas externas."
        },
        source: "Enchiridion, 13",
        metadata: {
            virtue: "Wisdom",
            level: 3,
            discipline: "Assent",
            sphere: "Mental",
            tags: ["humility", "learning", "growth", "judgment", "freedom"],
            coercion_type: "Dogmatic"
        },
        adaptations: {
            level_1: {
                pt: "Não sabe? Pergunte. Sem vergonha.",
                en: "Don't know? Ask. No shame.",
                es: "¿No sabes? Pregunta. Sin vergüenza."
            },
            level_2: {
                pt: "Abandone o ego intelectual. Para preencher a mente com a verdade, primeiro esvazie-a da presunção.",
                en: "Abandon intellectual ego. To fill the mind with truth, first empty it of conceit.",
                es: "Abandona el ego intelectual. Para llenar la mente con la verdad, primero vacíala de presunción."
            },
            level_3: {
                pt: "Pareça tolo para ser sábio.",
                en: "Seem foolish to be wise.",
                es: "Parece tonto para ser sabio."
            }
        }
    },
    {
        id: "cit_epicteto_asas_01",
        author: "epictetus",
        original_text: {
            pt: "Cada evento tem duas alças: uma pela qual pode ser carregado, e outra pela qual não pode.",
            en: "Every event has two handles, one by which it can be carried, and one by which it cannot.",
            es: "Cada evento tiene dos asas: una por la que se puede llevar, y otra por la que no.",
        },
        source: "Enchiridion, 43",
        metadata: {
            virtue: "Wisdom",
            level: 2,
            discipline: "Assent",
            sphere: "Mental",
            tags: ["perspective", "perception", "resilience", "wisdom"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "Segure onde pode carregar.",
                en: "Hold where you can carry.",
                es: "Agarra donde puedas llevar."
            },
            level_2: {
                pt: "Não foque na injustiça do irmão, mas no fato de que ele é seu irmão. Segure a alça que sustenta.",
                en: "Focus not on the brother's injustice, but that he is your brother. Grasp the handle that holds.",
                es: "No te enfoques en la injusticia del hermano, sino en que es tu hermano. Agarra el asa que sostiene."
            },
            level_3: {
                pt: "Segure pela alça suportável.",
                en: "Grasp by the bearable handle.",
                es: "Agarra por el asa soportable."
            }
        }
    },
    {
        id: "cit_marco_pepino_01",
        author: "marcusAurelius",
        original_text: {
            pt: "O pepino é amargo? Jogue-o fora. Há espinhos no caminho? Desvie-se. Isso é o suficiente.",
            en: "The cucumber is bitter? Throw it away. There are brambles in the path? Turn aside. That is enough.",
            es: "¿El pepino es amargo? Tíralo. ¿Hay zarzas en el camino? Desvíate. Eso es suficiente.",
        },
        source: "Meditações, VIII.50",
        metadata: {
            virtue: "Wisdom",
            level: 1,
            discipline: "Assent",
            sphere: "Mental",
            tags: ["simplicity", "acceptance", "perception"],
            coercion_type: "Dogmatic"
        },
        adaptations: {
            level_1: {
                pt: "Amargo? Jogue fora. Bloqueio? Desvie.",
                en: "Bitter? Toss it. Blocked? Swerve.",
                es: "¿Amargo? Tíralo. ¿Bloqueado? Desvíate."
            },
            level_2: {
                pt: "Não adicione julgamentos desnecessários aos fatos. A amargura está no pepino, não na natureza do universo.",
                en: "Do not add unnecessary judgments to facts. Bitterness is in the cucumber, not in the nature of the universe.",
                es: "No añadas juicios innecesarios a los hechos. La amargura está en el pepino, no en la naturaleza del universo."
            },
            level_3: {
                pt: "Amargo? Jogue fora.",
                en: "Bitter? Throw away.",
                es: "¿Amargo? Tira."
            }
        }
    },
    {
        id: "cit_seneca_animais_01",
        author: "seneca",
        original_text: {
            pt: "Animais selvagens fogem dos perigos que veem, e uma vez que escapam, não se preocupam mais. Nós, porém, somos atormentados tanto pelo passado quanto pelo futuro.",
            en: "Wild animals run from the dangers they actually see, and once they have escaped them worry no more. We however are tormented alike by what is past and what is to come.",
            es: "Los animales salvajes huyen de los peligros que ven, y una vez que escapan, no se preocupan más. Nosotros, sin embargo, somos atormentados tanto por el pasado como por el futuro."
        },
        source: "Cartas a Lucílio, V",
        metadata: {
            virtue: "Wisdom",
            level: 2,
            discipline: "Assent",
            sphere: "Mental",
            tags: ["anxiety", "fear", "mindset", "present", "imagination"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "Só o agora é real. Viva aqui.",
                en: "Only now is real. Live here.",
                es: "Solo el ahora es real. Vive aquí."
            },
            level_2: {
                pt: "A memória e a previsão, bênçãos da razão, tornam-se maldições quando usadas para perpetuar o sofrimento. Volte ao presente.",
                en: "Memory and foresight, blessings of reason, become curses when used to perpetuate suffering. Return to the present.",
                es: "La memoria y la previsión, bendiciones de la razón, se convierten en maldiciones quando se usan para perpetuar el sufrimiento. Vuelve al presente."
            },
            level_3: {
                pt: "Só o agora atormenta.",
                en: "Only the now torments.",
                es: "Solo el ahora atormenta."
            }
        }
    }
];

// --- CATEGORY 2: ACTION & DISCIPLINE (The Engine) ---
const ACTION_QUOTES: Quote[] = [
    {
        id: "cit_seneca_tempo_01",
        author: "seneca",
        original_text: {
            pt: "Não é que tenhamos pouco tempo, mas desperdiçamos muito.",
            en: "It is not that we have a short time to live, but that we waste a lot of it.",
            es: "No es que tengamos poco tiempo, sino que perdemos mucho.",
        },
        source: "Sobre a Brevidade da Vida",
        metadata: {
            virtue: "Wisdom",
            level: 1,
            discipline: "Action",
            sphere: "Structural",
            tags: ["time", "focus", "urgency", "life", "morning", "action"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "O tempo voa. Não desperdice.",
                en: "Time flies. Don't waste it.",
                es: "El tiempo vuela. No lo pierdas."
            },
            level_2: {
                pt: "Organizar o tempo é organizar a vida. Não deixe que os minutos escorram por descuido.",
                en: "To organize time is to organize life. Do not let minutes slip away through carelessness.",
                es: "Organizar el tiempo es organizar la vida. No dejes que los minutos se escapen por descuido."
            },
            level_3: {
                pt: "Taxis: Arranjo.",
                en: "Taxis: Arrangement.",
                es: "Taxis: Arreglo."
            }
        }
    },
    {
        id: "cit_marco_trabalho_01",
        author: "marcusAurelius",
        original_text: {
            pt: "Ao amanhecer, quando tiver dificuldade em sair da cama, diga a si mesmo: 'Tenho que ir trabalhar — como ser humano.'",
            en: "At dawn, when you have trouble getting out of bed, tell yourself: 'I have to go to work — as a human being.'",
            es: "Al amanecer, cuando te cueste salir de la cama, dite a ti mismo: 'Tengo que ir a trabajar — como ser humano.'"
        },
        source: "Meditações, V.1",
        metadata: {
            virtue: "Justice",
            level: 1,
            discipline: "Action",
            sphere: "Social",
            tags: ["action", "discipline", "consistency", "morning", "duty"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Nasceu para agir. Levante-se.",
                en: "Born to act. Get up.",
                es: "Naciste para actuar. Levántate."
            },
            level_2: {
                pt: "A 'Oikeiosis' humana é a atividade racional e social. Ficar na inércia é negar sua própria natureza e função.",
                en: "Human 'Oikeiosis' is rational and social activity. Staying in inertia is denying your own nature and function.",
                es: "La 'Oikeiosis' humana es la actividad racional y social. Quedarse en la inercia es negar tu propia naturaleza y función."
            },
            level_3: {
                pt: "Levante para sua natureza.",
                en: "Rise to your nature.",
                es: "Levántate a tu natureza."
            }
        }
    },
    {
        id: "cit_seneca_adiar_01",
        author: "seneca",
        original_text: {
            pt: "Enquanto desperdiçamos nosso tempo hesitando e adiando, a vida está passando.",
            en: "While we are postponing, life speeds by.",
            es: "Mientras posponemos, la vida pasa corriendo."
        },
        source: "Cartas a Lucílio, I",
        metadata: {
            virtue: "Wisdom",
            level: 1,
            discipline: "Action",
            sphere: "Structural",
            tags: ["action", "discipline", "consistency", "urgency", "time"],
            coercion_type: "Inspirational"
        },
        adaptations: {
            level_1: {
                pt: "Não hesite. A vida foge.",
                en: "Don't hesitate. Life flees.",
                es: "No dudes. La vida huye."
            },
            level_2: {
                pt: "O vício da inércia é curado pela ação imediata. Não projete a virtude no futuro; execute-a no presente.",
                en: "The vice of inertia is cured by immediate action. Do not project virtue into the future; execute it in the present.",
                es: "El vicio de la inercia se cura con la acción inmediata. No proyectes la virtud en el futuro; ejecútala en el presente."
            },
            level_3: {
                pt: "Hesitar é perder vida.",
                en: "To hesitate is to lose life.",
                es: "Dudar es perder vida."
            }
        }
    },
    {
        id: "cit_seneca_procrastinacao_02",
        author: "seneca",
        original_text: {
            pt: "A maior perda de vida é o adiamento: ele nos rouba cada dia que chega e nega o presente prometendo o futuro.",
            en: "Putting things off is the biggest waste of life: it snatches away each day as it comes, and denies us the present by promising the future.",
            es: "La mayor pérdida de vida es la postergación: nos roba cada día que llega y niega el presente prometiendo el futuro."
        },
        source: "Sobre a Brevidade da Vida, IX",
        metadata: {
            virtue: "Wisdom",
            level: 2,
            discipline: "Action",
            sphere: "Structural",
            tags: ["urgency", "time", "action", "procrastination", "future"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Não espere. Use o hoje.",
                en: "Don't wait. Use today.",
                es: "No esperes. Usa el hoy."
            },
            level_2: {
                pt: "A promessa do futuro é a ladra do presente. Execute sua virtude agora, pois a Fortuna controla o amanhã.",
                en: "The promise of the future is the thief of the present. Execute your virtue now, for Fortune controls tomorrow.",
                es: "La promesa del futuro es la ladrona del presente. Ejecuta tu virtud ahora, pues la Fortuna controla el mañana."
            },
            level_3: {
                pt: "Adiamento é perda.",
                en: "Delay is loss.",
                es: "La demora es pérdida."
            }
        }
    },
    {
        id: "cit_epicteto_pratica_01",
        author: "epictetus",
        original_text: {
            pt: "Pratique, pelos deuses, nas pequenas coisas, e depois prossiga para as maiores.",
            en: "Practice yourself, for heaven's sake in little things, and then proceed to greater.",
            es: "Practícate, por los dioses, en las cosas pequeñas, y luego procede a las mayores."
        },
        source: "Discursos, I.18",
        metadata: {
            virtue: "Temperance",
            level: 2,
            discipline: "Action",
            sphere: "Structural",
            tags: ["action", "discipline", "consistency", "growth", "habit"],
            coercion_type: "Dogmatic"
        },
        adaptations: {
            level_1: {
                pt: "Comece pequeno. Seja constante.",
                en: "Start small. Be constant.",
                es: "Empieza pequeño. Sé constante."
            },
            level_2: {
                pt: "A 'Askesis' começa no trivial. A consistência em atos menores fortalece a Vontade para os maiores desafios.",
                en: "'Askesis' begins in the trivial. Consistency in minor acts strengthens the Will for greater challenges.",
                es: "La 'Askesis' comienza en lo trivial. La constancia en actos menores fortalece la Voluntad para mayores desafíos."
            },
            level_3: {
                pt: "Pequeno hoje, grande amanhã.",
                en: "Small today, big tomorrow.",
                es: "Pequeño hoy, grande mañana."
            }
        }
    },
    {
        id: "cit_musonio_teoria_01",
        author: "musoniusRufus",
        original_text: {
            pt: "A teoria que ensina como se deve agir está para a ação como o conhecimento musical está para a execução.",
            en: "Theory which teaches how one should act is related to action as the musician's knowledge of music is related to his performance.",
            es: "La teoría que enseña cómo se debe actuar está para la acción como el conocimiento musical está para la ejecución."
        },
        source: "Fragmentos",
        metadata: {
            virtue: "Wisdom",
            level: 2,
            discipline: "Action",
            sphere: "Mental",
            tags: ["action", "discipline", "consistency", "learning", "practice"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "Saber não basta. Faça.",
                en: "Knowing isn't enough. Do.",
                es: "Saber no basta. Haz."
            },
            level_2: {
                pt: "Logos sem Ergon é estéril. A sabedoria não é acumulada na mente, mas demonstrada nos hábitos.",
                en: "Logos without Ergon is sterile. Wisdom is not accumulated in the mind, but demonstrated in habits.",
                es: "Logos sin Ergon es estéril. La sabiduría no se acumula en la mente, sino que se demuestra en los hábitos."
            },
            level_3: {
                pt: "Saber é fazer.",
                en: "Knowing is doing.",
                es: "Saber es hacer."
            }
        }
    },
    {
        id: "cit_epicteto_ovelhas_01",
        author: "epictetus",
        original_text: {
            pt: "Pois as ovelhas não vomitam a grama para mostrar aos pastores o quanto comeram; mas, digerindo-a internamente, produzem lã e leite.",
            en: "For sheep don't throw up the grass to show the shepherds how much they have eaten; but, inwardly digesting their food, they outwardly produce wool and milk.",
            es: "Pues las ovejas no vomitan la hierba para mostrar a los pastores cuánto han comido; sino que, digiriéndola interiormente, producen lana y leche."
        },
        source: "Enchiridion, 46",
        metadata: {
            virtue: "Wisdom",
            level: 2,
            discipline: "Action",
            sphere: "Social",
            tags: ["action", "example", "growth", "authenticity", "learning", "influence"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "Não fale. Mostre resultados.",
                en: "Don't speak. Show results.",
                es: "No hables. Muestra resultados."
            },
            level_2: {
                pt: "Digira seus princípios e deixe que eles se manifestem em caráter. A filosofia não é para ser exibida, mas encarnada.",
                en: "Digest your principles and let them manifest in character. Philosophy is not to be displayed, but embodied.",
                es: "Digiere tus principios y deja que se manifiesten en carácter. La filosofía no es para ser exhibida, sino encarnada."
            },
            level_3: {
                pt: "Não vomite a grama.",
                en: "Don't vomit the grass.",
                es: "No vomites la hierba."
            }
        }
    },
    {
        id: "cit_marco_essencial_01",
        author: "marcusAurelius",
        original_text: {
            pt: "Se queres ser tranquilo, faça poucas coisas. Fazer menos, mas melhor.",
            en: "If thou wouldst be tranquil, do a few things. Do less, better.",
            es: "Si quieres estar tranquilo, haz pocas cosas. Haz menos, pero mejor."
        },
        source: "Meditações, IV.24",
        metadata: {
            virtue: "Temperance",
            level: 2,
            discipline: "Action",
            sphere: "Structural",
            tags: ["essentialism", "focus", "peace", "simplicity", "action"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Faça menos. Faça melhor.",
                en: "Do less. Do better.",
                es: "Haz menos. Haz mejor."
            },
            level_2: {
                pt: "A maioria das nossas ações é dispensável. Pergunte-se a cada momento: 'Isso é necessário?'.",
                en: "Most of our actions are dispensable. Ask yourself at every moment: 'Is this necessary?'.",
                es: "La mayoría de nuestras acciones son prescindibles. Pregúntate en cada momento: '¿Es esto necesario?'."
            },
            level_3: {
                pt: "Faça menos, melhor.",
                en: "Do less, better.",
                es: "Haz menos, mejor."
            }
        }
    },
    {
        id: "cit_seneca_ousadia_01",
        author: "seneca",
        original_text: {
            pt: "Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.",
            en: "It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult.",
            es: "No es porque las cosas son difíciles que no te atreves; es porque no nos atrevemos que son difíciles."
        },
        source: "Cartas a Lucílio, 104",
        metadata: {
            virtue: "Courage",
            level: 1,
            discipline: "Action",
            sphere: "Mental",
            tags: ["courage", "fear", "action", "confidence", "laziness"],
            coercion_type: "Inspirational"
        },
        adaptations: {
            level_1: {
                pt: "É difícil porque não ousa. Tente.",
                en: "Hard because you don't dare. Try.",
                es: "Difícil porque no te atreves. Intenta."
            },
            level_2: {
                pt: "A inércia cria monstros imaginários. A ação dissipa o medo e revela a verdadeira dimensão do desafio.",
                en: "Inertia creates imaginary monsters. Action dispels fear and reveals the true dimension of the challenge.",
                es: "La inercia crea monstruos imaginarios. La acción disipa el miedo y revela la verdadera dimensión del desafío."
            },
            level_3: {
                pt: "Ouse e vencerá.",
                en: "Dare and you will win.",
                es: "Atrévete y vencerás."
            }
        }
    },
    {
        id: "quote_ze_001",
        author: "zeno",
        original_text: {
            pt: "O bem-estar é alcançado através de pequenos passos, mas não é uma coisa pequena.",
            en: "Well-being is realized by small steps, but is truly no small thing.",
            es: "El bienestar se logra con pequeños pasos, pero no es algo pequeño.",
        },
        source: "Diogenes Laertius, Vidas dos Filósofos",
        metadata: {
            virtue: "Justice",
            level: 1,
            discipline: "Action",
            sphere: "Structural",
            tags: ["action", "discipline", "consistency", "habit", "growth", "morning", "hope"],
            coercion_type: "Inspirational"
        },
        adaptations: {
            level_1: {
                pt: "Passos curtos. Grandes distâncias.",
                en: "Small steps. Big changes.",
                es: "Pequeños pasos. Grandes cambios."
            },
            level_2: {
                pt: "A excelência não é um ato, mas um hábito. Cada pequeno passo que você dá hoje constrói seu bem-estar amanhã.",
                en: "Excellence is not an act, but a habit. Every small step you take today builds your well-being tomorrow.",
                es: "La excelencia no es un acto, sino un hábito. Cada pequeño paso que das hoy construye tu bienestar de mañana."
            },
            level_3: {
                pt: "Pequenos passos, grande bem-estar.",
                en: "Small steps, great well-being.",
                es: "Pequeños pasos, gran bienestar."
            }
        }
    },
    {
        id: "cit_seneca_inibicao_01",
        author: "seneca",
        original_text: {
            pt: "Devemos tratar o corpo com algum rigor, para que não seja desobediente à mente.",
            en: "We must treat the body with some rigour, so that it may not be disobedient to the mind.",
            es: "Debemos tratar el cuerpo con cierto rigor, para que no sea desobediente a la mente.",
        },
        source: "Cartas a Lucílio, VIII",
        metadata: {
            virtue: "Courage",
            level: 1,
            discipline: "Desire",
            sphere: "Biological",
            tags: ["body", "pain", "endurance", "cold", "discomfort", "discipline", "action"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Busque o desconforto. Liberte-se.",
                en: "Seek discomfort. Be free.",
                es: "Busca la incomodidad. Sé libre."
            },
            level_2: {
                pt: "Ao suportar o frio e a fome, lembro ao meu corpo quem comanda. O rigor físico fortalece a vontade.",
                en: "By enduring cold and hunger, I remind my body who is in charge. Physical rigour strengthens the will.",
                es: "Al soportar o frio e o hambre, recuerdo a mi cuerpo quién manda. El rigor físico fortalece la voluntad."
            },
            level_3: {
                pt: "Suportar e abster-se.",
                en: "Endure and renounce.",
                es: "Soportar y renunciar."
            }
        }
    },
    {
        id: "cit_socrates_movimento_01",
        author: "socrates",
        original_text: {
            pt: "É uma desgraça envelhecer por puro descuido antes de ver que tipo de homem você pode se tornar desenvolvendo sua força corporal e beleza ao seu limite máximo.",
            en: "It is a disgrace to grow old through sheer carelessness before seeing what manner of man you may become by developing your bodily strength and beauty to their highest limit.",
            es: "Es una desgracia envejecer por puro descuido antes de ver qué tipo de hombre puedes llegar a ser desarrollando tu fuerza corporal y belleza hasta su límite máximo.",
        },
        source: "Xenophon, Memorabilia",
        metadata: {
            virtue: "Courage",
            level: 1,
            discipline: "Action",
            sphere: "Structural",
            tags: ["strength", "body", "action", "potential", "discipline", "urgency"],
            coercion_type: "Inspirational"
        },
        adaptations: {
            level_1: {
                pt: "Corpo forte, mente servida.",
                en: "Strong body, served mind.",
                es: "Cuerpo fuerte, mente servida."
            },
            level_2: {
                pt: "Um corpo fraco comanda a mente; um corpo forte obedece. Treine para a funcionalidade, não para a vaidade.",
                en: "A weak body commands the mind; a strong body obeys. Train for functionality, not vanity.",
                es: "Un cuerpo débil manda a la mente; un cuerpo fuerte obedece. Entrena para la funcionalidad, no para la vanidad."
            },
            level_3: {
                pt: "Corpo forte, mente livre.",
                en: "Strong body, free mind.",
                es: "Cuerpo fuerte, mente libre."
            }
        }
    },
    {
        id: "cit_marco_ordem_01",
        author: "marcusAurelius",
        original_text: {
            pt: "Que nenhum ato seja feito sem propósito, nem de outra forma que não de acordo com um princípio perfeito da arte.",
            en: "Let no act be done without a purpose, nor otherwise than according to the perfect principles of art.",
            es: "Que ningún acto se haga sin propósito, ni de otra manera que no sea de acuerdo con un principio perfecto del arte.",
        },
        source: "Meditações, IV.2",
        metadata: {
            virtue: "Temperance",
            level: 1,
            discipline: "Action",
            sphere: "Structural",
            tags: ["discipline", "order", "focus", "simplicity", "evening", "action"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Organize fora. Ordene dentro.",
                en: "Organize outside. Order inside.",
                es: "Organiza fuera. Ordena dentro."
            },
            level_2: {
                pt: "A desordem externa é um ruído para a razão. Elimine o supérfluo e organize o essencial.",
                en: "External disorder is noise to reason. Eliminate the superfluous and organize the essential.",
                es: "El desorden externo es ruido para la razón. Elimina lo superfluo y organiza lo esencial."
            },
            level_3: {
                pt: "Kosmos: Ordem e Beleza.",
                en: "Kosmos: Order and Beauty.",
                es: "Kosmos: Orden y Belleza."
            }
        }
    },
    {
        id: "cit_marco_compostura_01",
        author: "marcusAurelius",
        original_text: {
            pt: "É preciso compor o corpo inteiro, para que não haja nele nada de desordenado ou afetado; pois o mesmo caráter que a mente manifesta no rosto deve ser exigido do corpo inteiro.",
            en: "To have the face also obedient to the mind and allowing the mind to regulate its expression and its composition... this must be required of the whole body.",
            es: "Es necesario componer todo el cuerpo, para que no haya en él nada desordenado o afectado; pues el mismo carácter que la mente manifiesta en el rostro debe exigirse de todo el cuerpo.",
        },
        source: "Meditações, VII.60",
        metadata: {
            virtue: "Justice",
            level: 1,
            discipline: "Action",
            sphere: "Biological",
            tags: ["body", "character", "mindfulness", "action", "discipline"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Postura ereta. Mente firme.",
                en: "Upright posture. Firm mind.",
                es: "Postura recta. Mente firme."
            },
            level_2: {
                pt: "Não deixe que seu corpo traia sua filosofia. A dignidade física é uma extensão da dignidade moral.",
                en: "Do not let your body betray your philosophy. Physical dignity is an extension of moral dignity.",
                es: "No dejes que tu cuerpo traicione tu filosofia. La dignidad física es una extensión de la dignidad moral."
            },
            level_3: {
                pt: "Corpo ordenado, mente ordenada.",
                en: "Ordered body, ordered mind.",
                es: "Cuerpo ordenado, mente ordenada."
            }
        }
    },
    {
        id: "cit_marco_urgencia_01",
        author: "marcusAurelius",
        original_text: {
            pt: "Você pode deixar a vida agora. Que isso determine o que você faz, diz e pensa.",
            en: "You could leave life right now. Let that determine what you do and say and think.",
            es: "Podrías dejar la vida ahora mismo. Que eso determine lo que haces, dices y piensas."
        },
        source: "Meditações, II.11",
        metadata: {
            virtue: "Courage",
            level: 1,
            discipline: "Action",
            sphere: "Structural",
            tags: ["death", "urgency", "action", "focus", "time", "truth"],
            coercion_type: "Dogmatic"
        },
        adaptations: {
            level_1: {
                pt: "E se fosse o último dia? Aja.",
                en: "What if it's the last day? Act.",
                es: "¿Y si fuera el último día? Actúa."
            },
            level_2: {
                pt: "Memento Mori: A consciência da morte não deve causar medo, mas clareza e ação imediata.",
                en: "Memento Mori: The awareness of death should not cause fear, but clarity and action immediate.",
                es: "Memento Mori: La conciencia de la muerte no debe causar miedo, sino claridad y acción inmediata."
            },
            level_3: {
                pt: "Você pode partir agora.",
                en: "You could leave now.",
                es: "Podrías irte ahora."
            }
        }
    },
    {
        id: "cit_seneca_lugarnenhum_01",
        author: "seneca",
        original_text: {
            pt: "Estar em todo lugar é estar em lugar nenhum.",
            en: "To be everywhere is to be nowhere.",
            es: "Estar en todas partes es no estar en ninguna."
        },
        source: "Cartas a Lucílio, II",
        metadata: {
            virtue: "Wisdom",
            level: 1,
            discipline: "Action",
            sphere: "Mental",
            tags: ["focus", "distraction", "presence", "attention", "action"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Uma coisa de cada vez. Foco.",
                en: "One thing at a time. Focus.",
                es: "Una cosa a la vez. Foco."
            },
            level_2: {
                pt: "A dispersão enfraquece a mente. Limite seus objetivos e aprofunde sua atenção em um ponto de cada vez.",
                en: "Dispersion weakens the mind. Limit your goals and deepen your attention on one point at a time.",
                es: "La dispersión debilita la mente. Limita tus objetivos y profundiza tu atención en un punto a la vez."
            },
            level_3: {
                pt: "Um foco, uma ação.",
                en: "One focus, one action.",
                es: "Un foco, una acción."
            }
        }
    }
];

// --- CATEGORY 3: RESILIENCE & RECOVERY (The Shield) ---
const RESILIENCE_QUOTES: Quote[] = [
    {
        id: "quote_ma_002",
        author: "marcusAurelius",
        original_text: {
            pt: "O obstáculo à ação avança a ação. O que fica no caminho se torna o caminho.",
            en: "The impediment to action advances action. What stands in the way becomes the way.",
            es: "El impedimento a la acción avanza la acción. Lo que se interpone en el camino se convierte en el camino.",
        },
        source: "Meditações, V.20",
        metadata: {
            virtue: "Courage",
            level: 3,
            discipline: "Action",
            sphere: "Structural",
            tags: ["resilience", "action", "suffering", "perspective", "chaos", "strength", "acceptance"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "O obstáculo é o caminho.",
                en: "The obstacle is the way.",
                es: "El obstáculo es el camino."
            },
            level_2: {
                pt: "Transforme seus obstáculos em degraus. O desafio à sua frente é o seu verdadeiro caminho.",
                en: "Turn your obstacles into stepping stones. The challenge in front of you is your true path.",
                es: "Convierte tus obstáculos en peldaños. El desafío que tienes delante es tu verdadero camino."
            },
            level_3: {
                pt: "O obstáculo é o caminho.",
                en: "The obstacle is the way.",
                es: "El obstáculo es el camino."
            }
        }
    },
    {
        id: "cit_seneca_resiliencia_02",
        author: "seneca",
        original_text: {
            pt: "O fogo prova o ouro; a miséria, os homens fortes.",
            en: "Fire tests gold, suffering tests brave men.",
            es: "El fuego prueba el oro; la miseria, a los hombres fuertes."
        },
        source: "De Providentia, 5.9",
        metadata: {
            virtue: "Courage",
            level: 3,
            discipline: "Action",
            sphere: "Structural",
            tags: ["resilience", "suffering", "strength", "fate", "healing"],
            coercion_type: "Inspirational"
        },
        adaptations: {
            level_1: {
                pt: "Dificuldade é prova. Mostre força.",
                en: "Difficulty is a test. Show strength.",
                es: "La dificultad es prueba. Muestra fuerza."
            },
            level_2: {
                pt: "A adversidade não é um castigo, é um treinamento. Use este momento de falha para temperar seu caráter.",
                en: "Adversity is not punishment, it is training. Use this moment of failure to temper your character.",
                es: "La adversidad no es un castigo, es un entrenamiento. Usa este momento de fallo para templar tu carácter."
            },
            level_3: {
                pt: "O fogo prova o ouro.",
                en: "Fire tests gold.",
                es: "El fuego prueba el oro."
            }
        }
    },
    {
        id: "cit_marco_fogo_01",
        author: "marcusAurelius",
        original_text: {
            pt: "Um fogo forte se apropria de tudo que é jogado nele, consome-o e se eleva ainda mais alto por causa disso.",
            en: "A blazing fire makes flame and brightness out of everything that is thrown into it.",
            es: "Un fuego fuerte se apropia de todo lo que se arroja en él, lo consume y se eleva aún más alto gracias a ello."
        },
        source: "Meditações, IV.1",
        metadata: {
            virtue: "Courage",
            level: 3,
            discipline: "Action",
            sphere: "Structural",
            tags: ["resilience", "amor fati", "strength", "conversion", "acceptance"],
            coercion_type: "Inspirational"
        },
        adaptations: {
            level_1: {
                pt: "Seja fogo. Consuma o obstáculo.",
                en: "Be fire. Consume the obstacle.",
                es: "Sé fuego. Consume el obstáculo."
            },
            level_2: {
                pt: "Seja como o fogo voraz, não como a vela frágil. Transforme o obstáculo em parte da sua própria chama.",
                en: "Be like the voracious fire, not like the fragile candle. Transform the obstacle into part of your own flame.",
                es: "Sé como el fuego voraz, no como la vela frágil. Transforma el obstáculo en parte de tu propia llama."
            },
            level_3: {
                pt: "Tudo é combustível.",
                en: "Everything is fuel.",
                es: "Todo es combustible."
            }
        }
    },
    {
        id: "cit_marco_promontorio_01",
        author: "marcusAurelius",
        original_text: {
            pt: "Seja como o promontório contra o qual as ondas quebram continuamente, mas ele permanece firme e doma a fúria da água ao seu redor.",
            en: "Be like the promontory against which the waves continually break, but it stands firm and tames the fury of the water around it.",
            es: "Sé como el promontorio contra el que las olas rompen continuamente, pero se mantiene firme y doma la furia del agua a su alrededor."
        },
        source: "Meditações, IV.49",
        metadata: {
            virtue: "Courage",
            level: 2,
            discipline: "Action",
            sphere: "Mental",
            tags: ["resilience", "stability", "anger", "chaos", "strength", "patience"],
            coercion_type: "Inspirational"
        },
        adaptations: {
            level_1: {
                pt: "Seja rocha. Quebre a onda.",
                en: "Be rock. Break the wave.",
                es: "Sé roca. Rompe la ola."
            },
            level_2: {
                pt: "A estabilidade interna derrota a turbulência externa. Seja a rocha que quebra a onda, não a madeira que é levada por ela.",
                en: "Internal stability defeats external turbulence. Be the rock that breaks the wave, not the wood carried by it.",
                es: "La estabilidad interna derrota la turbulencia externa. Sé la roca que rompe la ola, no la madera llevada por ella."
            },
            level_3: {
                pt: "Seja o promontório.",
                en: "Be the promontory.",
                es: "Sé el promontorio."
            }
        }
    },
    {
        id: "cit_marco_identidade_01",
        author: "marcusAurelius",
        original_text: {
            pt: "Cave dentro de si. Dentro está a fonte do bem, e ela sempre jorrará se você sempre cavar.",
            en: "Dig within. Within is the wellspring of good; and it is always ready to bubble up, if you just dig.",
            es: "Cava dentro de ti. Dentro está la fuente del bien, y siempre brotará si siempre cavas."
        },
        source: "Meditações, VII.59",
        metadata: {
            virtue: "Wisdom",
            level: 2,
            discipline: "Desire",
            sphere: "Mental",
            tags: ["healing", "identity", "virtue", "potential", "hope", "will", "recovery", "resilience"],
            coercion_type: "Inspirational"
        },
        adaptations: {
            level_1: {
                pt: "Cave dentro. Encontre a fonte.",
                en: "Dig within. The source is there.",
                es: "Cava dentro. La fuente está ahí."
            },
            level_2: {
                pt: "O Hegemonikon (faculdade dirigente) é autossuficiente. A virtude não depende de circunstâncias externas.",
                en: "The Hegemonikon (ruling faculty) is self-sufficient. Virtue does not depend on external circumstances.",
                es: "El Hegemonikon (facultad rectora) es autosuficiente. La virtud no depende de circunstancias externas."
            },
            level_3: {
                pt: "A fonte está dentro.",
                en: "The source is within.",
                es: "La fuente está dentro."
            }
        }
    },
    {
        id: "cit_epicteto_papel_01",
        author: "epictetus",
        original_text: {
            pt: "Lembre-se de que você é um ator em uma peça... Sua função é atuar bem o papel designado; escolhê-lo cabe a outro.",
            en: "Remember that you are an actor in a drama... For this is your business, to act well the character assigned you; to choose it is another's.",
            es: "Recuerda que eres un actor en una obra... Tu función es representar bien el papel asignado; elegirlo corresponde a otro."
        },
        source: "Enchiridion, 17",
        metadata: {
            virtue: "Wisdom",
            level: 2,
            discipline: "Desire",
            sphere: "Social",
            tags: ["fate", "acceptance", "duty", "role", "resilience"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "Aceite seu papel. Atue bem.",
                en: "Accept your role. Act well.",
                es: "Acepta tu papel. Actúa bien."
            },
            level_2: {
                pt: "Amor Fati: Aceite o roteiro do destino. Sua excelência não está no que acontece, mas em como você performa seu papel.",
                en: "Amor Fati: Accept fate's script. Your excellence is not in what happens, but in how you perform your role.",
                es: "Amor Fati: Acepta el guion del destino. Tu excelencia no está en lo que sucede, sino en cómo representas tu papel."
            },
            level_3: {
                pt: "Atue bem seu papel.",
                en: "Act your role well.",
                es: "Actúa bien tu papel."
            }
        }
    },
    {
        id: "cit_seneca_cura_01",
        author: "seneca",
        original_text: {
            pt: "É parte da cura o desejo de ser curado.",
            en: "It is part of the cure to wish to be cured.",
            es: "Es parte de la cura el deseo de ser curado."
        },
        source: "Fedra, 249",
        metadata: {
            virtue: "Courage",
            level: 1,
            discipline: "Desire",
            sphere: "Mental",
            tags: ["healing", "mindset", "will", "recovery", "resilience"],
            coercion_type: "Inspirational"
        },
        adaptations: {
            level_1: {
                pt: "Deseje a cura. Comece agora.",
                en: "Wish for cure. Start now.",
                es: "Desea la cura. Empieza ahora."
            },
            level_2: {
                pt: "A vontade ativa direcionada à virtude já é o início da virtude. Não subestime sua intenção.",
                en: "Active will directed towards virtue is already the beginning of virtue. Do not underestimate your intention.",
                es: "La voluntad activa dirigida hacia la virtud ya es el comienzo de la virtud. No subestimes tu intención."
            },
            level_3: {
                pt: "Desejar a cura é cura.",
                en: "To wish for cure is cure.",
                es: "Desear la cura es cura."
            }
        }
    },
    {
        id: "cit_seneca_infelicidade_01",
        author: "seneca",
        original_text: {
            pt: "Ninguém é mais infeliz do que aquele a quem a adversidade esqueceu, pois não lhe foi permitido provar-se.",
            en: "No man is more unhappy than he who has never faced adversity. For he is not permitted to prove himself.",
            es: "Nadie es más infeliz que aquel a quien la adversidad olvida, pues no se le permite probarse a sí mismo."
        },
        source: "De Providentia, III",
        metadata: {
            virtue: "Courage",
            level: 3,
            discipline: "Action",
            sphere: "Structural",
            tags: ["resilience", "suffering", "potential", "strength", "fate"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "Sem teste, sem força. Abrace a luta.",
                en: "No test, no strength. Embrace the struggle.",
                es: "Sin prueba, sin fuerza. Abraza la lucha."
            },
            level_2: {
                pt: "Uma vida sem desafios é uma tragédia, pois deixa a virtude adormecida. Abrace a luta.",
                en: "A life without challenges is a tragedy, for it leaves virtue dormant. Embrace the struggle.",
                es: "Una vida sin desafíos es una tragedia, pues deja la virtud dormida. Abraza la lucha."
            },
            level_3: {
                pt: "Prove-se na adversidade.",
                en: "Prove yourself in adversity.",
                es: "Pruébate en la adversidad."
            }
        }
    },
    {
        id: "cit_musonio_esforco_01",
        author: "musoniusRufus",
        original_text: {
            pt: "Se você trabalhar duro para fazer o que é certo, a dor passa, mas o bem permanece.",
            en: "If you accomplish something good with hard work, the labor passes, but the good remains.",
            es: "Si logras algo bueno con trabajo duro, el esfuerzo pasa, pero el bien permanece."
        },
        source: "Fragmentos",
        metadata: {
            virtue: "Courage",
            level: 2,
            discipline: "Action",
            sphere: "Structural",
            tags: ["endurance", "pain", "pleasure", "virtue", "legacy"],
            coercion_type: "Inspirational"
        },
        adaptations: {
            level_1: {
                pt: "A dor passa. O bem fica.",
                en: "Pain passes. Good remains.",
                es: "El dolor pasa. El bien queda."
            },
            level_2: {
                pt: "Troque o prazer imediato pela satisfação duradoura. O esforço se dissipa, a virtude se acumula.",
                en: "Trade immediate pleasure for lasting satisfaction. Effort dissipates, virtue accumulates.",
                es: "Cambia el placer inmediato por la satisfacción duradera. El esfuerzo se disipa, la virtud se acumula."
            },
            level_3: {
                pt: "A dor passa, o bem fica.",
                en: "Pain passes, good remains.",
                es: "El dolor pasa, el bien queda."
            }
        }
    }
];

// --- CATEGORY 4: EQUILIBRIUM & TEMPERANCE (The Balance) ---
const EQUILIBRIUM_QUOTES: Quote[] = [
    {
        id: "cit_marco_aceitacao_03",
        author: "marcusAurelius",
        original_text: {
            pt: "Receba sem orgulho, largue sem apego.",
            en: "Receive without pride, let go without attachment.",
            es: "Recibe sin orgullo, suelta sin apego."
        },
        source: "Meditações, VIII.33",
        metadata: {
            virtue: "Temperance",
            level: 3,
            discipline: "Desire",
            sphere: "Mental",
            tags: ["humility", "wealth", "fortune", "acceptance", "simplicity"],
            coercion_type: "Dogmatic"
        },
        adaptations: {
            level_1: {
                pt: "Ganhe sem orgulho. Perca sem choro.",
                en: "Win without pride. Lose without tears.",
                es: "Gana sin orgullo. Pierde sin llanto."
            },
            level_2: {
                pt: "Trate o sucesso como um empréstimo da Fortuna, não como mérito eterno. Esteja pronto para devolvê-lo.",
                en: "Treat success as a loan from Fortune, not eternal merit. Be ready to return it.",
                es: "Trata el éxito como un préstamo de la Fortuna, no como mérito eterno. Prepárate para devolverlo."
            },
            level_3: {
                pt: "Sem orgulho, sem apego.",
                en: "No pride, no attachment.",
                es: "Sin orgullo, sin apego."
            }
        }
    },
    {
        id: "cit_marco_incenso_01",
        author: "marcusAurelius",
        original_text: {
            pt: "Muitos grãos de incenso no mesmo altar: um cai antes, outro depois, mas não faz diferença.",
            en: "Many lumps of incense on the same altar: one falls earlier, another later, but it makes no difference.",
            es: "Muchos granos de incienso en el mismo altar: uno cae antes, otro después, pero no hay diferencia."
        },
        source: "Meditações, IV.15",
        metadata: {
            virtue: "Temperance",
            level: 3,
            discipline: "Desire",
            sphere: "Mental",
            tags: ["humility", "fate", "impermanence", "nature", "equality"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "Cedo ou tarde, o fim é igual.",
                en: "Sooner or later, the end is the same.",
                es: "Tarde o temprano, el final es igual."
            },
            level_2: {
                pt: "Tempo e fama são ilusões. Cumpra sua função no tempo que lhe foi dado sem inveja ou arrogância.",
                en: "Time and fame are illusions. Fulfill your function in the time given to you without envy or arrogance.",
                es: "El tiempo y la fama son ilusiones. Cumple tu función en el tiempo que se te ha dado sin envidia ni arrogancia."
            },
            level_3: {
                pt: "Antes ou depois, não importa.",
                en: "Sooner or later, it matters not.",
                es: "Antes o depois, no importa."
            }
        }
    },
    {
        id: "cit_epicteto_gratidao_01",
        author: "epictetus",
        original_text: {
            pt: "É um homem sábio aquele que não se entristece pelas coisas que não tem, mas se alegra com as que tem.",
            en: "He is a wise man who does not grieve for the things which he has not, but rejoices for those which he has.",
            es: "Es un hombre sabio el que no se entristece por las cosas que no tiene, sino que se alegra por las que tiene.",
        },
        source: "Fragmentos",
        metadata: {
            virtue: "Justice",
            level: 1,
            discipline: "Desire",
            sphere: "Mental",
            tags: ["gratitude", "happiness", "perspective", "acceptance", "evening", "resilience"],
            coercion_type: "Inspirational"
        },
        adaptations: {
            level_1: {
                pt: "Foque no que tem. Agradeça.",
                en: "Focus on what you have. Be grateful.",
                es: "Enfócate en lo que tienes. Agradece."
            },
            level_2: {
                pt: "Não foque na falta, mas na suficiência. A alegria vem de apreciar o presente como uma dádiva.",
                en: "Do not focus on lack, but on sufficiency. Joy comes from appreciating the present as a gift.",
                es: "No te enfoques en la falta, sino en la suficiencia. La alegría viene de apreciar el presente como un regalo."
            },
            level_3: {
                pt: "Eucharistia: Ação de Graças.",
                en: "Eucharistia: Thanksgiving.",
                es: "Eucharistia: Acción de Gracias."
            }
        }
    },
    {
        id: "cit_epicteto_abstine_01",
        author: "epictetus",
        original_text: {
            pt: "Nenhum homem é livre se não é dono de si mesmo.",
            en: "No man is free who is not master of himself.",
            es: "Ningún hombre es libre si no es dueño de sí mesmo.",
        },
        source: "Fragmentos",
        metadata: {
            virtue: "Temperance",
            level: 1,
            discipline: "Desire",
            sphere: "Mental",
            tags: ["freedom", "control", "desire", "temperance", "discipline", "strength"],
            coercion_type: "Dogmatic"
        },
        adaptations: {
            level_1: {
                pt: "Sem domínio, sem liberdade.",
                en: "No mastery, no freedom.",
                es: "Sin dominio, sin libertad."
            },
            level_2: {
                pt: "Liberdade não é fazer o que se quer, mas ter poder sobre o que se deseja. Negue o impulso para afirmar a razão.",
                en: "Freedom is not doing what you want, but having power over what you desire. Deny the impulse to affirm reason.",
                es: "La libertad no es hacer lo que se quiere, sino tener poder sobre lo que se desea. Niega el impulso para afirmar la razón."
            },
            level_3: {
                pt: "Abster-se é liberdade.",
                en: "To abstain is freedom.",
                es: "Abstenerse es liberdade."
            }
        }
    },
    {
        id: "cit_epicteto_banquete_01",
        author: "epictetus",
        original_text: {
            pt: "Lembre-se que você deve se comportar na vida como em um banquete. Algo é trazido até você? Estenda a mão e pegue uma porção com moderação.",
            en: "Remember that you must behave in life as at a dinner party. Is anything brought around to you? Put out your hand and take your share with moderation.",
            es: "Recuerda que debes comportarte en la vida como en un banquete. ¿Te llega algo? Extiende la mano y toma tu parte con moderación."
        },
        source: "Enchiridion, 15",
        metadata: {
            virtue: "Temperance",
            level: 2,
            discipline: "Desire",
            sphere: "Social",
            tags: ["temperance", "desire", "patience", "social", "gratitude"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Espere sua vez. Sem ansiedade.",
                en: "Wait your turn. No anxiety.",
                es: "Espera tu turno. Sin ansiedad."
            },
            level_2: {
                pt: "Se a travessa passa direto, não a retenha. Se ainda não chegou, não estique seu desejo em direção a ela. Assim deve ser com filhos, esposa e cargos.",
                en: "If the dish passes you by, do not stop it. If it has not yet come, do not stretch your desire towards it. So it should be with children, wife, and offices.",
                es: "Si el plato pasa de largo, no lo detengas. Si aún no ha llegado, no estires tu deseo hacia él. Así debe ser con los hijos, la esposa y los cargos."
            },
            level_3: {
                pt: "Comporte-se como num banquete.",
                en: "Behave as at a banquet.",
                es: "Compórtate como en un banquete."
            }
        }
    },
    {
        id: "cit_musonio_rufo_nutricao_01",
        author: "musoniusRufus",
        original_text: {
            pt: "Que o alimento seja para o corpo o que a filosofia é para a alma: sustento, não luxo.",
            en: "Let food be for the body what philosophy is for the soul: sustenance, not luxury.",
            es: "Que el alimento sea para el cuerpo lo que la filosofía es para el alma: sustento, no lujo.",
        },
        source: "Fragmentos",
        metadata: {
            virtue: "Temperance",
            level: 1,
            discipline: "Desire",
            sphere: "Biological",
            tags: ["temperance", "health", "simplicity", "discipline", "body", "humility"],
            coercion_type: "Dogmatic"
        },
        adaptations: {
            level_1: {
                pt: "Coma para viver. Só.",
                en: "Eat to live. Only.",
                es: "Come para vivir. Solo."
            },
            level_2: {
                pt: "Seu corpo é uma ferramenta. Abasteça-o com intenção, assim como você alimenta sua mente com ideias virtuosas.",
                en: "Your body is a tool. Fuel it with intention, just as you feed your mind with virtuous ideas.",
                es: "Tu cuerpo es una herramienta. Abastécelo con intención, así como alimentas tu mente con ideas virtuosas."
            },
            level_3: {
                pt: "Sustento, não luxo.",
                en: "Sustenance, not luxury.",
                es: "Sustento, no lujo."
            }
        }
    },
    {
        id: "cit_seneca_paupertas_01",
        author: "seneca",
        original_text: {
            pt: "Reserve um certo número de dias, durante os quais você se contentará com a alimentação mais escassa e barata, com roupas grossas e ásperas, dizendo a si mesmo: 'É esta a condição que eu temia?'",
            en: "Set aside a certain number of days, during which you shall be content with the scantiest and cheapest fare, with coarse and rough dress, saying to yourself the while: 'Is this the condition that I feared?'",
            es: "Reserva un cierto número de días, durante los cuales te contentarás con la comida más escasa y barata, con vestidos toscos y ásperos, diciéndote a ti mismo: '¿Es esta la condición que temía?'",
        },
        source: "Cartas a Lucílio, XVIII",
        metadata: {
            virtue: "Courage",
            level: 1,
            discipline: "Desire",
            sphere: "Biological",
            tags: ["resilience", "temperance", "fear", "poverty", "discomfort", "humility"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Teste a escassez. Você aguenta.",
                en: "Test scarcity. You can handle it.",
                es: "Prueba la escasez. Aguantarás."
            },
            level_2: {
                pt: "O medo da escassez é pior que a escassez. Treine-se para precisar de pouco e você será livre.",
                en: "The fear of scarcity is worse than scarcity itself. Train yourself to need little, and you will be free.",
                es: "El medo a la escasez es peor que la escasez misma. Entrénate para necesitar poco y serás libre."
            },
            level_3: {
                pt: "É isso que eu temia?",
                en: "Is this what I feared?",
                es: "¿Es esto lo que temía?"
            }
        }
    },
    {
        id: "cit_marco_presenca_01",
        author: "marcusAurelius",
        original_text: {
            pt: "Dê a si mesmo um presente: o momento presente.",
            en: "Give yourself a gift: the present moment.",
            es: "Date un regalo: el momento presente.",
        },
        source: "Meditações", 
        metadata: {
            virtue: "Temperance",
            level: 1,
            discipline: "Desire",
            sphere: "Biological",
            tags: ["focus", "presence", "mindfulness", "breath", "morning", "gratitude"],
            coercion_type: "Inspirational"
        },
        adaptations: {
            level_1: {
                pt: "Esteja aqui. Respire.",
                en: "Be here. Breathe.",
                es: "Esté aquí. Respira."
            },
            level_2: {
                pt: "A respiração é a âncora da alma. Volte a ela e encontre a ordem em meio ao caos.",
                en: "Breath is the anchor of the soul. Return to it and find order amidst chaos.",
                es: "La respiración es el ancla del alma. Vuelve a ella y encuentra orden en medio del caos."
            },
            level_3: {
                pt: "Fôlego é domínio.",
                en: "Breath is mastery.",
                es: "El aliento es dominio."
            }
        }
    },
    {
        id: "cit_marco_raiva_01",
        author: "marcusAurelius",
        original_text: {
            pt: "Quão mais graves são as consequências da raiva do que as suas causas.",
            en: "How much more grievous are the consequences of anger than the causes of it.",
            es: "Cuánto más graves son las consecuencias de la ira que sus causas."
        },
        source: "Meditações, XI.18",
        metadata: {
            virtue: "Temperance",
            level: 2,
            discipline: "Assent",
            sphere: "Social",
            tags: ["anger", "patience", "emotion", "judgment", "consequences"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "A raiva destrói você. Não reaja.",
                en: "Anger hurts more. Don't react.",
                es: "La ira hiere más. No reacciones."
            },
            level_2: {
                pt: "A ofensa é externa; a raiva é interna. Não adicione seu próprio dano ao dano que o mundo lhe causou.",
                en: "The offense is external; anger is internal. Do not add your own harm to the harm the world has caused you.",
                es: "La ofensa es externa; la ira es interna. No añadas tu propio daño al daño que el mundo te ha causado."
            },
            level_3: {
                pt: "A raiva fere mais que a ofensa.",
                en: "Anger hurts more than the offense.",
                es: "La ira hiere más que la ofensa."
            }
        }
    },
    {
        id: "cit_seneca_raiva_02",
        author: "seneca",
        original_text: {
            pt: "O maior remédio para a raiva é o adiamento.",
            en: "The greatest remedy for anger is delay.",
            es: "El mayor remedio para la ira es la demora.",
        },
        source: "Sobre a Ira, II.29",
        metadata: {
            virtue: "Temperance",
            level: 1,
            discipline: "Assent",
            sphere: "Social",
            tags: ["anger", "patience", "time", "self-control", "emotion"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Raiva? Espere. O tempo cura.",
                en: "Anger? Wait. Time heals.",
                es: "¿Ira? Espera. El tiempo cura."
            },
            level_2: {
                pt: "Não peça perdão à raiva, peça tempo. O julgamento precipitado erra; o tempo revela a verdade.",
                en: "Do not ask anger for pardon, ask for time. Hasty judgment errs; time reveals truth.",
                es: "No pidas perdón a la ira, pide tiempo. El juicio precipitado yerra; el tiempo revela la verdad."
            },
            level_3: {
                pt: "Adie a reação.",
                en: "Delay the reaction.",
                es: "Retrasa la reacción."
            }
        }
    },
    {
        id: "cit_marco_esmeralda_01",
        author: "marcusAurelius",
        original_text: {
            pt: "Uma esmeralda perde sua qualidade se não for elogiada?",
            en: "Does an emerald lose its quality if it is not praised?",
            es: "¿Pierde una esmeralda su calidad si no es elogiada?",
        },
        source: "Meditações, IV.20",
        metadata: {
            virtue: "Temperance",
            level: 2,
            discipline: "Desire",
            sphere: "Mental",
            tags: ["humility", "character", "integrity", "praise"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "Ignore o aplauso. Conheça seu valor.",
                en: "Your value is internal. Ignore praise.",
                es: "Tu valor es interno. Igora elogios."
            },
            level_2: {
                pt: "A beleza é autossuficiente. Busque ser virtuoso, não ser reconhecido como tal.",
                en: "Beauty is self-sufficient. Seek to be virtuous, not to be recognized as such.",
                es: "La belleza es autosuficiente. Busca ser virtuoso, no ser reconocido como tal."
            },
            level_3: {
                pt: "Seja, não pareça.",
                en: "Be, do not seem.",
                es: "Sé, no parezcas."
            }
        }
    }
];

// --- CATEGORY 5: SOCIAL & JUSTICE (The Commons) ---
const SOCIAL_QUOTES: Quote[] = [
    {
        id: "cit_marco_zelo_01",
        author: "marcusAurelius",
        original_text: {
            pt: "O que não é bom para a colmeia não pode ser bom para a abelha.",
            en: "That which is not good for the swarm, neither is it good for the bee.",
            es: "Lo que no es bueno para la colmena no puede ser bueno para la abeja.",
        },
        source: "Meditações, VI.54",
        metadata: {
            virtue: "Justice",
            level: 1,
            discipline: "Action",
            sphere: "Social",
            tags: ["community", "duty", "justice", "nature", "humility"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Ajude o grupo. Ajude a si mesmo.",
                en: "The good of all is your good.",
                es: "El bien de todos es tu bien."
            },
            level_2: {
                pt: "Sua natureza é social. Trabalhar pelo outro é trabalhar por si mesmo. Não se isole da humanidade.",
                en: "Your nature is social. To work for another is to work for yourself. Do not isolate yourself from humanity.",
                es: "Tu natureza es social. Trabajar por el otro es trabajar por ti mismo. No te aísles de la humanidad."
            },
            level_3: {
                pt: "Bem comum, bem próprio.",
                en: "Common good, own good.",
                es: "Bien común, bien propio."
            }
        }
    },
    {
        id: "cit_hierocles_circulos_01",
        author: "hierocles",
        original_text: {
            pt: "Cada um de nós está, por assim dizer, circunscrito por muitos círculos concêntricos... É tarefa de um homem bem-intencionado e justo atrair os círculos para o centro.",
            en: "Each one of us is as it were entirely encompassed by many circles... It is the task of a well-tempered man, in his proper treatment of each class, to draw the circles together somehow towards the centre.",
            es: "Cada uno de nosotros está, por así decirlo, circunscrito por muchos círculos concéntricos... Es tarea de un hombre bien intencionado y justo atraer los círculos hacia el centro.",
        },
        source: "Sobre os Deveres",
        metadata: {
            virtue: "Justice",
            level: 2,
            discipline: "Action",
            sphere: "Social",
            tags: ["community", "love", "duty", "kindness", "humility"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Cuide dos seus. Traga-os para perto.",
                en: "Care for yours. Bring them close.",
                es: "Cuida a los tuyos. Tráelos cerca."
            },
            level_2: {
                pt: "Traga os distantes para perto. Veja sua família e amigos não como externos, mas como partes de você.",
                en: "Draw the distant near. See your family and friends not as external, but as parts of yourself.",
                es: "Trae a los distantes cerca. Ve a tu familia y amigos no como externos, sino como partes de ti."
            },
            level_3: {
                pt: "Oikeiosis: Apropriação Social.",
                en: "Oikeiosis: Social Appropriation.",
                es: "Oikeiosis: Apropiación Social."
            }
        }
    },
    {
        id: "cit_marco_ser_01",
        author: "marcusAurelius",
        original_text: {
            pt: "Não discuta mais sobre como deve ser um homem bom. Seja um.",
            en: "Waste no more time arguing about what a good man should be. Be one.",
            es: "No pierdas más tiempo discutiendo sobre cómo debe ser un hombre bueno. Sé uno."
        },
        source: "Meditações, X.16",
        metadata: {
            virtue: "Justice",
            level: 3,
            discipline: "Action",
            sphere: "Social",
            tags: ["action", "discipline", "consistency", "virtue", "character"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Pare de falar. Seja bom.",
                en: "Stop talking. Be good.",
                es: "Deja de hablar. Sé bueno."
            },
            level_2: {
                pt: "A filosofia não está no discurso, mas na conduta. A virtude só existe quando manifestada em 'Praxis'.",
                en: "Philosophy is not in speech, but in conduct. Virtue only exists when manifested in 'Praxis'.",
                es: "La filosofía no está en el discurso, sino en la conducta. La virtud solo existe cuando se manifiesta en 'Praxis'."
            },
            level_3: {
                pt: "Não fale, aja.",
                en: "Don't speak, act.",
                es: "No hables, actúa."
            }
        }
    },
    {
        id: "cit_epicteto_cidadao_01",
        author: "epictetus",
        original_text: {
            pt: "Você é um cidadão do mundo.",
            en: "You are a citizen of the world.",
            es: "Eres un ciudadano del mundo."
        },
        source: "Discursos, II.10",
        metadata: {
            virtue: "Justice",
            level: 2,
            discipline: "Action",
            sphere: "Social",
            tags: ["community", "duty", "cosmopolitanism", "identity", "nature"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "Você é do mundo. Aja assim.",
                en: "You are the world's. Act like it.",
                es: "Eres del mundo. Actúa así."
            },
            level_2: {
                pt: "Sua racionalidade o conecta a todos os outros seres racionais. Aja como parte do todo.",
                en: "Your rationality connects you to all other rational beings. Act as part of the whole.",
                es: "Tu racionalidad te conecta con todos los demás seres racionales. Actúa como parte del todo."
            },
            level_3: {
                pt: "Kosmopolites.",
                en: "Kosmopolites.",
                es: "Kosmopolites."
            }
        }
    },
    {
        id: "cit_seneca_amizade_01",
        author: "seneca",
        original_text: {
            pt: "Pondere por muito tempo se deve admitir alguém como amigo; mas quando decidir, receba-o de todo o coração.",
            en: "Ponder for a long time whether you shall admit a given person to your friendship; but when you have decided to admit him, welcome him with all your heart and soul.",
            es: "Pondera por mucho tiempo si debes admitir a alguien como amigo; pero cuando decidas, recíbelo de todo corazón."
        },
        source: "Cartas a Lucílio, III",
        metadata: {
            virtue: "Justice",
            level: 2,
            discipline: "Action",
            sphere: "Social",
            tags: ["friendship", "trust", "loyalty", "heart", "community"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Escolha bem. Confie totalmente.",
                en: "Choose well. Trust fully.",
                es: "Elige bien. Confía totalmente."
            },
            level_2: {
                pt: "A confiança é a alma da amizade. A dúvida constante é veneno para as relações.",
                en: "Trust is the soul of friendship. Constant doubt is poison to relationships.",
                es: "La confianza es el alma de la amistad. La duda constante es veneno para las relaciones."
            },
            level_3: {
                pt: "Confiança total ou nenhuma.",
                en: "Total trust or none.",
                es: "Confianza total o ninguna."
            }
        }
    },
    {
        id: "cit_marco_humanidade_01",
        author: "marcusAurelius",
        original_text: {
            pt: "Os homens existem uns para os outros.",
            en: "Men exist for the sake of one another.",
            es: "Los hombres existen unos para otros."
        },
        source: "Meditações, VIII.59",
        metadata: {
            virtue: "Justice",
            level: 1,
            discipline: "Action",
            sphere: "Social",
            tags: ["community", "kindness", "patience", "justice", "duty"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Ajude ou tolere.",
                en: "Help or tolerate.",
                es: "Ayuda o tolera."
            },
            level_2: {
                pt: "Sua função social é cooperar. A raiva contra o outro é uma falha contra a natureza humana.",
                en: "Your social function is to cooperate. Anger against another is a failure against human nature.",
                es: "Tu función social es cooperar. La ira contra el otro es una falla contra la naturaleza humana."
            },
            level_3: {
                pt: "Ensine ou tolere.",
                en: "Teach or tolerate.",
                es: "Enseña o tolera."
            }
        }
    },
    {
        id: "cit_marco_vinganca_01",
        author: "marcusAurelius",
        original_text: {
            pt: "A melhor vingança é ser diferente de quem causou o dano.",
            en: "The best revenge is to be unlike him who performed the injury.",
            es: "La mejor venganza es ser diferente a quien causó el daño."
        },
        source: "Meditações, VI.6",
        metadata: {
            virtue: "Justice",
            level: 3,
            discipline: "Action",
            sphere: "Social",
            tags: ["justice", "anger", "character", "forgiveness", "virtue"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Não imite o inimigo.",
                en: "Do not imitate the enemy.",
                es: "No imites al enemigo."
            },
            level_2: {
                pt: "A punição do vício é o próprio vício. Mantenha sua integridade e não deixe a maldade alheia corromper seu caráter.",
                en: "The punishment of vice is vice itself. Maintain your integrity and do not let others' malice corrupt your character.",
                es: "El castigo del vicio es el vicio mismo. Mantén tu integridad y no dejes que la maldad ajena corrompa tu carácter."
            },
            level_3: {
                pt: "Não se torne o inimigo.",
                en: "Do not become the enemy.",
                es: "No te conviertas en el enemigo."
            }
        }
    },
    {
        id: "cit_zeno_lingua_01",
        author: "zeno",
        original_text: {
            pt: "Melhor tropeçar com os pés do que com a língua.",
            en: "Better to trip with the feet than with the tongue.",
            es: "Mejor tropezar con los pies que con la lengua."
        },
        source: "Diógenes Laércio",
        metadata: {
            virtue: "Wisdom",
            level: 1,
            discipline: "Action",
            sphere: "Social",
            tags: ["speech", "silence", "self-control", "wisdom", "patience"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Escute mais. Fale menos.",
                en: "Listen more. Speak less.",
                es: "Escucha más. Habla menos."
            },
            level_2: {
                pt: "O silêncio é seguro; a fala é arriscada. Pense antes de falar para não se arrepender depois.",
                en: "Silence is safe; speech is risky. Think before you speak so you don't regret it later.",
                es: "El silencio es seguro; el habla es arriesgada. Piensa antes de hablar para no arrepentirte depois."
            },
            level_3: {
                pt: "Domine sua língua.",
                en: "Master your tongue.",
                es: "Domina tu lengua."
            }
        }
    },
    {
        id: "cit_seneca_multidao_01",
        author: "seneca",
        original_text: {
            pt: "Associe-se com pessoas que possam torná-lo melhor.",
            en: "Associate with people who are likely to improve you.",
            es: "Asóciate con personas que puedan mejorarte.",
        },
        source: "Cartas a Lucílio, VII",
        metadata: {
            virtue: "Justice",
            level: 1,
            discipline: "Action",
            sphere: "Social",
            tags: ["community", "friendship", "growth", "influence"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Ande com quem te eleva.",
                en: "Walk with those who lift you.",
                es: "Anda con quien te eleva."
            },
            level_2: {
                pt: "O contágio social é real. Busque amigos que desafiem sua mente e elevem sua alma, não que alimentem seus vícios.",
                en: "Social contagion is real. Seek friends who challenge your mind and elevate your soul, not feed your vices.",
                es: "El contagio social es real. Busca amigos que desafíen tu mente y eleven tu alma, not que alimenten tus vicios."
            },
            level_3: {
                pt: "Companhia eleva ou corrompe.",
                en: "Company elevates or corrupts.",
                es: "La compañía eleva o corrompe."
            }
        }
    },
    {
        id: "cit_epicteto_insulto_01",
        author: "epictetus",
        original_text: {
            pt: "Lembre-se que não é quem ofende que insulta, mas a sua opinião sobre o que é insultante.",
            en: "Remember that it is not he who gives abuse or blows who insults; but the view we take of these things as insulting.",
            es: "Recuerda que no es quien ofende quien insulta, sino tu opinión sobre lo que es insultante."
        },
        source: "Enchiridion, 20",
        metadata: {
            virtue: "Wisdom",
            level: 2,
            discipline: "Assent",
            sphere: "Social",
            tags: ["anger", "perception", "judgment", "patience", "forgiveness"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "Só ofende se você aceitar.",
                en: "Only offended if you accept.",
                es: "Solo te ofendes si aceptas."
            },
            level_2: {
                pt: "O insulto não está na palavra do outro, mas no seu julgamento. Remova a opinião e a raiva desaparece.",
                en: "The insult is not in the other's word, but in your judgment. Remove the opinion and the anger disappears.",
                es: "El insulto no está en la palabra del otro, sino en tu juicio. Elimina la opinión y la ira desaparece."
            },
            level_3: {
                pt: "A opinião cria o insulto.",
                en: "Opinion creates the insult.",
                es: "La opinión crea el insulto."
            }
        }
    }
];

// --- CATEGORY 6: NATURE & FATE (The Whole) ---
const NATURE_QUOTES: Quote[] = [
    {
        id: "cit_zeno_natureza_01",
        author: "zeno",
        original_text: {
            pt: "O objetivo da vida é viver em acordo com a natureza.",
            en: "The goal of life is living in agreement with nature.",
            es: "El objetivo de la vida es vivir de acuerdo con la naturaleza.",
        },
        source: "Diógenes Laércio",
        metadata: {
            virtue: "Justice",
            level: 1,
            discipline: "Desire",
            sphere: "Biological",
            tags: ["nature", "simplicity", "peace", "harmony", "morning", "acceptance"],
            coercion_type: "Dogmatic"
        },
        adaptations: {
            level_1: {
                pt: "Sem pressa. Como a natureza.",
                en: "No rush. Like nature.",
                es: "Sin prisa. Como la naturaleza."
            },
            level_2: {
                pt: "Ao observar o crescimento de uma planta, entendo o tempo e a paciência do universo.",
                en: "By observing the growth of a plant, I understand the time and patience of the universe.",
                es: "Al observar el crecimiento de una planta, entiendo el tiempo y la paciencia del universo."
            },
            level_3: {
                pt: "Physis: Natureza.",
                en: "Physis: Nature.",
                es: "Physis: Naturaleza."
            }
        }
    },
    {
        id: "cit_seneca_cadencia_01",
        author: "seneca",
        original_text: {
            pt: "Devemos viver de acordo com a natureza; separar-se dela é o começo da desordem.",
            en: "We must live according to nature; to separate ourselves from her is the beginning of disorder.",
            es: "Debemos vivir de acuerdo con la naturaleza; separarse de ella es el comienzo del desorden.",
        },
        source: "Cartas a Lucílio, 122",
        metadata: {
            virtue: "Wisdom",
            level: 1,
            discipline: "Desire",
            sphere: "Biological",
            tags: ["nature", "health", "time", "discipline", "body", "morning", "harmony"],
            coercion_type: "Directive"
        },
        adaptations: {
            level_1: {
                pt: "Siga o sol. Respeite o ritmo.",
                en: "Follow the sun. Respect rhythm.",
                es: "Sigue el sol. Respeta el ritmo."
            },
            level_2: {
                pt: "Não lute contra a noite nem desperdice o dia. A disciplina biológica é a base da tranquilidade mental.",
                en: "Do not fight the night nor waste the day. Biological discipline is the foundation of mental tranquility.",
                es: "No luches contra la noche ni desperdicies el día. La disciplina biológica es la base de la tranquilidad mental."
            },
            level_3: {
                pt: "Viva conforme a natureza.",
                en: "Live according to nature.",
                es: "Vive conforme a la natureza."
            }
        }
    },
    {
        id: "cit_marco_rio_01",
        author: "marcusAurelius",
        original_text: {
            pt: "O tempo é como um rio de eventos passageiros, e forte é a sua correnteza.",
            en: "Time is a sort of river of passing events, and strong is its current.",
            es: "El tempo es como un río de acontecimientos pasajeros, y fuerte es su corriente."
        },
        source: "Meditações, IV.43",
        metadata: {
            virtue: "Wisdom",
            level: 1,
            discipline: "Assent",
            sphere: "Structural",
            tags: ["nature", "change", "impermanence", "flux", "time", "acceptance"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "Tudo flui. Não se apegue.",
                en: "Everything flows. Don't cling.",
                es: "Todo fluye. No te apegues."
            },
            level_2: {
                pt: "Heráclito nos ensina o fluxo. Abrace a impermanência como a natureza da realidade.",
                en: "Heraclitus teaches us the flux. Embrace impermanence as the nature of reality.",
                es: "Heráclito nos enseña el flujo. Abraza la impermanencia como la naturaleza de la realidad."
            },
            level_3: {
                pt: "Panta Rhei: Tudo flui.",
                en: "Panta Rhei: Everything flows.",
                es: "Panta Rhei: Todo fluye."
            }
        }
    },
    {
        id: "cit_marco_perda_01",
        author: "marcusAurelius",
        original_text: {
            pt: "A perda nada mais é que mudança, e mudança é o deleite da Natureza.",
            en: "Loss is nothing else but change, and change is Nature's delight.",
            es: "La pérdida no es más que cambio, y el cambio es el deleite de la Naturaleza."
        },
        source: "Meditações, IX.42",
        metadata: {
            virtue: "Wisdom",
            level: 3,
            discipline: "Desire",
            sphere: "Structural",
            tags: ["change", "nature", "acceptance", "loss", "fate"],
            coercion_type: "Reflective"
        },
        adaptations: {
            level_1: {
                pt: "Perda é mudança. Aceite.",
                en: "Loss is change. Accept it.",
                es: "Pérdida es cambio. Acéptalo."
            },
            level_2: {
                pt: "O universo é metamorfose. O que você chama de perda é apenas a realidade se reconfigurando.",
                en: "The universe is metamorphosis. What you call loss is just reality reconfiguring itself.",
                es: "El universo es metamorfosis. Lo que llamas pérdida es solo la realidad reconfigurándose."
            },
            level_3: {
                pt: "Perda é mudança.",
                en: "Loss is change.",
                es: "La pérdida es cambio."
            }
        }
    }
];

// --- AGGREGATION & EXPORT ---

export const QUOTES_BY_CATEGORY = Object.freeze({
    mind: MIND_QUOTES,
    action: ACTION_QUOTES,
    resilience: RESILIENCE_QUOTES,
    equilibrium: EQUILIBRIUM_QUOTES,
    social: SOCIAL_QUOTES,
    nature: NATURE_QUOTES
});

// @fix: Change type to readonly Quote[] to match Object.freeze return type and fix type assignment error.
export const STOIC_QUOTES: readonly Quote[] = Object.freeze([
    ...MIND_QUOTES,
    ...ACTION_QUOTES,
    ...RESILIENCE_QUOTES,
    ...EQUILIBRIUM_QUOTES,
    ...SOCIAL_QUOTES,
    ...NATURE_QUOTES
]);
