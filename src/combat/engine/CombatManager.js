import { COMBAT_RULES, FIGHTER_AI_CONFIG } from '../../data/combatRules.js';
import { directionTo, isActive } from './CombatMovementManager.js';
import { getStartingBonuses } from './CombatSituation.js';
import { createAIContext } from './ai/aiContext.js';
import { CombatController, isStunned } from './ai/CombatController.js';
import { FighterAIController } from './ai/FighterAIController.js';
import { MovementController } from './ai/MovementController.js';
import { tileKey } from './ai/PathfindingService.js';
import { prepareTalentUnits } from './TalentCombat.js';
import { applyTickFatigue } from './RoundFatigue.js';

// Simulation d'une manche Joueur contre IA, en tours (« ticks »), sans interface ni animation.
// Chaque combattant (des deux camps) est guidé par sa propre IA (src/combat/engine/ai/) :
//
//   FighterAIController   cycles de décision, réactions aux événements, plan à suivre
//     → DecisionService    action : ATTACK, MOVE, REPOSITION, RETREAT, IDLE
//     → TargetSelectionService  score de chaque adversaire
//     → PathfindingService chemins sur la grille (détours compris)
//   MovementController    pas effectifs (vitesse cumulée : COMBAT_RULES.moveTilesPerTick)
//   CombatController      attaques (règles de dégâts inchangées)
//
// Chaque tour :
//   1. ordre d'action : endurance décroissante (égalité : ordre tiré une fois pour la manche) ;
//   2. décisions et déplacements, dans cet ordre ;
//   3. attaques, dans l'ordre d'endurance (le plus endurant frappe en premier) ;
//   4. la manche s'arrête dès qu'un camp n'a plus aucun combattant actif.
//
// Le résultat contient les ÉVÉNEMENTS du combat : la présentation les rejoue
// (src/combat/presentation/CombatPlayback.js) sans rien recalculer.
//
// Événements : { tick, type: 'target' | 'ai' | 'move' | 'attack' | 'stun' | 'lastStand' | 'ko' | 'end', … }
//   'ai' : changement d'état de l'IA d'un combattant { unitId, state, reason } ;
//   'stun' : renversé par un Runner { unitId, byId, until } ;
//   'lull' : temps mort { until } ; 'fatigue' : fatigue de chacun en fin de tour { values }
//            (dans l'ordre de `initial`).
//
// Fatigue (v0.66) : elle évolue tour par tour (RoundFatigue) — effort de ceux qui sont debout,
// de plus en plus lourd à mesure que la manche dure ; coups donnés et surtout reçus ;
// récupération au sol, en soufflant et pendant les temps morts. La fatigue du moment règle les
// dégâts (malus au-delà de 50).
//
// Casques fermés (v0.65) : chaque combattant a une direction (`facing`) : au départ vers
// l'adversaire, puis vers sa cible (sinon vers où il marche). Il ne voit que devant lui
// (COMBAT_RULES.vision) ; un coup venu de son angle mort est majoré (CombatSituation).

// Bonus de position : définis dans CombatSituation.js (exportés ici pour compatibilité).
export { getStartingBonuses, isNearBarrier, isPinned, strikeSituation, withSituation } from './CombatSituation.js';

/** Direction de départ : vers le centre des adversaires. */
function initialFacing(unit, units) {
  const enemies = units.filter((other) => other.side !== unit.side);
  if (!enemies.length) return { x: unit.side === 'A' ? 1 : -1, y: 0 };
  const cx = enemies.reduce((s, e) => s + e.x, 0) / enemies.length;
  const cy = enemies.reduce((s, e) => s + e.y, 0) / enemies.length;
  return directionTo(unit, { x: cx, y: cy }) ?? { x: unit.side === 'A' ? 1 : -1, y: 0 };
}

const snapshot = (unit) => ({ ...unit, stats: { ...unit.stats } });

/**
 * Manche entre deux camps déjà placés. units : CombatUnit[] (camps 'A' et 'B').
 * onKnockout(attackerId, targetId, tick) : appelé dès qu'un coup met une cible KO (auteur du
 * coup fatal) — le moteur constate le KO, l'appelant en tient les statistiques.
 * aiConfigBySide (facultatif) : { A, B } — réglages d'IA propres à chaque camp (banc d'essai des
 * stratégies, systems/ai/) ; sinon `aiConfig` pour tous.
 */
export function simulateRound({ arena, units, rng = Math.random, rules = COMBAT_RULES, aiConfig = FIGHTER_AI_CONFIG, aiConfigBySide = null, onKnockout = null }) {
  const configOf = (unit) => aiConfigBySide?.[unit.side] ?? aiConfig;
  // Talents : effets d'équipe calculés une fois au début de la manche (combat/engine/TalentCombat.js).
  const fighters = prepareTalentUnits(units.map((unit) => ({
    ...unit, targetId: null, aiState: 'IDLE', lastStand: unit.lastStand ? { ...unit.lastStand } : null,
    facing: unit.facing ?? initialFacing(unit, units), perceived: new Map(), stunnedUntil: -1, lastMoveTick: -Infinity,
  })));
  const byId = new Map(fighters.map((unit) => [unit.id, unit]));
  const tieBreak = new Map(fighters.map((unit) => [unit.id, rng()]));
  const events = [];
  const initial = fighters.map(snapshot);
  const stats = new Map(fighters.map((unit) => [unit.id, { dealt: 0, taken: 0, attacks: 0, knockouts: 0 }]));
  const startBonuses = getStartingBonuses(fighters, arena, rules);

  const hooks = {
    target(unitId, targetId, tick) {
      byId.get(unitId).targetId = targetId;
      if (targetId) events.push({ tick, type: 'target', unitId, targetId });
    },
    state(unitId, state, reason, tick) {
      byId.get(unitId).aiState = state;
      events.push({ tick, type: 'ai', unitId, state, reason });
    },
  };
  const controllers = new Map(fighters.map((unit, index) => [unit.id, new FighterAIController(unit, { index, config: configOf(unit), hooks, rules })]));
  const combat = new CombatController({ fighters, byId, arena, rules, rng, events, stats, controllers, onKnockout });

  const sideAlive = (side) => fighters.some((unit) => unit.side === side && isActive(unit));
  const order = () => fighters
    .filter(isActive)
    .sort((a, b) => b.endurance - a.endurance || tieBreak.get(b.id) - tieBreak.get(a.id));

  // Un camp vide (tous KO avant la manche) perd aussitôt.
  let tick = 0;
  let forfeit = null;
  if (!sideAlive('A') || !sideAlive('B')) forfeit = !sideAlive('A') ? 'A' : 'B';

  const occupied = new Set();
  const movement = new MovementController({
    occupied,
    rules,
    onMove: (unit, from, to) => {
      unit.state = 'moving';
      unit.lastMoveTick = tick;
      unit.facing = directionTo(from, to) ?? unit.facing;
      events.push({ tick, type: 'move', unitId: unit.id, from, to });
    },
  });

  // Temps mort (v0.66) : { until, count, lastEnd } — tant qu'il dure, personne ne frappe, chacun souffle.
  const lull = { until: -1, count: 0, lastEnd: -Infinity };
  const lullActive = () => tick <= lull.until;
  const fatigueRow = () => fighters.map((unit) => Math.round(unit.fatigue * 10) / 10);

  while (!forfeit && sideAlive('A') && sideAlive('B') && tick < rules.maxTicks) {
    tick += 1;
    const acting = order();
    occupied.clear();
    for (const unit of fighters) if (isActive(unit)) occupied.add(tileKey(unit.x, unit.y));
    const makeContext = (unit) => createAIContext({ unit, fighters, arena, occupied, tick, rng, rules, config: configOf(unit) });
    const env = { byId, makeContext, occupied, tick };

    // Fin d'un temps mort : chacun reprend l'affrontement (nouvelle décision).
    if (lull.until === tick - 1) {
      lull.lastEnd = tick - 1;
      for (const controller of controllers.values()) controller.request('lull-end');
    }
    // Début d'un temps mort : chacun recule d'un pas et souffle.
    if (!lullActive() && shouldStartLull(fighters, tick, lull, rules, rng)) {
      const { min, max } = rules.lull.durationTicks;
      lull.until = tick + min + Math.floor(rng() * (max - min + 1)) - 1;
      lull.count += 1;
      events.push({ tick, type: 'lull', until: lull.until });
      for (const unit of acting) stepBackFromEnemies(unit, fighters, arena, occupied, movement);
    }

    if (!lullActive()) {
      // Décisions et déplacements (un combattant renversé ne fait rien ce tour-ci).
      for (const unit of acting) {
        if (isStunned(unit, tick)) continue;
        const controller = controllers.get(unit.id);
        controller.think(unit, env);
        movement.advance(unit, controller, env);
      }
      // Chacun regarde sa cible (sinon reste tourné vers où il a marché).
      for (const unit of acting) {
        const target = unit.targetId ? byId.get(unit.targetId) : null;
        if (target && isActive(target) && !isStunned(unit, tick)) unit.facing = directionTo(unit, target) ?? unit.facing;
      }

      // Attaques, dans l'ordre d'endurance.
      combat.attackPhase(acting, tick, makeContext);
    }

    // Fatigue du tour : effort de ceux qui sont debout, récupération au sol et pour ceux qui soufflent.
    applyTickFatigue(fighters, tick, { rules, isResting: (unit) => lullActive() || controllers.get(unit.id).isBreathing });
    events.push({ tick, type: 'fatigue', values: fatigueRow() });
  }

  let winnerSide;
  let reason;
  if (forfeit) {
    winnerSide = forfeit === 'A' ? 'B' : 'A';
    reason = 'forfeit';
  } else if (!sideAlive('A') || !sideAlive('B')) {
    winnerSide = sideAlive('A') ? 'A' : 'B';
    reason = 'knockout';
  } else {
    // Sécurité (ne devrait pas arriver) : le camp qui garde le plus de PV, puis de combattants.
    const hpOf = (side) => fighters.filter((u) => u.side === side && isActive(u)).reduce((s, u) => s + u.hp, 0);
    const aliveOf = (side) => fighters.filter((u) => u.side === side && isActive(u)).length;
    winnerSide = hpOf('A') !== hpOf('B') ? (hpOf('A') > hpOf('B') ? 'A' : 'B') : (aliveOf('A') >= aliveOf('B') ? 'A' : 'B');
    reason = 'timeout';
  }
  for (const unit of fighters) if (isActive(unit) && unit.side === winnerSide) unit.state = 'victory';
  events.push({ tick, type: 'end', winnerSide, reason });

  return {
    winnerSide,
    reason,
    ticks: tick,
    initial,
    startBonuses,
    final: fighters.map(snapshot),
    knockedOut: fighters.filter((unit) => unit.status === 'ko').map((unit) => unit.id),
    // Talents de survie utilisés pendant la manche (Inébranlable : une fois par combat).
    lastStands: fighters.filter((unit) => unit.lastStand?.used).map((unit) => ({ unitId: unit.id, per: unit.lastStand.per })),
    stats: Object.fromEntries(stats),
    // IA : décisions prises et reculs, par combattant (suivi et réglages).
    aiStats: Object.fromEntries([...controllers].map(([id, c]) => [id, { decisions: c.decisions, retreats: c.retreatsUsed }])),
    // Temps morts de la manche (nombre).
    lulls: lull.count,
    events,
  };
}

/**
 * Faut-il lancer un temps mort ce tour-ci ? Au plus `maxPerSide` debout de chaque côté, à
 * égalité, fatigue moyenne des combattants debout ≥ minAverageFatigue, personne au bord du KO,
 * pas plus de `maxPerRound` par manche ni moins de `minGapTicks` tours après le précédent ; puis
 * une chance par tour (tirage seulement si tout le reste est réuni).
 */
function shouldStartLull(fighters, tick, lull, rules, rng) {
  const l = rules.lull;
  if (!l || lull.count >= l.maxPerRound || tick - lull.lastEnd < l.minGapTicks) return false;
  const standing = fighters.filter(isActive);
  const countA = standing.filter((u) => u.side === 'A').length;
  const countB = standing.length - countA;
  if (countA !== countB || countA === 0 || countA > l.maxPerSide) return false;
  const averageFatigue = standing.reduce((s, u) => s + u.fatigue, 0) / standing.length;
  if (averageFatigue < l.minAverageFatigue) return false;
  if (standing.some((u) => u.hp <= u.maxHp * l.safeHpRatio)) return false;
  return rng() < l.chancePerTick;
}

/** Temps mort : un pas de recul, vers la case libre voisine la plus loin des adversaires (s'il y en a une). */
function stepBackFromEnemies(unit, fighters, arena, occupied, movement) {
  const enemies = fighters.filter((other) => other.side !== unit.side && isActive(other));
  if (!enemies.length) return;
  const safety = (tile) => Math.min(...enemies.map((e) => Math.max(Math.abs(e.x - tile.x), Math.abs(e.y - tile.y))));
  let best = null;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const tile = { x: unit.x + dx, y: unit.y + dy };
      if ((!dx && !dy) || !arena.isInside(tile.x, tile.y) || occupied.has(tileKey(tile.x, tile.y))) continue;
      const value = safety(tile);
      if (value > safety(unit) && (!best || value > best.value)) best = { tile, value };
    }
  }
  if (!best) return;
  const from = { x: unit.x, y: unit.y };
  occupied.delete(tileKey(from.x, from.y));
  unit.x = best.tile.x;
  unit.y = best.tile.y;
  occupied.add(tileKey(unit.x, unit.y));
  movement.onMove(unit, from, { ...best.tile });
  // Il garde l'adversaire en face de lui en reculant.
  unit.facing = directionTo(unit, enemies.reduce((a, b) => (safety(a) <= safety(b) ? a : b))) ?? unit.facing;
}
