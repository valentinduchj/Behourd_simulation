// Version du format de sauvegarde. À incrémenter à chaque changement incompatible,
// en ajoutant la migration correspondante dans migrations.js.
//   1 : MVP (v0.1)
//   2 : nom unique et modifiable, stats PV/Force/Vitesse, activités, calendrier, Taverne (v0.2)
//   3 : spécialité « runner », stats 0–100, ligues et clubs de l'IA générés, Pôle Combat (v0.3)
//   4 : clubs de l'IA externalisés (data/clubs/*.json), sprites des combattants (v0.4)
//   5 : journées de championnat (calendrier des rencontres), classement en manches,
//       Centre agrandi (nouvelles coordonnées) (v0.5)
//   6 : rotation hebdomadaire de la Taverne, suppression des tournois, palmarès des
//       combattants (combats / manches) (v0.6)
//   7 : trois divisions (league_1/2/3), saisons, calendrier des rencontres stocké,
//       montées et descentes, historique des saisons (v0.7)
export const SAVE_FORMAT_VERSION = 8;

export class SaveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SaveError';
  }
}
