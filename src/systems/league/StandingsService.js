import { LEAGUE_RULES, PROMOTION_RULES, getRuleRanks } from '../../data/leagues.js';
import { getStarRating } from '../fighters/ratings.js';
import { getClubLevel, getLeagueDefinition, getLeagueSize } from './LeagueService.js';

// Classements : points, tri et situation (zone de montée / descente).

/** Points de championnat : victoire 3 ; défaite avec une manche gagnée 1 ; sinon 0. */
export function computeMatchPoints(won, roundsWon) {
  const { points } = LEAGUE_RULES;
  if (won) return points.win;
  return roundsWon > 0 ? points.lossWithRound : points.loss;
}

/** Intègre un combat terminé au classement (les deux clubs). Renvoie les points attribués. */
export function updateStandings(league, match) {
  if (!match.winnerId) throw new Error('Le combat n’est pas terminé.');
  const awarded = {};
  for (const [teamId, roundsWon, roundsLost] of [
    [match.teamAId, match.scoreA, match.scoreB],
    [match.teamBId, match.scoreB, match.scoreA],
  ]) {
    const row = league.standings[teamId];
    if (!row) continue;
    const won = match.winnerId === teamId;
    const points = computeMatchPoints(won, roundsWon);
    row.played += 1;
    row[won ? 'wins' : 'losses'] += 1;
    row.roundsWon += roundsWon;
    row.roundsLost += roundsLost;
    row.points += points;
    awarded[teamId] = points;
  }
  return awarded;
}

/** Tri : points, puis départages de LEAGUE_RULES.tiebreakers, puis ordre alphabétique (affichage stable). */
export function sortStandings(rows) {
  return [...rows].sort((a, b) => b.points - a.points
    || LEAGUE_RULES.tiebreakers.reduce((diff, key) => diff || (b[key] ?? 0) - (a[key] ?? 0), 0)
    || a.team.name.localeCompare(b.team.name, 'fr'));
}

/**
 * Situation d'un rang dans une division d'après les règles de montée / descente
 * (calculée dynamiquement, jamais enregistrée) : { direction: 'up' | 'down', targetLeagueId, ruleId } ou null.
 */
export function getPromotionStatus(leagueId, rank, leagueSize = getLeagueSize()) {
  const rule = PROMOTION_RULES.find((r) => {
    if (r.sourceLeague !== leagueId) return false;
    const { startRank, endRank } = getRuleRanks(r, leagueSize);
    return rank >= startRank && rank <= endRank;
  });
  if (!rule) return null;
  const sourceTier = getLeagueDefinition(rule.sourceLeague)?.tier ?? 0;
  const targetTier = getLeagueDefinition(rule.targetLeague)?.tier ?? 0;
  return { direction: targetTier < sourceTier ? 'up' : 'down', targetLeagueId: rule.targetLeague, ruleId: rule.id };
}

/**
 * Classement trié d'une division.
 * Renvoie [{ position, team, isPlayer, level, stars, played, wins, losses, roundsWon,
 *            roundsLost, roundDifference, points, promotion }].
 */
export function getStandings(session, league = session.playerLeague) {
  if (!league) return [];
  const rows = league.teamIds
    .map((teamId) => {
      const team = session.getTeam(teamId);
      if (!team) return null;
      const level = getClubLevel(session, teamId);
      const row = league.standings[teamId];
      return {
        team, isPlayer: teamId === session.player.teamId, level, stars: getStarRating(level),
        ...row, roundDifference: row.roundsWon - row.roundsLost,
      };
    })
    .filter(Boolean);
  return sortStandings(rows).map((row, index) => ({ ...row, position: index + 1, promotion: getPromotionStatus(league.id, index + 1, rows.length) }));
}

/**
 * Position actuelle d'un club dans SA division de la saison en cours (calculée à chaque
 * appel, jamais enregistrée) : { position, leagueId, size } ou null (club hors championnat).
 */
export function getTeamPosition(session, teamId) {
  const league = session.getLeagueOfTeam(teamId);
  if (!league) return null;
  const rows = getStandings(session, league);
  const row = rows.find((r) => r.team.id === teamId);
  return row ? { position: row.position, leagueId: league.id, size: rows.length } : null;
}

export function getPlayerStanding(session) {
  return getStandings(session).find((row) => row.isPlayer) ?? null;
}
