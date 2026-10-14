import { TAVERN_LAYOUT } from '../data/tavernLayout.js';
import { createGrid, tileKey } from '../combat/engine/ai/PathfindingService.js';
import { createRng, shuffle } from '../utils/random.js';
import { TavernCharacter } from './TavernCharacter.js';
import { Tavernkeeper } from './Tavernkeeper.js';

const tilesOf = ({ x, y, w = 1, h = 1 }) => {
  const tiles = [];
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) tiles.push({ x: tx, y: ty });
  return tiles;
};

/**
 * Modèle de la scène de la Taverne (sans rendu) : décor, grille praticable, tavernier,
 * clients et recrues présentes (une par candidature de l'offre en cours). Les positions de
 * départ des recrues sont tirées au sort (graine : l'offre), puis elles flânent.
 */
export class TavernScene {
  constructor(candidates, { layout = TAVERN_LAYOUT, seed = 'taverne' } = {}) {
    this.layout = layout;
    this.width = layout.width;
    this.height = layout.height;
    this.props = layout.props;
    this.groundProps = this.props.filter((prop) => prop.layer === 'ground');
    this.standingProps = this.props.filter((prop) => prop.layer !== 'ground');
    const blocked = new Set([
      ...this.props.filter((prop) => prop.blocking !== false).flatMap(tilesOf),
      ...(layout.blocked ?? []).flatMap(tilesOf),
    ].map((t) => tileKey(t.x, t.y)));
    this.grid = createGrid({ width: this.width, height: this.height, blocked });
    this.spots = layout.spots.filter((spot) => !blocked.has(tileKey(spot.x, spot.y)));
    this.keeper = new Tavernkeeper(layout.keeper);
    this.patrons = layout.patrons ?? [];
    this.rng = createRng(`${seed}:${candidates.map((c) => c.id).join(',')}`);
    this.characters = [];
    this.setCandidates(candidates);
  }

  /** Emplacements libres (ni occupés ni visés par une autre recrue). */
  freeSpots(except = null) {
    const taken = new Set(this.characters.filter((c) => c !== except).map((c) => tileKey(c.spot.x, c.spot.y)));
    return this.spots.filter((spot) => !taken.has(tileKey(spot.x, spot.y)));
  }

  /** Aligne les recrues sur l'offre : une recrue engagée quitte la scène, une nouvelle y entre. */
  setCandidates(candidates) {
    const ids = new Set(candidates.map((c) => c.id));
    this.characters = this.characters.filter((character) => ids.has(character.candidateId));
    const present = new Set(this.characters.map((c) => c.candidateId));
    for (const candidate of candidates) {
      if (present.has(candidate.id)) continue;
      const free = shuffle(this.rng, this.freeSpots());
      if (!free.length) break;
      this.characters.push(new TavernCharacter(candidate, free[0], { rng: this.rng, wander: this.layout.wander }));
    }
  }

  getCharacter(candidateId) {
    return this.characters.find((c) => c.candidateId === candidateId) ?? null;
  }

  update(dt) {
    const step = Math.min(dt, 0.25);
    for (const character of this.characters) character.update(step, this);
  }
}
