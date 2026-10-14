/**
 * Navigation entre écrans. Un écran est une classe dont le constructeur reçoit
 * { id, services, navigate, params } et qui expose :
 *   render()   → HTMLElement (obligatoire)
 *   mounted()  → appelé une fois l'élément inséré dans la page (optionnel)
 *   unmount()  → nettoyage avant de quitter l'écran (optionnel)
 *
 * Options d'enregistrement :
 *   guard(services, params) → false pour refuser l'accès ; redirectTo : écran de repli, ou
 *   fonction (services, params) → écran de repli.
 */
export class ScreenManager {
  constructor(root, services, { beforeShow } = {}) {
    this.root = root;
    this.services = services;
    this.beforeShow = beforeShow;
    this.registry = new Map();
    this.current = null;
    this.currentId = null;
  }

  register(id, ScreenClass, options = {}) {
    this.registry.set(id, { ScreenClass, options });
  }

  show(id, params = {}) {
    const entry = this.registry.get(id);
    if (!entry) throw new Error(`Écran inconnu : ${id}`);

    const { guard, redirectTo } = entry.options;
    if (guard && !guard(this.services, params)) {
      // redirectTo : un écran, ou une fonction (services, params) → écran (repli selon l'état).
      const target = typeof redirectTo === 'function' ? redirectTo(this.services, params) : redirectTo;
      if (target && target !== id) return this.show(target);
      throw new Error(`Accès refusé à l'écran : ${id}`);
    }

    this.beforeShow?.(id, params);
    this.current?.unmount?.();

    // Thème visuel de l'écran (propriété statique `theme`), appliqué à toute la page.
    document.body.dataset.theme = entry.ScreenClass.theme ?? 'dark';

    const screen = new entry.ScreenClass({
      id,
      services: this.services,
      navigate: (to, nextParams) => this.show(to, nextParams),
      params,
    });
    this.root.replaceChildren(screen.render());
    this.current = screen;
    this.currentId = id;
    window.scrollTo(0, 0);
    screen.mounted?.();
    // L'écran affiché (ex. voyage : le fondu d'arrivée se pose sur sa carte).
    return screen;
  }
}
