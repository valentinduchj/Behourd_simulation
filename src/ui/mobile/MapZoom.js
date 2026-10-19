import { h } from '../../utils/dom.js';
import { MAP_ZOOM } from '../../data/mapZoom.js';

// Zoom des cartes au doigt (v0.91, téléphone) : deux doigts pincent pour zoomer ou dézoomer
// autour du point pincé ; un doigt glisse la carte agrandie. Un simple toucher reste un toucher
// (sélection d'un lieu, d'un combattant…) ; après un glissé ou un pincement, le « clic » qui suit
// est ignoré. Un bouton « Vue d'ensemble » apparaît tant que la carte est agrandie.
// Le cadrage lui-même est dans IsoView (userZoom, setUserZoom) : ce module ne fait que lire les
// gestes.

const RESET_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg>';

/**
 * Branche le zoom sur le canevas d'une carte. `getRenderer()` rend le rendu en cours (IsoView),
 * ou null. Renvoie { reset(), detach() }.
 */
export function attachMapZoom(canvas, getRenderer, { rules = MAP_ZOOM, host = canvas.parentElement } = {}) {
  const pointers = new Map(); // pointerId → { x, y }
  let gesture = null; // { kind: 'pan' | 'pinch', ... }
  let moved = false;
  const reset = h('button', {
    type: 'button', class: 'm-zoom-reset', 'aria-label': 'Vue d’ensemble', title: 'Vue d’ensemble', hidden: true,
    onclick: () => apply({ scale: 1, x: 0, y: 0 }),
  });
  reset.innerHTML = RESET_ICON;
  host?.append(reset);

  const local = (event) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const apply = (zoom) => {
    const renderer = getRenderer();
    if (!renderer?.setUserZoom) return;
    renderer.setUserZoom(zoom, rules);
    reset.hidden = !renderer.isZoomed;
  };
  // Point de la carte (avant zoom) sous un point de l'écran, pour le garder sous les doigts.
  const anchorOf = (renderer, point) => {
    const { scale, x, y } = renderer.userZoom;
    const cx = renderer.view.w / 2;
    const cy = renderer.view.h / 2;
    return { x: cx + (point.x - cx - x) / scale, y: cy + (point.y - cy - y) / scale };
  };
  const startGesture = () => {
    const renderer = getRenderer();
    if (!renderer?.setUserZoom) return;
    const pts = [...pointers.values()];
    if (pts.length >= 2) {
      const [a, b] = pts;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gesture = { kind: 'pinch', distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: renderer.userZoom.scale, anchor: anchorOf(renderer, mid) };
    } else if (pts.length === 1) {
      gesture = { kind: 'pan', start: { ...pts[0] }, zoom: { ...renderer.userZoom } };
    }
  };

  const onDown = (event) => {
    if (event.pointerType === 'mouse') return;
    pointers.set(event.pointerId, local(event));
    if (pointers.size === 1) moved = false;
    startGesture();
  };
  const onMove = (event) => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, local(event));
    const renderer = getRenderer();
    if (!renderer?.setUserZoom) return;
    const pts = [...pointers.values()];
    if (gesture.kind === 'pinch' && pts.length >= 2) {
      const [a, b] = pts;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const scale = Math.min(rules.max, Math.max(rules.min, gesture.scale * (Math.hypot(a.x - b.x, a.y - b.y) / gesture.distance)));
      const cx = renderer.view.w / 2;
      const cy = renderer.view.h / 2;
      // Le point pincé reste sous les doigts.
      apply({ scale, x: mid.x - cx - (gesture.anchor.x - cx) * scale, y: mid.y - cy - (gesture.anchor.y - cy) * scale });
      moved = true;
      event.preventDefault();
    } else if (gesture.kind === 'pan' && pts.length === 1) {
      const dx = pts[0].x - gesture.start.x;
      const dy = pts[0].y - gesture.start.y;
      if (!moved && Math.hypot(dx, dy) < rules.dragThreshold) return;
      if (!renderer.isZoomed) return; // carte entière : rien à déplacer
      moved = true;
      apply({ scale: gesture.zoom.scale, x: gesture.zoom.x + dx, y: gesture.zoom.y + dy });
      event.preventDefault();
    }
  };
  const onUp = (event) => {
    if (!pointers.delete(event.pointerId)) return;
    startGesture();
    if (!pointers.size) gesture = null;
  };
  // Après un glissé ou un pincement, le « clic » qui suit n'est pas un toucher.
  const onClick = (event) => {
    if (!moved) return;
    moved = false;
    event.stopImmediatePropagation();
    event.preventDefault();
  };

  canvas.classList.add('is-zoomable');
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('click', onClick, true);
  return {
    reset: () => apply({ scale: 1, x: 0, y: 0 }),
    button: reset,
    detach() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('click', onClick, true);
      reset.remove();
    },
  };
}
