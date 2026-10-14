import { barrierDistance, isInContact, reachOf, sees } from '../CombatMovementManager.js';
import { isPinned } from '../CombatSituation.js';
import { chebyshev, pathTo, tileKey } from './PathfindingService.js';
import { estimateDuel, selectTarget } from './TargetSelectionService.js';

// Décision d'un combattant : quelle action, vers quelle cible, par quel chemin.
//
//   situation défavorable → RETREAT (recul vers une case plus sûre ; jamais s'il est plaqué)
//   supériorité, fatigué  → BREATHE (il se met hors de portée et récupère quelques tours)
//   cible à son allonge   → ATTACK (ou REPOSITION : une case voisine plus favorable, d'où il la touche encore)
//   cible accessible      → MOVE (MOVE_TO_TARGET : chemin vers l'angle d'approche choisi)
//   cible bloquée         → REPOSITION (détour pour s'en rapprocher) ou IDLE (attente, puis abandon)
//   plus d'adversaire     → IDLE
//
// Tout se décide sur l'état réel de la manche (positions, PV, cibles) ; le hasard ne fait que
// départager des choix proches. Coefficients : FIGHTER_AI_CONFIG.

export const AI_STATES = Object.freeze({
  IDLE: 'IDLE',
  SEEK_TARGET: 'SEEK_TARGET',
  MOVE_TO_TARGET: 'MOVE_TO_TARGET',
  ATTACK: 'ATTACK',
  REPOSITION: 'REPOSITION',
  RETREAT: 'RETREAT',
  BREATHE: 'BREATHE',
  KO: 'KO',
});

export const AI_ACTIONS = Object.freeze({ ATTACK: 'ATTACK', MOVE: 'MOVE', REPOSITION: 'REPOSITION', RETREAT: 'RETREAT', BREATHE: 'BREATHE', IDLE: 'IDLE' });

const STATE_OF_ACTION = Object.freeze({
  ATTACK: AI_STATES.ATTACK, MOVE: AI_STATES.MOVE_TO_TARGET, REPOSITION: AI_STATES.REPOSITION, RETREAT: AI_STATES.RETREAT, BREATHE: AI_STATES.BREATHE, IDLE: AI_STATES.IDLE,
});

const decision = (action, { target = null, path = [], reason }) => ({
  action, state: STATE_OF_ACTION[action], targetId: target?.id ?? null, path, destination: path.at(-1) ?? null, reason,
});

/**
 * Valeur d'une case, pour frapper `target`, selon le rôle du combattant (bonus de position) :
 *   Lutteur : contre la barrière (1), et la cible y est collée (+0,5 : il la plaque) ;
 *   Hastier : à distance de la cible (1), mais −1 si un adversaire serait à son contact ;
 *   Runner  : dans le dos de la cible, hors de son champ de vision (1).
 */
export function tileBonus(tile, ctx, target = null) {
  const { unit, rules, arena } = ctx;
  const { lutteurBarrier, lutteurPin, hastierReach, runnerRear } = rules.bonuses;
  if (unit.classId === lutteurBarrier.classId) {
    let value = barrierDistance(tile, arena) <= lutteurBarrier.distance ? 1 : 0;
    if (target && unit.classId === lutteurPin.classId && barrierDistance(target, arena) === 0) value += 0.5;
    return value;
  }
  if (unit.classId === hastierReach.classId && target) {
    const crowded = ctx.enemiesAround(tile, rules.contactRange).length > 0;
    return (chebyshev(tile, target) > rules.contactRange ? 1 : 0) - (crowded ? 1 : 0);
  }
  if (unit.classId === runnerRear.classId && target) return sees(target, tile, rules) ? 0 : 1;
  return 0;
}

/** Valeur d'une case d'où l'on touche la cible : moins d'adversaires autour, bonus de position. */
function contactTileValue(tile, target, ctx) {
  const { exposureWeight, bonusTileWeight, exposureByClass, bonusByClass } = ctx.config.approach;
  // Prudence propre à une classe (ex. Hastier : rester hors de la mêlée) ; 1 par défaut.
  const caution = exposureByClass?.[ctx.unit.classId] ?? 1;
  const weight = bonusTileWeight * (bonusByClass?.[ctx.unit.classId] ?? 1);
  return -exposureWeight * caution * ctx.enemiesAround(tile, 1, target).length + weight * tileBonus(tile, ctx, target);
}

/**
 * Situation du combattant : { hpRatio, threat (dégâts attendus par tour des adversaires au
 * contact), survivalTicks, adjacent, enemiesNear, alliesNear }.
 */
export function assessDanger(ctx) {
  const { unit, config } = ctx;
  const adjacent = ctx.enemies.filter((enemy) => isInContact(unit, enemy, ctx.rules));
  const threat = adjacent.reduce((sum, enemy) => sum + estimateDuel(unit, enemy, ctx).taken, 0);
  return {
    hpRatio: unit.hp / unit.maxHp,
    threat,
    survivalTicks: threat > 0 ? unit.hp / threat : Infinity,
    adjacent,
    enemiesNear: ctx.enemiesAround(unit, config.retreat.radius).length,
    alliesNear: ctx.alliesAround(unit, config.retreat.radius).length,
  };
}

/**
 * Le combattant doit-il reculer ? Renvoie la raison ('danger' : mort attendue sous peu,
 * 'outnumbered' : en infériorité numérique) ou null. `memory` : { retreatsUsed, retreatCooldownUntil }.
 */
export function shouldRetreat(ctx, memory = {}) {
  const { unit, config, tick } = ctx;
  const r = config.retreat;
  if ((memory.retreatsUsed ?? 0) >= r.maxPerRound || tick < (memory.retreatCooldownUntil ?? 0)) return null;
  if (r.requiresAlly && ctx.allies.length === 0) return null;
  // Plaqué contre la barrière par un Lutteur : il ne peut plus reculer.
  if (isPinned(unit, ctx.fighters, ctx.arena, ctx.rules)) return null;
  const danger = assessDanger(ctx);
  if (!danger.adjacent.length && danger.enemiesNear === 0) return null;
  // Situation favorable : il peut achever un adversaire au contact → il reste.
  if (danger.adjacent.some((enemy) => estimateDuel(unit, enemy, ctx).ticksToKill <= r.finishTicks)) return null;
  if (danger.hpRatio <= r.hpRatio && danger.survivalTicks <= r.survivalTicks) return 'danger';
  if (danger.hpRatio <= r.outnumberedHpRatio && danger.enemiesNear - danger.alliesNear >= r.outnumberedBy) return 'outnumbered';
  return null;
}

/** Case de recul : plus loin des adversaires, si possible près d'un allié. { tile, path } ou null. */
export function findRetreatTile(ctx) {
  const { unit, config } = ctx;
  const r = config.retreat;
  const safety = (tile) => Math.min(...ctx.enemies.map((enemy) => chebyshev(enemy, tile)));
  const current = safety(unit);
  let best = null;
  for (const entry of ctx.distances.values()) {
    if (entry.cost === 0 || entry.cost > r.maxDistance + 0.01) continue;
    const s = safety(entry);
    if (s < r.minEnemyDistance || s <= current) continue;
    const score = s + r.allyWeight * Math.min(2, ctx.alliesAround(entry, 1).length) - r.costWeight * entry.cost;
    if (!best || score > best.score) best = { tile: { x: entry.x, y: entry.y }, score };
  }
  return best ? { tile: best.tile, path: pathTo(ctx.distances, best.tile) } : null;
}

/**
 * Le combattant doit-il souffler (se ménager pour récupérer) ? En supériorité numérique,
 * assez fatigué, aucun adversaire au contact, pendant qu'un allié tient le combat (au contact
 * d'un adversaire). Jamais pendant son temps de repos (memory.breathCooldownUntil).
 */
export function shouldBreathe(ctx, memory = {}) {
  const { unit, config, rules, tick } = ctx;
  const b = config.breathe;
  if (!b || (unit.fatigue ?? 0) < b.minFatigue || tick < (memory.breathCooldownUntil ?? 0)) return false;
  if (ctx.allies.length + 1 <= ctx.enemies.length) return false;
  if (ctx.enemies.some((enemy) => isInContact(enemy, unit, rules))) return false;
  return ctx.allies.some((ally) => ctx.enemies.some((enemy) => isInContact(ally, enemy, rules)));
}

/** Case où souffler : un pas qui l'éloigne le plus des adversaires (ou rester sur place). */
export function findBreathTile(ctx) {
  const { unit } = ctx;
  const safety = (tile) => Math.min(...ctx.enemies.map((enemy) => chebyshev(enemy, tile)));
  let best = { tile: null, value: safety(unit) };
  for (const entry of ctx.distances.values()) {
    if (entry.cost === 0 || entry.cost > 1.01) continue;
    const value = safety(entry);
    if (value > best.value) best = { tile: { x: entry.x, y: entry.y }, value };
  }
  return best.tile ? [best.tile] : [];
}

/**
 * Angle d'approche : parmi les cases au contact de la cible accessibles, la moins chère en
 * chemin, la moins exposée, celle qui donne un bonus ; un peu de hasard varie les angles.
 * { tile, path } ou null si aucune n'est accessible.
 */
export function chooseApproach(target, ctx) {
  const { jitter } = ctx.config.approach;
  let best = null;
  for (const tile of ctx.attackTiles(target)) {
    const entry = ctx.distances.get(tileKey(tile.x, tile.y));
    if (!entry) continue;
    const score = entry.cost - contactTileValue(tile, target, ctx) + ctx.rng() * jitter;
    if (!best || score < best.score) best = { tile, score };
  }
  return best ? { tile: best.tile, path: pathTo(ctx.distances, best.tile) } : null;
}

/** À son allonge : une case voisine, d'où il touche toujours la cible, nettement meilleure ? */
export function findContactReposition(target, ctx) {
  const { unit, config, rules } = ctx;
  const here = contactTileValue(unit, target, ctx);
  let best = null;
  for (const tile of ctx.attackTiles(target)) {
    if (chebyshev(tile, unit) !== 1 || chebyshev(tile, target) > reachOf(unit, rules)) continue;
    if (!ctx.distances.has(tileKey(tile.x, tile.y))) continue;
    const gain = contactTileValue(tile, target, ctx) - here;
    if (gain >= config.reposition.minGain && (!best || gain > best.gain)) best = { tile, gain };
  }
  return best ? { tile: best.tile, path: [best.tile] } : null;
}

/**
 * Cible inaccessible : case atteignable qui rapproche le plus de la cible (détour), en
 * pondérant la longueur du chemin. null si rester sur place est déjà le mieux.
 */
export function findDetour(target, ctx) {
  const { unit, config } = ctx;
  const weight = config.reposition.detourCostWeight;
  const here = chebyshev(unit, target);
  let best = null;
  for (const entry of ctx.distances.values()) {
    if (entry.cost === 0) continue;
    const remaining = chebyshev(entry, target);
    if (remaining >= here) continue;
    const score = remaining + weight * entry.cost;
    if (!best || score < best.score) best = { tile: { x: entry.x, y: entry.y }, score };
  }
  return best ? { tile: best.tile, path: pathTo(ctx.distances, best.tile) } : null;
}

/**
 * Décision complète d'un combattant. `memory` (FighterAIController) : { targetId, ignored,
 * retreatsUsed, retreatCooldownUntil }.
 */
export function decide(ctx, memory = {}) {
  const retreatReason = shouldRetreat(ctx, memory);
  if (retreatReason) {
    const retreat = findRetreatTile(ctx);
    if (retreat) return decision(AI_ACTIONS.RETREAT, { path: retreat.path, reason: retreatReason });
  }
  // Se ménager : en supériorité, un combattant fatigué laisse ses alliés tenir et récupère.
  if (shouldBreathe(ctx, memory)) return decision(AI_ACTIONS.BREATHE, { path: findBreathTile(ctx), reason: 'breathe' });
  const choice = selectTarget(ctx, memory);
  if (!choice) return decision(AI_ACTIONS.IDLE, { reason: 'no-enemy' });
  const { target } = choice;
  if (choice.reach === 0) {
    if (ctx.rng() < ctx.config.reposition.probability) {
      const better = findContactReposition(target, ctx);
      if (better) return decision(AI_ACTIONS.REPOSITION, { target, path: better.path, reason: 'better-angle' });
    }
    return decision(AI_ACTIONS.ATTACK, { target, reason: 'contact' });
  }
  const approach = chooseApproach(target, ctx);
  if (approach) return decision(AI_ACTIONS.MOVE, { target, path: approach.path, reason: 'approach' });
  const detour = findDetour(target, ctx);
  if (detour) return decision(AI_ACTIONS.REPOSITION, { target, path: detour.path, reason: 'detour' });
  return decision(AI_ACTIONS.IDLE, { target, reason: 'blocked' });
}
