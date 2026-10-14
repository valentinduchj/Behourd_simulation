import { ROSTER_RULES } from '../../data/roster.js';
import { ensureCaptains, getCaptain } from './CaptainService.js';

// Effectif de la compagnie du joueur : limite de combattants, recrutement, congédiement.
// Règles : data/roster.js.

/** { count, max } — taille actuelle et maximale de l'effectif. */
export function getRosterSize(session) {
  return { count: session.playerFighters.length, max: ROSTER_RULES.maxTeamFighters };
}

export function isRosterFull(session) {
  const { count, max } = getRosterSize(session);
  return count >= max;
}

/** { ok, reason } — une place est-elle libre pour un nouveau combattant ? */
export function canRecruit(session) {
  const { count, max } = getRosterSize(session);
  if (count >= max) return { ok: false, reason: `Effectif complet (${count} / ${max}) : congédiez un combattant pour libérer une place.` };
  return { ok: true, reason: null };
}

/** Ajoute un combattant à la compagnie du joueur, dans la limite de l'effectif. */
export function recruit(session, fighter) {
  const check = canRecruit(session);
  if (!check.ok) return check;
  fighter.activityId = null;
  session.addFighterToTeam(fighter, session.player.teamId);
  session.markDirty();
  return { ok: true, reason: null };
}

/** { ok, reason } — le combattant peut-il être congédié ? */
export function canDismiss(session, fighterId) {
  const fighter = session.fighters.find((f) => f.id === fighterId);
  if (!fighter || fighter.teamId !== session.player.teamId) return { ok: false, reason: 'Ce combattant ne fait pas partie de votre compagnie.' };
  const { count } = getRosterSize(session);
  if (count <= ROSTER_RULES.minTeamFighters) {
    return { ok: false, reason: `Votre compagnie doit garder au moins ${ROSTER_RULES.minTeamFighters} combattant${ROSTER_RULES.minTeamFighters > 1 ? 's' : ''}.` };
  }
  return { ok: true, reason: null };
}

/**
 * Congédie définitivement un combattant : il est retiré de l'effectif et de la partie
 * (Centre, sélections, listes, niveau du club). Sa place est aussitôt libérée.
 */
export function dismiss(session, fighterId) {
  const check = canDismiss(session, fighterId);
  if (!check.ok) return { ...check, fighter: null };
  const fighter = session.fighters.find((f) => f.id === fighterId);
  session.removeFighter(fighterId);
  // Capitaine congédié : le membre le plus ancien devient capitaine (CaptainService).
  const newCaptain = fighter.isCaptain && ensureCaptains(session) ? getCaptain(session, session.player.teamId) : null;
  session.markDirty();
  return { ok: true, reason: null, fighter, newCaptain };
}
