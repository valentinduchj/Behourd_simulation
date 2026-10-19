import { SAVED_TEAM_RULES } from '../../data/savedTeams.js';
import { createId } from '../../utils/id.js';
import { autoSelectSquad } from './MatchService.js';
import { isAway } from '../talents/StudyService.js';

// Équipes enregistrées du joueur (« SavedTeamManager ») : jusqu'à 3 compositions nommées de
// 8 combattants, rappelées d'un clic dans l'écran « Effectif engagé ». Ce sont des raccourcis
// de sélection : aucune règle de combat n'en dépend.
//
// Équipe : { id, name, fighterIds } — rangée avec le joueur (session.player.savedTeams, sauvegardée).
// Elle ne garde que des RÉFÉRENCES : niveau, PV, fatigue, statistiques… sont toujours ceux du
// combattant au moment où l'équipe est rappelée.

/** Équipes enregistrées, dans l'ordre de création. */
export function listSavedTeams(session) {
  return session.player.savedTeams ?? [];
}

export function getSavedTeam(session, teamId) {
  return listSavedTeams(session).find((team) => team.id === teamId) ?? null;
}

/** Une nouvelle équipe peut-elle être créée (limite de 3) ? */
export function canCreateSavedTeam(session) {
  return listSavedTeams(session).length < SAVED_TEAM_RULES.maxTeams;
}

/** Nom nettoyé : forme Unicode normalisée (accents), espaces superflus retirés. */
export function cleanTeamName(name) {
  return String(name ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * Vérifie une équipe avant enregistrement : { ok, reason, name }.
 * Nom non vide et assez court ; exactement 8 combattants, tous du club, sans doublon.
 */
export function validateSavedTeam(session, { name, fighterIds }) {
  const clean = cleanTeamName(name);
  const fail = (reason) => ({ ok: false, reason, name: clean });
  if (!clean) return fail('Donnez un nom à l’équipe.');
  if ([...clean].length > SAVED_TEAM_RULES.maxNameLength) return fail(`Le nom ne doit pas dépasser ${SAVED_TEAM_RULES.maxNameLength} caractères.`);
  const ids = fighterIds ?? [];
  if (new Set(ids).size !== ids.length) return fail('Un combattant ne peut figurer qu’une fois dans l’équipe.');
  if (ids.length !== SAVED_TEAM_RULES.size) return fail(`Une équipe compte exactement ${SAVED_TEAM_RULES.size} combattants (${ids.length} choisis).`);
  const own = new Set(session.playerFighters.map((f) => f.id));
  if (!ids.every((id) => own.has(id))) return fail('Un combattant choisi n’appartient plus à la compagnie.');
  return { ok: true, reason: null, name: clean };
}

/** Crée une équipe : { ok, reason, team }. */
export function createSavedTeam(session, name, fighterIds) {
  if (!canCreateSavedTeam(session)) return { ok: false, reason: `Vous avez déjà ${SAVED_TEAM_RULES.maxTeams} équipes enregistrées.`, team: null };
  const check = validateSavedTeam(session, { name, fighterIds });
  if (!check.ok) return { ...check, team: null };
  const team = { id: createId('squad'), name: check.name, fighterIds: [...fighterIds] };
  session.player.savedTeams = [...listSavedTeams(session), team];
  session.markDirty();
  return { ok: true, reason: null, team };
}

/** Modifie le nom et les combattants d'une équipe : { ok, reason, team }. */
export function updateSavedTeam(session, teamId, name, fighterIds) {
  const existing = getSavedTeam(session, teamId);
  if (!existing) return { ok: false, reason: 'Équipe introuvable.', team: null };
  const check = validateSavedTeam(session, { name, fighterIds });
  if (!check.ok) return { ...check, team: null };
  const team = { ...existing, name: check.name, fighterIds: [...fighterIds] };
  session.player.savedTeams = listSavedTeams(session).map((t) => (t.id === teamId ? team : t));
  session.markDirty();
  return { ok: true, reason: null, team };
}

/** Supprime une équipe (la composition seulement : aucun combattant n'est touché). */
export function deleteSavedTeam(session, teamId) {
  const before = listSavedTeams(session).length;
  session.player.savedTeams = listSavedTeams(session).filter((team) => team.id !== teamId);
  const removed = session.player.savedTeams.length < before;
  if (removed) session.markDirty();
  return removed;
}

/**
 * Rappel d'une équipe : { fighterIds (combattants encore présents, dans l'ordre enregistré),
 * missing (identifiants disparus), available, total, complete }. Un combattant qui n'est plus
 * dans la compagnie n'est jamais sélectionné.
 */
export function loadSavedTeam(session, teamId) {
  const team = getSavedTeam(session, teamId);
  if (!team) return null;
  const own = new Set(session.playerFighters.map((f) => f.id));
  // Un combattant en étude au Scriptorium reste dans l'équipe enregistrée, mais n'est pas sélectionné.
  const studying = team.fighterIds.filter((id) => own.has(id) && isAway(session, id));
  const fighterIds = team.fighterIds.filter((id) => own.has(id) && !studying.includes(id));
  const missing = team.fighterIds.filter((id) => !own.has(id));
  return { team, fighterIds, missing, studying, available: fighterIds.length, total: SAVED_TEAM_RULES.size, complete: fighterIds.length === SAVED_TEAM_RULES.size };
}

/**
 * Message d'une équipe incomplète (« 6 combattants disponibles sur 8 »), ou null. Avec la
 * partie (`session`), il précise la cause : combattants partis, ou en étude (nommés).
 */
export function describeIncompleteTeam(status, session = null) {
  if (!status || status.complete) return null;
  const studying = status.studying?.length ?? 0;
  const base = `Cette équipe n’est plus complète. ${status.available} combattant${status.available > 1 ? 's' : ''} disponible${status.available > 1 ? 's' : ''} sur ${status.total}`;
  if (!session) return `${base}${studying ? ` (${studying} en étude au Scriptorium)` : ''}.`;
  const details = [];
  const gone = status.missing?.length ?? 0;
  if (gone) details.push(`${gone} ${gone > 1 ? 'ont' : 'a'} quitté la compagnie`);
  if (studying) details.push(`en étude au Scriptorium : ${status.studying.map((id) => session.getFighter(id)?.name ?? '?').join(', ')}`);
  return `${base}${details.length ? ` — ${details.join(' ; ')}` : ''}. Les autres restent sélectionnés.`;
}

/** Équipe Type : les 8 combattants au plus haut niveau actuel, quelle que soit leur classe. */
export function selectTypeTeam(session) {
  return autoSelectSquad(session, session.player.teamId).map((fighter) => fighter.id);
}

/** Deux sélections identiques (mêmes combattants, ordre indifférent) ? */
export function isSameSelection(a, b) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}
