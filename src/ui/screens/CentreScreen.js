import { h } from '../../utils/dom.js';
import { CENTRE_LAYOUT } from '../../data/centreLayout.js';
import {
  assignActivity, listActivities, getAssignedFighters, describeActivityEffect,
  describeActivityConditions, formatChance, getFreeSlots, isCentreClosed, CENTRE_CLOSED_REASON,
  getActivity, isTrainingUseless, getActivityClosure,
} from '../../systems/activities/ActivityService.js';
import { getCurrentSeason } from '../../systems/climate/ClimateService.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';
import { FighterStars } from '../components/Rating.js';
import { STAT_DEFINITIONS } from '../../data/stats.js';
import { showToast } from '../components/Toast.js';
import { CentreScene } from '../../centre/CentreScene.js';
import { CentreRenderer } from '../../centre/render/CentreRenderer.js';
import { activityAnchor, gainEffectsFromReport } from '../../centre/centreVfx.js';
import { takeSceneEffects } from '../hub/pendingVfx.js';
import {
  describeSort, getActivityConfig, getSortOptions, runQuickAssign, setActivityConfig,
} from '../../systems/activities/ActivityAssignmentService.js';
import { SPECIALTIES, SPECIALTY_IDS } from '../../data/specialties.js';
import { ASSIGNMENT_SORT_COLUMNS, getAssignmentSort, sortFighters, toggleAssignmentSort } from '../hub/assignmentSort.js';
import { HubScreen } from './HubScreen.js';
import { getExitState } from '../../systems/navigation/LocationNavigationService.js';
import { exitAtSignpost } from '../../render/exitMarkers.js';
import { ActivitySelect, activityLabel } from '../components/ActivitySelect.js';
import { SpecialtyBadge, FighterClassTags } from '../components/SpecialtyBadge.js';
import { FighterName } from '../components/CaptainCrown.js';
import { confirmModal, openModal } from '../components/Modal.js';
import { ASSIGNMENT_PRESET_RULES } from '../../data/assignmentPresets.js';
import { isStatMaxed } from '../../systems/fighters/stats.js';
import { getFatigueState, fatigueStateFrom, fatigueStateHint } from '../../systems/fighters/FatigueService.js';
import {
  applyAssignmentPreset, canCreateAssignmentPreset, captureAssignments, createAssignmentPreset, deleteAssignmentPreset,
  describeAssignmentPreset, describePresetIssues, getAssignmentPreset, listAssignmentPresets, updateAssignmentPreset,
} from '../../systems/activities/AssignmentPresetService.js';
import { createFramePacer } from '../../render/framePacing.js';
import { focusField } from '../mobile/mobileLayout.js';
import { attachMapZoom } from '../mobile/MapZoom.js';
import { isMobileLayout } from '../mobile/mobileLayout.js';
import { AssignBoard } from '../mobile/AssignBoard.js';

// Encombrement du panneau de réglage d'un lieu (px), pour l'ouvrir du côté où il tient.
const QUICK_PANEL_SIZE = Object.freeze({ width: 290, height: 250 });

const DEFAULT_HINT = 'Sélectionnez un combattant (dans la scène ou la liste), puis cliquez sur un lieu pour l’y affecter. Les chemins mènent à la Taverne (en haut à droite) et au Bourg (en bas à droite).';

/** Le Centre : scène isométrique où l'on affecte les combattants aux activités. */
/** Marque un bloc du Centre pour le volet du téléphone (partie « places » ou « assignments »). */
function withPart(el, part) {
  el.dataset.sheetPart = part;
  return el;
}

export class CentreScreen extends HubScreen {
  static hubLocationId = 'centre';
  // Interface mobile : carte en plein écran, le reste de la page dans ce volet.
  // Téléphone (v0.92) : deux boutons, « Lieux » et « Affectations », chacun sa partie du volet.
  static mobileSheet = {
    label: 'Lieux et affectations',
    parts: [{ id: 'places', label: 'Lieux', icon: 'places' }, { id: 'assignments', label: 'Affectations', icon: 'assign' }],
  };

  renderContent() {
    this.scene = new CentreScene(this.session);
    this.selectedId = null;
    this.closed = isCentreClosed(this.session);
    this.canvas = h('canvas', { class: 'centre-canvas', 'aria-label': 'Le Centre en vue isométrique' });
    this.hint = this.closed
      ? h('p', { class: 'centre-hint is-closed', role: 'status' }, `⚔ ${CENTRE_CLOSED_REASON} Rendez-vous dans La Lice avec le bouton « COMBATTRE ».`)
      : h('p', { class: 'centre-hint', role: 'status' }, DEFAULT_HINT);
    this.zonesHost = h('div', { class: 'zone-grid' });
    this.rosterHost = h('div', { class: 'centre-roster' });
    this.presetsHost = h('section', { class: 'assignment-presets', 'aria-label': 'Configurations d’affectation' });
    this.renderPanels();

    return h(
      'div',
      { class: 'hub-page' },
      h(
        'header',
        { class: 'hub-page-header' },
        h('h1', {}, 'Le Centre'),
        h('p', { class: 'hub-page-subtitle' }, 'Affectez vos combattants aux différents lieux. Les activités progressent à chaque journée passée.'),
      ),
      h('div', { class: `centre-stage ${this.closed ? 'is-closed' : ''}`.trim() }, this.canvas, this.renderQuickAssign()),
      this.hint,
      h('h2', { class: 'hub-section-title', 'data-sheet-part': 'places' }, 'Lieux'),
      withPart(this.zonesHost, 'places'),
      h('h2', { class: 'hub-section-title', 'data-sheet-part': 'assignments' }, 'Affectations'),
      withPart(this.presetsHost, 'assignments'),
      withPart(this.rosterHost, 'assignments'),
    );
  }

  mounted() {
    super.mounted();
    // Téléphone (v0.91) : pincer pour zoomer, glisser pour se déplacer sur la carte.
    if (isMobileLayout()) this.mapZoom = attachMapZoom(this.canvas, () => this.renderer);
    this.renderer = new CentreRenderer(this.canvas, this.scene);
    // Arrivée par un chemin (retour de la Taverne, du Bourg) : la caméra part de ce bout de chemin.
    if (this.params.arrivalExitId) this.renderer.setArrival(this.params.arrivalExitId);
    this.renderer.resize();
    this.listen(window, 'resize', () => this.renderer.resize());
    this.listen(this.canvas, 'mousemove', (event) => this.onPointerMove(event));
    this.listen(this.canvas, 'mouseleave', () => { this.setHover(null); this.renderer.hoverExitId = null; });
    this.listen(this.canvas, 'click', (event) => this.onClick(event));
    this.listen(window, 'keydown', (event) => { if (event.key === 'Escape') { this.select(null); this.selectActivity(null); } });
    this.listen(this.canvas, 'mouseleave', () => { this.hoverActivityId = null; });

    const draw = createFramePacer();
    const frame = (now) => {
      if (draw(now)) this.drawFrame(now / 1000);
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
    // Sans carnet à refermer : chantiers en attente (achats au Bourg) joués tout de suite.
    if (!this.params.dayReport) this.playSceneEffects(null);
  }

  afterLogbook(report) {
    this.playSceneEffects(report);
  }

  /**
   * Effets visuels du Centre : gains de la journée au-dessus des combattants qui ont réussi
   * leur activité, puis chantiers sur les installations améliorées au Bourg depuis la dernière visite.
   */
  playSceneEffects(report) {
    if (!this.renderer) return;
    const { effects } = this.renderer;
    const { gain, hammer } = effects.config;
    gainEffectsFromReport(report, this.scene).forEach((g, i) => effects.add('gain', g, { delay: 0.2 + i * gain.stagger }));
    takeSceneEffects('centre').forEach((work, i) => {
      const anchor = activityAnchor(this.scene, work.activityId);
      if (anchor) effects.add('hammer', anchor, { delay: 0.3 + i * hammer.stagger });
    });
  }

  unmount() {
    cancelAnimationFrame(this.frameId);
    super.unmount();
  }

  // --- Encadrés des lieux : masqués par défaut, affichés au survol, verrouillés au clic ---
  //
  //   état d'un lieu : HIDDEN (rien) · HOVERED (survol) · SELECTED (clic) ; SELECTED > HOVERED.
  //   Un seul lieu sélectionné à la fois. Ses boutons [+] et [⚙] suivent son encadré.

  /** Lieu dont l'encadré est affiché : le lieu sélectionné, sinon celui survolé (scène ou boutons). */
  get visibleActivityId() {
    return this.selectedActivityId ?? this.overlayHoverId ?? this.hoverActivityId ?? null;
  }

  /** État d'affichage de l'encadré d'un lieu : 'SELECTED' | 'HOVERED' | 'HIDDEN'. */
  panelState(activityId) {
    if (this.selectedActivityId === activityId) return 'SELECTED';
    return this.visibleActivityId === activityId ? 'HOVERED' : 'HIDDEN';
  }

  /** Sélectionne (verrouille) l'encadré d'un lieu ; même lieu ou null : désélection. */
  selectActivity(activityId) {
    this.selectedActivityId = activityId && activityId !== this.selectedActivityId ? activityId : null;
    // La caméra se rapproche du lieu sélectionné ; vue d'ensemble sinon.
    this.renderer?.focusActivity(this.selectedActivityId);
    for (const control of this.quickControls ?? []) {
      if (control.activity.id !== this.selectedActivityId) this.closeQuickPanel(control);
    }
  }

  // --- Boutons [+] et [⚙] de chaque lieu (affectation rapide) ---

  /** Boutons de tous les lieux : [+] (affectation rapide) et [⚙] (réglage du lieu). */
  renderQuickAssign() {
    this.quickControls = listActivities(this.session).map((activity) => this.renderQuickControl(activity));
    // Un clic ailleurs referme le réglage ouvert.
    this.listen(document, 'mousedown', (event) => {
      for (const control of this.quickControls) {
        if (!control.panel.hidden && !control.wrapper.contains(event.target)) this.closeQuickPanel(control);
      }
    });
    return h('div', { class: 'quick-assign-layer' }, this.quickControls.map((control) => control.wrapper));
  }

  renderQuickControl(activity) {
    const plus = h('button', {
      type: 'button', class: 'quick-assign-btn quick-assign-plus', 'data-activity': activity.id, disabled: this.closed,
      onclick: () => this.applyQuickAssign(activity),
    }, '+');
    const panel = h('div', { class: 'quick-assign-panel', hidden: true, role: 'dialog', 'aria-label': `Réglage : ${activity.name}` });
    const gear = h('button', {
      type: 'button', class: 'quick-assign-btn quick-assign-gear', 'data-activity': activity.id, 'aria-label': `Régler ${activity.name}`, title: 'Régler l’affectation rapide',
      'aria-expanded': 'false',
      onclick: () => {
        if (panel.hidden) {
          control.renderPanel();
          panel.hidden = false;
          gear.setAttribute('aria-expanded', 'true');
          focusField(panel.querySelector('select, input'));
        } else this.closeQuickPanel(control);
      },
    }, '⚙');
    const wrapper = h('div', {
      class: 'quick-assign', 'data-activity': activity.id, hidden: true,
      // Le survol des boutons garde l'encadré ouvert (la souris quitte alors la scène).
      onmouseenter: () => { this.overlayHoverId = activity.id; },
      onmouseleave: () => { if (this.overlayHoverId === activity.id && panel.hidden) this.overlayHoverId = null; },
    }, plus, gear, panel);
    const control = {
      activity, wrapper, panel, gear, plus,
      renderPanel: () => panel.replaceChildren(...(activity.quickAssign ? this.thresholdPanel(activity, control) : this.configPanel(activity, control))),
      refreshTitle: () => { plus.title = this.quickAssignTitle(activity); plus.setAttribute('aria-label', plus.title); },
    };
    control.refreshTitle();
    return control;
  }

  closeQuickPanel(control) {
    control.panel.hidden = true;
    control.gear.setAttribute('aria-expanded', 'false');
    if (this.overlayHoverId === control.activity.id && !control.wrapper.matches(':hover')) this.overlayHoverId = null;
  }

  /** Infobulle du bouton [+] : ce qu'il fera, d'après le réglage du lieu. */
  quickAssignTitle(activity) {
    if (activity.quickAssign) {
      return `${activity.name} : y envoyer tous les combattants dont la fatigue dépasse ${this.services.settings.get(activity.quickAssign.settingKey) ?? 0}`;
    }
    const config = getActivityConfig(this.session, activity.id);
    const who = config.targetClass ? `les ${SPECIALTIES[config.targetClass].name}s` : 'les combattants';
    return `${activity.name} : y placer ${who} (${describeSort(activity, config.sortBy, config.sortDirection).toLowerCase()}) dans les places libres`;
  }

  /** Réglage du Banquet : seuil de fatigue du bouton [+] (option enregistrée, de 0 à 100). */
  thresholdPanel(activity, control) {
    const { settingKey } = activity.quickAssign;
    const value = () => this.services.settings.get(settingKey) ?? 0;
    const valueLabel = h('strong', { class: 'quick-assign-value' }, String(value()));
    const help = h('p', { class: 'muted quick-assign-help' });
    const refresh = () => {
      valueLabel.textContent = String(value());
      help.textContent = `Le bouton + envoie au ${activity.name} les combattants dont la fatigue dépasse ${value()} (seuil de 0 à 100).`;
      control.refreshTitle();
    };
    const range = h('input', {
      type: 'range', min: 0, max: 100, step: 1, value: value(), class: 'quick-assign-range', 'aria-label': 'Seuil de fatigue',
      oninput: () => { this.services.settings.set(settingKey, Number(range.value)); refresh(); },
    });
    refresh();
    return [h('p', { class: 'quick-assign-panel-title' }, `${activity.icon} Seuil du bouton +`), h('div', { class: 'quick-assign-range-row' }, range, valueLabel), help];
  }

  /** Réglage d'un lieu : classe ciblée et tri ; « Valider » enregistre et applique. */
  configPanel(activity, control) {
    const config = getActivityConfig(this.session, activity.id);
    const classSelect = h('select', { class: 'select select-sm quick-assign-class', 'aria-label': 'Classe ciblée' },
      h('option', { value: '', selected: !config.targetClass }, 'Toutes les classes'),
      SPECIALTY_IDS.map((id) => h('option', { value: id, selected: config.targetClass === id }, `${SPECIALTIES[id].icon} ${SPECIALTIES[id].name}`)));
    const sortSelect = h('select', { class: 'select select-sm quick-assign-sort', 'aria-label': 'Trier par' },
      getSortOptions(activity).map((option) => h('option', {
        value: `${option.sortBy}:${option.sortDirection}`, selected: option.sortBy === config.sortBy && option.sortDirection === config.sortDirection,
      }, option.label)));
    const free = getFreeSlots(this.session, activity);
    return [
      h('p', { class: 'quick-assign-panel-title' }, `${activity.icon} ${activity.name} — affectation rapide`),
      h('label', { class: 'quick-assign-field' }, h('span', {}, 'Classe'), classSelect),
      h('label', { class: 'quick-assign-field' }, h('span', {}, 'Trier par'), sortSelect),
      h('p', { class: 'muted quick-assign-help' }, Number.isFinite(free)
        ? `Le bouton + place les premiers combattants de la classe dans les places libres (${free} actuellement).`
        : 'Le bouton + place tous les combattants de la classe (places illimitées).'),
      h('div', { class: 'quick-assign-actions' }, h('button', {
        type: 'button', class: 'btn btn-primary btn-sm quick-assign-validate', disabled: this.closed,
        onclick: () => {
          const [sortBy, sortDirection] = sortSelect.value.split(':');
          setActivityConfig(this.session, activity.id, { targetClass: classSelect.value || null, sortBy, sortDirection });
          control.refreshTitle();
          this.closeQuickPanel(control);
          this.applyQuickAssign(activity);
        },
      }, 'Valider')),
    ];
  }

  /** Une image : la scène (avec l'encadré du lieu affiché), puis ses boutons. */
  drawFrame(time = performance.now() / 1000) {
    this.renderer.visibleActivityId = this.visibleActivityId;
    this.renderer.selectedActivityId = this.selectedActivityId;
    this.renderer.render(time);
    this.placeQuickAssign();
  }

  /** Seuls les boutons du lieu affiché sont visibles, à droite de son encadré. */
  placeQuickAssign() {
    const visible = this.visibleActivityId;
    for (const control of this.quickControls ?? []) {
      const box = control.activity.id === visible ? this.renderer.labelBoxes.get(control.activity.id) : null;
      if (!box) {
        if (!control.wrapper.hidden) {
          control.wrapper.hidden = true;
          this.closeQuickPanel(control);
        }
        continue;
      }
      const x = Math.round(this.canvas.offsetLeft + box.left + box.width + 4);
      const y = Math.round(this.canvas.offsetTop + box.top);
      const left = `${x}px`;
      const top = `${y}px`;
      if (control.wrapper.style.left !== left || control.wrapper.style.top !== top) Object.assign(control.wrapper.style, { left, top });
      // Le réglage s'ouvre vers la gauche ou vers le haut s'il manque de place dans la scène.
      control.wrapper.classList.toggle('opens-left', x + QUICK_PANEL_SIZE.width > this.canvas.clientWidth);
      control.wrapper.classList.toggle('opens-up', y + QUICK_PANEL_SIZE.height > this.canvas.clientHeight);
      control.wrapper.hidden = false;
    }
  }

  /** Bouton [+] : raccourci du lieu (seuil du Banquet) ou sa configuration (classe et tri). */
  applyQuickAssign(activity) {
    const threshold = activity.quickAssign ? this.services.settings.get(activity.quickAssign.settingKey) ?? 0 : 0;
    const result = runQuickAssign(this.session, activity.id, { threshold });
    if (!result.ok) {
      showToast(result.reason, 'warning');
      return;
    }
    const n = result.assigned.length;
    const sent = `${n} combattant${n > 1 ? 's' : ''} envoyé${n > 1 ? 's' : ''}`;
    if (result.mode === 'threshold') {
      if (!n && !result.full.length) showToast(`Aucun combattant n’a plus de ${threshold} de fatigue hors du ${activity.name}.`, 'info');
      else showToast(`${sent} au ${activity.name} (fatigue > ${threshold})${result.full.length ? ` ; ${result.full.length} sans place` : ''}.`, n ? 'success' : 'warning');
    } else if (n) {
      showToast(`${activity.name} : ${sent} (${n} place${n > 1 ? 's' : ''} occupée${n > 1 ? 's' : ''}).`, 'success');
    } else {
      showToast(result.free === 0 ? `${activity.name} : plus aucune place libre.` : `${activity.name} : aucun combattant ne correspond au réglage.`, 'info');
    }
    this.scene.refresh();
    this.select(null);
    this.refreshStatus();
  }

  // --- Interaction avec la scène ---

  onPointerMove(event) {
    // Sur l'encadré affiché (et ses boutons) : le lieu reste survolé.
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const box = this.visibleActivityId ? this.renderer.labelBoxes.get(this.visibleActivityId) : null;
    if (box && x >= box.left && x <= box.left + box.width + 64 && y >= box.top && y <= box.top + box.height) {
      this.hoverActivityId = this.visibleActivityId;
      return;
    }
    const tile = this.renderer.pickTile(event.clientX, event.clientY);
    const picked = this.renderer.pickFighter(event.clientX, event.clientY);
    // Bout de chemin vers un autre lieu : indication de destination au survol.
    const exit = this.exitUnder(event, tile);
    this.renderer.hoverExitId = exit?.id ?? null;
    if (exit) {
      this.setHover(null);
      this.canvas.style.cursor = getExitState(exit) === 'open' ? 'pointer' : 'not-allowed';
      return;
    }
    this.setHover(tile, picked);
  }

  /**
   * Sortie sous le pointeur : son poteau indicateur, ou le bout de chemin au sol. Un combattant
   * dessiné par-dessus (sa tête, depuis la case de devant) ne la masque pas ; seul celui qui se
   * tient sur la case elle-même passe avant.
   */
  exitUnder(event, tile) {
    const rect = this.canvas.getBoundingClientRect();
    const signpost = exitAtSignpost(this.renderer, this.scene.exits ?? [], event.clientX - rect.left, event.clientY - rect.top);
    if (signpost) return signpost;
    if (!tile || this.scene.fighterAt(tile.x, tile.y)) return null;
    return this.scene.exitAt(tile.x, tile.y);
  }

  /** Combattant visé : sa silhouette à l'écran (il peut marcher, nager…), sinon sa place. */
  fighterUnder(tile, picked) {
    if (picked !== undefined) return picked;
    return tile ? this.scene.fighterAt(tile.x, tile.y) : null;
  }

  setHover(tile, picked) {
    const fighter = this.fighterUnder(tile, picked);
    const zone = tile ? this.scene.zoneAt(tile.x, tile.y) : null;
    this.renderer.hoverTile = tile;
    this.renderer.hoverFighterId = fighter?.id ?? null;
    this.renderer.hoverZone = fighter ? null : zone;
    this.hoverActivityId = !fighter && zone?.kind === 'activity' ? zone.activity.id : null;
    this.canvas.style.cursor = fighter || zone?.kind === 'activity' || (zone && this.selectedId) ? 'pointer' : 'default';
  }

  onClick(event) {
    const tile = this.renderer.pickTile(event.clientX, event.clientY);
    const picked = this.renderer.pickFighter(event.clientX, event.clientY);
    // Un bout de chemin mène à un autre lieu (data/locations.js) : on l'emprunte.
    const exit = this.exitUnder(event, tile);
    if (exit) {
      this.travel(exit.id);
      return;
    }
    const fighter = this.fighterUnder(tile, picked);
    const zone = tile ? this.scene.zoneAt(tile.x, tile.y) : null;
    // Combattant sélectionné : un clic sur un lieu l'y affecte (règle existante).
    if (this.selectedId && !fighter && zone) {
      if (this.closed) return showToast(CENTRE_CLOSED_REASON, 'warning');
      return this.assign(this.selectedId, zone.kind === 'activity' ? zone.activity.id : null);
    }
    if (fighter) {
      if (this.closed) return showToast(CENTRE_CLOSED_REASON, 'warning');
      return this.select(fighter.id === this.selectedId ? null : fighter.id);
    }
    // Sinon : un clic sur un lieu verrouille (ou libère) son encadré ; ailleurs, tout se referme.
    this.selectActivity(zone?.kind === 'activity' ? zone.activity.id : null);
    if (!zone) this.select(null);
  }

  select(fighterId) {
    this.selectedId = fighterId;
    this.renderer.selectedId = fighterId;
    const fighter = fighterId ? this.session.getFighter(fighterId) : null;
    this.hint.textContent = fighter
      ? `${fighter.name} sélectionné (${activityLabel(fighter.activityId)}). Cliquez sur un lieu pour l’y affecter, ou sur la cour pour le mettre au repos.`
      : DEFAULT_HINT;
    this.hint.classList.toggle('is-active', Boolean(fighter));
    this.renderPanels();
  }

  assign(fighterId, activityId) {
    const result = assignActivity(this.session, fighterId, activityId);
    if (!result.ok) showToast(result.reason, 'error');
    this.scene.refresh();
    this.select(null);
    this.refreshStatus();
  }

  // --- Configurations d'affectation (AssignmentPresetService) ---

  /** Rangée des configurations : appliquer (nom), modifier (✎), supprimer (✕), enregistrer (+). */
  renderPresets() {
    if (!this.presetsHost) return;
    const presets = listAssignmentPresets(this.session);
    const preset = (item) => {
      const info = describeAssignmentPreset(this.session, item);
      const summary = info.counts.map(({ activityId, count }) => `${activityLabel(activityId)} ×${count}`).join(' · ');
      const invalid = info.invalid
        ? ` — ${[info.departed ? `${info.departed} combattant${info.departed > 1 ? 's' : ''} parti${info.departed > 1 ? 's' : ''}` : null, info.unknownActivities ? `${info.unknownActivities} lieu${info.unknownActivities > 1 ? 'x' : ''} disparu${info.unknownActivities > 1 ? 's' : ''}` : null].filter(Boolean).join(', ')}`
        : '';
      return h(
        'div',
        { class: `saved-team assignment-preset ${info.invalid ? 'is-incomplete' : ''}`.trim(), 'data-preset-id': item.id },
        h('button', {
          type: 'button', class: 'saved-team-select', disabled: this.closed,
          title: `Appliquer « ${item.name} » : ${summary || 'aucune affectation'}${item.resetOthers ? ' — les autres au repos' : ''}${invalid}`,
          onclick: () => this.applyPreset(item.id),
        }, item.name, info.invalid ? h('span', { class: 'saved-team-missing' }, `⚠ ${info.invalid}`) : null),
        h('button', { type: 'button', class: 'saved-team-action', title: `Modifier ${item.name}`, 'aria-label': `Modifier ${item.name}`, onclick: () => this.openPresetEditor(item) }, '✎'),
        h('button', { type: 'button', class: 'saved-team-action is-danger', title: `Supprimer ${item.name}`, 'aria-label': `Supprimer ${item.name}`, onclick: () => this.confirmDeletePreset(item) }, '✕'),
      );
    };
    // replaceChildren écrirait « null » en toutes lettres : seuls les éléments présents.
    this.presetsHost.replaceChildren(...[
      h('h3', { class: 'sheet-section-title' }, 'Configurations'),
      h(
        'div',
        { class: 'saved-team-row' },
        presets.map(preset),
        canCreateAssignmentPreset(this.session)
          ? h('button', {
            type: 'button', class: 'btn btn-sm assignment-preset-add',
            title: 'Enregistrer les affectations actuelles sous un nom', onclick: () => this.openPresetEditor(null),
          }, presets.length ? '+ Enregistrer' : 'Enregistrer les affectations actuelles')
          : null,
      ),
      presets.length ? null : h('p', { class: 'muted' }, 'Enregistrez une répartition (entraînement, récupération…) pour la réappliquer d’un clic.'),
    ].filter(Boolean));
  }

  /** Applique une configuration d'un clic, puis dit ce qui a changé et ce qui a été ignoré. */
  applyPreset(presetId) {
    const preset = getAssignmentPreset(this.session, presetId);
    const result = applyAssignmentPreset(this.session, presetId);
    if (!result.ok) {
      showToast(result.reason, 'warning');
      return;
    }
    const n = result.changes.length;
    const issues = describePresetIssues(result.issues);
    const done = n ? `${n} affectation${n > 1 ? 's' : ''} modifiée${n > 1 ? 's' : ''}` : 'aucun changement, tout était déjà en place';
    showToast(`« ${preset.name} » appliquée : ${done}.${issues ? ` Ignoré : ${issues}.` : ''}`, issues ? 'warning' : 'success');
    this.scene.refresh();
    this.select(null);
    this.refreshStatus();
  }

  /** Création (preset = null) ou modification : nom, absents au repos, et mise à jour des affectations. */
  openPresetEditor(preset) {
    const input = h('input', {
      class: 'input saved-team-name', type: 'text', maxlength: ASSIGNMENT_PRESET_RULES.maxNameLength, autocomplete: 'off', spellcheck: 'false',
      value: preset?.name ?? '', placeholder: `Ex. Entraînement (${ASSIGNMENT_PRESET_RULES.maxNameLength} caractères au plus)`, 'aria-label': 'Nom de la configuration',
    });
    const resetBox = h('input', { type: 'checkbox', checked: Boolean(preset?.resetOthers) });
    const captureBox = preset ? h('input', { type: 'checkbox', checked: true }) : null;
    const error = h('p', { class: 'form-error', role: 'alert' });
    const current = describeAssignmentPreset(this.session, { assignments: captureAssignments(this.session) });
    const body = h(
      'div',
      { class: 'saved-team-editor assignment-preset-editor' },
      h('label', { class: 'saved-team-field' }, h('span', {}, 'Nom'), input),
      h('p', { class: 'muted' }, `Affectations actuelles : ${current.counts.map(({ activityId, count }) => `${activityLabel(activityId)} ×${count}`).join(' · ')}.`),
      captureBox ? h('label', { class: 'check-field' }, captureBox, ' Remplacer par les affectations actuelles') : null,
      h('label', { class: 'check-field' }, resetBox, ' Mettre au repos les combattants absents de la configuration (recrues arrivées depuis)'),
      error,
    );
    input.addEventListener('input', () => { error.textContent = ''; });
    const submit = (modal) => {
      const result = preset
        ? updateAssignmentPreset(this.session, preset.id, { name: input.value, resetOthers: resetBox.checked, capture: captureBox.checked })
        : createAssignmentPreset(this.session, input.value, { resetOthers: resetBox.checked });
      if (!result.ok) {
        error.textContent = result.reason;
        return;
      }
      modal.close(true);
      showToast(preset ? `Configuration « ${result.preset.name} » mise à jour.` : `Configuration « ${result.preset.name} » enregistrée.`, 'success');
      this.renderPresets();
    };
    openModal({
      title: preset ? `Modifier ${preset.name}` : 'Enregistrer les affectations',
      className: 'saved-team-modal',
      body,
      actions: [{ label: 'Annuler', value: false }, { label: preset ? 'Enregistrer' : 'Valider', variant: 'primary', onClick: submit }],
    });
    focusField(input);
  }

  async confirmDeletePreset(preset) {
    const ok = await confirmModal({
      title: 'Supprimer la configuration',
      message: `Supprimer la configuration « ${preset.name} » ? Les affectations actuelles ne changent pas.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    deleteAssignmentPreset(this.session, preset.id);
    this.renderPresets();
  }

  // --- Panneaux sous la scène ---

  renderPanels() {
    const selected = this.selectedId ? this.session.getFighter(this.selectedId) : null;
    this.renderPresets();
    const sort = getAssignmentSort();

    this.zonesHost.replaceChildren(
      ...listActivities(this.session).map((activity) => {
        const assigned = getAssignedFighters(this.session, activity.id);
        const conditions = describeActivityConditions(activity);
        const freeSlots = getFreeSlots(this.session, activity);
        const full = freeSlots <= 0;
        // Saison : lieu fermé (rivière asséchée en été, forêt enneigée en hiver).
        const seasonClosed = getActivityClosure(this.session, activity.id);
        return h(
          'article',
          { class: `zone-card ${full ? 'is-full' : ''} ${seasonClosed ? 'is-season-closed' : ''}`.replace(/\s+/g, ' ').trim(), style: { '--activity-color': activity.color } },
          activity.group ? h('p', { class: 'eyebrow zone-card-group' }, activity.group) : null,
          h('h3', { class: 'zone-card-title' }, h('span', { 'aria-hidden': 'true' }, activity.icon), activity.name),
          h('p', { class: 'zone-card-desc' }, activity.description),
          seasonClosed ? h('p', { class: 'zone-card-season', role: 'status' }, `${getCurrentSeason(this.session).icon} Fermé pour la saison : ${seasonClosed}`) : null,
          h(
            'dl',
            { class: 'zone-card-stats' },
            h('div', {}, h('dt', {}, 'Effet'), h('dd', {}, describeActivityEffect(activity))),
            h('div', {}, h('dt', {}, 'Réussite'), h('dd', {}, `${formatChance(activity.successChance)} / jour`)),
            h('div', {}, h('dt', {}, 'Places'), h(
              'dd',
              { class: full ? 'zone-card-full' : '' },
              Number.isFinite(freeSlots)
                ? `${assigned.length} / ${activity.capacity} combattant${activity.capacity > 1 ? 's' : ''}${full ? ' — complet' : ''}`
                : `${assigned.length} · illimitées`,
            )),
            conditions.length ? h('div', {}, h('dt', {}, 'Condition'), h('dd', {}, conditions.join(', '))) : null,
          ),
          h('p', { class: 'zone-card-assigned' }, assigned.length
            ? assigned.flatMap((f, i) => (i ? [', ', FighterName(f)] : [FighterName(f)]))
            : 'Personne'),
          selected
            ? h('button', {
              type: 'button', class: 'btn btn-sm', disabled: this.closed || Boolean(seasonClosed) || selected.activityId === activity.id || full,
              onclick: () => this.assign(selected.id, activity.id),
            }, `Y affecter ${selected.name}`)
            : null,
        );
      }),
    );

    // Téléphone (v0.95) : les lieux en colonnes, la fiche du combattant choisi en haut.
    if (isMobileLayout()) {
      this.rosterHost.replaceChildren(AssignBoard(this));
      return;
    }
    this.rosterHost.replaceChildren(
      h(
        'table',
        { class: 'assign-table' },
        h('thead', {}, h(
          'tr',
          {},
          // En-têtes cliquables : tri par colonne (second clic : ordre inverse).
          ASSIGNMENT_SORT_COLUMNS.map((column) => {
            const active = sort.key === column.key;
            const arrow = active ? (sort.direction === 'asc' ? '▲' : '▼') : '';
            return h('th', {
              class: `${column.type === 'number' && column.key !== 'level' ? 'num' : ''} sortable ${active ? 'is-sorted' : ''}`.trim(),
              'aria-sort': active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none',
            }, h('button', {
              type: 'button', class: 'sort-button', 'data-sort': column.key,
              title: `Trier par ${(column.title ?? column.label).toLowerCase()}`,
              onclick: () => { toggleAssignmentSort(column.key); this.renderPanels(); },
            }, column.label, h('span', { class: 'sort-arrow', 'aria-hidden': 'true' }, arrow)));
          }),
          h('th', {}, 'Activité'),
        )),
        h('tbody', {}, sortFighters(this.session.playerFighters, sort).map((fighter) => h(
          'tr',
          { class: fighter.id === this.selectedId ? 'is-selected' : '', 'data-fighter-id': fighter.id },
          h('td', {}, h('button', {
            type: 'button', class: 'link-button', 'aria-pressed': String(fighter.id === this.selectedId),
            onclick: () => this.select(fighter.id === this.selectedId ? null : fighter.id),
          }, FighterName(fighter))),
          h('td', {}, ...FighterClassTags(fighter)),
          h('td', {}, FighterStars(calculateFighterLevel(fighter))),
          // Compétence qui ne peut plus progresser (100, ou plafond du potentiel) : en rouge.
          STAT_DEFINITIONS.map((def) => {
            // Fatigue (v0.75) : son état en couleur (fatigué : orange, épuisé : rouge).
            if (def.id === 'fatigue') {
              const state = getFatigueState(fighter);
              return h('td', {
                class: `num fatigue-state is-${state.id}`,
                title: state.id === 'rested' ? null : `${state.label} : ${fatigueStateHint(state.id)}`,
              }, String(fighter.stats.fatigue ?? def.base));
            }
            const maxed = isStatMaxed(fighter, def.id);
            const atMax = (fighter.stats[def.id] ?? def.base) >= def.max;
            return h('td', {
              class: `num ${maxed ? 'is-stat-maxed' : ''}`.trim(),
              title: maxed ? (atMax ? `${def.label} au maximum (${def.max}) : plus aucun progrès possible.` : `${def.label} au plafond de son potentiel : plus aucun progrès possible tant que son potentiel ne monte pas.`) : null,
            }, String(fighter.stats[def.id] ?? def.base));
          }),
          h(
            'td',
            {},
            ActivitySelect(fighter, (activityId) => this.assign(fighter.id, activityId), { session: this.session, compact: true }),
            // Potentiel atteint dans la compétence de ce lieu : recalculé à chaque affichage.
            isTrainingUseless(fighter, getActivity(fighter.activityId))
              ? h('span', { class: 'useless-training', title: 'Ce combattant a atteint son potentiel maximal dans la compétence de ce lieu : affectez-le ailleurs.' }, 'Entraînement inutile : potentiel atteint')
              : null,
          ),
        ))),
      ),
      h('p', { class: 'muted stat-maxed-legend' }, h('span', { class: 'is-stat-maxed' }, '■'), ' En rouge : compétence qui ne peut plus progresser (100, ou plafond du potentiel). Inutile d’y affecter le combattant.'),
      h('p', { class: 'muted fatigue-legend' },
        h('span', { class: 'fatigue-state is-tired' }, '■'), ` Fatigue orange — fatigué (dès ${fatigueStateFrom('tired')}) : ${fatigueStateHint('tired')}. `,
        h('span', { class: 'fatigue-state is-exhausted' }, '■'), ` Rouge — épuisé (dès ${fatigueStateFrom('exhausted')}) : ${fatigueStateHint('exhausted')}.`),
      h('p', { class: 'muted centre-rest-note' }, `${CENTRE_LAYOUT.rest.icon} ${CENTRE_LAYOUT.rest.description}`),
    );
  }
}
