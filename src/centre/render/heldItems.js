// Objets tenus par les combattants du Centre (présentation) : dessinés au trait, centrés sur
// la main, à la taille `size` (px). Ajouter un objet : une fonction ici, puis son `kind` dans
// l'animation (centre/animation/fighterAnimations.js).

export const HELD_ITEMS = {
  /** Pilon de volaille (Banquet). */
  food(ctx, size) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3a2412';
    ctx.lineWidth = Math.max(1, size * 0.06);
    // Os.
    ctx.fillStyle = '#f4ecd8';
    ctx.beginPath();
    ctx.rect(-size * 0.42, -size * 0.06, size * 0.4, size * 0.12);
    ctx.fill();
    ctx.stroke();
    for (const dy of [-0.08, 0.08]) {
      ctx.beginPath();
      ctx.arc(-size * 0.44, size * dy, size * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // Chair dorée.
    ctx.fillStyle = '#b8652b';
    ctx.beginPath();
    ctx.ellipse(size * 0.12, 0, size * 0.32, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 220, 160, 0.6)';
    ctx.beginPath();
    ctx.ellipse(size * 0.06, -size * 0.08, size * 0.14, size * 0.06, -0.3, 0, Math.PI * 2);
    ctx.fill();
  },

  /** Hache de bûcheron (Forêt) : le manche part de la main, le fer en haut. */
  axe(ctx, size) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3a2412';
    ctx.lineWidth = Math.max(2, size * 0.13);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.35);
    ctx.lineTo(0, -size * 0.6);
    ctx.stroke();
    ctx.strokeStyle = '#8a5a2e';
    ctx.lineWidth = Math.max(1, size * 0.07);
    ctx.stroke();
    ctx.fillStyle = '#c9ced3';
    ctx.strokeStyle = '#2a2a2e';
    ctx.lineWidth = Math.max(1, size * 0.05);
    ctx.beginPath();
    ctx.moveTo(-size * 0.03, -size * 0.58);
    ctx.lineTo(size * 0.32, -size * 0.72);
    ctx.quadraticCurveTo(size * 0.4, -size * 0.5, size * 0.32, -size * 0.3);
    ctx.lineTo(-size * 0.03, -size * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  },

  /** Rabot du Menuisier (Bourg) : semelle de bois, poignée, fer qui dépasse. */
  plane(ctx, size) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#3a2412';
    ctx.lineWidth = Math.max(1, size * 0.05);
    ctx.fillStyle = '#b07a3e';
    ctx.beginPath();
    ctx.rect(-size * 0.42, -size * 0.1, size * 0.84, size * 0.2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8a5a2e';
    ctx.beginPath();
    ctx.ellipse(-size * 0.18, -size * 0.18, size * 0.12, size * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c9ced3';
    ctx.beginPath();
    ctx.moveTo(size * 0.06, -size * 0.1);
    ctx.lineTo(size * 0.18, -size * 0.3);
    ctx.lineTo(size * 0.26, -size * 0.3);
    ctx.lineTo(size * 0.14, -size * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  },

  /** Plume d'oie du Sénéchal (Bourg) : tuyau sombre, barbes claires. */
  quill(ctx, size) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2a2016';
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.3);
    ctx.lineTo(size * 0.1, -size * 0.5);
    ctx.stroke();
    ctx.fillStyle = '#f4f0e6';
    ctx.strokeStyle = 'rgba(60, 45, 30, 0.6)';
    ctx.beginPath();
    ctx.moveTo(size * 0.03, size * 0.05);
    ctx.quadraticCurveTo(size * 0.32, -size * 0.2, size * 0.12, -size * 0.55);
    ctx.quadraticCurveTo(-size * 0.08, -size * 0.2, size * 0.03, size * 0.05);
    ctx.fill();
    ctx.stroke();
  },

  /** Livre ouvert (Scriptorium) : reliure (`item.cover`, rouge par défaut), deux pages, lignes d'écriture. */
  book(ctx, size, item = {}) {
    ctx.lineJoin = 'round';
    ctx.fillStyle = item.cover ?? '#6d1f1f';
    ctx.strokeStyle = '#2a1408';
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.beginPath();
    ctx.rect(-size * 0.47, -size * 0.31, size * 0.94, size * 0.6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f4ecd8';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -size * 0.2);
      ctx.quadraticCurveTo(side * size * 0.2, -size * 0.28, side * size * 0.38, -size * 0.22);
      ctx.lineTo(side * size * 0.38, size * 0.18);
      ctx.quadraticCurveTo(side * size * 0.2, size * 0.12, 0, size * 0.2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(60, 40, 20, 0.5)';
    ctx.lineWidth = Math.max(0.6, size * 0.025);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(side * size * 0.06, -size * 0.1 + k * size * 0.09);
        ctx.lineTo(side * size * 0.32, -size * 0.12 + k * size * 0.09);
        ctx.stroke();
      }
    }
  },

  /** Livre fermé, porté sous le bras (Scriptorium) : reliure (`item.cover`), tranche dorée. */
  closedBook(ctx, size, item = {}) {
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1a2a';
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.fillStyle = item.cover ?? '#24406e';
    ctx.beginPath();
    ctx.rect(-size * 0.22, -size * 0.3, size * 0.44, size * 0.6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e0b43a';
    ctx.fillRect(size * 0.16, -size * 0.27, size * 0.05, size * 0.54);
    ctx.strokeStyle = '#e0b43a';
    ctx.lineWidth = Math.max(0.8, size * 0.025);
    ctx.strokeRect(-size * 0.15, -size * 0.2, size * 0.26, size * 0.4);
  },

  /** Pâton du Boulanger (Bourg) : boule de pâte farinée. */
  dough(ctx, size) {
    ctx.strokeStyle = 'rgba(120, 90, 50, 0.6)';
    ctx.lineWidth = Math.max(1, size * 0.04);
    ctx.fillStyle = '#f1e2c2';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.36, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.ellipse(-size * 0.08, -size * 0.06, size * 0.14, size * 0.05, -0.2, 0, Math.PI * 2);
    ctx.fill();
  },
};

/** Dessine l'objet `item.kind` à l'origine du contexte (déjà placé et tourné). */
export function drawHeldItem(ctx, item, size) {
  HELD_ITEMS[item.kind]?.(ctx, size, item);
}
