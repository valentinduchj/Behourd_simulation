// Plan général du Centre (vue isométrique). Les lieux d'activité sont décrits dans
// data/activities.js et leur mise en scène dans data/centreVisuals.js ; ce fichier définit le
// terrain commun et le décor du camp.
//
// Camp resserré (v0.40, 17 × 14 cases) pour mieux voir les combattants :
//   bordure (0, 16 / 13)  lisière : arbres, buissons, rochers (générés, voir `decorRing`) et tentes
//   x 7–8, y 6–7          grande croisée de chemins : la cour, autour du feu de camp
//   nord-ouest            Banquet            nord-est   Pôle Combat (Petite lice, Mannequins, Tas de foin)
//   sud-ouest             Forêt              sud-est    Rivière (pont sur l'allée)
export const CENTRE_LAYOUT = Object.freeze({
  width: 17,
  height: 14,
  grass: ['#93c46e', '#8aba66'],
  // Chemins : ils relient les zones ; les combattants au repos s'y tiennent (la « cour »).
  // Chaque bout de chemin mène à un lieu (sorties : data/locations.js) : haut-droite → Taverne,
  // bas-droite → Bourg, haut-gauche → Scriptorium, bas-gauche → Ma Lice d'entraînement (v0.71).
  paths: [
    { x: 7, y: 0, w: 2, h: 14 },
    { x: 0, y: 6, w: 17, h: 2 },
  ],
  // Cases laissées en herbe (ni chemin ni lisière générée). Le bout bas-gauche, longtemps fermé,
  // mène depuis la v0.71 à Ma Lice d'entraînement : il n'y en a plus.
  grassPatches: [],
  pathColor: ['#dcc89c', '#d4bf92'],
  // Centre de la cour : les combattants au repos se regroupent autour du feu.
  restCenter: { x: 8, y: 7 },
  // Enclos regroupant plusieurs lieux (palissade dessinée autour).
  enclosures: [
    { id: 'combat-pole', name: 'Pôle Combat', area: { x: 9, y: 1, w: 6, h: 5 }, fence: '#7a5230' },
  ],
  // Cadre de la caméra en vue d'ensemble (la lisière peut déborder un peu).
  overview: { x: 0.6, y: 0.4, w: 15.8, h: 13 },
  // Décor fixe. Le type 'banner' sans couleur prend les couleurs de l'équipe.
  props: [
    { id: 'camp-fire', type: 'campfire', x: 7, y: 6 },
    { type: 'banner', x: 6, y: 5 },
    { type: 'banner', x: 9, y: 0 },
    { type: 'tent', x: 0, y: 0, w: 2, h: 2, color: '#e8dcc0', stripe: '#b8402f' },
    { type: 'tent', x: 15, y: 2, w: 2, h: 2, color: '#e8dcc0', stripe: '#2d5a9a' },
    { type: 'tent', x: 15, y: 11, w: 2, h: 2, color: '#e8dcc0', stripe: '#b07d1a' },
    { type: 'bridge', x: 11, y: 6, w: 2, h: 2, layer: 'ground', blocking: false },
  ],
  // Lisière générée de façon déterministe (même résultat à chaque affichage) sur les
  // cases libres de la bordure. `mix` : poids relatifs de chaque élément (null = vide).
  decorRing: {
    width: 1,
    mix: [
      { type: 'tree', weight: 52 },
      { type: 'bush', weight: 20 },
      { type: 'flowers', weight: 12 },
      { type: 'rock', weight: 6 },
      { type: null, weight: 10 },
    ],
  },
  rest: {
    name: 'Cour',
    icon: '☗',
    description: 'Les combattants sans activité se reposent dans la cour, autour du feu de camp.',
  },
});
