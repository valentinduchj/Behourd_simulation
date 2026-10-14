// Capitaine d'équipe (systems/roster/CaptainService.js). Pour l'instant, un statut
// d'identification uniquement : aucun bonus ni rôle en combat.

export const CAPTAIN_CONFIG = Object.freeze({
  // Capitaine créé par le joueur en début de partie.
  player: Object.freeze({
    // Compétences de niveau (Lutte, Hast, Percussion, Endurance) : tirage dans cette plage.
    statRange: Object.freeze({ min: 15, max: 35 }),
    // Âge fixe à la création.
    age: 21,
    // Potentiel minimal : tiré parmi les valeurs ≥ minPotential, selon la répartition habituelle.
    minPotential: 2,
    // Apparences proposées : les variantes de la classe choisie (data/sprites.js, 4 par classe).
  }),
  // Clubs de l'IA : le capitaine est le 1er ou le 2e combattant de l'effectif.
  aiCaptainPositions: Object.freeze([0, 1]),
});
