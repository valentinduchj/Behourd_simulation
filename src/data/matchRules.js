// Règles des combats de championnat (systems/match/MatchService.js).

export const MATCH_RULES = Object.freeze({
  // Un combat se joue en manches gagnantes : le premier club à 2 manches gagne.
  roundsToWin: 2,
  // Effectif engagé pour un combat (sélection du joueur : 1 à 8).
  maxSquadSize: 8,
  // Combattants alignés par manche, choisis parmi l'effectif engagé.
  fightersPerRound: 5,

  // Probabilité de victoire d'une manche, à partir du NIVEAU DE LA MANCHE de chaque camp
  // (moyenne des 5 combattants réellement engagés — le niveau du club n'intervient pas) :
  //   P(A) = base + (niveauA − niveauB) × perLevelPoint, bornée entre 0 et 1.
  // Ex. 20 contre 30 : 0,5 − 10 × 0,018 = 32 % / 68 % ; 63 contre 68 : 41 % / 59 %.
  // Probabilité nulle à partir d'environ 28 points d'écart (0,5 / 0,018).
  winProbability: Object.freeze({ base: 0.5, perLevelPoint: 0.018 }),

  // Fatigue reçue par chaque combattant ayant disputé la manche (tirage dans la plage).
  fatigue: Object.freeze({
    roundWinner: { min: 20, max: 50 },
    roundLoser: { min: 50, max: 60 },
  }),
});
