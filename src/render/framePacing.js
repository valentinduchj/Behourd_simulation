// Cadence des animations (v0.87). Sur téléphone, les scènes (Centre, Bourg, Taverne, lice…) se
// dessinent à 30 images par seconde au plus : deux fois moins de calcul, autant de fluidité pour
// un jeu de gestion. Écran caché (application en arrière-plan) : plus rien n'est dessiné.

let maxFps = 0; // 0 : le rythme de l'écran (version ordinateur)

/** Plafond d'images par seconde des scènes (0 : aucun). */
export function setFrameCap(fps) {
  maxFps = Math.max(0, Number(fps) || 0);
}

export function getFrameCap() {
  return maxFps;
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
export function createFramePacer({ hidden = isHidden } = {}) {
  let last = -Infinity;
  return (now) => {
    if (hidden()) return false;
    if (!maxFps) return true;
    // Petite tolérance : un écran à 60 Hz donne une image sur deux, pas une sur trois.
    if (now - last < 1000 / maxFps - 4) return false;
    last = now;
    return true;
  };
}
