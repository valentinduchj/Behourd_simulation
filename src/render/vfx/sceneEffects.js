import { SCENE_VFX, TALENT_VFX_COLORS } from '../../data/vfx.js';
import { createRng } from '../../utils/random.js';
import { burstParticles } from './particles.js';
import { getVfxLevel } from './vfxLevel.js';

// Effets visuels des scènes hors combat (Centre, Bourg, Taverne) — présentation seulement.
//
// L'écran déclenche un effet (add) ; le rendu demande, à chaque image, les particules de
// l'instant (particles). Chaque particule est une fonction de l'âge de son effet. Un effet
// terminé est oublié. Réglages : data/vfx.js (SCENE_VFX). Dessin : render/vfx/particles.js.
//
// Effets (props passés à add) :
//   'gain'   { x, y, text, tone: 'stat' | 'fatigue' | 'resource' }  texte flottant qui monte
//   'hammer' { x, y }       coups de marteau, poussière et éclats de bois
//   'door'   { x, y }       fumée qui entre par la porte (l'ouverture : doorOpenAmount)
//   'cheers' { x, y }       deux chopes qui trinquent
//   'roundWin' { winners: [{ x, y }], color, width, height }  fanions et poussière (fin de manche)
//   'reveal' { x, y, rarity, text }  révélation d'un talent (Scriptorium)
//   'artifact' { x, y }     un artefact se pose sur la table de Flavia (artifactLift : sa descente)

const nowSeconds = () => performance.now() / 1000;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const lerp = ([min, max], t) => min + (max - min) * t;
const emitter = (x, y, seed) => ({ x, y, dirX: 0, dirY: 0, damage: 0, seed });

/** Durée d'un effet (la révélation d'un talent épique dure plus longtemps). */
function durationOf(effect, def) {
  return effect.kind === 'reveal' && effect.rarity === 'epic' ? def.epicDuration : def.duration;
}

const BUILDERS = {
  gain(effect, age, def) {
    const t = clamp01(age / def.duration);
    const alpha = Math.min(1, age / 0.18) * (t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4);
    return [{
      shape: 'text', layer: 'over', x: effect.x, y: effect.y, z: def.height + def.rise * easeOut(t),
      text: effect.text, size: def.size, color: def.colors[effect.tone] ?? def.colors.stat, alpha,
    }];
  },

  hammer(effect, age, def, level) {
    const out = [];
    const period = def.duration / def.strikes;
    const t = clamp01(age / def.duration);
    // Le marteau se lève puis frappe à chaque fin de période.
    const phase = (age % period) / period;
    const angle = -def.swing * Math.sin(phase * Math.PI);
    out.push({ shape: 'glyph', layer: 'over', x: effect.x, y: effect.y, z: def.height + 0.12 * Math.sin(phase * Math.PI), text: def.glyph, size: def.size, angle, alpha: t < 0.85 ? 1 : (1 - t) / 0.15 });
    for (let k = 0; k < def.strikes; k++) {
      const strikeAge = age - (k + 1) * period + 0.02;
      if (strikeAge < 0) continue;
      const emitter = { x: effect.x, y: effect.y, dirX: 0, dirY: 0, damage: 0 };
      out.push(...burstParticles({ ...emitter, seed: `${effect.seed}:dust:${k}` }, strikeAge, def.dust, level));
      out.push(...burstParticles({ ...emitter, seed: `${effect.seed}:chips:${k}` }, strikeAge, def.chips, level));
    }
    return out;
  },

  door(effect, age, def, level) {
    const out = [];
    for (let k = 0; k < def.puffs; k++) {
      const puffAge = age - def.opening * 0.6 - k * def.puffEvery;
      if (puffAge < 0) continue;
      // Fumée poussée dans la salle (vers +x depuis le mur de gauche).
      out.push(...burstParticles({ x: effect.x, y: effect.y, dirX: 1, dirY: 0, damage: 0, seed: `${effect.seed}:smoke:${k}` }, puffAge, def.smoke, level));
    }
    return out;
  },

  cheers(effect, age, def, level) {
    const out = [];
    const t = clamp01(age / def.duration);
    const meet = def.meetAt * def.duration;
    const approach = clamp01(age / meet);
    const offset = def.gap * (1 - easeOut(approach));
    const bounce = age > meet ? 0.08 * Math.sin(clamp01((age - meet) / 0.25) * Math.PI) : 0;
    const alpha = t < 0.8 ? 1 : (1 - t) / 0.2;
    // Décalage horizontal à l'écran : (+d/2, −d/2) en cases (axes isométriques).
    for (const side of [-1, 1]) {
      out.push({
        shape: 'glyph', layer: 'over', x: effect.x + (side * offset) / 2, y: effect.y - (side * offset) / 2,
        z: def.height + bounce, text: def.glyph, size: def.size, angle: side * -0.35 * (1 - approach * 0.4), alpha,
      });
    }
    if (age >= meet) out.push(...burstParticles({ x: effect.x, y: effect.y, dirX: 0, dirY: 0, damage: 0, seed: `${effect.seed}:froth` }, age - meet, def.froth, level));
    return out;
  },

  roundWin(effect, age, def, level) {
    const out = [];
    const t = clamp01(age / def.duration);
    const alpha = Math.min(1, age / def.pennant.fadeIn) * (t < 0.75 ? 1 : (1 - t) / 0.25);
    effect.winners.forEach((w, i) => out.push({
      shape: 'pennant', layer: 'over', x: w.x, y: w.y, z: def.pennant.height, size: def.pennant.size,
      color: effect.color, wave: age * def.pennant.wave + i * 0.9, alpha,
    }));
    // Poussière le long de la palissade : la foule trépigne.
    const rng = createRng(`${effect.seed}:foule`);
    const perimeter = 2 * (effect.width + effect.height);
    for (let k = 0; k < def.dustPoints; k++) {
      let d = rng() * perimeter;
      let x;
      let y;
      if (d < effect.width) [x, y] = [d, -0.3];
      else if ((d -= effect.width) < effect.height) [x, y] = [effect.width + 0.3, d];
      else if ((d -= effect.height) < effect.width) [x, y] = [effect.width - d, effect.height + 0.3];
      else [x, y] = [-0.3, effect.height - (d - effect.width)];
      const dustAge = age - k * def.dustEvery;
      if (dustAge >= 0) out.push(...burstParticles(emitter(x, y, `${effect.seed}:poussiere:${k}`), dustAge, def.dust, level));
    }
    return out;
  },

  reveal(effect, age, def, level) {
    const out = [];
    const colors = TALENT_VFX_COLORS[effect.rarity] ?? TALENT_VFX_COLORS.common;
    const duration = durationOf(effect, def);
    const t = clamp01(age / duration);
    const fade = t < 0.8 ? 1 : (1 - t) / 0.2;
    const open = clamp01(age / 0.5);
    // Lumière : rayons qui jaillissent du livre et tournent lentement.
    const rays = clamp01((age - 0.35) / 0.5);
    if (rays > 0) {
      out.push({
        shape: 'rays', layer: 'over', x: effect.x, y: effect.y, z: def.height, size: def.raySize * easeOut(rays) * (effect.rarity === 'epic' ? 1.25 : 1),
        count: def.rays, color: colors.fill, outline: colors.stroke, angle: age * def.raySpin, alpha: 0.75 * fade,
      });
    }
    if (level.flash && age >= 0.35 && age - 0.35 <= def.flash.life) {
      out.push({ shape: 'flash', layer: 'over', x: effect.x, y: effect.y, z: def.height, size: def.flash.radius, color: colors.rgb, alpha: 1 - (age - 0.35) / def.flash.life });
    }
    // Le livre s'ouvre (fermé, puis ouvert), au-dessus du pupitre.
    out.push({
      shape: 'item', layer: 'over', x: effect.x, y: effect.y, z: def.height, size: def.glyphSize,
      item: open < 1 ? { kind: 'closedBook', cover: '#5a3a1a' } : { kind: 'book', cover: '#5a3a1a' }, angle: 0, alpha: fade,
    });
    // Pages qui tourbillonnent en montant.
    const count = Math.max(1, Math.round(def.pages * level.count));
    for (let i = 0; i < count; i++) {
      const a = age - 0.3 - i * 0.06;
      if (a < 0) continue;
      const k = clamp01(a / (duration * 0.7));
      const angle = (i / count) * Math.PI * 2 + k * def.pageTurns * Math.PI * 2;
      out.push({
        shape: 'page', layer: 'over', x: effect.x + Math.cos(angle) * def.pageRadius * easeOut(k), y: effect.y + Math.sin(angle) * def.pageRadius * easeOut(k),
        z: def.height + def.pageRise * k, size: def.pageSize, color: '#f4ecd8', outline: 'rgba(90, 70, 40, 0.6)', angle: angle * 2, alpha: (1 - k) * fade,
      });
    }
    // Le nom du talent monte, à la couleur de sa famille.
    if (effect.text && age > 0.6) {
      out.push({
        shape: 'text', layer: 'over', x: effect.x, y: effect.y, z: def.height + 0.35 + def.textRise * easeOut(clamp01((age - 0.6) / 1.2)),
        text: effect.text, size: def.textSize, color: effect.rarity === 'epic' ? colors.stroke : colors.fill, alpha: Math.min(1, (age - 0.6) / 0.3) * fade,
      });
    }
    return out;
  },

  artifact(effect, age, def, level) {
    const out = [];
    if (age < def.drop) return out; // l'artefact descend (dessiné par la scène : artifactLift)
    const landed = age - def.drop;
    if (landed <= def.wave.life) {
      const t = landed / def.wave.life;
      out.push({ shape: 'ring', layer: 'over', x: effect.x, y: effect.y, z: 0.36, size: lerp(def.wave.radius, easeOut(t)), width: def.wave.width, color: '#f0c419', alpha: 1 - t });
    }
    if (level.flash && landed <= def.flash.life) {
      out.push({ shape: 'flash', layer: 'over', x: effect.x, y: effect.y, z: 0.45, size: def.flash.radius, color: '255, 226, 140', alpha: 1 - landed / def.flash.life });
    }
    out.push(...burstParticles(emitter(effect.x, effect.y, `${effect.seed}:pages`), landed, def.pages, level));
    return out;
  },
};

/**
 * Ambiance d'un pupitre occupé (B2) à l'instant `time` : points d'encre de la plume, poussière
 * dorée qui flotte. Fonction du temps seul (rien à déclencher). seat : { x, y } (le pupitre).
 */
export function studyAmbience(seat, time, { index = 0, config = SCENE_VFX.study, level = getVfxLevel() } = {}) {
  if (level.count <= 0) return [];
  const out = [];
  const cycle = Math.floor(time / config.inkEvery);
  for (const k of [cycle - 1, cycle]) {
    const age = time - k * config.inkEvery;
    out.push(...burstParticles(emitter(seat.x, seat.y, `encre:${index}:${k}`), age, config.ink, level));
  }
  const motes = Math.max(1, Math.round(config.motes * level.count));
  for (let i = 0; i < motes; i++) {
    const k = ((time / config.moteLife) + i / motes + index * 0.37) % 1;
    out.push({
      shape: 'flash', layer: 'over', x: seat.x + Math.sin(time * 0.7 + i * 2.1) * 0.25, y: seat.y + Math.cos(time * 0.5 + i) * 0.2,
      z: config.height + config.moteRise * k, size: config.moteSize * 3, color: '255, 214, 120', alpha: 0.8 * Math.sin(k * Math.PI),
    });
  }
  return out;
}

export class SceneEffects {
  constructor({ config = SCENE_VFX } = {}) {
    this.config = config;
    this.effects = [];
    this.counter = 0;
  }

  /**
   * Déclenche un effet. options : { at (secondes, horloge de rendu), delay }. Ignoré si les
   * effets visuels sont désactivés. Renvoie l'effet (ou null).
   */
  add(kind, props = {}, { at = nowSeconds(), delay = 0 } = {}) {
    if (!BUILDERS[kind] || getVfxLevel().count <= 0) return null;
    this.counter += 1;
    const effect = { ...props, kind, start: at + delay, seed: `${kind}:${this.counter}:${props.x ?? 0},${props.y ?? 0}` };
    this.effects.push(effect);
    return effect;
  }

  /** Effets en cours (ou à venir) à l'instant `now`. */
  active(now = nowSeconds()) {
    this.effects = this.effects.filter((effect) => now - effect.start <= durationOf(effect, this.config[effect.kind]));
    return this.effects;
  }

  /**
   * Hauteur (en cases) de l'artefact qui descend se poser sur la table (effet 'artifact') : de
   * dropHeight à 0, null hors de toute arrivée.
   */
  artifactLift(now = nowSeconds()) {
    for (const effect of this.active(now)) {
      if (effect.kind !== 'artifact') continue;
      const def = this.config.artifact;
      const age = now - effect.start;
      if (age < 0) return def.dropHeight;
      if (age < def.drop) return def.dropHeight * (1 - easeOut(age / def.drop));
    }
    return null;
  }

  /** Particules à dessiner à l'instant `now` (horloge de rendu, en secondes). */
  particles(now = nowSeconds()) {
    const level = getVfxLevel();
    const out = [];
    for (const effect of this.active(now)) {
      const age = now - effect.start;
      if (age < 0) continue;
      out.push(...BUILDERS[effect.kind](effect, age, this.config[effect.kind], level));
    }
    return out;
  }

  /** Ouverture de la porte (0 = fermée, 1 = grande ouverte) selon les effets 'door' en cours. */
  doorOpenAmount(now = nowSeconds()) {
    let open = 0;
    for (const effect of this.active(now)) {
      if (effect.kind !== 'door') continue;
      const def = this.config.door;
      const age = now - effect.start;
      if (age < 0) continue;
      const closingStart = def.duration - def.closing;
      const amount = age < def.opening ? easeOut(age / def.opening) : age < closingStart ? 1 : 1 - clamp01((age - closingStart) / def.closing);
      open = Math.max(open, amount);
    }
    return open;
  }
}
