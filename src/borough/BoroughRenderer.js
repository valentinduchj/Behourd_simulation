import { IsoView } from '../render/IsoView.js';
import { roundRect } from '../render/figures.js';
import { shade } from '../render/color.js';
import { drawSpectator } from '../render/spectators.js';
import { PROP_RENDERERS, propDepth } from '../render/propRenderers.js';
import { SceneEffects } from '../render/vfx/sceneEffects.js';
import { drawParticles } from '../render/vfx/particles.js';
import { exitProps, drawExitHighlight, drawExitLabel, arrivalGlow } from '../render/exitMarkers.js';
import { TRAVEL_TRANSITION } from '../data/locations.js';
import { CENTRE_CAMERA } from '../data/centreVisuals.js';
import { CentreAmbience } from '../centre/animation/environment.js';
import { FIGHTER_ANIMATIONS } from '../centre/animation/fighterAnimations.js';
import { drawHeldItem } from '../centre/render/heldItems.js';
import { drawChatBubble, drawFlyingBirds } from '../render/ambientFigures.js';
import { artisanFrame } from './artisanAnimations.js';
import { chatSpeaker } from './BoroughScene.js';
import { dogAt, flockAt, drawDog, drawGroundBird } from './animals.js';
import { drawSeasonTileDetail, seasonColor } from '../render/seasonLook.js';

/**
 * Geste d'un habitant (animations des combattants du Centre) : la marche quand il se déplace ;
 * sinon l'attente — respiration, et pour certains un regard d'un côté puis de l'autre.
 */
function villagerPose(villager, time) {
  const t = time + villager.phase * 1.37;
  if (villager.walking) return { ...FIGHTER_ANIMATIONS.walk(t, { facing: 1 }).pose, flip: false };
  const idle = FIGHTER_ANIMATIONS.idle(t * (0.8 + (villager.phase % 3) * 0.15), { facing: 1 }).pose;
  return villager.idle === 'still' ? { ...idle, flip: false } : idle;
}

const COLORS = {
  bird: '#2a2a2e',
  tileStroke: 'rgba(40, 60, 20, 0.08)',
  slabLeft: '#8b6a3f',
  slabRight: '#6e5230',
  plaque: 'rgba(253, 249, 238, 0.96)',
  plaqueText: '#2a2016',
  plaqueMuted: '#5f4e38',
};

/**
 * Rendu isométrique du Bourg. État d'interaction : hoverZone (zone d'artisan survolée),
 * hoverExitId (chemin vers un autre lieu survolé). Sorties : setExits() (data/locations.js).
 */
export class BoroughRenderer extends IsoView {
  constructor(canvas, scene) {
    // Même cadrage que le Centre (même grille de 17 × 14 cases).
    super(canvas, { fillWidth: 0.98, fillHeight: 0.9, lift: 0.12 });
    this.scene = scene;
    this.hoverZone = null;
    this.effects = new SceneEffects();
    // Ambiance du Centre réutilisée telle quelle : vent, feuilles, poussière dorée, oiseaux de
    // passage, réservoir de particules (copeaux, farine des artisans).
    this.ambience = new CentreAmbience({
      props: scene.props, activities: [],
      layout: { restCenter: { x: scene.width / 2, y: scene.height / 2 } },
    });
    this.eventCycles = new Map();
    // Étiquettes des artisans (masquées dans la vitrine de l'écran principal).
    this.showLabels = true;
    // Bandes où les étiquettes ne vont pas (v1.1.8, téléphone : bandeau du haut, dock du bas).
    this.labelInsets = { top: 0, bottom: 0 };
    this.exits = [];
    this.exitDecor = [];
    this.hoverExitId = null;
    this.arrival = null; // { exitId, start }
    this.camera = null; // cadrage d'arrivée qui rejoint la vue d'ensemble
    // Saison de l'année (v0.70), fixée par l'écran (null : aspect d'origine, ex. vitrine du menu).
    this.season = null;
    this.ambience.weatherArea = { x: 0, y: 0, w: scene.width, h: scene.height };
  }

  /** Sorties dessinées et survolables (chemins vers les autres lieux). */
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

  /** Rapproche le cadrage d'arrivée de la vue d'ensemble, puis l'abandonne. */
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
    // Socle et cases : fixes (saison comprise) — gardés en mémoire (v1.1.9).
    this.drawCachedLayer('ground', this.season ?? '-', () => {
      this.#drawSlab();
      this.#drawTiles();
    });
    this.#drawZones();
    for (const prop of scene.groundProps) PROP_RENDERERS[prop.type]?.(this, prop, { time, teamColors: {} });
    if (this.arrival && this.arrival.start === null) this.arrival.start = time;
    for (const exit of this.exits) {
      const arriving = this.arrival?.exitId === exit.id ? arrivalGlow(time - this.arrival.start, TRAVEL_TRANSITION.arrivalHighlight) : 0;
      const strength = Math.max(exit.id === this.hoverExitId ? 1 : 0, arriving);
      if (strength > 0) drawExitHighlight(this, exit, { strength, time });
    }

    // Même taille de personnage qu'au Centre (fraction de la largeur d'une case).
    const figureHeight = this.tile.w * CENTRE_CAMERA.fighterHeight * 0.9;
    const drawables = scene.standingProps.map((prop) => ({ depth: propDepth(prop), draw: () => this.#drawProp(prop, time) }));
    scene.artisans.forEach((artisan, index) => {
      // L'artisan à son ouvrage : geste de son métier, puis un temps de repos (fondu).
      const frame = artisanFrame(artisan.zone, time, index * 2.7);
      this.#emitArtisanParticles(artisan, frame, time);
      const x = artisan.x + frame.offset.x;
      const y = artisan.y + frame.offset.y;
      drawables.push({
        depth: x + y,
        draw: () => {
          const p = this.toScreen(x, y);
          const hovered = this.hoverZone?.artisanId === artisan.zone.artisanId;
          if (hovered) this.#drawHalo(p, artisan.zone.artisan.color);
          const height = figureHeight * 1.08;
          drawSpectator(this.ctx, p.x, p.y, { spriteId: artisan.spriteId, view: 'front', height, time, phase: index, pose: frame.pose });
          if (frame.item) this.#drawItem(p, frame, height);
        },
      });
    });
    for (const villager of scene.villagersAt(time)) {
      drawables.push({
        depth: villager.x + villager.y,
        draw: () => {
          const p = this.toScreen(villager.x, villager.y);
          drawSpectator(this.ctx, p.x, p.y, { ...villager, height: figureHeight, time, phase: villager.phase, pose: villagerPose(villager, time) });
          if (villager.chat) {
            const speaker = chatSpeaker(scene.layout.villagers, villager.chat, time);
            if (speaker && speaker.x === villager.x && speaker.y === villager.y) drawChatBubble(this.ctx, p.x, p.y - figureHeight * 1.08, { unit: this.tile.w * 0.2, time });
          }
        },
      });
    }
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
    // Ambiance du Centre : copeaux, farine, feuilles, poussière dorée, vols d'oiseaux de passage.
    drawParticles(this, this.ambience.particles(time), 'over', toScreen);
    drawFlyingBirds(this, this.ambience.birds(time), COLORS.bird);
    if (this.showLabels) this.#drawLabels();
    const hoveredExit = this.exits.find((exit) => exit.id === this.hoverExitId);
    if (hoveredExit) drawExitLabel(this, hoveredExit);
    // Effets visuels (chantier après un achat) : au-dessus de tout.
    drawParticles(this, this.effects.particles(time), 'over', toScreen);
  }

  /** Décor, balancé au vent comme au Centre (arbres, buissons, herbes). */
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

  /** Outil tenu par l'artisan (hache, rabot, plume, pâte), dans la pose du geste. */
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

  /** Particules d'un geste (copeaux, farine) : une gerbe par coup, comme au Centre. */
  #emitArtisanParticles(artisan, frame, time) {
    for (const event of frame.events) {
      const key = `${artisan.zone.artisanId}:${event.key}`;
      const last = this.eventCycles.get(key);
      if (!event.particle) continue;
      if (last === event.cycle) continue;
      this.eventCycles.set(key, event.cycle);
      const at = event.at === 'target' ? { x: frame.target.x, y: frame.target.y } : { x: artisan.x, y: artisan.y };
      this.ambience.spawn(event.particle, at, time, { z: event.z ?? 0 });
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
        const zone = scene.zoneAt(x, y);
        // Saison : herbe sèche, rousse, enneigée ou fraîche ; chemins et sols des artisans aussi.
        const kind = scene.isPath(x, y) ? 'path' : zone?.ground ? 'ground' : 'grass';
        let color = scene.layout.grass[alt];
        if (kind === 'path') color = scene.layout.pathColor[alt];
        else if (kind === 'ground') color = alt ? shade(zone.ground, -0.04) : zone.ground;
        this.traceArea(x, y);
        ctx.fillStyle = seasonColor(color, this.season, kind);
        ctx.fill();
        ctx.stroke();
        if (this.season) drawSeasonTileDetail(this, x, y, this.season, kind);
      }
    }
  }

  #drawZones() {
    const { ctx, scene } = this;
    for (const zone of scene.zones) {
      const { x, y, w, h } = zone.area;
      const hovered = this.hoverZone === zone;
      this.traceArea(x, y, w, h);
      if (hovered) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fill();
      }
      ctx.lineWidth = hovered ? 3 : 2;
      ctx.setLineDash(hovered ? [] : [6, 4]);
      ctx.strokeStyle = shade(zone.artisan.color, -0.1);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  #drawHalo(p, color) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, this.tile.w * 0.28, this.tile.w * 0.13, 0, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f0c419';
    ctx.stroke();
    ctx.fillStyle = `${color}33`;
    ctx.fill();
  }

  /** Zone d'artisan dont l'étiquette est sous le point (x, y), en coordonnées du canvas. */
  labelZoneAt(x, y) {
    for (const [zone, box] of this.labelBoxes ?? []) {
      if (x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height) return zone;
    }
    return null;
  }

  #drawLabels() {
    const { ctx, scene } = this;
    // Cadres des étiquettes (cliquables comme leur zone).
    this.labelBoxes = new Map();
    for (const zone of scene.zones) {
      const anchor = this.toScreen(zone.label.x, zone.label.y);
      const title = `${zone.artisan.icon} ${zone.artisan.name}`;
      const detail = zone.subtitle ?? '';
      ctx.font = '700 15px "EB Garamond", Georgia, serif';
      const titleWidth = ctx.measureText(title).width;
      ctx.font = '500 12px "EB Garamond", Georgia, serif';
      const width = Math.max(titleWidth, ctx.measureText(detail).width) + 22;
      const height = 42;
      const margin = 6;
      const left = Math.min(Math.max(anchor.x - width / 2, margin), this.view.w - width - margin);
      const top = Math.min(Math.max(anchor.y - height - 8, margin + this.labelInsets.top), this.view.h - height - margin - this.labelInsets.bottom);
      this.labelBoxes.set(zone, { left, top, width, height });
      const hovered = this.hoverZone === zone;
      roundRect(ctx, left, top, width, height, 6);
      ctx.fillStyle = COLORS.plaque;
      ctx.fill();
      ctx.lineWidth = hovered ? 3 : 2;
      ctx.strokeStyle = hovered ? '#f0c419' : zone.artisan.color;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = COLORS.plaqueText;
      ctx.font = '700 15px "EB Garamond", Georgia, serif';
      ctx.fillText(title, left + width / 2, top + 18);
      ctx.fillStyle = COLORS.plaqueMuted;
      ctx.font = '500 12px "EB Garamond", Georgia, serif';
      ctx.fillText(detail, left + width / 2, top + 34);
    }
  }
}
