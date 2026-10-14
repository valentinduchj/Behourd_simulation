import { h } from '../../utils/dom.js';
import { SCREENS } from '../../core/screenIds.js';
import { getLeagueDefinition, getLeaguesByTier, getCountry } from '../../systems/league/LeagueService.js';
import { getStandings } from '../../systems/league/StandingsService.js';
import { getSeasonProgress } from '../../systems/league/SeasonService.js';
import { HubScreen } from './HubScreen.js';
import { LeagueTable } from '../components/LeagueTable.js';
import { openClubSheet } from '../components/ClubSheet.js';

const PREVIEW_SIZE = 5;

/**
 * La Ligue : aperçu des trois divisions (5 premiers de chacune) et classement complet
 * d'une division (params.leagueId). Les zones de montée / descente sont calculées par
 * StandingsService ; cet écran ne connaît pas les règles.
 */
export class LeagueScreen extends HubScreen {
  static hubLocationId = 'league';

  renderContent() {
    return this.params.leagueId ? this.renderFull(this.params.leagueId) : this.renderOverview();
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
          ? `Votre compagnie est ${playerRow.position}${playerRow.position === 1 ? 're' : 'e'} de ${getLeagueDefinition(current.id).name}.`
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
