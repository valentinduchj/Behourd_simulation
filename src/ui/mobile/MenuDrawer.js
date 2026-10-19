import { h } from '../../utils/dom.js';
import { formatDateTime } from '../../utils/format.js';
import { GAME_CONFIG } from '../../config/gameConfig.js';
import { EmblemView } from '../components/EmblemView.js';
import { openModal } from '../components/Modal.js';
import { attachSwipeClose } from './SwipeClose.js';

// Menu du téléphone (v0.90, maquette « A · volet latéral ») : le bouton ☰ en haut à droite ouvre
// un volet qui glisse depuis la droite, par-dessus le jeu assombri. En haut, l'état de la
// sauvegarde et un grand bouton « Sauvegarder » ; au milieu, les rubriques (une ligne chacune,
// au pouce) ; en bas, à part, la sortie (Menu principal, et pour la Coupe « Abandonner »).
// C'est une fenêtre (openModal) : le bouton retour d'Android et un toucher à côté le referment.

const GLYPHS = Object.freeze({
  save: '<path d="M5 3h11l3 3v15H5Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  achievements: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7Z"/>',
  almanac: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
  options: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  notes: '<path d="M6 3h9l3 3v15H6Z"/><path d="M9 10h6M9 14h6M9 18h3"/>',
  board: '<path d="M4 5h16v14H4Z"/><path d="M4 10h16M10 5v14"/>',
  exit: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h9"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
});

function glyph(name, size = 20) {
  const el = h('span', { class: `m-drawer-glyph is-${name}`, 'aria-hidden': 'true' });
  el.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[name] ?? ''}</svg>`;
  return el;
}

/** État de la sauvegarde, en une ligne : { text, dirty }. */
export function describeSaveState(session) {
  const { dirty, lastSavedAt } = session ?? {};
  if (dirty) return { text: lastSavedAt ? 'Modifications non sauvegardées' : 'Partie non sauvegardée', dirty: true };
  return { text: lastSavedAt ? `Sauvegardée le ${formatDateTime(lastSavedAt)}` : 'Partie sauvegardée', dirty: false };
}

/**
 * Ouvre le volet.
 *   session  : partie en cours (blason, état de la sauvegarde)
 *   onSave   : « Sauvegarder » (le volet se referme)
 *   items    : rubriques [{ id, glyph, label, side, onClick }]
 *   exits    : sorties, en bas [{ id, glyph, label, onClick, danger }]
 * Renvoie la fenêtre (handle.close()).
 */
export function openMenuDrawer({ session, onSave, items = [], exits = [] }) {
  let handle = null;
  const run = (fn) => () => { handle.close(); fn?.(); };
  const team = session?.playerTeam;
  const save = describeSaveState(session);
  const body = h('div', { class: 'm-drawer' },
    h('div', { class: 'm-drawer-head' },
      team ? EmblemView(team.emblem, { size: 34, title: team.name }) : null,
      h('div', { class: 'm-drawer-titles' },
        h('strong', { class: 'm-drawer-title' }, 'Menu'),
        h('span', { class: `m-drawer-save ${save.dirty ? 'is-dirty' : 'is-saved'}` }, save.text)),
      h('button', { type: 'button', class: 'm-drawer-close', 'aria-label': 'Fermer le menu', onclick: () => handle.close() }, glyph('close', 18))),
    onSave ? h('button', { type: 'button', class: 'btn btn-primary m-drawer-save-btn', 'data-menu': 'save', onclick: run(onSave) }, glyph('save'), 'Sauvegarder') : null,
    h('nav', { class: 'm-drawer-list', 'aria-label': 'Rubriques' }, items.map((item) => h('button', {
      type: 'button', class: 'm-drawer-item', 'data-menu': item.id, onclick: run(item.onClick),
    },
    glyph(item.glyph),
    h('span', { class: 'm-drawer-label' }, item.label),
    item.side ? h('span', { class: 'm-drawer-side' }, item.side) : null,
    glyph('chevron', 16)))),
    h('div', { class: 'm-drawer-exits' }, exits.map((exit) => h('button', {
      type: 'button', class: `btn m-drawer-exit ${exit.danger ? 'is-danger' : ''}`.trim(), 'data-menu': exit.id, onclick: run(exit.onClick),
    }, glyph(exit.glyph ?? 'exit', 18), exit.label))),
    h('p', { class: 'm-drawer-version' }, `${GAME_CONFIG.title} · version ${GAME_CONFIG.version}`));
  handle = openModal({ body, className: 'm-drawer-modal' });
  // v0.93 : pousser le volet vers la droite le referme.
  attachSwipeClose(handle.element, { direction: 'right', onClose: () => handle.close() });
  return handle;
}
