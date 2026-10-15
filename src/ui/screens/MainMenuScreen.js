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
export class MainMenuScreen extends BaseScreen {
  render() {
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
        h('h1', { class: 'game-title' }, config.title),
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

  mounted() {
    this.el.querySelector('.btn-menu')?.focus();
    if (!this.services.storage.persistent) {
      showToast('Stockage indisponible : les sauvegardes seront perdues à la fermeture.', 'warning', 5000);
    }
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
