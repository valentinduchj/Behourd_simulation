// Palette des couleurs (émaux) disponibles pour les emblèmes.
// Les équipes stockent l'identifiant de la couleur, pas sa valeur hexadécimale :
// on peut retoucher la teinte ici sans casser les sauvegardes.
export const PALETTE = Object.freeze([
  { id: 'gueules', name: 'Gueules', hex: '#b3202a' },
  { id: 'sanguine', name: 'Sanguine', hex: '#7a1f1f' },
  { id: 'orange', name: 'Orangé', hex: '#d4702a' },
  { id: 'or', name: 'Or', hex: '#e0b43a' },
  { id: 'argent', name: 'Argent', hex: '#e8e4da' },
  { id: 'sinople', name: 'Sinople', hex: '#2f7d3a' },
  { id: 'celeste', name: 'Bleu céleste', hex: '#7fb3d9' },
  { id: 'azur', name: 'Azur', hex: '#1f4e9c' },
  { id: 'pourpre', name: 'Pourpre', hex: '#6b2c6e' },
  { id: 'brunatre', name: 'Brunâtre', hex: '#6b4a2b' },
  { id: 'cendre', name: 'Cendré', hex: '#8a8d8f' },
  { id: 'sable', name: 'Sable', hex: '#1d1b1a' },
]);

const PALETTE_BY_ID = new Map(PALETTE.map((color) => [color.id, color]));
const FALLBACK = { id: 'inconnu', name: 'Inconnue', hex: '#888888' };

export function getPaletteColor(id) {
  return PALETTE_BY_ID.get(id) ?? FALLBACK;
}

/** Accepte un identifiant de palette ou directement une couleur "#rrggbb". */
export function resolveColor(idOrHex) {
  if (typeof idOrHex === 'string' && idOrHex.startsWith('#')) return idOrHex;
  return getPaletteColor(idOrHex).hex;
}
