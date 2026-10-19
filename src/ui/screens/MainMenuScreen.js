import { h } from '../../utils/dom.js';
import { SCREENS } from '../../core/screenIds.js';
import { createRandomEmblem } from '../../systems/game/teamFactory.js';
import { BaseScreen } from './BaseScreen.js';
import { EmblemView } from '../components/EmblemView.js';
import { alertModal, confirmModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { openPatchNotes } from '../components/PatchNotesModal.js';
import { MainMenuShowcase } from '../mainMenu/MainMenuShowcase.js';
import { LanguagePicker } from '../components/LanguagePicker.js';
import { isMobileLayout } from '../mobile/mobileLayout.js';

// Emblème du jeu (v0.78) : partition et trois couleurs tirées au hasard à chaque ouverture de la
// page (chargement du module), le même tirage que les clubs ; il ne change plus ensuite.
export const MENU_EMBLEM = createRandomEmblem(Math.random);

/** Le système demande-t-il moins d'animations ? */
function prefersReducedMotion() {
  try {
    return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

/**
 * Écran principal : menu au centre ; de chaque côté, la vitrine du jeu (séquences de camp,
 * Taverne, combats et Bourg, ui/mainMenu/). Le module Admin s'ouvre depuis Options › Administration.
 */
/** Titre du jeu : le premier mot en grand (« Béhourd »), la suite dessous (« Management »). */
export function GameTitle(title) {
  const at = title.indexOf(' ');
  if (at < 0) return h('h1', { class: 'game-title' }, title);
  return h('h1', { class: 'game-title', 'aria-label': title },
    h('span', { class: 'game-title-main' }, title.slice(0, at)),
    h('span', { class: 'game-title-tag' }, title.slice(at + 1)));
}

export class MainMenuScreen extends BaseScreen {
  render() {
    if (isMobileLayout()) return this.renderMobile();
    const { config } = this.services;
    const items = [
      { label: 'Jouer', primary: true, action: () => this.navigate(SCREENS.NEW_GAME) },
      { label: 'Charger', action: () => this.openLoad() },
      { label: 'Options', action: () => this.navigate(SCREENS.OPTIONS) },
      { label: 'Quitter le jeu', action: () => this.quit() },
    ];

    this.showcasePanels = {
      left: h('div', { class: 'menu-showcase is-left', 'aria-hidden': 'true' }),
      right: h('div', { class: 'menu-showcase is-right', 'aria-hidden': 'true' }),
    };
    this.el = h(
      'section',
      { class: 'screen screen-main-menu' },
      this.showcasePanels.left,
      this.showcasePanels.right,
      // Langue (v0.79) : en haut à droite ; l'écran se redessine dans la langue choisie.
      LanguagePicker({ onChange: () => this.navigate(SCREENS.MAIN_MENU) }),
      h(
        'div',
        { class: 'main-menu' },
        EmblemView(MENU_EMBLEM, { size: 96, title: 'Emblème du jeu', className: 'main-menu-emblem' }),
        GameTitle(config.title),
        h('p', { class: 'game-subtitle' }, config.subtitle),
        h(
          'nav',
          { class: 'main-menu-nav', 'aria-label': 'Menu principal' },
          items.map((item) =>
            h('button', { type: 'button', class: `btn btn-menu ${item.primary ? 'btn-primary' : ''}`.trim(), onclick: item.action }, item.label)),
        ),
      ),
      h(
        'footer',
        { class: 'main-menu-footer' },
        h('p', { class: 'main-menu-version' }, `Version ${config.version} · prototype`),
        h('button', { type: 'button', class: 'link-button main-menu-patch-notes', onclick: () => openPatchNotes({ currentVersion: config.version }) }, 'Patch Notes'),
      ),
    );
    return this.el;
  }

  /**
   * Interface mobile (v0.84) : titre et emblème à gauche, menu à droite, sans vitrine ni défilement ;
   * « Continuer » reprend la sauvegarde la plus récente (résumé sous le bouton).
   */
  renderMobile() {
    const { config } = this.services;
    const latest = this.latestSave();
    const button = (label, action, primary = false) => h('button', { type: 'button', class: `btn btn-menu ${primary ? 'btn-primary' : ''}`.trim(), onclick: action }, label);
    this.showcasePanels = null;
    this.el = h(
      'section',
      { class: 'screen screen-main-menu m-main-menu' },
      LanguagePicker({ onChange: () => this.navigate(SCREENS.MAIN_MENU) }),
      h('div', { class: 'm-menu-brand' },
        EmblemView(MENU_EMBLEM, { size: 88, title: 'Emblème du jeu', className: 'main-menu-emblem' }),
        GameTitle(config.title),
        h('p', { class: 'game-subtitle' }, config.subtitle),
        h('p', { class: 'main-menu-version' }, `Version ${config.version} · `,
          h('button', { type: 'button', class: 'link-button main-menu-patch-notes', onclick: () => openPatchNotes({ currentVersion: config.version }) }, 'Patch Notes'))),
      h('nav', { class: 'main-menu-nav m-menu-nav', 'aria-label': 'Menu principal' },
        latest ? button('Continuer', () => this.continueLatest(latest), true) : null,
        latest ? h('p', { class: 'm-continue-summary' }, [latest.teamName, latest.day ? `Jour ${latest.day}` : null, latest.leagueName].filter(Boolean).join(' · ')) : null,
        button(latest ? 'Nouvelle partie' : 'Jouer', () => this.navigate(SCREENS.NEW_GAME), !latest),
        button('Charger', () => this.openLoad()),
        button('Options', () => this.navigate(SCREENS.OPTIONS))),
    );
    return this.el;
  }

  /** Sauvegarde lisible la plus récente (null : aucune). */
  latestSave() {
    try {
      return this.services.saves.listSaves().find((save) => !save.corrupted) ?? null;
    } catch {
      return null;
    }
  }

  /** « Continuer » : charge la dernière partie et reprend au Centre. */
  continueLatest(save) {
    try {
      const session = this.services.saves.load(save.id);
      this.services.gameState.setSession(session);
      this.navigate(SCREENS.CENTRE);
    } catch (error) {
      alertModal('Chargement impossible', error.message);
    }
  }

  mounted() {
    this.el.querySelector('.btn-menu')?.focus();
    if (!this.services.storage.persistent) {
      showToast('Stockage indisponible : les sauvegardes seront perdues à la fermeture.', 'warning', 5000);
    }
    // Interface mobile : pas de vitrine animée.
    if (!this.showcasePanels) return;
    // Vitrine : désactivable dans Options › Affichage ; coupée si le système demande moins d'animations.
    const { settings } = this.services;
    if (settings.get('display.menuShowcase') !== false && !prefersReducedMotion()) {
      this.showcase = new MainMenuShowcase(this.showcasePanels, { vfxSetting: settings.get('display.vfx') });
      this.showcase.start();
    } else {
      this.el.classList.add('is-static');
    }
  }

  unmount() {
    this.showcase?.stop();
    this.showcase = null;
    super.unmount();
  }

  openLoad() {
    if (!this.services.saves.hasSaves()) {
      alertModal(
        'Charger une partie',
        'Aucune sauvegarde n’a été trouvée. Lancez une nouvelle partie avec « Jouer », puis sauvegardez-la depuis l’écran de votre compagnie.',
      );
      return;
    }
    this.navigate(SCREENS.LOAD);
  }

  async quit() {
    const { settings, platform } = this.services;
    if (settings.get('gameplay.confirmQuit')) {
      const confirmed = await confirmModal({
        title: 'Quitter le jeu',
        message: 'Voulez-vous vraiment quitter le jeu ?',
        confirmLabel: 'Quitter',
      });
      if (!confirmed) return;
    }
    const closed = await platform.quitGame();
    if (!closed) this.navigate(SCREENS.FAREWELL);
  }
}
