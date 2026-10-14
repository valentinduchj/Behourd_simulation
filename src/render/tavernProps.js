import { shade } from './color.js';
import { drawBox } from './propRenderers.js';
import { drawTrophy } from './trophies.js';

// Mobilier de la Taverne (dessin seulement). Même contrat que render/propRenderers.js :
// chaque type reçoit (view, prop, env) avec env = { time }. Le mur du fond longe y = 0 :
// la face « avant-gauche » d'un meuble (côté y + h) regarde la salle.

const up = (p, dy) => ({ x: p.x, y: p.y - dy });
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function fillPoly(view, points, fill, stroke = 'rgba(30, 18, 8, 0.6)') {
  view.tracePolygon(points);
  view.ctx.fillStyle = fill;
  view.ctx.fill();
  view.ctx.lineWidth = 1;
  view.ctx.strokeStyle = stroke;
  view.ctx.stroke();
}

/** Petite flamme qui vacille (bougie, lanterne, âtre). Partagée avec le Scriptorium. */
export function flame(ctx, x, y, size, time, seed = 0) {
  const flicker = 0.85 + 0.15 * Math.sin(time * 9 + seed) + 0.05 * Math.sin(time * 23 + seed * 3);
  const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
  glow.addColorStop(0, `rgba(255, 200, 110, ${0.35 * flicker})`);
  glow.addColorStop(1, 'rgba(255, 170, 60, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, size * 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd36a';
  ctx.beginPath();
  ctx.ellipse(x, y - size * 0.4 * flicker, size * 0.45, size * flicker, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff4c8';
  ctx.beginPath();
  ctx.ellipse(x, y - size * 0.2, size * 0.2, size * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

function mug(ctx, x, y, s) {
  ctx.fillStyle = '#8a5f34';
  ctx.fillRect(x - s * 0.035, y - s * 0.08, s * 0.07, s * 0.08);
  ctx.fillStyle = '#f4ecd8';
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.08, s * 0.038, s * 0.016, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5f3f24';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x + s * 0.045, y - s * 0.045, s * 0.018, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
}

function plate(ctx, x, y, s, food = '#b8763c') {
  ctx.fillStyle = '#e8e2d4';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.07, s * 0.035, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = food;
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.008, s * 0.04, s * 0.02, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function candle(ctx, x, y, s, time, seed) {
  ctx.fillStyle = '#f4ecd8';
  ctx.fillRect(x - s * 0.012, y - s * 0.07, s * 0.024, s * 0.07);
  flame(ctx, x, y - s * 0.085, s * 0.022, time, seed);
}

export const TAVERN_PROPS = {
  // Âtre de pierre contre le mur du fond, feu animé, manteau de bois, marmite.
  fireplace(view, prop, { time = 0 } = {}) {
    const s = view.tile.w;
    const { x, y, w = 2 } = prop;
    const height = s * 1.05;
    drawBox(view, { x, y, w, h: 0.55, inset: 0.04, height, top: '#8e8478', left: '#7d7266', right: '#6a6156' });
    const D = view.toScreen(x + 0.04, y + 0.51);
    const C = view.toScreen(x + w - 0.04, y + 0.51);
    const a = lerp(D, C, 0.22);
    const b = lerp(D, C, 0.78);
    fillPoly(view, [a, b, up(b, height * 0.5), up(a, height * 0.5)], '#2a1a10');
    const mid = lerp(a, b, 0.5);
    const ctx = view.ctx;
    const glow = ctx.createRadialGradient(mid.x, mid.y - s * 0.1, 0, mid.x, mid.y - s * 0.1, s * 1.4);
    glow.addColorStop(0, `rgba(255, 150, 50, ${0.32 + 0.06 * Math.sin(time * 7)})`);
    glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(mid.x, mid.y - s * 0.1, s * 1.4, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) flame(ctx, lerp(a, b, 0.25 + i * 0.17).x, mid.y - s * 0.04 + (i % 2) * s * 0.02, s * (0.06 + (i % 2) * 0.02), time, i * 1.7);
    ctx.fillStyle = '#5a3b1e';
    ctx.fillRect(lerp(a, b, 0.3).x, mid.y - s * 0.02, lerp(a, b, 0.7).x - lerp(a, b, 0.3).x, s * 0.035);
    // Manteau de bois et marmite suspendue.
    fillPoly(view, [up(D, height * 0.6), up(C, height * 0.6), up(C, height * 0.68), up(D, height * 0.68)], '#5a3b1e');
    ctx.fillStyle = '#2b2b2e';
    ctx.beginPath();
    ctx.ellipse(mid.x, mid.y - height * 0.22, s * 0.11, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // Étagères de vaisselle contre le mur du fond : bouteilles, cruches, assiettes.
  shelf(view, prop) {
    const s = view.tile.w;
    const { x, y, w = 2 } = prop;
    const ctx = view.ctx;
    const D = view.toScreen(x + 0.05, y + 0.3);
    const C = view.toScreen(x + w - 0.05, y + 0.3);
    const colors = ['#2f5e3a', '#7a1b2a', '#c9a227', '#5c7f9c', '#8a5f34', '#e8e2d4'];
    [0.35, 0.7, 1.05].forEach((h, row) => {
      fillPoly(view, [up(D, s * h), up(C, s * h), up(C, s * (h + 0.04)), up(D, s * (h + 0.04))], '#6b4521');
      for (let i = 0; i < 6; i++) {
        const p = up(lerp(D, C, 0.1 + i * 0.16), s * (h + 0.04));
        ctx.fillStyle = colors[(i + row * 2) % colors.length];
        if ((i + row) % 3 === 0) {
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - s * 0.06, s * 0.05, s * 0.06, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(p.x - s * 0.02, p.y - s * 0.16, s * 0.04, s * 0.16);
          ctx.fillRect(p.x - s * 0.008, p.y - s * 0.21, s * 0.016, s * 0.05);
        }
      }
    });
    // Montants.
    ctx.fillStyle = '#5a3b1e';
    for (const t of [0, 1]) {
      const p = lerp(D, C, t);
      ctx.fillRect(p.x - s * 0.02, p.y - s * 1.12, s * 0.04, s * 1.12);
    }
  },

  // Tonneaux en perce couchés sur un chevalet, robinets de cuivre.
  kegRack(view, prop) {
    const s = view.tile.w;
    const { x, y, w = 3 } = prop;
    const ctx = view.ctx;
    drawBox(view, { x, y, w, h: 0.7, inset: 0.08, height: s * 0.18, top: '#7a5230', left: '#6b4521', right: '#5a3b1e' });
    for (let i = 0; i < w; i++) {
      const c = up(view.toScreen(x + i + 0.5, y + 0.62), s * 0.42);
      ctx.fillStyle = '#9a6a3a';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, s * 0.24, s * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a2a1a';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, s * 0.15, s * 0.15, 0, 0, Math.PI * 2);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#c98a3a';
      ctx.fillRect(c.x - s * 0.02, c.y + s * 0.02, s * 0.04, s * 0.09);
    }
  },

  // Comptoir : long meuble de chêne, panneaux, chopes et cruche.
  counter(view, prop) {
    const s = view.tile.w;
    const { x, y, w = 4, h = 1 } = prop;
    const height = s * 0.42;
    drawBox(view, { x, y, w, h, inset: 0.08, height, top: '#8a5f34', left: '#6b4521', right: '#5a3b1e' });
    const ctx = view.ctx;
    const D = view.toScreen(x + 0.08, y + h - 0.08);
    const C = view.toScreen(x + w - 0.08, y + h - 0.08);
    ctx.strokeStyle = 'rgba(30, 18, 8, 0.45)';
    ctx.lineWidth = 1;
    for (let i = 1; i < w * 2; i++) {
      const p = lerp(D, C, i / (w * 2));
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - height * 0.1);
      ctx.lineTo(p.x, p.y - height * 0.85);
      ctx.stroke();
    }
    for (const [t, u] of [[0.4, 0.4], [1.1, 0.55], [1.8, 0.35], [2.9, 0.5], [3.4, 0.45]]) {
      if (t > w) continue;
      const p = up(view.toScreen(x + t, y + u), height);
      mug(ctx, p.x, p.y, s);
    }
    const jug = up(view.toScreen(x + 2.4, y + 0.45), height);
    ctx.fillStyle = '#c9a26a';
    ctx.beginPath();
    ctx.ellipse(jug.x, jug.y - s * 0.07, s * 0.05, s * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  bench(view, prop) {
    const s = view.tile.w;
    drawBox(view, { x: prop.x, y: prop.y, w: prop.w ?? 2, h: prop.h ?? 1, inset: 0.3, height: s * 0.16, top: '#8a5f34', left: '#6b4521', right: '#5a3b1e' });
  },

  // Table longue : plateau, assiettes, chopes, chandelle.
  longTable(view, prop, { time = 0 } = {}) {
    const s = view.tile.w;
    const { x, y, w = 2, h = 1 } = prop;
    const height = s * 0.3;
    drawBox(view, { x, y, w, h, inset: 0.12, height, top: '#9a6a3a', left: '#7a5230', right: '#5f3f24' });
    const ctx = view.ctx;
    for (let i = 0; i < w; i++) {
      const p = up(view.toScreen(x + i + 0.35, y + 0.35), height);
      plate(ctx, p.x, p.y, s, i % 2 ? '#7a9a4a' : '#b8763c');
      const m = up(view.toScreen(x + i + 0.7, y + 0.65), height);
      mug(ctx, m.x, m.y, s);
    }
    const c = up(view.toScreen(x + w / 2, y + 0.5), height);
    candle(ctx, c.x, c.y, s, time, x + y);
  },

  // Table ronde : un pied, plateau, chope, assiette, chandelle.
  roundTable(view, prop, { time = 0 } = {}) {
    const s = view.tile.w;
    const ctx = view.ctx;
    const base = view.toScreen(prop.x + 0.5, prop.y + 0.5);
    const height = s * 0.3;
    ctx.fillStyle = '#5f3f24';
    ctx.fillRect(base.x - s * 0.04, base.y - height, s * 0.08, height);
    const top = up(base, height);
    ctx.fillStyle = '#7a5230';
    ctx.beginPath();
    ctx.ellipse(top.x, top.y + s * 0.03, s * 0.36, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9a6a3a';
    ctx.beginPath();
    ctx.ellipse(top.x, top.y, s * 0.36, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 18, 8, 0.6)';
    ctx.stroke();
    plate(ctx, top.x - s * 0.12, top.y + s * 0.03, s);
    mug(ctx, top.x + s * 0.14, top.y + s * 0.04, s);
    candle(ctx, top.x + s * 0.02, top.y - s * 0.03, s, time, prop.x * 3 + prop.y);
  },

  stool(view, prop) {
    const s = view.tile.w;
    const ctx = view.ctx;
    const base = view.toScreen(prop.x + 0.5, prop.y + 0.5);
    ctx.fillStyle = '#5f3f24';
    ctx.fillRect(base.x - s * 0.09, base.y - s * 0.16, s * 0.025, s * 0.16);
    ctx.fillRect(base.x + s * 0.065, base.y - s * 0.16, s * 0.025, s * 0.16);
    ctx.fillStyle = '#8a5f34';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y - s * 0.17, s * 0.12, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 18, 8, 0.6)';
    ctx.stroke();
  },

  // Lanterne sur un poteau, lumière vacillante.
  lantern(view, prop, { time = 0 } = {}) {
    const s = view.tile.w;
    const ctx = view.ctx;
    const base = view.toScreen(prop.x + 0.5, prop.y + 0.5);
    ctx.fillStyle = '#4a3220';
    ctx.fillRect(base.x - s * 0.02, base.y - s * 0.95, s * 0.04, s * 0.95);
    const lamp = up(base, s * 1.02);
    ctx.fillStyle = '#2b2b2e';
    ctx.fillRect(lamp.x - s * 0.07, lamp.y - s * 0.08, s * 0.14, s * 0.16);
    flame(ctx, lamp.x, lamp.y + s * 0.03, s * 0.05, time, prop.x + prop.y * 7);
    ctx.strokeStyle = '#2b2b2e';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(lamp.x - s * 0.07, lamp.y - s * 0.08, s * 0.14, s * 0.16);
  },

  // Tapis au sol : rouge à bordure dorée.
  rug(view, prop) {
    const { x, y, w = 3, h = 3 } = prop;
    const outer = [view.toScreen(x + 0.15, y + 0.15), view.toScreen(x + w - 0.15, y + 0.15), view.toScreen(x + w - 0.15, y + h - 0.15), view.toScreen(x + 0.15, y + h - 0.15)];
    const color = prop.color ?? '#8c2a1f';
    fillPoly(view, outer, color, 'rgba(0,0,0,0)');
    const inner = [view.toScreen(x + 0.35, y + 0.35), view.toScreen(x + w - 0.35, y + 0.35), view.toScreen(x + w - 0.35, y + h - 0.35), view.toScreen(x + 0.35, y + h - 0.35)];
    view.tracePolygon(inner);
    view.ctx.strokeStyle = prop.trim ?? '#d9a83a';
    view.ctx.lineWidth = 2;
    view.ctx.stroke();
    const center = view.toScreen(x + w / 2, y + h / 2);
    view.ctx.fillStyle = shade(color, 0.25);
    view.ctx.beginPath();
    view.ctx.ellipse(center.x, center.y, view.tile.w * 0.5, view.tile.h * 0.5, 0, 0, Math.PI * 2);
    view.ctx.fill();
  },

  // Armoire à trophées de la compagnie (contre le mur du fond) : vitrine à trois étagères. Les
  // trophées viennent du palmarès (env.trophies, systems/trophies/TrophyService.js), placés
  // d'eux-mêmes étagère par étagère ; au-delà de la place, une plaque « +N » (la vue détaillée
  // les montre tous). env.highlighted : survol (cadre doré).
  trophyCabinet(view, prop, { trophies = [], highlighted = false, capacity = { shelves: 3, perShelf: 4 } } = {}) {
    const s = view.tile.w;
    const { x, y, w = 2 } = prop;
    const ctx = view.ctx;
    const depth = 0.55;
    const height = s * 1.5;
    drawBox(view, { x, y, w, h: depth, inset: 0.04, height, top: '#7a5230', left: '#6b4521', right: '#4f3218' });
    const D = view.toScreen(x + 0.04, y + depth - 0.04);
    const C = view.toScreen(x + w - 0.04, y + depth - 0.04);
    // Fond de la vitrine (velours sombre) et cadre.
    const inner = [lerp(D, C, 0.06), lerp(D, C, 0.94)];
    fillPoly(view, [up(inner[0], s * 0.12), up(inner[1], s * 0.12), up(inner[1], height - s * 0.12), up(inner[0], height - s * 0.12)], '#3a1f2a');
    // Étagères et trophées.
    const rows = capacity.shelves;
    const perShelf = capacity.perShelf;
    const shelfHeights = Array.from({ length: rows }, (_, r) => 0.18 + r * ((1.5 - 0.42) / rows));
    shelfHeights.forEach((hRow) => {
      fillPoly(view, [up(inner[0], s * hRow), up(inner[1], s * hRow), up(inner[1], s * (hRow + 0.035)), up(inner[0], s * (hRow + 0.035))], '#8a5f34');
    });
    const visible = trophies.slice(0, rows * perShelf);
    visible.forEach((trophy, i) => {
      const row = Math.floor(i / perShelf);
      const col = i % perShelf;
      const p = up(lerp(inner[0], inner[1], (col + 0.5) / perShelf), s * (shelfHeights[row] + 0.035));
      drawTrophy(ctx, p.x, p.y, { competition: trophy.competition, size: s * 0.3 });
    });
    if (trophies.length > visible.length) {
      const p = up(lerp(inner[0], inner[1], 0.86), s * (shelfHeights[rows - 1] + 0.2));
      ctx.fillStyle = '#e0b43a';
      ctx.font = `700 ${Math.max(10, Math.round(s * 0.14))}px "Cinzel", Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`+${trophies.length - visible.length}`, p.x, p.y);
    }
    if (!trophies.length) {
      const p = up(lerp(inner[0], inner[1], 0.5), s * 0.62);
      ctx.fillStyle = 'rgba(240, 220, 180, 0.55)';
      ctx.font = `italic ${Math.max(9, Math.round(s * 0.11))}px "EB Garamond", Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText('— vide —', p.x, p.y);
    }
    // Vitre : reflets.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = Math.max(2, s * 0.04);
    for (const t of [0.2, 0.62]) {
      const a = up(lerp(inner[0], inner[1], t), s * 0.3);
      const b = up(lerp(inner[0], inner[1], t + 0.12), height - s * 0.3);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Fronton.
    fillPoly(view, [up(D, height), up(C, height), up(lerp(D, C, 0.5), height + s * 0.18)], '#5a3b1e');
    if (highlighted) {
      view.tracePolygon([D, C, up(C, height + s * 0.05), up(D, height + s * 0.05)]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f0c419';
      ctx.stroke();
    }
  },
};
