// Zoom des cartes sur téléphone (v0.91) : Centre, Bourg, Taverne, Scriptorium, Ma Lice, Gabarnac.
// Pincer pour zoomer ou dézoomer, glisser un doigt pour se déplacer quand la carte est agrandie.
export const MAP_ZOOM = Object.freeze({
  min: 1, // 1 : la carte entière (le cadrage d'origine) ; on ne dézoome pas en deçà
  max: 2.4, // agrandissement maximal
  dragThreshold: 8, // px : en deçà, c'est un toucher (sélection), pas un glissé
});
