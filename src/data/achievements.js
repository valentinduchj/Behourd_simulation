import { currentLocale } from '../i18n/i18n.js';
// Succès (v0.73) — catalogue. Un succès s'obtient une seule fois par partie ; il est enregistré
// avec la partie (session.achievements) et annoncé à l'écran (et au carnet de bord quand il tombe
// pendant une journée). Logique : systems/achievements/AchievementService.js ; fenêtre :
// ui/components/AchievementsModal.js (encart « Sauvegarde / Menu principal »).
//
//   { id, number, name, description, category, difficulty, icon,
//     kind: 'state' (condition lue dans la partie : accordé aussi au chargement d'une ancienne
//           sauvegarde) | 'event' (constaté au moment où il arrive) | 'counter' (compteur
//           enregistré, parti de 0 pour une ancienne sauvegarde),
//     goal? (seuil d'un compteur ou d'un état, affiché en progression),
//     teaser? (succès difficiles : phrase d'ambiance montrée à la place de la condition, tant que
//              le succès n'est pas obtenu — v0.73.2) }
//   Le numéro et la difficulté sont des données internes : jamais affichés au joueur (v0.73.2).

export const ACHIEVEMENT_CATEGORIES = Object.freeze({
  combat: Object.freeze({ id: 'combat', label: 'Combat', icon: '⚔' }),
  competition: Object.freeze({ id: 'competition', label: 'Compétition', icon: '🏆' }),
  economy: Object.freeze({ id: 'economy', label: 'Économie', icon: '💰' }),
  upgrades: Object.freeze({ id: 'upgrades', label: 'Améliorations', icon: '🔨' }),
  fighters: Object.freeze({ id: 'fighters', label: 'Combattants', icon: '🛡' }),
  world: Object.freeze({ id: 'world', label: 'Monde', icon: '🌍' }),
  centre: Object.freeze({ id: 'centre', label: 'Centre', icon: '⛺' }),
});

export const ACHIEVEMENT_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({ id: 'easy', label: 'Facile', order: 0, color: '#4f8a3c' }),
  medium: Object.freeze({ id: 'medium', label: 'Moyen', order: 1, color: '#c08a2a' }),
  hard: Object.freeze({ id: 'hard', label: 'Difficile', order: 2, color: '#a8322d' }),
});

// Seuils (réglages) : lus par le service et par les descriptions.
export const ACHIEVEMENT_RULES = Object.freeze({
  richDeniers: 10000,
  royalDeniers: 50000,
  builderUpgrades: 5,
  bakerPurchases: 5,
  veteranMatches: 50,
  reaperTakedowns: 50,
  commonTalents: 5,
  trophies: 3,
  activitySuccesses: 100,
  tiredFatigue: 80,
  queenStars: 5,
  legendStars: 5,
  yearDay: 101,
  expeditionPlaces: 5,
  exoticTalents: 3,
});

const R = ACHIEVEMENT_RULES;
const n = (value) => value.toLocaleString(currentLocale());

const achievement = (number, id, category, difficulty, kind, icon, name, description, extra = {}) => Object.freeze({
  number, id, category, difficulty, kind, icon, name, description, ...extra,
});

export const ACHIEVEMENTS = Object.freeze([
  achievement(1, 'premier-sang', 'combat', 'easy', 'event', '🩸', 'Premier sang', 'Gagner sa première manche.'),
  achievement(2, 'hache-s-abattra', 'combat', 'medium', 'event', '🪓', 'Et la hache s’abattra', 'Gagner une manche alors que le seul combattant encore debout est un Hastier.'),
  achievement(3, 'sans-egratignure', 'combat', 'easy', 'event', '🛡', 'Sans une égratignure', 'Gagner une manche sans qu’aucun de ses combattants soit mis KO.'),
  achievement(4, 'remontada', 'combat', 'medium', 'event', '🔄', 'Remontada', 'Gagner un combat après avoir perdu la première manche.'),
  achievement(5, 'contre-la-barriere', 'combat', 'medium', 'event', '🤼', 'Contre la barrière', 'Un Lutteur met KO un adversaire plaqué contre la barrière.'),
  achievement(6, 'par-derriere', 'combat', 'easy', 'event', '🏃', 'Par-derrière', 'Un Runner met KO un adversaire en le chargeant dans le dos.'),
  achievement(7, 'mon-capitaine', 'combat', 'easy', 'event', '👑', 'Mon capitaine !', 'Gagner une manche où son capitaine met lui-même un adversaire KO.'),
  achievement(8, 'hiver-de-fer', 'combat', 'easy', 'event', '❄', 'Hiver de fer', 'Gagner un combat de Ligue en hiver.'),
  achievement(9, 'plaisir-de-la-reine', 'competition', 'medium', 'event', '♛', 'Au plaisir de la Reine', 'Gagner un combat de la Reine.'),
  achievement(10, 'montee-en-grade', 'competition', 'medium', 'event', '⬆', 'Montée en grade', 'Être promu dans la Ligue supérieure.'),
  achievement(11, 'champion', 'competition', 'hard', 'event', '🥇', 'Champion !', 'Terminer 1er de sa Ligue.', { teaser: 'Que tout le domaine lève sa chope à votre gloire.' }),
  achievement(12, 'invaincu', 'competition', 'hard', 'event', '🗿', 'Invaincu', 'Finir une saison de Ligue sans aucune défaite.', { teaser: 'Aucune lame ne parvient à vous faire plier.' }),
  achievement(13, 'hors-des-poules', 'competition', 'medium', 'event', '🐓', 'Hors des poules', 'Se qualifier pour la phase finale de la Coupe de France.'),
  achievement(14, 'vainqueur-coupe', 'competition', 'hard', 'event', '🏆', 'Vainqueur de la Coupe', 'Remporter la Coupe de France.', { teaser: 'Le Château de Gabarnac attend son maître.' }),
  achievement(15, 'richesse-enfin', 'economy', 'medium', 'state', '💰', 'La Richesse, enfin !', `Posséder ${n(R.richDeniers)} deniers.`, { goal: R.richDeniers }),
  achievement(16, 'tresor-royal', 'economy', 'hard', 'state', '👑', 'Trésor royal', `Posséder ${n(R.royalDeniers)} deniers.`, { goal: R.royalDeniers, teaser: 'Les coffres du roi en feraient pâle figure.' }),
  achievement(17, 'premier-chantier', 'upgrades', 'easy', 'state', '🔨', 'Premier chantier', 'Acheter une première amélioration au Bourg.', { goal: 1 }),
  achievement(18, 'grand-batisseur', 'upgrades', 'medium', 'state', '🏗', 'Grand bâtisseur', `Acheter ${R.builderUpgrades} améliorations au Bourg.`, { goal: R.builderUpgrades }),
  achievement(19, 'deux-bureaux', 'upgrades', 'medium', 'state', '📚', 'Deux bureaux valent mieux qu’un', 'Acheter le second Bureau d’étude auprès de Flavia.'),
  achievement(20, 'pain-dans-la-tronche', 'economy', 'easy', 'counter', '🥖', 'Un pain dans la tronche', `Acheter ${R.bakerPurchases} produits au Boulanger.`, { goal: R.bakerPurchases }),
  achievement(21, 'sang-neuf', 'fighters', 'easy', 'event', '🍺', 'Sang neuf', 'Recruter un combattant à la Taverne.'),
  achievement(22, 'revelation', 'fighters', 'easy', 'state', '📜', 'Révélation', 'Révéler un premier talent au Scriptorium.'),
  achievement(23, 'doublement-doue', 'fighters', 'medium', 'state', '✨', 'Doublement doué', 'Avoir un combattant avec deux talents.'),
  achievement(24, 'touche-par-les-dieux', 'fighters', 'hard', 'state', '⚡', 'Touché par les dieux', 'Révéler un talent épique.', { teaser: 'Les astres se penchent sur l’un des vôtres.' }),
  achievement(25, 'graine-parmi-l-elite', 'fighters', 'hard', 'state', '🌱', 'La graine parmi l’élite', 'Un de ses combattants obtient le statut Élite.', { teaser: 'Les plus grands du royaume posent les yeux sur vous.' }),
  achievement(26, 'legende-vivante', 'fighters', 'hard', 'state', '⭐', 'Une légende vivante', 'Avoir un combattant à 5 étoiles.', { teaser: 'On chantera son nom dans toutes les tavernes.' }),
  achievement(27, 'veteran', 'fighters', 'medium', 'state', '🎖', 'Vétéran', `Un combattant dispute ${R.veteranMatches} combats.`, { goal: R.veteranMatches }),
  achievement(28, 'faucheur', 'fighters', 'hard', 'state', '💀', 'Faucheur', `Un combattant atteint ${R.reaperTakedowns} mises KO en carrière.`, { goal: R.reaperTakedowns, teaser: 'La lice se souviendra longtemps de ses coups.' }),
  achievement(29, 'cycle-des-saisons', 'world', 'medium', 'state', '🔁', 'Le cycle des saisons', 'Vivre une année complète (atteindre le jour 101).'),
  achievement(30, 'petits-talents', 'fighters', 'medium', 'counter', '🌾', 'Les petits talents font les grands guerriers', `Découvrir ${R.commonTalents} talents ordinaires différents.`, { goal: R.commonTalents }),
  achievement(31, 'feu-sacre', 'fighters', 'medium', 'state', '🔥', 'Le feu sacré', 'Avoir un combattant au potentiel maximal (3 flammes).'),
  achievement(32, 'armoire-pleine', 'competition', 'hard', 'state', '🗄', 'Armoire pleine', `Posséder ${R.trophies} trophées dans l’armoire de la Taverne.`, { goal: R.trophies, teaser: 'Le bois de l’armoire ploie sous l’or.' }),
  achievement(33, 'increvable', 'combat', 'medium', 'event', '😤', 'Increvable', `Gagner une manche avec un combattant entré dans la lice à ${R.tiredFatigue} de fatigue ou plus.`),
  achievement(34, 'main-d-oeuvre', 'centre', 'medium', 'counter', '⚒', 'Main-d’œuvre', `Cumuler ${R.activitySuccesses} activités réussies au Centre.`, { goal: R.activitySuccesses }),
  achievement(35, 'sans-partage', 'combat', 'easy', 'event', '🗡', 'Sans partage', 'Gagner un combat sans perdre une seule manche.'),
  achievement(36, 'trois-armes', 'combat', 'easy', 'event', '🔱', 'Les trois armes', 'Gagner une manche avec un Hastier, un Lutteur et un Runner encore debout.'),
  achievement(37, 'oeil-sur-le-monde', 'competition', 'hard', 'event', '👁', 'Un œil sur le Monde', `Remporter un combat de la Reine contre une équipe à ${R.queenStars} étoiles.`, { teaser: 'La Reine elle-même en retient son souffle.' }),
  achievement(38, 'toit-de-la-france', 'competition', 'hard', 'event', '🏰', 'Sur le toit de la France', 'Remporter la Ligue 1.', { teaser: 'Plus haut, il n’y a que le ciel.' }),
  achievement(39, 'chasseur-de-tetes', 'fighters', 'medium', 'event', '🎯', 'Chasseur de têtes', 'Recruter à la Taverne une recrue qui a déjà un talent.'),
  achievement(40, 'quatre-saisons', 'world', 'medium', 'counter', '🍂', 'Quatre saisons, quatre victoires', 'Gagner au moins un combat dans chacune des quatre saisons.', { goal: 4 }),
  // Expéditions du Baron (v1.0).
  achievement(41, 'premiere-route', 'world', 'easy', 'event', '🧭', 'Première route', 'Voir un combattant revenir de sa première expédition.'),
  achievement(42, 'pelerins-d-europe', 'world', 'medium', 'counter', '🗺', 'Pèlerins d’Europe', `Envoyer des combattants en expédition dans ${R.expeditionPlaces} lieux différents.`, { goal: R.expeditionPlaces }),
  achievement(43, 'merveilles-d-ailleurs', 'world', 'hard', 'state', '🟢', 'Merveilles d’ailleurs', `Avoir en même temps ${R.exoticTalents} talents exotiques différents dans la compagnie.`, { goal: R.exoticTalents, teaser: 'Ce que l’on rapporte des confins ne ressemble à rien de connu.' }),
  // Expéditions singulières (v1.1.3) : obtenus à la victoire (SingularRunService.claimVictory).
  achievement(44, 'sentier-des-pins', 'world', 'easy', 'event', '🌲', 'Le Sentier des pins', 'Gagner une première expédition singulière.'),
  achievement(45, 'trois-debout', 'world', 'medium', 'event', '🛡', 'Trois debout', 'Gagner une expédition singulière sans qu’aucun des trois combattants ne soit mis KO.'),
  achievement(46, 'loup-solitaire', 'world', 'hard', 'event', '🐺', 'Loup solitaire', 'Gagner les dix combats d’une expédition singulière avec un seul et même combattant.', { teaser: 'Dix duels, et toujours le même à se relever.' }),
  achievement(47, 'seigneur-des-cimes', 'world', 'hard', 'event', '👑', 'Seigneur des cimes', 'Gagner une expédition singulière de la tranche la plus chère (11 à 18 Ferveurs).', { teaser: 'Là-haut, les adversaires ont cinq étoiles.' }),
]);

const BY_ID = new Map(ACHIEVEMENTS.map((entry) => [entry.id, entry]));

export function getAchievement(id) {
  return BY_ID.get(id) ?? null;
}
