import { COMBAT_RULES } from '../../../data/combatRules.js';
import { computeDamage } from '../CombatDamageCalculator.js';

// Rapport de force entre deux combattants AVANT la manche (composition, placement), d'après les
// règles de dégâts (aléa moyen, sans combo ni bonus de situation) : classes, statistiques,
// fatigue, PV. Même calcul que l'estimation de duel en manche (TargetSelectionService), sans
// la situation sur la grille.

/**
 * log2(tours pour mourir ÷ tours pour mettre KO), borné à ±cap : > 0 si `unit` gagne le duel
 * contre `enemy`, < 0 s'il le perd (1 = deux fois plus vite).
 */
export function duelStrength(unit, enemy, { rules = COMBAT_RULES, cap = 3 } = {}) {
  const dealt = computeDamage(unit, enemy, { roll: 0.5, comboHits: 1 }, rules).damage;
  const taken = computeDamage(enemy, unit, { roll: 0.5, comboHits: 1 }, rules).damage;
  const ticksToKill = Math.ceil(enemy.hp / Math.max(1, dealt));
  const ticksToDie = Math.ceil(unit.hp / Math.max(1, taken));
  return Math.max(-cap, Math.min(cap, Math.log2(ticksToDie / ticksToKill)));
}

/** Rapport de force moyen d'un combattant contre une liste d'adversaires (0 si aucun). */
export function averageDuelStrength(unit, enemies, options) {
  if (!enemies.length) return 0;
  return enemies.reduce((sum, enemy) => sum + duelStrength(unit, enemy, options), 0) / enemies.length;
}
