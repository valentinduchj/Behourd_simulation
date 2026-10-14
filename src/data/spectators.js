// Sprites des spectateurs de La Lice (fichiers SVG dans assets/sprites/spectators/).
// Chaque profil a une vue de face (spectateur tourné vers la caméra) et une vue de dos
// (spectateur placé entre la caméra et La Lice). Purement visuel.
//
// Pour ajouter un profil : déposer spectator_NN_front.svg et spectator_NN_back.svg puis
// l'ajouter à cette liste. `weight` : fréquence relative dans la foule.
export const SPECTATOR_SPRITES = Object.freeze([
  { id: 'spectator_01', name: 'Bourgeois au chaperon', weight: 10 },
  { id: 'spectator_02', name: 'Bourgeoise à la guimpe', weight: 10 },
  { id: 'spectator_03', name: 'Paysan à la fourche', weight: 12 },
  { id: 'spectator_04', name: 'Paysanne au panier', weight: 12 },
  { id: 'spectator_05', name: 'Marchand', weight: 8 },
  { id: 'spectator_06', name: 'Seigneur', weight: 4 },
  { id: 'spectator_07', name: 'Dame au hennin', weight: 4 },
  { id: 'spectator_08', name: 'Soldat à la lance', weight: 8 },
  { id: 'spectator_09', name: 'Archer', weight: 7 },
  { id: 'spectator_10', name: 'Moine', weight: 5 },
  { id: 'spectator_11', name: 'Enfant', weight: 8 },
].map((sprite) => Object.freeze({
  ...sprite,
  files: Object.freeze({
    front: `assets/sprites/spectators/${sprite.id}_front.svg`,
    back: `assets/sprites/spectators/${sprite.id}_back.svg`,
  }),
})));

/**
 * La Reine : sprite unique (hors du tirage de la foule), présente aux Combats de la Reine
 * comme spectatrice privilégiée. `heightScale` : un peu plus grande que les spectateurs,
 * dans l'échelle humaine. Vue de face uniquement (elle se tient derrière La Lice).
 */
export const QUEEN_SPRITE = Object.freeze({
  id: 'queen_sprite',
  name: 'La Reine',
  heightScale: 1.18,
  files: Object.freeze({ front: 'assets/sprites/queen_sprite.svg', back: 'assets/sprites/queen_sprite.svg' }),
});

/** Artisans du Bourg (personnages uniques, vue de face). */
export const ARTISAN_SPRITES = Object.freeze(['carpenter', 'woodcutter', 'seneschal', 'baker', 'tavernkeeper'].map((id) => Object.freeze({
  id: `artisan_${id}`,
  heightScale: 1.05,
  files: Object.freeze({ front: `assets/sprites/borough/artisan_${id}.svg`, back: `assets/sprites/borough/artisan_${id}.svg` }),
})));

/** Personnages uniques du Scriptorium (vue de face) : la Professeure Flavia. */
export const SCRIPTORIUM_SPRITES = Object.freeze([
  Object.freeze({ id: 'scriptorium_flavia', name: 'Professeure Flavia', heightScale: 1.08, files: Object.freeze({ front: 'assets/sprites/scriptorium/professor_flavia.svg', back: 'assets/sprites/scriptorium/professor_flavia.svg' }) }),
]);

/** Ma Lice d'entraînement (v0.71) : le Marshal, arbitre du béhourd (attente, signal de départ). */
export const TRAINING_SPRITES = Object.freeze([
  Object.freeze({ id: 'training_marshal', name: 'Marshal', heightScale: 1.08, files: Object.freeze({ front: 'assets/sprites/training/marshal.svg', back: 'assets/sprites/training/marshal.svg' }) }),
  Object.freeze({ id: 'training_marshal_signal', name: 'Marshal (signal)', heightScale: 1.08, files: Object.freeze({ front: 'assets/sprites/training/marshal_signal.svg', back: 'assets/sprites/training/marshal_signal.svg' }) }),
]);

export function getSpectatorSprite(id) {
  if (id === QUEEN_SPRITE.id) return QUEEN_SPRITE;
  return SPECTATOR_SPRITES.find((sprite) => sprite.id === id) ?? ARTISAN_SPRITES.find((sprite) => sprite.id === id)
    ?? SCRIPTORIUM_SPRITES.find((sprite) => sprite.id === id) ?? TRAINING_SPRITES.find((sprite) => sprite.id === id) ?? null;
}
