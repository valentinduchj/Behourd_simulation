import { CAPTAIN_CONFIG } from '../../data/captain.js';
import { POTENTIAL_CONFIG } from '../../data/fighterProfile.js';
import { getSpritesForClass, isValidSprite } from '../../data/sprites.js';
import { hashString } from '../../utils/random.js';
import { Fighter } from '../../models/Fighter.js';
import { createStartingStats } from '../generation/FighterGenerator.js';
import { rollInitialPotential } from '../fighters/PotentialService.js';
import { normalizeFighterName, validateFighterName } from './rosterSystem.js';

// Capitaine d'équipe : donnée métier explicite (Fighter.isCaptain), un seul par équipe,
// même mécanique pour le joueur et les clubs de l'IA. Aucun effet de jeu pour l'instant.
//
// Clubs de l'IA : le capitaine est défini dans les données (data/leagues/*.json, "captain").
// Si une partie modifie l'effectif d'un club (recrutements) et que son capitaine le
// quitte, le nouveau capitaine est enregistré dans la partie (session.aiCaptains).

// --- Création du capitaine du joueur ---

/** Apparences proposées au joueur pour son capitaine : les variantes de la classe choisie (aucune sans classe). */
export function getCaptainSpriteChoices(specialtyId) {
  return getSpritesForClass(specialtyId).map((sprite) => sprite.id);
}

/** Potentiel du capitaine : répartition propre au capitaine, restreinte aux valeurs ≥ minPotential. */
export function rollCaptainPotential(rng = Math.random, config = CAPTAIN_CONFIG.player) {
  const restricted = { ...POTENTIAL_CONFIG, initialDistribution: POTENTIAL_CONFIG.captainDistribution.filter((e) => e.potential >= config.minPotential) };
  return Math.max(config.minPotential, rollInitialPotential(rng, restricted));
}

/** Vérifie les choix du joueur. Renvoie un message d'erreur ou null. */
export function validateCaptainDraft({ name, specialtyId, spriteId }, { specialtyIds }) {
  const problem = validateFighterName(normalizeFighterName(name));
  if (problem) return problem;
  if (!specialtyIds.includes(specialtyId)) return 'Choisissez une spécialité.';
  // L'apparence doit être l'une des variantes de la classe choisie.
  if (!isValidSprite(specialtyId, spriteId)) return 'Choisissez l’apparence de votre combattant.';
  return null;
}

/**
 * Crée le capitaine du joueur (modèle Fighter standard) : spécialité, sprite (définitif)
 * et nom choisis ; compétences 15–35, 21 ans, potentiel ≥ 2, isCaptain = true.
 */
export function createPlayerCaptain({ teamId = null, name, specialtyId, spriteId, rng = Math.random, day = 1, config = CAPTAIN_CONFIG.player }) {
  const fighter = new Fighter({
    teamId,
    name: normalizeFighterName(name),
    specialtyId,
    spriteId,
    stats: createStartingStats(specialtyId, rng, { levelStatRange: config.statRange }),
    age: config.age,
    potential: rollCaptainPotential(rng, config),
    potentialCheckDay: day,
    isCaptain: true,
  });
  return fighter;
}

// --- Statut de capitaine ---

/** Vrai si le combattant est le capitaine de son équipe (joueur ou IA). */
export function isCaptain(session, fighter) {
  if (!fighter) return false;
  const override = session?.aiCaptains?.[fighter.teamId];
  if (override) return override === fighter.id;
  return fighter.isCaptain === true;
}

/** Capitaine d'une équipe, ou null. */
export function getCaptain(session, teamId) {
  return session.getFightersOfTeam(teamId).find((fighter) => isCaptain(session, fighter)) ?? null;
}

/** Vérifie qu'un effectif n'a pas plus d'un capitaine. { ok, count } */
export function checkSingleCaptain(fighters, isCaptainOf = (f) => f.isCaptain === true) {
  const count = fighters.filter(isCaptainOf).length;
  return { ok: count <= 1, count };
}

/** Nomme le capitaine de la compagnie du joueur (les autres perdent le statut : un seul capitaine). */
export function setPlayerCaptain(session, fighterId) {
  const fighters = session.playerFighters;
  if (!fighters.some((f) => f.id === fighterId)) throw new Error('Ce combattant ne fait pas partie de votre compagnie.');
  for (const fighter of fighters) fighter.isCaptain = fighter.id === fighterId;
  session.markDirty();
}

/** Position (1er ou 2e) du capitaine d'un club de l'IA, stable pour un même club. */
export function pickAICaptainIndex(clubId, rosterLength, config = CAPTAIN_CONFIG) {
  const positions = config.aiCaptainPositions.filter((index) => index < rosterLength);
  if (!positions.length) return -1;
  return positions[hashString(`capitaine:${clubId}`) % positions.length];
}

/** Désigne le capitaine d'un effectif (données ou modèles) : le 1er ou le 2e, les autres non. */
export function designateCaptain(fighters, index, key = 'isCaptain') {
  fighters.forEach((fighter, i) => { fighter[key] = i === index; });
  return fighters[index] ?? null;
}

/**
 * Club de l'IA dont l'effectif de la partie n'a plus de capitaine (capitaine congédié) :
 * le 1er ou le 2e combattant de l'effectif restant devient capitaine (enregistré dans la partie).
 */
export function ensureAICaptain(session, clubId) {
  if (getCaptain(session, clubId)) return null;
  const fighters = session.getFightersOfTeam(clubId);
  const index = pickAICaptainIndex(clubId, fighters.length);
  if (index < 0) return null;
  session.aiCaptains[clubId] = fighters[index].id;
  session.markDirty();
  return fighters[index];
}

/**
 * Une compagnie du joueur sans capitaine (sauvegarde antérieure à la v0.14, ou capitaine
 * congédié) — règle explicite : le membre le plus ancien (date de création, puis ordre de
 * l'effectif) devient capitaine. Ses caractéristiques ne changent pas. Si plusieurs combattants
 * ont le statut, seul le premier le garde. Les clubs de l'IA dont la partie a changé l'effectif
 * reçoivent aussi un capitaine si besoin. Renvoie true si quelque chose a été modifié.
 */
export function ensureCaptains(session) {
  let changed = false;
  const fighters = session.playerFighters;
  const captains = fighters.filter((f) => f.isCaptain);
  if (captains.length > 1) {
    captains.slice(1).forEach((f) => { f.isCaptain = false; });
    changed = true;
  }
  if (!captains.length && fighters.length) {
    const founder = [...fighters].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))[0];
    founder.isCaptain = true;
    changed = true;
  }
  for (const clubId of Object.keys(session.aiRosters ?? {})) {
    if (ensureAICaptain(session, clubId)) changed = true;
  }
  return changed;
}
