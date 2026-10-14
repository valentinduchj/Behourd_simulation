import { svg } from '../../utils/dom.js';
import { getEmblemPattern, SHIELD_PATH } from '../../data/emblemPatterns.js';

let instanceCounter = 0;

/**
 * Rendu SVG d'un emblème. Point d'extension : selon `emblem.type`, d'autres
 * moteurs de rendu (blasons, images) pourront être ajoutés ici.
 */
export function EmblemView(emblem, { size = 80, title = 'Emblème', className = '' } = {}) {
  const clipId = `emblem-clip-${++instanceCounter}`;
  const colors = emblem.resolvedColors();
  const pattern = getEmblemPattern(emblem.patternId);

  return svg(
    'svg',
    {
      class: `emblem ${className}`.trim(),
      viewBox: '0 0 100 120',
      width: size,
      height: Math.round(size * 1.2),
      role: 'img',
      'aria-label': title,
    },
    svg('defs', {}, svg('clipPath', { id: clipId }, svg('path', { d: SHIELD_PATH }))),
    svg('g', { 'clip-path': `url(#${clipId})` }, pattern.shapes(colors).map(renderShape)),
    svg('path', { d: SHIELD_PATH, fill: 'none', stroke: '#24180c', 'stroke-width': 5 }),
    svg('path', { d: SHIELD_PATH, fill: 'none', stroke: '#c9a24a', 'stroke-width': 1.6, 'stroke-opacity': 0.85 }),
  );
}

function renderShape(shape) {
  return svg(shape.tag, shape.attrs, (shape.children ?? []).map(renderShape));
}
