import { h } from '../../utils/dom.js';
import { assetUrl } from '../../utils/assets.js';
import { ARENAS, DEFAULT_ARENA_ID } from '../../data/arenas.js';
import { BOROUGH_ARTISANS } from '../../data/borough.js';
import { COMBAT_RULES } from '../../data/combatRules.js';
import { getItemDefinition } from '../../data/items.js';
import { RATING_CONFIG } from '../../data/ratings.js';
import { SPECIALTIES, SPECIALTY_IDS } from '../../data/specialties.js';
import { getSpriteAsset } from '../../data/sprites.js';
import { getStatDefinition } from '../../data/stats.js';
import { spectatorUrl } from '../../render/spectators.js';
import { getSpectatorSprite } from '../../data/spectators.js';
import { ClassRoles } from '../components/ClassRoles.js';
import { FighterStars } from '../components/Rating.js';

// Illustrations de l'Almanach : { kind, … } → élément. Elles réutilisent les images du jeu
// (sprites, artisans, objets) ou sont dessinées d'après les règles (jauge, lice). Pour en
// ajouter une : une entrée dans ILLUSTRATIONS ; les articles s'y réfèrent par `kind`.
// Une illustration inconnue n'affiche rien (l'article reste lisible).

const svg = (markup, className) => {
  const host = h('div', { class: `almanac-svg ${className}`.trim() });
  host.innerHTML = markup;
  return host;
};

const fighterImage = (classId, variant = 1) => h('img', {
  class: 'almanac-fighter', src: assetUrl(getSpriteAsset(`${classId}_0${variant}`)), alt: SPECIALTIES[classId]?.name ?? '', width: 64, height: 96,
});

/** Jauge de fatigue : 0 (frais) → max (épuisé), seuil du malus marqué. */
function fatigueGauge() {
  const max = getStatDefinition('fatigue').max;
  const { threshold, perPoint } = COMBAT_RULES.fatigueDamage;
  const zero = Math.min(max, threshold + Math.round(1 / perPoint));
  const W = 320;
  const x = (v) => 14 + (v / max) * (W - 28);
  return svg(`<svg viewBox="0 0 ${W} 74" role="img" aria-label="Fatigue de 0 à ${max}, malus au-delà de ${threshold}">
    <defs><linearGradient id="alm-fat" x1="0" x2="1">
      <stop offset="0" stop-color="#5c8f3c"/><stop offset="${threshold / max}" stop-color="#c9a227"/><stop offset="1" stop-color="#9a2b1f"/>
    </linearGradient></defs>
    <rect x="14" y="22" width="${W - 28}" height="14" rx="7" fill="url(#alm-fat)" stroke="#5c4326" stroke-width="1.5"/>
    <line x1="${x(threshold)}" y1="14" x2="${x(threshold)}" y2="44" stroke="#2a1d10" stroke-width="2" stroke-dasharray="3 2"/>
    <text x="${x(threshold)}" y="10" class="alm-small" text-anchor="middle">malus au-delà de ${threshold}</text>
    <text x="14" y="58" class="alm-label">0 · frais</text>
    <text x="${x(zero) - 2}" y="58" class="alm-label" text-anchor="end">${max} · épuisé</text>
    <text x="${(x(threshold) + x(zero)) / 2}" y="70" class="alm-small" text-anchor="middle">−${Math.round(perPoint * 100)} % de dégâts par point</text>
  </svg>`, 'almanac-gauge');
}

/** Plan de la lice : grille, zones de placement des deux camps. */
function liceMap() {
  const arena = ARENAS[DEFAULT_ARENA_ID];
  const s = 20;
  const W = arena.width * s;
  const H = arena.height * s;
  const zone = (area, fill, stroke) => `<rect x="${area.x * s}" y="${area.y * s}" width="${area.w * s}" height="${area.h * s}" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-dasharray="5 3"/>`;
  let grid = '';
  for (let i = 1; i < arena.width; i++) grid += `<line x1="${i * s}" y1="0" x2="${i * s}" y2="${H}"/>`;
  for (let j = 1; j < arena.height; j++) grid += `<line x1="0" y1="${j * s}" x2="${W}" y2="${j * s}"/>`;
  return svg(`<svg viewBox="-6 -6 ${W + 12} ${H + 30}" role="img" aria-label="La lice : ${arena.width} cases sur ${arena.height}">
    <rect x="0" y="0" width="${W}" height="${H}" fill="#e3cf9f" stroke="#5c4326" stroke-width="2"/>
    ${zone(arena.sides[0].area, 'rgba(47,94,160,0.22)', '#2f5ea0')}
    ${zone(arena.sides[1].area, 'rgba(160,47,47,0.22)', '#a02f2f')}
    <g stroke="rgba(92,67,38,0.25)" stroke-width="1">${grid}</g>
    <text x="${(arena.sides[0].area.x + arena.sides[0].area.w / 2) * s}" y="${H + 18}" class="alm-label" text-anchor="middle" fill="#2f5ea0">Vous</text>
    <text x="${(arena.sides[1].area.x + arena.sides[1].area.w / 2) * s}" y="${H + 18}" class="alm-label" text-anchor="middle" fill="#a02f2f">Adversaire</text>
  </svg>`, 'almanac-lice');
}

/** Quelques niveaux d'étoiles, du débutant au champion (aucune valeur chiffrée). */
function starsScale() {
  const levelFor = (stars) => RATING_CONFIG.starScale.find((band) => band.stars === stars)?.max ?? 0;
  return h('div', { class: 'almanac-stars' }, [1, 2, 3.5, 5].map((stars) => h('div', { class: 'almanac-stars-row' },
    FighterStars(levelFor(stars)),
    h('span', { class: 'almanac-stars-label' }, stars <= 1 ? 'débutant' : stars <= 2 ? 'aguerri' : stars < 5 ? 'redoutable' : 'légende'))));
}

export const ILLUSTRATIONS = Object.freeze({
  fighter: ({ classId, variant }) => fighterImage(classId, variant),
  classTrio: () => h('div', { class: 'almanac-trio' }, SPECIALTY_IDS.map((id, i) => h('figure', { class: 'almanac-trio-item' },
    fighterImage(id, (i % 4) + 1), h('figcaption', {}, `${SPECIALTIES[id].icon} ${SPECIALTIES[id].name}`)))),
  classRoles: () => ClassRoles({ compact: true }),
  fatigueGauge,
  liceMap,
  stars: starsScale,
  // Artisan du Bourg, ou tout autre personnage du jeu portant ce nom (ex. le tavernier).
  artisan: ({ artisanId }) => {
    const artisan = BOROUGH_ARTISANS.find((a) => a.id === artisanId);
    const spriteId = artisan?.spriteId ?? (getSpectatorSprite(`artisan_${artisanId}`) ? `artisan_${artisanId}` : null);
    return spriteId ? h('img', { class: 'almanac-portrait', src: spectatorUrl(spriteId), alt: artisan?.name ?? '', width: 56, height: 90 }) : null;
  },
  item: ({ itemId }) => {
    const item = getItemDefinition(itemId);
    return item ? h('img', { class: 'almanac-item', src: assetUrl(item.sprite), alt: item.name, width: 56, height: 56 }) : null;
  },
  vignette: ({ name }) => h('img', { class: 'almanac-vignette-img', src: assetUrl(`assets/almanac/${name}.svg`), alt: '', width: 160, height: 100 }),
  icon: ({ glyph }) => h('span', { class: 'almanac-icon-big', 'aria-hidden': 'true' }, glyph),
});

/** Élément d'une illustration, ou null si elle est inconnue. */
export function renderIllustration(illustration) {
  if (!illustration) return null;
  const render = ILLUSTRATIONS[illustration.kind];
  return render ? render(illustration) : null;
}
