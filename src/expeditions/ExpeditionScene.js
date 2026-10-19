import { EXPEDITIONS_LAYOUT } from '../data/expeditionsLayout.js';
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
 * Modèle de la carte des Expéditions (v0.96), sans rendu : terrain (marché au nord, rivière,
 * pont, montagne au sud), zone cliquable du Baron, décor, civils et animaux décoratifs.
 */
export class ExpeditionScene {
  constructor(layout = EXPEDITIONS_LAYOUT) {
    this.layout = layout;
    this.width = layout.width;
    this.height = layout.height;
    this.captain = layout.captain;
    this.pathTiles = new Set(layout.paths.flatMap((path) => tilesOf(path).map((t) => key(t.x, t.y))));
    this.waterTiles = new Set(tilesOf(layout.river).map((t) => key(t.x, t.y)));
    this.rockTiles = new Set((layout.rockPatches ?? []).flatMap((area) => tilesOf(area).map((t) => key(t.x, t.y))));
    const fixedProps = layout.props;
    // Une montagne occupe toutes ses cases ; un décor « au sol » n'en occupe aucune.
    const occupied = new Set(fixedProps.filter((prop) => prop.layer !== 'ground').flatMap((prop) => tilesOf(prop).map((t) => key(t.x, t.y))));
    const ring = layout.decorRing
      ? generateRingDecor({
        width: layout.width, height: layout.height, ring: layout.decorRing, seed: 'expeditions',
        isFree: (x, y) => !occupied.has(key(x, y)) && !this.pathTiles.has(key(x, y)) && !this.waterTiles.has(key(x, y))
          && !inArea(layout.captain.area, x, y),
      })
      : [];
    this.props = [...fixedProps, ...ring];
    this.groundProps = this.props.filter((prop) => prop.layer === 'ground');
    this.standingProps = this.props.filter((prop) => prop.layer !== 'ground');
  }

  isPath(x, y) {
    return this.pathTiles.has(key(x, y));
  }

  /** Rivière (le pont est dessiné par-dessus). */
  isWater(x, y) {
    return this.waterTiles.has(key(x, y));
  }

  /** Moitié sauvage (au-delà de la rivière). */
  isWild(x) {
    return x >= this.layout.wildFrom;
  }

  isRock(x, y) {
    return this.rockTiles.has(key(x, y));
  }

  isCaptainZone(x, y) {
    return inArea(this.captain.area, x, y);
  }

  /** Élément cliquable sous une case : 'captain' ou null. */
  targetAt(x, y) {
    return this.isCaptainZone(x, y) ? 'captain' : null;
  }

  villagersAt(time) {
    return walkersAt(this.layout.villagers, time);
  }

  speakerOf(chat, time) {
    return chatSpeaker(this.layout.villagers, chat, time);
  }
}
