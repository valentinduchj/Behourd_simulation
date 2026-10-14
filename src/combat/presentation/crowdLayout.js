import { CROWD_LAYOUT } from '../../data/crowd.js';
import { SPECTATOR_SPRITES, QUEEN_SPRITE } from '../../data/spectators.js';
import { createRng } from '../../utils/random.js';

// Placement de la foule autour de La Lice — PRÉSENTATION uniquement : les spectateurs
// ne sont ni des unités ni des obstacles et n'interviennent dans aucun calcul de combat.
//
// Les spectateurs se tiennent en rangées le long de la palissade, à l'extérieur de la
// grille de combat, tournés vers elle :
//   côtés arrière (y < 0, x < 0) : vus de face ; côtés avant (y > hauteur, x > largeur) : vus de dos.
// Les longs côtés se remplissent en priorité, et le centre de chaque côté avant les extrémités.

/** Places possibles autour de la grille de combat (coordonnées de la grille de combat). */
export function listCrowdSlots(arena, layout = CROWD_LAYOUT) {
  const long = arena.width >= arena.height ? 'x' : 'y';
  const sides = [
    { id: 'north', axis: 'x', fixed: (d) => -d, view: 'front' },
    { id: 'south', axis: 'x', fixed: (d) => arena.height + d, view: 'back' },
    { id: 'west', axis: 'y', fixed: (d) => -d, view: 'front' },
    { id: 'east', axis: 'y', fixed: (d) => arena.width + d, view: 'back' },
  ];
  const slots = [];
  for (const side of sides) {
    const length = side.axis === 'x' ? arena.width : arena.height;
    const isLong = side.axis === long;
    layout.rows.forEach((distance, row) => {
      // Rangées décalées d'une demi-place pour que le second rang voie entre les têtes du premier.
      const offset = layout.margin + (row % 2 ? layout.spacing / 2 : 0);
      for (let t = offset; t <= length - layout.margin + 1e-9; t += layout.spacing) {
        const along = t;
        const across = side.fixed(distance);
        slots.push({
          side: side.id, row, view: side.view, long: isLong,
          x: side.axis === 'x' ? along : across,
          y: side.axis === 'x' ? across : along,
          centrality: Math.abs(t / length - 0.5) * 2, // 0 au centre du côté, 1 aux extrémités
        });
      }
    });
  }
  return slots;
}

/**
 * Place de La Reine (Combats de la Reine) : au centre du grand côté arrière, au premier
 * rang, face à la caméra et à La Lice. Hors de la grille de combat.
 */
export function getQueenPlace(arena, layout = CROWD_LAYOUT) {
  return { x: arena.width / 2, y: -layout.rows[0], side: 'north', view: 'front' };
}

/**
 * Génère la foule : [{ spriteId, x, y, view, flip, scale, phase, isQueen? }] (coordonnées
 * de la grille de combat). `count` est plafonné par la capacité et par layout.maxRendered.
 * `withQueen` : ajoute La Reine (sprite unique, en plus des spectateurs) et lui laisse de la place.
 */
export function generateCrowd({ arena, count, seed = 'lice', layout = CROWD_LAYOUT, sprites = SPECTATOR_SPRITES, withQueen = false }) {
  const rng = createRng(`crowd:${seed}`);
  const shortPenalty = 1 - layout.sideWeights.short / layout.sideWeights.long;
  const queen = withQueen ? getQueenPlace(arena, layout) : null;
  const slots = listCrowdSlots(arena, layout)
    .filter((slot) => !queen || Math.hypot(slot.x - queen.x, slot.y - queen.y) >= layout.queenClearance)
    .map((slot) => ({ slot, score: slot.row + (slot.long ? 0 : shortPenalty) + slot.centrality * 0.5 + rng() * 0.6 }))
    .sort((a, b) => a.score - b.score)
    .map(({ slot }) => slot);
  const size = Math.max(0, Math.min(Math.round(count) || 0, layout.maxRendered, slots.length));

  const totalWeight = sprites.reduce((sum, sprite) => sum + (sprite.weight ?? 1), 0);
  const pickSprite = () => {
    let roll = rng() * totalWeight;
    return sprites.find((sprite) => (roll -= sprite.weight ?? 1) < 0) ?? sprites[sprites.length - 1];
  };
  let previous = null;
  const royal = queen ? [{ spriteId: QUEEN_SPRITE.id, ...queen, flip: false, scale: QUEEN_SPRITE.heightScale, phase: 0, isQueen: true }] : [];
  return [...royal, ...slots.slice(0, size).map((slot) => {
    let sprite = pickSprite();
    if (sprite.id === previous) sprite = pickSprite(); // évite les doublons successifs
    previous = sprite.id;
    const jitter = () => (rng() * 2 - 1) * layout.jitter;
    const alongX = slot.side === 'north' || slot.side === 'south';
    return {
      spriteId: sprite.id,
      x: slot.x + (alongX ? jitter() : jitter() * 0.5),
      y: slot.y + (alongX ? jitter() * 0.5 : jitter()),
      side: slot.side,
      view: slot.view,
      flip: rng() < 0.5,
      scale: 1 + (rng() * 2 - 1) * layout.heightVariation,
      phase: rng() * Math.PI * 2,
    };
  })];
}
