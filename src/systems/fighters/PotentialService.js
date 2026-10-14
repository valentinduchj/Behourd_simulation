import { AGE_CONFIG, POTENTIAL_CONFIG } from '../../data/fighterProfile.js';
import { randInt } from '../../utils/random.js';
import { canPotentialDrop, potentialBoost } from '../talents/TalentEffects.js';

// Âge et potentiel des combattants — logique centralisée, sans interface.
//
// Âge : tiré à la création, enregistré avec le combattant, puis +1 an à chaque fin de
// saison (SeasonService.applyAgeIncrease) — jamais selon le nombre de jours écoulés.
//
// Potentiel : entier de 0 à 3, tiré à la création, puis vérifié tous les
// POTENTIAL_CONFIG.checkIntervalDays jours (à partir de la création) selon la tranche d'âge.
// C'est une capacité d'évolution, jamais une évolution garantie.

const clampPotential = (value) => Math.max(POTENTIAL_CONFIG.min, Math.min(POTENTIAL_CONFIG.max, value));

/** Potentiel initial, tiré selon POTENTIAL_CONFIG.initialDistribution. */
export function rollInitialPotential(rng = Math.random, config = POTENTIAL_CONFIG) {
  const total = config.initialDistribution.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  const entry = config.initialDistribution.find((candidate) => (roll -= candidate.weight) < 0);
  return clampPotential((entry ?? config.initialDistribution[config.initialDistribution.length - 1]).potential);
}

/** Âge initial, entre AGE_CONFIG.initial.min et max. */
export function rollInitialAge(rng = Math.random, config = AGE_CONFIG) {
  return randInt(rng, config.initial.min, config.initial.max);
}

/** Donne âge et potentiel à un combattant qui n'en a pas encore (création, ancienne sauvegarde). */
export function initializeFighterProfile(fighter, { day, rng = Math.random }) {
  let changed = false;
  if (fighter.age === null || fighter.age === undefined) {
    fighter.age = rollInitialAge(rng);
    changed = true;
  }
  if (fighter.potential === null || fighter.potential === undefined) {
    fighter.potential = rollInitialPotential(rng);
    changed = true;
  }
  if (fighter.potentialCheckDay === null || fighter.potentialCheckDay === undefined) {
    fighter.potentialCheckDay = day;
    changed = true;
  }
  return changed;
}

/** Âge actuel du combattant (null si non défini : combattants des clubs de l'IA). */
export function getFighterAge(fighter) {
  return typeof fighter.age === 'number' ? fighter.age : null;
}

/** Vieillissement de fin de saison : +AGE_CONFIG.yearsPerSeason an(s). Renvoie le nouvel âge. */
export function ageFighter(fighter, config = AGE_CONFIG) {
  if (typeof fighter.age !== 'number') return null;
  fighter.age += config.yearsPerSeason;
  return fighter.age;
}

export function getPotential(fighter) {
  return clampPotential(fighter.potential ?? 0);
}

/** Règle de la tranche d'âge (ou null : aucune évolution à cet âge). */
export function getPotentialRule(age, config = POTENTIAL_CONFIG) {
  return config.ageBands.find((band) => age >= band.minAge && age <= band.maxAge) ?? null;
}

/**
 * Vérification du potentiel d'un combattant au jour `day` : tranche d'âge, tirage,
 * modification éventuelle (toujours entre 0 et 3). Renvoie l'événement du carnet de bord
 * si le potentiel a effectivement changé, sinon null.
 */
export function updateFighterPotential(fighter, { day, rng = Math.random, config = POTENTIAL_CONFIG }) {
  const age = getFighterAge(fighter);
  let rule = age === null ? null : getPotentialRule(age, config);
  // Talents : Vieux loup / Élu des dieux (pas de baisse) ; Précoce / Élu des dieux (hausse plus
  // probable ; l'Élu peut progresser à tout âge).
  const boost = age === null ? { value: 0, anyAge: false } : potentialBoost(fighter, age);
  if (rule && rule.change < 0 && !canPotentialDrop(fighter, age)) rule = null;
  if (!rule && boost.anyAge) rule = { change: 1, chances: {} };
  if (!rule) return null;
  const current = getPotential(fighter);
  const chance = (rule.chances[current] ?? 0) + (rule.change > 0 ? boost.value : 0);
  if (!chance) return null;
  if (rng() >= chance) return null;
  const next = clampPotential(current + rule.change);
  if (next === current) return null;
  fighter.potential = next;
  return {
    type: 'fighter.potential',
    fighterId: fighter.id,
    name: fighter.name,
    age,
    change: next - current,
    potential: next,
  };
}

/**
 * Phase quotidienne : pour chaque combattant du joueur, les vérifications dues depuis la
 * dernière (une tous les 15 jours, rattrapées si des jours ont été sautés). Les
 * changements effectifs vont au carnet. Renvoie les événements.
 */
export function runPotentialChecks(session, { rng = Math.random, report = null, config = POTENTIAL_CONFIG } = {}) {
  const today = session.calendar.currentDay;
  const events = [];
  for (const fighter of session.playerFighters) {
    if (fighter.potentialCheckDay === null || fighter.potentialCheckDay === undefined) continue;
    while (fighter.potentialCheckDay + config.checkIntervalDays <= today) {
      fighter.potentialCheckDay += config.checkIntervalDays;
      const event = updateFighterPotential(fighter, { day: fighter.potentialCheckDay, rng, config });
      if (event) {
        events.push(event);
        report?.add(event);
      }
    }
  }
  if (events.length) session.markDirty();
  return events;
}

/** Combattants du joueur et recrues de la Taverne sans âge ni potentiel (anciennes sauvegardes). */
export function ensureFighterProfiles(session, rng = Math.random) {
  const day = session.calendar.currentDay;
  const fighters = [...session.playerFighters, ...session.recruitment.candidates.map((candidate) => candidate.fighter)];
  return fighters.filter((fighter) => initializeFighterProfile(fighter, { day, rng })).length;
}
