import { FRENCH_CUP_RULES } from '../../data/frenchCup.js';
import { createRng, shuffle } from '../../utils/random.js';

// Tableau final (BracketManager) : 32 qualifiés tirés au sort (graine de l'édition), puis
// seizièmes → huitièmes → quarts → demies → finale. Tout le tableau existe dès le tirage :
// les places des tours suivants se remplissent avec les vainqueurs (match i → match ⌊i/2⌋ du
// tour suivant, en haut si i est pair). Une équipe ne peut donc jamais y figurer deux fois, ni
// y revenir une fois éliminée.

/** Tableau vide de `bracketSize` équipes : [{ id, name, index, matches: [{ id, teamAId, teamBId, status }] }]. */
export function createBracket(qualifiedIds, seed, rules = FRENCH_CUP_RULES) {
  if (new Set(qualifiedIds).size !== qualifiedIds.length) throw new Error('Tableau : équipe en double.');
  if (qualifiedIds.length !== rules.bracketSize) throw new Error(`Tableau : ${qualifiedIds.length} qualifiés pour ${rules.bracketSize} places.`);
  const order = shuffle(createRng(`tableau:${seed}`), [...qualifiedIds]);
  const rounds = [];
  let size = rules.bracketSize / 2;
  rules.knockoutRounds.forEach((name, index) => {
    const matches = Array.from({ length: size }, (_, i) => ({
      id: `T${index + 1}-${i + 1}`, round: index, slot: i,
      teamAId: index === 0 ? order[i * 2] : null,
      teamBId: index === 0 ? order[i * 2 + 1] : null,
      status: 'pending',
    }));
    rounds.push({ id: `T${index + 1}`, index, name, matches });
    size /= 2;
  });
  return { rounds };
}

/** Inscrit le vainqueur d'un combat du tableau à sa place du tour suivant. */
export function propagateWinner(bracket, match) {
  const next = bracket.rounds[match.round + 1];
  if (!next || !match.winnerId) return null;
  const target = next.matches[Math.floor(match.slot / 2)];
  if (match.slot % 2 === 0) target.teamAId = match.winnerId; else target.teamBId = match.winnerId;
  return target;
}

/** Équipes encore en lice dans le tableau (jamais battues). */
export function aliveInBracket(bracket) {
  const losers = new Set();
  const teams = new Set();
  for (const round of bracket.rounds) {
    for (const match of round.matches) {
      for (const id of [match.teamAId, match.teamBId]) if (id) teams.add(id);
      if (match.status === 'played') losers.add(match.winnerId === match.teamAId ? match.teamBId : match.teamAId);
    }
  }
  return [...teams].filter((id) => !losers.has(id));
}
