import { IsoView } from '../render/IsoView.js';
import { roundRect } from '../render/figures.js';
import { shade } from '../render/color.js';
import { drawSpectator } from '../render/spectators.js';
import { drawSpriteFigure } from '../render/sprites.js';
import { PROP_RENDERERS, propDepth } from '../render/propRenderers.js';
import { TAVERN_PROPS } from '../render/tavernProps.js';
import { SCRIPTORIUM_PROPS, drawScriptoriumWallItem } from '../render/scriptoriumProps.js';
import { SceneEffects, studyAmbience } from '../render/vfx/sceneEffects.js';
import { drawParticles } from '../render/vfx/particles.js';
import { drawExitLabel, arrivalGlow } from '../render/exitMarkers.js';
import { drawChatBubble } from '../render/ambientFigures.js';
import { TRAVEL_TRANSITION } from '../data/locations.js';
import { FIGHTER_ANIMATIONS } from '../centre/animation/fighterAnimations.js';
import { drawHeldItem } from '../centre/render/heldItems.js';
import { artisanFrame, ARTISAN_ANIMATIONS } from '../borough/artisanAnimations.js';
import { chatSpeaker } from '../borough/BoroughScene.js';
import { drawCat, drawMouse } from './CatBehavior.js';
import { TAKE_SECONDS } from './FlaviaBehavior.js';

// Le livre que Flavia sort de son rayonnage.
const BLUE_BOOK = '#2a55a8';

const PROPS = { ...PROP_RENDERERS, ...TAVERN_PROPS, ...SCRIPTORIUM_PROPS };
const up = (p, dy) => ({ x: p.x, y: p.y - dy });

/** Geste d'un passant : la marche quand il se déplace, sinon l'attente (comme au Bourg). */
function walkerPose(walker, time) {
  const t = time + walker.phase * 1.37;
  if (walker.walking) return { ...FIGHTER_ANIMATIONS.walk(t, { facing: 1 }).pose, flip: false };
  const idle = FIGHTER_ANIMATIONS.idle(t * (0.8 + (walker.phase % 3) * 0.15), { facing: 1 }).pose;
  return walker.idle === 'still' ? { ...idle, flip: false } : idle;
}

/**
 * Rendu isométrique de l'intérieur du Scriptorium (dessin seulement). État d'interaction fourni
 * par l'écran : `hover` = { type: 'desk' } | { type: 'exit', exitId } | null ; `deskLabel` =
 * { title, subtitle } (plaque du Bureau d'étude).
 */
export class ScriptoriumRenderer extends IsoView {
  constructor(canvas, scene) {
    super(canvas, { fillWidth: 0.96, fillHeight: 0.86, lift: 0.3 });
    this.scene = scene;
    this.hover = null;
    this.deskLabel = { title: '📜 Bureau d’étude', subtitle: '' };
    this.flaviaLabel = { title: '👑 Professeure Flavia', subtitle: 'Améliorations' };
    this.effects = new SceneEffects();
    this.doorOpen = 0;
    this.exits = [];
    this.arrival = null; // { exitId, start }
  }

  get figureHeight() {
    return this.tile.w * 0.82;
  }

  /** Contour d'une porte de sortie à l'écran (mur de gauche) : [4 points] ou null. */
  doorPolygon(exit) {
    if (exit?.interactionType !== 'door' || !this.grid) return null;
    const half = (exit.position.width ?? 0.9) / 2;
    const doorH = this.tile.w * this.scene.layout.wall.height * 0.58;
    const hinge = this.toScreen(0, exit.position.y - half);
    const latch = this.toScreen(0, exit.position.y + half);
    return [hinge, latch, up(latch, doorH), up(hinge, doorH)];
  }

  /** Sortie (porte) sous un point du canvas, ou null. */
  exitAtPoint(x, y) {
    for (const exit of this.exits) {
      const poly = this.doorPolygon(exit);
      if (!poly) continue;
      const xs = poly.map((p) => p.x);
      const ys = poly.map((p) => p.y);
      if (x >= Math.min(...xs) - 4 && x <= Math.max(...xs) + 4 && y >= Math.min(...ys) - 4 && y <= Math.max(...ys) + 4) return exit;
    }
    return null;
  }

  /** Rectangle à l'écran des bureaux et des combattants en étude (clic sur les meubles eux-mêmes). */
  deskBox() {
    if (!this.grid) return null;
    const desks = this.scene.props.filter((p) => p.type === 'studyDesk');
    const points = desks.flatMap((desk) => [this.toScreen(desk.x, desk.y + desk.h), this.toScreen(desk.x + desk.w, desk.y)]);
    const feet = this.scene.seats.map((seat) => this.toScreen(seat.stand.x, seat.stand.y));
    const xs = [...points.map((p) => p.x), ...feet.flatMap((f) => [f.x - this.figureHeight * 0.3, f.x + this.figureHeight * 0.3])];
    const ys = [...points.map((p) => p.y), ...feet.map((f) => f.y)];
    return {
      left: Math.min(...xs), right: Math.max(...xs),
      top: Math.min(...ys, ...feet.map((f) => f.y - this.figureHeight)) - this.tile.w * 0.4, bottom: Math.max(...ys) + 4,
    };
  }

  /** Rectangle à l'écran de Flavia (clic sur le personnage, en plus de sa zone au sol). */
  flaviaBox() {
    if (!this.grid) return null;
    const where = this.scene.flaviaAmbience.frame();
    const foot = this.toScreen(where.x, where.y);
    const h = this.figureHeight * 1.08;
    return { left: foot.x - h * 0.3, right: foot.x + h * 0.3, top: foot.y - h, bottom: foot.y + 4 };
  }

  render(time) {
    const { scene } = this;
    if (!this.grid) this.fit(scene.width, scene.height);
    this.doorOpen = this.effects.doorOpenAmount(time);
    if (this.hover?.type === 'exit') this.doorOpen = Math.max(this.doorOpen, 0.3);
    this.clear();
    // Dallage fixe : gardé en mémoire (v1.1.9).
    this.drawCachedLayer('floor', '-', () => this.#drawFloor());
    this.#drawWalls(time);
    this.#drawLightShaft(time);
    for (const prop of scene.groundProps) PROPS[prop.type]?.(this, prop, { time, teamColors: {} });
    this.#drawDeskZone(time);
    this.#drawFlaviaZone();

    const h = this.figureHeight;
    const deskHovered = this.hover?.type === 'desk';
    const drawables = scene.standingProps.map((prop) => ({
      depth: propDepth(prop),
      draw: () => PROPS[prop.type]?.(this, prop, { time, teamColors: {}, highlighted: prop.type === 'studyDesk' && deskHovered }),
    }));
    // Ceux qui travaillent sur place : copistes, lecteur, bailli (gestes du Bourg).
    scene.workers.forEach((worker, index) => {
      const frame = artisanFrame({ stand: worker.stand, work: worker.work }, time, index * 2.3);
      const x = worker.stand.x + frame.offset.x;
      const y = worker.stand.y + frame.offset.y;
      drawables.push({
        depth: x + y,
        draw: () => {
          const p = this.toScreen(x, y);
          drawSpectator(this.ctx, p.x, p.y, { spriteId: worker.spriteId, view: worker.view ?? 'front', height: h * 0.95, time, phase: index, pose: frame.pose });
          if (frame.item) this.#drawItem(p, frame, h * 0.95);
        },
      });
    });
    // Ceux qui circulent, et le groupe qui discute.
    for (const walker of scene.walkersAt(time)) {
      drawables.push({
        depth: walker.x + walker.y,
        draw: () => {
          const p = this.toScreen(walker.x, walker.y);
          drawSpectator(this.ctx, p.x, p.y, { ...walker, height: h * (walker.spriteId === 'spectator_11' ? 0.8 : 0.95), time, phase: walker.phase, pose: walkerPose(walker, time) });
          if (walker.chat) {
            const speaker = chatSpeaker(scene.layout.walkers, walker.chat, time);
            if (speaker && speaker.x === walker.x && speaker.y === walker.y) drawChatBubble(this.ctx, p.x, p.y - h * 1.05, { unit: this.tile.w * 0.18, time });
          }
        },
      });
    }
    // La Professeure Flavia : à sa table, en promenade, au rayonnage, ou caressant le chat.
    const flavia = scene.flavia;
    const flaviaHovered = this.hover?.type === 'flavia';
    const fl = scene.flaviaAmbience.frame();
    drawables.push({
      depth: fl.x + fl.y,
      draw: () => {
        const p = this.toScreen(fl.x, fl.y);
        if (flaviaHovered) {
          this.ctx.beginPath();
          this.ctx.ellipse(p.x, p.y, this.tile.w * 0.3, this.tile.w * 0.14, 0, 0, Math.PI * 2);
          this.ctx.lineWidth = 3;
          this.ctx.strokeStyle = '#f0c419';
          this.ctx.stroke();
        }
        const pose = this.#flaviaPose(fl, time);
        drawSpectator(this.ctx, p.x, p.y, { spriteId: flavia.spriteId, view: 'front', height: h * 1.08, time, phase: 2, pose });
        const item = this.#flaviaItem(fl, time);
        if (item) this.#drawItem(p, { item, pose }, h * 1.08);
      },
    });
    // L'artefact acquis, posé sur la table de Flavia (il descend s'y poser à l'achat).
    if (scene.artifact) {
      const spot = flavia.artifactSpot;
      const table = scene.standingProps.find((prop) => prop.type === 'scholarTable');
      drawables.push({ depth: table ? propDepth(table) + 0.01 : spot.x + spot.y, draw: () => this.#drawArtifact(scene.artifact, spot, time) });
    }
    // Caresses : petits cœurs qui montent au-dessus du chat.
    if (fl.state === 'pet' && scene.cat.petted) {
      const c = scene.cat.catFrame();
      drawables.push({ depth: 99, draw: () => this.#drawHearts(this.toScreen(c.x, c.y), time) });
    }
    // Le Sacré de Birmanie et la souris.
    const cat = scene.cat.catFrame();
    drawables.push({ depth: cat.x + cat.y, draw: () => { const p = this.toScreen(cat.x, cat.y); drawCat(this.ctx, p.x, p.y, { ...cat, time, size: this.tile.w * 0.58 }); } });
    const mouse = scene.cat.mouseFrame();
    if (mouse) drawables.push({ depth: mouse.x + mouse.y, draw: () => { const p = this.toScreen(mouse.x, mouse.y); drawMouse(this.ctx, p.x, p.y, { ...mouse, time, size: this.tile.w * 0.2 }); } });
    // Les combattants en étude, au Bureau d'étude, livre en main.
    for (const [index, student] of scene.students.entries()) {
      const { fighter, seat } = student;
      const frame = artisanFrame({ stand: seat.stand, work: seat.work }, time, 1.1 + index * 2.6);
      const x = seat.stand.x + frame.offset.x;
      const y = seat.stand.y + frame.offset.y;
      drawables.push({
        depth: x + y,
        draw: () => {
          const p = this.toScreen(x, y);
          drawSpriteFigure(this.ctx, p.x, p.y, {
            spriteId: fighter.spriteId, height: h, clubColors: this.teamColors ?? null, ringColor: fighter.specialty?.color ?? '#6b4521', highlighted: deskHovered, time, phase: 0.7,
            pose: frame.pose,
            fallback: { size: this.tile.w * 0.16, colors: { primary: '#6b4521', secondary: '#c9a26a' }, specialtyId: fighter.specialtyId, time, phase: 0.7 },
          });
          if (frame.item) this.#drawItem(p, frame, h);
        },
      });
    }
    drawables.sort((a, b) => a.depth - b.depth).forEach((d) => d.draw());
    this.#drawAmbience(time);
    // Pupitres occupés : encre de la plume et poussière dorée (lot VFX 4).
    const ambience = scene.students.flatMap((student, index) => studyAmbience(student.seat.work.target, time, { index }));
    drawParticles(this, [...ambience, ...this.effects.particles(time)], 'over', (x, y) => this.toScreen(x, y));
    this.#drawPlaque(this.scene.desk, this.deskLabel, this.hover?.type === 'desk');
    this.#drawPlaque(this.scene.flavia, this.flaviaLabel, this.hover?.type === 'flavia');
    this.#drawExits(time);
  }

  /** Geste de Flavia : marche, recherche au rayonnage, penchée pour caresser, lecture à sa table. */
  #flaviaPose(fl, time) {
    const flip = fl.facing < 0;
    if (fl.state === 'walk') return { ...FIGHTER_ANIMATIONS.walk(time, { facing: fl.facing }).pose, flip };
    if (fl.state === 'take') {
      // Elle se hisse vers le rayon, attrape le livre bleu, le descend.
      const reach = this.#takeReach(fl);
      return { rotate: -0.07 * reach * fl.facing, dy: -0.03 * reach, scaleY: 1 + 0.045 * reach, flip };
    }
    if (fl.state === 'read') return { ...ARTISAN_ANIMATIONS.read(time, { facing: fl.facing }).pose, flip };
    if (fl.state === 'pet') {
      // Penchée vers le chat, la main qui va et vient sur son dos.
      const stroke = Math.sin(time * 4.2);
      return { rotate: (0.24 + 0.06 * stroke) * fl.facing, dy: 0.05 + 0.01 * stroke, scaleY: 0.9, flip };
    }
    const idle = FIGHTER_ANIMATIONS.idle(time * 0.7 + 4, { facing: 1 }).pose;
    return fl.state === 'desk' ? { ...idle, flip: Math.sin(time * 0.21) > 0.6 } : { ...idle, flip };
  }

  /** Prise du livre : 0 → 1 (bras tendu vers le rayon) puis retour, selon le temps écoulé. */
  #takeReach(fl) {
    const u = Math.max(0, Math.min(1, fl.since / TAKE_SECONDS));
    const smooth = (v) => { const t = Math.max(0, Math.min(1, v)); return t * t * (3 - 2 * t); };
    return u < 0.4 ? smooth(u / 0.4) : u < 0.6 ? 1 : 1 - smooth((u - 0.6) / 0.4);
  }

  /** Le livre bleu de Flavia : sorti du rayon, porté sous le bras, ouvert pour la lecture. */
  #flaviaItem(fl, time) {
    const cover = BLUE_BOOK;
    const side = fl.facing;
    if (fl.state === 'take') {
      const since = fl.since / TAKE_SECONDS;
      if (since < 0.4) return null; // il est encore sur le rayon
      const reach = this.#takeReach(fl);
      return { kind: 'closedBook', cover, dx: 0.2 * side, dy: -0.5 - 0.28 * reach, angle: -0.2 * side, size: 0.3 };
    }
    if (fl.state === 'read') return { ...ARTISAN_ANIMATIONS.read(time, { facing: side }).item, cover, size: 0.36 };
    if (fl.hasBook) return { kind: 'closedBook', cover, dx: 0.22 * side, dy: -0.4, angle: 0.15 * side, size: 0.27 };
    return null;
  }

  /**
   * Artefact sur la table : livre à sa reliure (data/scriptorium.js, `look`), lueur qui respire ;
   * pendant son arrivée (effet 'artifact'), il descend du plafond.
   */
  #drawArtifact(artifact, spot, time) {
    const { ctx } = this;
    const s = this.tile.w;
    const { cover, size, glow } = artifact.look;
    const lift = this.effects.artifactLift(time) ?? 0;
    const p = up(this.toScreen(spot.x, spot.y), s * (spot.tableHeight + lift));
    const book = size * s;
    const glowRadius = book * (1.1 + 0.12 * Math.sin(time * 1.8));
    const gradient = ctx.createRadialGradient(p.x, p.y - book * 0.3, 0, p.x, p.y - book * 0.3, glowRadius);
    gradient.addColorStop(0, `rgba(${glow}, 0.45)`);
    gradient.addColorStop(1, `rgba(${glow}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y - book * 0.3, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y - book * 0.3);
    ctx.rotate(-0.12);
    drawHeldItem(ctx, { kind: 'closedBook', cover }, book);
    ctx.restore();
  }

  /** Petits cœurs roses qui montent au-dessus du chat caressé. */
  #drawHearts(p, time) {
    const { ctx } = this;
    const s = this.tile.w * 0.09;
    for (let i = 0; i < 3; i++) {
      const k = ((time * 0.6 + i / 3) % 1);
      const x = p.x + Math.sin(time * 2 + i * 2) * s * 1.5;
      const y = p.y - this.tile.w * (0.35 + k * 0.5);
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#e0607e';
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.6);
      ctx.bezierCurveTo(x - s, y, x - s * 0.5, y - s * 0.7, x, y - s * 0.2);
      ctx.bezierCurveTo(x + s * 0.5, y - s * 0.7, x + s, y, x, y + s * 0.6);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Objet tenu (livre, plume), dans la pose du geste. */
  #drawItem(p, frame, height) {
    const { ctx } = this;
    const { item, pose } = frame;
    ctx.save();
    ctx.translate(p.x + item.dx * height + (pose.dx ?? 0) * height, p.y + item.dy * height + (pose.dy ?? 0) * height);
    ctx.rotate(item.angle ?? 0);
    if (pose.flip) ctx.scale(-1, 1);
    drawHeldItem(ctx, item, Math.max(8, item.size * height));
    ctx.restore();
  }

  /** Dallage de pierre : grandes dalles, joints, socle sous le sol. */
  #drawFloor() {
    const { ctx, scene } = this;
    const depth = this.tile.h * 0.45;
    const a = this.toScreen(0, scene.height);
    const b = this.toScreen(scene.width, scene.height);
    const c = this.toScreen(scene.width, 0);
    const down = (p) => ({ x: p.x, y: p.y + depth });
    this.tracePolygon([a, b, down(b), down(a)]);
    ctx.fillStyle = '#4a443c';
    ctx.fill();
    this.tracePolygon([b, c, down(c), down(b)]);
    ctx.fillStyle = '#3a352e';
    ctx.fill();
    ctx.lineWidth = 1;
    for (let y = 0; y < scene.height; y++) {
      for (let x = 0; x < scene.width; x++) {
        this.traceArea(x, y);
        ctx.fillStyle = scene.layout.floor[(x * 7 + y * 3) % 2];
        ctx.fill();
        ctx.strokeStyle = 'rgba(30, 26, 20, 0.4)';
        ctx.stroke();
      }
    }
  }

  /** Murs de pierre (gros appareil), partie haute plus claire, voûte de bois (poutres). */
  #drawWalls(time) {
    const { ctx, scene } = this;
    const { stone, upper, beam, height } = scene.layout.wall;
    const H = this.tile.w * height;
    const walls = [
      { from: this.toScreen(0, scene.height), to: this.toScreen(0, 0), light: -0.12 },
      { from: this.toScreen(0, 0), to: this.toScreen(scene.width, 0), light: 0 },
    ];
    for (const wall of walls) {
      this.tracePolygon([wall.from, wall.to, up(wall.to, H), up(wall.from, H)]);
      ctx.fillStyle = shade(upper, wall.light);
      ctx.fill();
      this.tracePolygon([wall.from, wall.to, up(wall.to, H * 0.55), up(wall.from, H * 0.55)]);
      ctx.fillStyle = shade(stone, wall.light);
      ctx.fill();
      // Assises de pierres, joints décalés.
      ctx.strokeStyle = 'rgba(25, 22, 18, 0.35)';
      ctx.lineWidth = 1;
      const courses = 7;
      for (let k = 1; k < courses; k++) {
        const level = (H * k) / courses;
        ctx.beginPath();
        ctx.moveTo(wall.from.x, wall.from.y - level);
        ctx.lineTo(wall.to.x, wall.to.y - level);
        ctx.stroke();
        const steps = 14;
        for (let i = (k % 2) * 0.5; i < steps; i++) {
          const t = i / steps;
          const p = { x: wall.from.x + (wall.to.x - wall.from.x) * t, y: wall.from.y + (wall.to.y - wall.from.y) * t };
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - level);
          ctx.lineTo(p.x, p.y - level + H / courses);
          ctx.stroke();
        }
      }
      // Voûte de bois : sablière et départs de poutres.
      ctx.strokeStyle = beam;
      ctx.lineWidth = Math.max(3, this.tile.w * 0.08);
      ctx.beginPath();
      ctx.moveTo(wall.from.x, wall.from.y - H);
      ctx.lineTo(wall.to.x, wall.to.y - H);
      ctx.stroke();
      ctx.lineWidth = Math.max(2, this.tile.w * 0.05);
      for (let i = 0; i <= 5; i++) {
        const t = i / 5;
        const p = { x: wall.from.x + (wall.to.x - wall.from.x) * t, y: wall.from.y + (wall.to.y - wall.from.y) * t };
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - H * 0.78);
        ctx.lineTo(p.x, p.y - H);
        ctx.stroke();
      }
    }
    const s = this.tile.w;
    for (const item of scene.layout.walls.left) {
      if (item.type === 'door') this.#drawDoor(item, H, -0.12);
      else if (item.type === 'mouseHole') drawScriptoriumWallItem(ctx, item, this.toScreen(0, item.y), s, { light: -0.12, time });
      else drawScriptoriumWallItem(ctx, item, up(this.toScreen(0, item.y), H * 0.62), s, { light: -0.12, time });
    }
    for (const item of scene.layout.walls.back) drawScriptoriumWallItem(ctx, item, up(this.toScreen(item.x, 0), H * 0.64), s, { light: 0, time });
  }

  /** Porte de chêne cloutée du mur de gauche (s'entrouvre au survol et à l'arrivée). */
  #drawDoor(item, H, light) {
    const { ctx } = this;
    const half = (item.width ?? 0.9) / 2;
    const doorH = H * 0.58;
    const hinge = this.toScreen(0, item.y - half);
    const latch = this.toScreen(0, item.y + half);
    // Encadrement en arc de pierre et ouverture (nuit au-dehors).
    this.tracePolygon([hinge, latch, up(latch, doorH), up(hinge, doorH)]);
    ctx.fillStyle = shade('#151b2c', light);
    ctx.fill();
    ctx.lineWidth = Math.max(3, this.tile.w * 0.07);
    ctx.strokeStyle = '#5b544a';
    ctx.stroke();
    const angle = Math.max(0, Math.min(1, this.doorOpen ?? 0)) * this.effects.config.door.maxAngle * (Math.PI / 2);
    const width = half * 2;
    const far = this.toScreen(Math.sin(angle) * width, item.y - half + Math.cos(angle) * width);
    this.tracePolygon([hinge, far, up(far, doorH), up(hinge, doorH)]);
    ctx.fillStyle = shade('#5a3a1e', light - angle * 0.12);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#2e1b0b';
    ctx.stroke();
    // Clous et pentures.
    ctx.fillStyle = '#2a2a2a';
    for (const f of [0.25, 0.5, 0.75]) {
      for (const g of [0.25, 0.75]) {
        const p = { x: hinge.x + (far.x - hinge.x) * g, y: hinge.y + (far.y - hinge.y) * g - doorH * f };
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, this.tile.w * 0.015), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Rai de lumière de la fenêtre du fond, poussière qui flotte dedans. */
  #drawLightShaft(time) {
    const { ctx, scene } = this;
    const window = scene.layout.walls.back.find((item) => item.type === 'window');
    if (!window) return;
    const H = this.tile.w * scene.layout.wall.height;
    const top = up(this.toScreen(window.x, 0), H * 0.64);
    const floor = this.toScreen(window.x + 1.2, 3.2);
    const spread = this.tile.w * 0.35;
    ctx.save();
    const gradient = ctx.createLinearGradient(top.x, top.y, floor.x, floor.y);
    gradient.addColorStop(0, 'rgba(200, 215, 255, 0.16)');
    gradient.addColorStop(1, 'rgba(200, 215, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(top.x - spread * 0.4, top.y);
    ctx.lineTo(top.x + spread * 0.4, top.y);
    ctx.lineTo(floor.x + spread, floor.y);
    ctx.lineTo(floor.x - spread, floor.y);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 9; i++) {
      const k = ((time * 0.05 + i * 0.137) % 1);
      const px = top.x + (floor.x - top.x) * k + Math.sin(time * 0.8 + i) * spread * 0.4;
      const py = top.y + (floor.y - top.y) * k;
      ctx.fillStyle = `rgba(255, 245, 210, ${0.25 + 0.25 * Math.sin(time + i)})`;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(0.8, this.tile.w * 0.012), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Zone du Bureau d'étude au sol : pointillés à sa couleur, illuminée au survol. */
  #drawDeskZone(time) {
    const { ctx, scene } = this;
    const { area, color } = scene.desk;
    const hovered = this.hover?.type === 'desk';
    this.traceArea(area.x, area.y, area.w, area.h);
    if (hovered) {
      ctx.fillStyle = 'rgba(240, 196, 25, 0.14)';
      ctx.fill();
    }
    ctx.setLineDash(hovered ? [] : [6, 4]);
    ctx.lineDashOffset = hovered ? 0 : -time * 6;
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.strokeStyle = hovered ? '#f0c419' : shade(color, 0.2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  /** Zone de Flavia (4 × 4 cases, logique) : illuminée seulement au survol. */
  #drawFlaviaZone() {
    if (this.hover?.type !== 'flavia') return;
    const { ctx } = this;
    const { area } = this.scene.flavia;
    this.traceArea(area.x, area.y, area.w, area.h);
    ctx.fillStyle = 'rgba(240, 196, 25, 0.12)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#f0c419';
    ctx.stroke();
  }

  /**
   * Plaque au-dessus d'une zone : `place` = scene.desk (« Bureau d'étude » : libre, ou les
   * combattants et les jours restants) ou scene.flavia (« Professeure Flavia »).
   */
  #drawPlaque(place, { title, subtitle }, hovered) {
    const { ctx } = this;
    const anchor = up(this.toScreen(place.label.x, place.label.y), this.tile.w * 0.9);
    ctx.font = '700 15px "EB Garamond", Georgia, serif';
    const titleWidth = ctx.measureText(title).width;
    ctx.font = '500 12px "EB Garamond", Georgia, serif';
    const width = Math.max(titleWidth, ctx.measureText(subtitle).width) + 22;
    const height = subtitle ? 42 : 26;
    const left = Math.min(Math.max(anchor.x - width / 2, 6), this.view.w - width - 6);
    const top = Math.min(Math.max(anchor.y - height, 6), this.view.h - height - 6);
    roundRect(ctx, left, top, width, height, 6);
    ctx.fillStyle = 'rgba(253, 249, 238, 0.96)';
    ctx.fill();
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.strokeStyle = hovered ? '#f0c419' : place.color;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#2a2016';
    ctx.font = '700 15px "EB Garamond", Georgia, serif';
    ctx.fillText(title, left + width / 2, top + 18);
    if (subtitle) {
      ctx.fillStyle = '#5f4e38';
      ctx.font = '500 12px "EB Garamond", Georgia, serif';
      ctx.fillText(subtitle, left + width / 2, top + 34);
    }
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

  /** Lueur chaude des chandelles, coins dans la pénombre. */
  #drawAmbience(time) {
    const { ctx } = this;
    const { w, h } = this.view;
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.08, w * 0.5, h * 0.52, Math.max(w, h) * 0.72);
    glow.addColorStop(0, `rgba(255, 190, 110, ${0.07 + 0.012 * Math.sin(time * 2.3)})`);
    glow.addColorStop(1, 'rgba(12, 8, 18, 0.38)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }
}
