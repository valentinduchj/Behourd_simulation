import { FRENCH_CUP_RULES } from '../../data/frenchCup.js';
import { getAIProfile } from '../../data/aiProfiles.js';
import { createRng, shuffle } from '../../utils/random.js';
import { getStarRating } from '../fighters/ratings.js';
import { getClubLevel } from '../league/LeagueService.js';
import { drawProfileId } from '../ai/OpponentAIService.js';
import { playBenchMatch } from '../ai/AIBenchService.js';
import { createMatch } from '../match/MatchService.js';
import { addResource } from '../economy/wallet.js';
import { awardCupTitle } from '../trophies/TrophyService.js';
import { createDrawOrder, createEmptyGroups, drawAllTeams, drawNextTeam, getFrenchTeamIds } from './CupDraw.js';
import { buildGroupSchedule, computeQualification, getGroupStandings } from './CupGroups.js';
import { aliveInBracket, createBracket, propagateWinner } from './CupBracket.js';
import { countKnockouts, recordFighterStats } from './CupStatistics.js';
import { setStat } from '../fighters/stats.js';
import { recordCupProgress } from '../achievements/AchievementService.js';

// Coupe de France (FrenchCupManager) : compétition permanente, indépendante du calendrier.
// Elle vit tout entière dans session.frenchCup (tirage, poules, tableau, statistiques) et ne
// touche JAMAIS aux championnats, au calendrier ni au palmarès des combattants (la fatigue de la
// compagnie est remise à 0 à l'entrée dans la Coupe, puis suit les règles normales)
// (combats « isolés » : Match.isolated).
//
// Déroulement par étapes (cup.step) :
//   { stage: 'draw' } → { stage: 'groups', matchday: 1…5 } → { stage: 'knockout', round: 0…4 }
//   → { stage: 'finished' }
// À chaque étape, le combat du joueur (s'il est encore en lice) se joue dans la Lice ; les
// autres sont simulés par le moteur de combat, puis l'étape suivante s'ouvre.

// --- Édition ---------------------------------------------------------------------------

/** Coupe en cours (null : aucune). */
export function getCup(session) {
  return session.frenchCup ?? null;
}

/**
 * Nouvelle édition : les équipes françaises de la partie, un ordre de tirage fixé par la graine.
 * Une édition terminée est remplacée (son bilan est déjà au palmarès) ; une édition en cours
 * n'est remplacée que si `force`.
 */
export function createEdition(session, { seed = `${Date.now()}`, force = false, trigger = null, rules = FRENCH_CUP_RULES } = {}) {
  const current = getCup(session);
  if (current && current.step.stage !== 'finished' && !force) throw new Error('Une Coupe de France est déjà en cours.');
  const teamIds = getFrenchTeamIds(session);
  const expected = rules.groupCount * rules.groupSize;
  if (teamIds.length !== expected) throw new Error(`Coupe de France : ${teamIds.length} équipes françaises pour ${expected} places.`);
  const edition = (session.frenchCupHistory?.length ?? 0) + 1;
  const cup = {
    editionId: `cdf-${edition}-${seed}`,
    edition,
    seed,
    // Saison du championnat pendant laquelle l'édition est ouverte (historique des clubs). Coupe de
    // fin de saison (v0.57.0) : la saison qui vient de finir.
    season: session.season?.number ?? 1,
    // 'seasonEnd' : Coupe de l'intersaison (seul déclencheur depuis la v0.57.0).
    trigger,
    abandoned: false,
    createdAt: Date.now(),
    playerTeamId: session.player.teamId,
    teamIds,
    draw: { order: createDrawOrder(teamIds, seed), drawn: 0, completed: false },
    groups: createEmptyGroups(rules),
    playerGroup: null,
    step: { stage: 'draw' },
    qualification: null,
    bracket: null,
    playerStatus: 'active',
    playerEliminatedAt: null,
    playerPath: [],
    fighterStats: {},
    // Récompenses déjà versées au joueur : { [matchId]: deniers } (jamais deux fois).
    rewards: {},
    winnerId: null,
    finishedAt: null,
    // Fatigue de la compagnie remise à 0 au lancement (v0.71), une seule fois par édition.
    fatigueReset: false,
  };
  session.frenchCup = cup;
  resetCupFatigue(session, cup);
  session.markDirty?.();
  return cup;
}

/**
 * Lancement d'une édition : toute la compagnie du joueur part reposée (fatigue 0), quelle que
 * soit la fatigue du championnat. Une seule fois par édition (cup.fatigueReset, sauvegardé) :
 * ni à l'ouverture de l'écran, ni au chargement. Les clubs de l'IA ne sont pas concernés (leurs
 * combats de Coupe partent déjà reposés) ; ensuite, les règles habituelles s'appliquent.
 * Renvoie le nombre de combattants remis à 0.
 */
export function resetCupFatigue(session, cup = session.frenchCup) {
  if (!cup || cup.fatigueReset) return 0;
  let count = 0;
  for (const fighter of session.playerFighters) {
    if ((fighter.stats.fatigue ?? 0) !== 0) count += 1;
    setStat(fighter, 'fatigue', 0);
  }
  cup.fatigueReset = true;
  session.markDirty?.();
  return count;
}

// --- Coupe de fin de saison (v0.57.0) ----------------------------------------------------
//
// La Coupe n'est plus ouverte à la demande : une édition par intersaison, après le bilan de
// fin de saison (« Aller en Coupe de France »). Une fois ouverte, elle est bloquante jusqu'à
// la nouvelle saison, lancée depuis l'écran du vainqueur.

export const SEASON_END_TRIGGER = 'seasonEnd';

/**
 * Où en est la Coupe de l'intersaison : 'closed' (saison en cours), 'available' (saison
 * terminée, Coupe pas encore ouverte), 'inProgress', 'finished' (en attente de la nouvelle saison).
 */
export function getSeasonCupState(session) {
  if (session.season?.status !== 'finished') return 'closed';
  const cup = getCup(session);
  if (!cup || cup.trigger !== SEASON_END_TRIGGER || cup.season !== session.season.number) return 'available';
  return cup.step.stage === 'finished' ? 'finished' : 'inProgress';
}

/** « Aller en Coupe de France » : ouvre la Coupe de la saison qui vient de finir (une seule fois). */
export function openSeasonCup(session, { seed = `${Date.now()}` } = {}) {
  const state = getSeasonCupState(session);
  if (state === 'closed') throw new Error('La Coupe de France se dispute à la fin de la saison.');
  if (state !== 'available') return getCup(session);
  return createEdition(session, { seed, force: true, trigger: SEASON_END_TRIGGER });
}

/** La compagnie du joueur a-t-elle encore au moins un combat à disputer dans cette Coupe ? */
export function playerHasMatchesLeft(cup) {
  return Boolean(cup) && cup.playerStatus === 'active' && cup.step.stage !== 'finished';
}

/** Forfait : l'adversaire gagne 2–0, sans manche disputée (aucune statistique de combattant). */
function forfeitMatch(session, match, teamId) {
  const winnerSide = match.teamAId === teamId ? 'B' : 'A';
  const rounds = [0, 1].map(() => ({ winner: winnerSide, lineups: { A: [], B: [] }, stats: {}, knockedOut: [] }));
  match.forfeit = teamId;
  return applyMatchResult(session, match, { rounds, simulated: true });
}

/**
 * « Abandonner la Coupe » : la compagnie est éliminée sur-le-champ ; ses combats restants sont
 * perdus par forfait (0–2) — tous ceux de sa poule, ou celui du tour en cours — et elle n'est
 * jamais qualifiée. Les autres continuent jusqu'au vainqueur. Deniers déjà gagnés conservés.
 */
export function abandonCup(session) {
  const cup = getCup(session);
  if (!playerHasMatchesLeft(cup)) throw new Error('La compagnie n’a plus de combat à disputer.');
  if (cup.step.stage === 'draw') {
    drawAllTeams(cup);
    startGroupStage(cup);
  }
  const label = cup.step.stage === 'knockout'
    ? `Abandon en ${FRENCH_CUP_RULES.knockoutRounds[cup.step.round].toLowerCase()}`
    : 'Abandon en phase de poules';
  cup.abandoned = true;
  cup.playerStatus = 'eliminated';
  cup.playerEliminatedAt = label;
  const pending = cup.step.stage === 'groups'
    ? cup.groups.flatMap((g) => g.matches).filter((m) => m.status === 'pending' && involves(m, cup.playerTeamId))
    : getStepMatches(cup).filter((m) => m.status === 'pending' && involves(m, cup.playerTeamId));
  for (const match of pending) forfeitMatch(session, match, cup.playerTeamId);
  session.markDirty?.();
  return pending.length;
}

/**
 * Sauvegarde antérieure à la v0.57.0 : une Coupe ouverte à la demande et pas terminée est
 * annulée (sans résultat ni historique). Renvoie true si elle l'a été.
 */
export function cancelLegacyCup(session) {
  const cup = getCup(session);
  if (!cup || cup.trigger === SEASON_END_TRIGGER || cup.step.stage === 'finished') return false;
  session.frenchCup = null;
  session.markDirty?.();
  return true;
}

// --- Tirage ----------------------------------------------------------------------------

/** Tire la prochaine équipe. Renvoie { teamId, slot } (null : tirage terminé). */
export function drawNext(session) {
  const cup = getCup(session);
  const drawn = drawNextTeam(cup);
  if (cup.draw.completed) startGroupStage(cup);
  session.markDirty?.();
  return drawn;
}

/** Termine le tirage d'un coup (même résultat que tirer équipe par équipe). */
export function drawAll(session) {
  const cup = getCup(session);
  const count = drawAllTeams(cup);
  if (cup.draw.completed) startGroupStage(cup);
  session.markDirty?.();
  return count;
}

function startGroupStage(cup) {
  if (cup.step.stage !== 'draw') return;
  for (const group of cup.groups) group.matches = buildGroupSchedule(group);
  cup.playerGroup = cup.groups.find((group) => group.teamIds.includes(cup.playerTeamId))?.id ?? null;
  cup.step = { stage: 'groups', matchday: 1 };
}

// --- Combats -----------------------------------------------------------------------------

/** Tous les combats de la Coupe (poules puis tableau). */
export function allMatches(cup) {
  return [
    ...cup.groups.flatMap((group) => group.matches),
    ...(cup.bracket?.rounds.flatMap((round) => round.matches) ?? []),
  ];
}

export function findMatch(cup, matchId) {
  return allMatches(cup).find((match) => match.id === matchId) ?? null;
}

/** Combats de l'étape en cours. */
export function getStepMatches(cup) {
  const { step } = cup;
  if (step.stage === 'groups') return cup.groups.flatMap((group) => group.matches.filter((m) => m.matchday === step.matchday));
  if (step.stage === 'knockout') return cup.bracket.rounds[step.round].matches;
  return [];
}

const involves = (match, teamId) => match.teamAId === teamId || match.teamBId === teamId;

/** Combat du joueur à disputer à l'étape en cours (null : aucun). */
export function getPlayerPendingMatch(cup) {
  if (cup.playerStatus !== 'active') return null;
  return getStepMatches(cup).find((match) => match.status === 'pending' && involves(match, cup.playerTeamId)) ?? null;
}

/** Combats de l'étape qui restent à simuler (ceux de l'IA ; jamais celui du joueur encore en lice). */
export function getPendingSimulations(cup) {
  const playerMatch = getPlayerPendingMatch(cup);
  return getStepMatches(cup).filter((match) => match.status === 'pending' && match !== playerMatch && match.teamAId && match.teamBId);
}

/** Libellé d'une étape : « Poule B · journée 3 », « Quarts de finale ». */
export function describeMatch(cup, match, rules = FRENCH_CUP_RULES) {
  if (!match) return '';
  if (match.groupId) return `Poule ${match.groupId} · journée ${match.matchday}`;
  return rules.knockoutRounds[match.round] ?? '';
}

export function describeStep(cup, rules = FRENCH_CUP_RULES) {
  const { step } = cup;
  if (step.stage === 'draw') return 'Tirage au sort';
  if (step.stage === 'groups') return `Phase de poules · journée ${step.matchday} / ${rules.groupSize - 1}`;
  if (step.stage === 'knockout') return rules.knockoutRounds[step.round];
  return 'Coupe terminée';
}

/**
 * Inscrit le résultat d'un combat. rounds : manches au format des statistiques, du point de vue
 * du combat de la Coupe (A = match.teamAId). Renvoie le combat.
 */
export function applyMatchResult(session, match, { rounds, simulated = false, profiles = null }) {
  if (match.status === 'played') return match;
  const cup = getCup(session);
  const roundsWon = { A: rounds.filter((r) => r.winner === 'A').length, B: rounds.filter((r) => r.winner === 'B').length };
  const winnerSide = roundsWon.A > roundsWon.B ? 'A' : 'B';
  const ko = countKnockouts(rounds);
  Object.assign(match, {
    status: 'played',
    simulated,
    winnerId: winnerSide === 'A' ? match.teamAId : match.teamBId,
    roundsWonA: roundsWon.A,
    roundsWonB: roundsWon.B,
    knockoutsA: ko.A,
    knockoutsB: ko.B,
    // Vainqueur de chaque manche, dans l'ordre (affichage pas à pas du score dans l'arbre).
    roundWinners: rounds.map((r) => r.winner),
    profiles,
  });
  recordFighterStats(cup, {
    rounds, teams: { A: match.teamAId, B: match.teamBId }, winnerSide,
    nameOf: (id) => session.getFighter(id)?.name ?? null,
  });
  if (involves(match, cup.playerTeamId)) {
    const won = match.winnerId === cup.playerTeamId;
    const mine = match.teamAId === cup.playerTeamId ? 'A' : 'B';
    cup.playerPath.push({
      matchId: match.id, label: describeMatch(cup, match), opponentId: mine === 'A' ? match.teamBId : match.teamAId,
      won, roundsWon: roundsWon[mine], roundsLost: roundsWon[mine === 'A' ? 'B' : 'A'], forfeit: match.forfeit === cup.playerTeamId,
    });
    if (match.round !== undefined && !won) eliminatePlayer(cup, describeMatch(cup, match));
    if (won) payVictoryReward(session, cup, match);
  }
  if (match.round !== undefined) propagateWinner(cup.bracket, match);
  session.markDirty?.();
  return match;
}

/** Récompense d'une victoire du joueur dans ce combat (deniers) : poules, puis selon le tour. */
export function getVictoryReward(match, rules = FRENCH_CUP_RULES) {
  if (!match) return 0;
  return match.round === undefined ? rules.rewards.groups : rules.rewards.knockout[match.round] ?? 0;
}

/**
 * Verse la récompense d'une victoire du joueur, une seule fois par combat : le paiement est
 * inscrit sous l'identifiant du combat (cup.rewards), sauvegardé avec la Coupe. Renvoie le
 * montant versé (0 si déjà payé).
 */
export function payVictoryReward(session, cup, match) {
  cup.rewards ??= {};
  if (cup.rewards[match.id] !== undefined || match.winnerId !== cup.playerTeamId) return 0;
  const amount = getVictoryReward(match);
  cup.rewards[match.id] = amount;
  if (amount > 0) addResource(session, 'deniers', amount);
  return amount;
}

/** Total des récompenses gagnées pendant l'édition. */
export function getTotalRewards(cup) {
  return Object.values(cup?.rewards ?? {}).reduce((sum, amount) => sum + amount, 0);
}

/**
 * Résultat du combat du joueur, joué dans la Lice (MatchScreen, camp A = joueur). Les manches
 * sont celles du combat (fightersTeamA/B, winner, simulation : stats, knockedOut).
 */
export function recordPlayerMatch(session, matchId, playedRounds) {
  const cup = getCup(session);
  const match = findMatch(cup, matchId);
  if (!match) throw new Error(`Combat de Coupe introuvable : ${matchId}`);
  const playerIsA = match.teamAId === cup.playerTeamId;
  const flip = (side) => (playerIsA ? side : side === 'A' ? 'B' : 'A');
  const rounds = playedRounds.map((round) => {
    const lineups = { A: round.fightersTeamA ?? [], B: round.fightersTeamB ?? [] };
    return {
      winner: flip(round.winner),
      lineups: playerIsA ? lineups : { A: lineups.B, B: lineups.A },
      stats: round.simulation?.stats ?? {},
      knockedOut: round.simulation?.knockedOut ?? [],
    };
  });
  return applyMatchResult(session, match, { rounds });
}

/**
 * Combat du joueur pour la Lice (MatchScreen) : la compagnie du joueur en camp A, combat isolé
 * (aucun effet sur le palmarès ni le championnat ; vraie fatigue de la compagnie). null : combat introuvable,
 * déjà joué ou sans le joueur.
 */
export function createCupPlayerMatch(session, matchId) {
  const cup = getCup(session);
  const match = cup ? findMatch(cup, matchId) : null;
  if (!match || match.status !== 'pending' || match !== getPlayerPendingMatch(cup)) return null;
  const opponentId = match.teamAId === cup.playerTeamId ? match.teamBId : match.teamAId;
  // Vraie fatigue de la compagnie (v0.73.1) : remise à 0 à l'entrée dans la Coupe, puis elle évolue
  // normalement d'un combat à l'autre.
  return createMatch({ teamAId: cup.playerTeamId, teamBId: opponentId, matchday: match.id, kind: 'cup', isolated: true, playerFatigue: true });
}

/** Affluence d'un combat de la Coupe (présentation) : selon la phase et le tour. */
export function getCupCrowdSize(match, rules = FRENCH_CUP_RULES) {
  if (!match || match.round === undefined) return rules.crowd.groups;
  return rules.crowd.knockout[match.round] ?? rules.crowd.groups;
}

/** Adversaire du joueur dans un combat de la Coupe. */
export function opponentOf(cup, match) {
  return match.teamAId === cup.playerTeamId ? match.teamBId : match.teamAId;
}

/** Comportement d'une compagnie pour un combat simulé (selon ses étoiles, comme contre le joueur). */
function profileFor(session, cup, match, teamId) {
  const stars = getStarRating(getClubLevel(session, teamId));
  return getAIProfile(drawProfileId(stars, createRng(`coupe:${cup.editionId}:${match.id}:${teamId}:comportement`)));
}

/** Simule un combat de l'IA avec le moteur de combat (graine : édition + combat). */
export function simulateMatch(session, match) {
  const cup = getCup(session);
  const profiles = { A: profileFor(session, cup, match, match.teamAId), B: profileFor(session, cup, match, match.teamBId) };
  const result = playBenchMatch({
    sides: {
      A: { profile: profiles.A, fighters: session.getFightersOfTeam(match.teamAId) },
      B: { profile: profiles.B, fighters: session.getFightersOfTeam(match.teamBId) },
    },
    rng: createRng(`coupe:${cup.editionId}:${match.id}`),
  });
  return applyMatchResult(session, match, { rounds: result.rounds, simulated: true, profiles: { A: profiles.A.id, B: profiles.B.id } });
}

// --- Étapes ------------------------------------------------------------------------------

function eliminatePlayer(cup, at) {
  if (cup.playerStatus !== 'active') return;
  cup.playerStatus = 'eliminated';
  cup.playerEliminatedAt = at;
}

const nameResolver = (session) => (id) => session.getTeam(id)?.name ?? id;

/** Classement d'une poule. */
export function getStandings(session, group) {
  return getGroupStandings(group, { nameOf: nameResolver(session) });
}

/**
 * Passe à l'étape suivante si celle en cours est jouée entièrement. Fin des poules :
 * qualification puis tableau. Fin du tableau : vainqueur. Renvoie true si l'étape a changé.
 */
export function advanceStep(session, rules = FRENCH_CUP_RULES) {
  const cup = getCup(session);
  const { step } = cup;
  if (!['groups', 'knockout'].includes(step.stage)) return false;
  if (getStepMatches(cup).some((match) => match.status !== 'played')) return false;
  if (step.stage === 'groups' && step.matchday < rules.groupSize - 1) {
    cup.step = { stage: 'groups', matchday: step.matchday + 1 };
  } else if (step.stage === 'groups') {
    const result = computeQualification(cup.groups, { nameOf: nameResolver(session), rules, excluded: cup.abandoned ? [cup.playerTeamId] : [] });
    cup.qualification = { qualified: result.qualified, direct: result.direct, extra: result.extra.map((row) => row.teamId), eliminated: result.eliminated };
    cup.bracket = createBracket(result.qualified, `${cup.editionId}`, rules);
    if (!result.qualified.includes(cup.playerTeamId)) eliminatePlayer(cup, 'Phase de poules');
    cup.step = { stage: 'knockout', round: 0 };
  } else if (step.round < cup.bracket.rounds.length - 1) {
    cup.step = { stage: 'knockout', round: step.round + 1 };
  } else {
    finishCup(session);
  }
  // Succès : phase finale atteinte, Coupe remportée.
  recordCupProgress(session, cup);
  session.markDirty?.();
  return true;
}

function finishCup(session) {
  const cup = getCup(session);
  const final = cup.bracket.rounds[cup.bracket.rounds.length - 1].matches[0];
  cup.winnerId = final.winnerId;
  if (cup.winnerId === cup.playerTeamId) cup.playerStatus = 'champion';
  cup.step = { stage: 'finished' };
  cup.finishedAt = Date.now();
  session.frenchCupHistory ??= [];
  if (!session.frenchCupHistory.some((entry) => entry.editionId === cup.editionId)) {
    session.frenchCupHistory.push({
      editionId: cup.editionId,
      edition: cup.edition,
      winnerId: cup.winnerId,
      winnerName: session.getTeam(cup.winnerId)?.name ?? null,
      finalistId: final.winnerId === final.teamAId ? final.teamBId : final.teamAId,
      playerTeamId: cup.playerTeamId,
      playerStatus: cup.playerStatus,
      playerEliminatedAt: cup.playerEliminatedAt,
      playerPath: cup.playerPath.map((entry) => ({ ...entry })),
      rewards: getTotalRewards(cup),
      season: cup.season ?? session.season?.number ?? 1,
      finishedAt: cup.finishedAt,
    });
  }
  // Résultat définitif de chaque club dans son historique, et trophée si le joueur l'emporte.
  recordCupHistory(session, cup);
  awardCupTitle(session, cup);
}

/**
 * Meilleur résultat d'un club dans une édition terminée : 'groups' (éliminé en poules),
 * 'round:N' (battu au tour N du tableau, 0 = seizièmes), 'finalist', 'champion'.
 */
export function getCupStage(cup, teamId) {
  if (cup.winnerId === teamId) return 'champion';
  const rounds = cup.bracket?.rounds ?? [];
  for (const round of rounds) {
    const lost = round.matches.find((m) => m.status === 'played' && (m.teamAId === teamId || m.teamBId === teamId) && m.winnerId !== teamId);
    if (lost) return round.index === rounds.length - 1 ? 'finalist' : `round:${round.index}`;
  }
  return 'groups';
}

/**
 * Stade atteint, sans saison, pour l'historique harmonisé des clubs (v0.69) : « Phase de poule »,
 * « Quart de finale », « Demi-finale », « Finaliste », « Vainqueur ». Tiré du stade enregistré
 * (`groups`, `round:N`, `finalist`, `champion`), jamais du libellé stocké.
 */
export function cupStageName(stage, rules = FRENCH_CUP_RULES) {
  const labels = rules.historyLabels;
  if (stage === 'champion') return labels.winner;
  if (stage === 'finalist') return labels.finalist;
  const round = typeof stage === 'string' && stage.startsWith('round:') ? labels.rounds[Number(stage.split(':')[1])] : null;
  if (round) return round.charAt(0).toUpperCase() + round.slice(1);
  return labels.groups;
}

/** Intitulé de l'historique : « Phase de poule », « Saison 2 quart de finale », « Finaliste », « Champion de France ». */
export function cupStageLabel(stage, season, rules = FRENCH_CUP_RULES) {
  if (stage === 'champion') return rules.historyLabels.champion;
  if (stage === 'finalist') return rules.historyLabels.finalist;
  if (stage === 'groups') return rules.historyLabels.groups;
  const round = Number(stage.split(':')[1]);
  return `Saison ${season} ${rules.historyLabels.rounds[round]}`;
}

/**
 * Inscrit le résultat de chaque club de l'édition dans son historique (session.clubHistory),
 * une seule fois par édition. Ne modifie jamais les entrées existantes. Renvoie le nombre ajouté.
 */
export function recordCupHistory(session, cup) {
  if (cup?.step?.stage !== 'finished') return 0;
  const season = cup.season ?? session.season?.number ?? 1;
  let added = 0;
  for (const teamId of cup.teamIds) {
    const entries = (session.clubHistory[teamId] ??= []);
    if (entries.some((entry) => entry.kind === 'cup' && entry.editionId === cup.editionId)) continue;
    const stage = getCupStage(cup, teamId);
    entries.push({ kind: 'cup', season, editionId: cup.editionId, edition: cup.edition, stage, label: cupStageLabel(stage, season) });
    added += 1;
  }
  if (added) session.markDirty?.();
  return added;
}

/**
 * Simule les combats de l'IA de l'étape en cours, puis ouvre l'étape suivante si tout est joué.
 * Asynchrone : rend la main entre deux combats (onProgress(done, total, match)).
 */
export async function simulateStep(session, { onProgress = null, yieldEvery = 1 } = {}) {
  const cup = getCup(session);
  const pending = getPendingSimulations(cup);
  let done = 0;
  for (const match of pending) {
    simulateMatch(session, match);
    done += 1;
    onProgress?.(done, pending.length, match);
    if (yieldEvery && done % yieldEvery === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  advanceStep(session);
  return done;
}

/**
 * Le joueur éliminé (ou spectateur) : simule toutes les étapes restantes jusqu'au vainqueur.
 * S'arrête si un combat du joueur encore en lice attend (jamais joué à sa place).
 */
export async function simulateToEnd(session, { onProgress = null } = {}) {
  const cup = getCup(session);
  let guard = 0;
  while (['groups', 'knockout'].includes(cup.step.stage) && guard++ < 20) {
    if (getPlayerPendingMatch(cup)) break;
    await simulateStep(session, { onProgress: (done, total) => onProgress?.(describeStep(cup), done, total) });
  }
  return cup.step.stage === 'finished';
}

/** Combats que la compagnie joueur a encore à jouer dans l'étape (Lice) ou attend (simulations). */
export function getCupStatus(cup) {
  if (!cup) return 'none';
  if (cup.step.stage === 'draw') return 'draw';
  if (cup.step.stage === 'finished') return 'finished';
  if (getPlayerPendingMatch(cup)) return 'playerMatch';
  return getPendingSimulations(cup).length ? 'simulate' : 'advance';
}

/**
 * Combattants d'ambiance du Château de Gabarnac : un combattant de `count` compagnies engagées
 * (encore en lice si possible), hors compagnie du joueur, choisis de façon stable pour l'étape.
 * Lecture seule : aucun effectif ni état de la Coupe n'est modifié. [{ fighter, team }]
 */
export function pickAmbianceFighters(session, count) {
  const cup = getCup(session);
  if (!cup) return [];
  const rng = createRng(`coupe:${cup.editionId}:ambiance:${describeStep(cup)}`);
  const alive = getTeamsAlive(cup).filter((id) => id !== cup.playerTeamId);
  const pool = alive.length >= count ? alive : cup.teamIds.filter((id) => id !== cup.playerTeamId);
  return shuffle(rng, [...pool]).slice(0, count).map((teamId) => {
    const fighters = session.getFightersOfTeam(teamId);
    const fighter = fighters.length ? fighters[Math.floor(rng() * fighters.length)] : null;
    return fighter ? { fighter, team: session.getTeam(teamId) } : null;
  }).filter(Boolean);
}

/** Équipes encore en lice (tableau) ; avant le tableau, toutes les équipes. */
export function getTeamsAlive(cup) {
  return cup.bracket ? aliveInBracket(cup.bracket) : [...cup.teamIds];
}
