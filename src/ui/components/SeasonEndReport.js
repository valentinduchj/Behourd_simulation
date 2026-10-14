import { h } from '../../utils/dom.js';
import { ordinal } from '../../utils/format.js';
import { getLeagueDefinition, getLeagueName, listLeagueDefinitions } from '../../systems/league/LeagueService.js';
import { EmblemView } from './EmblemView.js';
import { SCENE_VFX } from '../../data/vfx.js';
import { getVfxLevel, getVfxLevelId } from '../../render/vfx/vfxLevel.js';
import { createRng } from '../../utils/random.js';

// Bilan de fin de saison (carnet de bord) : classement FINAL de la division du joueur et
// mouvements dans les trois divisions. Lu dans l'archive de la saison (session.seasonHistory),
// jamais recalculé.

const tierOf = (leagueId) => getLeagueDefinition(leagueId)?.tier ?? 0;

function clubChip(session, teamId, position) {
  const team = session.getTeam(teamId);
  return h(
    'li',
    { class: `season-club ${teamId === session.player.teamId ? 'is-player' : ''}`.trim() },
    team ? EmblemView(team.emblem, { size: 22, title: team.name }) : null,
    h('span', { class: 'season-club-name' }, team?.name ?? '?'),
    position ? h('span', { class: 'season-club-rank' }, `(${ordinal(position)})`) : null,
  );
}

function movementList(session, label, entries, className) {
  return h(
    'div',
    { class: `season-moves ${className}` },
    h('p', { class: 'season-moves-label' }, label),
    entries.length
      ? h('ul', { class: 'season-club-list' }, entries.map(({ teamId, position }) => clubChip(session, teamId, position)))
      : h('p', { class: 'muted season-moves-none' }, 'aucun'),
  );
}

/** Mouvements d'une division : { promoted, relegated, withdrawn } (avec le rang final). */
export function getLeagueMovements(archive, leagueId) {
  const positionOf = (teamId) => archive.leagues[leagueId]?.find((row) => row.teamId === teamId)?.position ?? null;
  const moves = (archive.movements ?? []).filter((m) => m.from === leagueId);
  const entry = (m) => ({ teamId: m.teamId, position: positionOf(m.teamId) });
  const byRank = (a, b) => (a.position ?? 99) - (b.position ?? 99);
  return {
    promoted: moves.filter((m) => m.to && tierOf(m.to) < tierOf(leagueId)).map(entry).sort(byRank),
    relegated: moves.filter((m) => m.to && tierOf(m.to) > tierOf(leagueId)).map(entry).sort(byRank),
    withdrawn: moves.filter((m) => !m.to).map(entry).sort(byRank),
  };
}

/**
 * Effets visuels de la fin de saison (présentation) : guirlande de bannières aux couleurs de la
 * compagnie ; confettis en cas de montée ou de titre. Réglages : data/vfx.js (SCENE_VFX.seasonEnd) ;
 * niveau d'effets : Options. Les confettis sont tirés avec une graine (toujours les mêmes).
 */
export function SeasonCelebration(session, event) {
  const level = getVfxLevel();
  if (level.count <= 0) return null;
  const config = SCENE_VFX.seasonEnd;
  const colors = Object.values(session.playerTeam?.emblem.resolvedColors() ?? {});
  const palette = colors.length ? colors : config.confetti.extraColors;
  const reduced = getVfxLevelId() !== 'full';
  const banners = h('div', { class: `season-banners ${reduced ? 'is-still' : ''}`.trim(), 'aria-hidden': 'true' },
    Array.from({ length: config.banners }, (_, i) => h('span', { class: 'season-banner', style: { '--banner-color': palette[i % palette.length], '--i': String(i) } })));
  const celebrate = event.movement === 'promoted' || event.rank === 1;
  if (!celebrate) return h('div', { class: 'season-celebration' }, banners);
  const rng = createRng(`confettis:${event.season}`);
  const between = ([min, max]) => min + (max - min) * rng();
  const confettiColors = [...palette, ...config.confetti.extraColors];
  const count = Math.round(config.confetti.count * level.count);
  const confetti = h('div', { class: 'season-confetti', 'aria-hidden': 'true' }, Array.from({ length: count }, () => h('span', {
    class: `confetto ${rng() < 0.35 ? 'is-round' : ''}`.trim(),
    style: {
      '--x': `${(rng() * 100).toFixed(1)}%`, '--drift': `${((rng() * 2 - 1) * 60).toFixed(0)}px`,
      '--spin': `${Math.round(between([360, 1080]))}deg`, '--delay': `${between(config.confetti.delay).toFixed(2)}s`,
      '--duration': `${between(config.confetti.duration).toFixed(2)}s`, '--color': confettiColors[Math.floor(rng() * confettiColors.length)],
    },
  })));
  return h('div', { class: 'season-celebration' }, banners, confetti);
}

/** Bloc « FIN DE LA SAISON » d'après l'événement 'season.end'. */
export function SeasonEndReport(session, event) {
  const archive = session.seasonHistory.find((entry) => entry.season === event.season);
  if (!archive) return null;
  const playerId = session.player.teamId;
  const table = archive.leagues[event.leagueBefore] ?? [];
  const outcome = {
    promoted: `Promue en ${getLeagueName(event.leagueAfter)} !`,
    relegated: `Reléguée en ${getLeagueName(event.leagueAfter)}.`,
    stayed: `Reste en ${getLeagueName(event.leagueAfter)}.`,
  }[event.movement];
  const markOf = (teamId) => {
    const move = (archive.movements ?? []).find((m) => m.teamId === teamId && m.from === event.leagueBefore);
    if (!move) return null;
    if (!move.to) return h('span', { class: 'move-mark is-down', title: 'Quitte le championnat' }, '×');
    return tierOf(move.to) < tierOf(move.from)
      ? h('span', { class: 'move-mark is-up', title: `Promu en ${getLeagueName(move.to)}` }, '▲')
      : h('span', { class: 'move-mark is-down', title: `Relégué en ${getLeagueName(move.to)}` }, '▼');
  };

  return h(
    'section',
    { class: `season-end-report is-${event.movement}` },
    SeasonCelebration(session, event),
    h('p', { class: 'season-end-title' }, 'Fin de la saison'),
    h('p', { class: 'season-end-subtitle' }, `Saison ${event.season} — classement final`),
    h('p', { class: 'season-end-outcome' },
      h('strong', {}, `Votre compagnie termine ${ordinal(event.rank)} de ${getLeagueName(event.leagueBefore)}.`), ' ', outcome),
    h(
      'table',
      { class: 'season-final-table', 'aria-label': `Classement final de ${getLeagueName(event.leagueBefore)}` },
      h('caption', {}, `Classement final — ${getLeagueName(event.leagueBefore)}`),
      h('thead', {}, h('tr', {}, h('th', { class: 'num' }, 'Pos.'), h('th', {}, 'Club'), h('th', { class: 'num' }, 'J'), h('th', { class: 'num' }, 'V'), h('th', { class: 'num' }, 'D'), h('th', { class: 'num' }, 'Pts'), h('th', {}, ''))),
      h('tbody', {}, [...table].sort((a, b) => a.position - b.position).map((row) => {
        const team = session.getTeam(row.teamId);
        return h(
          'tr',
          { class: row.teamId === playerId ? 'is-player' : '' },
          h('td', { class: 'num' }, String(row.position)),
          h('td', {}, h('span', { class: 'season-club-cell' }, team ? EmblemView(team.emblem, { size: 20, title: team.name }) : null, team?.name ?? '?')),
          h('td', { class: 'num' }, String(row.played)),
          h('td', { class: 'num' }, String(row.wins)),
          h('td', { class: 'num' }, String(row.losses)),
          h('td', { class: 'num' }, h('strong', {}, String(row.points))),
          h('td', {}, markOf(row.teamId)),
        );
      })),
    ),
    h('h4', { class: 'season-moves-title' }, 'Promotions et relégations'),
    h(
      'div',
      { class: 'season-leagues' },
      listLeagueDefinitions().map((def) => {
        const moves = getLeagueMovements(archive, def.id);
        return h(
          'div',
          { class: `season-league ${def.id === event.leagueBefore ? 'is-current' : ''}`.trim(), 'data-league': def.id },
          h('p', { class: 'season-league-name' }, def.name),
          movementList(session, 'Promus', moves.promoted, 'is-up'),
          movementList(session, 'Relégués', moves.relegated, 'is-down'),
          moves.withdrawn.length ? movementList(session, 'Quittent le championnat', moves.withdrawn, 'is-down') : null,
        );
      }),
    ),
    h('p', { class: 'muted season-end-note' }, 'Les combattants ont pris un an. Les montées et descentes s’appliqueront au lancement de la nouvelle saison.'),
  );
}
