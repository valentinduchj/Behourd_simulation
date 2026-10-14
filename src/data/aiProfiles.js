import { AI_PLACEMENT_CONFIG, FIGHTER_AI_CONFIG } from './combatRules.js';

// Profils d'IA de combat (v0.67) : huit façons INTELLIGENTES de mener un combat de béhourd, qui
// jouent chacune autrement avec la formation, le placement, la fatigue et le choix des cibles.
// Un profil décide à TROIS moments d'un combat :
//   lineup     choix des 5 combattants de chaque manche (systems/ai/LineupStrategies.js) ;
//              `formation` : ses quotas de classes (sinon 2 Lutteurs, 2 Hastiers, 1 Runner)
//   placement  pose des combattants dans la lice (combat/engine/AIPlacementStrategy.js)
//   fighterAI  comportement de chaque combattant pendant la manche (combat/engine/ai/,
//              mêmes clés que FIGHTER_AI_CONFIG : cibles, approche, souffle, recul…)
// « ordonnance » reprend les réglages de base du jeu (c'est aussi l'IA de vos combattants).
//
// Affichage pendant un combat (équipe de l'IA) : « Comportement <behavior> » ; son infobulle
// montre `name — flavor` (ce que fait l'adversaire, en termes de jeu : composition, placement,
// combat) ; `summary` décrit le profil plus techniquement (banc d'essai).

const merge = (base, over) => Object.freeze(Object.fromEntries(Object.entries(base).map(([key, value]) => [
  key,
  over?.[key] !== undefined && value && typeof value === 'object' && !Array.isArray(value) ? merge(value, over[key]) : over?.[key] ?? value,
]).concat(Object.entries(over ?? {}).filter(([key]) => !(key in base)))));

const placement = (strategy, over = {}) => merge(AI_PLACEMENT_CONFIG, { strategy, ...over });
const fighterAI = (over = {}) => merge(FIGHTER_AI_CONFIG, over);

export const AI_PROFILES = Object.freeze([
  Object.freeze({
    id: 'ordonnance',
    name: 'L’Ordonnance',
    behavior: 'ordonné',
    summary: 'La formation 2-2-1 sans faille (Lutteurs aux barrières, Hastiers derrière, Runner au centre) ; ses meilleurs tant qu’ils restent sous le seuil de fatigue ; réglages de base équilibrés.',
    flavor: 'Formation 2 Lutteurs, 2 Hastiers, 1 Runner. Aligne ses meilleurs tant qu’ils sont sous 50 de fatigue. Lutteurs aux barrières, Hastiers derrière, Runner au centre.',
    lineup: 'disciplined',
    formation: null,
    placement: placement('formation'),
    fighterAI: FIGHTER_AI_CONFIG,
  }),
  Object.freeze({
    id: 'mur',
    name: 'Le Mur',
    behavior: 'défensif',
    summary: '2 Lutteurs aux barrières et 3 Hastiers derrière, aucun Runner (forêt de lances) ; ligne en retrait ; secourt ses blessés, souffle souvent.',
    flavor: '2 Lutteurs, 3 Hastiers, aucun Runner. Ligne en retrait. Protège ses blessés et souffle souvent.',
    lineup: 'disciplined',
    formation: Object.freeze({ lutteur: 2, hastier: 3, runner: 0 }),
    placement: placement('formation', { frontWeight: -0.3, barrierWeight: 2.4 }),
    fighterAI: fighterAI({
      target: { dangerWeight: 0.8, protectWeight: 1.5, finishWeight: 1.5, focusWeight: 0.5 },
      approach: { exposureWeight: 0.9, bonusByClass: { lutteur: 2, hastier: 2.5 } },
      reposition: { probability: 0.5 },
      retreat: { hpRatio: 0.3, maxPerRound: 1 },
      // Il souffle juste avant le seuil du malus de fatigue (50), et plus longtemps.
      breathe: { minFatigue: 45, maxTicks: 4 },
    }),
  }),
  Object.freeze({
    id: 'chevauchee',
    name: 'La Chevauchée',
    behavior: 'offensif',
    summary: '2 Runners, 2 Lutteurs, 1 Hastier ; les meilleurs d’abord (sauf les épuisés) ; ligne avancée ; les Runners filent dans le dos des adversaires engagés ; se ménage peu.',
    flavor: '2 Runners, 2 Lutteurs, 1 Hastier. Ligne avancée. Ses Runners cherchent le dos de vos combattants ; il souffle rarement.',
    lineup: 'allIn',
    formation: Object.freeze({ runner: 2, lutteur: 2, hastier: 1 }),
    placement: placement('formation', { frontWeight: 1.2, centreWeight: 2.4 }),
    fighterAI: fighterAI({
      decisionInterval: 2,
      target: { backWeight: { runner: 4 }, finishWeight: 1.5 },
      approach: { bonusByClass: { runner: 4, hastier: 1.5 } },
      retreat: { hpRatio: 0.15, maxPerRound: 1 },
      breathe: { minFatigue: 70 },
    }),
  }),
  Object.freeze({
    id: 'marteau',
    name: 'Le Marteau',
    behavior: 'écrasant',
    summary: 'Surcharge d’un seul flanc (toute la compagnie du même côté) ; tous sur la même cible jusqu’au KO (concentration, achèvement), sans limite de surnombre.',
    flavor: 'Toute l’équipe sur un même flanc. Tous frappent la même cible jusqu’au KO.',
    lineup: 'duel',
    formation: null,
    placement: placement('formation', { overloadWeight: 2.2, sharedBarrierPenalty: 0.5, frontWeight: 0.8 }),
    fighterAI: fighterAI({
      target: { focusWeight: 1.6, finishWeight: 2.5, crowdLimit: 5, crowdWeight: 0.3, dangerWeight: 0.3 },
      breathe: { minFatigue: 45 },
    }),
  }),
  Object.freeze({
    id: 'usure',
    name: 'La Guerre d’usure',
    behavior: 'patient',
    summary: 'Rotation : personne ne combat fatigué tant qu’un remplaçant est frais ; vise les adversaires épuisés ; Hastiers à distance ; souffle tôt et longtemps.',
    flavor: 'N’aligne pas ses combattants fatigués s’il a des remplaçants frais. Vise vos combattants les plus fatigués et souffle souvent.',
    lineup: 'rotation',
    formation: null,
    placement: placement('formation', { frontWeight: 0 }),
    fighterAI: fighterAI({
      target: { tiredWeight: 4, dangerWeight: 0.8, finishWeight: 1.5 },
      approach: { exposureWeight: 1, bonusByClass: { hastier: 2.5, runner: 2.5 } },
      reposition: { probability: 0.5 },
      breathe: { minFatigue: 45, maxTicks: 4, cooldownTicks: 3 },
    }),
  }),
  Object.freeze({
    id: 'stratege',
    name: 'Le Stratège',
    behavior: 'stratégique',
    summary: 'Prévoit la composition adverse et le score (ménage ses fatigués quand il mène), garde ses meilleures réponses pour la fin du placement ; en manche, se coordonne (achever, concentrer, secourir).',
    flavor: 'Prévoit votre composition et tient compte du score. Place ses meilleurs en dernier. Ses combattants se coordonnent.',
    lineup: 'strategist',
    formation: null,
    placement: placement('anticipate', { duelWeight: 2, reserveWeight: 1, threatWeight: 1.2 }),
    fighterAI: fighterAI({
      decisionInterval: 2,
      target: { finishWeight: 2.5, focusWeight: 0.8, protectWeight: 1.5 },
      approach: { exposureByClass: { hastier: 2 } },
      retreat: { maxPerRound: 2 },
    }),
  }),
  Object.freeze({
    id: 'tacticien',
    name: 'Le Tacticien',
    behavior: 'tactique',
    summary: 'Compose et place d’après le rapport de force réel (stats, fatigue) pour obtenir des duels favorables ; en manche, pèse fort le rapport de force, achève les blessés et cherche sans cesse un meilleur angle.',
    flavor: 'Aligne et place chaque combattant face à l’adversaire qu’il bat le mieux. Achève les blessés.',
    lineup: 'duel',
    formation: null,
    placement: placement('duel', { duelWeight: 2 }),
    fighterAI: fighterAI({
      target: { strengthWeight: 2.2, finishWeight: 2 },
      reposition: { probability: 0.55 },
    }),
  }),
  Object.freeze({
    id: 'chasseur',
    name: 'Le Chasseur de têtes',
    behavior: 'impitoyable',
    summary: 'Formation classique, mais tous traquent d’abord le capitaine adverse et les Hastiers (les plus dangereux) ; les Runners cherchent leur dos.',
    flavor: 'Vise d’abord votre capitaine, puis vos Hastiers. Ses Runners cherchent leur dos.',
    lineup: 'duel',
    formation: null,
    placement: placement('formation', { frontWeight: 0.6 }),
    fighterAI: fighterAI({
      target: { captainWeight: 6, classPriority: { hastier: 3.5 }, backWeight: { runner: 3 }, finishWeight: 1.5, currentTargetBonus: 2.5 },
      approach: { bonusByClass: { runner: 3 } },
    }),
  }),
]);

export const DEFAULT_AI_PROFILE_ID = 'ordonnance';

// Anciens profils (avant la v0.67), pour les combats sauvegardés : vers leur équivalent actuel.
export const LEGACY_AI_PROFILE_IDS = Object.freeze({
  classique: 'ordonnance', brouillon: 'chevauchee', instinctif: 'chevauchee',
  tacticien2: 'tacticien', stratege2: 'stratege',
});

// Comportement des clubs adverses, tiré à chaque combat (systems/ai/OpponentAIService.js) : tous
// les profils sont intelligents, chacun a la même chance quel que soit le niveau du club (la
// force du club tient à ses combattants). Première tranche dont maxStars est atteint ; poids en %.
export const AI_PROFILE_BY_CLUB_STARS = Object.freeze([
  Object.freeze({ maxStars: 5, weights: Object.freeze(Object.fromEntries(AI_PROFILES.map((profile) => [profile.id, 1]))) }),
]);

export function getAIProfile(id) {
  const known = LEGACY_AI_PROFILE_IDS[id] ?? id;
  return AI_PROFILES.find((profile) => profile.id === known) ?? AI_PROFILES.find((profile) => profile.id === DEFAULT_AI_PROFILE_ID);
}
