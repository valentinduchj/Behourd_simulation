// Règles du combat Joueur contre IA (src/combat/engine/). Les combats IA contre IA gardent
// leur simulation (systems/match/RoundService.js). Toutes les valeurs sont ici : aucune
// n'est écrite dans le moteur ni dans l'interface.

export const COMBAT_RULES = Object.freeze({
  // Statistique offensive de chaque classe (identifiants de data/stats.js).
  offenseStatByClass: Object.freeze({ hastier: 'polearm', lutteur: 'wrestling', runner: 'percussion' }),

  // v0.65 : plus de boucle de classes (l'ancien « Hastier > Lutteur > Runner », dégâts ×2). Ce
  // qui compte, c'est la POSITION, comme dans un vrai béhourd : le Lutteur contre la barrière, le
  // Hastier qui frappe à distance derrière lui, le Runner qui passe dans le dos des adversaires.

  // Allonge, en cases (distance de Tchebychev) : le Hastier frappe à 2 cases, par-dessus
  // l'épaule d'un allié ; les autres au contact.
  reachByClass: Object.freeze({ hastier: 2 }),

  // Dégâts d'un coup (CombatDamageCalculator) :
  //   10 × attaque ÷ défense × (1 + aléa + combo) × (1 − fatigue ÷ 100) × bonus final
  //   attaque : stat de classe de l'attaquant ;
  //   défense : moitié HAST + moitié stat de classe de la cible ;
  //   aléa    : un tirage par coup, entre 0 et la PER de l'attaquant (en %), 50 % au plus ;
  //   combo   : (coups consécutifs sur la même cible, 5 au plus) × LUTTE ÷ 10 (en %) — remis à
  //             zéro au changement de cible, à chaque manche et à chaque combat.
  damage: Object.freeze({
    base: 10,
    defense: Object.freeze({ statId: 'polearm', statWeight: 0.5, classWeight: 0.5 }),
    random: Object.freeze({ statId: 'percussion', cap: 0.5 }),
    combo: Object.freeze({ statId: 'wrestling', perPointPerHit: 0.001, maxHits: 5 }),
  }),

  // Bonus de position (CombatSituation). Valeurs « à valider ».
  bonuses: Object.freeze({
    // Capitaine : +15 % sur toutes ses stats de combat, au début de chaque manche (les deux camps).
    captain: Object.freeze({ allStats: 0.15 }),
    // Lutteur contre la barrière : à `distance` case(s) au plus d'un bord de la lice → +20 % en LUTTE.
    lutteurBarrier: Object.freeze({ classId: 'lutteur', statId: 'wrestling', bonus: 0.2, distance: 1 }),
    // Cible plaquée : collée à la barrière (bord de la lice) quand un Lutteur la frappe → son combo
    // monte de `comboBoost` coup(s) de plus, et elle ne peut plus reculer.
    lutteurPin: Object.freeze({ classId: 'lutteur', comboBoost: 1 }),
    // Hastier : frapper à distance (2 cases) → +20 % de dégâts finaux ; un adversaire au contact
    // (arme d'hast encombrante dans la mêlée) → −20 %.
    hastierReach: Object.freeze({ classId: 'hastier', finalDamage: 0.2 }),
    hastierCrowded: Object.freeze({ classId: 'hastier', finalDamage: -0.2 }),
    // Runner dans le dos : frapper une cible qui ne le voit pas → +30 % de dégâts finaux ; s'il
    // arrive en courant (pas fait ce tour-ci ou le précédent), il la renverse : elle perd
    // `stunTicks` tour(s).
    runnerRear: Object.freeze({ classId: 'runner', finalDamage: 0.3, stunTicks: 1 }),
    // Angle mort (casques fermés) : tout coup venu d'un adversaire que la cible ne voit pas →
    // +15 % de dégâts finaux, quelle que soit la classe (cumulé avec le Runner).
    blindSpot: Object.freeze({ finalDamage: 0.15 }),
  }),

  // Casques fermés : chacun ne voit que devant lui, dans un cône de ± halfAngle degrés autour de
  // sa direction (vers sa cible, sinon vers où il marche ; au départ, vers l'adversaire). Un
  // adversaire hors du cône n'existe pas pour son IA, sauf s'il l'a frappé dans les
  // `memoryTicks` derniers tours. Valeurs « à valider ».
  vision: Object.freeze({ halfAngle: 60, memoryTicks: 4 }),

  // Formation d'une manche (composition des IA) : 2 Lutteurs, 2 Hastiers, 1 Runner, complétés
  // par les meilleurs disponibles si une classe manque.
  formation: Object.freeze({ lutteur: 2, hastier: 2, runner: 1 }),

  // Fatigue et dégâts : aucun malus jusqu'au seuil ; au-delà, chaque point de fatigue au-dessus
  // du seuil retire `perPoint` des dégâts (50 → 100 %, 75 → 50 %, 100 → 0 %, puis le minimum de 1).
  // v0.66 : c'est la fatigue DU MOMENT qui compte (elle évolue pendant la manche).
  fatigueDamage: Object.freeze({ threshold: 50, perPoint: 0.02 }),
  // Mises à terre comptées (v1.1.7) : au plus `maxPerRound` par combattant et par manche, et
  // `maxPerMatch` sur tout le combat (simulateRound : knockoutsBefore). Au-delà,
  // le KO est compté au coéquipier qui a le plus frappé la victime dans la manche (une aide) ; le
  // combat lui-même n'en est pas changé (seules les statistiques et les mises à terre de carrière).
  knockoutCredit: Object.freeze({ maxPerRound: 3, maxPerMatch: 6 }),

  // Fatigue pendant la manche (v0.66, béhourd réel), tour par tour. Valeurs « à valider » :
  //   debout        + effortPerTick × (1 + tour ÷ escalationTicks) : plus la manche dure, plus
  //                 c'est fatigant pour ceux qui sont encore debout ;
  //   coup donné    + perHitGiven ;
  //   coup reçu     + perDamageTaken × dégâts (encaisser fatigue bien plus que frapper) ;
  //   au sol (KO)   − koRecoveryPerTick (plus il reste au sol, plus il récupère) ;
  //   il souffle    − breathRecoveryPerTick au lieu de l'effort (souffle, temps mort).
  // Entre deux manches d'un même combat : − betweenRounds.aligned pour ceux qui viennent de
  // combattre, − betweenRounds.bench pour les remplaçants de l'effectif. Bornée entre 0 et 100.
  // v0.68 (150 PV, manches plus longues) : effort 0,8 → 0,6 et alourdi plus lentement (15 → 25
  // tours) ; coups reçus 0,2 → 0,13 par point de dégât, pour garder la même fatigue totale par
  // KO (il faut 1,5 fois plus de coups). Mesuré : fatigue de fin de manche inchangée (≈ 41).
  roundFatigue: Object.freeze({
    effortPerTick: 0.6, escalationTicks: 25,
    perHitGiven: 0.6, perDamageTaken: 0.13,
    koRecoveryPerTick: 1.5, breathRecoveryPerTick: 0.8,
    betweenRounds: Object.freeze({ aligned: 10, bench: 15 }),
  }),

  // Temps mort (v0.66) : quand il reste au plus `maxPerSide` combattants contre autant, que la
  // fatigue moyenne des combattants debout atteint `minAverageFatigue` et que personne n'est au
  // bord du KO (PV > safeHpRatio), chaque tour a `chancePerTick` de lancer un temps mort de
  // `durationTicks` tours : chacun recule d'un pas et souffle, puis l'affrontement reprend. Au plus
  // `maxPerRound` par manche, espacés d'au moins `minGapTicks` tours. Valeurs « à valider ».
  lull: Object.freeze({ maxPerSide: 2, minAverageFatigue: 50, safeHpRatio: 0.25, chancePerTick: 0.15, durationTicks: Object.freeze({ min: 3, max: 5 }), maxPerRound: 2, minGapTicks: 6 }),

  // Fatigue fictive des combattants de l'IA au début de chaque combat (avant la première
  // manche), tirée une fois par combattant ; elle s'accumule ensuite comme celle du joueur.
  aiStartingFatigue: Object.freeze({ min: 0, max: 15 }),

  // Dégâts minimum d'un coup.
  minDamage: 1,
  // Les dégâts sont arrondis à l'entier le plus proche (PV entiers).
  rounding: 'round',

  // Endurance des combattants de l'IA (ordre des attaques) : valeur théorique (leur niveau,
  // que représentent leurs étoiles) ± cette variation, tirée une fois par combat.
  aiEnduranceVariation: 0.1,

  // Vitesse de déplacement de référence, en cases par tour de simulation (même vitesse pour
  // tous). Déplacements en 8 directions.
  // 0,7 = 1 × 0,70 : vitesse d'origine (1 case par tour) réduite de 30 %. Chaque tour, un
  // combattant qui se déplace cumule cette valeur et fait un pas dès qu'il atteint 1 case ;
  // la durée d'un tour, les attaques et les animations ne changent pas.
  moveTilesPerTick: 0.7,
  // Déplacement « en réserve » au plus (un combattant à l'arrêt ne cumule pas de pas d'avance).
  maxStoredMoves: 1,
  // Contact (mêlée) : cases adjacentes, diagonales comprises (distance de Tchebychev). C'est
  // aussi l'allonge de toute classe absente de `reachByClass`.
  contactRange: 1,

  // Sécurité : nombre maximal de tours d'une manche. Au-delà (blocage imprévu), la manche
  // revient au camp qui garde le plus de PV (puis le plus de combattants actifs).
  maxTicks: 1500,

  // Ordre du placement : à la 1re manche, l'équipe au niveau de club le plus élevé place en
  // premier (égalité : le joueur) ; ensuite, le premier à placer alterne à chaque manche.
  placementOrder: Object.freeze({ firstRound: 'higherLevel', tieGoesTo: 'A', alternateEachRound: true }),

  // Un KO ne vaut que pour la manche : à la suivante, tous les combattants (KO compris)
  // retrouvent leurs PV et peuvent être alignés. true : KO jusqu'à la fin du combat.
  knockoutLastsWholeMatch: false,
});

// Stratégie de placement de l'IA (src/combat/engine/AIPlacementStrategy.js).
// Formation du béhourd : un Lutteur contre chaque barrière (grand côté), un Hastier juste
// derrière chaque Lutteur (plus loin de l'adversaire, même rangée à une près), le Runner au
// milieu de la largeur, sur la ligne avant.
export const AI_PLACEMENT_CONFIG = Object.freeze({
  strategy: 'formation',
  // Lutteur : case à ≤ lutteurBarrier.distance d'un grand côté.
  barrierWeight: 2,
  // Lutteur : un grand côté déjà tenu par un Lutteur allié vaut moins (un de chaque côté).
  sharedBarrierPenalty: 1.6,
  // Hastier : juste derrière un Lutteur allié déjà posé (1 à 2 cases en retrait, rangée ± 1).
  coverWeight: 2.2,
  // Hastier : sans Lutteur à couvrir, rester en retrait de la ligne avant.
  rearWeight: 0.6,
  // Runner : rangées du milieu (écart au centre de la largeur).
  centreWeight: 1.8,
  // Tous : rester vers l'avant (Lutteurs et Runner surtout) ; négatif : ligne en retrait.
  frontWeight: 0.4,
  // Surcharge d'un flanc (0 : aucune) : bonus pour la moitié de la largeur où sont déjà ses alliés.
  overloadWeight: 0,
  // Petite part de hasard (0 = placement toujours identique dans la même situation).
  jitter: 0.15,
});

// IA individuelle des combattants pendant une manche (src/combat/engine/ai/) — ceux du
// joueur comme ceux de l'adversaire. Durées en tours de simulation (0,64 s à la vitesse ×1).
// Les règles du combat (dégâts, bonus, fatigue, victoire) ne sont pas ici : l'IA ne fait que
// choisir quoi faire, avec les mêmes calculs que le moteur.
export const FIGHTER_AI_CONFIG = Object.freeze({
  // Cycle de décision : chaque combattant décide tous les `decisionInterval` tours (décalés
  // d'un combattant à l'autre), ou aussitôt qu'un événement l'exige (cible KO ou hors
  // d'atteinte, chemin bloqué, arrivée au contact, coup dur, fin de recul).
  decisionInterval: 3,
  // Pendant une approche, le chemin vers la même cible est recalculé tous les N tours.
  pathRecalculationInterval: 2,
  // Coup dur : perte de PV depuis la dernière décision (fraction des PV max) → nouvelle décision.
  damageTrigger: 0.2,
  // Chemin bloqué : nouvelles tentatives (recalcul, pas de côté) avant d'abandonner la cible,
  // qui est alors écartée quelques tours (sauf s'il ne reste qu'elle).
  maxPathAttempts: 3,
  abandonTargetTicks: 4,

  // Recherche de chemin (PathfindingService) : une diagonale coûte à peine plus qu'un pas
  // droit (pour départager), sans se faufiler entre deux combattants qui se touchent.
  pathfinding: Object.freeze({ diagonalCost: 1.001, allowSqueeze: false, maxNodes: 400 }),

  // Choix de la cible (TargetSelectionService) — score de chaque adversaire actif :
  //   − distanceWeight × cases à parcourir (ou distance + unreachablePenalty s'il est hors d'atteinte)
  //   + strengthWeight × rapport de force (log2 : tours pour mourir ÷ tours pour le mettre KO,
  //     d'après les dégâts attendus ; favorise un adversaire moins fort, blessé ou dominé)
  //   − dangerWeight × autres adversaires autour de lui (× (1 + cautionFromWounds × blessure))
  //   + contactBonus s'il est déjà au contact (possibilité réelle d'attaquer)
  //   + currentTargetBonus pour la cible actuelle (pas de changement incessant)
  //   − crowdWeight par attaquant allié au-delà de crowdLimit
  //   + backWeight (Runner) si la cible est occupée par un de ses alliés (son dos est offert)
  //   + tiredWeight × fatigue de la cible ÷ 100 (préférer les adversaires épuisés)
  //   + captainWeight si la cible est le capitaine adverse ; + classPriority[classe de la cible]
  //   + un peu de hasard (jitter)
  // Seuls comptent les adversaires qu'il voit (casques fermés : COMBAT_RULES.vision).
  // Les profils d'IA (data/aiProfiles.js) modulent ces poids pour se distinguer.
  target: Object.freeze({
    distanceWeight: 1, unreachablePenalty: 6, strengthWeight: 1.5, strengthCap: 3,
    dangerWeight: 0.5, dangerRadius: 2, cautionFromWounds: 1,
    contactBonus: 2, currentTargetBonus: 1.5, crowdLimit: 3, crowdWeight: 1, jitter: 0.3,
    backWeight: Object.freeze({ runner: 2 }),
    tiredWeight: 0, captainWeight: 0, classPriority: Object.freeze({}),
  }),

  // Approche (DecisionService) : parmi les cases d'où l'on touche la cible, choisir l'angle —
  // coût du chemin + exposureWeight × autres adversaires voisins de la case − bonusTileWeight ×
  // valeur de la case pour sa classe (Lutteur : contre la barrière ; Hastier : à 2 cases, sans
  // adversaire au contact ; Runner : dans le dos de la cible), × bonusByClass + hasard.
  approach: Object.freeze({ exposureWeight: 0.6, bonusTileWeight: 0.8, bonusByClass: Object.freeze({ runner: 2.5, hastier: 1.5 }), jitter: 0.4 }),

  // Repositionnement au contact : à chaque décision, avec cette probabilité, un combattant
  // cherche une case voisine qui reste au contact de sa cible et vaut mieux (moins
  // d'adversaires autour, bonus de case) d'au moins `minGain`. Bloqué loin de sa cible : il
  // se rapproche par un détour (`detourCostWeight` : poids du chemin face à la distance restante).
  reposition: Object.freeze({ probability: 0.35, minGain: 0.5, detourCostWeight: 0.25 }),

  // Recul : en situation défavorable, un combattant cherche une case plus sûre.
  //   (PV ≤ hpRatio et mort attendue en ≤ survivalTicks tours face aux adversaires au contact)
  //   ou (PV ≤ outnumberedHpRatio et adversaires − alliés dans un rayon `radius` ≥ outnumberedBy)
  // Jamais s'il peut mettre sa cible KO en ≤ finishTicks tours, ni s'il n'a plus d'allié
  // debout (requiresAlly). Case visée : à ≤ maxDistance pas, à ≥ minEnemyDistance cases du
  // premier adversaire, si possible près d'un allié. Le recul dure au plus durationTicks
  // tours, puis cooldownTicks tours sans reculer, et au plus maxPerRound fois par manche.
  retreat: Object.freeze({
    hpRatio: 0.25, survivalTicks: 3, outnumberedHpRatio: 0.45, outnumberedBy: 2, radius: 2,
    finishTicks: 1, requiresAlly: true,
    maxDistance: 3, minEnemyDistance: 2, allyWeight: 0.5, costWeight: 0.1,
    durationTicks: 3, cooldownTicks: 8, maxPerRound: 1,
  }),

  // Souffler (v0.66) : en supériorité numérique, un combattant fatigué (≥ minFatigue) qu'aucun
  // adversaire ne touche, pendant qu'un allié tient le combat, se met hors de portée et récupère
  // au plus `maxTicks` tours ; frappé, il réplique aussitôt. Puis `cooldownTicks` tours sans
  // souffler. Valeurs « à valider ».
  breathe: Object.freeze({ minFatigue: 40, maxTicks: 3, cooldownTicks: 4 }),
});

// Présentation de la manche (rejeu animé ; sans effet sur le résultat).
export const COMBAT_PLAYBACK = Object.freeze({
  // Durée d'un tour à la vitesse ×1 (0,64 s : deux fois plus lent que les 0,32 s d'origine).
  tickSeconds: 0.64,
  // Avant le premier tour : les bonus de chaque combattant sont affichés un court instant.
  introSeconds: 2.6,
  // Un combattant KO s'efface puis disparaît de la lice (il reste dans les résultats).
  koFadeSeconds: 0.8,
  // Caméra rapprochée pendant la manche : elle cadre les combattants encore debout, avec une
  // marge (en cases), un cadrage minimal (pour ne pas zoomer à l'excès sur un dernier duel) et
  // un cadrage maximal centré sur le groupe (pour rester proche même quand ils sont dispersés).
  // `headroom` : marge supplémentaire vers le haut de l'écran (cases), pour la hauteur des
  // sprites, des barres de PV et des pastilles.
  camera: Object.freeze({ padding: 0.8, minWidth: 6, minHeight: 4.5, maxWidth: 10, maxHeight: 7, headroom: 1.8 }),
  speeds: Object.freeze([1, 2, 4]),
  // Temps de réflexion de l'IA avant chaque placement (tirage entre min et max).
  aiPlacementDelayMs: Object.freeze({ min: 1000, max: 2000 }),
});
