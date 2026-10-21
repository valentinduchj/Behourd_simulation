// Talents des combattants — catalogue centralisé (systems/talents/TalentService.js).
//
// Un talent est une aptitude propre à un combattant du joueur (jamais à un combattant de l'IA).
// Il se révèle à la fin d'une étude au Scriptorium, ou arrive avec une recrue de la Taverne.
// Ajouter un talent = ajouter une entrée dans TALENTS : aucune interface à modifier.
//
//   id           identifiant stable (enregistré dans les sauvegardes : ne jamais le changer)
//   name         nom affiché sur l'étiquette
//   rarity       famille : 'common' (niveau saison 1), 'rare' (saisons 2–3), 'epic' (saison 4),
//                'exotic' (v0.99 : seulement au retour d'une expédition du Baron)
//   domain       domaine affiché (Combat, Forêt, Banquet…)
//   description  texte de survol de l'étiquette (effet exact)
//   effects      [{ type, …paramètres }] — LUS par les systèmes concernés (systems/talents/
//                TalentEffects.js), jamais par les interfaces. Types :
//     finalDamage     { value, when } bonus de dégâts finaux de ses coups, si la condition `when` est
//                     remplie : always | targetEngaged | firstStrike | selfHpBelow (threshold) |
//                     targetHpBelow (threshold) | home | away | vsClass (classId) | withCaptain |
//                     perKnockout (max : bonus par adversaire qu'il a mis KO dans la manche)
//     damageTaken     { value } dégâts reçus en moins (fraction)
//     aura            { value, self } bonus de dégâts finaux de ses alliés de la manche (et lui-même)
//     enemyContact    { value } malus de dégâts finaux des adversaires à son contact
//     guardCaptain    { value } le capitaine aligné avec lui reçoit moins de dégâts
//     combatStats     { value, stat, when } bonus de statistiques de combat (stat : 'all' ou une stat ;
//                     when : always | decisive)
//     fatigueThreshold { value } ses pénalités de fatigue commencent plus tard
//     comboHits       { value } coups supplémentaires dans son combo
//     luckyRoll       {} un coup par manche : l'aléa est tiré deux fois, le meilleur est gardé
//     moveSpeed       { value } déplacement plus rapide (fraction)
//     lastStand       { per: 'match' | 'round', invulnerableTicks } survit à un coup fatal à 1 PV
//     fatigueEffort   { factor } son effort (fatigue d'être debout) pendant la manche est multiplié par `factor`
//     fatigueRecovery { factor } il récupère `factor` fois plus vite (souffle, temps mort, entre deux manches)
//     fatigueCap      { value } sa fatigue ne dépasse jamais cette valeur
//     squadFatigue    { factor } la compagnie gagne `factor` de la fatigue des manches (effectif)
//     activityChance  { value, activityId | null } réussite quotidienne en plus (null : toute activité)
//     activityReward  { value, activityIds } gain en plus à chaque réussite de ces activités
//     allyActivityChance { value } réussite en plus pour les autres combattants de son lieu
//     dailyDeniers    { value } deniers par jour
//     foresterDeniers { value } deniers par jour pour chaque combattant affecté en Forêt (compagnie)
//     homeRewardMultiplier { value } recette des victoires à domicile multipliée (compagnie)
//     homeWinDeniers  { value } deniers en plus par victoire à domicile où il a combattu
//     queenReward     { value } récompense des Combats de la Reine gagnés où il a combattu (fraction)
//     recruitDiscount { value } réduction sur le prix des recrues (compagnie, non cumulable)
//     studyDays       { value } jours d'étude en moins ; studyFactor { value } durée multipliée
//     potentialFloor  { minAge } son potentiel ne baisse pas avant cet âge (Infinity : jamais)
//     potentialBoost  { value, maxAge | null, anyAge } chances de hausse en plus à chaque vérification
//     skillCapSteps   { value } plafond des compétences de N crans plus haut
//     seasonImmune    {} la pénalité saisonnière de sa classe ne s'applique pas à lui (data/climate.js)
//   Expéditions du Baron (v1.0) :
//     expeditionDays  { value } ses expéditions durent N jours de moins
//     expeditionDiscount { value } les expéditions coûtent N Ferveurs de moins (compagnie, non cumulable ; 1 au moins)
//     expeditionTraining { value } à son retour d'expédition, +N dans chaque compétence de combat (plafond)
//     expeditionBonusReward {} son expédition rapporte une seconde récompense de la même tranche (jamais un talent)
//     queenFerveur    { value } Ferveurs en plus par Combat de la Reine gagné où il a combattu (non cumulable)
//   v1.2 :
//     awayWinDeniers  { value } deniers en plus par victoire de championnat à l'extérieur où il a combattu
//     upgradeDiscount { value } réduction sur le prix des améliorations du Bourg (compagnie, non cumulable)
//     sorenessFactor  { factor } ses courbatures de fin de combat sont multipliées par `factor`
//     finalDamage peut porter when: 'queen' (pendant un Combat de la Reine) ; potentialBoost, minAge
//                  Un effet peut porter afterJourney (jours) : actif seulement pendant les N jours qui
//                  suivent son retour d'expédition (TalentEffects.isEffectActive, contexte daysSinceReturn).
//   Exotiques (v0.99, expéditions du Baron seulement) :
//     fatigueIgnore   { when: 'selfHpBelow', threshold } ses pénalités de fatigue ne comptent pas
//     allyHeal        { value, threshold, per: 'round' } soigne un allié tombé sous `threshold` de ses PV
//     preferWounded   { value } choisit de préférence l'adversaire le plus blessé (poids du choix)
//     auraGuard       { value } dégâts reçus en moins pour tous les combattants de sa manche (lui compris)
//     dodgeChance     { value } chance d'esquiver chaque coup reçu
//     finalDamage / damageTaken peuvent porter when: 'lastStanding' (dernier debout de son camp)
//                  Tout effet peut porter season ('summer' | 'autumn' | 'winter' | 'spring') : il n'est
//                  actif que pendant cette saison de l'année (TalentEffects.isEffectActive).
//   season       talents saisonniers (v0.70) : saison où ils agissent ('all' : toute l'année)
//   sources      d'où il peut venir : 'tavern' (recrue de la Taverne), 'study' (Scriptorium),
//                'expedition' (expéditions du Baron : les exotiques n'ont que celle-ci)
//   weight       poids relatif lors d'un tirage parmi les talents d'une même famille

/** Familles de talents : couleur de l'étiquette (fond, texte, bordure). */
export const TALENT_RARITIES = Object.freeze({
  common: Object.freeze({ id: 'common', name: 'Ordinaire', color: '#9fd3f2', text: '#10354d', border: '#4f97c4' }),
  rare: Object.freeze({ id: 'rare', name: 'Rare', color: '#ec8a2c', text: '#2e1604', border: '#a85512' }),
  epic: Object.freeze({ id: 'epic', name: 'Épique', color: '#141416', text: '#f4ecd8', border: '#000000' }),
  exotic: Object.freeze({ id: 'exotic', name: 'Exotique', color: '#2f8a3e', text: '#f4f8ee', border: '#1b5a27' }),
});

// v1.2 : quatre couleurs d'étiquettes seulement — une par famille (plus de style « non classé »).

const BOTH = Object.freeze(['tavern', 'study']);
const EXPEDITION = Object.freeze(['expedition']);
const talent = (id, name, rarity, domain, description, effects, extra = {}) => Object.freeze({
  id, name, rarity, domain, description, effects: Object.freeze(effects.map((e) => Object.freeze(e))), sources: BOTH, weight: 1, ...extra,
});

export const TALENTS = Object.freeze([
  // ---------- Ordinaires (saison 1) ----------
  talent('fourbe', 'Fourbe', 'common', 'Combat', '+5 % de dégâts finaux contre un adversaire déjà aux prises avec un autre combattant : il frappe dans le dos.', [{ type: 'finalDamage', value: 0.05, when: 'targetEngaged' }]),
  talent('bucheron', 'Bûcheron', 'common', 'Forêt', '+2 deniers par journée réussie en Forêt.', [{ type: 'activityReward', value: 2, activityIds: ['forest'] }]),
  talent('glouton', 'Glouton', 'common', 'Banquet', 'Récupère 5 points de fatigue de plus par repas réussi au Banquet.', [{ type: 'activityReward', value: 5, activityIds: ['banquet'] }]),
  talent('leve-tot', 'Lève-tôt', 'common', 'Centre', '+5 % de réussite quotidienne, quelle que soit son activité.', [{ type: 'activityChance', value: 0.05, activityId: null }]),
  talent('nageur', 'Nageur', 'common', 'Rivière', '+8 % de réussite à la Rivière.', [{ type: 'activityChance', value: 0.08, activityId: 'river' }]),
  talent('bagarreur', 'Bagarreur', 'common', 'Petite lice', '+8 % de réussite à la Petite lice.', [{ type: 'activityChance', value: 0.08, activityId: 'lice' }]),
  talent('cogneur', 'Cogneur', 'common', 'Mannequins', '+8 % de réussite aux Mannequins.', [{ type: 'activityChance', value: 0.08, activityId: 'dummies' }]),
  talent('taureau', 'Taureau', 'common', 'Tas de foin', '+8 % de réussite aux Tas de foin.', [{ type: 'activityChance', value: 0.08, activityId: 'hay' }]),
  talent('cuir-epais', 'Cuir épais', 'common', 'Combat', '−4 % de dégâts reçus.', [{ type: 'damageTaken', value: 0.04 }]),
  talent('souffle-long', 'Souffle long', 'common', 'Fatigue', 'L’effort de rester debout le fatigue 20 % moins pendant les manches.', [{ type: 'fatigueEffort', factor: 0.8 }]),
  talent('sang-froid', 'Sang-froid', 'common', 'Combat', 'Ses pénalités de fatigue commencent 10 points plus tard.', [{ type: 'fatigueThreshold', value: 10 }]),
  talent('premier-sang', 'Premier sang', 'common', 'Combat', '+6 % de dégâts finaux sur son tout premier coup de la manche.', [{ type: 'finalDamage', value: 0.06, when: 'firstStrike' }]),
  talent('hargneux', 'Hargneux', 'common', 'Combat', '+4 % de dégâts finaux quand il lui reste moins de 50 % de ses PV.', [{ type: 'finalDamage', value: 0.04, when: 'selfHpBelow', threshold: 0.5 }]),
  talent('enfant-du-pays', 'Enfant du pays', 'common', 'Domicile', '+4 % de dégâts finaux à domicile.', [{ type: 'finalDamage', value: 0.04, when: 'home' }]),
  talent('voyageur', 'Voyageur', 'common', 'Extérieur', '+4 % de dégâts finaux à l’extérieur.', [{ type: 'finalDamage', value: 0.04, when: 'away' }]),
  talent('courtisan', 'Courtisan', 'common', 'Reine', '+5 % sur la récompense d’un Combat de la Reine gagné où il a combattu.', [{ type: 'queenReward', value: 0.05 }]),
  talent('marchandeur', 'Marchandeur', 'common', 'Taverne', '−5 % sur le prix des recrues tant qu’il est dans la compagnie (non cumulable).', [{ type: 'recruitDiscount', value: 0.05 }]),
  talent('studieux', 'Studieux', 'common', 'Scriptorium', 'Ses études durent 2 jours de moins.', [{ type: 'studyDays', value: 2 }]),
  talent('bon-vivant', 'Bon vivant', 'common', 'Fatigue', 'Sa fatigue ne dépasse jamais 90.', [{ type: 'fatigueCap', value: 90 }]),
  talent('opiniatre', 'Opiniâtre', 'common', 'Combat', '+3 % sur toutes ses statistiques de combat lors d’une manche décisive (1–1).', [{ type: 'combatStats', value: 0.03, stat: 'all', when: 'decisive' }]),
  talent('briseur-de-garde', 'Briseur de garde', 'common', 'Combat', '+5 % de dégâts finaux contre un Lutteur.', [{ type: 'finalDamage', value: 0.05, when: 'vsClass', classId: 'lutteur' }]),
  talent('chasseur-de-lances', 'Chasseur de lances', 'common', 'Combat', '+5 % de dégâts finaux contre un Hastier.', [{ type: 'finalDamage', value: 0.05, when: 'vsClass', classId: 'hastier' }]),
  talent('rattrapeur', 'Rattrapeur', 'common', 'Combat', '+5 % de dégâts finaux contre un Runner.', [{ type: 'finalDamage', value: 0.05, when: 'vsClass', classId: 'runner' }]),
  // (Le potentiel ne baisse qu'à partir de 32 ans : le Vieux loup le garde jusqu'à 35 ans.)
  talent('vieux-loup', 'Vieux loup', 'common', 'Carrière', 'Son potentiel ne baisse jamais avant 35 ans (au lieu de 32).', [{ type: 'potentialFloor', minAge: 35 }]),
  talent('precoce', 'Précoce', 'common', 'Carrière', 'Avant 22 ans, ses vérifications de potentiel ont +5 % de chances de hausse.', [{ type: 'potentialBoost', value: 0.05, maxAge: 21, anyAge: false }]),
  talent('combinard', 'Combinard', 'common', 'Combat', 'Son combo peut aller jusqu’à un coup de plus.', [{ type: 'comboHits', value: 1 }]),
  talent('endurant', 'Endurant', 'common', 'Combat', '+5 % d’Endurance en combat.', [{ type: 'combatStats', value: 0.05, stat: 'endurance', when: 'always' }]),
  talent('infatigable-marcheur', 'Infatigable marcheur', 'common', 'Combat', 'Se déplace 10 % plus vite dans la lice.', [{ type: 'moveSpeed', value: 0.1 }]),
  talent('chanceux', 'Chanceux', 'common', 'Combat', 'Sur son premier coup de chaque manche, l’aléa est tiré deux fois : le meilleur est gardé.', [{ type: 'luckyRoll' }]),
  talent('fidele', 'Fidèle', 'common', 'Moral', '+3 % de dégâts finaux s’il combat aux côtés du capitaine.', [{ type: 'finalDamage', value: 0.03, when: 'withCaptain' }]),
  talent('garde-du-corps', 'Garde du corps', 'common', 'Combat', 'Le capitaine aligné avec lui reçoit −5 % de dégâts.', [{ type: 'guardCaptain', value: 0.05 }]),
  talent('ecuyer', 'Écuyer', 'common', 'Centre', 'Les autres combattants affectés au même lieu que lui gagnent +3 % de réussite.', [{ type: 'allyActivityChance', value: 0.03 }]),
  talent('collecteur', 'Collecteur', 'common', 'Économie', '+1 denier par jour, quelle que soit son activité, même sans activité.', [{ type: 'dailyDeniers', value: 1 }]),
  // Saisonniers (v0.70) : actifs seulement pendant leur saison de l'année.
  talent('peau-tannee', 'Peau tannée', 'common', 'Été', 'En été : +5 % de dégâts finaux. La chaleur lui réussit.', [{ type: 'finalDamage', value: 0.05, when: 'always', season: 'summer' }], { season: 'summer' }),
  talent('pas-feutre', 'Pas feutré', 'common', 'Automne', 'En automne : se déplace 10 % plus vite dans la lice, malgré les feuilles mortes.', [{ type: 'moveSpeed', value: 0.1, season: 'autumn' }], { season: 'autumn' }),
  talent('seve-nouvelle', 'Sève nouvelle', 'common', 'Printemps', 'Au printemps : +8 % de réussite quotidienne au Centre, quelle que soit son activité.', [{ type: 'activityChance', value: 0.08, activityId: null, season: 'spring' }], { season: 'spring' }),
  // Expéditions du Baron (v1.0).
  talent('marcheur', 'Marcheur', 'common', 'Expédition', 'Ses expéditions durent 4 jours de moins.', [{ type: 'expeditionDays', value: 4 }]),
  talent('retour-du-pelerin', 'Retour du pèlerin', 'common', 'Expédition', 'Pendant les 10 jours qui suivent son retour d’expédition : +6 % de dégâts finaux.', [{ type: 'finalDamage', value: 0.06, when: 'always', afterJourney: 10 }]),
  talent('devot', 'Dévot', 'common', 'Reine', '+1 Ferveur de la Reine par Combat de la Reine gagné où il a combattu (une seule par combat, même avec plusieurs Dévots).', [{ type: 'queenFerveur', value: 1 }]),
  // v1.2 : 21 ordinaires de plus (60) — souvent le premier cran d'une échelle ordinaire → rare → épique.
  talent('poigne-de-fer', 'Poigne de fer', 'common', 'Combat', '+5 % de Lutte en combat.', [{ type: 'combatStats', value: 0.05, stat: 'wrestling', when: 'always' }]),
  talent('bras-long', 'Bras long', 'common', 'Combat', '+5 % de Force d’arme d’hast en combat.', [{ type: 'combatStats', value: 0.05, stat: 'polearm', when: 'always' }]),
  talent('main-lourde', 'Main lourde', 'common', 'Combat', '+5 % de Percussion en combat.', [{ type: 'combatStats', value: 0.05, stat: 'percussion', when: 'always' }]),
  talent('acheveur', 'Achèveur', 'common', 'Combat', '+5 % de dégâts finaux contre un adversaire sous 30 % de ses PV.', [{ type: 'finalDamage', value: 0.05, when: 'targetHpBelow', threshold: 0.3 }]),
  talent('esquiveur', 'Esquiveur', 'common', 'Combat', '4 % de chances d’esquiver chaque coup reçu : il ne subit alors aucun dégât.', [{ type: 'dodgeChance', value: 0.04 }]),
  talent('dernier-carre', 'Dernier carré', 'common', 'Combat', 'Dernier debout de sa compagnie dans la manche : +8 % de dégâts finaux.', [{ type: 'finalDamage', value: 0.08, when: 'lastStanding' }]),
  talent('coriace', 'Coriace', 'common', 'Combat', 'Sous 30 % de ses PV : −6 % de dégâts reçus.', [{ type: 'damageTaken', value: 0.06, when: 'selfHpBelow', threshold: 0.3 }]),
  talent('geneur', 'Gêneur', 'common', 'Combat', 'Les adversaires à son contact perdent 2 % de dégâts finaux.', [{ type: 'enemyContact', value: 0.02 }]),
  talent('ivre-de-victoire', 'Ivre de victoire', 'common', 'Combat', 'Chaque adversaire qu’il met KO lui donne +2 % de dégâts finaux pour le reste de la manche (3 fois au plus).', [{ type: 'finalDamage', value: 0.02, when: 'perKnockout', max: 3 }]),
  talent('tambour', 'Tambour', 'common', 'Aura', '+2 % de dégâts finaux pour tous les combattants de sa manche (lui compris).', [{ type: 'aura', value: 0.02, self: true }]),
  talent('bonne-haleine', 'Bonne haleine', 'common', 'Fatigue', 'Récupère 30 % plus vite : quand il souffle, au sol, pendant un temps mort et entre deux manches.', [{ type: 'fatigueRecovery', factor: 1.3 }]),
  talent('endurci', 'Endurci', 'common', 'Fatigue', 'Ses courbatures du lendemain de combat sont réduites de 30 %.', [{ type: 'sorenessFactor', factor: 0.7 }]),
  talent('pisteur', 'Pisteur', 'common', 'Forêt', '+8 % de réussite en Forêt.', [{ type: 'activityChance', value: 0.08, activityId: 'forest' }]),
  talent('queteur', 'Quêteur', 'common', 'Économie', '+5 deniers par victoire de championnat à l’extérieur où il a combattu.', [{ type: 'awayWinDeniers', value: 5 }]),
  talent('econome', 'Économe', 'common', 'Économie', '−5 % sur le prix des améliorations du Bourg tant qu’il est dans la compagnie (non cumulable).', [{ type: 'upgradeDiscount', value: 0.05 }]),
  talent('gars-du-coin', 'Gars du coin', 'common', 'Domicile', '+4 deniers par victoire à domicile où il a combattu.', [{ type: 'homeWinDeniers', value: 4 }]),
  talent('ecuyer-de-la-reine', 'Écuyer de la Reine', 'common', 'Reine', '+4 % de dégâts finaux pendant les Combats de la Reine.', [{ type: 'finalDamage', value: 0.04, when: 'queen' }]),
  // (Le potentiel ne monte plus après 31 ans : Tardif agit de 28 à 31 ans.)
  talent('tardif', 'Tardif', 'common', 'Carrière', 'De 28 à 31 ans, ses vérifications de potentiel ont +5 % de chances de hausse.', [{ type: 'potentialBoost', value: 0.05, minAge: 28, maxAge: 31, anyAge: false }]),
  talent('fourrure', 'Fourrure', 'common', 'Hiver', 'En hiver : −4 % de dégâts reçus. Le froid ne le traverse pas.', [{ type: 'damageTaken', value: 0.04, season: 'winter' }], { season: 'winter' }),
  talent('bourgeon', 'Bourgeon', 'common', 'Printemps', 'Au printemps : +4 % de dégâts finaux.', [{ type: 'finalDamage', value: 0.04, when: 'always', season: 'spring' }], { season: 'spring' }),
  talent('porteur', 'Porteur', 'common', 'Expédition', 'À son retour d’expédition : +1 dans chaque compétence de combat (HAS, LUT, PER, END), dans la limite de son plafond.', [{ type: 'expeditionTraining', value: 1 }]),
  // ---------- Rares (saisons 2–3) ----------
  talent('maitre-forestier', 'Maître forestier', 'rare', 'Forêt', '+5 deniers par réussite en Forêt et +10 % de réussite.', [{ type: 'activityReward', value: 5, activityIds: ['forest'] }, { type: 'activityChance', value: 0.1, activityId: 'forest' }]),
  talent('porte-etendard', 'Porte-étendard', 'rare', 'Aura', '+3 % de dégâts finaux pour tous les combattants de sa manche (lui compris).', [{ type: 'aura', value: 0.03, self: true }]),
  talent('inebranlable', 'Inébranlable', 'rare', 'Combat', 'Une fois par combat, un coup qui devait le mettre KO le laisse à 1 PV.', [{ type: 'lastStand', per: 'match', invulnerableTicks: 0 }]),
  talent('second-souffle', 'Second souffle', 'rare', 'Fatigue', 'Récupère deux fois plus vite : quand il souffle, au sol, pendant un temps mort et entre deux manches.', [{ type: 'fatigueRecovery', factor: 2 }]),
  talent('bourreau', 'Bourreau', 'rare', 'Combat', '+10 % de dégâts finaux contre un adversaire sous 30 % de ses PV.', [{ type: 'finalDamage', value: 0.1, when: 'targetHpBelow', threshold: 0.3 }]),
  talent('tacticien', 'Tacticien', 'rare', 'Combat', 'Les adversaires à son contact perdent 5 % de dégâts finaux.', [{ type: 'enemyContact', value: 0.05 }]),
  talent('maitre-d-armes', 'Maître d’armes', 'rare', 'Centre', '+1 point gagné à chaque réussite à la Petite lice, aux Mannequins et aux Tas de foin.', [{ type: 'activityReward', value: 1, activityIds: ['lice', 'dummies', 'hay'] }]),
  talent('prodige', 'Prodige', 'rare', 'Carrière', 'Le plafond de ses compétences monte d’un cran, comme s’il avait une flamme de potentiel de plus.', [{ type: 'skillCapSteps', value: 1 }]),
  talent('champion-de-la-reine', 'Champion de la Reine', 'rare', 'Reine', '+25 % sur la récompense des Combats de la Reine gagnés où il a combattu.', [{ type: 'queenReward', value: 0.25 }]),
  talent('heros-local', 'Héros local', 'rare', 'Domicile', '+10 deniers par victoire à domicile où il a combattu.', [{ type: 'homeWinDeniers', value: 10 }]),
  talent('chasseur-de-tetes', 'Chasseur de têtes', 'rare', 'Combat', 'Chaque adversaire qu’il met KO lui donne +5 % de dégâts finaux pour le reste de la manche (3 fois au plus).', [{ type: 'finalDamage', value: 0.05, when: 'perKnockout', max: 3 }]),
  talent('erudit', 'Érudit', 'rare', 'Scriptorium', 'Ses études durent moitié moins longtemps.', [{ type: 'studyFactor', value: 0.5 }]),
  talent('fils-du-soleil', 'Fils du soleil', 'rare', 'Été', 'En été : la chaleur ne le pénalise pas (un Hastier garde toute son efficacité) et +5 % de Force d’arme d’hast en combat.', [{ type: 'seasonImmune', season: 'summer' }, { type: 'combatStats', value: 0.05, stat: 'polearm', when: 'always', season: 'summer' }], { season: 'summer' }),
  talent('coureur-des-brumes', 'Coureur des brumes', 'rare', 'Automne', 'En automne : les terrains humides ne le pénalisent pas (un Runner garde toute son efficacité) et +5 % de dégâts finaux.', [{ type: 'seasonImmune', season: 'autumn' }, { type: 'finalDamage', value: 0.05, when: 'always', season: 'autumn' }], { season: 'autumn' }),
  talent('sang-chaud', 'Sang chaud', 'rare', 'Hiver', 'En hiver : +10 % d’Endurance en combat et −5 % de dégâts reçus.', [{ type: 'combatStats', value: 0.1, stat: 'endurance', when: 'always', season: 'winter' }, { type: 'damageTaken', value: 0.05, season: 'winter' }], { season: 'winter' }),
  talent('eclaireur', 'Éclaireur', 'rare', 'Expédition', 'Tant qu’il est dans la compagnie, les expéditions coûtent 1 Ferveur de moins (1 au moins). Non cumulable.', [{ type: 'expeditionDiscount', value: 1 }]),
  talent('voyageur-aguerri', 'Voyageur aguerri', 'rare', 'Expédition', 'À son retour d’expédition : +2 dans chaque compétence de combat (HAS, LUT, PER, END), dans la limite de son plafond.', [{ type: 'expeditionTraining', value: 2 }]),
  // v1.2 : 13 rares de plus (30).
  talent('briseur-de-bouclier', 'Briseur de bouclier', 'rare', 'Combat', '+8 % de dégâts finaux contre un Lutteur.', [{ type: 'finalDamage', value: 0.08, when: 'vsClass', classId: 'lutteur' }]),
  talent('brise-hampe', 'Brise-hampe', 'rare', 'Combat', '+8 % de dégâts finaux contre un Hastier.', [{ type: 'finalDamage', value: 0.08, when: 'vsClass', classId: 'hastier' }]),
  talent('coupe-jarret', 'Coupe-jarret', 'rare', 'Combat', '+8 % de dégâts finaux contre un Runner.', [{ type: 'finalDamage', value: 0.08, when: 'vsClass', classId: 'runner' }]),
  talent('etau', 'Étau', 'rare', 'Combat', '+10 % de Lutte en combat.', [{ type: 'combatStats', value: 0.1, stat: 'wrestling', when: 'always' }]),
  talent('allonge', 'Allonge', 'rare', 'Combat', '+10 % de Force d’arme d’hast en combat.', [{ type: 'combatStats', value: 0.1, stat: 'polearm', when: 'always' }]),
  talent('marteau', 'Marteau', 'rare', 'Combat', '+10 % de Percussion en combat.', [{ type: 'combatStats', value: 0.1, stat: 'percussion', when: 'always' }]),
  talent('roc', 'Roc', 'rare', 'Combat', '+10 % d’Endurance en combat.', [{ type: 'combatStats', value: 0.1, stat: 'endurance', when: 'always' }]),
  talent('insaisissable', 'Insaisissable', 'rare', 'Combat', '8 % de chances d’esquiver chaque coup reçu : il ne subit alors aucun dégât.', [{ type: 'dodgeChance', value: 0.08 }]),
  talent('loyal', 'Loyal', 'rare', 'Moral', '+6 % de dégâts finaux s’il combat aux côtés du capitaine.', [{ type: 'finalDamage', value: 0.06, when: 'withCaptain' }]),
  talent('increvable', 'Increvable', 'rare', 'Fatigue', 'Ses courbatures du lendemain de combat sont réduites de moitié.', [{ type: 'sorenessFactor', factor: 0.5 }]),
  talent('fierte-du-pays', 'Fierté du pays', 'rare', 'Domicile', '+8 % de dégâts finaux à domicile.', [{ type: 'finalDamage', value: 0.08, when: 'home' }]),
  talent('globe-trotter', 'Globe-trotter', 'rare', 'Extérieur', '+8 % de dégâts finaux à l’extérieur.', [{ type: 'finalDamage', value: 0.08, when: 'away' }]),
  talent('negociant', 'Négociant', 'rare', 'Taverne', '−10 % sur le prix des recrues tant qu’il est dans la compagnie (non cumulable).', [{ type: 'recruitDiscount', value: 0.1 }]),
  // ---------- Épiques (saison 4) ----------
  talent('seigneur-de-guerre', 'Seigneur de guerre', 'epic', 'Aura', '+5 % de dégâts finaux à tous les autres combattants de sa manche, et +5 % pour lui.', [{ type: 'aura', value: 0.05, self: true }]),
  talent('immortel', 'Immortel', 'epic', 'Combat', 'Une fois par manche, il survit à un coup fatal à 1 PV et devient intouchable une seconde.', [{ type: 'lastStand', per: 'round', invulnerableTicks: 2 }]),
  talent('legende-vivante', 'Légende vivante', 'epic', 'Équipe', 'Tant qu’il est dans l’effectif d’un combat, la compagnie gagne 25 % de fatigue en moins pendant les manches.', [{ type: 'squadFatigue', factor: 0.75 }]),
  talent('tresorier-du-roi', 'Trésorier du roi', 'epic', 'Économie', 'Double la recette des victoires à domicile, et +3 deniers par jour pour chaque combattant affecté en Forêt.', [{ type: 'homeRewardMultiplier', value: 2 }, { type: 'foresterDeniers', value: 3 }]),
  talent('elu-des-dieux', 'Élu des dieux', 'epic', 'Carrière', 'Son potentiel ne baisse jamais et peut monter à tout âge ; +10 % de chances à chaque vérification.', [{ type: 'potentialFloor', minAge: Infinity }, { type: 'potentialBoost', value: 0.1, maxAge: null, anyAge: true }]),
  talent('coeur-de-l-hiver', 'Cœur de l’hiver', 'epic', 'Hiver', 'En hiver : +12 % de dégâts finaux pour lui, et +4 % pour tous les autres combattants de sa manche.', [{ type: 'aura', value: 0.04, self: true, season: 'winter' }, { type: 'finalDamage', value: 0.08, when: 'always', season: 'winter' }], { season: 'winter' }),
  talent('compagnon-du-capitaine', 'Compagnon du Baron', 'epic', 'Expédition', 'Son expédition rapporte une seconde récompense, tirée dans la même tranche : deniers, potentiel ou recrue — jamais un second talent.', [{ type: 'expeditionBonusReward' }]),
  // v1.2 : 7 épiques de plus (15).
  talent('briseur-de-reve', 'Briseur de rêve', 'epic', 'Combat', '+12 % de dégâts finaux contre un Lutteur.', [{ type: 'finalDamage', value: 0.12, when: 'vsClass', classId: 'lutteur' }]),
  talent('fleau-des-lances', 'Fléau des lances', 'epic', 'Combat', '+12 % de dégâts finaux contre un Hastier.', [{ type: 'finalDamage', value: 0.12, when: 'vsClass', classId: 'hastier' }]),
  talent('faucheur-de-coureurs', 'Faucheur de coureurs', 'epic', 'Combat', '+12 % de dégâts finaux contre un Runner.', [{ type: 'finalDamage', value: 0.12, when: 'vsClass', classId: 'runner' }]),
  talent('titan', 'Titan', 'epic', 'Combat', '+10 % sur toutes ses statistiques de combat.', [{ type: 'combatStats', value: 0.1, stat: 'all', when: 'always' }]),
  talent('frere-d-armes', 'Frère d’armes', 'epic', 'Moral', '+10 % de dégâts finaux s’il combat aux côtés du capitaine, et le capitaine aligné avec lui reçoit −5 % de dégâts.', [{ type: 'finalDamage', value: 0.1, when: 'withCaptain' }, { type: 'guardCaptain', value: 0.05 }]),
  talent('chevalier-de-la-reine', 'Chevalier de la Reine', 'epic', 'Reine', '+50 % sur la récompense des Combats de la Reine gagnés où il a combattu, et +1 Ferveur de la Reine (une seule par combat, même avec un Dévot).', [{ type: 'queenReward', value: 0.5 }, { type: 'queenFerveur', value: 1 }]),
  talent('sage', 'Sage', 'epic', 'Scriptorium', 'Ses études durent quatre fois moins longtemps.', [{ type: 'studyFactor', value: 0.25 }]),
  talent('maitre-des-saisons', 'Maître des saisons', 'epic', 'Saisons', 'Toute l’année : aucune saison ne le pénalise, +4 % de dégâts finaux et +5 % de réussite quotidienne au Centre.', [{ type: 'seasonImmune' }, { type: 'finalDamage', value: 0.04, when: 'always' }, { type: 'activityChance', value: 0.05, activityId: null }], { season: 'all' }),
  // ---------- Exotiques (v0.99 : expéditions du Baron seulement) ----------
  talent('fureur-du-nord', 'Fureur du Nord', 'exotic', 'Combat', 'Sous 50 % de ses PV : +20 % de dégâts finaux, et la fatigue ne le pénalise plus.', [{ type: 'finalDamage', value: 0.2, when: 'selfHpBelow', threshold: 0.5 }, { type: 'fatigueIgnore', when: 'selfHpBelow', threshold: 0.5 }], { sources: EXPEDITION }),
  talent('ascete-des-meteores', 'Ascète des Météores', 'exotic', 'Fatigue', 'Rester debout ne le fatigue pas pendant les manches, et ses pénalités de fatigue ne commencent qu’à 90.', [{ type: 'fatigueEffort', factor: 0 }, { type: 'fatigueThreshold', value: 40 }], { sources: EXPEDITION }),
  talent('druide-de-broceliande', 'Druide de Brocéliande', 'exotic', 'Soin', 'Une fois par manche, soigne de 40 PV un allié qui tombe sous 25 % de ses PV.', [{ type: 'allyHeal', value: 40, threshold: 0.25, per: 'round' }], { sources: EXPEDITION }),
  talent('ours-de-bialowieza', 'Ours de Białowieża', 'exotic', 'Combat', '−15 % de dégâts reçus et +10 % d’Endurance en combat.', [{ type: 'damageTaken', value: 0.15 }, { type: 'combatStats', value: 0.1, stat: 'endurance', when: 'always' }], { sources: EXPEDITION }),
  talent('lame-d-avalon', 'Lame d’Avalon', 'exotic', 'Combat', 'Son premier coup de chaque manche : +40 % de dégâts finaux, et l’aléa est tiré deux fois (le meilleur est gardé).', [{ type: 'finalDamage', value: 0.4, when: 'firstStrike' }, { type: 'luckyRoll' }], { sources: EXPEDITION }),
  talent('oeil-de-skellig', 'Œil de Skellig', 'exotic', 'Combat', 'Vise de préférence l’adversaire le plus blessé, et +12 % de dégâts finaux contre un adversaire sous 50 % de ses PV.', [{ type: 'preferWounded', value: 6 }, { type: 'finalDamage', value: 0.12, when: 'targetHpBelow', threshold: 0.5 }], { sources: EXPEDITION }),
  talent('avalanche', 'Avalanche', 'exotic', 'Combat', 'Deux coups de plus dans ses combos, et se déplace 15 % plus vite dans la lice.', [{ type: 'comboHits', value: 2 }, { type: 'moveSpeed', value: 0.15 }], { sources: EXPEDITION }),
  talent('dernier-rempart', 'Dernier rempart', 'exotic', 'Combat', 'Dernier debout de sa compagnie dans la manche : +30 % de dégâts finaux et −20 % de dégâts reçus.', [{ type: 'finalDamage', value: 0.3, when: 'lastStanding' }, { type: 'damageTaken', value: 0.2, when: 'lastStanding' }], { sources: EXPEDITION }),
  talent('echo-des-cimes', 'Écho des cimes', 'exotic', 'Aura', '+7 % de dégâts finaux et −5 % de dégâts reçus pour tous les combattants de sa manche (lui compris).', [{ type: 'aura', value: 0.07, self: true }, { type: 'auraGuard', value: 0.05 }], { sources: EXPEDITION }),
  talent('feu-follet', 'Feu follet', 'exotic', 'Combat', '15 % de chances d’esquiver chaque coup reçu : il ne subit alors aucun dégât.', [{ type: 'dodgeChance', value: 0.15 }], { sources: EXPEDITION }),
]);

export const TALENT_RULES = Object.freeze({
  // Talents par combattant : deux (v0.72). Le premier et le second se révèlent au Scriptorium (études
  // gratuites) ; un combattant qui a ses deux talents peut en remplacer un, au choix (étude payante).
  maxPerFighter: 2,
  // Chance qu'une recrue de la Taverne arrive avec un talent (tirage unique, à sa génération).
  tavernChance: 0.1,
});
