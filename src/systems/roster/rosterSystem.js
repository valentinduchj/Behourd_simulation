import { GAME_CONFIG } from '../../config/gameConfig.js';

// Opérations sur les combattants de la compagnie du joueur.

export function normalizeFighterName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ');
}

export function validateFighterName(name) {
  const { nameMinLength, nameMaxLength } = GAME_CONFIG.fighter;
  if (name.length < nameMinLength) return `Le nom doit contenir au moins ${nameMinLength} caractères.`;
  if (name.length > nameMaxLength) return `Le nom ne peut pas dépasser ${nameMaxLength} caractères.`;
  return null;
}

/** Renomme un combattant. Renvoie un message d'erreur, ou null si tout va bien. */
export function renameFighter(session, fighterId, rawName) {
  const fighter = session.getFighter(fighterId);
  if (!fighter) return 'Combattant introuvable.';
  const name = normalizeFighterName(rawName);
  const problem = validateFighterName(name);
  if (problem) return problem;
  if (name !== fighter.name) {
    fighter.name = name;
    session.markDirty();
  }
  return null;
}
