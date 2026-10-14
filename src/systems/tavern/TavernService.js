import { canAfford, spendResource } from '../economy/wallet.js';
import { canRecruit, recruit as addToRoster } from '../roster/RosterService.js';
import { recruitDiscount } from '../talents/TalentEffects.js';
import { recordRecruit } from '../achievements/AchievementService.js';

// La Taverne — recrutement (TavernRecruitmentService) : engager une recrue de l'offre en cours.
// La rotation de l'offre est dans TavernRotationService, le niveau de la Taverne dans
// TavernUpgradeService ; leurs fonctions sont réexportées ici pour les imports existants.

export { computeRecruitPrice, generateRecruitmentPool, rotateTavern, getNextRotation } from './TavernRotationService.js';

const CURRENCY = 'deniers';

/**
 * Prix réellement payé pour une recrue : son prix, moins la réduction du talent Marchandeur s'il
 * est dans la compagnie (non cumulable). Le prix enregistré de la recrue ne change pas.
 */
export function getRecruitCost(session, candidate) {
  return Math.round(candidate.cost * (1 - recruitDiscount(session)));
}

/** { ok, reason } — indique si la recrue peut être engagée (place libre, deniers). */
export function checkRecruit(session, candidateId) {
  const candidate = session.recruitment.getCandidate(candidateId);
  if (!candidate) return { ok: false, reason: 'Ce combattant n’est plus disponible.' };
  const room = canRecruit(session);
  if (!room.ok) return room;
  if (!canAfford(session, CURRENCY, getRecruitCost(session, candidate))) return { ok: false, reason: 'Deniers insuffisants.' };
  return { ok: true, reason: null };
}

/** Engage une recrue : paie son prix et l'ajoute à la compagnie du joueur (RosterService). */
export function recruit(session, candidateId) {
  const check = checkRecruit(session, candidateId);
  if (!check.ok) return { ...check, fighter: null };

  const candidate = session.recruitment.getCandidate(candidateId);
  const cost = getRecruitCost(session, candidate);
  const added = addToRoster(session, candidate.fighter);
  if (!added.ok) return { ...added, fighter: null };
  spendResource(session, CURRENCY, cost);
  session.recruitment.removeCandidate(candidateId);
  // Succès : Sang neuf, Chasseur de têtes ; ses talents comptent comme découverts.
  recordRecruit(session, candidate.fighter);
  session.markDirty();
  return { ok: true, reason: null, fighter: candidate.fighter, cost };
}
