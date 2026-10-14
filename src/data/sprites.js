import { hashString } from '../utils/random.js';
import { SPECIALTY_IDS } from './specialties.js';

// Catalogue des sprites des combattants — source unique.
//
// Un sprite appartient à UNE classe (spécialité) : 4 variantes par classe.
//   identifiant : <classe>_<variante>            ex. hastier_03
//   fichier     : assets/sprites/fighters/<classe>/<classe>_<variante>_<animation>.svg
//                                                 ex. assets/sprites/fighters/hastier/hastier_03_idle.svg
//
// Identité du combattant (fighter.id), classe (fighter.specialtyId), variante graphique
// (fighter.spriteId) et animation sont distinctes : le combattant n'enregistre que son
// spriteId, jamais un chemin d'image. Pour animer une variante plus tard, il suffit
// d'ajouter ses animations ici (walk, attack…) : la sélection et les sauvegardes ne changent pas.

// Couleurs du club sur le sprite : dans chaque fichier, les zones marquées
// data-club-color="<emplacement>" (primary, secondary, tertiary : couleurs de l'emblème du
// club, models/Emblem.js) prennent la couleur correspondante du club du combattant. Leur
// couleur d'origine reste celle d'un combattant sans club (recrue de la Taverne, aperçu).
// Règle actuelle : chaque variante a UN tabard, marqué "primary" (couleur principale du
// club). Une bordure ou un motif en couleur secondaire s'ajoute en marquant une autre zone.
// Le combattant n'enregistre aucune couleur : elle découle de son club (render/sprites.js).
export const CLUB_COLOR_ATTRIBUTE = 'data-club-color';
export const TABARD_COLOR_SLOT = 'primary';

/** Animations prévues pour chaque variante (seule « idle », image fixe, existe pour l'instant). */
export const SPRITE_ANIMATIONS = Object.freeze(['idle', 'walk', 'attack', 'hit', 'death', 'victory']);
export const DEFAULT_ANIMATION = 'idle';

export const SPRITE_VARIANTS_PER_CLASS = 4;

const pad = (n) => String(n).padStart(2, '0');

/** Chemin conventionnel d'une animation d'une variante. */
export function spriteAnimationFile(classId, variant, animation) {
  return `assets/sprites/fighters/${classId}/${classId}_${pad(variant)}_${animation}.svg`;
}

/**
 * Définition d'une variante. animations : { [nom]: { file, frames, fps } } — une animation
 * absente retombe sur « idle » (getSpriteAsset).
 */
const fighterSprite = (classId, variant, name, animations = [DEFAULT_ANIMATION]) => Object.freeze({
  id: `${classId}_${pad(variant)}`,
  classId,
  variant,
  name,
  animations: Object.freeze(Object.fromEntries(animations.map((animation) => [animation, Object.freeze({
    file: spriteAnimationFile(classId, variant, animation), frames: 1, fps: 0,
  })]))),
});

export const FIGHTER_SPRITES = Object.freeze([
  // Runner : armure légère, casque fermé à grille (type Wolfrib), petit bouclier rond.
  fighterSprite('runner', 1, 'Runner au gambeson vert'),
  fighterSprite('runner', 2, 'Runner au gambeson bleu'),
  fighterSprite('runner', 3, 'Runner au cuir et au plumet'),
  fighterSprite('runner', 4, 'Runner à la croix'),
  // Hastier : armure de plates très lourde, casque très fermé, arme d'hast, aucun bouclier.
  fighterSprite('hastier', 1, 'Hastier au heaume et à la hallebarde'),
  fighterSprite('hastier', 2, 'Hastier au bassinet à bec et à la hache d’armes'),
  fighterSprite('hastier', 3, 'Hastier au heaume à bouche de grenouille et à la vouge'),
  fighterSprite('hastier', 4, 'Hastier à l’armet et au bec de corbin'),
  // Lutteur : armure moyenne (mailles et brigandine), épée, bouclier.
  fighterSprite('lutteur', 1, 'Lutteur à la salade et au chevron'),
  fighterSprite('lutteur', 2, 'Lutteur à la barbute et à la brigandine'),
  fighterSprite('lutteur', 3, 'Lutteur au bassinet et à la croix'),
  fighterSprite('lutteur', 4, 'Lutteur au casque à nasal et aux bandes'),
]);

const SPRITES_BY_ID = new Map(FIGHTER_SPRITES.map((sprite) => [sprite.id, sprite]));

/** Sprites de chaque classe : { runner: [...], hastier: [...], lutteur: [...] }. */
export const SPRITES_BY_CLASS = Object.freeze(Object.fromEntries(SPECIALTY_IDS.map((classId) => [
  classId, Object.freeze(FIGHTER_SPRITES.filter((sprite) => sprite.classId === classId)),
])));

export function getSprite(id) {
  return SPRITES_BY_ID.get(id) ?? null;
}

/** Les variantes proposées pour une classe (les seules autorisées pour un combattant de cette classe). */
export function getSpritesForClass(classId) {
  return SPRITES_BY_CLASS[classId] ?? [];
}

/** Règle métier : le sprite existe et appartient à la classe du combattant. */
export function isValidSprite(classId, spriteId) {
  return getSprite(spriteId)?.classId === classId;
}

/** Fichier d'une animation d'un sprite (« idle » si l'animation n'existe pas encore). */
export function getSpriteAsset(spriteId, animation = DEFAULT_ANIMATION) {
  const sprite = getSprite(spriteId) ?? FIGHTER_SPRITES[0];
  return (sprite.animations[animation] ?? sprite.animations[DEFAULT_ANIMATION]).file;
}

/**
 * Sprite valide pour une classe :
 *   - le sprite donné s'il appartient à la classe ;
 *   - sinon, après un changement de classe, la même variante dans la nouvelle classe
 *     (runner_03 → hastier_03) ;
 *   - sinon (ancien sprite, aucun sprite), une variante déterminée par `seed` (identifiant
 *     du combattant) : elle reste identique d'un chargement à l'autre.
 */
export function resolveSpriteId(classId, spriteId, seed = '') {
  const choices = getSpritesForClass(classId);
  if (!choices.length) return spriteId ?? FIGHTER_SPRITES[0].id;
  if (isValidSprite(classId, spriteId)) return spriteId;
  const sameVariant = choices.find((sprite) => sprite.variant === getSprite(spriteId)?.variant);
  if (sameVariant) return sameVariant.id;
  return choices[hashString(String(seed)) % choices.length].id;
}
