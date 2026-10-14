import { MAIN_MENU_VIDEOS, SHOWCASE_TIMING } from '../../data/mainMenuShowcase.js';

// Rotation des séquences de l'écran principal — règles pures (sans DOM), testables.

/** Durée d'une séquence, ramenée entre minDuration et maxDuration (3 à 6 s). */
export function clampDuration(duration, timing = SHOWCASE_TIMING) {
  const value = Number.isFinite(duration) ? duration : timing.minDuration;
  return Math.max(timing.minDuration, Math.min(timing.maxDuration, value));
}

/** Séquences jouables d'un côté ('left' | 'right') : activées, du bon côté, non écartées. */
export function listSequences(side, { videos = MAIN_MENU_VIDEOS, failed = new Set() } = {}) {
  return videos
    .filter((video) => video.enabled !== false && !failed.has(video.id))
    .filter((video) => !video.position || video.position === 'any' || video.position === side)
    .map((video) => ({ ...video, duration: clampDuration(video.duration) }));
}

/**
 * Séquence suivante, tirée selon `priority`. Évite de rejouer la précédente, la séquence en
 * cours de l'autre côté (`avoidIds`) et, si possible, la même catégorie que la précédente.
 * Renvoie null s'il n'y a rien à jouer.
 */
export function pickNextSequence(sequences, { previous = null, avoidIds = [], rng = Math.random } = {}) {
  if (!sequences.length) return null;
  const avoid = new Set([previous?.id, ...avoidIds].filter(Boolean));
  const tiers = [
    sequences.filter((s) => !avoid.has(s.id) && s.category !== previous?.category),
    sequences.filter((s) => !avoid.has(s.id)),
    sequences.filter((s) => s.id !== previous?.id),
    sequences,
  ];
  const pool = tiers.find((tier) => tier.length);
  const total = pool.reduce((sum, s) => sum + Math.max(0.01, s.priority ?? 1), 0);
  let roll = rng() * total;
  return pool.find((s) => (roll -= Math.max(0.01, s.priority ?? 1)) < 0) ?? pool[pool.length - 1];
}

/**
 * Opacité d'une séquence `age` secondes après son début : fondu entrant depuis le noir, plein,
 * puis fondu sortant vers le noir à la fin de `duration` (0 en dehors).
 */
export function fadeOpacity(age, duration, timing = SHOWCASE_TIMING) {
  if (age < 0 || age >= duration) return 0;
  const fadeIn = Math.min(1, age / timing.fadeIn);
  const fadeOut = Math.min(1, (duration - age) / timing.fadeOut);
  return Math.max(0, Math.min(fadeIn, fadeOut));
}
