import { mixColors, shade } from './color.js';
import { CLIMATE_SEASONS } from '../data/climate.js';
import { drawSnowCap, seasonFoliage, seasonVisuals, SNOW_COLOR, treeBlossoms } from './seasonLook.js';

// Saisons de l'année (v0.70) : la vue porte sa saison (view.season ; null : aspect d'origine).
const isWinter = (view) => view.season === 'winter';
const fireOut = (view) => Boolean(CLIMATE_SEASONS.find((s) => s.id === view.season)?.fireOut);

// Dessin des éléments de décor du Centre. Chaque type reçoit (view, prop, env) où
// view est l'IsoView, env = { time, teamColors }. Ajouter un type de décor = ajouter
// une fonction ici et l'utiliser dans data/activities.js ou data/centreLayout.js.

const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const up = (p, dy) => ({ x: p.x, y: p.y - dy });

function fillPoly(view, points, fill, stroke = 'rgba(40, 25, 10, 0.55)') {
  view.tracePolygon(points);
  view.ctx.fillStyle = fill;
  view.ctx.fill();
  view.ctx.lineWidth = 1;
  view.ctx.strokeStyle = stroke;
  view.ctx.stroke();
}

function tileCenter(view, prop) {
  return view.toScreen(prop.x + 0.5, prop.y + 0.5);
}

export const PROP_RENDERERS = {
  building(view, prop) {
    const { x, y, w, h } = prop;
    const H = view.tile.w * 0.5 * (prop.height ?? 1);
    const A = view.toScreen(x, y);
    const B = view.toScreen(x + w, y);
    const C = view.toScreen(x + w, y + h);
    const D = view.toScreen(x, y + h);

    // Murs visibles.
    fillPoly(view, [D, C, up(C, H), up(D, H)], shade(prop.wall, -0.04));
    fillPoly(view, [C, B, up(B, H), up(C, H)], shade(prop.wall, -0.2));

    // Porte et fenêtre.
    const d1 = lerp(D, C, 0.42);
    const d2 = lerp(D, C, 0.58);
    fillPoly(view, [d1, d2, up(d2, H * 0.6), up(d1, H * 0.6)], '#6b4a2b');
    const w1 = lerp(C, B, 0.35);
    const w2 = lerp(C, B, 0.65);
    fillPoly(view, [up(w1, H * 0.35), up(w2, H * 0.35), up(w2, H * 0.75), up(w1, H * 0.75)], '#5c7f9c');

    // Toit à croupe.
    const R = H * 0.9;
    const top = (p) => up(p, H);
    const ridge = (gx, gy) => up(view.toScreen(gx, gy), H + R);
    // Hiver : toit sous la neige (les pans gardent leurs ombrages).
    const roof = isWinter(view) ? mixColors(prop.roof, SNOW_COLOR, 0.82) : prop.roof;
    if (w >= h) {
      const r1 = ridge(x + h / 2, y + h / 2);
      const r2 = ridge(x + w - h / 2, y + h / 2);
      fillPoly(view, [top(A), top(B), r2, r1], shade(roof, -0.25));
      fillPoly(view, [top(A), top(D), r1], shade(roof, -0.1));
      fillPoly(view, [top(D), top(C), r2, r1], roof);
      fillPoly(view, [top(C), top(B), r2], shade(roof, -0.18));
    } else {
      const r1 = ridge(x + w / 2, y + w / 2);
      const r2 = ridge(x + w / 2, y + h - w / 2);
      fillPoly(view, [top(A), top(D), r2, r1], shade(roof, -0.1));
      fillPoly(view, [top(A), top(B), r1], shade(roof, -0.25));
      fillPoly(view, [top(B), top(C), r2, r1], shade(roof, -0.18));
      fillPoly(view, [top(D), top(C), r2], roof);
    }
  },

  banner(view, prop, { time, teamColors }) {
    const { ctx } = view;
    const base = tileCenter(view, prop);
    const height = view.tile.w * 1.1;
    const topY = base.y - height;
    const colors = prop.color ? [prop.color, prop.emblem ?? prop.color] : [teamColors.primary, teamColors.secondary];

    ctx.strokeStyle = '#5a3b1e';
    ctx.lineWidth = Math.max(2, view.tile.w * 0.05);
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(base.x, topY);
    ctx.stroke();

    const fw = view.tile.w * 0.55;
    const fh = view.tile.w * 0.36;
    const wave = (t) => Math.sin(time * 3 + t * 4) * fh * 0.08 * t;
    const flag = (y0, y1, color) => {
      ctx.beginPath();
      ctx.moveTo(base.x, y0);
      ctx.lineTo(base.x + fw, y0 + wave(1));
      ctx.lineTo(base.x + fw, y1 + wave(1));
      ctx.lineTo(base.x, y1);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    flag(topY + 2, topY + 2 + fh / 2, colors[0]);
    flag(topY + 2 + fh / 2, topY + 2 + fh, colors[1]);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(base.x, topY + 2, fw, fh);
  },

  pell(view, prop) {
    const { ctx } = view;
    const base = tileCenter(view, prop);
    const height = view.tile.w * 0.5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, view.tile.w * 0.14, view.tile.w * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(base.x - view.tile.w * 0.05, base.y - height, view.tile.w * 0.1, height);
    ctx.fillStyle = '#d9b860';
    ctx.fillRect(base.x - view.tile.w * 0.08, base.y - height * 0.8, view.tile.w * 0.16, height * 0.35);
    ctx.fillStyle = '#5a3b1e';
    ctx.fillRect(base.x - view.tile.w * 0.18, base.y - height * 0.62, view.tile.w * 0.36, view.tile.w * 0.04);
  },

  rack(view, prop) {
    const { ctx } = view;
    const base = tileCenter(view, prop);
    const s = view.tile.w;
    ctx.strokeStyle = '#5a3b1e';
    ctx.lineWidth = Math.max(2, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(base.x - s * 0.2, base.y);
    ctx.lineTo(base.x - s * 0.2, base.y - s * 0.4);
    ctx.moveTo(base.x + s * 0.2, base.y);
    ctx.lineTo(base.x + s * 0.2, base.y - s * 0.4);
    ctx.moveTo(base.x - s * 0.25, base.y - s * 0.32);
    ctx.lineTo(base.x + s * 0.25, base.y - s * 0.32);
    ctx.stroke();
    ctx.strokeStyle = '#b9bec3';
    for (const dx of [-0.12, 0, 0.12]) {
      ctx.beginPath();
      ctx.moveTo(base.x + s * dx, base.y - s * 0.05);
      ctx.lineTo(base.x + s * (dx + 0.05), base.y - s * 0.55);
      ctx.stroke();
    }
  },

  tree(view, prop) {
    const { ctx } = view;
    const base = tileCenter(view, prop);
    const s = view.tile.w * (0.85 + ((prop.x * 7 + prop.y * 13) % 5) * 0.05);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, s * 0.28, s * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(base.x - s * 0.05, base.y - s * 0.25, s * 0.1, s * 0.25);
    // Saison : feuillage (sec en été, roux en automne, vert sombre en hiver, frais au printemps).
    const foliage = seasonFoliage(view.season, prop) ?? ['#2f6b2c', '#3a7d35', '#4a9142'];
    const layers = [[foliage[0], 0.2, 0.62, 0.34], [foliage[1], 0.45, 0.85, 0.27], [foliage[2], 0.68, 1.05, 0.19]];
    for (const [color, bottom, apex, half] of layers) {
      const left = { x: base.x - s * half, y: base.y - s * bottom };
      const right = { x: base.x + s * half, y: base.y - s * bottom };
      const top = { x: base.x, y: base.y - s * apex };
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.lineTo(top.x, top.y);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      // Hiver : neige sur chaque étage.
      if (isWinter(view)) drawSnowCap(view, top, left, right, 0.42);
    }
    // Printemps : fleurs sur certains arbres.
    if (treeBlossoms(view.season, prop)) {
      for (let i = 0; i < 7; i++) {
        const k = (prop.x * 13 + prop.y * 7 + i * 29) % 100;
        ctx.fillStyle = i % 3 ? '#f6c3d2' : '#fff6f8';
        ctx.beginPath();
        ctx.arc(base.x + s * ((k % 40) - 20) / 100, base.y - s * (0.35 + (k % 50) / 100), s * 0.028, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // Grand pin (v1.1, Le Sentier) : tronc haut, quatre étages d'aiguilles sombres.
  pine(view, prop) {
    const { ctx } = view;
    const base = tileCenter(view, prop);
    const s = view.tile.w * (1.3 + ((prop.x * 11 + prop.y * 5) % 5) * 0.08);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.24)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, s * 0.2, s * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3b22';
    ctx.fillRect(base.x - s * 0.035, base.y - s * 0.3, s * 0.07, s * 0.3);
    const dark = isWinter(view) ? ['#1f4a33', '#245238', '#2a5a3e', '#306244'] : ['#1d4f2f', '#235a35', '#2a643b', '#316e42'];
    const layers = [[dark[0], 0.22, 0.6, 0.26], [dark[1], 0.42, 0.8, 0.21], [dark[2], 0.6, 0.98, 0.16], [dark[3], 0.78, 1.15, 0.1]];
    for (const [color, bottom, apex, half] of layers) {
      const left = { x: base.x - s * half, y: base.y - s * bottom };
      const right = { x: base.x + s * half, y: base.y - s * bottom };
      const top = { x: base.x, y: base.y - s * apex };
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.lineTo(top.x, top.y);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      if (isWinter(view)) drawSnowCap(view, top, left, right, 0.38);
    }
  },

  // Cabane de chasseur (v1.1) : rondins, toit de bardeaux, cheminée, bois de cerf au-dessus de la porte.
  cabin(view, prop) {
    const { ctx } = view;
    const { x, y, w = 2, h = 2 } = prop;
    const H = view.tile.w * 0.42;
    const D = view.toScreen(x, y + h);
    const C = view.toScreen(x + w, y + h);
    const B = view.toScreen(x + w, y);
    PROP_RENDERERS.building(view, { ...prop, w, h, wall: '#8a5a32', roof: '#4a3a2a', height: 0.85 });
    // Rondins : lignes sur les deux murs visibles.
    ctx.strokeStyle = 'rgba(45, 25, 10, 0.55)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 5; k++) {
      const dy = (H * k) / 5;
      ctx.beginPath();
      ctx.moveTo(D.x, D.y - dy);
      ctx.lineTo(C.x, C.y - dy);
      ctx.lineTo(B.x, B.y - dy);
      ctx.stroke();
    }
    // Cheminée de pierre, et sa fumée.
    const top = view.toScreen(x + w * 0.7, y + h * 0.3);
    const cx = top.x;
    const cy = top.y - H - view.tile.w * 0.45;
    ctx.fillStyle = '#7d7468';
    ctx.fillRect(cx - view.tile.w * 0.06, cy - view.tile.w * 0.1, view.tile.w * 0.12, view.tile.w * 0.28);
    if (!fireOut(view)) {
      ctx.fillStyle = 'rgba(220, 220, 220, 0.45)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(cx + i * view.tile.w * 0.06, cy - view.tile.w * (0.18 + i * 0.12), view.tile.w * (0.05 + i * 0.02), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Bois de cerf au-dessus de la porte (mur avant).
    const door = { x: (D.x + C.x) / 2, y: (D.y + C.y) / 2 - H * 0.82 };
    ctx.strokeStyle = '#e8dcc0';
    ctx.lineWidth = Math.max(1, view.tile.w * 0.02);
    ctx.beginPath();
    ctx.moveTo(door.x - view.tile.w * 0.1, door.y - view.tile.w * 0.08);
    ctx.lineTo(door.x, door.y);
    ctx.lineTo(door.x + view.tile.w * 0.1, door.y - view.tile.w * 0.08);
    ctx.stroke();
  },

  // Bêtes (v1.1) : poule, chien, cerf, chèvre — un peu de vie autour de la lice.
  animal(view, prop, env = {}) {
    const { ctx } = view;
    const base = tileCenter(view, prop);
    const u = view.tile.w;
    const t = env.time ?? 0;
    const kind = prop.kind ?? 'dog';
    const looks = {
      hen: { body: '#f2ece0', dark: '#c44a2a', size: 0.11, legs: 0.05, neck: 0.08 },
      dog: { body: '#9a6a3c', dark: '#5e3e20', size: 0.16, legs: 0.08, neck: 0.07 },
      deer: { body: '#a8743e', dark: '#6b4524', size: 0.22, legs: 0.17, neck: 0.16 },
      goat: { body: '#e6e0d2', dark: '#7b6f5e', size: 0.16, legs: 0.1, neck: 0.09 },
    };
    const look = looks[kind] ?? looks.dog;
    const bob = Math.sin(t * (kind === 'hen' ? 5 : 2) + prop.x * 3 + prop.y) * u * 0.012;
    const s = u * look.size;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, s * 1.1, s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    const by = base.y - u * look.legs - s * 0.4 + bob;
    // Pattes.
    ctx.strokeStyle = look.dark;
    ctx.lineWidth = Math.max(1, u * 0.018);
    for (const dx of kind === 'hen' ? [-0.2, 0.2] : [-0.6, -0.3, 0.3, 0.6]) {
      ctx.beginPath();
      ctx.moveTo(base.x + s * dx, by + s * 0.3);
      ctx.lineTo(base.x + s * dx, base.y);
      ctx.stroke();
    }
    // Corps et tête.
    ctx.fillStyle = look.body;
    ctx.beginPath();
    ctx.ellipse(base.x, by, s, s * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 25, 10, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const hx = base.x + s * 0.95;
    const hy = by - u * look.neck;
    ctx.fillStyle = look.body;
    ctx.beginPath();
    ctx.ellipse(hx, hy, s * 0.38, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (kind === 'hen') {
      ctx.fillStyle = look.dark;
      ctx.beginPath();
      ctx.arc(hx, hy - s * 0.3, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'deer' || kind === 'goat') {
      ctx.strokeStyle = kind === 'deer' ? '#e8dcc0' : '#8a7a62';
      ctx.lineWidth = Math.max(1, u * 0.015);
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.1, hy - s * 0.2);
      ctx.lineTo(hx - s * 0.25, hy - s * (kind === 'deer' ? 0.85 : 0.5));
      ctx.moveTo(hx + s * 0.1, hy - s * 0.2);
      ctx.lineTo(hx + s * 0.25, hy - s * (kind === 'deer' ? 0.85 : 0.5));
      ctx.stroke();
    } else {
      ctx.fillStyle = look.dark;
      ctx.beginPath();
      ctx.ellipse(hx - s * 0.2, hy - s * 0.15, s * 0.1, s * 0.2, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  stump(view, prop) {
    const { ctx } = view;
    const base = tileCenter(view, prop);
    const s = view.tile.w;
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(base.x - s * 0.12, base.y - s * 0.12, s * 0.24, s * 0.12);
    ctx.fillStyle = '#c9a26a';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y - s * 0.12, s * 0.12, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5230';
    ctx.stroke();
  },

  // Petite lice : carré de cordes tendues entre quatre poteaux (posé au sol).
  ring(view, prop) {
    const { ctx } = view;
    const inset = 0.25;
    const corners = [
      [prop.x + inset, prop.y + inset], [prop.x + prop.w - inset, prop.y + inset],
      [prop.x + prop.w - inset, prop.y + prop.h - inset], [prop.x + inset, prop.y + prop.h - inset],
    ].map(([gx, gy]) => view.toScreen(gx, gy));
    const postHeight = view.tile.w * 0.32;
    ctx.lineCap = 'round';
    for (const [height, color] of [[0.45, '#f4ecd8'], [0.85, '#b8402f']]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, view.tile.w * 0.025);
      view.tracePolygon(corners.map((p) => up(p, postHeight * height)));
      ctx.stroke();
    }
    ctx.strokeStyle = '#5a3b1e';
    ctx.lineWidth = Math.max(2, view.tile.w * 0.05);
    for (const p of corners) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - postHeight);
      ctx.stroke();
    }
  },

  // Mannequin d'entraînement : poteau, corps de paille, bras en croix.
  dummy(view, prop) {
    const { ctx } = view;
    const base = tileCenter(view, prop);
    const s = view.tile.w;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, s * 0.16, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(base.x - s * 0.03, base.y - s * 0.62, s * 0.06, s * 0.62);
    ctx.fillRect(base.x - s * 0.22, base.y - s * 0.5, s * 0.44, s * 0.05);
    ctx.fillStyle = '#d9b860';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y - s * 0.4, s * 0.11, s * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a8862f';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#e8d08a';
    ctx.beginPath();
    ctx.arc(base.x, base.y - s * 0.66, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  },

  // Botte de foin.
  hay(view, prop) {
    drawBox(view, { x: prop.x, y: prop.y, w: 1, h: 1, inset: 0.18, height: view.tile.w * 0.28,
      top: '#ecd77a', left: '#d6b850', right: '#bf9d3e' });
    const c = up(view.toScreen(prop.x + 0.5, prop.y + 0.5), view.tile.w * 0.28);
    view.ctx.strokeStyle = 'rgba(120, 90, 20, 0.6)';
    view.ctx.lineWidth = 1;
    for (const dx of [-0.12, 0, 0.12]) {
      view.ctx.beginPath();
      view.ctx.moveTo(c.x + view.tile.w * dx - view.tile.w * 0.06, c.y - view.tile.w * 0.02);
      view.ctx.lineTo(c.x + view.tile.w * dx + view.tile.w * 0.06, c.y + view.tile.w * 0.02);
      view.ctx.stroke();
    }
  },

  // Grande table de banquet garnie.
  table(view, prop) {
    const height = view.tile.w * 0.22;
    drawBox(view, { x: prop.x, y: prop.y, w: prop.w, h: prop.h, inset: 0.12, height,
      top: '#9a6a3a', left: '#7a5230', right: '#5f3f24' });
    const { ctx } = view;
    const dishes = Math.max(2, prop.w * 2);
    for (let i = 0; i < dishes; i++) {
      const t = (i + 0.5) / dishes;
      const p = up(view.toScreen(prop.x + t * prop.w, prop.y + prop.h / 2), height);
      ctx.fillStyle = i % 3 === 0 ? '#e8e4da' : i % 3 === 1 ? '#c98b3a' : '#b8402f';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, view.tile.w * 0.07, view.tile.w * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  barrel(view, prop) {
    const { ctx } = view;
    const base = tileCenter(view, prop);
    const s = view.tile.w;
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(base.x - s * 0.13, base.y - s * 0.32, s * 0.26, s * 0.32);
    ctx.fillStyle = '#9a6a3a';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y - s * 0.32, s * 0.13, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 1.5;
    for (const k of [0.1, 0.24]) {
      ctx.beginPath();
      ctx.moveTo(base.x - s * 0.13, base.y - s * k);
      ctx.lineTo(base.x + s * 0.13, base.y - s * k);
      ctx.stroke();
    }
  },

  bush(view, prop) {
    const { ctx } = view;
    const base = tileCenter(view, prop);
    const s = view.tile.w * (0.85 + (((prop.x * 5 + prop.y * 3) % 4) * 0.06));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, s * 0.26, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    const tones = seasonVisuals(view.season)?.bush ?? ['#3f7d38', '#3a7534', '#4f9446'];
    for (const [dx, dy, r, color] of [[-0.12, -0.1, 0.15, tones[0]], [0.12, -0.1, 0.15, tones[1]], [0, -0.2, 0.17, tones[2]]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(base.x + s * dx, base.y + s * dy, s * r, 0, Math.PI * 2);
      ctx.fill();
      // Hiver : neige sur le dessus de chaque boule.
      if (isWinter(view)) {
        ctx.fillStyle = SNOW_COLOR;
        ctx.beginPath();
        ctx.arc(base.x + s * dx, base.y + s * dy, s * r, Math.PI * 1.08, Math.PI * 1.92);
        ctx.closePath();
        ctx.fill();
      }
    }
  },

  rock(view, prop) {
    const { ctx } = view;
    const base = tileCenter(view, prop);
    const s = view.tile.w;
    ctx.fillStyle = '#8f9396';
    ctx.beginPath();
    ctx.moveTo(base.x - s * 0.2, base.y);
    ctx.lineTo(base.x - s * 0.12, base.y - s * 0.16);
    ctx.lineTo(base.x + s * 0.06, base.y - s * 0.2);
    ctx.lineTo(base.x + s * 0.2, base.y - s * 0.04);
    ctx.lineTo(base.x + s * 0.14, base.y + s * 0.03);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5f6366';
    ctx.lineWidth = 1;
    ctx.stroke();
  },

  // Montagne (v0.96, Les Expéditions) : pic rocheux sur plusieurs cases (w × h), deux faces
  // éclairées, arêtes, éboulis, et un sommet enneigé (davantage en hiver). height : hauteur du
  // pic en largeurs de case ; tone : couleur de la roche.
  mountain(view, prop) {
    const { ctx } = view;
    const w = prop.w ?? 1;
    const h = prop.h ?? 1;
    const tone = prop.tone ?? '#8a8680';
    const N = view.toScreen(prop.x, prop.y);
    const E = view.toScreen(prop.x + w, prop.y);
    const S = view.toScreen(prop.x + w, prop.y + h);
    const W = view.toScreen(prop.x, prop.y + h);
    const c = view.toScreen(prop.x + w / 2, prop.y + h / 2);
    const apex = up({ x: c.x + view.tile.w * 0.04 * (w - h), y: c.y }, view.tile.w * (prop.height ?? 1.6));
    // Faces arrière (à peine visibles), puis faces avant : gauche éclairée, droite à l'ombre.
    fillPoly(view, [W, N, apex], shade(tone, -0.12), 'rgba(40, 35, 30, 0.35)');
    fillPoly(view, [N, E, apex], shade(tone, -0.22), 'rgba(40, 35, 30, 0.35)');
    fillPoly(view, [W, S, apex], shade(tone, 0.06), 'rgba(40, 35, 30, 0.45)');
    fillPoly(view, [S, E, apex], shade(tone, -0.18), 'rgba(40, 35, 30, 0.45)');
    // Arêtes et strates.
    ctx.strokeStyle = 'rgba(50, 45, 40, 0.45)';
    ctx.lineWidth = Math.max(1, view.tile.w * 0.02);
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(S.x, S.y);
    for (const k of [0.45, 0.68]) {
      const a = lerp(apex, W, k);
      const b = lerp(apex, S, k);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(lerp(a, b, 0.55).x, lerp(a, b, 0.55).y + view.tile.w * 0.05);
      const d = lerp(apex, E, k);
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(lerp(b, d, 0.5).x, lerp(b, d, 0.5).y + view.tile.w * 0.04);
    }
    ctx.stroke();
    // Neige au sommet : toujours un peu, beaucoup en hiver.
    const snow = isWinter(view) ? 0.62 : view.season === 'summer' ? 0.18 : 0.3;
    drawSnowCap(view, apex, W, S, snow);
    drawSnowCap(view, apex, S, E, snow * 0.9);
    // Éboulis au pied.
    ctx.fillStyle = shade(tone, -0.05);
    for (let i = 0; i < 4; i++) {
      const p = lerp(W, S, 0.15 + i * 0.22);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - view.tile.w * 0.02, view.tile.w * 0.07, view.tile.w * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Touffes de fleurs (posées au sol).
  flowers(view, prop) {
    const { ctx } = view;
    const base = tileCenter(view, prop);
    const s = view.tile.w;
    // Saison sans fleurs : petite bosse de neige (hiver) ou fleurs fanées (automne).
    const look = seasonVisuals(view.season);
    if (look && !look.flowers) {
      ctx.fillStyle = isWinter(view) ? SNOW_COLOR : '#8a6a3a';
      ctx.beginPath();
      ctx.ellipse(base.x, base.y, s * (isWinter(view) ? 0.16 : 0.08), s * (isWinter(view) ? 0.06 : 0.03), 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const colors = ['#f4ecd8', '#e0b43a', '#c0533a', '#8a5bb0'];
    for (let i = 0; i < 5; i++) {
      const angle = (prop.x * 7 + prop.y * 11 + i * 73) % 360 * (Math.PI / 180);
      const radius = s * (0.08 + (i % 3) * 0.05);
      ctx.fillStyle = colors[(prop.x + prop.y + i) % colors.length];
      ctx.beginPath();
      ctx.arc(base.x + Math.cos(angle) * radius, base.y + Math.sin(angle) * radius * 0.5, s * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Tente de camp rayée.
  tent(view, prop) {
    const { x, y } = prop;
    const w = prop.w ?? 2;
    const h = prop.h ?? 2;
    const inset = 0.25;
    const A = view.toScreen(x + inset, y + inset);
    const B = view.toScreen(x + w - inset, y + inset);
    const C = view.toScreen(x + w - inset, y + h - inset);
    const D = view.toScreen(x + inset, y + h - inset);
    const peak = up(view.toScreen(x + w / 2, y + h / 2), view.tile.w * 0.9);
    fillPoly(view, [A, B, peak], shade(prop.color, -0.25));
    fillPoly(view, [A, D, peak], shade(prop.color, -0.12));
    fillPoly(view, [D, C, peak], prop.color);
    fillPoly(view, [C, B, peak], shade(prop.color, -0.18));
    // Bandes et entrée.
    const { ctx } = view;
    ctx.strokeStyle = prop.stripe;
    ctx.lineWidth = Math.max(2, view.tile.w * 0.05);
    for (const t of [0.3, 0.7]) {
      const p = lerp(D, C, t);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(peak.x + (p.x - peak.x) * 0.05, peak.y + (p.y - peak.y) * 0.05);
      ctx.stroke();
    }
    fillPoly(view, [lerp(D, C, 0.42), lerp(D, C, 0.58), lerp(lerp(D, C, 0.5), peak, 0.45)], '#3a2a1a');
    // Hiver : neige sur le haut de la toile.
    if (isWinter(view)) {
      drawSnowCap(view, peak, A, D, 0.38);
      drawSnowCap(view, peak, D, C, 0.38);
      drawSnowCap(view, peak, C, B, 0.38);
    }
    ctx.strokeStyle = '#5a3b1e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(peak.x, peak.y);
    ctx.lineTo(peak.x, peak.y - view.tile.w * 0.18);
    ctx.stroke();
    ctx.fillStyle = prop.stripe;
    ctx.fillRect(peak.x, peak.y - view.tile.w * 0.18, view.tile.w * 0.14, view.tile.w * 0.08);
  },

  well(view, prop) {
    drawBox(view, { x: prop.x, y: prop.y, w: 1, h: 1, inset: 0.2, height: view.tile.w * 0.16,
      top: '#4f97c9', left: '#9a9fa3', right: '#7d8286' });
    const { ctx } = view;
    const c = view.toScreen(prop.x + 0.5, prop.y + 0.5);
    const s = view.tile.w;
    ctx.strokeStyle = '#5a3b1e';
    ctx.lineWidth = Math.max(2, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(c.x - s * 0.24, c.y - s * 0.08);
    ctx.lineTo(c.x - s * 0.24, c.y - s * 0.55);
    ctx.moveTo(c.x + s * 0.24, c.y - s * 0.08);
    ctx.lineTo(c.x + s * 0.24, c.y - s * 0.55);
    ctx.stroke();
    fillPoly(view, [
      { x: c.x - s * 0.34, y: c.y - s * 0.5 }, { x: c.x, y: c.y - s * 0.72 },
      { x: c.x + s * 0.34, y: c.y - s * 0.5 },
    ], '#a8452f');
  },

  campfire(view, prop, { time }) {
    const { ctx } = view;
    const base = tileCenter(view, prop);
    const s = view.tile.w;
    ctx.fillStyle = '#8f9396';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(base.x + Math.cos(a) * s * 0.2, base.y + Math.sin(a) * s * 0.1, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    // Hiver : feu éteint — bûches noircies, cendres, aucune flamme (ni fumée : ambiance).
    if (fireOut(view)) {
      ctx.strokeStyle = '#2e241c';
      ctx.lineWidth = Math.max(2, s * 0.05);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(base.x - s * 0.13, base.y - s * 0.02);
      ctx.lineTo(base.x + s * 0.12, base.y - s * 0.06);
      ctx.moveTo(base.x - s * 0.1, base.y - s * 0.07);
      ctx.lineTo(base.x + s * 0.13, base.y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(150, 146, 140, 0.8)';
      ctx.beginPath();
      ctx.ellipse(base.x, base.y - s * 0.01, s * 0.08, s * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = SNOW_COLOR;
      ctx.beginPath();
      ctx.ellipse(base.x + s * 0.05, base.y - s * 0.07, s * 0.05, s * 0.018, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const flicker = 1 + Math.sin(time * 9) * 0.12;
    for (const [color, height, width] of [['#d4702a', 0.38, 0.14], ['#e0b43a', 0.26, 0.09]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(base.x - s * width, base.y);
      ctx.quadraticCurveTo(base.x, base.y - s * height * flicker * 1.4, base.x + s * width, base.y);
      ctx.closePath();
      ctx.fill();
    }
  },

  // Pont de planches au-dessus de l'eau (posé au sol).
  bridge(view, prop) {
    const { ctx } = view;
    const w = prop.w ?? 1;
    const h = prop.h ?? 1;
    view.traceArea(prop.x, prop.y + 0.1, w, h - 0.2);
    ctx.fillStyle = '#9a6a3a';
    ctx.fill();
    ctx.strokeStyle = '#5a3b1e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 1; i < w * 4; i++) {
      const a = view.toScreen(prop.x + i / 4, prop.y + 0.1);
      const b = view.toScreen(prop.x + i / 4, prop.y + h - 0.1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  },

  // L'eau est dessinée avec le sol : pas de volume.
  water() {},

  // Poteau indicateur au bout d'un chemin qui mène à un autre lieu (sorties, data/locations.js) :
  // planche tournée vers la sortie (`pointing` : 1 = droite de l'écran, −1 = gauche).
  signpost(view, prop, { time = 0 } = {}) {
    const { ctx } = view;
    const base = view.toScreen(prop.x, prop.y);
    const s = view.tile.w;
    const dir = prop.pointing ?? 1;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, s * 0.1, s * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a3b1e';
    ctx.fillRect(base.x - s * 0.025, base.y - s * 0.62, s * 0.05, s * 0.62);
    // Planche en flèche, légèrement balancée par le vent.
    const sway = Math.sin(time * 1.3 + prop.x) * s * 0.006;
    const y = base.y - s * 0.52 + sway;
    const w = s * 0.34;
    const h = s * 0.11;
    ctx.beginPath();
    ctx.moveTo(base.x - dir * w * 0.25, y - h / 2);
    ctx.lineTo(base.x + dir * w * 0.75, y - h / 2);
    ctx.lineTo(base.x + dir * w, y);
    ctx.lineTo(base.x + dir * w * 0.75, y + h / 2);
    ctx.lineTo(base.x - dir * w * 0.25, y + h / 2);
    ctx.closePath();
    ctx.fillStyle = prop.highlighted ? '#e9c46a' : '#a8743a';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#3a2412';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(58, 36, 18, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(base.x, y - h * 0.15);
    ctx.lineTo(base.x + dir * w * 0.6, y - h * 0.15);
    ctx.moveTo(base.x, y + h * 0.15);
    ctx.lineTo(base.x + dir * w * 0.5, y + h * 0.15);
    ctx.stroke();
  },

  // Barrière de bois en travers d'un chemin (lieu pas encore ouvert).
  barrier(view, prop) {
    const { ctx } = view;
    const s = view.tile.w;
    const a = view.toScreen(prop.from.x, prop.from.y);
    const b = view.toScreen(prop.to.x, prop.to.y);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#5a3b1e';
    ctx.lineWidth = Math.max(2, s * 0.05);
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - s * 0.32);
      ctx.stroke();
    }
    for (const [height, color] of [[0.26, '#8a5f34'], [0.14, '#7a5230']]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, s * 0.045);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - s * height);
      ctx.lineTo(b.x, b.y - s * height);
      ctx.stroke();
    }
  },

  // Touffe d'herbes sèches (terrain sablonneux).
  tuft(view, prop) {
    const { ctx } = view;
    const base = tileCenter(view, prop);
    const s = view.tile.w;
    const seed = prop.x * 7 + prop.y * 13;
    ctx.lineWidth = Math.max(1, s * 0.022);
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const lean = ((seed + i * 37) % 9 - 4) * 0.035;
      const height = s * (0.16 + ((seed + i * 11) % 5) * 0.025);
      const tuftTones = seasonVisuals(view.season)?.tuft ?? ['#a89a52', '#c2b065'];
      ctx.strokeStyle = i % 2 ? tuftTones[0] : tuftTones[1];
      ctx.beginPath();
      ctx.moveTo(base.x + (i - 3) * s * 0.025, base.y);
      ctx.quadraticCurveTo(base.x + (i - 3) * s * 0.03, base.y - height * 0.6, base.x + (i - 3) * s * 0.03 + lean * s, base.y - height);
      ctx.stroke();
    }
  },

  // Échoppe : comptoir de bois sous un auvent rayé.
  stall(view, prop) {
    // Hiver : auvent couvert de neige (les rayures restent visibles).
    const color = isWinter(view) ? mixColors(prop.color ?? '#b8402f', SNOW_COLOR, 0.7) : prop.color ?? '#b8402f';
    const stripe = prop.stripe ?? '#f4ecd8';
    const s = view.tile.w;
    drawBox(view, { x: prop.x, y: prop.y, w: 1, h: 1, inset: 0.14, height: s * 0.2, top: '#9a6a3a', left: '#7a5230', right: '#5f3f24' });
    const { ctx } = view;
    const goods = up(view.toScreen(prop.x + 0.5, prop.y + 0.5), s * 0.2);
    for (const [dx, c] of [[-0.12, '#c98b3a'], [0, '#7fa83a'], [0.12, '#b8402f']]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(goods.x + s * dx, goods.y - s * 0.02, s * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
    const postH = s * 0.62;
    const corners = [[0.12, 0.12], [0.88, 0.12], [0.88, 0.88], [0.12, 0.88]].map(([u, v]) => view.toScreen(prop.x + u, prop.y + v));
    ctx.strokeStyle = '#5a3b1e';
    ctx.lineWidth = Math.max(1.5, s * 0.03);
    for (const p of corners) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - postH);
      ctx.stroke();
    }
    const roof = corners.map((p) => up(p, postH));
    const peak = [lerp(roof[0], roof[1], 0.5), lerp(roof[3], roof[2], 0.5)].map((p) => up(p, s * 0.12));
    fillPoly(view, [roof[0], roof[1], peak[0]], shade(color, -0.2));
    fillPoly(view, [roof[0], peak[0], peak[1], roof[3]], shade(color, -0.08));
    fillPoly(view, [roof[3], peak[1], peak[0], roof[1], roof[2]], color);
    ctx.strokeStyle = stripe;
    ctx.lineWidth = Math.max(1.5, s * 0.03);
    for (const t of [0.25, 0.5, 0.75]) {
      const a = lerp(roof[3], roof[2], t);
      const b = lerp(peak[1], peak[0], t);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  },

  crate(view, prop) {
    const s = view.tile.w;
    drawBox(view, { x: prop.x, y: prop.y, w: 1, h: 1, inset: 0.28, height: s * 0.24, top: '#b88a52', left: '#9a6a3a', right: '#7a5230' });
    const { ctx } = view;
    const a = up(view.toScreen(prop.x + 0.28, prop.y + 0.72), s * 0.02);
    const b = up(view.toScreen(prop.x + 0.72, prop.y + 0.72), s * 0.22);
    ctx.strokeStyle = '#5a3b1e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  },

  // Charrette à bras : plateau, ridelles, une roue visible, brancards.
  cart(view, prop) {
    const s = view.tile.w;
    const { ctx } = view;
    drawBox(view, { x: prop.x, y: prop.y, w: 1, h: 1, inset: 0.2, height: s * 0.12, top: '#9a6a3a', left: '#7a5230', right: '#5f3f24' });
    const bed = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]].map(([u, v]) => up(view.toScreen(prop.x + u, prop.y + v), s * 0.12));
    fillPoly(view, [bed[3], bed[2], up(bed[2], s * 0.12), up(bed[3], s * 0.12)], '#8a5f34');
    fillPoly(view, [bed[2], bed[1], up(bed[1], s * 0.12), up(bed[2], s * 0.12)], '#6e4a28');
    const wheel = view.toScreen(prop.x + 0.5, prop.y + 0.85);
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = Math.max(2, s * 0.04);
    ctx.beginPath();
    ctx.ellipse(wheel.x, wheel.y - s * 0.12, s * 0.13, s * 0.15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(wheel.x - Math.cos(a) * s * 0.13, wheel.y - s * 0.12 - Math.sin(a) * s * 0.15);
      ctx.lineTo(wheel.x + Math.cos(a) * s * 0.13, wheel.y - s * 0.12 + Math.sin(a) * s * 0.15);
      ctx.stroke();
    }
    const shaft = view.toScreen(prop.x + 0.05, prop.y + 0.5);
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = Math.max(1.5, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(bed[0].x, bed[0].y);
    ctx.lineTo(shaft.x, shaft.y - s * 0.02);
    ctx.stroke();
  },

  // Établi de menuisier : plateau sur pieds, outils et copeaux.
  workbench(view, prop) {
    const s = view.tile.w;
    const { ctx } = view;
    const legH = s * 0.22;
    for (const [u, v] of [[0.2, 0.3], [0.8, 0.3], [0.8, 0.7], [0.2, 0.7]]) {
      const p = view.toScreen(prop.x + u, prop.y + v);
      ctx.strokeStyle = '#5a3b1e';
      ctx.lineWidth = Math.max(2, s * 0.04);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - legH);
      ctx.stroke();
    }
    const top = [[0.12, 0.22], [0.88, 0.22], [0.88, 0.78], [0.12, 0.78]].map(([u, v]) => up(view.toScreen(prop.x + u, prop.y + v), legH));
    fillPoly(view, [top[3], top[2], up(top[2], s * 0.06), up(top[3], s * 0.06)], '#8a5f34');
    fillPoly(view, [top[2], top[1], up(top[1], s * 0.06), up(top[2], s * 0.06)], '#6e4a28');
    fillPoly(view, top.map((p) => up(p, s * 0.06)), '#b88a52');
    // Scie et marteau posés sur le plateau.
    const a = up(view.toScreen(prop.x + 0.3, prop.y + 0.45), legH + s * 0.07);
    const b = up(view.toScreen(prop.x + 0.65, prop.y + 0.45), legH + s * 0.07);
    fillPoly(view, [a, b, { x: b.x, y: b.y + s * 0.05 }, { x: a.x, y: a.y + s * 0.08 }], '#b9bec3');
    const hm = up(view.toScreen(prop.x + 0.55, prop.y + 0.68), legH + s * 0.07);
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(hm.x - s * 0.1, hm.y - s * 0.015, s * 0.2, s * 0.03);
    ctx.fillStyle = '#6b6f73';
    ctx.fillRect(hm.x + s * 0.08, hm.y - s * 0.04, s * 0.05, s * 0.08);
  },

  // Pile de poutres équarries.
  lumber(view, prop) {
    const s = view.tile.w;
    const w = prop.w ?? 1;
    const h = prop.h ?? 1;
    for (let layer = 0; layer < 3; layer++) {
      const lift = s * 0.08 * layer;
      for (let i = 0; i < 3 - (layer % 2); i++) {
        const v0 = 0.2 + i * 0.22 + (layer % 2) * 0.11;
        const corners = [[0.1, v0], [w - 0.1, v0], [w - 0.1, v0 + 0.18], [0.1, v0 + 0.18]]
          .map(([u, v]) => up(view.toScreen(prop.x + u, prop.y + v * h), lift));
        fillPoly(view, [corners[3], corners[2], up(corners[2], s * 0.08), up(corners[3], s * 0.08)], '#b8834a');
        fillPoly(view, [corners[2], corners[1], up(corners[1], s * 0.08), up(corners[2], s * 0.08)], '#8a5f34');
        fillPoly(view, corners.map((p) => up(p, s * 0.08)), '#d4a86a');
      }
    }
  },

  // Pile de troncs (bois de la scierie).
  logs(view, prop) {
    const s = view.tile.w;
    const { ctx } = view;
    const w = prop.w ?? 1;
    const rows = [[0.25, 0], [0.55, 0], [0.85, 0], [0.4, 1], [0.7, 1]];
    for (const [v, layer] of rows) {
      const a = up(view.toScreen(prop.x + 0.12, prop.y + v), s * (0.1 + layer * 0.16));
      const b = up(view.toScreen(prop.x + w - 0.12, prop.y + v), s * (0.1 + layer * 0.16));
      ctx.strokeStyle = '#5a3b1e';
      ctx.lineWidth = s * 0.17;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = '#7a5230';
      ctx.lineWidth = s * 0.13;
      ctx.stroke();
      ctx.fillStyle = '#d9b479';
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, s * 0.075, s * 0.065, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a8823a';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  },

  // Scierie : hangar ouvert sur poteaux, grande lame circulaire, roue à eau.
  sawmill(view, prop) {
    const s = view.tile.w;
    const { ctx } = view;
    const { x, y, w = 2, h = 2 } = prop;
    drawBox(view, { x, y, w, h, inset: 0.1, height: s * 0.12, top: '#9a7a52', left: '#7a5a34', right: '#5f4426' });
    const postH = s * 0.95;
    const corners = [[0.15, 0.15], [w - 0.15, 0.15], [w - 0.15, h - 0.15], [0.15, h - 0.15]].map(([u, v]) => view.toScreen(x + u, y + v));
    ctx.strokeStyle = '#5a3b1e';
    ctx.lineWidth = Math.max(2, s * 0.05);
    for (const p of corners) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - postH);
      ctx.stroke();
    }
    // Lame circulaire.
    const c = up(view.toScreen(x + w / 2, y + h / 2), s * 0.32);
    ctx.fillStyle = '#c8ccd0';
    ctx.beginPath();
    ctx.arc(c.x, c.y, s * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6b6f73';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c.x + Math.cos(a) * s * 0.24, c.y + Math.sin(a) * s * 0.24);
      ctx.lineTo(c.x + Math.cos(a + 0.2) * s * 0.29, c.y + Math.sin(a + 0.2) * s * 0.29);
      ctx.stroke();
    }
    // Toit à deux pans.
    const roof = corners.map((p) => up(p, postH));
    const r1 = up(lerp(roof[0], roof[3], 0.5), s * 0.35);
    const r2 = up(lerp(roof[1], roof[2], 0.5), s * 0.35);
    // Hiver : toit sous la neige (le pignon reste en bois).
    const snowy = (color) => (isWinter(view) ? mixColors(color, SNOW_COLOR, 0.8) : color);
    fillPoly(view, [roof[0], roof[1], r2, r1], snowy('#6b4a2b'));
    fillPoly(view, [roof[3], roof[2], r2, r1], snowy('#8a6235'));
    fillPoly(view, [roof[2], roof[1], r2], '#5a3b1e');
  },

  // Bureau du Sénéchal : table, registre ouvert, plume, petit pupitre.
  desk(view, prop) {
    const s = view.tile.w;
    drawBox(view, { x: prop.x, y: prop.y, w: 1, h: 1, inset: 0.18, height: s * 0.24, top: '#7a4a2a', left: '#5f3a20', right: '#4a2d18' });
    const { ctx } = view;
    const book = up(view.toScreen(prop.x + 0.5, prop.y + 0.5), s * 0.25);
    ctx.fillStyle = '#f4ecd8';
    ctx.beginPath();
    ctx.moveTo(book.x - s * 0.15, book.y);
    ctx.lineTo(book.x, book.y - s * 0.05);
    ctx.lineTo(book.x + s * 0.15, book.y);
    ctx.lineTo(book.x, book.y + s * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a3a2a';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = '#f4f1e8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(book.x + s * 0.12, book.y - s * 0.02);
    ctx.lineTo(book.x + s * 0.2, book.y - s * 0.16);
    ctx.stroke();
  },

  // Four à pain du Boulanger : socle de pierre, dôme d'argile, gueule rougeoyante, fumée.
  breadOven(view, prop, { time = 0 } = {}) {
    const s = view.tile.w;
    const { ctx } = view;
    drawBox(view, { x: prop.x, y: prop.y, w: 1, h: 1, inset: 0.08, height: s * 0.16, top: '#a39a8a', left: '#8a8274', right: '#6f685c' });
    const base = up(tileCenter(view, prop), s * 0.16);
    // Dôme.
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, s * 0.36, s * 0.32, 0, Math.PI, 0);
    ctx.ellipse(base.x, base.y, s * 0.36, s * 0.12, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#c47a4a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 25, 10, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(base.x - s * 0.08, base.y - s * 0.2, s * 0.12, s * 0.05, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 220, 180, 0.25)';
    ctx.fill();
    // Gueule du four : braise qui vacille.
    const glow = 0.75 + 0.25 * Math.sin(time * 5 + prop.x);
    const mouth = { x: base.x + s * 0.1, y: base.y + s * 0.02 };
    ctx.beginPath();
    ctx.ellipse(mouth.x, mouth.y, s * 0.11, s * 0.09, 0, Math.PI, 0);
    ctx.lineTo(mouth.x + s * 0.11, mouth.y + s * 0.02);
    ctx.lineTo(mouth.x - s * 0.11, mouth.y + s * 0.02);
    ctx.closePath();
    ctx.fillStyle = '#2a1a10';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(mouth.x, mouth.y + s * 0.005, s * 0.07, s * 0.04, 0, Math.PI, 0);
    ctx.fillStyle = `rgba(255, ${Math.round(120 + 60 * glow)}, 40, ${0.85 * glow})`;
    ctx.fill();
    // Cheminée et fumée.
    const chimney = { x: base.x - s * 0.14, y: base.y - s * 0.26 };
    ctx.fillStyle = '#8a8274';
    ctx.fillRect(chimney.x - s * 0.04, chimney.y - s * 0.14, s * 0.08, s * 0.14);
    for (let i = 0; i < 3; i++) {
      const t = (time * 0.4 + i / 3) % 1;
      ctx.beginPath();
      ctx.arc(chimney.x + Math.sin(t * 6 + i) * s * 0.05, chimney.y - s * 0.16 - t * s * 0.5, s * (0.04 + t * 0.06), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(235, 230, 222, ${0.55 * (1 - t)})`;
      ctx.fill();
    }
  },

  // Sacs de farine (toile écrue, liens, un peu de farine répandue).
  flourSacks(view, prop) {
    const s = view.tile.w;
    const { ctx } = view;
    const c = tileCenter(view, prop);
    ctx.beginPath();
    ctx.ellipse(c.x + s * 0.04, c.y + s * 0.03, s * 0.3, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250, 248, 240, 0.6)';
    ctx.fill();
    for (const [dx, dy, scale] of [[-0.14, -0.02, 1], [0.13, 0.02, 0.92], [0, 0.07, 0.85]]) {
      const x = c.x + dx * s;
      const y = c.y + dy * s;
      const w = s * 0.13 * scale;
      const hgt = s * 0.3 * scale;
      ctx.beginPath();
      ctx.moveTo(x - w, y);
      ctx.quadraticCurveTo(x - w * 1.25, y - hgt * 0.6, x - w * 0.55, y - hgt);
      ctx.lineTo(x + w * 0.55, y - hgt);
      ctx.quadraticCurveTo(x + w * 1.25, y - hgt * 0.6, x + w, y);
      ctx.closePath();
      ctx.fillStyle = '#e9dfc6';
      ctx.fill();
      ctx.strokeStyle = 'rgba(90, 70, 40, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, y - hgt * 0.84);
      ctx.lineTo(x + w * 0.5, y - hgt * 0.84);
      ctx.stroke();
      ctx.fillStyle = 'rgba(120, 90, 50, 0.35)';
      ctx.fillRect(x - w * 0.35, y - hgt * 0.5, w * 0.7, hgt * 0.12);
    }
  },

  // Étal du Boulanger : table chargée de miches et de pains longs.
  breadStall(view, prop) {
    const s = view.tile.w;
    const { ctx } = view;
    drawBox(view, { x: prop.x, y: prop.y, w: 1, h: 1, inset: 0.14, height: s * 0.22, top: '#b88a52', left: '#8a5f34', right: '#6e4a28' });
    const top = up(tileCenter(view, prop), s * 0.22);
    const loaf = (dx, dy, rx, ry, color) => {
      ctx.beginPath();
      ctx.ellipse(top.x + dx * s, top.y + dy * s, rx * s, ry * s, -0.35, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(70, 40, 15, 0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    loaf(-0.12, -0.02, 0.1, 0.065, '#b9763a');
    loaf(0.1, 0.01, 0.1, 0.065, '#a8652e');
    loaf(-0.01, 0.06, 0.16, 0.045, '#c88a48');
    loaf(0.02, -0.07, 0.08, 0.055, '#9a5a28');
    ctx.strokeStyle = 'rgba(255, 235, 200, 0.7)';
    ctx.lineWidth = 1;
    for (const dx of [-0.05, 0.03, 0.09]) {
      ctx.beginPath();
      ctx.moveTo(top.x + dx * s - s * 0.02, top.y + s * 0.07);
      ctx.lineTo(top.x + dx * s + s * 0.02, top.y + s * 0.05);
      ctx.stroke();
    }
  },

  // Pétrin : auge de bois où lève la pâte.
  kneadingTrough(view, prop) {
    const s = view.tile.w;
    const { ctx } = view;
    drawBox(view, { x: prop.x, y: prop.y, w: 1, h: 1, inset: 0.22, height: s * 0.2, top: '#7a5230', left: '#8a5f34', right: '#6e4a28' });
    const top = up(tileCenter(view, prop), s * 0.2);
    ctx.beginPath();
    ctx.ellipse(top.x, top.y, s * 0.17, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f1e2c2';
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 90, 50, 0.5)';
    ctx.stroke();
  },

  // Tour carrée de forteresse : pierre nue, archère, merlons (sobre, sans ornement).
  tower(view, prop) {
    const s = view.tile.w;
    const height = s * 1.35;
    drawBox(view, { x: prop.x, y: prop.y, w: 1, h: 1, inset: 0.04, height, top: '#aaa498', left: '#948f86', right: '#7a766e' });
    const { ctx } = view;
    // Archère sur la face visible.
    const slit = up(view.toScreen(prop.x + 0.5, prop.y + 0.96), height * 0.62);
    ctx.fillStyle = '#3a3630';
    ctx.fillRect(slit.x - s * 0.02, slit.y - s * 0.12, s * 0.04, s * 0.16);
    // Merlons aux quatre coins.
    for (const [u, v] of [[0.04, 0.04], [0.68, 0.04], [0.68, 0.68], [0.04, 0.68]]) {
      const A = up(view.toScreen(prop.x + u, prop.y + v), height);
      const B = up(view.toScreen(prop.x + u + 0.28, prop.y + v), height);
      const C = up(view.toScreen(prop.x + u + 0.28, prop.y + v + 0.28), height);
      const D = up(view.toScreen(prop.x + u, prop.y + v + 0.28), height);
      const m = s * 0.18;
      fillPoly(view, [D, C, up(C, m), up(D, m)], '#948f86');
      fillPoly(view, [C, B, up(B, m), up(C, m)], '#7a766e');
      fillPoly(view, [A, B, C, D].map((p) => up(p, m)), '#aaa498');
    }
  },

  // Rang de vigne (Château de Gabarnac) : piquets, fil de palissage, ceps feuillus balancés par
  // le vent, grappes. `dir` : 'x' (rang le long des x) ou 'y'. `grape` : couleur des grappes.
  vine(view, prop, { time = 0 } = {}) {
    const { ctx } = view;
    const s = view.tile.w;
    const along = prop.dir === 'y'
      ? (t) => view.toScreen(prop.x + 0.5, prop.y + t)
      : (t) => view.toScreen(prop.x + t, prop.y + 0.5);
    const stakeH = s * 0.42;
    // Ombre du rang.
    const a = along(0.05);
    const b = along(0.95);
    ctx.strokeStyle = 'rgba(40, 30, 10, 0.22)';
    ctx.lineWidth = s * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // Piquets et fil.
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = Math.max(1.5, s * 0.03);
    for (const p of [a, b]) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - stakeH);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(70, 60, 50, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - stakeH * 0.8);
    ctx.lineTo(b.x, b.y - stakeH * 0.8);
    ctx.stroke();
    // Ceps : trois touffes de feuilles qui ondulent au vent (phase selon la position : une vague
    // traverse les rangs).
    const phase = prop.x * 0.55 + prop.y * 0.35;
    const greens = ['#4f8a3a', '#5e9a44', '#447c33'];
    for (let i = 0; i < 3; i++) {
      const t = 0.2 + i * 0.3;
      const p = along(t);
      const sway = Math.sin(time * 1.7 + phase + i * 0.9) * s * 0.035 + Math.sin(time * 4.1 + phase * 2 + i) * s * 0.01;
      ctx.strokeStyle = '#5a3b1e';
      ctx.lineWidth = Math.max(1.2, s * 0.025);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + sway * 0.3, p.y - s * 0.15, p.x + sway * 0.6, p.y - s * 0.26);
      ctx.stroke();
      for (const [dx, dy, r, k] of [[-0.09, -0.3, 0.1, 0], [0.09, -0.31, 0.1, 1], [0, -0.4, 0.11, 2], [0, -0.24, 0.09, 1]]) {
        ctx.fillStyle = greens[(k + i + prop.x) % greens.length];
        ctx.beginPath();
        ctx.arc(p.x + s * dx + sway, p.y + s * dy, s * r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Grappe.
      if ((prop.x + prop.y + i) % 2 === 0) {
        ctx.fillStyle = prop.grape ?? '#5b2a4e';
        for (const [gx, gy] of [[0, 0], [-0.025, -0.03], [0.025, -0.03], [0, -0.055]]) {
          ctx.beginPath();
          ctx.arc(p.x + sway * 0.8 + s * (0.05 + gx), p.y - s * (0.2 - gy), s * 0.022, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  },

  // Panneau d'affichage (tableau de la Coupe) : deux poteaux, une planche couverte d'affiches.
  noticeBoard(view, prop, { time = 0 } = {}) {
    const { ctx } = view;
    const s = view.tile.w;
    const base = tileCenter(view, prop);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, s * 0.34, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    const w = s * 0.62;
    const hgt = s * 0.42;
    const top = base.y - s * 0.95;
    ctx.fillStyle = '#5a3b1e';
    for (const dx of [-w * 0.42, w * 0.42]) ctx.fillRect(base.x + dx - s * 0.03, top, s * 0.06, base.y - top);
    ctx.fillStyle = '#8a6235';
    ctx.strokeStyle = '#4a2f16';
    ctx.lineWidth = 2;
    ctx.fillRect(base.x - w / 2, top, w, hgt);
    ctx.strokeRect(base.x - w / 2, top, w, hgt);
    // Petit toit.
    fillPoly(view, [
      { x: base.x - w * 0.6, y: top + s * 0.02 }, { x: base.x, y: top - s * 0.16 }, { x: base.x + w * 0.6, y: top + s * 0.02 },
    ], '#7a3a2a');
    // Affiches (l'une frémit au vent).
    const sheets = [[-0.2, 0.08, 0.17, 0.2, '#f1e6c8'], [0.02, 0.06, 0.16, 0.13, '#efe0bd'], [0.03, 0.22, 0.2, 0.12, '#f6eed8'], [-0.22, 0.3, 0.14, 0.08, '#e9d9b4']];
    sheets.forEach(([dx, dy, sw, sh, color], i) => {
      const flutter = i === 1 ? Math.sin(time * 3 + prop.x) * s * 0.01 : 0;
      ctx.fillStyle = color;
      ctx.fillRect(base.x + dx * s, top + dy * s + flutter, sw * s, sh * s);
      ctx.fillStyle = 'rgba(90, 60, 30, 0.45)';
      for (let k = 1; k < 3; k++) ctx.fillRect(base.x + dx * s + sw * s * 0.15, top + dy * s + flutter + (sh * s * k) / 3.2, sw * s * 0.7, 1);
    });
    // Sceau doré : tableau de la Coupe.
    ctx.fillStyle = '#c9a23a';
    ctx.beginPath();
    ctx.arc(base.x + s * 0.18, top + s * 0.12, s * 0.035, 0, Math.PI * 2);
    ctx.fill();
  },

  // Porte fortifiée : bloc de rempart percé d'une arche, herse relevée, deux flammes.
  castleGate(view, prop, { time = 0 } = {}) {
    const s = view.tile.w;
    const w = prop.w ?? 2;
    const height = s * 1.25;
    drawBox(view, { x: prop.x, y: prop.y, w, h: 1, height, top: '#b5afa3', left: '#9a958c', right: '#7f7a72' });
    const { ctx } = view;
    // Arche sur la face avant (côté y + 1).
    const L = view.toScreen(prop.x + w * 0.3, prop.y + 1);
    const R = view.toScreen(prop.x + w * 0.7, prop.y + 1);
    const archH = height * 0.62;
    ctx.fillStyle = '#2e2a25';
    ctx.beginPath();
    ctx.moveTo(L.x, L.y);
    ctx.lineTo(L.x, L.y - archH * 0.7);
    ctx.quadraticCurveTo((L.x + R.x) / 2, (L.y + R.y) / 2 - archH * 1.15, R.x, R.y - archH * 0.7);
    ctx.lineTo(R.x, R.y);
    ctx.closePath();
    ctx.fill();
    // Herse relevée.
    ctx.strokeStyle = '#5a5248';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 5; i++) {
      const p = lerp(L, R, i / 5);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - archH * 0.5);
      ctx.lineTo(p.x, p.y - archH * 0.85);
      ctx.stroke();
    }
    // Créneaux.
    for (let i = 0; i < w * 2; i++) {
      if (i % 2) continue;
      const cx = prop.x + i * 0.5 + 0.08;
      const A = up(view.toScreen(cx, prop.y + 0.66), height);
      const B = up(view.toScreen(cx + 0.34, prop.y + 0.66), height);
      const C = up(view.toScreen(cx + 0.34, prop.y + 1), height);
      const D = up(view.toScreen(cx, prop.y + 1), height);
      const m = s * 0.16;
      fillPoly(view, [D, C, up(C, m), up(D, m)], '#9a958c');
      fillPoly(view, [C, B, up(B, m), up(C, m)], '#7f7a72');
      fillPoly(view, [A, B, C, D].map((p) => up(p, m)), '#b5afa3');
    }
    // Flammes aux couleurs du château.
    for (const t of [0.12, 0.88]) {
      const p = up(view.toScreen(prop.x + w * t, prop.y + 1), height * 0.95);
      const wave = Math.sin(time * 3 + t * 6) * s * 0.03;
      ctx.fillStyle = prop.color ?? '#7a1f2b';
      ctx.beginPath();
      ctx.moveTo(p.x - s * 0.08, p.y);
      ctx.lineTo(p.x + s * 0.08, p.y);
      ctx.lineTo(p.x + s * 0.06 + wave, p.y + s * 0.42);
      ctx.lineTo(p.x + wave * 0.5, p.y + s * 0.34);
      ctx.lineTo(p.x - s * 0.06 + wave, p.y + s * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#d9b44a';
      ctx.fillRect(p.x - s * 0.025, p.y + s * 0.1, s * 0.05, s * 0.05);
    }
  },

  // Tour ronde à toit d'ardoise pointu (logis du château).
  conicalTower(view, prop) {
    const { ctx } = view;
    const s = view.tile.w;
    const c = view.toScreen(prop.x + 0.5, prop.y + 0.5);
    const rx = s * 0.42;
    const ry = rx * 0.5;
    const height = s * (prop.height ?? 1.7);
    const grad = ctx.createLinearGradient(c.x - rx, 0, c.x + rx, 0);
    grad.addColorStop(0, '#c9c0ad');
    grad.addColorStop(0.55, '#b3a995');
    grad.addColorStop(1, '#8f8676');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(c.x - rx, c.y);
    ctx.ellipse(c.x, c.y, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(c.x + rx, c.y - height);
    ctx.ellipse(c.x, c.y - height, rx, ry, 0, 0, Math.PI, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 25, 10, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Fenêtres.
    ctx.fillStyle = '#3a3630';
    ctx.fillRect(c.x - s * 0.04, c.y - height * 0.45, s * 0.08, s * 0.14);
    ctx.fillRect(c.x - s * 0.03, c.y - height * 0.78, s * 0.06, s * 0.1);
    // Toit conique.
    ctx.fillStyle = '#4a5560';
    ctx.beginPath();
    ctx.moveTo(c.x - rx * 1.15, c.y - height);
    ctx.lineTo(c.x, c.y - height - s * 1.05);
    ctx.lineTo(c.x + rx * 1.15, c.y - height);
    ctx.ellipse(c.x, c.y - height, rx * 1.15, ry * 1.15, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(c.x - rx * 0.6, c.y - height + ry * 0.4);
    ctx.lineTo(c.x, c.y - height - s * 1.05);
    ctx.lineTo(c.x - rx * 0.1, c.y - height + ry * 1.1);
    ctx.closePath();
    ctx.fill();
    // Girouette.
    ctx.strokeStyle = '#3a3630';
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - height - s * 1.05);
    ctx.lineTo(c.x, c.y - height - s * 1.25);
    ctx.stroke();
  },

  // Rempart crénelé (cour du château) : un bloc de pierre par case.
  rampart(view, prop) {
    const s = view.tile.w;
    const height = s * 0.95;
    drawBox(view, { x: prop.x, y: prop.y, w: 1, h: 1, height, top: '#b5afa3', left: '#9a958c', right: '#7f7a72' });
    // Merlons.
    for (const [u, v] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      if ((prop.x + prop.y + u * 2 + v * 2) % 2 < 1) continue;
      const cx = prop.x + u - 0.17;
      const cy = prop.y + v - 0.17;
      const A = up(view.toScreen(cx, cy), height);
      const B = up(view.toScreen(cx + 0.34, cy), height);
      const C = up(view.toScreen(cx + 0.34, cy + 0.34), height);
      const D = up(view.toScreen(cx, cy + 0.34), height);
      const m = s * 0.16;
      fillPoly(view, [D, C, up(C, m), up(D, m)], '#9a958c');
      fillPoly(view, [C, B, up(B, m), up(C, m)], '#7f7a72');
      fillPoly(view, [A, B, C, D].map((p) => up(p, m)), '#b5afa3');
    }
  },
};

/** Pavé isométrique (bottes de foin, tables…). */
export function drawBox(view, { x, y, w, h, inset = 0, height, top, left, right }) {
  const A = view.toScreen(x + inset, y + inset);
  const B = view.toScreen(x + w - inset, y + inset);
  const C = view.toScreen(x + w - inset, y + h - inset);
  const D = view.toScreen(x + inset, y + h - inset);
  fillPoly(view, [D, C, up(C, height), up(D, height)], left);
  fillPoly(view, [C, B, up(B, height), up(C, height)], right);
  fillPoly(view, [A, B, C, D].map((p) => up(p, height)), top);
}

/** Profondeur de tri d'un décor (même repère que la position des combattants : x + y). */
export function propDepth(prop) {
  const w = prop.w ?? 1;
  const h = prop.h ?? 1;
  return prop.x + w / 2 + prop.y + h / 2;
}
