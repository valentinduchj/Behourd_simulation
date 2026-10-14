import { BOROUGH_LAYOUT } from '../data/boroughLayout.js';
import { getArtisan } from '../systems/borough/UpgradeService.js';
import { generateRingDecor } from '../render/decor.js';

const key = (x, y) => `${x},${y}`;

function tilesOf({ x, y, w = 1, h = 1 }) {
  const tiles = [];
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) tiles.push({ x: tx, y: ty });
  return tiles;
}

/**
 * Modèle de la scène du Bourg (sans rendu) : terrain, zones cliquables des artisans,
 * décor et habitants décoratifs (positions selon le temps pour ceux qui marchent).
 */
export class BoroughScene {
  constructor(layout = BOROUGH_LAYOUT) {
    this.layout = layout;
    this.width = layout.width;
    this.height = layout.height;

    this.zones = layout.zones.map((zone) => ({ ...zone, artisan: getArtisan(zone.artisanId) })).filter((zone) => zone.artisan);
    const fixedProps = [...layout.props, ...this.zones.flatMap((zone) => zone.props ?? [])];
    const occupied = new Set(fixedProps.flatMap((prop) => tilesOf(prop).map((t) => key(t.x, t.y))));
    this.pathTiles = new Set(layout.paths.flatMap((path) => tilesOf(path).map((t) => key(t.x, t.y))));
    const zoneTiles = new Set(this.zones.flatMap((zone) => tilesOf(zone.area).map((t) => key(t.x, t.y))));
    const ring = layout.decorRing
      ? generateRingDecor({
        width: layout.width,
        height: layout.height,
        ring: layout.decorRing,
        seed: 'bourg',
        // Jamais d'arbre juste devant un artisan : il resterait caché pendant son travail.
        isFree: (x, y) => !occupied.has(key(x, y)) && !this.pathTiles.has(key(x, y)) && !zoneTiles.has(key(x, y))
          && !this.zones.some((zone) => Math.hypot(x + 0.5 - zone.stand.x, y + 0.5 - zone.stand.y) < 1.8),
      })
      : [];
    this.props = [...fixedProps, ...ring];
    this.groundProps = this.props.filter((prop) => prop.layer === 'ground');
    this.standingProps = this.props.filter((prop) => prop.layer !== 'ground');

    this.zoneByTile = new Map();
    for (const zone of this.zones) for (const t of tilesOf(zone.area)) this.zoneByTile.set(key(t.x, t.y), zone);
  }

  /** Zone (artisan) sous une case, ou null. */
  zoneAt(x, y) {
    return this.zoneByTile.get(key(x, y)) ?? null;
  }

  isPath(x, y) {
    return this.pathTiles.has(key(x, y));
  }

  /** Artisans à leur poste : [{ zone, x, y, spriteId }]. */
  get artisans() {
    return this.zones.map((zone) => ({ zone, x: zone.stand.x, y: zone.stand.y, spriteId: zone.artisan.spriteId }));
  }

  /** Habitants à l'instant `time` (voir walkersAt). */
  villagersAt(time) {
    return walkersAt(this.layout.villagers, time);
  }
}

/**
 * Tournée avec pauses (habitants, chiens) : `path` (points, en boucle), `speed` (cases/s),
 * `pauses` (secondes d'arrêt à chaque point : un nombre ou une liste), `phase` (décalage, s).
 * Fonction pure du temps : { x, y, walking, dir: { x, y }, stop: { index, elapsed, duration } | null }.
 */
export function patrolAt({ path, speed = 0.4, pauses = 2, phase = 0 }, time) {
  const n = path.length;
  const pauseAt = (i) => (Array.isArray(pauses) ? pauses[i % pauses.length] : pauses);
  const legs = path.map((a, i) => {
    const b = path[(i + 1) % n];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    return { a, b, length, walk: length / speed, pause: pauseAt(i) };
  });
  const total = legs.reduce((sum, leg) => sum + leg.pause + leg.walk, 0) || 1;
  let t = ((time + phase) % total + total) % total;
  for (let i = 0; i < n; i++) {
    const leg = legs[i];
    const prev = legs[(i - 1 + n) % n];
    if (t < leg.pause) {
      // À l'arrêt : il garde la direction d'où il vient.
      const len = prev.length || 1;
      return { x: leg.a.x, y: leg.a.y, walking: false, dir: { x: (leg.a.x - prev.a.x) / len, y: (leg.a.y - prev.a.y) / len }, stop: { index: i, elapsed: t, duration: leg.pause } };
    }
    t -= leg.pause;
    if (t < leg.walk) {
      const k = leg.walk ? t / leg.walk : 1;
      const len = leg.length || 1;
      return { x: leg.a.x + (leg.b.x - leg.a.x) * k, y: leg.a.y + (leg.b.y - leg.a.y) * k, walking: true, dir: { x: (leg.b.x - leg.a.x) / len, y: (leg.b.y - leg.a.y) / len }, stop: null };
    }
    t -= leg.walk;
  }
  return { x: path[0].x, y: path[0].y, walking: false, dir: { x: 1, y: 0 }, stop: null };
}

/** Groupe qui discute (`chat`) : celui qui parle (bulle) change toutes les quelques secondes ; null : silence. */
export function chatSpeaker(villagers, chat, time) {
  const members = villagers.filter((villager) => villager.chat === chat);
  if (!members.length) return null;
  const slot = Math.floor((time + chat.length * 1.3) / 2.6);
  if (slot % (members.length + 1) === members.length) return null;
  return members[slot % (members.length + 1)];
}

/**
 * Personnages décoratifs à l'instant `time` (Bourg, Château de Gabarnac) :
 * [{ spriteId, x, y, view, flip, walking }]. Ceux qui ont un trajet (`route` de deux points,
 * `speed` en cases par seconde, `phase`) font des allers-retours ; ils regardent dans le sens
 * de la marche.
 */
export function walkersAt(villagers, time) {
  return villagers.map((villager, index) => {
    if (villager.path) {
      const step = patrolAt(villager, time);
      return {
        ...villager, x: step.x, y: step.y, walking: step.walking, phase: index, stop: step.stop,
        // Vers la caméra (x + y croissant) : de face ; sinon de dos. Miroir selon le sens à l'écran.
        view: step.dir.x + step.dir.y >= 0 ? 'front' : 'back',
        flip: step.dir.x - step.dir.y < 0,
      };
    }
    if (!villager.route) return { ...villager, view: villager.view ?? 'front', flip: Boolean(villager.flip), walking: false, phase: index };
    const [a, b] = villager.route;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const travel = (time * villager.speed + (villager.phase ?? 0)) % (length * 2);
    const forward = travel <= length;
    const t = forward ? travel / length : 2 - travel / length;
    const dx = (b.x - a.x) * (forward ? 1 : -1);
    const dy = (b.y - a.y) * (forward ? 1 : -1);
    return {
      spriteId: villager.spriteId,
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      // Vers la caméra (x + y croissant) : de face ; sinon de dos. Miroir selon le sens à l'écran.
      view: dx + dy >= 0 ? 'front' : 'back',
      flip: dx - dy < 0,
      walking: true,
      phase: index,
    };
  });
}
