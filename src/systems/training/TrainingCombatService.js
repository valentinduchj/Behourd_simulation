import { TRAINING_FORMATS, DEFAULT_TRAINING_FORMAT, TRAINING_RULES } from '../../data/training.js';
import { createArena } from '../../combat/Arena.js';
import { createCombatUnit } from '../../combat/engine/CombatUnit.js';
import { simulateRound } from '../../combat/engine/CombatManager.js';
import { PlacementManager } from '../../combat/engine/PlacementManager.js';
import { placeAutomatically } from '../../combat/engine/AIPlacementStrategy.js';
import { getStartingBonuses } from '../../combat/engine/CombatSituation.js';
import { isCaptain } from '../roster/CaptainService.js';
import { canHaveTalents } from '../talents/TalentService.js';
import { combatEffectsOf, squadFatigueFactor } from '../talents/TalentEffects.js';
import { isFighterAvailable } from '../talents/StudyService.js';
import { createRng } from '../../utils/random.js';

// Ma Lice d'entraînement (v0.71) : combats INTERNES au club (camp A contre camp B, tous deux pris
// dans la compagnie du joueur), en 1 contre 1, 3 contre 3 ou 5 contre 5.
//
// Mode « entraînement » du moteur de combat — à distinguer du combat officiel
// (match/RoundService.resolveCombatRound) :
//   - MÊME moteur (simulateRound : déplacements, cibles, allonge, dégâts, fatigue de la manche,
//     KO, fin) et même IA, mêmes unités (createCombatUnit), mêmes talents de combat ;
//   - contexte temporaire : des unités de manche construites pour l'occasion. Rien n'est écrit
//     dans la partie — ni fatigue, ni statistiques, ni palmarès, ni mises à terre (aucun
//     onKnockout), ni deniers, ni classement, ni calendrier. On ne « défait » rien après coup :
//     il n'y a rien à défaire. Le résultat est abandonné quand l'écran le laisse tomber.
//   - aucune règle de saison (TRAINING_RULES.season : null) : seul le décor suit la saison.

export function getTrainingFormat(formatId) {
  return TRAINING_FORMATS.find((format) => format.id === formatId) ?? TRAINING_FORMATS.find((format) => format.id === DEFAULT_TRAINING_FORMAT);
}

/** Combattants de la compagnie qui peuvent s'entraîner (un combattant en étude ne combat pas). */
export function listTrainableFighters(session) {
  return session.playerFighters.filter((fighter) => isFighterAvailable(session, fighter));
}

/**
 * Composition ajustée à un format : doublons et combattants indisponibles retirés, aucun
 * combattant dans les deux camps (le camp A garde le sien), puis chaque camp ramené à la
 * taille du format (les premiers choisis restent). Ne complète jamais : { sideA, sideB }.
 */
export function fitTrainingSides(session, formatId, { sideA = [], sideB = [] } = {}) {
  const { size } = getTrainingFormat(formatId);
  const allowed = new Set(listTrainableFighters(session).map((fighter) => fighter.id));
  const unique = (ids) => [...new Set(ids)].filter((id) => allowed.has(id));
  const a = unique(sideA).slice(0, size);
  const b = unique(sideB).filter((id) => !a.includes(id)).slice(0, size);
  return { sideA: a, sideB: b };
}

/** Composition prête ? { ok, reason, missingA, missingB }. */
export function validateTrainingSides(session, formatId, { sideA = [], sideB = [] } = {}) {
  const { size, label } = getTrainingFormat(formatId);
  const fitted = fitTrainingSides(session, formatId, { sideA, sideB });
  const missingA = size - fitted.sideA.length;
  const missingB = size - fitted.sideB.length;
  if (fitted.sideA.length !== sideA.length || fitted.sideB.length !== sideB.length) {
    return { ok: false, reason: 'Un combattant ne peut figurer qu’une fois, dans un seul camp.', missingA, missingB };
  }
  if (missingA || missingB) {
    return { ok: false, reason: `${label} : il manque ${missingA ? `${missingA} au camp A` : ''}${missingA && missingB ? ' et ' : ''}${missingB ? `${missingB} au camp B` : ''}.`, missingA, missingB };
  }
  return { ok: true, reason: null, missingA: 0, missingB: 0 };
}

/**
 * Combat d'entraînement : placement automatique des deux camps, puis le moteur de combat sur
 * des unités temporaires. Renvoie { mode: 'training', formatId, arena, placements, simulation,
 * seed } — ou { ok: false, reason } si la composition n'est pas valide. `fatigueMode` :
 * 'current' (fatigue du moment) ou 'rested' (0).
 */
export function runTrainingCombat(session, { formatId, sideA, sideB, seed = `${Date.now()}`, fatigueMode = 'current' }) {
  const check = validateTrainingSides(session, formatId, { sideA, sideB });
  if (!check.ok) return { ok: false, reason: check.reason };
  const rng = createRng(`entrainement:${seed}`);
  const arena = createArena();
  const fighterOf = (id) => session.getFighter(id);
  const classOf = (id) => fighterOf(id).specialtyId;
  // Placement : même placement automatique que l'IA, pour les deux camps (en alternance).
  const manager = new PlacementManager({ arena, fighters: { A: [...sideA], B: [...sideB] } });
  let guard = 0;
  while (!manager.isComplete && guard++ < 40) placeAutomatically({ manager, side: manager.currentSide, classOf, rng });
  const lineup = manager.toLineup();
  const tileOf = (placements, id) => placements.find((p) => p.fighterId === id);
  const season = TRAINING_RULES.season;
  const fatigueOf = (fighter) => (fatigueMode === 'rested' ? 0 : fighter.stats.fatigue ?? 0);
  const unitsOf = (ids, side, placements) => {
    const fighters = ids.map(fighterOf);
    // Légende vivante : vaut pour son camp, comme dans un combat officiel.
    const fatigueGain = squadFatigueFactor(fighters.filter((fighter) => canHaveTalents(session, fighter)));
    return fighters.map((fighter) => createCombatUnit({
      fighter, side, tile: tileOf(placements, fighter.id), fatigue: fatigueOf(fighter),
      isCaptain: isCaptain(session, fighter),
      talentEffects: canHaveTalents(session, fighter) ? combatEffectsOf(fighter, { season }) : [],
      season,
      fatigueGain,
    }));
  };
  const units = [...unitsOf(sideA, 'A', lineup.placementsA), ...unitsOf(sideB, 'B', lineup.placementsB)];
  // Aucun onKnockout : les mises à terre ne sont jamais comptées.
  const simulation = simulateRound({ arena, units, rng });
  simulation.startBonuses ??= getStartingBonuses(simulation.initial ?? units, arena);
  return { ok: true, mode: 'training', formatId, arena, placements: lineup, simulation, seed, fatigueMode };
}
