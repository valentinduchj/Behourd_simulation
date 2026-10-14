import { GABARNAC_LAYOUT } from '../data/gabarnacLayout.js';
import { generateRingDecor } from '../render/decor.js';
import { walkersAt, chatSpeaker } from '../borough/BoroughScene.js';

const key = (x, y) => `${x},${y}`;

function tilesOf({ x, y, w = 1, h = 1 }) {
  const tiles = [];
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) tiles.push({ x: tx, y: ty });
  return tiles;
}

const inArea = (area, x, y) => x >= area.x && y >= area.y && x < area.x + area.w && y < area.y + area.h;

/**
 * Modèle de la carte du Château de Gabarnac (Coupe de France), sans rendu : terrain, Lice et
 * tableau cliquables, décor, habitants, et des combattants de compagnies engagées qui flânent.
 * fighters : [{ fighter, team }] (personnages d'ambiance, dans l'ordre des places `fighterSpots`).
 */
export class GabarnacScene {
  constructor({ fighters = [], layout = GABARNAC_LAYOUT } = {}) {
    this.layout = layout;
    this.width = layout.width;
    this.height = layout.height;
    this.lice = layout.lice;
    this.board = layout.board;
    const fixedProps = [...layout.props, layout.board.prop];
    const occupied = new Set(fixedProps.flatMap((prop) => tilesOf(prop).map((t) => key(t.x, t.y))));
    this.pathTiles = new Set(layout.paths.flatMap((path) => tilesOf(path).map((t) => key(t.x, t.y))));
    const ring = generateRingDecor({
      width: layout.width, height: layout.height, ring: layout.decorRing, seed: 'gabarnac',
      isFree: (x, y) => !occupied.has(key(x, y)) && !this.pathTiles.has(key(x, y)) && !inArea(layout.lice.area, x, y),
    });
    this.props = [...fixedProps, ...ring];
    this.groundProps = this.props.filter((prop) => prop.layer === 'ground');
    this.standingProps = this.props.filter((prop) => prop.layer !== 'ground');
    this.fighters = fighters.slice(0, layout.fighterSpots.length).map((entry, index) => ({ ...entry, spot: layout.fighterSpots[index], index }));
  }

  isPath(x, y) {
    return this.pathTiles.has(key(x, y));
  }

  isLice(x, y) {
    return inArea(this.lice.area, x, y);
  }

  /** Élément cliquable sous une case : 'lice', 'board' ou null. */
  targetAt(x, y) {
    if (this.isLice(x, y)) return 'lice';
    if (inArea(this.board.area, x, y)) return 'board';
    return null;
  }

  villagersAt(time) {
    return walkersAt(this.layout.villagers, time);
  }

  /**
   * Combattants du joueur à l'instant `time` : chacun flâne lentement autour de sa place (petite
   * boucle, pauses), regard dans le sens de la marche.
   */
  fightersAt(time) {
    return this.fighters.map(({ fighter, team, spot, index }) => {
      const t = time * 0.18 + index * 1.7;
      const dx = Math.sin(t) * 0.45;
      const dy = Math.sin(t * 0.7 + index) * 0.3;
      const vx = Math.cos(t) * 0.45;
      const vy = Math.cos(t * 0.7 + index) * 0.21;
      return {
        fighter, team, index,
        x: spot.x + dx,
        y: spot.y + dy,
        walking: Math.hypot(vx, vy) > 0.15,
        flip: vx - vy < 0,
      };
    });
  }

  /** Groupe qui discute : celui qui parle (bulle) change toutes les quelques secondes. */
  speakerOf(chat, time) {
    return chatSpeaker(this.layout.villagers, chat, time);
  }
}
