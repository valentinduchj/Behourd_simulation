import { DEFAULT_VFX_LEVEL, VFX_LEVELS } from '../../data/vfx.js';

// Niveau d'effets visuels en vigueur (Options › « Effets visuels », display.vfx), partagé par
// toutes les scènes. Tenu à jour par systems/settings/settingsEffects.js.

let currentSetting = DEFAULT_VFX_LEVEL;

/** Niveau d'effets retenu : celui des Options, réduit si le système demande moins d'animations. */
export function resolveVfxLevel(setting, { reducedMotion = prefersReducedMotion() } = {}) {
  const level = VFX_LEVELS[setting] ? setting : DEFAULT_VFX_LEVEL;
  return reducedMotion && level === 'full' ? 'reduced' : level;
}

function prefersReducedMotion() {
  try {
    return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}

export function setVfxSetting(setting) {
  currentSetting = setting;
  // Effets en CSS (reflets des talents…) : niveau lisible sur <html data-vfx="full|reduced|off">.
  try {
    if (globalThis.document?.documentElement) globalThis.document.documentElement.dataset.vfx = getVfxLevelId();
  } catch { /* hors navigateur */ }
}

/** Identifiant du niveau en vigueur ('full', 'reduced' ou 'off'). */
export function getVfxLevelId() {
  return resolveVfxLevel(currentSetting);
}

/** Réglages du niveau en vigueur : { count, flash, shake }. */
export function getVfxLevel() {
  return VFX_LEVELS[getVfxLevelId()];
}

setVfxSetting(currentSetting);
