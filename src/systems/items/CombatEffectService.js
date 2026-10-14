import { EFFECT_DURATIONS, ITEM_EFFECT_TYPES } from '../../data/items.js';
import { createId } from '../../utils/id.js';

// Effets temporaires sur les combattants (ex. Hypocras : +10 % de dégâts finaux pour la
// prochaine manche). Ils sont enregistrés dans la partie (session.activeEffects), jamais sur
// le combattant : ses statistiques ne changent pas.
//
// TemporaryEffect : { id, type, targetFighterId, value, duration, sourceItemId, matchId,
//                     createdOnDay, expiresAt: { matchId, round } }
//   NEXT_ROUND : vaut pour la prochaine manche du combat `matchId` (expiresAt.round), puis
//   disparaît à la fin de cette manche (expireRoundEffects).
// Le moteur de combat les interroge au début de chaque manche (getFinalDamageBonus).

/** Effets actifs d'un combattant (pour le combat `matchId` s'il est donné). */
export function getActiveEffects(session, fighterId, { matchId = null } = {}) {
  return (session.activeEffects ?? []).filter((effect) => effect.targetFighterId === fighterId && (!matchId || effect.matchId === matchId));
}

/** Le combattant a-t-il déjà un effet de ce type actif ? */
export function hasActiveEffect(session, fighterId, type, options = {}) {
  return getActiveEffects(session, fighterId, options).some((effect) => effect.type === type);
}

/**
 * Crée un effet temporaire. Un même type ne se cumule jamais sur un combattant : refusé
 * s'il en a déjà un. Renvoie { ok, reason, effect }.
 */
export function addTemporaryEffect(session, { type, targetFighterId, value, duration, sourceItemId = null, match }) {
  if (!match) return { ok: false, reason: 'Cet effet ne s’applique que pendant un combat.', effect: null };
  if (hasActiveEffect(session, targetFighterId, type, { matchId: match.id })) {
    return { ok: false, reason: 'Ce combattant bénéficie déjà de cet effet.', effect: null };
  }
  const effect = {
    id: createId('effect'),
    type,
    targetFighterId,
    value,
    duration,
    sourceItemId,
    matchId: match.id,
    createdOnDay: session.calendar?.currentDay ?? null,
    expiresAt: duration === EFFECT_DURATIONS.NEXT_ROUND ? { matchId: match.id, round: match.currentRound } : null,
  };
  session.activeEffects.push(effect);
  session.markDirty();
  return { ok: true, reason: null, effect };
}

/** Effets qui valent pour la manche `round` du combat `match` (ceux de la manche en cours). */
export function getRoundEffects(session, fighterId, match) {
  return getActiveEffects(session, fighterId, { matchId: match.id })
    .filter((effect) => !effect.expiresAt || effect.expiresAt.round === match.currentRound);
}

/** Bonus de dégâts finaux (fraction) d'un combattant pour la manche en cours : 0 sans effet. */
export function getFinalDamageBonus(session, fighterId, match) {
  return getRoundEffects(session, fighterId, match)
    .filter((effect) => effect.type === ITEM_EFFECT_TYPES.FINAL_DAMAGE_BONUS)
    .reduce((sum, effect) => sum + effect.value, 0);
}

/** Fin d'une manche : les effets « prochaine manche » de ce combat disparaissent. Renvoie leur nombre. */
export function expireRoundEffects(session, match, roundNumber) {
  const before = session.activeEffects.length;
  session.activeEffects = session.activeEffects.filter((effect) => !(effect.matchId === match.id
    && effect.duration === EFFECT_DURATIONS.NEXT_ROUND && (effect.expiresAt?.round ?? roundNumber) <= roundNumber));
  const removed = before - session.activeEffects.length;
  if (removed) session.markDirty();
  return removed;
}

/**
 * Effets d'un combat qui n'est plus en cours (combat quitté, partie rechargée) : supprimés.
 * `currentMatchId` : combat à conserver (null : aucun). Renvoie leur nombre.
 */
export function clearStaleEffects(session, currentMatchId = null) {
  const before = session.activeEffects.length;
  session.activeEffects = session.activeEffects.filter((effect) => effect.matchId === currentMatchId && currentMatchId !== null);
  const removed = before - session.activeEffects.length;
  if (removed) session.markDirty();
  return removed;
}
