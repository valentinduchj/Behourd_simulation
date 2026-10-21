import { h } from '../../utils/dom.js';
import { TalentBadges } from '../components/TalentBadge.js';
import { SCREENS } from '../../core/screenIds.js';
import { FRENCH_CUP_RULES } from '../../data/frenchCup.js';
import {
  getCup, drawNext, drawAll, getCupStatus, getPlayerPendingMatch, getPendingSimulations, simulateStep, simulateToEnd,
  simulateMatch, advanceStep, describeStep, describeMatch, getStandings, opponentOf, pickAmbianceFighters, getTotalRewards,
  getSeasonCupState, playerHasMatchesLeft, abandonCup,
} from '../../systems/frenchCup/FrenchCupManager.js';
import { startNextSeason } from '../../systems/league/SeasonService.js';
import { getLeagueName } from '../../systems/league/LeagueService.js';
import { slotLabel } from '../../systems/frenchCup/CupDraw.js';
import { CUP_LEADERBOARDS, getLeaderboard } from '../../systems/frenchCup/CupStatistics.js';
import { getClubLevel } from '../../systems/league/LeagueService.js';
import { GABARNAC_LAYOUT } from '../../data/gabarnacLayout.js';
import { GabarnacScene } from '../../frenchCup/GabarnacScene.js';
import { CupBracketView, nextSlotKey } from '../components/CupBracket.js';
import { GabarnacRenderer } from '../../frenchCup/GabarnacRenderer.js';
import { BaseScreen } from './BaseScreen.js';
import { EmblemView } from '../components/EmblemView.js';
import { ClubStars } from '../components/Rating.js';
import { openModal, confirmModal, alertModal, choiceModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { currentLocale } from '../../i18n/i18n.js';
import { isMobileLayout } from '../mobile/mobileLayout.js';
import { attachMapZoom } from '../mobile/MapZoom.js';
import { CupHud, renderDrawMobile, renderGabarnacMobile, openBoardMobile } from '../mobile/MobileCup.js';

const HINT = 'Cliquez sur la Lice pour préparer votre prochain combat, ou sur le tableau de la Coupe pour voir les résultats.';

/**
 * La Coupe de France, au Château de Gabarnac : tirage au sort, puis la carte du château (Lice
 * cliquable → prochain combat ; tableau → bilan), le tableau final et le vainqueur.
 * Coupe de l'intersaison (v0.57.0) : ouverte depuis le bilan de fin de saison, bloquante jusqu'à
 * la nouvelle saison (« Commencer la nouvelle saison », écran du vainqueur). « Abandonner la
 * Coupe » tant que la compagnie a un combat à disputer ; sinon « Quitter la Coupe » dispute la
 * fin du tournoi d'un coup. « Sauvegarder » et « Menu principal » dans l'en-tête.
 * Toute la logique est dans systems/frenchCup/ ; cet écran affiche et transmet les choix.
 */
export class FrenchCupScreen extends BaseScreen {
  static theme = 'hub';

  render() {
    this.session = this.services.gameState.session;
    this.el = h('section', { class: 'screen screen-cup' });
    this.update();
    return this.el;
  }

  get cup() {
    return getCup(this.session);
  }

  name(teamId) {
    return this.session.getTeam(teamId)?.name ?? '?';
  }

  persist() {
    if (!this.services.settings.get('gameplay.autosave')) return;
    try { this.services.saves.save(this.session); } catch { /* sauvegarde manuelle toujours possible */ }
  }

  update() {
    this.stopMap();
    const cup = this.cup;
    const status = getCupStatus(cup);
    let body;
    // Seule la Coupe de l'intersaison (ouverte en fin de saison) se joue ici.
    const seasonCup = getSeasonCupState(this.session);
    // Téléphone (v0.90) : bandeau, tirage et carte du château propres au téléphone.
    const mobile = isMobileLayout();
    if (status === 'none' || (seasonCup !== 'inProgress' && seasonCup !== 'finished')) body = this.renderUnavailable();
    else if (status === 'draw') body = mobile ? renderDrawMobile(this) : this.renderDraw();
    else if (status === 'finished' && !this.showMap) body = this.renderWinner();
    else body = mobile ? renderGabarnacMobile(this, this.renderMapStage()) : this.renderGabarnac();
    this.el.classList.toggle('is-mobile-cup', mobile);
    this.el.replaceChildren(mobile ? CupHud(this) : this.renderHeader(), body);
    if (this.canvas && this.el.isConnected) this.startMap();
  }

  mounted() {
    if (this.canvas) this.startMap();
    this.resolvePendingStep();
  }

  unmount() {
    this.stopMap();
    super.unmount();
  }

  // --- En-tête ---

  renderHeader() {
    const cup = this.cup;
    const team = this.session.playerTeam;
    let status = null;
    if (cup && cup.step.stage !== 'draw') {
      const label = { active: 'En lice', eliminated: `Éliminée · ${cup.playerEliminatedAt}`, champion: 'Championne de France' }[cup.playerStatus];
      status = h('span', { class: `cup-player-status is-${cup.playerStatus}` }, label);
    }
    return h(
      'header',
      { class: 'cup-header panel' },
      h('div', { class: 'cup-header-title' },
        h('span', { class: 'cup-trophy', 'aria-hidden': 'true' }, '🏆'),
        h('div', {},
          h('p', { class: 'eyebrow' }, cup ? `${FRENCH_CUP_RULES.name} · édition ${cup.edition}` : FRENCH_CUP_RULES.name),
          h('h1', {}, FRENCH_CUP_RULES.venueName),
          cup ? h('p', { class: 'cup-step' }, describeStep(cup)) : null)),
      h('div', { class: 'cup-header-team' }, EmblemView(team.emblem, { size: 40, title: team.name }), h('strong', {}, team.name), status),
      h('div', { class: 'cup-header-actions' },
        cup?.bracket ? h('button', { type: 'button', class: 'btn btn-sm', onclick: () => this.openBoard('bracket') }, 'Arbre final') : null,
        cup && cup.step.stage !== 'draw' ? h('button', { type: 'button', class: 'btn btn-sm', onclick: () => this.openBoard() }, '📜 Tableau de la Coupe') : null,
        h('button', { type: 'button', class: 'btn btn-sm', onclick: () => this.save() }, 'Sauvegarder'),
        h('button', { type: 'button', class: 'btn btn-sm', onclick: () => this.backToMenu() }, 'Menu principal'),
        // Encore un combat à disputer : « Abandonner la Coupe » ; sinon « Quitter la Coupe »
        // (la fin du tournoi est disputée d'un coup, jusqu'au vainqueur).
        !cup || cup.step.stage === 'finished' ? null
          : playerHasMatchesLeft(cup)
            ? h('button', { type: 'button', class: 'btn btn-sm cup-quit cup-abandon', onclick: () => this.abandon() }, 'Abandonner la Coupe')
            : h('button', { type: 'button', class: 'btn btn-sm cup-quit', onclick: () => this.quit() }, 'Quitter la Coupe')),
    );
  }

  save() {
    try {
      this.services.saves.save(this.session);
      showToast('Partie sauvegardée.', 'success');
    } catch (error) {
      alertModal('Sauvegarde impossible', error.message);
    }
  }

  /** Menu principal (comme depuis le domaine) : sauvegarder ou non si la partie a changé. */
  async backToMenu() {
    if (this.session.dirty) {
      const choice = await choiceModal({
        title: 'Retour au menu principal',
        message: 'La partie n’est pas sauvegardée. Que souhaitez-vous faire ?',
        choices: [
          { label: 'Annuler', value: 'cancel' },
          { label: 'Quitter sans sauvegarder', value: 'discard', variant: 'danger' },
          { label: 'Sauvegarder et quitter', value: 'save', variant: 'primary' },
        ],
      });
      if (choice === 'cancel' || !choice) return;
      if (choice === 'save') {
        try { this.services.saves.save(this.session); } catch (error) { alertModal('Sauvegarde impossible', error.message); return; }
      }
    }
    this.services.gameState.clear();
    this.navigate(SCREENS.MAIN_MENU);
  }

  /** « Abandonner la Coupe » : forfait sur les combats restants, la Coupe continue sans la compagnie. */
  async abandon() {
    const ok = await confirmModal({
      title: 'Abandonner la Coupe',
      message: 'Abandonner la Coupe de France ? Vos combats restants seront perdus par forfait (0–2) et votre compagnie sera éliminée. Les deniers déjà gagnés restent acquis.',
      confirmLabel: 'Abandonner',
      danger: true,
    });
    if (!ok) return;
    abandonCup(this.session);
    // Le forfait a pu clore le tour en cours : l'étape suivante s'ouvre.
    if (getCupStatus(this.cup) === 'advance') advanceStep(this.session);
    this.persist();
    showToast('Votre compagnie a abandonné la Coupe de France.', 'warning');
    this.update();
  }

  /** « Quitter la Coupe » (plus aucun combat à disputer) : la fin du tournoi est disputée d'un coup. */
  async quit() {
    if (this.simulating) return;
    this.simulating = true;
    this.update();
    await simulateToEnd(this.session, { onProgress: (label, done, total) => { if (this.progressEl) this.progressEl.textContent = `${label} : ${done} / ${total} combats…`; } });
    this.simulating = false;
    this.showMap = false;
    this.persist();
    this.update();
  }

  /** Écran du vainqueur : « Commencer la nouvelle saison » (seule sortie de la Coupe de l'intersaison). */
  startNewSeason() {
    const event = startNextSeason(this.session);
    this.persist();
    showToast(`La saison ${event.season} commence en ${getLeagueName(event.leagueId)} : nouveau calendrier des rencontres.`, 'success');
    this.navigate(SCREENS.LEAGUE);
  }

  // --- Aucune Coupe ouverte (on n'y accède qu'en fin de saison) ---

  renderUnavailable() {
    return h(
      'div',
      { class: 'panel cup-welcome' },
      h('h2', { class: 'section-title' }, 'La Coupe de France'),
      h('p', {}, 'La Coupe de France se dispute à la fin de chaque saison : après le bilan de fin de saison, « Aller en Coupe de France » vous mène au Château de Gabarnac.'),
      h('div', { class: 'match-actions' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.navigate(SCREENS.TEAM) }, 'Retour au domaine')),
      this.session.frenchCupHistory?.length ? this.renderHistory(this.session.frenchCupHistory) : null,
    );
  }

  renderHistory(history) {
    return h(
      'section',
      { class: 'cup-history' },
      h('h3', { class: 'sheet-section-title' }, 'Palmarès'),
      h('ul', { class: 'cup-history-list' }, [...history].reverse().map((entry) => h(
        'li',
        {},
        h('strong', {}, `Édition ${entry.edition}`),
        h('span', {}, ` — ${entry.winnerName ?? this.name(entry.winnerId)}`),
        h('span', { class: 'muted' }, entry.playerStatus === 'champion' ? ' · votre compagnie championne !' : entry.playerEliminatedAt ? ` · votre compagnie : ${entry.playerEliminatedAt}` : ''),
      ))),
    );
  }


  // --- Tirage au sort ---

  renderDraw() {
    const cup = this.cup;
    const total = cup.draw.order.length;
    const last = this.lastDrawn;
    return h(
      'div',
      { class: 'panel cup-draw' },
      h('div', { class: 'cup-draw-head' },
        h('div', {},
          h('h2', { class: 'section-title' }, 'Tirage au sort'),
          h('p', { class: 'muted' }, `Sans tête de série ni chapeau : chaque compagnie tirée prend la prochaine place (A1, B1… I1, puis A2…). ${cup.draw.drawn} / ${total} compagnies tirées.`)),
        h('div', { class: 'cup-draw-actions' },
          h('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.drawOne() }, 'Tirer la prochaine équipe'),
          h('button', { type: 'button', class: 'btn', onclick: () => this.drawEverything() }, 'Tout tirer'))),
      last ? h('p', { class: 'cup-draw-last', role: 'status' }, EmblemView(this.session.getTeam(last.teamId).emblem, { size: 28 }), h('strong', {}, this.name(last.teamId)), ` rejoint la place ${last.slot}.`) : null,
      this.renderGroupsGrid({ highlight: last?.teamId }),
    );
  }

  drawOne() {
    this.lastDrawn = drawNext(this.session);
    this.persist();
    this.afterDraw();
  }

  drawEverything() {
    drawAll(this.session);
    this.lastDrawn = null;
    this.persist();
    this.afterDraw();
  }

  afterDraw() {
    const cup = this.cup;
    if (cup.draw.completed) showToast(`Tirage terminé : votre compagnie est dans la poule ${cup.playerGroup}.`, 'success');
    this.update();
  }

  /** Les 9 poules, places vides comprises (tirage) ou classements (phase de poules). */
  renderGroupsGrid({ highlight = null, standings = false } = {}) {
    const cup = this.cup;
    return h('div', { class: 'cup-groups' }, cup.groups.map((group, groupIndex) => {
      const rows = standings ? getStandings(this.session, group) : null;
      const qualified = new Set(cup.qualification?.qualified ?? []);
      return h(
        'section',
        { class: `cup-group ${group.id === cup.playerGroup ? 'is-player' : ''}`.trim(), 'data-group': group.id },
        h('h3', { class: 'cup-group-title' }, group.name),
        h('ol', { class: 'cup-group-slots' }, Array.from({ length: FRENCH_CUP_RULES.groupSize }, (_, position) => {
          const teamId = rows ? rows[position]?.teamId : group.teamIds[position];
          const slot = slotLabel(position * FRENCH_CUP_RULES.groupCount + groupIndex);
          if (!teamId) return h('li', { class: 'cup-slot is-empty' }, h('span', { class: 'cup-slot-id' }, slot), h('span', { class: 'muted' }, '—'));
          const row = rows?.[position];
          const classes = ['cup-slot', teamId === cup.playerTeamId ? 'is-player' : '', teamId === highlight ? 'is-new' : '',
            cup.qualification ? (qualified.has(teamId) ? 'is-qualified' : 'is-out') : ''].filter(Boolean).join(' ');
          return h(
            'li',
            { class: classes, 'data-team-id': teamId },
            h('span', { class: 'cup-slot-id' }, rows ? `${position + 1}` : slot),
            EmblemView(this.session.getTeam(teamId).emblem, { size: 20 }),
            h('span', { class: 'cup-slot-name', title: this.name(teamId) }, this.name(teamId)),
            row ? h('span', { class: 'cup-slot-pts' }, `${row.points} pt${row.points > 1 ? 's' : ''}`) : null,
          );
        })),
      );
    }));
  }

  // --- Château de Gabarnac ---

  /** La carte du château (scène, canevas, aide), partagée par l'ordinateur et le téléphone. */
  renderMapStage() {
    // Combattants d'ambiance : un par compagnie engagée (tabards aux couleurs de leur club).
    const fighters = pickAmbianceFighters(this.session, GABARNAC_LAYOUT.fighterSpots.length);
    this.scene = new GabarnacScene({ fighters });
    this.canvas = h('canvas', { class: 'centre-canvas cup-canvas', 'aria-label': 'Le Château de Gabarnac en vue isométrique' });
    this.hint = h('p', { class: 'centre-hint', role: 'status' }, HINT);
    return h('div', { class: 'cup-map' }, h('div', { class: 'centre-stage cup-stage' }, this.canvas), this.hint);
  }

  renderGabarnac() {
    return h(
      'div',
      { class: 'cup-body' },
      this.renderMapStage(),
      h('aside', { class: 'cup-side' }, this.renderNextCard(), this.renderSideStandings(), this.renderPath()),
    );
  }

  /** Carte « Prochain combat » (ou état de la Coupe pour le joueur). */
  renderNextCard() {
    const cup = this.cup;
    const status = getCupStatus(cup);
    const match = getPlayerPendingMatch(cup);
    if (this.simulating) {
      return h('section', { class: 'cup-card cup-next is-busy' },
        h('h2', { class: 'cup-card-title' }, 'Les combats se disputent…'),
        this.progressEl = h('p', { class: 'muted', role: 'status' }, 'Les autres compagnies entrent dans la Lice.'));
    }
    if (match) {
      const opponentId = opponentOf(cup, match);
      const opponent = this.session.getTeam(opponentId);
      return h(
        'section',
        { class: 'cup-card cup-next' },
        h('p', { class: 'eyebrow' }, 'Prochain combat'),
        h('h2', { class: 'cup-card-title' }, describeMatch(cup, match)),
        h('div', { class: 'cup-versus' },
          EmblemView(this.session.playerTeam.emblem, { size: 44, title: this.session.playerTeam.name }),
          h('span', { class: 'cup-vs' }, 'VS'),
          EmblemView(opponent.emblem, { size: 44, title: opponent.name })),
        h('p', { class: 'cup-opponent' }, h('strong', {}, opponent.name), ClubStars(getClubLevel(this.session, opponentId))),
        h('button', { type: 'button', class: 'btn btn-fight', onclick: () => this.enterLice() }, '⚔ Entrer dans la Lice'),
      );
    }
    if (status === 'finished') {
      return h('section', { class: 'cup-card cup-next' },
        h('p', { class: 'eyebrow' }, 'Coupe terminée'),
        h('h2', { class: 'cup-card-title' }, `${this.name(cup.winnerId)}, Champion de France`),
        h('div', { class: 'match-actions' },
          h('button', { type: 'button', class: 'btn', onclick: () => { this.showMap = false; this.update(); } }, 'Voir le vainqueur'),
          h('button', { type: 'button', class: 'btn btn-primary cup-new-season', onclick: () => this.startNewSeason() }, 'Commencer la nouvelle saison ▸')));
    }
    // Phase de poules (abandon) : la journée suivante se dispute d'un coup ; tableau : l'arbre animé.
    const watch = h('button', {
      type: 'button', class: 'btn btn-primary cup-watch',
      onclick: () => (cup.step.stage === 'groups' ? this.runStep() : this.openSpectator({ autoStart: true })),
    }, 'Assister aux prochains combats');
    // Encore en lice : les autres combats du tour attendent avant le tour suivant.
    if (cup.playerStatus === 'active') {
      return h('section', { class: 'cup-card cup-next' },
        h('p', { class: 'eyebrow' }, describeStep(cup)),
        h('h2', { class: 'cup-card-title' }, 'Les autres combats du tour'),
        h('p', { class: 'muted' }, 'Votre combat est joué. Suivez les autres affiches dans l’arbre final avant le tour suivant.'),
        h('div', { class: 'match-actions' }, watch));
    }
    // Joueur éliminé : il peut suivre la suite du tournoi, tour par tour, jusqu'au vainqueur.
    return h(
      'section',
      { class: 'cup-card cup-next' },
      h('p', { class: 'eyebrow' }, 'Votre parcours est terminé'),
      h('h2', { class: 'cup-card-title' }, `Éliminée · ${cup.playerEliminatedAt}`),
      h('p', { class: 'muted' }, `Les autres compagnies poursuivent la Coupe. Prochain tour : ${describeStep(cup)}.`),
      h('div', { class: 'match-actions' }, watch),
    );
  }

  /** Classement de la poule du joueur (phase de poules) ou tour en cours (tableau). */
  renderSideStandings() {
    const cup = this.cup;
    if (cup.step.stage === 'groups' || !cup.bracket) {
      const group = cup.groups.find((g) => g.id === cup.playerGroup);
      if (!group) return null;
      const rows = getStandings(this.session, group);
      return h('section', { class: 'cup-card' },
        h('h3', { class: 'cup-card-title' }, `Ma poule · ${group.name}`),
        this.standingsTable(rows, { compact: true }),
        h('p', { class: 'muted cup-rule' }, `Les ${FRENCH_CUP_RULES.qualifiersPerGroup} premiers sont qualifiés, ainsi que les ${FRENCH_CUP_RULES.extraQualifiers.count} meilleurs ${FRENCH_CUP_RULES.extraQualifiers.rank}es.`));
    }
    const round = cup.bracket.rounds[Math.min(cup.step.round ?? cup.bracket.rounds.length - 1, cup.bracket.rounds.length - 1)];
    return h('section', { class: 'cup-card' },
      h('h3', { class: 'cup-card-title' }, round.name),
      h('ul', { class: 'cup-round-list' }, round.matches.map((match) => this.matchLine(match))));
  }

  /** Parcours du joueur dans la Coupe. */
  renderPath() {
    const cup = this.cup;
    if (!cup.playerPath.length) return null;
    return h('section', { class: 'cup-card' },
      h('h3', { class: 'cup-card-title' }, 'Mon parcours'),
      h('ol', { class: 'cup-path' }, cup.playerPath.map((entry) => h(
        'li',
        { class: entry.won ? 'is-win' : 'is-loss' },
        h('span', { class: 'cup-path-label' }, entry.label),
        h('span', {}, `${entry.forfeit ? 'Forfait' : entry.won ? 'Victoire' : 'Défaite'} ${entry.roundsWon} – ${entry.roundsLost} contre ${this.name(entry.opponentId)}`),
        cup.rewards?.[entry.matchId] ? h('span', { class: 'cup-path-reward' }, ` · +${cup.rewards[entry.matchId].toLocaleString(currentLocale())} deniers`) : null,
      ))),
      getTotalRewards(cup) ? h('p', { class: 'muted cup-rule' }, `Récompenses gagnées : ${getTotalRewards(cup).toLocaleString(currentLocale())} deniers`) : null);
  }

  standingsTable(rows, { compact = false } = {}) {
    const cup = this.cup;
    const qualified = new Set(cup.qualification?.qualified ?? []);
    return h('table', { class: `assign-table cup-standings ${compact ? 'is-compact' : ''}`.trim() },
      h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Compagnie'), h('th', { class: 'num' }, 'J'), h('th', { class: 'num' }, 'Pts'),
        h('th', { class: 'num', title: 'Manches remportées' }, 'M'), h('th', { class: 'num', title: 'Adversaires mis KO' }, 'KO'))),
      h('tbody', {}, rows.map((row) => h(
        'tr',
        { class: [row.teamId === cup.playerTeamId ? 'is-player' : '', cup.qualification ? (qualified.has(row.teamId) ? 'is-qualified' : 'is-out') : (row.position <= FRENCH_CUP_RULES.qualifiersPerGroup ? 'is-zone' : '')].filter(Boolean).join(' ') },
        h('td', {}, String(row.position)),
        h('td', {}, h('span', { class: 'cup-team-cell' }, EmblemView(this.session.getTeam(row.teamId).emblem, { size: 18 }), this.name(row.teamId))),
        h('td', { class: 'num' }, String(row.played)),
        h('td', { class: 'num' }, h('strong', {}, String(row.points))),
        h('td', { class: 'num' }, String(row.roundsWon)),
        h('td', { class: 'num' }, String(row.knockouts)),
      ))));
  }

  /** Une affiche : « Équipe A 2 – 1 Équipe B » (vainqueur en gras). */
  matchLine(match) {
    const cup = this.cup;
    const side = (teamId) => (teamId
      ? h('span', { class: `cup-line-team ${match.winnerId === teamId ? 'is-winner' : ''} ${teamId === cup.playerTeamId ? 'is-player' : ''}`.replace(/\s+/g, ' ').trim() },
        EmblemView(this.session.getTeam(teamId).emblem, { size: 18 }), this.name(teamId))
      : h('span', { class: 'cup-line-team muted' }, 'à déterminer'));
    return h('li', { class: 'cup-line', 'data-match-id': match.id },
      side(match.teamAId),
      h('span', { class: 'cup-line-score' }, match.status === 'played' ? `${match.roundsWonA} – ${match.roundsWonB}` : 'VS'),
      side(match.teamBId));
  }

  // --- La carte : Lice et tableau cliquables ---

  startMap() {
    if (!this.canvas || this.renderer) return;
    this.renderer = new GabarnacRenderer(this.canvas, this.scene);
    // Téléphone (v0.91) : pincer pour zoomer, glisser pour se déplacer sur le château.
    if (isMobileLayout() && !this.mapZoom?.button.isConnected) this.mapZoom = attachMapZoom(this.canvas, () => this.renderer);
    const cup = this.cup;
    const pending = getPlayerPendingMatch(cup);
    this.renderer.liceReady = Boolean(pending) && !this.simulating;
    this.renderer.labels.lice.detail = pending ? `Prochain combat · ${describeMatch(cup, pending)}` : 'Aucun combat à disputer';
    this.renderer.resize();
    const on = (target, type, handler) => {
      target.addEventListener(type, handler);
      this.mapCleanups.push(() => target.removeEventListener(type, handler));
    };
    this.mapCleanups = this.mapCleanups ?? [];
    on(window, 'resize', () => this.renderer?.resize());
    on(this.canvas, 'mousemove', (event) => {
      const tile = this.renderer.pickTile(event.clientX, event.clientY);
      const target = tile ? this.scene.targetAt(tile.x, tile.y) : null;
      this.renderer.hoverTarget = target;
      this.canvas.style.cursor = target ? 'pointer' : 'default';
      this.hint.textContent = target === 'lice'
        ? (getPlayerPendingMatch(this.cup) ? 'La Lice — cliquez pour préparer votre prochain combat.' : 'La Lice — aucun combat ne vous attend.')
        : target === 'board' ? 'Le tableau de la Coupe — cliquez pour voir résultats, poules et meilleurs combattants.' : HINT;
    });
    on(this.canvas, 'mouseleave', () => { this.renderer.hoverTarget = null; this.hint.textContent = HINT; });
    on(this.canvas, 'click', (event) => {
      const tile = this.renderer.pickTile(event.clientX, event.clientY);
      const target = tile ? this.scene.targetAt(tile.x, tile.y) : null;
      if (target === 'lice') this.enterLice();
      else if (target === 'board') this.openBoard();
    });
    // Animation à intervalle fixe (vignes, habitants) : fonctionne aussi hors requestAnimationFrame.
    const start = performance.now();
    const frame = () => {
      if (!document.hidden) this.renderer?.render((performance.now() - start) / 1000);
      this.frameTimer = setTimeout(frame, 1000 / 30);
    };
    frame();
  }

  stopMap() {
    clearTimeout(this.frameTimer);
    for (const cleanup of (this.mapCleanups ?? []).splice(0)) cleanup();
    this.renderer = null;
  }

  enterLice() {
    const match = getPlayerPendingMatch(this.cup);
    if (!match || this.simulating) {
      showToast('Aucun combat ne vous attend dans la Lice pour l’instant.', 'info');
      return;
    }
    this.navigate(SCREENS.MATCH, { cupMatchId: match.id });
  }

  // --- Simulation des autres combats ---

  /**
   * En arrivant : si le combat du joueur de l'étape est joué, les autres combats se disputent
   * aussitôt (moteur de combat), puis l'étape suivante s'ouvre.
   */
  async resolvePendingStep() {
    const cup = this.cup;
    const status = getCupStatus(cup);
    if (status === 'advance') {
      advanceStep(this.session);
      this.persist();
      this.update();
      return;
    }
    if (status !== 'simulate' || cup.playerStatus !== 'active') return;
    // Poules : les autres combats de la journée se disputent aussitôt ; tableau final : on les
    // suit dans l'arbre, affiche après affiche.
    if (cup.step.stage === 'knockout') this.openSpectator({ autoStart: true });
    else await this.runStep();
  }

  async runStep() {
    if (this.simulating) return;
    const cup = this.cup;
    const before = { label: describeStep(cup), status: cup.playerStatus };
    this.simulating = true;
    this.update();
    const total = getPendingSimulations(cup).length;
    await simulateStep(this.session, { onProgress: (done) => { if (this.progressEl) this.progressEl.textContent = `${done} / ${total} combats disputés…`; } });
    this.simulating = false;
    this.persist();
    this.update();
    this.announce(before);
  }

  // --- Assister aux prochains combats : l'arbre final animé ---

  /**
   * Fenêtre de l'arbre final où l'on suit le tour en cours : chaque combat restant se dispute
   * (moteur de combat, résultat enregistré dans la Coupe), puis s'affiche pas à pas — score
   * manche après manche, vainqueur, déplacement vers sa place du tour suivant. Le tour fini,
   * on passe au suivant, jusqu'au vainqueur. Rouvrir la fenêtre ne rejoue aucun résultat.
   */
  openSpectator({ autoStart = false } = {}) {
    if (this.spectator) return;
    const view = new CupBracketView({ session: this.session, cup: this.cup });
    const status = h('p', { class: 'cup-spectator-status', role: 'status' });
    const controls = h('div', { class: 'match-actions cup-spectator-controls' });
    const wrap = h('div', { class: 'cup-spectator' }, status, h('div', { class: 'cup-tree-wrap' }, view.el), controls);
    const spectator = { view, status, controls, wrap, running: false, speed: 1, skip: false, closed: false };
    this.spectator = spectator;
    spectator.modal = openModal({
      title: '🏆 Coupe de France — arbre final', body: wrap, className: 'modal-wide cup-bracket-modal',
      actions: [{ label: 'Fermer', variant: 'primary' }],
      onClose: () => {
        spectator.closed = true;
        this.spectator = null;
        this.persist();
        this.update();
      },
    });
    this.refreshSpectator();
    if (autoStart) this.watchRound();
    else setTimeout(() => { if (!spectator.closed && !spectator.running) view.celebratePlayerAdvance(); }, 320);
  }

  /** Texte et boutons de la fenêtre selon l'état réel de la Coupe. */
  refreshSpectator() {
    const sp = this.spectator;
    if (!sp) return;
    const cup = this.cup;
    const button = (label, onclick, cls = 'btn') => h('button', { type: 'button', class: cls, onclick }, label);
    let buttons = [];
    if (sp.running) {
      sp.status.textContent = `${describeStep(cup)} : les combats se disputent…`;
      buttons = [
        button(sp.speed > 1 ? 'Rythme normal' : 'Accélérer ×3', () => { sp.speed = sp.speed > 1 ? 1 : 3; this.refreshSpectator(); }),
        button('Passer l’animation', () => { sp.skip = true; }),
      ];
    } else if (cup.step.stage === 'finished') {
      sp.status.textContent = `${this.name(cup.winnerId)} remporte la Coupe de France !`;
      buttons = [button('Voir le vainqueur ▸', () => { this.showMap = false; sp.modal.close(); }, 'btn btn-primary')];
    } else if (getPlayerPendingMatch(cup)) {
      sp.status.textContent = `${describeStep(cup)} : votre compagnie est attendue dans la Lice.`;
      buttons = [button('Retour au Château ▸', () => sp.modal.close(), 'btn btn-primary')];
    } else if (cup.step.stage === 'knockout') {
      const pending = getPendingSimulations(cup).length;
      sp.status.textContent = pending ? `Prochain tour : ${describeStep(cup)} (${pending} combat${pending > 1 ? 's' : ''}).` : describeStep(cup);
      buttons = [button(`Assister aux ${describeStep(cup).toLowerCase()} ▸`, () => this.watchRound(), 'btn btn-primary')];
    }
    sp.controls.replaceChildren(...buttons);
  }

  /** Attente rythmée (raccourcie en accéléré, nulle si l'on passe l'animation ou ferme la fenêtre). */
  pause(ms) {
    const sp = this.spectator;
    if (!sp || sp.skip || sp.closed) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms / sp.speed));
  }

  /** Dispute et montre, un par un, les combats restants du tour en cours, puis ouvre le tour suivant. */
  async watchRound() {
    const sp = this.spectator;
    if (!sp || sp.running || this.cup.step.stage !== 'knockout') return;
    sp.running = true;
    sp.skip = false;
    this.refreshSpectator();
    const cup = this.cup;
    for (const match of getPendingSimulations(cup)) {
      if (sp.closed) break;
      await this.showMatch(match);
    }
    if (!sp.closed && !getPendingSimulations(cup).length) {
      advanceStep(this.session);
      sp.view.update();
    }
    this.persist();
    sp.running = false;
    this.refreshSpectator();
  }

  /**
   * Un combat du tableau : résultat calculé et enregistré d'abord (source unique), puis dévoilé
   * — score manche par manche (d'après les manches enregistrées), vainqueur mis en évidence, et
   * son blason qui rejoint sa place au tour suivant.
   */
  async showMatch(match) {
    const sp = this.spectator;
    const { view } = sp;
    const target = nextSlotKey(this.cup.bracket, match);
    view.hiddenScores.add(match.id);
    view.hiddenSlots.add(target);
    simulateMatch(this.session, match);
    view.update();
    const el = view.matchEl(match.id);
    el?.classList.add('is-live');
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const scoreA = el?.querySelector('[data-score="A"]');
    const scoreB = el?.querySelector('[data-score="B"]');
    const score = { A: 0, B: 0 };
    const showScore = () => { if (scoreA) scoreA.textContent = String(score.A); if (scoreB) scoreB.textContent = String(score.B); };
    showScore();
    sp.status.textContent = `${describeMatch(this.cup, match)} : ${this.name(match.teamAId)} contre ${this.name(match.teamBId)}`;
    for (const side of match.roundWinners ?? []) {
      await this.pause(750);
      score[side] += 1;
      showScore();
    }
    await this.pause(450);
    const winnerKey = match.winnerId === match.teamAId ? 'A' : 'B';
    const loserKey = winnerKey === 'A' ? 'B' : 'A';
    el?.querySelector(`[data-slot="${match.round}:${match.slot}:${winnerKey}"]`)?.classList.add('is-winner');
    el?.querySelector(`[data-slot="${match.round}:${match.slot}:${loserKey}"]`)?.classList.add('is-loser');
    await this.pause(500);
    await this.flyWinner(match, winnerKey, target);
    view.hiddenScores.delete(match.id);
    view.hiddenSlots.delete(target);
    view.update();
    view.slotEl(target)?.classList.add('is-arrived');
    await this.pause(350);
  }

  /** Le blason du vainqueur glisse de son combat jusqu'à sa place du tour suivant. */
  async flyWinner(match, winnerKey, target) {
    const sp = this.spectator;
    if (!sp || sp.skip || sp.closed) return;
    const from = sp.view.el.querySelector(`[data-slot="${match.round}:${match.slot}:${winnerKey}"] .cup-tree-circle`);
    const to = sp.view.slotEl(target);
    const host = sp.view.el;
    if (!from || !to) return;
    const hostRect = host.getBoundingClientRect();
    const a = from.getBoundingClientRect();
    const b = (to.querySelector('.cup-tree-circle') ?? to).getBoundingClientRect();
    const token = from.cloneNode(true);
    token.classList.add('cup-tree-token');
    // L'arbre (positionné) défile dans son cadre : les positions se comptent depuis son coin.
    Object.assign(token.style, { left: `${a.left - hostRect.left}px`, top: `${a.top - hostRect.top}px` });
    host.append(token);
    const duration = 900 / sp.speed;
    token.style.transition = `transform ${duration}ms cubic-bezier(0.45, 0, 0.25, 1)`;
    // La position de départ est posée (reflow) avant le déplacement.
    token.getBoundingClientRect();
    await new Promise((resolve) => setTimeout(resolve, 20));
    token.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(1.15)`;
    await this.pause(900);
    token.remove();
  }

  /** Annonce d'une étape terminée : qualification, élimination, tour suivant. */
  announce(before) {
    const cup = this.cup;
    if (before.status === 'active' && cup.playerStatus === 'eliminated') {
      showToast(`Votre compagnie est éliminée (${cup.playerEliminatedAt}).`, 'warning');
    } else if (before.label !== describeStep(cup)) {
      const qualifiedNow = cup.step.stage === 'knockout' && cup.step.round === 0 && cup.playerStatus === 'active';
      showToast(qualifiedNow ? `Qualifiée pour les ${FRENCH_CUP_RULES.knockoutRounds[0].toLowerCase()} !` : `${before.label} : tous les combats sont joués.`, 'success');
    }
    if (cup.step.stage === 'finished') {
      this.showMap = false;
      this.update();
    }
  }

  // --- Tableau de la Coupe (bilan) ---

  openBoard(tab = 'results') {
    // Téléphone (v0.90) : un volet, rubriques à gauche, poules en onglets, arbre final au pouce.
    if (isMobileLayout()) return openBoardMobile(this, tab);
    const body = h('div', { class: 'cup-board' });
    const tabs = [['results', 'Résultats'], ['groups', 'Poules'], ['bracket', 'Arbre final'], ['qualified', 'Qualifiés'], ['fighters', 'Meilleurs combattants']];
    const render = (current) => {
      body.replaceChildren(
        h('div', { class: 'cup-tabs', role: 'tablist' }, tabs.map(([id, label]) => h('button', {
          type: 'button', role: 'tab', class: `cup-tab ${id === current ? 'is-active' : ''}`.trim(), 'aria-selected': String(id === current),
          onclick: () => render(id),
        }, label))),
        {
          results: () => this.boardResults(),
          groups: () => this.renderGroupsGrid({ standings: true }),
          // Arbre final : lu dans l'état réel de la Coupe à chaque ouverture.
          bracket: () => {
            const view = new CupBracketView({ session: this.session, cup: this.cup });
            // Qualification pas encore vue : le blason de la compagnie avance dans l'arbre.
            setTimeout(() => view.celebratePlayerAdvance(), 320);
            return h('div', { class: 'cup-tree-wrap' }, view.el);
          },
          qualified: () => this.boardQualified(),
          fighters: () => this.boardFighters(),
        }[current](),
      );
    };
    render(tab);
    openModal({ title: `📜 Tableau de la Coupe — édition ${this.cup.edition}`, body, className: 'modal-wide cup-board-modal', actions: [{ label: 'Fermer', variant: 'primary' }] });
  }

  /** Résultats : chaque journée de poules et chaque tour joués (combats du joueur en évidence). */
  boardResults() {
    const cup = this.cup;
    const sections = [];
    const rounds = cup.bracket ? [...cup.bracket.rounds].reverse() : [];
    for (const round of rounds) {
      const played = round.matches.filter((m) => m.status === 'played');
      if (played.length) sections.push(h('section', {}, h('h3', { class: 'sheet-section-title' }, round.name), h('ul', { class: 'cup-round-list' }, played.map((m) => this.matchLine(m)))));
    }
    for (let day = FRENCH_CUP_RULES.groupSize - 1; day >= 1; day--) {
      const played = cup.groups.flatMap((g) => g.matches.filter((m) => m.matchday === day && m.status === 'played'));
      if (!played.length) continue;
      sections.push(h('section', {}, h('h3', { class: 'sheet-section-title' }, `Poules · journée ${day}`),
        h('ul', { class: 'cup-round-list is-columns' }, played.map((m) => this.matchLine(m)))));
    }
    return sections.length ? h('div', { class: 'cup-results' }, sections) : h('p', { class: 'empty-state' }, 'Aucun combat n’a encore été disputé.');
  }

  boardQualified() {
    const cup = this.cup;
    if (!cup.qualification) {
      return h('p', { class: 'empty-state' }, `La qualification sera connue à la fin des poules : les ${FRENCH_CUP_RULES.qualifiersPerGroup} premiers de chaque poule et les ${FRENCH_CUP_RULES.extraQualifiers.count} meilleurs ${FRENCH_CUP_RULES.extraQualifiers.rank}es.`);
    }
    const chip = (teamId) => h('li', { class: `cup-chip ${teamId === cup.playerTeamId ? 'is-player' : ''}`.trim() }, EmblemView(this.session.getTeam(teamId).emblem, { size: 18 }), this.name(teamId));
    const extra = new Set(cup.qualification.extra);
    return h('div', { class: 'cup-qualified' },
      h('h3', { class: 'sheet-section-title' }, `Qualifiés (${cup.qualification.qualified.length})`),
      h('ul', { class: 'cup-chips' }, cup.qualification.qualified.filter((id) => !extra.has(id)).map(chip)),
      h('h3', { class: 'sheet-section-title' }, `Meilleurs ${FRENCH_CUP_RULES.extraQualifiers.rank}es (${extra.size})`),
      h('ul', { class: 'cup-chips' }, cup.qualification.extra.map(chip)),
      h('h3', { class: 'sheet-section-title' }, `Éliminés en poules (${cup.qualification.eliminated.length})`),
      h('ul', { class: 'cup-chips is-out' }, cup.qualification.eliminated.map(chip)));
  }

  boardFighters() {
    const cup = this.cup;
    return h('div', { class: 'cup-leaders' }, CUP_LEADERBOARDS.map((board) => {
      const rows = getLeaderboard(cup, board, 5);
      return h('section', { class: 'cup-leader-card' },
        h('h3', { class: 'sheet-section-title' }, board.label),
        rows.length
          ? h('ol', { class: 'cup-leader-list' }, rows.map((row) => h('li', { class: row.teamId === cup.playerTeamId ? 'is-player' : '' },
            EmblemView(this.session.getTeam(row.teamId)?.emblem, { size: 18 }),
            h('span', { class: 'cup-leader-name' }, row.name ?? this.session.getFighter(row.fighterId)?.name ?? '?',
              // v1.2.1 : talents du combattant (clubs de l'IA compris).
              this.session.getFighter(row.fighterId)?.talents?.length ? h('span', { class: 'cup-leader-talents' }, ...TalentBadges(this.session.getFighter(row.fighterId), this.session)) : null,
              h('small', {}, this.name(row.teamId))),
            h('strong', {}, String(row.value), h('small', { class: 'cup-leader-matches' }, ` · ${row.matchesPlayed} combat${row.matchesPlayed > 1 ? 's' : ''}`)))))
          : h('p', { class: 'muted' }, 'Pas encore de données.'),
        h('p', { class: 'muted cup-leader-unit' }, `${board.unit}, sur toute la Coupe`));
    }));
  }

  // --- Vainqueur ---

  renderWinner() {
    const cup = this.cup;
    const winner = this.session.getTeam(cup.winnerId);
    const final = cup.bracket.rounds[cup.bracket.rounds.length - 1].matches[0];
    const finalistId = final.winnerId === final.teamAId ? final.teamBId : final.teamAId;
    const playerWon = cup.playerStatus === 'champion';
    return h(
      'div',
      { class: `panel cup-winner ${playerWon ? 'is-player' : ''}`.trim() },
      h('p', { class: 'cup-winner-eyebrow' }, 'COUPE DE FRANCE'),
      h('p', { class: 'cup-winner-title' }, 'VAINQUEUR'),
      h('div', { class: 'cup-winner-emblem' }, EmblemView(winner.emblem, { size: 140, title: winner.name })),
      h('h2', { class: 'cup-winner-name' }, winner.name),
      h('p', { class: 'cup-winner-sub' }, 'Champion de France'),
      h('p', { class: 'muted' }, `Finale : ${winner.name} ${Math.max(final.roundsWonA, final.roundsWonB)} – ${Math.min(final.roundsWonA, final.roundsWonB)} ${this.name(finalistId)}`),
      playerWon
        ? h('p', { class: 'cup-winner-note' }, 'Votre compagnie remporte la Coupe de France !')
        : h('p', { class: 'cup-winner-note' }, `Votre compagnie : ${cup.playerEliminatedAt ?? '—'}`),
      getTotalRewards(cup) ? h('p', { class: 'muted' }, `Récompenses de la Coupe : ${getTotalRewards(cup).toLocaleString(currentLocale())} deniers`) : null,
      h('div', { class: 'match-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => this.openBoard('bracket') }, 'Arbre final'),
        h('button', { type: 'button', class: 'btn', onclick: () => this.openBoard('fighters') }, 'Meilleurs combattants'),
        h('button', { type: 'button', class: 'btn', onclick: () => { this.showMap = true; this.update(); } }, 'Revoir le Château'),
        h('button', { type: 'button', class: 'btn btn-primary cup-new-season', onclick: () => this.startNewSeason() }, 'Commencer la nouvelle saison ▸')),
    );
  }
}
