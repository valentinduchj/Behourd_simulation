import { ACTIVITY_VISUALS, CENTRE_AMBIENCE, CENTRE_PARTICLES } from '../../data/centreVisuals.js';
import { burstParticles } from '../../render/vfx/particles.js';
import { getVfxLevel } from '../../render/vfx/vfxLevel.js';
import { createRng } from '../../utils/random.js';
import { CLIMATE_SEASONS } from '../../data/climate.js';
import { seasonVisuals, seasonWeatherParticles } from '../../render/seasonLook.js';

// Saison de l'année (v0.70) : fixée par le rendu (this.season) ; null : ambiance d'origine.
const LEAF_TONES = {
  summer: ['#9aa33a', '#c9b04a'],
  autumn: ['#c4612a', '#d9822f', '#a83d22', '#d6a52f'],
  spring: ['#5e9a3e', '#78b64e'],
};

// Ambiance du Centre, même sans combattant — présentation seulement.
//   vent       balancement des arbres, buissons et herbes (sway)
//   fumée      feux de camp (le feu du Banquet et celui de la cour)
//   lieux      ambiance propre à chaque lieu (idleAnimation de data/centreVisuals.js) :
//              feuilles en Forêt, reflets et poissons à la Rivière, brins de paille au Tas de foin…
//   lumière    poussière dorée qui flotte dans la cour
//   oiseaux    un vol de temps en temps (pas en permanence), en coordonnées d'écran
//
// Les gerbes (gestes des combattants, fumée…) sont gardées dans un réservoir plafonné
// (CENTRE_AMBIENCE.maxParticles) : les plus anciennes cèdent la place. Effets désactivés
// dans les Options : aucune particule, aucun oiseau ; le vent et l'eau restent (décor).

const SWAYING = new Set(['tree', 'bush', 'tuft', 'flowers']);
const AVERAGE_BURST = 4; // particules par gerbe, en moyenne (pour le plafond)
const tileCenter = (prop) => ({ x: prop.x + (prop.w ?? 1) / 2, y: prop.y + (prop.h ?? 1) / 2 });

// Ambiance de chaque lieu, même vide : gerbes régulières { every (s), particle, at() → point }.
const PLACE_AMBIENCE = {
  banquet: () => [],
  lice: (activity, rng) => [{ every: 4.5, particle: 'dust', at: () => ({ x: activity.area.x + 0.6 + rng() * (activity.area.w - 1.2), y: activity.area.y + 0.6 + rng() * (activity.area.h - 1.2) }) }],
  dummies: () => [],
  hay: (activity, rng, props) => {
    const bales = props.filter((p) => p.type === 'hay');
    return bales.length ? [{ every: 3.2, particle: 'straw', at: () => tileCenter(bales[Math.floor(rng() * bales.length)]) }] : [];
  },
  forest: () => [],
  river: (activity, rng, props) => {
    const water = props.find((p) => p.type === 'water');
    // Un poisson saute de temps en temps.
    return water ? [{ every: 6.5, particle: 'splash', kind: 'water', at: () => ({ x: water.x + 0.3 + rng() * (water.w - 0.6), y: Math.max(activity.area.y, water.y) + 0.3 + rng() * (Math.min(activity.area.h, water.h) - 0.6) }) }] : [];
  },
};

export class CentreAmbience {
  constructor(scene, { visuals = ACTIVITY_VISUALS, ambience = CENTRE_AMBIENCE, particles = CENTRE_PARTICLES } = {}) {
    this.scene = scene;
    this.config = ambience;
    this.defs = particles;
    this.bursts = [];
    this.leaves = [];
    this.counter = 0;
    this.rng = createRng('centre-ambience');
    this.emitters = [];
    this.lastTick = new Map();

    const propById = new Map(scene.props.filter((p) => p.id).map((p) => [p.id, p]));
    // Fumée des feux de camp.
    for (const prop of scene.props.filter((p) => p.type === 'campfire')) {
      this.emitters.push({ every: 0.75, particle: 'smoke', kind: 'fire', at: () => ({ x: prop.x + 0.5, y: prop.y + 0.5 }) });
    }
    for (const activity of scene.activities) {
      const visual = visuals[activity.id];
      if (!visual) continue;
      const props = scene.props.filter((p) => p.owner === activity.id);
      this.emitters.push(...(PLACE_AMBIENCE[visual.idleAnimation]?.(activity, this.rng, props) ?? []));
      for (const fx of visual.environmentVfx ?? []) {
        const [kind, propId] = fx.split(':');
        if (kind === 'smoke' && propById.get(propId)?.type !== 'campfire') {
          this.emitters.push({ every: 0.9, particle: 'smoke', at: () => tileCenter(propById.get(propId)) });
        }
      }
    }
    // Arbres d'où tombent les feuilles : ceux de la Forêt d'abord, sinon ceux de la lisière.
    const forestTrees = scene.props.filter((p) => p.type === 'tree' && visuals[p.owner]?.environmentVfx?.includes('leaves'));
    this.leafTrees = forestTrees.length ? forestTrees : scene.props.filter((p) => p.type === 'tree');
  }

  /** Feux de camp éteints (hiver, data/climate.js fireOut) ? */
  get firesOut() {
    return Boolean(CLIMATE_SEASONS.find((season) => season.id === this.season)?.fireOut);
  }

  /** Effets activés (Options) ? */
  get enabled() {
    return getVfxLevel().count > 0;
  }

  /** Gerbe de particules (data/centreVisuals.js CENTRE_PARTICLES) au point (x, y), hauteur z. */
  spawn(particleId, at, time, { z = 0, dirX = 0, dirY = 0 } = {}) {
    const def = this.defs[particleId];
    if (!def || !at || !this.enabled) return null;
    this.counter += 1;
    const burst = { def, z, start: time, emitter: { x: at.x, y: at.y, dirX, dirY, damage: 0, seed: `centre:${particleId}:${this.counter}` } };
    this.bursts.push(burst);
    const cap = Math.max(4, Math.floor(this.config.maxParticles / AVERAGE_BURST));
    if (this.bursts.length > cap) this.bursts.splice(0, this.bursts.length - cap);
    return burst;
  }

  /** Avance l'ambiance : gerbes régulières des lieux et des feux, feuilles qui tombent. */
  update(time) {
    if (!this.enabled) {
      this.bursts.length = 0;
      this.leaves.length = 0;
      return;
    }
    this.emitters.forEach((emitter, i) => {
      const tick = Math.floor(time / emitter.every);
      const last = this.lastTick.get(i);
      this.lastTick.set(i, tick);
      if (last === undefined || last === tick) return;
      // Saison : feux éteints en hiver (pas de fumée) ; pas de poisson dans un lit sec ou une eau froide.
      if (emitter.kind === 'fire' && this.firesOut) return;
      if (emitter.kind === 'water' && seasonVisuals(this.season) && seasonVisuals(this.season).water !== 'normal') return;
      this.spawn(emitter.particle, emitter.at(), time);
    });

    const leaves = this.config.leaves;
    const tick = Math.floor(time / (leaves.fall / leaves.count));
    // Hiver : aucune feuille ne tombe (arbres enneigés) ; sinon, aux couleurs de la saison.
    const tones = LEAF_TONES[this.season];
    if (this.leafTick !== undefined && tick !== this.leafTick && this.leafTrees.length && this.season !== 'winter') {
      const tree = this.leafTrees[Math.floor(this.rng() * this.leafTrees.length)];
      const color = tones ? tones[Math.floor(this.rng() * tones.length)] : this.rng() < 0.3 ? '#d9a23a' : '#5e9a3e';
      this.leaves.push({ x: tree.x + 0.3 + this.rng() * 0.4, y: tree.y + 0.3 + this.rng() * 0.4, start: time, seed: this.rng() * 10, color });
      if (this.leaves.length > leaves.count) this.leaves.shift();
    }
    this.leafTick = tick;

    this.bursts = this.bursts.filter((b) => time - b.start <= b.def.life);
    this.leaves = this.leaves.filter((leaf) => time - leaf.start <= leaves.fall);
  }

  /** Particules à dessiner (couche 'over'), plafonnées. */
  particles(time) {
    if (!this.enabled) return [];
    const level = getVfxLevel();
    const out = [];
    for (const burst of this.bursts) {
      out.push(...burstParticles(burst.emitter, time - burst.start, burst.def, level, { heightOffset: burst.z }));
    }
    const fall = this.config.leaves.fall;
    for (const leaf of this.leaves) {
      const age = time - leaf.start;
      const t = age / fall;
      // Une feuille tombe en zigzag, poussée par le vent.
      out.push({
        shape: 'puff', layer: 'over', size: 0.022, color: leaf.color, outline: 'rgba(30, 50, 20, 0.5)',
        x: leaf.x + Math.sin(age * 2.1 + leaf.seed) * 0.25 + t * 0.6, y: leaf.y + t * 0.3,
        z: Math.max(0, 1.05 * (1 - t * 1.3)), alpha: t < 0.85 ? 0.95 : (1 - t) / 0.15 * 0.95,
      });
    }
    // Météo de la saison (flocons, feuilles, pétales, poussière) sur toute la scène.
    if (this.season && this.weatherArea) out.push(...seasonWeatherParticles(this.season, time, this.weatherArea, level.count));
    // Poussière dorée dans la lumière, au-dessus de la cour (ni en hiver ni par temps humide).
    const center = this.scene.layout.restCenter;
    const motes = this.season === 'winter' || this.season === 'autumn' ? 0 : this.config.motes.count;
    for (let i = 0; i < Math.round(motes * level.count); i++) {
      const s = i * 1.37;
      const life = (time * 0.12 + i / this.config.motes.count) % 1;
      out.push({
        shape: 'puff', layer: 'over', size: 0.012, color: '#fff3c4', outline: null,
        x: center.x - 2 + ((i * 7.3) % 4) + Math.sin(time * 0.4 + s) * 0.3, y: center.y - 2 + ((i * 3.1) % 4),
        z: 0.15 + life * 0.9, alpha: Math.sin(life * Math.PI) * 0.6,
      });
    }
    return out.length > this.config.maxParticles ? out.slice(out.length - this.config.maxParticles) : out;
  }

  /** Balancement d'un décor au vent : { skew } (pieds immobiles), ou null s'il ne bouge pas. */
  sway(prop, time) {
    if (!SWAYING.has(prop.type)) return null;
    const { strength, speed, gust } = this.config.wind;
    const base = Math.sin(time * speed + prop.x * 0.7 + prop.y * 0.4);
    const gusts = gust * Math.max(0, Math.sin(time * 0.27 + prop.x * 0.15)) * Math.sin(time * 3.1 + prop.y);
    const k = prop.type === 'tree' ? 1 : prop.type === 'bush' ? 0.6 : 1.4;
    return { skew: strength * k * (base + gusts) };
  }

  /**
   * Vol d'oiseaux en cours (coordonnées d'écran, fractions de la largeur et de la hauteur) :
   * [{ x, y, flap, size }] ; vide la plupart du temps. Déterministe : une fenêtre tous les
   * `every` secondes, tirée au sort.
   */
  birds(time) {
    if (!this.enabled) return [];
    const { every, chance, duration, count } = this.config.birds;
    const window = Math.floor(time / every);
    const rng = createRng(`birds:${window}`);
    if (rng() > chance) return [];
    const age = time - window * every - rng() * (every - duration);
    if (age < 0 || age > duration) return [];
    const n = count[0] + Math.floor(rng() * (count[1] - count[0] + 1));
    const fromLeft = rng() < 0.5;
    const y0 = 0.08 + rng() * 0.22;
    const t = age / duration;
    const out = [];
    for (let i = 0; i < n; i++) {
      // Formation en V, de gauche à droite (ou l'inverse).
      const rank = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
      const lead = -0.15 + t * 1.3 - Math.abs(rank) * 0.025;
      out.push({
        x: fromLeft ? lead : 1 - lead, y: y0 + rank * 0.025 + Math.sin(t * 6 + i) * 0.006 - t * 0.05,
        flap: Math.sin(time * 11 + i * 1.7), size: 0.9 + ((i * 37) % 5) * 0.06, dir: fromLeft ? 1 : -1,
      });
    }
    return out;
  }
}
