import { QUEEN_COMBAT } from '../../data/calendar.js';
import { getMatchCrowdSize } from '../../systems/crowd/CrowdService.js';
import { createRng } from '../../utils/random.js';
import { generateCrowd } from './crowdLayout.js';
import { selectArenaDecoration, selectVenueBonus } from './CombatArenaService.js';
import { getCurrentSeason } from '../../systems/climate/ClimateService.js';

// Présentation d'un combat dans La Lice : décor + foule. Rien ici n'est lu par le moteur
// de combat (MatchService, RoundService, CombatSimulation) : changer de décor ou
// d'affluence ne modifie ni la grille, ni les placements, ni les résultats.
// Le choix du terrain (domicile, extérieur, Reine) : CombatArenaService.

export { chooseLiceDecoration } from './CombatArenaService.js';

/** Identifiant stable d'un combat de championnat (même décor et même foule à chaque affichage). */
export function matchSeed(session, { teamAId, teamBId, matchday = null }) {
  return `${session.season?.number ?? 0}:${matchday ?? '-'}:${teamAId}:${teamBId}`;
}

/**
 * Présentation d'un combat : { decoration, crowdSize, crowd, location, season }.
 *   decorationId / crowdSize : imposés (aperçu du Module Admin) ; sinon calculés.
 *   location : 'HOME' | 'AWAY' pour un match de Ligue du joueur (lieu enregistré du match) ;
 *              à domicile, terrain et bonus d'affluence viennent de la lice du joueur.
 */
export function buildLicePresentation(session, { arena, teamAId, teamBId, matchday = null, decorationId = null, crowdSize = null, kind = null, location = null, seasonId = null }) {
  const seed = session ? matchSeed(session, { teamAId, teamBId, matchday }) : `${teamAId}:${teamBId}`;
  const decoration = selectArenaDecoration(session, { kind, location, seed, decorationId });
  const venueBonus = selectVenueBonus(session, { kind, location });
  const size = crowdSize ?? (session ? getMatchCrowdSize(session, { teamAId, teamBId, kind }, { rng: createRng(`affluence:${seed}`), venueBonus }) : 0);
  // Combat de la Reine : La Reine assiste au combat, en spectatrice privilégiée.
  const withQueen = kind === QUEEN_COMBAT;
  // Saison de l'année (v0.70) : habillage du décor (imposée par l'aperçu, sinon celle du jour).
  const season = seasonId ?? (session?.calendar ? getCurrentSeason(session).id : null);
  return { decoration, crowdSize: size, withQueen, location, season, crowd: generateCrowd({ arena, count: size, seed, withQueen }) };
}
