import { TROPHY_TYPES, PALMARES_RIBBONS, PALMARES_ORDER } from '../../data/trophies.js';
import { getClubHistory } from '../league/SeasonService.js';
import { getLeagueName } from '../league/LeagueService.js';

// Palmarès d'un club (joueur ou IA), pour l'en-tête de sa fiche : trophées de Ligue et de Coupe
// de France, et rubans de 2e / 3e place en Ligue et de finaliste de Coupe.
//
// Il n'est JAMAIS enregistré : il se déduit à chaque affichage de l'historique du club
// (session.clubHistory, entrées de fin de saison et de fin d'édition, jamais réécrites). Un
// rechargement ne peut donc rien dupliquer, et rien ne peut diverger de l'historique.

/**
 * Distinctions du club, cumulées et sans saison, dans l'ordre d'affichage ; celles qu'il n'a
 * pas sont omises : [{ id, kind: 'trophy' | 'ribbon', count, name, title, detail }].
 * `detail` : répartition par Ligue d'un ruban de place (« Ligue 2 ×1, Ligue 3 ×2 »), sinon null.
 */
export function computePalmares(session, clubId) {
  const counts = new Map();
  const byLeague = new Map();
  const add = (id, leagueId = null) => {
    counts.set(id, (counts.get(id) ?? 0) + 1);
    if (leagueId) {
      const leagues = byLeague.get(id) ?? new Map();
      leagues.set(leagueId, (leagues.get(leagueId) ?? 0) + 1);
      byLeague.set(id, leagues);
    }
  };
  for (const entry of getClubHistory(session, clubId)) {
    if (entry.kind === 'cup') {
      if (entry.stage === 'champion') add('cup');
      else if (entry.stage === PALMARES_RIBBONS.cupFinalist.cupStage) add('cupFinalist');
      continue;
    }
    if (entry.finalPosition === 1 && TROPHY_TYPES[entry.leagueId]) add(entry.leagueId);
    const ribbon = Object.values(PALMARES_RIBBONS).find((r) => r.position && r.position === entry.finalPosition);
    if (ribbon) add(ribbon.id, entry.leagueId);
  }
  return PALMARES_ORDER.filter((id) => counts.has(id)).map((id) => {
    const trophy = TROPHY_TYPES[id];
    const ribbon = PALMARES_RIBBONS[id];
    const leagues = byLeague.get(id);
    return {
      id,
      kind: trophy ? 'trophy' : 'ribbon',
      count: counts.get(id),
      name: trophy?.palmaresName ?? trophy?.name ?? ribbon.name,
      title: trophy?.title ?? ribbon.title,
      detail: leagues ? [...leagues].sort(([a], [b]) => a.localeCompare(b)).map(([leagueId, n]) => `${getLeagueName(leagueId)} ×${n}`).join(', ') : null,
    };
  });
}
