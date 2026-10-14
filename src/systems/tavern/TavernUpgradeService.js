import { TAVERN_CONFIG } from '../../data/tavern.js';
import { canAfford, getResource, spendResource } from '../economy/wallet.js';
import { MAX_TAVERN_LEVEL, getStarRangeForLevel, getTavernLevelDef } from './TavernLevelConfig.js';

// Niveau de la Taverne : lecture et amélioration. Seul `session.tavernLevel` est enregistré.
// Une amélioration ne touche JAMAIS aux recrues présentes : la nouvelle plage d'étoiles
// vaut pour la prochaine rotation (TavernRotationService).

export function getTavernLevel(session) {
  return getTavernLevelDef(session.tavernLevel ?? TAVERN_CONFIG.startLevel).level;
}

/** Plage d'étoiles de la prochaine rotation (celle du niveau actuel). */
export function getNextRotationStarRange(session) {
  return getStarRangeForLevel(getTavernLevel(session));
}

export function isTavernAtMaxLevel(session) {
  return getTavernLevel(session) >= MAX_TAVERN_LEVEL;
}

/** Prochaine amélioration : { level, cost, minStars, maxStars }, ou null au niveau maximal. */
export function getNextTavernUpgrade(session) {
  if (isTavernAtMaxLevel(session)) return null;
  return getTavernLevelDef(getTavernLevel(session) + 1);
}

/** { ok, reason, upgrade } — l'amélioration peut-elle être achetée maintenant ? */
export function canUpgradeTavern(session) {
  const upgrade = getNextTavernUpgrade(session);
  if (!upgrade) return { ok: false, reason: 'La Taverne est déjà au niveau maximal.', upgrade: null };
  if (!canAfford(session, TAVERN_CONFIG.currency, upgrade.cost)) {
    return { ok: false, reason: `Deniers insuffisants (il en manque ${upgrade.cost - getResource(session, TAVERN_CONFIG.currency)}).`, upgrade };
  }
  return { ok: true, reason: null, upgrade };
}

/**
 * Amélioration : vérifie le niveau et les deniers, débite le coût, niveau +1.
 * Les recrues présentes ne changent pas. Renvoie { ok, reason, level, cost }.
 */
export function upgradeTavern(session) {
  const check = canUpgradeTavern(session);
  if (!check.ok) return { ok: false, reason: check.reason, level: getTavernLevel(session), cost: check.upgrade?.cost ?? null };
  if (!spendResource(session, TAVERN_CONFIG.currency, check.upgrade.cost)) {
    return { ok: false, reason: 'Deniers insuffisants.', level: getTavernLevel(session), cost: check.upgrade.cost };
  }
  session.tavernLevel = check.upgrade.level;
  session.markDirty();
  return { ok: true, reason: null, level: session.tavernLevel, cost: check.upgrade.cost };
}
