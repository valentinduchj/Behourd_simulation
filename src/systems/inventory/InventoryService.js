import { getItemDefinition } from '../../data/items.js';

// Le Coffre : stockage des objets du joueur. Seules les quantités sont enregistrées
// (session.inventory = { [itemId]: quantité }) ; nom, image et description viennent des
// données (data/items.js). Les objets identiques sont empilés. Ce service ne connaît aucun
// objet en particulier : il ajoute, retire et compte.

const toCount = (quantity) => {
  const n = Math.floor(Number(quantity));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Quantité possédée d'un objet (0 s'il n'est pas dans Le Coffre). */
export function getItemQuantity(session, itemId) {
  return session.inventory?.[itemId] ?? 0;
}

export function hasItem(session, itemId, quantity = 1) {
  return getItemQuantity(session, itemId) >= Math.max(1, toCount(quantity));
}

/** Ajoute `quantity` exemplaires (empilés). Renvoie { ok, reason, quantity : nouvelle quantité }. */
export function addItem(session, itemId, quantity = 1) {
  if (!getItemDefinition(itemId)) return { ok: false, reason: 'Objet inconnu.', quantity: 0 };
  const count = toCount(quantity);
  if (!count) return { ok: false, reason: 'Quantité invalide.', quantity: getItemQuantity(session, itemId) };
  session.inventory[itemId] = getItemQuantity(session, itemId) + count;
  session.markDirty();
  return { ok: true, reason: null, quantity: session.inventory[itemId] };
}

/** Retire `quantity` exemplaires ; à 0, l'objet disparaît du Coffre. Rien n'est retiré si le stock est insuffisant. */
export function removeItem(session, itemId, quantity = 1) {
  const count = toCount(quantity);
  if (!count) return { ok: false, reason: 'Quantité invalide.', quantity: getItemQuantity(session, itemId) };
  const owned = getItemQuantity(session, itemId);
  if (owned < count) return { ok: false, reason: 'Quantité insuffisante dans Le Coffre.', quantity: owned };
  const left = owned - count;
  if (left > 0) session.inventory[itemId] = left;
  else delete session.inventory[itemId];
  session.markDirty();
  return { ok: true, reason: null, quantity: left };
}

/** Détruit des exemplaires (action « Détruire » du Coffre). */
export function destroyItem(session, itemId, quantity = 1) {
  return removeItem(session, itemId, quantity);
}

/** Consomme un exemplaire d'un objet consommable (après application de son effet). */
export function consumeItem(session, itemId) {
  const item = getItemDefinition(itemId);
  if (!item?.consumable) return { ok: false, reason: 'Cet objet ne se consomme pas.', quantity: getItemQuantity(session, itemId) };
  return removeItem(session, itemId, 1);
}

/**
 * Contenu du Coffre, dans l'ordre des données : [{ id, name, icon, sprite, description,
 * consumable, quantity, definition }]. Les objets inconnus (données retirées) sont ignorés.
 */
export function listInventory(session) {
  return Object.entries(session.inventory ?? {})
    .map(([itemId, quantity]) => ({ definition: getItemDefinition(itemId), quantity }))
    .filter(({ definition, quantity }) => definition && quantity > 0)
    .map(({ definition, quantity }) => ({
      id: definition.id, name: definition.name, icon: definition.icon, sprite: definition.sprite,
      description: definition.description, consumable: definition.consumable, quantity, definition,
    }));
}
