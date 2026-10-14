import { FIRST_NAMES, PLACES, EPITHETS, NAME_FORM_WEIGHTS, TEAM_NOUNS } from '../../data/names.js';
import { pick } from '../../utils/random.js';

const STARTS_WITH_VOWEL = /^[aeiouyàâäéèêëîïôöûüœ]/i;

/** "de Rouen", "d'Évreux". */
export function withParticle(place) {
  return STARTS_WITH_VOWEL.test(place) ? `d’${place}` : `de ${place}`;
}

/** { firstName, epithet } → "Guillaume de Rouen". */
export function composeFighterName({ firstName, epithet }) {
  return epithet ? `${firstName} ${epithet}` : firstName;
}

/** Premier mot d'un nom complet, pour éviter les doublons de prénoms. */
export function firstNameOf(fullName) {
  return String(fullName ?? '').split(' ')[0];
}

export function generateFighterName(rng, usedFirstNames = new Set()) {
  const available = FIRST_NAMES.filter((name) => !usedFirstNames.has(name));
  const firstName = pick(rng, available.length ? available : FIRST_NAMES);

  const roll = rng();
  let epithet = '';
  if (roll < NAME_FORM_WEIGHTS.origin) {
    epithet = withParticle(pick(rng, PLACES));
  } else if (roll < NAME_FORM_WEIGHTS.origin + NAME_FORM_WEIGHTS.epithet) {
    epithet = pick(rng, EPITHETS);
  }
  return { firstName, epithet };
}

/** Génère `count` noms dont les prénoms sont tous différents (et absents de `usedFirstNames`). */
export function generateFighterNames(count, rng, usedFirstNames = new Set()) {
  const used = new Set(usedFirstNames);
  return Array.from({ length: count }, () => {
    const name = generateFighterName(rng, used);
    used.add(name.firstName);
    return name;
  });
}

export function generateTeamName(rng) {
  return `${pick(rng, TEAM_NOUNS)} ${withParticle(pick(rng, PLACES))}`;
}
