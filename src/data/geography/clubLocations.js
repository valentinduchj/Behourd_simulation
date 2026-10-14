// Lieu de chaque club des ligues : clubId → locationId (data/geography/locations.js).
// La Terre d'un club découle de son lieu. Le lieu est indépendant du nom du club.
// Un lieu modifié dans l'Admin (fiche du club : locationId) prime sur cette table.
// Les clubs hors championnat n'y figurent pas : ils vont en Terre lointaine.

export const CLUB_LOCATIONS = Object.freeze({
  // Ligue 1
  club_109: 'enceinte-philippe-auguste', // Ardents
  club_118: 'palais-des-ducs', // Descendants du Hardi
  club_110: 'abbaye-de-jumieges', // Diex Aïe
  club_106: 'chateau-de-falaise', // Pardus Bellator
  club_119: 'fort-saint-andre-salins', // Fera Sequania
  club_101: 'citadelle-de-besancon', // Aquila Sequania
  club_112: 'chateau-de-fougeres', // Ar Groaz Du
  club_114: 'domaine-des-dombes', // Bannis de la Grenouille
  club_107: 'porte-narbonnaise', // Carcas Sonne
  club_103: 'chateau-de-joux', // Comtois
  club_104: 'beffroi-de-douai', // Hommes du Nord
  club_102: 'chateau-de-vincennes', // Martel
  club_105: 'foret-de-compiegne', // Confrérie des Loups
  club_108: 'chateau-de-grimaud', // Grimaldi Milites
  club_113: 'chateau-de-lavardens', // Armagnacs
  club_111: 'porte-des-allemands', // Graoully
  club_116: 'commanderie-la-couvertoirade', // Ordre de Sinople
  club_117: 'colline-du-chateau-nice', // Bande Nere

  // Ligue 2
  club_007: 'chateau-vieux-de-bayonne', // Akerbeltz
  club_002: 'chateau-de-dourdan', // Exactor Mortis
  club_011: 'parvis-notre-dame', // Gargouilles de Paris
  club_018: 'chateau-des-baux', // Vassaux de Provence
  club_008: 'porte-de-la-craffe', // Lotharii Regnum
  club_004: 'forteresse-de-polignac', // Lupus Fratum
  club_006: 'forteresse-de-murol', // Bannerets d'Auvergne
  club_014: 'mont-cassel', // Arma Flandriae
  club_013: 'chateau-de-josselin', // An Diforc'h' Ruz
  club_010: 'champ-de-brignais', // Tard-Venus
  club_016: 'donjon-de-dinan', // Martel Du Guesclin
  club_003: 'abbaye-de-saint-denis', // In Memorio Y
  club_005: 'fort-de-bregancon', // Grimaldi Auxilia
  club_017: 'chateau-de-peyrepertuse', // Bannis du Languedoc
  club_009: 'chateau-de-brissac', // Baronnerie
  club_001: 'chateau-de-clisson', // Faucons Noirs
  club_012: 'haut-koenigsbourg', // Houblon d'or
  club_019: 'tour-de-vesone', // Sanctis Draconis Petrocoria

  // Ligue 3
  club_209: 'chateau-du-lichtenberg', // Ostlanders
  club_210: 'abbaye-de-saint-amand', // Chevaliers du Hainaut
  club_208: 'chateau-de-loches', // La Rose et le Fer
  club_203: 'chateau-de-chalucet', // Lance Limousine
  club_214: 'chateau-de-montsegur', // Cerbères
  club_206: 'tour-du-guet-de-calais', // Veilleurs du Nord
  club_216: 'palais-des-rois-de-majorque', // Magna Societas Catalanorum
  club_213: 'chateau-de-couzan', // Corvus Forezis
  club_211: 'chateau-comtal', // Carcas Sonne 2
  club_217: 'tour-de-montlhery', // Exactor Mortis 2
  club_205: 'bois-de-cergy', // Martel La Hire
  club_212: 'mont-saint-michel', // Auream Excubitores
  club_207: 'chateau-de-gien', // Red Stars
  club_201: 'chateau-de-roquebrune', // Grimaldi Milites 2
  club_202: 'porte-serpenoise', // Graoully 2
  club_215: 'port-de-barfleur', // Vassgard
  club_204: 'chateau-d-angers', // Arma Ligeris
});
