import { MATCH_RULES } from './matchRules.js';

// Équipes enregistrées (écran « Effectif engagé ») : raccourcis de sélection du joueur,
// sans effet sur les règles de combat. Service : systems/match/SavedTeamService.js.
export const SAVED_TEAM_RULES = Object.freeze({
  // Nombre d'équipes enregistrées au plus.
  maxTeams: 3,
  // Longueur maximale du nom (caractères), pour garder des boutons compacts.
  maxNameLength: 24,
  // Une équipe enregistrée compte exactement autant de combattants que l'effectif engagé maximal.
  size: MATCH_RULES.maxSquadSize,
});

export const MAX_TEAM_NAME_LENGTH = SAVED_TEAM_RULES.maxNameLength;
