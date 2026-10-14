// Figurine de combattant (placeholder vectoriel en attendant les sprites),
// partagée par La Lice et le Centre.

const COLORS = {
  helmet: '#a9afb5',
  helmetStroke: '#4b5055',
  visor: '#1b1d20',
  legs: '#3a2d22',
  outline: '#1a120b',
  wood: '#6b4a2b',
};

// Décorations propres à chaque spécialité.
const SPECIALTY_DECORATORS = {
  hastier(ctx, x, top, s) {
    ctx.strokeStyle = COLORS.wood;
    ctx.lineWidth = Math.max(1.5, s * 0.14);
    ctx.beginPath();
    ctx.moveTo(x + s * 1.05, top + s * 2.4);
    ctx.lineTo(x + s * 1.05, top - s * 1.6);
    ctx.stroke();
    ctx.fillStyle = '#c8ccd0';
    ctx.beginPath();
    ctx.moveTo(x + s * 1.05, top - s * 2.3);
    ctx.lineTo(x + s * 1.35, top - s * 1.5);
    ctx.lineTo(x + s * 0.75, top - s * 1.5);
    ctx.closePath();
    ctx.fill();
  },
  runner(ctx, x, top, s) {
    // Bouclier rond léger.
    ctx.fillStyle = '#8a5bb0';
    ctx.beginPath();
    ctx.arc(x - s * 0.95, top + s * 0.9, s * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 1;
    ctx.stroke();
  },
  lutteur(ctx, x, top, s) {
    ctx.fillStyle = COLORS.wood;
    for (const dx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + dx * s * 0.95, top + s * 1.15, s * 0.26, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/**
 * Dessine un combattant debout, les pieds en (x, y).
 * options : { size, colors: { primary, secondary, tertiary }, specialtyId, time, phase,
 *             highlighted, ringColor, label }
 */
export function drawFigure(ctx, x, y, { size: s, colors, specialtyId, time = 0, phase = 0, highlighted = false, ringColor, label }) {
  const bob = Math.sin(time * 2.2 + phase) * s * 0.06;

  // Ombre et anneau.
  ctx.beginPath();
  ctx.ellipse(x, y, s * 1.35, s * 0.68, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fill();
  ctx.lineWidth = highlighted ? 3 : 1.6;
  ctx.strokeStyle = highlighted ? '#f0c419' : ringColor ?? colors.primary;
  ctx.stroke();

  // Jambes.
  ctx.fillStyle = COLORS.legs;
  ctx.fillRect(x - s * 0.5, y - s * 1.1, s * 0.38, s * 1.1);
  ctx.fillRect(x + s * 0.12, y - s * 1.1, s * 0.38, s * 1.1);

  // Corps (tabard aux couleurs de l'équipe).
  const bodyW = s * 1.5;
  const bodyH = s * 1.7;
  const top = y - s * 2.6 + bob;
  roundRect(ctx, x - bodyW / 2, top, bodyW, bodyH, s * 0.3);
  ctx.fillStyle = colors.primary;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = COLORS.outline;
  ctx.stroke();
  ctx.fillStyle = colors.secondary;
  ctx.fillRect(x - s * 0.2, top, s * 0.4, bodyH);
  ctx.fillStyle = colors.tertiary;
  ctx.fillRect(x - bodyW / 2, top + bodyH * 0.62, bodyW, s * 0.22);

  // Heaume.
  const helmetTop = top - s * 1.25;
  roundRect(ctx, x - s * 0.55, helmetTop, s * 1.1, s * 1.2, s * 0.35);
  ctx.fillStyle = COLORS.helmet;
  ctx.fill();
  ctx.strokeStyle = COLORS.helmetStroke;
  ctx.stroke();
  ctx.fillStyle = COLORS.visor;
  ctx.fillRect(x - s * 0.4, helmetTop + s * 0.45, s * 0.8, s * 0.14);

  SPECIALTY_DECORATORS[specialtyId]?.(ctx, x, top, s, time, phase);

  if (label) drawLabel(ctx, label, x, helmetTop - s * 0.5, Math.max(12, s * 0.95));
}

/** Texte lisible sur n'importe quel fond (contour sombre). */
export function drawLabel(ctx, text, x, y, fontSize = 13, { color = '#fff6e0' } = {}) {
  ctx.font = `600 ${fontSize}px "EB Garamond", Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
