import { computeDamage } from '../CombatDamageCalculator.js';
import { withSituation } from '../CombatSituation.js';
import { isInReach } from '../CombatMovementManager.js';
import { chebyshev } from './PathfindingService.js';

// Choix de la cible : chaque adversaire perçu (casques fermés) reçoit un score de priorité
// (coefficients dans FIGHTER_AI_CONFIG.target). La distance compte, mais aussi l'accessibilité,
// le rapport de force, le danger autour de lui, la possibilité d'attaquer tout de suite, la
// cible actuelle et, pour le Runner, un dos offert.

/**
 * Affrontement attendu entre deux combattants, d'après les règles de dégâts (aléa moyen, sans
 * combo) : { dealt, taken, ticksToKill, ticksToDie }.
 */
export function estimateDuel(unit, enemy, { fighters, arena, rules }) {
  const me = withSituation(unit, fighters, arena, rules);
  const them = withSituation(enemy, fighters, arena, rules);
  const dealt = computeDamage(me, them, { roll: 0.5, comboHits: 1 }, rules).damage;
  const taken = computeDamage(them, me, { roll: 0.5, comboHits: 1 }, rules).damage;
  return { dealt, taken, ticksToKill: Math.ceil(enemy.hp / dealt), ticksToDie: Math.ceil(unit.hp / taken) };
}

/** Pas nécessaires pour toucher `target` (0 s'il est déjà à son allonge), ou null s'il est hors d'atteinte. */
export function reachCost(target, ctx) {
  if (isInReach(ctx.unit, target, ctx.rules)) return 0;
  let best = null;
  for (const tile of ctx.attackTiles(target)) {
    const entry = ctx.distances.get(`${tile.x},${tile.y}`);
    if (entry && (best === null || entry.cost < best)) best = entry.cost;
  }
  return best;
}

/**
 * Scores des adversaires qu'il perçoit, du meilleur au moins bon :
 * [{ target, score, reach, terms }]. `memory` : { targetId, ignored: Map(id → tour) }.
 * `onlyInReach` : seulement ceux qu'il peut frapper d'où il est (opportunité).
 */
export function scoreTargets(ctx, memory = {}, { onlyInReach = false } = {}) {
  const { unit, config, rng, tick } = ctx;
  const w = config.target;
  const wounds = 1 - unit.hp / unit.maxHp;
  const attackersOf = (target) => ctx.allies.filter((ally) => ally.targetId === target.id).length;
  // Casques fermés : seuls comptent les adversaires vus ou sentis ; s'il n'en perçoit aucun, il
  // se retourne et les cherche tous (jamais d'attente indéfinie).
  const perceived = ctx.perceives ? ctx.enemies.filter((enemy) => ctx.perceives(enemy)) : ctx.enemies;
  const seen = perceived.length || onlyInReach ? perceived : ctx.enemies;
  const candidates = seen.filter((enemy) => !onlyInReach || isInReach(unit, enemy, ctx.rules));
  // Cibles écartées (chemin bloqué) : ignorées tant que d'autres restent possibles.
  const allowed = candidates.filter((enemy) => !(memory.ignored?.get(enemy.id) > tick));
  const pool = allowed.length ? allowed : candidates;
  const backWeight = w.backWeight?.[unit.classId] ?? 0;
  return pool.map((target) => {
    const reach = reachCost(target, ctx);
    const duel = estimateDuel(unit, target, ctx);
    const strength = Math.max(-w.strengthCap, Math.min(w.strengthCap, Math.log2(duel.ticksToDie / duel.ticksToKill)));
    const others = ctx.enemiesAround(target, w.dangerRadius, target).length;
    const attackers = attackersOf(target);
    const crowd = Math.max(0, attackers - w.crowdLimit);
    // Coordination (stratégies avancées ; 0 par défaut) : achever un adversaire presque KO,
    // frapper la même cible que ses alliés, soulager un allié blessé que la cible attaque.
    const victim = target.targetId ? ctx.allies.find((ally) => ally.id === target.targetId) : null;
    const terms = {
      proximity: -w.distanceWeight * (reach ?? chebyshev(unit, target) + w.unreachablePenalty),
      strength: w.strengthWeight * strength,
      danger: -w.dangerWeight * others * (1 + w.cautionFromWounds * wounds),
      opportunity: reach === 0 ? w.contactBonus : 0,
      current: memory.targetId === target.id ? w.currentTargetBonus : 0,
      crowd: -w.crowdWeight * crowd,
      finish: (w.finishWeight ?? 0) * (duel.ticksToKill <= 1 ? 1 : duel.ticksToKill <= 2 ? 0.5 : 0),
      focus: (w.focusWeight ?? 0) * Math.min(attackers, w.crowdLimit),
      protect: victim ? (w.protectWeight ?? 0) * (1 - victim.hp / victim.maxHp) : 0,
      // Runner : un adversaire aux prises avec un allié lui offre son dos.
      back: backWeight && victim ? backWeight : 0,
      // Préférences des profils : adversaires épuisés, capitaine, classe visée en priorité.
      tired: (w.tiredWeight ?? 0) * ((target.fatigue ?? 0) / 100),
      captain: target.isCaptain ? (w.captainWeight ?? 0) : 0,
      priority: w.classPriority?.[target.classId] ?? 0,
      jitter: rng() * w.jitter,
    };
    const score = Object.values(terms).reduce((sum, v) => sum + v, 0);
    return { target, score, reach, duel, terms };
  }).sort((a, b) => b.score - a.score);
}

/** Meilleure cible (entrée de scoreTargets), ou null s'il n'y a plus d'adversaire. */
export function selectTarget(ctx, memory = {}, options = {}) {
  return scoreTargets(ctx, memory, options)[0] ?? null;
}
