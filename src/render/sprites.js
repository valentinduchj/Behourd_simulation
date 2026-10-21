import { FIGHTER_SPRITES, DEFAULT_ANIMATION, CLUB_COLOR_ATTRIBUTE, getSpriteAsset } from '../data/sprites.js';
import { assetUrl } from '../utils/assets.js';
import { GAME_CONFIG } from '../config/gameConfig.js';
import { drawFigure, drawLabel } from './figures.js';

// Images des sprites pour le canvas et l'interface (chargées une seule fois, partagées), par
// variante et par animation. Seule l'animation « idle » existe pour l'instant (data/sprites.js).
//
// Couleurs du club (tabard) : sprite de base + zones marquées data-club-color + couleurs du
// club = image recolorée, produite à la volée et gardée en mémoire (aucun fichier par club).
// Tant que le fichier source n'est pas lu, le sprite de base s'affiche.
const images = new Map();
const sources = new Map(); // `${spriteId}:${animation}` → { text, promise }
const tinted = new Map();  // `${spriteId}:${animation}:${couleurs}` → { url, image }

// La version du jeu est ajoutée à l'adresse : un navigateur ne peut pas garder une ancienne
// copie d'un sprite (ex. sans zone de tabard) après une mise à jour.
export function spriteUrl(spriteId, animation = DEFAULT_ANIMATION) {
  return `${assetUrl(getSpriteAsset(spriteId, animation))}?v=${GAME_CONFIG.version}`;
}

function baseImage(spriteId, animation) {
  const key = `${spriteId}:${animation}`;
  if (!images.has(key)) {
    const image = new Image();
    image.src = spriteUrl(spriteId, animation);
    images.set(key, image);
  }
  return images.get(key);
}

/** Lit (une fois) le SVG d'un sprite, pour pouvoir le recolorer. */
export function loadSpriteSource(spriteId, animation = DEFAULT_ANIMATION) {
  const key = `${spriteId}:${animation}`;
  if (!sources.has(key)) {
    const entry = { text: null, promise: null };
    entry.promise = fetch(spriteUrl(spriteId, animation), { cache: 'no-cache' })
      .then((response) => (response.ok ? response.text() : null))
      .then((text) => { entry.text = text; return text; })
      .catch(() => null);
    sources.set(key, entry);
  }
  return sources.get(key).promise;
}

/**
 * Applique les couleurs d'un club au texte SVG d'un sprite : chaque zone marquée
 * data-club-color="<emplacement>" prend colors[emplacement] ; le reste du dessin est intact.
 */
export function applyClubColors(svgText, colors) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  for (const element of doc.querySelectorAll(`[${CLUB_COLOR_ATTRIBUTE}]`)) {
    const color = colors?.[element.getAttribute(CLUB_COLOR_ATTRIBUTE)];
    if (color) element.setAttribute('fill', color);
  }
  return new XMLSerializer().serializeToString(doc);
}

const colorsKey = (colors) => Object.keys(colors).sort().map((slot) => `${slot}=${colors[slot]}`).join(',');

/**
 * Image d'un sprite aux couleurs d'un club (colors : couleurs résolues de l'emblème du club).
 * null tant que le fichier source n'est pas lu (le chargement est alors lancé).
 */
function tintedEntry(spriteId, animation, colors) {
  const key = `${spriteId}:${animation}:${colorsKey(colors)}`;
  if (tinted.has(key)) return tinted.get(key);
  const text = sources.get(`${spriteId}:${animation}`)?.text;
  if (!text) {
    loadSpriteSource(spriteId, animation);
    return null;
  }
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(applyClubColors(text, colors))}`;
  const image = new Image();
  image.src = url;
  const entry = { url, image };
  tinted.set(key, entry);
  return entry;
}

/** Adresse de l'image du sprite aux couleurs du club, ou null si elle n'est pas encore prête. */
export function getClubSpriteUrl(spriteId, colors, animation = DEFAULT_ANIMATION) {
  return colors ? tintedEntry(spriteId, animation, colors)?.url ?? null : null;
}

// Attente de l'image recolorée (v1.1.7) : sans elle, le tabard d'origine (rouge, bleu, vert…)
// s'affichait un instant avant de prendre les couleurs du club. Le sprite de base ne sert plus
// qu'en dernier recours, si l'image recolorée n'est toujours pas prête après ce délai.
const TINT_WAIT_MS = 2000;
const tintRequested = new Map(); // clé de l'image recolorée → premier instant demandé

/**
 * Image d'un sprite ; avec `colors`, aux couleurs du club dès qu'elle est prête. En attendant
 * (au plus TINT_WAIT_MS) : null — rien n'est dessiné plutôt qu'un tabard d'une autre couleur.
 */
export function getSpriteImage(spriteId, animation = DEFAULT_ANIMATION, colors = null) {
  if (!colors) return baseImage(spriteId, animation);
  const club = tintedEntry(spriteId, animation, colors)?.image;
  if (club && isReady(club)) return club;
  const key = `${spriteId}:${animation}:${colorsKey(colors)}`;
  const now = Date.now();
  if (!tintRequested.has(key)) tintRequested.set(key, now);
  return now - tintRequested.get(key) < TINT_WAIT_MS ? null : baseImage(spriteId, animation);
}

/** Couleurs du club d'un combattant (fighter.teamId → club → couleurs de l'emblème), ou null. */
export function getFighterClubColors(session, fighter) {
  return session?.getTeam(fighter?.teamId)?.emblem.resolvedColors() ?? null;
}

export function preloadSprites() {
  for (const sprite of FIGHTER_SPRITES) {
    baseImage(sprite.id, DEFAULT_ANIMATION);
    loadSpriteSource(sprite.id);
  }
}

const isReady = (image) => image.complete && image.naturalWidth > 0;

/**
 * Dessine un combattant par son sprite, les pieds en (x, y).
 * options : { spriteId, height, clubColors, ringColor, highlighted, label, time, phase, colorIntensity, fallback, pose }
 * `clubColors` : couleurs du club du combattant (tabard) ; null = couleurs d'origine du sprite.
 * `colorIntensity` (0 à 1) : saturation des couleurs du sprite (0 = noir et blanc).
 * `fallback` : options de drawFigure, utilisées tant que l'image n'est pas chargée.
 * `pose` (facultatif, animations du Centre) : transformation de l'image, en fractions de la hauteur :
 *   { dx, dy, rotate (radians, autour des pieds), skew, flip, scaleX, scaleY, bob (false = pas de
 *     respiration), sink (part du corps sous la ligne des pieds, coupée : nage), shadow (false = sans ombre) }
 */
export function drawSpriteFigure(ctx, x, y, { spriteId, animation = DEFAULT_ANIMATION, height, clubColors = null, ringColor = '#2a2016', highlighted = false, label = null, time = 0, phase = 0, colorIntensity = 1, fallback, pose = null }) {
  const image = getSpriteImage(spriteId, animation, clubColors);
  // Image recolorée pas encore prête : rien pendant un court instant (jamais l'autre tabard).
  if (!image) return;
  if (!isReady(image)) {
    drawFigure(ctx, x, y, { ...fallback, highlighted, label });
    return;
  }

  const width = height * (image.naturalWidth / image.naturalHeight);
  const bob = pose?.bob === false ? 0 : Math.sin(time * 2.2 + phase) * height * 0.012;

  // Ombre et anneau aux couleurs du club.
  if (pose?.shadow !== false) {
    ctx.beginPath();
    ctx.ellipse(x, y, width * 0.42, width * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fill();
    ctx.lineWidth = highlighted ? 3 : 2;
    ctx.strokeStyle = highlighted ? '#f0c419' : ringColor;
    ctx.stroke();
  } else if (highlighted) {
    ctx.beginPath();
    ctx.ellipse(x, y, width * 0.5, width * 0.24, 0, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f0c419';
    ctx.stroke();
  }

  const intensity = Math.max(0, Math.min(1, colorIntensity));
  if (intensity < 1) ctx.filter = `saturate(${intensity})`;
  if (pose) {
    const sink = Math.max(0, pose.sink ?? 0) * height;
    ctx.save();
    ctx.translate(x + (pose.dx ?? 0) * height, y + (pose.dy ?? 0) * height);
    if (sink > 0) {
      // Nage : seul le haut du corps dépasse de la ligne d'eau (les pieds).
      ctx.beginPath();
      ctx.rect(-width, -height * 1.6, width * 2, height * 1.6);
      ctx.clip();
    }
    if (pose.rotate) ctx.rotate(pose.rotate);
    if (pose.skew) ctx.transform(1, 0, pose.skew, 1, 0, 0);
    ctx.scale((pose.flip ? -1 : 1) * (pose.scaleX ?? 1), pose.scaleY ?? 1);
    ctx.drawImage(image, -width / 2, -height * 0.97 + bob + sink, width, height);
    ctx.restore();
  } else {
    ctx.drawImage(image, x - width / 2, y - height * 0.97 + bob, width, height);
  }
  ctx.filter = 'none';

  if (label) drawLabel(ctx, label, x, y - height * (1 - (pose?.sink ?? 0)) - 6, Math.max(12, height * 0.2));
}
