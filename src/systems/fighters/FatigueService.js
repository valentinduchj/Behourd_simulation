import { MATCH_RULES } from '../../data/matchRules.js';
import { COMBAT_RULES } from '../../data/combatRules.js';
import { randInt } from '../../utils/random.js';
import { getStat, worsenStat } from './stats.js';
import { FATIGUE_RULES } from '../../data/fatigue.js';
import { fatigueCapOf, fatigueEffortFactor, fatigueRecoveryFactor, fatigueThresholdShift, squadFatigueFactor } from '../talents/TalentEffects.js';

// Fatigue : règles de jeu (gain après une manche) et indicateur visuel, sans rendu.
// Les interfaces reçoivent une INTENSITÉ DE COULEUR (0 à 1) et ne connaissent pas la fatigue.

const MAX_FATIGUE = 100;

/** Intensité des couleurs d'un combattant : 1 − fatigue / 100 (100 → noir et blanc, 0 → couleurs normales). */
export function getColorIntensity(fatigue) {
  const value = Math.max(0, Math.min(MAX_FATIGUE, Number(fatigue) || 0));
  return 1 - value / MAX_FATIGUE;
}

/** Intensité des couleurs d'un combattant d'après sa fatigue actuelle. */
export function getFighterColorIntensity(fighter) {
  return getColorIntensity(getStat(fighter, 'fatigue'));
}

// Combattants du joueur : leur vraie fatigue, sauf dans un combat qui la suit seulement le temps du
// combat (match.playerFatigue === false). Coupe de France (v0.81.2) : vraie fatigue pendant le combat,
// remise à 0 au début de chaque combat (FrenchCupManager.createCupPlayerMatch). Adversaires : toujours
// une fatigue suivie le temps du combat.
function isPlayerFighter(session, fighter, match = null) {
  const realFatigue = match ? (match.playerFatigue ?? !match.isolated) : true;
  return realFatigue && fighter.teamId === session.player.teamId;
}

/**
 * Fatigue d'un combattant pendant un combat. Pour le joueur, c'est sa vraie
 * statistique ; pour l'IA (données statiques), une valeur suivie le temps du combat.
 */
export function getMatchFatigue(session, match, fighter) {
  if (isPlayerFighter(session, fighter, match)) return getStat(fighter, 'fatigue');
  if (match?.isolated) return match.localFatigue[fighter.id] ?? 0; // adversaires de Coupe : partent reposés
  return match.localFatigue[fighter.id] ?? getStat(fighter, 'fatigue');
}

/**
 * Fatigue au forfait des manches SIMULÉES (combats entre clubs de l'IA, avance rapide) :
 * vainqueurs 20–50, vaincus 50–60 (max 100), ou la règle propre au type de combat
 * (match.fatigueRules). Les manches disputées dans la lice suivent la fatigue tour par tour
 * (applyEngineRoundFatigue). Remplit round.fatigueApplied.
 */
export function applyRoundFatigue(session, match, round, rng = Math.random) {
  const { roundWinner, roundLoser } = match.fatigueRules ?? MATCH_RULES.fatigue;
  round.fatigueApplied = [];
  for (const side of ['A', 'B']) {
    const range = round.winner === side ? roundWinner : roundLoser;
    // Talent Légende vivante : la compagnie dont l'effectif engagé le compte reçoit moins de fatigue.
    const squad = side === 'A' && match.squadIds?.length ? match.squadIds : round[`fightersTeam${side}`];
    const squadFactor = squadFatigueFactor(squad.map((id) => session.getFighter(id)).filter(Boolean));
    for (const fighterId of round[`fightersTeam${side}`]) {
      const fighter = session.getFighter(fighterId);
      if (!fighter) continue;
      const before = getMatchFatigue(session, match, fighter);
      // Talents : Souffle long (effort réduit), Légende vivante (effectif) ; Bon vivant : jamais plus de 90.
      const drawn = randInt(rng, range.min, range.max);
      let amount = Math.max(0, Math.round(drawn * squadFactor * fatigueEffortFactor(fighter)));
      const cap = fatigueCapOf(fighter);
      if (cap !== null) amount = Math.max(0, Math.min(amount, cap - before));
      if (isPlayerFighter(session, fighter, match)) worsenStat(fighter, 'fatigue', amount);
      else match.localFatigue[fighter.id] = Math.min(MAX_FATIGUE, before + amount);
      const after = getMatchFatigue(session, match, fighter);
      round.fatigueApplied.push({ fighterId, side, amount: after - before, before, after });
    }
  }
}

// --- États de fatigue et courbatures (v0.75, data/fatigue.js) ---

/**
 * État de fatigue d'un combattant : { id: 'rested' | 'tired' | 'exhausted', label, from }.
 * `value` : fatigue à juger (par défaut, sa fatigue actuelle). Sang-froid décale les seuils.
 */
export function getFatigueState(fighter, value = getStat(fighter, 'fatigue'), rules = FATIGUE_RULES) {
  const shift = fatigueThresholdShift(fighter);
  const fatigue = Number(value) || 0;
  let state = rules.states[0];
  for (const candidate of rules.states) if (candidate.from === 0 || fatigue >= candidate.from + shift) state = candidate;
  return { ...state, from: state.from === 0 ? 0 : state.from + shift };
}

/** Seuil d'un état, sans talent (« 50 », « 70 »). */
export function fatigueStateFrom(id, rules = FATIGUE_RULES) {
  return rules.states.find((state) => state.id === id)?.from ?? 0;
}

/** Ce que coûte un état, en une phrase courte (infobulles, légendes, Almanach). */
export function fatigueStateHint(id, rules = FATIGUE_RULES) {
  const refuge = rules.centre.exhausted.refuge === 'banquet' ? 'le Banquet' : rules.centre.exhausted.refuge;
  if (id === 'tired') return `ses coups faiblissent en combat, et sa réussite au Centre baisse de ${Math.round((1 - rules.centre.tired.chanceFactor) * 100)} % (sauf au Banquet)`;
  if (id === 'exhausted') return `il frappe bien moins fort, refuse tout lieu sauf ${refuge}, et y est envoyé d’office`;
  return 'aucun malus';
}

const LEVEL_CLASSES = Object.freeze({ rested: 'is-low', tired: 'is-mid', exhausted: 'is-high' });

/** Classe de couleur d'une jauge de fatigue (is-low / is-mid / is-high) selon l'état. */
export function fatigueLevelClass(fighter, value = getStat(fighter, 'fatigue')) {
  return LEVEL_CLASSES[getFatigueState(fighter, value).id] ?? 'is-low';
}

/** « Fatigue 55 / 100 · Fatigué » (l'état n'est nommé qu'à partir de « Fatigué »). */
export function fatigueText(fighter, value = getStat(fighter, 'fatigue')) {
  const state = getFatigueState(fighter, value);
  return `Fatigue ${Math.round(Number(value) || 0)} / 100${state.id === 'rested' ? '' : ` · ${state.label}`}`;
}

export const isFatigueState = (fighter, id, rules = FATIGUE_RULES) => getFatigueState(fighter, undefined, rules).id === id;

/**
 * Courbatures de fin de combat (une seule fois par combat, match.soreness) : chaque combattant du
 * joueur qui a disputé au moins une manche prend + perRound par manche disputée, + knockedOut s'il
 * a été mis KO (plafond de Bon vivant respecté). Un combattant épuisé affecté ailleurs qu'au
 * Banquet y est envoyé d'office (toRefuge). Seulement pour la vraie fatigue du joueur (pas la Lice
 * d'entraînement). Renvoie match.soreness.
 */
export function applyMatchSoreness(session, match, rules = FATIGUE_RULES) {
  if (match.soreness) return match.soreness;
  const side = match.sideOf(session.player.teamId);
  if (!side || !match.isFinished) return [];
  match.soreness = [];
  const roundsOf = new Map();
  for (const round of match.rounds) for (const id of round[`fightersTeam${side}`] ?? []) roundsOf.set(id, (roundsOf.get(id) ?? 0) + 1);
  const { perRound, knockedOut } = rules.soreness;
  const refuge = rules.centre.exhausted.refuge;
  for (const [fighterId, rounds] of roundsOf) {
    const fighter = session.getFighter(fighterId);
    if (!fighter || !isPlayerFighter(session, fighter, match)) continue;
    const ko = match.isKnockedOut(fighterId);
    const before = getStat(fighter, 'fatigue');
    let amount = rounds * perRound + (ko ? knockedOut : 0);
    const cap = fatigueCapOf(fighter);
    if (cap !== null) amount = Math.max(0, Math.min(amount, cap - before));
    worsenStat(fighter, 'fatigue', amount);
    const after = getStat(fighter, 'fatigue');
    const toRefuge = getFatigueState(fighter, after, rules).id === 'exhausted' && Boolean(fighter.activityId) && fighter.activityId !== refuge;
    if (toRefuge) fighter.activityId = refuge;
    match.soreness.push({ fighterId, rounds, knockedOut: ko, amount: after - before, before, after, toRefuge });
  }
  return match.soreness;
}

/** Fixe la fatigue d'un combattant dans ce combat (vraie stat du joueur, ou suivi local). */
function setMatchFatigue(session, match, fighter, value) {
  const next = Math.max(0, Math.min(MAX_FATIGUE, value));
  if (isPlayerFighter(session, fighter, match)) fighter.stats.fatigue = next;
  else match.localFatigue[fighter.id] = next;
}

/**
 * Manche disputée dans la lice (v0.66) : la fatigue a évolué tour par tour dans le moteur
 * (simulation.final[].fatigue) ; on la reporte sur les combattants. Puis, si le combat continue,
 * tout l'effectif récupère un peu entre les deux manches : − aligned pour ceux qui viennent de
 * combattre, − bench pour les remplaçants (× Second souffle). Remplit round.fatigueApplied
 * (fatigue de la manche) et round.recovery (récupération avant la suivante).
 * benchIds : { A, B } — remplaçants de chaque camp (effectif du combat hors manche).
 */
export function applyEngineRoundFatigue(session, match, round, { continues = true, benchIds = { A: [], B: [] }, rules = COMBAT_RULES } = {}) {
  round.fatigueApplied = [];
  round.recovery = [];
  const finalById = new Map((round.simulation?.final ?? []).map((unit) => [unit.id, unit]));
  for (const side of ['A', 'B']) {
    for (const fighterId of round[`fightersTeam${side}`]) {
      const fighter = session.getFighter(fighterId);
      const unit = finalById.get(fighterId);
      if (!fighter || !unit) continue;
      const before = getMatchFatigue(session, match, fighter);
      setMatchFatigue(session, match, fighter, Math.round(unit.fatigue));
      const after = getMatchFatigue(session, match, fighter);
      round.fatigueApplied.push({ fighterId, side, amount: after - before, before, after });
    }
  }
  if (!continues) return;
  const { aligned, bench } = rules.roundFatigue.betweenRounds;
  for (const side of ['A', 'B']) {
    const entries = [...round[`fightersTeam${side}`].map((id) => [id, aligned]), ...(benchIds[side] ?? []).map((id) => [id, bench])];
    for (const [fighterId, amount] of entries) {
      const fighter = session.getFighter(fighterId);
      if (!fighter) continue;
      const before = getMatchFatigue(session, match, fighter);
      setMatchFatigue(session, match, fighter, before - amount * fatigueRecoveryFactor(fighter));
      const after = getMatchFatigue(session, match, fighter);
      if (after !== before) round.recovery.push({ fighterId, side, amount: after - before, before, after });
    }
  }
}
