// Effets visuels en attente d'un lieu (mémoire de la session de jeu, jamais sauvegardés) :
// un achat au Bourg déclenche un chantier sur l'installation améliorée, joué à la prochaine
// visite du Centre. Une rotation de la Taverne est jouée à la première visite qui suit.

const queues = new Map();

/** Met un effet en attente pour un lieu ('centre'…). */
export function queueSceneEffect(place, effect) {
  if (!queues.has(place)) queues.set(place, []);
  queues.get(place).push(effect);
}

/** Effets en attente d'un lieu, retirés de la file. */
export function takeSceneEffects(place) {
  const effects = queues.get(place) ?? [];
  queues.delete(place);
  return effects;
}

// Rotation de la Taverne déjà vue (par partie) : jour de génération de l'offre affichée.
const seenRotations = new WeakMap();

/** Vrai si l'offre de la Taverne a changé depuis la dernière fois qu'elle a été montrée. */
export function hasUnseenTavernRotation(session) {
  return seenRotations.get(session) !== session.recruitment.generatedOnDay;
}

export function markTavernRotationSeen(session) {
  seenRotations.set(session, session.recruitment.generatedOnDay);
}
