import { LOCATIONS } from '../../data/geography/locations.js';
import { getLand } from './LandService.js';

// Les Lieux (data/geography/locations.js) : lecture seule. La couleur d'un lieu est celle de sa Terre.

export function getLocations() {
  return LOCATIONS;
}

export function getLocation(locationId) {
  return LOCATIONS.find((location) => location.id === locationId) ?? null;
}

/** Lieux d'une Terre, éventuellement d'un seul type ('start', 'club', 'far'). */
export function getLocationsOfLand(landId, { type = null } = {}) {
  return LOCATIONS.filter((location) => location.landId === landId && (!type || location.type === type));
}

/** Les lieux de départ proposés au joueur dans une Terre. */
export function getStartLocations(landId) {
  return getLocationsOfLand(landId, { type: 'start' });
}

export function isStartLocation(locationId) {
  return getLocation(locationId)?.type === 'start';
}

export function getLocationLand(locationId) {
  return getLand(getLocation(locationId)?.landId);
}

export function getLocationColor(locationId) {
  return getLocationLand(locationId)?.color ?? null;
}
