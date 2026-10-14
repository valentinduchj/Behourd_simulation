// Le Bourg : artisans et améliorations des infrastructures du Centre (systems/borough/).
//
// Une amélioration :
//   id, artisanId, group (infrastructure concernée), name, description
//   baseCost, costProgression, currency   prix du 1er achat, progression des prix suivants
//   costs       (facultatif) prix de chaque achat, dans l'ordre : remplace la progression
//   maxLevel    nombre d'achats maximal (null : sans limite)
//   effect      { type, … } — types gérés dans systems/borough/upgradeEffects.js :
//               'activityRewardAmount'  { activityId, amount }  gain par réussite (+amount par niveau)
//               'activitySuccessChance' { activityId, amount }  probabilité de réussite (+amount par niveau, 100 % au plus)
//               'activityCapacity'      { activityId, amount }  places (+amount par niveau)
// Chaque amélioration a son propre compteur d'achats (session.upgrades[id]).
// Pour ajouter une amélioration : une entrée dans BOROUGH_UPGRADES ; un artisan : BOROUGH_ARTISANS.

// Progression des prix, commune à toutes les améliorations (systems/borough/UpgradeService.js) :
// chaque prix est le précédent × un multiplicateur qui augmente de `step` à chaque achat.
//   prix(0) = baseCost ; prix(n) = prix(n − 1) × (firstMultiplier + (n − 1) × step)
//   ex. 300 → 900 (×3) → 3 600 (×4) → 18 000 (×5) → 108 000 (×6)…
export const UPGRADE_COST_PROGRESSION = Object.freeze({ firstMultiplier: 3, step: 1 });

// Gain de probabilité de réussite de chaque amélioration « Probabilité » (+10 points par achat).
export const CHANCE_UPGRADE_STEP = 0.1;

const percent = (value) => `${Math.round(value * 100)} %`;

const upgrade = (id, artisanId, group, name, description, baseCost, effect, { maxLevel = null, costs = null } = {}) => Object.freeze({
  id, artisanId, group, name, description, baseCost, costProgression: UPGRADE_COST_PROGRESSION, costs: costs ? Object.freeze([...costs]) : null,
  maxLevel: maxLevel ?? (costs ? costs.length : null), currency: 'deniers', effect: Object.freeze(effect),
});

// Améliorations « caractéristique » du Pôle Combat (Lutte, Hast, Percussion) : 3 achats au
// plus, à prix fixés (gain par réussite : +2, puis +3, puis +4).
const SKILL_UPGRADE_COSTS = Object.freeze([200, 2400, 12000]);

const chanceUpgrade = (id, artisanId, group, place, baseCost, activityId, options = {}) => upgrade(id, artisanId, group, 'Probabilité',
  `+${percent(CHANCE_UPGRADE_STEP)} de probabilité de réussite ${place}.`, baseCost,
  { type: 'activitySuccessChance', activityId, amount: CHANCE_UPGRADE_STEP }, options);

// Forêt (v0.56.0) : chacune des trois améliorations du Bûcheron s'arrête au 4e achat (gain de
// deniers +60 au plus, réussite 90 % au plus, 10 places au plus). Une sauvegarde qui a déjà
// dépassé 4 achats garde ce qu'elle a acheté.
const FOREST_MAX_PURCHASES = 4;

export const BOROUGH_UPGRADES = Object.freeze([
  // Le Menuisier : infrastructures d'entraînement du Pôle Combat.
  upgrade('lice-wrestling', 'carpenter', 'Petite lice', 'Lutte', '+1 LUTTE gagnée à chaque réussite à la Petite lice.', 200,
    { type: 'activityRewardAmount', activityId: 'lice', amount: 1 }, { costs: SKILL_UPGRADE_COSTS }),
  chanceUpgrade('lice-chance', 'carpenter', 'Petite lice', 'à la Petite lice', 75, 'lice'),
  upgrade('lice-capacity', 'carpenter', 'Petite lice', 'Places', '+2 places à la Petite lice.', 100,
    { type: 'activityCapacity', activityId: 'lice', amount: 2 }),
  upgrade('dummies-polearm', 'carpenter', 'Mannequins', 'Hast', '+1 HAST gagnée à chaque réussite aux Mannequins.', 200,
    { type: 'activityRewardAmount', activityId: 'dummies', amount: 1 }, { costs: SKILL_UPGRADE_COSTS }),
  chanceUpgrade('dummies-chance', 'carpenter', 'Mannequins', 'aux Mannequins', 75, 'dummies'),
  upgrade('dummies-capacity', 'carpenter', 'Mannequins', 'Places', '+2 places aux Mannequins.', 100,
    { type: 'activityCapacity', activityId: 'dummies', amount: 2 }),
  upgrade('hay-percussion', 'carpenter', 'Tas de foin', 'Percussion', '+1 PER gagnée à chaque réussite au Tas de foin.', 200,
    { type: 'activityRewardAmount', activityId: 'hay', amount: 1 }, { costs: SKILL_UPGRADE_COSTS }),
  chanceUpgrade('hay-chance', 'carpenter', 'Tas de foin', 'au Tas de foin', 75, 'hay'),
  upgrade('hay-capacity', 'carpenter', 'Tas de foin', 'Places', '+2 places au Tas de foin.', 100,
    { type: 'activityCapacity', activityId: 'hay', amount: 2 }),
  // Le Bûcheron : travaux en Forêt (gain de deniers).
  upgrade('forest-deniers', 'woodcutter', 'Forêt', 'Gain de deniers', '+15 deniers gagnés à chaque tâche réussie en Forêt.', 150,
    { type: 'activityRewardAmount', activityId: 'forest', amount: 15 }, { maxLevel: FOREST_MAX_PURCHASES }),
  chanceUpgrade('forest-chance', 'woodcutter', 'Forêt', 'en Forêt', 200, 'forest', { maxLevel: FOREST_MAX_PURCHASES }),
  // 2 places de base → 4 → 6 → 8 → 10 (300 → 900 → 3 600 → 18 000 deniers) ; au-delà, non défini.
  upgrade('forest-capacity', 'woodcutter', 'Forêt', 'Places', '+2 places en Forêt.', 300,
    { type: 'activityCapacity', activityId: 'forest', amount: 2 }, { maxLevel: FOREST_MAX_PURCHASES }),
  // Le Sénéchal : Rivière et contrat de chasse (Banquet).
  upgrade('river-endurance', 'seneschal', 'Rivière', 'Endurance', '+1 END gagnée à chaque réussite à la Rivière.', 300,
    { type: 'activityRewardAmount', activityId: 'river', amount: 1 }),
  chanceUpgrade('river-chance', 'seneschal', 'Rivière', 'à la Rivière', 300, 'river'),
  upgrade('banquet-hunt', 'seneschal', 'Banquet', 'Contrat de chasse', '−10 fatigue supplémentaire à chaque repas du Banquet.', 200,
    { type: 'activityRewardAmount', activityId: 'banquet', amount: 10 }),
]);

export const BOROUGH_ARTISANS = Object.freeze([
  Object.freeze({
    id: 'carpenter',
    name: 'Le Menuisier',
    icon: '🪚',
    color: '#9a6a3a',
    spriteId: 'artisan_carpenter',
    description: 'Il construit et agrandit les infrastructures d’entraînement du Pôle Combat.',
  }),
  Object.freeze({
    id: 'woodcutter',
    name: 'Le Bûcheron',
    icon: '🪓',
    color: '#3e7d3a',
    spriteId: 'artisan_woodcutter',
    description: 'Il organise les travaux de la Forêt : rendement, réussite et places.',
  }),
  Object.freeze({
    id: 'seneschal',
    name: 'Le Sénéchal',
    icon: '🏰',
    color: '#4a3a7a',
    spriteId: 'artisan_seneschal',
    description: 'Il administre le Bourg : aménagements de la Rivière et contrat de chasse pour le Banquet.',
  }),
  Object.freeze({
    id: 'baker',
    name: 'Le Boulanger',
    icon: '🥖',
    color: '#c07a2c',
    spriteId: 'artisan_baker',
    description: 'Il cuit le pain et prépare quelques douceurs pour vos combattants. Ses consommables se rangent dans Le Coffre.',
  }),
]);

// Boutiques du Bourg : objets vendus par un artisan (data/items.js). Un achat débite le prix
// puis range l'objet dans Le Coffre (systems/shop/ShopService.js → InventoryService).
//   { itemId, price, currency, quantity (exemplaires par achat) }
export const BOROUGH_SHOPS = Object.freeze({
  baker: Object.freeze([
    Object.freeze({ itemId: 'pain_meteil', price: 50, currency: 'deniers', quantity: 1 }),
    Object.freeze({ itemId: 'hypocras', price: 50, currency: 'deniers', quantity: 1 }),
  ]),
});
