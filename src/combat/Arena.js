import { ARENAS, DEFAULT_ARENA_ID } from '../data/arenas.js';

/**
 * Terrain de combat : une grille de cases et, pour chaque camp, sa zone de placement.
 * Données de jeu uniquement : aucun élément de décor (voir data/liceDecorations.js).
 */
export class Arena {
  constructor(def) {
    this.id = def.id;
    this.name = def.name;
    this.width = def.width;
    this.height = def.height;
    this.sides = def.sides;
    for (const [index, side] of this.sides.entries()) {
      const outside = side.defaultSlots.filter((t) => !this.isInDeploymentArea(index, t.x, t.y) || !this.isInside(t.x, t.y));
      if (outside.length) throw new Error(`Terrain ${def.id} : emplacement par défaut hors de la zone du camp ${index}.`);
    }
  }

  isInside(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  getSide(sideIndex) {
    return this.sides[sideIndex % this.sides.length];
  }

  /** Vrai si la case (x, y) appartient à la zone de placement du camp. */
  isInDeploymentArea(sideIndex, x, y) {
    const { area } = this.getSide(sideIndex);
    return x >= area.x && y >= area.y && x < area.x + area.w && y < area.y + area.h;
  }

  /** Cases de départ par défaut du camp `sideIndex` (coordonnées entières). */
  getDefaultTiles(sideIndex, count) {
    const { defaultSlots } = this.getSide(sideIndex);
    return Array.from({ length: count }, (_, i) => ({ ...defaultSlots[i % defaultSlots.length] }));
  }

  /** Positions de départ (centres de cases) du camp `sideIndex`. */
  getDeploymentSlots(sideIndex, count) {
    return this.getDefaultTiles(sideIndex, count).map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 }));
  }
}

export function createArena(id = DEFAULT_ARENA_ID) {
  const def = ARENAS[id];
  if (!def) throw new Error(`Terrain inconnu : ${id}`);
  return new Arena(def);
}
