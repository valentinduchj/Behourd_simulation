import { LEAGUE_CONFIG } from '../../data/leagues.js';
import { getSeasonFormat } from './LeagueService.js';

// Calendrier des rencontres d'une saison — générique : aucune règle propre à une division.
//
// Méthode du tourniquet. Avec N équipes (N pair) : N − 1 journées de N / 2 rencontres,
// chaque équipe affrontant chacune des N − 1 autres exactement une fois (aller simple,
// LEAGUE_CONFIG.singleRoundRobin ; sinon une phase retour inversée s'ajoute).
// Avec N impair (anciennes sauvegardes uniquement), une équipe est au repos à chaque journée.

/** Rencontres de chaque journée : [[{ teamAId, teamBId }]]. */
export function generateSchedule(teamIds, { restLastFor = null, singleRoundRobin = LEAGUE_CONFIG.singleRoundRobin } = {}) {
  const ids = [...teamIds];
  if (ids.length % 2) ids.push(null);
  const n = ids.length;
  if (n < 2) return [];
  const rounds = [];
  for (let round = 0; round < n - 1; round++) {
    const rest = ids.slice(1);
    const rotated = [ids[0], ...rest.slice(rest.length - round), ...rest.slice(0, rest.length - round)];
    const fixtures = [];
    for (let i = 0; i < n / 2; i++) {
      const a = rotated[i];
      const b = rotated[n - 1 - i];
      if (a && b) fixtures.push(round % 2 && i === 0 ? { teamAId: b, teamBId: a } : { teamAId: a, teamBId: b });
    }
    rounds.push(fixtures);
  }
  // Effectif impair : le repos du club désigné est placé en dernière journée.
  if (restLastFor) {
    const restIndex = rounds.findIndex((fixtures) => !fixtures.some((f) => f.teamAId === restLastFor || f.teamBId === restLastFor));
    if (restIndex >= 0) rounds.push(...rounds.splice(restIndex, 1));
  }
  if (!singleRoundRobin) rounds.push(...rounds.map((fixtures) => fixtures.map(({ teamAId, teamBId }) => ({ teamAId: teamBId, teamBId: teamAId }))));
  return rounds;
}

/** Vérifie un calendrier. Renvoie la liste des problèmes (vide si valide). */
export function validateSchedule(teamIds, schedule, { singleRoundRobin = LEAGUE_CONFIG.singleRoundRobin } = {}) {
  const problems = [];
  const legs = singleRoundRobin ? 1 : 2;
  const format = getSeasonFormat(teamIds.length, { singleRoundRobin });
  const expectedRounds = format.matchdays;
  if (schedule.length !== expectedRounds) problems.push(`${schedule.length} journées au lieu de ${expectedRounds}.`);
  const pairs = new Map();
  const matches = Object.fromEntries(teamIds.map((id) => [id, 0]));
  schedule.forEach((fixtures, index) => {
    if (teamIds.length % 2 === 0 && fixtures.length !== format.matchesPerMatchday) {
      problems.push(`Journée ${index + 1} : ${fixtures.length} rencontres au lieu de ${format.matchesPerMatchday}.`);
    }
    const seen = new Set();
    for (const { teamAId, teamBId } of fixtures) {
      if (teamAId === teamBId) problems.push(`Journée ${index + 1} : ${teamAId} s’affronte lui-même.`);
      for (const id of [teamAId, teamBId]) {
        if (!(id in matches)) problems.push(`Journée ${index + 1} : club inconnu ${id}.`);
        if (seen.has(id)) problems.push(`Journée ${index + 1} : ${id} joue deux fois.`);
        seen.add(id);
        matches[id] = (matches[id] ?? 0) + 1;
      }
      const key = [teamAId, teamBId].sort().join('|');
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
  });
  for (const [key, count] of pairs) {
    if (count > legs) problems.push(`Rencontre en double : ${key}.`);
  }
  for (const [id, count] of Object.entries(matches)) {
    if (count !== format.matchesPerTeam) problems.push(`${id} : ${count} combats au lieu de ${format.matchesPerTeam}.`);
  }
  return problems;
}

/** Nombre de journées que le club dispute jusqu'à son dernier combat (ses journées de calendrier). */
export function getTeamRoundCount(league, teamId) {
  for (let i = league.schedule.length - 1; i >= 0; i--) {
    if (league.schedule[i].some((f) => f.teamAId === teamId || f.teamBId === teamId)) return i + 1;
  }
  return 0;
}

/** Rencontre d'un club lors d'une journée (index 0), ou null s'il est au repos. */
export function getFixtureOf(league, roundIndex, teamId) {
  return (league.schedule[roundIndex] ?? []).find((f) => f.teamAId === teamId || f.teamBId === teamId) ?? null;
}

/** Prochain combat du joueur : { round, opponentId } ou null (saison terminée pour lui). */
export function getNextMatch(session) {
  const league = session.playerLeague;
  if (!league) return null;
  const playerId = session.player.teamId;
  for (let round = league.roundsPlayed; round < league.schedule.length; round++) {
    const fixture = getFixtureOf(league, round, playerId);
    if (fixture) return { round: round + 1, opponentId: fixture.teamAId === playerId ? fixture.teamBId : fixture.teamAId };
  }
  return null;
}

/** La saison est terminée dès que le joueur a disputé toutes ses journées (N − 1 avec N équipes). */
export function isSeasonFinished(session) {
  const league = session.playerLeague;
  if (!league || !session.season) return false;
  const total = getTeamRoundCount(league, session.player.teamId);
  return total > 0 && league.roundsPlayed >= total;
}
