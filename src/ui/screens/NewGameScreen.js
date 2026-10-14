import { h } from '../../utils/dom.js';
import { SCREENS } from '../../core/screenIds.js';
import { getCountry, getLeagueDefinitionsOfCountry, getSeasonFormat } from '../../systems/league/LeagueService.js';
import { getLand, getMapLands, hasLandMap } from '../../systems/geography/LandService.js';
import { getLocation, getStartLocations, isStartLocation } from '../../systems/geography/LocationService.js';
import { BaseScreen } from './BaseScreen.js';
import { EuropeMap } from '../components/EuropeMap.js';
import { LandMap } from '../components/LandMap.js';

/**
 * Nouvelle partie, étape 1 : le pays sur la carte de l'Europe, puis la Terre et le lieu de
 * départ sur la carte du pays. La compagnie débute toujours dans la division de départ.
 * params : { countryId?, locationId? } (retour depuis l'étape 2 : la carte du pays est rouverte).
 */
export class NewGameScreen extends BaseScreen {
  constructor(context) {
    super(context);
    const location = isStartLocation(this.params.locationId) ? getLocation(this.params.locationId) : null;
    this.countryId = this.params.countryId ?? null;
    this.landId = location?.landId ?? null;
    this.locationId = location?.id ?? null;
    this.step = location && hasLandMap(this.countryId) ? 'lands' : 'europe';
  }

  render() {
    this.mapHost = h('div', { class: 'map-frame' });
    this.panelHost = h('aside', { class: 'league-panel panel', 'aria-live': 'polite' });
    this.titleEl = h('h1', {});
    this.subtitleEl = h('p', { class: 'screen-subtitle' });
    this.actionsHost = h('div', { class: 'screen-actions' });
    this.refresh();
    return h(
      'section',
      { class: 'screen screen-new-game' },
      h('header', { class: 'screen-header' }, h('p', { class: 'eyebrow' }, 'Nouvelle partie · Étape 1 sur 3'), this.titleEl, this.subtitleEl),
      h('div', { class: 'new-game-layout' }, this.mapHost, this.panelHost),
      this.actionsHost,
    );
  }

  /** Division de départ du pays : toute carrière y commence, les autres s'atteignent par promotion. */
  startLeague(countryId = this.countryId) {
    const leagues = getLeagueDefinitionsOfCountry(countryId);
    return { leagues, start: leagues.find((league) => league.playerStart) ?? leagues[leagues.length - 1] };
  }

  selectCountry(country) {
    this.countryId = country.id;
    this.refresh();
    this.panelHost.querySelector('.btn-start')?.focus();
  }

  selectLand(land) {
    if (land.id !== this.landId) this.locationId = null;
    this.landId = land.id;
    this.refresh();
  }

  selectLocation(location) {
    this.landId = location.landId;
    this.locationId = location.id;
    this.refresh();
    this.panelHost.querySelector('.btn-start')?.focus();
  }

  showStep(step) {
    this.step = step;
    this.refresh();
  }

  start() {
    this.navigate(SCREENS.NEW_TEAM, { countryId: this.countryId, leagueId: this.startLeague().start.id, locationId: this.locationId });
  }

  refresh() {
    const lands = this.step === 'lands';
    this.titleEl.textContent = lands ? 'Choisissez votre Terre' : 'Choisissez votre championnat';
    this.subtitleEl.textContent = lands
      ? 'Choisissez une Terre sur la carte, puis le lieu où votre compagnie s’installe.'
      : 'Sélectionnez un pays sur la carte de l’Europe.';
    this.mapHost.replaceChildren(lands
      ? LandMap({
        countryId: this.countryId, selectedLandId: this.landId, selectedLocationId: this.locationId,
        onSelectLand: (land) => this.selectLand(land), onSelectLocation: (location) => this.selectLocation(location),
      })
      : EuropeMap({ onSelect: (country) => this.selectCountry(country), selectedId: this.countryId }));
    this.panelHost.replaceChildren(...(lands ? this.renderLandPanel() : this.renderCountryPanel()));
    this.actionsHost.replaceChildren(lands
      ? h('button', { type: 'button', class: 'btn', onclick: () => this.showStep('europe') }, '◂ Carte de l’Europe')
      : h('button', { type: 'button', class: 'btn', onclick: () => this.navigate(SCREENS.MAIN_MENU) }, 'Retour au menu'));
  }

  renderCountryPanel() {
    const country = this.countryId ? getCountry(this.countryId) : null;
    if (!country) {
      return [
        h('h2', { class: 'section-title' }, 'Pays'),
        h('p', {}, 'Cliquez sur un pays disponible.'),
        h('p', { class: 'muted' }, 'Pour cette version, seule la France est jouable. Les autres championnats arriveront plus tard.'),
      ];
    }

    const { leagues, start } = this.startLeague(country.id);
    const format = getSeasonFormat();
    const withLands = hasLandMap(country.id);
    return [
      h('p', { class: 'eyebrow' }, 'Pays sélectionné'),
      h('h2', { class: 'section-title' }, country.name),
      h('p', {}, `Votre compagnie débute en ${start.name}. Chaque division compte ${format.teamCount} équipes : ${format.matchdays} journées, chacun rencontre une fois chaque adversaire. Les ${format.promotionCount} premiers montent, les ${format.relegationCount} derniers descendent.`),
      h(
        'div',
        { class: 'league-options' },
        leagues.map((league) => h(
          'div',
          { class: `league-option is-info ${league === start ? 'is-start' : 'is-locked'}`.trim() },
          h('span', { class: 'league-option-icon', 'aria-hidden': 'true' }, league === start ? '⚑' : '▲'),
          h(
            'span',
            { class: 'league-option-text' },
            h('span', { class: 'league-option-name' }, league.name),
            h('span', { class: 'league-option-status' }, league === start ? 'Division de départ' : 'Accessible par promotion'),
          ),
        )),
      ),
      h('button', {
        type: 'button', class: 'btn btn-primary btn-start',
        onclick: () => (withLands ? this.showStep('lands') : this.start()),
      }, withLands ? 'Choisir sa Terre ▸' : `Commencer en ${start.name} ▸`),
    ];
  }

  renderLandPanel() {
    const land = getLand(this.landId);
    if (!land) {
      return [
        h('p', { class: 'eyebrow' }, getCountry(this.countryId)?.name ?? ''),
        h('h2', { class: 'section-title' }, 'Les Terres'),
        h('p', {}, 'Cliquez sur une Terre de la carte ou de la liste.'),
        h('div', { class: 'land-options' }, getMapLands(this.countryId).map((option) => h(
          'button',
          { type: 'button', class: 'land-option', style: { '--land-color': option.color }, onclick: () => this.selectLand(option) },
          h('span', { class: 'land-option-swatch', 'aria-hidden': 'true' }),
          h('span', { class: 'land-option-text' },
            h('span', { class: 'land-option-name' }, option.name),
            h('span', { class: 'land-option-regions' }, option.regions.join(', '))),
        ))),
      ];
    }

    const location = getLocation(this.locationId);
    return [
      h('p', {}, h('span', { class: 'land-pill', style: { '--land-color': land.color } }, land.shortName)),
      h('h2', { class: 'section-title' }, land.name),
      h('p', { class: 'muted' }, land.regions.join(', ')),
      h('p', {}, 'Choisissez le lieu où votre compagnie s’installe.'),
      h('div', { class: 'land-options' }, getStartLocations(land.id).map((option) => h(
        'button',
        {
          type: 'button', class: `location-option ${option.id === this.locationId ? 'is-selected' : ''}`.trim(),
          style: { '--land-color': land.color }, 'aria-pressed': String(option.id === this.locationId), 'data-location': option.id,
          onclick: () => this.selectLocation(option),
          onmouseenter: () => this.highlightPoi(option.id, true),
          onmouseleave: () => this.highlightPoi(option.id, false),
        },
        h('span', { class: 'location-option-marker', 'aria-hidden': 'true' }, '⚑'),
        h('span', { class: 'land-option-name' }, option.name),
      ))),
      location
        ? h('button', { type: 'button', class: 'btn btn-primary btn-start', onclick: () => this.start() }, `S’installer : ${location.name} ▸`)
        : h('p', { class: 'muted' }, 'Aucun lieu choisi.'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-change-land', onclick: () => { this.landId = null; this.locationId = null; this.refresh(); } }, '◂ Changer de Terre'),
    ];
  }

  highlightPoi(locationId, on) {
    this.mapHost.querySelector(`.poi[data-location="${locationId}"]`)?.classList.toggle('is-hover', on);
  }
}
