import { COMBAT_RULES } from '../../data/combatRules.js';

// Calcul des dégâts d'un coup — règles seules, sans état ni animation :
//
//   attaque  = stat de classe de l'attaquant (HAST, LUTTE ou PER)
//   défense  = moitié HAST + moitié stat de classe de la cible
//   base     = 10 × attaque ÷ défense
//   × (1 + aléa + combo)   aléa : tirage × PER de l'attaquant (en %, 50 % au plus) ;
//                          combo : coups consécutifs sur la même cible (5 au plus) × LUTTE ÷ 10 %
//   × fatigue (100 % jusqu'à 50, puis −2 % par point au-delà) × bonus final (position, objets,
//     talents : ex. Hastier à distance +20 %, Runner dans le dos +30 %)
//   → arrondi, au moins 1.
// La classe ne multiplie plus rien (v0.65) : elle choisit la stat d'attaque et l'allonge.
//
// Un combattant de combat porte ses stats EFFECTIVES (bonus de capitaine et de situation déjà
// appliqués) : { classId, stats: { polearm, wrestling, percussion, endurance }, fatigue }.

/** Statistique offensive d'une classe : HAST (hastier), LUTTE (lutteur), PER (runner). */
export function getOffenseStatId(classId, rules = COMBAT_RULES) {
  const statId = rules.offenseStatByClass[classId];
  if (!statId) throw new Error(`Classe inconnue : ${classId}`);
  return statId;
}

/** Multiplicateur de fatigue : 100 % jusqu'au seuil (50), puis −2 % par point au-delà (75 → 50 %, 100 → 0 %, minimum de dégâts ensuite). */
export function getFatigueFactor(fatigue, rules = COMBAT_RULES) {
  const value = Math.max(0, Math.min(100, Number(fatigue) || 0));
  const { threshold, perPoint } = rules.fatigueDamage;
  return Math.max(0, 1 - Math.max(0, value - threshold) * perPoint);
}

/** Valeur d'attaque : la stat de classe. */
export function getAttackValue(unit, rules = COMBAT_RULES) {
  return unit.stats[getOffenseStatId(unit.classId, rules)];
}

/** Valeur de défense : moitié HAST + moitié stat de classe (jamais sous 1). */
export function getDefenseValue(unit, rules = COMBAT_RULES) {
  const { statId, statWeight, classWeight } = rules.damage.defense;
  return Math.max(1, unit.stats[statId] * statWeight + unit.stats[getOffenseStatId(unit.classId, rules)] * classWeight);
}

/** Aléa maximal d'un attaquant (fraction) : sa PER en %, plafonnée. */
export function getRandomCap(unit, rules = COMBAT_RULES) {
  const { statId, cap } = rules.damage.random;
  return Math.max(0, Math.min(cap, unit.stats[statId] / 100));
}

/** Bonus de combo (fraction) pour le n-ième coup consécutif sur la même cible. */
export function getComboBonus(unit, consecutiveHits, rules = COMBAT_RULES, extraHits = 0) {
  const { statId, perPointPerHit, maxHits } = rules.damage.combo;
  return Math.min(Math.max(0, consecutiveHits), maxHits + extraHits) * unit.stats[statId] * perPointPerHit;
}

/**
 * Dégâts d'un coup. options : { roll (tirage 0–1 de l'aléa), comboHits (n-ième coup consécutif
 * sur cette cible, 1 pour le premier), finalMultiplier (bonus final, 1 par défaut) }.
 * Renvoie le détail : { attack, defense, base, random, combo, fatigueFactor, finalMultiplier,
 * damage }.
 */
export function computeDamage(attacker, defender, { roll = 0, comboHits = 1, finalMultiplier = 1, comboExtra = 0 } = {}, rules = COMBAT_RULES) {
  const attack = getAttackValue(attacker, rules);
  const defense = getDefenseValue(defender, rules);
  const base = rules.damage.base * (attack / defense);
  const random = Math.max(0, Math.min(1, roll)) * getRandomCap(attacker, rules);
  // comboExtra : coups de combo en plus (talent Combinard).
  const combo = getComboBonus(attacker, comboHits, rules, comboExtra);
  const fatigueFactor = getFatigueFactor(attacker.fatigue, rules);
  const raw = base * (1 + random + combo) * fatigueFactor * finalMultiplier;
  const rounded = rules.rounding === 'floor' ? Math.floor(raw) : Math.round(raw);
  // raw : valeur exacte avant l'arrondi (journal de Ma Lice d'entraînement : jamais recalculée ailleurs) ;
  // attackStat / defenseStats : statistiques réellement lues pour l'attaque et la défense.
  return {
    attack, defense, base, random, combo, fatigueFactor, finalMultiplier, raw, damage: Math.max(rules.minDamage, rounded),
    attackStat: getOffenseStatId(attacker.classId, rules), defenseStats: [rules.damage.defense.statId, getOffenseStatId(defender.classId, rules)],
  };
}
