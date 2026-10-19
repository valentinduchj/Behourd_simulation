// Objets du jeu (Le Coffre) — données uniquement. Un objet :
//   id, name, icon (pastille), sprite (image), description
//   consumable   true : il disparaît (−1) quand on l'utilise
//   usableIn     contextes où il peut être utilisé (ITEM_USE_CONTEXTS)
//   target       ce qu'il vise : 'playerFighter' (un combattant de votre compagnie)
//   effect       { type (ITEM_EFFECT_TYPES), value, duration (EFFECT_DURATIONS) } — appliqué par
//                systems/items/ConsumableService.js selon son type, jamais selon l'objet
//   keepsake     (v0.97) objet sans usage pour l'instant (usableIn vide, effect null) : il se
//                garde et s'empile dans Le Coffre — ex. les Ferveurs de la Reine, pour le Baron
//
// Pour ajouter un objet : une entrée dans ITEMS (et, s'il se vend, une offre dans
// data/borough.js › BOROUGH_SHOPS). Un nouveau type d'effet : ITEM_EFFECT_TYPES et son
// application dans ConsumableService (EFFECT_HANDLERS).

export const ITEM_EFFECT_TYPES = Object.freeze({
  // La fatigue du combattant prend la valeur `value` (définitif : elle évolue ensuite normalement).
  SET_FATIGUE: 'SET_FATIGUE',
  // +`value` (fraction) sur les dégâts finaux du combattant, le temps de `duration`.
  FINAL_DAMAGE_BONUS: 'FINAL_DAMAGE_BONUS',
});

export const ITEM_USE_CONTEXTS = Object.freeze({
  // Hors combat : depuis Le Coffre, dans les écrans de gestion.
  OUTSIDE_COMBAT: 'outsideCombat',
  // Pendant la phase de placement d'une manche (combattants alignés pour cette manche).
  PLACEMENT: 'placement',
});

export const EFFECT_DURATIONS = Object.freeze({
  // Effet immédiat et définitif (aucun effet temporaire n'est créé).
  INSTANT: 'INSTANT',
  // Effet temporaire : la prochaine manche du combat en cours, puis il disparaît.
  NEXT_ROUND: 'NEXT_ROUND',
});

export const ITEMS = Object.freeze([
  Object.freeze({
    id: 'pain_meteil',
    name: 'Pain au méteil',
    icon: '🍞',
    sprite: 'assets/sprites/items/pain_meteil.svg',
    description: 'Une miche de froment et de seigle, dense et nourrissante. Le combattant qui la mange retrouve toutes ses forces : sa fatigue tombe à 0.',
    consumable: true,
    usableIn: Object.freeze([ITEM_USE_CONTEXTS.OUTSIDE_COMBAT, ITEM_USE_CONTEXTS.PLACEMENT]),
    target: 'playerFighter',
    effect: Object.freeze({ type: ITEM_EFFECT_TYPES.SET_FATIGUE, value: 0, duration: EFFECT_DURATIONS.INSTANT }),
  }),
  Object.freeze({
    id: 'hypocras',
    name: 'Hypocras',
    icon: '🍷',
    sprite: 'assets/sprites/items/hypocras.svg',
    description: 'Vin épicé et miellé qui échauffe le sang. Donné pendant le placement, il accorde +10 % de dégâts finaux au combattant pour la manche qui suit. Un seul à la fois.',
    consumable: true,
    usableIn: Object.freeze([ITEM_USE_CONTEXTS.PLACEMENT]),
    target: 'playerFighter',
    effect: Object.freeze({ type: ITEM_EFFECT_TYPES.FINAL_DAMAGE_BONUS, value: 0.1, duration: EFFECT_DURATIONS.NEXT_ROUND }),
  }),
  // v0.97 : gagnées aux Combats de la Reine (QUEEN_COMBAT_CONFIG.ferveur) ; elles serviront plus
  // tard auprès du Baron (Les Expéditions). Inutilisables, cumulables.
  Object.freeze({
    id: 'ferveur_reine',
    name: 'Ferveur de la Reine',
    icon: '🌸',
    sprite: 'assets/sprites/items/ferveur_reine.svg',
    description: 'Un petit billet de papier rose, scellé aux armes de la Reine : la marque de sa faveur après une victoire en son honneur. Le Baron saura quoi en faire.',
    consumable: false,
    keepsake: true,
    usableIn: Object.freeze([]),
    target: null,
    effect: null,
  }),
]);

const ITEMS_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

export function getItemDefinition(itemId) {
  return ITEMS_BY_ID.get(itemId) ?? null;
}
