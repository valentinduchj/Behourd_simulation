import { Player } from '../../models/Player.js';
import { GameSession } from '../../state/GameSession.js';
import { DEFAULT_LEAGUE_ID } from '../../data/leagues.js';
import { SPECIALTY_IDS } from '../../data/specialties.js';
import { pick } from '../../utils/random.js';
import { composeFighterName, generateFighterName, generateTeamName } from '../generation/NameGenerator.js';
import { createPlayerCaptain } from '../roster/CaptainService.js';
import { pickRandomSpriteId } from '../generation/FighterGenerator.js';
import { createRandomEmblem, createTeamWithRoster } from './teamFactory.js';
import { initializeWorld } from './worldSetup.js';
import { GAME_CONFIG } from '../../config/gameConfig.js';
import { assignTeamLocation, pickDefaultStartLocationId } from '../geography/GeographyService.js';
import { isStartLocation } from '../geography/LocationService.js';

/**
 * Nouvelle partie : joueur + équipe + capitaine créé par le joueur (`captain` : { name,
 * specialtyId, spriteId }) + combattants générés pour compléter l'effectif de départ
 * + ligue + calendrier + Taverne. Sans `captain`, un capitaine est tiré au hasard
 * (partie de test, mêmes règles : compétences 15–35, 21 ans, potentiel ≥ 2).
 * `locationId` : lieu de départ choisi sur la carte (sa Terre en découle) ; sans lieu
 * valide, un lieu de départ est attribué d'après le nom de la compagnie.
 */
export function createNewGame({ teamName, emblem, leagueId = DEFAULT_LEAGUE_ID, rng = Math.random, captain = null, locationId = null }) {
  const player = new Player();
  const randomSpecialty = captain ? null : pick(rng, SPECIALTY_IDS);
  const draft = captain ?? {
    name: composeFighterName(generateFighterName(rng, new Set())),
    specialtyId: randomSpecialty,
    spriteId: pickRandomSpriteId(randomSpecialty, rng),
  };
  const captainFighter = createPlayerCaptain({ ...draft, rng });
  // Compagnie de départ : plage de compétences propre (GAME_CONFIG.roster.startingSkillRange) ; le capitaine garde la sienne.
  const { team, fighters } = createTeamWithRoster({ name: teamName, emblem, ownerId: player.id, rng, captain: captainFighter, levelStatRange: GAME_CONFIG.roster.startingSkillRange });
  player.teamId = team.id;
  assignTeamLocation(team, isStartLocation(locationId) ? locationId : pickDefaultStartLocationId(team.name));

  const session = new GameSession({ player, teams: [team], fighters });
  initializeWorld(session, rng, { leagueId });
  session.markDirty(); // jamais sauvegardée
  return session;
}

/** Nouvelle partie entièrement aléatoire (module Admin, tests). */
export function createRandomGame({ rng = Math.random, leagueId = DEFAULT_LEAGUE_ID } = {}) {
  return createNewGame({ teamName: generateTeamName(rng), emblem: createRandomEmblem(rng), leagueId, rng });
}
