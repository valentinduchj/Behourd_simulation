import { ARTIFACTS, DESK_UPGRADE, NO_ARTIFACT, STUDY_RULES } from '../../data/scriptorium.js';
import { canAfford, spendResource } from '../economy/wallet.js';
import { checkAchievements } from '../achievements/AchievementService.js';

// Améliorations du Scriptorium (Professeure Flavia), sans interface.
//
// Enregistrées avec la partie : session.scriptorium = { deskUpgrade, artifacts, activeArtifactId }
//   deskUpgrade       true : le second Bureau d'étude est acheté (achat unique)
//   artifacts         identifiants des artefacts achetés (data/scriptorium.js › ARTIFACTS)
//   activeArtifactId  artefact dont les chances s'appliquent (null : aucune amélioration)
// Les artefacts sont une amélioration par paliers : chacun débloque le suivant ; le palier le
// plus haut acheté est actif. Leurs chances ne se cumulent jamais.

const CURRENCY = 'deniers';
const ARTIFACTS_BY_ID = new Map(ARTIFACTS.map((artifact) => [artifact.id, artifact]));

/**
 * État du Scriptorium, complété et normalisé (partie antérieure : rien d'acheté). L'artefact
 * actif est toujours le plus haut palier acheté (une sauvegarde v0.60 qui avait réactivé un
 * artefact inférieur reprend le meilleur).
 */
export function getScriptoriumState(session) {
  const state = session.scriptorium ?? {};
  const artifacts = [...new Set((state.artifacts ?? []).filter((id) => ARTIFACTS_BY_ID.has(id)))];
  const best = [...ARTIFACTS].reverse().find((artifact) => artifacts.includes(artifact.id));
  session.scriptorium = {
    deskUpgrade: state.deskUpgrade === true,
    artifacts,
    activeArtifactId: best?.id ?? null,
  };
  return session.scriptorium;
}

/** Nombre de places au Bureau d'étude (base + amélioration). */
export function getDeskCount(session) {
  return STUDY_RULES.desks + (getScriptoriumState(session).deskUpgrade ? DESK_UPGRADE.extraDesks : 0);
}

export function hasDeskUpgrade(session) {
  return getScriptoriumState(session).deskUpgrade;
}

/** { ok, reason } : le second Bureau peut-il être acheté ? */
export function canBuyDeskUpgrade(session) {
  if (hasDeskUpgrade(session)) return { ok: false, reason: 'Amélioration déjà acquise.' };
  if (!canAfford(session, CURRENCY, DESK_UPGRADE.cost)) return { ok: false, reason: 'Deniers insuffisants.' };
  return { ok: true, reason: null };
}

/** Achète le second Bureau (une seule fois) : { ok, reason, cost }. */
export function buyDeskUpgrade(session) {
  const check = canBuyDeskUpgrade(session);
  if (!check.ok) return { ...check, cost: 0 };
  if (!spendResource(session, CURRENCY, DESK_UPGRADE.cost)) return { ok: false, reason: 'Deniers insuffisants.', cost: 0 };
  getScriptoriumState(session).deskUpgrade = true;
  session.markDirty();
  // Succès : Deux bureaux valent mieux qu'un.
  checkAchievements(session);
  return { ok: true, reason: null, cost: DESK_UPGRADE.cost };
}

export function getArtifact(artifactId) {
  return ARTIFACTS_BY_ID.get(artifactId) ?? null;
}

/** Configuration active (artefact, ou « Aucune amélioration ») : { id, name, odds, … }. */
export function getActiveConfiguration(session) {
  return getArtifact(getScriptoriumState(session).activeArtifactId) ?? NO_ARTIFACT;
}

/** Chances de chaque famille utilisées à la révélation d'un talent : { common, rare, epic }. */
export function getActiveOdds(session) {
  return getActiveConfiguration(session).odds;
}

/** Prochain palier à acheter (ou null : tous acquis). */
export function getNextArtifact(session) {
  const owned = getScriptoriumState(session).artifacts;
  return ARTIFACTS.find((artifact) => !owned.includes(artifact.id)) ?? null;
}

/**
 * Artefacts avec leur état : [{ ...artifact, state, canBuy }]
 *   'active'    palier actuel (ses chances s'appliquent)
 *   'surpassed' acheté, remplacé par un palier supérieur
 *   'available' prochain palier, à vendre
 *   'locked'    il faut d'abord acheter le palier précédent
 */
export function listArtifacts(session) {
  const state = getScriptoriumState(session);
  return ARTIFACTS.map((artifact) => {
    const owned = state.artifacts.includes(artifact.id);
    const unlocked = !artifact.requires || state.artifacts.includes(artifact.requires);
    const status = state.activeArtifactId === artifact.id ? 'active' : owned ? 'surpassed' : unlocked ? 'available' : 'locked';
    return { ...artifact, state: status, canBuy: canBuyArtifact(session, artifact.id) };
  });
}

/** { ok, reason } : l'artefact peut-il être acheté ? (palier précédent acquis, deniers) */
export function canBuyArtifact(session, artifactId) {
  const artifact = getArtifact(artifactId);
  if (!artifact) return { ok: false, reason: 'Artefact inconnu.' };
  const state = getScriptoriumState(session);
  if (state.artifacts.includes(artifactId)) return { ok: false, reason: 'Déjà acquis.' };
  if (artifact.requires && !state.artifacts.includes(artifact.requires)) {
    return { ok: false, reason: `Achetez d’abord : ${getArtifact(artifact.requires).name}.` };
  }
  if (!canAfford(session, CURRENCY, artifact.cost)) return { ok: false, reason: 'Deniers insuffisants.' };
  return { ok: true, reason: null };
}

/** Achète le prochain palier au prix complet ; il devient actif. { ok, reason, cost }. */
export function buyArtifact(session, artifactId) {
  const check = canBuyArtifact(session, artifactId);
  if (!check.ok) return { ...check, cost: 0 };
  const artifact = getArtifact(artifactId);
  if (!spendResource(session, CURRENCY, artifact.cost)) return { ok: false, reason: 'Deniers insuffisants.', cost: 0 };
  const state = getScriptoriumState(session);
  state.artifacts.push(artifactId);
  state.activeArtifactId = artifactId;
  session.markDirty();
  return { ok: true, reason: null, cost: artifact.cost };
}
