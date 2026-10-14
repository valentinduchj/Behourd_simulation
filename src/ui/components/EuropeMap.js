import { svg } from '../../utils/dom.js';
import { EUROPE_COUNTRIES, MAP_BOUNDS } from '../../data/geography/europe.js';

// Projection équirectangulaire corrigée à la latitude de référence.
const SCALE = 24;
const COS_REF = Math.cos((MAP_BOUNDS.refLat * Math.PI) / 180);
const project = ([lon, lat]) => [
  (lon - MAP_BOUNDS.lonMin) * COS_REF * SCALE,
  (MAP_BOUNDS.latMax - lat) * SCALE,
];
const WIDTH = (MAP_BOUNDS.lonMax - MAP_BOUNDS.lonMin) * COS_REF * SCALE;
const HEIGHT = (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin) * SCALE;

function pathData(polygons) {
  return polygons
    .map((ring) => ring.map((point, i) => `${i ? 'L' : 'M'}${project(point).map((v) => v.toFixed(1)).join(' ')}`).join(' ') + ' Z')
    .join(' ');
}

/**
 * Carte de l'Europe. Seuls les pays `selectable` réagissent (clic, clavier).
 * onSelect(country) ; selectedId : pays mis en évidence.
 */
export function EuropeMap({ onSelect, selectedId = null } = {}) {
  const countries = EUROPE_COUNTRIES.map((country) => {
    const selectable = Boolean(country.selectable);
    const select = () => selectable && onSelect?.(country);
    const attrs = {
      class: ['country', selectable ? 'is-selectable' : 'is-locked', country.id === selectedId ? 'is-selected' : ''].join(' ').trim(),
      d: pathData(country.polygons),
      'data-country': country.id,
    };
    if (selectable) Object.assign(attrs, { tabindex: '0', role: 'button', 'aria-label': `${country.name} : choisir ce pays` });
    const path = svg('path', attrs, svg('title', {}, selectable ? country.name : `${country.name} — indisponible`));
    if (selectable) {
      path.addEventListener('click', select);
      path.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select();
        }
      });
    }
    return path;
  });

  const labels = EUROPE_COUNTRIES.filter((country) => country.label).map((country) => {
    const [x, y] = project(country.label);
    return svg('text', { class: `country-label ${country.selectable ? 'is-selectable' : ''}`.trim(), x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': 'middle' }, country.name);
  });

  return svg(
    'svg',
    { class: 'europe-map', viewBox: `0 0 ${WIDTH.toFixed(0)} ${HEIGHT.toFixed(0)}`, role: 'group', 'aria-label': 'Carte de l’Europe' },
    svg('rect', { class: 'map-sea', x: 0, y: 0, width: WIDTH.toFixed(0), height: HEIGHT.toFixed(0) }),
    svg('g', { class: 'map-countries' }, countries),
    svg('g', { class: 'map-labels', 'aria-hidden': 'true' }, labels),
  );
}
