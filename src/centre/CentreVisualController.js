import { CENTRE_MOVEMENT } from '../data/centreVisuals.js';
import { FIGHTER_ANIMATIONS, resolveFighterAnimation } from './animation/fighterAnimations.js';
import { createRng, hashString } from '../utils/random.js';
import { isStudying } from '../systems/talents/StudyService.js';

// Mise en scène des combattants du Centre : Activité → contrôleur → animation.
//
// Le gameplay ne fait qu'affecter un combattant à une activité (fighter.activityId). Le
// contrôleur le constate à chaque image et fait vivre son « acteur » :
//   walking  il marche (par les allées) vers sa place
//   active   arrivé dans son lieu, il fait l'animation de l'activité
//   idle     dans la cour, au repos ; il change de place de temps en temps
// Aucune règle de jeu ici : le contrôleur ne modifie jamais la partie.

const ARRIVAL = 0.04;
// (Une étude au Scriptorium retire le combattant du camp : elle compte dans l'état observé.)
const snapshot = (session) => session.playerFighters.map((f) => `${f.id}:${f.activityId ?? ''}:${isStudying(session, f) ? 'study' : ''}`).join('|');

export class CentreVisualController {
  /**
   * scene : CentreScene ; ambience : CentreAmbience (gerbes de particules), facultative ;
   * toScreenX(x, y) : abscisse à l'écran d'un point (orientation des combattants).
   */
  constructor(scene, { ambience = null, movement = CENTRE_MOVEMENT, toScreenX = (x, y) => x - y } = {}) {
    this.scene = scene;
    this.ambience = ambience;
    this.movement = movement;
    this.toScreenX = toScreenX;
    this.actors = new Map();
    this.lastTime = null;
    this.signature = null;
  }

  /** Avance la scène jusqu'à `time` (secondes). */
  update(time) {
    const dt = this.lastTime === null ? 0 : Math.max(0, Math.min(0.1, time - this.lastTime));
    this.lastTime = time;
    // Une affectation a changé (Centre, fiche, liste…) : les places sont recalculées.
    const signature = snapshot(this.scene.session);
    if (signature !== this.signature) {
      if (this.signature !== null) this.scene.refresh();
      this.signature = signature;
    }

    const present = new Set();
    for (const fighter of this.scene.session.playerFighters) {
      const placement = this.scene.getPlacement(fighter.id);
      if (!placement) continue;
      present.add(fighter.id);
      let actor = this.actors.get(fighter.id);
      if (!actor) {
        // Première apparition : directement à sa place.
        actor = this.#createActor(fighter, placement, time);
        this.actors.set(fighter.id, actor);
      } else if (actor.placementKey !== placementKey(placement)) {
        this.#sendTo(actor, placement, time);
      }
      this.#move(actor, dt, time);
    }
    for (const id of [...this.actors.keys()]) if (!present.has(id)) this.actors.delete(id);
  }

  #createActor(fighter, placement, time) {
    const rng = createRng(`actor:${fighter.id}`);
    return {
      fighterId: fighter.id,
      x: placement.x,
      y: placement.y,
      activityId: placement.activityId,
      placement,
      placementKey: placementKey(placement),
      state: placement.activityId ? 'active' : 'idle',
      stateSince: -Infinity,
      path: [],
      facing: 1,
      phase: (hashString(fighter.id) % 1000) / 100,
      rng,
      wanderAt: time + this.#wanderDelay(rng),
      emitted: new Map(),
      frame: null,
    };
  }

  #wanderDelay(rng) {
    const { min, max } = this.movement.restWander;
    return min + rng() * (max - min);
  }

  /** Nouvelle place : il s'y rend à pied, par les allées si le trajet est long. */
  #sendTo(actor, placement, time) {
    actor.placement = placement;
    actor.placementKey = placementKey(placement);
    const visuals = this.scene.visuals;
    const leaving = actor.activityId;
    actor.activityId = placement.activityId;
    actor.path = leaving === placement.activityId
      ? [{ x: placement.x, y: placement.y }]
      : routeBetween(actor, placement, this.scene.layout, {
        exit: visuals[leaving]?.entrance ?? null,
        entry: visuals[placement.activityId]?.entrance ?? null,
      });
    actor.state = 'walking';
    actor.stateSince = time;
    actor.wanderAt = time + this.#wanderDelay(actor.rng);
  }

  #move(actor, dt, time) {
    if (actor.state === 'walking') {
      let budget = this.movement.walkSpeed * dt;
      while (budget > 0 && actor.path.length) {
        const target = actor.path[0];
        const dx = target.x - actor.x;
        const dy = target.y - actor.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1e-6) {
          const screenDx = this.toScreenX(target.x, target.y) - this.toScreenX(actor.x, actor.y);
          if (Math.abs(screenDx) > 1e-3) actor.facing = Math.sign(screenDx);
        }
        if (dist <= budget + ARRIVAL) {
          actor.x = target.x;
          actor.y = target.y;
          budget -= dist;
          actor.path.shift();
        } else {
          actor.x += (dx / dist) * budget;
          actor.y += (dy / dist) * budget;
          budget = 0;
        }
      }
      if (!actor.path.length) {
        actor.state = actor.activityId ? 'active' : 'idle';
        actor.stateSince = time;
      }
      return;
    }
    // Au repos dans la cour : un petit tour de temps en temps, puis retour à sa place.
    if (actor.state === 'idle' && time >= actor.wanderAt) {
      const { placement } = actor;
      const away = Math.hypot(actor.x - placement.x, actor.y - placement.y) > 0.05;
      const goal = away ? { x: placement.x, y: placement.y } : { x: placement.x + (actor.rng() - 0.5) * 0.7, y: placement.y + (actor.rng() - 0.5) * 0.7 };
      actor.path = [goal];
      actor.state = 'walking';
      actor.wanderAt = time + this.#wanderDelay(actor.rng);
    }
  }

  /**
   * Image d'un combattant à `time` : { fighter, x, y, state, animation, frame, facing,
   * target, between, targetProp }. Les gestes émettent leurs gerbes (mannequin frappé…).
   */
  frame(fighter, time) {
    const actor = this.actors.get(fighter.id);
    if (!actor) return null;
    const { scene } = this;
    const resolved = resolveFighterAnimation(fighter, actor.activityId, actor.state, { visuals: scene.visuals });
    const point = actor.placement.point ?? actor.placement;
    const context = this.#context(actor, point, resolved);
    // Partenaires de lutte : l'un attaque pendant que l'autre esquive (demi-cycle de décalage).
    const offsetPhase = actor.state === 'active' && point.partner !== undefined && actor.placement.slot % 2 ? 0.9 : 0;
    const t = (time + actor.phase) * resolved.tempo + offsetPhase;
    const frame = FIGHTER_ANIMATIONS[resolved.name](t, context);
    // Arrivée dans un lieu : le geste s'installe en douceur (pas de saut de position).
    const settle = Math.min(1, (time - actor.stateSince) / 0.6);
    frame.offset = { x: frame.offset.x * settle, y: frame.offset.y * settle };
    const result = {
      fighter, state: actor.state, animation: resolved.name, frame,
      x: actor.x + frame.offset.x, y: actor.y + frame.offset.y,
      facing: context.facing, target: context.target, targetProp: context.targetProp,
    };
    this.#emit(actor, result, time);
    actor.frame = result;
    return result;
  }

  /** Contexte d'une animation : direction de la cible, partenaire, course, amplitude. */
  #context(actor, point, resolved) {
    const { scene } = this;
    let target = null;
    let targetProp = null;
    let partner = false;
    if (actor.state === 'active') {
      if (typeof point.target === 'string') {
        targetProp = scene.getProp(point.target);
        if (targetProp) target = { x: targetProp.x + (targetProp.w ?? 1) / 2, y: targetProp.y + (targetProp.h ?? 1) / 2 };
      } else if (point.target) target = point.target;
      if (point.partner !== undefined) {
        const partnerId = scene.fighterInSlot(actor.activityId, point.partner);
        const partnerActor = partnerId ? this.actors.get(partnerId) : null;
        partner = Boolean(partnerActor && partnerActor.state === 'active');
        target = partner ? { x: partnerActor.x, y: partnerActor.y } : scene.slotPoint(actor.activityId, point.partner);
      }
      // Table du Banquet : il fait face au joueur, la table devant lui.
      if (targetProp?.type === 'table') target = { x: actor.x + 0.5, y: actor.y + 0.5 };
    }
    const run = point.to ? { x: point.to.x - point.x, y: point.to.y - point.y } : { x: 0, y: 0 };
    const aim = actor.state === 'active' ? target ?? point.to ?? null : null;
    let dir = { x: 0, y: 0 };
    let facing = actor.facing;
    if (aim) {
      const dx = aim.x - actor.x;
      const dy = aim.y - actor.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1e-6) dir = { x: dx / dist, y: dy / dist };
      const screenDx = this.toScreenX(aim.x, aim.y) - this.toScreenX(actor.x, actor.y);
      if (Math.abs(screenDx) > 1e-3) facing = Math.sign(screenDx);
    }
    if (actor.state === 'active') actor.facing = facing;
    return { facing, dir, run, reach: resolved.reach, partner, target, targetProp };
  }

  /** Gerbes des gestes : une par cycle et par événement (voir fighterAnimations.js). */
  #emit(actor, result, time) {
    for (const event of result.frame.events ?? []) {
      if (!event.particle) continue;
      if (actor.emitted.get(event.key) === event.cycle) continue;
      actor.emitted.set(event.key, event.cycle);
      if (!this.ambience) continue;
      const self = { x: result.x, y: result.y };
      const at = event.at === 'target' ? result.target ?? self
        : event.at === 'between' ? (result.target ? { x: (self.x + result.target.x) / 2, y: (self.y + result.target.y) / 2 } : self)
          : self;
      this.ambience.spawn(event.particle, at, time, { z: event.z ?? 0 });
    }
  }

  /** Acteur d'un combattant (état, position), ou null. */
  getActor(fighterId) {
    return this.actors.get(fighterId) ?? null;
  }
}

const placementKey = (p) => `${p.activityId ?? 'rest'}:${p.slot}:${p.x.toFixed(2)},${p.y.toFixed(2)}`;

/**
 * Trajet d'un point à un autre : en ligne droite s'ils sont proches, sinon par les grandes
 * allées (data/centreLayout.js : le premier chemin vertical et le premier horizontal).
 * exit / entry : entrée du lieu quitté / du lieu visé (data/centreVisuals.js `entrance`),
 * passages obligés (ex. contourner la table du Banquet).
 */
export function routeBetween(from, to, layout, { exit = null, entry = null } = {}) {
  const end = { x: to.x, y: to.y };
  const start = exit ?? from;
  const goal = entry ?? to;
  const route = [];
  if (exit) route.push({ x: exit.x, y: exit.y });
  const vertical = layout.paths.find((p) => p.h > p.w);
  const horizontal = layout.paths.find((p) => p.w >= p.h);
  if (vertical && horizontal && Math.hypot(goal.x - start.x, goal.y - start.y) >= 2.5) {
    const vx = vertical.x + vertical.w / 2;
    const hy = horizontal.y + horizontal.h / 2;
    const onPath = (p) => (Math.abs(p.x - vx) <= Math.abs(p.y - hy) ? { arm: 'v', x: vx, y: p.y } : { arm: 'h', x: p.x, y: hy });
    const a = onPath(start);
    const b = onPath(goal);
    route.push({ x: a.x, y: a.y });
    if (a.arm !== b.arm) route.push({ x: vx, y: hy });
    route.push({ x: b.x, y: b.y });
  }
  if (entry) route.push({ x: entry.x, y: entry.y });
  route.push(end);
  // Points inutiles (déjà sur place) retirés.
  return route.filter((p, i) => Math.hypot(p.x - (i ? route[i - 1].x : from.x), p.y - (i ? route[i - 1].y : from.y)) > 0.05 || i === route.length - 1);
}
