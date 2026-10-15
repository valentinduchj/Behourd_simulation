import { GAME_CONFIG } from './config/gameConfig.js';
import { ScreenManager } from './core/ScreenManager.js';
import { SCREENS } from './core/screenIds.js';
import * as platform from './core/platform.js';
import { gameState } from './state/gameState.js';
import { StorageBackend } from './systems/storage/StorageBackend.js';
import { SaveSystem } from './systems/save/SaveSystem.js';
import { SettingsSystem } from './systems/settings/SettingsSystem.js';
import { applySettingsEffects } from './systems/settings/settingsEffects.js';
import { clubDatabase } from './systems/clubs/ClubDatabase.js';
import { preloadSprites } from './render/sprites.js';
import { preloadSpectators } from './render/spectators.js';
import { AdminAuth } from './admin/AdminAuth.js';
import { registerScreens } from './ui/screens/registerScreens.js';
import { closeAllModals } from './ui/components/Modal.js';
import { installAchievementNotifier } from './ui/hub/achievementNotifier.js';
import { installTutorial } from './ui/tutorial/Tutorial.js';
import { audio } from './audio/AudioEngine.js';
import { audioDirector } from './audio/AudioDirector.js';
import { setLanguage, readStoredLanguage, installDomTranslation, installCanvasTranslation, translateDocument } from './i18n/i18n.js';

async function boot() {
  // Langue (v0.79) : français par défaut ; anglais ou espagnol traduits à l'affichage.
  await setLanguage(readStoredLanguage(), { store: false });
  installCanvasTranslation();
  installDomTranslation(document.body);
  translateDocument();

  const storage = new StorageBackend(GAME_CONFIG.storage.prefix);

  // Données statiques chargées avant tout écran : clubs de l'IA (data/leagues/*.json).
  await clubDatabase.init(storage).load();
  preloadSprites();
  preloadSpectators();

  // Services partagés, transmis à chaque écran.
  const services = {
    config: GAME_CONFIG,
    platform,
    storage,
    gameState,
    clubs: clubDatabase,
    saves: new SaveSystem(storage),
    settings: new SettingsSystem(storage),
    adminAuth: new AdminAuth(GAME_CONFIG.admin.accessCode),
  };

  applySettingsEffects(services.settings);
  // Succès : annoncés à l'écran dès qu'ils sont obtenus dans la partie en cours.
  installAchievementNotifier(gameState);
  // Son (v0.74) : volumes des Options, puis musique et ambiance selon l'écran (fondus).
  audio.attach(services.settings);
  audioDirector.sessionOf = () => gameState.session;
  // Ouverture du jeu : la musique principale démarre tout de suite si le navigateur l'accepte,
  // sinon au premier clic (ou à la première touche) sur l'écran principal.

  const screens = new ScreenManager(document.getElementById('app'), services, { beforeShow: (id, params) => { closeAllModals(); audioDirector.onScreen(id, params); } });
  registerScreens(screens);
  // Tutoriel (v0.81) : sur-couche qui suit le joueur d'un écran à l'autre.
  installTutorial(screens);
  screens.show(SCREENS.MAIN_MENU);
  audio.tryAutoplay();

  // Accès depuis la console du navigateur, pour le développement.
  window.behourd = { services, screens, audio, audioDirector };
}

try {
  await boot();
} catch (error) {
  console.error(error);
  const el = document.getElementById('boot-error');
  el.textContent = `Erreur au démarrage : ${error.message}`;
  el.hidden = false;
}
