import { IsoView } from '../../render/IsoView.js';
import { roundRect } from '../../render/figures.js';
import { drawSpriteFigure } from '../../render/sprites.js';
import { getFighterColorIntensity } from '../../systems/fighters/FatigueService.js';
import { shade } from '../../render/color.js';
import { formatChance, describeActivityEffect } from '../../systems/activities/ActivityService.js';
import { PROP_RENDERERS, propDepth } from '../../render/propRenderers.js';
import { SceneEffects } from '../../render/vfx/sceneEffects.js';
import { drawParticles } from '../../render/vfx/particles.js';
import { CENTRE_CAMERA } from '../../data/centreVisuals.js';
import { CentreAmbience } from '../animation/environment.js';
import { drawFlyingBirds } from '../../render/ambientFigures.js';
import { CentreVisualController } from '../CentreVisualController.js';
import { drawHeldItem } from './heldItems.js';
import { TRAVEL_TRANSITION } from '../../data/locations.js';
import { exitProps, drawExitHighlight, drawExitLabel, arrivalGlow } from '../../render/exitMarkers.js';
import { getClimateSeason, getCurrentSeason, getSeasonalClosure } from '../../systems/climate/ClimateService.js';
import { drawSeasonTileDetail, drawSeasonWaterDetail, seasonColor, seasonWater } from '../../render/seasonLook.js';

const COLORS = {
  water: ['#4f97c9', '#4890c3'],
  tileStroke: 'rgba(40, 60, 20, 0.08)',
  slabLeft: '#8b6a3f',
  slabRight: '#6e5230',
  plaque: 'rgba(253, 249, 238, 0.96)',
  plaqueText: '#2a2016',
  plaqueMuted: '#5f4e38',
  dropTarget: '#f0c419',
  bird: '#2a2a2e',
};

/**
 * Rendu isométrique du Centre. État d'interaction : hoverTile, hoverZone, selectedId (combattant),
 * visibleActivityId (encadré affiché), selectedActivityId (lieu sélectionné).
 * La mise en scène (combattants qui marchent et s'activent, ambiance) est confiée au
 * contrôleur (centre/CentreVisualController.js) et à l'ambiance (centre/animation/environment.js).
 */
export class CentreRenderer extends IsoView {
  constructor(canvas, scene, { camera = CENTRE_CAMERA } = {}) {
    super(canvas, { fillWidth: 0.98, fillHeight: 0.9, lift: 0.12 });
    this.scene = scene;
    this.cameraConfig = camera;
    this.hoverTile = null;
    this.hoverZone = null; // { kind: 'activity', activity } | { kind: 'rest' } | null
    this.hoverFighterId = null;
    this.selectedId = null;
    this.effects = new SceneEffects();
    this.ambience = new CentreAmbience(scene);
    // Météo des saisons sur toute la carte.
    this.ambience.weatherArea = { x: 0, y: 0, w: scene.width, h: scene.height };
    // Orientation à l'écran : l'abscisse d'un point de la grille est proportionnelle à x − y.
    this.controller = new CentreVisualController(scene, { ambience: this.ambience, toScreenX: (x, y) => x - y });
    // Étiquette de chaque lieu à l'écran (mise à jour à chaque image) : { left, top, width, height }.
    this.labelBoxes = new Map();
    // Silhouette de chaque combattant à l'écran (sélection au clic) : [{ fighterId, left, top, right, bottom, depth }].
    this.fighterBoxes = [];
    // Encadré affiché (lieu survolé ou sélectionné) et lieu sélectionné, fournis par l'écran.
    this.visibleActivityId = null;
    this.selectedActivityId = null;
    // Caméra : vue d'ensemble, ou rapprochée sur un lieu (glissement progressif).
    this.cameraTarget = this.overviewFocus();
    this.camera = { ...this.cameraTarget };
    this.lastTime = null;
    // Sorties vers les autres lieux (data/locations.js) : poteaux, barrière, survol, arrivée.
    this.exitDecor = exitProps(scene.exits ?? [], { width: scene.width, height: scene.height });
    this.hoverExitId = null;
    this.arrival = null; // { exitId, start }
  }

  /**
   * Arrivée par une sortie (retour de la Taverne, du Bourg…) : la caméra part de ce bout de
   * chemin puis rejoint la vue d'ensemble ; le chemin luit un instant.
   */
  setArrival(exitId) {
    const exit = (this.scene.exits ?? []).find((e) => e.id === exitId);
    if (!exit) return;
    this.arrival = { exitId, start: null };
    const { x, y, w, h } = exit.position;
    const size = this.cameraConfig.minFocus + 1;
    this.camera = { x: x + w / 2 - size / 2, y: y + h / 2 - size / 2, w: size, h: size };
  }

  /** Cadre de la vue d'ensemble (data/centreLayout.js `overview`). */
  overviewFocus() {
    const { scene } = this;
    return { ...(scene.layout.overview ?? { x: 0, y: 0, w: scene.width, h: scene.height }) };
  }

  /** Rapproche la caméra d'un lieu (null : vue d'ensemble). */
  focusActivity(activityId) {
    const activity = activityId ? this.scene.getActivity(activityId) : null;
    if (!activity) {
      this.cameraTarget = this.overviewFocus();
      return;
    }
    const { focusMargin, minFocus } = this.cameraConfig;
    const { x, y, w, h } = activity.area;
    const fw = Math.max(minFocus, w + focusMargin * 2);
    const fh = Math.max(minFocus, h + focusMargin * 2);
    this.cameraTarget = { x: x + w / 2 - fw / 2, y: y + h / 2 - fh / 2, w: fw, h: fh };
  }

  #updateCamera(dt) {
    const k = this.lastTime === null ? 1 : Math.min(1, dt * this.cameraConfig.ease);
    let moved = !this.grid;
    for (const key of ['x', 'y', 'w', 'h']) {
      const delta = this.cameraTarget[key] - this.camera[key];
      if (Math.abs(delta) > 1e-3) {
        this.camera[key] += delta * k;
        moved = true;
      } else this.camera[key] = this.cameraTarget[key];
    }
    if (moved || !this.focus) this.fit(this.scene.width, this.scene.height, { ...this.camera });
  }

  render(time) {
    const { scene } = this;
    const dt = this.lastTime === null ? 0 : Math.max(0, Math.min(0.1, time - this.lastTime));
    this.#updateCamera(dt);
    this.lastTime = time;
    // Saison de l'année (v0.70) : sol, eau, végétation, feux et météo (render/seasonLook.js).
    // (Vitrine du menu, sans calendrier : aspect d'origine ; seasonOverride : saison imposée.)
    const climate = this.seasonOverride ? getClimateSeason(this.seasonOverride) : scene.session?.calendar ? getCurrentSeason(scene.session) : null;
    this.season = climate?.id ?? null;
    this.climate = climate;
    this.ambience.season = this.season;
    this.controller.update(time);
    this.ambience.update(time);
    const teamColors = scene.session.playerTeam.emblem.resolvedColors();

    this.clear();
    this.#drawSlab();
    this.#drawTiles(time);
    this.#drawZones();
    for (const enclosure of scene.enclosures) this.#drawFence(enclosure.area, enclosure.fence);
    for (const prop of scene.groundProps) if (this.#onScreen(prop)) PROP_RENDERERS[prop.type]?.(this, prop, { time, teamColors });
    this.#drawExits(time);

    // Combattants (image du geste en cours) puis réactions du décor qu'ils touchent.
    const frames = [];
    const reactions = new Map();
    for (const fighter of scene.session.playerFighters) {
      const frame = this.controller.frame(fighter, time);
      if (!frame) continue;
      frames.push(frame);
      const reaction = frame.frame.reaction;
      if (reaction && frame.targetProp?.id && frame.state === 'active') {
        const current = reactions.get(frame.targetProp.id);
        if (!current || Math.abs(reaction.amount) > Math.abs(current.amount)) reactions.set(frame.targetProp.id, reaction);
      }
    }

    const drawables = [];
    for (const prop of scene.standingProps) {
      if (!this.#onScreen(prop)) continue;
      drawables.push({ depth: propDepth(prop), draw: () => this.#drawProp(prop, time, teamColors, reactions.get(prop.id)) });
    }
    for (const prop of this.exitDecor) {
      drawables.push({ depth: prop.x + prop.y, draw: () => PROP_RENDERERS[prop.type]?.(this, { ...prop, highlighted: prop.exitId === this.hoverExitId }, { time }) });
    }
    this.fighterBoxes = [];
    for (const frame of frames) {
      let depth = frame.x + frame.y + 0.01;
      if (frame.frame.behind && frame.targetProp && frame.state === 'active') depth = Math.min(depth, propDepth(frame.targetProp) - 0.05);
      drawables.push({ depth, draw: () => this.#drawFighter(frame, teamColors, time, depth) });
    }
    drawables.sort((a, b) => a.depth - b.depth).forEach((d) => d.draw());

    // Effets : gestes et ambiance, puis gains de la journée et chantiers, puis les oiseaux.
    const toScreen = (x, y) => this.toScreen(x, y);
    drawParticles(this, this.ambience.particles(time), 'over', toScreen);
    drawParticles(this, this.effects.particles(time), 'over', toScreen);
    this.#drawBirds(time);
    this.#drawLabels();
    const hovered = (scene.exits ?? []).find((exit) => exit.id === this.hoverExitId);
    if (hovered) drawExitLabel(this, hovered);
  }

  /** Lueur des sorties : survolée, ou par laquelle on vient d'arriver. */
  #drawExits(time) {
    if (this.arrival && this.arrival.start === null) this.arrival.start = time;
    for (const exit of this.scene.exits ?? []) {
      const arriving = this.arrival?.exitId === exit.id ? arrivalGlow(time - this.arrival.start, TRAVEL_TRANSITION.arrivalHighlight) : 0;
      const strength = Math.max(exit.id === this.hoverExitId ? 1 : 0, arriving);
      if (strength > 0) drawExitHighlight(this, exit, { strength, time });
    }
  }

  /** Un décor est-il (au moins en partie) dans le cadre ? */
  #onScreen(prop) {
    const margin = this.tile.w * 1.6;
    const p = this.toScreen(prop.x + (prop.w ?? 1) / 2, prop.y + (prop.h ?? 1) / 2);
    const span = this.tile.w * ((prop.w ?? 1) + (prop.h ?? 1)) / 2;
    return p.x > -margin - span && p.x < this.view.w + margin + span && p.y > -margin && p.y < this.view.h + margin * 2 + span;
  }

  /** Décor, avec son balancement au vent et sa réaction aux gestes (mannequin frappé…). */
  #drawProp(prop, time, teamColors, reaction) {
    const renderer = PROP_RENDERERS[prop.type];
    if (!renderer) return;
    const sway = this.ambience.sway(prop, time);
    if (!sway && !reaction) {
      renderer(this, prop, { time, teamColors });
      return;
    }
    const { ctx } = this;
    const base = this.toScreen(prop.x + (prop.w ?? 1) / 2, prop.y + (prop.h ?? 1) / 2);
    ctx.save();
    ctx.translate(base.x, base.y);
    if (sway) ctx.transform(1, 0, -sway.skew, 1, 0, 0);
    if (reaction?.kind === 'wobble' || reaction?.kind === 'shake') ctx.rotate(reaction.amount);
    if (reaction?.kind === 'squash') ctx.scale(1 + 0.14 * reaction.amount, 1 - 0.24 * reaction.amount);
    ctx.translate(-base.x, -base.y);
    renderer(this, prop, { time, teamColors });
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

  #tileColor(x, y) {
    const { scene } = this;
    const alt = (x + y) % 2;
    // Eau selon la saison : lit asséché en été, eau froide en hiver.
    if (scene.isWater(x, y)) return this.season ? seasonWater(this.season).colors[alt] : COLORS.water[alt];
    const zone = scene.zoneAt(x, y);
    if (zone?.kind === 'activity') {
      const ground = zone.activity.visual?.ground;
      if (ground) return seasonColor(alt ? shade(ground, -0.04) : ground, this.season, 'ground');
    }
    if (scene.isPath(x, y)) return seasonColor(scene.layout.pathColor[alt], this.season, 'path');
    return seasonColor(scene.layout.grass[alt], this.season, 'grass');
  }

  #drawTiles(time) {
    const { ctx, scene } = this;
    const margin = this.tile.w;
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.tileStroke;
    for (let y = 0; y < scene.height; y++) {
      for (let x = 0; x < scene.width; x++) {
        const c = this.toScreen(x + 0.5, y + 0.5);
        if (c.x < -margin || c.x > this.view.w + margin || c.y < -margin || c.y > this.view.h + margin) continue;
        this.traceArea(x, y);
        ctx.fillStyle = this.#tileColor(x, y);
        ctx.fill();
        ctx.stroke();
        if (scene.isWater(x, y)) {
          this.#drawWater(x, y, time);
          if (this.season) drawSeasonWaterDetail(this, x, y, this.season);
        } else if (this.season) {
          drawSeasonTileDetail(this, x, y, this.season, scene.isPath(x, y) ? 'path' : scene.zoneAt(x, y)?.kind === 'activity' ? 'ground' : 'grass');
        }
      }
    }
  }

  /** Eau : courant qui descend la rivière et reflets qui scintillent. */
  #drawWater(x, y, time) {
    const { ctx } = this;
    const w = this.tile.w;
    // Lit asséché (été) : ni courant ni reflets ; eau froide (hiver) : courant plus lent.
    const flow = this.season ? seasonWater(this.season).flow : 1;
    if (!flow) return;
    time *= flow;
    ctx.save();
    this.traceArea(x, y);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 2; k++) {
      // Le courant suit l'axe y de la rivière.
      const flow = ((time * 0.35 + k * 0.5 + x * 0.37) % 1);
      const c = this.toScreen(x + 0.3 + k * 0.4, y + flow);
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

  #drawZones() {
    const { ctx, scene } = this;
    const hovered = this.hoverZone;
    const dropping = Boolean(this.selectedId);

    if (hovered?.kind === 'rest') {
      for (const tile of scene.restTiles) {
        this.traceArea(tile.x, tile.y);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fill();
      }
    }

    for (const activity of scene.activities) {
      const { x, y, w, h } = activity.area;
      // Lieu survolé ou sélectionné (encadré verrouillé) : mis en évidence de la même façon.
      const isHovered = (hovered?.kind === 'activity' && hovered.activity.id === activity.id) || activity.id === this.selectedActivityId;
      this.traceArea(x, y, w, h);
      if (isHovered) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();
      }
      ctx.setLineDash(isHovered && dropping ? [8, 5] : []);
      ctx.lineWidth = isHovered ? 3 : 2;
      ctx.strokeStyle = isHovered && dropping ? COLORS.dropTarget : shade(activity.color, -0.1);
      ctx.stroke();
      ctx.setLineDash([]);

      if (activity.visual?.fence) this.#drawFence(activity.area, activity.visual.fence);
    }
  }

  #drawFence(area, color) {
    const { ctx } = this;
    const postHeight = this.tile.h * 0.45;
    const corners = [[area.x, area.y], [area.x + area.w, area.y], [area.x + area.w, area.y + area.h], [area.x, area.y + area.h]];
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (let i = 0; i < corners.length; i++) {
      const [x0, y0] = corners[i];
      const [x1, y1] = corners[(i + 1) % corners.length];
      const start = this.toScreen(x0, y0);
      const end = this.toScreen(x1, y1);
      ctx.lineWidth = Math.max(1.5, this.tile.w * 0.03);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y - postHeight * 0.75);
      ctx.lineTo(end.x, end.y - postHeight * 0.75);
      ctx.stroke();
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.lineWidth = Math.max(2, this.tile.w * 0.04);
      for (let s = 0; s <= steps; s++) {
        const p = this.toScreen(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y - postHeight);
        ctx.stroke();
      }
    }
  }

  #drawFighter(view, teamColors, time, depth) {
    const { fighter, frame } = view;
    const { ctx } = this;
    const p = this.toScreen(view.x, view.y);
    const height = this.tile.w * this.cameraConfig.fighterHeight;
    if (p.x < -height || p.x > this.view.w + height || p.y < -height * 0.2 || p.y > this.view.h + height * 1.2) return;
    const selected = fighter.id === this.selectedId;
    const hovered = fighter.id === this.hoverFighterId;
    const pose = frame.pose ?? {};

    // Nageur : cercles dans l'eau autour de lui.
    if (frame.ripple) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.5;
      for (const k of [0, 0.5]) {
        const r = ((time * 0.8 + k) % 1);
        ctx.globalAlpha = 1 - r;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, height * (0.18 + r * 0.25), height * (0.08 + r * 0.12), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawSpriteFigure(ctx, p.x, p.y, {
      spriteId: fighter.spriteId,
      height,
      clubColors: teamColors,
      ringColor: teamColors.primary,
      highlighted: selected || hovered,
      label: selected || hovered ? fighter.name : null,
      time,
      phase: 0,
      colorIntensity: getFighterColorIntensity(fighter),
      fallback: { size: this.tile.w * 0.2, colors: teamColors, specialtyId: fighter.specialtyId, time, phase: 0 },
      pose,
    });

    // Objet tenu (nourriture au Banquet, hache en Forêt).
    const item = frame.item;
    if (item) {
      ctx.save();
      ctx.translate(p.x + item.dx * height + (pose.dx ?? 0) * height, p.y + item.dy * height + (pose.dy ?? 0) * height);
      ctx.rotate(item.angle ?? 0);
      if (pose.flip) ctx.scale(-1, 1);
      drawHeldItem(ctx, item, Math.max(8, item.size * height));
      ctx.restore();
    }

    // Silhouette cliquable (sélection d'un combattant dans la scène).
    const width = height * 0.5;
    const top = p.y - height * (1 - (pose.sink ?? 0)) + (pose.dy ?? 0) * height;
    this.fighterBoxes.push({ fighterId: fighter.id, left: p.x - width / 2, right: p.x + width / 2, top, bottom: p.y + height * 0.08, depth });
  }

  /** Combattant sous un point de l'écran (coordonnées client) : le plus en avant, ou null. */
  pickFighter(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let best = null;
    for (const box of this.fighterBoxes) {
      if (x < box.left || x > box.right || y < box.top || y > box.bottom) continue;
      if (!best || box.depth > best.depth) best = box;
    }
    return best ? this.scene.session.getFighter(best.fighterId) ?? null : null;
  }

  /** Vol d'oiseaux de passage (au-dessus de tout, coordonnées d'écran). */
  #drawBirds(time) {
    drawFlyingBirds(this, this.ambience.birds(time), COLORS.bird);
  }

  /**
   * Encadré d'un lieu : seulement celui du lieu survolé ou sélectionné (visibleActivityId,
   * fourni par l'écran). Nom, effet, réussite, places et combattants affectés.
   */
  #drawLabels() {
    const { ctx, scene } = this;
    this.labelBoxes.clear();
    for (const activity of scene.activities) {
      if (activity.id !== this.visibleActivityId) continue;
      const anchorGrid = activity.visual?.label ?? { x: activity.area.x, y: activity.area.y };
      const anchor = this.toScreen(anchorGrid.x, anchorGrid.y);
      const assigned = scene.session.playerFighters.filter((f) => f.activityId === activity.id);
      const count = assigned.length;
      const title = `${activity.icon} ${activity.name}`;
      const occupancy = activity.capacity ? `${count} / ${activity.capacity}${count >= activity.capacity ? ' · complet' : ''}` : `${count} affecté${count > 1 ? 's' : ''}`;
      // Saison : lieu fermé (rivière asséchée, forêt enneigée).
      const closure = getSeasonalClosure(activity.id, this.climate);
      const detail = closure ? `${this.climate.icon} ${closure}` : `${describeActivityEffect(activity)} · ${formatChance(activity.successChance)} · ${occupancy}`;
      const names = assigned.map((f) => f.name.split(' ')[0]);
      const who = count ? (names.length > 4 ? `${names.slice(0, 4).join(', ')} +${names.length - 4}` : names.join(', ')) : 'Personne';

      ctx.font = '700 14px "EB Garamond", Georgia, serif';
      const titleWidth = ctx.measureText(title).width;
      ctx.font = '500 12px "EB Garamond", Georgia, serif';
      const width = Math.max(titleWidth, ctx.measureText(detail).width, ctx.measureText(who).width) + 20;
      const height = 56;
      const margin = 6;
      const left = Math.min(Math.max(anchor.x - width / 2, margin), this.view.w - width - margin);
      const top = Math.min(Math.max(anchor.y - height - 8, margin), this.view.h - height - margin);
      // Position de l'étiquette (repère du canvas, en px CSS) : boutons de l'écran posés à côté.
      this.labelBoxes.set(activity.id, { left, top, width, height });

      roundRect(ctx, left, top, width, height, 6);
      ctx.fillStyle = COLORS.plaque;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = activity.color;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = COLORS.plaqueText;
      ctx.font = '700 14px "EB Garamond", Georgia, serif';
      ctx.fillText(title, left + width / 2, top + 17);
      ctx.fillStyle = COLORS.plaqueMuted;
      ctx.font = '500 12px "EB Garamond", Georgia, serif';
      ctx.fillText(detail, left + width / 2, top + 33);
      ctx.font = 'italic 500 12px "EB Garamond", Georgia, serif';
      ctx.fillText(who, left + width / 2, top + 49);
    }
  }
}
