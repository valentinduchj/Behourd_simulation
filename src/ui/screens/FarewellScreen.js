import { h } from '../../utils/dom.js';
import { SCREENS } from '../../core/screenIds.js';
import { BaseScreen } from './BaseScreen.js';

/** Affiché quand l'environnement (navigateur) refuse de fermer la fenêtre. */
export class FarewellScreen extends BaseScreen {
  render() {
    return h(
      'section',
      { class: 'screen screen-farewell' },
      h(
        'div',
        { class: 'panel farewell-panel' },
        h('h1', {}, 'La compagnie se retire'),
        h('p', {}, 'Le navigateur ne permet pas au jeu de fermer cet onglet lui-même.'),
        h('p', { class: 'muted' }, 'Vous pouvez fermer l’onglet en toute sécurité (Ctrl + W). Si vous avez lancé le jeu avec lancer.bat, fermez aussi la fenêtre du serveur.'),
        h('button', { type: 'button', class: 'btn', onclick: () => this.navigate(SCREENS.MAIN_MENU) }, 'Revenir au menu'),
      ),
    );
  }
}
