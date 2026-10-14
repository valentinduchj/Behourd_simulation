import { PATCH_MILESTONES, PATCH_NOTES, PATCH_NOTES_MIN_VERSION, PATCH_NOTE_SECTIONS } from '../../data/patchNotes.js';

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

// --- Versions majeures (v0.76 : seules affichées) ---

const parts = (version) => String(version).split('.').map((n) => Number.parseInt(n, 10) || 0);

/**
 * Version majeure qui contient une version : chaque majeure regroupe les versions qui la
 * précèdent — 0.51.0 … 0.60.x → « 0.6 » ; 0.61.0 … 0.70.x → « 0.7 » ; 0.40.0 → « 0.4 ».
 */
export function getMilestoneId(version) {
  const [major, minor] = parts(version);
  return `${major}.${Math.ceil(minor / 10)}`;
}

/** « 0.51 » pour 0.51.0, « 0.60.1 » sinon. */
export function shortVersion(version) {
  const [major, minor, patch] = parts(version);
  return patch ? `${major}.${minor}.${patch}` : `${major}.${minor}`;
}

/**
 * Versions majeures à afficher, de la plus récente à la plus ancienne :
 * { version, title, date, from, to, count, inProgress, isCurrent, sections }.
 *   from / to    première et dernière version regroupées (« 0.51 », « 0.60.1 ») ;
 *   date         date de la dernière version regroupée ;
 *   inProgress   le numéro de la majeure n'est pas encore atteint (0.8 tant qu'on est en 0.7x) ;
 *   isCurrent    elle contient `currentVersion`.
 * Une majeure sans aucune version détaillée n'est pas affichée.
 */
export function getDisplayedMilestones({ milestones = PATCH_MILESTONES, notes = PATCH_NOTES, sections = PATCH_NOTE_SECTIONS, currentVersion = null } = {}) {
  return milestones
    .map((milestone) => {
      const included = notes.filter((note) => note?.version && getMilestoneId(note.version) === milestone.version)
        .sort((a, b) => compareVersions(a.version, b.version));
      if (!included.length) return null;
      const [major, tenth] = parts(milestone.version);
      const reached = included.some((note) => parts(note.version)[0] === major && parts(note.version)[1] === tenth * 10);
      const last = included.at(-1);
      return {
        version: milestone.version,
        title: milestone.title ?? null,
        date: last.date ?? null,
        from: shortVersion(included[0].version),
        to: shortVersion(last.version),
        count: included.length,
        inProgress: !reached,
        isCurrent: Boolean(currentVersion) && getMilestoneId(currentVersion) === milestone.version,
        sections: sections
          .map((section) => ({ ...section, items: (milestone[section.key] ?? []).filter(Boolean) }))
          .filter((section) => section.items.length),
      };
    })
    .filter(Boolean)
    .sort((a, b) => compareVersions(b.version, a.version));
}

/** « 8 octobre 2026 » (ou null). */
export function formatPatchDate(date) {
  if (!date) return null;
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}
