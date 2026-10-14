// Talents des combattants — catalogue centralisé (systems/talents/TalentService.js).
//
// Un talent est une aptitude propre à un combattant du joueur (jamais à un combattant de l'IA).
// Il se révèle à la fin d'une étude au Scriptorium, ou arrive avec une recrue de la Taverne.
// Ajouter un talent = ajouter une entrée dans TALENTS : aucune interface à modifier.
//
//   id           identifiant stable (enregistré dans les sauvegardes : ne jamais le changer)
//   name         nom affiché sur l'étiquette
//   rarity       famille : 'common' (niveau saison 1), 'rare' (saisons 2–3), 'epic' (saison 4)
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
//                  Tout effet peut porter season ('summer' | 'autumn' | 'winter' | 'spring') : il n'est
//                  actif que pendant cette saison de l'année (TalentEffects.isEffectActive).
//   season       talents saisonniers (v0.70) : saison où ils agissent ('all' : toute l'année)
//   sources      d'où il peut venir : 'tavern' (recrue de la Taverne), 'study' (Scriptorium)
//   weight       poids relatif lors d'un tirage parmi les talents d'une même famille

/** Familles de talents : couleur de l'étiquette (fond, texte, bordure). */
export const TALENT_RARITIES = Object.freeze({
  common: Object.freeze({ id: 'common', name: 'Ordinaire', color: '#9fd3f2', text: '#10354d', border: '#4f97c4' }),
  rare: Object.freeze({ id: 'rare', name: 'Rare', color: '#ec8a2c', text: '#2e1604', border: '#a85512' }),
  epic: Object.freeze({ id: 'epic', name: 'Épique', color: '#141416', text: '#f4ecd8', border: '#000000' }),
});

/** Étiquette d'un talent dont la famille n'est pas encore décidée (couleur neutre, parchemin). */
export const TALENT_UNRANKED_STYLE = Object.freeze({ color: '#efe3c4', text: '#3a2a14', border: '#a8874f' });

const BOTH = Object.freeze(['tavern', 'study']);
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
  talent('collecteur', 'Collecteur', 'common', 'Économie', '+1 denier par jour, quelle que soit son activité, même au repos.', [{ type: 'dailyDeniers', value: 1 }]),
  // Saisonniers (v0.70) : actifs seulement pendant leur saison de l'année.
  talent('peau-tannee', 'Peau tannée', 'common', 'Été', 'En été : +5 % de dégâts finaux. La chaleur lui réussit.', [{ type: 'finalDamage', value: 0.05, when: 'always', season: 'summer' }], { season: 'summer' }),
  talent('pas-feutre', 'Pas feutré', 'common', 'Automne', 'En automne : se déplace 10 % plus vite dans la lice, malgré les feuilles mortes.', [{ type: 'moveSpeed', value: 0.1, season: 'autumn' }], { season: 'autumn' }),
  talent('seve-nouvelle', 'Sève nouvelle', 'common', 'Printemps', 'Au printemps : +8 % de réussite quotidienne au Centre, quelle que soit son activité.', [{ type: 'activityChance', value: 0.08, activityId: null, season: 'spring' }], { season: 'spring' }),
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
  // ---------- Épiques (saison 4) ----------
  talent('seigneur-de-guerre', 'Seigneur de guerre', 'epic', 'Aura', '+5 % de dégâts finaux à tous les autres combattants de sa manche, et +5 % pour lui.', [{ type: 'aura', value: 0.05, self: true }]),
  talent('immortel', 'Immortel', 'epic', 'Combat', 'Une fois par manche, il survit à un coup fatal à 1 PV et devient intouchable une seconde.', [{ type: 'lastStand', per: 'round', invulnerableTicks: 2 }]),
  talent('legende-vivante', 'Légende vivante', 'epic', 'Équipe', 'Tant qu’il est dans l’effectif d’un combat, la compagnie gagne 25 % de fatigue en moins pendant les manches.', [{ type: 'squadFatigue', factor: 0.75 }]),
  talent('tresorier-du-roi', 'Trésorier du roi', 'epic', 'Économie', 'Double la recette des victoires à domicile, et +3 deniers par jour pour chaque combattant affecté en Forêt.', [{ type: 'homeRewardMultiplier', value: 2 }, { type: 'foresterDeniers', value: 3 }]),
  talent('elu-des-dieux', 'Élu des dieux', 'epic', 'Carrière', 'Son potentiel ne baisse jamais et peut monter à tout âge ; +10 % de chances à chaque vérification.', [{ type: 'potentialFloor', minAge: Infinity }, { type: 'potentialBoost', value: 0.1, maxAge: null, anyAge: true }]),
  talent('coeur-de-l-hiver', 'Cœur de l’hiver', 'epic', 'Hiver', 'En hiver : +12 % de dégâts finaux pour lui, et +4 % pour tous les autres combattants de sa manche.', [{ type: 'aura', value: 0.04, self: true, season: 'winter' }, { type: 'finalDamage', value: 0.08, when: 'always', season: 'winter' }], { season: 'winter' }),
  talent('maitre-des-saisons', 'Maître des saisons', 'epic', 'Saisons', 'Toute l’année : aucune saison ne le pénalise, +4 % de dégâts finaux et +5 % de réussite quotidienne au Centre.', [{ type: 'seasonImmune' }, { type: 'finalDamage', value: 0.04, when: 'always' }, { type: 'activityChance', value: 0.05, activityId: null }], { season: 'all' }),
]);

export const TALENT_RULES = Object.freeze({
  // Talents par combattant : deux (v0.72). Le premier et le second se révèlent au Scriptorium (études
  // gratuites) ; un combattant qui a ses deux talents peut en remplacer un, au choix (étude payante).
  maxPerFighter: 2,
  // Chance qu'une recrue de la Taverne arrive avec un talent (tirage unique, à sa génération).
  tavernChance: 0.1,
});
