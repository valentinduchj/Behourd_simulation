// Recherche de chemin sur une grille de cases (8 directions) — indépendante de l'IA et du
// combat : elle ne connaît qu'une grille { width, height, isBlocked(x, y) }.
//
//   computeDistanceMap : coût depuis une case vers toutes les cases accessibles (Dijkstra) ;
//   findPath           : chemin le plus court vers l'une des cases visées (A*) ;
//   pathTo             : chemin reconstruit depuis une carte de distances.
//
// Un chemin est une liste de cases [{ x, y }] SANS la case de départ ; [] si l'on est déjà
// sur une case visée, null si aucune n'est accessible.

export const DIRECTIONS = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]);

export const tileKey = (x, y) => `${x},${y}`;

/** Distance en pas (8 directions) : distance de Tchebychev. */
export function chebyshev(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Grille de recherche. `blocked` : Set de clés « x,y » des cases occupées ; `free` : clés
 * toujours praticables (la case de départ du combattant, par exemple).
 */
export function createGrid({ width, height, blocked = new Set(), free = [] }) {
  const freeSet = new Set(free);
  return {
    width,
    height,
    isInside: (x, y) => x >= 0 && y >= 0 && x < width && y < height,
    isBlocked: (x, y) => !freeSet.has(tileKey(x, y)) && blocked.has(tileKey(x, y)),
  };
}

/** Voisins praticables d'une case, avec le coût du pas. */
export function neighbours(grid, x, y, { diagonalCost = 1.001, allowSqueeze = false } = {}) {
  const result = [];
  for (const [dx, dy] of DIRECTIONS) {
    const nx = x + dx;
    const ny = y + dy;
    if (!grid.isInside(nx, ny) || grid.isBlocked(nx, ny)) continue;
    const diagonal = dx !== 0 && dy !== 0;
    // Pas en diagonale entre deux cases occupées : refusé (on ne se faufile pas entre deux combattants).
    if (diagonal && !allowSqueeze && grid.isBlocked(x + dx, y) && grid.isBlocked(x, y + dy)) continue;
    result.push({ x: nx, y: ny, cost: diagonal ? diagonalCost : 1 });
  }
  return result;
}

/**
 * Carte des coûts depuis `start` : Map « x,y » → { x, y, cost, prev }. `maxCost` limite la
 * recherche (cases au-delà ignorées).
 */
export function computeDistanceMap(grid, start, { maxCost = Infinity, ...options } = {}) {
  const map = new Map([[tileKey(start.x, start.y), { x: start.x, y: start.y, cost: 0, prev: null }]]);
  const open = [map.get(tileKey(start.x, start.y))];
  const done = new Set();
  while (open.length) {
    // Grille de quelques dizaines de cases : une recherche linéaire du minimum suffit.
    let bestIndex = 0;
    for (let i = 1; i < open.length; i++) if (open[i].cost < open[bestIndex].cost) bestIndex = i;
    const node = open.splice(bestIndex, 1)[0];
    const key = tileKey(node.x, node.y);
    if (done.has(key)) continue;
    done.add(key);
    for (const next of neighbours(grid, node.x, node.y, options)) {
      const cost = node.cost + next.cost;
      if (cost > maxCost) continue;
      const nextKey = tileKey(next.x, next.y);
      const known = map.get(nextKey);
      if (known && known.cost <= cost) continue;
      const entry = { x: next.x, y: next.y, cost, prev: key };
      map.set(nextKey, entry);
      open.push(entry);
    }
  }
  return map;
}

/** Chemin vers `goal` d'après une carte de distances (null si la case n'y figure pas). */
export function pathTo(map, goal) {
  let entry = map.get(tileKey(goal.x, goal.y));
  if (!entry) return null;
  const path = [];
  while (entry.prev !== null) {
    path.unshift({ x: entry.x, y: entry.y });
    entry = map.get(entry.prev);
  }
  return path;
}

/**
 * Chemin le plus court (A*) de `start` vers l'une des cases `goals`. Les cases visées
 * occupées sont inaccessibles (sauf la case de départ). `maxNodes` borne la recherche.
 */
export function findPath(grid, start, goals, { maxNodes = 400, ...options } = {}) {
  const targets = goals.filter((g) => grid.isInside(g.x, g.y));
  if (!targets.length) return null;
  const goalKeys = new Set(targets.map((g) => tileKey(g.x, g.y)));
  if (goalKeys.has(tileKey(start.x, start.y))) return [];
  const heuristic = (x, y) => Math.min(...targets.map((g) => chebyshev({ x, y }, g)));
  const nodes = new Map([[tileKey(start.x, start.y), { x: start.x, y: start.y, cost: 0, prev: null }]]);
  const open = [{ key: tileKey(start.x, start.y), f: heuristic(start.x, start.y) }];
  const closed = new Set();
  let expanded = 0;
  while (open.length && expanded < maxNodes) {
    let bestIndex = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bestIndex].f) bestIndex = i;
    const { key } = open.splice(bestIndex, 1)[0];
    if (closed.has(key)) continue;
    closed.add(key);
    expanded += 1;
    const node = nodes.get(key);
    if (goalKeys.has(key)) return pathTo(nodes, node);
    for (const next of neighbours(grid, node.x, node.y, options)) {
      const nextKey = tileKey(next.x, next.y);
      const cost = node.cost + next.cost;
      const known = nodes.get(nextKey);
      if (known && known.cost <= cost) continue;
      nodes.set(nextKey, { x: next.x, y: next.y, cost, prev: key });
      open.push({ key: nextKey, f: cost + heuristic(next.x, next.y) });
    }
  }
  return null;
}
