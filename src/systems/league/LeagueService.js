import { LEAGUE_DEFINITIONS, LEAGUE_CONFIG, COUNTRIES } from '../../data/leagues.js';
import { calculateClubLevel } from '../fighters/ratings.js';

// Accès aux divisions (définitions et état de la saison en cours).

/** Nombre d'équipes exigé dans chaque division (LEAGUE_CONFIG.teamCount). */
export function getLeagueSize() {
  return LEAGUE_CONFIG.teamCount;
}

/** Format d'une saison pour `teamCount` équipes : journées, rencontres par journée et par saison. */
export function getSeasonFormat(teamCount = LEAGUE_CONFIG.teamCount, { singleRoundRobin = LEAGUE_CONFIG.singleRoundRobin } = {}) {
  const legs = singleRoundRobin ? 1 : 2;
  const slots = teamCount % 2 ? teamCount + 1 : teamCount; // effectif impair : un club au repos par journée
  return {
    teamCount,
    matchdays: (slots - 1) * legs,
    matchesPerMatchday: Math.floor(teamCount / 2),
    matchesPerTeam: (teamCount - 1) * legs,
    totalMatches: (teamCount * (teamCount - 1) / 2) * legs,
    promotionCount: LEAGUE_CONFIG.promotionCount,
    relegationCount: LEAGUE_CONFIG.relegationCount,
  };
}

export function getLeagueDefinition(definitionId) {
  return LEAGUE_DEFINITIONS.find((def) => def.id === definitionId) ?? null;
}

/** Définitions triées de la plus haute à la plus basse division. */
export function listLeagueDefinitions() {
  return [...LEAGUE_DEFINITIONS].sort((a, b) => a.tier - b.tier);
}

export function getLeagueDefinitionsOfCountry(countryId) {
  return listLeagueDefinitions().filter((def) => def.countryId === countryId);
}

export function getCountry(countryId) {
  return COUNTRIES[countryId] ?? null;
}

/** Nom affiché d'une division, ex. « Ligue 2 » (accepte une ligue ou un identifiant). */
export function getLeagueName(leagueOrId) {
  const id = typeof leagueOrId === 'string' ? leagueOrId : leagueOrId?.definitionId;
  return getLeagueDefinition(id)?.name ?? 'Ligue inconnue';
}

export function getLeague(session, leagueId) {
  return session.getLeague(leagueId);
}

/** Division actuelle du joueur. */
export function getCurrentLeague(session) {
  return session.playerLeague;
}

/** Divisions de la partie, de la plus haute à la plus basse. */
export function getLeaguesByTier(session) {
  return listLeagueDefinitions().map((def) => session.getLeague(def.id)).filter(Boolean);
}

/** Clubs d'une division autres que celui du joueur. */
export function getOpponentTeams(session, league = session.playerLeague) {
  if (!league) return [];
  return league.teamIds.filter((id) => id !== session.player.teamId).map((id) => session.getTeam(id)).filter(Boolean);
}

/** Niveau global d'un club (8 meilleurs) — affichage uniquement. */
export function getClubLevel(session, teamId) {
  return calculateClubLevel(session.getFightersOfTeam(teamId));
}

/** Change la division d'un club (et la division actuelle du joueur s'il s'agit de son club). */
export function changeTeamLeague(session, teamId, fromLeagueId, toLeagueId) {
  const from = session.getLeague(fromLeagueId);
  const to = session.getLeague(toLeagueId);
  if (!from || !to) throw new Error(`Division inconnue : ${fromLeagueId} → ${toLeagueId}`);
  from.teamIds = from.teamIds.filter((id) => id !== teamId);
  delete from.standings[teamId];
  to.addTeam(teamId);
  const team = session.teams.find((t) => t.id === teamId);
  if (team) team.leagueId = toLeagueId;
}

/**
 * Phase quotidienne du championnat. Les résultats sont intégrés au moment où la journée
 * est disputée (MatchdayService) et la fin de saison est traitée par SeasonService.
 */
export function updateLeaguesForDay(/* ctx */) {}
