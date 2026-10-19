// Abstraction de l'environnement d'exécution : navigateur, application Android (Capacitor, v0.82),
// application de bureau. Pour Electron, le preload devra exposer window.electronAPI.quit().

const ENVIRONMENT_LABELS = {
  android: 'Application Android',
  electron: 'Application Electron',
  tauri: 'Application Tauri',
  nwjs: 'Application NW.js',
  browser: 'Navigateur web',
};

/** Module natif « App » de Capacitor (bouton retour, fermeture), ou null hors de l'application Android. */
export function getNativeApp() {
  const capacitor = window.Capacitor;
  if (!capacitor?.isNativePlatform?.()) return null;
  return capacitor.Plugins?.App ?? null;
}

export function detectEnvironment() {
  if (window.Capacitor?.isNativePlatform?.() && window.Capacitor.getPlatform?.() === 'android') return 'android';
  if (typeof window.electronAPI?.quit === 'function') return 'electron';
  if (window.__TAURI__) return 'tauri';
  if (window.nw?.App) return 'nwjs';
  return 'browser';
}

export function getEnvironmentLabel() {
  return ENVIRONMENT_LABELS[detectEnvironment()];
}

/**
 * Quitte le jeu. Renvoie true si l'application a effectivement été fermée.
 * Dans un navigateur, window.close() n'est autorisé que pour les fenêtres ouvertes
 * par script : l'appelant affiche alors un écran de fin.
 */
export async function quitGame() {
  switch (detectEnvironment()) {
    case 'android': {
      const app = getNativeApp();
      if (app?.exitApp) {
        await app.exitApp();
        return true;
      }
      break;
    }
    case 'electron':
      window.electronAPI.quit();
      return true;
    case 'tauri': {
      const exit = window.__TAURI__?.process?.exit;
      if (exit) {
        await exit(0);
        return true;
      }
      break;
    }
    case 'nwjs':
      window.nw.App.quit();
      return true;
  }

  window.close();
  await new Promise((resolve) => setTimeout(resolve, 200));
  return window.closed;
}
