import { resolveActivitiesForDay, collectTalentIncome } from '../activities/ActivityService.js';
import { processEventsForDay } from '../calendar/eventHandlers.js';
import { ensureSchedule } from '../calendar/scheduler.js';
import { getPendingCombatEvent, getPendingQueenEvent, isCombatDay } from '../calendar/CalendarService.js';
import { ensureQueenCombatPlanned, missQueenCombat } from '../queen/QueenCombatService.js';
import { runAIRetirements, runDailyAIRecruitment, runDailyAIProgression } from '../clubs/AIProgressionService.js';
import { runPotentialChecks } from '../fighters/PotentialService.js';
import { completeDueStudies } from '../talents/StudyService.js';
import { updateLeaguesForDay } from '../league/LeagueService.js';
import {
  isSeasonFinished, isOffSeason, finalizeSeason, takeSeasonEndReport, completeMatchdayAndCheckSeason,
} from '../league/SeasonService.js';
import { buildPlayerResultEvent } from '../match/MatchdayService.js';
import { runSeasonTransition } from '../climate/ClimateService.js';
import { recordDay } from '../achievements/AchievementService.js';

/**
 * Étapes de résolution d'une journée (GameDay), exécutées dans l'ordre.
 * Chaque étape reçoit ctx = { session, rng, report, previousDay, wasCombatDay }.
 *
 *   GameDay → (journée de championnat ou Combat de la Reine non disputés) → fin de saison éventuelle
 *           → ResolveActivities → ResolveEvents (dont la rotation de la Taverne)
 *           → retraites de l'IA → recrutements de l'IA → progression de l'IA → UpdateLeague → planification
 *
 * Chaque étape alimente le carnet de bord (ctx.report) avec des événements structurés.
 * La mise à jour de l'interface puis la sauvegarde sont faites ensuite par l'appelant.
 * Pour ajouter un effet lié au temps (blessures, salaires, entretien, mercato…),
 * ajouter une étape à l'endroit voulu.
 */
export const DAY_PHASES = [
  {
    id: 'game-day',
    run(ctx) {
      const { calendar } = ctx.session;
      ctx.previousDay = calendar.currentDay;
      ctx.wasCombatDay = isCombatDay(calendar, ctx.previousDay);
      calendar.currentDay += 1;
      ctx.report.day = calendar.currentDay;
    },
  },

  {
    // Journée de championnat passée sans que le joueur ait combattu (avance rapide) :
    // elle est disputée automatiquement, combat du joueur compris.
    id: 'unplayed-matchday',
    run(ctx) {
      const event = getPendingCombatEvent(ctx.session.calendar, ctx.previousDay);
      if (!event) return;
      const { results } = completeMatchdayAndCheckSeason(ctx.session, event, null, ctx.rng);
      ctx.report.add(buildPlayerResultEvent(ctx.session, event, results, { auto: true }));
    },
  },
  {
    // Combat de la Reine passé sans que le joueur ait combattu (avance rapide) : manqué.
    id: 'unplayed-queen-combat',
    run(ctx) {
      const event = getPendingQueenEvent(ctx.session.calendar, ctx.previousDay);
      if (event) ctx.report.add(missQueenCombat(ctx.session, event, ctx.rng));
    },
  },
  {
    // La saison est clôturée dès le dernier combat de championnat (completeMatchdayAndCheckSeason) ;
    // ici, le bilan est présenté une fois dans le carnet du jour. La saison suivante ne
    // démarre qu'à la demande du joueur (SeasonService.startNextSeason).
    id: 'season-end',
    run(ctx) {
      const { session } = ctx;
      if (!session.season) return;
      if (!isOffSeason(session) && isSeasonFinished(session)) finalizeSeason(session, ctx.rng);
      const event = takeSeasonEndReport(session);
      if (event) ctx.report.add(event);
    },
  },
  {
    // Une journée de combat est entièrement consacrée au combat : pas d'entraînement.
    id: 'activities',
    run(ctx) {
      if (ctx.wasCombatDay) {
        ctx.report.add({ type: 'centre.closed' });
        return;
      }
      resolveActivitiesForDay(ctx);
    },
  },  {
    // Saisons de l'année (v0.70) : au premier jour d'une saison, affectations aux lieux fermés
    // libérées et entrée au carnet de bord, une seule fois (ClimateService). Après les activités :
    // le travail de la veille (dernier jour de la saison précédente) a été réglé selon ses règles.
    id: 'climate-season',
    run: ({ session, report }) => { runSeasonTransition(session, report); },
  },
  {
    // Talents économiques (Collecteur, Trésorier du roi) : deniers chaque jour, combat ou non.
    id: 'talent-income',
    run: ({ session, report }) => { collectTalentIncome(session, report); },
  },
  {
    // Scriptorium : les études arrivées à leur date de fin révèlent leur talent (une seule fois).
    id: 'studies',
    run: ({ session, report }) => { completeDueStudies(session, { report }); },
  },
  {
    // Potentiel des combattants : une vérification tous les 15 jours (selon l'âge).
    id: 'fighter-potential',
    run: ({ session, rng, report }) => { runPotentialChecks(session, { rng, report }); },
  },
  { id: 'events', run: processEventsForDay },
  {
    // Retraites de l'IA (36 ans) avant tout ce qui dépend de l'effectif : départ, historique,
    // remplacement direct si l'effectif passe sous 9. Un retraité ne dispute plus aucun combat.
    id: 'ai-retirement',
    run: ({ session, rng }) => { runAIRetirements(session, { rng }); },
  },
  {
    // Recrutements des clubs de l'IA (un tirage par club) : effectifs, puis niveaux
    // recalculés à la lecture ; seuls ceux de la division du joueur vont au carnet.
    id: 'ai-recruitment',
    run: ({ session, rng, report }) => { runDailyAIRecruitment(session, { rng, report }); },
  },
  {
    // Progression (ou vieillissement) des combattants de l'IA, une fois par jour : niveaux
    // modifiés et enregistrés (historique de 30 jours) ; niveaux des clubs recalculés à la
    // lecture, avant la mise à jour des classements. Rien au carnet de bord.
    id: 'ai-progression',
    run: ({ session, rng }) => { runDailyAIProgression(session, { rng }); },
  },
  { id: 'league', run: updateLeaguesForDay },
  {
    id: 'schedule',
    run: ({ session, rng }) => {
      ensureSchedule(session.calendar, rng, session);
      ensureQueenCombatPlanned(session, rng);
    },
  },
  {
    // Succès (v0.73), en dernier : activités réussies de la journée (compteur), puis succès
    // d'état (deniers, talents, étoiles, Élite…), inscrits au carnet de bord.
    id: 'achievements',
    run: ({ session, report }) => { recordDay(session, report); },
  },
];
