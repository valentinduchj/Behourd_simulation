import { h } from '../../utils/dom.js';
import { SPECIALTIES, SPECIALTY_IDS } from '../../data/specialties.js';
import { HubScreen } from './HubScreen.js';
import { FighterCard } from '../components/FighterCard.js';
import { openFighterSheet } from '../components/FighterSheet.js';
import { getRosterSize, isRosterFull } from '../../systems/roster/RosterService.js';
import { ClubHistory } from '../components/ClubHistory.js';

/** La Compagnie : effectif du joueur, groupé par spécialité. */
export class TeamScreen extends HubScreen {
  static hubLocationId = 'team';

  renderContent() {
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

  mounted() {
    super.mounted();
  }

  openSheet(fighter) {
    openFighterSheet(this.session, fighter, { onChange: () => this.refreshContent() });
  }
}
