// Cadence des animations (v0.87). Sur téléphone, les scènes (Centre, Bourg, Taverne, lice…) se
// dessinent à 30 images par seconde au plus : deux fois moins de calcul, autant de fluidité pour
// un jeu de gestion. Écran caché (application en arrière-plan) : plus rien n'est dessiné.
// v1.1.9 (batterie) : scène du domaine presque entièrement couverte (fenêtre ouverte, volet haut,
// affectations) → COVERED_FPS images par seconde seulement : la bande encore visible reste
// vivante, sans dessiner 30 fois par seconde ce que personne ne voit.

let maxFps = 0; // 0 : le rythme de l'écran (version ordinateur)
export const COVERED_FPS = 2;
// Ce qui couvre la scène : une fenêtre (modale, carnet), un volet haut (Taverne, Bourg, Baron),
// les affectations du Centre.
export const COVERING_SELECTOR = '.modal-backdrop, .m-sheet.is-tall[data-state="open"], .m-sheet[data-state="open"][data-part="assignments"]';

/** Plafond d'images par seconde des scènes (0 : aucun). */
export function setFrameCap(fps) {
  maxFps = Math.max(0, Number(fps) || 0);
}

export function getFrameCap() {
  return maxFps;
}

/** La scène est-elle presque entièrement couverte (téléphone : fenêtre, volet haut) ? */
export function isSceneCovered() {
  try {
    return Boolean(globalThis.document?.querySelector(COVERING_SELECTOR));
  } catch {
    return false;
  }
}

function isHidden() {
  try {
    return Boolean(globalThis.document?.hidden);
  } catch {
    return false;
  }
}

/**
 * Crée un « métronome » pour une boucle d'animation : appelé à chaque requestAnimationFrame
 * avec l'horodatage, il répond s'il faut dessiner cette image.
 */
export function createFramePacer({ hidden = isHidden, covered = null } = {}) {
  let last = -Infinity;
  return (now) => {
    if (hidden()) return false;
    if (!maxFps) return true;
    // Scène couverte (scènes du domaine, `covered` fourni) : cadence très basse.
    const fps = covered?.() ? Math.min(maxFps, COVERED_FPS) : maxFps;
    // Petite tolérance : un écran à 60 Hz donne une image sur deux, pas une sur trois.
    if (now - last < 1000 / fps - 4) return false;
    last = now;
    return true;
  };
}

/** Métronome des scènes du domaine (Centre, Bourg, Taverne…) : ralenti quand elles sont couvertes. */
export function createScenePacer(options = {}) {
  return createFramePacer({ covered: isSceneCovered, ...options });
}
