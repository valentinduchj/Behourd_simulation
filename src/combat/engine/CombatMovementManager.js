import { COMBAT_RULES } from '../../data/combatRules.js';

// Outils de géométrie d'une manche (grille de La Lice, cases entières) : contact, distance,
// combattant actif. Le choix des cibles et des chemins relève de l'IA des combattants
// (src/combat/engine/ai/) ; findNearestTarget et stepTowards restent des outils simples
// (adversaire le plus proche, pas direct) qu'elle n'utilise plus.

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Au contact : cases voisines, diagonales comprises (distance de Tchebychev ≤ portée). */
export function isInContact(a, b, rules = COMBAT_RULES) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= rules.contactRange;
}

/** Allonge d'un combattant (cases) : 2 pour le Hastier, le contact pour les autres. */
export function reachOf(unit, rules = COMBAT_RULES) {
  return rules.reachByClass?.[unit.classId] ?? rules.contactRange;
}

/** `attacker` peut-il frapper `target` d'où il est (selon son allonge) ? */
export function isInReach(attacker, target, rules = COMBAT_RULES) {
  return Math.max(Math.abs(attacker.x - target.x), Math.abs(attacker.y - target.y)) <= reachOf(attacker, rules);
}

/** Distance (cases) d'une case au bord le plus proche de la lice, donc à la barrière (0 : collée). */
export function barrierDistance(tile, arena) {
  return Math.min(tile.x, tile.y, arena.width - 1 - tile.x, arena.height - 1 - tile.y);
}

/**
 * Casques fermés : `observer` voit-il le point `other` ? Oui s'il est dans le cône de
 * ± vision.halfAngle autour de sa direction (`observer.facing`, vecteur), ou sur sa case.
 */
export function sees(observer, other, rules = COMBAT_RULES) {
  const dx = other.x - observer.x;
  const dy = other.y - observer.y;
  const length = Math.hypot(dx, dy);
  const facing = observer.facing;
  if (!length || !facing || (!facing.x && !facing.y)) return true;
  const cos = (dx * facing.x + dy * facing.y) / (length * Math.hypot(facing.x, facing.y));
  return cos >= Math.cos((rules.vision.halfAngle * Math.PI) / 180) - 1e-9;
}

/** Direction (vecteur unitaire) de `from` vers `to`, ou null s'ils sont sur la même case. */
export function directionTo(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length ? { x: dx / length, y: dy / length } : null;
}

export const isActive = (unit) => unit.status === 'active';

/** Adversaire actif le plus proche (à égalité : l'ordre des combattants). null s'il n'y en a plus. */
export function findNearestTarget(unit, units) {
  let best = null;
  let bestDistance = Infinity;
  for (const other of units) {
    if (other.side === unit.side || !isActive(other)) continue;
    const d = distance(unit, other);
    if (d < bestDistance) {
      best = other;
      bestDistance = d;
    }
  }
  return best;
}

/** Cible valide actuelle (active), ou null. */
export function getValidTarget(unit, byId) {
  const target = unit.targetId ? byId.get(unit.targetId) : null;
  return target && isActive(target) ? target : null;
}

/**
 * Prochaine case vers la cible : la case voisine libre (dans le terrain, non occupée par un
 * combattant actif) qui rapproche le plus. null si aucune ne rapproche.
 */
export function stepTowards(unit, target, { arena, occupied }) {
  const current = distance(unit, target);
  let best = null;
  let bestDistance = current;
  for (const [dx, dy] of NEIGHBOURS) {
    const x = unit.x + dx;
    const y = unit.y + dy;
    if (!arena.isInside(x, y) || occupied.has(`${x},${y}`)) continue;
    const d = Math.hypot(x - target.x, y - target.y);
    if (d < bestDistance - 1e-9) {
      best = { x, y };
      bestDistance = d;
    }
  }
  return best;
}
