import { IsoView } from '../render/IsoView.js';
import { roundRect } from '../render/figures.js';
import { shade } from '../render/color.js';
import { drawSpectator } from '../render/spectators.js';
import { drawSpriteFigure } from '../render/sprites.js';
import { PROP_RENDERERS, propDepth } from '../render/propRenderers.js';
import { drawChatBubble } from '../render/ambientFigures.js';

const COLORS = {
  tileStroke: 'rgba(40, 60, 20, 0.08)',
  slabLeft: '#7a6a3f',
  slabRight: '#655631',
  plaque: 'rgba(253, 249, 238, 0.96)',
  plaqueText: '#2a2016',
  plaqueMuted: '#5f4e38',
  gold: '#f0c419',
};

/**
 * Rendu isométrique du Château de Gabarnac. État d'interaction : hoverTarget ('lice' | 'board'
 * | null). labels : { lice: { title, detail }, board: { title, detail } } (texte des étiquettes).
 */
export class GabarnacRenderer extends IsoView {
  constructor(canvas, scene) {
    super(canvas, { fillWidth: 0.98, fillHeight: 0.9, lift: 0.22 });
    this.scene = scene;
    this.hoverTarget = null;
    this.showLabels = true;
    this.labels = {
      lice: { title: '⚔ La Lice', detail: 'Prochain combat' },
      board: { title: '📜 Tableau de la Coupe', detail: 'Résultats · poules · meilleurs combattants' },
    };
    // La Lice luit doucement quand un combat du joueur attend.
    this.liceReady = false;
  }

  render(time) {
    const { scene } = this;
    // Caméra rapprochée (cadrage du plan) : le décor, les habitants et la Lice en grand.
    if (!this.grid) this.fit(scene.width, scene.height, scene.layout.camera ? { ...scene.layout.camera } : null);
    this.clear();
    this.#drawSlab();
    this.#drawTiles();
    this.#drawLiceGround(time);
    for (const prop of scene.groundProps) PROP_RENDERERS[prop.type]?.(this, prop, { time, teamColors: {} });

    const figureHeight = this.tile.w * 0.62;
    const drawables = scene.standingProps.map((prop) => ({ depth: propDepth(prop), draw: () => PROP_RENDERERS[prop.type]?.(this, prop, { time, teamColors: {} }) }));
    drawables.push(...this.#fenceDrawables());
    for (const villager of scene.villagersAt(time)) {
      drawables.push({
        depth: villager.x + villager.y,
        draw: () => {
          const p = this.toScreen(villager.x, villager.y);
          const step = villager.walking ? Math.abs(Math.sin(time * 6 + villager.phase)) * figureHeight * 0.03 : 0;
          drawSpectator(this.ctx, p.x, p.y - step, { ...villager, height: figureHeight, time, phase: villager.phase });
          if (villager.chat) {
            const speaker = scene.speakerOf(villager.chat, time);
            if (speaker && speaker.x === villager.x && speaker.y === villager.y) this.#drawBubble(p.x, p.y - figureHeight * 1.08, time);
          }
        },
      });
    }
    for (const entry of scene.fightersAt(time)) {
      drawables.push({
        depth: entry.x + entry.y,
        draw: () => {
          const p = this.toScreen(entry.x, entry.y);
          const colors = entry.team.emblem.resolvedColors();
          const step = entry.walking ? Math.abs(Math.sin(time * 5 + entry.index)) * figureHeight * 0.03 : 0;
          drawSpriteFigure(this.ctx, p.x, p.y - step, {
            spriteId: entry.fighter.spriteId, height: figureHeight * 1.05, clubColors: colors, ringColor: colors.primary,
            time, phase: entry.index, pose: { flip: entry.flip },
            fallback: { size: this.tile.w * 0.2, colors, specialtyId: entry.fighter.specialtyId, time, phase: entry.index },
          });
        },
      });
    }
    drawables.sort((a, b) => a.depth - b.depth).forEach((d) => d.draw());
    if (this.showLabels) {
      this.#drawLabel('lice', scene.lice.label, this.hoverTarget === 'lice' || this.liceReady);
      this.#drawLabel('board', scene.board.label, this.hoverTarget === 'board');
    }
  }

  #drawSlab() {
    const { ctx, scene } = this;
    const depth = this.tile.h * 0.5;
    const a = this.toScreen(0, scene.height);
    const b = this.toScreen(scene.width, scene.height);
    const c = this.toScreen(scene.width, 0);
    const down = (p) => ({ x: p.x, y: p.y + depth });
    this.tracePolygon([a, b, down(b), down(a)]);
    ctx.fillStyle = COLORS.slabLeft;
    ctx.fill();
    this.tracePolygon([b, c, down(c), down(b)]);
    ctx.fillStyle = COLORS.slabRight;
    ctx.fill();
  }

  #drawTiles() {
    const { ctx, scene } = this;
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.tileStroke;
    for (let y = 0; y < scene.height; y++) {
      for (let x = 0; x < scene.width; x++) {
        const alt = (x + y) % 2;
        let color = scene.layout.grass[alt];
        if (scene.isPath(x, y)) color = scene.layout.pathColor[alt];
        else if (scene.isLice(x, y)) color = scene.lice.sand[alt];
        this.traceArea(x, y);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  /** Sol de la Lice : contour (doré au survol ou quand un combat attend). */
  #drawLiceGround(time) {
    const { ctx, scene } = this;
    const { x, y, w, h } = scene.lice.area;
    const hovered = this.hoverTarget === 'lice';
    const glow = this.liceReady ? 0.35 + 0.25 * Math.sin(time * 3) : 0;
    this.traceArea(x, y, w, h);
    if (hovered || glow) {
      ctx.fillStyle = `rgba(255, 236, 170, ${hovered ? 0.28 : glow * 0.4})`;
      ctx.fill();
    }
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.strokeStyle = hovered || this.liceReady ? COLORS.gold : 'rgba(90, 60, 30, 0.5)';
    ctx.stroke();
    // Zone du tableau.
    const b = scene.board.area;
    if (this.hoverTarget === 'board') {
      this.traceArea(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255, 236, 170, 0.25)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLORS.gold;
      ctx.stroke();
    }
  }

  /** Palissade de bois autour de la Lice : un tronçon par côté de case, trié en profondeur. */
  #fenceDrawables() {
    const { x, y, w, h } = this.scene.lice.area;
    const { rail, post } = this.scene.lice.fence;
    const segments = [];
    for (let i = 0; i < w; i++) segments.push([[x + i, y], [x + i + 1, y]], [[x + i, y + h], [x + i + 1, y + h]]);
    for (let j = 0; j < h; j++) segments.push([[x, y + j], [x, y + j + 1]], [[x + w, y + j], [x + w, y + j + 1]]);
    return segments.map(([a, b]) => ({
      depth: (a[0] + b[0]) / 2 + (a[1] + b[1]) / 2 - 0.01,
      draw: () => {
        const { ctx } = this;
        const pa = this.toScreen(a[0], a[1]);
        const pb = this.toScreen(b[0], b[1]);
        const hgt = this.tile.w * 0.22;
        ctx.strokeStyle = rail;
        ctx.lineWidth = Math.max(1.5, this.tile.w * 0.035);
        for (const k of [0.45, 0.85]) {
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y - hgt * k);
          ctx.lineTo(pb.x, pb.y - hgt * k);
          ctx.stroke();
        }
        ctx.strokeStyle = post;
        ctx.lineWidth = Math.max(2, this.tile.w * 0.045);
        for (const p of [pa, pb]) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x, p.y - hgt);
          ctx.stroke();
        }
      },
    }));
  }

  /** Bulle de discussion (« … ») au-dessus d'un habitant. */
  #drawBubble(x, y, time) {
    drawChatBubble(this.ctx, x, y, { unit: this.tile.w * 0.22, time });
  }

  #drawLabel(id, anchorTile, highlighted) {
    const { ctx } = this;
    const label = this.labels[id];
    if (!label) return;
    const anchor = this.toScreen(anchorTile.x, anchorTile.y);
    ctx.font = '700 15px "EB Garamond", Georgia, serif';
    const titleWidth = ctx.measureText(label.title).width;
    ctx.font = '500 12px "EB Garamond", Georgia, serif';
    const width = Math.max(titleWidth, ctx.measureText(label.detail).width) + 22;
    const height = 42;
    const margin = 6;
    const left = Math.min(Math.max(anchor.x - width / 2, margin), this.view.w - width - margin);
    // `below` : étiquette sous l'ancrage (pour ne pas cacher l'élément qu'elle désigne).
    const wanted = anchorTile.below ? anchor.y + 6 : anchor.y - height - this.tile.w * 0.4;
    const top = Math.min(Math.max(wanted, margin), this.view.h - height - margin);
    roundRect(ctx, left, top, width, height, 6);
    ctx.fillStyle = COLORS.plaque;
    ctx.fill();
    ctx.lineWidth = highlighted ? 3 : 2;
    ctx.strokeStyle = highlighted ? COLORS.gold : shade('#7a1f2b', 0);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COLORS.plaqueText;
    ctx.font = '700 15px "EB Garamond", Georgia, serif';
    ctx.fillText(label.title, left + width / 2, top + 18);
    ctx.fillStyle = COLORS.plaqueMuted;
    ctx.font = '500 12px "EB Garamond", Georgia, serif';
    ctx.fillText(label.detail, left + width / 2, top + 34);
  }
}
