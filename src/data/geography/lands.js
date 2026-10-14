// Les Terres — grandes zones géographiques fictives du royaume (systems/geography/).
// Elles remplacent les régions administratives : la carte de France est volontairement
// grossière (contours approximatifs en [longitude, latitude], pas de départements).
//
//   id, name, shortName (pastille), color (identité visuelle)
//   countryId pays de la carte (data/geography/europe.js) ; null : hors carte
//   regions   régions réelles regroupées (texte, Almanach)
//   polygons  contours de la Terre sur la carte de France (pays seulement)
//   label     position du nom sur la carte
//
// « Terre lointaine » : clubs hors championnat, hors de la carte de France.

// Cadre de la carte des Terres de chaque pays jouable.
export const LAND_MAP_BOUNDS = Object.freeze({
  fr: Object.freeze({ lonMin: -5.6, lonMax: 10.2, latMin: 41.1, latMax: 51.5, refLat: 46.5 }),
});

export const LANDS = Object.freeze([
  {
    id: 'OUEST', name: 'Terre de l’Ouest', shortName: 'Ouest', color: '#d9822b', countryId: 'fr',
    regions: ['Normandie', 'Bretagne', 'Pays de la Loire'],
    label: [-1.6, 48.1],
    polygons: [[[1.4, 50.1], [0.2, 49.7], [-1.2, 49.4], [-1.25, 49.7], [-1.9, 49.7], [-1.6, 48.6], [-3.0, 48.8], [-4.7, 48.5], [-4.3, 47.8],
      [-2.5, 47.3], [-2.1, 47.0], [-1.2, 46.3], [-0.1, 46.9], [0.3, 47.2], [0.8, 47.7], [0.9, 48.3], [1.6, 48.9], [1.8, 49.7]]],
  },
  {
    id: 'NORD', name: 'Terre du Nord', shortName: 'Nord', color: '#2f5ea0', countryId: 'fr',
    regions: ['Île-de-France', 'Hauts-de-France', 'Grand Est'],
    label: [4.4, 49.1],
    polygons: [[[1.4, 50.1], [1.5, 50.2], [1.6, 50.9], [2.5, 51.1], [3.1, 50.6], [4.2, 49.95], [4.85, 50.15], [5.8, 49.55], [6.4, 49.5],
      [7.0, 49.1], [8.2, 49.0], [7.75, 48.6], [7.6, 47.6], [7.1, 47.7], [5.9, 47.8], [4.9, 47.8], [4.0, 48.0], [3.0, 48.2], [2.0, 48.2],
      [0.9, 48.3], [1.6, 48.9], [1.8, 49.7]]],
  },
  {
    id: 'CENTRE', name: 'Terre du Centre', shortName: 'Centre', color: '#3e7d3a', countryId: 'fr',
    regions: ['Centre-Val de Loire', 'Bourgogne-Franche-Comté', 'Auvergne-Rhône-Alpes'],
    label: [3.9, 46.6],
    polygons: [[[0.9, 48.3], [2.0, 48.2], [3.0, 48.2], [4.0, 48.0], [4.9, 47.8], [5.9, 47.8], [7.1, 47.7], [7.6, 47.6], [7.0, 47.5],
      [6.8, 47.0], [6.1, 46.2], [7.0, 45.9], [6.9, 45.0], [5.6, 44.8], [4.6, 44.3], [3.9, 44.6], [2.9, 44.9], [2.3, 45.2], [2.5, 46.4],
      [1.2, 46.6], [0.3, 47.2], [0.8, 47.7]]],
  },
  {
    id: 'SUD', name: 'Terre du Sud', shortName: 'Sud', color: '#8a5a32', countryId: 'fr',
    regions: ['Nouvelle-Aquitaine', 'Occitanie', 'Provence', 'Corse'],
    label: [1.4, 44.2],
    polygons: [
      [[-1.2, 46.3], [-1.2, 45.0], [-1.4, 44.0], [-1.8, 43.4], [-0.5, 42.8], [1.0, 42.7], [3.2, 42.4], [3.1, 43.1], [4.0, 43.5],
        [5.4, 43.2], [6.6, 43.1], [7.5, 43.8], [7.0, 44.2], [6.9, 45.0], [5.6, 44.8], [4.6, 44.3], [3.9, 44.6], [2.9, 44.9], [2.3, 45.2],
        [2.5, 46.4], [1.2, 46.6], [0.3, 47.2], [-0.1, 46.9]],
      [[9.4, 43.0], [9.6, 42.1], [9.2, 41.4], [8.6, 41.9], [8.7, 42.6]],
    ],
  },
  {
    id: 'LOINTAINE', name: 'Terre lointaine', shortName: 'Lointaine', color: '#6b6380', countryId: null,
    regions: [],
    label: null,
    polygons: [],
  },
].map(Object.freeze));
