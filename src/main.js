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
import { installBackButton } from './ui/navigation/backButton.js';
import { setupMobileLayout } from './ui/mobile/mobileLayout.js';
import { installAppLifecycle } from './ui/mobile/appLifecycle.js';
import { installTalentTips } from './ui/mobile/TalentTip.js';
import { setFrameCap } from './render/framePacing.js';
import { setPixelRatioCap } from './render/IsoView.js';
import { setLowEndDevice, isLowEndDevice } from './render/vfx/vfxLevel.js';
import { audio } from './audio/AudioEngine.js';
import { audioDirector } from './audio/AudioDirector.js';
import { setLanguage, readStoredLanguage, installDomTranslation, installCanvasTranslation, translateDocument } from './i18n/i18n.js';
import { installQuickCards } from './ui/mobile/QuickCard.js';
import { setHapticsEnabled } from './ui/mobile/Haptics.js';

/** Application Android : largeur de mise en page provisoire et classe `is-android` (zones de l'encoche). */
function setupAndroidViewport() {
  if (platform.detectEnvironment() !== 'android') return;
  document.documentElement.classList.add('is-android');
  const width = GAME_CONFIG.android?.viewportWidth;
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) meta.content = `${width ? `width=${width}` : 'width=device-width, initial-scale=1'}, viewport-fit=cover`;
}

async function boot() {
  setupAndroidViewport();
  // Interface mobile (v0.83) : application Android, ou `?mobile=1` dans un navigateur.
  // (Application Android : l'écran de démarrage est lancé avant le jeu, ui/mobile/splashBoot.js.)
  const mobile = setupMobileLayout({ environment: platform.detectEnvironment() });
  // Téléphone (v0.87) : scènes à 30 images par seconde, effets réduits sur un petit appareil.
  if (mobile) {
    setFrameCap(30);
    // v1.1.9 (batterie) : canvas dessinés à la densité 2 au plus.
    setPixelRatioCap(2);
    setLowEndDevice(isLowEndDevice());
  }
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
  // Application Android (v0.82) : bouton retour du téléphone (sans effet dans un navigateur).
  installBackButton(screens);
  // Téléphone (v0.87) : en arrière-plan, la partie est sauvegardée et le son se tait.
  if (mobile) installAppLifecycle({ services, screens, audio });
  // Téléphone (v0.88) : toucher un talent affiche son effet dans une bulle.
  if (mobile) installTalentTips(document);
  // Téléphone (v0.93) : appui long sur un combattant (liste, carte, Centre) = sa fiche en bulle ;
  // vibrations aux gestes qui comptent (Haptics).
  if (mobile) {
    setHapticsEnabled(true);
    installQuickCards(document, () => gameState.session, {
      resolveAt: (x, y, event) => (event.target.matches?.('canvas') ? screens.current?.renderer?.pickFighter?.(x, y) ?? null : null),
    });
  } else setHapticsEnabled(false);
  screens.show(SCREENS.MAIN_MENU);
  // Application Android : la musique du jeu attend la fin de l'écran de démarrage et de son air.
  if (globalThis.behourdSplash) globalThis.behourdSplash.then(() => audio.tryAutoplay());
  else audio.tryAutoplay();

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
