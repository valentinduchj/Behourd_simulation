import { COMBAT_RULES } from '../../../data/combatRules.js';
import { computeDamage } from '../CombatDamageCalculator.js';
import { talentStrikeModifiers } from '../TalentCombat.js';

// Rapport de force entre deux combattants AVANT la manche (composition, placement), d'après les
// règles de dégâts (aléa moyen, sans combo ni bonus de situation) : classes, statistiques,
// fatigue, PV. Même calcul que l'estimation de duel en manche (TargetSelectionService), sans
// la situation sur la grille.

/**
 * log2(tours pour mourir ÷ tours pour mettre KO), borné à ±cap : > 0 si `unit` gagne le duel
 * contre `enemy`, < 0 s'il le perd (1 = deux fois plus vite).
 */
export function duelStrength(unit, enemy, { rules = COMBAT_RULES, cap = 3, fighters = [] } = {}) {
  const dealt = computeDamage(unit, enemy, { roll: 0.5, comboHits: 1 }, rules).damage * talentDamageFactor(unit, enemy, fighters, rules);
  const taken = computeDamage(enemy, unit, { roll: 0.5, comboHits: 1 }, rules).damage * talentDamageFactor(enemy, unit, fighters, rules);
  const ticksToKill = Math.ceil(enemy.hp / Math.max(1, dealt));
  const ticksToDie = Math.ceil(unit.hp / Math.max(1, taken));
  return Math.max(-cap, Math.min(cap, Math.log2(ticksToDie / ticksToKill)));
}

/**
 * Talents dans un échange (v1.2.2) : multiplicateur des dégâts de `unit` sur `enemy` — mêmes
 * bonus et réductions que le moteur au moment du coup (TalentCombat.talentStrikeModifiers), et
 * l'esquive de la cible. 1 sans talent.
 */
export function talentDamageFactor(unit, enemy, fighters = [], rules = COMBAT_RULES) {
  if (!unit?.talentEffects?.length && !enemy?.talentEffects?.length && !unit?.auraBonus) return 1;
  const { bonus, reduction } = talentStrikeModifiers(unit, enemy, fighters, rules);
  return Math.max(0.05, (1 + bonus) * (1 - reduction) * (1 - (enemy.dodgeChance ?? 0)));
}

/** Rapport de force moyen d'un combattant contre une liste d'adversaires (0 si aucun). */
export function averageDuelStrength(unit, enemies, options) {
  if (!enemies.length) return 0;
  return enemies.reduce((sum, enemy) => sum + duelStrength(unit, enemy, options), 0) / enemies.length;
}
