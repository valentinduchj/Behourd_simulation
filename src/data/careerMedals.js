// Médailles de carrière des combattants du joueur (systems/fighters/CareerStatsService.js).
// La source de vérité est le nombre de mises à terre (fighter.record.takedowns) : les médailles
// s'en déduisent, elles ne sont jamais enregistrées. Elles sont CUMULATIVES : chaque seuil
// atteint ajoute une médaille, aucune ne remplace la précédente.
// Ordre d'affichage : celui de cette liste. Ajouter une récompense = ajouter une entrée.

export const CAREER_MEDALS = Object.freeze([
  Object.freeze({ id: 'BRONZE', name: 'Bronze', icon: '🥉', threshold: 5, color: '#a8642a' }),
  Object.freeze({ id: 'SILVER', name: 'Argent', icon: '🥈', threshold: 25, color: '#9aa3ad' }),
  Object.freeze({ id: 'GOLD', name: 'Or', icon: '🥇', threshold: 50, color: '#d4a017' }),
  Object.freeze({ id: 'PLATINUM', name: 'Platine', icon: '🏅', threshold: 100, color: '#6f8fa8' }),
  Object.freeze({ id: 'DIAMOND', name: 'Diamant', icon: '💎', threshold: 300, color: '#3fa7c9' }),
]);
