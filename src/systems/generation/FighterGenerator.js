import { Fighter } from '../../models/Fighter.js';
import { GAME_CONFIG } from '../../config/gameConfig.js';
import { SPECIALTY_IDS, getSpecialty } from '../../data/specialties.js';
import { STAT_DEFINITIONS } from '../../data/stats.js';
import { getSpritesForClass } from '../../data/sprites.js';
import { pick, randInt, shuffle } from '../../utils/random.js';
import { composeFighterName, generateFighterNames } from './NameGenerator.js';
import { initializeFighterProfile } from '../fighters/PotentialService.js';

/** Sprite tiré au hasard, parmi les variantes de sa classe, à la création d'un combattant ; il ne change plus ensuite. */
export function pickRandomSpriteId(classId, rng = Math.random) {
  const choices = getSpritesForClass(classId);
  if (!choices.length) throw new Error(`Aucun sprite pour la classe ${classId}`);
  return pick(rng, choices).id;
}

/**
 * Répartition équilibrée des spécialités (8 combattants → 3 / 3 / 2),
 * dans un ordre aléatoire.
 */
export function buildSpecialtyDistribution(size, rng) {
  const list = Array.from({ length: size }, (_, i) => SPECIALTY_IDS[i % SPECIALTY_IDS.length]);
  return shuffle(rng, list);
}

/**
 * Statistiques de départ : valeur `start` de chaque stat (fixe ou tirée dans une plage),
 * puis modificateurs de la spécialité (aucun n'est défini pour l'instant).
 * `levelStatRange` : plage imposée aux compétences de niveau (ex. capitaine : 15–35).
 */
export function createStartingStats(specialtyId, rng = Math.random, { levelStatRange = null } = {}) {
  const stats = Object.fromEntries(STAT_DEFINITIONS.map((def) => {
    const start = levelStatRange && def.level ? levelStatRange : def.start;
    const value = typeof start === 'object' ? randInt(rng, start.min, start.max) : start ?? def.base;
    return [def.id, value];
  }));
  const modifiers = getSpecialty(specialtyId)?.statModifiers ?? {};
  for (const [statId, bonus] of Object.entries(modifiers)) {
    if (statId in stats) stats[statId] += bonus;
  }
  return stats;
}

/**
 * `name` : { firstName, epithet } produit par NameGenerator. `day` : jour de jeu de la
 * création (référence de l'âge et des vérifications du potentiel).
 */
export function generateFighter({ teamId = null, specialtyId, name, rng = Math.random, day = 1, levelStatRange = null }) {
  const fighter = new Fighter({
    teamId,
    name: composeFighterName(name),
    specialtyId,
    spriteId: pickRandomSpriteId(specialtyId, rng),
    stats: createStartingStats(specialtyId, rng, { levelStatRange }),
  });
  initializeFighterProfile(fighter, { day, rng });
  return fighter;
}

/** `levelStatRange` (facultatif) : plage des compétences de départ (compagnie du joueur). */
export function generateRoster({ teamId, size = GAME_CONFIG.roster.size, rng = Math.random, day = 1, usedFirstNames = new Set(), levelStatRange = null } = {}) {
  const specialties = buildSpecialtyDistribution(size, rng);
  const names = generateFighterNames(size, rng, usedFirstNames);
  return specialties.map((specialtyId, i) =>
    generateFighter({ teamId, specialtyId, name: names[i], rng, day, levelStatRange }),
  );
}
