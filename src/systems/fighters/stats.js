import { getStatDefinition } from '../../data/stats.js';
import { POTENTIAL_CONFIG } from '../../data/fighterProfile.js';
import { skillCapSteps } from '../talents/TalentEffects.js';

// Règles centrales d'application des statistiques. Tout système qui modifie une
// statistique (activités, futurs combats, blessures…) doit passer par ces fonctions,
// qui garantissent le respect des bornes et du sens de chaque stat (voir data/stats.js).

function definitionOf(statId) {
  const def = getStatDefinition(statId);
  if (!def) throw new Error(`Statistique inconnue : ${statId}`);
  return def;
}

export function clampStat(statId, value) {
  const def = definitionOf(statId);
  return Math.min(def.max, Math.max(def.min, value));
}

export function getStat(fighter, statId) {
  return fighter.stats[statId] ?? definitionOf(statId).base;
}

/** Fixe la valeur brute d'une statistique (bornée). Renvoie la nouvelle valeur. */
export function setStat(fighter, statId, value) {
  fighter.stats[statId] = clampStat(statId, value);
  return fighter.stats[statId];
}

/**
 * Améliore une statistique de `amount` dans son sens favorable :
 * +amount pour les PV ou les compétences, −amount pour la fatigue.
 * Renvoie l'amélioration réellement appliquée (0 si la borne est déjà atteinte).
 */
export function improveStat(fighter, statId, amount) {
  const def = definitionOf(statId);
  const current = getStat(fighter, statId);
  if (def.polarity > 0) {
    // Plafond du potentiel : aucun gain au-delà ; une valeur déjà au-dessus n'est jamais réduite.
    const cap = getStatCap(fighter, statId);
    if (current >= cap) return 0;
    const next = setStat(fighter, statId, Math.min(cap, current + amount));
    return Math.abs(next - current);
  }
  const next = setStat(fighter, statId, current + def.polarity * amount);
  return Math.abs(next - current);
}

/**
 * Valeur maximale que la statistique peut atteindre par progression. Compétences : plafond
 * du potentiel ACTUEL (data/fighterProfile.js, POTENTIAL_CONFIG.skillCaps) ; autres stats, ou
 * combattant sans potentiel (clubs de l'IA) : la borne de la statistique.
 */
export function getStatCap(fighter, statId) {
  const def = definitionOf(statId);
  if (def.kind !== 'skill' || def.polarity < 0 || typeof fighter?.potential !== 'number') return def.max;
  // Talent Prodige : le plafond monte de N crans (comme N flammes de potentiel de plus).
  const potential = Math.max(POTENTIAL_CONFIG.min, Math.min(POTENTIAL_CONFIG.max, fighter.potential + skillCapSteps(fighter)));
  return Math.min(def.max, POTENTIAL_CONFIG.skillCaps[potential] ?? def.max);
}

/** Vrai si la compétence est bloquée par le plafond du potentiel (et non par sa borne). */
export function isAtPotentialCap(fighter, statId) {
  const cap = getStatCap(fighter, statId);
  return cap < definitionOf(statId).max && getStat(fighter, statId) >= cap;
}

/**
 * Compétence qui ne peut plus progresser : à 100, ou au plafond de son potentiel (v0.73.2,
 * affichée en rouge dans les affectations). Recalculé à chaque lecture : un gain de potentiel (ou
 * le talent Prodige) relève le plafond et la compétence redevient améliorable.
 */
export function isStatMaxed(fighter, statId) {
  const def = definitionOf(statId);
  if (def.kind !== 'skill' || def.polarity < 0) return false;
  return getStat(fighter, statId) >= getStatCap(fighter, statId);
}

/** Dégrade une statistique de `amount` (ex. futur gain de fatigue, perte de PV). */
export function worsenStat(fighter, statId, amount) {
  const def = definitionOf(statId);
  const current = getStat(fighter, statId);
  const next = setStat(fighter, statId, current - def.polarity * amount);
  return Math.abs(next - current);
}

/** Vrai si la statistique peut encore être améliorée. */
export function canImproveStat(fighter, statId) {
  const def = definitionOf(statId);
  const current = getStat(fighter, statId);
  return def.polarity > 0 ? current < getStatCap(fighter, statId) : current > def.min;
}

/** « +10 Points de vie », « −20 Fatigue ». */
export function formatStatImprovement(statId, amount) {
  const def = definitionOf(statId);
  return `${def.polarity > 0 ? '+' : '−'}${amount} ${def.label}`;
}

/** Raison affichée quand une statistique est déjà à sa meilleure valeur. */
export function describeStatAtBest(statId) {
  const def = definitionOf(statId);
  return def.polarity > 0 ? `${def.label} déjà au maximum` : `${def.label} déjà à ${def.min}`;
}
