// Tutoriel de début de partie (v0.81) : le tavernier guide le joueur, juste après la création
// de sa compagnie et de son capitaine. Moteur : ui/tutorial/Tutorial.js.
//
// Trois chapitres (affichés « (1/3) », « (2/3) », « (3/3) »), chacun fait de bulles :
//   chapter   chapitre de la bulle (id de TUTORIAL_CHAPTERS)
//   screen    écran où la bulle s'affiche (le tutoriel s'y rend si besoin) ; absent : écran courant
//   target    zone mise en lumière : sélecteur CSS (le premier élément visible), ou
//             { selectorAll } (toutes les zones), ou { activity } (un lieu du Centre, sur la carte) ;
//             absent : bulle au centre, tout le jeu flouté
//   advance   'next'  bouton « Suivant » ; la zone est montrée, pas cliquable
//             'click' le joueur doit cliquer la zone (seule zone cliquable) pour continuer
//             'select' (target activity) le joueur doit sélectionner ce lieu sur la carte
//   text      paragraphes ; {nom} est remplacé par une valeur du jeu (voir Tutorial.js)
//   list      contenu tiré des données : 'specialties' (rôles) ou 'activities' (lieux du Centre)
//   action    consigne mise en avant (étapes à cliquer) ; mobileAction : sa version téléphone
//   mobileText / mobileAfter  (v1.1.8) version téléphone de text / after (« touchez », boutons du dock)
//   sheet     interface mobile : la zone est dans le volet du lieu, ouvert pour cette bulle
//             (sinon le volet est refermé) ; les cibles listent aussi leur équivalent mobile.
//   watch     après le clic : { target, ms } — la bulle s'efface et l'on regarde la zone `target`
//             pendant `ms` millisecondes (ex. les combattants qui rejoignent la Petite lice)
// La dernière bulle porte le bouton « Terminer » ; « Passer le tutoriel » est toujours là.
// Fin du tutoriel (Terminer ou Passer) : retour sur cet écran.
export const TUTORIAL_END_SCREEN = 'centre';

export const TUTORIAL_CHAPTERS = Object.freeze([
  Object.freeze({ id: 'centre', title: 'Vos combattants et le Centre' }),
  Object.freeze({ id: 'tavern', title: 'La Taverne et les recrues' }),
  Object.freeze({ id: 'days', title: 'Le fil des jours' }),
]);

export const TUTORIAL_STEPS = Object.freeze([
  // ---------- (1/3) Vos combattants et le Centre ----------
  {
    id: 'welcome', chapter: 'centre', screen: 'borough', advance: 'next',
    text: [
      'Bienvenue au Bourg, capitaine ! Je tiens la Taverne du domaine. Laissez-moi vous montrer comment mener votre compagnie.',
      'Ici, au Bourg, les artisans vendent des améliorations pour votre Centre et des consommables. Vous y reviendrez quand vous aurez des deniers.',
    ],
  },
  {
    id: 'domain', chapter: 'centre', target: '.hub-nav-domain', advance: 'next',
    text: [
      'À droite, l’encart « Le domaine » : chaque lieu s’ouvre d’un clic. Sur les cartes, les chemins et les portes y mènent aussi.',
    ],
    mobileText: [
      'À gauche, les lieux du domaine : chacun s’ouvre d’une touche. Sur les cartes, les chemins et les portes y mènent aussi.',
    ],
  },
  {
    id: 'company-button', chapter: 'centre', target: '[data-hub-item="team"]', advance: 'click',
    text: ['Faisons d’abord connaissance avec vos combattants.'],
    action: 'Cliquez sur « La Compagnie ».',
    mobileAction: 'Touchez « Compagnie », en bas.',
  },
  {
    id: 'roles', chapter: 'centre', screen: 'team', target: { selectorAll: '.roster-group, .m-team-list' }, advance: 'next',
    text: ['Chaque combattant a une spécialité, qui fixe son rôle dans la lice :'],
    list: 'specialties',
    after: ['Un combat se joue à cinq contre cinq : un bon mélange des trois rôles fait la différence.'],
  },
  {
    id: 'fighter-card', chapter: 'centre', screen: 'team', target: '.fighter-card, .m-team-sheet', advance: 'next',
    text: [
      'Les étoiles donnent le niveau d’un combattant. Un clic sur sa carte ouvre sa fiche : compétences, fatigue, talents.',
    ],
    mobileText: [
      'Les étoiles donnent le niveau d’un combattant. Touchez-le dans la liste pour voir sa fiche : compétences, fatigue, talents.',
    ],
  },
  {
    id: 'centre-button', chapter: 'centre', target: '[data-hub-item="centre"], .m-dock [data-hub-item="domain"]', advance: 'click',
    text: ['Allons au Centre, là où vos combattants s’entraînent.'],
    action: 'Cliquez sur « Le Centre ».',
    mobileAction: 'Touchez « Domaine », en bas : il mène au Centre.',
  },
  {
    id: 'centre', chapter: 'centre', screen: 'centre', target: '.centre-stage', advance: 'next',
    text: [
      'Voici le Centre. Chaque journée, vos combattants s’activent dans le lieu où vous les avez envoyés, et peuvent y progresser. Les lieux sont regroupés en pôles d’entraînement :',
    ],
    list: 'activities',
    after: ['Le Banquet, lui, sert à récupérer de la fatigue.'],
  },
  {
    id: 'lice', chapter: 'centre', screen: 'centre', target: { activity: 'lice' }, advance: 'select',
    text: ['Essayons. La Petite lice, le ring de cordes du Pôle Combat, fait progresser la lutte.'],
    action: 'Cliquez sur la Petite lice.',
    mobileAction: 'Touchez la Petite lice.',
  },
  {
    id: 'lice-plus', chapter: 'centre', screen: 'centre', target: '.quick-assign[data-activity="lice"] .quick-assign-plus', advance: 'click',
    select: 'lice',
    watch: { target: '.centre-stage', ms: 2000 },
    text: [
      'Le bouton « + » y envoie d’un coup des combattants, dans les places libres. La roue ⚙ à côté règle lesquels il choisit.',
    ],
    action: 'Cliquez sur « + ».',
    mobileAction: 'Touchez « + ».',
  },
  {
    id: 'assign-table', chapter: 'centre', screen: 'centre', target: '.assign-table', advance: 'next', sheet: true,
    text: [
      'Vous pouvez aussi affecter vos combattants un par un : choisissez-en un dans ce tableau, puis un lieu. Chaque lieu a un nombre de places limité.',
    ],
  },
  {
    id: 'fatigue', chapter: 'centre', screen: 'centre', target: '.fatigue-legend', advance: 'next', sheet: true,
    text: [
      'Surveillez la fatigue : chaque combat en laisse. Fatigué (orange), un combattant réussit moins bien ses activités ; épuisé (rouge), il ne peut plus aller qu’au Banquet.',
    ],
  },
  // ---------- (2/3) La Taverne et les recrues ----------
  {
    id: 'tavern-button', chapter: 'tavern', target: '[data-hub-item="tavern"]', advance: 'click',
    text: ['Tôt ou tard, il vous faudra du renfort. Passez donc à ma Taverne !'],
    action: 'Cliquez sur « La Taverne ».',
    mobileAction: 'Touchez « La Taverne », à gauche.',
  },
  {
    id: 'recruits', chapter: 'tavern', screen: 'tavern', target: '.tavern-recruits', advance: 'next', sheet: true,
    text: [
      'Voici les recrues présentes. Leurs étoiles disent leur niveau, et leur prix est en deniers. Un clic sur l’une ouvre sa fiche, d’où vous pouvez l’engager.',
    ],
    mobileText: [
      'Voici les recrues présentes. Leurs étoiles disent leur niveau, et leur prix est en deniers. Touchez-en une pour ouvrir sa fiche, d’où vous pouvez l’engager.',
    ],
  },
  {
    id: 'keeper', chapter: 'tavern', screen: 'tavern', target: '.tavern-keeper-card', advance: 'next', sheet: true,
    text: [
      'Les recrues changent chaque semaine. Parlez-moi pour améliorer la Taverne : vous attirerez de meilleurs combattants à la rotation suivante.',
    ],
  },
  {
    id: 'purse', chapter: 'tavern', screen: 'tavern', target: '.tavern-purse', advance: 'next', sheet: true,
    text: [
      'Votre compagnie compte au plus {maxFighters} combattants. Vos deniers servent à recruter ici et à payer les artisans du Bourg.',
    ],
  },
  // ---------- (3/3) Le fil des jours ----------
  {
    id: 'today', chapter: 'days', target: '.calendar-today, .mobile-day', advance: 'next',
    text: [
      'Le jeu avance jour par jour. L’année traverse quatre saisons, qui changent le domaine, les activités et les combats.',
    ],
  },
  {
    id: 'strip', chapter: 'days', target: '.calendar-main, .mobile-event', advance: 'next',
    text: [
      'La frise montre les jours à venir et leurs événements : journées de championnat ⚔, Combat de la Reine ♛, rotation de la Taverne…',
    ],
  },
  {
    id: 'advance', chapter: 'days', target: '.calendar-bar .btn-advance, .calendar-bar .btn-fight, .mobile-advance', advance: 'next',
    text: [
      'Quand vos affectations sont prêtes, « Passer la journée » : les activités se déroulent, puis le carnet de bord raconte la journée.',
      'Un jour de combat, ce bouton devient « ⚔ COMBATTRE » : le Centre ferme et vous rejoignez la lice.',
    ],
    mobileText: [
      'Quand vos affectations sont prêtes, touchez « Jour suivant » : les activités se déroulent, puis le carnet de bord raconte la journée.',
      'Un jour de combat, ce bouton devient « Combattre » : le Centre ferme et vous rejoignez la lice.',
    ],
  },
  {
    id: 'league', chapter: 'days', target: '.hub-league, .m-dock [data-hub-item="league"]', advance: 'next',
    text: [
      'En championnat, une victoire rapporte {winPoints} points, une défaite avec une manche gagnée {lossWithRoundPoints} point. En fin de saison, les premiers montent de division et les derniers descendent.',
    ],
  },
  {
    id: 'almanac', chapter: 'days', target: '.hub-almanac, .mobile-menu-button', advance: 'next',
    text: [
      'C’est tout pour moi ! L’Almanach répond à toutes vos questions sur les règles. Bonne saison, capitaine !',
    ],
  },
]);
