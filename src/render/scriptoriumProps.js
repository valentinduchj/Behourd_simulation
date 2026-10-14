import { shade } from './color.js';
import { drawBox } from './propRenderers.js';
import { candle } from './tavernProps.js';

// Mobilier du Scriptorium (dessin seulement). Même contrat que render/propRenderers.js : chaque
// type reçoit (view, prop, env) avec env = { time, highlighted }. Le mur du fond longe y = 0 :
// la face « avant-gauche » d'un meuble (côté y + h) regarde la salle.

const up = (p, dy) => ({ x: p.x, y: p.y - dy });
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const BOOK_COLORS = ['#7a1b2a', '#2f5e3a', '#24406e', '#8a5f34', '#5a2a5e', '#a0741a', '#3a2412', '#6d1f1f', '#2d4a4a'];

function fillPoly(view, points, fill, stroke = 'rgba(30, 18, 8, 0.6)') {
  view.tracePolygon(points);
  view.ctx.fillStyle = fill;
  view.ctx.fill();
  view.ctx.lineWidth = 1;
  view.ctx.strokeStyle = stroke;
  view.ctx.stroke();
}

// Suite pseudo-aléatoire stable (couleurs et hauteurs des livres : même dessin à chaque image).
const noise = (seed, i) => {
  const v = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/** Livre ouvert, à plat (pages crème, tranche rouge), centré en (x, y). */
function openBook(ctx, x, y, s, { cover = '#6d1f1f', time = 0 } = {}) {
  ctx.fillStyle = cover;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.01, s * 0.15, s * 0.055, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#f4ecd8';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + side * s * 0.07, y - s * 0.035, x + side * s * 0.13, y - s * 0.01);
    ctx.lineTo(x + side * s * 0.13, y + s * 0.02);
    ctx.quadraticCurveTo(x + side * s * 0.07, y - s * 0.005, x, y + s * 0.025);
    ctx.closePath();
    ctx.fill();
  }
  // Lignes d'écriture.
  ctx.strokeStyle = 'rgba(60, 40, 20, 0.45)';
  ctx.lineWidth = 0.8;
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(x + side * s * 0.025, y - s * 0.012 + k * s * 0.01);
      ctx.lineTo(x + side * s * 0.11, y - s * 0.004 + k * s * 0.01);
      ctx.stroke();
    }
  }
  // Une page qui se tourne de temps en temps.
  const turn = (time * 0.25) % 1;
  if (time && turn < 0.12) {
    const k = turn / 0.12;
    ctx.fillStyle = 'rgba(250, 244, 228, 0.95)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + s * 0.06 * (1 - 2 * k), y - s * 0.09 * Math.sin(k * Math.PI), x + s * 0.12 * (1 - 2 * k), y - s * 0.01);
    ctx.lineTo(x, y + s * 0.02);
    ctx.closePath();
    ctx.fill();
  }
}

/** Parchemin roulé (couché), centré en (x, y). */
function scroll(ctx, x, y, s, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#efe0bb';
  ctx.fillRect(-s * 0.1, -s * 0.022, s * 0.2, s * 0.044);
  ctx.fillStyle = '#d8c393';
  for (const end of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(end * s * 0.1, 0, s * 0.012, s * 0.024, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#8c2a1f';
  ctx.fillRect(-s * 0.012, -s * 0.024, s * 0.024, s * 0.048);
  ctx.restore();
}

/** Encrier et plume. */
function inkwell(ctx, x, y, s) {
  ctx.fillStyle = '#1d1d22';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.03, s * 0.016, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - s * 0.03, y - s * 0.035, s * 0.06, s * 0.035);
  ctx.strokeStyle = '#f4f0e6';
  ctx.lineWidth = Math.max(1, s * 0.012);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.005, y - s * 0.03);
  ctx.quadraticCurveTo(x + s * 0.05, y - s * 0.1, x + s * 0.035, y - s * 0.16);
  ctx.stroke();
}

/** Pile de livres posés à plat, en (x, y) (base). */
function bookStack(ctx, x, y, s, count, seed) {
  for (let i = 0; i < count; i++) {
    const w = s * (0.17 - noise(seed, i) * 0.05);
    const shift = (noise(seed, i + 9) - 0.5) * s * 0.04;
    ctx.fillStyle = BOOK_COLORS[Math.floor(noise(seed, i + 3) * BOOK_COLORS.length)];
    ctx.fillRect(x - w / 2 + shift, y - (i + 1) * s * 0.045, w, s * 0.04);
    ctx.fillStyle = 'rgba(244, 236, 216, 0.8)';
    ctx.fillRect(x - w / 2 + shift + s * 0.01, y - (i + 1) * s * 0.045 + s * 0.008, w - s * 0.02, s * 0.01);
  }
}

/** Anneaux d'une sphère armillaire, qui tournent lentement. */
function rings(ctx, c, r, time, color = '#c9a227') {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.2, r * 0.09);
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
  for (let k = 0; k < 3; k++) {
    const phase = time * 0.6 + k * (Math.PI / 3);
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, Math.abs(Math.cos(phase)) * r + 0.5, r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, r, r * 0.32, -0.35, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#e8c35a';
  ctx.beginPath();
  ctx.arc(c.x, c.y, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

export const SCRIPTORIUM_PROPS = {
  // Grande bibliothèque contre le mur du fond : montants de chêne, cinq rayons de livres reliés.
  bookshelf(view, prop) {
    const s = view.tile.w;
    const { x, y, w = 2, seed = 1 } = prop;
    const ctx = view.ctx;
    const height = s * 1.7;
    drawBox(view, { x, y, w, h: 0.5, inset: 0.03, height, top: '#5a3b1e', left: '#4a2f18', right: '#3a2412' });
    const D = view.toScreen(x + 0.06, y + 0.47);
    const C = view.toScreen(x + w - 0.06, y + 0.47);
    // Fond sombre des casiers.
    fillPoly(view, [up(D, s * 0.06), up(C, s * 0.06), up(C, height - s * 0.08), up(D, height - s * 0.08)], '#22150b');
    const rows = 5;
    const rowH = (height - s * 0.16) / rows;
    for (let r = 0; r < rows; r++) {
      const base = s * 0.08 + r * rowH;
      fillPoly(view, [up(D, base), up(C, base), up(C, base + s * 0.035), up(D, base + s * 0.035)], '#6b4521');
      const books = Math.round(w * 7);
      for (let i = 0; i < books; i++) {
        if (noise(seed * 7 + r, i) < 0.08) continue; // un vide sur le rayon
        const t = (i + 0.5) / books;
        const p = up(lerp(D, C, t), base + s * 0.035);
        const bh = rowH * (0.62 + noise(seed + r, i) * 0.3);
        const bw = Math.max(2, s * 0.045 * (0.8 + noise(seed, i + r) * 0.5));
        ctx.fillStyle = BOOK_COLORS[Math.floor(noise(seed * 3 + r, i) * BOOK_COLORS.length)];
        ctx.fillRect(p.x - bw / 2, p.y - bh, bw, bh);
        ctx.fillStyle = 'rgba(224, 180, 58, 0.55)';
        ctx.fillRect(p.x - bw / 2, p.y - bh * 0.8, bw, Math.max(1, s * 0.008));
      }
    }
    // Montants et corniche.
    ctx.fillStyle = '#3a2412';
    for (const t of [0, 0.5, 1]) {
      if (w < 3 && t === 0.5) continue;
      const p = lerp(D, C, t);
      ctx.fillRect(p.x - s * 0.025, p.y - height, s * 0.05, height);
    }
    fillPoly(view, [up(D, height - s * 0.08), up(C, height - s * 0.08), up(C, height + s * 0.04), up(D, height + s * 0.04)], '#5a3b1e');
  },

  // Pupitre de copiste : plateau incliné, registre ouvert, encrier, parchemins, chandelle.
  scribeDesk(view, prop, { time = 0 } = {}) {
    const s = view.tile.w;
    const { x, y, w = 2, h = 1 } = prop;
    const height = s * 0.34;
    drawBox(view, { x, y, w, h, inset: 0.16, height, top: '#7a5230', left: '#5f3f24', right: '#4a3220' });
    const ctx = view.ctx;
    for (let i = 0; i < w; i++) {
      const p = up(view.toScreen(x + i + 0.5, y + 0.5), height);
      openBook(ctx, p.x, p.y, s, { cover: i % 2 ? '#24406e' : '#6d1f1f', time: time + i * 1.7 + x });
    }
    const ink = up(view.toScreen(x + w - 0.3, y + 0.3), height);
    inkwell(ctx, ink.x, ink.y, s);
    const sc = up(view.toScreen(x + 0.3, y + 0.75), height);
    scroll(ctx, sc.x, sc.y, s, -0.4);
    const c = up(view.toScreen(x + w / 2, y + 0.25), height);
    candle(ctx, c.x, c.y, s, time, x * 3 + y);
  },

  // Pupitre de lecture sur pied, grand livre ouvert.
  lectern(view, prop, { time = 0 } = {}) {
    const s = view.tile.w;
    const ctx = view.ctx;
    const base = view.toScreen(prop.x + 0.5, prop.y + 0.5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, s * 0.2, s * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a2f18';
    ctx.fillRect(base.x - s * 0.04, base.y - s * 0.55, s * 0.08, s * 0.55);
    ctx.fillRect(base.x - s * 0.16, base.y - s * 0.04, s * 0.32, s * 0.04);
    const top = up(base, s * 0.58);
    fillPoly(view, [{ x: top.x - s * 0.22, y: top.y + s * 0.05 }, { x: top.x + s * 0.22, y: top.y + s * 0.05 }, { x: top.x + s * 0.18, y: top.y - s * 0.08 }, { x: top.x - s * 0.18, y: top.y - s * 0.08 }], '#6b4521');
    openBook(ctx, top.x, top.y - s * 0.01, s * 1.2, { cover: '#5a2a5e', time: time + prop.x });
  },

  // Globe terrestre sur son pied, qui tourne doucement.
  globe(view, prop, { time = 0 } = {}) {
    const s = view.tile.w;
    const ctx = view.ctx;
    const base = view.toScreen(prop.x + 0.5, prop.y + 0.5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, s * 0.22, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4a2f18';
    ctx.lineWidth = Math.max(2, s * 0.035);
    for (const dx of [-0.14, 0, 0.14]) {
      ctx.beginPath();
      ctx.moveTo(base.x + dx * s, base.y - s * (dx ? 0.02 : 0.05));
      ctx.lineTo(base.x, base.y - s * 0.4);
      ctx.stroke();
    }
    const c = up(base, s * 0.62);
    const r = s * 0.22;
    const sea = ctx.createRadialGradient(c.x - r * 0.3, c.y - r * 0.3, r * 0.1, c.x, c.y, r);
    sea.addColorStop(0, '#6f9cc4');
    sea.addColorStop(1, '#2c4e74');
    ctx.fillStyle = sea;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    // Terres qui défilent avec la rotation.
    ctx.save();
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#9a8a4a';
    const spin = (time * 0.12) % 1;
    for (const [lon, lat, size] of [[0.1, -0.3, 0.45], [0.45, 0.2, 0.35], [0.75, -0.1, 0.3]]) {
      const u = ((lon + spin) % 1) * 2 - 1;
      ctx.beginPath();
      ctx.ellipse(c.x + u * r * 1.1, c.y + lat * r, r * size * (1 - Math.abs(u) * 0.5), r * size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(240, 220, 160, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r, r * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Méridien de laiton.
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = Math.max(1.5, s * 0.025);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 1.12, -Math.PI * 0.85, Math.PI * 0.35);
    ctx.stroke();
  },

  // Sphère armillaire de laiton sur un socle (petite : posée près du Bureau d'étude).
  armillary(view, prop, { time = 0 } = {}) {
    const s = view.tile.w * (prop.small ? 0.7 : 1);
    const ctx = view.ctx;
    const base = view.toScreen(prop.x + 0.5, prop.y + 0.5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, s * 0.18, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3b1e';
    ctx.fillRect(base.x - s * 0.12, base.y - s * 0.12, s * 0.24, s * 0.12);
    ctx.fillStyle = '#a0741a';
    ctx.fillRect(base.x - s * 0.025, base.y - s * 0.42, s * 0.05, s * 0.3);
    rings(ctx, up(base, s * 0.62), s * 0.22, time + prop.x);
  },

  // Lunette astronomique sur trépied, pointée vers la fenêtre.
  telescope(view, prop) {
    const s = view.tile.w;
    const ctx = view.ctx;
    const base = view.toScreen(prop.x + 0.5, prop.y + 0.5);
    ctx.strokeStyle = '#3a2412';
    ctx.lineWidth = Math.max(2, s * 0.03);
    const head = up(base, s * 0.55);
    for (const dx of [-0.2, 0.05, 0.2]) {
      ctx.beginPath();
      ctx.moveTo(base.x + dx * s, base.y + (dx === 0.05 ? -s * 0.08 : 0));
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(-0.75);
    ctx.fillStyle = '#a0741a';
    ctx.fillRect(-s * 0.18, -s * 0.045, s * 0.52, s * 0.09);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(s * 0.3, -s * 0.06, s * 0.08, s * 0.12);
    ctx.fillStyle = '#5a3b1e';
    ctx.fillRect(-s * 0.04, -s * 0.05, s * 0.05, s * 0.1);
    ctx.restore();
  },

  // Chandelier sur pied : trois bougies qui vacillent.
  candelabra(view, prop, { time = 0 } = {}) {
    const s = view.tile.w;
    const ctx = view.ctx;
    const base = view.toScreen(prop.x + 0.5, prop.y + 0.5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, s * 0.14, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3b3328';
    ctx.fillRect(base.x - s * 0.1, base.y - s * 0.04, s * 0.2, s * 0.04);
    ctx.fillRect(base.x - s * 0.02, base.y - s * 0.95, s * 0.04, s * 0.95);
    const top = up(base, s * 0.95);
    ctx.strokeStyle = '#3b3328';
    ctx.lineWidth = Math.max(1.5, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(top.x - s * 0.16, top.y - s * 0.08);
    ctx.quadraticCurveTo(top.x, top.y + s * 0.08, top.x + s * 0.16, top.y - s * 0.08);
    ctx.stroke();
    for (const [dx, dy] of [[-0.16, -0.08], [0, -0.04], [0.16, -0.08]]) candle(ctx, top.x + dx * s, top.y + dy * s, s, time, prop.x * 5 + prop.y + dx * 10);
  },

  // Le Bureau d'étude : grand bureau de chêne à ferrures dorées, livres, parchemins, astrolabe.
  studyDesk(view, prop, { time = 0, highlighted = false } = {}) {
    const s = view.tile.w;
    const { x, y, w = 2, h = 1 } = prop;
    const height = s * 0.38;
    drawBox(view, { x, y, w, h, inset: 0.08, height, top: '#8a5f34', left: '#6b4521', right: '#55361a' });
    const ctx = view.ctx;
    // Ferrures dorées.
    const D = view.toScreen(x + 0.08, y + h - 0.08);
    const C = view.toScreen(x + w - 0.08, y + h - 0.08);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = Math.max(1.5, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(D.x, D.y - height * 0.85);
    ctx.lineTo(C.x, C.y - height * 0.85);
    ctx.stroke();
    const book = up(view.toScreen(x + 0.9, y + 0.55), height);
    openBook(ctx, book.x, book.y, s * 1.15, { cover: '#24406e', time });
    const stack = up(view.toScreen(x + 0.3, y + 0.3), height);
    bookStack(ctx, stack.x, stack.y, s, 4, x + y);
    const sc = up(view.toScreen(x + 1.55, y + 0.75), height);
    scroll(ctx, sc.x, sc.y, s, 0.3);
    scroll(ctx, sc.x + s * 0.05, sc.y - s * 0.05, s, 0.1);
    // Astrolabe posé debout.
    const astro = up(view.toScreen(x + w - 0.3, y + 0.3), height + s * 0.14);
    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.arc(astro.x, astro.y, s * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6b4a10';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(astro.x, astro.y, s * 0.07, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(astro.x, astro.y);
    ctx.rotate(time * 0.3);
    ctx.beginPath();
    ctx.moveTo(-s * 0.1, 0);
    ctx.lineTo(s * 0.1, 0);
    ctx.stroke();
    ctx.restore();
    const c = up(view.toScreen(x + 1.3, y + 0.2), height);
    candle(ctx, c.x, c.y, s, time, 42);
    if (highlighted) {
      view.tracePolygon([view.toScreen(x, y + h), view.toScreen(x + w, y + h), up(view.toScreen(x + w, y + h), height), up(view.toScreen(x, y + h), height)]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#f0c419';
      ctx.stroke();
    }
  },

  // Rayonnage contre le mur de GAUCHE (cabinet de Flavia) : sa face regarde la salle (+x).
  // Un interstice sombre entre deux livres, au rayon du bas : la souris en sort.
  bookshelfLeft(view, prop) {
    const s = view.tile.w;
    const { x, y, h = 2, seed = 5 } = prop;
    const ctx = view.ctx;
    const height = s * 1.7;
    drawBox(view, { x, y, w: 0.5, h, inset: 0.03, height, top: '#5a3b1e', left: '#4a2f18', right: '#3a2412' });
    const B = view.toScreen(x + 0.47, y + 0.06);
    const C = view.toScreen(x + 0.47, y + h - 0.06);
    fillPoly(view, [up(B, s * 0.06), up(C, s * 0.06), up(C, height - s * 0.08), up(B, height - s * 0.08)], '#22150b');
    const rows = 5;
    const rowH = (height - s * 0.16) / rows;
    for (let r = 0; r < rows; r++) {
      const base = s * 0.08 + r * rowH;
      fillPoly(view, [up(B, base), up(C, base), up(C, base + s * 0.035), up(B, base + s * 0.035)], '#6b4521');
      const books = Math.round(h * 7);
      for (let i = 0; i < books; i++) {
        if (r === 0 && i === 2) continue; // l'interstice de la souris
        if (noise(seed * 7 + r, i) < 0.08) continue;
        const p = up(lerp(B, C, (i + 0.5) / books), base + s * 0.035);
        const bh = rowH * (0.62 + noise(seed + r, i) * 0.3);
        const bw = Math.max(2, s * 0.045 * (0.8 + noise(seed, i + r) * 0.5));
        ctx.fillStyle = BOOK_COLORS[Math.floor(noise(seed * 3 + r, i) * BOOK_COLORS.length)];
        ctx.fillRect(p.x - bw / 2, p.y - bh, bw, bh);
        ctx.fillStyle = 'rgba(224, 180, 58, 0.55)';
        ctx.fillRect(p.x - bw / 2, p.y - bh * 0.8, bw, Math.max(1, s * 0.008));
      }
    }
    ctx.fillStyle = '#3a2412';
    for (const t of [0, 1]) {
      const p = lerp(B, C, t);
      ctx.fillRect(p.x - s * 0.025, p.y - height, s * 0.05, height);
    }
    fillPoly(view, [up(B, height - s * 0.08), up(C, height - s * 0.08), up(C, height + s * 0.04), up(B, height + s * 0.04)], '#5a3b1e');
  },

  // Table de travail de Flavia : manuscrits enluminés, astrolabe, sablier, chandelle, plume.
  scholarTable(view, prop, { time = 0 } = {}) {
    const s = view.tile.w;
    const { x, y, w = 2, h = 1 } = prop;
    const height = s * 0.36;
    drawBox(view, { x, y, w, h, inset: 0.1, height, top: '#7a4a2a', left: '#5a3420', right: '#472816' });
    const ctx = view.ctx;
    const D = view.toScreen(x + 0.1, y + h - 0.1);
    const C = view.toScreen(x + w - 0.1, y + h - 0.1);
    // Nappe verte brodée qui tombe sur le devant.
    fillPoly(view, [up(D, height), up(C, height), up(C, height * 0.45), up(D, height * 0.45)], '#2f5e3a');
    ctx.strokeStyle = '#e0b43a';
    ctx.lineWidth = Math.max(1, s * 0.015);
    ctx.beginPath();
    ctx.moveTo(D.x, D.y - height * 0.5);
    ctx.lineTo(C.x, C.y - height * 0.5);
    ctx.stroke();
    const book = up(view.toScreen(x + 0.7, y + 0.55), height);
    openBook(ctx, book.x, book.y, s * 1.1, { cover: '#2f5e3a', time: time + 3 });
    const stack = up(view.toScreen(x + w - 0.35, y + 0.35), height);
    bookStack(ctx, stack.x, stack.y, s, 3, 77);
    const ink = up(view.toScreen(x + 1.25, y + 0.3), height);
    inkwell(ctx, ink.x, ink.y, s);
    // Sablier : le sable s'écoule.
    const glass = up(view.toScreen(x + 1.5, y + 0.7), height);
    const fall = (time * 0.1) % 1;
    ctx.strokeStyle = '#5a3b1e';
    ctx.lineWidth = Math.max(1, s * 0.02);
    ctx.strokeRect(glass.x - s * 0.04, glass.y - s * 0.16, s * 0.08, s * 0.16);
    ctx.fillStyle = 'rgba(220, 235, 245, 0.5)';
    ctx.beginPath();
    ctx.moveTo(glass.x - s * 0.035, glass.y - s * 0.155);
    ctx.lineTo(glass.x + s * 0.035, glass.y - s * 0.155);
    ctx.lineTo(glass.x, glass.y - s * 0.08);
    ctx.lineTo(glass.x + s * 0.035, glass.y - s * 0.005);
    ctx.lineTo(glass.x - s * 0.035, glass.y - s * 0.005);
    ctx.lineTo(glass.x, glass.y - s * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d9b35a';
    ctx.fillRect(glass.x - s * 0.025 * (1 - fall), glass.y - s * 0.14 + s * 0.05 * fall, s * 0.05 * (1 - fall), s * 0.04 * (1 - fall));
    ctx.fillRect(glass.x - s * 0.03 * fall, glass.y - s * 0.03 * fall - s * 0.005, s * 0.06 * fall, s * 0.03 * fall);
    const c = up(view.toScreen(x + 0.25, y + 0.25), height);
    candle(ctx, c.x, c.y, s, time, 91);
  },

  // Coussin du chat (velours pourpre à glands d'or).
  catCushion(view, prop) {
    const s = view.tile.w;
    const c = view.toScreen(prop.x + 0.5, prop.y + 0.45);
    const ctx = view.ctx;
    ctx.fillStyle = '#5a2a5e';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, s * 0.3, s * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#74407a';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - s * 0.02, s * 0.22, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0b43a';
    for (const dx of [-0.3, 0.3]) {
      ctx.beginPath();
      ctx.arc(c.x + dx * s, c.y, s * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Gamelle du chat : eau (reflets) ou croquettes.
  catBowl(view, prop, { time = 0 } = {}) {
    const s = view.tile.w;
    const c = view.toScreen(prop.x + 0.5, prop.y + 0.3);
    const ctx = view.ctx;
    ctx.fillStyle = '#8a8f96';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, s * 0.12, s * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5f646b';
    ctx.fillRect(c.x - s * 0.12, c.y, s * 0.24, s * 0.03);
    if (prop.kind === 'water') {
      ctx.fillStyle = `rgba(110, 170, 220, ${0.8 + 0.1 * Math.sin(time * 2)})`;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, s * 0.095, s * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.ellipse(c.x - s * 0.03, c.y - s * 0.01, s * 0.025, s * 0.008, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#8a5a2e';
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.arc(c.x + (noise(i, 4) - 0.5) * s * 0.16, c.y + (noise(i, 5) - 0.6) * s * 0.06, Math.max(1, s * 0.016), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // Livres empilés au sol.
  bookPile(view, prop) {
    const s = view.tile.w;
    const base = view.toScreen(prop.x + 0.5, prop.y + 0.5);
    const ctx = view.ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, s * 0.2, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    bookStack(ctx, base.x - s * 0.08, base.y, s * 1.2, 5, prop.x * 3 + prop.y);
    bookStack(ctx, base.x + s * 0.12, base.y + s * 0.03, s * 1.1, 3, prop.x + prop.y * 5);
  },

  // Coffre bardé de fer, débordant de parchemins roulés.
  scrollChest(view, prop) {
    const s = view.tile.w;
    const { x, y } = prop;
    const height = s * 0.32;
    drawBox(view, { x, y, w: 1, h: 1, inset: 0.18, height, top: '#7a5230', left: '#5f3f24', right: '#4a3220' });
    const ctx = view.ctx;
    const D = view.toScreen(x + 0.18, y + 0.82);
    const C = view.toScreen(x + 0.82, y + 0.82);
    ctx.strokeStyle = '#2b2b2e';
    ctx.lineWidth = Math.max(1.5, s * 0.03);
    for (const t of [0.25, 0.75]) {
      const p = lerp(D, C, t);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - height);
      ctx.stroke();
    }
    const top = up(view.toScreen(x + 0.5, y + 0.5), height);
    for (let i = 0; i < 4; i++) scroll(ctx, top.x + (i - 1.5) * s * 0.06, top.y - (i % 2) * s * 0.03, s * 1.3, -0.5 + i * 0.25);
  },
};

/** Dessin d'un objet de mur du Scriptorium (fenêtre, carte céleste, applique), centré en `center`. */
export function drawScriptoriumWallItem(ctx, item, center, s, { light = 0, time = 0 } = {}) {
  if (item.type === 'window') {
    // Haute fenêtre en ogive : nuit étoilée, meneau de pierre.
    ctx.fillStyle = shade('#1a2440', light);
    ctx.beginPath();
    ctx.moveTo(center.x - s * 0.2, center.y + s * 0.4);
    ctx.lineTo(center.x - s * 0.2, center.y - s * 0.12);
    ctx.quadraticCurveTo(center.x - s * 0.2, center.y - s * 0.42, center.x, center.y - s * 0.5);
    ctx.quadraticCurveTo(center.x + s * 0.2, center.y - s * 0.42, center.x + s * 0.2, center.y - s * 0.12);
    ctx.lineTo(center.x + s * 0.2, center.y + s * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5b544a';
    ctx.lineWidth = 3;
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const twinkle = 0.5 + 0.5 * Math.sin(time * 2 + i * 1.7);
      ctx.fillStyle = `rgba(250, 240, 200, ${0.4 + 0.5 * twinkle})`;
      ctx.beginPath();
      ctx.arc(center.x + (noise(i, 1) - 0.5) * s * 0.32, center.y + (noise(i, 2) - 0.6) * s * 0.7, Math.max(0.8, s * 0.012), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#5b544a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y - s * 0.48);
    ctx.lineTo(center.x, center.y + s * 0.4);
    ctx.stroke();
    return;
  }
  if (item.type === 'starChart') {
    // Carte céleste : parchemin cloué, constellations reliées, cercle zodiacal.
    ctx.fillStyle = shade('#e9dcb6', light);
    ctx.fillRect(center.x - s * 0.24, center.y - s * 0.28, s * 0.48, s * 0.5);
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(center.x - s * 0.24, center.y - s * 0.28, s * 0.48, s * 0.5);
    ctx.strokeStyle = 'rgba(40, 50, 90, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center.x, center.y - s * 0.03, s * 0.18, 0, Math.PI * 2);
    ctx.stroke();
    const stars = [[-0.12, -0.12], [-0.04, -0.06], [0.05, -0.14], [0.1, 0.02], [-0.08, 0.08]];
    ctx.beginPath();
    stars.forEach(([dx, dy], i) => (i ? ctx.lineTo(center.x + dx * s, center.y + dy * s) : ctx.moveTo(center.x + dx * s, center.y + dy * s)));
    ctx.stroke();
    ctx.fillStyle = '#24406e';
    for (const [dx, dy] of stars) {
      ctx.beginPath();
      ctx.arc(center.x + dx * s, center.y + dy * s, Math.max(1, s * 0.014), 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (item.type === 'mouseHole') {
    // Trou de souris au ras du sol (le centre est déjà au pied du mur).
    ctx.fillStyle = '#120c08';
    ctx.beginPath();
    ctx.moveTo(center.x - s * 0.07, center.y);
    ctx.lineTo(center.x - s * 0.07, center.y - s * 0.06);
    ctx.arc(center.x, center.y - s * 0.06, s * 0.07, Math.PI, 0);
    ctx.lineTo(center.x + s * 0.07, center.y);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (item.type === 'sconce') {
    // Applique murale : support de fer et bougie.
    ctx.fillStyle = '#2b2b2e';
    ctx.fillRect(center.x - s * 0.04, center.y + s * 0.02, s * 0.08, s * 0.04);
    ctx.fillRect(center.x - s * 0.01, center.y + s * 0.02, s * 0.02, s * 0.12);
    candle(ctx, center.x, center.y + s * 0.02, s, time, center.x);
    return;
  }
  if (item.type === 'banner') {
    ctx.fillStyle = shade(item.color, light);
    ctx.beginPath();
    ctx.moveTo(center.x - s * 0.15, center.y - s * 0.4);
    ctx.lineTo(center.x + s * 0.15, center.y - s * 0.4);
    ctx.lineTo(center.x + s * 0.15, center.y + s * 0.3);
    ctx.lineTo(center.x, center.y + s * 0.18);
    ctx.lineTo(center.x - s * 0.15, center.y + s * 0.3);
    ctx.closePath();
    ctx.fill();
    // Emblème : livre ouvert et étoile.
    ctx.fillStyle = item.emblem;
    ctx.beginPath();
    ctx.moveTo(center.x - s * 0.08, center.y - s * 0.02);
    ctx.lineTo(center.x, center.y + s * 0.02);
    ctx.lineTo(center.x + s * 0.08, center.y - s * 0.02);
    ctx.lineTo(center.x + s * 0.08, center.y - s * 0.1);
    ctx.lineTo(center.x, center.y - s * 0.06);
    ctx.lineTo(center.x - s * 0.08, center.y - s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(center.x, center.y - s * 0.22, s * 0.035, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2412';
    ctx.fillRect(center.x - s * 0.19, center.y - s * 0.43, s * 0.38, s * 0.04);
  }
}
