import { h } from '../../utils/dom.js';
import { SPECIALTIES, SPECIALTY_IDS } from '../../data/specialties.js';
import { HubScreen } from './HubScreen.js';
import { FighterCard } from '../components/FighterCard.js';
import { openFighterSheet, buildFighterSheet } from '../components/FighterSheet.js';
import { getRosterSize, isRosterFull } from '../../systems/roster/RosterService.js';
import { ClubHistory } from '../components/ClubHistory.js';
import { FighterStars } from '../components/Rating.js';
import { FighterName } from '../components/CaptainCrown.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';
import { fatigueLevelClass } from '../../systems/fighters/FatigueService.js';
import { getStat } from '../../systems/fighters/stats.js';
import { getListMetric, TeamMetricPicker } from '../mobile/TeamMetric.js';

/** La Compagnie : effectif du joueur, groupé par spécialité. */
export class TeamScreen extends HubScreen {
  static hubLocationId = 'team';

  renderContent() {
    if (this.mobile) return this.renderMobile();
    const fighters = this.session.playerFighters;
    const size = getRosterSize(this.session);
    const groups = SPECIALTY_IDS.map((specialtyId) => {
      const members = fighters.filter((fighter) => fighter.specialtyId === specialtyId);
      if (!members.length) return null;
      const specialty = SPECIALTIES[specialtyId];
      return h(
        'section',
        { class: 'roster-group', style: { '--spec-color': specialty.color } },
        h(
          'header',
          { class: 'roster-group-header' },
          h('h3', { class: 'roster-group-title' }, h('span', { 'aria-hidden': 'true' }, specialty.icon), specialty.pluralName),
          h('span', { class: 'roster-group-count' }, String(members.length)),
          h('p', { class: 'roster-group-desc' }, specialty.shortDescription),
        ),
        h('div', { class: 'roster-grid' }, members.map((fighter) =>
          FighterCard(fighter, this.team, { onOpen: (f) => this.openSheet(f) }))),
      );
    });

    return h(
      'div',
      { class: 'hub-page' },
      h(
        'header',
        { class: 'hub-page-header' },
        h('h1', {}, 'La Compagnie'),
        h('p', { class: 'hub-page-subtitle' }, `Cliquez sur un combattant pour ouvrir sa fiche.`),
        h('p', { class: `roster-size ${isRosterFull(this.session) ? 'is-full' : ''}`.trim() },
          `Effectif : ${size.count} / ${size.max} combattants${isRosterFull(this.session) ? ' — complet' : ''}`),
      ),
      groups,
      h('div', { class: 'hub-card team-history' }, ClubHistory(this.session, this.team.id, { title: 'Historique de la compagnie' })),
    );
  }

  /**
   * Interface mobile (v0.83, maquette « C ») : filtres par classe, la liste à gauche et la fiche
   * complète du combattant choisi à droite — sans fenêtre à ouvrir.
   */
  renderMobile() {
    const fighters = this.session.playerFighters;
    const size = getRosterSize(this.session);
    this.classFilter ??= 'all';
    const listed = this.classFilter === 'all' ? fighters : fighters.filter((f) => f.specialtyId === this.classFilter);
    if (!listed.some((f) => f.id === this.selectedFighterId)) this.selectedFighterId = listed[0]?.id ?? null;
    const selected = listed.find((f) => f.id === this.selectedFighterId) ?? null;

    const chip = (id, label, count) => h('button', {
      type: 'button', class: `m-chip ${this.classFilter === id ? 'is-active' : ''}`.trim(), 'aria-pressed': String(this.classFilter === id),
      onclick: () => { this.classFilter = id; this.refreshContent(); },
    }, `${label} · ${count}`);

    const metric = getListMetric();
    const list = h('ul', { class: 'm-team-list', 'aria-label': 'Combattants', 'data-metric': metric.id }, listed.map((fighter) => {
      return h('li', {}, h('button', {
        type: 'button', class: `m-team-row ${fighter.id === this.selectedFighterId ? 'is-active' : ''}`.trim(),
        'data-fighter-id': fighter.id, 'aria-pressed': String(fighter.id === this.selectedFighterId),
        style: { '--spec-color': fighter.specialty?.color },
        onclick: () => { this.selectedFighterId = fighter.id; this.refreshContent(); },
      },
      h('span', { class: 'm-team-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'm-team-who' },
        h('span', { class: 'm-team-name' }, FighterName(fighter, { session: this.session })),
        h('span', { class: 'm-team-sub' }, fighter.specialty?.name ?? '', ' ', FighterStars(calculateFighterLevel(fighter)))),
      metric.render(fighter)));
    }));

    let detail = h('p', { class: 'muted' }, 'Aucun combattant.');
    if (selected) {
      const sheet = buildFighterSheet(this.session, selected, { onChange: () => this.refreshContent() });
      detail = h('section', { class: 'm-team-sheet', 'aria-label': `Fiche de ${selected.name}` },
        sheet.title,
        sheet.body,
        h('div', { class: 'm-team-actions' },
          h('button', {
            type: 'button', class: 'btn btn-danger', disabled: !sheet.dismissal.ok, title: sheet.dismissal.reason,
            onclick: () => sheet.dismiss(),
          }, 'Congédier')));
    }

    return h(
      'div',
      { class: 'hub-page m-team-page' },
      h('header', { class: 'm-team-head' },
        h('h1', {}, 'La Compagnie'),
        h('span', { class: `roster-size ${isRosterFull(this.session) ? 'is-full' : ''}`.trim() }, `${size.count} / ${size.max}`),
        TeamMetricPicker(() => this.refreshContent()),
        h('div', { class: 'm-chips' },
          chip('all', 'Tous', fighters.length),
          ...SPECIALTY_IDS.map((id) => chip(id, SPECIALTIES[id].pluralName, fighters.filter((f) => f.specialtyId === id).length)))),
      h('div', { class: 'm-team-split' }, list, detail),
    );
  }

  mounted() {
    super.mounted();
  }

  openSheet(fighter) {
    openFighterSheet(this.session, fighter, { onChange: () => this.refreshContent() });
  }
}
