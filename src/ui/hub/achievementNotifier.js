import { onAchievementUnlocked, markAchievementAnnounced, takePendingAchievements } from '../../systems/achievements/AchievementService.js';
import { showAchievementToast } from '../components/AchievementToast.js';

// Annonces des succès (v0.73) : dès qu'un succès est obtenu dans la partie en cours, il
// s'annonce à l'écran. Ceux obtenus hors de la partie affichée (chargement d'une ancienne
// sauvegarde) attendent le premier écran du domaine (announcePendingAchievements).
// Pendant un combat (v0.73.1), les annonces sont retenues : les succès d'une manche ne se
// dévoilent qu'à la fin du combat (holdAchievementAnnouncements / releaseAchievementAnnouncements).

let installed = false;
let held = 0;

/** À appeler une fois, au démarrage. `gameState` : partie en cours (state/gameState.js). */
export function installAchievementNotifier(gameState) {
  if (installed) return;
  installed = true;
  onAchievementUnlocked((session, achievement) => {
    if (session !== gameState.session || held > 0) return; // retenu : reste en attente
    markAchievementAnnounced(session, achievement.id);
    showAchievementToast(achievement);
  });
}

/** Retient les annonces (début d'un combat). */
export function holdAchievementAnnouncements() {
  held += 1;
}

/** Fin du combat : les annonces reprennent, et les succès retenus s'affichent. */
export function releaseAchievementAnnouncements(session) {
  if (held > 0) held -= 1;
  if (held === 0 && session) announcePendingAchievements(session);
}

/** Les annonces sont-elles retenues ? */
export function areAchievementAnnouncementsHeld() {
  return held > 0;
}

/** Annonce les succès obtenus pas encore montrés (une seule fois). */
export function announcePendingAchievements(session) {
  for (const achievement of takePendingAchievements(session)) showAchievementToast(achievement);
}