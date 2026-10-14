/**
 * Fin de journée côté interface : sauvegarde automatique (si activée), notée dans le
 * carnet de bord. Renvoie les paramètres à transmettre à l'écran suivant.
 */
export function autosaveDay({ services, session, report }) {
  if (services.settings.get('gameplay.autosave')) {
    try {
      services.saves.save(session);
      report.add({ type: 'save.autosaved' });
    } catch (error) {
      report.add({ type: 'save.failed', message: error.message });
    }
  }
  return { dayReport: report };
}
