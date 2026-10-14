import { IsoView } from '../../render/IsoView.js';
import { drawSpriteFigure } from '../../render/sprites.js';
import { drawSpectator } from '../../render/spectators.js';
import { getColorIntensity, getFighterColorIntensity } from '../../systems/fighters/FatigueService.js';
import { drawLabel } from '../../render/figures.js';
import { drawParticles } from '../../render/vfx/particles.js';
import { SceneEffects } from '../../render/vfx/sceneEffects.js';
import { COMBAT_RULES } from '../../data/combatRules.js';
import { drawGroundTile } from '../../render/groundStyles.js';
import { PROP_RENDERERS, propDepth } from '../../render/propRenderers.js';
import { getLiceDecoration } from '../../data/liceDecorations.js';
import { CROWD_LAYOUT } from '../../data/crowd.js';
import { buildLiceScenery, zoneOf } from '../presentation/liceScenery.js';
import { drawSeasonTileDetail, seasonGroundZone, seasonSky, seasonWeatherParticles } from '../../render/seasonLook.js';
import { getVfxLevel } from '../../render/vfx/vfxLevel.js';

// Jauge de fatigue : seuils (fraction de 100) et couleurs. `calm` = seuil du malus de dégâts.
const FATIGUE_BAR = Object.freeze({
  calm: COMBAT_RULES.fatigueDamage.threshold / 100,
  tired: 0.75,
  colors: Object.freeze({ calm: '#6fa8d6', tired: '#e0a23a', spent: '#c0392b' }),
});

const COLORS = {
  hover: 'rgba(255, 255, 255, 0.4)',
  deployFill: 'rgba(39, 80, 141, 0.16)',
  deployStroke: '#27508d',
  ghost: 'rgba(60, 40, 30, 0.35)',
};

/**
 * Rendu isométrique de La Lice : grille de combat entourée de sa palissade de bois, de la
 * foule et d'un décor (data/liceDecorations.js). Toutes les coordonnées reçues sont celles
 * de la grille de combat (sans bande de foule ni décor).
 *
 * Ordre de dessin (les combattants ne sont jamais masqués) :
 *   sol (en cache) → zones → décor et foule arrière → palissade arrière → palissade avant
 *   → décor et foule avant → combattants.
 *
 * Présentation (setPresentation) : { decoration, crowd } — sans effet sur le combat.
 * État d'affichage : hoverTile, highlightedId, highlightArea (zone de placement),
 * ghosts (adversaires inconnus).
 */
export class IsoRenderer extends IsoView {
  constructor(canvas) {
    super(canvas, { fillWidth: 0.98, fillHeight: 0.86, lift: 0.22 });
    this.arena = null;
    this.decoration = getLiceDecoration();
    this.crowd = [];
    this.scenery = null;
    // Décalage du terrain de combat dans la vue (ceinture de décor, pas forcément symétrique).
    this.offset = { x: 0, y: 0 };
    this.border = 0;
    this.hoverTile = null;
    this.highlightedId = null;
    this.highlightArea = null;
    this.ghosts = [];
    // Autres personnages dans la lice, triés en profondeur avec les combattants (présentation) :
    // [{ depth (x + y, terrain), draw() }] — le Marshal de la lice d'entraînement.
    this.extraActors = [];
    // Zone de placement adverse (pointillés rouges), combattants signalés (anneau pulsé),
    // effets flottants (dégâts, KO) — présentation seulement.
    this.enemyArea = null;
    this.markedIds = new Set();
    this.effects = [];
    // Particules du rejeu (combat/presentation/vfx.js) : sous ou devant les combattants.
    this.vfx = [];
    // Tremblement des gros coups (pixels, combat/presentation/vfx.js : shakeAt) et effets à
    // l'horloge de rendu (fanions de la manche gagnée : ils durent après l'arrêt du rejeu).
    this.shake = { x: 0, y: 0 };
    this.sceneFx = new SceneEffects();
    // Caméra (rejeu d'une manche) : zone suivie, cadrage courant.
    this.cameraTarget = null;
    this.cameraFocus = null;
    this.groundCache = null;
  }

  /** Décor et foule à afficher (présentation uniquement). */
  setPresentation({ decoration = this.decoration, crowd = this.crowd, season = this.season ?? null } = {}) {
    const changed = decoration !== this.decoration;
    // Saison de l'année (v0.70) : habillage du décor (sol, végétation, ciel, météo) ; le terrain,
    // les placements et les combattants ne changent pas. null : aspect d'origine.
    if (season !== this.season) this.groundCache = null;
    this.season = season;
    this.decoration = decoration ?? getLiceDecoration();
    this.crowd = crowd ?? [];
    this.excitement = Math.min(1, this.crowd.length / 40);
    if (changed && this.arena) this.setArena(this.arena);
  }

  setArena(arena) {
    this.arena = arena;
    this.scenery = buildLiceScenery(arena, this.decoration);
    this.offset = this.scenery.offset;
    this.border = this.scenery.border;
    this.fit(this.scenery.width, this.scenery.height, this.scenery.focus);
    this.cameraFocus = { ...this.scenery.focus };
    this.groundCache = null;
  }

  /**
   * Caméra : zone de la grille de combat à cadrer ({ x, y, w, h }, coordonnées du terrain), ou
   * null pour la vue d'ensemble. La vue glisse et zoome en douceur vers cette zone.
   */
  setCameraTarget(area) {
    this.cameraTarget = area ? { x: area.x + this.offset.x, y: area.y + this.offset.y, w: area.w, h: area.h } : null;
  }

  /** Rapproche le cadrage actuel de la cible (vue d'ensemble par défaut). */
  #updateCamera(time) {
    const dt = this.lastRenderTime === undefined ? 0 : Math.max(0, Math.min(0.1, time - this.lastRenderTime));
    this.lastRenderTime = time;
    const goal = this.cameraTarget ?? this.scenery.focus;
    const focus = this.cameraFocus ?? { ...goal };
    const k = 1 - Math.exp(-dt * 3.5);
    let moved = false;
    for (const key of ['x', 'y', 'w', 'h']) {
      const delta = goal[key] - focus[key];
      if (Math.abs(delta) > 0.002) {
        focus[key] += delta * k;
        moved = true;
      }
    }
    this.cameraFocus = focus;
    if (moved) this.fit(this.scenery.width, this.scenery.height, focus);
  }

  /** Coordonnées terrain → écran. */
  toArenaScreen(x, y) {
    return this.toScreen(x + this.offset.x, y + this.offset.y);
  }

  /** Case du terrain sous le pointeur, ou null (hors terrain ou dans le décor). */
  pickArenaTile(clientX, clientY) {
    const tile = this.pickTile(clientX, clientY);
    if (!tile || !this.arena) return null;
    const local = { x: tile.x - this.offset.x, y: tile.y - this.offset.y };
    return this.arena.isInside(local.x, local.y) ? local : null;
  }

  /**
   * Manche gagnée : fanions aux couleurs du vainqueur au-dessus de ses combattants debout
   * (winners : [{ x, y }], coordonnées du terrain) et poussière de la foule.
   */
  celebrateRound(winners, color) {
    if (!this.arena) return null;
    return this.sceneFx.add('roundWin', { winners, color, width: this.arena.width, height: this.arena.height });
  }

  render(scene, time) {
    if (this.arena !== scene.arena || !this.grid) this.setArena(scene.arena);
    this.#updateCamera(time);
    this.clear();
    // Tremblement : toute la scène est décalée ; le fond déborde pour ne rien laisser à nu.
    const shaking = Boolean(this.shake?.x || this.shake?.y);
    if (shaking) {
      this.ctx.fillStyle = (this.decoration.background ?? ['#a9cbe6', '#d3e6f0'])[1];
      this.ctx.fillRect(0, 0, this.view.w, this.view.h);
      this.ctx.save();
      this.ctx.translate(this.shake.x, this.shake.y);
    }
    this.#drawScene(scene, time);
    drawParticles(this, this.sceneFx.particles(time), 'over', (x, y) => this.toArenaScreen(x, y));
    // Météo de la saison (flocons, feuilles, pétales, poussière) sur tout le décor.
    if (this.season && this.scenery) {
      const area = { x: 0, y: 0, w: this.scenery.width, h: this.scenery.height };
      drawParticles(this, seasonWeatherParticles(this.season, time, area, getVfxLevel().count), 'over', (x, y) => this.toScreen(x, y));
    }
    if (shaking) this.ctx.restore();
  }

  #drawScene(scene, time) {
    this.#drawCachedGround();
    this.#drawOverlays();

    const o = this.offset;
    const layers = { back: [], front: [] };
    for (const prop of this.scenery.props) {
      if (prop.layer === 'ground') continue;
      layers[prop.zone].push({ depth: propDepth(prop), draw: () => PROP_RENDERERS[prop.type]?.(this, prop, { time, teamColors: {} }) });
    }
    const height = this.tile.w * CROWD_LAYOUT.height;
    for (const spectator of this.crowd) {
      const zone = zoneOf(this.arena, spectator.x, spectator.y) === 'front' ? 'front' : 'back';
      layers[zone].push({
        depth: spectator.x + spectator.y + o.x + o.y,
        draw: () => {
          if (spectator.isQueen) this.#drawRoyalDais(spectator);
          const p = this.toArenaScreen(spectator.x, spectator.y);
          drawSpectator(this.ctx, p.x, p.y, { ...spectator, height: height * spectator.scale, time, excitement: spectator.isQueen ? 0 : this.excitement });
        },
      });
    }
    const byDepth = (a, c) => a.depth - c.depth;
    layers.back.sort(byDepth).forEach((d) => d.draw());
    this.#drawFence('back');
    this.#drawFence('front');
    layers.front.sort(byDepth).forEach((d) => d.draw());
    this.#drawVfx('under');

    // Combattants (et adversaires inconnus) : toujours au premier plan.
    const actors = [];
    for (const ghost of this.ghosts) {
      actors.push({ depth: ghost.x + ghost.y + 1, draw: () => this.#drawGhost(ghost) });
    }
    for (const combatant of scene.combatants) {
      // Un combattant KO s'efface puis disparaît de la lice (view.hidden).
      if (combatant.view?.hidden) continue;
      // Pendant qu'il s'efface, il reste derrière les combattants actifs.
      const depth = combatant.position.x + combatant.position.y + (combatant.view?.ko ? -0.5 : 0.01);
      actors.push({ depth, draw: () => this.#drawCombatant(combatant, time) });
    }
    actors.push(...this.extraActors);
    actors.sort(byDepth).forEach((d) => d.draw());
    this.#drawUnitOverlays(scene.combatants);
    this.#drawVfx('over');
    this.#drawEffects();
  }

  /** Particules d'une couche : étincelles, bouffées de sable, éclairs (rejeu d'une manche). */
  #drawVfx(layer) {
    drawParticles(this, this.vfx, layer, (x, y) => this.toArenaScreen(x, y));
  }

  // --- Sol (statique, dessiné une fois dans un cache) ---

  #drawCachedGround() {
    const key = `${this.canvas.width}x${this.canvas.height}:${this.tile.w}:${this.origin.x},${this.origin.y}:${this.decoration.id}:${this.season ?? '-'}`;
    if (!this.groundCache || this.groundCache.key !== key) {
      const cache = document.createElement('canvas');
      cache.width = this.canvas.width;
      cache.height = this.canvas.height;
      const cacheCtx = cache.getContext('2d');
      cacheCtx.setTransform(this.ctx.getTransform());
      const mainCtx = this.ctx;
      this.ctx = cacheCtx;
      try {
        this.#drawBackground();
        this.#drawGround();
      } finally {
        this.ctx = mainCtx;
      }
      this.groundCache = { key, canvas: cache };
    }
    this.ctx.drawImage(this.groundCache.canvas, 0, 0, this.view.w, this.view.h);
  }

  #drawBackground() {
    const [top, bottom] = seasonSky(this.decoration.background ?? ['#a9cbe6', '#d3e6f0'], this.season);
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.view.h);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.view.w, this.view.h);
  }

  #drawGround() {
    const { ctx, grid, arena } = this;
    const { ground } = this.decoration;
    const depth = this.tile.h * 0.5;
    const a = this.toScreen(0, grid.height);
    const bb = this.toScreen(grid.width, grid.height);
    const c = this.toScreen(grid.width, 0);
    const down = (p) => ({ x: p.x, y: p.y + depth });
    this.tracePolygon([a, bb, down(bb), down(a)]);
    ctx.fillStyle = ground.slab.left;
    ctx.fill();
    this.tracePolygon([bb, c, down(c), down(bb)]);
    ctx.fillStyle = ground.slab.right;
    ctx.fill();

    const band = this.decoration.layout.crowdBand;
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const lx = x - this.offset.x;
        const ly = y - this.offset.y;
        const inArena = arena.isInside(lx, ly);
        const inBand = lx >= -band && ly >= -band && lx < arena.width + band && ly < arena.height + band;
        const onPath = !inArena && !inBand && ground.path && this.scenery.isPath(x, y);
        const role = inArena ? 'arena' : inBand || onPath ? 'path' : 'grass';
        drawGroundTile(this, x, y, seasonGroundZone(inArena ? ground.arena : inBand ? ground.crowd : onPath ? ground.path : ground.outer, this.season, role));
        // Détails de la saison autour de La Lice (jamais sur le terrain de combat : lisibilité).
        if (this.season && !inArena) drawSeasonTileDetail(this, x, y, this.season, role === 'grass' ? 'grass' : 'path');
      }
    }
    // Quadrillage du terrain de combat (les cases de placement).
    ctx.lineWidth = 1;
    ctx.strokeStyle = ground.arena.grid ?? 'rgba(80, 55, 25, 0.22)';
    for (let y = 0; y < arena.height; y++) {
      for (let x = 0; x < arena.width; x++) {
        this.traceArea(x + this.offset.x, y + this.offset.y);
        ctx.stroke();
      }
    }
    // Éléments posés au sol (fleurs…).
    for (const prop of this.scenery.props.filter((p) => p.layer === 'ground')) PROP_RENDERERS[prop.type]?.(this, prop, { time: 0, teamColors: {} });
  }

  #drawOverlays() {
    const { ctx } = this;
    if (this.enemyArea) {
      const { x, y, w, h } = this.enemyArea;
      this.traceArea(x + this.offset.x, y + this.offset.y, w, h);
      ctx.fillStyle = 'rgba(160, 40, 30, 0.12)';
      ctx.fill();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#a3291f';
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (this.highlightArea) {
      const { x, y, w, h } = this.highlightArea;
      this.traceArea(x + this.offset.x, y + this.offset.y, w, h);
      ctx.fillStyle = COLORS.deployFill;
      ctx.fill();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLORS.deployStroke;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (this.hoverTile) {
      this.traceArea(this.hoverTile.x + this.offset.x, this.hoverTile.y + this.offset.y);
      ctx.fillStyle = COLORS.hover;
      ctx.fill();
    }
  }

  /** Tapis pourpre bordé d'or sous La Reine (présentation seulement). */
  #drawRoyalDais(queen) {
    const { ctx } = this;
    const o = this.offset;
    const half = 0.38;
    this.traceArea(queen.x - half + o.x, queen.y - half + o.y, half * 2, half * 2);
    ctx.fillStyle = '#7a1f2a';
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, this.tile.w * 0.03);
    ctx.strokeStyle = '#e0b43a';
    ctx.stroke();
  }

  /** Palissade de bois sur tout le pourtour : moitié arrière (bords x = 0 et y = 0) ou avant. */
  #drawFence(half) {
    const { ctx, arena } = this;
    const { fence } = this.decoration;
    const o = this.offset;
    const W = arena.width;
    const H = arena.height;
    const edges = half === 'back'
      ? [[[0, H], [0, 0]], [[0, 0], [W, 0]]]
      : [[[W, 0], [W, H]], [[W, H], [0, H]]];
    const postHeight = this.tile.h * 0.7;
    ctx.lineCap = 'round';
    for (const [[x0, y0], [x1, y1]] of edges) {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      const start = this.toScreen(x0 + o.x, y0 + o.y);
      const end = this.toScreen(x1 + o.x, y1 + o.y);
      ctx.strokeStyle = fence.rail;
      ctx.lineWidth = Math.max(1.5, this.tile.w * 0.04);
      for (const level of [0.8, 0.4]) {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y - postHeight * level);
        ctx.lineTo(end.x, end.y - postHeight * level);
        ctx.stroke();
      }
      ctx.strokeStyle = fence.post;
      ctx.lineWidth = Math.max(2, this.tile.w * 0.05);
      for (let s = 0; s <= steps; s += 1) {
        const p = this.toScreen(x0 + o.x + ((x1 - x0) * s) / steps, y0 + o.y + ((y1 - y0) * s) / steps);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y - postHeight);
        ctx.stroke();
      }
    }
  }

  #drawCombatant(combatant, time) {
    // `view` (rejeu d'une manche, CombatPlayback) : élan d'attaque, PV, KO, animation.
    const view = combatant.view ?? null;
    const lunge = view?.lunge ?? { dx: 0, dy: 0 };
    const p = this.toArenaScreen(combatant.position.x + lunge.dx, combatant.position.y + lunge.dy);
    const highlighted = combatant.id === this.highlightedId;
    const marked = this.markedIds.has(combatant.id);
    const colors = combatant.team.emblem.resolvedColors();
    const { ctx } = this;
    if (marked) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, this.tile.w * (0.36 + pulse * 0.06), this.tile.h * (0.36 + pulse * 0.06), 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(240, 196, 25, 0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    if (view?.ko) ctx.globalAlpha = 0.55 * (view.koFade ?? 1);
    drawSpriteFigure(ctx, p.x, p.y, {
      spriteId: combatant.fighter.spriteId,
      animation: view?.animation,
      height: this.tile.w * 0.78,
      // Tabard aux couleurs du club du combattant (même variante, même équipement).
      clubColors: colors,
      ringColor: colors.primary,
      highlighted,
      label: highlighted ? combatant.fighter.name : null,
      time: view?.ko ? 0 : time,
      phase: combatant.animationPhase,
      // Couleurs selon la fatigue : celle du moment pendant le rejeu (v0.66), sinon celle fournie
      // (fatigue dans le combat, adversaires compris), sinon celle du combattant.
      colorIntensity: view?.ko ? 0 : typeof view?.fatigue === 'number' ? getColorIntensity(view.fatigue) : (combatant.colorIntensity ?? getFighterColorIntensity(combatant.fighter)),
      fallback: { size: this.tile.w * 0.16, colors, specialtyId: combatant.fighter.specialtyId, time, phase: combatant.animationPhase },
    });
    ctx.globalAlpha = 1;
    // Barre de PV et pastilles : dessinées ensuite par-dessus tous les combattants (#drawUnitOverlays).
    if (view?.ko) {
      ctx.globalAlpha = view.koFade ?? 1;
      drawLabel(ctx, 'KO', p.x, p.y - this.tile.w * 0.86, Math.max(11, this.tile.w * 0.22));
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Barres de PV et pastilles, après tous les combattants : en mêlée, le sprite de devant ne
   * cache plus la barre de celui de derrière (même ordre de profondeur entre elles).
   */
  #drawUnitOverlays(combatants) {
    const ordered = [...combatants].sort((a, b) => (a.position.x + a.position.y) - (b.position.x + b.position.y));
    for (const combatant of ordered) {
      const view = combatant.view ?? null;
      const lunge = view?.lunge ?? { dx: 0, dy: 0 };
      const p = this.toArenaScreen(combatant.position.x + lunge.dx, combatant.position.y + lunge.dy);
      if (view && !view.ko) this.#drawHealthBar(p, view, combatant.team.emblem.resolvedColors().primary, view.state === 'taking_damage');
      // Pastilles : bonus et effets (rejeu : view.badges ; placement : combatant.badges).
      const badges = view?.badges ?? combatant.badges;
      if (badges?.length) this.#drawBadges(p, badges);
    }
  }

  /** Étiquettes de bonus empilées au-dessus d'un combattant (lancement d'une manche). */
  #drawBadges(p, badges) {
    const { ctx } = this;
    const size = Math.max(10, this.tile.w * 0.17);
    ctx.font = `700 ${size}px "EB Garamond", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    badges.forEach((text, i) => {
      const y = p.y - this.tile.w * 1.08 - i * (size + 6);
      const w = ctx.measureText(text).width + 10;
      ctx.fillStyle = 'rgba(42, 29, 16, 0.88)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(p.x - w / 2, y - size / 2 - 3, w, size + 6, 6);
      else ctx.rect(p.x - w / 2, y - size / 2 - 3, w, size + 6);
      ctx.fill();
      ctx.strokeStyle = '#e0b43a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fff6e0';
      ctx.fillText(text, p.x, y + 1);
    });
    ctx.textBaseline = 'alphabetic';
  }

  /** Barre de PV au-dessus d'un combattant (rejeu d'une manche). */
  #drawHealthBar(p, view, color, flash) {
    const { ctx } = this;
    const w = this.tile.w * 0.5;
    const h = Math.max(3, this.tile.w * 0.06);
    const x = p.x - w / 2;
    const y = p.y - this.tile.w * 0.9;
    const ratio = Math.max(0, Math.min(1, view.hp / view.maxHp));
    ctx.fillStyle = 'rgba(20, 14, 8, 0.75)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = flash ? '#ffffff' : ratio > 0.5 ? '#3c9a3c' : ratio > 0.25 ? '#d49a1e' : '#c0392b';
    ctx.fillRect(x, y, w * ratio, h);
    ctx.fillStyle = color;
    ctx.fillRect(x - 1, y + h + 1, w + 2, 2);
    // Jauge de fatigue (v0.66) sous les PV : elle évolue pendant la manche. Bleue jusqu'au seuil
    // du malus (repère), puis ambre, puis rouge quand l'épuisement ronge les dégâts.
    if (typeof view.fatigue === 'number') {
      const fy = y + h + 4;
      const fh = Math.max(2, this.tile.w * 0.04);
      const value = Math.max(0, Math.min(100, view.fatigue)) / 100;
      ctx.fillStyle = 'rgba(20, 14, 8, 0.7)';
      ctx.fillRect(x - 1, fy - 1, w + 2, fh + 2);
      ctx.fillStyle = value <= FATIGUE_BAR.calm ? FATIGUE_BAR.colors.calm : value <= FATIGUE_BAR.tired ? FATIGUE_BAR.colors.tired : FATIGUE_BAR.colors.spent;
      ctx.fillRect(x, fy, w * value, fh);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fillRect(x + w * FATIGUE_BAR.calm - 0.5, fy, 1, fh);
    }
  }

  /** Dégâts flottants et KO (rejeu d'une manche). */
  #drawEffects() {
    const { ctx } = this;
    // Mêlée : plusieurs chiffres au même endroit. Les plus anciens gardent leur place, chaque
    // nouveau monte au-dessus de celui qu'il recouvrirait.
    const placed = [];
    for (const effect of [...this.effects].sort((a, b) => b.age - a.age)) {
      const p = this.toArenaScreen(effect.x, effect.y);
      const rise = effect.age * this.tile.w * 0.5 + (effect.kind === 'ko' ? this.tile.w * 0.3 : 0);
      const size = Math.max(12, this.tile.w * (effect.kind === 'ko' ? 0.3 : 0.24));
      const box = { x: p.x, y: p.y - this.tile.w * 1.05 - rise, half: effect.text.length * size * 0.32 + 4, h: size * 1.05 };
      for (let tries = 0; tries < 6; tries += 1) {
        const hit = placed.find((b) => Math.abs(b.x - box.x) < b.half + box.half && Math.abs(b.y - box.y) < (b.h + box.h) / 2);
        if (!hit) break;
        box.y = hit.y - (hit.h + box.h) / 2 - 1;
      }
      placed.push(box);
      ctx.globalAlpha = Math.max(0, 1 - effect.age);
      const color = effect.kind === 'ko' ? '#f0c419' : effect.kind === 'advantage' ? '#ff6b3d' : '#ffffff';
      drawLabel(ctx, effect.text, box.x, box.y, size, { color });
      ctx.globalAlpha = 1;
    }
  }

  /** Adversaire dont la composition n'est pas connue : silhouette et « ? ». */
  #drawGhost(ghost) {
    const { ctx } = this;
    const p = this.toArenaScreen(ghost.x + 0.5, ghost.y + 0.5);
    const s = this.tile.w;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s * 0.2, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.ghost;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - s * 0.3, s * 0.13, s * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y - s * 0.66, s * 0.1, 0, Math.PI * 2);
    ctx.fill();
    drawLabel(ctx, '?', p.x, p.y - s * 0.86, Math.max(12, s * 0.3));
  }
}
