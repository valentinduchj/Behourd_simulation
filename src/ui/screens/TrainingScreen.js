import { h } from '../../utils/dom.js';
import { HubScreen } from './HubScreen.js';
import { TrainingRenderer } from '../../training/TrainingRenderer.js';
import { createArena } from '../../combat/Arena.js';
import { Combatant } from '../../combat/Combatant.js';
import { Emblem } from '../../models/Emblem.js';
import { CombatPlayback } from '../../combat/presentation/CombatPlayback.js';
import { collectVfx, resolveVfxLevel, shakeAt } from '../../combat/presentation/vfx.js';
import { buildLicePresentation } from '../../combat/presentation/LicePresentation.js';
import { getBonusLabels } from '../../combat/presentation/bonusLabels.js';
import { COMBAT_PLAYBACK } from '../../data/combatRules.js';
import { TRAINING_DECORATION_ID } from '../../data/liceDecorations.js';
import { MARSHAL, TRAINING_FORMATS, DEFAULT_TRAINING_FORMAT, TRAINING_RULES, TRAINING_SIDE_B_COLORS } from '../../data/training.js';
import {
  fitTrainingSides, getTrainingFormat, listTrainableFighters, runTrainingCombat, validateTrainingSides,
} from '../../systems/training/TrainingCombatService.js';
import { getVisibleExits, describeExit } from '../../systems/navigation/LocationNavigationService.js';
import { getColorIntensity } from '../../systems/fighters/FatigueService.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';
import { DEFAULT_FIGHTER_FILTER, organizeFighters } from '../../systems/fighters/FighterListFilter.js';
import { buildTrainingJournal } from '../report/trainingJournal.js';
import { FighterFilterBar } from '../components/FighterFilterBar.js';
import { PickCard } from '../components/PickCard.js';
import { FighterStars } from '../components/Rating.js';
import { SpecialtyBadge } from '../components/SpecialtyBadge.js';
import { openModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { audioDirector, buildCombatCues, playCombatCues } from '../../audio/AudioDirector.js';
import { currentLocale } from '../../i18n/i18n.js';
import { createScenePacer } from '../../render/framePacing.js';
import { attachMapZoom } from '../mobile/MapZoom.js';
import { isMobileLayout } from '../mobile/mobileLayout.js';

const HINT = 'Cliquez sur le Marshal (tenue jaune rayée) pour préparer un combat d’entraînement. Le chemin de droite ramène au Centre.';

/**
 * Ma Lice d'entraînement (v0.71) : la lice du domaine. Le Marshal y prépare des combats
 * internes au club (1 contre 1, 3 contre 3, 5 contre 5), joués par le moteur de combat sans
 * aucune conséquence sur la partie (systems/training/TrainingCombatService.js), avec un journal
 * détaillé facultatif (ui/report/trainingJournal.js).
 */
export class TrainingScreen extends HubScreen {
  static hubLocationId = 'training';
  // Interface mobile : carte en plein écran, le reste de la page dans ce volet.
  static mobileSheet = { label: 'Préparer l’entraînement' };

  renderContent() {
    this.arena ??= createArena();
    this.formatId ??= DEFAULT_TRAINING_FORMAT;
    this.sides ??= { sideA: [], sideB: [] };
    this.fatigueMode ??= TRAINING_RULES.fatigueModes[0].id;
    this.showJournal ??= true;
    this.canvas = h('canvas', { class: 'arena-canvas training-canvas', 'aria-label': 'Ma Lice d’entraînement en vue isométrique' });
    this.hint = h('p', { class: 'centre-hint', role: 'status' }, HINT);
    this.panelHost = h('div', { class: 'training-panel' });
    this.renderPanel();
    return h(
      'div',
      { class: 'hub-page training-page' },
      h('header', { class: 'hub-page-header' },
        h('h1', {}, 'Ma Lice d’entraînement'),
        h('p', { class: 'hub-page-subtitle' }, 'Opposez vos combattants entre eux pour comprendre le combat : aucun enjeu, aucune conséquence sur votre compagnie.')),
      h('div', { class: 'arena-wrap arena-wrap-battle training-stage' }, this.canvas),
      this.hint,
      this.panelHost,
    );
  }

  mounted() {
    super.mounted();
    // Téléphone (v0.91) : pincer pour zoomer, glisser pour se déplacer sur la carte.
    if (isMobileLayout()) this.mapZoom = attachMapZoom(this.canvas, () => this.renderer);
    this.renderer = new TrainingRenderer(this.canvas);
    this.renderer.exits = getVisibleExits('TRAINING');
    this.presentation = this.buildPresentation();
    this.renderer.setPresentation(this.presentation);
    this.renderer.setArena(this.arena);
    this.renderer.resize();
    if (this.params.arrivalExitId) this.renderer.arrival = { exitId: this.params.arrivalExitId, start: null };
    this.listen(window, 'resize', () => this.renderer.resize());
    this.listen(this.canvas, 'mousemove', (event) => {
      const exit = this.renderer.exitAt(event.clientX, event.clientY);
      const marshal = !exit && this.renderer.isMarshalAt(event.clientX, event.clientY);
      this.renderer.hoverExitId = exit?.id ?? null;
      this.renderer.hoverMarshal = marshal;
      this.canvas.style.cursor = exit || marshal ? 'pointer' : 'default';
      const label = exit ? describeExit(exit) : null;
      this.hint.textContent = label ? `${label.title} — cliquez pour prendre le chemin.` : marshal ? `${MARSHAL.name} — cliquez pour préparer un combat d’entraînement.` : HINT;
    });
    this.listen(this.canvas, 'mouseleave', () => { this.renderer.hoverExitId = null; this.renderer.hoverMarshal = false; this.hint.textContent = HINT; });
    this.listen(this.canvas, 'click', (event) => {
      const exit = this.renderer.exitAt(event.clientX, event.clientY);
      if (exit) {
        this.travel(exit.id);
        return;
      }
      if (this.renderer.isMarshalAt(event.clientX, event.clientY)) this.openSetup();
    });
    let last = performance.now();
    const draw = createScenePacer();
    const frame = (now) => {
      if (draw(now)) {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (this.playback) this.advanceBattle(dt);
        this.renderer.render(this.liceScene ?? { arena: this.arena, combatants: [] }, now / 1000);
      }
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
  }

  unmount() {
    cancelAnimationFrame(this.frameId);
    // Rien à défaire : le combat d'entraînement n'a jamais touché la partie ; il est abandonné.
    this.clearCombat();
    super.unmount();
  }

  /** Décor : la lice d'entraînement, aux couleurs de la saison, et quelques compagnons qui regardent. */
  buildPresentation() {
    const teamId = this.session.player.teamId;
    return buildLicePresentation(this.session, {
      arena: this.arena, teamAId: teamId, teamBId: `${teamId}:entrainement`, matchday: 'entrainement',
      decorationId: TRAINING_DECORATION_ID, crowdSize: TRAINING_RULES.watchers, kind: 'training',
    });
  }

  // --- Préparation (le Marshal) ---

  /** Fenêtre de préparation : format, camps (composition puis récapitulatif), lancement. */
  openSetup() {
    if (this.playback && !this.battleFinished) return;
    let step = 'compose';
    let activeSide = 'sideA';
    let filter = { ...DEFAULT_FIGHTER_FILTER };
    const body = h('div', { class: 'training-setup' });
    let handle;
    const sides = () => this.sides;
    const fit = () => { this.sides = fitTrainingSides(this.session, this.formatId, this.sides); };
    fit();
    const render = () => {
      const format = getTrainingFormat(this.formatId);
      const check = validateTrainingSides(this.session, this.formatId, sides());
      const formatButtons = h('div', { class: 'training-formats', role: 'radiogroup', 'aria-label': 'Format du combat' }, TRAINING_FORMATS.map((f) => h('button', {
        type: 'button', class: `btn btn-sm ${f.id === this.formatId ? 'is-active' : ''}`.trim(), role: 'radio', 'aria-checked': String(f.id === this.formatId),
        onclick: () => { this.formatId = f.id; fit(); render(); },
      }, f.label)));
      const fatigueSelect = h('select', {
        class: 'select select-sm training-fatigue', 'aria-label': 'Fatigue de départ',
        onchange: (event) => { this.fatigueMode = event.target.value; },
      }, TRAINING_RULES.fatigueModes.map((mode) => h('option', { value: mode.id, selected: mode.id === this.fatigueMode }, mode.label)));
      const counter = (key, label) => {
        const count = sides()[key].length;
        return h('button', {
          type: 'button', class: `training-side-tab ${activeSide === key ? 'is-active' : ''} is-${key}`.trim(), 'aria-pressed': String(activeSide === key),
          onclick: () => { activeSide = key; render(); },
        }, `${label} : ${count} / ${format.size}${count < format.size ? ` — encore ${format.size - count}` : ' ✓'}`);
      };
      if (step === 'compose') {
        const fighters = listTrainableFighters(this.session);
        const chosen = [...sides().sideA, ...sides().sideB];
        const listed = organizeFighters(fighters, filter, { selectedIds: chosen });
        const toggle = (fighter) => {
          const own = sides()[activeSide];
          const other = sides()[activeSide === 'sideA' ? 'sideB' : 'sideA'];
          if (own.includes(fighter.id)) this.sides = { ...sides(), [activeSide]: own.filter((id) => id !== fighter.id) };
          else if (other.includes(fighter.id)) { showToast(`${fighter.name} est déjà dans l’autre camp.`, 'warning'); return; }
          else if (own.length < format.size) this.sides = { ...sides(), [activeSide]: [...own, fighter.id] };
          render();
        };
        const full = sides()[activeSide].length >= format.size;
        const cards = [...listed.shown, ...listed.outside].map((fighter) => {
          const camp = sides().sideA.includes(fighter.id) ? 'A' : sides().sideB.includes(fighter.id) ? 'B' : null;
          const card = PickCard(fighter, this.session.playerTeam, {
            selected: camp !== null, disabled: full && camp === null,
            onToggle: toggle,
          });
          if (camp) {
            card.classList.add(`is-camp-${camp.toLowerCase()}`);
            card.append(h('span', { class: `training-camp-badge is-${camp.toLowerCase()}` }, `Camp ${camp}`));
          }
          return card;
        });
        body.replaceChildren(
          h('div', { class: 'training-setup-head' }, h('span', { class: 'field-label' }, 'Format'), formatButtons, h('span', { class: 'field-label' }, 'Départ'), fatigueSelect),
          h('p', { class: 'muted' }, 'Choisissez le camp à composer, puis cliquez sur les combattants. Un combattant ne peut être que dans un seul camp.'),
          h('div', { class: 'training-side-tabs' }, counter('sideA', 'Camp A'), counter('sideB', 'Camp B')),
          FighterFilterBar(filter, (next) => { filter = next; render(); }, { shown: listed.matching, total: listed.total }),
          h('div', { class: 'pick-grid training-grid' }, cards),
        );
      } else {
        const list = (ids) => h('ul', { class: 'training-recap-list' }, ids.map((id) => {
          const fighter = this.session.getFighter(id);
          return h('li', {}, h('strong', {}, fighter.name), ' ', SpecialtyBadge(fighter.specialty), ' ', FighterStars(calculateFighterLevel(fighter)));
        }));
        body.replaceChildren(
          h('p', { class: 'training-recap-format' }, h('strong', {}, format.label), ` · ${TRAINING_RULES.fatigueModes.find((m) => m.id === this.fatigueMode)?.label ?? ''}`),
          h('div', { class: 'training-recap' },
            h('section', { class: 'training-recap-side is-a' }, h('h3', { class: 'sheet-section-title' }, 'Camp A'), list(sides().sideA)),
            h('section', { class: 'training-recap-side is-b' }, h('h3', { class: 'sheet-section-title' }, 'Camp B'), list(sides().sideB))),
          h('p', { class: 'muted' }, 'Entraînement : aucune fatigue, aucune statistique, aucun palmarès ni aucun denier ne changera.'),
        );
      }
      // Boutons de la fenêtre selon l'étape.
      const actions = handle?.element.querySelector('.modal-actions');
      if (actions) {
        actions.replaceChildren(...(step === 'compose'
          ? [
            h('button', { type: 'button', class: 'btn', onclick: () => handle.close(false) }, 'Annuler'),
            h('button', { type: 'button', class: 'btn btn-primary', disabled: !check.ok, title: check.ok ? null : check.reason, onclick: () => { step = 'recap'; render(); } }, 'Récapitulatif ▸'),
          ]
          : [
            h('button', { type: 'button', class: 'btn', onclick: () => handle.close(false) }, 'Annuler'),
            h('button', { type: 'button', class: 'btn', onclick: () => { step = 'compose'; render(); } }, 'Modifier la composition'),
            h('button', { type: 'button', class: 'btn btn-primary', disabled: !check.ok, onclick: () => { handle.close(true); this.launch(); } }, '⚔ Lancer le combat'),
          ]));
      }
    };
    handle = openModal({ title: `${MARSHAL.name} — combat d’entraînement`, className: 'modal-wide training-setup-modal', body, actions: [{ label: 'Annuler', value: false }] });
    render();
  }

  // --- Combat ---

  /** Lance (ou relance) le combat avec la composition actuelle : nouvelle simulation, rien de gardé. */
  launch() {
    const result = runTrainingCombat(this.session, { formatId: this.formatId, ...this.sides, fatigueMode: this.fatigueMode, seed: `${Date.now()}:${Math.random()}` });
    if (!result.ok) {
      showToast(result.reason, 'warning');
      return;
    }
    this.clearCombat();
    this.training = result;
    this.playback = new CombatPlayback(result.simulation);
    // Son : musique de combat dès que la manche se lance ; coups et KO suivent le rejeu.
    audioDirector.startMoment('roundStart');
    this.combatCues = buildCombatCues(this.playback);
    this.battleTime = 0;
    this.battleSpeed = COMBAT_PLAYBACK.speeds[0];
    this.cameraClose = true;
    this.celebrated = false;
    this.bonusLabels ??= getBonusLabels();
    const playerTeam = this.session.playerTeam;
    const sideB = this.sideBTeam(playerTeam);
    this.battleCombatants = result.simulation.initial.map((unit) => {
      const combatant = new Combatant({
        fighter: this.session.getFighter(unit.id),
        team: unit.side === 'A' ? playerTeam : sideB,
        sideIndex: unit.side === 'A' ? 0 : 1,
        position: { x: unit.x + 0.5, y: unit.y + 0.5 },
      });
      combatant.colorIntensity = getColorIntensity(unit.fatigue);
      return combatant;
    });
    this.liceScene = { arena: this.arena, combatants: this.battleCombatants };
    this.sideColors = { A: playerTeam.emblem.resolvedColors().primary, B: sideB.emblem.resolvedColors().primary };
    const format = getTrainingFormat(this.formatId);
    this.journal = buildTrainingJournal(result.simulation, {
      nameOf: (id) => this.session.getFighter(id)?.name ?? id,
      formatLabel: format.label,
      maxEntries: TRAINING_RULES.journalMaxEntries,
    });
    this.journalShown = 0;
    // Le Marshal se poste hors de la lice et donne le signal pendant l'introduction.
    this.renderer.combat = { start: null, signalSeconds: this.playback.introSeconds };
    this.renderPanel();
    this.advanceBattle(0);
    this.canvas.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }

  /** Camp B : la compagnie, sous des tabards de couleur contrastée. */
  sideBTeam(playerTeam) {
    const colors = playerTeam.emblem.colors.primary === 'azur' ? TRAINING_SIDE_B_COLORS.alternate : TRAINING_SIDE_B_COLORS.default;
    return { id: `${playerTeam.id}:entrainement`, name: 'Camp B', emblem: new Emblem({ colors, patternId: playerTeam.emblem.patternId }) };
  }

  /** Abandonne le combat affiché (rien n'a été écrit dans la partie). */
  clearCombat() {
    // Fin du combat : retour en fondu à la musique de la lice (seulement si un combat était en cours).
    if (this.playback) audioDirector.endMoment();
    this.training = null;
    this.playback = null;
    this.battleCombatants = null;
    this.journal = null;
    this.liceScene = null;
    if (this.renderer) {
      this.renderer.combat = null;
      this.renderer.effects = [];
      this.renderer.vfx = [];
      this.renderer.shake = { x: 0, y: 0 };
      this.renderer.setCameraTarget(null);
    }
  }

  get battleFinished() {
    return Boolean(this.playback) && this.battleTime >= this.playback.duration;
  }

  advanceBattle(dt) {
    if (!this.playback) return;
    const before = this.battleTime;
    this.battleTime = Math.min(this.playback.duration, this.battleTime + dt * this.battleSpeed);
    playCombatCues(this.combatCues, before, this.battleTime, { maxJump: 0.6 * Math.max(1, this.battleSpeed) });
    const frame = this.playback.frameAt(this.battleTime);
    const byId = new Map(frame.units.map((unit) => [unit.id, unit]));
    for (const combatant of this.battleCombatants) {
      const unit = byId.get(combatant.id);
      combatant.position = { x: unit.x + 0.5, y: unit.y + 0.5 };
      const icons = frame.intro ? (unit.bonuses ?? []).map((id) => this.bonusLabels[id]?.icon).filter(Boolean) : [];
      combatant.view = { ...unit, badges: icons.length ? [icons.join(' ')] : [] };
      combatant.state = unit.state;
    }
    const level = resolveVfxLevel(this.services.settings.get('display.vfx'));
    this.renderer.effects = frame.effects;
    this.renderer.vfx = collectVfx(this.playback, this.battleTime, { level, arenaHeight: this.arena.height, sideColors: this.sideColors });
    this.renderer.shake = shakeAt(this.playback, this.battleTime, { level, arenaHeight: this.arena.height });
    this.renderer.setCameraTarget(this.cameraClose && !frame.intro ? this.cameraArea(frame) : null);
    if (this.battleFinished && !this.celebrated) {
      this.celebrated = true;
      const side = this.playback.simulation.winnerSide;
      const winners = frame.units.filter((u) => !u.ko && this.playback.sideOf.get(u.id) === side).map((u) => ({ x: u.x + 0.5, y: u.y + 0.5 }));
      if (winners.length) this.renderer.celebrateRound(winners, this.sideColors[side]);
    }
    if (this.status) {
      const alive = (side) => frame.units.filter((u) => !u.ko && this.playback.sideOf.get(u.id) === side).length;
      this.status.textContent = frame.intro
        ? `${MARSHAL.name} lève son drapeau : début du combat…`
        : this.battleFinished
        ? `Combat terminé : victoire du camp ${this.playback.simulation.winnerSide}.`
        : `Debout — Camp A : ${alive('A')} · Camp B : ${alive('B')}`;
    }
    this.updateJournal();
    // Panneau de fin (relancer, modifier) dès que le rejeu est terminé.
    if (this.battleFinished !== this.panelFinished) this.renderPanel();
  }

  /** Cadrage de la caméra : les combattants encore debout, avec une marge. */
  cameraArea(frame) {
    const standing = frame.units.filter((unit) => !unit.ko);
    if (!standing.length) return null;
    const xs = standing.map((u) => u.x);
    const ys = standing.map((u) => u.y);
    const pad = 2.2;
    const x = Math.max(-1, Math.min(...xs) - pad);
    const y = Math.max(-1, Math.min(...ys) - pad);
    return { x, y, w: Math.max(7, Math.max(...xs) - x + pad + 1), h: Math.max(5, Math.max(...ys) - y + pad + 1) };
  }

  // --- Panneau : contrôles, journal, fin du combat ---

  renderPanel() {
    if (!this.panelHost) return;
    if (!this.playback) {
      this.status = null;
      this.journalList = null;
      this.panelHost.replaceChildren(h('div', { class: 'panel training-idle' },
        h('p', {}, `Le ${MARSHAL.name} arbitre vos combats d’entraînement. Choisissez un format (1 contre 1, 3 contre 3, 5 contre 5), composez deux camps parmi vos combattants, puis lancez : le combat suit exactement les règles des combats officiels, sans aucune conséquence.`),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.openSetup() }, `Parler au ${MARSHAL.name}`)));
      return;
    }
    const finished = this.battleFinished;
    this.panelFinished = finished;
    this.status = h('p', { class: 'battle-status', role: 'status' });
    const controls = h('div', { class: 'match-actions training-controls' },
      ...COMBAT_PLAYBACK.speeds.map((speed) => h('button', {
        type: 'button', class: `btn btn-sm ${this.battleSpeed === speed ? 'is-active' : ''}`.trim(), disabled: finished, 'aria-pressed': String(this.battleSpeed === speed),
        onclick: () => { this.battleSpeed = speed; this.renderPanel(); },
      }, `×${speed}`)),
      h('button', { type: 'button', class: 'btn btn-sm', 'aria-pressed': String(!this.cameraClose), onclick: () => { this.cameraClose = !this.cameraClose; this.renderPanel(); } }, this.cameraClose ? '🔍 Vue d’ensemble' : '🔍 Suivre le combat'),
      finished ? null : h('button', { type: 'button', class: 'btn', onclick: () => { this.battleTime = this.playback.duration; this.advanceBattle(0); } }, 'Passer à la fin ▸▸'),
      finished ? h('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.launch() }, '↻ Relancer le même combat') : null,
      finished ? h('button', { type: 'button', class: 'btn', onclick: () => this.openSetup() }, 'Modifier la composition') : null,
      h('button', { type: 'button', class: 'btn', onclick: () => { this.clearCombat(); this.renderPanel(); } }, finished ? 'Revenir à la lice' : 'Arrêter le combat'),
    );
    const toggle = h('label', { class: 'check-field training-journal-toggle' },
      h('input', { type: 'checkbox', checked: this.showJournal, onchange: (event) => { this.showJournal = event.target.checked; this.renderJournalFrame(); } }),
      ' Afficher le journal détaillé du combat');
    this.journalFrame = h('section', { class: 'training-journal', 'aria-label': 'Journal détaillé du combat' });
    this.panelHost.replaceChildren(h('div', { class: 'panel training-battle' }, this.status, controls, toggle, this.journalFrame));
    this.renderJournalFrame();
    this.advanceStatusOnly();
  }

  /** Statut à jour sans relancer le rejeu (après un changement de panneau). */
  advanceStatusOnly() {
    if (this.playback) this.advanceBattle(0);
  }

  renderJournalFrame() {
    if (!this.journalFrame) return;
    this.journalFrame.hidden = !this.showJournal;
    this.journalList = h('ol', { class: 'training-journal-list' });
    this.journalShown = 0;
    this.journalFrame.replaceChildren(this.journalList);
    this.updateJournal();
  }

  /** Ajoute au journal les événements déjà joués (rendu progressif ; la simulation n'en dépend pas). */
  updateJournal() {
    if (!this.journal || !this.journalList || !this.showJournal) return;
    const now = this.battleTime - this.playback.introSeconds;
    const due = this.journal.filter((entry) => entry.kind === 'start' || entry.time <= now || this.battleFinished).length;
    if (due <= this.journalShown) return;
    const atBottom = this.journalList.scrollHeight - this.journalList.scrollTop - this.journalList.clientHeight < 40;
    for (const entry of this.journal.slice(this.journalShown, due)) {
      this.journalList.append(h(
        'li',
        { class: `journal-entry is-${entry.kind} tone-${entry.tone}${entry.side ? ` side-${entry.side.toLowerCase()}` : ''}`, 'data-kind': entry.kind },
        h('p', { class: 'journal-title' }, h('span', { class: 'journal-time' }, `[${entry.time.toLocaleString(currentLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s]`), ' ', entry.title),
        entry.lines.length ? h('ul', { class: 'journal-lines' }, entry.lines.map((line) => h('li', {}, line))) : null,
      ));
    }
    this.journalShown = due;
    if (atBottom) this.journalList.scrollTop = this.journalList.scrollHeight;
  }
}
