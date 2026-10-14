import { hashString } from '../utils/random.js';

/**
 * Décor de lisière généré de façon déterministe (identique à chaque affichage) sur
 * les cases de bordure d'une grille. Utilisé par le Centre et par La Lice.
 *
 * ring    : { width, mix: [{ type, weight }] } (type null = case vide)
 * isFree  : (x, y) → booléen, false pour les cases occupées (chemins, décor fixe…)
 * seed    : sel du hachage, pour varier d'une scène à l'autre
 */
export function generateRingDecor({ width, height, ring, isFree = () => true, seed = '' }) {
  const totalWeight = ring.mix.reduce((sum, entry) => sum + entry.weight, 0);
  const props = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const inRing = x < ring.width || y < ring.width || x >= width - ring.width || y >= height - ring.width;
      if (!inRing || !isFree(x, y)) continue;
      let roll = hashString(`${seed}:${x},${y}`) % totalWeight;
      const entry = ring.mix.find((candidate) => (roll -= candidate.weight) < 0);
      if (!entry?.type) continue;
      const prop = { type: entry.type, x, y, generated: true };
      if (entry.type === 'flowers') Object.assign(prop, { layer: 'ground', blocking: false });
      props.push(prop);
    }
  }
  return props;
}
