import { AI_RECRUITMENT_CONFIG, ROSTER_EVENT_TYPES } from '../../data/aiRecruitment.js';
import { RESERVE_POOL } from '../../data/leagues.js';
import { createId } from '../../utils/id.js';
import { selectTopFighters } from '../rating/RatingService.js';
import { clubDatabase, createClubFighter, createClubFighterData } from './ClubDatabase.js';
import { getClubFighters, getWeakestFighter, recalculateLevel } from './ClubService.js';
import { listLeagueDefinitions } from '../league/LeagueService.js';
import { addAIRecruitmentEvent } from '../report/DailyReportService.js';
import { ensureAICaptain } from '../roster/CaptainService.js';
import { rollInitialAge } from '../fighters/PotentialService.js';

// Effectifs des clubs de l'IA (réglages : data/aiRecruitment.js) :
//   retraite : à 36 ans, départ aussitôt → remplacement direct si l'effectif passe sous 9 ;
//   recrutement naturel : tirage (1 % par club, indépendant) → recrue construite autour d'un
//     des 4e à 7e plus forts → ajout → congédiement du plus faible au-delà de 12 ;
//   chaque entrée et sortie est inscrite dans l'historique d'effectif du club
//   (session.clubRosterEvents : RECRUITMENT, DEPART_NIVEAU, DEPART_RETRAITE).
//
// L'effectif d'un club de l'IA modifié pendant la partie est enregistré dans la sauvegarde
// (session.aiRosters, session.aiFighters) ; niveaux et étoiles en sont recalculés.

/** Clubs de l'IA concernés, dans un ordre stable (divisions par niveau, puis hors championnat). */
export function listAIClubs(session, config = AI_RECRUITMENT_CONFIG) {
  const playerId = session.player.teamId;
  const clubs = listLeagueDefinitions().flatMap((def) => session.getLeague(def.id)?.teamIds ?? []);
  if (config.includeOutOfChampionship) {
    const engaged = new Set(clubs);
    clubs.push(...clubDatabase.getClubIdsOfLeague(RESERVE_POOL.id).filter((id) => !engaged.has(id)));
  }
  return clubs.filter((id) => id !== playerId && !session.teams.some((team) => team.id === id));
}

/** Tirage individuel d'un club pour la journée. */
export function shouldRecruit(rng = Math.random, config = AI_RECRUITMENT_CONFIG) {
  return rng() < config.dailyRecruitChance;
}

/**
 * Combattants de référence d'une recrue : positions `referenceRange.from` à `to` du club
 * (classement par niveau). Effectif plus court : celles qui existent, ou à défaut le plus faible.
 */
export function getReferenceCandidates(session, clubId, config = AI_RECRUITMENT_CONFIG) {
  const ranked = selectTopFighters(getClubFighters(session, clubId), Infinity);
  const { from, to } = config.referenceRange;
  const range = ranked.slice(from - 1, to);
  return range.length ? range : ranked.slice(-1);
}

/** Niveau de référence : celui d'un combattant tiré au hasard parmi les positions 4 à 7. */
export function getReferenceLevel(session, clubId, rng = Math.random, config = AI_RECRUITMENT_CONFIG) {
  const candidates = getReferenceCandidates(session, clubId, config);
  if (!candidates.length) return 0;
  return candidates[Math.floor(rng() * candidates.length)].level;
}

/** Nouvelle recrue (même générateur que les autres combattants de l'IA), sans l'ajouter au club. */
export function generateRecruit(session, clubId, rng = Math.random, config = AI_RECRUITMENT_CONFIG) {
  const reference = getReferenceLevel(session, clubId, rng, config);
  const offset = config.levelSpread ? (rng() * 2 - 1) * config.levelSpread : 0;
  const score = Math.max(0, Math.min(100, Math.round(reference + offset)));
  const data = createClubFighterData({
    id: createId(`${clubId}_r`),
    takenNames: getClubFighters(session, clubId).map((f) => f.name),
    score,
    rng,
  });
  const fighter = createClubFighter(clubId, data, session.calendar.currentDay);
  // Âge de la recrue : même tirage que tout combattant créé (vieillissement, AIProgressionService).
  fighter.age = rollInitialAge(rng);
  return fighter;
}

/** Effectif de la partie d'un club (créé à partir de la base de clubs au premier changement). */
function ensureRoster(session, clubId) {
  if (!session.aiRosters[clubId]) session.aiRosters[clubId] = getClubFighters(session, clubId).map((f) => f.id);
  return session.aiRosters[clubId];
}

/**
 * Inscrit une entrée ou une sortie dans l'historique d'effectif du club. Nom, âge et
 * spécialité sont figés au moment de l'événement.
 */
export function recordRosterEvent(session, clubId, type, fighter, metadata = {}) {
  const event = {
    id: createId('roster'),
    day: session.calendar.currentDay,
    type,
    fighterId: fighter.id,
    fighterName: fighter.name,
    fighterAge: typeof fighter.age === 'number' ? fighter.age : null,
    specialty: fighter.specialtyId,
    metadata: { ...metadata },
  };
  (session.clubRosterEvents[clubId] ??= []).push(event);
  session.markDirty();
  return event;
}

/** Historique d'effectif d'un club, du plus ancien au plus récent. */
export function getClubRosterEvents(session, clubId) {
  return session.clubRosterEvents[clubId] ?? [];
}

/** Ajoute une recrue à l'effectif. eason : 'natural' (tirage de 1 %) ou 'replacement' (après une retraite). */
export function addRecruitToClub(session, clubId, fighter, { reason = 'natural' } = {}) {
  ensureRoster(session, clubId).push(fighter.id);
  session.aiFighters.push(fighter);
  recordRosterEvent(session, clubId, ROSTER_EVENT_TYPES.RECRUITMENT, fighter, { reason });
  session.markDirty();
}

/** Retire un combattant de son club dans la partie (effectif, sauvegarde, capitaine). */
function removeFighterFromClub(session, clubId, fighter) {
  session.aiRosters[clubId] = ensureRoster(session, clubId).filter((id) => id !== fighter.id);
  // Un combattant recruté pendant la partie puis parti disparaît de la sauvegarde.
  session.aiFighters = session.aiFighters.filter((f) => f.id !== fighter.id);
  // Son évolution dans la partie n'a plus lieu d'être conservée.
  delete session.aiFighterStates[fighter.id];
  // Capitaine parti : le 1er ou le 2e de l'effectif restant devient capitaine.
  if (session.aiCaptains[clubId] === fighter.id) delete session.aiCaptains[clubId];
  ensureAICaptain(session, clubId);
  session.markDirty();
}

/** Au-delà de l'effectif maximal, congédie le plus faible (départ lié au niveau). Renvoie le congédié, ou null. */
export function removeWeakestIfNeeded(session, clubId, config = AI_RECRUITMENT_CONFIG) {
  if (getClubFighters(session, clubId).length <= config.maxClubFighters) return null;
  const weakest = getWeakestFighter(session, clubId);
  recordRosterEvent(session, clubId, ROSTER_EVENT_TYPES.DEPART_NIVEAU, weakest);
  removeFighterFromClub(session, clubId, weakest);
  return weakest;
}

/** Recrutement complet d'un club. Renvoie { clubId, fighter, dismissed, before, after, reason }. */
export function recruitForClub(session, clubId, rng = Math.random, config = AI_RECRUITMENT_CONFIG, { reason = 'natural' } = {}) {
  const before = recalculateLevel(session, clubId);
  const fighter = generateRecruit(session, clubId, rng, config);
  addRecruitToClub(session, clubId, fighter, { reason });
  const dismissed = removeWeakestIfNeeded(session, clubId, config);
  return { clubId, fighter, dismissed, before, after: recalculateLevel(session, clubId), reason };
}

/** Le combattant a-t-il l'âge de la retraite ? */
export function hasRetirementAge(fighter, config = AI_RECRUITMENT_CONFIG) {
  return typeof fighter.age === 'number' && fighter.age >= config.retirementAge;
}

/**
 * Retraites : chaque combattant de l'IA ayant atteint l'âge de la retraite quitte son club
 * (DEPART_RETRAITE). Si l'effectif passe alors sous minRosterAfterRetirement, une recrue
 * le remplace aussitôt (même générateur, sans tirage de probabilité).
 * Renvoie [{ clubId, fighter, replacement }].
 */
export function runAIRetirements(session, { rng = Math.random, config = AI_RECRUITMENT_CONFIG } = {}) {
  const retirements = [];
  for (const clubId of listAIClubs(session, config)) {
    for (const fighter of getClubFighters(session, clubId).filter((f) => hasRetirementAge(f, config))) {
      recordRosterEvent(session, clubId, ROSTER_EVENT_TYPES.DEPART_RETRAITE, fighter);
      removeFighterFromClub(session, clubId, fighter);
      const replacement = getClubFighters(session, clubId).length < config.minRosterAfterRetirement
        ? recruitForClub(session, clubId, rng, config, { reason: 'replacement' }).fighter
        : null;
      retirements.push({ clubId, fighter, replacement });
    }
  }
  return retirements;
}
/**
 * Événement du carnet de bord d'un recrutement — seulement si le club est dans la division
 * actuelle du joueur (règle dynamique : elle suit les montées et descentes).
 */
export function buildAIRecruitmentEvent(session, recruitment) {
  const league = session.getLeagueOfTeam(recruitment.clubId);
  if (!league || league !== session.playerLeague) return null;
  return {
    type: 'ai.recruitment',
    clubId: recruitment.clubId,
    leagueId: league.id,
    specialtyId: recruitment.fighter.specialtyId,
  };
}

/** Phase quotidienne : un tirage par club ; renvoie les recrutements de la journée. */
export function runDailyAIRecruitment(session, { rng = Math.random, report = null, config = AI_RECRUITMENT_CONFIG } = {}) {
  const recruitments = [];
  for (const clubId of listAIClubs(session, config)) {
    if (!shouldRecruit(rng, config)) continue;
    const recruitment = recruitForClub(session, clubId, rng, config);
    recruitments.push(recruitment);
    addAIRecruitmentEvent(report, buildAIRecruitmentEvent(session, recruitment));
  }
  return recruitments;
}
