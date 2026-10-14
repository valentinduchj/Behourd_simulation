import { HOME_AWAY_RULES, MATCH_LOCATIONS } from '../../data/homeAway.js';
import { CHAMPIONSHIP_MATCH } from '../../data/calendar.js';
import { getFixtureOf } from './ScheduleService.js';

// Domicile / extérieur des matchs de Ligue du joueur (MatchLocationManager).
//
// Le lieu de chaque match est ENREGISTRÉ avec la rencontre, jamais recalculé à l'affichage :
//   - événement du calendrier du match (data.location : 'HOME' | 'AWAY') — la fiche du match
//     du joueur (jour, adversaire, statut) ;
//   - rencontre du calendrier de la division (fixture.homeTeamId : le club qui reçoit).
// Règle (data/homeAway.js) : 1er match de Ligue de la saison à domicile, puis alternance stricte.
// Seuls les matchs de Ligue du joueur comptent : les Combats de la Reine et les journées où il
// serait exempt ne décalent pas l'alternance. Aucun tirage aléatoire.

/** Lieu du n-ième match de Ligue (index 0 = premier match de la saison). */
export function locationForMatchIndex(index, rules = HOME_AWAY_RULES) {
  const { sequence } = rules;
  const start = Math.max(0, sequence.indexOf(rules.firstMatch));
  return sequence[(start + index) % sequence.length];
}

/** Rang du match du joueur de la journée `round` parmi ses matchs de Ligue de la saison (null : exempt). */
export function playerMatchIndex(league, round, playerId) {
  if (!getFixtureOf(league, round, playerId)) return null;
  let index = 0;
  for (let r = 0; r < round; r++) if (getFixtureOf(league, r, playerId)) index++;
  return index;
}

/** Lieu du match du joueur lors de la journée `round` (index), ou null s'il est exempt. */
export function computePlayerMatchLocation(league, round, playerId, rules = HOME_AWAY_RULES) {
  const index = playerMatchIndex(league, round, playerId);
  return index === null ? null : locationForMatchIndex(index, rules);
}

/** Enregistre sur la rencontre de la division le club qui reçoit. */
export function recordHomeTeam(league, round, playerId, location) {
  const fixture = getFixtureOf(league, round, playerId);
  if (!fixture || !location) return;
  const opponentId = fixture.teamAId === playerId ? fixture.teamBId : fixture.teamAId;
  fixture.homeTeamId = location === MATCH_LOCATIONS.HOME ? playerId : opponentId;
}

/** Lieu enregistré d'un match de Ligue du joueur (événement du calendrier), ou null. */
export function getEventLocation(event) {
  return event?.typeId === CHAMPIONSHIP_MATCH ? event.data?.location ?? null : null;
}

export const isHomeMatch = (event) => getEventLocation(event) === MATCH_LOCATIONS.HOME;

/**
 * Sauvegarde antérieure au domicile / extérieur : les matchs de Ligue de la saison en cours
 * sans lieu reçoivent celui de la règle (même calcul qu'à la création du calendrier, sans
 * hasard), puis il est enregistré. Renvoie le nombre de matchs complétés.
 */
export function ensureMatchLocations(session) {
  const league = session.playerLeague;
  const season = session.season?.number;
  const playerId = session.player?.teamId;
  if (!league || !season || !playerId) return 0;
  let added = 0;
  for (const event of session.calendar.events) {
    if (event.typeId !== CHAMPIONSHIP_MATCH || event.data?.season !== season || event.data.location) continue;
    const round = (event.data.matchday ?? 0) - 1;
    const location = round >= 0 ? computePlayerMatchLocation(league, round, playerId) : null;
    if (!location) continue;
    event.data.location = location;
    recordHomeTeam(league, round, playerId, location);
    added++;
  }
  return added;
}
