// Partitions de l'écu. Chaque motif décrit des formes (données pures, sans DOM) dans un
// repère 100 x 120 ; le rendu SVG est fait par ui/components/EmblemView.js.
// Pour ajouter un motif : ajouter une entrée ici, rien d'autre à modifier.

const rect = (x, y, width, height, fill) => ({ tag: 'rect', attrs: { x, y, width, height, fill } });
const poly = (points, fill) => ({ tag: 'polygon', attrs: { points, fill } });

export const EMBLEM_PATTERNS = Object.freeze([
  {
    id: 'pal',
    label: 'Tiercé en pal',
    shapes: (c) => [
      rect(0, 0, 34, 120, c.primary),
      rect(33.3, 0, 33.6, 120, c.secondary),
      rect(66.6, 0, 33.4, 120, c.tertiary),
    ],
  },
  {
    id: 'fasce',
    label: 'Tiercé en fasce',
    shapes: (c) => [
      rect(0, 0, 100, 41, c.primary),
      rect(0, 40, 100, 41, c.secondary),
      rect(0, 80, 100, 40, c.tertiary),
    ],
  },
  {
    id: 'bande',
    label: 'Tiercé en bande',
    shapes: (c) => [
      {
        tag: 'g',
        attrs: { transform: 'rotate(40 50 60)' },
        children: [
          rect(-100, -100, 300, 141, c.primary),
          rect(-100, 40, 300, 41, c.secondary),
          rect(-100, 80, 300, 200, c.tertiary),
        ],
      },
    ],
  },
  {
    id: 'chef',
    label: 'Au chef et au pal',
    shapes: (c) => [
      rect(0, 0, 100, 120, c.primary),
      rect(38, 0, 24, 120, c.tertiary),
      rect(0, 0, 100, 36, c.secondary),
    ],
  },
  {
    id: 'croix',
    label: 'À la croix',
    shapes: (c) => [
      rect(0, 0, 100, 120, c.primary),
      rect(40, 0, 20, 120, c.secondary),
      rect(0, 42, 100, 20, c.secondary),
      rect(44, 46, 12, 12, c.tertiary),
    ],
  },
  {
    id: 'sautoir',
    label: 'Au sautoir',
    shapes: (c) => [
      rect(0, 0, 100, 120, c.primary),
      { tag: 'g', attrs: { transform: 'rotate(40 50 60)' }, children: [rect(-100, 51, 300, 18, c.secondary)] },
      { tag: 'g', attrs: { transform: 'rotate(-40 50 60)' }, children: [rect(-100, 51, 300, 18, c.secondary)] },
      { tag: 'circle', attrs: { cx: 50, cy: 60, r: 9, fill: c.tertiary } },
    ],
  },
  {
    id: 'chevron',
    label: 'Au chevron',
    shapes: (c) => [
      rect(0, 0, 100, 120, c.primary),
      rect(0, 0, 100, 26, c.tertiary),
      { tag: 'polygon', attrs: { points: '0,88 50,44 100,88 100,108 50,64 0,108', fill: c.secondary } },
    ],
  },
  {
    id: 'ecartele',
    label: 'Écartelé',
    shapes: (c) => [
      rect(0, 0, 50.5, 60.5, c.primary),
      rect(50, 0, 50, 60.5, c.secondary),
      rect(0, 60, 50.5, 60, c.secondary),
      rect(50, 60, 50, 60, c.primary),
      { tag: 'circle', attrs: { cx: 50, cy: 60, r: 11, fill: c.tertiary } },
    ],
  },
  // --- v0.71 : sept partitions de plus (15 en tout, 3 lignes de 5) ---
  {
    // Émanché : partition verticale en longues dents de scie emboîtées.
    id: 'emanche',
    label: 'Émanché',
    shapes: (c) => [
      rect(0, 0, 100, 120, c.primary),
      poly('100,0 46,0 22,15 46,30 22,45 46,60 22,75 46,90 22,105 46,120 100,120', c.secondary),
      { tag: 'circle', attrs: { cx: 76, cy: 56, r: 8, fill: c.tertiary } },
    ],
  },
  {
    // Tiercé en barre (variante 1) : trois bandes obliques, de l'angle senestre du chef.
    id: 'barre',
    label: 'Tiercé en barre',
    shapes: (c) => [
      {
        tag: 'g',
        attrs: { transform: 'rotate(-40 50 60)' },
        children: [
          rect(-100, -100, 300, 141, c.primary),
          rect(-100, 40, 300, 41, c.secondary),
          rect(-100, 80, 300, 200, c.tertiary),
        ],
      },
    ],
  },
  {
    // Tiercé en pairle (variante 2) : trois parts en Y, depuis les angles du chef et la pointe.
    id: 'pairle',
    label: 'Tiercé en pairle',
    shapes: (c) => [
      poly('0,0 100,0 50,56', c.primary),
      poly('0,0 50,56 50,120 0,120', c.secondary),
      poly('100,0 100,120 50,120 50,56', c.tertiary),
    ],
  },
  {
    // Chapé : une « chape » sur les flancs, le champ montant en pointe jusqu'au chef.
    id: 'chape',
    label: 'Chapé',
    shapes: (c) => [
      rect(0, 0, 100, 120, c.primary),
      poly('50,0 100,120 0,120', c.secondary),
      { tag: 'circle', attrs: { cx: 50, cy: 88, r: 9, fill: c.tertiary } },
    ],
  },
  {
    // Coupé : deux moitiés horizontales séparées d'un filet.
    id: 'coupe',
    label: 'Coupé',
    shapes: (c) => [
      rect(0, 0, 100, 61, c.primary),
      rect(0, 60, 100, 60, c.secondary),
      rect(0, 55, 100, 10, c.tertiary),
    ],
  },
  {
    // Tranché : partagé en diagonale, de l'angle dextre du chef à l'angle senestre de la pointe.
    id: 'tranche',
    label: 'Tranché',
    shapes: (c) => [
      poly('0,0 100,0 100,120', c.primary),
      poly('0,0 100,120 0,120', c.secondary),
      poly('0,0 9,0 100,111 100,120 91,120 0,9', c.tertiary),
    ],
  },
  {
    // Taillé : partagé en diagonale, de l'angle senestre du chef à l'angle dextre de la pointe.
    id: 'taille',
    label: 'Taillé',
    shapes: (c) => [
      poly('0,0 100,0 0,120', c.primary),
      poly('100,0 100,120 0,120', c.secondary),
      poly('100,0 100,9 9,120 0,120 0,111 91,0', c.tertiary),
    ],
  },
]);

export const DEFAULT_PATTERN_ID = 'pal';

export function getEmblemPattern(id) {
  return EMBLEM_PATTERNS.find((pattern) => pattern.id === id) ?? EMBLEM_PATTERNS[0];
}

// Contour de l'écu (forme "heater shield").
export const SHIELD_PATH = 'M5 5 H95 V55 C95 90 72 108 50 116 C28 108 5 90 5 55 Z';
