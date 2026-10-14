import { FIGHTER_AI_CONFIG } from '../../../data/combatRules.js';
import { isInReach, reachOf } from '../CombatMovementManager.js';
import { chebyshev, tileKey } from './PathfindingService.js';
import { AI_ACTIONS, AI_STATES, chooseApproach, decide } from './DecisionService.js';

// IA individuelle d'un combattant pendant une manche (un contrôleur par combattant).
//
// Elle décide par CYCLES (FIGHTER_AI_CONFIG.decisionInterval, décalés d'un combattant à
// l'autre), et aussitôt qu'un événement l'exige : cible KO ou hors de portée, arrivée au
// contact, coup dur, chemin bloqué, fin de recul. Entre deux décisions, elle suit son plan
// (un chemin case par case), recalculé de temps en temps pendant une approche.
//
// Chemin bloqué : nouveau calcul de chemin, sinon pas de côté, et après plusieurs échecs la
// cible est écartée quelques tours le temps de réévaluer : jamais d'attente indéfinie.

export class FighterAIController {
  /**
   * hooks : { state(unitId, state, reason, tick), target(unitId, targetId, tick) } — le
   * gestionnaire de manche en tire ses événements et tient `unit.targetId` à jour.
   */
  constructor(unit, { index = 0, config = FIGHTER_AI_CONFIG, hooks = {}, rules } = {}) {
    this.unitId = unit.id;
    this.config = config;
    this.rules = rules;
    this.hooks = hooks;
    this.index = index;
    this.state = AI_STATES.IDLE;
    this.action = AI_ACTIONS.IDLE;
    this.targetId = null;
    this.path = [];
    this.pendingReason = 'start';
    this.nextDecisionTick = 0;
    this.repathAt = 0;
    this.lastDecisionHp = unit.hp;
    this.failedAttempts = 0;
    this.ignored = new Map();
    this.retreatsUsed = 0;
    this.retreatUntil = 0;
    this.retreatCooldownUntil = 0;
    // Souffle (il se ménage) : fin prévue, repos avant le suivant, PV au début (frappé : il réplique).
    this.breathUntil = 0;
    this.breathCooldownUntil = 0;
    this.breathStartHp = unit.hp;
    this.lastTile = null;
    this.decisions = 0;
  }

  get isRetreating() {
    return this.action === AI_ACTIONS.RETREAT;
  }

  get isBreathing() {
    return this.action === AI_ACTIONS.BREATHE;
  }

  /** Demande une nouvelle décision au prochain passage (événement important). */
  request(reason) {
    if (!this.pendingReason) this.pendingReason = reason;
  }

  setState(state, reason, tick) {
    if (this.state === state) return;
    this.state = state;
    this.hooks.state?.(this.unitId, state, reason, tick);
  }

  setTarget(targetId, tick) {
    if (this.targetId === targetId) return;
    this.targetId = targetId;
    this.hooks.target?.(this.unitId, targetId, tick);
  }

  /** Le combattant est KO : son IA s'arrête. */
  knockOut(tick) {
    this.path = [];
    this.action = AI_ACTIONS.IDLE;
    this.setTarget(null, tick);
    this.setState(AI_STATES.KO, 'ko', tick);
  }

  /** Sa cible vient de tomber (ou d'être écartée) : il en cherche une autre. */
  loseTarget(reason, tick) {
    this.path = [];
    this.setTarget(null, tick);
    this.setState(AI_STATES.SEEK_TARGET, reason, tick);
    this.request(reason);
  }

  /** Raison de décider maintenant, ou null pour suivre le plan en cours. */
  #decisionReason(unit, target, tick) {
    if (this.pendingReason) return this.pendingReason;
    if (this.targetId && !target) return 'target-ko';
    if (this.isRetreating) return !this.path.length || tick >= this.retreatUntil ? 'retreat-end' : null;
    // Il souffle : frappé, il réplique aussitôt ; sinon, au plus `breathe.maxTicks` tours.
    if (this.isBreathing) {
      if (unit.hp < this.breathStartHp) return 'struck';
      return tick >= this.breathUntil ? 'breath-end' : null;
    }
    if (this.lastDecisionHp - unit.hp >= this.config.damageTrigger * unit.maxHp) return 'damaged';
    if (this.action === AI_ACTIONS.MOVE && target && isInReach(unit, target, this.rules)) return 'arrived';
    if (this.action === AI_ACTIONS.ATTACK && target && !isInReach(unit, target, this.rules)) return 'target-left';
    if ((this.action === AI_ACTIONS.MOVE || this.action === AI_ACTIONS.REPOSITION) && !this.path.length) return 'arrived';
    if (tick >= this.nextDecisionTick) return 'cycle';
    return null;
  }

  /**
   * Phase de décision d'un tour. env : { byId, makeContext(unit), tick }.
   */
  think(unit, { byId, makeContext, tick }) {
    if (unit.status !== 'active') {
      if (this.state !== AI_STATES.KO) this.knockOut(tick);
      return;
    }
    const target = this.targetId ? byId.get(this.targetId) : null;
    const liveTarget = target && target.status === 'active' ? target : null;
    const reason = this.#decisionReason(unit, liveTarget, tick);
    if (reason) {
      this.decideNow(unit, makeContext(unit), reason, tick);
      return;
    }
    // Approche en cours : chemin recalculé de temps en temps, ou tout de suite si la cible
    // s'est éloignée de la case visée.
    if (this.action === AI_ACTIONS.MOVE && liveTarget) {
      const destination = this.path.at(-1);
      const stale = !destination || chebyshev(destination, liveTarget) > reachOf(unit, this.rules);
      if (stale || tick >= this.repathAt) {
        const approach = chooseApproach(liveTarget, makeContext(unit));
        if (approach?.path.length) this.path = approach.path;
        else this.decideNow(unit, makeContext(unit), 'path-lost', tick);
        this.repathAt = tick + this.config.pathRecalculationInterval;
      }
    }
  }

  /** Décision complète, appliquée aussitôt. */
  decideNow(unit, ctx, reason, tick) {
    const wasRetreating = this.isRetreating;
    const wasBreathing = this.isBreathing;
    // Fin d'un souffle (durée écoulée, frappé, événement) : quelques tours avant le suivant.
    if (wasBreathing && this.config.breathe) this.breathCooldownUntil = Math.max(this.breathCooldownUntil, tick + (reason === 'cycle' ? 0 : this.config.breathe.cooldownTicks));
    const d = decide(ctx, this);
    this.decisions += 1;
    this.pendingReason = null;
    this.lastDecisionHp = unit.hp;
    this.nextDecisionTick = tick + this.config.decisionInterval + (this.decisions === 1 ? this.index % this.config.decisionInterval : 0);
    this.repathAt = tick + this.config.pathRecalculationInterval;
    if (wasRetreating && d.action !== AI_ACTIONS.RETREAT) this.retreatCooldownUntil = tick + this.config.retreat.cooldownTicks;
    if (d.action === AI_ACTIONS.RETREAT && !wasRetreating) {
      this.retreatsUsed += 1;
      this.retreatUntil = tick + this.config.retreat.durationTicks;
    }
    if (d.action === AI_ACTIONS.BREATHE && !wasBreathing) {
      this.breathUntil = tick + this.config.breathe.maxTicks;
      this.breathStartHp = unit.hp;
    }
    if (wasBreathing && d.action !== AI_ACTIONS.BREATHE && this.config.breathe) this.breathCooldownUntil = Math.max(this.breathCooldownUntil, tick + this.config.breathe.cooldownTicks);
    // Les échecs ne s'effacent qu'au contact, ou sur une décision qui n'est pas due à un blocage.
    if (d.action === AI_ACTIONS.ATTACK || (d.action === AI_ACTIONS.MOVE && reason !== 'path-blocked')) this.failedAttempts = 0;
    this.action = d.action;
    this.path = d.path.slice();
    this.setTarget(d.targetId, tick);
    this.setState(d.state, d.reason ?? reason, tick);
    if (d.reason === 'blocked') {
      // Aucun chemin, aucun détour : on attend un tour, puis on réessaie ; après plusieurs
      // échecs, la cible est écartée quelques tours.
      this.failedAttempts += 1;
      this.nextDecisionTick = tick + 1;
      if (this.failedAttempts >= this.config.maxPathAttempts) this.#abandonTarget(tick);
    }
    return d;
  }

  #abandonTarget(tick) {
    if (this.targetId) this.ignored.set(this.targetId, tick + this.config.abandonTargetTicks);
    this.failedAttempts = 0;
    this.loseTarget('abandon', tick);
  }

  /**
   * Prochaine case du plan, ou null. env : { occupied, byId, makeContext, tick }. Si la case
   * suivante est prise : nouveau calcul, sinon pas de côté, sinon (après plusieurs essais)
   * abandon de la cible.
   */
  nextStep(unit, env) {
    if (!this.path.length) return null;
    const { occupied, makeContext, tick } = env;
    const isTaken = (tile) => occupied.has(tileKey(tile.x, tile.y));
    if (!isTaken(this.path[0])) return this.path[0];
    this.failedAttempts += 1;
    if (this.failedAttempts > this.config.maxPathAttempts && !this.isRetreating) {
      this.#abandonTarget(tick);
      return null;
    }
    this.decideNow(unit, makeContext(unit), 'path-blocked', tick);
    if (!this.path.length) return null;
    if (!isTaken(this.path[0])) return this.path[0];
    return this.#sidestep(unit, env);
  }

  /** Pas de côté : case voisine libre qui ne l'éloigne pas de son but (jamais celle qu'il vient de quitter). */
  #sidestep(unit, { occupied, makeContext, tick, byId }) {
    const goal = this.path.at(-1) ?? (this.targetId ? byId.get(this.targetId) : null);
    if (!goal) return null;
    const ctx = makeContext(unit);
    const here = chebyshev(unit, goal);
    const options = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const tile = { x: unit.x + dx, y: unit.y + dy };
        if ((!dx && !dy) || !ctx.grid.isInside(tile.x, tile.y) || occupied.has(tileKey(tile.x, tile.y))) continue;
        if (this.lastTile && tile.x === this.lastTile.x && tile.y === this.lastTile.y) continue;
        const d = chebyshev(tile, goal);
        if (d <= here) options.push({ tile, d, r: ctx.rng() });
      }
    }
    if (!options.length) return null;
    options.sort((a, b) => a.d - b.d || a.r - b.r);
    this.action = this.isRetreating ? this.action : AI_ACTIONS.REPOSITION;
    this.path = [options[0].tile];
    if (!this.isRetreating) this.setState(AI_STATES.REPOSITION, 'sidestep', tick);
    return options[0].tile;
  }

  /** Le pas a été fait. */
  stepDone(from) {
    this.lastTile = { ...from };
    this.path.shift();
  }
}
