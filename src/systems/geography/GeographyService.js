import { CLUB_LOCATIONS } from '../../data/geography/clubLocations.js';
import { DEFAULT_FAR_LOCATION_ID, LOCATIONS } from '../../data/geography/locations.js';
import { getMapLands } from './LandService.js';
import { getLocation, getLocationLand, getStartLocations } from './LocationService.js';

/**
 * Localisation des compagnies : Terre → Lieu → Club.
 *
 * Chaque équipe (joueur ou IA) porte `locationId` et `landId` ; la Terre découle toujours
 * du lieu. Le système domicile / extérieur n'existe pas encore : il pourra s'appuyer sur
 * getTeamLocation / sameLand / sameLocation (lieu du club → sa lice).
 */

/**
 * Lieu d'un club de l'IA : celui choisi dans l'Admin (`locationId` de ses données), sinon
 * celui de data/geography/clubLocations.js, sinon la Terre lointaine (clubs hors championnat,
 * clubs ajoutés dans l'Admin).
 */
export function resolveClubLocationId(clubId, clubData = null) {
  const candidates = [clubData?.locationId, CLUB_LOCATIONS[clubId]];
  return candidates.find((id) => id && getLocation(id)) ?? DEFAULT_FAR_LOCATION_ID;
}

/** Donne un lieu à une équipe (la Terre suit). Renvoie false si le lieu est inconnu. */
export function assignTeamLocation(team, locationId) {
  const location = getLocation(locationId);
  if (!team || !location) return false;
  team.locationId = location.id;
  team.landId = location.landId;
  return true;
}

/** { land, location } d'une équipe ; Terre lointaine si elle n'a pas de lieu connu. */
export function getTeamLocation(team) {
  const location = getLocation(team?.locationId) ?? getLocation(DEFAULT_FAR_LOCATION_ID);
  return { location, land: getLocationLand(location.id) };
}

export function sameLand(teamA, teamB) {
  return getTeamLocation(teamA).land.id === getTeamLocation(teamB).land.id;
}

export function sameLocation(teamA, teamB) {
  return getTeamLocation(teamA).location.id === getTeamLocation(teamB).location.id;
}

/**
 * Lieu de départ attribué sans choix du joueur (partie de test, sauvegarde antérieure à
 * la v0.32) : tiré d'après `seed` (identifiant ou nom), toujours le même pour une même
 * compagnie, sans toucher au générateur aléatoire de la partie (à valider).
 */
export function pickDefaultStartLocationId(seed) {
  const starts = getMapLands().flatMap((land) => getStartLocations(land.id));
  let hash = 0;
  for (const char of String(seed ?? '')) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return starts[hash % starts.length].id;
}

/** Compagnie du joueur sans lieu (sauvegarde antérieure) : lieu de départ par défaut. */
export function ensurePlayerLocation(session) {
  const team = session.playerTeam;
  if (!team) return false;
  const location = getLocation(team.locationId);
  if (location && team.landId === location.landId) return false;
  return assignTeamLocation(team, location ? location.id : pickDefaultStartLocationId(team.id));
}

/**
 * Vérification des données (Admin, tests) : clubs des ligues sans lieu propre (ils
 * tomberaient en Terre lointaine) et lieux de club en double.
 */
export function validateClubLocations(database, leagueDefIds) {
  const problems = [];
  const seen = new Map();
  for (const leagueDefId of leagueDefIds) {
    for (const club of database.getClubsData(leagueDefId)) {
      const locationId = resolveClubLocationId(club.id, club);
      const location = getLocation(locationId);
      if (!location || location.landId === 'LOINTAINE') problems.push(`${club.name} : aucun lieu en France.`);
      else if (seen.has(locationId)) problems.push(`${club.name} : même lieu que ${seen.get(locationId)}.`);
      else seen.set(locationId, club.name);
    }
  }
  return problems;
}

/** Tous les lieux connus regroupés par Terre (listes de l'Admin). */
export function getLocationsByLand(lands) {
  return lands.map((land) => ({ land, locations: LOCATIONS.filter((location) => location.landId === land.id) }));
}
