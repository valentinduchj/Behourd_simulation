/**
 * Accès au module Admin. Le jeu étant exécuté côté client, il s'agit d'un verrou
 * de confort pour les outils de développement, pas d'une protection de sécurité.
 */
export class AdminAuth {
  #accessCode;
  #unlocked = false;

  constructor(accessCode) {
    this.#accessCode = accessCode;
  }

  verify(code) {
    const ok = String(code ?? '').trim() === this.#accessCode;
    if (ok) this.#unlocked = true;
    return ok;
  }

  isUnlocked() {
    return this.#unlocked;
  }

  lock() {
    this.#unlocked = false;
  }
}
