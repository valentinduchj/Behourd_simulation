import { h } from '../../utils/dom.js';
import { getStat } from '../../systems/fighters/stats.js';
import { fatigueLevelClass } from '../../systems/fighters/FatigueService.js';
import { PotentialFlames } from '../components/Potential.js';

// La Compagnie sur téléphone (v0.92) : ce que la liste des combattants montre à droite de chaque
// nom — la fatigue (par défaut), les mises à terre de la carrière ou le potentiel (flammes).
// Un petit bouton à icône, à droite de « La Compagnie 19/20 », ouvre le choix. Le choix tient le
// temps de la partie ouverte (il n'est pas enregistré dans la sauvegarde).

const ICONS = {
  fatigue: '<path d="M4 7h13a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4Z"/><path d="M21 10v4"/><path d="M7 10v4M10 10v4"/>',
  takedowns: '<path d="M4 4l10 10M14 4 4 14"/><path d="M13 17l4 4M17 17l4 4"/><path d="M3 13l4 4M11 13l-4 4"/>',
  potential: '<path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0C8 9 10 8 10 5c1 1 1.6 2 2 3"/>',
};

function svg(name, size = 18) {
  const el = h('span', { class: 'm-metric-icon', 'aria-hidden': 'true' });
  el.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  return el;
}

export const TEAM_METRICS = Object.freeze([
  {
    id: 'fatigue', label: 'Fatigue',
    render: (fighter) => h('span', { class: `m-team-metric m-team-fatigue ${fatigueLevelClass(fighter)}`, title: 'Fatigue' }, String(Math.round(getStat(fighter, 'fatigue')))),
  },
  {
    id: 'takedowns', label: 'Mises à terre',
    render: (fighter) => h('span', { class: 'm-team-metric m-team-takedowns', title: 'Mises à terre (carrière)' }, svg('takedowns', 14), String(fighter.takedowns ?? 0)),
  },
  {
    id: 'potential', label: 'Potentiel',
    render: (fighter) => h('span', { class: 'm-team-metric m-team-potential' }, PotentialFlames(fighter, { className: 'is-compact' })),
  },
]);

let current = 'fatigue';

export function getListMetric() {
  return TEAM_METRICS.find((m) => m.id === current) ?? TEAM_METRICS[0];
}

export function setListMetric(id) {
  if (TEAM_METRICS.some((m) => m.id === id)) current = id;
  return getListMetric();
}

/**
 * Bouton discret (icône de l'affichage en cours) ; un toucher ouvre un petit menu à trois
 * lignes. `onChange()` redessine la liste.
 */
export function TeamMetricPicker(onChange) {
  const metric = getListMetric();
  const menu = h('div', { class: 'm-metric-menu', role: 'menu', hidden: true }, TEAM_METRICS.map((m) => h('button', {
    type: 'button', role: 'menuitemradio', class: `m-metric-option ${m.id === metric.id ? 'is-active' : ''}`.trim(),
    'aria-checked': String(m.id === metric.id), 'data-metric': m.id,
    onclick: () => { setListMetric(m.id); menu.hidden = true; onChange?.(); },
  }, svg(m.id), h('span', {}, m.label))));
  const button = h('button', {
    type: 'button', class: 'm-metric-button', 'aria-haspopup': 'menu', 'aria-expanded': 'false',
    'aria-label': `Affichage de la liste : ${metric.label}`, title: `Affichage : ${metric.label}`,
    onclick: (event) => {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
      button.setAttribute('aria-expanded', String(!menu.hidden));
    },
  }, svg(metric.id));
  const wrap = h('div', { class: 'm-metric' }, button, menu);
  openPicker = { wrap, menu, button };
  installOutsideClose();
  return wrap;
}

// Un toucher ailleurs referme le menu (un seul écouteur pour toute la partie).
let openPicker = null;
let outsideInstalled = false;
function installOutsideClose() {
  if (outsideInstalled) return;
  outsideInstalled = true;
  document.addEventListener('click', (event) => {
    const picker = openPicker;
    if (!picker || picker.menu.hidden || picker.wrap.contains(event.target)) return;
    picker.menu.hidden = true;
    picker.button.setAttribute('aria-expanded', 'false');
  }, { capture: true });
}
