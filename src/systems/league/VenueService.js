import { MATCH_LOCATIONS } from '../../data/homeAway.js';
import { getTeamLocation } from '../geography/GeographyService.js';
import { getEventLocation } from './MatchLocationService.js';

// Lieu affiché d'un match de Ligue (VenueManager) — d'après le lieu ENREGISTRÉ du match :
//   domicile  → le lieu du joueur (ex. « Château de Caen »), à la couleur de sa Terre ;
//   extérieur → seulement la Terre de l'adversaire (ex. « Centre »), à sa couleur.
// La Lice précise de l'adversaire n'est pas dévoilée.

/** { locationName, landName, landShortName, landColor } d'un club (données de géographie). */
export function getClubLocationInfo(team) {
  const { location, land } = getTeamLocation(team);
  return { locationName: location.name, landName: land.name, landShortName: land.shortName, landColor: land.color, landId: land.id };
}

/**
 * Lieu d'un match de Ligue du joueur (événement du calendrier) :
 * { location: 'HOME' | 'AWAY', label, color, landName, isHome } ou null (Combat de la Reine,
 * match sans lieu enregistré, exempt).
 */
export function getMatchVenue(session, event) {
  const location = getEventLocation(event);
  if (!location) return null;
  if (location === MATCH_LOCATIONS.HOME) {
    const info = getClubLocationInfo(session.playerTeam);
    return { location, isHome: true, label: info.locationName, color: info.landColor, landName: info.landName };
  }
  const opponent = session.getTeam(event.data.opponentTeamId);
  if (!opponent) return null;
  const info = getClubLocationInfo(opponent);
  return { location, isHome: false, label: info.landShortName, color: info.landColor, landName: info.landName };
}
