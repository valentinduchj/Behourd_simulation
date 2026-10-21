import { h } from '../../utils/dom.js';
import { BaseScreen } from './BaseScreen.js';
import { SCREENS } from '../../core/screenIds.js';
import { SINGULAR_RULES, SINGULAR_OPPONENT_COLORS, getSingularBoon, getSingularReward, describeSingularReward } from '../../data/singularExpedition.js';
import { getLiceDecoration } from '../../data/liceDecorations.js';
import { SPECTATOR_SPRITES } from '../../data/spectators.js';
import { COMBAT_PLAYBACK } from '../../data/combatRules.js';
import { TALENT_RARITIES } from '../../data/talents.js';
import { createArena } from '../../combat/Arena.js';
import { Combatant } from '../../combat/Combatant.js';
import { IsoRenderer } from '../../combat/render/IsoRenderer.js';
import { CombatPlayback } from '../../combat/presentation/CombatPlayback.js';
import { collectVfx, resolveVfxLevel, shakeAt } from '../../combat/presentation/vfx.js';
import { generateCrowd } from '../../combat/presentation/crowdLayout.js';
import { Emblem } from '../../models/Emblem.js';
import { createFramePacer } from '../../render/framePacing.js';
import { audioDirector, buildCombatCues, playCombatCues } from '../../audio/AudioDirector.js';
import { getCurrentSeason } from '../../systems/climate/ClimateService.js';
import { getColorIntensity } from '../../systems/fighters/FatigueService.js';
import { getStat } from '../../systems/fighters/stats.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';
import { getPotential } from '../../systems/fighters/PotentialService.js';
import { getTalent } from '../../systems/talents/TalentService.js';
import {
  getSingularRun, canFightNext, fightNext, currentOpponent, boonsOf, optionTargets, chooseOption, abandonRun,
  getVictoryClaims, planTalentClaims, placeOfRun, runHp, runMaxHp,
} from '../../systems/expeditions/SingularRunService.js';
import { claimSingularVictory } from '../../systems/expeditions/ExpeditionService.js';
import { describeReward } from '../components/ExpeditionBoard.js';
import { FighterSprite } from '../components/FighterSprite.js';
import { FighterClassTags } from '../components/SpecialtyBadge.js';
import { FighterStars } from '../components/Rating.js';
import { TalentBadge, TalentBadges } from '../components/TalentBadge.js';
import { openModal, confirmModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { haptic } from '../mobile/Haptics.js';
import { isMobileLayout } from '../mobile/mobileLayout.js';

// Expédition singulière (v1.1) : dix duels d'affilée dans la lice du Sentier, en pleine forêt.
//   en haut : la frise des dix combats ;
//   à gauche : la lice (adversaire du combat en cours, puis le rejeu du duel) ;
//   à droite : selon l'étape — choix du combattant, propositions entre deux combats, victoire.
// Les règles sont dans systems/expeditions/SingularRunService.js ; cet écran ne fait que recueillir
// les choix du joueur et afficher les résultats.

// Adversaires : la compagnie du Sentier (couleurs de forêt).
const FOREST_TEAM = Object.freeze({ id: 'sentier', name: 'Les gens du Sentier', emblem: new Emblem({ colors: SINGULAR_OPPONENT_COLORS }) });
// Spectateurs : villageois et enfants (les bêtes sont dans le décor).
const VILLAGERS = SPECTATOR_SPRITES.filter((sprite) => ['spectator_01', 'spectator_02', 'spectator_03', 'spectator_04', 'spectator_11'].includes(sprite.id));

const fatigueOf = (fighter) => Math.round(getStat(fighter, 'fatigue'));

/** PV de l'expédition (v1.1.7 : ils ne se récupèrent pas d'un combat à l'autre). */
function HpGauge(value, max) {
  const ratio = max > 0 ? value / max : 0;
  const tone = value <= 0 ? 'is-spent' : ratio <= 0.25 ? 'is-tired' : ratio <= 0.5 ? 'is-warm' : '';
  return h('span', { class: `sx-fatigue sx-hp ${tone}`.trim(), title: `Points de vie ${value} / ${max}` },
    h('span', { class: 'sx-fatigue-bar' }, h('span', { style: { width: `${Math.max(0, Math.min(100, ratio * 100))}%` } })),
    h('span', { class: 'sx-fatigue-value' }, `PV ${value}`));
}

export class SingularExpeditionScreen extends BaseScreen {
  static theme = 'hub';

  constructor(context) {
    super(context);
    this.session = this.services.gameState.session;
    this.arena = createArena(SINGULAR_RULES.arenaId);
    this.selectedId = null;
    this.playback = null;
    this.lastFight = null;
    this.pendingOption = null;
    this.assignments = {};
  }

  get run() {
    return getSingularRun(this.session) ?? (this.session.expeditions?.run?.phase === 'victory' ? this.session.expeditions.run : null);
  }

  render() {
    const run = this.run;
    this.el = h('section', { class: 'screen screen-singular' });
    if (!run) {
      this.el.append(this.renderOutcome());
      return this.el;
    }
    this.place = placeOfRun(run);
    this.headerEl = h('header', { class: 'sx-header' });
    this.timelineEl = h('ol', { class: 'sx-timeline', 'aria-label': 'Les dix combats' });
    this.canvas = h('canvas', { class: 'arena-canvas sx-canvas', 'aria-label': 'La lice du Sentier' });
    this.statusEl = h('p', { class: 'sx-status', role: 'status' });
    this.controlsEl = h('div', { class: 'sx-controls' });
    this.sideEl = h('aside', { class: 'sx-side' });
    this.el.append(
      this.headerEl,
      this.timelineEl,
      h('div', { class: 'sx-body' },
        h('section', { class: 'sx-stage' }, h('div', { class: 'sx-canvas-wrap' }, this.canvas), this.statusEl, this.controlsEl),
        this.sideEl),
    );
    this.refresh();
    return this.el;
  }

  mounted() {
    if (!this.canvas) return;
    const run = this.run;
    this.renderer = new IsoRenderer(this.canvas);
    const season = getCurrentSeason(this.session).id;
    this.renderer.setPresentation({
      decoration: getLiceDecoration(SINGULAR_RULES.decorationId),
      crowd: generateCrowd({ arena: this.arena, count: 7, seed: run.id, sprites: VILLAGERS }),
      season,
    });
    this.renderer.setArena(this.arena);
    this.renderer.resize();
    this.listen(window, 'resize', () => this.renderer?.resize());
    this.refreshScene();
    let last = performance.now();
    const draw = createFramePacer();
    const frame = (now) => {
      if (draw(now)) {
        const dt = (now - last) / 1000;
        last = now;
        if (this.playback) this.advance(dt);
        this.renderer.render(this.scene, now / 1000);
      }
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
  }

  unmount() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.renderer = null;
    super.unmount();
  }

  // --- Affichage ---

  refresh() {
    const run = this.run;
    if (!run) {
      this.el.replaceChildren(this.renderOutcome());
      if (this.frameId) cancelAnimationFrame(this.frameId);
      return;
    }
    this.headerEl.replaceChildren(
      h('div', {},
        h('h1', { class: 'sx-title' }, `⚜ ${this.place?.name ?? 'Expédition singulière'}`),
        h('p', { class: 'sx-subtitle' }, `Expédition singulière · dix duels, une manche gagnante · récompense : ${describeReward(run.reward)}`)),
      h('div', { class: 'sx-header-actions' },
        h('button', { type: 'button', class: 'btn btn-sm sx-back', title: 'Retour au domaine (l’expédition attend)', onclick: () => this.navigate(SCREENS.EXPEDITIONS) }, isMobileLayout() ? '◂' : '◂ Le domaine'),
        run.phase === 'victory' ? null : h('button', { type: 'button', class: 'btn btn-sm btn-danger sx-abandon', onclick: () => this.abandon() }, isMobileLayout() ? '⚑ Abandonner' : 'Abandonner')),
    );
    this.timelineEl.replaceChildren(...this.renderTimeline(run));
    this.sideEl.replaceChildren(...this.renderSide(run).filter(Boolean));
    this.renderControls();
    this.refreshScene();
  }

  renderTimeline(run) {
    return run.opponents.map((entry, index) => {
      const done = index < run.stage;
      const current = index === run.stage && run.phase !== 'victory';
      const tries = run.history.filter((fight) => fight.stage === index);
      const winner = tries.find((fight) => fight.won);
      const winnerName = winner ? this.session.getFighter(winner.fighterId)?.name : null;
      const spec = entry.fighter.specialtyId;
      const talents = (entry.talents ?? []).map((id) => getTalent(id)?.name).filter(Boolean);
      return h('li', {
        class: ['sx-node', done ? 'is-done' : '', current ? 'is-current' : '', entry.boss ? 'is-boss' : ''].filter(Boolean).join(' '),
        'data-stage': String(index),
        title: `Combat ${index + 1} : ${entry.fighter.name} — ${entry.stars} étoiles${talents.length ? ` · ${talents.join(', ')}` : ''}${winnerName ? ` · gagné par ${winnerName}` : ''}`,
      },
      h('span', { class: 'sx-node-number' }, entry.boss ? '👑' : String(index + 1)),
      h('span', { class: 'sx-node-class', 'aria-hidden': 'true' }, { lutteur: '✊', hastier: '🔱', runner: '🏃' }[spec] ?? '⚔'),
      h('span', { class: 'sx-node-stars' }, `${entry.stars}★`),
      tries.filter((fight) => !fight.won).length ? h('span', { class: 'sx-node-ko', title: 'Combattants battus à ce combat' }, '✖'.repeat(tries.filter((fight) => !fight.won).length)) : null,
      talents.length ? h('span', { class: 'sx-node-talent', 'aria-hidden': 'true' }, '✦') : null);
    });
  }

  renderSide(run) {
    if (this.playback) return [this.renderFightCard(run, { watching: true })];
    const banner = this.lastFight ? this.renderLastFight() : null;
    if (run.phase === 'choice') return [banner, this.renderChoice(run)];
    if (run.phase === 'victory') return [banner, this.renderVictory(run)];
    return [banner, this.renderFightCard(run), this.renderSquadPicker(run)];
  }

  renderLastFight() {
    const { won, fighterName, opponentName } = this.lastFight;
    return h('p', { class: `sx-last ${won ? 'is-won' : 'is-lost'}` }, won
      ? `Victoire ! ${fighterName} a battu ${opponentName}.`
      : `${fighterName} est battu par ${opponentName} : KO jusqu’à la fin de l’expédition. Un autre doit reprendre ce combat.`);
  }

  /** L'adversaire du combat en cours. */
  renderFightCard(run, { watching = false } = {}) {
    const opponent = currentOpponent(run);
    if (!opponent) return null;
    const { entry, fighter, hp, maxHp } = opponent;
    // Téléphone (v1.2) : carte résumée en haut à droite ; un appui ouvre la fiche complète.
    const mobile = isMobileLayout();
    return h('article', {
      class: `sx-opponent ${entry.boss ? 'is-boss' : ''}`.trim(),
      ...(mobile ? { role: 'button', tabindex: '0', title: 'Voir la fiche de l’adversaire', onclick: () => this.openOpponent(run) } : {}),
    },
      h('h2', { class: 'sx-section-title' }, watching ? `Combat ${run.stage + 1} / ${SINGULAR_RULES.fights} — en cours` : `Combat ${run.stage + 1} / ${SINGULAR_RULES.fights}${entry.boss ? ' — le dernier' : ''}`),
      h('div', { class: 'sx-fighter-row' },
        FighterSprite(fighter, { size: 46, team: FOREST_TEAM }),
        h('div', { class: 'sx-fighter-who' },
          h('strong', {}, fighter.name),
          h('span', { class: 'sx-tags' }, ...FighterClassTags(fighter, this.session), FighterStars(calculateFighterLevel(fighter))),
          (entry.talents ?? []).length ? h('span', { class: 'sx-tags' }, ...TalentBadges(fighter, this.session)) : null),
        HpGauge(Math.round(hp), maxHp)));
  }

  /** Téléphone : la fiche complète de l'adversaire du combat en cours. */
  openOpponent(run) {
    const opponent = currentOpponent(run);
    if (!opponent) return null;
    const { entry, fighter, hp, maxHp } = opponent;
    return openModal({
      title: `${entry.boss ? '👑 ' : ''}${fighter.name} — combat ${run.stage + 1} / ${SINGULAR_RULES.fights}`,
      className: 'sx-opponent-modal',
      body: h('div', { class: 'sx-fighter-row' },
        FighterSprite(fighter, { size: 64, team: FOREST_TEAM }),
        h('div', { class: 'sx-fighter-who' },
          h('span', { class: 'sx-tags' }, ...FighterClassTags(fighter, this.session), FighterStars(calculateFighterLevel(fighter))),
          (entry.talents ?? []).length ? h('span', { class: 'sx-tags' }, ...TalentBadges(fighter, this.session)) : h('span', { class: 'muted' }, 'sans talent'),
          (entry.talents ?? []).map((id) => getTalent(id)).filter(Boolean).map((talent) => h('p', { class: 'muted', style: { margin: '0' } }, `${talent.name} : ${talent.description}`))),
        HpGauge(Math.round(hp), maxHp)),
      actions: [{ label: 'Fermer', variant: 'primary' }],
    });
  }

  /** Choisir qui entre en lice. */
  renderSquadPicker(run) {
    const able = run.fighterIds.filter((id) => canFightNext(this.session, id).ok);
    if (!able.includes(this.selectedId)) this.selectedId = able[0] ?? null;
    return h('section', { class: 'sx-squad' },
      h('h2', { class: 'sx-section-title' }, 'Qui entre en lice ?'),
      h('ul', { class: 'sx-squad-list' }, run.fighterIds.map((id) => {
        const fighter = this.session.getFighter(id);
        const check = canFightNext(this.session, id);
        const ko = run.ko.includes(id);
        const boons = boonsOf(run, id);
        return h('li', {}, h('button', {
          type: 'button', class: `sx-member ${ko ? 'is-ko' : ''}`.trim(), 'data-fighter-id': id, disabled: !check.ok,
          'aria-pressed': String(this.selectedId === id), title: check.reason ?? `Envoyer ${fighter.name}`,
          onclick: () => { this.selectedId = id; this.refresh(); },
        },
        FighterSprite(fighter, { size: 40, team: this.session.playerTeam }),
        h('span', { class: 'sx-fighter-who' },
          h('strong', {}, fighter.name, ko ? h('span', { class: 'sx-ko' }, ' KO') : null),
          h('span', { class: 'sx-tags' }, ...FighterClassTags(fighter, this.session), FighterStars(calculateFighterLevel(fighter))),
          boons.length ? h('span', { class: 'sx-boons' }, boons.map((b) => h('span', { class: 'sx-boon-icon', title: `${b.def.name} : ${b.def.description}` }, b.def.icon))) : null),
        HpGauge(runHp(this.session, run, id), runMaxHp(this.session, run, id))));
      })),
      h('button', { type: 'button', class: 'btn btn-fight sx-fight', disabled: !this.selectedId, onclick: () => this.fight() },
        this.selectedId ? `⚔ Combattre avec ${this.session.getFighter(this.selectedId).name}` : 'Personne n’est en état'));
  }

  /** Entre deux combats : trois propositions, on en garde une. */
  renderChoice(run) {
    return h('section', { class: 'sx-choice' },
      h('h2', { class: 'sx-section-title' }, `Avant le combat ${run.stage + 1} : gardez une proposition`),
      h('div', { class: 'sx-options' }, run.options.map((option, index) => {
        const def = option.kind === 'boon' ? getSingularBoon(option.id) : getSingularReward(option.id);
        const targets = optionTargets(this.session, run, option);
        const open = this.pendingOption === index;
        return h('article', { class: `sx-option is-${option.kind} ${def.rare ? 'is-rare' : ''} ${open ? 'is-open' : ''}`.replace(/\s+/g, ' ').trim(), 'data-option': option.id },
          h('button', { type: 'button', class: 'sx-option-main', onclick: () => this.pick(index) },
            h('span', { class: 'sx-option-kind' }, option.kind === 'boon' ? 'Bonus d’expédition' : 'Récompense de fin'),
            h('span', { class: 'sx-option-icon', 'aria-hidden': 'true' }, def.icon),
            h('strong', {}, def.name),
            h('span', { class: 'sx-option-desc' }, option.kind === 'reward' ? describeSingularReward(def, run.band ?? 0) : def.description)),
          open && targets.length
            ? h('div', { class: 'sx-targets' },
              h('span', { class: 'muted' }, 'Pour qui ?'),
              ...targets.map((id) => h('button', { type: 'button', class: 'btn btn-sm', 'data-target-id': id, onclick: () => this.pick(index, id) }, this.session.getFighter(id).name)))
            : null);
      })),
      run.rewards.length ? h('p', { class: 'muted sx-kept' }, `Récompenses de fin gardées : ${run.rewards.map((r) => getSingularReward(r.id)?.name).join(', ')}.`) : null);
  }

  /** Victoire : qui reçoit quoi, puis retour au domaine. */
  renderVictory(run) {
    const claims = getVictoryClaims(this.session, run);
    const plan = planTalentClaims(this.session, claims, this.assignments);
    const rows = claims.map((claim) => {
      const chosen = this.assignments[claim.key] ?? {};
      const step = plan.steps[claim.key];
      const label = claim.kind === 'talent'
        ? h('span', {}, 'Talent ', TalentBadge(getTalent(claim.talentId), this.session))
        : claim.kind === 'potential' ? `+${claim.value} potentiel 🔥` : `+${claim.value} dans chaque compétence de combat`;
      // Talent : s'il a déjà deux talents (à ce moment, autres récompenses comprises), il en remplace un.
      const slotPicker = claim.kind === 'talent' && chosen.fighterId && step?.needsSlot
        ? h('div', { class: 'sx-slots' },
          h('span', { class: 'muted' }, 'Remplacer :'),
          ...step.talents.map((id, slot) => h('button', {
            type: 'button', class: 'btn btn-sm', 'aria-pressed': String(chosen.slot === slot), 'data-slot': String(slot),
            onclick: () => { this.assignments[claim.key] = { ...chosen, slot }; this.refresh(); },
          }, getTalent(id)?.name ?? id)))
        : null;
      return h('li', { class: 'sx-claim', 'data-claim': claim.key },
        h('div', { class: 'sx-claim-what' }, label),
        claim.eligible.length
          ? h('div', { class: 'sx-claim-who' }, ...claim.eligible.map((id) => h('button', {
            type: 'button', class: 'btn btn-sm', 'aria-pressed': String(chosen.fighterId === id), 'data-fighter-id': id,
            // Potentiel : jamais plus que 3 flammes (autres flammes déjà attribuées comprises).
            disabled: (claim.kind === 'potential' && getPotential(this.session.getFighter(id)) + claim.value
                + claims.filter((other) => other !== claim && other.kind === 'potential' && this.assignments[other.key]?.fighterId === id).reduce((s2, other) => s2 + other.value, 0) > 3),
            onclick: () => { this.assignments[claim.key] = { fighterId: id, slot: null }; this.refresh(); },
          }, this.session.getFighter(id).name)),
          // v1.1.7 : le joueur peut aussi ne pas l'attribuer.
          h('button', {
            type: 'button', class: 'btn btn-sm sx-skip-claim', 'aria-pressed': String(chosen.fighterId === null), 'data-skip': claim.key,
            onclick: () => { this.assignments[claim.key] = { fighterId: null, slot: null }; this.refresh(); },
          }, 'Ne pas attribuer'))
          : h('p', { class: 'muted' }, 'Personne ne peut le recevoir : il est perdu.'),
        slotPicker);
    });
    // Prêt : chaque récompense a son combattant (ou « ne pas attribuer »), et le plan des talents tient.
    const ready = plan.ok && claims.every((claim) => !claim.eligible.length || Object.prototype.hasOwnProperty.call(this.assignments, claim.key));
    const kept = run.rewards.map((r) => getSingularReward(r.id)).filter(Boolean);
    return h('section', { class: 'sx-victory' },
      h('h2', { class: 'sx-section-title' }, '🏆 Les dix combats sont gagnés !'),
      h('p', {}, `Récompense de la carte : ${describeReward(run.reward)}.`),
      kept.length ? h('p', {}, `Récompenses de fin : ${kept.map((r) => `${r.icon} ${r.name}`).join(' · ')}.`) : null,
      rows.length ? h('ul', { class: 'sx-claims' }, rows) : null,
      !plan.ok && plan.reason !== 'Choisissez le talent remplacé.' ? h('p', { class: 'form-error' }, plan.reason) : null,
      h('button', { type: 'button', class: 'btn btn-primary sx-claim-button', disabled: !ready, onclick: () => this.claim() }, 'Recevoir les récompenses ▸'));
  }

  renderOutcome() {
    const last = this.session.expeditions?.lastRun;
    const won = last?.outcome === 'won';
    const text = !last ? 'Aucune expédition singulière en cours.'
      : won ? 'Expédition gagnée : les récompenses sont reçues.'
      : last.outcome === 'abandoned' ? 'Expédition abandonnée : les Ferveurs sont perdues. Les combattants rentrent avec leur fatigue.'
      : `Expédition perdue au combat ${last.stage + 1} : les trois combattants sont hors d’état. Les Ferveurs sont perdues.`;
    return h('div', { class: 'sx-outcome hub-card' },
      h('h1', { class: 'sx-title' }, won ? '🏆 Expédition gagnée' : '⚜ Expédition singulière'),
      h('p', {}, text),
      h('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.navigate(SCREENS.EXPEDITIONS) }, 'Retour aux Expéditions'));
  }

  renderControls() {
    if (!this.controlsEl) return;
    if (!this.playback) {
      this.controlsEl.replaceChildren();
      return;
    }
    const finished = this.battleTime >= this.playback.duration;
    this.controlsEl.replaceChildren(
      ...COMBAT_PLAYBACK.speeds.map((speed) => h('button', {
        type: 'button', class: `btn btn-sm ${this.speed === speed ? 'is-active' : ''}`.trim(), disabled: finished, 'aria-pressed': String(this.speed === speed),
        onclick: () => { this.speed = speed; this.renderControls(); },
      }, `×${speed}`)),
      finished
        ? h('button', { type: 'button', class: 'btn btn-primary sx-next', onclick: () => this.endPlayback() }, 'Suite ▸')
        : h('button', { type: 'button', class: 'btn sx-skip', onclick: () => { this.battleTime = this.playback.duration; this.advance(0); } }, 'Passer à la fin ▸▸'),
    );
  }

  // --- Lice ---

  combatant(fighter, team, sideIndex, tile, fatigue) {
    const combatant = new Combatant({ fighter, team, sideIndex, position: { x: tile.x + 0.5, y: tile.y + 0.5 } });
    combatant.colorIntensity = getColorIntensity(fatigue);
    return combatant;
  }

  /** Avant un combat : le combattant choisi face à l'adversaire du combat. */
  refreshScene() {
    if (this.playback) return;
    const run = this.run;
    const combatants = [];
    if (run && run.phase !== 'victory') {
      const opponent = currentOpponent(run);
      const [slotA] = this.arena.getDefaultTiles(0, 1);
      const [slotB] = this.arena.getDefaultTiles(1, 1);
      const mine = this.selectedId ? this.session.getFighter(this.selectedId) : null;
      if (mine) combatants.push(this.combatant(mine, this.session.playerTeam, 0, slotA, fatigueOf(mine)));
      if (opponent) combatants.push(this.combatant(opponent.fighter, FOREST_TEAM, 1, slotB, opponent.fatigue));
    }
    this.scene = { arena: this.arena, combatants };
    if (this.statusEl) {
      this.statusEl.textContent = !run ? '' : run.phase === 'choice' ? 'Le combat est gagné. Une halte au camp avant le suivant.'
        : run.phase === 'victory' ? 'La forêt applaudit : l’expédition est gagnée.'
        : `Combat ${run.stage + 1} sur ${SINGULAR_RULES.fights}. ${run.ko.length ? `KO : ${run.ko.length} / 3.` : ''}`;
    }
  }

  advance(dt) {
    const before = this.battleTime;
    const wasFinished = before >= this.playback.duration;
    this.battleTime = Math.min(this.playback.duration, this.battleTime + dt * this.speed);
    playCombatCues(this.cues, before, this.battleTime, { maxJump: 0.6 * Math.max(1, this.speed) });
    const frame = this.playback.frameAt(this.battleTime);
    const byId = new Map(frame.units.map((unit) => [unit.id, unit]));
    for (const combatant of this.scene.combatants) {
      const unit = byId.get(combatant.id);
      if (!unit) continue;
      combatant.position = { x: unit.x + 0.5, y: unit.y + 0.5 };
      combatant.view = { ...unit, badges: [] };
      combatant.state = unit.state;
    }
    if (this.renderer) {
      const level = resolveVfxLevel(this.services.settings.get('display.vfx'));
      const sideColors = { A: this.session.playerTeam?.emblem.resolvedColors().primary ?? null, B: FOREST_TEAM.emblem.resolvedColors().primary };
      this.renderer.effects = frame.effects;
      this.renderer.vfx = collectVfx(this.playback, this.battleTime, { level, arenaHeight: this.arena.height, sideColors });
      this.renderer.shake = shakeAt(this.playback, this.battleTime, { level, arenaHeight: this.arena.height });
    }
    if (this.statusEl) {
      this.statusEl.textContent = frame.intro ? 'Les deux combattants se saluent…' : this.battleTime >= this.playback.duration
        ? (this.lastFight.won ? `Victoire de ${this.lastFight.fighterName} !` : `${this.lastFight.fighterName} est à terre.`)
        : `${this.lastFight.fighterName} contre ${this.lastFight.opponentName}`;
    }
    if ((this.battleTime >= this.playback.duration) !== wasFinished || dt === 0) this.renderControls();
  }

  // --- Actions ---

  fight() {
    if (!this.selectedId) return;
    const fighter = this.session.getFighter(this.selectedId);
    const opponentName = currentOpponent(this.run)?.fighter.name ?? '';
    const result = fightNext(this.session, this.selectedId);
    if (!result.ok) {
      showToast(result.reason, 'error');
      return;
    }
    haptic('heavy');
    this.lastFight = { won: result.won, fighterName: fighter.name, opponentName };
    this.playback = new CombatPlayback(result.simulation);
    this.cues = buildCombatCues(this.playback);
    audioDirector.startMoment('roundStart');
    this.battleTime = 0;
    this.speed = COMBAT_PLAYBACK.speeds[0];
    this.scene = {
      arena: this.arena,
      combatants: result.simulation.initial.map((unit) => {
        const who = unit.side === 'A' ? fighter : result.opponent.fighter;
        return this.combatant(who, unit.side === 'A' ? this.session.playerTeam : FOREST_TEAM, unit.side === 'A' ? 0 : 1, { x: unit.x, y: unit.y }, unit.fatigue);
      }),
    };
    // La frise et le panneau montrent le combat en cours ; l'état de l'expédition est déjà à jour.
    this.sideEl.replaceChildren(this.renderFightCard({ ...this.runSnapshotForFight(result) }, { watching: true }));
    this.renderControls();
    this.advance(0);
  }

  /** Pendant le rejeu, la carte montre l'adversaire qui vient d'être combattu. */
  runSnapshotForFight(result) {
    const run = this.session.expeditions?.run ?? result.run;
    const stage = result.won ? run.stage - 1 : run.stage;
    return { ...run, stage, opponentHp: result.opponent.hp, phase: 'fight' };
  }

  endPlayback() {
    this.playback = null;
    this.cues = null;
    if (this.renderer) {
      this.renderer.effects = [];
      this.renderer.vfx = [];
      this.renderer.shake = { x: 0, y: 0 };
    }
    if (this.lastFight?.won) haptic('success');
    this.refresh();
  }

  pick(index, targetId = null) {
    const run = this.run;
    const option = run.options[index];
    const targets = optionTargets(this.session, run, option);
    if (targets.length && !targetId) {
      this.pendingOption = index;
      this.refresh();
      return;
    }
    const result = chooseOption(this.session, index, targetId);
    if (!result.ok) {
      showToast(result.reason, 'error');
      return;
    }
    this.pendingOption = null;
    this.lastFight = null;
    this.refresh();
  }

  async abandon() {
    const ok = await confirmModal({
      title: 'Abandonner l’expédition',
      message: 'L’expédition sera perdue, Ferveurs comprises, et sans récompense. Les combattants rentrent avec leur fatigue.',
      confirmLabel: 'Abandonner', danger: true,
    });
    if (!ok) return;
    abandonRun(this.session);
    this.playback = null;
    this.refresh();
  }

  claim() {
    const result = claimSingularVictory(this.session, this.assignments);
    if (!result.ok) {
      showToast(result.reason, 'error');
      return;
    }
    openModal({
      title: '🏆 Retour de l’expédition singulière',
      className: 'sx-summary-modal',
      body: h('ul', { class: 'sx-summary' }, result.summary.map((line) => h('li', {}, describeSummaryLine(this.session, line)))),
      actions: [{ label: 'Rentrer au domaine', variant: 'primary' }],
    });
    this.refresh();
  }
}

/** Une ligne du bilan de victoire. */
export function describeSummaryLine(session, line) {
  const bonus = line.bonus ? ' (Compagnon du Baron)' : '';
  switch (line.type) {
    case 'deniers': return `+${line.amount.toLocaleString('fr-FR')} deniers au Trésor${bonus}.`;
    case 'ferveurs': return `+${line.amount} Ferveur${line.amount > 1 ? 's' : ''} de la Reine.`;
    case 'item': return `+${line.quantity} Hypocras dans Le Coffre.`;
    case 'recruit': return `${line.recruitName} attend à la Taverne (offert)${bonus}.`;
    case 'potential': return `${line.name ?? session.getFighter(line.fighterId)?.name ?? ''} : potentiel ${'🔥'.repeat(line.potential)}${bonus}.`;
    case 'talent': {
      const talent = getTalent(line.talentId);
      const family = (TALENT_RARITIES[talent?.rarity]?.name ?? '').toLowerCase();
      const previous = line.previousId ? `, à la place de ${getTalent(line.previousId)?.name ?? line.previousId}` : '';
      return `${line.name} reçoit le talent ${talent?.name ?? line.talentId} (${family})${previous}.`;
    }
    case 'skills': return `${line.name} : +${Object.values(line.gains).reduce((s, v) => s + v, 0)} points de compétences de combat${line.training ? ' (Voyageur aguerri)' : ''}.`;
    default: return '';
  }
}
