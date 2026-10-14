import { FRENCH_CUP_RULES } from '../../data/frenchCup.js';
import { createRng, shuffle } from '../../utils/random.js';

// Tirage au sort de la Coupe de France (DrawManager) : aucune tête de série, aucun chapeau.
// L'ordre de tirage complet est fixé à la création de l'édition (graine de l'édition) : tirer
// équipe par équipe ou tout d'un coup donne exactement le même résultat. Les places se
// remplissent dans l'ordre A1, B1, … I1, puis A2, B2, … I2, … jusqu'à I6.

/**
 * Équipes françaises de la partie : la compagnie du joueur et tous les clubs des Ligues
 * (lus dans la partie, jamais ajoutés à la main ; sans doublon).
 */
export function getFrenchTeamIds(session) {
  const ids = new Set([session.player.teamId]);
  for (const league of session.leagues) for (const id of league.teamIds) ids.add(id);
  return [...ids].filter((id) => session.getTeam(id));
}

/** Poules vides : [{ id: 'A', name: 'Poule A', teamIds: [] , matches: [] }]. */
export function createEmptyGroups(rules = FRENCH_CUP_RULES) {
  return rules.groupLetters.slice(0, rules.groupCount).map((letter) => ({ id: letter, name: `Poule ${letter}`, teamIds: [], matches: [] }));
}

/** Ordre de tirage : les équipes mélangées par la graine de l'édition. */
export function createDrawOrder(teamIds, seed) {
  return shuffle(createRng(`tirage:${seed}`), [...teamIds]);
}

/** Place n° k du tirage (0 = A1, 1 = B1… 9 = A2…) : { groupIndex, position }. */
export function slotOf(k, rules = FRENCH_CUP_RULES) {
  return { groupIndex: k % rules.groupCount, position: Math.floor(k / rules.groupCount) };
}

/** Libellé d'une place : « A1 », « I6 ». */
export function slotLabel(k, rules = FRENCH_CUP_RULES) {
  const { groupIndex, position } = slotOf(k, rules);
  return `${rules.groupLetters[groupIndex]}${position + 1}`;
}

/** Tire la prochaine équipe dans la prochaine place. Renvoie { teamId, slot } ou null (tirage fini). */
export function drawNextTeam(cup, rules = FRENCH_CUP_RULES) {
  const { draw } = cup;
  if (draw.completed || draw.drawn >= draw.order.length) return null;
  const teamId = draw.order[draw.drawn];
  const { groupIndex, position } = slotOf(draw.drawn, rules);
  cup.groups[groupIndex].teamIds[position] = teamId;
  const slot = slotLabel(draw.drawn, rules);
  draw.drawn += 1;
  if (draw.drawn >= draw.order.length) draw.completed = true;
  return { teamId, slot };
}

/** Termine le tirage d'un coup (même résultat que tirer une à une). Renvoie le nombre tiré. */
export function drawAllTeams(cup, rules = FRENCH_CUP_RULES) {
  let count = 0;
  while (drawNextTeam(cup, rules)) count += 1;
  return count;
}
