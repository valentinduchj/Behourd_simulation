/** Classe de base des écrans (voir core/ScreenManager.js pour le cycle de vie). */
export class BaseScreen {
  constructor({ id, services, navigate, params }) {
    this.id = id;
    this.services = services;
    this.navigate = navigate;
    this.params = params ?? {};
    this.cleanups = [];
  }

  render() {
    throw new Error(`${this.constructor.name}.render() n'est pas implémenté.`);
  }

  mounted() {}

  unmount() {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
  }

  /** addEventListener retiré automatiquement en quittant l'écran. */
  listen(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this.cleanups.push(() => target.removeEventListener(event, handler, options));
  }
}
