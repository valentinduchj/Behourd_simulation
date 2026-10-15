import { h } from '../../utils/dom.js';
import { SCREENS } from '../../core/screenIds.js';
import { SETTINGS_SCHEMA } from '../../data/settingsSchema.js';
import { BaseScreen } from './BaseScreen.js';
import { SettingControl } from '../components/SettingControl.js';
import { confirmModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { openAdminAccess } from '../admin/adminAccess.js';

/**
 * Rubriques des Options, générées depuis data/settingsSchema.js : l'écran Options (menu principal)
 * et la fenêtre Options en jeu (v0.77, components/OptionsModal.js) partagent le même contenu.
 * `admin` : ajoute l'accès au module Admin (écran principal seulement : il quitte la partie).
 */
export function OptionsSections(services, { admin = false, navigate = null } = {}) {
  const { settings } = services;
  return h(
    'div',
    { class: 'options-sections' },
    SETTINGS_SCHEMA.map((section) =>
      h(
        'section',
        { class: 'panel options-section' },
        h('h2', { class: 'section-title' }, section.label),
        h(
          'div',
          { class: 'options-list' },
          section.settings.map((def) => SettingControl(def, settings.get(def.key), (value) => settings.set(def.key, value))),
        ),
      )),
    // Administration : accès au module Admin (outil de développement, code d'accès).
    admin
      ? h(
        'section',
        { class: 'panel options-section options-admin' },
        h('h2', { class: 'section-title' }, 'Administration'),
        h('p', { class: 'muted' }, 'Outils de développement : clubs, statistiques, ressources, temps, sauvegardes… Un code d’accès est demandé.'),
        h('div', { class: 'button-row' }, h('button', {
          type: 'button', class: 'btn', onclick: () => openAdminAccess({ services, navigate }),
        }, 'Ouvrir le module Admin')),
      )
      : null,
  );
}

/** Écran Options, entièrement généré depuis data/settingsSchema.js. */
export class OptionsScreen extends BaseScreen {
  render() {
    return h(
      'section',
      { class: 'screen screen-options' },
      h(
        'header',
        { class: 'screen-header' },
        h('h1', {}, 'Options'),
        h('p', { class: 'screen-subtitle' }, 'Les réglages sont enregistrés automatiquement.'),
      ),
      OptionsSections(this.services, { admin: true, navigate: (id) => this.navigate(id) }),
      h(
        'div',
        { class: 'screen-actions' },
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => this.reset() }, 'Réinitialiser'),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.navigate(SCREENS.MAIN_MENU) }, 'Retour'),
      ),
    );
  }

  async reset() {
    const confirmed = await confirmModal({
      title: 'Réinitialiser les options',
      message: 'Rétablir toutes les options à leur valeur par défaut ?',
      confirmLabel: 'Réinitialiser',
    });
    if (!confirmed) return;
    this.services.settings.reset();
    showToast('Options réinitialisées.');
    this.navigate(SCREENS.OPTIONS);
  }
}
