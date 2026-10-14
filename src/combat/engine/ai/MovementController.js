import { COMBAT_RULES } from '../../../data/combatRules.js';
import { tileKey } from './PathfindingService.js';

// Exécution des déplacements : la vitesse (COMBAT_RULES.moveTilesPerTick, 0,7 case par tour)
// s'accumule ; un combattant fait un pas dès qu'il a cumulé une case. À l'arrêt, il garde au
// plus `maxStoredMoves` d'avance. Une case n'accueille jamais deux combattants debout.

export class MovementController {
  /** occupied : Set « x,y » des cases des combattants actifs (tenu à jour à chaque pas). */
  constructor({ occupied, rules = COMBAT_RULES, onMove = () => {} }) {
    this.occupied = occupied;
    this.rules = rules;
    this.onMove = onMove;
    this.points = new Map();
  }

  pointsOf(unit) {
    return this.points.get(unit.id) ?? this.rules.maxStoredMoves;
  }

  /**
   * Tour de déplacement d'un combattant guidé par son contrôleur d'IA. env : passé à
   * controller.nextStep. Renvoie le nombre de pas faits.
   */
  advance(unit, controller, env) {
    const { maxStoredMoves } = this.rules;
    // Talent Infatigable marcheur : vitesse propre plus élevée.
    const moveTilesPerTick = this.rules.moveTilesPerTick * (1 + (unit.speedBonus ?? 0));
    const wantsToMove = controller.path.length > 0;
    let points = this.pointsOf(unit) + moveTilesPerTick;
    if (!wantsToMove) points = Math.min(maxStoredMoves, points);
    let steps = 0;
    // Tolérance : 0,7 cumulé dix fois donne 6,999… en virgule flottante.
    while (points >= 1 - 1e-9 && controller.path.length) {
      const next = controller.nextStep(unit, env);
      if (!next || this.occupied.has(tileKey(next.x, next.y))) break;
      const from = { x: unit.x, y: unit.y };
      this.occupied.delete(tileKey(from.x, from.y));
      unit.x = next.x;
      unit.y = next.y;
      this.occupied.add(tileKey(next.x, next.y));
      controller.stepDone(from);
      this.onMove(unit, from, { x: next.x, y: next.y });
      points -= 1;
      steps += 1;
    }
    this.points.set(unit.id, Math.min(points, maxStoredMoves + moveTilesPerTick));
    return steps;
  }
}
