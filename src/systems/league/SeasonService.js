import { LEAGUE_CONFIG, SEASON_CONFIG } from '../../data/leagues.js';
import { calculateClubLevel } from '../fighters/ratings.js';
import { CHAMPIONSHIP_MATCH } from '../../data/calendar.js';
import { randInt } from '../../utils/random.js';
import { generateChampionshipDates, resolveCombatDayConflicts } from '../calendar/CalendarService.js';
import { League } from '../../models/League.js';
import { clubDatabase } from '../clubs/ClubDatabase.js';
import { getLeagueDefinition, getLeagueName, listLeagueDefinitions } from './LeagueService.js';
import { getStandings } from './StandingsService.js';
import { generateSchedule, getTeamRoundCount, getFixtureOf, validateSchedule, isSeasonFinished } from './ScheduleService.js';
import { calculateMovements, applyMovements, validateLeagueSizes } from './PromotionService.js';
import { playLeagueRound, completeMatchday } from '../match/MatchdayService.js';
import { ageFighter } from '../fighters/PotentialService.js';
import { ageAIFighters } from '../clubs/AIProgressionService.js';
import { runAIRetirements } from '../clubs/AIRecruitmentService.js';
import { computePlayerMatchLocation, recordHomeTeam } from './MatchLocationService.js';
import { awardLeagueTitle } from '../trophies/TrophyService.js';
import { recordSeasonEnd } from '../achievements/AchievementService.js';

// Saisons : création du monde (3 divisions de LEAGUE_CONFIG.teamCount équipes), début de
// saison, fin de saison (finalizeSeason) puis, à la demande du joueur, saison suivante
// (startNextSeason : montées/descentes appliquées → nouvelles divisions → nouveau calendrier).

export { isSeasonFinished };

/**
 * Répartition par niveau (LEAGUE_CONFIG.initialDistribution = 'level') : tous les clubs des
 * divisions sont classés du plus fort au plus faible, puis chaque division, de la plus haute
 * à la plus basse, reçoit autant de clubs que son fichier en contient (18 / 18 / 17). À
 * niveau égal, l'ordre des fichiers départage (division la plus haute, puis rang dans le fichier).
 * `fileCompositions` : { [divisionId]: clubIds } ; `levelOf(clubId)` : niveau du club.
 */
export function distributeClubsByLevel(fileCompositions, levelOf) {
  const tiers = listLeagueDefinitions().map((def) => def.id).filter((id) => id in fileCompositions);
  const ranked = tiers
    .flatMap((id, tierIndex) => fileCompositions[id].map((clubId, index) => ({ clubId, level: levelOf(clubId), tierIndex, index })))
    .sort((a, b) => b.level - a.level || a.tierIndex - b.tierIndex || a.index - b.index)
    .map((entry) => entry.clubId);
  const result = {};
  let next = 0;
  for (const id of tiers) {
    result[id] = ranked.slice(next, next + fileCompositions[id].length);
    next += fileCompositions[id].length;
  }
  return result;
}

/** Crée les trois divisions d'une nouvelle partie, le joueur dans `startLeagueId`. */
export function createWorld(session, startLeagueId, rng = Math.random) {
  const problems = clubDatabase.validateCompositions();
  if (problems.length) throw new Error(`Les fichiers de ligues ne permettent pas de lancer une partie : ${problems.join(' ')}`);
  const playerId = session.player.teamId;

  const fileCompositions = Object.fromEntries(listLeagueDefinitions().map((def) => [def.id, clubDatabase.getClubIdsOfLeague(def.id)]));
  const distributed = LEAGUE_CONFIG.initialDistribution === 'level'
    ? distributeClubsByLevel(fileCompositions, (clubId) => calculateClubLevel(clubDatabase.getFightersOfClub(clubId)))
    : fileCompositions;
  const compositions = {};
  for (const def of listLeagueDefinitions()) {
    const clubs = distributed[def.id];
    compositions[def.id] = def.id === startLeagueId ? [playerId, ...clubs] : [...clubs];
  }
  // Si la division de départ n'est pas celle prévue par les fichiers, le dernier club
  // de cette division cède sa place au joueur et rejoint la division de départ prévue.
  const plannedStart = listLeagueDefinitions().find((def) => def.playerStart)?.id;
  if (plannedStart && plannedStart !== startLeagueId) {
    const displaced = compositions[startLeagueId].pop();
    compositions[plannedStart].push(displaced);
  }
  validateLeagueSizes(compositions);

  session.leagues = Object.entries(compositions).map(([id, teamIds]) => new League({ definitionId: id, teamIds, season: 1 }));
  session.playerTeam.leagueId = startLeagueId;
  startSeason(session, { number: 1, firstMatchdayDay: Math.max(SEASON_CONFIG.firstMatchdayDay, session.calendar.currentDay + 1) }, rng);
}

/** Démarre une saison : calendrier de chaque division et journées de combat du joueur. */
export function startSeason(session, { number, firstMatchdayDay }, rng = Math.random) {
  const playerId = session.player.teamId;
  // Une saison ne démarre qu'avec des divisions complètes (sinon : erreur, rien n'est modifié).
  validateLeagueSizes(Object.fromEntries(session.leagues.map((league) => [league.id, league.teamIds])));
  if (session.leagues.filter((league) => league.teamIds.includes(playerId)).length !== 1) {
    throw new Error('La compagnie du joueur doit être engagée dans une seule division.');
  }
  for (const league of session.leagues) {
    const restLastFor = league.teamIds.includes(playerId) ? playerId : null;
    const fresh = new League({ definitionId: league.definitionId, teamIds: league.teamIds, season: number });
    fresh.schedule = generateSchedule(fresh.teamIds, { restLastFor });
    const problems = validateSchedule(fresh.teamIds, fresh.schedule);
    if (problems.length) throw new Error(`Calendrier invalide (${getLeagueName(league)}) : ${problems.join(' ')}`);
    Object.assign(league, fresh);
  }
  session.season = { number, status: 'active', startedOnDay: session.calendar.currentDay, firstMatchdayDay };
  scheduleSeasonEvents(session, firstMatchdayDay, 0, rng);
  session.markDirty();
}

/**
 * Planifie les journées de combat du joueur à partir de la journée `fromRound` (index).
 * Les dates sont tirées ici (écarts SEASON_CONFIG.daysBetweenMatches) puis enregistrées
 * dans les événements du calendrier : elles ne sont jamais recalculées.
 */
export function scheduleSeasonEvents(session, firstDay, fromRound, rng = Math.random) {
  const league = session.playerLeague;
  const playerId = session.player.teamId;
  const total = getTeamRoundCount(league, playerId);
  const days = generateChampionshipDates(Math.max(0, total - fromRound), firstDay, SEASON_CONFIG.daysBetweenMatches, rng);
  for (let round = fromRound; round < total; round++) {
    const fixture = getFixtureOf(league, round, playerId);
    const opponentTeamId = fixture ? (fixture.teamAId === playerId ? fixture.teamBId : fixture.teamAId) : null;
    // Domicile / extérieur : fixé ici, une fois pour toutes, et enregistré avec le match.
    const location = computePlayerMatchLocation(league, round, playerId);
    recordHomeTeam(league, round, playerId, location);
    session.calendar.addEvent({
      typeId: CHAMPIONSHIP_MATCH,
      day: days[round - fromRound],
      title: 'Journée de championnat',
      data: { season: session.season.number, matchday: round + 1, opponentTeamId, ...(location ? { location } : {}) },
    });
  }
  // Un Combat de la Reine déjà planifié ne partage jamais la journée d'un combat de championnat.
  resolveCombatDayConflicts(session.calendar);
}

/** Premier jour de combat possible après `day` : écart tiré dans SEASON_CONFIG.daysBetweenMatches. */
function nextMatchdayAfter(day, rng) {
  const { min, max } = SEASON_CONFIG.daysBetweenMatches;
  return day + randInt(rng, min, max) + 1;
}

/** Avancement de la saison du point de vue du joueur : { season, played, total }. */
export function getSeasonProgress(session) {
  const league = session.playerLeague;
  if (!league || !session.season) return null;
  const total = getTeamRoundCount(league, session.player.teamId);
  return { season: session.season.number, played: Math.min(league.roundsPlayed, total), total };
}

// --- Fin de saison ---------------------------------------------------------------
//
//   dernier combat de championnat → completeMatchdayAndCheckSeason()
//     → finalizeSeason() : classements finaux figés, historique des clubs, montées et
//       descentes déterminées (pas encore appliquées), âge des combattants +1 ;
//       la saison passe à l'état « terminée » (status: 'finished') ;
//   bilan affiché au joueur → « Commencer la nouvelle saison »
//     → startNextSeason() : montées et descentes appliquées, nouvelles divisions,
//       nouveau calendrier.
//
// L'état de la saison (session.season) est enregistré : { number, status, endedOnDay,
// summary, endEvent, endReported, … }. Le classement final n'est jamais recalculé.

/** Vrai quand la saison est terminée et attend que le joueur lance la suivante. */
export function isOffSeason(session) {
  return session.season?.status === 'finished';
}

/** Mouvement d'un club entre deux divisions : 'PROMOTED' | 'RELEGATED' | 'WITHDRAWN' | 'NONE'. */
function movementOf(from, to) {
  if (!from) return 'NONE';
  if (!to) return 'WITHDRAWN';
  const delta = (getLeagueDefinition(to)?.tier ?? 0) - (getLeagueDefinition(from)?.tier ?? 0);
  return delta < 0 ? 'PROMOTED' : delta > 0 ? 'RELEGATED' : 'NONE';
}

/**
 * Fin de saison : dispute les journées restantes (clubs de l'IA), fige les classements,
 * calcule et valide les mouvements. Ne modifie pas encore les divisions.
 */
export function endSeason(session, rng = Math.random) {
  for (const league of session.leagues) {
    while (!league.isComplete) playLeagueRound(session, league, { rng });
  }
  const finalStandings = {};
  const finalTables = {};
  for (const league of session.leagues) {
    const rows = getStandings(session, league);
    finalStandings[league.id] = rows.map((row) => row.team.id);
    finalTables[league.id] = rows.map((row) => ({ teamId: row.team.id, position: row.position, points: row.points, played: row.played, wins: row.wins, losses: row.losses }));
  }
  const movements = calculateMovements(finalStandings);
  const engaged = new Set(session.leagues.flatMap((league) => league.teamIds));
  const compositions = applyMovements(finalStandings, movements, {
    protectedIds: [session.player.teamId],
    reserve: clubDatabase.getReserveClubIds().filter((id) => !engaged.has(id)),
  });
  validateLeagueSizes(compositions);
  return { season: session.season.number, finalStandings, finalTables, movements, compositions };
}

/**
 * Historique des saisons : archive de la saison (classements finaux de toutes les
 * divisions, mouvements) et une entrée par club, qu'il soit celui du joueur ou de l'IA :
 * { season, leagueId, finalPosition, movement }. Ces entrées ne sont jamais réécrites.
 */
export function generateSeasonHistory(session, summary) {
  const playerId = session.player.teamId;
  const leagueBefore = Object.keys(summary.finalStandings).find((id) => summary.finalStandings[id].includes(playerId));
  session.seasonHistory.push({
    season: summary.season,
    leagues: structuredClone(summary.finalTables),
    movements: structuredClone(summary.movements),
    player: { leagueId: leagueBefore, rank: summary.finalStandings[leagueBefore].indexOf(playerId) + 1 },
  });
  recordClubHistory(session, summary.season, summary.finalStandings, summary.movements);
  // Compagnie du joueur championne de sa Ligue : trophée (armoire de la Taverne).
  awardLeagueTitle(session, { leagueId: leagueBefore, season: summary.season, position: summary.finalStandings[leagueBefore].indexOf(playerId) + 1 });
}

function recordClubHistory(session, season, finalStandings, movements) {
  for (const [leagueId, ranking] of Object.entries(finalStandings)) {
    ranking.forEach((teamId, index) => {
      const move = movements.find((m) => m.teamId === teamId && m.from === leagueId);
      const entry = { season, leagueId, finalPosition: index + 1, movement: movementOf(leagueId, move ? move.to : leagueId) };
      if (move?.to && entry.movement !== 'NONE') entry.toLeagueId = move.to;
      (session.clubHistory[teamId] ??= []).push(entry);
    });
  }
}

/** Sauvegarde antérieure à l'historique des clubs : il est reconstruit depuis l'archive des saisons. */
export function backfillClubHistory(session) {
  if (Object.keys(session.clubHistory).length || !session.seasonHistory.length) return false;
  for (const archived of session.seasonHistory) {
    const finalStandings = Object.fromEntries(Object.entries(archived.leagues ?? {})
      .map(([leagueId, table]) => [leagueId, [...table].sort((a, b) => a.position - b.position).map((row) => row.teamId)]));
    recordClubHistory(session, archived.season, finalStandings, archived.movements ?? []);
  }
  return true;
}

/**
 * Historique d'un club, de la plus ancienne saison à la plus récente : classements de Ligue
 * ({ season, leagueId, finalPosition, movement }) et résultats de Coupe de France
 * ({ kind: 'cup', season, editionId, stage, label }) ; à saison égale, la Ligue d'abord.
 */
export function getClubHistory(session, clubId) {
  return [...(session.clubHistory[clubId] ?? [])].sort((a, b) => a.season - b.season || (a.kind === 'cup') - (b.kind === 'cup') || (a.edition ?? 0) - (b.edition ?? 0));
}

/** Vieillissement de fin de saison : +1 an pour chaque combattant du joueur et chaque recrue de la Taverne. */
export function applyAgeIncrease(session) {
  const fighters = [...session.playerFighters, ...session.recruitment.candidates.map((candidate) => candidate.fighter)];
  for (const fighter of fighters) ageFighter(fighter);
  // Combattants des clubs de l'IA : +1 an aussi (vieillissement, AIProgressionService).
  return fighters.length + ageAIFighters(session);
}

/**
 * Clôture de la saison, dès le dernier combat de championnat résolu : journées restantes
 * des autres divisions, classements finaux, historique, montées et descentes déterminées,
 * âge +1. La saison suivante ne démarre qu'à la demande du joueur (startNextSeason).
 * Renvoie l'événement du carnet de bord 'season.end' (aussi gardé dans session.season).
 */
export function finalizeSeason(session, rng = Math.random) {
  if (isOffSeason(session)) return session.season.endEvent;
  const playerId = session.player.teamId;
  const leagueBefore = session.playerLeague.id;
  const summary = endSeason(session, rng);
  const rank = summary.finalStandings[leagueBefore].indexOf(playerId) + 1;
  generateSeasonHistory(session, summary);
  applyAgeIncrease(session);
  // Les combattants de l'IA qui viennent d'atteindre l'âge de la retraite partent aussitôt
  // (la phase quotidienne s'en charge aussi, pour les sauvegardes et cas particuliers).
  runAIRetirements(session, { rng });

  const leagueAfter = Object.keys(summary.compositions).find((id) => summary.compositions[id].includes(playerId));
  const movement = movementOf(leagueBefore, leagueAfter);
  const { calendar } = session;
  const seasonDays = calendar.events.filter((e) => e.typeId === CHAMPIONSHIP_MATCH && e.data?.season === summary.season).map((e) => e.day);
  // Plus aucun combat de championnat ne reste à disputer pour cette saison.
  calendar.events = calendar.events.filter((e) => !(e.typeId === CHAMPIONSHIP_MATCH && e.status === 'scheduled'));
  const endEvent = {
    type: 'season.end',
    season: summary.season,
    rank,
    leagueBefore,
    leagueAfter,
    movement: { PROMOTED: 'promoted', RELEGATED: 'relegated' }[movement] ?? 'stayed',
    movements: summary.movements.map(({ teamId, from, to }) => ({ teamId, from, to })),
    nextSeason: summary.season + 1,
  };
  Object.assign(session.season, {
    status: 'finished',
    endedOnDay: Math.max(calendar.currentDay, ...seasonDays),
    summary: structuredClone(summary),
    endEvent,
    endReported: false,
  });
  // Succès : montée, titre, saison sans défaite, Ligue 1.
  const playerRow = summary.finalTables[leagueBefore]?.find((row) => row.teamId === playerId);
  recordSeasonEnd(session, { rank, movement: endEvent.movement, leagueBefore, losses: playerRow?.losses ?? null });
  session.markDirty();
  return endEvent;
}

/** Journée de championnat terminée ; si c'était la dernière, la saison est aussitôt clôturée. */
export function completeMatchdayAndCheckSeason(session, event, playerMatch = null, rng = Math.random) {
  const results = completeMatchday(session, event, playerMatch, rng);
  const seasonEnd = isSeasonFinished(session) ? finalizeSeason(session, rng) : null;
  return { results, seasonEnd };
}

/** Applique les montées et descentes décidées en fin de saison : nouvelles compositions des divisions. */
export function applyPromotionsAndRelegations(session, summary) {
  for (const league of session.leagues) league.teamIds = [...summary.compositions[league.id]];
  const playerLeague = session.leagues.find((league) => league.teamIds.includes(session.player.teamId));
  session.playerTeam.leagueId = playerLeague.id;
}

/**
 * Nouvelle saison, à la demande du joueur (« Commencer la nouvelle saison ») : montées et
 * descentes appliquées, nouvelles divisions, nouveau calendrier (première journée 4 à 6 jours
 * après la dernière, au plus tôt demain). Renvoie l'événement 'season.start'.
 */
export function startNextSeason(session, rng = Math.random) {
  if (!isOffSeason(session)) throw new Error('La saison en cours n’est pas terminée.');
  const { summary, endedOnDay } = session.season;
  applyPromotionsAndRelegations(session, summary);
  session.calendar.events = session.calendar.events.filter((e) => !(e.typeId === CHAMPIONSHIP_MATCH && e.status === 'scheduled'));
  startSeason(session, {
    number: summary.season + 1,
    firstMatchdayDay: Math.max(nextMatchdayAfter(endedOnDay, rng), session.calendar.currentDay + 1),
  }, rng);
  return { type: 'season.start', season: session.season.number, leagueId: session.playerLeague.id };
}

/**
 * Événement du carnet de bord de la fin de saison, à présenter une seule fois (le jour
 * où le joueur termine la journée du dernier combat). Null s'il est déjà présenté.
 */
export function takeSeasonEndReport(session) {
  if (!isOffSeason(session) || session.season.endReported) return null;
  session.season.endReported = true;
  return session.season.endEvent;
}

/**
 * Sauvegarde antérieure à la v0.7 (une seule division, format différent) : la saison en
 * cours est conservée telle quelle (clubs, classement, rencontres déjà disputées) et
 * les deux autres divisions sont créées. Les tailles sont rééquilibrées à la fin de
 * cette première saison.
 */
export function adoptLegacySeason(session, rng = Math.random) {
  const legacy = session.playerLeague;
  const playerId = session.player.teamId;
  legacy.legacyFormat = true;
  legacy.schedule = generateSchedule(legacy.teamIds);
  legacy.roundsPlayed = legacy.standings[playerId]?.played ?? 0;

  const used = new Set(legacy.teamIds);
  for (const def of listLeagueDefinitions()) {
    if (def.id === legacy.id) continue;
    const teamIds = clubDatabase.getClubIdsOfLeague(def.id).filter((id) => !used.has(id));
    teamIds.forEach((id) => used.add(id));
    const league = new League({ definitionId: def.id, teamIds, season: 1 });
    league.schedule = generateSchedule(teamIds);
    session.leagues.push(league);
  }
  session.season = { number: 1, startedOnDay: session.calendar.currentDay, legacy: true };

  // Journée de combat du jour éventuellement en attente : elle devient la prochaine journée.
  const { calendar } = session;
  const pending = calendar.events.find((e) => e.typeId === 'combat' && e.status === 'scheduled' && e.day === calendar.currentDay);
  let firstDay;
  let fromRound = legacy.roundsPlayed;
  if (pending) {
    const fixture = getFixtureOf(legacy, fromRound, playerId);
    pending.data = { season: 1, matchday: fromRound + 1, opponentTeamId: fixture ? (fixture.teamAId === playerId ? fixture.teamBId : fixture.teamAId) : null };
    firstDay = nextMatchdayAfter(calendar.currentDay, rng);
    fromRound += 1;
  } else {
    // Écart habituel après le dernier combat disputé (au plus tôt demain).
    const lastPlayed = Math.max(0, ...calendar.events.filter((e) => e.typeId === CHAMPIONSHIP_MATCH && e.status === 'done').map((e) => e.day));
    firstDay = lastPlayed
      ? Math.max(calendar.currentDay + 1, nextMatchdayAfter(lastPlayed, rng))
      : Math.max(SEASON_CONFIG.firstMatchdayDay, calendar.currentDay + 1);
  }
  scheduleSeasonEvents(session, firstDay, fromRound, rng);
}
