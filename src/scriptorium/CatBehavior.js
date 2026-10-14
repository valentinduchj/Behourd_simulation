import { createRng } from '../utils/random.js';

// Le Sacré de Birmanie de Flavia et la souris des rayonnages — présentation seulement, aucune
// règle de jeu (ni talents, ni deniers, ni statistiques).
//
// Le chat enchaîne des comportements (se promener, regarder autour de lui, s'asseoir, se
// coucher sur son coussin, boire, manger). La souris sort d'un interstice entre deux livres en
// moyenne toutes les 20 s (intervalle variable) ; le chat la remarque, la poursuit, puis guette
// le trou où elle s'est réfugiée avant de reprendre ses habitudes. Une seule poursuite à la fois.
//
// L'état avance avec le temps des images affichées (update(dt)) : quand le joueur quitte le
// Scriptorium, l'animation s'arrête et aucun événement ne s'accumule.

const WALK_SPEED = 0.55;
const CHASE_SPEED = 2.0;
const NOTICE_DELAY = 0.45;
const PEEK = 0.7;

const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

/** Point suivant d'un trajet parcouru à `speed` pendant `t` secondes (ou null s'il est fini). */
function alongPath(path, speed, t) {
  let left = speed * t;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = dist(path[i], path[i + 1]);
    if (left <= seg) {
      const k = seg ? left / seg : 1;
      return { x: path[i].x + (path[i + 1].x - path[i].x) * k, y: path[i].y + (path[i + 1].y - path[i].y) * k, dir: { x: path[i + 1].x - path[i].x, y: path[i + 1].y - path[i].y } };
    }
    left -= seg;
  }
  return null;
}

export class CatAmbience {
  /** cat, mouse : data/scriptoriumLayout.js › cat, mouse. */
  constructor(cat, mouse, { seed = 'chat-flavia' } = {}) {
    this.config = cat;
    this.mouseConfig = mouse;
    this.rng = createRng(seed);
    this.elapsed = 0;
    this.cat = { x: cat.start.x, y: cat.start.y, state: 'lie', facing: -1, until: 4 + this.rng() * 4, target: null, then: null };
    this.mouse = null; // { t, pos, dir, gone }
    this.nextMouseAt = this.#mouseDelay();
    this.chases = 0;
  }

  #mouseDelay() {
    const { mean, spread } = this.mouseConfig.interval;
    return mean + (this.rng() * 2 - 1) * spread;
  }

  #setState(state, duration) {
    this.cat.state = state;
    this.cat.until = this.elapsed + duration;
  }

  #walkTo(target, then) {
    this.cat.state = 'walk';
    this.cat.target = { ...target };
    this.cat.then = then;
  }

  /** Comportement suivant, tiré au sort (poids : promenade, regard, assis, coussin, eau, croquettes). */
  #nextHabit() {
    const { spots, water, kibble, cushion } = this.config;
    const roll = this.rng() * 100;
    if (roll < 34) this.#walkTo(spots[Math.floor(this.rng() * spots.length)], { state: 'look', duration: 1.5 + this.rng() * 2 });
    else if (roll < 52) this.#setState('look', 2 + this.rng() * 2.5);
    else if (roll < 66) this.#setState('sit', 3 + this.rng() * 3);
    else if (roll < 78) this.#walkTo(cushion, { state: 'lie', duration: 6 + this.rng() * 6 });
    else if (roll < 89) this.#walkTo(water, { state: 'drink', duration: 3 + this.rng() * 2 });
    else this.#walkTo(kibble, { state: 'eat', duration: 3 + this.rng() * 2 });
  }

  #clamp(p) {
    const b = this.config.bounds;
    return { x: Math.max(b.x, Math.min(b.x + b.w, p.x)), y: Math.max(b.y, Math.min(b.y + b.h, p.y)) };
  }

  #moveToward(goal, speed, dt) {
    const cat = this.cat;
    // Il ne quitte jamais le cabinet : au bord, il s'arrête (ex. devant le trou de la souris).
    const target = this.#clamp(goal);
    const d = dist(cat, target);
    if (d < 0.02) return true;
    const step = Math.min(d, speed * dt);
    const dx = (target.x - cat.x) / d;
    const dy = (target.y - cat.y) / d;
    Object.assign(cat, this.#clamp({ x: cat.x + dx * step, y: cat.y + dy * step }));
    if (Math.abs(dx - dy) > 0.05) cat.facing = dx - dy >= 0 ? 1 : -1;
    return step >= d - 1e-6;
  }

  /** Avance de `dt` secondes (temps des images affichées). */
  update(dt) {
    const step = Math.max(0, Math.min(dt, 0.25));
    this.elapsed += step;
    this.#updateMouse(step);
    const cat = this.cat;

    // La souris est sortie : le chat la remarque, puis la poursuit.
    if (this.mouse && !this.mouse.gone && this.mouse.t >= NOTICE_DELAY && cat.state !== 'alert' && cat.state !== 'chase') {
      this.#setState('alert', 0.35);
      cat.facing = this.mouse.pos.x - cat.x - (this.mouse.pos.y - cat.y) >= 0 ? 1 : -1;
    }
    switch (cat.state) {
      case 'alert':
        if (this.elapsed >= cat.until) cat.state = 'chase';
        break;
      case 'chase': {
        const prey = this.mouse && !this.mouse.gone ? this.mouse.pos : this.mouseConfig.path[this.mouseConfig.path.length - 1];
        const arrived = this.#moveToward(prey, CHASE_SPEED, step);
        // La souris s'est réfugiée : le chat guette le trou, puis reprend ses habitudes.
        if ((!this.mouse || this.mouse.gone) && arrived) this.#setState('watch', 2.5);
        break;
      }
      case 'walk':
        if (this.#moveToward(cat.target, WALK_SPEED, step)) {
          const then = cat.then ?? { state: 'look', duration: 2 };
          cat.then = null;
          this.#setState(then.state, then.duration);
        }
        break;
      // Flavia vient le caresser : il l'attend assis, puis ronronne sous sa main ; elle le libère.
      case 'await':
      case 'petted':
        if (this.elapsed >= cat.until) this.#nextHabit();
        break;
      default:
        if (this.elapsed >= cat.until) this.#nextHabit();
    }
  }

  #updateMouse(dt) {
    if (!this.mouse) {
      if (this.elapsed < this.nextMouseAt) return;
      this.mouse = { t: 0, pos: { ...this.mouseConfig.path[0] }, dir: { x: 1, y: 1 }, gone: false };
      this.chases += 1;
      return;
    }
    const mouse = this.mouse;
    mouse.t += dt;
    if (mouse.gone) {
      // Fin de la séquence quand le chat a fini de guetter : prochaine souris plus tard.
      if (this.cat.state !== 'chase' && this.cat.state !== 'alert') {
        this.mouse = null;
        this.nextMouseAt = this.elapsed + this.#mouseDelay();
      }
      return;
    }
    // Elle hésite un instant entre les livres, puis file jusqu'au trou du mur.
    const run = Math.max(0, mouse.t - PEEK);
    const at = alongPath(this.mouseConfig.path, this.mouseConfig.speed, run);
    if (!at) {
      mouse.gone = true;
      return;
    }
    mouse.pos = { x: at.x, y: at.y };
    mouse.dir = at.dir;
  }

  /**
   * Flavia veut le caresser : s'il est tranquille (ni souris, ni poursuite), il s'arrête et
   * l'attend assis (au plus `patience` secondes). Renvoie sa position, ou null s'il est occupé.
   */
  requestPet(patience = 14) {
    const busy = this.mouse || ['alert', 'chase', 'watch'].includes(this.cat.state);
    if (busy) return null;
    this.cat.target = null;
    this.cat.then = null;
    this.#setState('await', patience);
    return { x: this.cat.x, y: this.cat.y };
  }

  /** Flavia est arrivée : il se laisse caresser `duration` secondes, tourné vers elle. */
  startPet(from, duration) {
    if (this.cat.state !== 'await') return false;
    this.cat.facing = from.x - this.cat.x - (from.y - this.cat.y) >= 0 ? 1 : -1;
    this.#setState('petted', duration);
    return true;
  }

  /** Fin des caresses (ou Flavia renonce) : il reprend ses habitudes. */
  endPet() {
    if (this.cat.state === 'await' || this.cat.state === 'petted') this.#setState('look', 1.5 + this.rng() * 1.5);
  }

  /** Le chat est-il caressé en ce moment ? */
  get petted() {
    return this.cat.state === 'petted';
  }

  /** Image du chat : { x, y, state, facing }. */
  catFrame() {
    return { x: this.cat.x, y: this.cat.y, state: this.cat.state, facing: this.cat.facing };
  }

  /** Image de la souris : { x, y, facing, peeking } ou null. */
  mouseFrame() {
    if (!this.mouse || this.mouse.gone) return null;
    const { pos, dir, t } = this.mouse;
    return { x: pos.x, y: pos.y, facing: dir.x - dir.y >= 0 ? 1 : -1, peeking: t < PEEK };
  }

  /** Une poursuite est-elle en cours ? */
  get chasing() {
    return Boolean(this.mouse);
  }
}

/**
 * Dessine le Sacré de Birmanie, les pattes en (x, y) : pelage crème, extrémités brun foncé
 * (masque, oreilles, queue, pattes), gants blancs, yeux bleus. `size` : longueur du corps (px).
 */
export function drawCat(ctx, x, y, { state, facing = 1, time = 0, size }) {
  const s = size;
  const cream = '#f1e6d2';
  const point = '#5b4032';
  const outline = 'rgba(50, 35, 25, 0.75)';
  const moving = state === 'walk' || state === 'chase';
  const speed = state === 'chase' ? 16 : 8;
  const swing = moving ? Math.sin(time * speed) : 0;
  const lie = state === 'lie' ? 1 : 0;
  const sit = ['sit', 'watch', 'await', 'petted'].includes(state) ? 1 : 0;
  // Caressé : il ferme à demi les yeux, la tête se tend vers la main (ronronnement).
  const purr = state === 'petted' ? Math.sin(time * 6) : 0;
  const crouch = state === 'alert' ? 1 : state === 'chase' ? 0.5 : 0;
  const headDown = state === 'drink' || state === 'eat' ? 1 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.42, s * 0.11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.scale(facing, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const bodyY = -s * (0.3 - 0.17 * lie - 0.08 * crouch) - (moving ? Math.abs(swing) * s * 0.02 : 0);

  // Pattes (brunes, bout blanc) ; repliées couché ou assis à l'arrière.
  if (!lie) {
    for (const [lx, side] of [[-0.2, -1], [0.18, -1], [-0.24, 1], [0.2, 1]]) {
      const back = lx < 0;
      if (sit && back) {
        // Assis : les pattes arrière restent visibles, repliées sous lui (cuisse et patte au sol).
        ctx.globalAlpha = side < 0 ? 0.85 : 1;
        ctx.fillStyle = point;
        ctx.strokeStyle = outline;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(s * (lx + 0.08), -s * 0.1, s * 0.1, s * 0.08, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(s * (lx + 0.17), -s * 0.025, s * 0.05, s * 0.028, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }
      const reach = moving ? swing * side * (back ? -1 : 1) * s * (state === 'chase' ? 0.14 : 0.07) : 0;
      ctx.globalAlpha = side < 0 ? 0.8 : 1;
      ctx.strokeStyle = point;
      ctx.lineWidth = Math.max(2, s * 0.07);
      ctx.beginPath();
      ctx.moveTo(s * lx, bodyY + s * 0.06);
      ctx.lineTo(s * lx + reach, -s * 0.03);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s * lx + reach, -s * 0.02, s * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Queue : touffue, brune ; elle fouette quand il guette la souris.
  const lash = state === 'alert' || state === 'watch' ? Math.sin(time * 14) * 0.6 : Math.sin(time * 1.6) * 0.25;
  ctx.strokeStyle = point;
  ctx.lineWidth = Math.max(2.5, s * 0.09);
  ctx.beginPath();
  if (lie) {
    ctx.moveTo(-s * 0.28, bodyY + s * 0.04);
    ctx.quadraticCurveTo(-s * 0.3, s * 0.02, s * 0.1, -s * 0.01);
  } else {
    ctx.moveTo(-s * 0.3, bodyY);
    ctx.quadraticCurveTo(-s * 0.5, bodyY - s * 0.1, -s * 0.52 + lash * s * 0.1, bodyY - s * (sit ? 0.05 : 0.3) + (sit ? s * 0.25 : 0));
  }
  ctx.stroke();

  // Corps crème (plus haut et ramassé assis).
  ctx.fillStyle = cream;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (sit) ctx.ellipse(-s * 0.04, bodyY - s * 0.04, s * 0.2, s * 0.2, -0.5, 0, Math.PI * 2);
  else ctx.ellipse(0, bodyY, s * 0.32, s * (lie ? 0.12 : 0.14), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Tête : masque brun, oreilles brunes, yeux bleus ; baissée pour boire ou manger.
  const look = state === 'look' ? Math.sin(time * 1.3) : 0;
  const headX = s * (sit ? 0.14 : 0.34) + look * s * 0.03 + purr * s * 0.012;
  const headY = bodyY - s * (sit ? 0.26 : 0.1) + s * 0.2 * headDown + s * 0.05 * lie + s * 0.05 * crouch + (state === 'petted' ? s * 0.03 : 0);
  if (lie) {
    // Couché : les pattes avant dépassent, gantées de blanc.
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = outline;
    for (const dx of [0.22, 0.3]) {
      ctx.beginPath();
      ctx.ellipse(s * dx, -s * 0.04, s * 0.06, s * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.fillStyle = cream;
  ctx.beginPath();
  ctx.arc(headX, headY, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = point;
  for (const ex of [-0.06, 0.06]) {
    ctx.beginPath();
    ctx.moveTo(headX + s * (ex - 0.04), headY - s * 0.08);
    ctx.lineTo(headX + s * ex, headY - s * 0.2);
    ctx.lineTo(headX + s * (ex + 0.04), headY - s * 0.08);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(headX + s * 0.04, headY + s * 0.03, s * 0.07, s * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  if ((lie && state === 'lie') || state === 'petted') {
    // Endormi, ou ronronnant sous la main de Flavia : yeux fermés.
    ctx.strokeStyle = '#2a1a10';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(headX - s * 0.02, headY - s * 0.01);
    ctx.lineTo(headX + s * 0.03, headY - s * 0.01);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#5ea8e8';
    ctx.beginPath();
    ctx.arc(headX + s * 0.06, headY - s * 0.015, s * 0.026, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headX - s * 0.01, headY - s * 0.015, s * 0.022, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Dessine la souris (petite, grise, longue queue), les pattes en (x, y). */
export function drawMouse(ctx, x, y, { facing = 1, peeking = false, time = 0, size }) {
  const s = size;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.5, s * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = peeking ? 0 : Math.abs(Math.sin(time * 30)) * s * 0.05;
  ctx.strokeStyle = '#b08a8a';
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(-s * 0.35, -s * 0.15 - bob);
  ctx.quadraticCurveTo(-s * 0.7, -s * 0.05, -s * 0.85, -s * 0.3 + Math.sin(time * 12) * s * 0.08);
  ctx.stroke();
  ctx.fillStyle = '#8f8a86';
  ctx.strokeStyle = 'rgba(40, 30, 25, 0.7)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.2 - bob, s * 0.38, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s * 0.32, -s * 0.24 - bob, s * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9a0a0';
  ctx.beginPath();
  ctx.arc(s * 0.27, -s * 0.38 - bob, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(s * 0.38, -s * 0.27 - bob, s * 0.025, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
