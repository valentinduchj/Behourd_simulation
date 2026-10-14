import { Team } from '../../models/Team.js';
import { Emblem } from '../../models/Emblem.js';
import { PALETTE } from '../../data/palette.js';
import { EMBLEM_PATTERNS } from '../../data/emblemPatterns.js';
import { GAME_CONFIG } from '../../config/gameConfig.js';
import { pick, shuffle } from '../../utils/random.js';
import { generateRoster } from '../generation/FighterGenerator.js';
import { generateTeamName, firstNameOf } from '../generation/NameGenerator.js';
import { designateCaptain, pickAICaptainIndex } from '../roster/CaptainService.js';

export function validateTeamName(name) {
  const { nameMinLength, nameMaxLength } = GAME_CONFIG.team;
  if (name.length < nameMinLength) return `Le nom doit contenir au moins ${nameMinLength} caractères.`;
  if (name.length > nameMaxLength) return `Le nom ne peut pas dépasser ${nameMaxLength} caractères.`;
  return null;
}

export function normalizeTeamName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ');
}

export function createRandomEmblem(rng) {
  const [primary, secondary, tertiary] = shuffle(rng, PALETTE.map((color) => color.id));
  return new Emblem({ colors: { primary, secondary, tertiary }, patternId: pick(rng, EMBLEM_PATTERNS).id });
}

/**
 * Crée une équipe et génère son effectif. Renvoie { team, fighters }.
 * `captain` (combattant déjà créé) : premier membre de l'effectif, les autres sont générés
 * pour compléter l'effectif de départ. Sans capitaine fourni, le 1er ou le 2e combattant
 * généré est nommé capitaine (même règle que les clubs de l'IA).
 */
export function createTeamWithRoster({ name, emblem, ownerId = null, rng = Math.random, captain = null, levelStatRange = null }) {
  const team = new Team({ name, emblem, ownerId });
  const size = GAME_CONFIG.roster.size - (captain ? 1 : 0);
  const usedFirstNames = new Set(captain ? [firstNameOf(captain.name)] : []);
  const generated = generateRoster({ teamId: team.id, rng, size, usedFirstNames, levelStatRange });
  const fighters = captain ? [captain, ...generated] : generated;
  if (captain) captain.teamId = team.id;
  else designateCaptain(fighters, pickAICaptainIndex(team.id, fighters.length));
  team.fighterIds = fighters.map((fighter) => fighter.id);
  return { team, fighters };
}

export function createRandomTeam({ rng = Math.random, ownerId = null } = {}) {
  return createTeamWithRoster({
    name: generateTeamName(rng),
    emblem: createRandomEmblem(rng),
    ownerId,
    rng,
  });
}
