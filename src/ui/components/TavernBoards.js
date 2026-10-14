import { h } from '../../utils/dom.js';
import { FIGHTER_LEADERBOARDS, getFighterLeaderboard } from '../../systems/fighters/FighterStatsService.js';
import { groupTrophies } from '../../systems/trophies/TrophyService.js';
import { getLeagueName } from '../../systems/league/LeagueService.js';
import { drawTrophy } from '../../render/trophies.js';
import { openModal } from './Modal.js';
import { EmblemView } from './EmblemView.js';
import { FighterSprite } from './FighterSprite.js';
import { FighterStars } from './Rating.js';
import { FighterClassTags } from './SpecialtyBadge.js';

// Pancarte des classements et armoire à trophées de la Taverne (fenêtres). Aucune règle ici :
// classements (FighterStatsService) et palmarès (TrophyService) viennent des services.

/** Pancarte des classements : un onglet par statistique, filtre par Ligue ou sur sa compagnie. */
export function openFighterStatsBoard(session, { board = 'level', scope = 'all' } = {}) {
  const state = { board, scope };
  const body = h('div', { class: 'stats-board' });
  const scopes = [['all', 'Toutes les Ligues'], ...session.leagues.map((league) => [league.id, getLeagueName(league.id)]), ['player', 'Ma compagnie']];
  const render = () => {
    const definition = FIGHTER_LEADERBOARDS.find((b) => b.id === state.board);
    // Périmètre imposé par le classement (mises à terre : « Ma compagnie ») ; le choix du joueur
    // est gardé pour les autres onglets.
    const scope = definition.lockedScope ?? state.scope;
    const rows = getFighterLeaderboard(session, state.board, { scope, limit: 20 });
    const select = h('select', {
      class: 'input stats-scope', 'aria-label': 'Périmètre du classement', disabled: Boolean(definition.lockedScope),
      title: definition.lockedScope ? 'Les mises à terre ne sont comptées que pour votre compagnie.' : null,
      onchange: (event) => { state.scope = event.target.value; render(); },
    }, scopes.map(([value, label]) => h('option', { value, selected: value === scope }, label)));
    body.replaceChildren(
      h('div', { class: 'stats-board-head' },
        h('div', { class: 'cup-tabs', role: 'tablist' }, FIGHTER_LEADERBOARDS.map((b) => h('button', {
          type: 'button', role: 'tab', class: `cup-tab ${b.id === state.board ? 'is-active' : ''}`.trim(), 'aria-selected': String(b.id === state.board),
          'data-board': b.id, onclick: () => { state.board = b.id; render(); },
        }, b.label))),
        select),
      rows.length
        ? h('table', { class: 'assign-table stats-table' },
          h('thead', {}, h('tr', {}, h('th', { class: 'num' }, 'Rang'), h('th', {}, 'Combattant'), h('th', {}, 'Club'), h('th', { class: 'num' }, definition.column))),
          h('tbody', {}, rows.map((row) => {
            const team = session.getTeam(row.teamId);
            return h('tr', { class: row.teamId === session.player.teamId ? 'is-player' : '', 'data-fighter-id': row.fighter.id },
              h('td', { class: 'num' }, String(row.rank)),
              h('td', {}, h('span', { class: 'stats-who' }, FighterSprite(row.fighter, { size: 28, team }), h('strong', {}, row.fighter.name), h('span', { class: 'class-tags' }, ...FighterClassTags(row.fighter, session)))),
              h('td', {}, h('span', { class: 'cup-team-cell' }, team ? EmblemView(team.emblem, { size: 18 }) : null, team?.name ?? '—')),
              h('td', { class: 'num stats-value' }, definition.display === 'stars' ? FighterStars(row.value) : String(row.value)));
          })))
        : h('p', { class: 'empty-state' }, 'Aucun combattant classé pour l’instant : les combats à venir rempliront ce classement.'),
      h('p', { class: 'muted stats-note' }, definition.lockedScope
        ? 'Mises à terre de votre compagnie, constatées dans la Lice (championnat et Combats de la Reine). Les combats entre autres compagnies ne les comptent pas : ce classement est réservé à vos combattants.'
        : 'Combats de championnat et Combats de la Reine. La Coupe de France tient ses propres statistiques.'),
    );
  };
  render();
  return openModal({ title: '📜 Les classements des combattants', body, className: 'modal-wide stats-board-modal', actions: [{ label: 'Fermer', variant: 'primary' }] });
}

/** Dessine un trophée sur un petit canvas (netteté écran haute densité). */
function TrophyCanvas(competition, size = 96) {
  const canvas = h('canvas', { class: 'trophy-canvas', width: size * 2, height: size * 2, style: { width: `${size}px`, height: `${size}px` } });
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  drawTrophy(ctx, size / 2, size - 4, { competition, size: size - 10 });
  return canvas;
}

/**
 * Armoire à trophées en vue rapprochée : les trophées de la compagnie regroupés par
 * compétition, chacun avec sa saison (et l'édition pour la Coupe), sans limite de nombre.
 */
export function openTrophyCabinet(session) {
  const groups = groupTrophies(session);
  const total = groups.reduce((sum, g) => sum + g.trophies.length, 0);
  const body = h('div', { class: 'trophy-cabinet' },
    h('p', { class: 'trophy-cabinet-summary' }, total
      ? `${total} titre${total > 1 ? 's' : ''} : ${groups.map((g) => `${g.type.name} ×${g.trophies.length}`).join(' · ')}`
      : 'Aucun trophée pour l’instant. Terminez champion d’une Ligue ou remportez la Coupe de France pour garnir l’armoire.'),
    h('div', { class: 'trophy-shelves' }, groups.map((group) => h('section', { class: 'trophy-shelf', 'data-competition': group.type.competition },
      h('h3', { class: 'trophy-shelf-title' }, `${group.type.name}`, h('span', { class: 'trophy-count' }, `×${group.trophies.length}`)),
      h('ul', { class: 'trophy-row' }, group.trophies.map((trophy) => h('li', { class: 'trophy-item', 'data-trophy-id': trophy.id, title: `${group.type.title} — saison ${trophy.season}` },
        TrophyCanvas(trophy.competition),
        h('strong', {}, group.type.title),
        h('span', { class: 'muted' }, trophy.competition === 'cup' ? `Saison ${trophy.season} · édition ${String(trophy.editionId).split('-')[1] ?? ''}` : `Saison ${trophy.season}`))))))),
  );
  return openModal({ title: '🏆 Armoire à trophées', body, className: 'modal-wide trophy-cabinet-modal', actions: [{ label: 'Retour à la Taverne', variant: 'primary' }] });
}
