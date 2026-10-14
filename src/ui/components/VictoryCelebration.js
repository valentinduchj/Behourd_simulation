import { h } from '../../utils/dom.js';
import { SCENE_VFX } from '../../data/vfx.js';
import { getVfxLevel, getVfxLevelId } from '../../render/vfx/vfxLevel.js';
import { createRng } from '../../utils/random.js';

/**
 * Pluie de victoire sur l'écran de résultat (présentation) : pétales pour un Combat de la Reine
 * gagné, étincelles d'or pour une victoire en Coupe de France. Réglages : data/vfx.js
 * (SCENE_VFX.victory) ; rien si les effets visuels sont désactivés, moitié moins en effets
 * réduits. Tirage avec une graine (`seed`) : toujours le même pour un même combat.
 */
export function VictoryCelebration(kind, { seed = kind } = {}) {
  const config = SCENE_VFX.victory[kind];
  const level = getVfxLevel();
  if (!config || level.count <= 0) return null;
  const rng = createRng(`victoire:${seed}`);
  const between = ([min, max]) => min + (max - min) * rng();
  const count = Math.round(config.count * level.count);
  return h('div', { class: `victory-rain is-${kind} ${getVfxLevelId() !== 'full' ? 'is-calm' : ''}`.trim(), 'aria-hidden': 'true' },
    Array.from({ length: count }, () => h('span', {
      class: `victory-drop is-${config.shape}`,
      style: {
        '--x': `${(rng() * 100).toFixed(1)}%`, '--drift': `${((rng() * 2 - 1) * 70).toFixed(0)}px`,
        '--spin': `${Math.round(between([180, 720]))}deg`, '--delay': `${between(config.delay).toFixed(2)}s`,
        '--duration': `${between(config.duration).toFixed(2)}s`, '--color': config.colors[Math.floor(rng() * config.colors.length)],
        '--scale': between([0.7, 1.25]).toFixed(2),
      },
    })));
}
