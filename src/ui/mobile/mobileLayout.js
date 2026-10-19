// Interface mobile (v0.83) : téléphone en paysage. Activée dans l'application Android, ou dans
// un navigateur avec `?mobile=1` (essais, tests). Elle ne touche qu'à la présentation : la classe
// `is-mobile` sur <html> active css/mobile.css, et quelques écrans s'habillent autrement
// (HubScreen : carte plein écran, dock flottant ; La Compagnie : liste et fiche ; la Lice : cartes).

const CLASS = 'is-mobile';

/** Décide une fois, au démarrage, si le jeu prend l'interface mobile. */
export function setupMobileLayout({ environment, search = globalThis.location?.search ?? '' } = {}) {
  const params = new URLSearchParams(search);
  const forced = params.get('mobile');
  const mobile = forced === '1' ? true : forced === '0' ? false : environment === 'android';
  setMobileLayout(mobile);
  return mobile;
}

export function setMobileLayout(on) {
  document.documentElement.classList.toggle(CLASS, Boolean(on));
}

export function isMobileLayout() {
  return document.documentElement.classList.contains(CLASS);
}

/**
 * Met le curseur dans un champ de saisie, sauf sur téléphone (v0.88) : là, le focus ouvrirait le
 * clavier d'office ; c'est au joueur de toucher le champ quand il veut écrire.
 */
export function focusField(field) {
  if (!field || isMobileLayout()) return false;
  field.focus();
  return true;
}
