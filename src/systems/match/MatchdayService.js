import { createArena } from '../../combat/Arena.js';
import { getPendingCombatEvent } from '../calendar/CalendarService.js';
import { getFixtureOf } from '../league/ScheduleService.js';
import { updateStandings } from '../league/StandingsService.js';
import { listLeagueDefinitions } from '../league/LeagueService.js';
import { createMatch, simulateAIMatch, playerParticipants } from './MatchService.js';
import { getEventLocation } from '../league/MatchLocationService.js';
import { awardHomeReward } from '../league/HomeRewardService.js';

// Journée de championnat : chaque division dispute sa prochaine journée. Le combat du
// joueur est disputé à la main (écran La Lice) ; tous les autres sont simulés avec le
// même moteur (sélection automatique des combattants).

export function getPendingMatchdayEvent(session) {
  return getPendingCombatEvent(session.calendar);
}

/** Rencontre du joueur lors de la prochaine journée de sa division : { opponentId } ou null (repos). */
export function getPlayerFixture(session) {
  const league = session.playerLeague;
  if (!league || league.isComplete) return null;
  const playerId = session.player.teamId;
  const fixture = getFixtureOf(league, league.roundsPlayed, playerId);
  if (!fixture) return null;
  return { opponentId: fixture.teamAId === playerId ? fixture.teamBId : fixture.teamAId };
}

/** Combat du joueur, toujours en camp A (le joueur place ses combattants). */
export function createPlayerMatch(session, event) {
  const fixture = getPlayerFixture(session);
  if (!fixture) return null;
  return createMatch({ teamAId: session.player.teamId, teamBId: fixture.opponentId, matchday: event.data.matchday });
}

/**
 * Dispute la prochaine journée d'une division (combats simulés, sauf `playerMatch`
 * déjà terminé). Renvoie [{ match, points, leagueId }].
 */
export function playLeagueRound(session, league, { playerMatch = null, rng = Math.random, arena = createArena() } = {}) {
  const round = league.nextRound;
  if (!round) return [];
  const playerId = session.player.teamId;
  const results = [];
  for (const fixture of round) {
    const involvesPlayer = fixture.teamAId === playerId || fixture.teamBId === playerId;
    let match;
    if (involvesPlayer && playerMatch) {
      if (!playerMatch.isFinished) throw new Error('Le combat du joueur n’est pas terminé.');
      match = playerMatch;
    } else {
      match = simulateAIMatch(session, { ...fixture, matchday: league.roundsPlayed + 1 }, arena, rng);
    }
    const points = updateStandings(league, match);
    league.results.push({
      round: league.roundsPlayed + 1, teamAId: match.teamAId, teamBId: match.teamBId,
      scoreA: match.scoreA, scoreB: match.scoreB, winnerId: match.winnerId,
    });
    results.push({ match, points, leagueId: league.id });
  }
  league.roundsPlayed += 1;
  session.markDirty();
  return results;
}

/**
 * Termine la journée : chaque division dispute sa prochaine journée (le combat du
 * joueur, s'il est fourni, est intégré tel quel), puis l'événement est clos.
 * Renvoie [{ match, points, leagueId }] pour les trois divisions.
 */
export function completeMatchday(session, event, playerMatch = null, rng = Math.random) {
  if (!session.playerLeague) throw new Error('Aucune ligue en cours.');
  if (event.status !== 'scheduled') throw new Error('Cette journée a déjà été disputée.');
  const arena = createArena();
  const results = [];
  for (const def of listLeagueDefinitions()) {
    const league = session.getLeague(def.id);
    if (!league || league.isComplete) continue;
    const isPlayerLeague = league === session.playerLeague;
    results.push(...playLeagueRound(session, league, { playerMatch: isPlayerLeague ? playerMatch : null, rng, arena }));
  }
  // Match du joueur : lieu enregistré et, pour une victoire à domicile, récompense en deniers.
  const playerId = session.player.teamId;
  const playerEntry = results.find(({ match }) => match.teamAId === playerId || match.teamBId === playerId);
  if (playerEntry) {
    playerEntry.location = getEventLocation(event);
    playerEntry.homeReward = awardHomeReward(session, {
      location: playerEntry.location, won: playerEntry.match.winnerId === playerId,
      participants: playerParticipants(session, playerEntry.match),
    }, rng);
    if (playerEntry.homeReward) event.data.homeReward = playerEntry.homeReward;
  }
  event.status = 'done';
  event.outcome = 'played';
  session.markDirty();
  return results;
}

/** Journée disputée sans intervention du joueur (avance rapide du temps, Admin). */
export function autoPlayMatchday(session, event, rng = Math.random) {
  return completeMatchday(session, event, null, rng);
}

/**
 * Événement de carnet de bord décrivant le combat du joueur pour cette journée :
 * { type: 'match.result', matchday, opponentTeamId, won, roundsFor, roundsAgainst, points, auto }
 * (opponentTeamId null : le joueur était au repos).
 */
export function buildPlayerResultEvent(session, event, results, { auto = false } = {}) {
  const playerId = session.player.teamId;
  const entry = results.find(({ match }) => match.teamAId === playerId || match.teamBId === playerId);
  if (!entry) return { type: 'match.result', matchday: event.data.matchday, opponentTeamId: null, auto };
  const { match, points } = entry;
  const side = match.sideOf(playerId);
  return {
    type: 'match.result',
    matchday: event.data.matchday,
    opponentTeamId: side === 'A' ? match.teamBId : match.teamAId,
    won: match.winnerId === playerId,
    roundsFor: side === 'A' ? match.scoreA : match.scoreB,
    roundsAgainst: side === 'A' ? match.scoreB : match.scoreA,
    points: points[playerId] ?? 0,
    location: entry.location ?? null,
    homeReward: entry.homeReward ?? 0,
    auto,
  };
}
