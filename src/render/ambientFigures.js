import { roundRect } from './figures.js';

// Petits dessins d'ambiance communs aux cartes (Centre, Bourg, Château de Gabarnac).

/** Bulle de discussion (« … ») au-dessus d'un habitant ; `unit` : taille de référence (px). */
export function drawChatBubble(ctx, x, y, { unit, time = 0 }) {
  const s = Math.max(10, unit);
  const bob = Math.sin(time * 4) * 1.5;
  roundRect(ctx, x - s, y - s * 0.9 + bob, s * 2, s * 0.9, s * 0.35);
  ctx.fillStyle = 'rgba(255, 252, 242, 0.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 40, 20, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#5f4e38';
  for (let i = 0; i < 3; i++) {
    const on = Math.floor(time * 3) % 4 > i;
    ctx.globalAlpha = on ? 1 : 0.3;
    ctx.beginPath();
    ctx.arc(x - s * 0.45 + i * s * 0.45, y - s * 0.45 + bob, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Vol d'oiseaux de passage, en coordonnées d'écran (fractions de la vue) : [{ x, y, flap, size }]
 * (CentreAmbience.birds). view : IsoView (ctx, view.w, view.h).
 */
export function drawFlyingBirds(view, birds, color) {
  if (!birds.length) return;
  const { ctx } = view;
  const unit = Math.max(5, view.view.w * 0.008);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, unit * 0.28);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const bird of birds) {
    const x = bird.x * view.view.w;
    const y = bird.y * view.view.h;
    const s = unit * bird.size;
    const wing = s * (0.15 + 0.55 * (bird.flap * 0.5 + 0.5));
    ctx.beginPath();
    ctx.moveTo(x - s, y - wing);
    ctx.quadraticCurveTo(x - s * 0.4, y - wing * 0.3, x, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - wing * 0.3, x + s, y - wing);
    ctx.stroke();
  }
  ctx.restore();
}
