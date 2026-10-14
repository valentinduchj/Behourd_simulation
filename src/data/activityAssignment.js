// Affectation rapide du Centre (systems/activities/ActivityAssignmentService.js) — confort
// de jeu seulement : aucune règle d'activité (gain, réussite, places) n'est ici.
//
// Chaque lieu a une configuration enregistrée avec la partie :
//   { activityId, targetClass: 'lutteur' | 'hastier' | 'runner' | null, sortBy, sortDirection }
// Son bouton [+] y place, dans les places libres, les combattants de la classe ciblée (toutes
// si null) dans l'ordre du tri. Le Banquet garde son raccourci par seuil de fatigue
// (data/activities.js › quickAssign).
//
// Critères de tri : ajouter un critère = ajouter une entrée (sa valeur est calculée par le
// service, d'après `source`) :
//   'stat'          une statistique du combattant (`stat`)
//   'level'         le niveau (moyenne des compétences)
//   'activitySkill' la compétence travaillée par le lieu (récompense de type stat) ; ce
//                   critère n'est proposé que pour les lieux qui en ont une
export const ACTIVITY_SORT_CRITERIA = Object.freeze([
  Object.freeze({ id: 'FATIGUE', label: 'Fatigue', source: 'stat', stat: 'fatigue', feminine: true }),
  Object.freeze({ id: 'LEVEL', label: 'Niveau', source: 'level', feminine: false }),
  Object.freeze({ id: 'ACTIVITY_SKILL', label: 'Compétence du lieu', source: 'activitySkill', feminine: true }),
]);

export const SORT_DIRECTIONS = Object.freeze({ ASC: 'ASC', DESC: 'DESC' });

// Configuration de départ d'un lieu (avant tout réglage du joueur) :
//   lieu qui travaille la compétence d'attaque d'une classe → cette classe, meilleur niveau d'abord ;
//   lieu qui rapporte des deniers (Forêt) → toutes classes, niveau le plus bas d'abord ;
//   autres lieux → toutes classes, meilleur niveau d'abord.
export const DEFAULT_ASSIGNMENT = Object.freeze({
  skill: Object.freeze({ sortBy: 'LEVEL', sortDirection: 'DESC', classFromSkill: true }),
  resource: Object.freeze({ sortBy: 'LEVEL', sortDirection: 'ASC', classFromSkill: false }),
  other: Object.freeze({ sortBy: 'LEVEL', sortDirection: 'DESC', classFromSkill: false }),
});
