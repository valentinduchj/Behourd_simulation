import { LANDS, LAND_MAP_BOUNDS } from '../../data/geography/lands.js';

// Les Terres (data/geography/lands.js) : lecture seule.

export function getLands() {
  return LANDS;
}

/** Terres d'un pays (sur sa carte) ; sans pays : toutes les Terres placées sur une carte. */
export function getMapLands(countryId = null) {
  return LANDS.filter((land) => land.countryId && (!countryId || land.countryId === countryId));
}

/** Le pays a-t-il une carte des Terres (choix d'une Terre et d'un lieu à la création) ? */
export function hasLandMap(countryId) {
  return Boolean(LAND_MAP_BOUNDS[countryId]) && getMapLands(countryId).length > 0;
}

export function getLandMapBounds(countryId) {
  return LAND_MAP_BOUNDS[countryId] ?? null;
}

export function getLand(landId) {
  return LANDS.find((land) => land.id === landId) ?? null;
}

export function getLandColor(landId) {
  return getLand(landId)?.color ?? null;
}
