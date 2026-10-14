import { CAREER_MEDALS } from '../../data/careerMedals.js';
import { recordOf } from './FighterRecordService.js';

// Statistiques de carrière des combattants du joueur (CareerStatsManager) : mises à terre et
// médailles. Le moteur de combat constate le KO et désigne l'auteur du coup fatal
// (simulateRound › onKnockout) ; ce service tient le compte. Depuis la v0.55.0, les mises à
// terre des combattants de l'IA (contre le joueur) sont aussi comptées, sans médaille.
//
//   mise à terre : un KO provoqué par le coup fatal du combattant (+1, à lui seul)
//   donnée de carrière, enregistrée sur le combattant (fighter.record.takedowns), jamais
//   remise à zéro ; les médailles s'en déduisent (data/careerMedals.js).

/** Médailles obtenues pour `takedowns` mises à terre, dans l'ordre d'affichage (cumulatives). */
export function getUnlockedMedals(takedowns, medals = CAREER_MEDALS) {
  return medals.filter((medal) => takedowns >= medal.threshold);
}

/** Médailles débloquées en passant de `before` à `after` mises à terre. */
export function getNewMedals(before, after, medals = CAREER_MEDALS) {
  return medals.filter((medal) => before < medal.threshold && after >= medal.threshold);
}

/** Prochaine médaille à obtenir, ou null (toutes obtenues). */
export function getNextMedal(takedowns, medals = CAREER_MEDALS) {
  return medals.find((medal) => takedowns < medal.threshold) ?? null;
}

/**
 * Mise à terre : +1 pour l'auteur du coup fatal, constaté par le moteur de combat (une seule
 * fois par KO). Combattant du joueur : renvoie { fighterId, targetId, takedowns, newMedals }
 * (newMedals : médailles débloquées par ce KO). Combattant de l'IA (v0.55.0) : compté dans son
 * palmarès de partie (classements de la Taverne), sans médaille ; renvoie null.
 */
export function recordTakedown(session, attackerId, targetId) {
  const fighter = session.getFighter(attackerId);
  if (!fighter) return null;
  const record = recordOf(session, fighter);
  const before = record.takedowns;
  record.takedowns = before + 1;
  session.markDirty?.();
  if (fighter.teamId !== session.player.teamId) return null;
  return { fighterId: fighter.id, targetId, takedowns: record.takedowns, newMedals: getNewMedals(before, record.takedowns) };
}
