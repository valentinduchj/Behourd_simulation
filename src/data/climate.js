// Les quatre saisons de l'année (v0.70) — à ne pas confondre avec la saison de CHAMPIONNAT
// (data/leagues.js, SeasonService) : une année dure 100 jours, découpée en 4 saisons de 25
// jours, et tourne en continu, indépendamment des championnats.
//
// La saison se DÉDUIT toujours du jour courant (systems/climate/ClimateService.js) : aucun
// compteur à part, rien ne peut se désynchroniser. Une nouvelle partie commence au jour 1, donc
// au premier jour de l'été.
//
// Règles (lues par les systèmes, jamais par les interfaces) :
//   closedActivities  lieux du Centre fermés pendant la saison (affectations libérées à son début)
//   classEfficiency   efficacité au combat d'une classe (fraction en moins : 0.1 = −10 %), appliquée
//                     comme un multiplicateur temporaire (jamais inscrit dans les statistiques)
//   fireOut           feux de camp éteints (présentation)
// Présentation : name, color (pastille), icon (lisible sans la couleur), logbook (carnet de bord).

export const CLIMATE_YEAR = Object.freeze({
  // Jours d'une année ; jours d'une saison.
  length: 100,
  seasonLength: 25,
});

export const CLIMATE_SEASONS = Object.freeze([
  Object.freeze({
    id: 'summer', name: 'Été', article: 'l’été', icon: '☀', color: '#e8b923', text: '#3a2a04',
    closedActivities: Object.freeze(['river']),
    classEfficiency: Object.freeze({ hastier: 0.1 }),
    fireOut: false,
    closedReason: Object.freeze({ river: 'La rivière est asséchée en été.' }),
    effectSummary: 'Rivière asséchée ; Hastiers −10 % d’efficacité (chaleur).',
    logbook: 'L’été commence. La chaleur assèche la rivière et rend les combats des Hastiers plus éprouvants (−10 % d’efficacité).',
  }),
  Object.freeze({
    id: 'autumn', name: 'Automne', article: 'l’automne', icon: '🍂', color: '#e07a2c', text: '#2e1604',
    closedActivities: Object.freeze([]),
    classEfficiency: Object.freeze({ runner: 0.1 }),
    fireOut: false,
    closedReason: Object.freeze({}),
    effectSummary: 'Terrains humides : Runners −10 % d’efficacité.',
    logbook: 'L’automne commence. Les terrains deviennent humides et les Runners perdent en efficacité (−10 %). La rivière coule de nouveau.',
  }),
  Object.freeze({
    id: 'winter', name: 'Hiver', article: 'l’hiver', icon: '❄', color: '#9fd0ea', text: '#10354d',
    closedActivities: Object.freeze(['forest']),
    classEfficiency: Object.freeze({}),
    fireOut: true,
    closedReason: Object.freeze({ forest: 'La forêt est enneigée et inaccessible en hiver.' }),
    effectSummary: 'Forêt inaccessible ; feux de camp éteints.',
    logbook: 'L’hiver commence. La forêt devient inaccessible et les combattants ne peuvent plus y travailler.',
  }),
  Object.freeze({
    id: 'spring', name: 'Printemps', article: 'le printemps', icon: '🌱', color: '#6fbf4a', text: '#173a0b',
    closedActivities: Object.freeze([]),
    classEfficiency: Object.freeze({}),
    fireOut: false,
    closedReason: Object.freeze({}),
    effectSummary: 'Aucune contrainte : la forêt et la rivière sont ouvertes.',
    logbook: 'Le printemps commence. La nature reprend vie et les installations saisonnières retrouvent leur fonctionnement normal.',
  }),
]);

export const CLIMATE_SEASON_IDS = Object.freeze(CLIMATE_SEASONS.map((season) => season.id));
