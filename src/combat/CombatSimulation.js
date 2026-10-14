import { Combatant } from './Combatant.js';

/**
 * Simulation d'un affrontement de béhourd, indépendante de l'affichage.
 *
 * Étapes prévues d'un pas de simulation (update) :
 *   1. décisions (IA / ordres du joueur)
 *   2. déplacements sur la grille
 *   3. résolution des attaques, prises et mises au sol
 *   4. conditions de victoire (dernier camp avec des combattants debout)
 * Les événements produits (coups, chutes…) iront dans `events` pour l'interface et
 * le journal de combat.
 *
 * `sides` : [{ team, fighters }, { team, fighters }]
 */
export class CombatSimulation {
  constructor({ arena, sides }) {
    this.arena = arena;
    this.sides = sides;
    this.combatants = [];
    this.events = [];
    this.elapsed = 0;
    this.status = 'setup'; // setup | ready | running | finished
    this.winnerSideIndex = null;
  }

  setup() {
    this.combatants = this.sides.flatMap((side, sideIndex) => {
      const slots = this.arena.getDeploymentSlots(sideIndex, side.fighters.length);
      return side.fighters.map(
        (fighter, i) => new Combatant({ fighter, team: side.team, sideIndex, position: slots[i] }),
      );
    });
    this.status = 'ready';
  }

  update(dt) {
    this.elapsed += dt;
    if (this.status !== 'running') return;
    for (const combatant of this.combatants) combatant.update(dt, this);
  }

  getCombatantAt(x, y) {
    return (
      this.combatants.find(
        (c) => Math.floor(c.position.x) === x && Math.floor(c.position.y) === y,
      ) ?? null
    );
  }
}
