import { IsoView } from '../render/IsoView.js';
import { roundRect } from '../render/figures.js';
import { shade } from '../render/color.js';
import { drawSpectator } from '../render/spectators.js';
import { drawSpriteFigure } from '../render/sprites.js';
import { PROP_RENDERERS, propDepth } from '../render/propRenderers.js';
import { TAVERN_PROPS } from '../render/tavernProps.js';
import { SceneEffects } from '../render/vfx/sceneEffects.js';
import { drawParticles } from '../render/vfx/particles.js';
import { drawExitLabel, arrivalGlow } from '../render/exitMarkers.js';
import { TRAVEL_TRANSITION } from '../data/locations.js';

const PROPS = { ...PROP_RENDERERS, ...TAVERN_PROPS };
const up = (p, dy) => ({ x: p.x, y: p.y - dy });

/**
 * Rendu isométrique de l'intérieur de la Taverne (dessin seulement).
 * État d'interaction fourni par l'écran : `hover` = { type: 'recruit', candidateId } |
 * { type: 'keeper' } | null, et `labelFor(hover)` → { title, subtitle } pour l'étiquette.
 */
export class TavernRenderer extends IsoView {
  constructor(canvas, scene) {
    super(canvas, { fillWidth: 0.96, fillHeight: 0.86, lift: 0.28 });
    this.scene = scene;
    this.hover = null;
    this.labelFor = () => null;
    this.effects = new SceneEffects();
    this.doorOpen = 0;
    // Sorties de la salle (porte vers le Centre, data/locations.js), fournies par l'écran.
    this.exits = [];
    this.arrival = null; // { exitId, start }
    // Palmarès de la compagnie (armoire à trophées), fourni par l'écran : trophées triés.
    this.trophies = [];
    this.trophyCapacity = { shelves: 3, perShelf: 4 };
  }

  /** Rectangle à l'écran (canvas) de l'armoire à trophées, ou null. */
  trophyCabinetBox() {
    const prop = this.scene.props.find((p) => p.type === 'trophyCabinet');
    if (!prop || !this.grid) return null;
    const a = this.toScreen(prop.x, prop.y + 0.55);
    const b = this.toScreen(prop.x + (prop.w ?? 2), prop.y + 0.55);
    const height = this.tile.w * 1.7;
    return { left: Math.min(a.x, b.x), right: Math.max(a.x, b.x), top: Math.min(a.y, b.y) - height, bottom: Math.max(a.y, b.y) };
  }

  /** Rectangle à l'écran (canvas) de la pancarte des statistiques (mur de gauche), ou null. */
  statsBoardBox() {
    const item = this.scene.layout.walls.left.find((w) => w.type === 'statsBoard');
    if (!item || !this.grid) return null;
    const s = this.tile.w;
    const center = up(this.toScreen(0, item.y), s * this.scene.layout.wall.height * 0.62);
    return { left: center.x - s * 0.36, right: center.x + s * 0.36, top: center.y - s * 0.36, bottom: center.y + s * 0.3, center };
  }

  /** Contour d'une porte de sortie à l'écran (mur de gauche) : [4 points] ou null. */
  doorPolygon(exit) {
    if (exit?.interactionType !== 'door' || !this.grid) return null;
    const half = (exit.position.width ?? 0.9) / 2;
    const doorH = this.tile.w * this.scene.layout.wall.height * 0.6;
    const hinge = this.toScreen(0, exit.position.y - half);
    const latch = this.toScreen(0, exit.position.y + half);
    return [hinge, latch, up(latch, doorH), up(hinge, doorH)];
  }

  /** Sortie (porte) sous un point de l'écran, coordonnées du canvas, ou null. */
  exitAtPoint(x, y) {
    for (const exit of this.exits) {
      const poly = this.doorPolygon(exit);
      if (!poly) continue;
      const xs = poly.map((p) => p.x);
      const ys = poly.map((p) => p.y);
      const margin = 4;
      if (x >= Math.min(...xs) - margin && x <= Math.max(...xs) + margin && y >= Math.min(...ys) - margin && y <= Math.max(...ys) + margin) return exit;
    }
    return null;
  }

  /** Hauteur à l'écran d'une recrue et du tavernier. */
  get figureHeight() {
    return this.tile.w * 0.82;
  }

  render(time) {
    const { scene } = this;
    if (!this.grid) this.fit(scene.width, scene.height);
    this.doorOpen = this.effects.doorOpenAmount(time);
    // Porte survolée : elle s'entrouvre (invitation à sortir).
    if (this.hover?.type === 'exit') this.doorOpen = Math.max(this.doorOpen, 0.3);
    this.clear();
    this.#drawFloor();
    this.#drawWalls();
    for (const prop of scene.groundProps) PROPS[prop.type]?.(this, prop, { time, teamColors: {} });

    // Armoire à trophées : ses trophées viennent du palmarès (fourni par l'écran, this.trophies).
    const env = (prop) => (prop.type === 'trophyCabinet'
      ? { time, teamColors: {}, trophies: this.trophies, capacity: this.trophyCapacity, highlighted: this.hover?.type === 'trophies' }
      : { time, teamColors: {} });
    const drawables = scene.standingProps.map((prop) => ({ depth: propDepth(prop), draw: () => PROPS[prop.type]?.(this, prop, env(prop)) }));
    const h = this.figureHeight;
    const keeper = scene.keeper;
    drawables.push({
      depth: keeper.x + keeper.y,
      draw: () => {
        const p = this.toScreen(keeper.x, keeper.y);
        if (this.hover?.type === 'keeper') this.#halo(p);
        drawSpectator(this.ctx, p.x, p.y, { spriteId: keeper.spriteId, view: 'front', height: h * 1.05, time, phase: 0.3 });
      },
    });
    scene.patrons.forEach((patron, i) => drawables.push({
      depth: patron.x + patron.y,
      draw: () => {
        const p = this.toScreen(patron.x, patron.y);
        drawSpectator(this.ctx, p.x, p.y, { ...patron, height: h * 0.82, time, phase: i * 1.3 });
      },
    }));
    for (const character of scene.characters) {
      drawables.push({
        depth: character.x + character.y,
        draw: () => {
          const p = this.toScreen(character.x, character.y);
          const hovered = this.hover?.type === 'recruit' && this.hover.candidateId === character.candidateId;
          const step = character.walking ? Math.abs(Math.sin(time * 7 + character.phase)) * h * 0.035 : 0;
          drawSpriteFigure(this.ctx, p.x, p.y - step, {
            spriteId: character.fighter.spriteId,
            height: h,
            ringColor: character.fighter.specialty?.color ?? '#6b4521',
            highlighted: hovered,
            time,
            phase: character.phase,
            fallback: { size: this.tile.w * 0.16, colors: { primary: '#6b4521', secondary: '#c9a26a' }, specialtyId: character.fighter.specialtyId, time, phase: character.phase },
          });
        },
      });
    }
    drawables.sort((a, b) => a.depth - b.depth).forEach((d) => d.draw());
    this.#drawAmbience(time);
    // Effets visuels (fumée de la porte, chopes qui trinquent) : au-dessus de la salle.
    drawParticles(this, this.effects.particles(time), 'over', (x, y) => this.toScreen(x, y));
    this.#drawExits(time);
    if (this.hover && this.hover.type !== 'exit') this.#drawLabel(this.hover);
  }

  /** Porte de sortie : contour doré au survol ou à l'arrivée, indication de destination. */
  #drawExits(time) {
    if (this.arrival && this.arrival.start === null) this.arrival.start = time;
    const { ctx } = this;
    for (const exit of this.exits) {
      const poly = this.doorPolygon(exit);
      if (!poly) continue;
      const hovered = this.hover?.type === 'exit' && this.hover.exitId === exit.id;
      const arriving = this.arrival?.exitId === exit.id ? arrivalGlow(time - this.arrival.start, TRAVEL_TRANSITION.arrivalHighlight) : 0;
      const strength = Math.max(hovered ? 1 : 0, arriving);
      if (strength > 0) {
        this.tracePolygon(poly);
        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(240, 196, 25, ${0.95 * strength})`;
        ctx.stroke();
        ctx.fillStyle = `rgba(240, 196, 25, ${0.12 * strength})`;
        ctx.fill();
      }
      if (hovered) drawExitLabel(this, exit, { anchor: { x: (poly[2].x + poly[3].x) / 2, y: Math.min(poly[2].y, poly[3].y) } });
    }
  }

  /** Position à l'écran (pieds) et hauteur d'un personnage cliquable. */
  figureBox(target) {
    const h = this.figureHeight;
    if (target.type === 'keeper') return { p: this.toScreen(this.scene.keeper.x, this.scene.keeper.y), h: h * 1.05 };
    // Pancarte et armoire : étiquette au-dessus de leur rectangle.
    const box = target.type === 'stats' ? this.statsBoardBox() : target.type === 'trophies' ? this.trophyCabinetBox() : null;
    if (box) return { p: { x: (box.left + box.right) / 2, y: box.bottom }, h: box.bottom - box.top };
    const character = this.scene.getCharacter(target.candidateId);
    return character ? { p: this.toScreen(character.x, character.y), h } : null;
  }

  #drawFloor() {
    const { ctx, scene } = this;
    // Socle sous le plancher.
    const depth = this.tile.h * 0.45;
    const a = this.toScreen(0, scene.height);
    const b = this.toScreen(scene.width, scene.height);
    const c = this.toScreen(scene.width, 0);
    const down = (p) => ({ x: p.x, y: p.y + depth });
    this.tracePolygon([a, b, down(b), down(a)]);
    ctx.fillStyle = '#4a2f18';
    ctx.fill();
    this.tracePolygon([b, c, down(c), down(b)]);
    ctx.fillStyle = '#3a2412';
    ctx.fill();
    // Lames de plancher : une rangée de planches par case, joints décalés.
    ctx.lineWidth = 1;
    for (let y = 0; y < scene.height; y++) {
      for (let x = 0; x < scene.width; x++) {
        this.traceArea(x, y);
        ctx.fillStyle = scene.layout.floor[(x + y * 3) % 2];
        ctx.fill();
        ctx.strokeStyle = 'rgba(40, 22, 8, 0.35)';
        ctx.stroke();
        const p = this.toScreen(x + 0.5, y);
        const q = this.toScreen(x + 0.5, y + 1);
        ctx.strokeStyle = 'rgba(40, 22, 8, 0.18)';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
    }
  }

  #drawWalls() {
    const { ctx, scene } = this;
    const { stone, plaster, beam, height } = scene.layout.wall;
    const H = this.tile.w * height;
    const stoneH = H * 0.32;
    const face = (from, to, fill) => {
      this.tracePolygon([from, to, up(to, H), up(from, H)]);
      ctx.fillStyle = fill;
      ctx.fill();
    };
    // Mur de gauche (le long de x = 0) et mur du fond (le long de y = 0).
    const walls = [
      { from: this.toScreen(0, scene.height), to: this.toScreen(0, 0), light: -0.12 },
      { from: this.toScreen(0, 0), to: this.toScreen(scene.width, 0), light: 0 },
    ];
    for (const wall of walls) {
      face(wall.from, wall.to, shade(plaster, wall.light));
      this.tracePolygon([wall.from, wall.to, up(wall.to, stoneH), up(wall.from, stoneH)]);
      ctx.fillStyle = shade(stone, wall.light);
      ctx.fill();
      // Pierres du soubassement.
      ctx.strokeStyle = 'rgba(30, 24, 18, 0.35)';
      ctx.lineWidth = 1;
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        const p = { x: wall.from.x + (wall.to.x - wall.from.x) * (i / steps), y: wall.from.y + (wall.to.y - wall.from.y) * (i / steps) };
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - (i % 2 ? 0 : stoneH / 2));
        ctx.lineTo(p.x, p.y - (i % 2 ? stoneH / 2 : stoneH));
        ctx.stroke();
      }
      // Colombages : poutres verticales, sablière, lisse.
      ctx.strokeStyle = beam;
      ctx.lineWidth = Math.max(2, this.tile.w * 0.06);
      const count = 6;
      for (let i = 0; i <= count; i++) {
        const p = { x: wall.from.x + (wall.to.x - wall.from.x) * (i / count), y: wall.from.y + (wall.to.y - wall.from.y) * (i / count) };
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - stoneH);
        ctx.lineTo(p.x, p.y - H);
        ctx.stroke();
      }
      for (const level of [stoneH, H * 0.98]) {
        ctx.beginPath();
        ctx.moveTo(wall.from.x, wall.from.y - level);
        ctx.lineTo(wall.to.x, wall.to.y - level);
        ctx.stroke();
      }
    }
    // Décor des murs.
    for (const item of scene.layout.walls.left) this.#wallItem(item, this.toScreen(0, item.y), H, -0.12);
    for (const item of scene.layout.walls.back) this.#wallItem(item, this.toScreen(item.x, 0), H, 0);
  }

  #wallItem(item, base, H, light) {
    if (item.type === 'door') {
      this.#drawDoor(item, H, light);
      return;
    }
    const { ctx } = this;
    const s = this.tile.w;
    const center = up(base, H * 0.62);
    if (item.type === 'window') {
      ctx.fillStyle = shade('#1f2c4a', light);
      ctx.beginPath();
      ctx.moveTo(center.x - s * 0.22, center.y + s * 0.3);
      ctx.lineTo(center.x - s * 0.22, center.y - s * 0.1);
      ctx.quadraticCurveTo(center.x, center.y - s * 0.38, center.x + s * 0.22, center.y - s * 0.1);
      ctx.lineTo(center.x + s * 0.22, center.y + s * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#5a3b1e';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(center.x, center.y - s * 0.24);
      ctx.lineTo(center.x, center.y + s * 0.3);
      ctx.moveTo(center.x - s * 0.22, center.y + s * 0.06);
      ctx.lineTo(center.x + s * 0.22, center.y + s * 0.06);
      ctx.stroke();
      ctx.fillStyle = 'rgba(240, 230, 200, 0.85)';
      ctx.beginPath();
      ctx.arc(center.x + s * 0.1, center.y - s * 0.08, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === 'shield') {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.moveTo(center.x - s * 0.16, center.y - s * 0.16);
      ctx.lineTo(center.x + s * 0.16, center.y - s * 0.16);
      ctx.lineTo(center.x + s * 0.16, center.y + s * 0.02);
      ctx.quadraticCurveTo(center.x, center.y + s * 0.24, center.x - s * 0.16, center.y + s * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#2a1d10';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = item.emblem;
      ctx.fillRect(center.x - s * 0.03, center.y - s * 0.14, s * 0.06, s * 0.3);
    } else if (item.type === 'statsBoard') {
      this.#drawStatsBoard(center, s);
    } else if (item.type === 'banner') {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.moveTo(center.x - s * 0.14, center.y - s * 0.35);
      ctx.lineTo(center.x + s * 0.14, center.y - s * 0.35);
      ctx.lineTo(center.x + s * 0.14, center.y + s * 0.25);
      ctx.lineTo(center.x, center.y + s * 0.15);
      ctx.lineTo(center.x - s * 0.14, center.y + s * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = item.emblem;
      ctx.beginPath();
      ctx.arc(center.x, center.y - s * 0.08, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a3b1e';
      ctx.fillRect(center.x - s * 0.18, center.y - s * 0.38, s * 0.36, s * 0.04);
    }
  }

  /**
   * Porte du mur de gauche (le long de x = 0) : encadrement, nuit au-dehors quand elle est
   * ouverte, vantail pivotant vers l'intérieur selon this.doorOpen (0 à 1, effets visuels).
   */
  #drawDoor(item, H, light) {
    const { ctx } = this;
    const half = (item.width ?? 0.9) / 2;
    const doorH = H * 0.6;
    const hinge = this.toScreen(0, item.y - half);
    const latch = this.toScreen(0, item.y + half);
    // Encadrement et ouverture (nuit au-dehors).
    this.tracePolygon([hinge, latch, up(latch, doorH), up(hinge, doorH)]);
    ctx.fillStyle = shade('#1a2236', light);
    ctx.fill();
    ctx.lineWidth = Math.max(2, this.tile.w * 0.05);
    ctx.strokeStyle = '#3e2712';
    ctx.stroke();
    // Vantail : pivote autour du côté gauche, vers l'intérieur de la salle (+x).
    const angle = Math.max(0, Math.min(1, this.doorOpen ?? 0)) * this.effects.config.door.maxAngle * (Math.PI / 2);
    const width = half * 2;
    const far = this.toScreen(Math.sin(angle) * width, item.y - half + Math.cos(angle) * width);
    this.tracePolygon([hinge, far, up(far, doorH), up(hinge, doorH)]);
    ctx.fillStyle = shade('#6b4423', light - angle * 0.12);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#2e1b0b';
    ctx.stroke();
    // Planches et pentures.
    ctx.strokeStyle = 'rgba(30, 16, 6, 0.55)';
    ctx.lineWidth = 1;
    for (const f of [1 / 3, 2 / 3]) {
      const a = { x: hinge.x + (far.x - hinge.x) * f, y: hinge.y + (far.y - hinge.y) * f };
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x, a.y - doorH);
      ctx.stroke();
    }
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = Math.max(2, this.tile.w * 0.035);
    for (const f of [0.22, 0.78]) {
      ctx.beginPath();
      ctx.moveTo(hinge.x, hinge.y - doorH * f);
      ctx.lineTo(hinge.x + (far.x - hinge.x) * 0.55, hinge.y + (far.y - hinge.y) * 0.55 - doorH * f);
      ctx.stroke();
    }
  }

  /**
   * Pancarte des statistiques (mur de gauche) : planche suspendue, trois feuillets de
   * classements, épées croisées. Cadre doré au survol.
   */
  #drawStatsBoard(center, s) {
    const { ctx } = this;
    const w = s * 0.62;
    const hgt = s * 0.5;
    const left = center.x - w / 2;
    const top = center.y - hgt / 2;
    // Cordelette et clou.
    ctx.strokeStyle = '#3a2412';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(left + w * 0.15, top);
    ctx.lineTo(center.x, top - s * 0.16);
    ctx.lineTo(left + w * 0.85, top);
    ctx.stroke();
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(center.x, top - s * 0.16, s * 0.02, 0, Math.PI * 2);
    ctx.fill();
    // Planche.
    roundRect(ctx, left, top, w, hgt, s * 0.04);
    ctx.fillStyle = '#8a5f34';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.hover?.type === 'stats' ? '#f0c419' : '#3a2412';
    ctx.stroke();
    // Feuillets : colonnes de classements.
    for (let i = 0; i < 3; i++) {
      const x = left + w * (0.08 + i * 0.3);
      const y = top + hgt * (0.3 + (i % 2) * 0.04);
      ctx.fillStyle = '#f1e6c8';
      ctx.fillRect(x, y, w * 0.26, hgt * 0.6);
      ctx.fillStyle = 'rgba(90, 60, 30, 0.6)';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + w * 0.03, y + hgt * (0.1 + k * 0.12), w * (k === 0 ? 0.18 : 0.2 - k * 0.02), 1.4);
    }
    // En-tête : épées croisées.
    ctx.strokeStyle = '#d5dbe0';
    ctx.lineWidth = Math.max(1.5, s * 0.025);
    ctx.beginPath();
    ctx.moveTo(center.x - s * 0.08, top + hgt * 0.06);
    ctx.lineTo(center.x + s * 0.08, top + hgt * 0.24);
    ctx.moveTo(center.x + s * 0.08, top + hgt * 0.06);
    ctx.lineTo(center.x - s * 0.08, top + hgt * 0.24);
    ctx.stroke();
    if (this.hover?.type === 'stats') {
      roundRect(ctx, left - 3, top - 3, w + 6, hgt + 6, s * 0.05);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f0c419';
      ctx.stroke();
    }
  }

  /** Lumière chaude du soir et coins dans la pénombre. */
  #drawAmbience(time) {
    const { ctx } = this;
    const { w, h } = this.view;
    const glow = ctx.createRadialGradient(w * 0.42, h * 0.45, h * 0.1, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    glow.addColorStop(0, `rgba(255, 190, 110, ${0.06 + 0.01 * Math.sin(time * 2)})`);
    glow.addColorStop(1, 'rgba(20, 10, 4, 0.32)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  #halo(p) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, this.tile.w * 0.3, this.tile.w * 0.14, 0, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f0c419';
    ctx.stroke();
  }

  /** Étiquette au-dessus du personnage survolé (spécialité et étoiles, ou le tavernier). */
  #drawLabel(target) {
    const box = this.figureBox(target);
    const label = this.labelFor(target);
    if (!box || !label) return;
    const { ctx } = this;
    ctx.font = '700 15px "Cinzel", Georgia, serif';
    const titleWidth = ctx.measureText(label.title).width;
    ctx.font = '600 16px "EB Garamond", Georgia, serif';
    const width = Math.max(titleWidth, ctx.measureText(label.subtitle).width) + 24;
    const height = 46;
    const left = Math.min(Math.max(box.p.x - width / 2, 6), this.view.w - width - 6);
    const top = Math.max(box.p.y - box.h - height - 10, 6);
    roundRect(ctx, left, top, width, height, 7);
    ctx.fillStyle = 'rgba(253, 246, 228, 0.97)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#c99a2e';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#2a2016';
    ctx.font = '700 15px "Cinzel", Georgia, serif';
    ctx.fillText(label.title, left + width / 2, top + 19);
    ctx.fillStyle = '#a0741a';
    ctx.font = '600 16px "EB Garamond", Georgia, serif';
    ctx.fillText(label.subtitle, left + width / 2, top + 38);
  }
}
