// Calendrier du jeu : types d'événements et planification.

// Types d'événements. Ajouter un type ici le rend affichable ; son effet le jour J se
// définit dans systems/calendar/eventHandlers.js (sinon un effet par défaut s'applique).
// Présentation : `color`, `icon` et `dayClass` (style de la case du jour dans la frise).
// Règles :
//   combatDay  un combat a lieu ce jour-là : le Centre est fermé
//   movable    la date peut être décalée au jour libre suivant si un combat non déplaçable
//              tombe le même jour (deux combats ne partagent jamais une journée)
//   order      ordre d'affichage des événements d'un même jour
// Pour réintroduire les tournois plus tard : ajouter un type 'tournament' ici, une règle
// récurrente ci-dessous et son effet dans eventHandlers.js.
export const EVENT_TYPES = Object.freeze({
  // CHAMPIONSHIP_MATCH : journée de championnat (identifiant historique 'combat', conservé pour les sauvegardes).
  combat: { id: 'combat', label: 'Combat de championnat', icon: '⚔', color: '#a8322d', dayClass: 'is-combat', combatDay: true, order: 1 },
  // QUEEN_COMBAT : Combat de la Reine (hors championnat).
  queen: { id: 'queen', label: 'Combat de la Reine', icon: '♛', color: '#d9822b', dayClass: 'is-queen', combatDay: true, movable: true, order: 2 },
  tavern: { id: 'tavern', label: 'Taverne', icon: '🍺', color: '#a87f1e', dayClass: 'is-tavern', order: 3 },
  special: { id: 'special', label: 'Événement', icon: '★', color: '#2d5a9a', dayClass: 'is-special', order: 4 },
});

export const CHAMPIONSHIP_MATCH = EVENT_TYPES.combat.id;
export const QUEEN_COMBAT = EVENT_TYPES.queen.id;

export function getEventType(id) {
  return EVENT_TYPES[id] ?? EVENT_TYPES.special;
}

export const CALENDAR_CONFIG = Object.freeze({
  startDay: 1,
  // Les événements sont planifiés jusqu'à ce nombre de jours dans le futur.
  horizonDays: 28,
  // Nombre de jours affichés dans la frise du calendrier.
  stripDays: 14,
  // Nombre d'actualités affichées sous le calendrier (tous les événements restent planifiés).
  upcomingCount: 2,
  // Événements récurrents : le premier a lieu le jour `firstDay`, puis tous les `interval` jours.
  // (Les journées de championnat sont planifiées par saison : voir SEASON_CONFIG dans data/leagues.js.)
  recurringEvents: [
    // Rotation hebdomadaire de la Taverne : jours 7, 14, 21, 28…
    { typeId: 'tavern', firstDay: 7, interval: 7 },
  ],
  // Nombre d'événements passés conservés dans la sauvegarde.
  historySize: 20,
});
