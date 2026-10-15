import { h, svg } from '../../utils/dom.js';
import { LANGUAGES, getLanguage, getLanguageInfo, setLanguage, translateDocument } from '../../i18n/i18n.js';

// Choix de la langue (v0.79), en haut à droite de l'écran principal : le drapeau de la langue
// active ; au clic, la liste des trois langues. Le choix est enregistré et vaut pour tout le jeu.

/** Drapeaux dessinés (SVG 30 × 20) : France, Royaume-Uni, Espagne. */
const FLAGS = Object.freeze({
  fr: () => svg('svg', { viewBox: '0 0 30 20', class: 'flag', 'aria-hidden': 'true' },
    svg('rect', { width: 10, height: 20, fill: '#1f4e9c' }),
    svg('rect', { x: 10, width: 10, height: 20, fill: '#f4f1ea' }),
    svg('rect', { x: 20, width: 10, height: 20, fill: '#c8202f' })),
  en: () => svg('svg', { viewBox: '0 0 60 40', class: 'flag', 'aria-hidden': 'true' },
    svg('rect', { width: 60, height: 40, fill: '#1f3a8a' }),
    svg('path', { d: 'M0 0 L60 40 M60 0 L0 40', stroke: '#f4f1ea', 'stroke-width': 8 }),
    svg('path', { d: 'M0 0 L60 40 M60 0 L0 40', stroke: '#c8202f', 'stroke-width': 3 }),
    svg('path', { d: 'M30 0 V40 M0 20 H60', stroke: '#f4f1ea', 'stroke-width': 12 }),
    svg('path', { d: 'M30 0 V40 M0 20 H60', stroke: '#c8202f', 'stroke-width': 7 })),
  es: () => svg('svg', { viewBox: '0 0 30 20', class: 'flag', 'aria-hidden': 'true' },
    svg('rect', { width: 30, height: 20, fill: '#c60b1e' }),
    svg('rect', { y: 5, width: 30, height: 10, fill: '#f1bf00' })),
});

export function LanguageFlag(id) {
  return (FLAGS[id] ?? FLAGS.fr)();
}

/**
 * Sélecteur de langue. `onChange(id)` : appelé une fois la nouvelle langue active (l'écran se
 * redessine alors dans cette langue).
 */
export function LanguagePicker({ onChange } = {}) {
  const active = getLanguageInfo();
  const list = h('ul', { class: 'language-list', role: 'listbox', hidden: true, 'aria-label': 'Langue' },
    LANGUAGES.map((language) => h('li', {},
      h('button', {
        type: 'button',
        class: `language-option ${language.id === active.id ? 'is-active' : ''}`.trim(),
        role: 'option',
        'aria-selected': String(language.id === active.id),
        'data-language': language.id,
        // Le nom de chaque langue s'écrit dans cette langue : jamais traduit.
        'data-no-translate': '',
        onclick: async () => {
          close();
          if (language.id === getLanguage()) return;
          await setLanguage(language.id);
          translateDocument();
          onChange?.(language.id);
        },
      }, LanguageFlag(language.id), h('span', {}, language.label)))));
  const toggle = h('button', {
    type: 'button', class: 'language-toggle', 'aria-haspopup': 'listbox', 'aria-expanded': 'false',
    title: 'Langue', 'aria-label': `Langue : ${active.label}`,
    onclick: (event) => {
      event.stopPropagation();
      if (list.hidden) open();
      else close();
    },
  }, LanguageFlag(active.id));
  const root = h('div', { class: 'language-picker' }, toggle, list);
  const onOutside = (event) => { if (!root.contains(event.target)) close(); };
  function open() {
    list.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onOutside);
  }
  function close() {
    list.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutside);
  }
  return root;
}
