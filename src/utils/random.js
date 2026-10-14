// Générateurs aléatoires. Toute la génération reçoit une fonction `rng` (() => [0, 1[)
// afin de pouvoir rejouer une situation à partir d'une graine (tests, module Admin).

export function createRng(seed) {
  if (seed === undefined || seed === null || seed === '') return Math.random;
  let state = hashString(seed);
  // mulberry32
  return function rng() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Empreinte numérique stable d'une chaîne (FNV-1a). */
export function hashString(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function shuffle(rng, list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
