import { ASSIGNMENT_PRESET_RULES } from '../../data/assignmentPresets.js';
import { createId } from '../../utils/id.js';
import { getActivity, getEffectiveActivity, isCentreClosed, CENTRE_CLOSED_REASON } from './ActivityService.js';
import { isAway } from '../talents/StudyService.js';
import { getCurrentSeason, getSeasonalClosure } from '../climate/ClimateService.js';
import { getFatigueState } from '../fighters/FatigueService.js';
import { FATIGUE_RULES } from '../../data/fatigue.js';

const EXHAUSTED_REFUGE = FATIGUE_RULES.centre.exhausted.refuge;

// Configurations d'affectation du Centre (« Entraînement », « Récupération »…) : la répartition
// des combattants entre les lieux, enregistrée puis appliquée d'un clic.
//
// Configuration : { id, name, assignments: [{ fighterId, activityId | null }], resetOthers }
// rangée avec le joueur (session.player.assignmentPresets, sauvegardée). Elle ne garde que des
// RÉFÉRENCES : un combattant parti ou un lieu disparu est signalé et ignoré, jamais corrigé
// en silence dans la configuration.
//
// Règles d'application (planAssignmentPreset) :
//   - les combattants absents de la configuration (recrues arrivées depuis) gardent leur
//     affectation, sauf si `resetOthers` : ils passent alors au repos ;
//   - places : les combattants hors configuration gardent leur place ; ceux de la configuration
//     sont placés dans l'ordre enregistré, et ceux qui ne trouvent plus de place passent au repos ;
//   - un combattant en étude au Scriptorium n'est affecté nulle part (il reste où il est) ;
//   - un combattant épuisé (v0.75) va au Banquet au lieu du lieu prévu (signalé) ;
//   - tout est calculé avant d'écrire : l'application est atomique.

export function listAssignmentPresets(session) {
  return session.player.assignmentPresets ?? [];
}

export function getAssignmentPreset(session, presetId) {
  return listAssignmentPresets(session).find((preset) => preset.id === presetId) ?? null;
}

export function canCreateAssignmentPreset(session) {
  return listAssignmentPresets(session).length < ASSIGNMENT_PRESET_RULES.maxPresets;
}

/** Affectations actuelles de toute la compagnie (repos compris), dans l'ordre de l'effectif. */
export function captureAssignments(session) {
  return session.playerFighters.map((fighter) => ({ fighterId: fighter.id, activityId: fighter.activityId ?? null }));
}

/** Nom nettoyé : forme Unicode normalisée, espaces superflus retirés. */
const cleanName = (name) => String(name ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();

function validateName(name) {
  const clean = cleanName(name);
  if (!clean) return { ok: false, reason: 'Donnez un nom à la configuration.', name: clean };
  if ([...clean].length > ASSIGNMENT_PRESET_RULES.maxNameLength) return { ok: false, reason: `Le nom ne doit pas dépasser ${ASSIGNMENT_PRESET_RULES.maxNameLength} caractères.`, name: clean };
  return { ok: true, reason: null, name: clean };
}

/** Enregistre les affectations actuelles sous un nom : { ok, reason, preset }. */
export function createAssignmentPreset(session, name, { resetOthers = false } = {}) {
  if (!canCreateAssignmentPreset(session)) return { ok: false, reason: `Vous avez déjà ${ASSIGNMENT_PRESET_RULES.maxPresets} configurations.`, preset: null };
  const check = validateName(name);
  if (!check.ok) return { ...check, preset: null };
  const preset = { id: createId('preset'), name: check.name, assignments: captureAssignments(session), resetOthers: Boolean(resetOthers) };
  session.player.assignmentPresets = [...listAssignmentPresets(session), preset];
  session.markDirty();
  return { ok: true, reason: null, preset };
}

/**
 * Modifie une configuration : nom, option des absents, et (si `capture`) remplace ses
 * affectations par celles du moment. { ok, reason, preset }.
 */
export function updateAssignmentPreset(session, presetId, { name, resetOthers, capture = false } = {}) {
  const existing = getAssignmentPreset(session, presetId);
  if (!existing) return { ok: false, reason: 'Configuration introuvable.', preset: null };
  const check = validateName(name ?? existing.name);
  if (!check.ok) return { ...check, preset: null };
  const preset = {
    ...existing,
    name: check.name,
    resetOthers: resetOthers === undefined ? existing.resetOthers : Boolean(resetOthers),
    assignments: capture ? captureAssignments(session) : existing.assignments,
  };
  session.player.assignmentPresets = listAssignmentPresets(session).map((p) => (p.id === presetId ? preset : p));
  session.markDirty();
  return { ok: true, reason: null, preset };
}

export function deleteAssignmentPreset(session, presetId) {
  const before = listAssignmentPresets(session).length;
  session.player.assignmentPresets = listAssignmentPresets(session).filter((preset) => preset.id !== presetId);
  const removed = session.player.assignmentPresets.length < before;
  if (removed) session.markDirty();
  return removed;
}

/**
 * Contenu d'une configuration pour l'affichage : { counts: [{ activityId, count }] (repos :
 * activityId null), departed (combattants partis), unknownActivities (lieux disparus) }.
 */
export function describeAssignmentPreset(session, preset) {
  const own = new Set(session.playerFighters.map((fighter) => fighter.id));
  const counts = new Map();
  let departed = 0;
  let unknownActivities = 0;
  for (const { fighterId, activityId } of preset.assignments) {
    if (!own.has(fighterId)) { departed += 1; continue; }
    if (activityId && !getActivity(activityId)) { unknownActivities += 1; continue; }
    counts.set(activityId, (counts.get(activityId) ?? 0) + 1);
  }
  return { counts: [...counts].map(([activityId, count]) => ({ activityId, count })), departed, unknownActivities, invalid: departed + unknownActivities };
}

/**
 * Plan d'application, sans rien modifier : { changes: [{ fighter, from, to }], issues }.
 * issues : [{ kind: 'departed' | 'unknownActivity' | 'studying' | 'full', fighterId, fighter?, activityId? }].
 */
export function planAssignmentPreset(session, preset) {
  const fighters = session.playerFighters;
  const target = new Map(fighters.map((fighter) => [fighter.id, fighter.activityId ?? null]));
  const own = new Map(fighters.map((fighter) => [fighter.id, fighter]));
  const issues = [];
  const listed = [];
  const season = getCurrentSeason(session);
  // Mentionnés par la configuration, même pour une affectation ignorée : jamais « absents ».
  const mentioned = new Set();
  for (const { fighterId, activityId } of preset.assignments) {
    const fighter = own.get(fighterId);
    if (!fighter) { issues.push({ kind: 'departed', fighterId }); continue; }
    mentioned.add(fighter.id);
    if (activityId && !getActivity(activityId)) { issues.push({ kind: 'unknownActivity', fighterId, fighter, activityId }); continue; }
    if (activityId && isAway(session, fighter)) { issues.push({ kind: 'studying', fighterId, fighter, activityId }); continue; }
    // Lieu fermé par la saison (rivière en été, forêt en hiver) : ignoré, signalé.
    if (activityId && getSeasonalClosure(activityId, season)) { issues.push({ kind: 'seasonClosed', fighterId, fighter, activityId }); continue; }
    // Épuisé (v0.75) : il ne peut aller qu'au Banquet ; il y est envoyé à la place.
    if (activityId && activityId !== EXHAUSTED_REFUGE && getFatigueState(fighter).id === 'exhausted') {
      issues.push({ kind: 'exhausted', fighterId, fighter, activityId });
      listed.push(fighter.id);
      target.set(fighter.id, EXHAUSTED_REFUGE);
      continue;
    }
    listed.push(fighter.id);
    target.set(fighter.id, activityId ?? null);
  }
  const inPreset = new Set(listed);
  if (preset.resetOthers) for (const fighter of fighters) if (!mentioned.has(fighter.id)) target.set(fighter.id, null);
  // Places : ceux qui restent en place d'abord, puis la configuration dans son ordre.
  const activityIds = new Set([...target.values()].filter(Boolean));
  for (const activityId of activityIds) {
    const { capacity } = getEffectiveActivity(session, activityId) ?? {};
    if (capacity === null || capacity === undefined) continue;
    let free = capacity - fighters.filter((f) => !inPreset.has(f.id) && target.get(f.id) === activityId).length;
    for (const fighterId of listed) {
      if (target.get(fighterId) !== activityId) continue;
      if (free > 0) { free -= 1; continue; }
      target.set(fighterId, null);
      issues.push({ kind: 'full', fighterId, fighter: own.get(fighterId), activityId });
    }
  }
  const changes = fighters
    .filter((fighter) => (fighter.activityId ?? null) !== target.get(fighter.id))
    .map((fighter) => ({ fighter, from: fighter.activityId ?? null, to: target.get(fighter.id) }));
  return { changes, issues };
}

/** Applique une configuration d'un clic : { ok, reason, changes, issues }. */
export function applyAssignmentPreset(session, presetId) {
  const preset = getAssignmentPreset(session, presetId);
  if (!preset) return { ok: false, reason: 'Configuration introuvable.', changes: [], issues: [] };
  if (isCentreClosed(session)) return { ok: false, reason: CENTRE_CLOSED_REASON, changes: [], issues: [] };
  const plan = planAssignmentPreset(session, preset);
  // Tout est vérifié : les écritures ne peuvent plus échouer.
  for (const { fighter, to } of plan.changes) fighter.activityId = to;
  if (plan.changes.length) session.markDirty();
  return { ok: true, reason: null, ...plan };
}

/** Résumé des éléments ignorés (« 1 combattant parti ; Forêt complète : Thierry au repos »), ou null. */
export function describePresetIssues(issues) {
  if (!issues.length) return null;
  const parts = [];
  const departed = issues.filter((i) => i.kind === 'departed').length;
  if (departed) parts.push(`${departed} combattant${departed > 1 ? 's' : ''} parti${departed > 1 ? 's' : ''} de la compagnie`);
  const unknown = issues.filter((i) => i.kind === 'unknownActivity');
  if (unknown.length) parts.push(`lieu disparu pour ${unknown.map((i) => i.fighter.name).join(', ')} (affectation inchangée)`);
  const studying = issues.filter((i) => i.kind === 'studying');
  if (studying.length) parts.push(`en étude au Scriptorium : ${studying.map((i) => i.fighter.name).join(', ')}`);
  const closed = issues.filter((i) => i.kind === 'seasonClosed');
  for (const activityId of new Set(closed.map((i) => i.activityId))) {
    parts.push(`${getActivity(activityId)?.name ?? 'lieu'} fermé pour la saison : ${closed.filter((i) => i.activityId === activityId).map((i) => i.fighter.name).join(', ')} non affecté${closed.filter((i) => i.activityId === activityId).length > 1 ? 's' : ''}`);
  }
  const exhausted = issues.filter((i) => i.kind === 'exhausted');
  if (exhausted.length) parts.push(`épuisé${exhausted.length > 1 ? 's' : ''}, envoyé${exhausted.length > 1 ? 's' : ''} au ${getActivity(EXHAUSTED_REFUGE)?.name ?? 'Banquet'} : ${exhausted.map((i) => i.fighter.name).join(', ')}`);
  const full = issues.filter((i) => i.kind === 'full');
  for (const activityId of new Set(full.map((i) => i.activityId))) {
    parts.push(`${getActivity(activityId)?.name ?? 'lieu'} complet : ${full.filter((i) => i.activityId === activityId).map((i) => i.fighter.name).join(', ')} au repos`);
  }
  return parts.join(' ; ');
}
