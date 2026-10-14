import { IsoRenderer } from '../combat/render/IsoRenderer.js';
import { drawSpectator } from '../render/spectators.js';
import { PROP_RENDERERS } from '../render/propRenderers.js';
import { drawExitHighlight, drawExitLabel, exitAtSignpost, arrivalGlow } from '../render/exitMarkers.js';
import { exitAtTile } from '../systems/navigation/LocationNavigationService.js';
import { TRAVEL_TRANSITION } from '../data/locations.js';
import { CROWD_LAYOUT } from '../data/crowd.js';
import { MARSHAL } from '../data/training.js';
import { roundRect } from '../render/figures.js';

// Ma Lice d'entraînement (v0.71) — rendu : la lice et son décor (IsoRenderer, décor
// 'lice_training', saisons comprises), plus le Marshal et le chemin qui ramène au Centre.
// Présentation seulement : la simulation ne lit rien ici.
//
// Le Marshal : dans la lice, bien en vue. Hors combat, il fait sa ronde au milieu du terrain,
// s'arrête et regarde ; au lancement d'un combat, il lève son bâton (signal de départ), puis reste
// à son poste, au bord arrière, loin des zones de placement. Il est trié en profondeur avec les
// combattants (IsoRenderer.extraActors) : jamais dessiné par-dessus eux.

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Position du Marshal en ronde à l'instant `time` (coordonnées du terrain) : { x, y, walking, facing }. */
export function marshalPatrolAt(time, config = MARSHAL) {
  const points = config.patrol;
  const leg = config.walkSeconds + config.pauseSeconds;
  const cycle = points.length * leg;
  const t = ((time % cycle) + cycle) % cycle;
  const index = Math.floor(t / leg);
  const from = points[index];
  const to = points[(index + 1) % points.length];
  const local = t - index * leg;
  if (local < config.pauseSeconds) return { x: from.x, y: from.y, walking: false, facing: 1 };
  const k = ease((local - config.pauseSeconds) / config.walkSeconds);
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, walking: true, facing: to.y >= from.y ? 1 : -1 };
}

export class TrainingRenderer extends IsoRenderer {
  constructor(canvas) {
    super(canvas);
    this.exits = [];
    this.hoverExitId = null;
    this.hoverMarshal = false;
    this.arrival = null; // { exitId, start }
    // Combat en cours : { start (horloge de rendu), signalSeconds } — le Marshal est à son poste.
    this.combat = null;
    this.marshalBounds = null;
  }

  /** Sortie sous un point du canvas : poteau, ou case du chemin. */
  exitAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const post = exitAtSignpost(this, this.exits, clientX - rect.left, clientY - rect.top);
    if (post) return post;
    const tile = this.pickTile(clientX, clientY);
    return tile ? exitAtTile(this.exits, tile.x, tile.y) : null;
  }

  /** Le Marshal est-il sous ce point du canvas ? */
  isMarshalAt(clientX, clientY) {
    const box = this.marshalBounds;
    if (!box) return false;
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
  }

  /** Où est le Marshal (terrain), et dans quelle pose ? */
  marshalState(time) {
    if (this.combat) {
      const age = time - (this.combat.start ?? time);
      const signal = age < (this.combat.signalSeconds ?? 0);
      return { ...MARSHAL.combatSpot, walking: false, facing: 1, sprite: signal ? MARSHAL.sprites.signal : MARSHAL.sprites.idle };
    }
    const at = marshalPatrolAt(time);
    // Petit geste de temps en temps : il lève son drapeau une seconde pendant ses pauses.
    const salute = !at.walking && Math.sin(time * 0.7) > 0.93;
    return { ...at, sprite: salute ? MARSHAL.sprites.signal : MARSHAL.sprites.idle };
  }

  render(scene, time) {
    if (this.combat && this.combat.start === null) this.combat.start = time;
    const marshal = this.marshalState(time);
    this.extraActors = [{ depth: marshal.x + marshal.y, draw: () => this.#drawMarshal(marshal, time) }];
    super.render(scene, time);
    if (!this.arena) return;
    // Chemin vers le Centre : lueur au survol ou à l'arrivée, poteau, indication.
    if (this.arrival && this.arrival.start === null) this.arrival.start = time;
    for (const exit of this.exits) {
      const arriving = this.arrival?.exitId === exit.id ? arrivalGlow(time - this.arrival.start, TRAVEL_TRANSITION.arrivalHighlight) : 0;
      const strength = Math.max(exit.id === this.hoverExitId ? 1 : 0, arriving);
      if (strength > 0) drawExitHighlight(this, exit, { strength, time });
      if (exit.marker) PROP_RENDERERS.signpost(this, { type: 'signpost', x: exit.marker.x, y: exit.marker.y, pointing: 1, highlighted: exit.id === this.hoverExitId }, { time });
    }
    if (this.hoverMarshal) this.#drawMarshalLabel(marshal);
    const hovered = this.exits.find((exit) => exit.id === this.hoverExitId);
    if (hovered) drawExitLabel(this, hovered);
  }

  #drawMarshal(state, time) {
    const p = this.toArenaScreen(state.x, state.y);
    const height = this.#marshalHeight();
    // Halo au survol (il est cliquable).
    if (this.hoverMarshal) {
      const { ctx } = this;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, this.tile.w * 0.3, this.tile.w * 0.14, 0, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#f0c419';
      ctx.stroke();
    }
    const bob = state.walking ? Math.abs(Math.sin(time * 7)) * height * 0.025 : 0;
    drawSpectator(this.ctx, p.x, p.y - bob, { spriteId: state.sprite, height, time, phase: 1.7, flip: state.facing < 0 });
    const pad = height * MARSHAL.hitPadding;
    this.marshalBounds = { left: p.x - height * 0.35 - pad, right: p.x + height * 0.4 + pad, top: p.y - height - pad, bottom: p.y + pad * 0.6 };
  }

  #marshalHeight() {
    return this.tile.w * CROWD_LAYOUT.height * MARSHAL.scale;
  }

  /** Étiquette « Marshal » au survol (au-dessus de tout). */
  #drawMarshalLabel(state) {
    const p = this.toArenaScreen(state.x, state.y);
    const height = this.#marshalHeight();
    const { ctx } = this;
    const text = `${MARSHAL.name} — préparer un combat`;
    ctx.font = '700 13px "EB Garamond", Georgia, serif';
    const width = ctx.measureText(text).width + 18;
    const left = Math.min(Math.max(p.x - width / 2, 6), this.view.w - width - 6);
    const top = Math.max(6, p.y - height - 34);
    roundRect(ctx, left, top, width, 24, 6);
    ctx.fillStyle = 'rgba(253, 246, 228, 0.96)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#c99a2e';
    ctx.stroke();
    ctx.fillStyle = '#2a2016';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, left + width / 2, top + 12.5);
    ctx.textBaseline = 'alphabetic';
  }
}
