import { AI_PROFILE_BY_CLUB_STARS, DEFAULT_AI_PROFILE_ID, getAIProfile } from '../../data/aiProfiles.js';
import { createCombatUnit } from '../../combat/engine/CombatUnit.js';
import { getStarRating } from '../fighters/ratings.js';
import { getClubLevel } from '../league/LeagueService.js';
import { createRng } from '../../utils/random.js';
import { selectLineup } from './LineupStrategies.js';
import { combatEffectsOf } from '../talents/TalentEffects.js';

// Comportement de l'équipe adverse (IA) dans un combat contre le joueur : un des 8 profils d'IA
// (data/aiProfiles.js) tiré À CHAQUE COMBAT (AI_PROFILE_BY_CLUB_STARS : même chance pour tous),
// enregistré sur le combat (match.aiProfileId). Il décide de la composition de chaque manche, du
// placement et du comportement en manche des combattants de l'IA ; ceux du joueur gardent l'IA
// habituelle.

/** Tranche de répartition pour un nombre d'étoiles. */
export function getProfileTier(stars, tiers = AI_PROFILE_BY_CLUB_STARS) {
  return tiers.find((tier) => stars <= tier.maxStars) ?? tiers[tiers.length - 1];
}

/** Tire un profil selon les étoiles du club (poids de la tranche). Renvoie l'identifiant. */
export function drawProfileId(stars, rng = Math.random, tiers = AI_PROFILE_BY_CLUB_STARS) {
  const entries = Object.entries(getProfileTier(stars, tiers).weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;
  for (const [id, weight] of entries) {
    roll -= weight;
    if (roll < 0) return id;
  }
  return entries[entries.length - 1][0];
}

/**
 * Comportement de l'IA pour ce combat : celui déjà tiré (match.aiProfileId), sinon tiré selon
 * les étoiles actuelles du club adverse. `seed` : graine propre au combat (même tirage si le
 * combat est rouvert, différent d'un combat à l'autre). Renvoie le profil.
 */
export function assignMatchAIProfile(session, match, { seed = match.id } = {}) {
  if (!match.aiProfileId) {
    const stars = getStarRating(getClubLevel(session, match.teamBId));
    match.aiProfileId = drawProfileId(stars, createRng(`comportement:${seed}`));
  }
  return getAIProfile(match.aiProfileId);
}

/** Profil d'IA de l'équipe adverse d'un combat (null : combat sans comportement tiré). */
export function getMatchAIProfile(match) {
  return match?.aiProfileId ? getAIProfile(match.aiProfileId) : null;
}

/** « Comportement défensif », « Comportement écrasant »… (nom du profil en infobulle). */
export function describeBehavior(profile) {
  if (!profile) return null;
  return `Comportement ${profile.behavior}`;
}

/** Combattant de manche (stats, fatigue du combat) pour les estimations de l'IA. */
function unitFor(fighter, fatigue) {
  // v1.2.2 : avec ses talents de combat (estimations des profils réfléchis).
  return createCombatUnit({ fighter, side: 'B', tile: { x: 0, y: 0 }, fatigue, isCaptain: fighter.isCaptain === true, talentEffects: combatEffectsOf(fighter) });
}

/**
 * Composition de la manche de l'IA selon son profil. own : combattants disponibles de l'IA ;
 * opponents : ceux du joueur ; fatigueOf(fighter) : fatigue dans ce combat.
 */
export function selectOpponentLineup(match, { own, opponents, size, fatigueOf, rng = Math.random }) {
  const profile = getMatchAIProfile(match) ?? getAIProfile(DEFAULT_AI_PROFILE_ID);
  return selectLineup(profile.lineup, {
    own, opponents, size, fatigueOf, rng, formation: profile.formation,
    unitOf: (fighter) => unitFor(fighter, fatigueOf(fighter)),
    score: { own: match.scoreB, opponent: match.scoreA },
  });
}

/** Réglages de placement de l'IA et estimation de ses combattants (stratégies « duel », « anticipate »). */
export function getOpponentPlacementOptions(match, { fighterOf, fatigueOf }) {
  const profile = getMatchAIProfile(match);
  if (!profile) return {};
  return {
    config: profile.placement,
    unitOf: (fighterId) => {
      const fighter = fighterOf(fighterId);
      return fighter ? unitFor(fighter, fatigueOf(fighter)) : null;
    },
  };
}
