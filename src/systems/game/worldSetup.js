import { DEFAULT_LEAGUE_ID } from '../../data/leagues.js';
import { ensureSchedule } from '../calendar/scheduler.js';
import { generateRecruitmentPool } from '../tavern/TavernService.js';
import { createWorld, adoptLegacySeason, backfillClubHistory } from '../league/SeasonService.js';
import { ensureQueenCombatPlanned } from '../queen/QueenCombatService.js';
import { ensureFighterProfiles } from '../fighters/PotentialService.js';
import { ensureCaptains } from '../roster/CaptainService.js';
import { enforceActivityCapacities } from '../activities/ActivityService.js';
import { ensureAIFighterProfiles } from '../clubs/AIProgressionService.js';
import { runAIRetirements } from '../clubs/AIRecruitmentService.js';
import { ensurePlayerLocation } from '../geography/GeographyService.js';
import { ensureMatchLocations } from '../league/MatchLocationService.js';
import { recordCupHistory, cancelLegacyCup } from '../frenchCup/FrenchCupManager.js';
import { ensureTrophies } from '../trophies/TrophyService.js';
import { completeDueStudies } from '../talents/StudyService.js';
import { ensureClimateState } from '../climate/ClimateService.js';
import { checkAchievements } from '../achievements/AchievementService.js';
import { seedAITalents } from '../clubs/AITalentService.js';

/**
 * Complète l'état du monde d'une partie : divisions et saison, événements récurrents,
 * offre de la Taverne… Idempotent : appelé à la création d'une partie et après chaque
 * chargement (une sauvegarde ancienne reçoit ainsi les systèmes ajoutés depuis).
 */
export function initializeWorld(session, rng = Math.random, { leagueId = DEFAULT_LEAGUE_ID } = {}) {
  const dirtyBefore = session.dirty;
  if (!session.leagues.length) createWorld(session, leagueId, rng);
  else if (!session.season) adoptLegacySeason(session, rng);
  ensureSchedule(session.calendar, rng, session);
  ensureQueenCombatPlanned(session, rng);
  if (!session.recruitment.isGenerated) generateRecruitmentPool(session, rng);
  // Combattants d'une sauvegarde antérieure : âge et potentiel tirés une fois puis enregistrés.
  const profiled = ensureFighterProfiles(session, rng);
  const backfilled = backfillClubHistory(session);
  // Sauvegarde sans capitaine : le membre le plus ancien devient capitaine (CaptainService).
  const captained = ensureCaptains(session);
  // Places limitées ajoutées depuis (ex. Forêt à 4 places) : affectations en trop remises au repos.
  const unassigned = enforceActivityCapacities(session);
  // Saisons de l'année (v0.70) : affectations à un lieu fermé par la saison en cours libérées
  // (ancienne sauvegarde chargée en été…), passage de saison en cours tenu pour fait.
  const unseasoned = ensureClimateState(session).length;
  // Combattants de l'IA sans âge (nouvelle partie, sauvegarde antérieure) : âge tiré une fois.
  const aiProfiled = ensureAIFighterProfiles(session, rng);
  // Sauvegarde contenant des combattants de l'IA déjà à l'âge de la retraite : ils partent.
  const retired = runAIRetirements(session, { rng }).length;
  // Talents de combat des clubs de l'IA (v1.2.1) : tirés une fois (nouvelle partie, ou sauvegarde antérieure).
  const aiTalents = seedAITalents(session);
  // Sauvegarde antérieure à la v0.32 : la compagnie reçoit un lieu de départ (sans tirage aléatoire).
  const located = ensurePlayerLocation(session);
  // Sauvegarde antérieure au domicile / extérieur : lieu des matchs de Ligue de la saison (règle, sans hasard).
  const venues = ensureMatchLocations(session);
  // Sauvegarde antérieure à la v0.55 : résultat de la dernière Coupe terminée dans l'historique
  // des clubs, et trophées retrouvés dans les titres déjà enregistrés (jamais en double).
  // Sauvegarde antérieure à la v0.57 : une Coupe ouverte à la demande, inachevée, est annulée.
  const cancelledCup = cancelLegacyCup(session);
  const cupHistory = session.frenchCup ? recordCupHistory(session, session.frenchCup) : 0;
  const trophies = ensureTrophies(session);
  // Études du Scriptorium : une sauvegarde ouverte après la date de fin termine l'étude (talent
  // révélé une seule fois, annoncé à l'écran) ; celle d'un combattant parti est annulée.
  const studies = session.studies.filter((s) => s.status === 'active').length;
  completeDueStudies(session);
  const studiesClosed = studies - session.studies.filter((s) => s.status === 'active').length;
  // Succès (v0.73) : ceux qui se lisent dans la partie sont accordés (ancienne sauvegarde) et
  // annoncés au premier écran ; les compteurs partent de 0.
  const achieved = checkAchievements(session).length;
  session.dirty = dirtyBefore || profiled > 0 || backfilled || captained || unassigned > 0 || unseasoned > 0 || aiProfiled > 0 || retired > 0 || aiTalents > 0 || located || venues > 0 || cancelledCup || cupHistory > 0 || trophies > 0 || studiesClosed > 0 || achieved > 0;
}
