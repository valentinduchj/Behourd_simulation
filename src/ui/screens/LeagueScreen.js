import { h } from '../../utils/dom.js';
import { SCREENS } from '../../core/screenIds.js';
import { getLeagueDefinition, getLeaguesByTier, getCountry } from '../../systems/league/LeagueService.js';
import { getStandings } from '../../systems/league/StandingsService.js';
import { getSeasonProgress } from '../../systems/league/SeasonService.js';
import { HubScreen } from './HubScreen.js';
import { LeagueTable } from '../components/LeagueTable.js';
import { openClubSheet } from '../components/ClubSheet.js';
import { ordinal } from '../../utils/format.js';
import { isMobileLayout } from '../mobile/mobileLayout.js';
import { EmblemView } from '../components/EmblemView.js';

const PREVIEW_SIZE = 5;

/**
 * La Ligue : aperçu des trois divisions (5 premiers de chacune) et classement complet
 * d'une division (params.leagueId). Les zones de montée / descente sont calculées par
 * StandingsService ; cet écran ne connaît pas les règles.
 */
export class LeagueScreen extends HubScreen {
  static hubLocationId = 'league';

  renderContent() {
    // Téléphone (v0.95) : un seul écran — divisions en onglets, votre compagnie épinglée à gauche,
    // classement en lignes compactes qui s'ouvre sur votre ligne.
    if (isMobileLayout()) return this.renderMobile(this.params.leagueId);
    return this.params.leagueId ? this.renderFull(this.params.leagueId) : this.renderOverview();
  }

  renderMobile(leagueId) {
    const playerLeague = this.session.playerLeague;
    const league = (leagueId && this.session.getLeague(leagueId)) || playerLeague;
    const def = getLeagueDefinition(league.id);
    const rows = getStandings(this.session, league);
    const isOwn = league === playerLeague;
    const me = rows.find((row) => row.isPlayer) ?? null;
    const list = h('div', { class: 'm-league-list', role: 'table', 'aria-label': `Classement ${def.name}` },
      h('div', { class: 'm-league-row is-head', role: 'row' },
        h('span', {}, '#'), h('span', {}, 'Compagnie'), h('span', { class: 'num' }, 'J'), h('span', { class: 'num' }, 'V'), h('span', { class: 'num' }, 'D'), h('span', { class: 'num' }, 'Pts')),
      rows.map((row) => h('button', {
        type: 'button', role: 'row',
        class: ['m-league-row', row.isPlayer ? 'is-player' : '', row.promotion ? `zone-${row.promotion.direction}` : ''].filter(Boolean).join(' '),
        onclick: () => openClubSheet(this.session, row.team),
      },
      h('span', { class: 'm-league-pos' }, String(row.position)),
      h('span', { class: 'm-league-club' }, EmblemView(row.team.emblem, { size: 20, title: row.team.name }), h('span', {}, row.team.name)),
      h('span', { class: 'num' }, String(row.played)),
      h('span', { class: 'num' }, String(row.wins)),
      h('span', { class: 'num' }, String(row.losses)),
      h('strong', { class: 'num' }, String(row.points)))));
    const focus = () => list.querySelector('.m-league-row.is-player')?.scrollIntoView({ block: 'center' });
    const aside = h('aside', { class: 'm-league-aside' },
      h('h1', {}, 'Championnat'),
      h('p', { class: 'm-league-season' }, this.renderSeasonLine() ?? ''),
      h('div', { class: 'm-league-tabs', role: 'tablist', 'aria-label': 'Division' }, getLeaguesByTier(this.session).map((other) => h('button', {
        type: 'button', role: 'tab', class: `m-league-tab ${other === league ? 'is-active' : ''} ${other === playerLeague ? 'is-own' : ''}`.replace(/\s+/g, ' ').trim(),
        'aria-selected': String(other === league), 'data-league': other.id,
        onclick: () => this.navigate(SCREENS.LEAGUE, { leagueId: other.id }),
      }, getLeagueDefinition(other.id).shortName ?? getLeagueDefinition(other.id).name))),
      isOwn && me ? this.renderMobileStanding(rows, me) : h('p', { class: 'm-league-note' }, `${def.name} · ${rows.length} équipes. Touchez un club pour voir son effectif.`),
      isOwn && me ? h('button', { type: 'button', class: 'btn m-league-focus', onclick: focus }, '⌖ Ma ligne') : null);
    // À l'ouverture, la liste se place sur la ligne de la compagnie.
    if (isOwn) requestAnimationFrame(() => { if (list.isConnected) focus(); });
    return h('div', { class: 'hub-page m-league' }, aside, list);
  }

  /** Encart « Votre compagnie » : place, points, écart à la montée (ou à la descente). */
  renderMobileStanding(rows, me) {
    const lastUp = [...rows].reverse().find((row) => row.promotion?.direction === 'up') ?? null;
    const firstDown = rows.find((row) => row.promotion?.direction === 'down') ?? null;
    let line = null;
    if (me.promotion?.direction === 'up') line = h('p', { class: 'is-up' }, '▲ Zone de montée');
    else if (me.promotion?.direction === 'down') line = h('p', { class: 'is-down' }, '▼ Zone de descente');
    else if (lastUp) {
      const gap = Math.max(0, lastUp.points - me.points);
      line = h('p', { class: 'is-up' }, gap ? `▲ ${gap} point${gap > 1 ? 's' : ''} de la montée` : '▲ À égalité avec la montée');
    } else if (firstDown) {
      const gap = Math.max(0, me.points - firstDown.points);
      line = h('p', { class: 'is-safe' }, `${gap} point${gap > 1 ? 's' : ''} d’avance sur la descente`);
    }
    return h('div', { class: 'm-league-me' },
      h('p', { class: 'm-league-me-label' }, 'Votre compagnie'),
      h('p', { class: 'm-league-me-pos' }, h('strong', {}, ordinal(me.position, { feminine: true })), ` · ${me.points} pt${me.points > 1 ? 's' : ''}`),
      line);
  }

  renderSeasonLine() {
    const progress = getSeasonProgress(this.session);
    if (!progress) return null;
    return `Saison ${progress.season} · journée ${progress.played} / ${progress.total} de votre compagnie`;
  }

  renderOverview() {
    const current = this.session.playerLeague;
    const playerRow = getStandings(this.session, current).find((row) => row.isPlayer);
    const leagues = getLeaguesByTier(this.session);

    return h(
      'div',
      { class: 'hub-page' },
      h(
        'header',
        { class: 'hub-page-header' },
        h('p', { class: 'eyebrow' }, this.renderSeasonLine()),
        h('h1', {}, 'Championnat'),
        h('p', { class: 'hub-page-subtitle' }, playerRow
          ? `Votre compagnie est ${ordinal(playerRow.position, { feminine: true })} de ${getLeagueDefinition(current.id).name}.`
          : ''),
      ),
      h(
        'div',
        { class: 'league-overview' },
        // Division du joueur en premier, puis les autres de la plus haute à la plus basse.
        [current, ...leagues.filter((league) => league !== current)].map((league) => this.renderPreview(league, league === current)),
      ),
      h(
        'p',
        { class: 'muted league-legend' },
        h('span', { class: 'move-mark is-up', 'aria-hidden': 'true' }, '▲'), ' montée en fin de saison · ',
        h('span', { class: 'move-mark is-down', 'aria-hidden': 'true' }, '▼'), ' descente en fin de saison',
      ),
    );
  }

  renderPreview(league, isCurrent) {
    const def = getLeagueDefinition(league.id);
    const rows = getStandings(this.session, league);
    return h(
      'section',
      { class: `league-preview ${isCurrent ? 'is-current' : ''}`.trim() },
      h(
        'header',
        { class: 'league-preview-header' },
        h('h2', {}, def.name),
        isCurrent ? h('span', { class: 'tag tag-current' }, 'Votre division') : null,
        h('span', { class: 'muted' }, `${rows.length} équipes`),
      ),
      LeagueTable(rows.slice(0, PREVIEW_SIZE), { compact: true, onOpenClub: (team) => openClubSheet(this.session, team) }),
      h('button', {
        type: 'button', class: 'btn btn-sm',
        onclick: () => this.navigate(SCREENS.LEAGUE, { leagueId: league.id }),
      }, 'Classement complet'),
    );
  }

  renderFull(leagueId) {
    const league = this.session.getLeague(leagueId) ?? this.session.playerLeague;
    const def = getLeagueDefinition(league.id);
    const rows = getStandings(this.session, league);
    return h(
      'div',
      { class: 'hub-page' },
      h(
        'header',
        { class: 'hub-page-header' },
        h('p', { class: 'eyebrow' }, `${getCountry(def.countryId)?.name ?? ''} · ${this.renderSeasonLine() ?? ''}`),
        h('h1', {}, def.name),
        h('p', { class: 'hub-page-subtitle' }, `${rows.length} équipes · journée ${league.roundsPlayed} / ${league.schedule.length} disputée${league.roundsPlayed > 1 ? 's' : ''}.`),
      ),
      h('div', { class: 'button-row league-switch' },
        h('button', { type: 'button', class: 'btn btn-sm', onclick: () => this.navigate(SCREENS.LEAGUE) }, '◂ Tous les classements'),
        getLeaguesByTier(this.session).filter((other) => other !== league).map((other) => h('button', {
          type: 'button', class: 'btn btn-sm btn-ghost', onclick: () => this.navigate(SCREENS.LEAGUE, { leagueId: other.id }),
        }, getLeagueDefinition(other.id).name))),
      LeagueTable(rows, { onOpenClub: (team) => openClubSheet(this.session, team) }),
      h('p', { class: 'muted league-note' }, 'Cliquez sur un club pour voir son effectif. ▲ / ▼ : zones de montée et de descente. À égalité de points, ordre alphabétique (départages à définir).'),
    );
  }
}
