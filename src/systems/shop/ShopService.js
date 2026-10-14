import { BOROUGH_SHOPS } from '../../data/borough.js';
import { getItemDefinition } from '../../data/items.js';
import { canAfford, getResource, spendResource } from '../economy/wallet.js';
import { addItem } from '../inventory/InventoryService.js';
import { recordShopPurchase } from '../achievements/AchievementService.js';

// Boutiques des artisans du Bourg (ex. Le Boulanger) : achat seulement. Le prix est débité,
// puis l'objet est confié au Coffre (InventoryService). Aucune logique d'effet ici.

/** Artisan qui tient une boutique ? */
export function hasShop(artisanId) {
  return (BOROUGH_SHOPS[artisanId] ?? []).length > 0;
}

/** Offres d'un artisan : [{ itemId, price, currency, quantity, item }]. */
export function listShopOffers(artisanId) {
  return (BOROUGH_SHOPS[artisanId] ?? [])
    .map((offer) => ({ ...offer, item: getItemDefinition(offer.itemId) }))
    .filter((offer) => offer.item);
}

function findOffer(artisanId, itemId) {
  return listShopOffers(artisanId).find((offer) => offer.itemId === itemId) ?? null;
}

/** { ok, reason, offer } — l'objet peut-il être acheté maintenant ? */
export function canBuyItem(session, artisanId, itemId) {
  const offer = findOffer(artisanId, itemId);
  if (!offer) return { ok: false, reason: 'Cet objet n’est pas vendu ici.', offer: null };
  if (!canAfford(session, offer.currency, offer.price)) {
    return { ok: false, reason: `Deniers insuffisants (il en manque ${offer.price - getResource(session, offer.currency)}).`, offer };
  }
  return { ok: true, reason: null, offer };
}

/**
 * Achat d'un objet : vérifie les deniers, débite le prix, puis ajoute les exemplaires au
 * Coffre. Renvoie { ok, reason, price, quantity : quantité possédée après l'achat }.
 */
export function buyItem(session, artisanId, itemId) {
  const check = canBuyItem(session, artisanId, itemId);
  if (!check.ok) return { ok: false, reason: check.reason, price: check.offer?.price ?? null, quantity: null };
  const { offer } = check;
  if (!spendResource(session, offer.currency, offer.price)) return { ok: false, reason: 'Deniers insuffisants.', price: offer.price, quantity: null };
  const added = addItem(session, itemId, offer.quantity);
  // Succès : achats au Boulanger (compteur), puis états (deniers…).
  recordShopPurchase(session, artisanId);
  return { ok: true, reason: null, price: offer.price, quantity: added.quantity };
}
