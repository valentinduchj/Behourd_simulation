import { h } from '../../utils/dom.js';
import { computePalmares } from '../../systems/trophies/PalmaresService.js';
import { drawTrophy, drawRibbon } from '../../render/trophies.js';

// Palmarès graphique d'un club (en-tête de sa fiche) : une icône par distinction possédée,
// avec son nombre (« ×2 »), sans aucune saison. Trophées et rubans se distinguent par leur
// forme et par un léger séparateur. Données : PalmaresService (déduit de l'historique).

function PalmaresIcon(item, size) {
  const canvas = h('canvas', { class: 'palmares-canvas', width: size * 2, height: size * 2, style: { width: `${size}px`, height: `${size}px` } });
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(2, 2);
    if (item.kind === 'trophy') drawTrophy(ctx, size / 2, size - 2, { competition: item.id, size: size - 4 });
    else drawRibbon(ctx, size / 2, size - 2, { ribbon: item.id, size: size - 4 });
  }
  return canvas;
}

/** Palmarès d'un club, ou null s'il n'a encore aucune distinction (rien n'est affiché). */
export function ClubPalmares(session, clubId, { size = 40 } = {}) {
  const items = computePalmares(session, clubId);
  if (!items.length) return null;
  const entry = (item) => h(
    'li',
    {
      class: `palmares-item is-${item.kind}`,
      'data-palmares': item.id,
      title: `${item.name} — ${item.title}${item.count > 1 ? ` ×${item.count}` : ''}${item.detail ? ` (${item.detail})` : ''}`,
      'aria-label': `${item.name} : ${item.count}`,
    },
    PalmaresIcon(item, size),
    h('span', { class: 'palmares-count' }, `×${item.count}`),
  );
  const trophies = items.filter((item) => item.kind === 'trophy');
  const ribbons = items.filter((item) => item.kind === 'ribbon');
  return h(
    'div',
    { class: 'club-palmares', 'aria-label': 'Palmarès' },
    h('p', { class: 'club-palmares-title' }, 'Palmarès'),
    h(
      'ul',
      { class: 'club-palmares-list' },
      trophies.map(entry),
      trophies.length && ribbons.length ? h('li', { class: 'palmares-sep', 'aria-hidden': 'true' }) : null,
      ribbons.map(entry),
    ),
  );
}
