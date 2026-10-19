import { SCREENS } from '../../core/screenIds.js';
import { getNativeApp } from '../../core/platform.js';

// Application en arrière-plan (v0.87, téléphone) : Android peut fermer le jeu à tout moment
// quand on change d'application. La partie est donc sauvegardée dès que le jeu passe en
// arrière-plan, et le son se tait jusqu'au retour.

/**
 * Sauvegarde à la mise en pause : seulement une partie modifiée, si la sauvegarde automatique
 * est activée (Options), et jamais pendant un combat (il se rejoue alors depuis le début).
 */
export function canSaveOnPause({ session, screenId, autosave }) {
  return Boolean(session && session.dirty && autosave && screenId !== SCREENS.MATCH);
}

/** Sauvegarde la partie en cours si possible ; renvoie true si elle a été écrite. */
export function saveOnPause({ services, screens }) {
  const session = services.gameState.session;
  if (!canSaveOnPause({ session, screenId: screens.currentId, autosave: services.settings.get('gameplay.autosave') })) return false;
  try {
    services.saves.save(session);
    screens.current?.refreshStatus?.();
    return true;
  } catch {
    return false;
  }
}

/** Branche la mise en arrière-plan et le retour (onglet caché, ou pause / reprise d'Android). */
export function installAppLifecycle({ services, screens, audio }) {
  let background = false;
  const hide = () => {
    if (background) return;
    background = true;
    saveOnPause({ services, screens });
    audio?.setBackground?.(true);
  };
  const show = () => {
    if (!background) return;
    background = false;
    audio?.setBackground?.(false);
  };
  document.addEventListener('visibilitychange', () => (document.hidden ? hide() : show()));
  const app = getNativeApp();
  if (app?.addListener) {
    app.addListener('pause', hide);
    app.addListener('resume', show);
  }
  return { hide, show };
}
