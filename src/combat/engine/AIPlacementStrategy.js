import { AI_PLACEMENT_CONFIG, COMBAT_RULES } from '../../data/combatRules.js';
import { duelStrength } from './ai/duelEstimate.js';

// Stratégies de placement (IA, et placement automatique proposé au joueur). Une stratégie
// reçoit le contexte et renvoie { fighterId, tile } ; pour en ajouter une : PLACEMENT_STRATEGIES.
//
// contexte : { manager (PlacementManager), side, classOf(fighterId), rng, config, unitOf? }
//   unitOf(fighterId) : combattant de manche (stats, fatigue, PV) — stratégies « duel » et « anticipate ».
//
// Formation du béhourd (v0.65) : un Lutteur contre chaque barrière (grand côté), un Hastier
// juste derrière chaque Lutteur, le Runner au milieu de la largeur, prêt à passer dans le dos
// des adversaires. Toutes les stratégies réfléchies partent de cette formation.

const opponentSide = (side) => (side === 'A' ? 'B' : 'A');
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Centre de la zone adverse (pour préférer la ligne avant). */
function enemyZoneCenter(manager, side) {
  const { area } = manager.arena.getSide(side === 'A' ? 1 : 0);
  return { x: area.x + (area.w - 1) / 2, y: area.y + (area.h - 1) / 2 };
}

/** Distance d'une case au grand côté le plus proche (0 : collée à la barrière). */
const longSideDistance = (tile, arena) => Math.min(tile.y, arena.height - 1 - tile.y);
/** Moitié de la largeur où se trouve la case (un Lutteur par grand côté). */
const halfOf = (tile, arena) => (tile.y < arena.height / 2 ? 'low' : 'high');
/** Recul d'une case par rapport à une autre, vers son propre camp (positif : plus en retrait). */
const behindness = (tile, other, enemyCenter) => Math.abs(tile.x - enemyCenter.x) - Math.abs(other.x - enemyCenter.x);

/** Distance (en x) entre la ligne avant de la zone d'un camp et le centre de la zone adverse. */
function frontDistanceOf(manager, side, enemyCenter) {
  const { area } = manager.arena.getSide(side === 'A' ? 0 : 1);
  return Math.min(Math.abs(area.x - enemyCenter.x), Math.abs(area.x + area.w - 1 - enemyCenter.x));
}

/**
 * Score d'une case dans la formation, pour un combattant de classe `classId`, d'après les alliés
 * déjà posés ([{ classId, tile }]). `frontDistance` : distance de la ligne avant au centre
 * adverse (repère du « retrait »). Plus le score est haut, mieux c'est.
 */
export function formationScore(context) {
  return roleScore(context) + overloadScore(context);
}

/** Surcharge d'un flanc : bonus pour la moitié de la largeur où se trouvent déjà la plupart de ses alliés. */
function overloadScore({ tile, allies = [], arena, config = AI_PLACEMENT_CONFIG }) {
  if (!config.overloadWeight) return 0;
  const low = allies.filter((a) => halfOf(a.tile, arena) === 'low').length;
  const preferred = low >= allies.length - low ? 'low' : 'high';
  return halfOf(tile, arena) === preferred ? config.overloadWeight : 0;
}

function roleScore({ classId, tile, allies = [], arena, enemyCenter, frontDistance = 0, config = AI_PLACEMENT_CONFIG, rules = COMBAT_RULES }) {
  const front = config.frontWeight / (1 + Math.abs(tile.x - enemyCenter.x));
  const { lutteurBarrier, hastierReach, runnerRear } = rules.bonuses;
  if (classId === lutteurBarrier.classId) {
    let score = front;
    if (longSideDistance(tile, arena) <= lutteurBarrier.distance) score += config.barrierWeight;
    // Un Lutteur par grand côté : la barrière déjà tenue vaut moins.
    if (allies.some((a) => a.classId === classId && longSideDistance(a.tile, arena) <= lutteurBarrier.distance && halfOf(a.tile, arena) === halfOf(tile, arena))) score -= config.sharedBarrierPenalty;
    return score;
  }
  if (classId === hastierReach.classId) {
    const lutteurs = allies.filter((a) => a.classId === lutteurBarrier.classId);
    const covers = (lutteur, at) => {
      const back = behindness(at, lutteur.tile, enemyCenter);
      return back >= 1 && back <= 2 && Math.abs(at.y - lutteur.tile.y) <= 1;
    };
    // Derrière un Lutteur allié pas encore couvert par un autre Hastier.
    const free = lutteurs.filter((l) => !allies.some((a) => a.classId === classId && covers(l, a.tile)));
    if (free.some((l) => covers(l, tile))) return config.coverWeight;
    if (lutteurs.some((l) => covers(l, tile))) return config.coverWeight * 0.4;
    // Sans Lutteur à couvrir : 1 à 2 cases en retrait de la ligne avant.
    const depth = Math.abs(tile.x - enemyCenter.x) - frontDistance;
    return depth >= 1 && depth <= 2 ? config.rearWeight : 0;
  }
  if (classId === runnerRear.classId) {
    const middle = (arena.height - 1) / 2;
    return front + config.centreWeight * (1 - Math.abs(tile.y - middle) / middle);
  }
  return front;
}

/** Alliés déjà posés d'un camp : [{ classId, tile }]. */
function placedAllies(manager, side, classOf) {
  return [...manager.placements[side]].map(([fighterId, tile]) => ({ classId: classOf(fighterId), tile }));
}

/** Score d'une case d'après le rapport de force avec les adversaires déjà posés (stratégies « duel »). */
function scoreDuelTile(unit, tile, { opponents, enemyCenter, frontDistance, allies, arena, config }) {
  let score = 0;
  for (const opponent of opponents) {
    score += (config.duelWeight ?? 3) * duelStrength(unit, opponent.unit) / (1 + dist(tile, opponent.tile));
  }
  return score + formationScore({ classId: unit.classId, tile, allies, arena, enemyCenter, frontDistance, config });
}

export const PLACEMENT_STRATEGIES = {
  /** Formation : Lutteurs contre les barrières, Hastiers derrière eux, Runner au centre. */
  formation({ manager, side, classOf, rng, config }) {
    const enemyCenter = enemyZoneCenter(manager, side);
    const frontDistance = frontDistanceOf(manager, side, enemyCenter);
    const allies = placedAllies(manager, side, classOf);
    let best = null;
    for (const fighterId of manager.getRemaining(side)) {
      for (const tile of manager.getAvailableTiles(side)) {
        const score = formationScore({ classId: classOf(fighterId), tile, allies, arena: manager.arena, enemyCenter, frontDistance, config }) + config.jitter * rng();
        if (!best || score > best.score) best = { fighterId, tile, score };
      }
    }
    return best ? { fighterId: best.fighterId, tile: best.tile } : null;
  },

  /** Première ligne : chaque combattant, dans l'ordre, sur la case libre la plus avancée (aucune lecture des classes). */
  frontline({ manager, side, rng, config }) {
    const fighterId = manager.getRemaining(side)[0];
    if (!fighterId) return null;
    const enemyCenter = enemyZoneCenter(manager, side);
    let best = null;
    for (const tile of manager.getAvailableTiles(side)) {
      const score = -dist(tile, enemyCenter) + config.jitter * rng();
      if (!best || score > best.score) best = { tile, score };
    }
    return best ? { fighterId, tile: best.tile } : null;
  },

  /**
   * Duel : la formation, plus le RAPPORT DE FORCE réel (statistiques, fatigue : duelStrength)
   * avec les adversaires déjà posés. Nécessite `unitOf(fighterId)` ; sinon, la formation seule.
   */
  duel(context) {
    const { manager, side, rng, config, unitOf, classOf } = context;
    if (!unitOf) return PLACEMENT_STRATEGIES.formation(context);
    const opponents = [...manager.placements[opponentSide(side)]].map(([fighterId, tile]) => ({ unit: unitOf(fighterId), tile }));
    const enemyCenter = enemyZoneCenter(manager, side);
    const frontDistance = frontDistanceOf(manager, side, enemyCenter);
    const allies = placedAllies(manager, side, classOf);
    let best = null;
    for (const fighterId of manager.getRemaining(side)) {
      const unit = unitOf(fighterId);
      for (const tile of manager.getAvailableTiles(side)) {
        const score = scoreDuelTile(unit, tile, { opponents, enemyCenter, frontDistance, allies, arena: manager.arena, config }) + config.jitter * rng();
        if (!best || score > best.score) best = { fighterId, tile, score };
      }
    }
    return best ? { fighterId: best.fighterId, tile: best.tile } : null;
  },

  /**
   * Anticipation : « duel », plus deux lectures des adversaires PAS ENCORE posés :
   *   - garder ses meilleurs pour la fin (placer en dernier est un avantage) : un combattant
   *     plus fort que les adversaires encore à poser attend (reserveWeight) ;
   *   - ne pas s'exposer en première ligne face à plus fort que soi encore à venir (threatWeight).
   */
  anticipate(context) {
    const { manager, side, rng, config, unitOf, classOf } = context;
    if (!unitOf) return PLACEMENT_STRATEGIES.formation(context);
    const other = opponentSide(side);
    const opponents = [...manager.placements[other]].map(([fighterId, tile]) => ({ unit: unitOf(fighterId), tile }));
    const pending = manager.getRemaining(other).map(unitOf);
    const enemyCenter = enemyZoneCenter(manager, side);
    const frontDistance = frontDistanceOf(manager, side, enemyCenter);
    const allies = placedAllies(manager, side, classOf);
    let best = null;
    for (const fighterId of manager.getRemaining(side)) {
      const unit = unitOf(fighterId);
      const vs = pending.map((enemy) => duelStrength(unit, enemy));
      const reserve = pending.length ? vs.reduce((s, v) => s + Math.max(0, v), 0) / pending.length : 0;
      const threat = pending.length ? vs.reduce((s, v) => s + Math.max(0, -v), 0) / pending.length : 0;
      for (const tile of manager.getAvailableTiles(side)) {
        const exposure = 1 / (1 + dist(tile, enemyCenter));
        const score = scoreDuelTile(unit, tile, { opponents, enemyCenter, frontDistance, allies, arena: manager.arena, config })
          - (config.reserveWeight ?? 1) * reserve
          - (config.threatWeight ?? 1) * threat * exposure
          + config.jitter * rng();
        if (!best || score > best.score) best = { fighterId, tile, score };
      }
    }
    return best ? { fighterId: best.fighterId, tile: best.tile } : null;
  },

  /** Hasard (référence, tests). */
  random({ manager, side, rng }) {
    const remaining = manager.getRemaining(side);
    const tiles = manager.getAvailableTiles(side);
    if (!remaining.length || !tiles.length) return null;
    return { fighterId: remaining[Math.floor(rng() * remaining.length)], tile: tiles[Math.floor(rng() * tiles.length)] };
  },
};

/** Choix du prochain placement d'un camp selon la stratégie configurée. */
export function chooseAIPlacement({ manager, side = 'B', classOf, rng = Math.random, config = AI_PLACEMENT_CONFIG, unitOf = null }) {
  const strategy = PLACEMENT_STRATEGIES[config.strategy] ?? PLACEMENT_STRATEGIES.formation;
  return strategy({ manager, side, classOf, rng, config, unitOf });
}

/** Joue le placement d'un camp (IA ou placement automatique). Renvoie le résultat de manager.place. */
export function placeAutomatically({ manager, side, classOf, rng = Math.random, config = AI_PLACEMENT_CONFIG, unitOf = null }) {
  const choice = chooseAIPlacement({ manager, side, classOf, rng, config, unitOf });
  if (!choice) return { ok: false, reason: 'Aucun placement possible.' };
  return manager.place(side, choice.fighterId, choice.tile);
}
