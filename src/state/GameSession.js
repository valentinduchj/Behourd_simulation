import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import { Fighter } from '../models/Fighter.js';
import { Calendar } from '../models/Calendar.js';
import { RecruitmentPool } from '../models/RecruitmentPool.js';
import { League } from '../models/League.js';
import { clubDatabase } from '../systems/clubs/ClubDatabase.js';
import { createFighterRecord, cloneFighterRecord } from '../models/FighterRecord.js';

/**
 * Une partie en cours : le joueur, son club et ses combattants, le calendrier, l'offre
 * de recrutement et les championnats (clubs engagés par identifiant, classement).
 * C'est l'objet sérialisé dans une sauvegarde. Les clubs de l'IA n'y sont pas copiés.
 */
export class GameSession {
  constructor(data = {}) {
    this.player = data.player instanceof Player ? data.player : Player.fromJSON(data.player ?? {});
    this.teams = (data.teams ?? []).map((team) => (team instanceof Team ? team : Team.fromJSON(team)));
    this.fighters = (data.fighters ?? []).map((f) => (f instanceof Fighter ? f : Fighter.fromJSON(f)));
    this.calendar = data.calendar instanceof Calendar ? data.calendar : Calendar.fromJSON(data.calendar);
    this.recruitment = data.recruitment instanceof RecruitmentPool
      ? data.recruitment
      : RecruitmentPool.fromJSON(data.recruitment);
    this.leagues = (data.leagues ?? []).map((league) => (league instanceof League ? league : League.fromJSON(league)));
    // Saison en cours : { number, status: 'active' | 'finished', startedOnDay, … } (null tant
    // que le monde n'est pas initialisé). Terminée, elle garde son bilan jusqu'au lancement
    // de la suivante (SeasonService).
    this.season = data.season ? structuredClone(data.season) : null;
    // Classements finaux des saisons passées et mouvements entre divisions.
    this.seasonHistory = (data.seasonHistory ?? []).map((entry) => structuredClone(entry));
    // Historique de chaque club (joueur et IA) : { [clubId]: [{ season, leagueId, finalPosition,
    // movement: 'NONE' | 'PROMOTED' | 'RELEGATED' | 'WITHDRAWN', toLeagueId? }] }. Jamais réécrit.
    this.clubHistory = Object.fromEntries(Object.entries(data.clubHistory ?? {}).map(([id, entries]) => [id, entries.map((e) => ({ ...e }))]));
    // Effectifs des clubs de l'IA modifiés pendant la partie (recrutements) :
    // { [clubId]: [fighterId] }. Un club absent garde l'effectif de la base de clubs.
    this.aiRosters = Object.fromEntries(Object.entries(data.aiRosters ?? {}).map(([id, ids]) => [id, [...ids]]));
    // Combattants recrutés par les clubs de l'IA pendant la partie (absents des fichiers de clubs).
    this.aiFighters = (data.aiFighters ?? []).map((f) => (f instanceof Fighter ? f : Fighter.fromJSON(f)));
    // Capitaines des clubs de l'IA désignés pendant la partie (leur capitaine d'origine a
    // quitté l'effectif) : { [clubId]: fighterId }. Sinon, le capitaine vient des données du club.
    this.aiCaptains = { ...(data.aiCaptains ?? {}) };
    // Évolution, dans cette partie, des combattants de la base de clubs (hors recrues, qui
    // portent elles-mêmes niveau et âge) : { [fighterId]: { levelDelta, age } }. Le niveau
    // vaut celui de la base + levelDelta (une modification de l'Admin reste donc prise en compte).
    this.aiFighterStates = Object.fromEntries(Object.entries(data.aiFighterStates ?? {}).map(([id, state]) => [id, { ...state }]));
    // Événements de progression des combattants de l'IA sur la période de l'indicateur :
    // [{ fighterId, day, previousLevel, newLevel, delta }] (AIProgressionService).
    this.aiProgressionEvents = (data.aiProgressionEvents ?? []).map((event) => ({ ...event }));
    // Dernier jour traité par la progression de l'IA (jamais deux fois le même jour).
    this.aiProgressionDay = typeof data.aiProgressionDay === 'number' ? data.aiProgressionDay : null;
    // Historique d'effectif de chaque club de l'IA : { [clubId]: [{ id, day, type, fighterId,
    // fighterName, fighterAge, specialty, metadata }] } (RECRUITMENT, DEPART_NIVEAU, DEPART_RETRAITE).
    this.clubRosterEvents = Object.fromEntries(Object.entries(data.clubRosterEvents ?? {}).map(([id, events]) => [id, events.map((e) => ({ ...e, metadata: { ...(e.metadata ?? {}) } }))]));
    // Améliorations du Bourg : nombre d'achats de chaque amélioration ({ [upgradeId]: n }).
    // Coûts et effets s'en déduisent (systems/borough/UpgradeService.js).
    this.upgrades = { ...(data.upgrades ?? {}) };
    // Niveau de la Taverne (data/tavern.js) : plage d'étoiles des recrues de la prochaine rotation.
    this.tavernLevel = Number.isInteger(data.tavernLevel) && data.tavernLevel > 0 ? data.tavernLevel : 1;
    // Niveau de la lice du club (data/liceUpgrades.js) : recette des victoires à domicile,
    // bonus d'affluence et décor du terrain à domicile s'en déduisent (systems/lice/).
    this.liceLevel = Number.isInteger(data.liceLevel) && data.liceLevel > 0 ? data.liceLevel : 1;
    // Affectation rapide du Centre : réglage de chaque lieu ({ [activityId]: { targetClass,
    // sortBy, sortDirection } }, systems/activities/ActivityAssignmentService.js).
    this.activityAssignments = Object.fromEntries(Object.entries(data.activityAssignments ?? {}).map(([id, config]) => [id, { ...config }]));
    // Le Coffre : quantité de chaque objet possédé ({ [itemId]: n }, systems/inventory/).
    // Nom, image, description et effet viennent des données (data/items.js).
    this.inventory = Object.fromEntries(Object.entries(data.inventory ?? {}).filter(([, n]) => Number.isInteger(n) && n > 0));
    // Effets temporaires des combattants (ex. Hypocras pour la prochaine manche),
    // systems/items/CombatEffectService.js. Jamais inscrits dans les statistiques.
    this.activeEffects = (data.activeEffects ?? []).map((effect) => ({ ...effect, expiresAt: effect.expiresAt ? { ...effect.expiresAt } : null }));
    // Coupe de France en cours (systems/frenchCup/FrenchCupManager.js) : tirage, poules,
    // tableau, statistiques. Indépendante du calendrier et des championnats. null : aucune.
    this.frenchCup = data.frenchCup ? structuredClone(data.frenchCup) : null;
    // Palmarès des éditions terminées : [{ editionId, edition, winnerId, playerResult, … }].
    this.frenchCupHistory = (data.frenchCupHistory ?? []).map((entry) => structuredClone(entry));
    // Palmarès de partie des combattants des clubs de l'IA (FighterRecordService) :
    // { [fighterId]: { matches, rounds, takedowns } }.
    this.aiFighterRecords = Object.fromEntries(Object.entries(data.aiFighterRecords ?? {}).map(([id, record]) => [id, createFighterRecord(record)]));
    // Trophées de la compagnie du joueur (systems/trophies/TrophyService.js) : une entrée par
    // titre gagné [{ id, clubId, competition, season, editionId, order, day }]. Source de vérité
    // de l'armoire à trophées de la Taverne.
    this.trophies = (data.trophies ?? []).map((trophy) => ({ ...trophy }));
    // Saisons de l'année (systems/climate/ClimateService.js) : la saison se déduit du jour ; seul
    // le dernier passage de saison traité est gardé (aucune notification en double au rechargement).
    this.climate = { lastTransitionDay: data.climate?.lastTransitionDay ?? null };
    // Études du Scriptorium, en cours et passées (systems/talents/StudyService.js) :
    // [{ id, fighterId, startDay, duration, endDay, status, talentId, closedOnDay, notified }].
    // La disponibilité des combattants s'en déduit (jamais enregistrée à part).
    this.studies = (data.studies ?? []).map((study) => ({ ...study }));
    // Expéditions du Baron (v0.98) : propositions de la saison, pérégrinations (ExpeditionService).
    this.expeditions = data.expeditions ? JSON.parse(JSON.stringify(data.expeditions)) : null;
    // Améliorations du Scriptorium (Professeure Flavia) : second Bureau, artefacts achetés,
    // artefact actif (systems/talents/ScriptoriumUpgradeService.js).
    this.scriptorium = {
      deskUpgrade: data.scriptorium?.deskUpgrade === true,
      artifacts: [...(data.scriptorium?.artifacts ?? [])],
      activeArtifactId: data.scriptorium?.activeArtifactId ?? null,
    };
    // Succès (systems/achievements/AchievementService.js) : obtenus une seule fois, et compteurs
    // (partis de 0 pour une ancienne sauvegarde). { unlocked: { [id]: { day, … } }, counters }.
    this.achievements = data.achievements ? structuredClone(data.achievements) : { unlocked: {}, counters: {} };
    // Talents de combat des clubs de l'IA déjà tirés (v1.2.1, AITalentService.seedAITalents).
    this.aiTalentsSeeded = data.aiTalentsSeeded === true;
    this.createdAt = data.createdAt ?? Date.now();
    this.lastSavedAt = data.lastSavedAt ?? null;

    // État d'exécution (non sauvegardé).
    this.saveId = null;
    this.dirty = false;
    // Copies propres à la partie des combattants de la base de clubs ({ base, fighter }).
    this.aiFighterViews = new Map();
    // Succès obtenus pas encore annoncés à l'écran (AchievementService.takePendingAchievements).
    this.pendingAchievements = [];
  }

  get playerTeam() {
    return this.getTeam(this.player.teamId);
  }

  /** Combattants de la compagnie du joueur. */
  get playerFighters() {
    return this.getFightersOfTeam(this.player.teamId);
  }

  /** Ligue actuelle de la compagnie du joueur. */
  get playerLeague() {
    return this.getLeague(this.playerTeam?.leagueId);
  }

  getLeague(leagueId) {
    return this.leagues.find((league) => league.id === leagueId) ?? null;
  }

  /** Division dans laquelle évolue un club cette saison. */
  getLeagueOfTeam(teamId) {
    return this.leagues.find((league) => league.teamIds.includes(teamId)) ?? null;
  }

  // Les équipes et combattants de la partie (club du joueur) sont cherchés d'abord ;
  // les clubs de l'IA viennent de la base de clubs (données statiques, hors sauvegarde),
  // avec leur effectif de la partie s'il a changé (aiRosters / aiFighters).

  getTeam(teamId) {
    return this.teams.find((team) => team.id === teamId) ?? clubDatabase.getTeam(teamId);
  }

  getFighter(fighterId) {
    return this.fighters.find((fighter) => fighter.id === fighterId)
      ?? this.getAIFighter(fighterId);
  }

  /**
   * Combattant d'un club de l'IA tel qu'il est dans CETTE partie : recrue de la partie, ou
   * copie du combattant de la base de clubs avec son évolution (niveau, âge). La base de
   * clubs, partagée par toutes les parties, n'est jamais modifiée.
   */
  getAIFighter(fighterId) {
    const recruit = this.aiFighters.find((fighter) => fighter.id === fighterId);
    if (recruit) return recruit;
    const base = clubDatabase.getFighter(fighterId);
    if (!base) return null;
    let view = this.aiFighterViews.get(fighterId);
    if (!view || view.base !== base) {
      view = { base, fighter: new Fighter({ ...base.toJSON(), createdAt: base.createdAt }) };
      this.aiFighterViews.set(fighterId, view);
    }
    const state = this.aiFighterStates[fighterId];
    view.fighter.score = Math.max(0, Math.min(100, (base.score ?? 0) + (state?.levelDelta ?? 0)));
    view.fighter.age = typeof state?.age === 'number' ? state.age : null;
    // Talents de combat (v1.2.1) : propres à la partie, rangés avec son évolution.
    view.fighter.talents = Array.isArray(state?.talents) ? [...state.talents] : [];
    return view.fighter;
  }

  /** Combattant de la base de clubs (et non recrue de la partie) ? */
  isBaseAIFighter(fighterId) {
    return !this.aiFighters.some((fighter) => fighter.id === fighterId) && Boolean(clubDatabase.getFighter(fighterId));
  }

  getFightersOfTeam(teamId) {
    const team = this.teams.find((t) => t.id === teamId);
    if (team) return team.fighterIds.map((id) => this.fighters.find((f) => f.id === id)).filter(Boolean);
    const ids = this.aiRosters[teamId] ?? (clubDatabase.getTeam(teamId)?.fighterIds ?? []);
    return ids.map((id) => this.getAIFighter(id)).filter(Boolean);
  }

  /** Ajoute un combattant à une équipe. */
  addFighterToTeam(fighter, teamId) {
    const team = this.getTeam(teamId);
    if (!team) throw new Error(`Équipe introuvable : ${teamId}`);
    fighter.teamId = team.id;
    if (!this.fighters.includes(fighter)) this.fighters.push(fighter);
    if (!team.fighterIds.includes(fighter.id)) team.fighterIds.push(fighter.id);
  }

  /** Retire définitivement un combattant de la partie (et de l'effectif de son équipe). */
  removeFighter(fighterId) {
    const fighter = this.fighters.find((f) => f.id === fighterId);
    if (!fighter) return false;
    for (const team of this.teams) team.fighterIds = team.fighterIds.filter((id) => id !== fighterId);
    this.fighters = this.fighters.filter((f) => f.id !== fighterId);
    return true;
  }

  markDirty() {
    this.dirty = true;
  }

  markSaved(timestamp) {
    this.lastSavedAt = timestamp;
    this.dirty = false;
  }

  toJSON() {
    return {
      player: this.player.toJSON(),
      teams: this.teams.map((team) => team.toJSON()),
      fighters: this.fighters.map((fighter) => fighter.toJSON()),
      calendar: this.calendar.toJSON(),
      recruitment: this.recruitment.toJSON(),
      leagues: this.leagues.map((league) => league.toJSON()),
      season: this.season ? structuredClone(this.season) : null,
      seasonHistory: this.seasonHistory.map((entry) => structuredClone(entry)),
      clubHistory: Object.fromEntries(Object.entries(this.clubHistory).map(([id, entries]) => [id, entries.map((e) => ({ ...e }))])),
      aiRosters: Object.fromEntries(Object.entries(this.aiRosters).map(([id, ids]) => [id, [...ids]])),
      aiFighters: this.aiFighters.map((fighter) => fighter.toJSON()),
      aiCaptains: { ...this.aiCaptains },
      aiFighterStates: Object.fromEntries(Object.entries(this.aiFighterStates).map(([id, state]) => [id, { ...state, ...(state.talents ? { talents: [...state.talents] } : {}) }])),
      aiTalentsSeeded: this.aiTalentsSeeded,
      aiProgressionEvents: this.aiProgressionEvents.map((event) => ({ ...event })),
      aiProgressionDay: this.aiProgressionDay,
      clubRosterEvents: Object.fromEntries(Object.entries(this.clubRosterEvents).map(([id, events]) => [id, events.map((e) => ({ ...e, metadata: { ...e.metadata } }))])),
      upgrades: { ...this.upgrades },
      tavernLevel: this.tavernLevel,
      liceLevel: this.liceLevel,
      activityAssignments: Object.fromEntries(Object.entries(this.activityAssignments).map(([id, config]) => [id, { ...config }])),
      inventory: { ...this.inventory },
      activeEffects: this.activeEffects.map((effect) => ({ ...effect, expiresAt: effect.expiresAt ? { ...effect.expiresAt } : null })),
      frenchCup: this.frenchCup ? structuredClone(this.frenchCup) : null,
      frenchCupHistory: this.frenchCupHistory.map((entry) => structuredClone(entry)),
      aiFighterRecords: Object.fromEntries(Object.entries(this.aiFighterRecords).map(([id, record]) => [id, cloneFighterRecord(record)])),
      trophies: this.trophies.map((trophy) => ({ ...trophy })),
      climate: { lastTransitionDay: this.climate?.lastTransitionDay ?? null },
      studies: this.studies.map((study) => ({ ...study })),
      expeditions: this.expeditions ? JSON.parse(JSON.stringify(this.expeditions)) : null,
      scriptorium: { ...this.scriptorium, artifacts: [...this.scriptorium.artifacts] },
      achievements: structuredClone(this.achievements ?? { unlocked: {}, counters: {} }),
      createdAt: this.createdAt,
      lastSavedAt: this.lastSavedAt,
    };
  }

  static fromJSON(data) {
    return new GameSession(data);
  }
}
