// Banques de noms pour la génération procédurale.

export const FIRST_NAMES = Object.freeze([
  'Guillaume', 'Bertrand', 'Mathieu', 'Geoffroy', 'Arnaud', 'Renaud', 'Thibault', 'Enguerrand',
  'Raoul', 'Gauthier', 'Hugues', 'Baudouin', 'Aymeric', 'Foulques', 'Godefroy', 'Tancrède',
  'Robert', 'Richard', 'Roger', 'Eudes', 'Gilles', 'Jehan', 'Amaury', 'Anseau',
  'Évrard', 'Gaucher', 'Gervais', 'Hervé', 'Josselin', 'Lambert', 'Mahieu', 'Odon',
  'Onfroy', 'Pierre', 'Rainier', 'Raymond', 'Simon', 'Tristan', 'Yves', 'Aubry',
  'Bérenger', 'Garin', 'Hamon', 'Osmond', 'Herluin', 'Galeran', 'Thierry', 'Clément',
]);

export const PLACES = Object.freeze([
  'Rouen', 'Caen', 'Bayeux', 'Falaise', 'Évreux', 'Lisieux', 'Coutances', 'Avranches',
  'Dieppe', 'Fécamp', 'Chartres', 'Troyes', 'Provins', 'Beauvais', 'Amiens', 'Arras',
  'Senlis', 'Meaux', 'Dreux', 'Coucy', 'Montfort', 'Mortagne', 'Vernon', 'Gisors',
  'Argentan', 'Alençon', 'Orbec', 'Étampes', 'Laon', 'Eu',
]);

export const EPITHETS = Object.freeze([
  'le Rouge', 'le Hardi', 'le Roux', 'le Bref', 'le Grand', 'le Jeune', 'le Vieux', 'le Borgne',
  'le Taciturne', 'le Pieux', 'le Fort', 'le Balafré', 'Cœur-de-Fer', 'Brise-Lance',
  'Main-Lourde', 'Tête-d’Ours', 'Sans-Peur', 'Pied-Ferme', 'Bras-de-Fer',
]);

// Probabilités de forme du nom : "Prénom de Lieu", "Prénom l'Épithète", ou "Prénom" seul.
export const NAME_FORM_WEIGHTS = Object.freeze({
  origin: 0.45,
  epithet: 0.3,
});

export const TEAM_NOUNS = Object.freeze([
  'Les Loups', 'Les Sangliers', 'Les Ours', 'Les Faucons', 'Les Lames', 'Les Brise-Écus',
  'Les Lions', 'Les Corbeaux', 'La Compagnie Franche', 'La Mesnie', 'Les Gonfanons', 'Les Masses',
]);
