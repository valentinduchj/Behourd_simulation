import { SPECTATOR_SPRITES, QUEEN_SPRITE, ARTISAN_SPRITES, SCRIPTORIUM_SPRITES, TRAINING_SPRITES, getSpectatorSprite } from '../data/spectators.js';
import { assetUrl } from '../utils/assets.js';

// Dessin des spectateurs (images partagées, chargées une seule fois).
const images = new Map();

function getImage(spriteId, view) {
  const key = `${spriteId}:${view}`;
  if (!images.has(key)) {
    const sprite = getSpectatorSprite(spriteId) ?? SPECTATOR_SPRITES[0];
    const image = new Image();
    image.src = assetUrl(sprite.files[view] ?? sprite.files.front);
    images.set(key, image);
  }
  return images.get(key);
}

/** Adresse de l'image d'un personnage (spectateur, Reine, artisan). */
export function spectatorUrl(spriteId, view = 'front') {
  const sprite = getSpectatorSprite(spriteId) ?? SPECTATOR_SPRITES[0];
  return assetUrl(sprite.files[view] ?? sprite.files.front);
}

export function preloadSpectators() {
  for (const sprite of SPECTATOR_SPRITES) for (const view of ['front', 'back']) getImage(sprite.id, view);
  getImage(QUEEN_SPRITE.id, 'front');
  for (const sprite of [...ARTISAN_SPRITES, ...SCRIPTORIUM_SPRITES, ...TRAINING_SPRITES]) getImage(sprite.id, 'front');
}

/**
 * Dessine un spectateur, les pieds en (x, y). `view` : 'front' | 'back' ; `flip` : miroir
 * horizontal ; `excitement` (0 à 1) : amplitude des sautillements.
 * `pose` (facultatif) : mêmes gestes que les combattants du Centre (centre/animation/
 * fighterAnimations.js) — { dx, dy, rotate (autour des pieds), scaleY, flip (miroir en plus) },
 * en fractions de la hauteur ; le léger balancement habituel est alors remplacé par la pose.
 */
export function drawSpectator(ctx, x, y, { spriteId, view = 'front', flip = false, height, time = 0, phase = 0, excitement = 0, pose = null }) {
  const image = getImage(spriteId, view);
  if (!(image.complete && image.naturalWidth > 0)) return;
  const width = height * (image.naturalWidth / image.naturalHeight);
  const sway = Math.sin(time * 1.6 + phase) * height * 0.012;
  const hop = Math.max(0, Math.sin(time * 5 + phase * 3)) * height * 0.05 * excitement;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.ellipse(x + (pose?.dx ?? 0) * height, y, width * 0.32, width * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();

  if (pose) {
    ctx.save();
    ctx.translate(x + (pose.dx ?? 0) * height, y + (pose.dy ?? 0) * height - hop);
    ctx.rotate(pose.rotate ?? 0);
    ctx.scale(flip !== Boolean(pose.flip) ? -1 : 1, pose.scaleY ?? 1);
    ctx.drawImage(image, -width / 2, -height, width, height);
    ctx.restore();
    return;
  }

  if (flip) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(image, -width / 2 + sway, y - height - hop, width, height);
    ctx.restore();
  } else {
    ctx.drawImage(image, x - width / 2 + sway, y - height - hop, width, height);
  }
}
