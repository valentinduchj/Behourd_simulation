/**
 * Représentation d'un combattant pendant un affrontement. Elle enveloppe le Fighter
 * (données persistantes) avec l'état temporaire du combat : position, PV courants,
 * action en cours… Le Fighter n'est modifié qu'à la fin du combat (blessures, XP).
 */
export class Combatant {
  constructor({ fighter, team, sideIndex, position }) {
    this.id = fighter.id;
    this.fighter = fighter;
    this.team = team;
    this.sideIndex = sideIndex;
    this.position = { ...position };
    this.facing = sideIndex === 0 ? 'south' : 'north';
    this.hp = fighter.stats.hp;
    this.state = 'idle'; // idle | moving | attacking | grappling | down | out
    this.animationPhase = Math.random() * Math.PI * 2;
  }

  get isActive() {
    return this.state !== 'down' && this.state !== 'out';
  }

  update(dt, simulation) {
    // À venir : choix d'action (IA ou ordres du joueur), déplacement, attaque.
  }
}
