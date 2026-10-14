// Lice du club — terrain des combats de Ligue À DOMICILE (combat/presentation/CombatArenaService.js,
// via systems/lice/LiceService.js). Présentation uniquement.
//
// v0.44 : le lieu « Ma Lice » (scène, maître d'œuvre) a été retiré du jeu ; seul le décor du
// terrain des matchs à domicile reste, avec les améliorations éventuelles de la lice
// (data/liceUpgrades.js › visualUpgrade.arenaProps).

const HOUSES = {
  oak: { wall: '#e8dcc0', roof: '#a8452f', height: 1.15 },
  slate: { wall: '#d9c7a0', roof: '#4f5a63', height: 1.1 },
};

export const MY_LICE_LAYOUT = Object.freeze({
  // Terrain des combats de Ligue À DOMICILE (combat/presentation/CombatArenaService.js) : même
  // format qu'un décor de data/liceDecorations.js, tiré de cette lice (sable, herbe, palissade,
  // maisons, râteliers, tonneaux…). Les bannières prennent les couleurs de la compagnie.
  // Les améliorations de la lice y ajoutent leurs éléments (data/liceUpgrades.js › arenaProps).
  // Disposition fixe : la même à chaque match à domicile (tant que la lice ne change pas).
  arena: Object.freeze({
    name: 'Lice du club',
    description: 'La lice de votre compagnie, dressée chez vous.',
    background: ['#a9cbe6', '#d3e6f0'],
    ground: {
      arena: { style: 'checker', colors: ['#e1c98e', '#d8bf84'], grid: 'rgba(80, 55, 25, 0.22)' },
      crowd: { style: 'checker', colors: ['#c9b48c', '#c0ab82'] },
      outer: { style: 'checker', colors: ['#93c46e', '#8aba66'] },
      slab: { left: '#8b6a3f', right: '#6e5230' },
    },
    fence: { rail: '#8a5f34', post: '#5f3f24' },
    layout: { crowdBand: 2, ringWidth: 2 },
    props: {
      back: [
        { type: 'building', weight: 18, w: 2, h: 2, variants: [HOUSES.oak, HOUSES.slate] },
        { type: 'clubBanner', weight: 10 }, { type: 'rack', weight: 8 }, { type: 'barrel', weight: 7 },
        { type: 'tree', weight: 14 }, { type: 'rock', weight: 5 }, { type: null, weight: 38 },
      ],
      front: [
        { type: 'barrel', weight: 10 }, { type: 'rack', weight: 6 }, { type: 'rock', weight: 8 },
        { type: 'bush', weight: 8 }, { type: null, weight: 68 },
      ],
    },
  }),
});
