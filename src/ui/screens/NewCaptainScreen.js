import { h } from '../../utils/dom.js';
import { ofClub } from '../../utils/format.js';
import { SCREENS } from '../../core/screenIds.js';
import { SPECIALTIES, SPECIALTY_IDS } from '../../data/specialties.js';
import { CAPTAIN_CONFIG } from '../../data/captain.js';
import { getSprite, isValidSprite, resolveSpriteId } from '../../data/sprites.js';
import { Emblem } from '../../models/Emblem.js';
import { createNewGame } from '../../systems/game/newGame.js';
import { getCaptainSpriteChoices, validateCaptainDraft } from '../../systems/roster/CaptainService.js';
import { normalizeFighterName } from '../../systems/roster/rosterSystem.js';
import { composeFighterName, generateFighterName } from '../../systems/generation/NameGenerator.js';
import { getCountry, getLeagueDefinition } from '../../systems/league/LeagueService.js';
import { DEFAULT_LEAGUE_ID } from '../../data/leagues.js';
import { BaseScreen } from './BaseScreen.js';
import { FighterSprite } from '../components/FighterSprite.js';
import { CaptainCrown } from '../components/CaptainCrown.js';
import { EmblemView } from '../components/EmblemView.js';
import { alertModal } from '../components/Modal.js';

/**
 * Nouvelle partie, étape 3 : création du premier combattant, le capitaine.
 * Le joueur choisit sa spécialité, son apparence (définitive) et son nom. Les règles du
 * capitaine (compétences, âge, potentiel, statut) sont appliquées par CaptainService.
 *
 * params : { teamName, emblem: { colors, patternId }, leagueId, locationId, captainDraft? }
 */
export class NewCaptainScreen extends BaseScreen {
  constructor(context) {
    super(context);
    this.leagueDef = getLeagueDefinition(this.params.leagueId) ?? getLeagueDefinition(DEFAULT_LEAGUE_ID);
    this.country = getCountry(this.leagueDef.countryId);
    this.emblem = new Emblem(this.params.emblem ?? {});
    // Apparences proposées : les 4 variantes de la classe choisie (data/sprites.js). Un ancien
    // brouillon peut encore porter la liste de sprites tirés de la v0.14 : elle est ignorée.
    const { spriteChoices: _legacyChoices, ...draft } = this.params.captainDraft ?? {};
    this.draft = { name: '', specialtyId: null, spriteId: null, ...draft };
    this.ensureSpriteMatchesClass();
  }

  render() {
    const { nameMaxLength } = this.services.config.fighter;
    const rules = CAPTAIN_CONFIG.player;
    this.nameInput = h('input', {
      id: 'captain-name', class: 'input input-lg', type: 'text', maxlength: nameMaxLength, value: this.draft.name,
      placeholder: 'Ex. : Arthur', autocomplete: 'off', spellcheck: 'false',
      oninput: () => { this.draft.name = this.nameInput.value; this.errorEl.textContent = ''; this.renderPreview(); },
    });
    this.errorEl = h('p', { class: 'form-error', role: 'alert' });
    this.specialtyHost = h('div', { class: 'captain-specialties', role: 'radiogroup', 'aria-label': 'Spécialité' });
    this.spriteHost = h('div', { class: 'captain-sprites', role: 'radiogroup', 'aria-label': 'Apparence' });
    this.previewHost = h('div', { class: 'captain-preview-body' });

    const form = h(
      'form',
      { class: 'new-team-form panel', novalidate: true, onsubmit: (event) => { event.preventDefault(); this.submit(); } },
      h('fieldset', { class: 'form-field' }, h('legend', { class: 'field-label' }, 'Spécialité'), this.specialtyHost),
      h(
        'fieldset',
        { class: 'form-field' },
        h('legend', { class: 'field-label' }, 'Apparence'),
        h('p', { class: 'field-help' }, 'Les apparences dépendent de la spécialité. L’apparence est définitive.'),
        this.spriteHost,
      ),
      h(
        'div',
        { class: 'form-field' },
        h('label', { class: 'field-label', for: 'captain-name' }, 'Nom du combattant'),
        h('div', { class: 'input-with-action' }, this.nameInput,
          h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => this.suggestName() }, 'Suggérer')),
        this.errorEl,
      ),
      h('p', { class: 'muted captain-rules' },
        `Votre capitaine a ${rules.age} ans et un potentiel d’au moins ${rules.minPotential} flammes. Ses compétences sont tirées à la création. Sept autres combattants rejoindront ensuite la compagnie.`),
      h(
        'div',
        { class: 'form-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => this.back() }, 'Retour'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, 'Créer le capitaine et commencer'),
      ),
    );

    this.refresh();
    return h(
      'section',
      { class: 'screen screen-new-team screen-new-captain' },
      h(
        'header',
        { class: 'screen-header' },
        h('p', { class: 'eyebrow' }, `Nouvelle partie · Étape 3 sur 3 · ${this.country?.name ?? ''} — ${this.leagueDef.name}`),
        h('h1', {}, 'Votre capitaine'),
        h('p', { class: 'screen-subtitle' }, `Créez le premier combattant ${this.params.teamName ? ofClub(this.params.teamName) : 'de votre compagnie'}. Il en sera le capitaine.`),
      ),
      h('div', { class: 'new-team-layout' }, form, h('aside', { class: 'emblem-preview panel captain-preview', 'aria-label': 'Aperçu du capitaine' }, h('p', { class: 'eyebrow' }, 'Aperçu'), this.previewHost)),
    );
  }

  mounted() {
    this.nameInput.focus();
  }

  refresh() {
    this.specialtyHost.replaceChildren(...SPECIALTY_IDS.map((id) => {
      const specialty = SPECIALTIES[id];
      const selected = this.draft.specialtyId === id;
      return h(
        'button',
        {
          type: 'button', role: 'radio', 'aria-checked': String(selected), 'data-specialty': id,
          class: `captain-option ${selected ? 'is-active' : ''}`.trim(), style: { '--spec-color': specialty.color },
          onclick: () => { this.selectSpecialty(id); },
        },
        h('span', { class: 'captain-option-icon', 'aria-hidden': 'true' }, specialty.icon),
        h('span', { class: 'captain-option-name' }, specialty.name),
        h('span', { class: 'captain-option-desc' }, specialty.shortDescription),
      );
    }));
    const spriteChoices = getCaptainSpriteChoices(this.draft.specialtyId);
    if (!spriteChoices.length) {
      this.spriteHost.replaceChildren(h('p', { class: 'muted captain-sprites-empty' }, 'Choisissez d’abord une spécialité.'));
      this.renderPreview();
      return;
    }
    this.spriteHost.replaceChildren(...spriteChoices.map((spriteId) => {
      const selected = this.draft.spriteId === spriteId;
      return h(
        'button',
        {
          type: 'button', role: 'radio', 'aria-checked': String(selected), 'data-sprite': spriteId,
          class: `captain-sprite ${selected ? 'is-active' : ''}`.trim(), title: getSprite(spriteId)?.name,
          onclick: () => { this.draft.spriteId = spriteId; this.errorEl.textContent = ''; this.refresh(); },
        },
        FighterSprite({ spriteId, stats: {} }, { size: 84, colors: this.emblem.resolvedColors(), colorIntensity: 1 }),
        h('span', { class: 'captain-sprite-label' }, `${SPECIALTIES[this.draft.specialtyId].name} ${getSprite(spriteId).variant}`),
      );
    }));
    this.renderPreview();
  }

  renderPreview() {
    if (!this.previewHost) return;
    const specialty = this.draft.specialtyId ? SPECIALTIES[this.draft.specialtyId] : null;
    const name = normalizeFighterName(this.draft.name);
    this.previewHost.replaceChildren(
      EmblemView(this.emblem, { size: 64, title: this.params.teamName }),
      this.draft.spriteId ? FighterSprite({ spriteId: this.draft.spriteId, stats: {} }, { size: 140, colors: this.emblem.resolvedColors(), colorIntensity: 1 }) : h('div', { class: 'captain-preview-empty' }, '?'),
      h('p', { class: 'emblem-preview-name fighter-name-line' }, h('span', { class: 'fighter-name-text' }, name || 'Votre capitaine'), CaptainCrown()),
      h('p', { class: 'muted' }, specialty ? `${specialty.icon} ${specialty.name}` : 'Spécialité à choisir'),
    );
  }

  /**
   * Changement de spécialité : les apparences proposées deviennent celles de la nouvelle classe ;
   * une apparence déjà choisie, devenue incompatible, est remplacée (même variante).
   */
  selectSpecialty(specialtyId) {
    this.draft.specialtyId = specialtyId;
    this.ensureSpriteMatchesClass();
    this.errorEl.textContent = '';
    this.refresh();
  }

  ensureSpriteMatchesClass() {
    const { specialtyId, spriteId } = this.draft;
    if (!specialtyId) { this.draft.spriteId = null; return; }
    if (spriteId && !isValidSprite(specialtyId, spriteId)) this.draft.spriteId = resolveSpriteId(specialtyId, spriteId);
  }

  suggestName() {
    this.nameInput.value = composeFighterName(generateFighterName(Math.random, new Set()));
    this.draft.name = this.nameInput.value;
    this.errorEl.textContent = '';
    this.renderPreview();
  }

  back() {
    this.navigate(SCREENS.NEW_TEAM, {
      leagueId: this.leagueDef.id,
      draft: { name: this.params.teamName ?? '', ...(this.params.emblem ?? {}) },
      captainDraft: { ...this.draft },
      locationId: this.params.locationId ?? null,
    });
  }

  submit() {
    const problem = validateCaptainDraft(this.draft, { specialtyIds: SPECIALTY_IDS });
    if (problem) {
      this.errorEl.textContent = problem;
      return;
    }
    let session;
    try {
      session = createNewGame({
        teamName: this.params.teamName,
        emblem: this.emblem,
        leagueId: this.leagueDef.id,
        locationId: this.params.locationId ?? null,
        captain: { name: this.draft.name, specialtyId: this.draft.specialtyId, spriteId: this.draft.spriteId },
      });
    } catch (error) {
      // Ex. fichiers de ligues modifiés dans l'Admin avec un nombre de clubs incorrect.
      alertModal('Impossible de créer la partie', error.message);
      return;
    }
    this.services.gameState.setSession(session);
    this.navigate(SCREENS.TEAM, { justCreated: true });
  }
}
