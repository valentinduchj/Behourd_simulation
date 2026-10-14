import { SCREENS } from '../../core/screenIds.js';
import { MainMenuScreen } from './MainMenuScreen.js';
import { NewGameScreen } from './NewGameScreen.js';
import { NewTeamScreen } from './NewTeamScreen.js';
import { NewCaptainScreen } from './NewCaptainScreen.js';
import { TeamScreen } from './TeamScreen.js';
import { CentreScreen } from './CentreScreen.js';
import { TavernScreen } from './TavernScreen.js';
import { BoroughScreen } from './BoroughScreen.js';
import { ScriptoriumScreen } from './ScriptoriumScreen.js';
import { TrainingScreen } from './TrainingScreen.js';
import { LeagueScreen } from './LeagueScreen.js';
import { LoadScreen } from './LoadScreen.js';
import { OptionsScreen } from './OptionsScreen.js';
import { AdminScreen } from './AdminScreen.js';
import { CombatScreen } from './CombatScreen.js';
import { MatchScreen } from './MatchScreen.js';
import { FarewellScreen } from './FarewellScreen.js';
import { AlmanacScreen } from './AlmanacScreen.js';
import { FrenchCupScreen } from './FrenchCupScreen.js';
import { getSeasonCupState } from '../../systems/frenchCup/FrenchCupManager.js';

export function registerScreens(manager) {
  const requiresSession = {
    guard: (services) => services.gameState.hasSession(),
    redirectTo: SCREENS.MAIN_MENU,
  };
  // Écrans du domaine : partie en cours, et pas de Coupe de France de l'intersaison ouverte
  // (elle est bloquante jusqu'à la nouvelle saison : on y est ramené).
  const cupBlocks = (services) => ['inProgress', 'finished'].includes(getSeasonCupState(services.gameState.session));
  const domainScreen = {
    guard: (services) => services.gameState.hasSession() && !cupBlocks(services),
    redirectTo: (services) => (services.gameState.hasSession() ? SCREENS.FRENCH_CUP : SCREENS.MAIN_MENU),
  };
  const requiresAdmin = {
    guard: (services) => services.adminAuth.isUnlocked(),
    redirectTo: SCREENS.MAIN_MENU,
  };

  manager.register(SCREENS.MAIN_MENU, MainMenuScreen);
  manager.register(SCREENS.NEW_GAME, NewGameScreen);
  manager.register(SCREENS.NEW_TEAM, NewTeamScreen);
  manager.register(SCREENS.NEW_CAPTAIN, NewCaptainScreen, {
    guard: (_services, params) => Boolean(params?.teamName),
    redirectTo: SCREENS.NEW_GAME,
  });
  manager.register(SCREENS.TEAM, TeamScreen, domainScreen);
  manager.register(SCREENS.CENTRE, CentreScreen, domainScreen);
  manager.register(SCREENS.TAVERN, TavernScreen, domainScreen);
  manager.register(SCREENS.BOROUGH, BoroughScreen, domainScreen);
  manager.register(SCREENS.SCRIPTORIUM, ScriptoriumScreen, domainScreen);
  manager.register(SCREENS.TRAINING, TrainingScreen, domainScreen);
  manager.register(SCREENS.LEAGUE, LeagueScreen, domainScreen);
  manager.register(SCREENS.LOAD, LoadScreen);
  manager.register(SCREENS.OPTIONS, OptionsScreen);
  manager.register(SCREENS.ADMIN, AdminScreen, requiresAdmin);
  manager.register(SCREENS.COMBAT, CombatScreen);
  manager.register(SCREENS.MATCH, MatchScreen, requiresSession);
  manager.register(SCREENS.FAREWELL, FarewellScreen);
  // Coupe de France : mode autonome (ni Centre, ni Bourg, ni Taverne depuis cet écran).
  manager.register(SCREENS.FRENCH_CUP, FrenchCupScreen, requiresSession);
  // L'Almanach ne lit que les règles du jeu : il s'ouvre avec ou sans partie en cours.
  manager.register(SCREENS.ALMANAC, AlmanacScreen);
}
