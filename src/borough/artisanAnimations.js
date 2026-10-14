import { FIGHTER_ANIMATIONS } from '../centre/animation/fighterAnimations.js';

// Gestes des artisans du Bourg — présentation seulement. Même format que les animations des
// combattants du Centre (centre/animation/fighterAnimations.js) : animation(t, ctx) →
// { pose, offset, item, events } ; le Bûcheron reprend la hache de la Forêt du Centre.
//
// Chaque artisan alterne travail et repos (`work` de data/boroughLayout.js : { animation,
// target, particle, work, rest } en secondes) ; le passage de l'un à l'autre est fondu.

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const cycleOf = (t, period) => ({ u: ((t / period) % 1 + 1) % 1, n: Math.floor(t / period) });
const along = (dir, amount) => ({ x: dir.x * amount, y: dir.y * amount });

export const ARTISAN_ANIMATIONS = Object.freeze({
  idle: FIGHTER_ANIMATIONS.idle,
  /** Bûcheron : il lève la hache et fend la bûche (animation de la Forêt du Centre). */
  chop: FIGHTER_ANIMATIONS.chop,

  /** Menuisier : il pousse le rabot sur la planche, revient, recommence ; copeaux. */
  plane(t, ctx) {
    const period = 1.5;
    const { u, n } = cycleOf(t, period);
    const push = u < 0.55 ? smooth(u / 0.55) : 1 - smooth((u - 0.55) / 0.45);
    return {
      pose: { rotate: 0.1 * push * ctx.facing, dy: 0.015 * push, flip: ctx.facing < 0 },
      offset: along(ctx.dir, 0.08 * push),
      item: { kind: 'plane', dx: (0.2 + 0.1 * push) * ctx.facing, dy: -0.4 + 0.03 * push, angle: 0.05 * ctx.facing, size: 0.3 },
      events: [{ key: 'shave', cycle: n, particle: u >= 0.5 ? 'chips' : null, at: 'target', z: 0.25 }],
    };
  },

  /** Sénéchal : il écrit dans le registre, la plume court ; de temps en temps il relève la tête. */
  write(t, ctx) {
    const period = 4;
    const { u } = cycleOf(t, period);
    const lookUp = u > 0.78 ? Math.sin((u - 0.78) / 0.22 * Math.PI) : 0;
    const scribble = (1 - lookUp) * Math.sin(t * 9);
    return {
      pose: { rotate: (0.08 - 0.1 * lookUp) * ctx.facing, dy: 0.01 * (1 - lookUp), scaleY: 1 - 0.015 * (1 - lookUp), flip: ctx.facing < 0 },
      offset: { x: 0, y: 0 },
      item: { kind: 'quill', dx: (0.22 + 0.03 * scribble) * ctx.facing, dy: -0.44 + 0.02 * Math.cos(t * 7) - 0.12 * lookUp, angle: (0.5 + 0.1 * scribble) * ctx.facing, size: 0.3 },
      events: [],
    };
  },

  /** Scriptorium : il lit le livre qu'il tient, tourne une page, relève la tête et hoche. */
  read(t, ctx) {
    const period = 5;
    const { u } = cycleOf(t, period);
    const turn = u > 0.62 && u < 0.72 ? Math.sin((u - 0.62) / 0.1 * Math.PI) : 0;
    const nod = u > 0.82 ? Math.sin((u - 0.82) / 0.18 * Math.PI) : 0;
    return {
      pose: { rotate: (0.05 + 0.04 * Math.sin(t * 0.7) - 0.06 * nod) * ctx.facing, dy: 0.008, scaleY: 1 - 0.012 * (1 - nod), flip: ctx.facing < 0 },
      offset: { x: 0, y: 0 },
      item: { kind: 'book', dx: 0.2 * ctx.facing, dy: -0.46 + 0.02 * turn - 0.03 * nod, angle: (0.15 + 0.25 * turn) * ctx.facing, size: 0.28 },
      events: [],
    };
  },

  /** Scriptorium : il se hisse vers le rayon, en tire un livre, le parcourt, le remet. */
  browse(t, ctx) {
    const period = 4.2;
    const { u } = cycleOf(t, period);
    const reach = u < 0.25 ? smooth(u / 0.25) : u < 0.4 ? 1 : u < 0.55 ? 1 - smooth((u - 0.4) / 0.15) : 0;
    const holding = u >= 0.4 && u < 0.9;
    return {
      pose: { rotate: -0.06 * reach * ctx.facing, dy: -0.03 * reach, scaleY: 1 + 0.04 * reach, flip: ctx.facing < 0 },
      offset: along(ctx.dir, 0.05 * reach),
      item: holding ? { kind: 'book', dx: 0.18 * ctx.facing, dy: -0.48 - 0.25 * reach, angle: -0.2 * ctx.facing, size: 0.24 } : null,
      events: [],
    };
  },

  /** Boulanger : il pétrit la pâte à pleines mains, pèse de tout son poids ; farine. */
  knead(t, ctx) {
    const period = 1.25;
    const { u, n } = cycleOf(t, period);
    const press = u < 0.4 ? smooth(u / 0.4) : u < 0.55 ? 1 : 1 - smooth((u - 0.55) / 0.45);
    return {
      pose: { rotate: 0.14 * press * ctx.facing, dy: 0.035 * press, scaleY: 1 - 0.05 * press, flip: ctx.facing < 0 },
      offset: along(ctx.dir, 0.05 * press),
      item: { kind: 'dough', dx: (0.24 + 0.04 * press) * ctx.facing, dy: -0.34 + 0.06 * press, angle: 0, size: 0.24 },
      events: [{ key: 'knead', cycle: n, particle: u >= 0.45 ? 'flour' : null, at: 'target', z: 0.2 }],
    };
  },
});

const NUMERIC = ['dx', 'dy', 'rotate', 'scaleY'];
const DEFAULTS = { dx: 0, dy: 0, rotate: 0, scaleY: 1 };

/**
 * Image d'un artisan à l'instant `time` : { pose, offset, item, events, working (0 à 1), facing }.
 * zone : { stand, work: { animation, target, work, rest } } ; phase : décalage (s) propre à
 * l'artisan, pour que tous ne travaillent pas en même temps.
 */
export function artisanFrame(zone, time, phase = 0) {
  const work = zone.work ?? {};
  const target = work.target ?? { x: zone.stand.x, y: zone.stand.y - 1 };
  const raw = { x: target.x - zone.stand.x, y: target.y - zone.stand.y };
  const length = Math.hypot(raw.x, raw.y) || 1;
  const dir = { x: raw.x / length, y: raw.y / length };
  const facing = raw.x - raw.y >= 0 ? 1 : -1;
  const ctx = { facing, dir, reach: 0.2, run: { x: 0, y: 0 }, partner: false };

  const workSpan = work.work ?? 7;
  const restSpan = work.rest ?? 3.5;
  const fade = 0.6;
  const local = ((time + phase) % (workSpan + restSpan) + workSpan + restSpan) % (workSpan + restSpan);
  const working = local < workSpan ? Math.min(smooth(local / fade), smooth((workSpan - local) / fade)) : 0;

  const idle = ARTISAN_ANIMATIONS.idle(time + phase, ctx);
  const gesture = (ARTISAN_ANIMATIONS[work.animation] ?? ARTISAN_ANIMATIONS.idle)(time + phase, ctx);
  const pose = {};
  for (const key of NUMERIC) {
    const a = idle.pose[key] ?? DEFAULTS[key];
    const b = gesture.pose[key] ?? DEFAULTS[key];
    pose[key] = a + (b - a) * working;
  }
  // Au travail : tourné vers l'ouvrage ; au repos : il regarde autour de lui.
  pose.flip = working > 0.5 ? gesture.pose.flip : idle.pose.flip;
  const offset = gesture.offset ?? { x: 0, y: 0 };
  return {
    pose,
    offset: { x: offset.x * working, y: offset.y * working },
    item: working > 0.35 ? gesture.item ?? null : null,
    events: working > 0.8 ? gesture.events ?? [] : [],
    working,
    facing,
    target,
  };
}
