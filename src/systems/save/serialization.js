import { GAME_CONFIG } from '../../config/gameConfig.js';
import { GameSession } from '../../state/GameSession.js';
import { SAVE_FORMAT_VERSION } from './saveFormat.js';
import { migrateSave } from './migrations.js';
import { getLeagueName } from '../league/LeagueService.js';

/**
 * Structure d'un fichier de sauvegarde :
 * {
 *   formatVersion, gameVersion,
 *   meta: { teamName, emblem, fighterCount, day, savedAt },   // affiché dans "Charger"
 *   data: { player, teams, fighters, calendar, recruitment, leagues (classements, calendriers
 *           des rencontres, résultats), season, seasonHistory, createdAt, lastSavedAt }
 * }
 */
export function serializeSession(session, savedAt = Date.now()) {
  const team = session.playerTeam;
  return {
    formatVersion: SAVE_FORMAT_VERSION,
    gameVersion: GAME_CONFIG.version,
    meta: {
      teamName: team?.name ?? 'Compagnie inconnue',
      emblem: team?.emblem.toJSON() ?? null,
      fighterCount: team ? session.getFightersOfTeam(team.id).length : 0,
      day: session.calendar.currentDay,
      leagueName: session.playerLeague ? getLeagueName(session.playerLeague) : null,
      season: session.season?.number ?? null,
      savedAt,
    },
    data: { ...session.toJSON(), lastSavedAt: savedAt },
  };
}

export function deserializeSession(file) {
  const migrated = migrateSave(file);
  return GameSession.fromJSON(migrated.data);
}
