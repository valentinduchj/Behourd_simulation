// Niveau des combattants et des clubs (systems/rating/RatingService.js).

export const RATING_CONFIG = Object.freeze({
  // Nombre de meilleurs combattants pris en compte pour le niveau du club.
  clubTopCount: 8,

  // Barème niveau moyen → étoiles, avec demi-étoiles. Chaque palier couvre
  // ]palier précédent, max] : un niveau non entier (ex. 10,25) tombe dans le palier supérieur.
  //   0–5 : 0 · 6–10 : ½ · 11–16 : 1 · 17–25 : 1½ · 26–40 : 2 · 41–50 : 2½ · 51–60 : 3
  //   61–70 : 3½ · 71–85 : 4 · 86–92 : 4½ · 93–100 : 5
  starScale: Object.freeze([
    { max: 5, stars: 0 },
    { max: 10, stars: 0.5 },
    { max: 16, stars: 1 },
    { max: 25, stars: 1.5 },
    { max: 40, stars: 2 },
    { max: 50, stars: 2.5 },
    { max: 60, stars: 3 },
    { max: 70, stars: 3.5 },
    { max: 85, stars: 4 },
    { max: 92, stars: 4.5 },
    { max: 100, stars: 5 },
  ].map(Object.freeze)),
  maxStars: 5,
});

// Statut « Elite » (systems/rating/EliteService.js) : les `count` meilleurs combattants de toutes
// les compagnies des Ligues (1, 2 et 3), classés par niveau actuel (même calcul que l'affichage),
// sans aucun quota par ligue ni par club. Égalité : identifiant du combattant (ordre stable).
export const ELITE_CONFIG = Object.freeze({
  count: 16,
  label: 'Elite',
});
