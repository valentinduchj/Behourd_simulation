// Statistiques de la Coupe de France (StatisticsManager) : tenues à part, sur l'édition
// (cup.fighterStats), jamais mêlées au palmarès ni à la carrière des combattants.
//
// Une manche, quel que soit le combat (joueur ou simulé), se décrit ainsi :
//   { winner: 'A' | 'B', lineups: { A: [fighterId], B: [fighterId] }, stats: { [id]: { dealt,
//     knockouts, … } }, knockedOut: [fighterId] }

/** Classements des meilleurs combattants (extensible : ajouter une entrée). */
export const CUP_LEADERBOARDS = Object.freeze([
  Object.freeze({ id: 'knockouts', label: 'Meilleur tueur', unit: 'adversaires mis KO', key: 'knockouts' }),
  Object.freeze({ id: 'damage', label: 'Meilleur combattant', unit: 'coups portés (dégâts)', key: 'damage' }),
  Object.freeze({ id: 'wins', label: 'Plus de victoires', unit: 'combats gagnés', key: 'matchesWon' }),
]);

const emptyFighterStats = (teamId, name) => ({ teamId, name, knockouts: 0, damage: 0, roundsPlayed: 0, roundsWon: 0, matchesPlayed: 0, matchesWon: 0 });

/** Adversaires mis KO par chaque camp sur l'ensemble des manches : { A, B }. */
export function countKnockouts(rounds) {
  const ko = { A: 0, B: 0 };
  for (const round of rounds) {
    const out = new Set(round.knockedOut ?? []);
    ko.A += (round.lineups.B ?? []).filter((id) => out.has(id)).length;
    ko.B += (round.lineups.A ?? []).filter((id) => out.has(id)).length;
  }
  return ko;
}

/**
 * Ajoute les manches d'un combat aux statistiques de l'édition. teams : { A: teamId, B: teamId } ;
 * winnerSide : vainqueur du combat ; nameOf(fighterId) : nom conservé pour l'historique.
 */
export function recordFighterStats(cup, { rounds, teams, winnerSide, nameOf = () => null }) {
  cup.fighterStats ??= {};
  const played = { A: new Set(), B: new Set() };
  for (const round of rounds) {
    for (const side of ['A', 'B']) {
      for (const id of round.lineups[side] ?? []) {
        const entry = (cup.fighterStats[id] ??= emptyFighterStats(teams[side], nameOf(id)));
        const stats = round.stats?.[id];
        entry.knockouts += stats?.knockouts ?? 0;
        entry.damage += Math.round(stats?.dealt ?? 0);
        entry.roundsPlayed += 1;
        if (round.winner === side) entry.roundsWon += 1;
        played[side].add(id);
      }
    }
  }
  for (const side of ['A', 'B']) {
    for (const id of played[side]) {
      cup.fighterStats[id].matchesPlayed += 1;
      if (winnerSide === side) cup.fighterStats[id].matchesWon += 1;
    }
  }
}

/** Les `limit` meilleurs d'un classement : [{ fighterId, …stats, value }]. */
export function getLeaderboard(cup, board, limit = 5) {
  return Object.entries(cup.fighterStats ?? {})
    .map(([fighterId, stats]) => ({ fighterId, ...stats, value: stats[board.key] ?? 0 }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || b.roundsWon - a.roundsWon || String(a.name ?? '').localeCompare(String(b.name ?? ''), 'fr'))
    .slice(0, limit);
}
