import { calculateFighterLevel } from '../rating/RatingService.js';
import { getEligibleFighters } from '../rating/EliteService.js';
import { getFighterRecord } from './FighterRecordService.js';

// Classements des combattants (pancarte des statistiques de la Taverne). Population : les
// effectifs actuels de toutes les compagnies des Ligues (comme le statut Elite), filtrable par
// Ligue ou sur la compagnie du joueur. Valeurs lues dans le palmarès enregistré combat après
// combat (FighterRecordService, CareerStatsService) — jamais recalculées.
//
// Ajouter un classement : une entrée ici (valeur lue sur le combattant et son palmarès).

export const FIGHTER_LEADERBOARDS = Object.freeze([
  Object.freeze({ id: 'level', label: 'Niveau', column: 'Niveau', display: 'stars', value: (fighter) => calculateFighterLevel(fighter) }),
  // Mises à terre : comptées seulement dans les combats disputés par le moteur de combat (ceux de
  // la compagnie du joueur) ; les combats entre clubs de l'IA, simulés, n'en produisent pas.
  // Classement limité à la compagnie du joueur (`lockedScope`).
  Object.freeze({ id: 'takedowns', label: 'Mises à terre', column: 'Mises à terre', lockedScope: 'player', value: (fighter, record) => record.takedowns ?? 0 }),
  Object.freeze({ id: 'wins', label: 'Victoires', column: 'Victoires', value: (fighter, record) => record.matches.won }),
  Object.freeze({ id: 'losses', label: 'Défaites', column: 'Défaites', value: (fighter, record) => record.matches.lost }),
  Object.freeze({ id: 'played', label: 'Combats disputés', column: 'Combats', value: (fighter, record) => record.matches.played }),
]);

export function getLeaderboardDefinition(id) {
  return FIGHTER_LEADERBOARDS.find((board) => board.id === id) ?? FIGHTER_LEADERBOARDS[0];
}

/**
 * Classement : [{ rank, fighter, teamId, value, level }], valeur décroissante ; égalité → niveau,
 * puis identifiant (ordre stable). scope : 'all' | identifiant de Ligue | 'player'.
 * Les combattants à 0 sont exclus des classements de palmarès (pas du classement par niveau).
 */
export function getFighterLeaderboard(session, boardId, { scope: wanted = 'all', limit = 20 } = {}) {
  const board = getLeaderboardDefinition(boardId);
  // Classement au périmètre imposé (mises à terre : la compagnie du joueur seulement).
  const scope = board.lockedScope ?? wanted;
  let fighters = getEligibleFighters(session);
  if (scope === 'player') fighters = fighters.filter((f) => f.teamId === session.player.teamId);
  else if (scope !== 'all') {
    const league = session.getLeague(scope);
    const teams = new Set(league?.teamIds ?? []);
    fighters = fighters.filter((f) => teams.has(f.teamId));
  }
  return fighters
    .map((fighter) => {
      const level = calculateFighterLevel(fighter);
      return { fighter, teamId: fighter.teamId, level, value: board.value(fighter, getFighterRecord(session, fighter)) };
    })
    .filter((row) => board.id === 'level' || row.value > 0)
    .sort((a, b) => b.value - a.value || b.level - a.level || String(a.fighter.id).localeCompare(String(b.fighter.id)))
    .slice(0, limit)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
