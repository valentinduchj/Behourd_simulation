import { LOCATIONS, LOCATION_EXITS } from '../../data/locations.js';

// Navigation dans le monde : quelles sorties a un lieu, où mènent-elles, peut-on les emprunter.
// Sans interface : les écrans dessinent les sorties et demandent le voyage (ui/navigation/travel.js).

export function getLocation(locationId) {
  return LOCATIONS[locationId] ?? null;
}

/** Lieu dont l'écran est `screenId` (ou null). */
export function getLocationByScreen(screenId) {
  return Object.values(LOCATIONS).find((location) => location.screen && location.screen === screenId) ?? null;
}

/** Sorties d'un lieu (toutes, y compris fermées ou à venir). */
export function getExits(locationId, exits = LOCATION_EXITS) {
  return exits.filter((exit) => exit.source === locationId);
}

export function getExit(exitId, exits = LOCATION_EXITS) {
  return exits.find((exit) => exit.id === exitId) ?? null;
}

/**
 * État d'une sortie : 'open' (on peut l'emprunter), 'soon' (lieu à venir : dessinée, inactive),
 * 'closed' (passage fermé : ni dessinée ni interactive).
 */
export function getExitState(exit) {
  if (!exit?.destination) return 'closed';
  const destination = getLocation(exit.destination);
  if (!exit.enabled || !destination?.available || !destination.screen) return 'soon';
  return 'open';
}

/** Sorties visibles d'un lieu (ouvertes ou à venir) : celles que la carte dessine et rend survolables. */
export function getVisibleExits(locationId, exits = LOCATION_EXITS) {
  return getExits(locationId, exits).filter((exit) => getExitState(exit) !== 'closed');
}

/** Sortie « chemin » couvrant la case (x, y) parmi `exits`, ou null. */
export function exitAtTile(exits, x, y) {
  return exits.find((exit) => {
    if (exit.interactionType !== 'path') return false;
    const p = exit.position;
    return x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h;
  }) ?? null;
}

/** Indication au survol : « ↗ La Taverne · Prendre le chemin » (ou « Prochainement » pour un lieu à venir). */
export function describeExit(exit) {
  const destination = getLocation(exit?.destination);
  if (!destination) return null;
  const state = getExitState(exit);
  return {
    title: `${exit.direction ?? '→'} ${destination.name}`,
    subtitle: state === 'open' ? (exit.interactionType === 'door' ? 'Sortir' : 'Prendre le chemin') : 'Prochainement',
    state,
  };
}

/**
 * Voyage par une sortie : { ok, reason, destination, screen, params } — params transmis à
 * l'écran d'arrivée ({ arrivalExitId } : la sortie par laquelle on y entre).
 */
export function resolveTravel(exitId, exits = LOCATION_EXITS) {
  const exit = getExit(exitId, exits);
  if (!exit) return { ok: false, reason: 'Ce passage n’existe pas.' };
  const state = getExitState(exit);
  const destination = getLocation(exit.destination);
  if (state === 'closed') return { ok: false, reason: 'Ce chemin ne mène nulle part.' };
  if (state === 'soon') return { ok: false, reason: `${destination?.name ?? 'Ce lieu'} n’est pas encore ouvert.`, destination };
  return { ok: true, reason: null, exit, destination, screen: destination.screen, params: { arrivalExitId: exit.arrival ?? null } };
}
