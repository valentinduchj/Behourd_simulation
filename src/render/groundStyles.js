import { hashString } from '../utils/random.js';
import { shade } from './color.js';

// Styles de sol des décors de La Lice (data/liceDecorations.js, `ground.*.style`).
// Chaque style dessine UNE case (x, y) de la grille de la vue : (view, x, y, zone).
// Le sol est statique : il est dessiné une fois dans un cache (IsoRenderer).

const noise = (x, y, salt = '') => hashString(`${salt}${x},${y}`);

function fillTile(view, x, y, color) {
  view.traceArea(x, y);
  view.ctx.fillStyle = color;
  view.ctx.fill();
}

/** Point de la case (x, y) à la position relative (u, v) ∈ [0, 1]². */
const at = (view, x, y, u, v) => view.toScreen(x + u, y + v);

export const GROUND_STYLES = {
  checker(view, x, y, zone) {
    fillTile(view, x, y, zone.colors[(x + y) % zone.colors.length]);
  },

  speckle(view, x, y, zone) {
    fillTile(view, x, y, zone.colors[noise(x, y, 's') % zone.colors.length]);
    if (!zone.grain) return;
    const { ctx } = view;
    ctx.fillStyle = zone.grain;
    const count = 2 + (noise(x, y, 'n') % 3);
    for (let i = 0; i < count; i++) {
      const h = noise(x, y, `g${i}`);
      const p = at(view, x, y, 0.15 + ((h % 70) / 100), 0.15 + (((h >> 7) % 70) / 100));
      ctx.fillRect(p.x, p.y, Math.max(1, view.tile.w * 0.03), Math.max(1, view.tile.w * 0.02));
    }
  },

  cobble(view, x, y, zone) {
    fillTile(view, x, y, zone.joint ?? shade(zone.colors[0], -0.2));
    const { ctx } = view;
    // 2 × 2 pavés par case, légèrement irréguliers.
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const h = noise(x * 2 + i, y * 2 + j, 'c');
        const base = h % 3 === 0 ? zone.stone ?? zone.colors[0] : zone.colors[(h >> 3) % zone.colors.length];
        const inset = 0.06 + ((h >> 5) % 3) * 0.01;
        view.tracePolygon([
          at(view, x, y, i / 2 + inset, j / 2 + inset), at(view, x, y, (i + 1) / 2 - inset, j / 2 + inset),
          at(view, x, y, (i + 1) / 2 - inset, (j + 1) / 2 - inset), at(view, x, y, i / 2 + inset, (j + 1) / 2 - inset),
        ]);
        ctx.fillStyle = base;
        ctx.fill();
      }
    }
  },

  flagstone(view, x, y, zone) {
    fillTile(view, x, y, zone.joint ?? shade(zone.colors[0], -0.2));
    const h = noise(x, y, 'f');
    const inset = 0.05;
    view.tracePolygon([
      at(view, x, y, inset, inset), at(view, x, y, 1 - inset, inset),
      at(view, x, y, 1 - inset, 1 - inset), at(view, x, y, inset, 1 - inset),
    ]);
    view.ctx.fillStyle = zone.colors[h % zone.colors.length];
    view.ctx.fill();
    if (h % 5 === 0) {
      // Fissure.
      const a = at(view, x, y, 0.3, 0.2);
      const b = at(view, x, y, 0.55, 0.6);
      view.ctx.strokeStyle = zone.joint ?? '#777';
      view.ctx.lineWidth = 1;
      view.ctx.beginPath();
      view.ctx.moveTo(a.x, a.y);
      view.ctx.lineTo(b.x, b.y);
      view.ctx.stroke();
    }
  },
};

export function drawGroundTile(view, x, y, zone) {
  (GROUND_STYLES[zone?.style] ?? GROUND_STYLES.checker)(view, x, y, zone ?? { colors: ['#888', '#999'] });
}
