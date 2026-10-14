import { hashString } from '../utils/random.js';
import { CLIMATE_VISUALS, SNOW_COLOR, WATER_LOOKS } from '../data/climateVisuals.js';
import { fromHsl, mixColors, toHsl } from './color.js';

// Habillage saisonnier des environnements (v0.70) — présentation seulement. Une vue (IsoView)
// porte sa saison dans `view.season` ('summer' | 'autumn' | 'winter' | 'spring', ou null : aspect
// d'origine) ; Le Centre, Le Bourg et les lices la reçoivent, jamais la Taverne ni le Scriptorium.
// Tout est déterministe (même case → même détail) : rien ne clignote d'une image à l'autre.

const cache = new Map();
const hueMix = (from, to, t) => {
  const d = ((((to - from) % 360) + 540) % 360) - 180;
  return from + d * t;
};

/** Habillage d'une saison (data/climateVisuals.js), ou null. */
export function seasonVisuals(seasonId) {
  return CLIMATE_VISUALS[seasonId] ?? null;
}

/** Couleur verte (herbe, feuillage) ? */
function isGreen({ h, s, l }) {
  return h >= 55 && h <= 175 && s > 0.12 && l > 0.1 && l < 0.88;
}

/**
 * Couleur d'un sol transformée par la saison. role : 'grass' | 'ground' | 'path' | 'arena' —
 * il règle la part de neige en hiver (l'arène reste lisible). Sans saison : couleur d'origine.
 */
export function seasonColor(hex, seasonId, role = 'ground') {
  const look = seasonVisuals(seasonId);
  if (!look || typeof hex !== 'string' || hex[0] !== '#') return hex;
  const key = `${seasonId}|${role}|${hex}`;
  if (cache.has(key)) return cache.get(key);
  const hsl = toHsl(hex);
  let out = hex;
  if (hsl) {
    const green = isGreen(hsl);
    const rule = green ? look.ground.green : look.ground.other;
    out = fromHsl({ h: hueMix(hsl.h, rule.hue, rule.hueMix), s: hsl.s * rule.sat, l: hsl.l + rule.light });
    if (look.snow) {
      const amount = green && role !== 'arena' ? look.snow.grass : look.snow[role] ?? look.snow.other;
      out = mixColors(out, SNOW_COLOR, amount);
    }
  }
  cache.set(key, out);
  return out;
}

/** Zone de sol d'une lice (data/liceDecorations.js) aux couleurs de la saison. */
export function seasonGroundZone(zone, seasonId, role) {
  if (!zone || !seasonVisuals(seasonId)) return zone;
  const tint = (c) => seasonColor(c, seasonId, role);
  return {
    ...zone,
    colors: (zone.colors ?? []).map(tint),
    grain: zone.grain ? tint(zone.grain) : zone.grain,
    stone: zone.stone ? tint(zone.stone) : zone.stone,
    joint: zone.joint ? tint(zone.joint) : zone.joint,
  };
}

/** Ciel d'une lice selon la saison (dégradé [haut, bas]). */
export function seasonSky(background, seasonId) {
  return seasonVisuals(seasonId)?.sky ?? background;
}

const noise = (x, y, salt) => hashString(`${salt}:${x},${y}`);
const at = (view, x, y, u, v) => view.toScreen(x + u, y + v);
const LEAF_COLORS = ['#c4612a', '#d9822f', '#a83d22', '#d6a52f', '#8f4a1c'];
const SPRING_FLOWERS = ['#f7f3ea', '#f4b6c8', '#f1d34a', '#b9a3e3'];

/**
 * Détail saisonnier d'une case de sol (après sa couleur) : fissures et paille sèche en été,
 * feuilles mortes et flaques en automne, congères scintillantes en hiver, pousses et fleurs
 * au printemps. kind : 'grass' | 'path' | 'ground'. Dessin léger, sans effet sur la lisibilité.
 */
export function drawSeasonTileDetail(view, x, y, seasonId, kind = 'grass') {
  const look = seasonVisuals(seasonId);
  if (!look) return;
  const chance = look.details[kind] ?? 0;
  const h = noise(x, y, `${seasonId}${kind}`);
  if ((h % 1000) / 1000 >= chance) return;
  const { ctx } = view;
  const s = view.tile.w;
  const pick = (i, n) => (h >> (i * 3)) % n;
  ctx.save();
  if (seasonId === 'autumn') {
    if (kind === 'path' && pick(1, 3) === 0) {
      // Flaque : ovale bleu-gris et son reflet.
      const c = at(view, x, y, 0.5, 0.5);
      ctx.fillStyle = 'rgba(96, 124, 140, 0.55)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, s * 0.2, s * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230, 240, 245, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(c.x - s * 0.04, c.y - s * 0.015, s * 0.08, s * 0.025, 0, Math.PI, Math.PI * 1.8);
      ctx.stroke();
    } else {
      // Feuilles mortes éparpillées.
      const count = 3 + pick(2, 4);
      for (let i = 0; i < count; i++) {
        const hh = noise(x * 7 + i, y * 5 - i, 'leaf');
        const p = at(view, x, y, 0.15 + (hh % 70) / 100, 0.15 + ((hh >> 7) % 70) / 100);
        ctx.fillStyle = LEAF_COLORS[hh % LEAF_COLORS.length];
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, s * 0.035, s * 0.018, ((hh >> 4) % 6) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (seasonId === 'summer') {
    // Fissures de sol sec et brins de paille.
    const a = at(view, x, y, 0.25 + pick(1, 3) * 0.1, 0.3);
    const b = at(view, x, y, 0.5, 0.55);
    const c = at(view, x, y, 0.72, 0.42 + pick(2, 3) * 0.08);
    ctx.strokeStyle = 'rgba(110, 84, 40, 0.45)';
    ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.stroke();
    if (kind === 'grass') {
      ctx.strokeStyle = 'rgba(214, 186, 104, 0.85)';
      for (let i = 0; i < 3; i++) {
        const p = at(view, x, y, 0.3 + i * 0.15, 0.62 - i * 0.05);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + s * 0.03, p.y - s * 0.06);
        ctx.stroke();
      }
    }
  } else if (seasonId === 'winter') {
    // Congères : petites bosses de neige ombrées de bleu, et une étincelle.
    const count = 1 + pick(1, 2);
    for (let i = 0; i < count; i++) {
      const hh = noise(x * 3 + i, y * 11 + i, 'drift');
      const p = at(view, x, y, 0.2 + (hh % 60) / 100, 0.2 + ((hh >> 6) % 60) / 100);
      ctx.fillStyle = 'rgba(160, 182, 204, 0.45)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + s * 0.012, s * 0.11, s * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s * 0.1, s * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const g = at(view, x, y, 0.6, 0.35);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(g.x, g.y, Math.max(1, s * 0.015), Math.max(1, s * 0.015));
  } else if (seasonId === 'spring') {
    // Pousses vertes et petites fleurs.
    ctx.strokeStyle = '#4f9a3a';
    ctx.lineWidth = Math.max(1, s * 0.014);
    const count = 2 + pick(1, 3);
    for (let i = 0; i < count; i++) {
      const hh = noise(x * 5 + i, y * 3 + i, 'sprout');
      const p = at(view, x, y, 0.2 + (hh % 60) / 100, 0.25 + ((hh >> 6) % 55) / 100);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - s * 0.012, p.y - s * 0.05);
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + s * 0.014, p.y - s * 0.045);
      ctx.stroke();
      if (hh % 2 === 0) {
        ctx.fillStyle = SPRING_FLOWERS[(hh >> 3) % SPRING_FLOWERS.length];
        ctx.beginPath();
        ctx.arc(p.x, p.y - s * 0.055, s * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

/** Aspect de l'eau selon la saison (data/climateVisuals.js WATER_LOOKS). */
export function seasonWater(seasonId) {
  return WATER_LOOKS[seasonVisuals(seasonId)?.water ?? 'normal'] ?? WATER_LOOKS.normal;
}

/**
 * Lit de rivière asséché (été) : fissures et galets ; eau froide (hiver) : plaques de glace
 * près des bords. Dessiné sur une case d'eau, après sa couleur.
 */
export function drawSeasonWaterDetail(view, x, y, seasonId) {
  const water = seasonWater(seasonId);
  const { ctx } = view;
  const s = view.tile.w;
  const h = noise(x, y, 'water');
  ctx.save();
  if (water.crack) {
    ctx.strokeStyle = water.crack;
    ctx.lineWidth = Math.max(1, s * 0.016);
    const a = at(view, x, y, 0.15, 0.3 + (h % 4) * 0.08);
    const b = at(view, x, y, 0.45, 0.5);
    const c = at(view, x, y, 0.85, 0.35 + ((h >> 3) % 4) * 0.08);
    const d = at(view, x, y, 0.5, 0.9);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(d.x, d.y);
    ctx.stroke();
    ctx.fillStyle = water.pebble;
    for (let i = 0; i < 3; i++) {
      const hh = noise(x + i * 13, y - i * 7, 'pebble');
      const p = at(view, x, y, 0.15 + (hh % 70) / 100, 0.15 + ((hh >> 7) % 70) / 100);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s * 0.04, s * 0.022, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (water.ice) {
    ctx.fillStyle = water.ice;
    ctx.globalAlpha = 0.85;
    const p = at(view, x, y, 0.25 + (h % 50) / 100, 0.3 + ((h >> 5) % 40) / 100);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s * (0.12 + (h % 3) * 0.03), s * 0.05, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Météo animée d'une saison, en coordonnées de grille, pour drawParticles : flocons en hiver,
 * feuilles en automne, pétales au printemps, poussière dorée en été. area : { x, y, w, h }
 * (zone couverte) ; density : 1 = normale (réglage des effets : level.count).
 */
export function seasonWeatherParticles(seasonId, time, area, density = 1) {
  const look = seasonVisuals(seasonId);
  if (!look || density <= 0) return [];
  const out = [];
  const kind = look.weather;
  const surface = Math.max(1, area.w * area.h);
  const base = kind === 'snow' ? 0.32 : kind === 'motes' ? 0.06 : 0.08;
  const count = Math.round(Math.min(160, surface * base) * density);
  const fall = kind === 'snow' ? 6 : kind === 'motes' ? 9 : 7;
  for (let i = 0; i < count; i++) {
    const seed = noise(i, count, kind);
    const phase = (seed % 1000) / 1000;
    const t = ((time / fall) + phase) % 1;
    const x0 = area.x + ((seed >> 3) % 1000) / 1000 * area.w;
    const y0 = area.y + ((seed >> 13) % 1000) / 1000 * area.h;
    const sway = Math.sin(time * (kind === 'snow' ? 0.9 : 1.6) + i) * (kind === 'snow' ? 0.15 : 0.3);
    if (kind === 'snow') {
      out.push({ shape: 'puff', layer: 'over', x: x0 + sway + t * 0.4, y: y0 + t * 0.2, z: 2.4 * (1 - t), size: 0.012 + (seed % 3) * 0.004, color: '#ffffff', outline: 'rgba(150, 172, 196, 0.55)', alpha: t < 0.9 ? 0.95 : (1 - t) * 9.5 });
    } else if (kind === 'leaves') {
      out.push({ shape: 'puff', layer: 'over', x: x0 + sway + t * 0.8, y: y0 + t * 0.3, z: 1.8 * (1 - t), size: 0.02, color: LEAF_COLORS[seed % LEAF_COLORS.length], outline: 'rgba(60, 30, 10, 0.5)', alpha: t < 0.85 ? 0.95 : (1 - t) / 0.15 * 0.95 });
    } else if (kind === 'petals') {
      out.push({ shape: 'puff', layer: 'over', x: x0 + sway + t * 0.6, y: y0 + t * 0.25, z: 1.6 * (1 - t), size: 0.014, color: seed % 3 ? '#f6c3d2' : '#fbf3ee', outline: 'rgba(170, 90, 120, 0.4)', alpha: t < 0.85 ? 0.9 : (1 - t) / 0.15 * 0.9 });
    } else {
      out.push({ shape: 'puff', layer: 'over', x: x0 + Math.sin(time * 0.4 + i) * 0.3, y: y0, z: 0.2 + t * 1.2, size: 0.011, color: '#fff1bf', outline: null, alpha: Math.sin(t * Math.PI) * 0.55 });
    }
  }
  return out;
}

/** Feuillage d'un arbre (3 étages) selon la saison ; variante fixe par arbre. null : d'origine. */
export function seasonFoliage(seasonId, prop) {
  const look = seasonVisuals(seasonId);
  if (!look) return null;
  const variants = look.foliage;
  return variants[hashString(`tree:${prop.x},${prop.y}`) % variants.length];
}

/** L'arbre fleurit-il (printemps) ? Fixe par arbre. */
export function treeBlossoms(seasonId, prop) {
  const chance = seasonVisuals(seasonId)?.blossom ?? 0;
  return chance > 0 && (hashString(`blossom:${prop.x},${prop.y}`) % 100) / 100 < chance;
}

/** Calotte de neige : triangle depuis un sommet vers deux points (part `t` de chaque côté). */
export function drawSnowCap(view, peak, a, b, t = 0.35) {
  const { ctx } = view;
  const pa = { x: peak.x + (a.x - peak.x) * t, y: peak.y + (a.y - peak.y) * t };
  const pb = { x: peak.x + (b.x - peak.x) * t, y: peak.y + (b.y - peak.y) * t };
  ctx.beginPath();
  ctx.moveTo(peak.x, peak.y);
  ctx.lineTo(pa.x, pa.y);
  // Bord inférieur ondulé.
  const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 + view.tile.w * 0.02 };
  ctx.quadraticCurveTo(mid.x, mid.y + view.tile.w * 0.03, pb.x, pb.y);
  ctx.closePath();
  ctx.fillStyle = SNOW_COLOR;
  ctx.fill();
}

export { SNOW_COLOR };
