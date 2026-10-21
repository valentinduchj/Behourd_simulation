import { AI_PROFILES, getAIProfile } from '../../data/aiProfiles.js';
import { COMBAT_RULES } from '../../data/combatRules.js';
import { MATCH_RULES } from '../../data/matchRules.js';
import { createArena } from '../../combat/Arena.js';
import { PlacementManager } from '../../combat/engine/PlacementManager.js';
import { placeAutomatically } from '../../combat/engine/AIPlacementStrategy.js';
import { createCombatUnit } from '../../combat/engine/CombatUnit.js';
import { simulateRound } from '../../combat/engine/CombatManager.js';
import { createRandomTeam } from '../game/teamFactory.js';
import { calculateClubLevel } from '../fighters/ratings.js';
import { createRng } from '../../utils/random.js';
import { selectLineup } from './LineupStrategies.js';
import { combatEffectsOf } from '../talents/TalentEffects.js';

// Banc d'essai des IA de combat : de vrais combats simulés de bout en bout (manches gagnantes,
// composition, placement alterné, moteur de combat, fatigue entre les manches, KO), entre deux
// profils (data/aiProfiles.js), sans interface et sans toucher à aucune partie.
//
// Équité : chaque rencontre se joue deux fois, effectifs échangés (le même club passe d'un
// profil à l'autre), de sorte que seule la stratégie fait la différence. Tout est tiré d'une
// graine : un même banc d'essai donne toujours les mêmes résultats.

const SIDES = ['A', 'B'];
const other = (side) => (side === 'A' ? 'B' : 'A');

/**
 * Un combat complet entre deux effectifs. sides : { A: { profile, fighters }, B: { … } }.
 * Renvoie { winner: 'A' | 'B', score: { A, B }, rounds: [{ winner, ticks, reason, lineups, knockedOut,
 * stats }], ticks }. Les effectifs ne sont jamais modifiés (fatigue et KO propres au combat).
 * fatigueStart (facultatif) : Map id → fatigue de départ.
 */
export function playBenchMatch({ sides, rng, rules = COMBAT_RULES, matchRules = MATCH_RULES, arena = createArena(), fatigueStart = null, keepSimulations = false, season = null, withTalents = false }) {
  const fatigue = new Map(fatigueStart ?? []);
  const knockedOut = new Set();
  const score = { A: 0, B: 0 };
  const rounds = [];
  const fighterById = new Map(SIDES.flatMap((side) => sides[side].fighters.map((f) => [f.id, f])));
  const fatigueOf = (fighter) => fatigue.get(fighter.id) ?? 0;
  // withTalents (v1.2.1, Coupe de France) : talents de combat des combattants (clubs de l'IA).
  const unitOf = (fighter, side = 'A', tile = { x: 0, y: 0 }) => createCombatUnit({
    fighter, side, tile, fatigue: fatigueOf(fighter), isCaptain: fighter.isCaptain === true, rules,
    ...(withTalents ? { talentEffects: combatEffectsOf(fighter, { season }), season } : {}),
  });
  // Premier à placer : le club le plus fort, puis chacun son tour (règle du jeu).
  const levelA = calculateClubLevel(sides.A.fighters);
  const levelB = calculateClubLevel(sides.B.fighters);
  let firstSide = levelA > levelB ? 'A' : levelB > levelA ? 'B' : rules.placementOrder.tieGoesTo;

  while (score.A < matchRules.roundsToWin && score.B < matchRules.roundsToWin && rounds.length < 9) {
    const available = (side) => sides[side].fighters.filter((f) => !knockedOut.has(f.id));
    const lineups = {};
    for (const side of SIDES) {
      lineups[side] = selectLineup(sides[side].profile.lineup, {
        formation: sides[side].profile.formation,
        own: available(side), opponents: available(other(side)), size: matchRules.fightersPerRound,
        fatigueOf, unitOf: (f) => unitOf(f), score: { own: score[side], opponent: score[other(side)] }, rng,
      });
    }
    const manager = new PlacementManager({ arena, fighters: { A: lineups.A.map((f) => f.id), B: lineups.B.map((f) => f.id) }, firstSide });
    const classOf = (id) => fighterById.get(id)?.specialtyId;
    const placementUnit = (id) => unitOf(fighterById.get(id));
    let guard = 0;
    while (!manager.isComplete && guard++ < 40) {
      const side = manager.currentSide;
      const result = placeAutomatically({ manager, side, classOf, rng, config: sides[side].profile.placement, unitOf: placementUnit });
      if (!result.ok) break;
    }
    const units = SIDES.flatMap((side) => lineups[side]
      .filter((fighter) => manager.placements[side].has(fighter.id))
      .map((fighter) => unitOf(fighter, side, manager.placements[side].get(fighter.id))));
    // Mises à terre déjà comptées dans le combat (plafond par combat, rules.knockoutCredit).
    const knockoutsBefore = {};
    for (const r of rounds) for (const [id, s] of Object.entries(r.stats ?? {})) knockoutsBefore[id] = (knockoutsBefore[id] ?? 0) + (s.knockouts ?? 0);
    const simulation = simulateRound({
      arena, units, rng, rules, knockoutsBefore,
      aiConfigBySide: { A: sides.A.profile.fighterAI, B: sides.B.profile.fighterAI },
    });
    score[simulation.winnerSide] += 1;
    rounds.push({
      winner: simulation.winnerSide, ticks: simulation.ticks, reason: simulation.reason,
      lineups: { A: lineups.A.map((f) => f.id), B: lineups.B.map((f) => f.id) },
      knockedOut: simulation.knockedOut, stats: simulation.stats, lulls: simulation.lulls,
      // Détail complet de la manche (événements), pour les analyses du banc d'essai.
      ...(keepSimulations ? { simulation } : {}),
      // Fatigue de chacun au début et à la fin de la manche (suivi, réglages).
      fatigue: Object.fromEntries(simulation.final.map((u) => [u.id, { start: simulation.initial.find((i) => i.id === u.id)?.fatigue ?? 0, end: u.fatigue, ko: u.status === 'ko' }])),
    });
    // Fatigue (v0.66, règle du jeu) : celle de la fin de manche, tour par tour ; puis, si le
    // combat continue, récupération de tout l'effectif avant la manche suivante.
    for (const unit of simulation.final) fatigue.set(unit.id, unit.fatigue);
    if (score.A < matchRules.roundsToWin && score.B < matchRules.roundsToWin) {
      const { aligned, bench } = rules.roundFatigue.betweenRounds;
      for (const side of SIDES) {
        const played = new Set(lineups[side].map((f) => f.id));
        for (const fighter of sides[side].fighters) {
          if (!fatigue.has(fighter.id) && !played.has(fighter.id)) continue;
          fatigue.set(fighter.id, Math.max(0, fatigueOf(fighter) - (played.has(fighter.id) ? aligned : bench)));
        }
      }
    }
    if (rules.knockoutLastsWholeMatch) for (const id of simulation.knockedOut) knockedOut.add(id);
    if (rules.placementOrder.alternateEachRound) firstSide = other(firstSide);
  }
  const winner = score.A > score.B ? 'A' : 'B';
  return { winner, score, rounds, ticks: rounds.reduce((sum, r) => sum + r.ticks, 0) };
}

/** Effectif de test : un club généré (graine), pour opposer deux profils à armes égales. */
export function createBenchRoster(seed) {
  return createRandomTeam({ rng: createRng(`banc:${seed}`) }).fighters;
}

/**
 * Rencontre équitable entre deux profils : deux combats sur les mêmes effectifs, échangés.
 * Renvoie les deux résultats du point de vue du profil `first`.
 */
export function playBenchPair({ first, second, seed, rules, matchRules }) {
  const rosterX = createBenchRoster(`${seed}:x`);
  const rosterY = createBenchRoster(`${seed}:y`);
  const games = [
    { A: { profile: first, fighters: rosterX }, B: { profile: second, fighters: rosterY } },
    { A: { profile: second, fighters: rosterX }, B: { profile: first, fighters: rosterY } },
  ];
  return games.map((sides, i) => {
    const result = playBenchMatch({ sides, rng: createRng(`banc:${seed}:${i}`), rules, matchRules });
    const firstSide = i === 0 ? 'A' : 'B';
    return {
      won: result.winner === firstSide,
      roundsWon: result.score[firstSide],
      roundsLost: result.score[other(firstSide)],
      rounds: result.rounds.length,
      ticks: result.ticks,
    };
  });
}

/**
 * Tournoi complet (chaque profil contre chacun des autres) : `pairs` rencontres équitables
 * par duel de profils, soit 2 × pairs combats. Asynchrone (rend la main entre deux paquets ;
 * onProgress(done, total)). Renvoie { profiles, matrix, totals }.
 *   matrix[i][j] : { matches, wins, rounds, roundsWon } du profil i contre le profil j
 *   totals[i]    : { matches, wins, winRate, roundsWon, rounds, avgTicks }
 */
export async function runAIBench({ profiles = AI_PROFILES, pairs = 10, seed = 'banc', onProgress = null, yieldEvery = 4, rules, matchRules } = {}) {
  const list = profiles.map((p) => (typeof p === 'string' ? getAIProfile(p) : p));
  const matrix = list.map(() => list.map(() => ({ matches: 0, wins: 0, rounds: 0, roundsWon: 0, ticks: 0 })));
  const duels = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) duels.push([i, j]);
  const total = duels.length * pairs;
  let done = 0;
  for (const [i, j] of duels) {
    for (let k = 0; k < pairs; k++) {
      for (const game of playBenchPair({ first: list[i], second: list[j], seed: `${seed}:${list[i].id}:${list[j].id}:${k}`, rules, matchRules })) {
        const a = matrix[i][j];
        const b = matrix[j][i];
        a.matches += 1; b.matches += 1;
        if (game.won) a.wins += 1; else b.wins += 1;
        a.rounds += game.rounds; b.rounds += game.rounds;
        a.roundsWon += game.roundsWon; b.roundsWon += game.roundsLost;
        a.ticks += game.ticks; b.ticks += game.ticks;
      }
      done += 1;
      onProgress?.(done, total);
      if (yieldEvery && done % yieldEvery === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  const totals = list.map((_, i) => {
    const row = matrix[i].filter((_, j) => j !== i);
    const matches = row.reduce((s, c) => s + c.matches, 0);
    const wins = row.reduce((s, c) => s + c.wins, 0);
    const rounds = row.reduce((s, c) => s + c.rounds, 0);
    return {
      matches, wins, winRate: matches ? wins / matches : 0,
      roundsWon: row.reduce((s, c) => s + c.roundsWon, 0), rounds,
      avgTicks: rounds ? row.reduce((s, c) => s + c.ticks, 0) / rounds : 0,
    };
  });
  return { profiles: list, matrix, totals };
}

/** Marge d'erreur à 95 % d'un taux de victoire (± points, approximation normale). */
export function winRateMargin(wins, matches) {
  if (!matches) return 0;
  const p = wins / matches;
  return 1.96 * Math.sqrt((p * (1 - p)) / matches);
}
