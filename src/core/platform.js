// Abstraction de l'environnement d'exécution (navigateur aujourd'hui, application de
// bureau demain). Pour Electron, le preload devra exposer window.electronAPI.quit().

const ENVIRONMENT_LABELS = {
  electron: 'Application Electron',
  tauri: 'Application Tauri',
  nwjs: 'Application NW.js',
  browser: 'Navigateur web',
};

export function detectEnvironment() {
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
