import { SCREENS } from '../../core/screenIds.js';

// Accès de la barre latérale du hub de gestion : les interfaces globales (compagnie, ligue) et
// l'entrée dans le domaine. Les lieux physiques (Taverne, Bourg…) ne sont PAS ici : on s'y rend
// par les chemins et les portes des cartes (data/locations.js), depuis le Centre.
// Pour ajouter une interface globale : créer son écran (extends HubScreen) puis l'ajouter ici.
export const HUB_LOCATIONS = Object.freeze([
  { id: 'team', label: 'La Compagnie', icon: '🛡', screen: SCREENS.TEAM, hint: 'Vos combattants' },
  { id: 'centre', label: 'Le Centre', icon: '⛺', screen: SCREENS.CENTRE, hint: 'Le domaine : Taverne, Bourg et Scriptorium par les chemins' },
  { id: 'league', label: 'La Ligue', icon: '🏆', screen: SCREENS.LEAGUE, hint: 'Classement' },
]);
