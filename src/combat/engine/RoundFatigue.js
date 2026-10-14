import { COMBAT_RULES } from '../../data/combatRules.js';

// Fatigue pendant la manche (v0.66, béhourd réel) — règles pures, sur les combattants de manche.
// Réglages : COMBAT_RULES.roundFatigue. Chaque combattant porte ses facteurs (talents) :
//   fatigueEffort   effort de rester debout (Souffle long : 0,8)
//   fatigueRecovery récupération (Second souffle : 2)
//   fatigueGain     part de tout gain de fatigue (Légende vivante dans l'effectif : 0,75)
//   fatigueCap      plafond (Bon vivant : 90)
// La fatigue du moment sert aussitôt au calcul des dégâts (malus au-delà de 50).

const clampFatigue = (unit, value) => Math.max(0, Math.min(unit.fatigueCap ?? 100, 100, value));

/** Gain de fatigue (coup donné, coup reçu, effort) : × part de gain de la compagnie. */
export function gainFatigue(unit, amount) {
  if (amount <= 0) return;
  unit.fatigue = clampFatigue(unit, unit.fatigue + amount * (unit.fatigueGain ?? 1));
}

/** Récupération (au sol, souffle, temps mort) : × facteur de récupération. */
export function recoverFatigue(unit, amount) {
  if (amount <= 0) return;
  unit.fatigue = clampFatigue(unit, unit.fatigue - amount * (unit.fatigueRecovery ?? 1));
}

/** Effort d'un tour pour un combattant debout : plus la manche dure, plus il pèse. */
export function effortOfTick(tick, rules = COMBAT_RULES) {
  const { effortPerTick, escalationTicks } = rules.roundFatigue;
  return effortPerTick * (1 + tick / escalationTicks);
}

/** Coup porté : l'attaquant se fatigue un peu, la cible beaucoup plus (selon les dégâts). */
export function applyStrikeFatigue(attacker, target, damage, rules = COMBAT_RULES) {
  const { perHitGiven, perDamageTaken } = rules.roundFatigue;
  gainFatigue(attacker, perHitGiven);
  gainFatigue(target, perDamageTaken * damage);
}

/**
 * Fin d'un tour : effort pour chaque combattant debout (sauf s'il souffle : il récupère),
 * récupération pour chaque combattant au sol. `isResting(unit)` : il souffle (souffle
 * individuel, temps mort).
 */
export function applyTickFatigue(fighters, tick, { isResting = () => false, rules = COMBAT_RULES } = {}) {
  const { koRecoveryPerTick, breathRecoveryPerTick } = rules.roundFatigue;
  for (const unit of fighters) {
    if (unit.status === 'ko') recoverFatigue(unit, koRecoveryPerTick);
    else if (isResting(unit)) recoverFatigue(unit, breathRecoveryPerTick);
    else gainFatigue(unit, effortOfTick(tick, rules) * (unit.fatigueEffort ?? 1));
  }
}
