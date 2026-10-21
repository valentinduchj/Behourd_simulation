// Son du jeu (v0.74 ; v0.74.1 : enregistrements seulement) — données. Moteur : audio/AudioEngine.js ; aiguillage selon l'écran :
// audio/AudioDirector.js. Rien n'est écrit en dur dans les écrans : ils annoncent un moment
// (« la manche se lance », « victoire ») et ce fichier dit ce qu'on entend.
//
// Trois bus, réglables dans les Options : musique, ambiances, effets (sous le volume général).

/** Musiques (fichiers MP3, jouées en boucle). */
export const MUSIC_TRACKS = Object.freeze({
  taverne: Object.freeze({ id: 'taverne', title: 'Tableau de la Taverne', file: 'assets/audio/music/tableau-de-la-taverne.ogg', volume: 0.85 }),
  combat: Object.freeze({ id: 'combat', title: 'Warlike Pulse', file: 'assets/audio/music/warlike-pulse.ogg', volume: 0.8 }),
  scriptorium: Object.freeze({ id: 'scriptorium', title: 'Wistful Dawn', file: 'assets/audio/music/wistful-dawn.ogg', volume: 0.9 }),
});

/**
 * Ce qu'on entend sur chaque écran : { music, ambience }.
 *   music    identifiant de MUSIC_TRACKS ; 'keep' : la musique en cours continue ; null : silence
 *            (fondu de sortie).
 *   ambience identifiant de AMBIENCES ; null : pas d'ambiance (fondu de sortie).
 * Un écran absent prend DEFAULT_SCREEN_AUDIO. Le combat (« Warlike Pulse ») ne démarre qu'au
 * lancement d'une manche (moment 'roundStart').
 */
export const SCREEN_AUDIO = Object.freeze({
  // Ouverture du jeu : la musique principale (v0.74.1).
  'main-menu': Object.freeze({ music: 'taverne', ambience: null }),
  centre: Object.freeze({ music: 'taverne', ambience: 'centre' }),
  borough: Object.freeze({ music: 'taverne', ambience: 'borough' }),
  tavern: Object.freeze({ music: 'taverne', ambience: 'tavern' }),
  training: Object.freeze({ music: 'taverne', ambience: 'training' }),
  scriptorium: Object.freeze({ music: 'scriptorium', ambience: 'scriptorium' }),
  expeditions: Object.freeze({ music: 'taverne', ambience: 'expeditions' }),
  match: Object.freeze({ music: 'keep', ambience: 'lice' }),
  'french-cup': Object.freeze({ music: 'keep', ambience: 'cup' }),
});
export const DEFAULT_SCREEN_AUDIO = Object.freeze({ music: 'keep', ambience: null });

/** Moments du jeu → musique. */
export const MOMENT_MUSIC = Object.freeze({
  // Une manche se lance (Lice, Coupe, Reine, lice d'entraînement) : jusqu'à la fin du combat.
  roundStart: 'combat',
});

// v1.1.9 : musique et ambiances en Opus (.ogg) — musique 96 kb/s, ambiances 48 kb/s mono (audio
// deux fois plus léger) ; les bruitages courts restent en MP3.
const EXTENSION = Object.freeze({ music: 'ogg', ambience: 'ogg', sfx: 'mp3' });
const A = (name) => `assets/audio/ambience/${name}.${EXTENSION.ambience}`;
const S = (name) => `assets/audio/sfx/${name}.${EXTENSION.sfx}`;
// Variantes numérotées d'un même son : « hit-steel-1.mp3 », « hit-steel-2.mp3 »…
const variants = (folder, base, count) => Array.from({ length: count }, (_, i) => `assets/audio/${folder}/${base}-${i + 1}.${EXTENSION[folder] ?? 'mp3'}`);

/**
 * Ambiances (v0.74.1 : de vrais enregistrements, plus aucun son synthétisé). Par lieu :
 *   layers      boucles jouées ensemble : [{ file, volume }] (chacune part d'un endroit au hasard) ;
 *   winterLayers   remplacent `layers` en hiver (oiseaux absents) ;
 *   oneShots    sons ponctuels au hasard : [{ files, every: [min, max] secondes, volume, pitchJitter }] ;
 *   volume      volume de l'ensemble (sous le plafond des ambiances : toujours sous la musique).
 * Sources et licences : AUDIO_CREDITS (toutes libres de droits, CC0).
 */
export const AMBIENCES = Object.freeze({
  centre: Object.freeze({
    label: 'Le camp : feu de camp, forêt voisine', volume: 0.9,
    layers: [{ file: A('camp-fire'), volume: 0.75 }, { file: A('forest'), volume: 0.6 }],
    winterLayers: [{ file: A('camp-fire'), volume: 0.75 }, { file: A('wind-trees'), volume: 0.55 }],
  }),
  borough: Object.freeze({
    label: 'Le Bourg : marché', volume: 0.85,
    layers: [{ file: A('market'), volume: 0.8 }],
  }),
  // Les Expéditions (v0.96) : le marché au nord, le vent des montagnes au sud.
  expeditions: Object.freeze({
    label: 'Les Expéditions : marché, vent des montagnes', volume: 0.85,
    layers: [{ file: A('market'), volume: 0.45 }, { file: A('wind-trees'), volume: 0.6 }],
  }),
  tavern: Object.freeze({
    label: 'La Taverne : conversations, âtre', volume: 0.85,
    layers: [{ file: A('tavern-chatter'), volume: 0.8 }, { file: A('hearth'), volume: 0.45 }],
  }),
  scriptorium: Object.freeze({
    label: 'Le Scriptorium : âtre étouffé, pages tournées', volume: 0.8,
    layers: [{ file: A('hearth-quiet'), volume: 0.6 }],
    oneShots: [{ files: variants('ambience', 'book-flip', 3), every: [7, 16], volume: 0.5, pitchJitter: 0.06 }],
  }),
  training: Object.freeze({
    label: 'Ma Lice d’entraînement : vent dans les arbres, mannequins frappés', volume: 0.85,
    layers: [{ file: A('wind-trees'), volume: 0.6 }],
    oneShots: [{ files: variants('ambience', 'dummy-hit', 3), every: [2.5, 6], volume: 0.45, pitchJitter: 0.1 }],
  }),
  lice: Object.freeze({
    label: 'La Lice : la foule', volume: 0.9,
    layers: [{ file: A('crowd'), volume: 0.8 }],
    oneShots: [{ files: [A('applause-small'), A('applause-crowd')], every: [25, 50], volume: 0.4 }],
  }),
  cup: Object.freeze({
    label: 'Le Château de Gabarnac : grande foule', volume: 1,
    layers: [{ file: A('big-crowd'), volume: 0.85 }],
    oneShots: [{ files: [A('applause-crowd'), A('applause-big')], every: [20, 40], volume: 0.45 }],
  }),
});

/**
 * Effets sonores (v0.74.1 : de vrais enregistrements) : plusieurs variantes par effet, tirées au
 * hasard et légèrement transposées (pitchJitter) pour éviter la répétition.
 *   { files, volume, pitchJitter?, throttle? (limité à maxHitsPerSecond), maxSeconds? (coupé en fondu) }
 */
export const SOUND_EFFECTS = Object.freeze({
  // Coups (v1.1.5) : des lames d'acier qui s'entrechoquent.
  hit: Object.freeze({ files: Object.freeze(variants('sfx', 'hit-steel', 3)), volume: 0.55, pitchJitter: 0.08, throttle: true }),
  // Gros coups : un long choc d'épées, ou une masse qui sonne sur le métal.
  bigHit: Object.freeze({ files: Object.freeze([S('bighit-steel-1'), S('bighit-pipe-1')]), volume: 0.75, pitchJitter: 0.06, throttle: true }),
  // KO : la lourde chute du combattant dans la terre.
  ko: Object.freeze({ files: Object.freeze([S('ko-fall-1')]), volume: 0.9, pitchJitter: 0.05 }),
  // Fanfare de victoire : l'ouverture d'un thème médiéval (8 s, fondu).
  victory: Object.freeze({ files: Object.freeze([S('victory-fanfare')]), volume: 0.8, maxSeconds: 8 }),
  // Exploit accompli : une cloche.
  achievement: Object.freeze({ files: Object.freeze([S('achievement-bell')]), volume: 0.6 }),
});

/** Sources des sons (toutes sous licence CC0 : utilisables sans condition, crédit facultatif). */
export const AUDIO_CREDITS = Object.freeze([
  Object.freeze({ files: 'ambience/camp-fire, forest, market, tavern-chatter, hearth, hearth-quiet, wind-trees, crowd, big-crowd, applause-*', author: 'Joseph Sardin', source: 'BigSoundBank (bigsoundbank.com) — sons n° 0989, 2749, 2729, 0480, 2855, 0030, 0904, 2969, 2970, 3523, 0019, 0021', license: 'CC0' }),
  Object.freeze({ files: 'sfx/hit-steel-1, 2, 3', author: 'loudernoises, Bird_man, JohnBuhr', source: 'Freesound — « Sword Clash » (n° 334169), « Sword Clash.wav » (n° 275159), « Sword_Clash (7).wav » (n° 326868)', license: 'CC0' }),
  Object.freeze({ files: 'sfx/bighit-steel-1, bighit-pipe-1', author: 'Christopherderp, ani_music', source: 'Freesound — « Swords Clash - High Quality #3 » (n° 364531), « ANI Big Pipe Hit » (n° 244983)', license: 'CC0' }),
  Object.freeze({ files: 'sfx/ko-fall-1', author: 'leonelmail', source: 'Freesound — « BODY FALL - V HVY - DIRT » (n° 504626)', license: 'CC0' }),
  Object.freeze({ files: 'sfx/achievement-bell ; ambience/dummy-hit-*', author: 'Kenney', source: 'Impact Sounds (kenney.nl)', license: 'CC0' }),
  Object.freeze({ files: 'ambience/book-flip-*', author: 'Kenney', source: 'RPG Audio (kenney.nl)', license: 'CC0' }),
  Object.freeze({ files: 'sfx/victory-fanfare', author: 'RandomMind', source: 'Medieval: Victory Theme (opengameart.org)', license: 'CC0' }),
]);

export const AUDIO_RULES = Object.freeze({
  // Fondu enchaîné des musiques (s) : réglable dans les Options (audio.crossfade).
  crossfadeSeconds: 3,
  // Fondu des ambiances d'un lieu à l'autre (s).
  ambienceFadeSeconds: 2.5,
  // Les ambiances restent sous la musique : plafond du bus des ambiances, et atténuation
  // supplémentaire tant qu'une musique joue.
  ambienceCeiling: 0.5,
  ambienceUnderMusic: 0.6,
  // Coups : un « gros coup » à partir de ces dégâts ; au plus N sons de coups par seconde.
  bigHitDamage: 25,
  maxHitsPerSecond: 8,
});
