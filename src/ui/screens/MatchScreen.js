import { h } from '../../utils/dom.js';
import { SCREENS } from '../../core/screenIds.js';
import { ofClub, clubVerb, crowdLabel, ordinal } from '../../utils/format.js';
import { DEFAULT_FIGHTER_FILTER, organizeFighters } from '../../systems/fighters/FighterListFilter.js';
import { FighterFilterBar, markOutsideFilter } from '../components/FighterFilterBar.js';
import { MATCH_RULES } from '../../data/matchRules.js';
import { createArena } from '../../combat/Arena.js';
import { Combatant } from '../../combat/Combatant.js';
import { IsoRenderer } from '../../combat/render/IsoRenderer.js';
import { buildLicePresentation } from '../../combat/presentation/LicePresentation.js';
import {
  resolvePlayerRound, autoSelectSquad, autoSelectLineup, getAvailableFighters, getFirstPlacingSide, canSelectForMatch,
} from '../../systems/match/MatchService.js';
import { PlacementManager } from '../../combat/engine/PlacementManager.js';
import { assignMatchAIProfile, describeBehavior, getOpponentPlacementOptions, selectOpponentLineup } from '../../systems/ai/OpponentAIService.js';
import { ensureAIStartingFatigue } from '../../systems/match/RoundService.js';
import { placeAutomatically } from '../../combat/engine/AIPlacementStrategy.js';
import { CombatPlayback } from '../../combat/presentation/CombatPlayback.js';
import { collectVfx, resolveVfxLevel, shakeAt } from '../../combat/presentation/vfx.js';
import { VictoryCelebration } from '../components/VictoryCelebration.js';
import { getMatchVenue } from '../../systems/league/VenueService.js';
import { getBonusLabels } from '../../combat/presentation/bonusLabels.js';
import { COMBAT_PLAYBACK, COMBAT_RULES } from '../../data/combatRules.js';
import { calculateFighterLevel } from '../../systems/fighters/ratings.js';
import { SpecialtyBadge, FighterClassTags } from '../components/SpecialtyBadge.js';
import { ClassRoles, ClassRolesInline } from '../components/ClassRoles.js';
import { PlacementFighterCard } from '../components/PlacementFighterCard.js';
import { getColorIntensity, getMatchFatigue, getFatigueState, fatigueLevelClass } from '../../systems/fighters/FatigueService.js';
import { FATIGUE_RULES } from '../../data/fatigue.js';
import { getActivity } from '../../systems/activities/ActivityService.js';
import {
  getPendingMatchdayEvent, createPlayerMatch, buildPlayerResultEvent,
} from '../../systems/match/MatchdayService.js';
import { completeMatchdayAndCheckSeason } from '../../systems/league/SeasonService.js';
import {
  getPendingQueenCombat, generateQueenCombat, selectOpponent, createQueenMatch, resolveQueenCombat,
  getSelectedOption, getPoolName, sortOptionsByStars, getClubStars,
} from '../../systems/queen/QueenCombatService.js';
import { getStandings, getTeamPosition } from '../../systems/league/StandingsService.js';
import { getClubLevel, getLeagueName } from '../../systems/league/LeagueService.js';
import { autosaveDay } from '../hub/endOfDay.js';
import { audioDirector, buildCombatCues, playCombatCues } from '../../audio/AudioDirector.js';
import { holdAchievementAnnouncements, releaseAchievementAnnouncements } from '../hub/achievementNotifier.js';
import { advanceDay } from '../../systems/time/TimeSystem.js';
import { BaseScreen } from './BaseScreen.js';
import { EmblemView } from '../components/EmblemView.js';
import { FighterSprite } from '../components/FighterSprite.js';
import { ClubStars, FighterStars } from '../components/Rating.js';
import { PickCard } from '../components/PickCard.js';
import { LeagueMiniTable } from '../components/LeagueTable.js';
import { showToast } from '../components/Toast.js';
import { confirmModal, openModal } from '../components/Modal.js';
import { SAVED_TEAM_RULES } from '../../data/savedTeams.js';
import {
  listSavedTeams, canCreateSavedTeam, createSavedTeam, updateSavedTeam, deleteSavedTeam, loadSavedTeam,
  describeIncompleteTeam, selectTypeTeam, isSameSelection,
} from '../../systems/match/SavedTeamService.js';
import { FighterName } from '../components/CaptainCrown.js';
import { RESERVE_POOL } from '../../data/leagues.js';
import { ITEM_USE_CONTEXTS } from '../../data/items.js';
import { clearStaleEffects, getRoundEffects } from '../../systems/items/CombatEffectService.js';
import { listInventory } from '../../systems/inventory/InventoryService.js';
import { effectBonusIds } from '../../combat/engine/CombatSituation.js';
import { openChest, isChestLocked } from '../components/ChestModal.js';
import { FRENCH_CUP_RULES } from '../../data/frenchCup.js';
import {
  getCup, findMatch, createCupPlayerMatch, recordPlayerMatch, describeMatch, getCupCrowdSize,
} from '../../systems/frenchCup/FrenchCupManager.js';
import { pointsFor } from '../../systems/frenchCup/CupGroups.js';

/** « 1 de vos combattants a été mis KO : rétabli pour la manche suivante. » (accordé au nombre). */
export function koSummary(count, lastsWholeMatch) {
  const many = count > 1;
  const after = lastsWholeMatch
    ? `indisponible${many ? 's' : ''} jusqu’à la fin du combat`
    : `rétabli${many ? 's' : ''} pour la manche suivante`;
  return `${count} de vos combattants ${many ? 'ont été mis' : 'a été mis'} KO : ${after}.`;
}

const STEP_LABELS = [
  ['choice', 'Adversaire'],
  ['squad', 'Effectif'],
  ['lineup', 'Manche'],
  ['placement', 'Placement'],
  ['battle', 'Combat'],
  ['result', 'Résultat'],
];

/**
 * La Lice — combat du jour :
 *   journée de championnat : effectif (8 max) → pour chaque manche : 5 combattants (hors KO
 *     des manches précédentes) → placement alterné avec l'IA → combat simulé et rejoué
 *     (src/combat/engine/) → résultat et fatigue → … → résultat final, autres combats, classement ;
 *   Combat de la Reine : choix définitif d'un adversaire parmi 5 (les 4 autres combats du
 *     jour sont affichés dessous) → même déroulement → récompense en cas de victoire et
 *     résultats des autres combats (le championnat n'est pas modifié).
 *
 * La résolution est entièrement faite par les services (MatchService, MatchdayService,
 * QueenCombatService) ; cet écran ne fait que recueillir les choix du joueur et afficher
 * les résultats. Les informations détaillées de l'adversaire ne sont jamais affichées.
 */
export class MatchScreen extends BaseScreen {
  static theme = 'hub';

  constructor(context) {
    super(context);
    this.session = this.services.gameState.session;
    this.arena = createArena();
    this.squad = [];
    this.lineup = [];
    this.placements = new Map();
    this.placingId = null;
    this.lastRound = null;
    this.results = null;
    this.liceCleanups = [];

    const queenEvent = this.params.cupMatchId ? null : getPendingQueenCombat(this.session);
    this.kind = this.params.cupMatchId ? 'cup' : queenEvent ? 'queen' : 'championship';
    if (this.isCup) {
      // Coupe de France : combat isolé (ni palmarès, ni championnat), hors calendrier ; la fatigue de
      // vos combattants, remise à 0 à l'entrée dans la Coupe, évolue normalement d'un combat à l'autre.
      const cup = getCup(this.session);
      this.cupMatch = cup ? findMatch(cup, this.params.cupMatchId) : null;
      this.match = createCupPlayerMatch(this.session, this.params.cupMatchId);
      this.event = this.match ? { day: null, data: {} } : null;
      this.step = 'squad';
    } else if (queenEvent) {
      this.event = queenEvent;
      // Idempotent : ne tire que ce qui manque (propositions, combats secondaires d'une ancienne sauvegarde).
      generateQueenCombat(this.session, queenEvent);
      this.match = queenEvent.data.selectedTeamId ? createQueenMatch(this.session, queenEvent) : null;
      this.step = this.match ? 'squad' : 'choice';
    } else {
      this.event = getPendingMatchdayEvent(this.session);
      this.match = this.event ? createPlayerMatch(this.session, this.event) : null;
      this.step = this.event && !this.match ? 'final' : 'squad';
    }
    if (this.match) this.prepareOpponent();
    // Effets temporaires d'un combat quitté avant la fin (ex. Hypocras jamais joué) : retirés.
    clearStaleEffects(this.session, this.match?.id ?? null);
  }

  get isQueen() {
    return this.kind === 'queen';
  }

  get isCup() {
    return this.kind === 'cup';
  }

  /** Écran de départ (boutons « Retour ») : le Château de Gabarnac pour la Coupe, la Compagnie sinon. */
  get backScreen() {
    return this.isCup ? SCREENS.FRENCH_CUP : SCREENS.TEAM;
  }

  /** Adversaire connu : sa sélection automatique, le décor et la foule (présentation). */
  prepareOpponent() {
    // Comportement de l'équipe adverse pour ce combat (selon ses étoiles), tiré une fois par combat.
    const seed = this.isCup
      ? `coupe:${getCup(this.session).editionId}:${this.cupMatch.id}`
      : `${this.isQueen ? 'reine' : this.session.season?.number ?? 0}:${this.event.day}:${this.match.teamBId}`;
    this.aiProfile = assignMatchAIProfile(this.session, this.match, { seed });
    this.opponentSquad = autoSelectSquad(this.session, this.match.teamBId);
    // Fatigue fictive de départ des adversaires (0 à 15), visible dès le placement (sauf Coupe :
    // les deux compagnies partent reposées).
    ensureAIStartingFatigue(this.match, this.opponentSquad);
    if (this.isCup) {
      // Coupe de France : Lice du Château de Gabarnac, foule selon le tour.
      this.venue = null;
      this.presentation = buildLicePresentation(this.session, {
        arena: this.arena, teamAId: this.match.teamAId, teamBId: this.match.teamBId, matchday: `coupe-${this.cupMatch.id}`,
        kind: 'cup', decorationId: FRENCH_CUP_RULES.decorationId, crowdSize: getCupCrowdSize(this.cupMatch),
      });
      return;
    }
    // Décor et foule d'après le classement avant le combat.
    // Match de Ligue : domicile (lice du joueur) ou extérieur (décor ordinaire), lieu enregistré du match.
    this.venue = this.isQueen ? null : getMatchVenue(this.session, this.event);
    // Lieu du match (talents Enfant du pays, Voyageur) : enregistré sur le combat.
    if (this.match) this.match.location = this.venue?.location ?? null;
    this.presentation = buildLicePresentation(this.session, {
      arena: this.arena, teamAId: this.match.teamAId, teamBId: this.match.teamBId,
      matchday: this.isQueen ? `reine-${this.event.day}` : this.event.data.matchday,
      kind: this.match.kind,
      location: this.venue?.location ?? null,
    });
  }

  get playerTeam() {
    return this.session.playerTeam;
  }

  get opponentTeam() {
    return this.match ? this.session.getTeam(this.match.teamBId) : null;
  }

  render() {
    // Succès obtenus pendant le combat : dévoilés à sa fin seulement (écran de résultat final).
    if (!this.achievementsHeld) {
      holdAchievementAnnouncements();
      this.achievementsHeld = true;
    }
    this.el = h('section', { class: 'screen screen-match' });
    this.update();
    return this.el;
  }

  get usesLice() {
    return this.step === 'placement' || this.step === 'battle';
  }

  mounted() {
    if (this.usesLice) this.startLice();
  }

  unmount() {
    this.stopLice();
    this.releaseAchievements();
    super.unmount();
  }

  /** Fin du combat (ou écran quitté) : les succès retenus s'annoncent. */
  releaseAchievements() {
    if (!this.achievementsHeld) return;
    this.achievementsHeld = false;
    releaseAchievementAnnouncements(this.session);
  }

  goTo(step) {
    this.step = step;
    this.update();
  }

  update() {
    this.stopLice();
    if (!this.event) {
      this.el.replaceChildren(
        h('header', { class: 'screen-header' }, h('h1', {}, 'La Lice')),
        h('div', { class: 'panel' }, h('p', {}, this.isCup ? 'Aucun combat de Coupe ne vous attend.' : 'Aucun combat n’est prévu aujourd’hui.'),
          h('button', { type: 'button', class: 'btn', onclick: () => this.navigate(this.backScreen) }, 'Retour')),
      );
      return;
    }
    const renderers = {
      choice: () => this.renderChoiceStep(),
      squad: () => this.renderSquadStep(),
      lineup: () => this.renderLineupStep(),
      placement: () => this.renderPlacementStep(),
      battle: () => this.renderBattleStep(),
      result: () => this.renderResultStep(),
      final: () => this.renderFinalStep(),
    };
    // Le corps d'abord : l'étape finale enregistre la journée, et l'en-tête doit afficher le
    // classement qui en résulte.
    const body = renderers[this.step]();
    this.el.replaceChildren(this.renderHeader(), body);
    if (this.usesLice && this.el.isConnected) this.startLice();
    // Nouvelle étape : haut de page (la manche : la lice). Même étape redessinée (« Les moins
    // fatigués », une case cochée…) : la page reste où elle était.
    const stepChanged = this.renderedStep !== this.step;
    this.renderedStep = this.step;
    if (!stepChanged) return;
    if (this.step === 'battle') this.scrollToBattle();
    else window.scrollTo(0, 0);
  }

  /** Manche lancée : la lice à l'écran, juste sous le rappel de la formation (collant). */
  scrollToBattle() {
    const sticky = this.el.querySelector('.class-roles-sticky');
    const margin = (sticky?.offsetHeight ?? 0) + 16;
    window.scrollTo(0, Math.max(0, this.battleStatus.getBoundingClientRect().top + window.scrollY - margin));
  }

  // --- En-tête ---

  /** Classement ACTUEL d'un club (recalculé à chaque affichage) : « 12e de Ligue 3 ». */
  rankLabel(teamId) {
    const standing = getTeamPosition(this.session, teamId);
    return standing ? `${ordinal(standing.position)} de ${getLeagueName(standing.leagueId)}` : 'Hors championnat';
  }

  renderHeader() {
    const day = `Jour ${this.session.calendar.currentDay}`;
    const eyebrow = this.isCup
      ? `${FRENCH_CUP_RULES.name} · ${describeMatch(getCup(this.session), this.cupMatch)}`
      : this.isQueen ? `Combat de la Reine · ${day}` : `Journée de championnat ${this.event.data.matchday} · ${day}`;
    const steps = STEP_LABELS.filter(([id]) => this.isQueen || id !== 'choice');
    const stepIndex = steps.findIndex(([id]) => id === this.step);
    const stepList = this.step === 'final' ? null : h(
      'ol',
      { class: 'match-steps' },
      steps.map(([id, label], i) => h('li', { class: i === stepIndex ? 'is-current' : i < stepIndex ? 'is-done' : '' }, label)),
    );
    // Placement : en-tête resserré sur une ligne (l'écran doit tenir sans défilement).
    const compact = this.step === 'placement';
    const headerClass = `match-header panel ${this.isQueen ? 'is-queen' : ''} ${this.isCup ? 'is-cup' : ''} ${compact ? 'is-compact' : ''}`.replace(/\s+/g, ' ').trim();
    if (!this.match) {
      return h('header', { class: headerClass }, h('p', { class: 'eyebrow' }, eyebrow),
        h('h1', {}, this.isQueen ? '♛ Combat de la Reine' : 'La Lice'), this.isQueen ? stepList : null);
    }
    const team = (club) => h(
      'div',
      { class: 'match-team' },
      EmblemView(club.emblem, { size: compact ? 34 : 56, title: club.name }),
      h('strong', {}, club.name),
      h('span', { class: 'match-team-rank' }, this.rankLabel(club.id)),
      ClubStars(getClubLevel(this.session, club.id)),
      // Équipe de l'IA : son comportement pour ce combat (« Comportement défensif »…), et en
      // infobulle le nom de sa manière (« Le Mur ») et sa description.
      club.id === this.match.teamBId && this.aiProfile
        ? h('span', { class: 'match-behavior', title: `${this.aiProfile.name} — ${this.aiProfile.flavor ?? this.aiProfile.summary}` }, describeBehavior(this.aiProfile))
        : null,
    );
    return h(
      'header',
      { class: headerClass },
      h('p', { class: 'eyebrow' }, `${eyebrow} · La Lice`),
      h(
        'div',
        { class: 'match-teams' },
        team(this.playerTeam),
        h(
          'div',
          { class: 'match-score' },
          // Lieu du match de Ligue : domicile → nom du lieu du joueur ; extérieur → Terre adverse.
          this.venue ? h('span', {
            class: `match-venue ${this.venue.isHome ? 'is-home' : 'is-away'}`, style: { '--land-color': this.venue.color },
            title: this.venue.isHome ? `À domicile — ${this.venue.label} (${this.venue.landName})` : `À l’extérieur — ${this.venue.landName}`,
          }, this.venue.label) : null,
          // Pendant le rejeu, le score d'avant la manche (le résultat n'est pas dévoilé).
          h('span', { class: 'match-score-value' }, this.step === 'battle' && this.scoreBeforeRound
            ? `${this.scoreBeforeRound.a} – ${this.scoreBeforeRound.b}`
            : `${this.match.scoreA} – ${this.match.scoreB}`),
          h('span', { class: 'match-score-label' }, this.step === 'battle'
            ? `Manche ${this.lastRound.number} en cours · 2 manches gagnantes`
            : this.match.isFinished ? 'Combat terminé' : `Manche ${this.match.currentRound} · 2 manches gagnantes`),
        ),
        team(this.opponentTeam),
      ),
      stepList,
    );
  }

  // --- Combat de la Reine : choix de l'adversaire ---

  renderChoiceStep() {
    // Du moins étoilé au plus étoilé, de gauche à droite — d'après les étoiles ACTUELLES (celles
    // affichées) : les clubs ont pu progresser depuis le tirage des propositions.
    const options = sortOptionsByStars((this.event.data.options ?? []).map((option) => ({ ...option, stars: getClubStars(this.session, option.teamId) })));
    return h(
      'div',
      { class: 'match-body panel' },
      h('h2', { class: 'section-title' }, 'Choisissez votre adversaire'),
      h('p', {}, `${options.length} compagnies acceptent de vous affronter, de la moins à la plus redoutable. Choisissez-en une seule : ce choix est définitif. La récompense n’est versée qu’en cas de victoire ; ce combat ne compte pas pour le championnat.`),
      options.length
        ? h('div', { class: 'queen-options' }, options.map((option) => this.renderQueenOption(option)))
        : h('p', { class: 'empty-state' }, 'Aucun adversaire disponible.'),
      this.renderSecondaryMatches({ withResults: false }),
      h('div', { class: 'match-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => this.navigate(SCREENS.TEAM) }, 'Retour')),
    );
  }

  /** Origine courte d'un club : « Ligue 2 » ou « Hors championnat ». */
  originLabel(teamId) {
    const standing = getTeamPosition(this.session, teamId);
    return standing ? getLeagueName(standing.leagueId) : getPoolName(RESERVE_POOL.id);
  }

  /**
   * Autres Combats de la Reine du jour (IA contre IA) : affiches seules avant le combat,
   * scores enregistrés après (jamais recalculés ici).
   */
  renderSecondaryMatches({ withResults }) {
    const matches = this.event.data.secondaryMatches ?? [];
    if (!matches.length) return null;
    const side = (match, teamId) => {
      const club = this.session.getTeam(teamId);
      const winner = withResults && match.result?.winnerId === teamId;
      return h(
        'span',
        { class: `queen-duel-team ${winner ? 'is-winner' : ''}`.trim() },
        EmblemView(club.emblem, { size: 28, title: club.name }),
        h('span', { class: 'queen-duel-name' }, club.name, h('small', {}, this.originLabel(teamId))),
      );
    };
    return h(
      'section',
      { class: 'queen-duels' },
      h('h3', { class: 'sheet-section-title' }, 'Autres Combats de la Reine'),
      h('ul', { class: 'queen-duel-list' }, matches.map((match) => h(
        'li',
        { class: 'queen-duel' },
        side(match, match.teamAId),
        h('span', { class: 'queen-duel-score' }, withResults && match.result ? `${match.result.scoreA} – ${match.result.scoreB}` : 'VS'),
        side(match, match.teamBId),
      ))),
    );
  }

  renderQueenOption(option) {
    const club = this.session.getTeam(option.teamId);
    return h(
      'article',
      { class: 'queen-option', 'data-team-id': option.teamId },
      EmblemView(club.emblem, { size: 64, title: club.name }),
      h('h3', { class: 'queen-option-name' }, club.name),
      ClubStars(getClubLevel(this.session, club.id)),
      h('p', { class: 'queen-option-pool' }, getPoolName(option.pool)),
      h('div', { class: 'queen-option-reward' }, h('span', {}, 'Récompense'), h('strong', {}, `${option.reward} deniers`)),
      h('button', { type: 'button', class: 'btn btn-queen', onclick: () => this.chooseOpponent(option) }, 'Affronter'),
    );
  }

  async chooseOpponent(option) {
    const club = this.session.getTeam(option.teamId);
    const ok = await confirmModal({
      title: 'Combat de la Reine',
      message: `Affronter ${club.name} ? Ce choix est définitif : les autres compagnies ne seront plus proposées.`,
      confirmLabel: 'Affronter',
    });
    if (!ok || this.match) return;
    try {
      selectOpponent(this.session, this.event, option.teamId);
    } catch (error) {
      showToast(error.message, 'error');
      return;
    }
    // Le choix est enregistré aussitôt (sauvegarde automatique) pour ne pas pouvoir être changé.
    if (this.services.settings.get('gameplay.autosave')) {
      try { this.services.saves.save(this.session); } catch { /* sauvegarde manuelle toujours possible */ }
    }
    this.match = createQueenMatch(this.session, this.event);
    this.prepareOpponent();
    this.goTo('squad');
  }

  // --- Étape 1 : effectif ---

  renderSquadStep() {
    const max = MATCH_RULES.maxSquadSize;
    const full = this.squad.length >= max;
    // Filtres d'affichage (classe, tri) : la sélection n'est jamais modifiée par eux.
    this.squadFilter ??= { ...DEFAULT_FIGHTER_FILTER };
    const listed = organizeFighters(this.session.playerFighters, this.squadFilter, { selectedIds: this.squad });
    const toggle = (fighter) => {
      if (this.squad.includes(fighter.id)) this.squad = this.squad.filter((id) => id !== fighter.id);
      // Règle de jeu (et pas seulement l'affichage grisé) : un combattant en étude ne combat pas.
      else if (!full && canSelectForMatch(this.session, fighter).ok) this.squad.push(fighter.id);
      this.update();
    };
    return h(
      'div',
      { class: 'match-body panel' },
      h('h2', { class: 'section-title' }, 'Effectif engagé'),
      h('p', {}, `Sélectionnez jusqu’à ${max} combattants pour ce combat. À chaque manche, ${MATCH_RULES.fightersPerRound} d’entre eux entreront dans La Lice.`),
      this.renderSavedTeams(),
      h('h3', { class: 'sheet-section-title squad-fighters-title' }, 'Combattants'),
      FighterFilterBar(this.squadFilter, (filter) => { this.squadFilter = filter; this.update(); }, { shown: listed.matching, total: listed.total }),
      h('div', { class: 'pick-grid' }, [...listed.shown, ...listed.outside].map((fighter) => {
        const check = canSelectForMatch(this.session, fighter);
        const card = PickCard(fighter, this.playerTeam, { selected: this.squad.includes(fighter.id), disabled: full, onToggle: toggle, unavailable: check.ok ? null : check.reason });
        return listed.outside.includes(fighter) ? markOutsideFilter(card) : card;
      })),
      h(
        'div',
        { class: 'match-actions' },
        h('span', { class: 'pick-count' }, `${this.squad.length} / ${max} sélectionné${this.squad.length > 1 ? 's' : ''}`),
        h('button', { type: 'button', class: 'btn', onclick: () => this.navigate(this.backScreen) }, 'Retour'),
        h('button', {
          type: 'button', class: 'btn', title: `Les ${max} combattants au plus haut niveau, quelle que soit leur classe`,
          onclick: () => this.selectTypeTeam(),
        }, 'Sélection de l’équipe Type'),
        h('button', {
          type: 'button', class: 'btn btn-primary', disabled: this.squad.length === 0,
          // Effectif engagé enregistré sur le combat (talent Légende vivante).
          onclick: () => { this.lineup = []; this.match.squadIds = [...this.squad]; this.goTo('lineup'); },
        }, 'Valider l’effectif ▸'),
      ),
    );
  }

  // --- Équipes enregistrées (raccourcis de l'effectif engagé) ---

  /** Équipe Type : les 8 meilleurs niveaux actuels, sans tenir compte de la classe. */
  selectTypeTeam() {
    this.squad = selectTypeTeam(this.session);
    this.teamNotice = null;
    this.update();
  }

  /** Rappel d'une équipe enregistrée : la sélection actuelle est remplacée par ses combattants. */
  selectSavedTeam(teamId) {
    const status = loadSavedTeam(this.session, teamId);
    if (!status) return;
    this.squad = [...status.fighterIds];
    this.teamNotice = describeIncompleteTeam(status, this.session);
    this.update();
  }

  /** Zone « Équipes », au-dessus des combattants : Type, équipes enregistrées, [+]. */
  renderSavedTeams() {
    const teams = listSavedTeams(this.session);
    const typeActive = this.squad.length > 0 && isSameSelection(this.squad, selectTypeTeam(this.session));
    const teamButton = (team) => {
      const status = loadSavedTeam(this.session, team.id);
      const active = this.squad.length > 0 && isSameSelection(this.squad, status.fighterIds);
      return h(
        'div',
        { class: `saved-team ${active ? 'is-active' : ''} ${status.complete ? '' : 'is-incomplete'}`.trim(), 'data-team-id': team.id },
        h('button', {
          type: 'button', class: 'saved-team-select', 'aria-pressed': String(active),
          title: status.complete ? `Sélectionner ${team.name}` : describeIncompleteTeam(status, this.session),
          onclick: () => this.selectSavedTeam(team.id),
        }, team.name, status.complete ? null : h('span', { class: 'saved-team-missing' }, `${status.available}/${status.total}`)),
        h('button', { type: 'button', class: 'saved-team-action', title: `Modifier ${team.name}`, 'aria-label': `Modifier ${team.name}`, onclick: () => this.openTeamEditor(team) }, '✎'),
        h('button', { type: 'button', class: 'saved-team-action is-danger', title: `Supprimer ${team.name}`, 'aria-label': `Supprimer ${team.name}`, onclick: () => this.confirmDeleteTeam(team) }, '✕'),
      );
    };
    const canCreate = canCreateSavedTeam(this.session);
    return h(
      'section',
      { class: 'saved-teams', 'aria-label': 'Équipes' },
      h('h3', { class: 'sheet-section-title' }, 'Équipes'),
      h(
        'div',
        { class: 'saved-team-row' },
        h('div', { class: `saved-team is-type ${typeActive ? 'is-active' : ''}`.trim() }, h('button', {
          type: 'button', class: 'saved-team-select', 'aria-pressed': String(typeActive),
          title: `Les ${SAVED_TEAM_RULES.size} combattants au plus haut niveau, quelle que soit leur classe`,
          onclick: () => this.selectTypeTeam(),
        }, 'Équipe Type')),
        teams.map(teamButton),
        canCreate
          ? h('button', {
            type: 'button', class: `btn btn-sm saved-team-add ${teams.length ? 'is-plus' : ''}`.trim(),
            title: 'Créer une équipe enregistrée', 'aria-label': 'Créer son équipe', onclick: () => this.openTeamEditor(null),
          }, teams.length ? '+' : 'Créer son équipe')
          : null,
      ),
      this.teamNotice ? h('p', { class: 'saved-team-notice', role: 'status' }, this.teamNotice) : null,
    );
  }

  /**
   * Création (team = null) ou modification d'une équipe : nom, puis exactement 8 combattants
   * (mêmes cartes que l'effectif). La sélection en cours de l'effectif n'est pas touchée.
   */
  openTeamEditor(team) {
    const size = SAVED_TEAM_RULES.size;
    // Départ : les combattants encore présents de l'équipe ; à la création, la sélection actuelle.
    let picked = team ? [...loadSavedTeam(this.session, team.id).fighterIds] : this.squad.slice(0, size);
    const input = h('input', {
      class: 'input saved-team-name', type: 'text', maxlength: SAVED_TEAM_RULES.maxNameLength, autocomplete: 'off', spellcheck: 'false',
      value: team?.name ?? '', placeholder: `Ex. Équipe Reine (${SAVED_TEAM_RULES.maxNameLength} caractères au plus)`, 'aria-label': 'Nom de l’équipe',
    });
    const error = h('p', { class: 'form-error', role: 'alert' });
    const count = h('span', { class: 'pick-count' });
    const grid = h('div', { class: 'pick-grid saved-team-grid' });
    const filterHost = h('div', { class: 'saved-team-filters' });
    // Mêmes filtres que l'effectif (sans la fatigue, état du moment : l'équipe sert plus tard).
    let filter = { ...(this.squadFilter ?? DEFAULT_FIGHTER_FILTER) };
    if (filter.sortId?.startsWith('fatigue')) filter.sortId = DEFAULT_FIGHTER_FILTER.sortId;
    let handle;
    const renderGrid = () => {
      const full = picked.length >= size;
      const listed = organizeFighters(this.session.playerFighters, filter, { selectedIds: picked });
      filterHost.replaceChildren(FighterFilterBar(filter, (next) => { filter = next; renderGrid(); }, { fatigue: false, shown: listed.matching, total: listed.total }));
      grid.replaceChildren(...[...listed.shown, ...listed.outside].map((fighter) => {
        const card = PickCard(fighter, this.playerTeam, {
          selected: picked.includes(fighter.id), disabled: full, unavailable: canSelectForMatch(this.session, fighter).reason,
          onToggle: (f) => {
            picked = picked.includes(f.id) ? picked.filter((id) => id !== f.id) : picked.length < size ? [...picked, f.id] : picked;
            error.textContent = '';
            renderGrid();
          },
        });
        return listed.outside.includes(fighter) ? markOutsideFilter(card) : card;
      }));
      count.textContent = `${picked.length} / ${size} sélectionné${picked.length > 1 ? 's' : ''}`;
      const save = handle?.element.querySelector('.modal-actions .btn-primary');
      if (save) save.disabled = picked.length !== size;
    };
    input.addEventListener('input', () => { error.textContent = ''; });
    const missing = team ? describeIncompleteTeam(loadSavedTeam(this.session, team.id), this.session) : null;
    const body = h(
      'div',
      { class: 'saved-team-editor' },
      h('label', { class: 'saved-team-field' }, h('span', {}, 'Nom'), input),
      missing ? h('p', { class: 'saved-team-notice' }, `${missing} Choisissez des remplaçants.`) : null,
      h('p', { class: 'muted' }, `Choisissez exactement ${size} combattants.`),
      filterHost,
      grid,
      count,
      error,
    );
    const submit = (modal) => {
      const result = team
        ? updateSavedTeam(this.session, team.id, input.value, picked)
        : createSavedTeam(this.session, input.value, picked);
      if (!result.ok) {
        error.textContent = result.reason;
        return;
      }
      modal.close(true);
      showToast(team ? `Équipe « ${result.team.name} » enregistrée.` : `Équipe « ${result.team.name} » créée.`, 'success');
      this.teamNotice = null;
      this.update();
    };
    handle = openModal({
      title: team ? `Modifier ${team.name}` : 'Créer son équipe',
      className: 'modal-wide saved-team-modal',
      body,
      actions: [
        { label: 'Annuler', value: false },
        { label: team ? 'Enregistrer' : 'Valider', variant: 'primary', onClick: submit, disabled: picked.length !== size },
      ],
    });
    renderGrid();
    input.focus();
  }

  async confirmDeleteTeam(team) {
    const ok = await confirmModal({
      title: 'Supprimer l’équipe',
      message: `Supprimer l’équipe « ${team.name} » ? Seule la composition enregistrée disparaît : les combattants restent dans la compagnie.`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    deleteSavedTeam(this.session, team.id);
    this.teamNotice = null;
    this.update();
  }

  // --- Étape 2 : composition de la manche ---

  /** Combattants de l'effectif encore disponibles (les KO du combat ne reviennent pas). */
  get availableSquad() {
    return getAvailableFighters(this.match, this.squad.map((id) => this.session.getFighter(id)).filter(Boolean), this.session);
  }

  get lineupSize() {
    return Math.min(MATCH_RULES.fightersPerRound, this.availableSquad.length);
  }

  renderLineupStep() {
    const need = this.lineupSize;
    const full = this.lineup.length >= need;
    const squadFighters = this.squad.map((id) => this.session.getFighter(id));
    const available = this.availableSquad;
    const toggle = (fighter) => {
      if (this.match.isKnockedOut(fighter.id)) return;
      if (this.lineup.includes(fighter.id)) this.lineup = this.lineup.filter((id) => id !== fighter.id);
      else if (!full) this.lineup.push(fighter.id);
      this.update();
    };
    const tie = this.match.scoreA === 1 && this.match.scoreB === 1;
    const koCount = squadFighters.length - available.length;
    return h(
      'div',
      { class: 'match-body panel' },
      h('h2', { class: 'section-title' }, `Manche ${this.match.currentRound}${tie ? ' — manche décisive' : ''}`),
      need
        ? h('p', {}, `Choisissez ${need} combattant${need > 1 ? 's' : ''} parmi votre effectif. La fatigue accumulée lors des manches précédentes est indiquée sur chaque carte.`)
        : h('p', { class: 'form-error' }, 'Tous vos combattants engagés sont KO : vous ne pouvez aligner personne pour cette manche.'),
      koCount ? h('p', { class: 'muted' }, `${koCount} combattant${koCount > 1 ? 's' : ''} KO lors des manches précédentes ne peu${koCount > 1 ? 'vent' : 't'} plus combattre dans ce combat.`) : null,
      h('div', { class: 'pick-grid' }, squadFighters.map((fighter) => {
        const ko = this.match.isKnockedOut(fighter.id);
        const card = PickCard(fighter, this.playerTeam, { selected: this.lineup.includes(fighter.id), disabled: ko || full, onToggle: toggle });
        if (ko) {
          card.classList.add('is-ko');
          card.append(h('span', { class: 'pick-ko-badge' }, 'KO'));
        }
        return card;
      })),
      h(
        'div',
        { class: 'match-actions' },
        h('span', { class: 'pick-count' }, `${this.lineup.length} / ${need}`),
        this.match.rounds.length === 0
          ? h('button', { type: 'button', class: 'btn', onclick: () => this.goTo('squad') }, 'Modifier l’effectif')
          : null,
        need
          ? h('button', {
            type: 'button', class: 'btn',
            onclick: () => { this.lineup = autoSelectLineup(this.session, this.match, squadFighters, need).map((f) => f.id); this.update(); },
          }, 'Les moins fatigués')
          : null,
        need
          ? h('button', {
            type: 'button', class: 'btn btn-primary', disabled: this.lineup.length !== need,
            onclick: () => this.startPlacement(),
          }, 'Placer dans La Lice ▸')
          : h('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.forfeitRound() }, 'Concéder la manche ▸'),
      ),
    );
  }

  // --- Étape 3 : placement alterné (joueur, IA, joueur…) ---

  /** Composition de l'IA pour la manche, selon son comportement de ce combat (OpponentAIService). */
  opponentLineupIds() {
    const available = (fighters) => fighters.filter((fighter) => fighter && !this.match.isKnockedOut(fighter.id));
    return selectOpponentLineup(this.match, {
      own: available(this.opponentSquad),
      opponents: available(this.squad.map((id) => this.session.getFighter(id))),
      size: MATCH_RULES.fightersPerRound,
      fatigueOf: (fighter) => this.matchFatigue(fighter),
    }).map((fighter) => fighter.id);
  }

  /** Placement de l'IA selon son comportement de ce combat (stratégie et estimation des combattants). */
  aiPlacementOptions() {
    return getOpponentPlacementOptions(this.match, { fighterOf: (id) => this.session.getFighter(id), fatigueOf: (fighter) => this.matchFatigue(fighter) });
  }

  /** Composition de l'IA pour la manche, puis placement alterné (aucun combattant posé au départ). */
  startPlacement() {
    this.opponentLineup = this.opponentLineupIds();
    // Qui place en premier : niveau le plus élevé à la 1re manche, puis alternance.
    this.firstPlacing = getFirstPlacingSide(this.session, this.match);
    this.placement = new PlacementManager({ arena: this.arena, fighters: { A: [...this.lineup], B: this.opponentLineup }, firstSide: this.firstPlacing.side });
    this.placingId = null;
    this.goTo('placement');
    // Si l'IA commence, elle joue son premier placement après son temps de réflexion.
    this.afterPlacement();
  }

  classOf = (fighterId) => this.session.getFighter(fighterId)?.specialtyId;

  bonusLabels = getBonusLabels();

  /** Fatigue d'un combattant dans ce combat (adversaires : fatigue suivie le temps du combat, cumulée d'une manche à l'autre). */
  matchFatigue(fighter) {
    return Math.round(getMatchFatigue(this.session, this.match, fighter));
  }

  /** Combattant affiché dans La Lice, couleurs selon sa fatigue dans ce combat. */
  liceCombatant(fighter, team, sideIndex, position) {
    const combatant = new Combatant({ fighter, team, sideIndex, position });
    combatant.colorIntensity = getColorIntensity(this.matchFatigue(fighter));
    return combatant;
  }

  get isPlayerTurn() {
    return this.placement?.currentSide === 'A';
  }

  /**
   * Placement dans la Lice : écran de préparation tactique en trois zones, sans défilement.
   *   [Mon équipe]  [La Lice]  [Adversaires]
   *   [état du placement · actions · Lancer la manche]
   */
  renderPlacementStep() {
    this.canvas = h('canvas', { class: 'arena-canvas match-canvas', 'aria-label': 'Placement dans La Lice' });
    this.ownList = h('ul', { class: 'placement-list' });
    this.enemyList = h('ul', { class: 'placement-list placement-enemies' });
    this.ownCount = h('span', { class: 'placement-count' });
    this.enemyCount = h('span', { class: 'placement-count' });
    this.placementStatus = h('p', { class: 'placement-status', role: 'status' });
    this.placementActions = h('div', { class: 'match-actions placement-actions' });
    this.refreshPlacementUi();
    return h(
      'div',
      { class: 'match-body panel placement-screen' },
      h(
        'div',
        { class: 'placement-head' },
        h('h2', { class: 'section-title', title: 'Chacun son tour, vous puis l’adversaire, placez un combattant sur une case libre de votre zone (pointillés bleus). Un combattant posé ne peut plus être déplacé : le placement décide des premiers affrontements.' },
          `Manche ${this.match.currentRound} — placement dans la lice`),
        ClassRolesInline(),
        h('div', { class: 'placement-subhead' },
          h('p', { class: 'placement-rule muted' }, 'Chacun son tour · une case libre de votre zone (pointillés bleus) · un combattant posé ne bouge plus'),
          h('p', { class: 'lice-ambiance muted' }, `${this.presentation.decoration.name} · ${crowdLabel(this.presentation.crowdSize)}`)),
      ),
      h(
        'div',
        { class: 'placement-layout placement-panel' },
        h('section', { class: 'placement-side is-own', 'aria-label': 'Mon équipe' },
          h('h3', { class: 'placement-side-title' }, h('span', {}, 'Mon équipe'), this.ownCount),
          this.ownList),
        h('div', { class: 'arena-wrap' }, this.canvas),
        h('section', { class: 'placement-side is-enemy', 'aria-label': `Adversaires — ${this.opponentTeam.name}` },
          h('h3', { class: 'placement-side-title' }, h('span', { title: this.opponentTeam.name }, 'Adversaires'), this.enemyCount),
          this.enemyList),
      ),
      h('div', { class: 'placement-actionbar' }, this.placementStatus, this.placementActions),
    );
  }

  /** Colonnes (mon équipe à gauche, adversaires à droite), tour en cours et boutons. */
  refreshPlacementUi() {
    if (!this.ownList || !this.placement) return;
    const manager = this.placement;
    if (this.isPlayerTurn && (!this.placingId || manager.getPlacement('A', this.placingId))) this.placingId = manager.getRemaining('A')[0] ?? null;
    const lastAI = manager.getLastPlacement('B');
    const tileLabel = (tile) => `case ${tile.x + 1}·${tile.y + 1}`;

    // Nos combattants : à placer, en cours de placement, placés (verrouillés).
    const own = this.lineup.map((id) => {
      const fighter = this.session.getFighter(id);
      const tile = manager.getPlacement('A', id);
      const fatigue = this.matchFatigue(fighter);
      const state = tile ? 'placed' : !this.isPlayerTurn ? 'waiting' : this.placingId === id ? 'selected' : 'available';
      return PlacementFighterCard(fighter, {
        side: 'own', state, session: this.session, team: this.playerTeam, fatigue, colorIntensity: getColorIntensity(fatigue),
        // Effets pour la manche à venir (ex. Hypocras) : pastille à côté du nom.
        effects: this.effectIconsOf(id),
        statusText: tile ? `🔒 ${tileLabel(tile)}` : state === 'selected' ? '▸ à placer maintenant' : 'à placer',
        onSelect: (fighterId) => { this.placingId = fighterId; this.refreshPlacementUi(); this.refreshLice(); },
      });
    });
    // Adversaires : présence, classe, étoiles, sprite, fatigue — jamais leurs statistiques.
    const enemies = this.opponentLineup.map((id) => {
      const fighter = this.session.getFighter(id);
      const tile = manager.getPlacement('B', id);
      const isLast = lastAI?.fighterId === id;
      const fatigue = this.matchFatigue(fighter);
      return PlacementFighterCard(fighter, {
        side: 'enemy', state: isLast && tile ? 'last' : tile ? 'placed' : 'available', session: this.session, team: this.opponentTeam,
        fatigue, colorIntensity: getColorIntensity(fatigue),
        statusText: tile ? `${isLast ? '← vient d’être placé · ' : ''}${tileLabel(tile)}` : 'à placer',
      });
    });
    this.ownList.replaceChildren(...own);
    this.enemyList.replaceChildren(...enemies);
    const placedOwn = this.lineup.filter((id) => manager.getPlacement('A', id)).length;
    const placedEnemy = this.opponentLineup.filter((id) => manager.getPlacement('B', id)).length;
    this.ownCount.textContent = `${placedOwn} / ${this.lineup.length} placés`;
    this.enemyCount.textContent = `${placedEnemy} / ${this.opponentLineup.length} placés`;

    const fighterName = (id) => this.session.getFighter(id)?.name ?? '?';
    const total = this.lineup.length + this.opponentLineup.length;
    let status;
    if (manager.isComplete) status = `Les ${total} combattants sont en place. Lancez la manche quand vous êtes prêt.`;
    else if (this.isPlayerTurn) status = `À vous : placez ${fighterName(this.placingId)} sur une case libre de votre zone.`;
    else status = `Au tour ${ofClub(this.opponentTeam.name)}…`;
    // Qui a commencé, et pourquoi (niveau le plus élevé à la 1re manche, alternance ensuite).
    if (manager.history.length === 0 && this.firstPlacing) {
      const starter = this.firstPlacing.side === 'A' ? this.playerTeam.name : this.opponentTeam.name;
      const why = this.firstPlacing.reason === 'level' ? 'niveau le plus élevé' : 'chacun son tour d’une manche à l’autre';
      status = `${starter} place en premier (${why}). ${status}`;
    }
    if (lastAI && !manager.isComplete && this.isPlayerTurn) {
      const fighter = this.session.getFighter(lastAI.fighterId);
      status = `${fighter.name} (${fighter.specialty.name}) vient d’être placé en ${tileLabel(lastAI.tile)}. ${status}`;
    }
    this.placementStatus.textContent = status;
    this.placementStatus.classList.toggle('is-ready', manager.isComplete);
    this.placementStatus.classList.toggle('is-waiting', !manager.isComplete && !this.isPlayerTurn);

    // replaceChildren écrirait « null » en texte : les boutons absents sont retirés de la liste.
    this.placementActions.replaceChildren(...[
      manager.history.length === 0
        ? h('button', { type: 'button', class: 'btn btn-sm', onclick: () => this.goTo('lineup') }, 'Modifier la sélection')
        : null,
      !manager.isComplete
        ? h('button', { type: 'button', class: 'btn btn-sm', disabled: !this.isPlayerTurn, onclick: () => this.autoPlaceAll() }, 'Placement automatique')
        : null,
      // Consommables (Pain au méteil, Hypocras…) donnés aux combattants alignés pour cette manche.
      // Coupe de France : Le Coffre est fermé.
      isChestLocked({ match: this.match }) ? null : h('button', {
        type: 'button', class: 'btn btn-sm chest-button', onclick: () => this.openPlacementChest(),
        title: 'Donner un consommable à un combattant aligné pour cette manche',
      }, `🧰 Le Coffre${this.chestCount() ? ` (${this.chestCount()})` : ''}`),
      h('button', {
        type: 'button', class: 'btn btn-fight', disabled: !manager.isComplete,
        onclick: () => this.launchRound(),
      }, `⚔ Lancer la manche ${this.match.currentRound}`),
    ].filter(Boolean));
  }
  /** Pose un combattant du joueur, puis fait jouer l'IA. */
  placePlayerFighter(fighterId, tile) {
    const result = this.placement.place('A', fighterId, tile);
    if (!result.ok) {
      showToast(result.reason, 'warning');
      return false;
    }
    this.placingId = null;
    this.afterPlacement();
    return true;
  }

  /** Après chaque pose : l'IA joue son tour (avec un court délai pour qu'on la voie). */
  afterPlacement() {
    this.refreshPlacementUi();
    this.refreshLice();
    if (this.placement.currentSide !== 'B') return;
    clearTimeout(this.aiTimer);
    this.aiTimer = setTimeout(() => {
      if (this.step !== 'placement' || this.placement.currentSide !== 'B') return;
      placeAutomatically({ manager: this.placement, side: 'B', classOf: this.classOf, ...this.aiPlacementOptions() });
      this.afterPlacement();
    }, this.aiPlacementDelay());
  }

  /** Temps de réflexion de l'IA avant un placement (1 à 2 s). */
  aiPlacementDelay() {
    const { min, max } = COMBAT_PLAYBACK.aiPlacementDelayMs;
    return min + Math.random() * (max - min);
  }

  /** Placement automatique de tous vos combattants restants (en alternance avec l'IA). */
  autoPlaceAll() {
    clearTimeout(this.aiTimer);
    while (!this.placement.isComplete) {
      placeAutomatically({ manager: this.placement, side: this.placement.currentSide, classOf: this.classOf });
    }
    this.placingId = null;
    this.refreshPlacementUi();
    this.refreshLice();
  }

  /** Pastilles des effets d'un combattant pour la manche à venir (ex. 🍷 Hypocras). */
  effectIconsOf(fighterId) {
    const ids = effectBonusIds({ effects: getRoundEffects(this.session, fighterId, this.match) });
    return ids.map((id) => this.bonusLabels[id]).filter(Boolean);
  }

  /** Nombre d'objets dans Le Coffre (tous exemplaires). */
  chestCount() {
    return listInventory(this.session).reduce((sum, item) => sum + item.quantity, 0);
  }

  /** Le Coffre pendant le placement : consommables donnés aux combattants de la manche. */
  openPlacementChest() {
    openChest({
      session: this.session,
      context: ITEM_USE_CONTEXTS.PLACEMENT,
      match: this.match,
      eligibleFighterIds: [...this.lineup],
      onChange: () => { this.refreshPlacementUi(); this.refreshLice(); },
    });
  }

  startLice() {
    if (!this.canvas || this.renderer) return;
    this.renderer = new IsoRenderer(this.canvas);
    this.renderer.setPresentation(this.presentation);
    this.renderer.resize();
    if (this.step === 'placement') {
      this.renderer.highlightArea = this.arena.getSide(0).area;
      this.renderer.enemyArea = this.arena.getSide(1).area;
      // Placement : caméra resserrée sur la lice (cases plus grandes, décor en bordure).
      this.renderer.setArena(this.arena);
      this.renderer.setCameraTarget({ x: -1, y: -1.6, w: this.arena.width + 2, h: this.arena.height + 2.2 });
      this.renderer.cameraFocus = { ...this.renderer.cameraTarget };
      this.renderer.fit(this.renderer.scenery.width, this.renderer.scenery.height, this.renderer.cameraFocus);
    }
    this.refreshLice();
    // Rejeu : caméra et scène posées dès le lancement, sans attendre la première image.
    if (this.step === 'battle') this.advanceBattle(0);

    const on = (target, type, handler) => {
      target.addEventListener(type, handler);
      this.liceCleanups.push(() => target.removeEventListener(type, handler));
    };
    on(window, 'resize', () => this.renderer.resize());
    if (this.step === 'placement') {
      on(this.canvas, 'mousemove', (event) => {
        const tile = this.renderer.pickArenaTile(event.clientX, event.clientY);
        this.renderer.hoverTile = tile && this.isPlayerTurn && this.arena.isInDeploymentArea(0, tile.x, tile.y) ? tile : null;
      });
      on(this.canvas, 'mouseleave', () => { this.renderer.hoverTile = null; });
      on(this.canvas, 'click', (event) => this.onLiceClick(event));
    }

    let last = performance.now();
    const frame = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      if (this.step === 'battle') this.advanceBattle(dt);
      this.renderer.render(this.liceScene, now / 1000);
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
  }

  stopLice() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    clearTimeout(this.aiTimer);
    for (const cleanup of this.liceCleanups.splice(0)) cleanup();
    this.renderer = null;
  }

  /** Scène affichée : combattants posés (placement) ou rejeu de la manche (combat). */
  refreshLice() {
    if (this.step === 'battle') return;
    const units = [];
    for (const [side, team, index] of [['A', this.playerTeam, 0], ['B', this.opponentTeam, 1]]) {
      for (const [id, tile] of this.placement?.placements[side] ?? []) {
        const combatant = this.liceCombatant(this.session.getFighter(id), team, index, { x: tile.x + 0.5, y: tile.y + 0.5 });
        // Effet actif pour la manche à venir : pastille au-dessus du combattant.
        if (side === 'A') combatant.badges = this.effectIconsOf(id).map((effect) => effect.icon);
        units.push(combatant);
      }
    }
    this.liceScene = { arena: this.arena, combatants: units };
    if (this.renderer) {
      const lastAI = this.placement?.getLastPlacement('B');
      this.renderer.markedIds = new Set(lastAI && !this.placement.isComplete ? [lastAI.fighterId] : []);
      this.renderer.highlightedId = this.placingId;
    }
  }

  onLiceClick(event) {
    const tile = this.renderer.pickArenaTile(event.clientX, event.clientY);
    if (!tile || !this.isPlayerTurn) return;
    if (!this.placingId) return;
    this.placePlayerFighter(this.placingId, tile);
  }

  // --- Étape 4 : la manche (simulation, puis rejeu animé) ---

  /** Verrouille le placement, simule la manche (moteur de combat), puis la rejoue. */
  launchRound() {
    if (!this.placement?.isComplete) return;
    this.placement.lock();
    const scoreBefore = { a: this.match.scoreA, b: this.match.scoreB };
    this.lastRound = resolvePlayerRound(this.session, this.match, {
      fightersA: [...this.lineup],
      fightersB: [...this.opponentLineup],
      ...this.placement.toLineup(),
      arena: this.arena,
    });
    this.scoreBeforeRound = scoreBefore;
    this.playback = new CombatPlayback(this.lastRound.simulation);
    // Son : la musique de combat se lance avec la manche ; coups et KO suivent le rejeu.
    audioDirector.startMoment('roundStart');
    this.combatCues = buildCombatCues(this.playback);
    this.roundCelebrated = false;
    this.battleTime = 0;
    this.battleSpeed = COMBAT_PLAYBACK.speeds[0];
    this.battleCameraClose = true;
    // Couleurs : fatigue au début de la manche (celle de la simulation).
    this.battleCombatants = this.lastRound.simulation.initial.map((unit) => {
      const combatant = new Combatant({
        fighter: this.session.getFighter(unit.id),
        team: unit.side === 'A' ? this.playerTeam : this.opponentTeam,
        sideIndex: unit.side === 'A' ? 0 : 1,
        position: { x: unit.x + 0.5, y: unit.y + 0.5 },
      });
      combatant.colorIntensity = getColorIntensity(unit.fatigue);
      // Effets de la manche (ex. Hypocras) : pastille visible pendant toute la manche.
      combatant.effectIcons = effectBonusIds(unit).map((id) => this.bonusLabels[id]?.icon).filter(Boolean);
      return combatant;
    });
    this.liceScene = { arena: this.arena, combatants: this.battleCombatants };
    this.goTo('battle');
  }

  /** Concède une manche faute de combattant disponible (tous KO). */
  forfeitRound() {
    this.opponentLineup = this.opponentLineupIds();
    const manager = new PlacementManager({ arena: this.arena, fighters: { A: [], B: this.opponentLineup } });
    while (!manager.isComplete) placeAutomatically({ manager, side: 'B', classOf: this.classOf, ...this.aiPlacementOptions() });
    this.placement = manager;
    this.lineup = [];
    this.launchRound();
  }

  renderBattleStep() {
    this.canvas = h('canvas', { class: 'arena-canvas match-canvas', 'aria-label': 'Manche en cours dans La Lice' });
    this.battleStatus = h('p', { class: 'battle-status', role: 'status' });
    this.bonusPanel = this.renderBonusPanel();
    this.battleActions = h('div', { class: 'match-actions' });
    this.renderBattleControls();
    return h(
      'div',
      { class: 'match-body panel' },
      // Rappel permanent, en haut : la formation et les rôles.
      h('div', { class: 'class-roles-sticky' }, ClassRoles({ compact: true })),
      h('h2', { class: 'section-title' }, `Manche ${this.lastRound.number} — combat`),
      h('p', { class: 'muted' }, 'Chacun choisit un adversaire qu’il voit et va le frapper. Le plus endurant frappe le premier ; la position fait le reste — barrière, distance, dos tourné — et la fatigue réduit les dégâts.'),
      this.battleStatus,
      h('div', { class: 'arena-wrap arena-wrap-battle' }, this.canvas),
      this.bonusPanel,
      this.battleActions,
    );
  }

  get battleFinished() {
    return this.playback && this.battleTime >= this.playback.duration;
  }

  renderBattleControls() {
    if (!this.battleActions) return;
    const finished = this.battleFinished;
    this.battleActions.replaceChildren(
      ...COMBAT_PLAYBACK.speeds.map((speed) => h('button', {
        type: 'button', class: `btn btn-sm ${this.battleSpeed === speed ? 'is-active' : ''}`.trim(), disabled: finished,
        'aria-pressed': String(this.battleSpeed === speed),
        onclick: () => { this.battleSpeed = speed; this.renderBattleControls(); },
      }, `×${speed}`)),
      h('button', {
        type: 'button', class: 'btn btn-sm camera-toggle', 'aria-pressed': String(!this.battleCameraClose),
        onclick: () => { this.battleCameraClose = !this.battleCameraClose; this.advanceBattle(0); },
      }, this.battleCameraClose ? '🔍 Vue d’ensemble' : '🔍 Suivre le combat'),
      finished
        ? h('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.goTo('result') }, 'Voir le résultat de la manche ▸')
        : h('button', { type: 'button', class: 'btn', onclick: () => { this.battleTime = this.playback.duration; this.advanceBattle(0); } }, 'Passer à la fin ▸▸'),
    );
  }

  /** Avance le rejeu de `dt` secondes et met à jour la scène (positions, PV, états). */
  advanceBattle(dt) {
    if (!this.playback) return;
    const wasFinished = this.battleFinished;
    const before = this.battleTime;
    this.battleTime = Math.min(this.playback.duration, this.battleTime + dt * this.battleSpeed);
    playCombatCues(this.combatCues, before, this.battleTime, { maxJump: 0.6 * Math.max(1, this.battleSpeed) });
    const frame = this.playback.frameAt(this.battleTime);
    const byId = new Map(frame.units.map((unit) => [unit.id, unit]));
    for (const combatant of this.battleCombatants) {
      const unit = byId.get(combatant.id);
      combatant.position = { x: unit.x + 0.5, y: unit.y + 0.5 };
      // Lancement : étiquettes de bonus au-dessus de chaque combattant.
      // Une pastille d'icônes par combattant (lisible même en mêlée) ; le détail est listé sous la lice.
      // Pendant la manche : seuls les effets temporaires (ex. 🍷 Hypocras) restent affichés,
      // jusqu'au KO ou à la fin de la manche (l'effet prend fin avec elle).
      const icons = frame.intro
        ? (unit.bonuses ?? []).map((id) => this.bonusLabels[id]?.icon).filter(Boolean)
        : (unit.ko || frame.finished ? [] : combatant.effectIcons ?? []);
      combatant.view = { ...unit, badges: icons.length ? [icons.join(' ')] : [] };
      combatant.state = unit.state;
    }
    if (this.renderer) {
      this.renderer.effects = frame.effects;
      // Particules (étincelles, sable) : niveau choisi dans les Options.
      const level = resolveVfxLevel(this.services.settings.get('display.vfx'));
      const sideColors = this.battleSideColors();
      this.renderer.vfx = collectVfx(this.playback, this.battleTime, { level, arenaHeight: this.arena.height, sideColors });
      // Gros coups : tremblement bref (niveau d'effets complet seulement).
      this.renderer.shake = shakeAt(this.playback, this.battleTime, { level, arenaHeight: this.arena.height });
      this.renderer.setCameraTarget(this.battleCameraClose ? this.battleCameraArea(frame) : null);
      // Manche finie : fanions du vainqueur au-dessus de ses combattants debout (une fois).
      if (this.battleFinished && !this.roundCelebrated) {
        this.roundCelebrated = true;
        const side = this.playback.simulation.winnerSide;
        const winners = frame.units.filter((u) => !u.ko && this.playback.sideOf.get(u.id) === side).map((u) => ({ x: u.x + 0.5, y: u.y + 0.5 }));
        if (winners.length) this.renderer.celebrateRound(winners, sideColors[side]);
      }
    }
    const alive = (side) => frame.units.filter((unit) => !unit.ko && this.playback.sideOf.get(unit.id) === side).length;
    if (this.battleStatus) {
      this.battleStatus.textContent = frame.intro
        ? 'Lancement de la manche : voici les bonus de chacun…'
        : frame.lull
        ? 'Temps mort : chacun recule d’un pas et reprend son souffle…'
        : this.battleFinished
        ? `Manche terminée : victoire ${ofClub(this.session.getTeam(this.lastRound.winnerTeamId).name)}.`
        : `Combattants debout — ${this.playerTeam.name} : ${alive('A')} · ${this.opponentTeam.name} : ${alive('B')}`;
    }
    if (this.bonusPanel) this.bonusPanel.hidden = !frame.intro;
    if (this.battleFinished !== wasFinished || dt === 0) this.renderBattleControls();
  }

  /** Couleur principale de chaque camp de la manche (A : la compagnie du joueur). */
  battleSideColors() {
    const colorOf = (teamId) => this.session.getTeam(teamId)?.emblem.resolvedColors().primary ?? null;
    return { A: colorOf(this.match.teamAId), B: colorOf(this.match.teamBId) };
  }

  /**
   * Zone cadrée par la caméra : les combattants encore debout (tous pendant l'introduction),
   * avec une marge et un cadrage minimal, sans sortir largement de la lice.
   */
  battleCameraArea(frame) {
    const { padding, minWidth, minHeight, maxWidth, maxHeight } = COMBAT_PLAYBACK.camera;
    const standing = frame.units.filter((u) => !u.ko);
    const units = standing.length ? standing : frame.units;
    let x0 = Math.min(...units.map((u) => u.x)) - padding;
    let x1 = Math.max(...units.map((u) => u.x)) + 1 + padding;
    let y0 = Math.min(...units.map((u) => u.y)) - padding;
    let y1 = Math.max(...units.map((u) => u.y)) + 1 + padding;
    // Centre du groupe (pour un cadrage plafonné) : moyenne des positions.
    const cx = units.reduce((s, u) => s + u.x + 0.5, 0) / units.length;
    const cy = units.reduce((s, u) => s + u.y + 0.5, 0) / units.length;
    const resize = (lo, hi, size, center) => [center - size / 2, center + size / 2];
    if (x1 - x0 < minWidth) [x0, x1] = resize(x0, x1, minWidth, (x0 + x1) / 2);
    if (x1 - x0 > maxWidth) [x0, x1] = resize(x0, x1, maxWidth, cx);
    if (y1 - y0 < minHeight) [y0, y1] = resize(y0, y1, minHeight, (y0 + y1) / 2);
    if (y1 - y0 > maxHeight) [y0, y1] = resize(y0, y1, maxHeight, cy);
    // Le haut de l'écran correspond aux petits x et y : on y décale le cadre pour la hauteur des sprites.
    const { headroom } = COMBAT_PLAYBACK.camera;
    x0 -= headroom / 2; x1 -= headroom / 2;
    y0 -= headroom / 2; y1 -= headroom / 2;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    x0 = clamp(x0, -1, this.arena.width + 1 - (x1 - x0));
    y0 = clamp(y0, -1, this.arena.height + 1 - (y1 - y0));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /** Bonus de chaque camp au lancement de la manche (affichés le temps de l'introduction). */
  renderBonusPanel() {
    const bonuses = this.lastRound.simulation.startBonuses ?? {};
    const column = (side, team) => {
      const units = this.lastRound.simulation.initial.filter((u) => u.side === side && (bonuses[u.id] ?? []).length);
      return h(
        'section',
        { class: 'bonus-column' },
        h('h4', { class: 'round-summary-title' }, team.name),
        units.length
          ? h('ul', { class: 'bonus-list' }, units.map((u) => h(
            'li',
            { 'data-fighter-id': u.id },
            h('strong', {}, u.name),
            h('span', { class: 'muted' }, bonuses[u.id].map((id) => `${this.bonusLabels[id].icon} ${this.bonusLabels[id].long}`).join(' · ')),
          )))
          : h('p', { class: 'muted' }, 'Aucun bonus.'),
      );
    };
    return h(
      'div',
      { class: 'bonus-panel', role: 'status' },
      h('h3', { class: 'sheet-section-title' }, 'Bonus au lancement'),
      h('div', { class: 'final-columns' }, column('A', this.playerTeam), column('B', this.opponentTeam)),
    );
  }

  /** Bilan d'une manche simulée : KO et dégâts infligés par chacun (aucune statistique adverse). */
  renderRoundSummary(round) {
    const simulation = round.simulation;
    if (!simulation) return null;
    const row = (unit) => {
      const fighter = this.session.getFighter(unit.id);
      const team = unit.side === 'A' ? this.playerTeam : this.opponentTeam;
      const ko = simulation.knockedOut.includes(unit.id);
      return h(
        'tr',
        { class: ko ? 'is-ko' : '' },
        h('td', {}, h('span', { class: 'fatigue-who' }, FighterSprite(fighter, { size: 28, team }), FighterName(fighter, { session: this.session }))),
        h('td', {}, ...FighterClassTags(fighter)),
        h('td', { class: 'num' }, String(simulation.stats[unit.id]?.dealt ?? 0)),
        h('td', {}, ko ? h('strong', { class: 'ko-label' }, 'KO') : 'debout'),
      );
    };
    const table = (side, title) => h(
      'section',
      {},
      h('h4', { class: 'round-summary-title' }, title),
      h('table', { class: 'assign-table round-units' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Combattant'), h('th', {}, 'Classe'), h('th', { class: 'num' }, 'Dégâts infligés'), h('th', {}, 'État'))),
        h('tbody', {}, simulation.initial.filter((u) => u.side === side).map(row))),
    );
    const ownKo = simulation.knockedOut.filter((id) => simulation.initial.find((u) => u.id === id)?.side === 'A').length;
    return h(
      'div',
      { class: 'round-summary-block' },
      h('h3', { class: 'sheet-section-title' }, 'Bilan de la manche'),
      simulation.reason === 'forfeit'
        ? h('p', { class: 'muted' }, 'Manche concédée : aucun combattant disponible.')
        : h('p', { class: 'muted' }, `${simulation.ticks} tours de combat.${ownKo ? ` ${koSummary(ownKo, COMBAT_RULES.knockoutLastsWholeMatch)}` : ''}`),
      h('div', { class: 'final-columns' }, table('A', this.playerTeam.name), table('B', this.opponentTeam.name)),
    );
  }

  /** Tableau de fatigue d'une manche (avant, gain, après) pour un camp. */
  renderFatigueTable(entries, team, className) {
    return h(
      'table',
      { class: `assign-table ${className}` },
      h('thead', {}, h('tr', {}, h('th', {}, 'Combattant'), h('th', { class: 'num' }, 'Avant'), h('th', { class: 'num' }, 'Gain'), h('th', { class: 'num' }, 'Fatigue'))),
      h('tbody', {}, entries.map((entry) => {
        const fighter = this.session.getFighter(entry.fighterId);
        return h(
          'tr',
          {},
          h('td', {}, h('span', { class: 'fatigue-who' }, FighterSprite(fighter, { size: 32, team, colorIntensity: getColorIntensity(entry.after) }), FighterName(fighter, { session: this.session }))),
          h('td', { class: 'num' }, String(entry.before)),
          // (Mis KO tôt, il récupère au sol : sa fatigue peut finir sous celle du départ.)
          h('td', { class: 'num fatigue-gain' }, entry.amount < 0 ? `−${-entry.amount}` : `+${entry.amount}`),
          h('td', { class: 'num' }, h('strong', {}, `${entry.after} / 100`)),
        );
      })),
    );
  }

  /**
   * Courbatures de fin de combat (v0.75) : fatigue prise par chacun de nos combattants (manches
   * disputées, KO), son nouvel état, et les épuisés envoyés au Banquet. null : rien à montrer.
   */
  renderSorenessBlock() {
    const entries = this.match?.soreness ?? [];
    if (!entries.length) return null;
    const { perRound, knockedOut } = FATIGUE_RULES.soreness;
    const refuge = getActivity(FATIGUE_RULES.centre.exhausted.refuge)?.name ?? 'Banquet';
    const sent = entries.filter((entry) => entry.toRefuge).map((entry) => this.session.getFighter(entry.fighterId)?.name).filter(Boolean);
    const exhausted = entries.filter((entry) => getFatigueState(this.session.getFighter(entry.fighterId), entry.after).id === 'exhausted').length;
    return h(
      'section',
      { class: 'soreness-block' },
      h('h3', { class: 'sheet-section-title' }, 'Courbatures du lendemain'),
      h('p', { class: 'muted' }, `Chaque combattant engagé prend +${perRound} de fatigue par manche disputée, +${knockedOut} s’il a été mis KO. Seul le ${refuge} la fait redescendre.`),
      h('table', { class: 'assign-table fatigue-table soreness-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Combattant'), h('th', { class: 'num' }, 'Manches'), h('th', { class: 'num' }, 'Courbatures'), h('th', { class: 'num' }, 'Fatigue'), h('th', {}, 'État'))),
        h('tbody', {}, entries.map((entry) => {
          const fighter = this.session.getFighter(entry.fighterId);
          if (!fighter) return null;
          const state = getFatigueState(fighter, entry.after);
          return h(
            'tr',
            { class: `is-${state.id}` },
            h('td', {}, h('span', { class: 'fatigue-who' }, FighterSprite(fighter, { size: 28, team: this.playerTeam, colorIntensity: getColorIntensity(entry.after) }), FighterName(fighter, { session: this.session }))),
            h('td', { class: 'num' }, `${entry.rounds}${entry.knockedOut ? ' · KO' : ''}`),
            h('td', { class: 'num fatigue-gain' }, `+${entry.amount}`),
            h('td', { class: 'num' }, h('strong', {}, `${entry.after} / 100`)),
            h('td', {}, h('span', { class: `pick-fatigue ${fatigueLevelClass(fighter, entry.after)}` }, state.label)),
          );
        }).filter(Boolean))),
      sent.length
        ? h('p', { class: 'soreness-refuge', role: 'status' }, `🍗 Épuisé${sent.length > 1 ? 's' : ''}, envoyé${sent.length > 1 ? 's' : ''} d’office au ${refuge} : ${sent.join(', ')}.`)
        : exhausted
          ? h('p', { class: 'soreness-refuge', role: 'status' }, `🍗 ${exhausted} combattant${exhausted > 1 ? 's sont épuisés' : ' est épuisé'} : seul le ${refuge} ${exhausted > 1 ? 'les' : 'le'} remettra sur pied.`)
          : null,
    );
  }

  renderResultStep() {    const round = this.lastRound;
    const won = round.winnerTeamId === this.playerTeam.id;
    const winner = this.session.getTeam(round.winnerTeamId);
    const tie = !this.match.isFinished && this.match.scoreA === 1 && this.match.scoreB === 1;

    return h(
      'div',
      { class: `match-body panel round-result ${won ? 'is-win' : 'is-loss'}` },
      h('p', { class: 'round-label' }, `Manche ${round.number}`),
      h('h2', { class: 'round-title' }, `Victoire ${ofClub(winner.name)} !`),
      h('p', { class: 'round-score' }, `${this.playerTeam.name} ${round.scoreA} — ${round.scoreB} ${this.opponentTeam.name}`),
      tie ? h('p', { class: 'round-decider' }, 'Égalité 1 – 1 : une troisième manche décisive est nécessaire.') : null,
      h('h3', { class: 'sheet-section-title' }, 'Fatigue de vos combattants'),
      this.renderFatigueTable(round.fatigueApplied.filter((entry) => entry.side === 'A'), this.playerTeam, 'fatigue-table'),
      this.renderRoundSummary(round),
      // Fatigue (suivie le temps du combat) des adversaires : visible, elle compte aux manches suivantes.
      h('h3', { class: 'sheet-section-title' }, `Fatigue ${ofClub(this.opponentTeam.name)}`),
      this.renderFatigueTable(round.fatigueApplied.filter((entry) => entry.side === 'B'), this.opponentTeam, 'fatigue-table-opponent'),      h(
        'div',
        { class: 'match-actions' },
        this.match.isFinished
          ? h('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.goTo('final') }, 'Voir le résultat du combat ▸')
          : h('button', {
            type: 'button', class: 'btn btn-primary',
            onclick: () => { this.lineup = []; this.goTo('lineup'); },
          }, `Préparer la manche ${this.match.currentRound} ▸`),
      ),
    );
  }

  // --- Fin du combat et de la journée ---

  /** Fin d'un Combat de la Reine : récompense (victoire seulement), sans effet sur le championnat. */
  renderQueenFinalStep() {
    if (!this.queenReport) this.queenReport = resolveQueenCombat(this.session, this.event, this.match);
    const playerId = this.playerTeam.id;
    const won = this.queenReport.won;
    const name = (id) => this.session.getTeam(id)?.name ?? '?';
    const option = getSelectedOption(this.event);
    return h(
      'div',
      { class: 'match-body panel' },
      h(
        'div',
        { class: `match-final is-queen ${won ? 'is-win' : 'is-loss'}` },
        won ? VictoryCelebration('queen', { seed: `reine:${this.event.day}` }) : null,
        h('p', { class: 'final-title' }, won ? 'VICTOIRE !' : 'DÉFAITE'),
        h('p', { class: 'final-sub' }, `${name(this.match.winnerId)} ${clubVerb(name(this.match.winnerId), 'remporte', 'remportent')} le Combat de la Reine`),
        h('p', { class: 'final-score' }, `${Math.max(this.match.scoreA, this.match.scoreB)} – ${Math.min(this.match.scoreA, this.match.scoreB)}`),
        h('p', { class: 'final-points queen-reward' }, won
          ? `+${this.queenReport.reward} deniers de récompense`
          : `Aucune récompense (${option.reward} deniers en cas de victoire)`),
        h(
          'ol',
          { class: 'round-summary' },
          this.match.rounds.map((round) => h(
            'li',
            { class: round.winnerTeamId === playerId ? 'is-win' : 'is-loss' },
            `Manche ${round.number} — victoire ${ofClub(name(round.winnerTeamId))} (${round.scoreA} – ${round.scoreB})`,
          )),
        ),
        h('p', { class: 'muted' }, 'Ce combat ne compte pas pour le championnat : le classement n’est pas modifié.'),
      ),
      this.renderSorenessBlock(),
      this.renderSecondaryMatches({ withResults: true }),
      h(
        'div',
        { class: 'match-actions' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.finishDay() }, 'Terminer la journée ▸'),
      ),
    );
  }

  /**
   * Fin d'un combat de Coupe de France : résultat inscrit dans la Coupe (une seule fois),
   * sauvegarde, puis retour au Château de Gabarnac (les autres combats s'y disputent).
   */
  renderCupFinalStep() {
    if (!this.cupRecorded) {
      recordPlayerMatch(this.session, this.cupMatch.id, this.match.rounds);
      this.cupRecorded = true;
      // Récompense de la victoire (versée une seule fois par combat, FrenchCupManager).
      const paid = getCup(this.session).rewards?.[this.cupMatch.id] ?? 0;
      if (paid) showToast(`Victoire ! +${paid.toLocaleString('fr-FR')} deniers`, 'success');
      if (this.services.settings.get('gameplay.autosave')) {
        try { this.services.saves.save(this.session); } catch { /* sauvegarde manuelle toujours possible */ }
      }
    }
    const playerId = this.playerTeam.id;
    const won = this.match.winnerId === playerId;
    const name = (id) => this.session.getTeam(id)?.name ?? '?';
    const cup = getCup(this.session);
    const knockout = this.cupMatch.round !== undefined;
    const isFinal = knockout && this.cupMatch.round === FRENCH_CUP_RULES.knockoutRounds.length - 1;
    let note;
    const points = pointsFor(won, this.match.scoreA);
    if (!knockout) note = `Phase de poules : +${points} point${points > 1 ? 's' : ''} au classement de la poule ${this.cupMatch.groupId}.`;
    else if (won) note = isFinal ? 'Votre compagnie remporte la Coupe de France !' : 'Votre compagnie se qualifie pour le tour suivant.';
    else note = `Votre compagnie est éliminée (${describeMatch(cup, this.cupMatch)}).`;
    return h(
      'div',
      { class: 'match-body panel' },
      h(
        'div',
        { class: `match-final is-cup ${won ? 'is-win' : 'is-loss'}` },
        won ? VictoryCelebration('cup', { seed: `coupe:${this.cupMatch.id}` }) : null,
        h('p', { class: 'final-title' }, won ? 'VICTOIRE !' : 'DÉFAITE'),
        h('p', { class: 'final-sub' }, `${name(this.match.winnerId)} ${clubVerb(name(this.match.winnerId), 'remporte', 'remportent')} le combat`),
        h('p', { class: 'final-score' }, `${Math.max(this.match.scoreA, this.match.scoreB)} – ${Math.min(this.match.scoreA, this.match.scoreB)}`),
        h('p', { class: 'final-points' }, note),
        won && cup.rewards?.[this.cupMatch.id]
          ? h('p', { class: 'final-points home-reward cup-reward' }, `💰 Récompense de la Coupe : +${cup.rewards[this.cupMatch.id].toLocaleString('fr-FR')} deniers`)
          : null,
        h('ol', { class: 'round-summary' }, this.match.rounds.map((round) => h(
          'li',
          { class: round.winnerTeamId === playerId ? 'is-win' : 'is-loss' },
          `Manche ${round.number} — victoire ${ofClub(name(round.winnerTeamId))} (${round.scoreA} – ${round.scoreB})`,
        ))),
        h('p', { class: 'muted' }, 'La Coupe de France ne touche ni au championnat ni au calendrier. La fatigue de vos combattants, remise à 0 à l’entrée dans la Coupe, se garde d’un combat à l’autre.'),
      ),
      this.renderSorenessBlock(),
      h('div', { class: 'match-actions' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.navigate(SCREENS.FRENCH_CUP) }, 'Retour au Château de Gabarnac ▸')),
    );
  }

  renderFinalStep() {
    this.releaseAchievements();
    // Victoire du joueur : fanfare (une fois par combat).
    if (this.match?.isFinished && this.match.winnerId === this.playerTeam?.id && !this.fanfarePlayed) {
      this.fanfarePlayed = true;
      audioDirector.play('victory');
    }
    if (this.isCup) return this.renderCupFinalStep();
    if (this.isQueen) return this.renderQueenFinalStep();
    if (!this.results) {
      // Dernier combat de la saison : la saison est clôturée aussitôt (bilan au carnet du jour).
      const { results, seasonEnd } = completeMatchdayAndCheckSeason(this.session, this.event, this.match);
      this.results = results;
      this.seasonEnd = seasonEnd;
    }
    const playerId = this.playerTeam.id;
    const playerLeagueId = this.session.playerLeague.id;
    // Combats de la division du joueur ; les autres divisions ont aussi disputé leur journée.
    const others = this.results.filter(({ match, leagueId }) => match !== this.match && leagueId === playerLeagueId);
    const otherLeagues = [...new Set(this.results.filter((r) => r.leagueId !== playerLeagueId).map((r) => r.leagueId))];
    const standings = getStandings(this.session);
    const name = (id) => this.session.getTeam(id)?.name ?? '?';

    let headline;
    if (this.match) {
      const won = this.match.winnerId === playerId;
      const playerResult = this.results.find(({ match }) => match === this.match);
      const points = playerResult.points[playerId];
      const homeReward = playerResult.homeReward ?? 0;
      headline = h(
        'div',
        { class: `match-final ${won ? 'is-win' : 'is-loss'}` },
        h('p', { class: 'final-title' }, won ? 'VICTOIRE !' : 'DÉFAITE'),
        h('p', { class: 'final-sub' }, `${name(this.match.winnerId)} ${clubVerb(name(this.match.winnerId), 'remporte', 'remportent')} le combat`),
        h('p', { class: 'final-score' }, `${Math.max(this.match.scoreA, this.match.scoreB)} – ${Math.min(this.match.scoreA, this.match.scoreB)}`),
        h('p', { class: 'final-points' }, `+${points} point${points > 1 ? 's' : ''} au classement`),
        // Victoire à domicile : recette de la lice (HomeRewardService).
        homeReward ? h('p', { class: 'final-points home-reward' }, `🏠 Victoire à domicile : +${homeReward} deniers`) : null,
        h(
          'ol',
          { class: 'round-summary' },
          this.match.rounds.map((round) => h(
            'li',
            { class: round.winnerTeamId === playerId ? 'is-win' : 'is-loss' },
            `Manche ${round.number} — victoire ${ofClub(name(round.winnerTeamId))} (${round.scoreA} – ${round.scoreB})`,
          )),
        ),
      );
    } else {
      headline = h('div', { class: 'match-final' }, h('p', { class: 'final-sub' }, 'Votre compagnie est exempte lors de cette journée.'));
    }

    return h(
      'div',
      { class: 'match-body panel' },
      headline,
      this.renderSorenessBlock(),
      this.seasonEnd
        ? h('p', { class: 'season-over-note', role: 'status' }, `C’était la dernière journée : la saison ${this.seasonEnd.season} est terminée. Le bilan s’affiche en terminant la journée.`)
        : null,
      h(
        'div',
        { class: 'final-columns' },
        h(
          'section',
          {},
          h('h3', { class: 'sheet-section-title' }, `Autres combats de ${getLeagueName(playerLeagueId)}`),
          h('ul', { class: 'matchday-results' }, others.map(({ match }) => h(
            'li',
            {},
            h('span', { class: match.winnerId === match.teamAId ? 'is-winner' : '' }, name(match.teamAId)),
            h('span', { class: 'matchday-score' }, `${match.scoreA} – ${match.scoreB}`),
            h('span', { class: match.winnerId === match.teamBId ? 'is-winner' : '' }, name(match.teamBId)),
          ))),
          otherLeagues.length
            ? h('p', { class: 'muted' }, `${otherLeagues.map((id) => getLeagueName(id)).join(' et ')} : journée disputée, classements mis à jour.`)
            : null,
        ),
        h('section', {}, h('h3', { class: 'sheet-section-title' }, `${this.seasonEnd ? 'Classement final' : 'Classement'} — ${getLeagueName(playerLeagueId)}`), LeagueMiniTable(standings, { around: 3 })),
      ),
      h(
        'div',
        { class: 'match-actions' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.finishDay() }, 'Terminer la journée ▸'),
      ),
    );
  }

  finishDay() {
    const report = advanceDay(this.session);
    report.prepend(this.isQueen ? this.queenReport : buildPlayerResultEvent(this.session, this.event, this.results));
    this.navigate(this.isQueen ? SCREENS.TEAM : SCREENS.LEAGUE, autosaveDay({ services: this.services, session: this.session, report }));
  }
}
