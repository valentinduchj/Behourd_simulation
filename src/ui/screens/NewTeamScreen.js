import { h } from '../../utils/dom.js';
import { SCREENS } from '../../core/screenIds.js';
import { PALETTE, getPaletteColor } from '../../data/palette.js';
import { EMBLEM_PATTERNS, DEFAULT_PATTERN_ID } from '../../data/emblemPatterns.js';
import { Emblem, EMBLEM_COLOR_SLOTS, DEFAULT_EMBLEM_COLORS } from '../../models/Emblem.js';
import { normalizeTeamName, validateTeamName } from '../../systems/game/teamFactory.js';
import { generateTeamName } from '../../systems/generation/NameGenerator.js';
import { getCountry, getLeagueDefinition } from '../../systems/league/LeagueService.js';
import { DEFAULT_LEAGUE_ID } from '../../data/leagues.js';
import { getLocation } from '../../systems/geography/LocationService.js';
import { BaseScreen } from './BaseScreen.js';
import { EmblemView } from '../components/EmblemView.js';

export class NewTeamScreen extends BaseScreen {
  constructor(context) {
    super(context);
    // Brouillon (rétabli au retour de l'étape « capitaine »).
    const saved = this.params.draft ?? {};
    this.draft = {
      name: saved.name ?? '',
      colors: { ...DEFAULT_EMBLEM_COLORS, ...(saved.colors ?? {}) },
      patternId: saved.patternId ?? DEFAULT_PATTERN_ID,
    };
    this.activeSlot = EMBLEM_COLOR_SLOTS[0].key;
    // Ligue choisie à l'étape précédente (carte de l'Europe).
    this.leagueDef = getLeagueDefinition(this.params.leagueId) ?? getLeagueDefinition(DEFAULT_LEAGUE_ID);
    this.country = getCountry(this.leagueDef.countryId);
    // Lieu de départ choisi sur la carte des Terres (transmis jusqu'à la création de la partie).
    this.location = getLocation(this.params.locationId);
  }

  render() {
    const { nameMaxLength } = this.services.config.team;

    this.nameInput = h('input', {
      id: 'team-name', class: 'input input-lg', type: 'text', maxlength: nameMaxLength, value: this.draft.name,
      placeholder: 'Ex. : Les Loups de Rouen', autocomplete: 'off',
      oninput: () => {
        this.draft.name = this.nameInput.value;
        this.errorEl.textContent = '';
        this.renderPreview();
      },
    });
    this.errorEl = h('p', { class: 'form-error', role: 'alert' });
    this.slotsHost = h('div', { class: 'color-slots', role: 'radiogroup', 'aria-label': 'Couleur à modifier' });
    this.paletteHost = h('div', { class: 'palette' });
    this.patternsHost = h('div', { class: 'pattern-list' });
    this.previewHost = h('div', { class: 'emblem-preview-shield' });
    this.previewName = h('p', { class: 'emblem-preview-name' });
    this.previewColors = h('ul', { class: 'emblem-preview-colors' });

    const form = h(
      'form',
      { class: 'new-team-form panel', novalidate: true, onsubmit: (event) => { event.preventDefault(); this.submit(); } },
      h(
        'div',
        { class: 'form-field' },
        h('label', { class: 'field-label', for: 'team-name' }, 'Nom de l’équipe'),
        h(
          'div',
          { class: 'input-with-action' },
          this.nameInput,
          h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => this.suggestName() }, 'Suggérer'),
        ),
        this.errorEl,
      ),
      h(
        'fieldset',
        { class: 'form-field' },
        h('legend', { class: 'field-label' }, 'Couleurs de l’emblème'),
        h('p', { class: 'field-help' }, 'Choisissez un emplacement, puis une couleur de la palette.'),
        this.slotsHost,
        this.paletteHost,
      ),
      h(
        'fieldset',
        { class: 'form-field' },
        h('legend', { class: 'field-label' }, 'Partition de l’écu'),
        this.patternsHost,
      ),
      h(
        'div',
        { class: 'form-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => this.navigate(SCREENS.NEW_GAME, { countryId: this.country?.id, locationId: this.location?.id }) }, 'Retour'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, 'Continuer : le capitaine ▸'),
      ),
    );

    const preview = h(
      'aside',
      { class: 'emblem-preview panel', 'aria-label': 'Aperçu de l’emblème' },
      h('p', { class: 'eyebrow' }, 'Aperçu'),
      this.previewHost,
      this.previewName,
      this.previewColors,
    );

    this.refresh();
    return h(
      'section',
      { class: 'screen screen-new-team' },
      h(
        'header',
        { class: 'screen-header' },
        h('p', { class: 'eyebrow' }, `Nouvelle partie · Étape 2 sur 3 · ${this.country?.name ?? ''} — ${this.leagueDef.name}${this.location ? ` · ${this.location.name}` : ''}`),
        h('h1', {}, 'Nouvelle compagnie'),
        h('p', { class: 'screen-subtitle' }, 'Donnez un nom et des couleurs à votre équipe. Vous créerez ensuite son capitaine.'),
      ),
      h('div', { class: 'new-team-layout' }, form, preview),
    );
  }

  mounted() {
    this.nameInput.focus();
  }

  buildEmblem(patternId = this.draft.patternId) {
    return new Emblem({ colors: { ...this.draft.colors }, patternId });
  }

  selectColor(colorId) {
    const { colors } = this.draft;
    // Une couleur déjà utilisée par un autre emplacement est échangée.
    const otherSlot = EMBLEM_COLOR_SLOTS.find(({ key }) => key !== this.activeSlot && colors[key] === colorId);
    if (otherSlot) colors[otherSlot.key] = colors[this.activeSlot];
    colors[this.activeSlot] = colorId;

    const index = EMBLEM_COLOR_SLOTS.findIndex(({ key }) => key === this.activeSlot);
    this.activeSlot = EMBLEM_COLOR_SLOTS[(index + 1) % EMBLEM_COLOR_SLOTS.length].key;
    this.refresh();
  }

  suggestName() {
    this.nameInput.value = generateTeamName(Math.random);
    this.draft.name = this.nameInput.value;
    this.errorEl.textContent = '';
    this.renderPreview();
  }

  submit() {
    const name = normalizeTeamName(this.draft.name);
    const problem = validateTeamName(name);
    if (problem) {
      this.errorEl.textContent = problem;
      this.nameInput.focus();
      return;
    }
    // Étape suivante : création du capitaine (la partie est créée à la fin de cette étape).
    this.navigate(SCREENS.NEW_CAPTAIN, {
      teamName: name,
      emblem: { colors: { ...this.draft.colors }, patternId: this.draft.patternId },
      leagueId: this.leagueDef.id,
      captainDraft: this.params.captainDraft ?? null,
      locationId: this.location?.id ?? null,
    });
  }

  refresh() {
    this.renderSlots();
    this.renderPalette();
    this.renderPatterns();
    this.renderPreview();
  }

  renderSlots() {
    this.slotsHost.replaceChildren(
      ...EMBLEM_COLOR_SLOTS.map((slot) => {
        const color = getPaletteColor(this.draft.colors[slot.key]);
        const active = slot.key === this.activeSlot;
        return h(
          'button',
          {
            type: 'button', role: 'radio', 'aria-checked': String(active),
            class: `color-slot ${active ? 'is-active' : ''}`.trim(),
            onclick: () => { this.activeSlot = slot.key; this.refresh(); },
          },
          h('span', { class: 'color-slot-swatch', style: { background: color.hex } }),
          h(
            'span',
            { class: 'color-slot-text' },
            h('span', { class: 'color-slot-label' }, slot.label),
            h('span', { class: 'color-slot-name' }, color.name),
          ),
        );
      }),
    );
  }

  renderPalette() {
    this.paletteHost.replaceChildren(
      ...PALETTE.map((color) => {
        const slotIndex = EMBLEM_COLOR_SLOTS.findIndex(({ key }) => this.draft.colors[key] === color.id);
        return h(
          'button',
          {
            type: 'button',
            class: `swatch ${slotIndex >= 0 ? 'is-used' : ''}`.trim(),
            style: { background: color.hex },
            title: color.name,
            'aria-label': `${color.name}${slotIndex >= 0 ? ` (couleur ${EMBLEM_COLOR_SLOTS[slotIndex].label.toLowerCase()})` : ''}`,
            onclick: () => this.selectColor(color.id),
          },
          slotIndex >= 0 ? h('span', { class: 'swatch-marker' }, String(slotIndex + 1)) : null,
        );
      }),
    );
  }

  renderPatterns() {
    this.patternsHost.replaceChildren(
      ...EMBLEM_PATTERNS.map((pattern) => {
        const selected = pattern.id === this.draft.patternId;
        return h(
          'button',
          {
            type: 'button', 'aria-pressed': String(selected),
            class: `pattern-option ${selected ? 'is-active' : ''}`.trim(),
            onclick: () => { this.draft.patternId = pattern.id; this.refresh(); },
          },
          EmblemView(this.buildEmblem(pattern.id), { size: 40, title: pattern.label }),
          h('span', {}, pattern.label),
        );
      }),
    );
  }

  renderPreview() {
    this.previewHost.replaceChildren(EmblemView(this.buildEmblem(), { size: 170, title: 'Aperçu de l’emblème' }));
    this.previewName.textContent = normalizeTeamName(this.draft.name) || 'Votre compagnie';
    this.previewColors.replaceChildren(
      ...EMBLEM_COLOR_SLOTS.map((slot) => {
        const color = getPaletteColor(this.draft.colors[slot.key]);
        return h('li', {}, h('span', { class: 'dot', style: { background: color.hex } }), `${slot.label} : ${color.name}`);
      }),
    );
  }
}
