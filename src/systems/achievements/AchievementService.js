import { ACHIEVEMENTS, ACHIEVEMENT_RULES, getAchievement } from '../../data/achievements.js';
import { LEAGUE_DEFINITIONS } from '../../data/leagues.js';
import { POTENTIAL_CONFIG } from '../../data/fighterProfile.js';
import { getResource } from '../economy/wallet.js';
import { listArtisans, listUpgradesOf, getPurchaseCount } from '../borough/UpgradeService.js';
import { hasDeskUpgrade } from '../talents/ScriptoriumUpgradeService.js';
import { getFighterTalents, getTalent } from '../talents/TalentService.js';
import { isElite } from '../rating/EliteService.js';
import { calculateFighterLevel, getStarRating } from '../fighters/ratings.js';
import { getFighterRecord } from '../fighters/FighterRecordService.js';
import { getPotential } from '../fighters/PotentialService.js';
import { listTrophies } from '../trophies/TrophyService.js';
import { getCurrentSeason, yearOf } from '../climate/ClimateService.js';

// Succès (v0.73) — logique, sans interface (catalogue : data/achievements.js).
//
// Enregistré avec la partie : session.achievements = {
//   unlocked: { [id]: { day, year, climateSeason, leagueSeason } }   (obtenu une seule fois)
//   counters: { bakerPurchases, activitySuccesses, commonTalents: [talentId…], winSeasons: [seasonId…],
//               expeditionPlaces: [placeId…] (v1.0) }
// }
// Les compteurs partent de 0 pour une ancienne sauvegarde. Les succès « d'état » (deniers,
// talents, étoiles…) se lisent dans la partie : ils sont aussi accordés au chargement.
//
// Notification : chaque succès obtenu est mis en attente sur la partie (non sauvegardé) et
// signalé aux écouteurs (onAchievementUnlocked) ; l'interface l'annonce à l'écran
// (ui/hub/achievementNotifier.js). Pendant une journée, il est aussi inscrit au carnet de bord.

const listeners = new Set();

/** Écoute les succès obtenus : fn(session, achievement). Renvoie la fonction de désinscription. */
export function onAchievementUnlocked(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** État des succès d'une partie (créé et normalisé au besoin). */
export function getAchievementState(session) {
  const raw = session.achievements ?? {};
  const counters = raw.counters ?? {};
  session.achievements = {
    unlocked: raw.unlocked && typeof raw.unlocked === 'object' ? raw.unlocked : {},
    counters: {
      bakerPurchases: Number(counters.bakerPurchases) || 0,
      activitySuccesses: Number(counters.activitySuccesses) || 0,
      commonTalents: Array.isArray(counters.commonTalents) ? [...new Set(counters.commonTalents)] : [],
      winSeasons: Array.isArray(counters.winSeasons) ? [...new Set(counters.winSeasons)] : [],
      expeditionPlaces: Array.isArray(counters.expeditionPlaces) ? [...new Set(counters.expeditionPlaces)] : [],
    },
  };
  return session.achievements;
}

export function isUnlocked(session, id) {
  return Boolean(session.achievements?.unlocked?.[id]);
}

/** Nombre de succès obtenus / total. */
export function countUnlocked(session) {
  return { unlocked: ACHIEVEMENTS.filter((entry) => isUnlocked(session, entry.id)).length, total: ACHIEVEMENTS.length };
}

/**
 * Accorde un succès (une seule fois). `report` : carnet de bord de la journée (entrée
 * 'achievement.unlocked'). Renvoie le succès obtenu, ou null (déjà obtenu, inconnu).
 */
export function unlockAchievement(session, id, { report = null } = {}) {
  const entry = getAchievement(id);
  if (!entry || !session?.player) return null;
  const state = getAchievementState(session);
  if (state.unlocked[id]) return null;
  const day = session.calendar?.currentDay ?? 1;
  state.unlocked[id] = { day, year: yearOf(day), climateSeason: session.calendar ? getCurrentSeason(session).id : null, leagueSeason: session.season?.number ?? null };
  session.markDirty?.();
  (session.pendingAchievements ??= []).push(id);
  report?.add({ type: 'achievement.unlocked', achievementId: id, name: entry.name, icon: entry.icon });
  for (const listener of listeners) {
    try { listener(session, entry); } catch (error) { console.error(error); }
  }
  return entry;
}

/** Succès obtenus pas encore annoncés à l'écran : renvoyés une fois, puis oubliés. */
export function takePendingAchievements(session) {
  const ids = session.pendingAchievements ?? [];
  session.pendingAchievements = [];
  return ids.map(getAchievement).filter(Boolean);
}

/** Retire un succès de la file d'annonce (il vient d'être annoncé). */
export function markAchievementAnnounced(session, id) {
  if (session.pendingAchievements) session.pendingAchievements = session.pendingAchievements.filter((pending) => pending !== id);
}

// --- Succès d'état (lus dans la partie) ---

/** Améliorations achetées au Bourg (tous niveaux confondus). */
export function countBoroughPurchases(session) {
  return listArtisans().flatMap((artisan) => listUpgradesOf(artisan.id)).reduce((sum, upgrade) => sum + getPurchaseCount(session, upgrade.id), 0);
}

/** Talents exotiques différents portés dans la compagnie (succès 43). */
export function exoticTalentCount(session) {
  return new Set((session.playerFighters ?? []).flatMap((fighter) => getFighterTalents(session, fighter)).filter((talent) => talent.rarity === 'exotic').map((talent) => talent.id)).size;
}

const completedStudies = (session) => (session.studies ?? []).filter((study) => study.status === 'completed' && study.talentId);

/** Conditions des succès d'état : { id: () => boolean }. */
function stateConditions(session) {
  const R = ACHIEVEMENT_RULES;
  const fighters = session.playerFighters ?? [];
  const deniers = getResource(session, 'deniers') ?? 0;
  const purchases = () => countBoroughPurchases(session);
  const state = getAchievementState(session);
  return {
    'richesse-enfin': () => deniers >= R.richDeniers,
    'tresor-royal': () => deniers >= R.royalDeniers,
    'premier-chantier': () => purchases() >= 1,
    'grand-batisseur': () => purchases() >= R.builderUpgrades,
    'deux-bureaux': () => hasDeskUpgrade(session),
    'pain-dans-la-tronche': () => state.counters.bakerPurchases >= R.bakerPurchases,
    revelation: () => completedStudies(session).length > 0,
    'doublement-doue': () => fighters.some((fighter) => getFighterTalents(session, fighter).length >= 2),
    'touche-par-les-dieux': () => completedStudies(session).some((study) => getTalent(study.talentId)?.rarity === 'epic'),
    'graine-parmi-l-elite': () => fighters.some((fighter) => isElite(session, fighter)),
    'legende-vivante': () => fighters.some((fighter) => getStarRating(calculateFighterLevel(fighter)) >= R.legendStars),
    veteran: () => fighters.some((fighter) => (getFighterRecord(session, fighter)?.matches?.played ?? 0) >= R.veteranMatches),
    faucheur: () => fighters.some((fighter) => (getFighterRecord(session, fighter)?.takedowns ?? 0) >= R.reaperTakedowns),
    'cycle-des-saisons': () => (session.calendar?.currentDay ?? 0) >= R.yearDay,
    'petits-talents': () => state.counters.commonTalents.length >= R.commonTalents,
    'feu-sacre': () => fighters.some((fighter) => getPotential(fighter) >= POTENTIAL_CONFIG.max),
    'armoire-pleine': () => listTrophies(session).length >= R.trophies,
    'main-d-oeuvre': () => state.counters.activitySuccesses >= R.activitySuccesses,
    'quatre-saisons': () => state.counters.winSeasons.length >= 4,
    'pelerins-d-europe': () => state.counters.expeditionPlaces.length >= R.expeditionPlaces,
    'merveilles-d-ailleurs': () => exoticTalentCount(session) >= R.exoticTalents,
  };
}

/**
 * Vérifie les succès d'état et de compteur (appelé à la fin de chaque journée, après un
 * combat, un achat, un recrutement, et au chargement). Renvoie les succès obtenus.
 */
export function checkAchievements(session, { report = null } = {}) {
  if (!session?.player) return [];
  const unlocked = [];
  for (const [id, condition] of Object.entries(stateConditions(session))) {
    if (isUnlocked(session, id)) continue;
    if (condition()) {
      const entry = unlockAchievement(session, id, { report });
      if (entry) unlocked.push(entry);
    }
  }
  return unlocked;
}

/** Avancement d'un succès à seuil : { value, goal } (null sans seuil). Affichage seulement. */
export function getAchievementProgress(session, id) {
  const entry = getAchievement(id);
  if (!entry?.goal) return null;
  const state = getAchievementState(session);
  const fighters = session.playerFighters ?? [];
  const best = (fn) => fighters.reduce((max, fighter) => Math.max(max, fn(fighter)), 0);
  const values = {
    'richesse-enfin': () => getResource(session, 'deniers') ?? 0,
    'tresor-royal': () => getResource(session, 'deniers') ?? 0,
    'premier-chantier': () => countBoroughPurchases(session),
    'grand-batisseur': () => countBoroughPurchases(session),
    'pain-dans-la-tronche': () => state.counters.bakerPurchases,
    veteran: () => best((fighter) => getFighterRecord(session, fighter)?.matches?.played ?? 0),
    faucheur: () => best((fighter) => getFighterRecord(session, fighter)?.takedowns ?? 0),
    'petits-talents': () => state.counters.commonTalents.length,
    'armoire-pleine': () => listTrophies(session).length,
    'main-d-oeuvre': () => state.counters.activitySuccesses,
    'quatre-saisons': () => state.counters.winSeasons.length,
    'pelerins-d-europe': () => state.counters.expeditionPlaces.length,
    'merveilles-d-ailleurs': () => exoticTalentCount(session),
  };
  const value = values[id]?.() ?? 0;
  return { value: Math.min(value, entry.goal), goal: entry.goal };
}

// --- Événements du jeu ---

/**
 * Manche jouée dans la Lice (moteur de combat ; le joueur est le camp A) : succès 1, 2, 3, 5,
 * 6, 7, 33 et 36. Les combats simulés n'y comptent pas.
 */
export function recordPlayedRound(session, match, round) {
  const simulation = round?.simulation;
  if (!simulation || match.teamAId !== session.player?.teamId) return [];
  const units = simulation.initial ?? [];
  const ko = new Set(simulation.knockedOut ?? []);
  const own = units.filter((unit) => unit.side === 'A');
  const standing = own.filter((unit) => !ko.has(unit.id));
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const won = simulation.winnerSide === 'A';
  const ids = [];
  // Coups fatals du joueur : le dernier coup de l'auteur du KO sur sa cible.
  const lastHit = new Map();
  const fatal = [];
  for (const event of simulation.events ?? []) {
    if (event.type === 'attack') lastHit.set(`${event.unitId}>${event.targetId}`, event);
    if (event.type === 'ko' && byId.get(event.byId)?.side === 'A') fatal.push({ attacker: byId.get(event.byId), hit: lastHit.get(`${event.byId}>${event.unitId}`) ?? null });
  }
  const positions = (hit) => hit?.detail?.modifiers?.positionIds ?? [];
  if (fatal.some(({ attacker, hit }) => attacker.classId === 'lutteur' && positions(hit).includes('pinned'))) ids.push('contre-la-barriere');
  if (fatal.some(({ attacker, hit }) => attacker.classId === 'runner' && positions(hit).includes('rear'))) ids.push('par-derriere');
  if (won) {
    ids.push('premier-sang');
    if (standing.length === 1 && standing[0].classId === 'hastier') ids.push('hache-s-abattra');
    if (own.length && standing.length === own.length) ids.push('sans-egratignure');
    if (fatal.some(({ attacker }) => attacker.isCaptain)) ids.push('mon-capitaine');
    if (own.some((unit) => (unit.fatigue ?? 0) >= ACHIEVEMENT_RULES.tiredFatigue)) ids.push('increvable');
    const classes = new Set(standing.map((unit) => unit.classId));
    if (['hastier', 'lutteur', 'runner'].every((classId) => classes.has(classId))) ids.push('trois-armes');
  }
  return ids.map((id) => unlockAchievement(session, id)).filter(Boolean);
}

/**
 * Combat terminé (toutes compétitions, joué ou simulé) : succès 4 et 35 (combat joué dans la
 * Lice), 8 (combat de Ligue en hiver), 40 (victoires selon la saison de l'année).
 */
export function recordFinishedMatch(session, match) {
  const playerId = session.player?.teamId;
  if (!match?.isFinished || !playerId || (match.teamAId !== playerId && match.teamBId !== playerId)) return [];
  const unlocked = [];
  if (match.winnerId === playerId) {
    const side = match.teamAId === playerId ? 'A' : 'B';
    const played = match.rounds.length > 0 && match.rounds.every((round) => round.simulation);
    const season = getCurrentSeason(session).id;
    const state = getAchievementState(session);
    if (!state.counters.winSeasons.includes(season)) {
      state.counters.winSeasons.push(season);
      session.markDirty?.();
    }
    const ids = [];
    if (played && match.rounds[0]?.winner !== side) ids.push('remontada');
    if (played && match.rounds.every((round) => round.winner === side)) ids.push('sans-partage');
    if (match.kind === 'combat' && season === 'winter') ids.push('hiver-de-fer');
    unlocked.push(...ids.map((id) => unlockAchievement(session, id)).filter(Boolean));
  }
  unlocked.push(...checkAchievements(session));
  return unlocked;
}

/** Combat de la Reine terminé : succès 9 (victoire) et 37 (victoire contre une équipe à 5 étoiles). */
export function recordQueenResult(session, { won, opponentStars }) {
  if (!won) return [];
  const ids = ['plaisir-de-la-reine'];
  if ((opponentStars ?? 0) >= ACHIEVEMENT_RULES.queenStars) ids.push('oeil-sur-le-monde');
  return ids.map((id) => unlockAchievement(session, id)).filter(Boolean);
}

/** Fin de saison de Ligue : succès 10, 11, 12 et 38. endEvent : FinalizeSeason ; table : ligne finale du joueur. */
export function recordSeasonEnd(session, { rank, movement, leagueBefore, losses }) {
  const ids = [];
  if (movement === 'promoted') ids.push('montee-en-grade');
  if (rank === 1) ids.push('champion');
  if (losses === 0) ids.push('invaincu');
  const topLeague = [...LEAGUE_DEFINITIONS].sort((a, b) => a.tier - b.tier)[0];
  if (rank === 1 && leagueBefore === topLeague?.id) ids.push('toit-de-la-france');
  return [...ids.map((id) => unlockAchievement(session, id)).filter(Boolean), ...checkAchievements(session)];
}

/** Étape de la Coupe de France franchie : succès 13 (phase finale) et 14 (victoire). */
export function recordCupProgress(session, cup) {
  const playerId = cup?.playerTeamId ?? session.player?.teamId;
  if (!cup || !playerId) return [];
  const ids = [];
  if (cup.qualification?.qualified?.includes(playerId)) ids.push('hors-des-poules');
  if (cup.winnerId && cup.winnerId === playerId) ids.push('vainqueur-coupe');
  return [...ids.map((id) => unlockAchievement(session, id)).filter(Boolean), ...checkAchievements(session)];
}

/** Talent découvert (révélé au Scriptorium, ou porté par une recrue) : compteur des talents ordinaires. */
export function recordTalentDiscovered(session, talentId) {
  const talent = getTalent(talentId);
  if (!talent || talent.rarity !== 'common') return;
  const state = getAchievementState(session);
  if (state.counters.commonTalents.includes(talent.id)) return;
  state.counters.commonTalents.push(talent.id);
  session.markDirty?.();
}

/** Recrue engagée à la Taverne : succès 21 et 39 ; ses talents comptent comme découverts. */
export function recordRecruit(session, fighter) {
  const ids = ['sang-neuf'];
  const talents = (fighter?.talents ?? []).filter((id) => getTalent(id));
  if (talents.length) ids.push('chasseur-de-tetes');
  talents.forEach((id) => recordTalentDiscovered(session, id));
  return [...ids.map((id) => unlockAchievement(session, id)).filter(Boolean), ...checkAchievements(session)];
}

/** Départ en expédition (v1.0) : lieu compté pour Pèlerins d'Europe. */
export function recordExpeditionDeparture(session, placeId) {
  const state = getAchievementState(session);
  if (placeId && !state.counters.expeditionPlaces.includes(placeId)) {
    state.counters.expeditionPlaces.push(placeId);
    session.markDirty?.();
  }
  return checkAchievements(session);
}

/** Retour d'expédition (v1.0) : Première route, puis les états (talents exotiques…). */
export function recordExpeditionReturn(session, { report = null } = {}) {
  return [unlockAchievement(session, 'premiere-route', { report }), ...checkAchievements(session, { report })].filter(Boolean);
}

/**
 * Victoire d'une expédition singulière (v1.1.3) : Le Sentier des pins ; Trois debout (aucun combat
 * perdu, donc aucun KO) ; Loup solitaire (les dix combats, tous par le même combattant) ; Seigneur
 * des cimes (tranche la plus chère). `run` : l'expédition gagnée (session.expeditions.run).
 */
export function recordSingularVictory(session, run, { report = null } = {}) {
  const history = run?.history ?? [];
  const ids = ['sentier-des-pins'];
  if (history.length && history.every((fight) => fight.won)) ids.push('trois-debout');
  if (history.length && history.every((fight) => fight.won && fight.fighterId === history[0].fighterId)) ids.push('loup-solitaire');
  if (run?.band === 2) ids.push('seigneur-des-cimes');
  return ids.map((id) => unlockAchievement(session, id, { report })).filter(Boolean);
}

/** Achat chez un artisan du Bourg : compteur des achats au Boulanger (succès 20), puis états. */
export function recordShopPurchase(session, artisanId) {
  if (artisanId === 'baker') {
    getAchievementState(session).counters.bakerPurchases += 1;
    session.markDirty?.();
  }
  return checkAchievements(session);
}

/**
 * Fin de journée (phase 'achievements') : activités réussies de la journée (carnet), puis
 * succès d'état — inscrits au carnet de bord.
 */
export function recordDay(session, report = null) {
  const successes = report?.ofType?.('activity.reward')?.length ?? 0;
  if (successes) {
    getAchievementState(session).counters.activitySuccesses += successes;
    session.markDirty?.();
  }
  return checkAchievements(session, { report });
}
