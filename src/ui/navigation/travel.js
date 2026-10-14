import { TRAVEL_TRANSITION } from '../../data/locations.js';
import { resolveTravel } from '../../systems/navigation/LocationNavigationService.js';
import { showToast } from '../components/Toast.js';

// Voyage d'un lieu à l'autre par une sortie (chemin, porte) : fondu au noir, changement
// d'écran, apparition du nouveau lieu (côté de la sortie d'arrivée). Toutes les cartes passent
// par ici ; aucune destination n'est écrite dans les écrans (data/locations.js).
// v0.73.2 : le fondu ne couvre que la carte (le canvas du lieu), jamais tout l'écran : il se
// pose sur la carte de départ, puis sur celle d'arrivée. Sans carte : tout l'écran (repli).

let veil = null;
let traveling = false;

function getVeil() {
  if (!veil || !veil.isConnected) {
    veil = document.createElement('div');
    veil.className = 'travel-veil';
    veil.setAttribute('aria-hidden', 'true');
    document.body.append(veil);
  }
  return veil;
}

/** Pose le voile exactement sur la carte (même place, mêmes coins arrondis), ou sur tout l'écran. */
export function fitVeil(v, mapElement) {
  if (!mapElement?.isConnected) {
    for (const key of ['top', 'left', 'width', 'height', 'borderRadius', 'inset']) v.style[key] = '';
    v.classList.remove('is-map');
    return;
  }
  const rect = mapElement.getBoundingClientRect();
  const frame = mapElement.parentElement ?? mapElement;
  Object.assign(v.style, {
    inset: 'auto', top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px`,
    borderRadius: getComputedStyle(frame).borderRadius || getComputedStyle(mapElement).borderRadius,
  });
  v.classList.add('is-map');
}

/** Un voyage est-il en cours (fondu) ? */
export function isTraveling() {
  return traveling;
}

/**
 * Emprunte la sortie `exitId` depuis l'écran `screen` (qui fournit navigate et sa carte,
 * `screen.canvas`). Sortie fermée ou lieu à venir : simple message, rien ne change. Renvoie le
 * résultat de resolveTravel.
 */
export function travelThrough(screen, exitId, { timing = TRAVEL_TRANSITION } = {}) {
  const result = resolveTravel(exitId);
  if (!result.ok) {
    if (result.reason) showToast(result.reason, 'info');
    return result;
  }
  if (traveling) return { ...result, ok: false, reason: 'Déplacement déjà en cours.' };
  traveling = true;
  const v = getVeil();
  // Le voile part transparent, posé sur la carte de départ, puis s'assombrit.
  v.style.transitionDuration = '0s';
  v.classList.remove('is-active');
  fitVeil(v, screen.canvas);
  void v.offsetWidth;
  v.style.transitionDuration = `${timing.fadeOut}s`;
  v.classList.add('is-active');
  setTimeout(() => {
    try {
      const next = screen.navigate(result.screen, result.params);
      // Arrivée : le voile (encore noir) se pose sur la nouvelle carte, puis s'efface.
      v.style.transitionDuration = '0s';
      fitVeil(v, next?.canvas);
      void v.offsetWidth;
    } finally {
      v.style.transitionDuration = `${timing.fadeIn}s`;
      v.classList.remove('is-active');
      traveling = false;
    }
  }, timing.fadeOut * 1000);
  return result;
}