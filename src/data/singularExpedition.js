// Expéditions singulières (v1.1) — données uniquement (systems/expeditions/SingularRunService.js).
//
// Le joueur emmène TROIS combattants (ni absents, ni en étude, ni épuisés à 100) et enchaîne dix
// combats en un contre un, une manche gagnante, dans une lice de forêt (data/arenas.js : 'sentier').
// Aucun jour ne passe pendant l'expédition. Avant chaque combat, il choisit qui entre en lice ; la
// fatigue se garde d'un combat à l'autre (les PV, eux, sont pleins à chaque combat). Un combattant
// battu est KO jusqu'à la fin de l'expédition : un autre reprend le MÊME combat, contre le même
// adversaire, qui garde sa fatigue. Les trois KO (ou plus personne en état) : expédition perdue,
// Ferveurs comprises. Abandon possible à tout moment (perdue aussi).
//
// Entre deux combats gagnés, trois propositions (SINGULAR_RULES.choice) : le joueur en garde UNE —
// un bonus temporaire (SINGULAR_BOONS, jusqu'à la fin de l'expédition sauf mention) ou une
// récompense de fin (SINGULAR_REWARDS, donnée seulement en cas de victoire).
// Victoire : les dix combats gagnés avec au moins un combattant debout → récompense de la carte,
// récompenses de fin ; un talent ou du potentiel va à l'un des trois, au choix du joueur.

export const SINGULAR_RULES = Object.freeze({
  squadSize: 3,
  fights: 10,
  arenaId: 'sentier',
  decorationId: 'lice_sentier',
  // Épuisé : ne peut ni partir ni entrer en lice.
  exhaustedFatigue: 100,
  // Propositions entre deux combats : `boons` bonus temporaires et `rewards` récompenses de fin.
  choice: Object.freeze({ boons: 2, rewards: 1 }),
  // Adversaires selon la tranche de coût (data/expeditions.js, costBands) : étoiles du 1er au 9e
  // (montée régulière, par demi-étoile), étoiles et talents du 10e ; à partir du combat
  // `talentFrom`, chance `talentChance` qu'un adversaire ait un talent de combat.
  bands: Object.freeze([
    Object.freeze({ minStars: 2, maxStars: 3.5, bossStars: 3.5, bossTalents: 1, rarities: Object.freeze(['common']), bossRarity: 'rare' }),
    Object.freeze({ minStars: 2.5, maxStars: 4, bossStars: 4, bossTalents: 1, rarities: Object.freeze(['common', 'rare']), bossRarity: 'rare' }),
    Object.freeze({ minStars: 4, maxStars: 5, bossStars: 5, bossTalents: 2, rarities: Object.freeze(['rare', 'epic']), bossRarity: 'epic' }),
  ]),
  talentFrom: 6,
  talentChance: 0.3,
  // Types d'effets admis pour les talents des adversaires (talents de combat, sans saison).
  opponentEffectTypes: Object.freeze(['finalDamage', 'damageTaken', 'aura', 'enemyContact', 'combatStats', 'fatigueThreshold', 'comboHits', 'luckyRoll', 'moveSpeed', 'lastStand', 'fatigueEffort', 'fatigueRecovery', 'fatigueCap']),
  opponentExcludedWhen: Object.freeze(['home', 'away', 'withCaptain']),
});

// Bonus temporaires. target : 'one' (un combattant debout, au choix), 'all' (les trois),
// 'ko' (un combattant KO), 'opponent' (le prochain adversaire). effects : effets de talents
// (data/talents.js) ajoutés en combat ; fights : durée en combats (sinon toute l'expédition) ;
// now : effet immédiat ({ fatigue, revive, opponentFatigue }) ; afterWin : après chaque victoire.
const boon = (id, icon, name, description, target, extra = {}) => Object.freeze({ id, icon, name, description, target, weight: 10, ...extra });

export const SINGULAR_BOONS = Object.freeze([
  boon('pierre-a-aiguiser', '🗡', 'Pierre à aiguiser', '+2 % de dégâts finaux, jusqu’à la fin de l’expédition.', 'one', { effects: [{ type: 'finalDamage', value: 0.02, when: 'always' }] }),
  boon('repos-au-camp', '⛺', 'Repos au camp', '−50 de fatigue, tout de suite.', 'one', { now: { fatigue: -50 } }),
  boon('feu-de-camp', '🔥', 'Feu de camp', '−20 de fatigue pour les trois, tout de suite.', 'all', { now: { fatigue: -20 } }),
  boon('cuirasse-rapiecee', '🛡', 'Cuirasse rapiécée', '−5 % de dégâts reçus.', 'one', { effects: [{ type: 'damageTaken', value: 0.05 }] }),
  boon('bottes-de-chasseur', '🥾', 'Bottes de chasseur', 'Se déplace 10 % plus vite dans la lice.', 'one', { effects: [{ type: 'moveSpeed', value: 0.1 }] }),
  boon('souffle-du-bucheron', '🪓', 'Souffle du bûcheron', 'Rester debout le fatigue 30 % de moins.', 'one', { effects: [{ type: 'fatigueEffort', factor: 0.7 }] }),
  boon('gourde-d-hypocras', '🍷', 'Gourde d’hypocras', '+8 % de dégâts finaux, pour le prochain combat seulement.', 'one', { effects: [{ type: 'finalDamage', value: 0.08, when: 'always' }], fights: 1 }),
  boon('exercice-d-hast', '🔱', 'Exercice d’hast', '+6 % de Force d’arme d’hast (HAS) en combat.', 'one', { effects: [{ type: 'combatStats', value: 0.06, stat: 'polearm', when: 'always' }] }),
  boon('exercice-de-lutte', '🤼', 'Exercice de lutte', '+6 % de Lutte (LUT) en combat.', 'one', { effects: [{ type: 'combatStats', value: 0.06, stat: 'wrestling', when: 'always' }] }),
  boon('exercice-de-percussion', '💥', 'Exercice de percussion', '+6 % de Percussion (PER) en combat.', 'one', { effects: [{ type: 'combatStats', value: 0.06, stat: 'percussion', when: 'always' }] }),
  boon('trefle-de-sous-bois', '🍀', 'Trèfle de sous-bois', 'Premier coup de chaque combat : l’aléa est tiré deux fois, le meilleur est gardé.', 'one', { effects: [{ type: 'luckyRoll' }] }),
  boon('amulette-de-l-ours', '🐻', 'Amulette de l’ours', 'Une fois dans l’expédition, survit à un coup fatal à 1 PV.', 'one', { effects: [{ type: 'lastStand', per: 'match', invulnerableTicks: 0 }], once: true }),
  boon('oeil-du-chasseur', '🎯', 'Œil du chasseur', '+10 % de dégâts finaux contre un adversaire sous 50 % de ses PV.', 'one', { effects: [{ type: 'finalDamage', value: 0.1, when: 'targetHpBelow', threshold: 0.5 }] }),
  boon('coups-en-rafale', '⚡', 'Coups en rafale', 'Un coup de plus dans ses combos.', 'one', { effects: [{ type: 'comboHits', value: 1 }] }),
  boon('benediction-du-druide', '🌿', 'Bénédiction du druide', '−15 de fatigue après chacune de ses victoires.', 'one', { afterWin: { fatigue: -15 } }),
  boon('peau-de-loup', '🐺', 'Peau de loup', 'Ses pénalités de fatigue commencent 10 points plus tard.', 'one', { effects: [{ type: 'fatigueThreshold', value: 10 }] }),
  boon('chant-de-veillee', '🎶', 'Chant de veillée', '+3 % de dégâts finaux pour les trois.', 'all', { effects: [{ type: 'finalDamage', value: 0.03, when: 'always' }] }),
  boon('esquive-du-renard', '🦊', 'Esquive du renard', '5 % de chances d’esquiver chaque coup reçu.', 'one', { effects: [{ type: 'dodgeChance', value: 0.05 }] }),
  boon('fumee-des-pins', '🌫', 'Fumée des pins', 'Le prochain adversaire commence avec +25 de fatigue.', 'opponent', { now: { opponentFatigue: 25 } }),
  boon('remise-sur-pied', '🩹', 'Remise sur pied', 'Un combattant KO revient dans l’expédition, avec 80 de fatigue.', 'ko', { now: { revive: true, fatigue: 80 }, weight: 3, rare: true }),
]);

// Récompenses de fin (victoire seulement). target : 'pick' — l'un des trois, choisi à la victoire.
const reward = (id, icon, name, description, extra = {}) => Object.freeze({ id, icon, name, description, weight: 10, ...extra });

export const SINGULAR_REWARDS = Object.freeze([
  reward('bourse-du-chasseur', '👛', 'Bourse du chasseur', '+500 deniers.', { deniers: 500 }),
  reward('grosse-bourse', '💰', 'Grosse bourse', '+1 000 deniers.', { deniers: 1000, weight: 6 }),
  reward('coffre-de-la-cabane', '🧰', 'Coffre de la cabane', '+1 500 deniers.', { deniers: 1500, weight: 3, rare: true }),
  reward('ferveurs-retrouvees', '🌸', 'Ferveurs retrouvées', '+2 Ferveurs de la Reine.', { ferveurs: 2 }),
  reward('offrande-rendue', '🕯', 'Offrande rendue', 'La moitié du coût en Ferveurs est rendue.', { refund: 0.5 }),
  reward('flamme-nouvelle', '🔥', 'Flamme nouvelle', '+1 potentiel à l’un des trois (3 au plus).', { potential: 1, target: 'pick' }),
  reward('recrue-de-la-foret', '🍺', 'Recrue de la forêt', 'Une recrue offerte à la Taverne (potentiel 1 au moins).', { recruit: { minPotential: 1 } }),
  reward('lecon-du-maitre-d-armes', '📯', 'Leçon du maître d’armes', '+3 dans chaque compétence de combat de l’un des trois.', { skills: 3, target: 'pick' }),
  reward('parchemin-ancien', '📜', 'Parchemin ancien', 'Un talent ordinaire, tiré au hasard, pour l’un des trois.', { talentRarity: 'common', target: 'pick' }),
  reward('cave-du-roi', '🍷', 'Cave du roi', '2 Hypocras dans Le Coffre.', { item: Object.freeze({ id: 'hypocras', quantity: 2 }) }),
]);

export const getSingularBoon = (id) => SINGULAR_BOONS.find((entry) => entry.id === id) ?? null;
export const getSingularReward = (id) => SINGULAR_REWARDS.find((entry) => entry.id === id) ?? null;
