// Configurations d'affectation du Centre : répartitions enregistrées des combattants entre les
// lieux, appliquées d'un clic. Service : systems/activities/AssignmentPresetService.js.
// À ne pas confondre avec les équipes enregistrées (data/savedTeams.js), qui servent aux combats.
export const ASSIGNMENT_PRESET_RULES = Object.freeze({
  // Nombre de configurations au plus (boutons compacts au-dessus du tableau des affectations).
  maxPresets: 6,
  // Longueur maximale du nom (caractères).
  maxNameLength: 24,
});
