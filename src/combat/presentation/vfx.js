import { DEFAULT_VFX_LEVEL, TALENT_VFX_COLORS, VFX_CONFIG, VFX_LEVELS } from '../../data/vfx.js';
import { TALENTS } from '../../data/talents.js';
import { burstParticles } from '../../render/vfx/particles.js';
import { createRng } from '../../utils/random.js';

// Effets visuels du rejeu d'une manche (particules) — présentation seulement.
//
//   événements de la simulation (coups, KO, déplacements, survies, talents) → événements visuels
//   (une fois) → particules à l'instant t (fonction pure du temps : rien n'est mémorisé d'une
//   image à l'autre, donc l'avance rapide, la pause et « Passer à la fin » restent cohérents).
//
// Chaque particule est tirée avec une graine propre à son événement : la même manche donne
// toujours les mêmes étincelles. Réglages : data/vfx.js. Moteur et dessin : render/vfx/particles.js.
//
// Événements visuels : step, flankTrail, impact, advantage, ko (lot 1) ; talent, lastStand,
// lucky, combo, heavy, captain, fatigue (lot 4). Le tremblement de caméra des gros coups est
// lu à part (shakeAt) : c'est un décalage de toute la scène, pas une particule.

export { resolveVfxLevel } from '../../render/vfx/vfxLevel.js';

// Distance (en cases) entre le centre de la cible et le point de contact d'un coup.
const CONTACT_OFFSET = 0.3;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const lerp = ([min, max], t) => min + (max - min) * t;

const cache = new WeakMap();

/** Famille de talent ('common' | 'rare' | 'epic') ; 'common' par défaut. */
const RARITY_BY_TALENT = new Map(TALENTS.map((talent) => [talent.id, talent.rarity]));
function rarityOf(talentId) {
  const rarity = RARITY_BY_TALENT.get(talentId);
  return TALENT_VFX_COLORS[rarity] ? rarity : 'common';
}

/**
 * Événements visuels d'une manche : [{ kind, time, x, y, dirX, dirY, damage, seed, … }], triés
 * par instant (secondes de rejeu, sans l'introduction). Calculés une fois par rejeu.
 */
export function buildVfxEvents(playback, { arenaHeight = null, config = VFX_CONFIG } = {}) {
  const key = `${arenaHeight}`;
  const known = cache.get(playback);
  if (known?.key === key && known.config === config) return known.events;
  const ts = playback.tickSeconds;
  const initial = playback.simulation.initial ?? [];
  const unitOf = new Map(initial.map((unit) => [unit.id, unit]));
  const classOf = new Map(initial.map((unit) => [unit.id, unit.classId]));
  const center = (p) => ({ x: p.x + 0.5, y: p.y + 0.5 });
  const attackTime = (tick, i, count) => (tick - 1 + 0.5 + (0.5 * i) / count) * ts;
  const events = [];
  const lastRune = new Map(); // `${unitId}:${talentId}` → dernier tour d'une rune
  for (let tick = 1; tick <= playback.ticks; tick++) {
    const { attacks, moves } = playback.byTick[tick];
    const positions = playback.positions[tick];
    const attackers = new Set(attacks.map((attack) => attack.unitId));
    // Déplacements : première moitié du tour si le combattant frappe ensuite, tout le tour sinon.
    for (const move of moves) {
      const start = (tick - 1) * ts;
      const duration = attackers.has(move.unitId) ? ts * 0.5 : ts;
      const from = center(move.from);
      const to = center(move.to);
      events.push({ kind: 'step', time: start, x: from.x, y: from.y, dirX: 0, dirY: 0, damage: 0, seed: `step:${tick}:${move.unitId}` });
      // Course du Runner : traînée de poussière derrière lui.
      const trail = config.flankTrail;
      if (trail && classOf.get(move.unitId) === trail.classId) {
        [0.25, 0.6, 0.95].forEach((f, i) => events.push({
          kind: 'flankTrail', time: start + duration * f, x: from.x + (to.x - from.x) * f, y: from.y + (to.y - from.y) * f,
          dirX: 0, dirY: 0, damage: 0, seed: `trail:${tick}:${move.unitId}:${i}`,
        }));
      }
    }
    // Coups : chacun au début de sa tranche de temps (même instant que les dégâts affichés).
    attacks.forEach((attack, i) => {
      const time = attackTime(tick, i, attacks.length);
      const target = center(positions.get(attack.targetId));
      const attacker = center(positions.get(attack.unitId) ?? positions.get(attack.targetId));
      const length = Math.hypot(target.x - attacker.x, target.y - attacker.y) || 1;
      const dirX = (target.x - attacker.x) / length;
      const dirY = (target.y - attacker.y) / length;
      const base = { time, x: target.x, y: target.y, dirX, dirY, damage: attack.damage };
      // Étincelles au point de contact, un peu en avant de la cible, côté attaquant.
      const contact = { ...base, x: target.x - dirX * CONTACT_OFFSET, y: target.y - dirY * CONTACT_OFFSET };
      events.push({ ...contact, kind: 'impact', seed: `impact:${tick}:${i}` });
      // Coup avantagé par la position (dans le dos, angle mort, à distance) : gerbe orange.
      if (attack.detail?.highlight) events.push({ ...contact, kind: 'advantage', seed: `adv:${tick}:${i}` });
      if (attack.hpAfter <= 0) events.push({ ...base, kind: 'ko', seed: `ko:${tick}:${i}` });
      // Gros coup, combo, coup chanceux.
      if (config.heavy && attack.damage >= config.heavy.minDamage) events.push({ ...contact, kind: 'heavy', seed: `heavy:${tick}:${i}` });
      const hits = attack.detail?.comboHits ?? 0;
      if (config.combo && hits >= config.combo.minHits) events.push({ ...contact, kind: 'combo', hits, seed: `combo:${tick}:${i}` });
      const atAttacker = { time, x: attacker.x, y: attacker.y, dirX: 0, dirY: 0, damage: 0 };
      if (config.lucky && attack.detail?.lucky) events.push({ ...atAttacker, kind: 'lucky', seed: `lucky:${tick}:${i}` });
      // Talents de l'attaquant lui-même (pas l'aura d'un allié) qui ont joué sur ce coup.
      const own = new Set((unitOf.get(attack.unitId)?.talentEffects ?? []).map((e) => e.talentId));
      const played = (attack.detail?.bonuses ?? []).filter((id) => id.startsWith('talent:')).map((id) => id.slice(7)).filter((id) => own.has(id));
      for (const talentId of new Set(played)) {
        const runeKey = `${attack.unitId}:${talentId}`;
        if (config.talent && (lastRune.get(runeKey) ?? -Infinity) + config.talent.minGapTicks <= tick) {
          lastRune.set(runeKey, tick);
          events.push({ ...atAttacker, kind: 'talent', rarity: rarityOf(talentId), seed: `talent:${tick}:${i}:${talentId}` });
        }
      }
    });
  }
  // Survies à 1 PV : à l'instant du coup qui aurait dû être fatal (le premier coup reçu ensuite
  // dans le même tour, dans l'ordre des événements du moteur).
  if (config.lastStand) {
    const pending = new Map(); // tick → [unitId]
    const seen = new Map(); // tick → nombre de coups déjà vus
    for (const event of playback.simulation.events ?? []) {
      if (event.type === 'lastStand') {
        if (!pending.has(event.tick)) pending.set(event.tick, []);
        pending.get(event.tick).push(event);
      } else if (event.type === 'attack') {
        const index = seen.get(event.tick) ?? 0;
        seen.set(event.tick, index + 1);
        const waiting = pending.get(event.tick) ?? [];
        const match = waiting.findIndex((s) => s.unitId === event.targetId);
        if (match < 0) continue;
        const [stand] = waiting.splice(match, 1);
        const count = playback.byTick[event.tick]?.attacks.length ?? 1;
        const p = center(playback.positions[event.tick].get(stand.unitId));
        const invulnerableTicks = unitOf.get(stand.unitId)?.lastStand?.invulnerableTicks ?? 0;
        events.push({
          kind: 'lastStand', time: attackTime(event.tick, index, count), x: p.x, y: p.y, dirX: 0, dirY: 0, damage: 0,
          invulnerable: invulnerableTicks * ts, seed: `stand:${event.tick}:${stand.unitId}`,
        });
      }
    }
  }
  // Renversements (percussion du Runner) : poussière et étoiles sur la cible, au moment du coup.
  if (config.stun) {
    const seen = new Map();
    let lastAttack = null;
    for (const event of playback.simulation.events ?? []) {
      if (event.type === 'attack') {
        const index = seen.get(event.tick) ?? 0;
        seen.set(event.tick, index + 1);
        lastAttack = { tick: event.tick, index };
      } else if (event.type === 'stun' && lastAttack?.tick === event.tick) {
        const count = playback.byTick[event.tick]?.attacks.length ?? 1;
        const p = center(playback.positions[event.tick].get(event.unitId));
        events.push({ kind: 'stun', time: attackTime(event.tick, lastAttack.index, count), x: p.x, y: p.y, dirX: 0, dirY: 0, damage: 0, seed: `stun:${event.tick}:${event.unitId}` });
      }
    }
  }
  // Capitaines : lueur aux couleurs de leur compagnie, jouée pendant l'introduction (tous
  // immobiles) et éteinte quand le combat commence : elle ne reste pas, vide, à sa place de départ.
  if (config.captain && playback.ticks > 0) {
    const time = -Math.min(playback.introSeconds ?? 0, config.captain.life);
    for (const unit of initial.filter((u) => u.isCaptain)) {
      const p = center(unit);
      events.push({ kind: 'captain', time, x: p.x, y: p.y, dirX: 0, dirY: 0, damage: 0, side: unit.side, seed: `captain:${unit.id}` });
    }
  }
  // Fatigue élevée : gouttes de sueur (et vapeur) à intervalles réguliers, jusqu'au KO ou à la fin,
  // d'après la fatigue DU MOMENT (v0.66 : elle évolue pendant la manche) ; un combattant qui
  // souffle exhale aussi un peu de vapeur.
  const tired = config.fatigue;
  if (tired && playback.ticks > 0) {
    const endTime = playback.ticks * ts;
    const fatigueAt = (unit, tick) => playback.fatigue?.[tick]?.get(unit.id) ?? unit.fatigue ?? 0;
    for (const unit of initial) {
      const offset = createRng(`sueur:${unit.id}`)() * tired.every;
      const stop = playback.koTime?.get(unit.id) ?? endTime;
      for (let time = offset; time < stop; time += tired.every) {
        const tick = Math.min(playback.ticks, Math.floor(time / ts) + 1);
        const fatigue = fatigueAt(unit, tick);
        const resting = playback.isResting?.(unit.id, tick) ?? false;
        if (fatigue < tired.threshold && !resting) continue;
        const p = center(playback.positions[tick].get(unit.id));
        events.push({
          kind: 'fatigue', time, x: p.x, y: p.y, dirX: 0, dirY: 0, damage: 0, sweat: fatigue >= tired.threshold,
          steam: fatigue >= tired.steamThreshold || resting, seed: `fatigue:${unit.id}:${time.toFixed(2)}`,
        });
      }
    }
  }
  events.sort((a, b) => a.time - b.time);
  cache.set(playback, { key, config, events });
  return events;
}

/** Durée de vie d'un événement visuel (au-delà, il ne dessine plus rien). */
function lifeOf(event, config) {
  const def = config[event.kind];
  if (!def) return 0;
  if (event.kind === 'lastStand') return Math.max(def.life, event.invulnerable ?? 0);
  if (event.kind === 'captain') return def.gap * (def.rings - 1) + def.ringLife;
  if (event.kind === 'combo') return Math.max(def.life, def.sparks.life);
  if (event.kind === 'talent') return Math.max(def.life, def.burst.life);
  if (event.kind === 'lucky') return Math.max(def.life, def.burst.life);
  if (event.kind === 'fatigue') return Math.max(def.drops.life, def.steam.life);
  if (event.kind === 'stun') return Math.max(def.life, def.dust.life);
  return def.life;
}

/** Éclair blanc ou coloré (niveau complet seulement). */
function flashOf(event, age, flash, level, height, layer = 'over') {
  if (!flash || !level.flash || age < 0 || age > flash.life) return [];
  return [{ shape: 'flash', layer, x: event.x, y: event.y, z: height, size: flash.radius, color: flash.color, alpha: 1 - age / flash.life }];
}

// Particules de chaque sorte d'événement, `age` secondes après son déclenchement.
const BUILDERS = {
  talent(event, age, def, level) {
    const colors = TALENT_VFX_COLORS[event.rarity] ?? TALENT_VFX_COLORS.common;
    const out = burstParticles(event, age, { ...def.burst, colors: [colors.fill, colors.fill, colors.stroke], outline: colors.stroke }, level);
    const t = clamp01(age / def.life);
    if (age <= def.life) {
      out.push({
        shape: 'rune', layer: 'over', x: event.x, y: event.y, z: def.height + def.rise * easeOut(t),
        size: def.size * (1 + 0.35 * (1 - t)), color: colors.fill, outline: colors.stroke, angle: t * def.spin,
        alpha: Math.min(1, age / 0.08) * (t < 0.65 ? 1 : (1 - t) / 0.35),
      });
    }
    return out;
  },

  lastStand(event, age, def, level) {
    const out = [];
    const t = clamp01(age / def.life);
    if (age <= def.life) {
      out.push({ shape: 'ring', layer: 'under', x: event.x, y: event.y, z: 0.02, size: lerp(def.halo.radius, easeOut(t)), width: def.halo.width, color: def.color, alpha: 1 - t });
      out.push({ shape: 'ring', layer: 'over', x: event.x, y: event.y, z: 0.5, size: lerp(def.halo.radius, easeOut(t)) * 0.8, width: def.halo.width * 0.7, color: def.color, alpha: (1 - t) * 0.8 });
    }
    // Le bouclier tient, puis se brise en éclats.
    if (age < def.shield.breakAt) {
      out.push({ shape: 'shield', layer: 'over', x: event.x, y: event.y, z: def.shield.height, size: def.shield.size * (0.7 + 0.3 * clamp01(age / 0.12)), color: def.color, alpha: 1 });
    } else {
      out.push(...burstParticles(event, age - def.shield.breakAt, def.shards, level));
    }
    out.push(...flashOf(event, age, def.flash, level, def.shield.height));
    // Intouchable (Immortel) : scintillement autour de lui tant que dure l'invulnérabilité.
    const sh = def.shimmer;
    for (let start = 0; start < (event.invulnerable ?? 0); start += sh.every) {
      const a = age - start;
      if (a < 0 || a > sh.life) continue;
      const k = start / sh.every;
      const angle = k * 2.4;
      out.push({
        shape: 'rune', layer: 'over', x: event.x + Math.cos(angle) * sh.radius, y: event.y + Math.sin(angle) * sh.radius,
        z: 0.3 + (k % 3) * 0.2 + a * 0.3, size: sh.size, color: sh.color, outline: sh.outline, angle: a * 3, alpha: Math.sin((a / sh.life) * Math.PI),
      });
    }
    return out;
  },

  lucky(event, age, def, level) {
    const out = burstParticles(event, age, def.burst, level);
    const t = clamp01(age / def.life);
    if (age <= def.life) {
      out.push({
        shape: 'glyph', layer: 'over', x: event.x, y: event.y, z: def.height + def.rise * easeOut(t), text: def.glyph,
        size: def.size, angle: t * def.spin, alpha: t < 0.7 ? 1 : (1 - t) / 0.3,
      });
    }
    return out;
  },

  combo(event, age, def, level) {
    const out = burstParticles(event, age, def.sparks, level);
    const t = clamp01(age / def.life);
    if (age <= def.life) {
      out.push({
        shape: 'text', layer: 'over', x: event.x, y: event.y, z: def.height + def.rise * easeOut(t), shiftX: def.shiftX ?? 0, text: `×${event.hits}`,
        size: def.size * (1 + def.growth * (event.hits - def.minHits)), color: def.color, alpha: t < 0.6 ? 1 : (1 - t) / 0.4,
      });
    }
    return out;
  },

  heavy(event, age, def, level) {
    return [...burstParticles(event, age, def, level), ...flashOf(event, age, def.flash, level, def.height)];
  },

  captain(event, age, def, level, options) {
    const color = options.sideColors?.[event.side] ?? def.defaultColor;
    const out = [];
    for (let r = 0; r < def.rings; r++) {
      const a = age - r * def.gap;
      if (a < 0 || a > def.ringLife) continue;
      const t = a / def.ringLife;
      out.push({ shape: 'ring', layer: 'under', x: event.x, y: event.y, z: 0.02, size: lerp(def.radius, easeOut(t)), width: def.width, color, alpha: (1 - t) * (level.flash ? 1 : 0.7) });
    }
    return out;
  },

  stun(event, age, def, level) {
    const out = burstParticles(event, age, def.dust, level);
    const t = clamp01(age / def.life);
    if (age <= def.life) {
      out.push({ shape: 'glyph', layer: 'over', x: event.x, y: event.y, z: def.height + 0.1 * Math.sin(age * 9), text: def.glyph, size: def.size, angle: age * def.spin, alpha: t < 0.7 ? 1 : (1 - t) / 0.3 });
    }
    return out;
  },

  fatigue(event, age, def, level) {
    const out = event.sweat === false ? [] : burstParticles(event, age, def.drops, level);
    if (event.steam) out.push(...burstParticles({ ...event, seed: `${event.seed}:vapeur` }, age, def.steam, level));
    return out;
  },
};

/** Particules d'un événement visuel, `age` secondes après son déclenchement (gerbe + éclair éventuel). */
function particlesOf(event, age, def, level, options) {
  const builder = BUILDERS[event.kind];
  if (builder) return builder(event, age, def, level, options);
  const out = burstParticles(event, age, def, level);
  out.push(...flashOf(event, age, def.flash, level, def.height, def.layer));
  return out;
}

/**
 * Particules à afficher à l'instant `time` du rejeu (même horloge que playback.frameAt,
 * introduction comprise). Liste vide si les effets sont désactivés.
 * sideColors (facultatif) : { A, B } — couleur de chaque compagnie (lueur du capitaine).
 */
export function collectVfx(playback, time, { level = DEFAULT_VFX_LEVEL, arenaHeight = null, config = VFX_CONFIG, sideColors = null } = {}) {
  const settings = VFX_LEVELS[level] ?? VFX_LEVELS[DEFAULT_VFX_LEVEL];
  if (!playback || settings.count <= 0) return [];
  // Pendant l'introduction (now < 0), seuls les effets placés avant le combat (capitaines) jouent.
  const now = time - playback.introSeconds;
  const events = buildVfxEvents(playback, { arenaHeight, config });
  const particles = [];
  for (const event of events) {
    if (event.time > now) break;
    const age = now - event.time;
    if (age > lifeOf(event, config)) continue;
    const def = config[event.kind];
    if (def) particles.push(...particlesOf(event, age, def, settings, { sideColors }));
  }
  // Textes (compteur de combo) : un seul par case de la cible, le plus récent — deux « ×N »
  // successifs sur la même cible (point d'impact à ± 0,3 case de son centre) ne se superposent pas.
  const lastText = new Map();
  particles.forEach((particle, i) => { if (particle.shape === 'text') lastText.set(`${Math.floor(particle.x)}:${Math.floor(particle.y)}`, i); });
  if (lastText.size) {
    const kept = new Set(lastText.values());
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].shape === 'text' && !kept.has(i)) particles.splice(i, 1);
  }
  // Plafond : les particules les plus récentes sont gardées.
  return particles.length > config.maxParticles ? particles.slice(-config.maxParticles) : particles;
}

/**
 * Tremblement de caméra à l'instant `time` (gros coups) : décalage { x, y } en pixels, nul hors
 * du niveau d'effets complet. Oscillation amortie, fonction du seul temps de rejeu.
 */
export function shakeAt(playback, time, { level = DEFAULT_VFX_LEVEL, arenaHeight = null, config = VFX_CONFIG } = {}) {
  const settings = VFX_LEVELS[level] ?? VFX_LEVELS[DEFAULT_VFX_LEVEL];
  const shake = config.heavy?.shake;
  if (!playback || !settings.shake || !shake) return { x: 0, y: 0 };
  const now = time - playback.introSeconds;
  if (now < 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const event of buildVfxEvents(playback, { arenaHeight, config })) {
    if (event.time > now) break;
    if (event.kind !== 'heavy') continue;
    const age = now - event.time;
    if (age > shake.life) continue;
    const decay = 1 - age / shake.life;
    const phase = age * shake.frequency;
    x += Math.sin(phase * 2 * Math.PI) * shake.amplitude * decay;
    y += Math.cos(phase * 2 * Math.PI * 0.8) * shake.amplitude * 0.6 * decay;
  }
  const max = shake.amplitude * 1.5;
  return { x: Math.max(-max, Math.min(max, x)), y: Math.max(-max, Math.min(max, y)) };
}
