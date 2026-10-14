import { h } from '../../utils/dom.js';
import { SCREENS } from '../../core/screenIds.js';
import { ADMIN_TOOLS } from '../../admin/adminTools.js';
import { BaseScreen } from './BaseScreen.js';

/** Module Admin : accessible uniquement après saisie du code (garde dans registerScreens). */
export class AdminScreen extends BaseScreen {
  constructor(context) {
    super(context);
    this.activeToolId = this.params.tool ?? ADMIN_TOOLS[0].id;
  }

  render() {
    this.navHost = h('nav', { class: 'admin-nav', 'aria-label': 'Outils d’administration' });
    this.contentHost = h('div', { class: 'admin-content panel' });
    this.refresh();

    return h(
      'section',
      { class: 'screen screen-admin' },
      h(
        'header',
        { class: 'screen-header admin-header' },
        h('div', {}, h('p', { class: 'eyebrow' }, 'Outil de développement'), h('h1', {}, 'Module Admin')),
        h(
          'div',
          { class: 'button-row' },
          h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => this.lock() }, 'Verrouiller'),
          h('button', { type: 'button', class: 'btn', onclick: () => this.navigate(SCREENS.MAIN_MENU) }, 'Menu principal'),
        ),
      ),
      h('div', { class: 'admin-layout' }, this.navHost, this.contentHost),
    );
  }

  refresh() {
    const tool = ADMIN_TOOLS.find((t) => t.id === this.activeToolId) ?? ADMIN_TOOLS[0];

    this.navHost.replaceChildren(
      ...ADMIN_TOOLS.map((t) =>
        h(
          'button',
          {
            type: 'button',
            class: `admin-nav-item ${t.id === tool.id ? 'is-active' : ''}`.trim(),
            'aria-current': t.id === tool.id ? 'page' : null,
            onclick: () => { this.activeToolId = t.id; this.refresh(); },
          },
          t.label,
          t.status === 'planned' ? h('span', { class: 'tag' }, 'à venir') : null,
        )),
    );

    const context = { services: this.services, navigate: this.navigate, refresh: () => this.refresh() };
    this.contentHost.replaceChildren(
      h('h2', { class: 'section-title' }, tool.label),
      h('p', { class: 'admin-tool-description' }, tool.description),
      tool.render(context),
    );
  }

  lock() {
    this.services.adminAuth.lock();
    this.navigate(SCREENS.MAIN_MENU);
  }
}
