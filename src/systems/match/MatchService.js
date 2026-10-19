import { MATCH_RULES } from '../../data/matchRules.js';
import { Match } from '../../models/Match.js';
import { ofClub } from '../../utils/format.js';
import { calculateFighterLevel, calculateClubLevel } from '../fighters/ratings.js';
import { COMBAT_RULES } from '../../data/combatRules.js';
import { getMatchFatigue, applyMatchSoreness } from '../fighters/FatigueService.js';
import { recordMatch } from '../fighters/FighterRecordService.js';
import { recordFinishedMatch, recordPlayedRound } from '../achievements/AchievementService.js';
import { resolveRound as resolveRoundOnly, resolveCombatRound } from './RoundService.js';
import { isFighterAvailable, awayReason } from '../talents/StudyService.js';

// Déroulement d'un combat (manches gagnantes), indépendant de l'interface. Le même
// moteur sert au combat du joueur et aux combats entre clubs de l'IA ; seule la
// sélection diffère (manuelle ou automatique).
//
//   playRound() → RoundService.resolveRound() → score → fin du combat → palmarès

export { calculateWinProbability, calculateLineupLevel, randomizeResult } from './RoundService.js';
export { getMatchFatigue } from '../fighters/FatigueService.js';

export function createMatch({ teamAId, teamBId, matchday = null, kind, fatigueRules = null, isolated = false, playerFatigue = undefined }) {
  return new Match({ teamAId, teamBId, matchday, kind, fatigueRules, isolated, playerFatigue });
}

/**
 * Dispute la prochaine manche et met à jour le combat (score, vainqueur, palmarès).
 * lineup : { fightersA, fightersB, placementsA, placementsB }
 */
export function resolveRound(session, match, lineup, rng = Math.random, resolver = resolveRoundOnly) {
  if (match.isFinished) throw new Error('Le combat est déjà terminé.');
  const round = resolver(session, match, lineup, rng);

  if (round.winner === 'A') match.scoreA += 1;
  else match.scoreB += 1;
  round.scoreA = match.scoreA;
  round.scoreB = match.scoreB;
  round.result = `Manche ${round.number} : victoire ${ofClub(session.getTeam(round.winnerTeamId)?.name ?? '?')} (${match.scoreA} – ${match.scoreB})`;
  match.rounds.push(round);
  // Succès : manche jouée dans la Lice (moteur de combat), puis combat terminé.
  if (round.simulation) recordPlayedRound(session, match, round);

  if (match.scoreA >= MATCH_RULES.roundsToWin) match.winnerId = match.teamAId;
  else if (match.scoreB >= MATCH_RULES.roundsToWin) match.winnerId = match.teamBId;
  // Combat isolé (Coupe de France) : aucun effet sur le palmarès des combattants.
  if (match.isFinished && !match.isolated) recordMatch(session, match);
  // Courbatures du lendemain pour les combattants du joueur (v0.75 ; vraie fatigue seulement).
  if (match.isFinished) applyMatchSoreness(session, match);
  if (match.isFinished) recordFinishedMatch(session, match);
  session.markDirty();
  return round;
}

// --- Sélection automatique (clubs de l'IA, combats simulés) ---

/** Effectif engagé : les meilleurs combattants DISPONIBLES du club (pas en étude), dans la limite autorisée. */
export function autoSelectSquad(session, teamId, size = MATCH_RULES.maxSquadSize) {
  return session.getFightersOfTeam(teamId).filter((fighter) => isFighterAvailable(session, fighter))
    .sort((a, b) => calculateFighterLevel(b) - calculateFighterLevel(a))
    .slice(0, size);
}

/** Composition d'une manche : les moins fatigués de l'effectif (hors KO du combat), puis les meilleurs. */
export function autoSelectLineup(session, match, squad, size = MATCH_RULES.fightersPerRound) {
  return [...squad]
    .filter((fighter) => !match.isKnockedOut?.(fighter.id))
    .sort((a, b) => getMatchFatigue(session, match, a) - getMatchFatigue(session, match, b)
      || calculateFighterLevel(b) - calculateFighterLevel(a))
    .slice(0, size);
}

/** Placement par défaut sur les emplacements du camp. */
export function autoPlacements(arena, sideIndex, fighters) {
  const tiles = arena.getDefaultTiles(sideIndex, fighters.length);
  return fighters.map((fighter, i) => ({ fighterId: fighter.id, ...tiles[i] }));
}

/** Sélection et placement automatiques d'un camp pour la prochaine manche. */
export function autoLineupFor(session, match, arena, side, squad) {
  const fighters = autoSelectLineup(session, match, squad);
  return { fighters: fighters.map((f) => f.id), placements: autoPlacements(arena, side === 'A' ? 0 : 1, fighters) };
}

/**
 * Manche du combat du joueur contre l'IA (composition et placement alterné) : simulée par le
 * moteur de combat (déplacements, cibles, dégâts, KO). Les combats IA contre IA gardent leur
 * simulation (resolveRound). lineup : { fightersA, fightersB, placementsA, placementsB, arena }.
 */
export function resolvePlayerRound(session, match, lineup, rng = Math.random) {
  return resolveRound(session, match, lineup, rng, resolveCombatRound);
}

/** Alias historique. */
export const playPlayerMatch = resolvePlayerRound;

/**
 * Camp qui place en premier pour la manche en cours ('A' : joueur, 'B' : IA) : à la 1re manche,
 * l'équipe au niveau de club le plus élevé (égalité : le joueur), retenue pour tout le combat ;
 * ensuite, alternance à chaque manche. Renvoie { side, reason: 'level' | 'alternate' }.
 */
export function getFirstPlacingSide(session, match, rules = COMBAT_RULES) {
  const order = rules.placementOrder;
  if (!match.firstPlacingSide) {
    const levelA = calculateClubLevel(session.getFightersOfTeam(match.teamAId));
    const levelB = calculateClubLevel(session.getFightersOfTeam(match.teamBId));
    match.firstPlacingSide = levelA > levelB ? 'A' : levelB > levelA ? 'B' : order.tieGoesTo;
  }
  const roundIndex = match.rounds.length;
  const flip = order.alternateEachRound && roundIndex % 2 === 1;
  const side = flip ? (match.firstPlacingSide === 'A' ? 'B' : 'A') : match.firstPlacingSide;
  return { side, reason: roundIndex === 0 ? 'level' : 'alternate' };
}

/**
 * Combattants encore disponibles pour une manche : les KO du combat sont exclus, et, avec la
 * partie (`session`), ceux qui sont en étude au Scriptorium.
 */
export function getAvailableFighters(match, fighters, session = null) {
  return fighters.filter((fighter) => !match.isKnockedOut(fighter.id) && (!session || isFighterAvailable(session, fighter)));
}

/** Le combattant peut-il être engagé dans un combat ? { ok, reason } (étude au Scriptorium). */
export function canSelectForMatch(session, fighter) {
  if (!isFighterAvailable(session, fighter)) return { ok: false, reason: awayReason(session, fighter) };
  return { ok: true, reason: null };
}

/**
 * Combattants du joueur qui ont réellement combattu dans ce combat (au moins une manche) :
 * talents de récompense (Héros local, Courtisan, Champion de la Reine).
 */
export function playerParticipants(session, match) {
  const side = match.sideOf(session.player.teamId);
  if (!side) return [];
  const ids = new Set(match.rounds.flatMap((round) => round[`fightersTeam${side}`] ?? []));
  return [...ids].map((id) => session.getFighter(id)).filter(Boolean);
}

/** Combat entre clubs de l'IA (ou combat du joueur en avance rapide), entièrement automatique. */
export function simulateAIMatch(session, fixture, arena, rng = Math.random) {
  return simulateMatch(session, fixture, arena, rng);
}

/** Combat entièrement automatique, avec le même moteur que le combat du joueur. */
export function simulateMatch(session, { teamAId, teamBId, matchday = null, kind, fatigueRules = null }, arena, rng = Math.random) {
  const match = createMatch({ teamAId, teamBId, matchday, kind, fatigueRules });
  const squadA = autoSelectSquad(session, teamAId);
  const squadB = autoSelectSquad(session, teamBId);
  // Effectif engagé du camp A (talent Légende vivante, si c'est la compagnie du joueur).
  match.squadIds = squadA.map((fighter) => fighter.id);
  while (!match.isFinished) {
    const a = autoLineupFor(session, match, arena, 'A', squadA);
    const b = autoLineupFor(session, match, arena, 'B', squadB);
    resolveRound(session, match, { fightersA: a.fighters, fightersB: b.fighters, placementsA: a.placements, placementsB: b.placements }, rng);
  }
  return match;
}
