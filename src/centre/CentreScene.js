import { CENTRE_LAYOUT } from '../data/centreLayout.js';
import { listActivities } from '../systems/activities/ActivityService.js';
import { generateRingDecor } from '../render/decor.js';
import { ACTIVITY_VISUALS } from '../data/centreVisuals.js';
import { getVisibleExits } from '../systems/navigation/LocationNavigationService.js';
import { isStudying } from '../systems/talents/StudyService.js';

const key = (x, y) => `${x},${y}`;

function tilesOf({ x, y, w = 1, h = 1 }) {
  const tiles = [];
  for (let ty = y; ty < y + h; ty++) for (let tx = x; tx < x + w; tx++) tiles.push({ x: tx, y: ty });
  return tiles;
}

function byDistanceTo(center) {
  return (a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y)
    || a.y - b.y || a.x - b.x;
}

/**
 * Modèle de la scène du Centre (sans rendu) : terrain, lieux d'activité, décor et
 * position de chaque combattant selon son activité.
 */
export class CentreScene {
  constructor(session, { layout = CENTRE_LAYOUT, activities = listActivities(session), visuals = ACTIVITY_VISUALS, locationId = 'CENTRE' } = {}) {
    this.session = session;
    this.locationId = locationId;
    this.layout = layout;
    this.activities = activities;
    this.visuals = visuals;
    this.width = layout.width;
    this.height = layout.height;
    this.placements = new Map();
    this.#buildTerrain();
    this.refresh();
  }

  #buildTerrain() {
    const { layout, activities } = this;

    const fixedProps = [
      ...layout.props.map((prop) => ({ ...prop, owner: null })),
      ...activities.flatMap((activity) => (activity.visual?.props ?? []).map((prop) => ({ ...prop, owner: activity.id }))),
    ];

    // Lisière (arbres, buissons…) générée sur les cases de bordure restées libres.
    const occupied = new Set(fixedProps.flatMap((prop) => tilesOf(prop).map((t) => key(t.x, t.y))));
    const pathKeys = new Set(layout.paths.flatMap((path) => tilesOf(path).map((t) => key(t.x, t.y))));
    const grassKeys = new Set((layout.grassPatches ?? []).flatMap((patch) => tilesOf(patch).map((t) => key(t.x, t.y))));
    const ringProps = layout.decorRing
      ? generateRingDecor({
        width: layout.width,
        height: layout.height,
        ring: layout.decorRing,
        seed: 'centre',
        isFree: (x, y) => !occupied.has(key(x, y)) && !pathKeys.has(key(x, y)) && !grassKeys.has(key(x, y)),
      })
      : [];

    this.props = [...fixedProps, ...ringProps];
    this.propById = new Map(this.props.filter((prop) => prop.id).map((prop) => [prop.id, prop]));

    // Décor posé au sol (cordes de la lice…) : dessiné avant les combattants, ne bloque pas.
    this.groundProps = this.props.filter((prop) => prop.layer === 'ground');
    this.standingProps = this.props.filter((prop) => prop.layer !== 'ground');
    this.enclosures = layout.enclosures ?? [];

    this.blocked = new Set();
    this.waterTiles = new Set();
    for (const prop of this.props) {
      for (const t of tilesOf(prop)) {
        if (prop.blocking !== false) this.blocked.add(key(t.x, t.y));
        if (prop.type === 'water') this.waterTiles.add(key(t.x, t.y));
      }
    }

    this.zoneByTile = new Map();
    this.standTiles = new Map();
    for (const activity of activities) {
      const { area } = activity;
      const tiles = tilesOf(area);
      for (const t of tiles) this.zoneByTile.set(key(t.x, t.y), activity);
      const center = { x: area.x + (area.w - 1) / 2, y: area.y + (area.h - 1) / 2 };
      this.standTiles.set(activity.id, tiles.filter((t) => !this.blocked.has(key(t.x, t.y))).sort(byDistanceTo(center)));
    }

    this.pathTiles = new Set();
    for (const path of layout.paths) for (const t of tilesOf(path)) this.pathTiles.add(key(t.x, t.y));

    // Sorties du Centre (bouts de chemin vers les autres lieux, data/locations.js) : dessinées et
    // cliquables ; personne ne s'y repose.
    this.exits = this.locationId ? getVisibleExits(this.locationId) : [];
    this.exitByTile = new Map();
    for (const exit of this.exits) for (const t of tilesOf(exit.position)) this.exitByTile.set(key(t.x, t.y), exit);

    const restCenter = { x: layout.restCenter.x - 0.5, y: layout.restCenter.y - 0.5 };
    this.restTiles = [...this.pathTiles]
      .map((k) => { const [x, y] = k.split(',').map(Number); return { x, y }; })
      .filter((t) => !this.blocked.has(key(t.x, t.y)) && !this.zoneByTile.has(key(t.x, t.y)) && !this.exitByTile.has(key(t.x, t.y)))
      .sort(byDistanceTo(restCenter));
  }

  /** Sortie (chemin vers un autre lieu) sur une case, ou null. */
  exitAt(x, y) {
    return this.exitByTile.get(key(x, y)) ?? null;
  }

  getActivity(activityId) {
    return this.activities.find((activity) => activity.id === activityId) ?? null;
  }

  /** Places d'un lieu : ses points d'interaction (data/centreVisuals.js), sinon ses cases libres. */
  slotsOf(activityId) {
    if (!activityId) return this.restTiles.map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 }));
    const points = this.visuals[activityId]?.interactionPoints;
    if (points?.length) return points;
    return (this.standTiles.get(activityId) ?? []).map((t) => ({ x: t.x + 0.5, y: t.y + 0.5 }));
  }

  /**
   * Recalcule la place des combattants d'après leur activité actuelle. Chacun garde sa place
   * tant qu'il reste dans le même lieu (pas de chassé-croisé quand un autre arrive ou part) ;
   * un nouveau venu prend la première place libre. Au-delà des places dessinées, elles sont
   * réutilisées avec un léger décalage.
   * Placement : { x, y, tile, activityId, slot, point }.
   */
  refresh() {
    const previous = new Map(this.placements);
    this.placements.clear();
    const groups = new Map();
    for (const fighter of this.session.playerFighters) {
      // En étude, il est au Scriptorium : absent du camp.
      if (isStudying(this.session, fighter)) continue;
      const groupId = fighter.activityId && this.getActivity(fighter.activityId) ? fighter.activityId : null;
      if (!groups.has(groupId)) groups.set(groupId, []);
      groups.get(groupId).push(fighter);
    }

    const overflowOffsets = [0, 0.28, -0.28];
    for (const [activityId, fighters] of groups) {
      const slots = this.slotsOf(activityId);
      if (!slots.length) continue;
      const taken = new Set();
      const slotOf = new Map();
      for (const fighter of fighters) {
        const before = previous.get(fighter.id);
        if (before && before.activityId === activityId && !taken.has(before.slot)) {
          taken.add(before.slot);
          slotOf.set(fighter.id, before.slot);
        }
      }
      let next = 0;
      for (const fighter of fighters) {
        if (slotOf.has(fighter.id)) continue;
        while (taken.has(next)) next++;
        taken.add(next);
        slotOf.set(fighter.id, next);
      }
      for (const fighter of fighters) {
        const slot = slotOf.get(fighter.id);
        const point = slots[slot % slots.length];
        const offset = overflowOffsets[Math.floor(slot / slots.length) % overflowOffsets.length];
        const x = point.x + offset;
        const y = point.y - offset;
        this.placements.set(fighter.id, { x, y, tile: { x: Math.floor(x), y: Math.floor(y) }, activityId, slot, point });
      }
    }
  }

  /** Point d'interaction d'une place d'un lieu (partenaire de lutte…), ou null. */
  slotPoint(activityId, slot) {
    const slots = this.slotsOf(activityId);
    return slots.length ? slots[slot % slots.length] : null;
  }

  /** Combattant qui occupe une place d'un lieu, ou null. */
  fighterInSlot(activityId, slot) {
    for (const [fighterId, placement] of this.placements) {
      if (placement.activityId === activityId && placement.slot === slot) return fighterId;
    }
    return null;
  }

  getProp(propId) {
    return this.propById.get(propId) ?? null;
  }

  getPlacement(fighterId) {
    return this.placements.get(fighterId) ?? null;
  }

  fighterAt(x, y) {
    for (const fighter of this.session.playerFighters) {
      const placement = this.placements.get(fighter.id);
      if (placement && placement.tile.x === x && placement.tile.y === y) return fighter;
    }
    return null;
  }

  /** Lieu sous une case : { kind: 'activity', activity } | { kind: 'rest' } | null */
  zoneAt(x, y) {
    const activity = this.zoneByTile.get(key(x, y));
    if (activity) return { kind: 'activity', activity };
    if (this.pathTiles.has(key(x, y))) return { kind: 'rest' };
    return null;
  }

  isWater(x, y) {
    return this.waterTiles.has(key(x, y));
  }

  isPath(x, y) {
    return this.pathTiles.has(key(x, y));
  }
}
