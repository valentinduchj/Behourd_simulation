import { findPath } from '../combat/engine/ai/PathfindingService.js';

// Une recrue présente dans la Taverne (présentation seulement) : elle flâne d'un emplacement
// à l'autre en contournant le mobilier, puis s'arrête quelques secondes. Ses déplacements
// n'ont aucun effet sur le combattant ni sur son recrutement.

export class TavernCharacter {
  /**
   * candidate : { id, fighter, cost } de l'offre de la Taverne ; spot : case de départ.
   */
  constructor(candidate, spot, { rng = Math.random, wander }) {
    this.candidateId = candidate.id;
    this.fighter = candidate.fighter;
    this.spot = spot;
    this.x = spot.x + 0.5;
    this.y = spot.y + 0.5;
    this.path = [];
    this.rng = rng;
    this.wander = wander;
    this.walking = false;
    this.phase = rng() * 6;
    this.pauseLeft = this.#pause() * rng();
  }

  #pause() {
    const { min, max } = this.wander.pause;
    return min + this.rng() * (max - min);
  }

  /**
   * Avance de `dt` secondes. scene : { grid, freeSpots(except) } pour choisir la prochaine
   * étape (un emplacement libre, jamais celui d'une autre recrue).
   */
  update(dt, scene) {
    if (!this.walking) {
      this.pauseLeft -= dt;
      if (this.pauseLeft > 0) return;
      const choices = scene.freeSpots(this);
      if (!choices.length) { this.pauseLeft = this.#pause(); return; }
      const target = choices[Math.floor(this.rng() * choices.length)];
      const path = findPath(scene.grid, this.spot, [target]);
      if (!path?.length) { this.pauseLeft = this.#pause(); return; }
      this.spot = target;
      this.path = path.map((tile) => ({ x: tile.x + 0.5, y: tile.y + 0.5 }));
      this.walking = true;
    }
    let step = this.wander.speed * dt;
    while (step > 0 && this.path.length) {
      const next = this.path[0];
      const dx = next.x - this.x;
      const dy = next.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= step) {
        this.x = next.x;
        this.y = next.y;
        this.path.shift();
        step -= dist;
      } else {
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
        step = 0;
      }
    }
    if (!this.path.length) {
      this.walking = false;
      this.pauseLeft = this.#pause();
    }
  }
}
