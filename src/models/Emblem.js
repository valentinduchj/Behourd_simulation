import { resolveColor } from '../data/palette.js';
import { DEFAULT_PATTERN_ID } from '../data/emblemPatterns.js';

export const EMBLEM_COLOR_SLOTS = Object.freeze([
  { key: 'primary', label: 'Principale' },
  { key: 'secondary', label: 'Secondaire' },
  { key: 'tertiary', label: 'Tertiaire' },
]);

export const DEFAULT_EMBLEM_COLORS = Object.freeze({
  primary: 'gueules',
  secondary: 'or',
  tertiary: 'sable',
});

/**
 * Emblème d'une équipe.
 * `type` permet d'introduire plus tard d'autres représentations (blason complet,
 * meubles héraldiques, image importée…) sans changer le reste du code.
 */
export class Emblem {
  constructor(data = {}) {
    this.type = data.type ?? 'tinctures';
    this.patternId = data.patternId ?? DEFAULT_PATTERN_ID;
    this.colors = { ...DEFAULT_EMBLEM_COLORS, ...(data.colors ?? {}) };
  }

  /** Couleurs converties en valeurs CSS (#rrggbb). */
  resolvedColors() {
    return Object.fromEntries(
      EMBLEM_COLOR_SLOTS.map(({ key }) => [key, resolveColor(this.colors[key])]),
    );
  }

  toJSON() {
    return { type: this.type, patternId: this.patternId, colors: { ...this.colors } };
  }

  static fromJSON(data) {
    return new Emblem(data ?? {});
  }
}
