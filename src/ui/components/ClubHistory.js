import { h } from '../../utils/dom.js';
import { ordinal } from '../../utils/format.js';
import { getLeagueName } from '../../systems/league/LeagueService.js';
import { getClubHistory } from '../../systems/league/SeasonService.js';
import { cupStageName } from '../../systems/frenchCup/FrenchCupManager.js';
import { FRENCH_CUP_RULES } from '../../data/frenchCup.js';

// Historique d'un club (joueur ou IA), même présentation pour la Ligue et la Coupe (v0.69) :
//   **Saison 3** — 1er — Ligue 3 — Promotion en Ligue 2
//   **Saison 3** — 8e — Ligue 2
//   **Saison 3** — Quart de finale — Coupe de France
// Tout vient des entrées enregistrées en fin de saison / d'édition (jamais du classement actuel).

const MOVEMENTS = {
  PROMOTED: (entry) => ({ className: 'is-up', text: `Promotion en ${getLeagueName(entry.toLeagueId)}` }),
  RELEGATED: (entry) => ({ className: 'is-down', text: `Relégation en ${getLeagueName(entry.toLeagueId)}` }),
  WITHDRAWN: () => ({ className: 'is-down', text: 'Quitte le championnat' }),
};

/**
 * Une entrée d'historique, prête à afficher : { season, result, competition, movement, kind, stage }.
 * Coupe de France : stade atteint, jamais de promotion ni de relégation.
 */
export function formatHistoryEntry(entry) {
  if (entry.kind === 'cup') {
    return { kind: 'cup', season: entry.season, result: cupStageName(entry.stage), competition: FRENCH_CUP_RULES.name, movement: null, stage: entry.stage.split(':')[0] };
  }
  return {
    kind: 'league',
    season: entry.season,
    result: ordinal(entry.finalPosition),
    competition: getLeagueName(entry.leagueId),
    movement: MOVEMENTS[entry.movement]?.(entry) ?? null,
    stage: null,
  };
}

export function ClubHistory(session, clubId, { title = 'Historique' } = {}) {
  const entries = getClubHistory(session, clubId);
  // Séparateur dans le texte lui-même (lecture d'écran, copie) : « Saison 3 — 1er — Ligue 3 ».
  const sep = () => h('span', { class: 'club-history-sep' }, ' — ');
  return h(
    'section',
    { class: 'club-history' },
    h('h3', { class: 'sheet-section-title' }, title),
    entries.length
      ? h('ol', { class: 'club-history-list' }, entries.map((raw) => {
        const entry = formatHistoryEntry(raw);
        return h(
          'li',
          {
            class: `club-history-entry ${entry.kind === 'cup' ? `is-cup is-${entry.stage}` : ''}`.trim(),
            title: entry.kind === 'cup' ? `Saison ${entry.season} · ${entry.competition}, édition ${raw.edition}` : null,
          },
          h('strong', { class: 'club-history-season' }, `Saison ${entry.season}`),
          sep(),
          h('span', { class: 'club-history-result' }, entry.result),
          sep(),
          h('span', { class: 'club-history-competition' }, entry.competition),
          entry.movement ? [sep(), h('span', { class: `club-history-move ${entry.movement.className}` }, entry.movement.text)] : null,
        );
      }))
      : h('p', { class: 'muted' }, 'Aucune saison ni Coupe terminée pour le moment.'),
  );
}
