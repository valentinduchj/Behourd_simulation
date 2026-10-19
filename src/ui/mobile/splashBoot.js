// Lancé avant le jeu (index.html, premier module) : dans l'application Android, l'écran de
// démarrage s'affiche aussitôt, pendant que les modules du jeu se chargent (v0.85), avec son
// air (« Girls », v0.88) au volume des Options. La musique du jeu attend qu'il soit passé.
import { showSplash } from './Splash.js';
import { GAME_CONFIG } from '../../config/gameConfig.js';

export const SPLASH_TUNE = 'assets/audio/splash/girls.m4a';

/** Volume de l'air : général × musique des Options (0 si le son est coupé). */
export function splashVolume(settings = readSettings()) {
  if (settings['audio.muted']) return 0;
  const pct = (key, fallback) => (typeof settings[key] === 'number' ? settings[key] : fallback) / 100;
  return pct('audio.master', 80) * pct('audio.music', 70);
}

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(`${GAME_CONFIG.storage.prefix}settings`)) ?? {};
  } catch {
    return {};
  }
}

const capacitor = globalThis.Capacitor;
if (capacitor?.isNativePlatform?.() && capacitor.getPlatform?.() === 'android') {
  globalThis.behourdSplash = showSplash({ tune: SPLASH_TUNE, volume: splashVolume() });
}
