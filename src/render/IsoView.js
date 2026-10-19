import { gridToScreen, screenToGrid } from './IsoMath.js';

/**
 * Base commune des rendus isométriques (La Lice, Centre) : taille du canvas,
 * ajustement de la grille à l'écran, conversions et sélection de case.
 */
export class IsoView {
  constructor(canvas, { fillWidth = 0.94, fillHeight = 0.8, lift = 0.3 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = { fillWidth, fillHeight, lift };
    this.view = { w: 0, h: 0 };
    this.tile = { w: 64, h: 32 };
    this.origin = { x: 0, y: 0 };
    this.grid = null;
    // Zoom du joueur (v0.91, téléphone : pincer, glisser) : échelle et décalage en px,
    // appliqués par-dessus le cadrage de la scène (fit).
    this.userZoom = { scale: 1, x: 0, y: 0 };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.view = { w: rect.width, h: rect.height };
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.grid) this.fit(this.grid.width, this.grid.height, this.focus);
  }

  /**
   * Ajuste la taille des cases pour que la grille tienne dans le canvas.
   * `focus` ({ x, y, w, h }, facultatif) : partie de la grille à cadrer ; le reste peut
   * déborder du canvas.
   */
  fit(width, height, focus = null) {
    this.grid = { width, height };
    this.focus = focus;
    const area = focus ?? { x: 0, y: 0, w: width, h: height };
    const { fillWidth, fillHeight, lift } = this.options;
    const span = area.w + area.h;
    const w = Math.max(16, Math.min((this.view.w * fillWidth * 2) / span, (this.view.h * fillHeight * 4) / span));
    this.tile = { w, h: w / 2 };
    const center = gridToScreen(area.x + area.w / 2, area.y + area.h / 2, this.tile);
    this.origin = { x: this.view.w / 2 - center.x, y: this.view.h / 2 - center.y + w * lift };
    const zoom = this.userZoom;
    if (zoom && (zoom.scale !== 1 || zoom.x || zoom.y)) {
      // Chaque point de l'écran s'écarte du centre de la vue (échelle), puis glisse (décalage).
      const cx = this.view.w / 2;
      const cy = this.view.h / 2;
      this.tile = { w: w * zoom.scale, h: (w * zoom.scale) / 2 };
      this.origin = { x: cx + (this.origin.x - cx) * zoom.scale + zoom.x, y: cy + (this.origin.y - cy) * zoom.scale + zoom.y };
    }
  }

  /**
   * Zoom du joueur : { scale, x, y } (échelle bornée, décalage borné pour garder la carte à
   * l'écran). Le cadrage est recalculé aussitôt. Renvoie le zoom retenu.
   */
  setUserZoom({ scale = 1, x = 0, y = 0 } = {}, { min = 1, max = 3 } = {}) {
    const s = Math.min(max, Math.max(min, scale));
    const limitX = (this.view.w / 2) * Math.max(0, s - 1) + this.view.w * 0.1;
    const limitY = (this.view.h / 2) * Math.max(0, s - 1) + this.view.h * 0.1;
    const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
    this.userZoom = s === 1 && Math.abs(x) < 1 && Math.abs(y) < 1 ? { scale: 1, x: 0, y: 0 } : { scale: s, x: clamp(x, limitX), y: clamp(y, limitY) };
    if (this.grid) this.fit(this.grid.width, this.grid.height, this.focus);
    return this.userZoom;
  }

  get isZoomed() {
    return this.userZoom.scale !== 1 || this.userZoom.x !== 0 || this.userZoom.y !== 0;
  }

  toScreen(gx, gy) {
    const p = gridToScreen(gx, gy, this.tile);
    return { x: p.x + this.origin.x, y: p.y + this.origin.y };
  }

  /** Case de la grille sous un point de l'écran (coordonnées client), ou null. */
  pickTile(clientX, clientY) {
    if (!this.grid) return null;
    const rect = this.canvas.getBoundingClientRect();
    const g = screenToGrid(clientX - rect.left - this.origin.x, clientY - rect.top - this.origin.y, this.tile);
    const tile = { x: Math.floor(g.x), y: Math.floor(g.y) };
    const inside = tile.x >= 0 && tile.y >= 0 && tile.x < this.grid.width && tile.y < this.grid.height;
    return inside ? tile : null;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.view.w, this.view.h);
  }

  tracePolygon(points) {
    const { ctx } = this;
    ctx.beginPath();
    points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
  }

  /** Trace le losange couvrant les cases [x, x+w[ × [y, y+h[. */
  traceArea(x, y, w = 1, h = 1) {
    this.tracePolygon([this.toScreen(x, y), this.toScreen(x + w, y), this.toScreen(x + w, y + h), this.toScreen(x, y + h)]);
  }
}
