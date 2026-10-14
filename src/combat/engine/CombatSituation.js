import { COMBAT_RULES } from '../../data/combatRules.js';
import { barrierDistance, isActive, isInContact, sees } from './CombatMovementManager.js';
import { talentBonusIds } from './TalentCombat.js';

// Bonus de POSITION d'un combattant (v0.65, béhourd réel) — utilisés par le moteur au moment
// du coup et par l'IA pour estimer un affrontement ou choisir une case :
//   Lutteur contre la barrière (+LUTTE) ; sa cible collée à la barrière est « plaquée » ;
//   Hastier qui frappe à distance (bonus) ou gêné par un adversaire au contact (malus) ;
//   Runner qui frappe dans le dos (bonus, et renversement s'il arrive en courant) ;
//   angle mort des casques fermés (bonus pour tous).

/** Lutteur à ≤ `distance` case(s) de la barrière (bord de la lice). */
export function isNearBarrier(unit, arena, rules = COMBAT_RULES) {
  return barrierDistance(unit, arena) <= rules.bonuses.lutteurBarrier.distance;
}

/** Cible collée à la barrière (case du bord de la lice). */
export function isAgainstBarrier(unit, arena) {
  return barrierDistance(unit, arena) === 0;
}

/** Au moins un adversaire debout au contact. */
export function hasEnemyInContact(unit, fighters, rules = COMBAT_RULES) {
  return fighters.some((other) => other.side !== unit.side && isActive(other) && isInContact(other, unit, rules));
}

/** Plaqué : collé à la barrière avec un Lutteur adverse au contact (il ne peut plus reculer). */
export function isPinned(unit, fighters, arena, rules = COMBAT_RULES) {
  const { classId } = rules.bonuses.lutteurPin;
  return isAgainstBarrier(unit, arena)
    && fighters.some((other) => other.side !== unit.side && isActive(other) && other.classId === classId && isInContact(other, unit, rules));
}

/**
 * Stats effectives d'un combattant à cet instant : bonus de position qui modifient une stat
 * (Lutteur contre la barrière) appliqués à une copie. Renvoie { classId, fatigue, stats, situation }.
 */
export function withSituation(unit, fighters, arena, rules = COMBAT_RULES) {
  const stats = { ...unit.stats };
  const situation = [];
  const { lutteurBarrier } = rules.bonuses;
  if (unit.classId === lutteurBarrier.classId && isNearBarrier(unit, arena, rules)) {
    stats[lutteurBarrier.statId] *= 1 + lutteurBarrier.bonus;
    situation.push('barrier');
  }
  return { classId: unit.classId, fatigue: unit.fatigue, stats, situation };
}

/**
 * Bonus de position d'un coup de `unit` sur `target` (au moment de frapper) :
 * { finalBonus (fraction, malus compris), comboBoost (coups de combo en plus), stun (tours de
 * renversement infligés), blind (la cible ne voyait pas l'attaquant), ids ['pinned' | 'reach'
 * | 'crowded' | 'rear' | 'blind'] }. `tick` : tour en cours (course du Runner).
 */
export function strikeSituation(unit, target, fighters, arena, rules = COMBAT_RULES, tick = 0) {
  const { lutteurPin, hastierReach, hastierCrowded, runnerRear, blindSpot } = rules.bonuses;
  const ids = [];
  let finalBonus = 0;
  let comboBoost = 0;
  let stun = 0;
  if (unit.classId === lutteurPin.classId && isAgainstBarrier(target, arena) && isInContact(unit, target, rules)) {
    comboBoost += lutteurPin.comboBoost;
    ids.push('pinned');
  }
  if (unit.classId === hastierReach.classId) {
    if (!isInContact(unit, target, rules)) {
      finalBonus += hastierReach.finalDamage;
      ids.push('reach');
    }
    if (hasEnemyInContact(unit, fighters, rules)) {
      finalBonus += hastierCrowded.finalDamage;
      ids.push('crowded');
    }
  }
  const blind = !sees(target, unit, rules);
  if (blind) {
    finalBonus += blindSpot.finalDamage;
    ids.push('blind');
    if (unit.classId === runnerRear.classId) {
      finalBonus += runnerRear.finalDamage;
      ids.push('rear');
      // Percussion : il arrive en courant (un pas ce tour-ci ou le précédent) et renverse.
      if ((unit.lastMoveTick ?? -Infinity) >= tick - 1) stun = runnerRear.stunTicks;
    }
  }
  return { finalBonus, comboBoost, stun, blind, ids };
}

/**
 * Bonus de chaque combattant au lancement de la manche (positions de départ) :
 * { [unitId]: ['captain' | 'barrier' | 'item:…' | 'talent:…'] }. Les bonus du coup (distance,
 * dos, angle mort) dépendent de chaque échange : ils ne sont pas annoncés au départ.
 */
export function getStartingBonuses(units, arena, rules = COMBAT_RULES) {
  return Object.fromEntries(units.map((unit) => [unit.id, [
    ...(unit.isCaptain ? ['captain'] : []),
    ...withSituation(unit, units, arena, rules).situation,
    ...effectBonusIds(unit),
    ...talentBonusIds(unit),
    // Malus saisonnier de sa classe (v0.70) : affiché au lancement comme les autres modificateurs.
    ...((unit.seasonFactor ?? 1) < 1 ? [`season:${unit.season}`] : []),
  ]]));
}

/** Bonus dus aux effets temporaires d'un combattant (ex. 'item:hypocras'), pour l'affichage. */
export function effectBonusIds(unit) {
  return (unit.effects ?? []).map((effect) => `item:${effect.sourceItemId ?? effect.type}`);
}
