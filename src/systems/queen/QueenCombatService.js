import { QUEEN_COMBAT_CONFIG } from '../../data/queenCombat.js';
import { QUEEN_COMBAT } from '../../data/calendar.js';
import { RESERVE_POOL } from '../../data/leagues.js';
import { calculateClubLevel, getStarRating } from '../fighters/ratings.js';
import { clubDatabase } from '../clubs/ClubDatabase.js';
import { addResource } from '../economy/wallet.js';
import { findFreeCombatDay, generateQueenCombatDate, getPendingQueenEvent } from '../calendar/CalendarService.js';
import { getLeagueDefinition } from '../league/LeagueService.js';
import { createMatch, simulateMatch, playerParticipants } from '../match/MatchService.js';
import { queenRewardBonus } from '../talents/TalentEffects.js';
import { createArena } from '../../combat/Arena.js';
import { recordQueenResult } from '../achievements/AchievementService.js';

// Combats de la Reine : événements spéciaux, distincts du championnat. Ils ne touchent ni
// au classement, ni aux journées de championnat, ni aux montées et descentes.
//
//   planification (intervalle tiré, enregistré) → jour J : 5 propositions tirées et
//   enregistrées (adversaire, origine, récompense) + 4 combats IA contre IA tirés parmi
//   les autres clubs → choix définitif d'un adversaire → combat (même moteur, même
//   fatigue) → les 4 autres combats simulés une seule fois, résultats enregistrés →
//   récompense en cas de victoire seulement → planification du suivant.
//
// État d'un Combat de la Reine (event.data, sauvegardé) :
//   { stage: 'planned' | 'choosing' | 'selected' | 'resolved' | 'missed',
//     options: [{ teamId, pool, stars, reward }] | null,
//     secondaryMatches: [{ teamAId, teamBId, result: { winnerId, scoreA, scoreB } | null }] | null,
//     selectedTeamId, result: { won, roundsFor, roundsAgainst, reward } | null }

const CURRENCY = 'deniers';

// --- Calendrier ---

/** Planifie un Combat de la Reine après `fromDay` (jamais le jour d'un autre combat). */
export function scheduleQueenCombat(session, fromDay, rng = Math.random, config = QUEEN_COMBAT_CONFIG) {
  const { calendar } = session;
  const drawn = generateQueenCombatDate(fromDay, config.interval, rng);
  const day = findFreeCombatDay(calendar, Math.max(drawn, calendar.currentDay + 1));
  session.markDirty();
  return calendar.addEvent({
    typeId: QUEEN_COMBAT,
    day,
    title: 'Combat de la Reine',
    data: { stage: 'planned', options: null, secondaryMatches: null, selectedTeamId: null, result: null },
  });
}

/** Garantit qu'un Combat de la Reine est planifié (nouvelle partie, ancienne sauvegarde). Idempotent. */
export function ensureQueenCombatPlanned(session, rng = Math.random) {
  const { calendar } = session;
  const pending = calendar.events.some((event) => event.typeId === QUEEN_COMBAT && event.status === 'scheduled');
  if (pending) return null;
  const last = calendar.events
    .filter((event) => event.typeId === QUEEN_COMBAT)
    .reduce((max, event) => Math.max(max, event.day), -Infinity);
  return scheduleQueenCombat(session, Number.isFinite(last) ? last : calendar.currentDay, rng);
}

export function getPendingQueenCombat(session) {
  return getPendingQueenEvent(session.calendar);
}

// --- Propositions ---

/** Clubs pouvant être proposés depuis une origine ('reserve' ou identifiant de division). */
export function getOpponentPool(session, poolId) {
  const playerId = session.player.teamId;
  if (poolId === RESERVE_POOL.id) {
    const engaged = new Set(session.leagues.flatMap((league) => league.teamIds));
    return clubDatabase.getClubIdsOfLeague(RESERVE_POOL.id).filter((id) => !engaged.has(id) && id !== playerId);
  }
  return (session.getLeague(poolId)?.teamIds ?? []).filter((id) => id !== playerId);
}

/** Nom affiché de l'origine d'un adversaire : « Ligue 2 », « Hors championnat ». */
export function getPoolName(poolId) {
  return poolId === RESERVE_POOL.id ? RESERVE_POOL.name : getLeagueDefinition(poolId)?.name ?? poolId;
}

/** Niveau en étoiles d'un club (même calcul que partout ailleurs). */
export function getClubStars(session, teamId) {
  return getStarRating(calculateClubLevel(session.getFightersOfTeam(teamId)));
}

/** Récompense de base pour un niveau en étoiles (la plus petite définie en dessous du barème). */
export function getBaseReward(stars, config = QUEEN_COMBAT_CONFIG) {
  const levels = Object.keys(config.rewardsByStars).map(Number).sort((a, b) => a - b);
  const level = [...levels].reverse().find((value) => value <= stars) ?? levels[0];
  return config.rewardsByStars[level];
}

/**
 * Récompense tirée une seule fois, à la proposition :
 *   (barème des étoiles ± variation, arrondi au denier) × multiplicateur des Combats de la Reine.
 * Ex. avec le multiplicateur 2 : un tirage de 8 deniers devient 16, 410 devient 820.
 */
export function calculateReward(stars, rng = Math.random, config = QUEEN_COMBAT_CONFIG) {
  const base = getBaseReward(stars, config);
  const factor = 1 + (rng() * 2 - 1) * config.rewardVariation;
  return Math.round(base * factor) * (config.rewardMultiplier ?? 1);
}

/** Propositions du moins étoilé au plus étoilé ; à égalité, l'ordre du tirage est conservé (tri stable). */
export function sortOptionsByStars(options) {
  return [...options].sort((a, b) => a.stars - b.stars);
}

/** Tire `opponentOptions` adversaires distincts, chacun d'une origine tirée selon les poids. */
export function generateOpponentOptions(session, rng = Math.random, config = QUEEN_COMBAT_CONFIG) {
  const chosen = new Set();
  const options = [];
  for (let i = 0; i < config.opponentOptions; i++) {
    const pools = config.opponentPools
      .map((entry) => ({ ...entry, candidates: getOpponentPool(session, entry.pool).filter((id) => !chosen.has(id)) }))
      .filter((entry) => entry.candidates.length && entry.weight > 0);
    if (!pools.length) break;
    const total = pools.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng() * total;
    const pool = pools.find((entry) => (roll -= entry.weight) < 0) ?? pools[pools.length - 1];
    const teamId = pool.candidates[Math.floor(rng() * pool.candidates.length)];
    chosen.add(teamId);
    const stars = getClubStars(session, teamId);
    options.push({ teamId, pool: pool.pool, stars, reward: calculateReward(stars, rng, config) });
  }
  return sortOptionsByStars(options);
}

// --- Autres Combats de la Reine (IA contre IA) ---

/** Tous les clubs éligibles aux Combats de la Reine (toutes origines confondues, hors compagnie du joueur). */
export function getEligibleClubIds(session, config = QUEEN_COMBAT_CONFIG) {
  return [...new Set(config.opponentPools.flatMap((entry) => getOpponentPool(session, entry.pool)))];
}

/**
 * Tire les combats secondaires : 2 × `secondaryMatches` clubs distincts parmi les clubs
 * éligibles, en excluant explicitement `excludedIds` (les adversaires proposés au joueur),
 * sans filtre de ligue, puis appariés dans l'ordre du tirage.
 */
export function generateSecondaryMatches(session, excludedIds, rng = Math.random, config = QUEEN_COMBAT_CONFIG) {
  const excluded = new Set(excludedIds);
  const candidates = getEligibleClubIds(session, config).filter((id) => !excluded.has(id));
  const needed = Math.min(config.secondaryMatches * 2, candidates.length - (candidates.length % 2));
  // Tirage sans remise (Fisher-Yates partiel).
  for (let i = 0; i < needed; i++) {
    const j = i + Math.floor(rng() * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const matches = [];
  for (let i = 0; i < needed; i += 2) matches.push({ teamAId: candidates[i], teamBId: candidates[i + 1], result: null });
  return matches;
}

/**
 * Contrôle d'intégrité d'une journée de Combat de la Reine. Renvoie la liste des anomalies
 * (vide si tout est correct) : nombre d'adversaires, de combats, de clubs, doublons.
 */
export function validateQueenDraw(options, secondaryMatches, config = QUEEN_COMBAT_CONFIG) {
  const problems = [];
  const optionIds = options.map((option) => option.teamId);
  const secondaryIds = secondaryMatches.flatMap((match) => [match.teamAId, match.teamBId]);
  if (optionIds.length !== config.opponentOptions) problems.push(`${optionIds.length} adversaires proposés au lieu de ${config.opponentOptions}.`);
  if (secondaryMatches.length !== config.secondaryMatches) problems.push(`${secondaryMatches.length} combats secondaires au lieu de ${config.secondaryMatches}.`);
  if (new Set(optionIds).size !== optionIds.length) problems.push('Un adversaire est proposé deux fois.');
  if (new Set(secondaryIds).size !== secondaryIds.length) problems.push('Un club apparaît dans deux combats secondaires.');
  if (secondaryIds.some((id) => optionIds.includes(id))) problems.push('Un adversaire proposé apparaît dans un combat secondaire.');
  const total = new Set([...optionIds, ...secondaryIds]).size;
  const expected = config.opponentOptions + config.secondaryMatches * 2;
  if (total !== expected) problems.push(`${total} clubs mobilisés au lieu de ${expected}.`);
  return problems;
}

/**
 * Simule UNE SEULE FOIS chaque combat secondaire (même moteur que tous les combats IA :
 * MatchService.simulateMatch) et enregistre son résultat dans l'événement. Ne produit
 * aucun événement de carnet de bord (logbook: false) : seuls les résultats sont renvoyés.
 */
export function simulateSecondaryMatches(session, event, rng = Math.random) {
  const matches = event.data.secondaryMatches ?? [];
  const arena = createArena();
  for (const secondary of matches) {
    if (secondary.result) continue;
    const match = simulateMatch(session, {
      teamAId: secondary.teamAId, teamBId: secondary.teamBId, kind: QUEEN_COMBAT, fatigueRules: QUEEN_COMBAT_CONFIG.fatigue,
    }, arena, rng);
    secondary.result = { winnerId: match.winnerId, scoreA: match.scoreA, scoreB: match.scoreB };
  }
  if (matches.length) session.markDirty();
  return matches;
}

/** Jour J : tire et enregistre les propositions et les combats secondaires (une seule fois). */
export function generateQueenCombat(session, event, rng = Math.random) {
  if (!event.data.options) {
    event.data.options = generateOpponentOptions(session, rng);
    event.data.secondaryMatches = generateSecondaryMatches(session, event.data.options.map((option) => option.teamId), rng);
    const problems = validateQueenDraw(event.data.options, event.data.secondaryMatches);
    if (problems.length) console.warn('Combat de la Reine : tirage incomplet —', problems.join(' '));
    event.data.stage = 'choosing';
    session.markDirty();
  } else if (!event.data.secondaryMatches && event.status === 'scheduled') {
    // Ancienne sauvegarde : propositions déjà tirées, combats secondaires ajoutés.
    event.data.secondaryMatches = generateSecondaryMatches(session, event.data.options.map((option) => option.teamId), rng);
    session.markDirty();
  }
  return { type: 'queen.available', count: event.data.options.length };
}

/** Choix définitif d'un adversaire parmi les propositions. */
export function selectOpponent(session, event, teamId) {
  if (event.typeId !== QUEEN_COMBAT || event.status !== 'scheduled') throw new Error('Aucun Combat de la Reine en attente.');
  if (event.data.selectedTeamId) throw new Error('L’adversaire de ce Combat de la Reine est déjà choisi.');
  const option = (event.data.options ?? []).find((candidate) => candidate.teamId === teamId);
  if (!option) throw new Error('Ce club ne fait pas partie des adversaires proposés.');
  event.data.selectedTeamId = teamId;
  event.data.stage = 'selected';
  session.markDirty();
  return option;
}

export function getSelectedOption(event) {
  return (event.data.options ?? []).find((option) => option.teamId === event.data.selectedTeamId) ?? null;
}

// --- Combat ---

/** Combat du joueur (camp A) contre l'adversaire choisi ; fatigue : QUEEN_COMBAT_CONFIG.fatigue. */
export function createQueenMatch(session, event) {
  if (!event.data.selectedTeamId) throw new Error('Choisissez d’abord un adversaire.');
  return createMatch({
    teamAId: session.player.teamId,
    teamBId: event.data.selectedTeamId,
    kind: QUEEN_COMBAT,
    fatigueRules: QUEEN_COMBAT_CONFIG.fatigue,
  });
}

/**
 * Après le combat (terminé) : récompense en cas de victoire seulement, état enregistré,
 * Combat de la Reine suivant planifié. Renvoie l'événement du carnet de bord.
 */
export function resolveQueenCombat(session, event, match, { auto = false, rng = Math.random } = {}) {
  if (event.status !== 'scheduled' || event.data.result) throw new Error('Ce Combat de la Reine est déjà terminé.');
  if (!match.isFinished) throw new Error('Le combat n’est pas terminé.');
  const playerId = session.player.teamId;
  const won = match.winnerId === playerId;
  const option = getSelectedOption(event);
  // Talents Courtisan / Champion de la Reine : récompense majorée pour chacun de ceux qui ont combattu.
  const bonus = won ? queenRewardBonus(playerParticipants(session, match)) : 0;
  const reward = won ? Math.round(option.reward * (1 + bonus)) : 0;
  if (reward) addResource(session, CURRENCY, reward);
  const side = match.sideOf(playerId);
  event.data.result = {
    won,
    roundsFor: side === 'A' ? match.scoreA : match.scoreB,
    roundsAgainst: side === 'A' ? match.scoreB : match.scoreA,
    reward,
  };
  // Les autres Combats de la Reine du jour, après celui du joueur (hors carnet de bord).
  simulateSecondaryMatches(session, event, rng);
  event.data.stage = 'resolved';
  event.status = 'done';
  event.outcome = won ? 'won' : 'lost';
  // Succès : Au plaisir de la Reine, Un œil sur le Monde (étoiles de l'adversaire au tirage).
  recordQueenResult(session, { won, opponentStars: option.stars ?? getClubStars(session, option.teamId) });
  scheduleQueenCombat(session, event.day, rng);
  session.markDirty();
  return { type: 'queen.result', opponentTeamId: option.teamId, ...event.data.result, auto };
}

/**
 * Journée passée sans que le joueur ait combattu (avance rapide du Module Admin) :
 * le Combat de la Reine est manqué — aucun combat, aucune récompense, aucune fatigue.
 */
export function missQueenCombat(session, event, rng = Math.random) {
  // Les autres Combats de la Reine déjà tirés ont lieu sans le joueur (hors carnet de bord).
  simulateSecondaryMatches(session, event, rng);
  event.data.stage = 'missed';
  event.status = 'done';
  event.outcome = 'missed';
  scheduleQueenCombat(session, event.day, rng);
  session.markDirty();
  return { type: 'queen.missed' };
}

/** Combat de la Reine entièrement automatique (tests, outils) : choix imposé puis simulation. */
export function playQueenCombatAutomatically(session, event, teamId, rng = Math.random) {
  selectOpponent(session, event, teamId);
  const match = createQueenMatch(session, event);
  const played = simulateMatch(session, { teamAId: match.teamAId, teamBId: match.teamBId, kind: match.kind, fatigueRules: match.fatigueRules }, createArena(), rng);
  return { match: played, report: resolveQueenCombat(session, event, played, { auto: true, rng }) };
}
