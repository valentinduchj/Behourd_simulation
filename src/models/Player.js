import { createId } from '../utils/id.js';
import { GAME_CONFIG } from '../config/gameConfig.js';

const copyPreset = (preset) => ({
  id: preset.id,
  name: preset.name,
  assignments: (preset.assignments ?? []).map(({ fighterId, activityId }) => ({ fighterId, activityId: activityId ?? null })),
  resetOthers: Boolean(preset.resetOthers),
});

/** Données propres au joueur (indépendantes de son équipe). */
export class Player {
  constructor(data = {}) {
    this.id = data.id ?? createId('player');
    this.name = data.name ?? 'Capitaine';
    this.teamId = data.teamId ?? null;
    this.resources = { deniers: GAME_CONFIG.economy.startingDeniers, ...(data.resources ?? {}) };
    this.createdAt = data.createdAt ?? Date.now();
    // Équipes enregistrées du club (raccourcis de l'effectif engagé) : [{ id, name, fighterIds }].
    // Voir systems/match/SavedTeamService.js. Anciennes sauvegardes : aucune équipe.
    this.savedTeams = (data.savedTeams ?? []).map((team) => ({ id: team.id, name: team.name, fighterIds: [...(team.fighterIds ?? [])] }));
    // Configurations d'affectation du Centre : [{ id, name, assignments: [{ fighterId, activityId }],
    // resetOthers }]. Voir systems/activities/AssignmentPresetService.js. Anciennes sauvegardes : aucune.
    this.assignmentPresets = (data.assignmentPresets ?? []).map(copyPreset);
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      teamId: this.teamId,
      resources: { ...this.resources },
      createdAt: this.createdAt,
      savedTeams: this.savedTeams.map((team) => ({ id: team.id, name: team.name, fighterIds: [...team.fighterIds] })),
      assignmentPresets: this.assignmentPresets.map(copyPreset),
    };
  }

  static fromJSON(data) {
    return new Player(data);
  }
}
