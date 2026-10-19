import { IsoView } from '../render/IsoView.js';
import { roundRect } from '../render/figures.js';
import { shade } from '../render/color.js';
import { drawSpectator } from '../render/spectators.js';
import { PROP_RENDERERS, propDepth } from '../render/propRenderers.js';
import { drawParticles } from '../render/vfx/particles.js';
import { exitProps, drawExitHighlight, drawExitLabel, arrivalGlow } from '../render/exitMarkers.js';
import { TRAVEL_TRANSITION } from '../data/locations.js';
import { CENTRE_CAMERA } from '../data/centreVisuals.js';
import { CentreAmbience } from '../centre/animation/environment.js';
import { FIGHTER_ANIMATIONS } from '../centre/animation/fighterAnimations.js';
import { drawChatBubble, drawFlyingBirds } from '../render/ambientFigures.js';
import { dogAt, flockAt, drawDog, drawGroundBird } from '../borough/animals.js';
import { drawSeasonTileDetail, drawSeasonWaterDetail, seasonColor, seasonWater } from '../render/seasonLook.js';

const COLORS = {
  bird: '#2a2a2e',
  tileStroke: 'rgba(40, 60, 20, 0.08)',
  water: ['#4f97c9', '#4890c3'],
  slabLeft: '#8b6a3f',
  slabRight: '#6e5230',
  plaque: 'rgba(253, 249, 238, 0.97)',
  plaqueText: '#2a2016',
  plaqueMuted: '#5f4e38',
  gold: '#f0c419',
  captain: '#9e1f2c',
};

function villagerPose(villager, time) {
  const t = time + villager.phase * 1.37;
  if (villager.walking) return { ...FIGHTER_ANIMATIONS.walk(t, { facing: 1 }).pose, flip: false };
  const idle = FIGHTER_ANIMATIONS.idle(t * (0.8 + (villager.phase % 3) * 0.15), { facing: 1 }).pose;
  return villager.idle === 'still' ? { ...idle, flip: false } : idle;
}

/**
 * Rendu isométrique des Expéditions (v0.96) : saison (sol, eau, arbres, neige des pics, météo),
 * rivière qui coule, pont, sorties (chemin du Bourg), civils, et le Baron — halo doré,
 * blason flottant au-dessus de lui, étiquette toujours visible. hoverCaptain : zone survolée.
 */
export class ExpeditionRenderer extends IsoView {
  constructor(canvas, scene) {
    super(canvas, { fillWidth: 0.98, fillHeight: 0.9, lift: 0.12 });
    this.scene = scene;
    this.hoverCaptain = false;
    this.ambience = new CentreAmbience({
      props: scene.props, activities: [],
      layout: { restCenter: { x: scene.width / 2, y: scene.height / 2 } },
    });
    this.ambience.weatherArea = { x: 0, y: 0, w: scene.width, h: scene.height };
    this.showLabels = true;
    this.exits = [];
    this.exitDecor = [];
    this.hoverExitId = null;
    this.arrival = null;
    this.camera = null;
    this.season = null;
    this.labelBox = null;
  }

  setExits(exits) {
    this.exits = exits;
    this.exitDecor = exitProps(exits, { width: this.scene.width, height: this.scene.height });
  }

  /** Arrivée par une sortie : la caméra part de ce bout de chemin, qui luit un instant. */
  setArrival(exitId) {
    const exit = this.exits.find((e) => e.id === exitId);
    if (!exit) return;
    this.arrival = { exitId, start: null };
    const { x, y, w, h } = exit.position;
    const size = 8;
    this.camera = { x: x + w / 2 - size / 2, y: y + h / 2 - size / 2, w: size, h: size };
  }

  #updateCamera(time) {
    const { scene } = this;
    if (!this.camera) {
      if (!this.grid) this.fit(scene.width, scene.height);
      return;
    }
    const dt = this.cameraTime === undefined ? 0 : Math.max(0, Math.min(0.1, time - this.cameraTime));
    this.cameraTime = time;
    const goal = { x: 0, y: 0, w: scene.width, h: scene.height };
    const k = 1 - Math.exp(-dt * 2.4);
    let done = true;
    for (const key of ['x', 'y', 'w', 'h']) {
      const delta = goal[key] - this.camera[key];
      this.camera[key] += delta * k;
      if (Math.abs(delta) > 0.02) done = false;
    }
    if (done) {
      this.camera = null;
      this.fit(scene.width, scene.height);
    } else this.fit(scene.width, scene.height, { ...this.camera });
  }

  render(time) {
    const { scene } = this;
    this.#updateCamera(time);
    this.ambience.season = this.season;
    this.ambience.update(time);
    this.clear();
    this.#drawSlab();
    this.#drawTiles(time);
    this.#drawCaptainZone(time);
    for (const prop of scene.groundProps) PROP_RENDERERS[prop.type]?.(this, prop, { time, teamColors: {} });
    if (this.arrival && this.arrival.start === null) this.arrival.start = time;
    for (const exit of this.exits) {
      const arriving = this.arrival?.exitId === exit.id ? arrivalGlow(time - this.arrival.start, TRAVEL_TRANSITION.arrivalHighlight) : 0;
      const strength = Math.max(exit.id === this.hoverExitId ? 1 : 0, arriving);
      if (strength > 0) drawExitHighlight(this, exit, { strength, time });
    }

    const figureHeight = this.tile.w * CENTRE_CAMERA.fighterHeight * 0.9;
    const drawables = scene.standingProps.map((prop) => ({ depth: propDepth(prop), draw: () => this.#drawProp(prop, time) }));
    for (const villager of scene.villagersAt(time)) {
      drawables.push({
        depth: villager.x + villager.y,
        draw: () => {
          const p = this.toScreen(villager.x, villager.y);
          drawSpectator(this.ctx, p.x, p.y, { ...villager, height: figureHeight, time, phase: villager.phase, pose: villagerPose(villager, time) });
          if (villager.chat) {
            const speaker = scene.speakerOf(villager.chat, time);
            if (speaker && speaker.x === villager.x && speaker.y === villager.y) drawChatBubble(this.ctx, p.x, p.y - figureHeight * 1.08, { unit: this.tile.w * 0.2, time });
          }
        },
      });
    }
    // Le Baron : plus grand, halo doré, blason au-dessus de lui.
    const { stand } = scene.captain;
    drawables.push({
      depth: stand.x + stand.y,
      draw: () => {
        const p = this.toScreen(stand.x, stand.y);
        this.#drawHalo(p, time);
        const idle = FIGHTER_ANIMATIONS.idle(time * 0.7, { facing: 1 }).pose;
        const height = figureHeight * 1.3;
        drawSpectator(this.ctx, p.x, p.y, { spriteId: scene.captain.spriteId, view: 'front', height, time, phase: 0, pose: { ...idle, flip: false } });
        this.#drawCrest(p.x, p.y - height * 1.42, time);
      },
    });
    (scene.layout.dogs ?? []).forEach((dog, index) => {
      const state = dogAt(dog, time);
      drawables.push({
        depth: state.x + state.y,
        draw: () => {
          const p = this.toScreen(state.x, state.y);
          drawDog(this.ctx, p.x, p.y, { ...state, time, phase: index * 1.3, size: this.tile.w * 0.42, coat: dog.coat, patch: dog.patch });
        },
      });
    });
    for (const flock of scene.layout.birds ?? []) {
      for (const bird of flockAt(flock, time)) {
        drawables.push({
          depth: bird.x + bird.y + (bird.flying ? 2 : 0),
          draw: () => {
            const p = this.toScreen(bird.x, bird.y);
            drawGroundBird(this.ctx, p.x, p.y, { ...bird, lift: bird.z * this.tile.w, size: this.tile.w * 0.09 });
          },
        });
      }
    }
    for (const prop of this.exitDecor) {
      drawables.push({ depth: prop.x + prop.y, draw: () => PROP_RENDERERS[prop.type]?.(this, { ...prop, highlighted: prop.exitId === this.hoverExitId }, { time }) });
    }
    drawables.sort((a, b) => a.depth - b.depth).forEach((d) => d.draw());
    const toScreen = (x, y) => this.toScreen(x, y);
    drawParticles(this, this.ambience.particles(time), 'over', toScreen);
    drawFlyingBirds(this, this.ambience.birds(time), COLORS.bird);
    if (this.showLabels) this.#drawCaptainLabel();
    const hoveredExit = this.exits.find((exit) => exit.id === this.hoverExitId);
    if (hoveredExit) drawExitLabel(this, hoveredExit);
  }

  #drawProp(prop, time) {
    const renderer = PROP_RENDERERS[prop.type];
    if (!renderer) return;
    const sway = this.ambience.sway(prop, time);
    if (!sway) {
      renderer(this, prop, { time, teamColors: {} });
      return;
    }
    const { ctx } = this;
    const base = this.toScreen(prop.x + (prop.w ?? 1) / 2, prop.y + (prop.h ?? 1) / 2);
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.transform(1, 0, -sway.skew, 1, 0, 0);
    ctx.translate(-base.x, -base.y);
    renderer(this, prop, { time, teamColors: {} });
    ctx.restore();
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

  /** Sol : herbe du marché, alpages et rocaille au sud, chemins, rivière (saison). */
  #drawTiles(time) {
    const { ctx, scene } = this;
    const { layout } = scene;
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.tileStroke;
    for (let y = 0; y < scene.height; y++) {
      for (let x = 0; x < scene.width; x++) {
        const alt = (x + y) % 2;
        this.traceArea(x, y);
        if (scene.isWater(x, y)) {
          const look = this.#waterLook();
          ctx.fillStyle = look ? look.colors[alt] : COLORS.water[alt];
          ctx.fill();
          this.#drawWater(x, y, time);
          if (this.season && look === seasonWater(this.season)) drawSeasonWaterDetail(this, x, y, this.season);
          continue;
        }
        let kind = 'grass';
        let color = layout.grass[alt];
        if (scene.isPath(x, y)) {
          kind = 'path';
          color = layout.pathColor[alt];
        } else if (scene.isCaptainZone(x, y)) {
          kind = 'ground';
          color = alt ? shade(scene.captain.ground, -0.04) : scene.captain.ground;
        } else if (scene.isRock(x, y)) {
          kind = 'ground';
          color = layout.rockGround[alt];
        } else if (scene.isWild(x)) color = layout.wildGrass[alt];
        ctx.fillStyle = seasonColor(color, this.season, kind);
        ctx.fill();
        ctx.stroke();
        if (this.season) drawSeasonTileDetail(this, x, y, this.season, kind);
      }
    }
  }

  /**
   * Aspect de l'eau : celui de la saison ; mais une rivière qui ne s'assèche jamais (neverDry)
   * garde l'eau du printemps en été, avec un courant plus lent.
   */
  #waterLook() {
    if (!this.season) return null;
    const look = seasonWater(this.season);
    if (look.flow || !this.scene.layout.river.neverDry) return look;
    return { ...seasonWater('spring'), flow: 0.5 };
  }

  /** Courant de la rivière (de droite à gauche à l'écran : il suit l'axe y) et reflets. */
  #drawWater(x, y, time) {
    const { ctx } = this;
    const w = this.tile.w;
    const flow = this.#waterLook()?.flow ?? 1;
    if (!flow) return;
    time *= flow;
    ctx.save();
    this.traceArea(x, y);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 2; k++) {
      const f = ((time * 0.35 + k * 0.5 + x * 0.37) % 1);
      const c = this.toScreen(x + 0.3 + k * 0.4, y + f);
      ctx.beginPath();
      ctx.moveTo(c.x - w * 0.09, c.y - w * 0.045);
      ctx.lineTo(c.x + w * 0.02, c.y + w * 0.01);
      ctx.stroke();
    }
    const glint = Math.max(0, Math.sin(time * 2.3 + x * 5.1 + y * 3.7)) ** 8;
    if (glint > 0.05) {
      const g = this.toScreen(x + 0.5 + Math.sin(x * 3 + y) * 0.2, y + 0.5 + Math.cos(y * 2 + x) * 0.2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * glint})`;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y - w * 0.04);
      ctx.lineTo(g.x + w * 0.02, g.y);
      ctx.lineTo(g.x, g.y + w * 0.04);
      ctx.lineTo(g.x - w * 0.02, g.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** Zone du Baron (5 × 5) : contour pointillé rouge ; doré et éclairé au survol. */
  #drawCaptainZone(time) {
    const { ctx, scene } = this;
    const { x, y, w, h } = scene.captain.area;
    this.traceArea(x, y, w, h);
    if (this.hoverCaptain) {
      ctx.fillStyle = 'rgba(255, 236, 170, 0.28)';
      ctx.fill();
    }
    ctx.lineWidth = this.hoverCaptain ? 3 : 2;
    ctx.setLineDash(this.hoverCaptain ? [] : [7, 5]);
    ctx.lineDashOffset = -time * 6;
    ctx.strokeStyle = this.hoverCaptain ? COLORS.gold : COLORS.captain;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  /** Halo doré qui pulse sous les pieds du Baron. */
  #drawHalo(p, time) {
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, this.tile.w * (0.34 + pulse * 0.05), this.tile.w * (0.16 + pulse * 0.025), 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(240, 196, 25, ${0.18 + pulse * 0.12})`;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLORS.gold;
    ctx.stroke();
    ctx.restore();
  }

  /** Petit écu rouge et or qui flotte au-dessus de la tête du Baron. */
  #drawCrest(x, y, time) {
    const { ctx } = this;
    const s = Math.max(9, this.tile.w * 0.16);
    const bob = Math.sin(time * 2.2) * s * 0.18;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.beginPath();
    ctx.moveTo(-s * 0.55, -s * 0.6);
    ctx.lineTo(s * 0.55, -s * 0.6);
    ctx.lineTo(s * 0.55, 0);
    ctx.quadraticCurveTo(s * 0.5, s * 0.55, 0, s * 0.75);
    ctx.quadraticCurveTo(-s * 0.5, s * 0.55, -s * 0.55, 0);
    ctx.closePath();
    ctx.fillStyle = COLORS.captain;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * 0.12);
    ctx.strokeStyle = COLORS.gold;
    ctx.stroke();
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(-s * 0.08, -s * 0.45, s * 0.16, s * 0.95);
    ctx.fillRect(-s * 0.35, -s * 0.18, s * 0.7, s * 0.16);
    ctx.restore();
  }

  /** Le cadre de l'étiquette du Baron est-il sous le point (x, y) du canvas ? */
  labelAt(x, y) {
    const box = this.labelBox;
    return Boolean(box) && x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height;
  }

  #drawCaptainLabel() {
    const { ctx, scene } = this;
    const anchor = this.toScreen(scene.captain.label.x, scene.captain.label.y);
    const title = scene.captain.title;
    const detail = scene.captain.subtitle;
    ctx.font = '700 15px "EB Garamond", Georgia, serif';
    const titleWidth = ctx.measureText(title).width;
    ctx.font = '500 12px "EB Garamond", Georgia, serif';
    const width = Math.max(titleWidth, ctx.measureText(detail).width) + 24;
    const height = 42;
    const margin = 6;
    const left = Math.min(Math.max(anchor.x - width / 2, margin), this.view.w - width - margin);
    const top = Math.min(Math.max(anchor.y - height - 8, margin), this.view.h - height - margin);
    this.labelBox = { left, top, width, height };
    roundRect(ctx, left, top, width, height, 6);
    ctx.fillStyle = COLORS.plaque;
    ctx.fill();
    ctx.lineWidth = this.hoverCaptain ? 3 : 2.5;
    ctx.strokeStyle = this.hoverCaptain ? COLORS.gold : COLORS.captain;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = COLORS.captain;
    ctx.font = '700 15px "EB Garamond", Georgia, serif';
    ctx.fillText(title, left + width / 2, top + 18);
    ctx.fillStyle = COLORS.plaqueMuted;
    ctx.font = '500 12px "EB Garamond", Georgia, serif';
    ctx.fillText(detail, left + width / 2, top + 34);
  }
}
