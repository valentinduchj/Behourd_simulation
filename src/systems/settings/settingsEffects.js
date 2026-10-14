// Effets concrets des options sur le jeu. Un réglage sans effet ici est simplement
// enregistré. Le son (audio.*) est appliqué par le moteur sonore (audio/AudioEngine.js, attach).

import { setVfxSetting } from '../../render/vfx/vfxLevel.js';

const EFFECTS = {
  // Niveau des effets visuels (combats, Centre, Bourg, Taverne, carnet de bord).
  'display.vfx': (value) => setVfxSetting(value),
  'display.uiScale': (value) => {
    document.documentElement.style.setProperty('--ui-scale', String(value));
  },
};

export function applySettingsEffects(settings) {
  for (const [key, apply] of Object.entries(EFFECTS)) apply(settings.get(key));
  settings.onChange((key, value) => EFFECTS[key]?.(value));
}
