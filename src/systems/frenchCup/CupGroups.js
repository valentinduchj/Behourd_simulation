import { FRENCH_CUP_RULES } from '../../data/frenchCup.js';

// Phase de poules (GroupStageManager) et qualification (QualificationManager).
// Chaque équipe affronte une fois les 5 autres de sa poule : 5 journées de 3 combats.

/**
 * Calendrier d'une poule (méthode du cercle) : [{ id, matchday, teamAId, teamBId, status: 'pending' }].
 * Chaque équipe joue une fois par journée.
 */
export function buildGroupSchedule(group) {
  const teams = [...group.teamIds];
  const n = teams.length;
  const matches = [];
  const rotating = teams.slice(1);
  for (let day = 0; day < n - 1; day++) {
    const order = [teams[0], ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const a = order[i];
      const b = order[n - 1 - i];
      // Alternance de l'ordre d'affiche d'une journée à l'autre.
      const [teamAId, teamBId] = (day + i) % 2 ? [b, a] : [a, b];
      matches.push({ id: `${group.id}-${day + 1}-${i + 1}`, groupId: group.id, matchday: day + 1, teamAId, teamBId, status: 'pending' });
    }
    rotating.unshift(rotating.pop());
  }
  return matches;
}

/** Ligne de classement vide. */
const emptyRow = (teamId) => ({ teamId, played: 0, won: 0, lost: 0, points: 0, roundsWon: 0, roundsLost: 0, knockouts: 0 });

/** Points d'un combat terminé pour une équipe (barème du championnat). */
export function pointsFor(won, roundsWon, rules = FRENCH_CUP_RULES) {
  if (won) return rules.points.win;
  return roundsWon > 0 ? rules.points.lossWithRound : rules.points.loss;
}

/** Comparateur du départage : points, manches remportées, adversaires mis KO (ordre strict). */
export function compareRows(a, b, rules = FRENCH_CUP_RULES) {
  for (const key of rules.ranking) {
    const diff = (b[key] ?? 0) - (a[key] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

/**
 * Classement d'une poule d'après ses combats joués : lignes triées (points, manches, KO), avec
 * `position`. `nameOf` départage en dernier recours (ordre alphabétique stable).
 */
export function getGroupStandings(group, { nameOf = (id) => id, rules = FRENCH_CUP_RULES } = {}) {
  const rows = new Map(group.teamIds.filter(Boolean).map((id) => [id, emptyRow(id)]));
  for (const match of group.matches) {
    if (match.status !== 'played') continue;
    for (const [teamId, won, roundsWon, roundsLost, knockouts] of [
      [match.teamAId, match.winnerId === match.teamAId, match.roundsWonA, match.roundsWonB, match.knockoutsA],
      [match.teamBId, match.winnerId === match.teamBId, match.roundsWonB, match.roundsWonA, match.knockoutsB],
    ]) {
      const row = rows.get(teamId);
      if (!row) continue;
      row.played += 1;
      row.won += won ? 1 : 0;
      row.lost += won ? 0 : 1;
      row.points += pointsFor(won, roundsWon, rules);
      row.roundsWon += roundsWon;
      row.roundsLost += roundsLost;
      row.knockouts += knockouts;
    }
  }
  return [...rows.values()]
    .sort((a, b) => compareRows(a, b, rules) || String(nameOf(a.teamId)).localeCompare(String(nameOf(b.teamId)), 'fr'))
    .map((row, index) => ({ ...row, groupId: group.id, position: index + 1 }));
}

/**
 * Qualification à la fin des poules : les `qualifiersPerGroup` premiers de chaque poule, puis
 * les meilleurs au rang `extraQualifiers.rank`, comparés entre poules (points, manches, KO),
 * pour compléter le tableau. Renvoie { qualified: [teamId], extra: [ligne], ranked: [ligne au
 * rang comparé, triées], eliminated: [teamId] }.
 */
export function computeQualification(groups, { nameOf = (id) => id, rules = FRENCH_CUP_RULES, excluded = [] } = {}) {
  const standings = groups.map((group) => getGroupStandings(group, { nameOf, rules }));
  // Compagnie qui a abandonné : jamais qualifiée ; les suivantes de sa poule montent d'un rang.
  const out = new Set(excluded);
  const eligible = standings.map((rows) => rows.filter((row) => !out.has(row.teamId)));
  const direct = eligible.flatMap((rows) => rows.slice(0, rules.qualifiersPerGroup));
  const { rank, count } = rules.extraQualifiers;
  const ranked = eligible.map((rows) => rows[rank - 1]).filter(Boolean)
    .sort((a, b) => compareRows(a, b, rules) || String(nameOf(a.teamId)).localeCompare(String(nameOf(b.teamId)), 'fr'));
  const extra = ranked.slice(0, count);
  const qualified = [...direct, ...extra].map((row) => row.teamId);
  const qualifiedSet = new Set(qualified);
  const eliminated = standings.flat().map((row) => row.teamId).filter((id) => !qualifiedSet.has(id));
  return { qualified, direct: direct.map((row) => row.teamId), extra, ranked, eliminated, standings };
}
