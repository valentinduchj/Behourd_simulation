import { SCREENS } from '../../core/screenIds.js';
import { getNativeApp, quitGame } from '../../core/platform.js';
import { dismissTopModal } from '../components/Modal.js';
import { isTutorialActive } from '../tutorial/Tutorial.js';
import { translateText } from '../../i18n/i18n.js';

// Bouton retour d'Android (v0.82). Sans écouteur, Capacitor recule dans l'historique de la vue
// web ou ferme l'application d'un coup ; ici, il agit comme dans un jeu :
//   1. tutoriel en cours        → rien (on le termine ou le passe avec ses boutons) ;
//   2. une fenêtre est ouverte  → elle se ferme (comme Échap ; une fenêtre qui exige un choix reste) ;
//      le volet d'un lieu est ouvert (interface mobile) → il se referme ;
//   3. un lieu du domaine       → retour au Centre ; au Centre → « Menu principal » (sauvegarde proposée) ;
//   4. un autre écran           → son bouton « Retour », s'il en a un ;
//   5. le menu principal        → l'application se ferme.

const BACK_LABEL = 'Retour';

function isHubScreen(screen) {
  return Boolean(screen) && 'hubLocationId' in screen.constructor;
}

/** Bouton « Retour » visible de l'écran (texte français ou traduit). */
function findBackButton(root = document.getElementById('app')) {
  const labels = new Set([BACK_LABEL, translateText(BACK_LABEL)]);
  return [...(root?.querySelectorAll('button') ?? [])].find((button) => {
    const text = button.textContent.replace(/[◂‹←]/g, '').trim();
    return labels.has(text) && !button.disabled && button.offsetParent !== null;
  }) ?? null;
}

/**
 * Une pression sur le bouton retour. Renvoie ce qui a été fait : 'tutorial', 'modal', 'modal-blocked', 'sheet',
 * 'centre', 'menu', 'back', 'quit' ou 'none'.
 */
export async function handleBack(screens, { quit = quitGame } = {}) {
  if (isTutorialActive()) return 'tutorial';
  const modal = dismissTopModal();
  if (modal === 'closed') return 'modal';
  if (modal === 'blocked') return 'modal-blocked';
  const screen = screens.current;
  if (screen?.mobileSheetEl?.dataset.state === 'open') {
    screen.closeMobileSheet();
    return 'sheet';
  }
  if (screens.currentId === SCREENS.MAIN_MENU) {
    await quit();
    return 'quit';
  }
  if (isHubScreen(screen)) {
    if (screens.currentId !== SCREENS.CENTRE) {
      screens.show(SCREENS.CENTRE);
      return 'centre';
    }
    // Sans attendre : la fenêtre de sauvegarde qui s'ouvre se referme d'un second appui sur retour.
    screen.backToMenu?.();
    return 'menu';
  }
  const back = findBackButton();
  if (back) {
    back.click();
    return 'back';
  }
  return 'none';
}

/** Branche le bouton retour d'Android (sans effet dans un navigateur). */
export function installBackButton(screens) {
  const app = getNativeApp();
  if (!app?.addListener) return false;
  let busy = false;
  app.addListener('backButton', async () => {
    if (busy) return;
    busy = true;
    try { await handleBack(screens); } finally { busy = false; }
  });
  return true;
}
