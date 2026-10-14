import { roundRect } from './figures.js';
import { describeExit, getExitState } from '../systems/navigation/LocationNavigationService.js';

// Sorties d'une carte en cases (Centre, Bourg) : poteau indicateur, barrière d'un lieu à venir,
// mise en évidence au survol ou à l'arrivée, indication de destination. Présentation seulement :
// les sorties viennent de data/locations.js.

/** Décor des sorties : poteau tourné vers la sortie ; barrière en travers si le lieu est à venir. */
export function exitProps(exits, { width, height }) {
  const props = [];
  for (const exit of exits) {
    const { x, y, w, h } = exit.position;
    const state = getExitState(exit);
    if (exit.marker) {
      // Planche tournée vers le bord de la carte que touche la sortie (à l'écran : x − y).
      const toward = (x + w / 2 - (y + h / 2)) - (width / 2 - height / 2);
      props.push({ type: 'signpost', x: exit.marker.x, y: exit.marker.y, pointing: toward >= 0 ? 1 : -1, exitId: exit.id, layer: 'standing' });
    }
    if (state === 'soon') {
      const barrier = h > w
        ? { from: { x: x + w * 0.7, y }, to: { x: x + w * 0.7, y: y + h } }
        : { from: { x, y: y + h * 0.7 }, to: { x: x + w, y: y + h * 0.7 } };
      props.push({ type: 'barrier', x: barrier.from.x, y: barrier.from.y, ...barrier, exitId: exit.id, layer: 'standing' });
    }
  }
  return props;
}

/**
 * Sortie dont le poteau indicateur est sous le point (x, y), en coordonnées du canvas : le
 * poteau et sa planche se cliquent comme le bout de chemin qu'ils signalent (même cadre que
 * `propRenderers.signpost`).
 */
export function exitAtSignpost(view, exits, x, y) {
  const s = view.tile?.w;
  if (!s) return null;
  return exits.find((exit) => {
    if (!exit.marker) return false;
    const base = view.toScreen(exit.marker.x, exit.marker.y);
    return Math.abs(x - base.x) <= s * 0.36 && y >= base.y - s * 0.7 && y <= base.y + s * 0.06;
  }) ?? null;
}

/** Lueur sur les cases d'une sortie : `strength` de 0 à 1 (survol : 1 ; arrivée : décroît). */
export function drawExitHighlight(view, exit, { strength = 1, time = 0 } = {}) {
  if (strength <= 0) return;
  const { ctx } = view;
  const { x, y, w, h } = exit.position;
  const open = getExitState(exit) === 'open';
  view.traceArea(x, y, w, h);
  ctx.fillStyle = open ? `rgba(240, 196, 25, ${0.28 * strength})` : `rgba(200, 190, 170, ${0.2 * strength})`;
  ctx.fill();
  ctx.setLineDash([6, 4]);
  ctx.lineDashOffset = -time * 14;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = open ? `rgba(240, 196, 25, ${0.9 * strength})` : `rgba(120, 110, 95, ${0.8 * strength})`;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
}

/** Indication de destination près de la sortie survolée : « ↗ La Taverne · Prendre le chemin ». */
export function drawExitLabel(view, exit, { anchor: at = null } = {}) {
  const label = describeExit(exit);
  if (!label) return null;
  const { ctx } = view;
  // Ancrage : le centre de la zone de la sortie (chemin), ou un point fourni (porte).
  const anchor = at ?? view.toScreen(exit.position.x + exit.position.w / 2, exit.position.y + exit.position.h / 2);
  ctx.font = '700 14px "Cinzel", Georgia, serif';
  const titleWidth = ctx.measureText(label.title).width;
  ctx.font = 'italic 500 13px "EB Garamond", Georgia, serif';
  const width = Math.max(titleWidth, ctx.measureText(label.subtitle).width) + 22;
  const height = 42;
  const left = Math.min(Math.max(anchor.x - width / 2, 6), view.view.w - width - 6);
  const top = Math.min(Math.max(anchor.y - (at ? 10 : view.tile.w * 0.9) - height, 6), view.view.h - height - 6);
  roundRect(ctx, left, top, width, height, 7);
  ctx.fillStyle = 'rgba(253, 246, 228, 0.96)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = label.state === 'open' ? '#c99a2e' : '#8a7f70';
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#2a2016';
  ctx.font = '700 14px "Cinzel", Georgia, serif';
  ctx.fillText(label.title, left + width / 2, top + 18);
  ctx.fillStyle = label.state === 'open' ? '#8a6114' : '#6b6255';
  ctx.font = 'italic 500 13px "EB Garamond", Georgia, serif';
  ctx.fillText(label.subtitle, left + width / 2, top + 35);
  return { left, top, width, height };
}

/** Intensité de la lueur d'arrivée, `age` secondes après l'arrivée (pulsation qui s'éteint). */
export function arrivalGlow(age, duration) {
  if (age < 0 || age > duration) return 0;
  return (1 - age / duration) * (0.65 + 0.35 * Math.sin(age * 6));
}
