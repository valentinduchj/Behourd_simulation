import { SCREENS } from '../../core/screenIds.js';

// Colonne de droite du hub de gestion (v0.80) : deux encarts de boutons.
//   - « Ma compagnie » : les interfaces globales (combattants, inventaire, classement) ;
//   - « Le domaine » : les lieux, accessibles d'un clic — en plus des chemins et des portes des
//     cartes (data/locations.js), qui restent le moyen de s'y rendre « à pied ».
// Un bouton mène à un écran (`screen`) ou ouvre une fenêtre (`action`, géré par HubScreen).
// Pour ajouter un lieu : créer son écran (extends HubScreen, static hubLocationId) puis l'ajouter ici.
export const HUB_NAV_GROUPS = Object.freeze([
  Object.freeze({
    id: 'company',
    label: 'Ma compagnie',
    items: Object.freeze([
      Object.freeze({ id: 'team', label: 'La Compagnie', icon: '🛡', screen: SCREENS.TEAM, hint: 'Vos combattants' }),
      Object.freeze({ id: 'chest', label: 'Le Coffre', icon: '🧰', action: 'chest' }),
      Object.freeze({ id: 'league', label: 'La Ligue', icon: '🏆', screen: SCREENS.LEAGUE, hint: 'Classement' }),
    ]),
  }),
  Object.freeze({
    id: 'domain',
    label: 'Le domaine',
    items: Object.freeze([
      Object.freeze({ id: 'centre', label: 'Le Centre', icon: '⛺', screen: SCREENS.CENTRE, hint: 'Activités et entraînement' }),
      Object.freeze({ id: 'borough', label: 'Le Bourg', icon: '🏘', screen: SCREENS.BOROUGH, hint: 'Artisans et améliorations' }),
      Object.freeze({ id: 'tavern', label: 'La Taverne', icon: '🍺', screen: SCREENS.TAVERN, hint: 'Recrutement' }),
      Object.freeze({ id: 'training', label: 'Ma Lice', icon: '🎯', screen: SCREENS.TRAINING, hint: 'Combats d’entraînement' }),
      Object.freeze({ id: 'scriptorium', label: 'Le Scriptorium', icon: '📜', screen: SCREENS.SCRIPTORIUM, hint: 'Études et talents' }),
      Object.freeze({ id: 'expeditions', label: 'Les Expéditions', icon: '🧭', screen: SCREENS.EXPEDITIONS, hint: 'Le Baron' }),
    ]),
  }),
]);

/** Tous les boutons, à plat (ordre d'affichage). */
export const HUB_LOCATIONS = Object.freeze(HUB_NAV_GROUPS.flatMap((group) => group.items));
