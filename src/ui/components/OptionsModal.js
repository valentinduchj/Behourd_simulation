import { h } from '../../utils/dom.js';
import { openModal, confirmModal } from './Modal.js';
import { showToast } from './Toast.js';
import { OptionsSections } from '../screens/OptionsScreen.js';

/**
 * Options en jeu (v0.77) : les mêmes réglages que l'écran Options du menu principal, dans une
 * fenêtre — la partie reste ouverte, chaque réglage s'applique aussitôt (enregistré
 * automatiquement). Sans le module Admin, qui quitterait la partie.
 */
export function openOptionsModal(services) {
  const host = h('div', { class: 'options-modal-body' }, OptionsSections(services));
  return openModal({
    title: 'Options',
    className: 'modal-wide options-modal',
    body: h('div', {}, h('p', { class: 'muted' }, 'Les réglages sont enregistrés automatiquement.'), host),
    actions: [
      {
        label: 'Réinitialiser',
        variant: 'ghost',
        onClick: async () => {
          const confirmed = await confirmModal({
            title: 'Réinitialiser les options',
            message: 'Rétablir toutes les options à leur valeur par défaut ?',
            confirmLabel: 'Réinitialiser',
          });
          if (!confirmed) return;
          services.settings.reset();
          host.replaceChildren(OptionsSections(services));
          showToast('Options réinitialisées.');
        },
      },
      { label: 'Fermer', variant: 'primary', value: true },
    ],
  });
}
