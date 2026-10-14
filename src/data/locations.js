import { SCREENS } from '../core/screenIds.js';

// Le monde du joueur : ses LIEUX et les SORTIES qui les relient (chemins, portes). Les cartes
// ne connaissent pas leurs destinations : elles dessinent et rendent cliquables les sorties
// décrites ici ; le changement de lieu passe par systems/navigation/LocationNavigationService.js.
//
// Lieu : { id, name, screen (écran du jeu, null tant qu'il n'existe pas), available }
//
// Sortie (LocationExit) :
//   id               identifiant unique
//   source           lieu où se trouve la sortie
//   destination      lieu atteint (null : passage fermé, rien n'y mène)
//   interactionType  'path' (bout de chemin) | 'door' (porte)
//   position         'path' : { x, y, w, h } en cases de la carte source (zone cliquable) ;
//                    'door' : { wall, y, width } (porte d'un mur, carte de la Taverne)
//   marker           'path' : emplacement du poteau indicateur (cases)
//   enabled          false : sortie dessinée mais inactive (lieu à venir)
//   transition       'fade' : fondu au noir (ui/navigation/travel.js)
//   arrival          sortie par laquelle on ARRIVE dans la destination (retour cohérent)
//   direction        flèche de l'indication au survol
//
// Ajouter un lieu : une entrée dans LOCATIONS (avec son écran), puis ses sorties ici.

export const LOCATIONS = Object.freeze({
  CENTRE: Object.freeze({ id: 'CENTRE', name: 'Le Centre', screen: SCREENS.CENTRE, available: true }),
  TAVERNE: Object.freeze({ id: 'TAVERNE', name: 'La Taverne', screen: SCREENS.TAVERN, available: true }),
  BOURG: Object.freeze({ id: 'BOURG', name: 'Le Bourg', screen: SCREENS.BOROUGH, available: true }),
  // Le Scriptorium (v0.59) remplace le Centre de formation prévu au bout du chemin nord-ouest.
  SCRIPTORIUM: Object.freeze({ id: 'SCRIPTORIUM', name: 'Le Scriptorium', screen: SCREENS.SCRIPTORIUM, available: true }),
  // Ma Lice d'entraînement (v0.71) : au bout du chemin sud-ouest, entre la Forêt et la Rivière.
  TRAINING: Object.freeze({ id: 'TRAINING', name: 'Ma Lice d’entraînement', screen: SCREENS.TRAINING, available: true }),
});

export const LOCATION_EXITS = Object.freeze([
  // --- Le Centre (hub) : un lieu au bout de chaque chemin ---
  Object.freeze({
    id: 'centre_exit_north_east', source: 'CENTRE', destination: 'TAVERNE', interactionType: 'path',
    position: Object.freeze({ x: 7, y: 0, w: 2, h: 1 }), marker: Object.freeze({ x: 8.75, y: 0.35 }), enabled: true, transition: 'fade', arrival: 'taverne_door_exit', direction: '↗',
  }),
  Object.freeze({
    id: 'centre_exit_south_east', source: 'CENTRE', destination: 'BOURG', interactionType: 'path',
    position: Object.freeze({ x: 16, y: 6, w: 1, h: 2 }), marker: Object.freeze({ x: 16.65, y: 6.3 }), enabled: true, transition: 'fade', arrival: 'bourg_path_north_west', direction: '↘',
  }),
  Object.freeze({
    id: 'centre_exit_north_west', source: 'CENTRE', destination: 'SCRIPTORIUM', interactionType: 'path',
    position: Object.freeze({ x: 0, y: 6, w: 1, h: 2 }), marker: Object.freeze({ x: 0.35, y: 6.3 }), enabled: true, transition: 'fade', arrival: 'scriptorium_door_exit', direction: '↖',
  }),
  // Bas-gauche (v0.71) : entre la Forêt et la Rivière, le chemin mène à Ma Lice d'entraînement.
  Object.freeze({
    id: 'centre_exit_south_west', source: 'CENTRE', destination: 'TRAINING', interactionType: 'path',
    position: Object.freeze({ x: 7, y: 13, w: 2, h: 1 }), marker: Object.freeze({ x: 6.7, y: 13.3 }), enabled: true, transition: 'fade', arrival: 'training_path_east', direction: '↙',
  }),

  // --- Ma Lice d'entraînement : le chemin de droite (côté est de la lice) ramène au Centre ---
  // (Repère de la carte, 17 × 14 comme le Centre : la lice 13 × 8 entourée de 2 cases à l'est et à
  // l'ouest, de 3 au nord et au sud ; le chemin occupe la dernière colonne, rangées 6–7.)
  Object.freeze({
    id: 'training_path_east', source: 'TRAINING', destination: 'CENTRE', interactionType: 'path',
    position: Object.freeze({ x: 16, y: 6, w: 1, h: 2 }), marker: Object.freeze({ x: 15.6, y: 5.55 }), enabled: true, transition: 'fade', arrival: 'centre_exit_south_west', direction: '↗',
  }),

  // --- La Taverne : la porte ramène au Centre ---
  Object.freeze({
    id: 'taverne_door_exit', source: 'TAVERNE', destination: 'CENTRE', interactionType: 'door',
    position: Object.freeze({ wall: 'left', y: 4.05, width: 0.95 }), enabled: true, transition: 'fade', arrival: 'centre_exit_north_east', direction: '↩',
  }),

  // --- Le Scriptorium : la porte (mur de gauche) ramène au Centre ---
  Object.freeze({
    id: 'scriptorium_door_exit', source: 'SCRIPTORIUM', destination: 'CENTRE', interactionType: 'door',
    position: Object.freeze({ wall: 'left', y: 4.5, width: 0.95 }), enabled: true, transition: 'fade', arrival: 'centre_exit_north_west', direction: '↩',
  }),

  // --- Le Bourg : le chemin haut-gauche ramène au Centre ---
  Object.freeze({
    id: 'bourg_path_north_west', source: 'BOURG', destination: 'CENTRE', interactionType: 'path',
    position: Object.freeze({ x: 0, y: 6, w: 1, h: 2 }), marker: Object.freeze({ x: 0.35, y: 6.3 }), enabled: true, transition: 'fade', arrival: 'centre_exit_south_east', direction: '↖',
  }),
]);

// Fondu du changement de lieu (secondes) : sortie au noir, puis apparition du nouveau lieu.
export const TRAVEL_TRANSITION = Object.freeze({ fadeOut: 0.32, fadeIn: 0.45, arrivalHighlight: 2.2 });
