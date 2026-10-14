import { svg } from '../../utils/dom.js';
import { getLandMapBounds, getMapLands } from '../../systems/geography/LandService.js';
import { getStartLocations } from '../../systems/geography/LocationService.js';

// Carte stylisée des Terres d'un pays (contours grossiers, pas de départements).
// Projection équirectangulaire corrigée à la latitude de référence, comme EuropeMap.
const SCALE = 40;

function createProjection(bounds) {
  const cosRef = Math.cos((bounds.refLat * Math.PI) / 180);
  return {
    project: ([lon, lat]) => [(lon - bounds.lonMin) * cosRef * SCALE, (bounds.latMax - lat) * SCALE],
    width: (bounds.lonMax - bounds.lonMin) * cosRef * SCALE,
    height: (bounds.latMax - bounds.latMin) * SCALE,
  };
}

const fixed = (value) => value.toFixed(1);

/** Cadre (viewBox) resserré sur une Terre, au même rapport largeur/hauteur que la carte. */
function zoomBox(land, { project, width, height }) {
  const points = land.polygons.flat().map(project);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const pad = SCALE * 0.8;
  let [x0, x1, y0, y1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
  const ratio = width / height;
  if ((x1 - x0) / (y1 - y0) < ratio) {
    const extra = (y1 - y0) * ratio - (x1 - x0);
    x0 -= extra / 2; x1 += extra / 2;
  } else {
    const extra = (x1 - x0) / ratio - (y1 - y0);
    y0 -= extra / 2; y1 += extra / 2;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function activate(element, label, action) {
  element.setAttribute('tabindex', '0');
  element.setAttribute('role', 'button');
  element.setAttribute('aria-label', label);
  element.addEventListener('click', action);
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  });
  return element;
}

/**
 * Carte des Terres d'un pays. Sans Terre choisie : les Terres colorées, cliquables.
 * Terre choisie : la carte se resserre sur elle et affiche ses lieux de départ
 * (survol : mise en évidence et nom ; clic : choix du lieu).
 *   onSelectLand(land), onSelectLocation(location)
 */
export function LandMap({ countryId, selectedLandId = null, selectedLocationId = null, onSelectLand, onSelectLocation } = {}) {
  const bounds = getLandMapBounds(countryId);
  const projection = createProjection(bounds);
  const { project, width, height } = projection;
  const lands = getMapLands(countryId);
  const selectedLand = lands.find((land) => land.id === selectedLandId) ?? null;

  const pathData = (polygons) => polygons
    .map((ring) => ring.map((point, i) => `${i ? 'L' : 'M'}${project(point).map(fixed).join(' ')}`).join(' ') + ' Z')
    .join(' ');

  const landPaths = lands.map((land) => {
    const state = !selectedLand ? '' : land === selectedLand ? 'is-selected' : 'is-dimmed';
    const path = svg('path', {
      class: `land ${state}`.trim(), d: pathData(land.polygons), 'data-land': land.id, style: `--land-color: ${land.color}`,
    }, svg('title', {}, land.name));
    return activate(path, `${land.name} : choisir cette Terre`, () => onSelectLand?.(land));
  });

  const landLabels = selectedLand ? [] : lands.map((land) => {
    const [x, y] = project(land.label);
    return svg('text', { class: 'land-label', x: fixed(x), y: fixed(y), 'text-anchor': 'middle' }, land.shortName);
  });

  const pois = selectedLand ? getStartLocations(selectedLand.id).map((location) => {
    const [x, y] = project(location.coords);
    const selected = location.id === selectedLocationId;
    const group = svg('g', {
      class: `poi ${selected ? 'is-selected' : ''}`.trim(), transform: `translate(${fixed(x)} ${fixed(y)})`,
      'data-location': location.id, style: `--land-color: ${selectedLand.color}`,
    },
    svg('title', {}, location.name),
    svg('circle', { class: 'poi-halo', r: 11 }),
    svg('circle', { class: 'poi-dot', r: 5.5 }),
    svg('text', { class: 'poi-label', y: -14, 'text-anchor': 'middle' }, location.name));
    return activate(group, `${location.name} : choisir ce lieu`, () => onSelectLocation?.(location));
  }) : [];

  const box = selectedLand ? zoomBox(selectedLand, projection) : { x: 0, y: 0, w: width, h: height };
  return svg(
    'svg',
    {
      class: `land-map ${selectedLand ? 'is-zoomed' : ''}`.trim(),
      viewBox: [box.x, box.y, box.w, box.h].map(fixed).join(' '),
      role: 'group', 'aria-label': selectedLand ? `Carte : ${selectedLand.name}` : 'Carte des Terres',
    },
    svg('rect', { class: 'map-sea', x: fixed(Math.min(0, box.x)), y: fixed(Math.min(0, box.y)), width: fixed(Math.max(width, box.x + box.w) - Math.min(0, box.x)), height: fixed(Math.max(height, box.y + box.h) - Math.min(0, box.y)) }),
    svg('g', { class: 'map-lands' }, landPaths),
    svg('g', { class: 'map-labels', 'aria-hidden': 'true' }, landLabels),
    svg('g', { class: 'map-pois' }, pois),
  );
}
