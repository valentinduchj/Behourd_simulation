import { hashString } from '../../utils/random.js';

// Mise en scène d'un décor autour de la grille de combat — PRÉSENTATION uniquement.
//
// Repère de la vue : la grille de combat (arena.width × arena.height) est entourée
// d'une bande réservée aux spectateurs (layout.crowdBand) puis d'une ceinture de décor
// (layout.ringWidth ; layout.ringDepth, facultatif, pour les côtés nord et sud quand la ceinture
// n'est pas la même partout). La palissade suit le bord de la grille de combat.
//
//   arrière : au-delà des bords x = 0 et y = 0 (en haut à l'écran) et coins latéraux
//   avant   : au-delà des bords x = largeur et y = hauteur (entre la caméra et La Lice)

/** Zone d'un point en coordonnées de la grille de combat : 'arena' | 'back' | 'front'. */
export function zoneOf(arena, x, y) {
  if (x >= 0 && y >= 0 && x < arena.width && y < arena.height) return 'arena';
  const front = (y >= arena.height && x >= 0) || (x >= arena.width && y >= 0);
  return front ? 'front' : 'back';
}

/**
 * Construit la scène d'un décor : dimensions de la vue, cadrage et éléments de décor.
 * Déterministe : un même décor donne toujours la même disposition.
 * Renvoie { offset: { x, y }, border, width, height, focus, props } (coordonnées des props :
 * grille de la vue). `offset` : décalage du terrain de combat dans la vue (case 0,0 du terrain) ;
 * `border` = offset.x (décors symétriques).
 */
export function buildLiceScenery(arena, decoration) {
  const { crowdBand, ringWidth, ringDepth = ringWidth } = decoration.layout;
  const offset = { x: crowdBand + ringWidth, y: crowdBand + ringDepth };
  const border = offset.x;
  const width = arena.width + offset.x * 2;
  const height = arena.height + offset.y * 2;
  const taken = new Set();
  const props = [];

  const isRing = (x, y) => {
    const lx = x - offset.x;
    const ly = y - offset.y;
    return lx < -crowdBand || ly < -crowdBand || lx >= arena.width + crowdBand || ly >= arena.height + crowdBand;
  };
  const isOuterRow = (x, y) => x === 0 || y === 0 || x === width - 1 || y === height - 1;
  const zoneAt = (x, y) => zoneOf(arena, x + 0.5 - offset.x, y + 0.5 - offset.y);
  const isPath = pathTest(arena, decoration, offset);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isRing(x, y) || isPath(x, y) || taken.has(`${x},${y}`)) continue;
      const zone = zoneAt(x, y);
      const row = isOuterRow(x, y) ? 'outer' : 'inner';
      const entries = (decoration.props?.[zone] ?? []).filter((entry) => !entry.row || entry.row === row);
      const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
      if (!total) continue;
      let roll = hashString(`${decoration.id}:${x},${y}`) % total;
      const entry = entries.find((candidate) => (roll -= candidate.weight) < 0);
      if (!entry?.type) continue;
      const w = entry.w ?? 1;
      const h = entry.h ?? 1;
      // Un élément sur plusieurs cases doit tenir entièrement dans la ceinture, dans la même zone.
      const cells = [];
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) cells.push([x + dx, y + dy]);
      const fits = cells.every(([cx, cy]) => cx < width && cy < height && isRing(cx, cy) && !isPath(cx, cy) && !taken.has(`${cx},${cy}`) && zoneAt(cx, cy) === zone);
      if (!fits) continue;
      cells.forEach(([cx, cy]) => taken.add(`${cx},${cy}`));
      const variant = entry.variants?.length ? entry.variants[hashString(`${decoration.id}:v:${x},${y}`) % entry.variants.length] : null;
      const prop = { type: entry.type, x, y, zone, ...variant };
      if (w > 1 || h > 1) Object.assign(prop, { w, h });
      if (entry.type === 'flowers') prop.layer = 'ground';
      props.push(prop);
    }
  }

  // Cadrage : La Lice, sa foule et une case de décor ; le reste peut déborder du cadre.
  const margin = crowdBand + 1;
  const focus = { x: offset.x - margin, y: offset.y - margin, w: arena.width + margin * 2, h: arena.height + margin * 2 };
  return { offset, border, width, height, focus, props, isPath };
}

/**
 * Cases du chemin d'un décor (`decoration.path`), dans la grille de la vue : une bande de
 * `width` cases au-delà de la bande des spectateurs, sur toute la longueur du côté choisi.
 * `offset` : { x, y } (décalage du terrain dans la vue), ou un nombre (décor symétrique).
 */
export function pathTest(arena, decoration, offset) {
  const ox = typeof offset === 'number' ? offset : offset.x;
  const oy = typeof offset === 'number' ? offset : offset.y;
  const path = decoration.path;
  if (!path) return () => false;
  const band = decoration.layout.crowdBand;
  const W = arena.width;
  const H = arena.height;
  const inRange = (value, from) => value >= from && value < from + path.width;
  // `span` : seulement une portion du côté (le long de ce côté, en cases du terrain).
  const along = (value) => !path.span || (value >= path.span.from && value < path.span.to);
  return (x, y) => {
    const lx = x - ox;
    const ly = y - oy;
    switch (path.side) {
      case 'south': return inRange(ly, H + band) && along(lx);
      case 'north': return inRange(ly, -band - path.width) && along(lx);
      case 'east': return inRange(lx, W + band) && along(ly);
      case 'west': return inRange(lx, -band - path.width) && along(ly);
      default: return false;
    }
  };
}
