import { h } from '../../utils/dom.js';
import { formatDateTime } from '../../utils/format.js';
import { SCREENS } from '../../core/screenIds.js';
import { advanceDay } from '../../systems/time/TimeSystem.js';
import { getDeniers } from '../../systems/economy/wallet.js';
import { getPendingMatchdayEvent } from '../../systems/match/MatchdayService.js';
import { getPendingQueenCombat } from '../../systems/queen/QueenCombatService.js';
import { calculateClubLevel } from '../../systems/fighters/ratings.js';
import { getStandings } from '../../systems/league/StandingsService.js';
import { getLeagueName } from '../../systems/league/LeagueService.js';
import { getSeasonProgress, isOffSeason } from '../../systems/league/SeasonService.js';
import { openSeasonCup } from '../../systems/frenchCup/FrenchCupManager.js';
import { ClubStars } from '../components/Rating.js';
import { LeagueMiniTable } from '../components/LeagueTable.js';
import { HUB_LOCATIONS } from '../hub/hubLocations.js';
import { BaseScreen } from './BaseScreen.js';
import { EmblemView } from '../components/EmblemView.js';
import { CalendarBar } from '../components/CalendarBar.js';
import { openLogbook } from '../components/LogbookModal.js';
import { autosaveDay } from '../hub/endOfDay.js';
import { alertModal, choiceModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { openChest } from '../components/ChestModal.js';
import { ITEM_USE_CONTEXTS } from '../../data/items.js';
import { listInventory } from '../../systems/inventory/InventoryService.js';
import { getTeamLocation } from '../../systems/geography/GeographyService.js';
import { travelThrough } from '../navigation/travel.js';
import { takeUnnotifiedReveals } from '../../systems/talents/StudyService.js';
import { openAchievements as openAchievementsModal } from '../components/AchievementsModal.js';
import { announcePendingAchievements } from '../hub/achievementNotifier.js';
import { countUnlocked } from '../../systems/achievements/AchievementService.js';

/**
 * Base des écrans de la phase de gestion : calendrier en haut, contenu au centre,
 * navigation entre les lieux à droite. Les sous-classes définissent :
 *   static hubLocationId  identifiant du lieu dans hubLocations.js
 *   renderContent()       contenu principal
 */
export class HubScreen extends BaseScreen {
  static theme = 'hub';
  static hubLocationId = null;

  render() {
    this.session = this.services.gameState.session;
    this.team = this.session.playerTeam;

    this.saveStatus = h('p', { class: 'save-status' });
    this.deniersEl = h('strong', { class: 'hub-deniers' });
    this.chestCountEl = h('span', { class: 'hub-nav-hint hub-chest-count' });
    this.achievementsCountEl = h('span', { class: 'hub-achievements-count' });
    this.clubLevelHost = h('div', { class: 'hub-club-level' });
    this.contentHost = h('div', { class: 'hub-content' }, this.renderContent());

    this.el = h(
      'section',
      { class: 'hub' },
      h('div', { class: 'bunting', 'aria-hidden': 'true' }),
      CalendarBar(this.session, {
        onAdvance: () => this.advanceDay(),
        onFight: () => this.navigate(SCREENS.MATCH),
        onGoToCup: () => this.goToCup(),
      }),
      h('div', { class: 'hub-body' }, this.contentHost, this.renderSidebar()),
    );
    this.refreshStatus();
    return this.el;
  }

  renderContent() {
    throw new Error(`${this.constructor.name}.renderContent() n'est pas implémenté.`);
  }

  /** Reconstruit le contenu principal (après une modification). */
  refreshContent() {
    this.contentHost.replaceChildren(this.renderContent());
    this.refreshStatus();
  }

  mounted() {
    // Études du Scriptorium terminées au chargement de la partie (sans journée jouée, donc sans
    // carnet de bord) : la révélation est annoncée une fois, sur le premier écran affiché.
    for (const reveal of takeUnnotifiedReveals(this.session)) {
      showToast(`Étude terminée : ${reveal.name} a révélé le talent ${reveal.talentName}.`, 'success');
    }
    // (Coupe de France de l'intersaison ouverte : les écrans du domaine renvoient vers elle,
    // ui/screens/registerScreens.js.)
    // Succès obtenus hors de l'écran (chargement d'une ancienne sauvegarde) : annoncés ici, une fois.
    announcePendingAchievements(this.session);
    if (this.params.dayReport) {
      openLogbook(this.session, this.params.dayReport, {
        onGoToCup: () => this.goToCup(),
        // Effets visuels de la journée : joués une fois le carnet refermé (sinon cachés par lui).
        onClose: () => this.afterLogbook(this.params.dayReport),
      });
    }
  }

  /** Après la fermeture du carnet de bord de la journée (effets visuels du lieu). */
  afterLogbook() {}

  /**
   * Emprunte une sortie de la carte (chemin, porte) vers un autre lieu : fondu, puis le lieu
   * d'arrivée (data/locations.js, ui/navigation/travel.js). Sortie fermée : simple message.
   */
  travel(exitId) {
    return travelThrough(this, exitId);
  }

  /**
   * « Aller en Coupe de France » (fin de saison) : ouvre la Coupe de la saison qui vient de finir
   * (ou la reprend) ; la nouvelle saison se lance ensuite depuis l'écran du vainqueur.
   */
  goToCup() {
    if (!isOffSeason(this.session)) return;
    openSeasonCup(this.session);
    if (this.services.settings.get('gameplay.autosave')) {
      try { this.services.saves.save(this.session); } catch { /* sauvegarde manuelle toujours possible */ }
    }
    this.navigate(SCREENS.FRENCH_CUP);
  }

  /** Fenêtre des succès ; le compteur de l'encart suit. */
  openAchievements() {
    openAchievementsModal(this.session, { onClose: () => this.refreshStatus() });
  }

  /** Terre (pastille à sa couleur) et lieu de la compagnie. */
  renderLocation() {
    const { land, location } = getTeamLocation(this.team);
    return h(
      'div',
      { class: 'hub-location', title: `${land.name} — ${location.name}` },
      h('span', { class: 'land-pill', style: { '--land-color': land.color } }, land.shortName),
      h('span', { class: 'hub-location-name' }, location.name),
    );
  }

  renderSidebar() {
    const activeId = this.constructor.hubLocationId;
    return h(
      'aside',
      { class: 'hub-sidebar' },
      h(
        'div',
        { class: 'hub-card hub-identity' },
        EmblemView(this.team.emblem, { size: 52, title: `Emblème de ${this.team.name}` }),
        h(
          'div',
          { class: 'hub-identity-text' },
          h('p', { class: 'hub-team-name' }, this.team.name),
          this.clubLevelHost,
        ),
        this.renderLocation(),
      ),
      h('div', { class: 'hub-card hub-treasury' }, h('span', { class: 'hub-treasury-label' }, 'Trésor'), this.deniersEl),
      // Le Coffre : inventaire (fenêtre), sans quitter l'écran ni toucher au déroulement de la journée.
      h('button', { type: 'button', class: 'hub-card hub-chest', onclick: () => this.openChest() },
        h('span', { class: 'hub-nav-icon', 'aria-hidden': 'true' }, '🧰'),
        h('span', { class: 'hub-nav-text' }, h('span', { class: 'hub-nav-label' }, 'Le Coffre'), this.chestCountEl)),
      // L'Almanach : la documentation du jeu ; « Retour » ramène à cet écran, partie intacte.
      h('button', { type: 'button', class: 'hub-card hub-chest hub-almanac', onclick: () => this.navigate(SCREENS.ALMANAC, { returnTo: this.id }) },
        h('span', { class: 'hub-nav-icon', 'aria-hidden': 'true' }, '📖'),
        h('span', { class: 'hub-nav-text' }, h('span', { class: 'hub-nav-label' }, 'L’Almanach'), h('span', { class: 'hub-nav-hint' }, 'Les règles du jeu'))),
      h(
        'nav',
        { class: 'hub-card hub-nav', 'aria-label': 'Lieux' },
        HUB_LOCATIONS.map((location) => h(
          'button',
          {
            type: 'button',
            class: `hub-nav-item ${location.id === activeId ? 'is-active' : ''}`.trim(),
            'aria-current': location.id === activeId ? 'page' : null,
            onclick: () => this.navigate(location.screen, location.params),
          },
          h('span', { class: 'hub-nav-icon', 'aria-hidden': 'true' }, location.icon),
          h('span', { class: 'hub-nav-text' }, h('span', { class: 'hub-nav-label' }, location.label), h('span', { class: 'hub-nav-hint' }, location.hint)),
        )),
      ),
      this.renderLeagueCard(),
      h(
        'div',
        { class: 'hub-card hub-actions' },
        this.saveStatus,
        // Succès (v0.73) : avancement, et la liste complète dans une fenêtre.
        h('button', { type: 'button', class: 'btn hub-achievements', onclick: () => this.openAchievements() },
          h('span', { 'aria-hidden': 'true' }, '🏅'), ' Succès ', this.achievementsCountEl),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.save() }, 'Sauvegarder'),
        h('button', { type: 'button', class: 'btn', onclick: () => this.backToMenu() }, 'Menu principal'),
      ),
    );
  }

  /** Encart « Ma ligue » : nom, position, points et extrait du classement. */
  renderLeagueCard() {
    const league = this.session.playerLeague;
    if (!league) return null;
    const rows = getStandings(this.session, league);
    const player = rows.find((row) => row.isPlayer);
    const progress = getSeasonProgress(this.session);
    // Les 5 premiers ; le club du joueur est ajouté s'il est plus loin.
    const top = rows.slice(0, 5);
    const excerpt = player && player.position > 5 ? [...top, player] : top;
    return h(
      'section',
      { class: 'hub-card hub-league', 'aria-label': 'Ma ligue' },
      h('p', { class: 'eyebrow' }, progress ? `Ma ligue · saison ${progress.season}` : 'Ma ligue'),
      h('p', { class: 'hub-league-name' }, getLeagueName(league)),
      player ? h('p', { class: 'hub-league-position' }, `${player.position}${player.position === 1 ? 're' : 'e'} sur ${rows.length} · ${player.points} pt${player.points > 1 ? 's' : ''}`) : null,
      progress ? h('p', { class: 'hub-league-progress' }, `Journée ${progress.played} / ${progress.total}`) : null,
      LeagueMiniTable(excerpt, { around: excerpt.length }),
      h(
        'div',
        { class: 'button-row' },
        h('button', { type: 'button', class: 'btn btn-sm', onclick: () => this.navigate(SCREENS.LEAGUE, { leagueId: league.id }) }, 'Classement complet'),
        h('button', { type: 'button', class: 'btn btn-sm btn-ghost', onclick: () => this.navigate(SCREENS.LEAGUE) }, 'Les 3 ligues'),
      ),
    );
  }

  refreshStatus() {
    this.clubLevelHost.replaceChildren(ClubStars(calculateClubLevel(this.session.playerFighters)));
    this.deniersEl.textContent = `${getDeniers(this.session)} deniers`;
    const items = listInventory(this.session);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const achieved = countUnlocked(this.session);
    this.achievementsCountEl.textContent = `(${achieved.unlocked} / ${achieved.total})`;
    this.chestCountEl.textContent = count ? `${count} objet${count > 1 ? 's' : ''} · ${items.map((item) => `${item.icon} ×${item.quantity}`).join(' ')}` : 'Vide';
    const { dirty, lastSavedAt } = this.session;
    this.saveStatus.classList.toggle('is-dirty', dirty);
    if (dirty) this.saveStatus.textContent = lastSavedAt ? 'Modifications non sauvegardées' : 'Partie non sauvegardée';
    else this.saveStatus.textContent = `Sauvegardée le ${formatDateTime(lastSavedAt)}`;
  }

  /**
   * Ouvre Le Coffre (hors combat). Après une utilisation ou une destruction, l'écran courant
   * est réaffiché à la fermeture (fatigue, effectif à jour) ; la journée n'est pas modifiée.
   */
  openChest() {
    openChest({
      session: this.session,
      context: ITEM_USE_CONTEXTS.OUTSIDE_COMBAT,
      onChange: () => this.refreshStatus(),
      onClose: (changed) => { if (changed) this.navigate(this.id); },
    });
  }

  advanceDay() {
    // Saison terminée : le temps ne reprend qu'avec la nouvelle saison.
    if (isOffSeason(this.session)) return;
    // Un jour de combat (championnat ou Combat de la Reine) se termine par le combat, jamais en passant.
    if (getPendingMatchdayEvent(this.session) || getPendingQueenCombat(this.session)) {
      this.navigate(SCREENS.MATCH);
      return;
    }
    const report = advanceDay(this.session);
    // Ré-affiche l'écran courant avec l'état à jour, puis le carnet de bord.
    this.navigate(this.id, autosaveDay({ services: this.services, session: this.session, report }));
  }

  save() {
    try {
      this.services.saves.save(this.session);
      this.refreshStatus();
      showToast('Partie sauvegardée.', 'success');
      return true;
    } catch (error) {
      alertModal('Sauvegarde impossible', error.message);
      return false;
    }
  }

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
      if (choice === 'save' && !this.save()) return;
      if (choice !== 'save' && choice !== 'discard') return;
    }
    this.services.gameState.clear();
    this.navigate(SCREENS.MAIN_MENU);
  }
}
