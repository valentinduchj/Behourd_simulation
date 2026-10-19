// Les expéditions du Baron (v0.98, récompenses v0.99) — données uniquement
// (systems/expeditions/ExpeditionService.js).
//
// À chaque saison de l'année (climat : 25 jours), le Baron propose trois expéditions, une par
// tranche de coût (en Ferveurs de la Reine). Chacune est, au hasard, une Pérégrination ou une
// Expédition singulière (simple couleur du récit : les deux s'entreprennent de la même façon),
// dans un lieu sauvage ou médiéval d'Europe (EXPEDITION_PLACES). Le joueur n'en entreprend
// qu'une par saison : les autres se grisent jusqu'aux propositions suivantes.
//
// Toute expédition emmène un combattant (indisponible, comme au Bureau d'étude) pendant 20 à 30
// jours. Sa récompense est tirée avec la proposition et annoncée sur la carte ; elle est donnée
// au retour. Récompenses (rewards de chaque tranche, tirées selon `weight`) :
//   deniers    { min, max }  deniers au Trésor
//   talent     { rarity }    un talent précis de cette famille (connu sur la carte) ; s'il en a déjà
//                            deux, le joueur choisit au départ celui qu'il remplacera
//   potential  { value }     +1 potentiel (3 flammes au plus)
//   recruit    { minPotential }  une recrue attend à la Taverne, offerte (gardée aux rotations)

const reward = (type, weight, params = {}) => Object.freeze({ type, weight, ...params });

export const EXPEDITION_RULES = Object.freeze({
  currencyItemId: 'ferveur_reine',
  // Une proposition par tranche de coût (Ferveurs), dans cet ordre, et ses récompenses possibles.
  costBands: Object.freeze([
    Object.freeze({ min: 1, max: 5, rewards: Object.freeze([
      reward('deniers', 25, { min: 500, max: 1000 }),
      reward('talent', 25, { rarity: 'common' }),
      reward('potential', 25, { value: 1 }),
      reward('recruit', 25, { minPotential: 1 }),
    ]) }),
    Object.freeze({ min: 6, max: 10, rewards: Object.freeze([
      reward('deniers', 33, { min: 1500, max: 3000 }),
      reward('talent', 34, { rarity: 'rare' }),
      reward('talent', 33, { rarity: 'epic' }),
    ]) }),
    Object.freeze({ min: 11, max: 18, rewards: Object.freeze([
      reward('deniers', 33, { min: 5000, max: 7000 }),
      reward('talent', 34, { rarity: 'epic' }),
      reward('talent', 33, { rarity: 'exotic' }),
    ]) }),
  ]),
  // Durée de toute expédition (jours) : le combattant est absent jusqu'à son retour.
  durationDays: Object.freeze({ min: 20, max: 30 }),
  // Nature de chaque proposition, tirée au hasard (poids).
  kinds: Object.freeze([
    Object.freeze({ id: 'peregrination', weight: 50 }),
    Object.freeze({ id: 'singular', weight: 50 }),
  ]),
  // Une seule expédition entreprise par saison.
  perSeason: 1,
  peregrination: Object.freeze({
    durationDays: Object.freeze({ min: 20, max: 30 }),
    potentialGain: 1,
    potentialMax: 3,
  }),
});

/** Récompenses : icône et libellé court (cartes, carnet de bord). */
export const EXPEDITION_REWARDS = Object.freeze({
  deniers: Object.freeze({ id: 'deniers', icon: '⛁', name: 'Deniers' }),
  talent: Object.freeze({ id: 'talent', icon: '📜', name: 'Talent' }),
  potential: Object.freeze({ id: 'potential', icon: '🔥', name: 'Potentiel' }),
  recruit: Object.freeze({ id: 'recruit', icon: '🍺', name: 'Recrue' }),
});

export const EXPEDITION_KINDS = Object.freeze({
  peregrination: Object.freeze({ id: 'peregrination', name: 'Pérégrination', icon: '🧭', color: '#2f6b4f' }),
  singular: Object.freeze({ id: 'singular', name: 'Expédition singulière', icon: '⚜', color: '#7a1f2b' }),
});

// Lieux : nom, région (telle qu'on la nommait au Moyen Âge, pays actuel entre parenthèses),
// thème de l'illustration (expeditions/ExpeditionArt.js) et une phrase du Baron.
export const EXPEDITION_PLACES = Object.freeze([
  Object.freeze({ id: 'broceliande', name: 'Forêt de Brocéliande', region: 'Bretagne (France)', theme: 'forest', palette: 'dawn', line: 'Les vieux chênes y gardent les secrets de Merlin.' }),
  Object.freeze({ id: 'foret_noire', name: 'Forêt-Noire', region: 'Souabe (Allemagne)', theme: 'forest', palette: 'dusk', line: 'Des sapins si serrés que le jour n’y entre pas.' }),
  Object.freeze({ id: 'bialowieza', name: 'Forêt de Białowieża', region: 'Mazovie (Pologne)', theme: 'forest', palette: 'mist', line: 'Les bisons y règnent encore sur les sous-bois.' }),
  Object.freeze({ id: 'mont_blanc', name: 'Massif du Mont-Blanc', region: 'Savoie (France)', theme: 'peaks', palette: 'day', line: 'La montagne maudite, que nul n’a encore vaincue.' }),
  Object.freeze({ id: 'gavarnie', name: 'Cirque de Gavarnie', region: 'Bigorre (France)', theme: 'peaks', palette: 'dawn', line: 'Une muraille de roche où tombent les cascades.' }),
  Object.freeze({ id: 'dolomites', name: 'Les Dolomites', region: 'Tyrol (Italie)', theme: 'peaks', palette: 'dusk', line: 'Des tours de pierre pâle qui rougissent au couchant.' }),
  Object.freeze({ id: 'picos', name: 'Picos de Europa', region: 'Asturies (Espagne)', theme: 'peaks', palette: 'mist', line: 'Les premiers sommets qu’aperçoivent les marins.' }),
  Object.freeze({ id: 'jumieges', name: 'Abbaye de Jumièges', region: 'Normandie (France)', theme: 'ruins', palette: 'day', line: 'Les plus belles ruines du royaume, dit-on.' }),
  Object.freeze({ id: 'montsegur', name: 'Château de Montségur', region: 'Comté de Foix (France)', theme: 'fortress', palette: 'dusk', line: 'Un nid d’aigle où les derniers parfaits ont résisté.' }),
  Object.freeze({ id: 'calascio', name: 'Rocca Calascio', region: 'Abruzzes (Italie)', theme: 'fortress', palette: 'day', line: 'La forteresse la plus haute des Apennins.' }),
  Object.freeze({ id: 'tintagel', name: 'Tintagel', region: 'Cornouailles (Angleterre)', theme: 'coast', palette: 'mist', line: 'Là où naquit le roi Arthur, face à la mer.' }),
  Object.freeze({ id: 'skellig', name: 'Skellig Michael', region: 'Kerry (Irlande)', theme: 'coast', palette: 'dawn', line: 'Un rocher, des moines, et l’océan tout autour.' }),
  Object.freeze({ id: 'sognefjord', name: 'Sognefjord', region: 'Norvège', theme: 'fjord', palette: 'day', line: 'Le plus long des fjords, où dorment les drakkars.' }),
  Object.freeze({ id: 'glencoe', name: 'Glencoe', region: 'Highlands (Écosse)', theme: 'highlands', palette: 'mist', line: 'Une vallée de bruyère et de brume, et ses vieilles pierres.' }),
  Object.freeze({ id: 'connemara', name: 'Connemara', region: 'Connacht (Irlande)', theme: 'highlands', palette: 'dawn', line: 'Des landes, des lacs, et le vent pour seul maître.' }),
  Object.freeze({ id: 'meteores', name: 'Les Météores', region: 'Thessalie (Grèce)', theme: 'monastery', palette: 'dusk', line: 'Des monastères perchés au sommet des rochers.' }),
]);

export function getExpeditionPlace(id) {
  return EXPEDITION_PLACES.find((place) => place.id === id) ?? null;
}
