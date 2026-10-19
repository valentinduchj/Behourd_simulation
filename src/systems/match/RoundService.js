import { MATCH_RULES } from '../../data/matchRules.js';
import { calculateFighterLevel } from '../fighters/ratings.js';
import { applyEngineRoundFatigue, applyRoundFatigue, getMatchFatigue } from '../fighters/FatigueService.js';
import { recordRound } from '../fighters/FighterRecordService.js';
import { recordTakedown } from '../fighters/CareerStatsService.js';
import { createCombatUnit, rollAIEndurance } from '../../combat/engine/CombatUnit.js';
import { simulateRound } from '../../combat/engine/CombatManager.js';
import { createArena } from '../../combat/Arena.js';
import { COMBAT_RULES } from '../../data/combatRules.js';
import { isCaptain } from '../roster/CaptainService.js';
import { daysSinceReturn } from '../expeditions/journeys.js';
import { expireRoundEffects, getRoundEffects } from '../items/CombatEffectService.js';
import { getAIProfile } from '../../data/aiProfiles.js';
import { isFighterAvailable } from '../talents/StudyService.js';
import { canHaveTalents } from '../talents/TalentService.js';
import { combatEffectsOf, squadFatigueFactor } from '../talents/TalentEffects.js';
import { classEfficiencyFactor, getCurrentSeason } from '../climate/ClimateService.js';

// Résolution d'une manche, indépendante de l'interface :
//   calculateLineupLevel() → calculateWinProbability() → randomizeResult()
//   → applyRoundFatigue() (FatigueService) → recordRound() (FighterRecordService)
//
// Le résultat dépend UNIQUEMENT du niveau des combattants réellement engagés dans la
// manche (moyenne des 5). Le niveau du club (8 meilleurs) n'intervient pas ici : il ne
// sert qu'à l'affichage. Placement, spécialités et statistiques individuelles n'ont pas
// encore d'influence (règles à définir).

/**
 * Combattants réellement engagés dans une manche : un combattant en étude au Scriptorium n'entre
 * jamais dans la lice, même si une interface l'a laissé dans la composition.
 */
function engagedFighters(session, ids) {
  return ids.map((id) => session.getFighter(id)).filter((fighter) => fighter && isFighterAvailable(session, fighter));
}

/**
 * Niveau d'une composition de manche : moyenne des niveaux des combattants engagés. Avec une
 * saison de l'année (`{ season }`), chaque niveau est pondéré par l'efficacité saisonnière de sa
 * classe (Hastier en été, Runner en automne : × 0,9) — même règle que dans le moteur de combat.
 */
export function calculateLineupLevel(fighters, { season = null } = {}) {
  if (!fighters.length) return 0;
  const factor = (fighter) => (season ? classEfficiencyFactor(fighter.specialtyId, season) : 1);
  return fighters.reduce((sum, fighter) => sum + calculateFighterLevel(fighter) * factor(fighter), 0) / fighters.length;
}

/** Probabilité que A gagne la manche : 50 % ± 2 % par point d'écart de niveau, bornée entre 0 et 1. */
export function calculateWinProbability(levelA, levelB, rules = MATCH_RULES.winProbability) {
  const probability = rules.base + (levelA - levelB) * rules.perLevelPoint;
  return Math.max(0, Math.min(1, probability));
}

export function randomizeResult(probabilityA, rng = Math.random) {
  return rng() < probabilityA ? 'A' : 'B';
}

/**
 * Dispute une manche. lineup : { fightersA, fightersB, placementsA, placementsB }.
 * Renvoie la manche (sans modifier le score du combat : voir MatchService.playRound).
 */
export function resolveRound(session, match, lineup, rng = Math.random) {
  const fightersA = engagedFighters(session, lineup.fightersA);
  const fightersB = engagedFighters(session, lineup.fightersB);
  // Niveaux effectifs du jour : la saison pèse sur les combats simulés comme sur les autres.
  const season = getCurrentSeason(session).id;
  const levelA = calculateLineupLevel(fightersA, { season });
  const levelB = calculateLineupLevel(fightersB, { season });
  const probabilityA = calculateWinProbability(levelA, levelB);
  const winner = randomizeResult(probabilityA, rng);

  const round = {
    number: match.currentRound,
    fightersTeamA: fightersA.map((f) => f.id),
    fightersTeamB: fightersB.map((f) => f.id),
    placementsTeamA: (lineup.placementsA ?? []).map((p) => ({ ...p })),
    placementsTeamB: (lineup.placementsB ?? []).map((p) => ({ ...p })),
    levelA,
    levelB,
    probabilityA,
    winner,
    winnerTeamId: winner === 'A' ? match.teamAId : match.teamBId,
    fatigueApplied: [],
  };
  applyRoundFatigue(session, match, round, rng);
  recordRound(session, round);
  return round;
}

// --- Combat Joueur contre IA (src/combat/engine/) ---

/**
 * Fatigue fictive de départ des combattants de l'IA pour ce combat (avant la première manche) :
 * tirée une fois par combattant entre aiStartingFatigue.min et max, puis cumulée comme celle du
 * joueur. Sans effet sur un combattant qui a déjà une fatigue dans ce combat. Renvoie le nombre tiré.
 */
export function ensureAIStartingFatigue(match, fighters, rng = Math.random, rules = COMBAT_RULES) {
  // Combat isolé (Coupe de France) : les deux compagnies partent reposées.
  if (match.isolated) return 0;
  const { min, max } = rules.aiStartingFatigue;
  let count = 0;
  for (const fighter of fighters) {
    if (match.localFatigue[fighter.id] !== undefined) continue;
    match.localFatigue[fighter.id] = min + Math.floor(rng() * (max - min + 1));
    count++;
  }
  return count;
}

/** Endurance de combat d'un combattant de l'IA : tirée une fois pour tout le combat, puis réutilisée. */
export function getAIEndurance(match, fighter, rng = Math.random) {
  if (match.aiEndurance[fighter.id] === undefined) match.aiEndurance[fighter.id] = rollAIEndurance(fighter, rng);
  return match.aiEndurance[fighter.id];
}

/**
 * Manche du joueur (camp A) contre l'IA (camp B), simulée par le moteur de combat :
 * déplacements, cibles, attaques, KO. lineup : { fightersA, fightersB, placementsA, placementsB }.
 * Un KO ne vaut que pour la manche : à la suivante, tous retrouvent leurs PV et peuvent être
 * alignés (COMBAT_RULES.knockoutLastsWholeMatch = true : KO jusqu'à la fin du combat,
 * match.knockedOut). Fatigue : tour par tour dans la manche (v0.66), puis récupération entre
 * deux manches (FatigueService.applyEngineRoundFatigue). Palmarès : règles habituelles.
 */
export function resolveCombatRound(session, match, lineup, rng = Math.random) {
  const fightersA = engagedFighters(session, lineup.fightersA);
  const fightersB = engagedFighters(session, lineup.fightersB);
  // Combattant de l'IA aligné sans fatigue de départ (l'écran la tire dès que l'adversaire est connu).
  ensureAIStartingFatigue(match, fightersB, rng);
  const tileOf = (placements, id) => placements.find((p) => p.fighterId === id);
  // Talents : lieu du match (camp du joueur), manche décisive, survies déjà utilisées dans ce combat.
  const venue = match.location === 'HOME' ? 'home' : match.location === 'AWAY' ? 'away' : null;
  const decisive = match.scoreA === MATCH_RULES.roundsToWin - 1 && match.scoreB === MATCH_RULES.roundsToWin - 1;
  // Saison de l'année : efficacité des classes et talents saisonniers actifs (ClimateService).
  const season = getCurrentSeason(session).id;
  const talentsOf = (fighter) => ({
    talentEffects: canHaveTalents(session, fighter) ? combatEffectsOf(fighter, { season, daysSinceReturn: daysSinceReturn(session, fighter) }) : [],
    season,
    decisive,
    lastStandUsed: match.talentUses?.[fighter.id]?.lastStand === true,
  });
  // Légende vivante : toute la compagnie (son effectif du combat) gagne moins de fatigue.
  const squadA = (match.squadIds?.length ? match.squadIds : fightersA.map((f) => f.id)).map((id) => session.getFighter(id)).filter(Boolean);
  const fatigueGainA = squadFatigueFactor(squadA.filter((fighter) => canHaveTalents(session, fighter)));
  const units = [
    ...fightersA.map((fighter) => createCombatUnit({
      fighter, side: 'A', tile: tileOf(lineup.placementsA, fighter.id), fatigue: getMatchFatigue(session, match, fighter),
      isCaptain: isCaptain(session, fighter),
      // Effets temporaires valables pour cette manche (ex. Hypocras), lus au moment du calcul.
      effects: getRoundEffects(session, fighter.id, match),
      ...talentsOf(fighter),
      venue,
      fatigueGain: fatigueGainA,
    })),
    ...fightersB.map((fighter) => createCombatUnit({
      fighter, side: 'B', tile: tileOf(lineup.placementsB, fighter.id), fatigue: getMatchFatigue(session, match, fighter),
      endurance: getAIEndurance(match, fighter, rng), isCaptain: isCaptain(session, fighter),
      ...talentsOf(fighter),
    })),
  ];
  // Mises à terre : chaque KO est attribué à l'auteur du coup fatal au moment où le moteur le
  // constate (combattants du joueur seulement ; CareerStatsService).
  const takedowns = [];
  const onKnockout = (attackerId, targetId) => {
    // Combat isolé (Coupe de France) : la Coupe tient ses propres statistiques.
    if (match.isolated) return;
    const entry = recordTakedown(session, attackerId, targetId);
    if (entry) takedowns.push(entry);
  };
  // Comportement de l'équipe adverse tiré pour ce combat (camp B) ; le joueur garde l'IA habituelle.
  const profile = match.aiProfileId ? getAIProfile(match.aiProfileId) : null;
  const simulation = simulateRound({ arena: lineup.arena ?? createArena(), units, rng, onKnockout, aiConfigBySide: profile ? { B: profile.fighterAI } : null });
  // Inébranlable : sa survie à 1 PV ne vaut qu'une fois par combat.
  for (const { unitId, per } of simulation.lastStands ?? []) {
    if (per !== 'match') continue;
    match.talentUses = match.talentUses ?? {};
    match.talentUses[unitId] = { ...(match.talentUses[unitId] ?? {}), lastStand: true };
  }
  // KO de la manche seulement (règle par défaut) ; sinon, indisponibles jusqu'à la fin du combat.
  if (COMBAT_RULES.knockoutLastsWholeMatch) {
    for (const id of simulation.knockedOut) if (!match.knockedOut.includes(id)) match.knockedOut.push(id);
  }

  const round = {
    number: match.currentRound,
    fightersTeamA: fightersA.map((f) => f.id),
    fightersTeamB: fightersB.map((f) => f.id),
    placementsTeamA: (lineup.placementsA ?? []).map((p) => ({ ...p })),
    placementsTeamB: (lineup.placementsB ?? []).map((p) => ({ ...p })),
    levelA: calculateLineupLevel(fightersA),
    levelB: calculateLineupLevel(fightersB),
    probabilityA: null,
    winner: simulation.winnerSide,
    winnerTeamId: simulation.winnerSide === 'A' ? match.teamAId : match.teamBId,
    fatigueApplied: [],
    simulation,
    // Mises à terre de la manche (et médailles débloquées) : [{ fighterId, targetId, takedowns, newMedals }].
    takedowns,
  };
  // Fatigue (v0.66) : celle de la fin de manche, tour par tour ; puis, si le combat continue,
  // un peu de récupération pour tout l'effectif avant la manche suivante.
  const scoreAfter = simulation.winnerSide === 'A' ? match.scoreA + 1 : match.scoreB + 1;
  const continues = scoreAfter < MATCH_RULES.roundsToWin;
  const inRound = new Set([...round.fightersTeamA, ...round.fightersTeamB]);
  const benchIds = {
    A: squadA.map((f) => f.id).filter((id) => !inRound.has(id)),
    // Adversaire : ceux qui ont déjà une fatigue suivie dans ce combat (son effectif rencontré).
    B: Object.keys(match.localFatigue).filter((id) => !inRound.has(id) && session.getFighter(id)?.teamId === match.teamBId),
  };
  applyEngineRoundFatigue(session, match, round, { continues, benchIds });
  // Fin de la manche : les effets « prochaine manche » (ex. Hypocras) disparaissent.
  round.expiredEffects = expireRoundEffects(session, match, round.number);
  if (!match.isolated) recordRound(session, round);
  return round;
}
