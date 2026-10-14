// Spécialités des combattants. Leurs règles de combat (stat d'attaque, allonge, bonus de
// position) sont dans data/combatRules.js ; `formationRole` décrit leur place dans la
// formation du béhourd (Almanach, aides).
export const SPECIALTIES = Object.freeze({
  lutteur: {
    id: 'lutteur',
    name: 'Lutteur',
    pluralName: 'Lutteurs',
    icon: '✊',
    color: '#b5523b',
    shortDescription: 'Lutte, contre la barrière.',
    // Annonce d'une recrue (carnet de bord) et forme courte (historique d'effectif d'un club).
    newRecruit: 'Un nouveau lutteur',
    newRecruitShort: 'nouveau lutteur',
    description: 'Spécialiste du corps-à-corps : saisies, projections et mises au sol. Il est redoutable contre la barrière, où il plaque ses adversaires.',
    formationRole: 'contre une barrière, un de chaque côté de la lice',
    statModifiers: {},
  },
  hastier: {
    id: 'hastier',
    name: 'Hastier',
    pluralName: 'Hastiers',
    icon: '🔱',
    color: '#3f7fa8',
    shortDescription: 'Arme d’hast, frappe à distance.',
    newRecruit: 'Un nouvel hastier',
    newRecruitShort: 'nouvel hastier',
    description: 'Manie une arme d’hast pour frapper à distance, par-dessus l’épaule de son Lutteur. Pris dans la mêlée, son arme l’encombre.',
    formationRole: 'juste derrière un Lutteur, hors d’atteinte',
    statModifiers: {},
  },
  runner: {
    id: 'runner',
    name: 'Runner',
    pluralName: 'Runners',
    icon: '🏃',
    color: '#8a5bb0',
    shortDescription: 'Combattant mobile, frappe dans le dos.',
    newRecruit: 'Un nouveau Runner',
    newRecruitShort: 'nouveau Runner',
    description: 'Combattant mobile qui file au milieu de la lice pour passer derrière les lignes adverses et percuter les combattants dans le dos.',
    formationRole: 'au centre, prêt à passer dans le dos adverse',
    statModifiers: {},
  },
});

export const SPECIALTY_IDS = Object.freeze(Object.keys(SPECIALTIES));

export function getSpecialty(id) {
  return SPECIALTIES[id] ?? null;
}
