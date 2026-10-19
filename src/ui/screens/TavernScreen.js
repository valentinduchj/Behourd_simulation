import { h } from '../../utils/dom.js';
import { SkillLine } from '../components/PlacementFighterCard.js';
import { checkRecruit, recruit, getRecruitCost } from '../../systems/tavern/TavernService.js';
import { upgradeTavern } from '../../systems/tavern/TavernUpgradeService.js';
import { formatStarRange, formatStarCount, formatPriceTable } from '../../systems/tavern/TavernLevelConfig.js';
import { getDeniers } from '../../systems/economy/wallet.js';
import { getRosterSize, isRosterFull } from '../../systems/roster/RosterService.js';
import { getFighterAge } from '../../systems/fighters/PotentialService.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';
import { TavernScene } from '../../tavern/TavernScene.js';
import { TavernRenderer } from '../../tavern/TavernRenderer.js';
import { TavernInteractionService } from '../../tavern/TavernInteractionService.js';
import { Tavernkeeper } from '../../tavern/Tavernkeeper.js';
import { TAVERN_LAYOUT } from '../../data/tavernLayout.js';
import { spectatorUrl } from '../../render/spectators.js';
import { PotentialFlames, formatAge } from '../components/Potential.js';
import { HubScreen } from './HubScreen.js';
import { getVisibleExits } from '../../systems/navigation/LocationNavigationService.js';
import { FighterSprite } from '../components/FighterSprite.js';
import { SpecialtyBadge, FighterClassTags } from '../components/SpecialtyBadge.js';
import { StatList } from '../components/StatList.js';
import { showToast } from '../components/Toast.js';
import { FighterStars } from '../components/Rating.js';
import { TalentBadges } from '../components/TalentBadge.js';
import { openModal } from '../components/Modal.js';
import { hasUnseenTavernRotation, markTavernRotationSeen } from '../hub/pendingVfx.js';
import { listTrophies } from '../../systems/trophies/TrophyService.js';
import { TROPHY_CABINET } from '../../data/trophies.js';
import { openFighterStatsBoard, openTrophyCabinet } from '../components/TavernBoards.js';
import { currentLocale } from '../../i18n/i18n.js';
import { createFramePacer } from '../../render/framePacing.js';
import { attachMapZoom } from '../mobile/MapZoom.js';
import { isMobileLayout } from '../mobile/mobileLayout.js';

const HINT = 'Survolez un combattant pour voir sa spécialité et ses étoiles ; cliquez pour sa fiche. Le tavernier se tient derrière le comptoir ; la pancarte affiche les classements, l’armoire vos trophées ; la porte ramène au Centre.';
const formatDeniers = (n) => `${n.toLocaleString(currentLocale())} denier${n > 1 ? 's' : ''}`;

/**
 * La Taverne : un lieu à explorer. Les recrues de l'offre en cours flânent dans la salle
 * (survol : spécialité et étoiles ; clic : fiche de recrutement) et le tavernier, derrière le
 * comptoir, parle de la prochaine rotation et de l'amélioration de la Taverne.
 * Toute la logique passe par les services (TavernService, TavernUpgradeService…) ; la scène
 * (tavern/) n'est que de la présentation.
 */
export class TavernScreen extends HubScreen {
  static hubLocationId = 'tavern';
  // Interface mobile : carte en plein écran, le reste de la page dans ce volet.
  static mobileSheet = { label: 'Les recrues' };

  renderContent() {
    this.canvas = h('canvas', { class: 'centre-canvas tavern-canvas', 'aria-label': 'L’intérieur de la Taverne en vue isométrique' });
    this.hint = h('p', { class: 'centre-hint', role: 'status' }, HINT);
    this.statusHost = h('div', { class: 'tavern-status' });
    this.panelsHost = h('div', { class: 'tavern-panels' });
    this.renderPanels();
    return h(
      'div',
      { class: 'hub-page' },
      h('header', { class: 'hub-page-header' },
        h('h1', {}, 'La Taverne'),
        h('p', { class: 'hub-page-subtitle' }, 'Des combattants cherchent une compagnie. Approchez-vous, observez-les, et parlez au tavernier.')),
      this.statusHost,
      h('div', { class: 'centre-stage tavern-stage' }, this.canvas),
      this.hint,
      this.panelsHost,
    );
  }

  mounted() {
    super.mounted();
    // Téléphone (v0.91) : pincer pour zoomer, glisser pour se déplacer sur la carte.
    if (isMobileLayout()) this.mapZoom = attachMapZoom(this.canvas, () => this.renderer);
    const { recruitment } = this.session;
    this.scene = new TavernScene(recruitment.candidates, { seed: `taverne-${recruitment.generatedOnDay}` });
    this.renderer = new TavernRenderer(this.canvas, this.scene);
    this.interaction = new TavernInteractionService(this.scene, this.renderer, this.session);
    this.renderer.labelFor = (target) => this.interaction.labelFor(target);
    // Armoire à trophées : image du palmarès de la compagnie (dans l'ordre des victoires).
    this.renderer.trophies = listTrophies(this.session);
    this.renderer.trophyCapacity = TROPHY_CABINET;
    // Sortie : la porte ramène au Centre (data/locations.js).
    this.renderer.exits = getVisibleExits('TAVERNE');
    this.renderer.resize();
    // Arrivée depuis le Centre : on entre par la porte, qui s'ouvre et luit un instant.
    if (this.params.arrivalExitId) {
      this.renderer.arrival = { exitId: this.params.arrivalExitId, start: null };
      const door = this.renderer.exits.find((exit) => exit.id === this.params.arrivalExitId);
      if (door) this.renderer.effects.add('door', { x: 0.25, y: door.position.y }, { delay: 0.1 });
    }
    this.listen(window, 'resize', () => this.renderer.resize());
    this.listen(this.canvas, 'mousemove', (event) => {
      const target = this.interaction.targetAt(event.clientX, event.clientY);
      this.renderer.hover = target;
      this.canvas.style.cursor = target ? 'pointer' : 'default';
      this.hint.textContent = this.interaction.hintFor(target) ?? HINT;
    });
    this.listen(this.canvas, 'mouseleave', () => { this.renderer.hover = null; this.hint.textContent = HINT; });
    this.listen(this.canvas, 'click', (event) => this.activate(this.interaction.targetAt(event.clientX, event.clientY)));
    let last = performance.now();
    const draw = createFramePacer();
    const frame = (now) => {
      if (draw(now)) {
        this.scene.update((now - last) / 1000);
        last = now;
        this.renderer.render(now / 1000);
      }
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
    // Nouvelle rotation pas encore vue : la porte s'ouvre (après le carnet de bord s'il est ouvert).
    if (!this.params.dayReport) this.playRotation();
  }

  afterLogbook() {
    this.playRotation();
  }

  /** Effets visuels d'une rotation encore jamais montrée : porte qui s'ouvre et fumée qui entre. */
  playRotation() {
    if (!this.renderer || !hasUnseenTavernRotation(this.session)) return;
    markTavernRotationSeen(this.session);
    const door = TAVERN_LAYOUT.walls.left.find((item) => item.type === 'door');
    if (door) this.renderer.effects.add('door', { x: 0.25, y: door.y }, { delay: 0.3 });
  }

  unmount() {
    cancelAnimationFrame(this.frameId);
    super.unmount();
  }

  /** Action d'un clic dans la scène (ou d'un bouton de la liste). */
  activate(target) {
    if (target?.type === 'exit') this.travel(target.exitId);
    else if (target?.type === 'recruit') this.openRecruitSheet(target.candidateId);
    else if (target?.type === 'keeper') this.openKeeper();
    else if (target?.type === 'stats') openFighterStatsBoard(this.session);
    else if (target?.type === 'trophies') openTrophyCabinet(this.session);
  }

  // --- Panneaux sous la scène : état, tavernier, recrues présentes ---

  renderPanels() {
    const size = getRosterSize(this.session);
    // (replaceChildren écrirait « null » : la bannière n'est ajoutée que si l'effectif est complet.)
    this.statusHost.replaceChildren(
      h('p', { class: 'tavern-purse' }, `Vous disposez de ${getDeniers(this.session)} deniers. Effectif : ${size.count} / ${size.max} combattants.`),
      ...(isRosterFull(this.session)
        ? [h('p', { class: 'roster-full-banner', role: 'status' }, `Effectif complet (${size.count} / ${size.max}) : aucun recrutement possible. Congédiez un combattant depuis sa fiche (La Compagnie) pour libérer une place.`)]
        : []),
    );
    const { candidates } = this.session.recruitment;
    const keeper = this.keeperDialogue();
    this.panelsHost.replaceChildren(
      h('article', { class: 'zone-card tavern-keeper-card' },
        h('img', { class: 'artisan-portrait', src: spectatorUrl('artisan_tavernkeeper'), alt: '', width: 48, height: 78 }),
        h('div', {},
          h('h3', { class: 'zone-card-title' }, '🍺 Le tavernier'),
          h('p', { class: 'zone-card-desc' }, `Taverne niveau ${keeper.level} / ${keeper.maxLevel} · prochaines recrues ${formatStarRange(keeper.starRange)}.`),
          h('p', { class: 'muted' }, this.rotationText(keeper.nextRotation)),
          h('button', { type: 'button', class: 'btn btn-sm', onclick: () => this.openKeeper() }, 'Parler au tavernier'))),
      h('section', { class: 'tavern-recruits' },
        h('h2', { class: 'hub-section-title' }, 'Les recrues présentes'),
        candidates.length
          ? h('ul', { class: 'tavern-recruit-list' }, candidates.map((candidate) => h('li', {}, h('button', {
            type: 'button', class: 'tavern-recruit-item', 'data-candidate': candidate.id, onclick: () => this.openRecruitSheet(candidate.id),
          },
          FighterSprite(candidate.fighter, { size: 40 }),
          h('span', { class: 'tavern-recruit-who' }, h('strong', {}, candidate.fighter.name), h('span', { class: 'tavern-recruit-tags' }, ...FighterClassTags(candidate.fighter), ...TalentBadges(candidate.fighter, this.session), FighterStars(calculateFighterLevel(candidate.fighter))),
            // v0.83 : le potentiel de la recrue, visible sans ouvrir sa fiche ; compétences (mobile).
            h('span', { class: 'tavern-recruit-potential' }, h('span', { class: 'tavern-recruit-potential-label' }, 'Potentiel'), PotentialFlames(candidate.fighter)),
            SkillLine(candidate.fighter)),
          candidate.gift
            ? h('span', { class: 'recruit-cost is-gift', title: 'Ramené d’expédition par le Baron : offert' }, '🧭 Offert')
            : h('span', { class: 'recruit-cost' }, formatDeniers(getRecruitCost(this.session, candidate)))))))
          : h('p', { class: 'empty-state hub-card' }, 'Aucun combattant n’est disponible pour le moment. Revenez après la prochaine rotation.')),
    );
  }

  rotationText(next) {
    if (!next) return 'Aucune rotation n’est prévue pour le moment.';
    return `Prochaine rotation : jour ${next.day} (${next.inDays <= 1 ? 'demain' : `dans ${next.inDays} jours`}).`;
  }

  /** Ce que dit le tavernier (niveau, plage, rotation, amélioration), d'après les services. */
  keeperDialogue() {
    this.keeper ??= new Tavernkeeper(TAVERN_LAYOUT.keeper);
    return this.keeper.dialogue(this.session);
  }

  /** Après un recrutement ou une amélioration : panneaux, scène et colonne de droite à jour. */
  refreshTavern() {
    this.renderPanels();
    this.scene?.setCandidates(this.session.recruitment.candidates);
    this.refreshStatus();
  }

  // --- Fiche de recrutement ---

  openRecruitSheet(candidateId) {
    const candidate = this.session.recruitment.getCandidate(candidateId);
    if (!candidate) return;
    const { fighter } = candidate;
    // Prix réellement payé (talent Marchandeur dans la compagnie : réduit).
    const cost = getRecruitCost(this.session, candidate);
    const check = checkRecruit(this.session, candidateId);
    const body = h('div', { class: 'recruit-sheet', style: { '--spec-color': fighter.specialty?.color } },
      h('div', { class: 'fighter-card-head' },
        FighterSprite(fighter, { size: 84 }),
        h('div', { class: 'fighter-card-identity' },
          h('h4', { class: 'fighter-name' }, fighter.name),
          // Rôle, talent éventuel (tiré à l'arrivée de la recrue), puis les étoiles.
          h('div', { class: 'fighter-card-tags' }, ...FighterClassTags(fighter), ...TalentBadges(fighter, this.session), FighterStars(calculateFighterLevel(fighter))),
          h('div', { class: 'fighter-profile' },
            h('span', { class: 'fighter-profile-item fighter-age' }, formatAge(getFighterAge(fighter))),
            PotentialFlames(fighter)))),
      StatList(fighter, { compact: true }),
      h('div', { class: 'recruit-footer' },
        h('span', { class: 'recruit-cost' }, candidate.gift ? '🧭 Offert' : formatDeniers(cost)),
        h('span', { class: 'muted' }, candidate.gift ? 'Ramené d’expédition par le Baron.' : `Trésor : ${formatDeniers(getDeniers(this.session))}`)),
      check.ok ? null : h('p', { class: 'recruit-reason' }, check.reason));
    openModal({
      title: 'Fiche de recrutement',
      body,
      className: 'recruit-sheet-modal',
      actions: [
        { label: 'Fermer', value: null },
        {
          label: candidate.gift ? 'Recruter (offert)' : `Recruter (${formatDeniers(cost)})`, variant: 'primary', disabled: !check.ok, title: check.reason ?? `Engager ${fighter.name}`,
          onClick: (modal) => { modal.close(true); this.recruit(candidateId); },
        },
      ],
    });
  }

  recruit(candidateId) {
    // Position de la recrue dans la salle, avant qu'elle ne la quitte (effets visuels).
    const character = this.scene?.getCharacter(candidateId);
    const spot = character ? { x: character.x, y: character.y } : null;
    const result = recruit(this.session, candidateId);
    if (!result.ok) {
      showToast(result.reason, 'error');
      return;
    }
    // Les chopes trinquent là où se tenait la nouvelle recrue.
    if (spot) this.renderer?.effects.add('cheers', spot);
    showToast(`${result.fighter.name} rejoint ${this.team.name} (−${result.cost} deniers).`, 'success');
    this.refreshTavern();
  }

  // --- Le tavernier ---

  openKeeper() {
    const body = h('div', { class: 'tavern-keeper-panel' });
    const render = () => body.replaceChildren(...this.renderKeeperPanel(render));
    render();
    openModal({ title: 'Le tavernier', body, className: 'modal-wide artisan-modal', actions: [{ label: 'Fermer', variant: 'primary' }] });
  }

  renderKeeperPanel(rerender) {
    const d = this.keeperDialogue();
    const upgrade = d.upgrade;
    return [
      h('header', { class: 'artisan-panel-head' },
        h('img', { class: 'artisan-portrait', src: spectatorUrl('artisan_tavernkeeper'), alt: '', width: 56, height: 90 }),
        h('div', {},
          h('p', { class: 'artisan-panel-desc' }, '« Des gaillards passent chaque semaine. Plus ma taverne a bonne réputation, plus les combattants qui s’y arrêtent sont aguerris. »'),
          h('p', { class: 'artisan-panel-purse' }, `Trésor : ${formatDeniers(getDeniers(this.session))}`))),
      h('section', { class: 'upgrade-group' },
        h('h3', { class: 'sheet-section-title' }, `Taverne — niveau ${d.level} / ${d.maxLevel}`),
        h('p', { class: 'tavern-range' }, `Les prochaines recrues seront comprises ${formatStarRange(d.starRange)}.`),
        h('p', { class: 'tavern-price' }, `Prix d’une recrue, selon ses étoiles : ${formatPriceTable(d.priceTable, formatDeniers)}.`),
        h('p', { class: 'muted' }, `${this.rotationText(d.nextRotation)} Les combattants présents restent jusque-là.`)),
      h('section', { class: 'upgrade-group' },
        h('h3', { class: 'sheet-section-title' }, 'Améliorer la Taverne'),
        upgrade
          ? h('div', { class: 'upgrade-row tavern-upgrade-row' + (d.canUpgrade.ok ? '' : ' is-locked'), 'data-level': upgrade.level },
            h('div', { class: 'upgrade-info' },
              h('p', { class: 'upgrade-name' }, `Niveau ${upgrade.level}`, h('span', { class: 'upgrade-level' }, `Actuellement : niveau ${d.level}`)),
              h('p', { class: 'upgrade-desc' }, `Les recrues des rotations suivantes seront comprises ${formatStarRange(upgrade)}${d.upgradeTopPrice === null ? '' : ` ; une recrue à ${formatStarCount(upgrade.maxStars)} coûtera ${formatDeniers(d.upgradeTopPrice)}`}.`),
              h('p', { class: 'upgrade-current muted' }, 'Les combattants présents ne changent pas : la nouvelle plage vaut à partir de la prochaine rotation.')),
            h('div', { class: 'upgrade-buy' },
              h('span', { class: 'upgrade-cost' }, formatDeniers(upgrade.cost)),
              h('button', {
                type: 'button', class: 'btn btn-primary btn-sm', disabled: !d.canUpgrade.ok, title: d.canUpgrade.reason ?? `Améliorer pour ${formatDeniers(upgrade.cost)}`,
                onclick: () => this.upgrade(rerender),
              }, 'Améliorer'),
              d.canUpgrade.ok ? null : h('span', { class: 'upgrade-reason' }, d.canUpgrade.reason)))
          : h('p', { class: 'tavern-max' }, 'La Taverne est au niveau maximal : sa réputation attire les meilleurs combattants qui cherchent une compagnie.')),
    ];
  }

  upgrade(rerender) {
    const result = upgradeTavern(this.session);
    if (!result.ok) {
      showToast(result.reason, 'error');
      return;
    }
    // Progression enregistrée aussitôt (si la sauvegarde automatique est active).
    if (this.services.settings.get('gameplay.autosave')) {
      try { this.services.saves.save(this.session); } catch { /* sauvegarde manuelle toujours possible */ }
    }
    showToast(`La Taverne passe au niveau ${result.level} (−${formatDeniers(result.cost)}). Les prochaines recrues en profiteront.`, 'success');
    rerender();
    this.refreshTavern();
  }
}
