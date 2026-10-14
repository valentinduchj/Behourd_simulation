// Les Lieux — Terre → Lieu → Club (systems/geography/).
//
//   id, name, landId (data/geography/lands.js), type, coords [longitude, latitude]
//   type  'start'  lieu de départ proposé au joueur à la création (6 par Terre)
//         'club'   lieu d'un club des ligues (data/geography/clubLocations.js)
//         'far'    lieu hors de la carte de France (Terre lointaine)
//
// Un lieu est historique ou médiéval et cohérent avec sa Terre. La couleur d'un lieu est
// celle de sa Terre (LocationService). Les coordonnées des lieux côtiers sont un peu
// rentrées dans les terres pour rester dans les contours grossiers de la carte. Un lieu pourra porter plus tard la lice d'un club
// (domicile / extérieur : non implémenté).

const loc = (id, name, landId, type, coords = null) => Object.freeze({ id, name, landId, type, coords: coords ? Object.freeze(coords) : null });

export const LOCATIONS = Object.freeze([
  // ---------- Lieux de départ ----------
  loc('les-andelys', 'Les Andelys', 'OUEST', 'start', [1.41, 49.24]),
  loc('chateau-de-caen', 'Château de Caen', 'OUEST', 'start', [-0.36, 49.19]),
  loc('tour-d-oudon', 'Tour d’Oudon', 'OUEST', 'start', [-1.03, 47.35]),
  loc('jardin-aux-moines', 'Le Jardin aux Moines', 'OUEST', 'start', [-2.25, 48.0]),
  loc('cite-de-locronan', 'Cité de Locronan', 'OUEST', 'start', [-4.21, 48.1]),
  // Maillezais réel : [-0.74, 46.37], remonté au nord pour rester dans la Terre de l'Ouest.
  loc('abbaye-de-maillezais', 'Abbaye de Maillezais', 'OUEST', 'start', [-0.85, 46.56]),

  loc('faubourg-de-lille', 'Faubourg de Lille', 'NORD', 'start', [3.06, 50.63]),
  loc('parc-saint-pierre', 'Parc Saint-Pierre', 'NORD', 'start', [2.31, 49.9]),
  loc('chateau-de-pierrefonds', 'Château de Pierrefonds', 'NORD', 'start', [2.98, 49.35]),
  loc('champ-de-crecy', 'Champ de Crécy', 'NORD', 'start', [1.88, 50.25]),
  loc('foire-de-provins', 'Foire de Provins', 'NORD', 'start', [3.29, 48.56]),
  loc('remparts-de-langres', 'Remparts de Langres', 'NORD', 'start', [5.33, 47.9]),

  loc('chateau-de-la-roche', 'Château de la Roche', 'CENTRE', 'start', [4.1, 45.9]),
  loc('sentier-de-morez', 'Sentier de Morez', 'CENTRE', 'start', [6.02, 46.52]),
  loc('donjon-de-bressieux', 'Donjon de Bressieux', 'CENTRE', 'start', [5.3, 45.33]),
  loc('oree-des-monts-d-ardeche', 'Orée des Monts d’Ardèche', 'CENTRE', 'start', [4.4, 44.75]),
  loc('palais-jacques-coeur', 'Palais Jacques-Cœur', 'CENTRE', 'start', [2.4, 47.08]),
  loc('colline-de-vezelay', 'Colline de Vézelay', 'CENTRE', 'start', [3.75, 47.47]),

  loc('cite-de-carcassonne', 'Cité de Carcassonne', 'SUD', 'start', [2.36, 43.21]),
  loc('tour-de-campomoro', 'Tour de Campomoro', 'SUD', 'start', [8.98, 41.7]),
  loc('moulin-de-bargemon', 'Moulin de Bargemon', 'SUD', 'start', [6.55, 43.62]),
  loc('chateau-de-cascastel', 'Château de Cascastel', 'SUD', 'start', [2.78, 42.98]),
  loc('cite-de-saint-emilion', 'Cité de Saint-Émilion', 'SUD', 'start', [-0.16, 44.89]),
  loc('tours-de-la-rochelle', 'Tours de La Rochelle', 'SUD', 'start', [-1.1, 46.16]),

  // ---------- Lieux des clubs : Terre du Nord ----------
  loc('enceinte-philippe-auguste', 'Enceinte de Philippe Auguste', 'NORD', 'club', [2.35, 48.86]),
  loc('chateau-de-vincennes', 'Château de Vincennes', 'NORD', 'club', [2.44, 48.84]),
  loc('bois-de-cergy', 'Bois de Cergy', 'NORD', 'club', [2.06, 49.04]),
  loc('beffroi-de-douai', 'Beffroi de Douai', 'NORD', 'club', [3.08, 50.37]),
  loc('foret-de-compiegne', 'Forêt de Compiègne', 'NORD', 'club', [2.9, 49.37]),
  loc('porte-des-allemands', 'Porte des Allemands', 'NORD', 'club', [6.19, 49.12]),
  loc('porte-serpenoise', 'Porte Serpenoise', 'NORD', 'club', [6.17, 49.11]),
  loc('chateau-de-dourdan', 'Château de Dourdan', 'NORD', 'club', [2.01, 48.53]),
  loc('tour-de-montlhery', 'Tour de Montlhéry', 'NORD', 'club', [2.27, 48.64]),
  loc('parvis-notre-dame', 'Parvis de Notre-Dame', 'NORD', 'club', [2.35, 48.853]),
  loc('porte-de-la-craffe', 'Porte de la Craffe', 'NORD', 'club', [6.18, 48.7]),
  loc('mont-cassel', 'Mont Cassel', 'NORD', 'club', [2.49, 50.8]),
  loc('abbaye-de-saint-denis', 'Abbaye de Saint-Denis', 'NORD', 'club', [2.36, 48.94]),
  loc('haut-koenigsbourg', 'Château du Haut-Koenigsbourg', 'NORD', 'club', [7.34, 48.25]),
  loc('chateau-du-lichtenberg', 'Château du Lichtenberg', 'NORD', 'club', [7.48, 48.92]),
  loc('abbaye-de-saint-amand', 'Abbaye de Saint-Amand', 'NORD', 'club', [3.3, 50.4]),
  loc('tour-du-guet-de-calais', 'Tour du Guet de Calais', 'NORD', 'club', [1.86, 50.9]),

  // ---------- Lieux des clubs : Terre de l'Ouest ----------
  loc('abbaye-de-jumieges', 'Abbaye de Jumièges', 'OUEST', 'club', [0.82, 49.43]),
  loc('chateau-de-falaise', 'Château de Falaise', 'OUEST', 'club', [-0.2, 48.89]),
  loc('chateau-de-fougeres', 'Château de Fougères', 'OUEST', 'club', [-1.21, 48.35]),
  loc('chateau-de-josselin', 'Château de Josselin', 'OUEST', 'club', [-2.55, 47.95]),
  loc('donjon-de-dinan', 'Donjon de Dinan', 'OUEST', 'club', [-2.05, 48.45]),
  loc('chateau-de-brissac', 'Château de Brissac', 'OUEST', 'club', [-0.45, 47.36]),
  loc('chateau-de-clisson', 'Château de Clisson', 'OUEST', 'club', [-1.28, 47.09]),
  loc('mont-saint-michel', 'Mont-Saint-Michel', 'OUEST', 'club', [-1.51, 48.64]),
  loc('port-de-barfleur', 'Port de Barfleur', 'OUEST', 'club', [-1.3, 49.62]),
  loc('chateau-d-angers', 'Château d’Angers', 'OUEST', 'club', [-0.56, 47.47]),

  // ---------- Lieux des clubs : Terre du Centre ----------
  loc('palais-des-ducs', 'Palais des Ducs de Bourgogne', 'CENTRE', 'club', [5.04, 47.32]),
  loc('fort-saint-andre-salins', 'Fort Saint-André de Salins', 'CENTRE', 'club', [5.88, 46.94]),
  loc('citadelle-de-besancon', 'Citadelle de Besançon', 'CENTRE', 'club', [6.03, 47.23]),
  loc('domaine-des-dombes', 'Domaine des Dombes', 'CENTRE', 'club', [5.0, 46.0]),
  loc('chateau-de-joux', 'Château de Joux', 'CENTRE', 'club', [6.37, 46.87]),
  loc('forteresse-de-polignac', 'Forteresse de Polignac', 'CENTRE', 'club', [3.86, 45.07]),
  loc('forteresse-de-murol', 'Forteresse de Murol', 'CENTRE', 'club', [2.94, 45.57]),
  loc('champ-de-brignais', 'Champ de Brignais', 'CENTRE', 'club', [4.75, 45.67]),
  loc('chateau-de-loches', 'Château de Loches', 'CENTRE', 'club', [1.0, 47.13]),
  loc('chateau-de-couzan', 'Château de Couzan', 'CENTRE', 'club', [3.85, 45.72]),
  loc('chateau-de-gien', 'Château de Gien', 'CENTRE', 'club', [2.63, 47.69]),

  // ---------- Lieux des clubs : Terre du Sud ----------
  loc('porte-narbonnaise', 'Porte Narbonnaise', 'SUD', 'club', [2.37, 43.21]),
  loc('chateau-comtal', 'Château Comtal de Carcassonne', 'SUD', 'club', [2.36, 43.207]),
  loc('chateau-de-grimaud', 'Château de Grimaud', 'SUD', 'club', [6.52, 43.27]),
  loc('chateau-de-roquebrune', 'Château de Roquebrune', 'SUD', 'club', [7.4, 43.8]),
  loc('fort-de-bregancon', 'Fort de Brégançon', 'SUD', 'club', [6.3, 43.16]),
  loc('chateau-de-lavardens', 'Château de Lavardens', 'SUD', 'club', [0.52, 43.76]),
  loc('commanderie-la-couvertoirade', 'Commanderie de La Couvertoirade', 'SUD', 'club', [3.31, 43.91]),
  loc('colline-du-chateau-nice', 'Colline du Château de Nice', 'SUD', 'club', [7.28, 43.7]),
  loc('chateau-vieux-de-bayonne', 'Château-Vieux de Bayonne', 'SUD', 'club', [-1.47, 43.49]),
  loc('chateau-des-baux', 'Château des Baux', 'SUD', 'club', [4.79, 43.74]),
  loc('chateau-de-peyrepertuse', 'Château de Peyrepertuse', 'SUD', 'club', [2.56, 42.87]),
  loc('tour-de-vesone', 'Tour de Vésone', 'SUD', 'club', [0.71, 45.18]),
  loc('chateau-de-chalucet', 'Château de Châlucet', 'SUD', 'club', [1.32, 45.73]),
  loc('chateau-de-montsegur', 'Château de Montségur', 'SUD', 'club', [1.83, 42.88]),
  loc('palais-des-rois-de-majorque', 'Palais des Rois de Majorque', 'SUD', 'club', [2.89, 42.69]),

  // ---------- Terre lointaine (clubs hors championnat) ----------
  loc('terres-lointaines', 'Au-delà des frontières', 'LOINTAINE', 'far'),
]);

// Lieu des clubs hors championnat, et de tout club sans lieu connu (à valider).
export const DEFAULT_FAR_LOCATION_ID = 'terres-lointaines';
