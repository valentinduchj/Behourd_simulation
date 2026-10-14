import { COMBAT_RULES, FIGHTER_AI_CONFIG } from '../../../data/combatRules.js';
import { isActive, reachOf, sees } from '../CombatMovementManager.js';
import { chebyshev, computeDistanceMap, createGrid, tileKey } from './PathfindingService.js';

// Contexte d'une décision : ce qu'un combattant sait de la manche à cet instant (positions
// réelles, PV, cibles), la grille de la lice avec les cases occupées, et sa carte de
// distances (calculée seulement si une décision en a besoin).

export function createAIContext({ unit, fighters, arena, occupied, tick = 0, rng = Math.random, rules = COMBAT_RULES, config = FIGHTER_AI_CONFIG }) {
  const own = tileKey(unit.x, unit.y);
  const grid = createGrid({ width: arena.width, height: arena.height, blocked: occupied, free: [own] });
  let distances = null;
  const ctx = {
    unit,
    fighters,
    arena,
    occupied,
    grid,
    tick,
    rng,
    rules,
    config,
    enemies: fighters.filter((other) => other.side !== unit.side && isActive(other)),
    allies: fighters.filter((other) => other.side === unit.side && other.id !== unit.id && isActive(other)),
    /** Carte des coûts depuis la case du combattant (cases libres seulement). */
    get distances() {
      if (!distances) distances = computeDistanceMap(grid, unit, config.pathfinding);
      return distances;
    },
    /** Case libre (ou celle du combattant) dans la lice. */
    isFree: (x, y) => grid.isInside(x, y) && !grid.isBlocked(x, y),
    /**
     * Casques fermés : adversaire perçu, c'est-à-dire vu (dans son cône de vision) ou senti
     * (il l'a frappé il y a peu : unit.perceived).
     */
    perceives(enemy) {
      return sees(unit, enemy, rules) || (unit.perceived?.get(enemy.id) ?? -Infinity) >= tick;
    },
    /** Cases d'où l'on touche `target` (allonge du combattant), libres ou celle du combattant. */
    attackTiles(target) {
      const range = reachOf(unit, rules);
      const tiles = [];
      for (let x = target.x - range; x <= target.x + range; x++) {
        for (let y = target.y - range; y <= target.y + range; y++) {
          if ((x !== target.x || y !== target.y) && ctx.isFree(x, y)) tiles.push({ x, y });
        }
      }
      return tiles;
    },
    /** Adversaires actifs à ≤ `radius` cases d'une case (sauf `except`). */
    enemiesAround(tile, radius, except = null) {
      return ctx.enemies.filter((e) => e !== except && e.id !== except?.id && chebyshev(e, tile) <= radius);
    },
    alliesAround(tile, radius) {
      return ctx.allies.filter((a) => chebyshev(a, tile) <= radius);
    },
  };
  return ctx;
}
