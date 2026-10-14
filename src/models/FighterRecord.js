/**
 * Palmarès d'un combattant (données de carrière, jamais remises à zéro) :
 *   matches   : { played, won, lost }   combats auxquels il a réellement participé
 *   rounds    : { played, won, lost }   manches qu'il a réellement disputées
 *   takedowns : mises à terre — adversaires mis KO par son coup fatal (combattants du joueur)
 * Mis à jour uniquement par systems/fighters/FighterRecordService.js et CareerStatsService.js.
 * Une ancienne sauvegarde sans mises à terre part de 0.
 */
export function createFighterRecord(data = {}) {
  const takedowns = Number(data.takedowns);
  return {
    matches: { played: 0, won: 0, lost: 0, ...(data.matches ?? {}) },
    rounds: { played: 0, won: 0, lost: 0, ...(data.rounds ?? {}) },
    takedowns: Number.isInteger(takedowns) && takedowns > 0 ? takedowns : 0,
  };
}

export function cloneFighterRecord(record) {
  return { matches: { ...record.matches }, rounds: { ...record.rounds }, takedowns: record.takedowns ?? 0 };
}
