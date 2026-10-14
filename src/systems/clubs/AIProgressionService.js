import { AI_PROGRESSION_CONFIG, PROGRESSION_NONE } from '../../data/aiProgression.js';
import { calculateFighterLevel, getStarRating } from '../rating/RatingService.js';
import { ageFighter } from '../fighters/PotentialService.js';
import { AGE_CONFIG } from '../../data/fighterProfile.js';
import { AI_RECRUITMENT_CONFIG } from '../../data/aiRecruitment.js';
import { randInt } from '../../utils/random.js';
import { listAIClubs } from './AIRecruitmentService.js';

// Le recrutement quotidien (1 % par club) reste dans AIRecruitmentService ; il est exposé ici
// pour que l'évolution des clubs de l'IA ait un point d'entrée unique.
export { runDailyAIRecruitment, runAIRetirements } from './AIRecruitmentService.js';

// Évolution quotidienne des combattants des clubs de l'IA (jamais ceux du joueur) :
//
//   pour chaque combattant : âge ≥ 32 → vieillissement (−1 niveau, 2 à 5 % selon l'âge)
//                            sinon   → progression (+1 niveau, 10 / 5 / 2 % selon ses étoiles)
//   → niveau borné (0 à 100) → événement enregistré s'il a changé → historique élagué (30 jours)
//
// Le niveau numérique change ; les étoiles (du combattant et du club) en sont recalculées
// à la lecture par RatingService. Une journée n'est traitée qu'une fois (aiProgressionDay).
// Aucune entrée au carnet de bord.

/** Combattants de tous les clubs de l'IA, dans un ordre stable. */
function listAIFighters(session) {
  return listAIClubs(session).flatMap((clubId) => session.getFightersOfTeam(clubId));
}

/** Âge d'un combattant de l'IA dans la partie (null s'il n'en a pas encore). */
export function getAIFighterAge(session, fighter) {
  return typeof fighter.age === 'number' ? fighter.age : null;
}

function setAIFighterAge(session, fighter, age) {
  if (session.isBaseAIFighter(fighter.id)) {
    session.aiFighterStates[fighter.id] = { ...(session.aiFighterStates[fighter.id] ?? {}), age };
  }
  fighter.age = age;
}

/**
 * Âge initial d'un combattant de l'IA (création de la partie) : tirage uniforme dont la
 * MOYENNE est décalée de `initialAgeOffset` ans, sans sortir des bornes de génération.
 * La borne basse est gardée et la borne haute abaissée de 2 × |décalage| :
 *   18–35 ans (moyenne 26,5) → 18–31 ans (moyenne 24,5) pour un décalage de −2.
 */
export function rollAIInitialAge(rng = Math.random, config = AI_RECRUITMENT_CONFIG, ages = AGE_CONFIG) {
  const { min, max } = ages.initial;
  const offset = config.initialAgeOffset ?? 0;
  const low = offset > 0 ? Math.min(max, min + 2 * offset) : min;
  const high = offset < 0 ? Math.max(min, max + 2 * offset) : max;
  return randInt(rng, low, high);
}

/**
 * Âge des combattants de l'IA qui n'en ont pas (nouvelle partie, ancienne sauvegarde, club
 * ajouté par l'Admin) : tirage initial de l'IA (rollAIInitialAge), une seule fois, puis enregistré.
 * Renvoie le nombre de combattants concernés.
 */
export function ensureAIFighterProfiles(session, rng = Math.random) {
  let count = 0;
  for (const fighter of listAIFighters(session)) {
    if (getAIFighterAge(session, fighter) !== null) continue;
    setAIFighterAge(session, fighter, rollAIInitialAge(rng));
    count++;
  }
  if (count) session.markDirty();
  return count;
}

/** Fin de saison : +1 an pour chaque combattant de l'IA (comme ceux du joueur). */
export function ageAIFighters(session) {
  const fighters = listAIFighters(session).filter((fighter) => getAIFighterAge(session, fighter) !== null);
  for (const fighter of fighters) {
    if (session.isBaseAIFighter(fighter.id)) setAIFighterAge(session, fighter, fighter.age + 1);
    else ageFighter(fighter);
  }
  if (fighters.length) session.markDirty();
  return fighters.length;
}

/**
 * Évolution possible d'un combattant aujourd'hui : { kind: 'gain' | 'loss', chance } ou null.
 * Le vieillissement est prioritaire : à partir de `aging.fromAge` ans, plus de progression.
 */
export function getDailyEvolution(fighter, age, config = AI_PROGRESSION_CONFIG) {
  const { aging } = config;
  if (typeof age === 'number' && age >= aging.fromAge) {
    return { kind: 'loss', chance: Math.min((age - aging.ageOffset) * aging.chancePerYear, aging.maxChance) };
  }
  const stars = getStarRating(calculateFighterLevel(fighter));
  const band = config.progressionByStars.find((entry) => stars <= entry.maxStars);
  return band ? { kind: 'gain', chance: band.chance } : null;
}

/**
 * Change le niveau d'un combattant de l'IA (borné). Enregistre l'événement si le niveau a
 * réellement changé. Renvoie l'événement, ou null.
 */
export function changeAIFighterLevel(session, fighter, delta, day, config = AI_PROGRESSION_CONFIG) {
  const previousLevel = calculateFighterLevel(fighter);
  const newLevel = Math.max(config.minLevel, Math.min(config.maxLevel, previousLevel + delta));
  const applied = newLevel - previousLevel;
  if (!applied) return null;
  if (session.isBaseAIFighter(fighter.id)) {
    const state = session.aiFighterStates[fighter.id] ?? {};
    session.aiFighterStates[fighter.id] = { ...state, levelDelta: (state.levelDelta ?? 0) + applied };
  }
  fighter.score = newLevel;
  const event = { fighterId: fighter.id, day, previousLevel, newLevel, delta: applied };
  session.aiProgressionEvents.push(event);
  session.markDirty();
  return event;
}

/** Supprime les événements sortis de la période de l'indicateur. */
export function pruneProgressionEvents(session, currentDay, config = AI_PROGRESSION_CONFIG) {
  const first = currentDay - config.historyDays + 1;
  const before = session.aiProgressionEvents.length;
  session.aiProgressionEvents = session.aiProgressionEvents.filter((event) => event.day >= first);
  return before - session.aiProgressionEvents.length;
}

/**
 * Phase quotidienne (après les recrutements) : un tirage par combattant de l'IA.
 * Renvoie les événements de la journée (aucun si la journée a déjà été traitée).
 */
export function runDailyAIProgression(session, { rng = Math.random, config = AI_PROGRESSION_CONFIG } = {}) {
  const day = session.calendar.currentDay;
  if (session.aiProgressionDay === day) return [];
  const events = [];
  for (const fighter of listAIFighters(session)) {
    let age = getAIFighterAge(session, fighter);
    if (age === null) {
      age = rollAIInitialAge(rng);
      setAIFighterAge(session, fighter, age);
    }
    const evolution = getDailyEvolution(fighter, age, config);
    if (!evolution || rng() >= evolution.chance) continue;
    const delta = evolution.kind === 'gain' ? config.levelGain : -config.levelLoss;
    const event = changeAIFighterLevel(session, fighter, delta, day, config);
    if (event) events.push(event);
  }
  pruneProgressionEvents(session, day, config);
  session.aiProgressionDay = day;
  session.markDirty();
  return events;
}

/**
 * Bilan net d'un combattant sur la période (niveau actuel − niveau au début de la période) :
 * somme des variations enregistrées pendant les `historyDays` derniers jours.
 */
export function getProgressionNet(session, fighterId, currentDay, config = AI_PROGRESSION_CONFIG) {
  const first = currentDay - config.historyDays + 1;
  return session.aiProgressionEvents
    .filter((event) => event.fighterId === fighterId && event.day >= first && event.day <= currentDay)
    .reduce((sum, event) => sum + event.delta, 0);
}

/** Indicateur d'un bilan net : 'NONE' | 'UP_1' | 'UP_2' | 'UP_3' | 'DOWN'. */
export function getIndicatorForNet(net, config = AI_PROGRESSION_CONFIG) {
  const rule = config.indicators.find((entry) => (entry.maxNet === undefined || net <= entry.maxNet) && (entry.minNet === undefined || net >= entry.minNet));
  return rule?.id ?? PROGRESSION_NONE;
}

/** Indicateur de progression d'un combattant sur les 30 derniers jours (pour l'affichage). */
export function getProgressionIndicator(session, fighterId, currentDay = session.calendar.currentDay, config = AI_PROGRESSION_CONFIG) {
  return getIndicatorForNet(getProgressionNet(session, fighterId, currentDay, config), config);
}

/** Flèches d'un indicateur ('' pour NONE). */
export function getIndicatorArrows(indicatorId, config = AI_PROGRESSION_CONFIG) {
  return config.indicators.find((entry) => entry.id === indicatorId)?.arrows ?? '';
}
