/**
 * Boucle à pas fixe : la simulation avance par incréments réguliers (déterministe),
 * l'affichage suit le rythme de l'écran. `getSpeed` applique la vitesse de jeu.
 */
export class CombatLoop {
  constructor({ update, render, step = 1 / 30, getSpeed = () => 1 }) {
    this.update = update;
    this.render = render;
    this.step = step;
    this.getSpeed = getSpeed;
    this.running = false;
    this.frameId = null;
    this.accumulator = 0;
    this.lastTime = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.frameId = requestAnimationFrame(this.#tick);
  }

  stop() {
    this.running = false;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  #tick = (now) => {
    if (!this.running) return;
    const delta = Math.min(0.25, (now - this.lastTime) / 1000) * this.getSpeed();
    this.lastTime = now;
    this.accumulator += delta;
    while (this.accumulator >= this.step) {
      this.update(this.step);
      this.accumulator -= this.step;
    }
    this.render(now / 1000);
    this.frameId = requestAnimationFrame(this.#tick);
  };
}
