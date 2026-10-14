import { getItemDefinition, ITEM_EFFECT_TYPES, ITEM_USE_CONTEXTS } from '../../data/items.js';
import { getStat, setStat } from '../fighters/stats.js';
import { consumeItem, getItemQuantity } from '../inventory/InventoryService.js';
import { addTemporaryEffect, hasActiveEffect } from './CombatEffectService.js';

// Utilisation des consommables : vérifie le contexte (hors combat, placement), la cible,
// applique l'EFFET selon son type (EFFECT_HANDLERS), puis consomme un exemplaire dans Le
// Coffre. Aucune règle propre à un objet : tout vient de data/items.js.
//
// Contexte d'utilisation : { context (ITEM_USE_CONTEXTS), match (combat en cours, placement),
//   eligibleFighterIds (placement : combattants alignés pour la manche) }.

const EFFECT_HANDLERS = Object.freeze({
  [ITEM_EFFECT_TYPES.SET_FATIGUE]: {
    /** Raison de refuser cette cible, ou null. */
    check(session, fighter, effect) {
      return getStat(fighter, 'fatigue') === effect.value ? `La fatigue de ${fighter.name} est déjà à ${effect.value}.` : null;
    },
    apply(session, fighter, effect) {
      const before = getStat(fighter, 'fatigue');
      setStat(fighter, 'fatigue', effect.value);
      session.markDirty();
      return { message: `Fatigue de ${fighter.name} : ${Math.round(before)} → ${effect.value}.` };
    },
  },
  [ITEM_EFFECT_TYPES.FINAL_DAMAGE_BONUS]: {
    check(session, fighter, effect, { match }) {
      if (!match) return 'Uniquement pendant un combat.';
      return hasActiveEffect(session, fighter.id, effect.type, { matchId: match.id }) ? `${fighter.name} en bénéficie déjà pour la prochaine manche (non cumulable).` : null;
    },
    apply(session, fighter, effect, { match, item }) {
      const result = addTemporaryEffect(session, {
        type: effect.type, targetFighterId: fighter.id, value: effect.value, duration: effect.duration, sourceItemId: item.id, match,
      });
      if (!result.ok) return { error: result.reason };
      return { message: `${fighter.name} : +${Math.round(effect.value * 100)} % de dégâts finaux pour la prochaine manche.`, effect: result.effect };
    },
  },
});

export function getEffectHandler(type) {
  return EFFECT_HANDLERS[type] ?? null;
}

const CONTEXT_REASONS = Object.freeze({
  [ITEM_USE_CONTEXTS.OUTSIDE_COMBAT]: 'Utilisable uniquement hors combat.',
  [ITEM_USE_CONTEXTS.PLACEMENT]: 'Utilisable uniquement pendant le placement des combattants, avant une manche.',
});

/** Texte « où l'utiliser » d'un objet, d'après ses contextes. */
export function describeUsage(item) {
  const labels = { [ITEM_USE_CONTEXTS.OUTSIDE_COMBAT]: 'hors combat (depuis Le Coffre)', [ITEM_USE_CONTEXTS.PLACEMENT]: 'pendant le placement avant une manche' };
  return `Utilisable ${item.usableIn.map((context) => labels[context] ?? context).join(' ou ')}.`;
}

/** Combattants que l'objet peut viser dans ce contexte, chacun avec { fighter, ok, reason }. */
export function getItemTargets(session, itemId, { context, match = null, eligibleFighterIds = null } = {}) {
  const item = getItemDefinition(itemId);
  if (!item) return [];
  const handler = getEffectHandler(item.effect.type);
  let fighters = item.target === 'playerFighter' ? session.playerFighters : [];
  if (eligibleFighterIds) fighters = fighters.filter((fighter) => eligibleFighterIds.includes(fighter.id));
  return fighters.map((fighter) => {
    const reason = handler ? handler.check(session, fighter, item.effect, { match, context, item }) : 'Effet inconnu.';
    return { fighter, ok: !reason, reason };
  });
}

/**
 * L'objet peut-il être utilisé maintenant ? { ok, reason } : il faut en posséder, être dans
 * un contexte prévu et avoir au moins un combattant valide.
 */
export function canUseItem(session, itemId, options = {}) {
  const item = getItemDefinition(itemId);
  if (!item) return { ok: false, reason: 'Objet inconnu.' };
  if (getItemQuantity(session, itemId) < 1) return { ok: false, reason: 'Vous n’en avez plus.' };
  if (!item.usableIn.includes(options.context)) return { ok: false, reason: CONTEXT_REASONS[item.usableIn[0]] ?? 'Inutilisable ici.' };
  if (options.context === ITEM_USE_CONTEXTS.PLACEMENT && !options.match) return { ok: false, reason: 'Aucun combat en cours.' };
  const targets = getItemTargets(session, itemId, options);
  if (!targets.length) return { ok: false, reason: 'Aucun combattant ne peut le recevoir.' };
  if (!targets.some((target) => target.ok)) return { ok: false, reason: targets.length === 1 ? targets[0].reason : 'Aucun combattant valide pour le moment.' };
  return { ok: true, reason: null };
}

/**
 * Donne l'objet à un combattant : effet appliqué, puis un exemplaire consommé. Rien n'est
 * consommé si l'utilisation est refusée. Renvoie { ok, reason, message, quantity }.
 */
export function useItem(session, itemId, fighterId, options = {}) {
  const check = canUseItem(session, itemId, options);
  if (!check.ok) return { ok: false, reason: check.reason, quantity: getItemQuantity(session, itemId) };
  const target = getItemTargets(session, itemId, options).find((t) => t.fighter.id === fighterId);
  if (!target) return { ok: false, reason: 'Ce combattant ne peut pas le recevoir ici.', quantity: getItemQuantity(session, itemId) };
  if (!target.ok) return { ok: false, reason: target.reason, quantity: getItemQuantity(session, itemId) };
  const item = getItemDefinition(itemId);
  const applied = getEffectHandler(item.effect.type).apply(session, target.fighter, item.effect, { ...options, item });
  if (applied.error) return { ok: false, reason: applied.error, quantity: getItemQuantity(session, itemId) };
  const consumed = consumeItem(session, itemId);
  return { ok: true, reason: null, message: applied.message, quantity: consumed.quantity };
}
