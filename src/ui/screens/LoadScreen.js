import { h } from '../../utils/dom.js';
import { formatDateTime } from '../../utils/format.js';
import { SCREENS } from '../../core/screenIds.js';
import { Emblem } from '../../models/Emblem.js';
import { BaseScreen } from './BaseScreen.js';
import { EmblemView } from '../components/EmblemView.js';
import { alertModal, confirmModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';

export class LoadScreen extends BaseScreen {
  render() {
    this.listHost = h('div', { class: 'save-list' });
    this.refresh();
    return h(
      'section',
      { class: 'screen screen-load' },
      h(
        'header',
        { class: 'screen-header' },
        h('h1', {}, 'Charger une partie'),
        h('p', { class: 'screen-subtitle' }, 'Choisissez la compagnie à reprendre.'),
      ),
      this.listHost,
      h(
        'div',
        { class: 'screen-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => this.navigate(SCREENS.MAIN_MENU) }, 'Retour'),
      ),
    );
  }

  refresh() {
    const saves = this.services.saves.listSaves();
    if (!saves.length) {
      this.listHost.replaceChildren(h('p', { class: 'empty-state panel' }, 'Aucune sauvegarde disponible.'));
      return;
    }
    this.listHost.replaceChildren(...saves.map((save) => this.renderSave(save)));
  }

  renderSave(save) {
    const deleteButton = h('button', { type: 'button', class: 'btn btn-danger btn-sm', onclick: () => this.remove(save) }, 'Supprimer');

    if (save.corrupted) {
      return h(
        'article',
        { class: 'save-card panel is-corrupted' },
        h(
          'div',
          { class: 'save-card-info' },
          h('h2', { class: 'save-card-title' }, 'Sauvegarde illisible'),
          h('p', { class: 'save-card-meta' }, `Identifiant : ${save.id}`),
        ),
        h('div', { class: 'save-card-actions' }, deleteButton),
      );
    }

    return h(
      'article',
      { class: 'save-card panel' },
      EmblemView(Emblem.fromJSON(save.emblem), { size: 52, title: `Emblème de ${save.teamName}` }),
      h(
        'div',
        { class: 'save-card-info' },
        h('h2', { class: 'save-card-title' }, save.teamName),
        h('p', { class: 'save-card-meta' }, `${save.leagueName ? `${save.leagueName} · ` : ''}${save.day ? `Jour ${save.day} · ` : ''}${save.fighterCount} combattants · sauvegardée le ${formatDateTime(save.savedAt)}`),
      ),
      h(
        'div',
        { class: 'save-card-actions' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => this.load(save.id) }, 'Charger'),
        deleteButton,
      ),
    );
  }

  load(saveId) {
    try {
      const session = this.services.saves.load(saveId);
      this.services.gameState.setSession(session);
      this.navigate(SCREENS.TEAM);
    } catch (error) {
      alertModal('Chargement impossible', error.message);
    }
  }

  async remove(save) {
    const confirmed = await confirmModal({
      title: 'Supprimer la sauvegarde',
      message: `Supprimer définitivement « ${save.teamName ?? save.id} » ?`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;
    this.services.saves.delete(save.id);
    showToast('Sauvegarde supprimée.');
    this.refresh();
  }
}
