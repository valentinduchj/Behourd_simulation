import { PATCH_NOTES, PATCH_NOTES_MIN_VERSION, PATCH_NOTE_SECTIONS } from '../../data/patchNotes.js';

// Patch Notes : sélection et ordre des versions affichées (sans interface).

/** Compare deux numéros de version « x.y.z » (numériquement, partie par partie) : < 0, 0 ou > 0. */
export function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}

/**
 * Versions à afficher : celles ≥ `minVersion` (0.42.0), de la plus récente à la plus ancienne,
 * chacune avec ses rubriques non vides : { version, date, title, sections: [{ key, label, icon, items }] }.
 */
export function getDisplayedPatchNotes({ notes = PATCH_NOTES, minVersion = PATCH_NOTES_MIN_VERSION, sections = PATCH_NOTE_SECTIONS } = {}) {
  return notes
    .filter((note) => note?.version && compareVersions(note.version, minVersion) >= 0)
    .sort((a, b) => compareVersions(b.version, a.version))
    .map((note) => ({
      version: note.version,
      date: note.date ?? null,
      title: note.title ?? null,
      sections: sections
        .map((section) => ({ ...section, items: (note[section.key] ?? []).filter(Boolean) }))
        .filter((section) => section.items.length),
    }));
}

/** « 8 octobre 2026 » (ou null). */
export function formatPatchDate(date) {
  if (!date) return null;
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
