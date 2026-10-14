import { DAY_PHASES } from './dayPhases.js';
import { DailyReport } from '../report/DailyReportService.js';

/**
 * Fait passer une journée et renvoie son carnet de bord (événements structurés).
 * La sauvegarde automatique et la mise à jour de l'interface sont gérées par l'appelant.
 */
export function advanceDay(session, { rng = Math.random, phases = DAY_PHASES } = {}) {
  const report = new DailyReport(session.calendar.currentDay);
  const ctx = { session, rng, report };
  for (const phase of phases) phase.run(ctx);
  session.markDirty();
  return report;
}
