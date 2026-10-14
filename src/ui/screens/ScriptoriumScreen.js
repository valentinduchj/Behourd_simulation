import { h } from '../../utils/dom.js';
import { HubScreen } from './HubScreen.js';
import { ScriptoriumScene } from '../../scriptorium/ScriptoriumScene.js';
import { ScriptoriumRenderer } from '../../scriptorium/ScriptoriumRenderer.js';
import { getVisibleExits, describeExit, getExit } from '../../systems/navigation/LocationNavigationService.js';
import {
  canStartStudy, getActiveStudies, getFreeDesks, getStudyDuration, getStudyPlan, getStudyProgress, interruptStudy, startStudy,
  takeUnseenRevealCeremonies,
} from '../../systems/talents/StudyService.js';
import { SCENE_VFX } from '../../data/vfx.js';
import {
  buyArtifact, buyDeskUpgrade, canBuyDeskUpgrade, getActiveConfiguration, getDeskCount, hasDeskUpgrade, listArtifacts,
} from '../../systems/talents/ScriptoriumUpgradeService.js';
import { getFighterTalents, getTalent } from '../../systems/talents/TalentService.js';
import { DESK_UPGRADE, NO_ARTIFACT, STUDY_RULES } from '../../data/scriptorium.js';
import { TALENT_RARITIES } from '../../data/talents.js';
import { getDeniers } from '../../systems/economy/wallet.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';
import { openModal, confirmModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { FighterSprite } from '../components/FighterSprite.js';
import { FighterClassTags } from '../components/SpecialtyBadge.js';
import { FighterStars } from '../components/Rating.js';
import { FighterName } from '../components/CaptainCrown.js';
import { PotentialFlames } from '../components/Potential.js';
import { TalentBadge, TalentBadges } from '../components/TalentBadge.js';
import { spectatorUrl } from '../../render/spectators.js';

const HINT = 'Cliquez sur le Bureau d’étude pour envoyer un combattant révéler ses talents (deux au plus), ou sur la Professeure Flavia pour améliorer le Scriptorium. La porte ramène au Centre.';
const days = (n) => `${n} jour${n > 1 ? 's' : ''}`;
const deniers = (n) => `${n.toLocaleString('fr-FR')} denier${n > 1 ? 's' : ''}`;
const pct = (v) => `${Math.round(v * 1000) / 10} %`.replace('.', ',');

/**
 * Libellé du lancement d'une étude (v0.72) : premier talent, second talent (gratuits), ou
 * remplacement d'un des deux talents (payant). `mode` : 'first' | 'second' | 'replace'.
 */
export function studyButtonLabel(cost, mode = cost > 0 ? 'replace' : 'first') {
  if (mode === 'replace') return `Remplacer ce talent : ${cost} deniers`;
  return mode === 'second' ? 'Révéler son second talent' : 'Lancer l’étude';
}

/** Ce que révélera l'étude, en une phrase. */
function studyGoal(plan) {
  if (plan.mode === 'replace') return `Remplacer un de ses deux talents, au choix (${deniers(plan.cost)}).`;
  return plan.mode === 'second' ? 'Révéler son second talent (gratuit) : il garde le premier.' : 'Révéler son premier talent (gratuit).';
}

/** Ce que révèle une étude en cours (affichée au Bureau d'étude). */
function studyLabel(study, fighter) {
  if (study.mode === 'replace' || (!study.mode && study.cost > 0)) {
    const name = study.previousTalentId ? getTalent(study.previousTalentId)?.name : null;
    return ` · remplace ${name ?? 'un talent'} (${deniers(study.cost)})`;
  }
  return study.mode === 'second' || (study.slot ?? fighter.talents?.length ?? 0) >= 1 ? ' · second talent' : ' · premier talent';
}
/** Chances de chaque famille de talents (configuration réellement utilisée), en liste. */
function OddsList(odds, { className = '' } = {}) {
  return h('ul', { class: `talent-odds ${className}`.trim() }, Object.entries(odds).map(([rarity, chance]) => h('li', { 'data-rarity': rarity },
    h('span', { class: 'talent-odds-swatch', style: { '--talent-color': TALENT_RARITIES[rarity].color, '--talent-border': TALENT_RARITIES[rarity].border }, 'aria-hidden': 'true' }),
    h('span', { class: 'talent-odds-name' }, `Talents ${TALENT_RARITIES[rarity].name.toLowerCase()}s`),
    h('strong', { class: 'talent-odds-value' }, pct(chance)))));
}

/**
 * Le Scriptorium : bibliothèque fortifiée où des combattants étudient pour révéler (ou
 * remplacer) leur talent, et où la Professeure Flavia propose ses améliorations. Toute la
 * logique passe par StudyService et ScriptoriumUpgradeService ; la scène (scriptorium/) n'est
 * que de la présentation.
 */
export class ScriptoriumScreen extends HubScreen {
  static hubLocationId = 'scriptorium';

  renderContent() {
    this.canvas = h('canvas', { class: 'centre-canvas scriptorium-canvas', 'aria-label': 'L’intérieur du Scriptorium en vue isométrique' });
    this.hint = h('p', { class: 'centre-hint', role: 'status' }, HINT);
    this.panelHost = h('div', { class: 'scriptorium-panels' });
    this.renderPanels();
    return h(
      'div',
      { class: 'hub-page' },
      h('header', { class: 'hub-page-header' },
        h('h1', {}, 'Le Scriptorium'),
        h('p', { class: 'hub-page-subtitle' }, 'Copistes, moines et baillis veillent sur les savoirs de la citadelle. Au Bureau d’étude, un combattant révèle ses talents ; la Professeure Flavia y veille.')),
      h('div', { class: 'centre-stage scriptorium-stage' }, this.canvas),
      this.hint,
      this.panelHost,
    );
  }

  mounted() {
    super.mounted();
    this.scene = new ScriptoriumScene();
    this.renderer = new ScriptoriumRenderer(this.canvas, this.scene);
    // Sortie : la porte ramène au Centre (data/locations.js).
    this.renderer.exits = getVisibleExits('SCRIPTORIUM');
    this.refreshScene();
    this.renderer.resize();
    // Arrivée depuis le Centre : on entre par la porte, qui s'ouvre et luit un instant.
    if (this.params.arrivalExitId) {
      this.renderer.arrival = { exitId: this.params.arrivalExitId, start: null };
      const door = this.renderer.exits.find((exit) => exit.id === this.params.arrivalExitId);
      if (door) this.renderer.effects.add('door', { x: 0.25, y: door.position.y }, { delay: 0.1 });
    }
    this.playRevealCeremonies();
    this.listen(window, 'resize', () => this.renderer.resize());
    this.listen(this.canvas, 'mousemove', (event) => {
      const target = this.targetAt(event.clientX, event.clientY);
      this.renderer.hover = target;
      this.canvas.style.cursor = target ? 'pointer' : 'default';
      this.hint.textContent = this.hintFor(target) ?? HINT;
    });
    this.listen(this.canvas, 'mouseleave', () => { this.renderer.hover = null; this.hint.textContent = HINT; });
    this.listen(this.canvas, 'click', (event) => this.activate(this.targetAt(event.clientX, event.clientY)));
    // Le chat et la souris ne vivent que pendant l'affichage (rien ne s'accumule après le départ).
    let last = performance.now();
    const frame = (now) => {
      this.scene.update((now - last) / 1000);
      last = now;
      this.renderer.render(now / 1000);
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
  }

  unmount() {
    cancelAnimationFrame(this.frameId);
    super.unmount();
  }

  /**
   * Talents révélés depuis la dernière visite : au-dessus du Bureau d'étude, le livre s'ouvre,
   * les pages tourbillonnent, la lumière de la famille jaillit (une fois par révélation).
   */
  playRevealCeremonies() {
    const ceremonies = takeUnseenRevealCeremonies(this.session, { maxAgeDays: SCENE_VFX.reveal.maxAgeDays });
    if (!ceremonies.length) return;
    this.autosave();
    const seats = this.scene.desk.seats;
    let delay = 0.9;
    ceremonies.forEach((ceremony, i) => {
      const seat = seats[i % seats.length].work.target;
      this.renderer.effects.add('reveal', { x: seat.x, y: seat.y + 0.4, rarity: ceremony.rarity, text: `✦ ${ceremony.talentName}` }, { delay });
      delay += (ceremony.rarity === 'epic' ? SCENE_VFX.reveal.epicDuration : SCENE_VFX.reveal.duration) * 0.75;
    });
  }

  /** Cible sous le pointeur : la porte, le Bureau d'étude, Flavia (sa zone de 4 × 4 cases), ou rien. */
  targetAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const inside = (box) => box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    const exit = this.renderer.exitAtPoint(x, y);
    if (exit) return { type: 'exit', exitId: exit.id };
    if (inside(this.renderer.flaviaBox())) return { type: 'flavia' };
    if (inside(this.renderer.deskBox())) return { type: 'desk' };
    const tile = this.renderer.pickTile(clientX, clientY);
    if (tile && this.scene.isFlaviaTile(tile.x, tile.y)) return { type: 'flavia' };
    return tile && this.scene.isDeskTile(tile.x, tile.y) ? { type: 'desk' } : null;
  }

  hintFor(target) {
    if (target?.type === 'exit') {
      const label = describeExit(getExit(target.exitId));
      return label ? `La porte — sortir du Scriptorium (${label.title}).` : null;
    }
    if (target?.type === 'flavia') return 'La Professeure Flavia — cliquez pour améliorer le Bureau d’étude ou choisir un artefact.';
    if (target?.type === 'desk') {
      const studies = getActiveStudies(this.session);
      const names = studies.map((s) => this.session.getFighter(s.fighterId)?.name).join(', ');
      return studies.length
        ? `Bureau d’étude — ${names} étudie${studies.length > 1 ? 'nt' : ''} (${studies.length} / ${getDeskCount(this.session)}). Cliquez pour suivre les études${getFreeDesks(this.session) ? ' ou en lancer une autre' : ''}.`
        : 'Bureau d’étude — libre. Cliquez pour choisir le combattant qui étudiera.';
    }
    return null;
  }

  activate(target) {
    if (target?.type === 'exit') this.travel(target.exitId);
    else if (target?.type === 'desk') this.openDesk();
    else if (target?.type === 'flavia') this.openFlavia();
  }

  /** Scène et panneaux à jour : combattants au Bureau, second bureau, plaque, colonne de droite. */
  refresh() {
    this.refreshScene();
    this.renderPanels();
    this.refreshStatus();
  }

  refreshScene() {
    if (!this.scene) return;
    this.scene.setUpgrades(hasDeskUpgrade(this.session) ? [DESK_UPGRADE.id] : []);
    this.scene.setArtifact(getActiveConfiguration(this.session));
    const studies = getActiveStudies(this.session);
    this.scene.setStudents(studies.map((study) => ({ fighter: this.session.getFighter(study.fighterId), study })).filter((s) => s.fighter));
    if (this.renderer) {
      const first = studies[0];
      const subtitle = !studies.length ? `Libre · ${getDeskCount(this.session)} place${getDeskCount(this.session) > 1 ? 's' : ''}`
        : studies.length === 1 ? `${this.session.getFighter(first.fighterId)?.name} — encore ${days(getStudyProgress(this.session, first).remaining)}`
          : `${studies.length} combattants en étude`;
      this.renderer.deskLabel = { title: '📜 Bureau d’étude', subtitle };
      this.renderer.flaviaLabel = { title: '👑 Professeure Flavia', subtitle: getActiveConfiguration(this.session).name };
    }
  }

  // --- Panneaux sous la scène ---

  renderPanels() {
    const studies = getActiveStudies(this.session);
    const desks = getDeskCount(this.session);
    const free = getFreeDesks(this.session);
    const config = getActiveConfiguration(this.session);
    this.panelHost.replaceChildren(
      h('article', { class: `zone-card study-desk-card ${studies.length ? 'is-busy' : ''}`.trim() },
        h('h3', { class: 'zone-card-title' }, h('span', { 'aria-hidden': 'true' }, '📜'), 'Le Bureau d’étude',
          h('span', { class: 'study-desk-count' }, `${studies.length} / ${desks} place${desks > 1 ? 's' : ''}`)),
        studies.length ? studies.map((study) => this.renderStudy(study)) : h('p', { class: 'zone-card-desc' }, 'Personne n’étudie en ce moment.'),
        free > 0 ? h('button', { type: 'button', class: 'btn btn-primary btn-sm study-choose', onclick: () => this.openSelection() }, 'Choisir un combattant') : null,
        h('div', { class: 'study-odds-block' },
          h('p', { class: 'study-odds-title' }, `Chances à la révélation — ${config.icon} ${config.name}`),
          OddsList(config.odds))),
      h('div', { class: 'scriptorium-side' },
        h('article', { class: 'zone-card flavia-card' },
          h('img', { class: 'artisan-portrait', src: spectatorUrl(this.scene?.flavia.spriteId ?? 'scriptorium_flavia'), alt: '', width: 48, height: 78 }),
          h('div', {},
            h('h3', { class: 'zone-card-title' }, '👑 La Professeure Flavia'),
            h('p', { class: 'zone-card-desc' }, `Bureau d’étude : ${desks} place${desks > 1 ? 's' : ''} · ${config.name}.`),
            h('button', { type: 'button', class: 'btn btn-sm', onclick: () => this.openFlavia() }, 'Parler à la Professeure Flavia'))),
        h('article', { class: 'zone-card study-rules-card' },
          h('h3', { class: 'zone-card-title' }, h('span', { 'aria-hidden': 'true' }, '🕯'), 'L’étude'),
          h('p', { class: 'zone-card-desc' }, `Un combattant en étude ne s’entraîne pas et ne combat pas. À la fin, un talent se révèle. Chaque combattant peut avoir deux talents : le premier et le second se révèlent gratuitement. Avec deux talents, une nouvelle étude (${deniers(STUDY_RULES.replaceCost)}) remplace celui qu’on choisit, à la révélation. Interrompue, l’étude ne révèle rien et n’est pas remboursée.`),
          h('ul', { class: 'study-durations' }, Object.entries(STUDY_RULES.durationByPotential).map(([potential, duration]) => h('li', {},
            PotentialFlames({ potential: Number(potential) }), h('span', {}, days(duration))))))),
    );
  }

  /** Une étude en cours : combattant, talent actuel, potentiel, jours restants, progression, interruption. */
  renderStudy(study) {
    const fighter = this.session.getFighter(study.fighterId);
    const progress = getStudyProgress(this.session, study);
    return h('div', { class: 'study-entry', 'data-fighter': fighter.id },
      h('div', { class: 'study-current' },
        FighterSprite(fighter, { size: 56, team: this.team }),
        h('div', {},
          h('p', { class: 'study-name' }, FighterName(fighter, { session: this.session }), ...TalentBadges(fighter, this.session)),
          h('p', { class: 'study-potential' }, h('span', { class: 'fighter-profile-label' }, 'Potentiel'), PotentialFlames(fighter)),
          h('p', { class: 'study-remaining' }, `Fin de l’étude : jour ${progress.endDay} — encore ${days(progress.remaining)}.`))),
      h('div', { class: 'study-progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(study.duration), 'aria-valuenow': String(progress.elapsed) },
        h('span', { class: 'study-progress-fill', style: { width: `${Math.round(progress.ratio * 100)}%` } })),
      h('p', { class: 'muted' }, `${days(progress.elapsed)} sur ${days(study.duration)}${studyLabel(study, fighter)}.`),
      h('button', { type: 'button', class: 'btn btn-danger btn-sm study-interrupt', 'data-fighter': fighter.id, onclick: () => this.confirmInterrupt(fighter.id) }, 'Interrompre l’étude'));
  }

  /** Clic sur le Bureau d'étude : une place libre → choix d'un combattant ; sinon, les études en cours. */
  openDesk() {
    if (getFreeDesks(this.session) > 0) this.openSelection();
    else this.openCurrentStudies();
  }

  openCurrentStudies() {
    const handle = openModal({
      title: 'Le Bureau d’étude',
      className: 'study-modal',
      body: h('div', { class: 'study-desk-card' }, getActiveStudies(this.session).map((study) => this.renderStudy(study))),
      actions: [{ label: 'Fermer', variant: 'primary' }],
    });
    // Un bouton d'interruption de la fenêtre la referme avant de demander confirmation.
    for (const button of handle.element.querySelectorAll('.study-interrupt')) button.addEventListener('click', () => handle.close(), { capture: true });
  }

  // --- Choix du combattant ---

  /**
   * Interface d'étude : chances de la configuration active, combattants de la compagnie (ceux
   * qui ne peuvent pas étudier grisés). Un clic en choisit un : talent actuel, durée, coût et
   * chances s'affichent ; le bouton « Lancer l'étude » ou « Nouvelle étude : 500 deniers »
   * demande confirmation.
   */
  openSelection() {
    let selectedId = null;
    let selectedSlot = null;
    const list = h('div', { class: 'study-candidates' });
    const summary = h('div', { class: 'study-summary' }, h('p', { class: 'muted' }, 'Choisissez le combattant qui étudiera.'));
    const config = getActiveConfiguration(this.session);
    let handle;
    const render = () => {
      list.replaceChildren(...this.session.playerFighters.map((fighter) => {
        const check = canStartStudy(this.session, fighter.id);
        const selected = fighter.id === selectedId;
        const duration = getStudyDuration(fighter);
        // Un combattant sélectionnable sans assez de deniers reste choisissable : le bouton se grise.
        const blocked = !check.ok && !/Deniers/.test(check.reason ?? '');
        return h('button', {
          type: 'button',
          class: `study-candidate ${selected ? 'is-selected' : ''} ${blocked ? 'is-disabled' : ''}`.trim().replace(/\s+/g, ' '),
          'data-fighter': fighter.id,
          disabled: blocked,
          'aria-pressed': String(selected),
          title: check.reason ?? `${fighter.name} : ${days(duration)} d’étude`,
          style: { '--spec-color': fighter.specialty?.color },
          onclick: () => { if (selectedId !== fighter.id) selectedSlot = null; selectedId = fighter.id; render(); },
        },
        FighterSprite(fighter, { size: 40, team: this.team }),
        h('span', { class: 'study-candidate-who' },
          h('strong', {}, FighterName(fighter, { session: this.session })),
          h('span', { class: 'study-candidate-tags' }, ...FighterClassTags(fighter, this.session), ...TalentBadges(fighter, this.session), FighterStars(calculateFighterLevel(fighter)))),
        h('span', { class: 'study-candidate-potential' }, PotentialFlames(fighter)),
        h('span', { class: 'study-candidate-duration' }, blocked ? check.reason : `${days(duration)}${check.cost ? ` · ${deniers(check.cost)}` : ''}`));
      }));
      const fighter = selectedId ? this.session.getFighter(selectedId) : null;
      const start = handle?.element.querySelector('.modal-actions .btn-primary');
      if (fighter) {
        const plan = getStudyPlan(this.session, fighter);
        // Deux talents : choisir celui à remplacer (aucun choisi d'office).
        if (plan.mode !== 'replace') selectedSlot = null;
        const check = canStartStudy(this.session, fighter.id, { slot: selectedSlot });
        const duration = getStudyDuration(fighter);
        const talents = getFighterTalents(this.session, fighter);
        const kept = selectedSlot === null ? null : talents[selectedSlot];
        const slotPicker = plan.mode !== 'replace' ? null : h('fieldset', { class: 'study-slot-picker' },
          h('legend', {}, 'Talent à remplacer'),
          ...talents.map((talent, index) => h('label', { class: `study-slot ${selectedSlot === index ? 'is-selected' : ''}`.trim(), 'data-slot': String(index) },
            h('input', { type: 'radio', name: 'study-slot', value: String(index), checked: selectedSlot === index, onchange: () => { selectedSlot = index; render(); } }),
            h('span', { class: 'study-slot-rank' }, index === 0 ? 'Premier talent' : 'Second talent'),
            TalentBadge(talent, this.session))));
        // (replaceChildren écrirait « null » : éléments absents retirés.)
        summary.replaceChildren(...[
          h('h4', { class: 'study-summary-title' }, `Étudier le combattant : ${fighter.name}`),
          h('ul', { class: 'study-summary-facts' },
            h('li', {}, `Talent${talents.length > 1 ? 's' : ''} actuel${talents.length > 1 ? 's' : ''} : `, talents.length ? TalentBadges(fighter, this.session) : h('em', {}, 'aucun')),
            h('li', { class: 'study-summary-goal' }, studyGoal(plan)),
            h('li', {}, `Durée : ${days(duration)} (fin le jour ${this.session.calendar.currentDay + duration})`),
            h('li', { class: 'study-summary-cost' }, `Coût : ${check.cost ? deniers(check.cost) : 'gratuit'}`)),
          slotPicker,
          OddsList(config.odds, { className: 'is-compact' }),
          kept ? h('p', { class: 'muted' }, `Il garde ${kept.name} jusqu’à la révélation du nouveau talent, qui le remplacera ; ${talents[1 - selectedSlot]?.name ?? 'son autre talent'} reste acquis.`) : null,
          plan.mode === 'second' ? h('p', { class: 'muted' }, `Le second talent s’ajoute à ${talents[0]?.name} : jamais le même.`) : null,
          check.ok ? null : h('p', { class: 'recruit-reason' }, check.reason),
          check.ok && plan.mode === 'replace' && selectedSlot === null ? h('p', { class: 'recruit-reason' }, 'Choisissez le talent à remplacer.') : null,
        ].filter(Boolean));
        if (start) {
          start.textContent = studyButtonLabel(check.cost, plan.mode);
          start.disabled = !check.ok || (plan.mode === 'replace' && selectedSlot === null);
          start.title = check.reason ?? '';
        }
      } else if (start) start.disabled = true;
    };
    handle = openModal({
      title: 'Le Bureau d’étude — choisir un combattant',
      className: 'modal-wide study-modal',
      body: h('div', { class: 'study-selection' },
        h('div', { class: 'study-odds-block' },
          h('p', { class: 'study-odds-title' }, `Chances à la révélation — ${config.icon} ${config.name}`),
          OddsList(config.odds)),
        h('p', {}, `La durée dépend du potentiel. Chaque combattant peut avoir deux talents : le premier et le second se révèlent gratuitement ; avec deux talents, en remplacer un (au choix) coûte ${deniers(STUDY_RULES.replaceCost)}.`),
        list,
        summary),
      actions: [
        { label: 'Annuler', value: null },
        { label: studyButtonLabel(0), variant: 'primary', disabled: true, onClick: async (modal) => { if (selectedId && await this.confirmStart(selectedId, selectedSlot)) modal.close(true); } },
      ],
    });
    render();
  }

  /** Confirmation, puis lancement de l'étude (StudyService). Renvoie true si l'étude a commencé. */
  async confirmStart(fighterId, slot = null) {
    const fighter = this.session.getFighter(fighterId);
    const duration = getStudyDuration(fighter);
    const plan = getStudyPlan(this.session, fighter);
    const { cost } = plan;
    const talents = getFighterTalents(this.session, fighter);
    const replaced = plan.mode === 'replace' ? talents[slot] ?? null : null;
    const goal = plan.mode === 'replace'
      ? ` Coût : ${deniers(cost)}, non remboursés en cas d’interruption. Le nouveau talent remplacera ${replaced?.name} (${slot === 0 ? 'premier' : 'second'} talent), qu’il garde jusqu’à la révélation ; ${talents[1 - slot]?.name} reste acquis.`
      : plan.mode === 'second' ? ` Son second talent s’ajoutera à ${talents[0]?.name} (gratuit).` : '';
    const confirmed = await confirmModal({
      title: plan.mode === 'replace' ? 'Remplacer un talent ?' : plan.mode === 'second' ? 'Révéler son second talent ?' : 'Lancer l’étude ?',
      message: `${fighter.name} étudiera ${days(duration)} au Scriptorium (fin le jour ${this.session.calendar.currentDay + duration}). Il quittera son activité du Centre et ne pourra ni s’entraîner ni combattre jusqu’à la fin de son étude.${goal}`,
      confirmLabel: studyButtonLabel(cost, plan.mode),
    });
    if (!confirmed) return false;
    const result = startStudy(this.session, fighterId, { slot });
    if (!result.ok) {
      showToast(result.reason, 'error');
      return false;
    }
    this.autosave();
    showToast(`${fighter.name} commence son étude au Scriptorium (${days(duration)}${cost ? `, −${deniers(cost)}` : ''}).`, 'success');
    this.refresh();
    return true;
  }
  async confirmInterrupt(fighterId) {
    const study = getActiveStudies(this.session).find((s) => s.fighterId === fighterId);
    if (!study) return;
    const fighter = this.session.getFighter(study.fighterId);
    const owned = getFighterTalents(this.session, fighter);
    const confirmed = await confirmModal({
      title: 'Interrompre l’étude ?',
      message: `${fighter.name} quittera le Bureau d’étude sans révéler de talent : le temps déjà passé est perdu${study.cost ? `, les ${deniers(study.cost)} ne sont pas remboursés` : ''}.${owned.length ? ` Il garde ${owned.map((talent) => talent.name).join(' et ')}.` : ''} Il redeviendra disponible aussitôt.`,
      confirmLabel: 'Interrompre l’étude',
      danger: true,
    });
    if (!confirmed) return;
    const result = interruptStudy(this.session, study.fighterId);
    if (!result.ok) {
      showToast(result.reason, 'error');
      return;
    }
    this.autosave();
    showToast(`L’étude de ${fighter.name} est interrompue : aucun nouveau talent.`, 'info');
    this.refresh();
  }

  // --- La Professeure Flavia ---

  openFlavia() {
    const body = h('div', { class: 'flavia-panel' });
    const render = () => body.replaceChildren(...this.renderFlaviaPanel(render));
    render();
    openModal({
      title: 'La Professeure Flavia', body, className: 'modal-wide artisan-modal flavia-modal', actions: [{ label: 'Fermer', variant: 'primary' }],
      // Artefact acheté : il descend se poser sur la table, sous les yeux du joueur (fenêtre fermée).
      onClose: () => {
        if (!this.pendingArtifactDrop) return;
        this.pendingArtifactDrop = false;
        const spot = this.scene?.flavia.artifactSpot;
        if (spot) this.renderer?.effects.add('artifact', { x: spot.x, y: spot.y }, { delay: 0.25 });
      },
    });
  }

  renderFlaviaPanel(rerender) {
    const desk = canBuyDeskUpgrade(this.session);
    const owned = hasDeskUpgrade(this.session);
    const active = getActiveConfiguration(this.session);
    const artifacts = listArtifacts(this.session);
    const stateLabel = { active: 'Actif', surpassed: 'Remplacé', available: 'À acheter', locked: 'Verrouillé' };
    const row = (config, state, button) => h('li', { class: `upgrade-row artifact-row ${state === 'active' ? 'is-active' : ''} ${state === 'locked' ? 'is-locked' : ''}`.trim().replace(/\s+/g, ' '), 'data-artifact': config.id ?? 'none' },
      h('div', { class: 'upgrade-info' },
        h('p', { class: 'upgrade-name' }, `${config.icon} ${config.name}`, h('span', { class: `upgrade-level artifact-state is-${state}` }, stateLabel[state] ?? state)),
        OddsList(config.odds, { className: 'is-compact' })),
      button);
    return [
      h('header', { class: 'artisan-panel-head' },
        h('img', { class: 'artisan-portrait', src: spectatorUrl('scriptorium_flavia'), alt: '', width: 56, height: 90 }),
        h('div', {},
          h('p', { class: 'artisan-panel-desc' }, '« Un esprit bien guidé trouve vite sa voie. Offrez à vos combattants de meilleures conditions d’étude, et les talents les plus rares se révéleront. »'),
          h('p', { class: 'artisan-panel-purse' }, `Trésor : ${deniers(getDeniers(this.session))}`))),
      h('section', { class: 'upgrade-group' },
        h('h3', { class: 'sheet-section-title' }, 'Amélioration du Bureau d’étude'),
        h('ul', { class: 'upgrade-list' },
          h('li', { class: `upgrade-row desk-upgrade-row ${owned ? 'is-owned' : desk.ok ? '' : 'is-locked'}`.trim() },
            h('div', { class: 'upgrade-info' },
              h('p', { class: 'upgrade-name' }, DESK_UPGRADE.name, h('span', { class: 'upgrade-level' }, `Actuellement : ${getDeskCount(this.session)} place${getDeskCount(this.session) > 1 ? 's' : ''}`)),
              h('p', { class: 'upgrade-desc' }, `${DESK_UPGRADE.description} Achat unique.`)),
            owned
              ? h('div', { class: 'upgrade-buy' }, h('span', { class: 'upgrade-owned' }, '✔ Amélioration acquise'))
              : h('div', { class: 'upgrade-buy' },
                h('span', { class: 'upgrade-cost' }, deniers(DESK_UPGRADE.cost)),
                h('button', { type: 'button', class: 'btn btn-primary btn-sm buy-desk', disabled: !desk.ok, title: desk.reason ?? `Acheter pour ${deniers(DESK_UPGRADE.cost)}`, onclick: () => this.buyDesk(rerender) }, 'Acheter'),
                desk.ok ? null : h('span', { class: 'upgrade-reason' }, desk.reason))))),
      h('section', { class: 'upgrade-group' },
        h('h3', { class: 'sheet-section-title' }, 'Artefacts'),
        h('p', { class: 'muted' }, 'Une amélioration par paliers : chaque artefact débloque le suivant et le remplace une fois acheté. Seul le dernier acquis est actif ; ses chances s’appliquent au moment où un talent se révèle, études en cours comprises.'),
        h('ul', { class: 'upgrade-list artifact-list' },
          row(NO_ARTIFACT, active.id === null ? 'active' : 'surpassed', h('div', { class: 'upgrade-buy' }, h('span', { class: 'upgrade-cost' }, 'Départ'))),
          artifacts.map((artifact) => row(artifact, artifact.state, h('div', { class: 'upgrade-buy' },
            h('span', { class: 'upgrade-cost' }, deniers(artifact.cost)),
            artifact.state === 'available'
              ? h('button', { type: 'button', class: 'btn btn-primary btn-sm buy-artifact', 'data-artifact': artifact.id, disabled: !artifact.canBuy.ok, title: artifact.canBuy.reason ?? `Acheter pour ${deniers(artifact.cost)}`, onclick: () => this.buyArtifact(artifact, rerender) }, 'Acheter')
              : artifact.state === 'active' || artifact.state === 'surpassed' ? h('span', { class: 'upgrade-owned' }, '✔ Acquis') : null,
            (artifact.state === 'available' || artifact.state === 'locked') && !artifact.canBuy.ok ? h('span', { class: 'upgrade-reason' }, artifact.canBuy.reason) : null))))),
    ];
  }

  buyDesk(rerender) {
    const result = buyDeskUpgrade(this.session);
    if (!result.ok) {
      showToast(result.reason, 'error');
      return;
    }
    this.autosave();
    showToast(`Un second Bureau d’étude est installé (−${deniers(result.cost)}) : deux combattants peuvent étudier en même temps.`, 'success');
    rerender();
    this.refresh();
  }

  buyArtifact(artifact, rerender) {
    const result = buyArtifact(this.session, artifact.id);
    if (!result.ok) {
      showToast(result.reason, 'error');
      return;
    }
    this.autosave();
    showToast(`${artifact.name} acquis (−${deniers(result.cost)}) : ses chances s’appliquent désormais.`, 'success');
    // L'artefact descendra se poser sur la table de Flavia à la fermeture de sa fenêtre.
    this.pendingArtifactDrop = true;
    rerender();
    this.refresh();
  }

  autosave() {
    if (!this.services.settings.get('gameplay.autosave')) return;
    try { this.services.saves.save(this.session); } catch { /* sauvegarde manuelle toujours possible */ }
  }
}
