// Paramètres de la Taverne (systems/tavern/TavernRotationService.js).
// La rotation hebdomadaire est planifiée dans data/calendar.js (événement 'tavern').
//
// Prix d'une recrue, fixé à son arrivée dans la Taverne (il ne change plus ensuite), selon SES
// ÉTOILES (quel que soit le niveau de la Taverne) :
//   - étoiles proposées dès le niveau de départ (jusqu'à 2★) : (niveau du combattant (arrondi)
//     + variation aléatoire `priceVariation`) × `startingPriceFactor` (v1.1.8 : × 2, de 12 à 26
//     deniers environ en début de partie, au lieu de 6 à 13) ;
//   - étoiles débloquées par une amélioration : prix fixe du barème `starPrices` (v0.53.0).
export const RECRUITMENT_CONFIG = Object.freeze({
  // Nombre de combattants proposés à chaque rotation.
  poolSize: 4,
  // Prix fixe (deniers) des recrues selon leurs étoiles ; étoiles absentes : selon leur valeur.
  starPrices: Object.freeze({ 2.5: 150, 3: 350, 3.5: 600, 4: 1250 }),
  // Taverne de départ : variation aléatoire autour du niveau du combattant, en deniers.
  priceVariation: Object.freeze({ min: -10, max: 10 }),
  // v1.1.8 : multiplicateur de ce prix (les recrues de départ étaient trop bon marché).
  startingPriceFactor: 2,
  // Prix plancher : un combattant n'est jamais gratuit.
  minimumPrice: 1,
});
