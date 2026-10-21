import { isActive, isInContact } from './CombatMovementManager.js';

// Talents en combat — règles pures, sans partie : chaque unité de manche porte les effets de
// ses talents (unit.talentEffects, copiés à sa création depuis data/talents.js par
// systems/talents/TalentEffects.js). Les combattants de l'IA n'en ont jamais.
//
//   prepareTalentUnits(units)          au début de la manche : auras, garde du capitaine,
//                                      présence du capitaine (effets d'équipe)
//   talentStrikeModifiers(unit, target, fighters, rules)  au moment d'un coup : bonus de dégâts
//                                      finaux de l'attaquant, malus des Tacticiens à son contact,
//                                      réduction des dégâts de la cible → { bonus, reduction, ids }

const effectsOf = (unit, type) => (unit.talentEffects ?? []).filter((effect) => effect.type === type);
const sum = (effects) => effects.reduce((total, effect) => total + (effect.value ?? 0), 0);

/** Effets d'équipe d'une manche : Porte-étendard / Seigneur de guerre, Garde du corps, Fidèle. */
export function prepareTalentUnits(units) {
  for (const unit of units) {
    const allies = units.filter((other) => other.side === unit.side);
    // Aura : bonus de dégâts finaux donné par les alliés (et par lui-même si `self`).
    unit.auraBonus = allies.reduce((total, ally) => total + sum(effectsOf(ally, 'aura').filter((e) => ally !== unit || e.self)), 0);
    unit.auraIds = allies.filter((ally) => effectsOf(ally, 'aura').some((e) => ally !== unit || e.self)).flatMap((ally) => effectsOf(ally, 'aura').map((e) => e.talentId));
    // Capitaine aligné avec un Garde du corps : dégâts reçus en moins.
    const guard = unit.isCaptain ? allies.filter((ally) => ally !== unit).reduce((total, ally) => total + sum(effectsOf(ally, 'guardCaptain')), 0) : 0;
    // Écho des cimes : dégâts reçus en moins pour toute la manche de son camp (lui compris).
    const auraGuard = allies.reduce((total, ally) => total + sum(effectsOf(ally, 'auraGuard')), 0);
    unit.damageTakenReduction = (unit.damageTakenReduction ?? 0) + guard + auraGuard;
    if (guard) unit.guarded = true;
    unit.hasCaptainAlly = allies.some((ally) => ally !== unit && ally.isCaptain);
  }
  return units;
}

/** Le combattant est-il le dernier debout de son camp (Dernier rempart) ? */
export function isLastStanding(unit, fighters = []) {
  return isActive(unit) && fighters.filter((other) => other.side === unit.side && isActive(other)).length === 1;
}

/** La condition `when` d'un bonus de dégâts finaux est-elle remplie pour ce coup ? */
function conditionMet(effect, unit, target, fighters = []) {
  switch (effect.when) {
    case 'always': return true;
    case 'targetEngaged': return Boolean(target.targetId) && target.targetId !== unit.id;
    case 'firstStrike': return (unit.strikes ?? 0) === 0;
    case 'selfHpBelow': return unit.hp < unit.maxHp * effect.threshold;
    case 'targetHpBelow': return target.hp < target.maxHp * effect.threshold;
    case 'home': return unit.venue === 'home';
    case 'away': return unit.venue === 'away';
    case 'queen': return unit.competition === 'queen';
    case 'vsClass': return target.classId === effect.classId;
    case 'withCaptain': return Boolean(unit.hasCaptainAlly);
    case 'perKnockout': return (unit.knockdowns ?? 0) > 0;
    case 'lastStanding': return isLastStanding(unit, fighters);
    default: return false;
  }
}

/**
 * Modificateurs de talents d'un coup : { bonus (dégâts finaux de l'attaquant, fraction, malus des
 * Tacticiens déduit), reduction (dégâts reçus en moins par la cible), ids (talents en jeu) }.
 */
export function talentStrikeModifiers(unit, target, fighters, rules) {
  const ids = [];
  let bonus = unit.auraBonus ?? 0;
  if (bonus) ids.push(...(unit.auraIds ?? []));
  for (const effect of effectsOf(unit, 'finalDamage')) {
    if (!conditionMet(effect, unit, target, fighters)) continue;
    bonus += effect.when === 'perKnockout' ? effect.value * Math.min(effect.max ?? 1, unit.knockdowns ?? 0) : effect.value;
    ids.push(effect.talentId);
  }
  // Tacticien : chaque adversaire de l'attaquant à son contact lui retire des dégâts finaux.
  for (const other of fighters) {
    if (other.side === unit.side || !isActive(other) || !isInContact(other, unit, rules)) continue;
    const malus = sum(effectsOf(other, 'enemyContact'));
    if (malus) {
      bonus -= malus;
      ids.push(...effectsOf(other, 'enemyContact').map((e) => e.talentId));
    }
  }
  // Réductions conditionnelles de la cible (Dernier rempart : dernier debout de son camp).
  let reduction = target.damageTakenReduction ?? 0;
  for (const effect of effectsOf(target, 'damageTaken').filter((e) => e.when)) {
    if (conditionMet(effect, target, unit, fighters)) reduction += effect.value ?? 0;
  }
  reduction = Math.min(0.9, reduction);
  return { bonus, reduction, ids: [...new Set(ids)] };
}

/** Fureur du Nord : ses pénalités de fatigue sont-elles ignorées pour ce coup ? */
export function ignoresFatigue(unit, target, fighters) {
  return effectsOf(unit, 'fatigueIgnore').some((effect) => conditionMet({ ...effect, when: effect.when ?? 'always' }, unit, target, fighters));
}

/** Bonus affichés au début de la manche pour un combattant qui a un talent : ['talent:<id>']. */
export function talentBonusIds(unit) {
  return [...new Set((unit.talentEffects ?? []).map((effect) => `talent:${effect.talentId}`))];
}
