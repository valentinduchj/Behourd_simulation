// Schéma des options. L'écran Options est généré à partir de ce fichier :
// ajouter un réglage = ajouter une entrée. Types gérés : range, toggle, select.
// `planned: true` signale un réglage enregistré mais pas encore branché.

export const SETTINGS_SCHEMA = Object.freeze([
  {
    id: 'audio',
    label: 'Audio',
    settings: [
      { key: 'audio.master', label: 'Volume général', type: 'range', min: 0, max: 100, step: 5, default: 80, unit: '%' },
      {
        key: 'audio.music', label: 'Musique', type: 'range', min: 0, max: 100, step: 5, default: 70, unit: '%',
        description: 'Tableau de la Taverne (Centre, Bourg, Taverne, lice d’entraînement), Wistful Dawn (Scriptorium), Warlike Pulse (dès qu’une manche se lance).',
      },
      {
        key: 'audio.ambience', label: 'Ambiances', type: 'range', min: 0, max: 100, step: 5, default: 60, unit: '%',
        description: 'Une ambiance par lieu : feu de camp et forêt, marché, Taverne, Scriptorium, foule de la lice. Elles restent toujours sous la musique.',
      },
      {
        key: 'audio.sfx', label: 'Effets sonores', type: 'range', min: 0, max: 100, step: 5, default: 80, unit: '%',
        description: 'Coups, KO, fanfare de victoire, annonce d’un exploit.',
      },
      {
        key: 'audio.crossfade', label: 'Fondu entre les musiques', type: 'select', default: 3,
        options: [
          { value: 1.5, label: 'Court (1,5 s)' },
          { value: 3, label: 'Normal (3 s)' },
          { value: 5, label: 'Long (5 s)' },
        ],
      },
      { key: 'audio.muted', label: 'Couper le son', type: 'toggle', default: false },
    ],
  },
  {
    id: 'display',
    label: 'Affichage',
    settings: [
      {
        key: 'display.uiScale', label: 'Taille de l’interface', type: 'select', default: 1,
        options: [
          { value: 0.9, label: 'Petite' },
          { value: 1, label: 'Normale' },
          { value: 1.1, label: 'Grande' },
          { value: 1.25, label: 'Très grande' },
        ],
      },
      {
        key: 'display.vfx', label: 'Effets visuels des combats', type: 'select', default: 'full',
        description: 'Étincelles des coups, sable des pas et des chutes. « Réduits » s’applique aussi si votre système demande moins d’animations.',
        options: [
          { value: 'full', label: 'Complets' },
          { value: 'reduced', label: 'Réduits' },
          { value: 'off', label: 'Désactivés' },
        ],
      },
      {
        key: 'display.menuShowcase', label: 'Animations de l’écran principal', type: 'toggle', default: true,
        description: 'Scènes du jeu en arrière-plan du menu principal (camp, Taverne, combats, Bourg).',
      },
      {
        key: 'display.resolution', label: 'Résolution', type: 'select', default: 'auto', planned: true,
        description: 'Utile une fois le jeu empaqueté en application de bureau.',
        options: [
          { value: 'auto', label: 'Automatique' },
          { value: '1280x720', label: '1280 × 720' },
          { value: '1600x900', label: '1600 × 900' },
          { value: '1920x1080', label: '1920 × 1080' },
        ],
      },
    ],
  },
  {
    id: 'gameplay',
    label: 'Jeu',
    settings: [
      {
        key: 'gameplay.speed', label: 'Vitesse des combats', type: 'select', default: 1,
        options: [
          { value: 0.5, label: '× 0,5' },
          { value: 1, label: '× 1' },
          { value: 2, label: '× 2' },
          { value: 4, label: '× 4' },
        ],
      },
      {
        key: 'gameplay.autosave', label: 'Sauvegarde automatique', type: 'toggle', default: true,
        description: 'Sauvegarde la partie à chaque nouvelle journée.',
      },
      { key: 'gameplay.confirmQuit', label: 'Confirmer avant de quitter le jeu', type: 'toggle', default: true },
      {
        key: 'gameplay.banquetThreshold', label: 'Seuil du bouton [+] du Banquet', type: 'range', min: 0, max: 100, step: 1, default: 0, unit: ' de fatigue',
        description: 'Le bouton [+] du Banquet (Centre) y envoie tous les combattants dont la fatigue dépasse ce seuil.',
      },
    ],
  },
]);

export function getSettingDefinitions() {
  return SETTINGS_SCHEMA.flatMap((section) => section.settings);
}
