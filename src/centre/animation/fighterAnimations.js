import {
  ACTIVITY_VISUALS, REST_VISUAL, WALK_ANIMATION, CLASS_ANIMATION_STYLE, DEFAULT_ANIMATION_STYLE, FATIGUE_ANIMATION,
} from '../../data/centreVisuals.js';

// Animations des combattants du Centre — présentation seulement, aucune règle de jeu.
//
// Une animation est une fonction pure du temps : animation(t, ctx) → image du geste.
//   t    temps (s) déjà ajusté (déphasage du combattant, tempo de sa classe et de sa fatigue)
//   ctx  { facing (+1 : cible à droite de l'écran, −1 : à gauche), dir: { x, y } (vers la cible,
//          en cases, unitaire), run: { x, y } (course du Tas de foin), reach, partner (présent ?) }
// Renvoie :
//   pose       transformation du sprite (render/sprites.js, drawSpriteFigure `pose`)
//   offset     déplacement des pieds (cases)
//   events     [{ key, cycle, particle, at: 'self' | 'target' | 'between', z }] : un événement est
//              émis une fois par cycle (le contrôleur compare `cycle` d'une image à l'autre)
//   item       objet tenu { kind: 'food' | 'axe', dx, dy, angle, size } (fractions de la hauteur du sprite ;
//              dessins : centre/render/heldItems.js)
//   reaction   réaction du décor ciblé { kind: 'wobble' | 'squash' | 'shake', amount }
//   behind     true : dessiné derrière son décor cible (assis à table)
//   ripple     true : cercles dans l'eau autour du combattant
//
// Ajouter une animation : une fonction ici, puis son nom dans data/centreVisuals.js.

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
// Position dans le cycle : u ∈ [0, 1[ et numéro du cycle.
const cycleOf = (t, period) => ({ u: ((t / period) % 1 + 1) % 1, n: Math.floor(t / period) });
// Temps écoulé depuis l'instant `at` (fraction du cycle), dans le cycle courant.
const since = (u, at, period) => ((u - at + 1) % 1) * period;
// Pas de geste en arrière d'une case dans le sens de la cible.
const along = (dir, amount) => ({ x: dir.x * amount, y: dir.y * amount });

export const FIGHTER_ANIMATIONS = Object.freeze({
  /** Repos : respiration, poids d'une jambe sur l'autre, regard qui change de côté. */
  idle(t, { facing }) {
    const look = Math.sin(t * 0.23) > 0.55 ? -1 : 1;
    return {
      pose: { rotate: 0.03 * Math.sin(t * 0.8), scaleY: 1 + 0.012 * Math.sin(t * 2.1), flip: facing * look < 0 },
      offset: { x: 0, y: 0 },
    };
  },

  /** Marche : petits bonds, balancement, poussière à un pas sur deux. */
  walk(t, { facing }) {
    const period = 0.42;
    const { u, n } = cycleOf(t, period);
    return {
      pose: { dy: -0.035 * Math.abs(Math.sin(u * Math.PI)), rotate: 0.07 * Math.sin(u * TAU), flip: facing < 0, bob: false },
      offset: { x: 0, y: 0 },
      events: [{ key: 'step', cycle: Math.floor(n / 2), particle: 'dust', at: 'self', z: 0 }],
    };
  },

  /** Rivière : il nage d'une rive à l'autre du courant, le haut du corps hors de l'eau. */
  swim(t, ctx) {
    const lane = Math.sin(t * 0.45);
    const stroke = cycleOf(t, 1.3);
    // Le courant suit l'axe y : vers +y, le nageur va vers la gauche de l'écran.
    const heading = Math.cos(t * 0.45) >= 0 ? -1 : 1;
    return {
      pose: {
        sink: 0.52, shadow: false, bob: false, flip: heading < 0,
        dy: 0.02 * Math.sin(stroke.u * TAU), rotate: heading * (0.18 + 0.08 * Math.sin(stroke.u * TAU)),
      },
      offset: { x: 0, y: lane * 0.38 },
      ripple: true,
      events: [{ key: 'stroke', cycle: stroke.n, particle: 'splash', at: 'self', z: 0 }],
    };
  },

  /** Banquet : assis derrière la table, il porte la nourriture à la bouche. */
  eat(t, ctx) {
    const period = 2.6;
    const { u, n } = cycleOf(t, period);
    const lift = u < 0.3 ? smooth(u / 0.3) : u < 0.62 ? 1 : 1 - smooth((u - 0.62) / 0.28);
    const chew = u > 0.3 && u < 0.62 ? Math.sin((u - 0.3) * 40) * 0.02 : 0;
    return {
      pose: { dy: 0.12, scaleY: 0.9 + chew, flip: ctx.facing < 0, rotate: -0.04 * lift * ctx.facing },
      offset: { x: 0, y: 0 },
      behind: true,
      item: { kind: 'food', dx: 0.16 * ctx.facing * (1 - lift * 0.6), dy: -0.32 - 0.38 * lift, angle: -0.6 * lift * ctx.facing, size: 0.26 },
      events: [{ key: 'bite', cycle: n, at: 'self', particle: u >= 0.4 ? 'crumbs' : null, z: 0.62 }],
    };
  },

  /** Petite lice : fentes vers le partenaire (en alternance), esquives, petits pas de côté. */
  spar(t, ctx) {
    const period = 1.8;
    const { u, n } = cycleOf(t, period);
    const reach = ctx.reach;
    const lunge = u < 0.22 ? -0.35 * smooth(u / 0.22) : u < 0.36 ? -0.35 + 1.35 * smooth((u - 0.22) / 0.14) : u < 0.62 ? 1 - smooth((u - 0.36) / 0.26) : 0;
    const side = u >= 0.62 ? Math.sin((u - 0.62) / 0.38 * Math.PI) * 0.12 : 0;
    const off = along(ctx.dir, lunge * reach);
    return {
      pose: { rotate: 0.2 * lunge * ctx.facing, dy: -0.02 * Math.max(0, lunge), flip: ctx.facing < 0 },
      // Pas de côté : perpendiculaire à l'axe des deux lutteurs.
      offset: { x: off.x - ctx.dir.y * side, y: off.y + ctx.dir.x * side },
      events: [
        { key: 'clash', cycle: n, particle: u >= 0.36 ? (ctx.partner ? 'sparks' : null) : null, at: 'between', z: 0.5 },
        { key: 'dust', cycle: n, particle: u >= 0.36 ? 'dust' : null, at: 'self', z: 0 },
      ],
    };
  },

  /** Mannequins : il arme, frappe ; le mannequin tangue et perd de la paille. */
  strikeDummy(t, ctx) {
    const period = 1.35;
    const { u, n } = cycleOf(t, period);
    const windUp = u < 0.45 ? smooth(u / 0.45) : u < 0.52 ? 1 - smooth((u - 0.45) / 0.07) * 1.6 : -0.6 + smooth((u - 0.52) / 0.48) * 0.6;
    const hitAge = since(u, 0.5, period);
    const off = along(ctx.dir, Math.max(0, -windUp) * ctx.reach * 0.6);
    return {
      pose: { rotate: -0.22 * windUp * ctx.facing, flip: ctx.facing < 0, dy: 0.01 * windUp },
      offset: off,
      events: [{ key: 'hit', cycle: n, particle: u >= 0.5 ? 'straw' : null, at: 'target', z: 0.35 }],
      reaction: { kind: 'wobble', amount: Math.exp(-hitAge * 3.5) * Math.sin(hitAge * 16) * 0.22 },
    };
  },

  /** Tas de foin : il recule, prend son élan, charge l'épaule en avant ; la botte s'écrase. */
  chargeHay(t, ctx) {
    const period = 2.8 / (ctx.reach > 0.25 ? 1.1 : 1);
    const { u, n } = cycleOf(t, period);
    // 0 = position de départ (le point), 1 = contre la botte (`run`).
    let k;
    let rotate = 0;
    let crouch = 0;
    if (u < 0.3) k = 0;
    else if (u < 0.42) { k = 0; crouch = smooth((u - 0.3) / 0.12); }
    else if (u < 0.6) { k = smooth((u - 0.42) / 0.18) ** 1.4; rotate = 0.28; crouch = 0.3; }
    else if (u < 0.7) { k = 1 - 0.15 * smooth((u - 0.6) / 0.1); rotate = 0.1; }
    else { k = 0.85 * (1 - smooth((u - 0.7) / 0.3)); }
    const hitAge = since(u, 0.6, period);
    return {
      pose: { rotate: rotate * ctx.facing, dy: 0.05 * crouch, scaleY: 1 - 0.08 * crouch, flip: (u >= 0.7 ? -ctx.facing : ctx.facing) < 0, bob: false },
      offset: { x: ctx.run.x * k, y: ctx.run.y * k },
      events: [
        { key: 'impact', cycle: n, particle: u >= 0.6 ? 'straw' : null, at: 'target', z: 0.25 },
        { key: 'push', cycle: n, particle: u >= 0.45 ? 'dust' : null, at: 'self', z: 0 },
      ],
      reaction: { kind: 'squash', amount: Math.exp(-hitAge * 5) * (hitAge < period * 0.5 ? 1 : 0) },
    };
  },

  /** Forêt : il lève la hache et fend la souche (ou entaille l'arbre) ; éclats de bois. */
  chop(t, ctx) {
    const period = 1.6;
    const { u, n } = cycleOf(t, period);
    const raise = u < 0.55 ? smooth(u / 0.55) : u < 0.62 ? 1 - smooth((u - 0.55) / 0.07) : 0;
    const hitAge = since(u, 0.6, period);
    const strike = u >= 0.55 && u < 0.75 ? 1 - smooth((u - 0.62) / 0.13) : 0;
    return {
      pose: { rotate: (-0.16 * raise + 0.12 * strike) * ctx.facing, dy: 0.03 * strike, flip: ctx.facing < 0 },
      offset: along(ctx.dir, 0.05 * strike),
      item: { kind: 'axe', dx: (0.22 - 0.12 * raise + 0.12 * strike) * ctx.facing, dy: -0.55 - 0.35 * raise + 0.25 * strike, angle: (-1.4 * raise + 0.9 * strike + 0.2) * ctx.facing, size: 0.3 },
      events: [{ key: 'chop', cycle: n, particle: u >= 0.6 ? 'chips' : null, at: 'target', z: 0.15 }],
      reaction: { kind: 'shake', amount: Math.exp(-hitAge * 6) * Math.sin(hitAge * 30) * 0.06 },
    };
  },
});

/**
 * Animation d'un combattant : (combattant, classe, activité, état) → { name, tempo, reach }.
 * état : 'walking' | 'active' | 'idle'. Une activité sans mise en scène retombe sur le repos.
 */
export function resolveFighterAnimation(fighter, activityId, state, { visuals = ACTIVITY_VISUALS } = {}) {
  const style = CLASS_ANIMATION_STYLE[fighter?.specialtyId] ?? DEFAULT_ANIMATION_STYLE;
  const tired = (fighter?.stats?.fatigue ?? 0) >= FATIGUE_ANIMATION.threshold;
  const tempo = style.tempo * (tired ? FATIGUE_ANIMATION.tempo : 1);
  let name = REST_VISUAL.occupiedAnimation;
  if (state === 'walking') name = WALK_ANIMATION;
  else if (state === 'active' && activityId) {
    const visual = visuals[activityId];
    name = visual?.byClass?.[fighter?.specialtyId] ?? visual?.occupiedAnimation ?? name;
  }
  if (!FIGHTER_ANIMATIONS[name]) name = REST_VISUAL.occupiedAnimation;
  // La marche garde sa cadence (elle suit la vitesse de déplacement).
  return { name, tempo: name === WALK_ANIMATION ? 1 : tempo, reach: style.reach, tired };
}
