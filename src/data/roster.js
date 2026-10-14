// Règles de l'effectif du joueur (systems/roster/RosterService.js).
export const ROSTER_RULES = Object.freeze({
  // Nombre maximal de combattants dans la compagnie (MAX_TEAM_FIGHTERS).
  maxTeamFighters: 20,
  // Nombre minimal de combattants conservés lors d'un congédiement : une compagnie doit
  // pouvoir aligner au moins un combattant pour disputer ses combats.
  minTeamFighters: 1,
});

export const MAX_TEAM_FIGHTERS = ROSTER_RULES.maxTeamFighters;
