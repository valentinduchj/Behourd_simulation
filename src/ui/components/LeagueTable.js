import { h } from '../../utils/dom.js';
import { getLeagueName } from '../../systems/league/LeagueService.js';
import { EmblemView } from './EmblemView.js';
import { ClubStars } from './Rating.js';

/**
 * Indicateur de montée / descente, calculé dynamiquement depuis le rang
 * (row.promotion, fourni par StandingsService.getStandings).
 */
export function MovementMark(promotion) {
  if (!promotion) return h('span', { class: 'move-mark is-none', 'aria-hidden': 'true' });
  const up = promotion.direction === 'up';
  const label = `${up ? 'Montée' : 'Descente'} en ${getLeagueName(promotion.targetLeagueId)}`;
  return h('span', { class: `move-mark ${up ? 'is-up' : 'is-down'}`, title: label, role: 'img', 'aria-label': label }, up ? '▲' : '▼');
}

/**
 * Classement. rows : résultat de StandingsService.getStandings.
 * onOpenClub(team) : clic sur un club (ouvre sa fiche).
 * compact : sans les colonnes de détail (aperçus).
 */
export function LeagueTable(rows, { onOpenClub, compact = false } = {}) {
  return h(
    'table',
    { class: `league-table ${compact ? 'is-compact' : ''}`.trim() },
    h('thead', {}, h(
      'tr',
      {},
      h('th', { class: 'num', title: 'Position' }, 'Pos.'),
      h('th', {}, 'Club'),
      compact ? null : h('th', {}, 'Niveau'),
      h('th', { class: 'num', title: 'Joués' }, 'J'),
      h('th', { class: 'num', title: 'Victoires' }, 'V'),
      h('th', { class: 'num', title: 'Défaites' }, 'D'),
      compact ? null : h('th', { class: 'num', title: 'Manches gagnées – perdues' }, 'Manches'),
      h('th', { class: 'num', title: 'Points' }, 'Pts'),
    )),
    h('tbody', {}, rows.map((row) => h(
      'tr',
      { class: [row.isPlayer ? 'is-player' : '', row.promotion ? `zone-${row.promotion.direction}` : ''].filter(Boolean).join(' ') },
      h('td', { class: 'num' }, String(row.position)),
      h('td', {}, h(
        'span',
        { class: 'league-club-cell' },
        MovementMark(row.promotion),
        h(
          'button',
          { type: 'button', class: 'league-club link-button', onclick: () => onOpenClub?.(row.team), title: `Voir ${row.team.name}` },
          EmblemView(row.team.emblem, { size: 20, title: row.team.name }),
          row.team.name,
        ),
      )),
      compact ? null : h('td', {}, ClubStars(row.level, { className: 'star-rating-sm' })),
      h('td', { class: 'num' }, String(row.played)),
      h('td', { class: 'num' }, String(row.wins)),
      h('td', { class: 'num' }, String(row.losses)),
      compact ? null : h('td', { class: 'num' }, `${row.roundsWon} – ${row.roundsLost}`),
      h('td', { class: 'num league-points' }, String(row.points)),
    ))),
  );
}

/** Extrait du classement autour du club du joueur (encart « Ma ligue »). */
export function LeagueMiniTable(rows, { around = 2 } = {}) {
  const playerIndex = rows.findIndex((row) => row.isPlayer);
  const start = Math.max(0, Math.min(playerIndex - around, rows.length - (around * 2 + 1)));
  const excerpt = rows.slice(start, start + around * 2 + 1);
  return h(
    'ol',
    { class: 'league-mini', start: String(start + 1) },
    excerpt.map((row) => h(
      'li',
      { class: row.isPlayer ? 'is-player' : '' },
      h('span', { class: 'league-mini-pos' }, String(row.position)),
      MovementMark(row.promotion),
      h('span', { class: 'league-mini-name' }, row.team.name),
      h('span', { class: 'league-mini-pts' }, `${row.points} pt${row.points > 1 ? 's' : ''}`),
    )),
  );
}
