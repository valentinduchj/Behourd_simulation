// Écran principal — séquences d'arrière-plan (« vitrine » du jeu), de chaque côté du menu.
// Présentation uniquement. Lecteur : ui/mainMenu/MainMenuShowcase.js ; scènes : ui/mainMenu/showcaseScenes.js.
//
// Séquence (MainMenuVideo) :
//   id         identifiant unique
//   category   CAMP | TAVERNE | COMBAT | BOURG
//   source     { type: 'scene', scene, options }  scène rendue en direct par le moteur du jeu
//              { type: 'video', path }            fichier vidéo (assets/…), lu sans son ; un fichier
//                                                 absent ou illisible est ignoré (séquence suivante)
//   duration   secondes à l'écran, fondus compris (3 à 6)
//   position   'left' | 'right' | 'any' : côté(s) où elle peut passer
//   priority   poids du tirage (plus haut = plus fréquent)
//   enabled    false : retirée de la rotation
//
// Ajouter une séquence = ajouter une entrée. Une vidéo enregistrée se déclare ainsi :
//   { id: 'combat-video', category: 'COMBAT', source: { type: 'video', path: 'assets/videos/combat.webm' }, … }

export const SHOWCASE_CATEGORIES = Object.freeze(['CAMP', 'TAVERNE', 'COMBAT', 'BOURG']);

export const SHOWCASE_TIMING = Object.freeze({
  minDuration: 3,
  maxDuration: 6,
  // Fondus au noir, à l'entrée et à la sortie (secondes), puis un instant de noir entre deux scènes.
  fadeIn: 0.7,
  fadeOut: 0.7,
  blackGap: 0.35,
  // Opacité maximale d'une séquence : la vitrine reste en retrait derrière le menu.
  maxOpacity: 0.58,
  // Premier démarrage différé : le menu s'affiche et répond d'abord (millisecondes).
  startDelayMs: 400,
  // Décalage du côté droit, pour que les deux côtés ne changent pas en même temps (secondes).
  rightOffset: 2.2,
  // Images par seconde des scènes (arrière-plan : inutile de viser plus).
  fps: 30,
});

export const MAIN_MENU_VIDEOS = Object.freeze([
  // --- Le camp (Centre) : animations des activités ---
  { id: 'camp-river', category: 'CAMP', source: { type: 'scene', scene: 'centre', options: { focus: 'river' } }, duration: 5, position: 'any', priority: 3, enabled: true },
  { id: 'camp-banquet', category: 'CAMP', source: { type: 'scene', scene: 'centre', options: { focus: 'banquet' } }, duration: 5, position: 'any', priority: 2, enabled: true },
  { id: 'camp-pole', category: 'CAMP', source: { type: 'scene', scene: 'centre', options: { focus: 'pole' } }, duration: 6, position: 'any', priority: 3, enabled: true },
  { id: 'camp-forest', category: 'CAMP', source: { type: 'scene', scene: 'centre', options: { focus: 'forest' } }, duration: 4, position: 'any', priority: 2, enabled: true },
  { id: 'camp-overview', category: 'CAMP', source: { type: 'scene', scene: 'centre', options: { focus: 'overview', walker: true } }, duration: 6, position: 'any', priority: 2, enabled: true },
  // --- La Taverne ---
  { id: 'tavern', category: 'TAVERNE', source: { type: 'scene', scene: 'tavern', options: {} }, duration: 5, position: 'any', priority: 3, enabled: true },
  // --- Combats : plusieurs formats ---
  { id: 'combat-1v1', category: 'COMBAT', source: { type: 'scene', scene: 'combat', options: { size: 1 } }, duration: 5, position: 'any', priority: 3, enabled: true },
  { id: 'combat-2v2', category: 'COMBAT', source: { type: 'scene', scene: 'combat', options: { size: 2 } }, duration: 5, position: 'any', priority: 3, enabled: true },
  { id: 'combat-melee', category: 'COMBAT', source: { type: 'scene', scene: 'combat', options: { size: 4 } }, duration: 6, position: 'any', priority: 2, enabled: true },
  // --- Le Bourg : survol ---
  { id: 'borough', category: 'BOURG', source: { type: 'scene', scene: 'borough', options: { pan: true } }, duration: 6, position: 'any', priority: 3, enabled: true },
]);
