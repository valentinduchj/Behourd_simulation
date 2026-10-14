// Patch Notes — historique des évolutions, affiché depuis l'écran principal.
//
// Ajouter une version = ajouter une entrée ici (l'ordre est libre : l'affichage trie de la plus
// récente à la plus ancienne). Aucun code d'interface à modifier.
//
//   { version: 'x.y.z', date: 'AAAA-MM-JJ' | null, title?, <rubrique>: [texte, …] }
//
// Rubriques (PATCH_NOTE_SECTIONS, dans l'ordre d'affichage) : une rubrique vide ou absente
// n'est pas affichée. Les versions antérieures à PATCH_NOTES_MIN_VERSION ne sont jamais
// affichées, même si elles figurent ici (systems/patchNotes/PatchNoteService.js).

export const PATCH_NOTES_MIN_VERSION = '0.42.0';

export const PATCH_NOTE_SECTIONS = Object.freeze([
  Object.freeze({ key: 'newFeatures', label: 'Nouvelles fonctionnalités', icon: '✦' }),
  Object.freeze({ key: 'improvements', label: 'Améliorations', icon: '▲' }),
  Object.freeze({ key: 'gameplayChanges', label: 'Modifications de gameplay', icon: '⚔' }),
  Object.freeze({ key: 'balanceChanges', label: 'Équilibrage', icon: '⚖' }),
  Object.freeze({ key: 'graphics', label: 'Évolutions graphiques', icon: '🎨' }),
  Object.freeze({ key: 'fixes', label: 'Corrections', icon: '🔧' }),
]);

export const PATCH_NOTES = Object.freeze([
  {
    version: '0.75.0',
    date: '2026-10-14',
    title: 'Une fatigue qui compte',
    improvements: [
      'Courbatures : après chaque combat, vos combattants prennent +15 de fatigue par manche disputée, +10 s’ils ont été mis KO.',
      'Trois états : Reposé, Fatigué (dès 50 : coups plus faibles, entraînements deux fois moins réussis) et Épuisé (dès 70 : il ne va plus qu’au Banquet).',
      'Un combattant épuisé est envoyé d’office au Banquet ; la colonne Fatigue du Centre se colore, et la fin de combat montre les courbatures de chacun.',
    ],
  },
  {
    version: '0.74.1',
    date: '2026-10-14',
    title: 'De vrais sons',
    improvements: [
      'Ambiances et effets sonores refaits avec de vrais enregistrements libres de droits : feu de camp et forêt au Centre, marché du Bourg, conversations et âtre de la Taverne, pages tournées au Scriptorium, mannequins frappés à la lice d’entraînement, foule et applaudissements dans la Lice.',
      'Coups sur l’armure, KO, fanfare de victoire médiévale et cloche des exploits — chaque son a plusieurs variantes pour ne pas se répéter.',
      'La musique principale accompagne désormais l’écran d’accueil, dès l’ouverture du jeu.',
    ],
  },
  {
    version: '0.74.0',
    date: '2026-10-14',
    title: 'Le son',
    newFeatures: [
      'Musiques : « Tableau de la Taverne » au Centre, au Bourg, à la Taverne et à la lice d’entraînement ; « Wistful Dawn » au Scriptorium ; « Warlike Pulse » dès qu’une manche se lance. Les musiques passent de l’une à l’autre en fondu enchaîné, sans jamais être coupées.',
      'Ambiances : chaque lieu a la sienne — feu de camp et forêt au Centre, marché du Bourg, conversations de la Taverne, silence studieux du Scriptorium, foule de la Lice. Elles restent toujours sous la musique.',
      'Effets sonores : coups, KO, fanfare de victoire et carillon à chaque exploit accompli.',
    ],
    improvements: [
      'Options › Audio : volume général, musique, ambiances, effets, durée du fondu entre les musiques, couper le son.',
    ],
  },
  {
    version: '0.73.2',
    date: '2026-10-14',
    title: 'La Salle des exploits',
    improvements: [
      'Les succès font peau neuve : une Salle des exploits avec des médaillons dorés pour ceux que vous avez obtenus, de fer pour ceux qui restent à conquérir, rangés par catégorie.',
      'Exploits secrets : les plus difficiles gardent le mystère — vous voyez leur nom, jamais ce qu’il faut faire, jusqu’à ce que vous les accomplissiez.',
      'Le numéro et la difficulté des succès ne sont plus affichés.',
      'Affectations du Centre : une compétence qui ne peut plus progresser (100, ou plafond du potentiel) s’affiche en rouge — elle redevient normale si le potentiel monte.',
    ],
    graphics: [
      'En passant d’un lieu à l’autre, le fondu ne couvre plus que la carte, et non tout l’écran.',
    ],
  },
  {
    version: '0.73.1',
    date: '2026-10-14',
    title: 'Succès et Coupe de France',
    gameplayChanges: [
      'Coupe de France : la fatigue de vos combattants est remise à 0 quand vous entrez dans la compétition, puis elle se garde d’un combat à l’autre selon les règles habituelles — elle n’est plus remise à 0 à chaque tour. Faites tourner l’effectif !',
    ],
    balanceChanges: [
      'Succès « Sans une égratignure », « Par-derrière », « Sans partage » et « Les trois armes » : désormais classés Faciles.',
    ],
    fixes: [
      'Les succès obtenus pendant un combat ne se dévoilent plus avant la fin du combat : ils s’annoncent à l’écran du résultat final.',
    ],
  },
  {
    version: '0.73.0',
    date: '2026-10-14',
    title: 'Les succès',
    newFeatures: [
      '40 succès à débloquer en jouant : combats, compétitions (Ligue, Coupe de France, combats de la Reine), deniers, améliorations, combattants, saisons… Chacun ne s’obtient qu’une fois.',
      'Un bandeau doré annonce chaque succès dès qu’il est obtenu ; ceux d’une journée apparaissent aussi au carnet de bord.',
      'Bouton « 🏅 Succès » dans l’encart Sauvegarde / Menu principal : la liste complète, les dates d’obtention, la progression et des filtres par difficulté.',
    ],
    improvements: [
      'Anciennes sauvegardes : les succès déjà mérités (deniers, talents, étoiles…) sont accordés au chargement ; les compteurs partent de zéro.',
    ],
  },
  {
    version: '0.72.0',
    date: '2026-10-14',
    title: 'Deux talents',
    newFeatures: [
      'Deux talents par combattant : au Scriptorium, un combattant qui a déjà un talent peut révéler son second — gratuitement. Ses deux talents agissent ensemble, et ne sont jamais les mêmes.',
    ],
    gameplayChanges: [
      'Remplacer un talent n’est possible qu’avec deux talents : pour 500 deniers, vous choisissez lequel remplacer, le premier ou le second ; l’autre reste acquis.',
    ],
    improvements: [
      'Bureau d’étude : la fenêtre indique ce que révélera l’étude (premier talent, second talent ou remplacement) et propose le choix du talent à remplacer.',
    ],
  },
  {
    version: '0.71.1',
    date: '2026-10-12',
    title: 'Ma Lice d’entraînement, retouches',
    improvements: [
      'Ma Lice d’entraînement est ramenée à la taille du Centre (17 × 14 cases) : un peu moins de décor, une lice plus lisible.',
      'Le Marshal se tient désormais dans la lice, plus grand et bien en vue ; pendant un combat, il arbitre depuis le bord arrière.',
    ],
    fixes: [
      'Le Centre : le chemin vers Ma Lice d’entraînement s’ouvrait sur 2 × 2 cases ; il s’ouvre désormais sur 2 cases au bord, comme les autres chemins.',
    ],
  },
  {
    version: '0.71.0',
    date: '2026-10-12',
    title: 'Ma Lice d’entraînement',
    newFeatures: [
      'Ma Lice d’entraînement : un nouveau lieu, au bout du chemin bas-gauche du Centre. Le Marshal y arbitre des combats entre vos propres combattants — 1 contre 1, 3 contre 3 ou 5 contre 5 — joués avec les vraies règles du combat, sans aucune conséquence (ni fatigue, ni statistiques, ni palmarès, ni deniers).',
      'Journal détaillé du combat d’entraînement : chaque coup expliqué pas à pas (attaque, défense, aléa, combo, fatigue, bonus, arrondi), avec les valeurs exactes du moteur. Une case à cocher l’affiche ou le masque.',
      'Sept nouvelles partitions d’écusson, dont l’Émanché, le Chapé et deux Tiercés : 15 au choix, à la création du club comme dans l’Administration.',
    ],
    gameplayChanges: [
      'Coupe de France : au début de chaque édition, la fatigue de tous vos combattants est remise à zéro — une seule fois par édition.',
    ],
    improvements: [
      'Choix de la partition de l’écu présenté en grille de 5 colonnes.',
    ],
    graphics: [
      'Le Marshal : tenue jaune à rayures noires, chapeau jaune et bâton à drapeau ; il fait sa ronde autour de la lice et donne le signal de départ.',
      'Une lice d’entraînement vivante (mannequins, râteliers, tentes, feu de camp, compagnons qui regardent), aux couleurs de la saison.',
    ],
  },
  {
    version: '0.70.0',
    date: '2026-10-12',
    title: 'Les quatre saisons',
    newFeatures: [
      'Les saisons : une année de 100 jours, en quatre saisons de 25 jours — été, automne, hiver, printemps. La saison s’affiche sous le jour, et chaque changement est annoncé au carnet de bord.',
      'Le monde change avec elles : herbe jaunie et rivière asséchée en été, arbres roux et feuilles mortes en automne, neige, toits blancs et feux éteints en hiver, fleurs au printemps — au Centre, au Bourg et dans toutes les lices.',
      'Huit talents saisonniers (3 ordinaires, 3 rares, 2 épiques), à découvrir au Scriptorium et à la Taverne.',
    ],
    gameplayChanges: [
      'Été : la rivière est asséchée (personne ne peut y être affecté) et les Hastiers perdent 10 % d’efficacité au combat.',
      'Automne : les Runners perdent 10 % d’efficacité au combat.',
      'Hiver : la forêt est inaccessible.',
      'Au début d’une saison, les combattants affectés à un lieu qui ferme passent au repos ; ils ne sont pas renvoyés d’office à sa réouverture.',
    ],
    improvements: [
      'Administration › La Lice (aperçu) : choix de la saison du décor.',
    ],
  },
  {
    version: '0.69.0',
    date: '2026-10-12',
    title: 'Gestion de la compagnie',
    newFeatures: [
      'Le Centre : enregistrez vos affectations sous un nom (« Entraînement », « Récupération »…) et réappliquez-les d’un clic. Jusqu’à 6 configurations, modifiables et supprimables ; les places sont respectées et tout élément ignoré est signalé.',
      'Fiches de club : un palmarès en haut à droite — trophées de Ligue, Calice d’or de la Coupe de France, et rubans de 2e et 3e place en Ligue et de finaliste de Coupe, cumulés (×2, ×3…).',
      'Sélection d’un combat et équipes enregistrées : filtres par classe et tris (niveau, nom, potentiel, fatigue). Les combattants déjà choisis restent visibles, marqués « hors filtre ».',
    ],
    improvements: [
      'Carnet de bord et Centre : un combattant qui a atteint son potentiel maximal dans la compétence de son lieu est signalé (« entraînement inutile »).',
      'Historique des clubs : Ligue et Coupe de France présentées de la même façon (Saison, résultat, compétition, promotion ou relégation).',
      'Équipe enregistrée incomplète : le message dit qui a quitté la compagnie ou qui est en étude, et garde les autres sélectionnés.',
    ],
  },
  {
    version: '0.68.1',
    date: '2026-10-12',
    improvements: [
      'La Lice : au lancement d’une manche, la page descend d’elle-même jusqu’au combat.',
      'La Lice : « Les moins fatigués » et les cases cochées ne ramènent plus la page tout en haut.',
      'Le Centre : le tableau « Affectations » tient dans la largeur (noms courts des lieux).',
      'Le Centre et le Bourg : le poteau indicateur d’un chemin se clique, et un combattant posé devant ne masque plus la sortie.',
      'Le Bourg : un clic sur l’étiquette d’un artisan ouvre son panneau.',
      'Carnet de bord : les combattants de la Forêt apparaissent dans la liste du Centre, avec leurs deniers ou « rien gagné ».',
    ],
    graphics: [
      'Combat : les barres de PV ne sont plus cachées par les combattants de devant ; les chiffres de dégâts s’empilent au lieu de se recouvrir ; le compteur de combo s’affiche à côté.',
      'Combat : la lueur du capitaine brille pendant l’attente du lancement et ne reste plus, vide, à sa place de départ.',
      'Le rappel de la formation, en haut du combat, se détache du texte qui défile dessous.',
    ],
    fixes: [
      'Une demi-étoile s’affichait pleine sur la carte du combattant à placer.',
      'L’écran de fin de combat affichait votre ancien rang au classement.',
      'Textes : « les Loups de Lille remportent », « rétabli » ou « rétablis » selon le nombre, « le premier combattant des Loups ».',
    ],
  },
  {
    version: '0.68.0',
    date: '2026-10-10',
    gameplayChanges: [
      'Les combattants ont désormais 150 PV au lieu de 100 : les manches durent plus longtemps (environ 22 tours au lieu de 15) et laissent plus de place au placement et aux renversements.',
      'Les PV de vos combattants et des recrues de la Taverne sont convertis automatiquement (× 1,5) au chargement d’une ancienne sauvegarde.',
    ],
    balanceChanges: [
      'Fatigue pendant la manche recalibrée pour des combats plus longs : effort debout 0,6 par tour (au lieu de 0,8), qui s’alourdit plus lentement ; encaisser un coup fatigue de 0,13 par point de dégâts (au lieu de 0,2). La fatigue en fin de combat reste la même qu’avant.',
    ],
  },
  {
    version: '0.67.1',
    date: '2026-10-10',
    improvements: [
      'Comportement de l’équipe adverse : l’infobulle et l’Almanach le décrivent désormais en termes de jeu (composition, placement, cibles, souffle), sans effet de style.',
    ],
  },
  {
    version: '0.67.0',
    date: '2026-10-10',
    title: 'Huit manières de combattre',
    gameplayChanges: [
      'Les équipes adverses adoptent désormais l’une de huit manières de combattre, toutes réfléchies : l’Ordonnance, le Mur, la Chevauchée, le Marteau, la Guerre d’usure, le Stratège, le Tacticien et le Chasseur de têtes.',
      'Chacune joue autrement avec la formation, le placement, la fatigue et les cibles : forêt de lances sans Runner, double Runner dans le dos, toute la compagnie sur un flanc, rotation et chasse aux épuisés, traque du capitaine…',
      'Chaque club peut adopter n’importe laquelle, avec la même chance : sa force tient à ses combattants. Les comportements « brouillon » et « instinctif » disparaissent.',
    ],
    improvements: [
      'Le comportement adverse s’affiche toujours sous son nom (« Comportement défensif », « … écrasant »…) ; l’infobulle donne le nom de sa manière et la raconte.',
      'L’Almanach présente les huit manières et comment leur répondre.',
    ],
  },
  {
    version: '0.66.0',
    date: '2026-10-10',
    title: 'Reprendre son souffle',
    gameplayChanges: [
      'La fatigue évolue pendant la manche : rester debout fatigue un peu, de plus en plus à mesure que la manche s’éternise ; frapper coûte peu, encaisser coûte bien plus.',
      'Un combattant au sol récupère : plus il y reste, plus il reprend des forces.',
      'C’est la fatigue du moment qui compte : un combattant qui s’épuise en fin de manche frappe de moins en moins fort.',
      'Se ménager : en supériorité numérique, un combattant fatigué laisse ses alliés tenir l’adversaire et souffle quelques secondes hors de portée.',
      'Temps mort : à deux contre deux, quand tout le monde est épuisé, chacun recule d’un pas et reprend son souffle avant de se retaper.',
      'Entre deux manches, tout l’effectif récupère un peu (−10 pour ceux qui viennent de combattre, −15 pour les remplaçants). Fini les +20 à +60 au forfait après chaque manche.',
      'Talents : Souffle long réduit l’effort de 20 %, Second souffle récupère deux fois plus vite ; Bon vivant et Légende vivante gardent leur rôle.',
    ],
    improvements: [
      'Une jauge de fatigue sous les PV de chaque combattant, pendant la manche (bleue, ambre, rouge) ; ses couleurs pâlissent en direct.',
    ],
  },
  {
    version: '0.65.0',
    date: '2026-10-10',
    title: 'Le vrai béhourd : la position avant tout',
    gameplayChanges: [
      'Fin de la boucle « Hastier > Lutteur > Runner » et de ses dégâts ×2 : aucune classe n’en domine une autre, c’est la position qui fait la différence.',
      'Lutteur : redoutable contre la barrière (+20 % en Lutte). Il y plaque sa cible : son combo monte plus vite, et elle ne peut plus reculer.',
      'Hastier : il frappe à 2 cases, par-dessus l’épaule de son Lutteur (+20 % de dégâts à distance). Pris dans la mêlée, son arme l’encombre (−20 %).',
      'Runner : au centre de la lice, il passe derrière les lignes adverses. Dans le dos, +30 % de dégâts, et s’il arrive en courant, il renverse sa cible, qui perd un tour.',
      'Casques fermés : chacun ne voit que devant lui. Un adversaire dans son angle mort n’existe pas pour lui jusqu’à ce qu’il le frappe, et tout coup venu de l’angle mort fait +15 %.',
      'L’IA adopte la formation du béhourd : 2 Lutteurs contre les barrières, 2 Hastiers derrière eux, 1 Runner au centre. Le placement automatique fait de même.',
    ],
    improvements: [
      'Le rappel « Qui domine qui » laisse place au schéma de la formation et au rôle de chaque classe, pendant le placement et le combat, et dans l’Almanach.',
      'Les dégâts flottants et la gerbe orange signalent désormais un coup avantagé par la position (dans le dos, angle mort, à distance).',
    ],
    graphics: [
      'Renversement : poussière et étoiles au-dessus du combattant percuté par un Runner ; la traînée de poussière suit la course du Runner.',
    ],
  },
  {
    version: '0.64.0',
    date: '2026-10-10',
    title: 'Un carnet de bord plus lisible',
    improvements: [
      'Carnet de bord repensé : le combat du jour dans un sceau de cire (score, adversaire, journée, lieu), puis une tuile par domaine — points, deniers, progrès du Centre, talent révélé, potentiel, Taverne. On ouvre la tuile qui intéresse.',
      'Les deniers du jour sont comptés une seule fois, avec leur provenance (recette, Reine, Forêt, talents).',
      'Le Centre tient en une rangée de pastilles (« LUT +1 », « FAT −28 », « au mieux ») au lieu d’une phrase par combattant.',
      'Les annonces à ne pas manquer (combat du jour, Combat de la Reine, fin de saison) sont réunies dans un bandeau doré ; les recrutements des autres compagnies tiennent en une ligne qui se déplie.',
    ],
    graphics: [
      'Le sceau s’imprime à l’ouverture du carnet (effets visuels complets).',
    ],
    fixes: [
      'Le lancement d’une nouvelle saison n’apparaît plus sous la forme « season.start » dans le carnet.',
    ],
  },
  {
    version: '0.63.0',
    date: '2026-10-09',
    title: 'Talents et moments forts',
    graphics: [
      'Lice : une rune ✦ à la couleur de sa famille s’élève quand un talent joue sur un coup (épique : noire cernée d’or).',
      'Lice : survie à 1 PV (Inébranlable, Immortel) — halo doré et bouclier qui se brise en éclats ; scintillement pendant l’invulnérabilité.',
      'Lice : trèfle du coup chanceux, compteur de combo « ×2, ×3… » aux étincelles rouges, gros coups (25 dégâts et plus) avec un bref tremblement de caméra.',
      'Lice : lueur aux couleurs de la compagnie sous chaque capitaine au début de la manche ; gouttes de sueur (et vapeur au-delà de 80) pour les combattants épuisés.',
      'Lice : à la fin d’une manche, les fanions du vainqueur claquent au-dessus de ses combattants debout et la foule soulève la poussière.',
      'Scriptorium : à la première visite qui suit une étude, le livre s’ouvre, les pages tourbillonnent et la lumière du talent révélé jaillit.',
      'Scriptorium : encre et poussière dorée aux pupitres occupés ; l’artefact acquis est posé sur la table de Flavia, et il y descend, dans une onde de lumière, au moment de l’achat.',
      'Talents rares : reflet lent sur leur étiquette ; talents épiques : lueur dorée pulsée.',
      'Victoire face à la Reine : pluie de pétales ; victoire en Coupe de France : étincelles d’or.',
      'Coupe de France : le blason de votre compagnie avance dans l’arbre final, suivi d’une traînée lumineuse, à chaque qualification.',
    ],
    improvements: [
      'Tous ces effets respectent l’option « Effets visuels » (moitié moins en effets réduits, sans éclair ni tremblement) et le réglage « réduire les animations » du système.',
    ],
  },
  {
    version: '0.62.0',
    date: '2026-10-09',
    title: 'Cinquante talents',
    newFeatures: [
      '50 talents à découvrir : 33 ordinaires, 12 rares et 5 épiques, chacun avec un vrai effet en jeu.',
      'En combat : bonus de dégâts selon la situation (cible occupée, premier coup, lieu du match, classe adverse…), auras pour toute la manche (Porte-étendard, Seigneur de guerre), protection du capitaine (Garde du corps), survie à 1 PV (Inébranlable, Immortel).',
      'Hors combat : moins de fatigue après les manches, réussite et gains en plus au Centre, deniers chaque jour, recette à domicile et récompenses de la Reine majorées, recrues moins chères, études plus courtes, potentiel protégé ou stimulé, plafond de compétences plus haut.',
      'Les talents en jeu s’affichent parmi les bonus de la manche (✦).',
    ],
    gameplayChanges: [
      'Fourbe a désormais un effet : +5 % de dégâts finaux contre un adversaire déjà aux prises avec un autre combattant.',
      'Une étude, ou une recrue de la Taverne, révèle désormais un talent de la famille tirée (ordinaire, rare ou épique).',
    ],
  },
  {
    version: '0.61.0',
    date: '2026-10-09',
    title: 'Le livre bleu de Flavia',
    gameplayChanges: [
      'Les artefacts deviennent une amélioration par paliers : au départ, seul le Grimoire de guerre est à vendre. Il débloque l’Encyclopédie du guerrier, qui débloque le Traité de Poliorcétique. Chaque palier remplace le précédent.',
    ],
    improvements: [
      'Artefacts renommés : Artefact lugubre → Grimoire de guerre, Artefact brillant → Encyclopédie du guerrier, Grand Artefact → Traité de Poliorcétique.',
    ],
    graphics: [
      'La Professeure Flavia alterne ses habitudes : caresser son chat, ou aller chercher un livre bleu dans son rayonnage pour le lire quelques secondes sur le tapis vert.',
      'Les deux lecteurs qui discutaient (la dame en bleu et l’enfant) se sont éloignés du cabinet de Flavia : ils bavardent désormais devant le Bureau d’étude.',
    ],
  },
  {
    version: '0.60.1',
    date: '2026-10-09',
    title: 'Flavia et son chat',
    graphics: [
      'La Professeure Flavia quitte régulièrement sa table : elle se promène sur le tapis vert, consulte son rayonnage et vient caresser son chat, qui l’attend assis et ronronne (petits cœurs).',
    ],
    fixes: [
      'Le chat ne perd plus ses pattes arrière quand il s’assoit : elles restent visibles, repliées sous lui. Couché, ses pattes avant dépassent.',
    ],
  },
  {
    version: '0.60.0',
    date: '2026-10-09',
    title: 'La Professeure Flavia',
    newFeatures: [
      'La Professeure Flavia s’installe au Scriptorium, dans son cabinet, avec son chat, un Sacré de Birmanie.',
      'Second Bureau d’étude (2 500 deniers, auprès de Flavia) : deux combattants étudient en même temps.',
      'Artefacts (auprès de Flavia) : ils changent les chances d’obtenir un talent ordinaire, rare ou épique. Artefact lugubre 60 / 36 / 4 %, Artefact brillant 50 / 44 / 6 %, Grand Artefact 20 / 60 / 20 %. Un seul est actif à la fois.',
      'Une souris sort des rayonnages de temps en temps… et le chat se lance à sa poursuite.',
    ],
    gameplayChanges: [
      'Un combattant n’a qu’un talent : « Nouvelle étude : 500 deniers » permet de tenter d’en obtenir un autre. Il garde l’ancien jusqu’à la révélation ; une étude interrompue n’est pas remboursée.',
      'La famille du talent est tirée à la fin de l’étude, selon l’artefact actif à ce moment.',
    ],
    improvements: [
      'Le Bureau d’étude affiche les chances de chaque famille, ainsi que le talent actuel, la durée et le coût de l’étude.',
      'Le Scriptorium s’agrandit : salle de lecture au premier plan et cabinet de Flavia.',
    ],
  },
  {
    version: '0.59.0',
    date: '2026-10-09',
    title: 'Le Scriptorium et les talents',
    newFeatures: [
      'Le Scriptorium ouvre ses portes au bout du chemin nord-ouest du Centre, à la place du Centre de formation : une bibliothèque fortifiée peuplée de copistes, de moines, de baillis et de citoyens.',
      'Talents : une aptitude propre à chaque combattant. Le premier connu, Fourbe, n’a encore aucun effet en jeu.',
      'Au Bureau d’étude, envoyez un combattant étudier : 25, 20, 15 ou 10 jours selon son potentiel. À la fin de l’étude, son talent se révèle.',
      'Une recrue de la Taverne sur dix arrive avec un talent, visible sur sa fiche de recrutement.',
    ],
    improvements: [
      'Le talent s’affiche à droite de l’état des combattants dans La Compagnie, et entre la classe et les étoiles sur les fiches. Rien ne s’affiche pour un combattant sans talent.',
      'Les familles de talents ont leur couleur : bleu clair pour les ordinaires, orange pour les rares, noir pour les épiques.',
    ],
    gameplayChanges: [
      'Un combattant en étude ne s’entraîne pas et ne combat pas : il apparaît grisé dans la sélection d’un combat, jusqu’à la fin de son étude.',
      'Une étude peut être interrompue à tout moment : le combattant redevient disponible, mais aucun talent n’est révélé.',
    ],
  },
  {
    version: '0.58.0',
    date: '2026-10-09',
    title: 'De nouvelles terres où s’installer',
    newFeatures: [
      'Huit nouveaux lieux de départ, deux par Terre : chaque Terre en propose désormais six.',
      'Ouest : Cité de Locronan, Abbaye de Maillezais. Nord : Foire de Provins, Remparts de Langres.',
      'Centre : Palais Jacques-Cœur, Colline de Vézelay. Sud : Cité de Saint-Émilion (enfin un lieu en Aquitaine), Tours de La Rochelle.',
    ],
  },
  {
    version: '0.57.0',
    date: '2026-10-09',
    title: 'La Coupe, rendez-vous de l’intersaison',
    gameplayChanges: [
      'La Coupe de France se dispute désormais à la fin de chaque saison : après le bilan, « Aller en Coupe de France » remplace « Commencer la nouvelle saison ». Le bouton « Coupe de France » de la colonne disparaît.',
      'Pendant la Coupe, le domaine est fermé ; la nouvelle saison commence depuis l’écran du vainqueur.',
      'Tant qu’il vous reste un combat, « Abandonner la Coupe » remplace « Quitter la Coupe » : vos combats restants sont perdus par forfait, les deniers gagnés restent acquis.',
    ],
    improvements: [
      'Sauvegarder et revenir au menu principal directement depuis la Coupe.',
      '« Quitter la Coupe », une fois éliminé, dispute d’un coup la fin du tournoi jusqu’au vainqueur.',
    ],
  },
  {
    version: '0.56.0',
    date: '2026-10-09',
    title: 'Un royaume plus rude',
    balanceChanges: [
      'Forêt : les améliorations du Bûcheron (gain de deniers, probabilité, places) s’arrêtent au 4e achat. Ce qui est déjà acheté reste acquis.',
      'Potentiel : un peu moins de chances de gagner une flamme (18–25 ans : 16 / 8 / 4 % ; 26–31 ans : 40 / 24 / 1 %).',
      'Compagnie de départ : vos combattants débutent un peu plus faibles (compétences de 8 à 27) ; votre capitaine ne change pas.',
      'Clubs adverses : leurs combattants progressent une fois et demie moins vite.',
    ],
  },
  {
    version: '0.55.1',
    date: '2026-10-09',
    title: 'Des classements justes',
    improvements: [
      'Pancarte des classements : les mises à terre ne classent plus que les combattants de votre compagnie (filtre « Ma compagnie » imposé) — les combats entre autres compagnies ne les comptent pas.',
    ],
  },
  {
    version: '0.55.0',
    date: '2026-10-09',
    title: 'Palmarès et trophées',
    newFeatures: [
      'Armoire à trophées dans la Taverne : un trophée par titre de Ligue 1, 2 ou 3 et par Coupe de France gagnée. Cliquez pour admirer chaque trophée et sa saison.',
      'Pancarte des classements dans la Taverne : les meilleurs combattants des trois Ligues par niveau, mises à terre, victoires, défaites et combats disputés, filtrables par Ligue ou sur votre compagnie.',
      'L’historique de chaque club garde son parcours en Coupe de France : « Phase de poule », « Saison X quart de finale », « Finaliste », « Champion de France »…',
    ],
    improvements: [
      'Les combattants des clubs adverses tiennent désormais leur palmarès (combats, victoires, défaites, mises à terre contre votre compagnie).',
      'Les anciennes sauvegardes retrouvent leurs titres déjà gagnés.',
      'Almanach : nouvel article « Classements et trophées ».',
    ],
  },
  {
    version: '0.54.0',
    date: '2026-10-09',
    title: 'Un Bourg qui s’anime',
    graphics: [
      'Le Bourg se resserre : même taille et même caméra que le Centre, personnages et décor bien plus proches.',
      'Un campement de tentes remplace les maisons : atelier du Menuisier, pavillon du Sénéchal, fournil du Boulanger, tentes du marché.',
      'Les artisans travaillent : le Menuisier rabote (copeaux), le Bûcheron fend ses bûches, le Sénéchal écrit dans son registre, le Boulanger pétrit (farine) — puis soufflent un moment.',
      'Une vingtaine d’habitants font leurs tournées, s’arrêtent, regardent autour d’eux et bavardent ; deux chiens flânent, s’assoient, reniflent et se couchent ; des oiseaux picorent et s’envolent.',
      'Arbres et buissons bougent au vent, feuilles et poussière dorée, vols d’oiseaux de passage, comme au Centre.',
    ],
  },
  {
    version: '0.53.0',
    date: '2026-10-09',
    title: 'Le prix du talent',
    balanceChanges: [
      'Taverne : les recrues de 2,5★ et plus coûtent davantage — 2,5★ 150 deniers, 3★ 350, 3,5★ 600, 4★ 1 250. Jusqu’à 2★, le prix dépend toujours de la valeur du combattant.',
      'Potentiel des nouveaux combattants plus rare : 0 flamme 60 %, 1 flamme 30 %, 2 flammes 8 %, 3 flammes 2 %. Le capitaine de votre compagnie garde ses chances habituelles.',
      'Le potentiel évolue désormais tous les 15 jours (au lieu de 10).',
    ],
  },
  {
    version: '0.52.0',
    date: '2026-10-08',
    title: 'L’élite du béhourd',
    newFeatures: [
      'Étiquette « Elite » : les 16 meilleurs combattants de France, toutes Ligues et compagnies confondues, portent une étiquette noire juste avant leur classe.',
      'Le statut suit le classement : un combattant qui progresse peut y entrer, un autre qui est dépassé le perd. Une compagnie peut n’en compter aucun… ou plusieurs.',
    ],
  },
  {
    version: '0.51.0',
    date: '2026-10-08',
    title: 'La Coupe se vit de près',
    newFeatures: [
      'Arbre final dans le tableau de la Coupe : toutes les affiches des seizièmes à la finale, scores, vainqueurs et places à venir, toujours à jour.',
      'Éliminé ? « Assister aux prochains combats » : chaque affiche se dispute sous vos yeux, le score monte manche après manche et le vainqueur rejoint sa place au tour suivant, jusqu’au Champion de France.',
      'Récompenses : chaque victoire de votre compagnie rapporte des deniers — 150 en poules, puis 300, 600, 1 200, 2 500 et 5 000 de la phase finale à la finale.',
    ],
    graphics: [
      'Château de Gabarnac : caméra rapprochée, 36 habitants de plus autour de la Lice et dans les vignes, des combattants de nombreuses compagnies engagées, à leurs couleurs.',
      'Une tente de campement remplace la maison près des vignes.',
    ],
    gameplayChanges: [
      'Le Coffre reste fermé pendant les combats de la Coupe de France.',
      'Dans le tableau final, les autres combats du tour se suivent dans l’arbre après le vôtre (accélérer ou passer l’animation).',
    ],
  },
  {
    version: '0.50.0',
    date: '2026-10-08',
    title: 'La Coupe de France',
    newFeatures: [
      'La Coupe de France : les 54 compagnies de France s’affrontent au Château de Gabarnac, à tout moment, hors du calendrier. Accès par le bouton « Coupe de France », sous « Sauvegarder ».',
      'Tirage au sort en 9 poules de 6 (A à I), équipe par équipe ou d’un coup, puis phase de poules, qualification des 32 meilleures et tableau final jusqu’à la finale.',
      'Le Château de Gabarnac : remparts, tours, vignes balancées par le vent, habitants qui flânent et bavardent, et vos 8 combattants aux couleurs du club. La Lice, au centre, ouvre votre prochain combat ; le tableau de la Coupe donne résultats, poules, qualifiés et meilleurs combattants.',
      'Tableau final illustré, écran du vainqueur « Champion de France » et palmarès des éditions.',
    ],
    gameplayChanges: [
      'Les combats de la Coupe utilisent le moteur de combat habituel ; ils ne touchent ni au championnat, ni aux journées, ni à la fatigue ou au palmarès de vos combattants.',
      'Éliminé, vous pouvez suivre la suite tour par tour ou simuler directement jusqu’au vainqueur.',
    ],
    graphics: [
      'Nouvelle Lice du Château de Gabarnac, au milieu des vignes, réservée à la Coupe.',
    ],
    improvements: [
      'Almanach : nouvel article « La Coupe de France ».',
    ],
  },
  {
    version: '0.49.2',
    date: '2026-10-08',
    title: 'La chronique des compagnies',
    improvements: [
      'La bulle du comportement adverse raconte désormais la manière de combattre de la compagnie, à la façon d’une chronique de tournoi.',
    ],
  },  {
    version: '0.49.1',
    date: '2026-10-08',
    title: 'Des adversaires plus coriaces',
    balanceChanges: [
      'Nouvelle répartition des comportements adverses : 0 à 2★ surtout classique ; 2,5 à 3,5★ tactique ou stratégique (d’élite une fois sur cinq) ; 4 à 5★ toujours d’élite.',
    ],
  },  {
    version: '0.49.0',
    date: '2026-10-08',
    title: 'Des adversaires qui ont du caractère',
    gameplayChanges: [
      'À chaque combat, l’équipe adverse adopte un comportement selon sa force : classique, instinctif, tactique ou stratégique, et « d’élite » pour les meilleurs clubs.',
      'Ce comportement guide la composition de ses manches, son placement et la façon dont ses combattants se battent.',
    ],
    improvements: [
      'Le comportement de l’adversaire est annoncé sous son nom pendant le combat.',
      'Almanach : nouvel article « Le comportement des adversaires ».',
    ],
  },  {
    version: '0.48.0',
    date: '2026-10-08',
    title: 'Tacticien 2 et Stratège 2',
    newFeatures: [
      'Deux nouveaux profils d’IA, Tacticien 2 et Stratège 2, issus des mesures du banc d’essai : ils composent mieux leurs manches et gardent le placement par classes.',
    ],
    improvements: [
      'Banc d’essai IA (Module Admin) : choix des profils à confronter.',
    ],
  },  {
    version: '0.47.0',
    date: '2026-10-08',
    title: 'Les coulisses de l’IA',
    newFeatures: [
      'Module Admin : « Banc d’essai IA », un tournoi entre cinq profils d’IA de combat (du Brouillon au Stratège), en combats complets simulés.',
    ],
    improvements: [
      'Le moteur de combat sait désormais faire jouer une IA différente à chaque camp. Les combats du jeu ne changent pas.',
    ],
  },  {
    version: '0.46.0',
    date: '2026-10-08',
    title: 'Un placement d’un seul coup d’œil',
    improvements: [
      'Placement dans la Lice repensé en trois zones : votre équipe à gauche, la Lice au centre, les adversaires à droite. Tout tient à l’écran, sans défilement.',
      'Cartes de combattants compactes (classe, étoiles, fatigue, état) et compteurs « 2 / 5 placés ».',
      'Le bouton « Lancer la manche » est toujours visible, dans une barre d’actions sous la Lice.',
      'Pendant le placement, la caméra se resserre sur la lice : les cases sont plus grandes.',
    ],
  },  {
    version: '0.45.0',
    date: '2026-10-08',
    title: 'La Taverne ouvre ses portes à tous',
    gameplayChanges: [
      'Améliorer la Taverne ne relève plus que la borne haute des recrues : au niveau 2, elles vont de 1★ à 2,5★ ; au niveau 5, de 1★ à 4★.',
      'Le prix d’une recrue dépend désormais de ses étoiles, quel que soit le niveau de la Taverne : jusqu’à 2★ selon sa valeur, 2,5★ 50 deniers, 3★ 250, 3,5★ 500, 4★ 750.',
    ],
    improvements: [
      'Le tavernier annonce le barème des prix de la prochaine rotation et le prix des nouvelles étoiles que débloque l’amélioration.',
      'Almanach : tableau des prix des recrues selon leurs étoiles.',
    ],
  },  {
    version: '0.44.0',
    date: '2026-10-08',
    title: 'Se déplacer dans son domaine',
    newFeatures: [
      'La carte devient le moyen de se déplacer : au Centre, le chemin du nord-est mène à la Taverne et celui du sud-est au Bourg.',
      'Dans la Taverne, la porte ramène au Centre ; dans le Bourg, le chemin du nord-ouest aussi.',
      'Le chemin du nord-ouest du Centre est réservé au futur Centre de formation (barré pour l’instant).',
    ],
    improvements: [
      'Au survol, un chemin ou une porte s’illumine et annonce sa destination ; un fondu accompagne le voyage, et le passage d’arrivée luit un instant.',
      'Nouvel article de l’Almanach : « Se déplacer dans le domaine ».',
    ],
    gameplayChanges: [
      '« Ma Lice » et le maître d’œuvre sont retirés du jeu. Vos matchs à domicile se jouent toujours dans la lice de votre club.',
      'La colonne de droite ne garde que la Compagnie, la Ligue, le Coffre, l’Almanach et l’entrée au Centre.',
    ],
    graphics: [
      'Le chemin du sud-ouest du Centre s’arrête désormais dans l’herbe ; des poteaux indicateurs marquent les chemins ouverts.',
    ],
  },
  {
    version: '0.43.0',
    date: '2026-10-08',
    title: 'Un écran principal vivant',
    newFeatures: [
      'Patch Notes : l’historique des évolutions du jeu, accessible sous le numéro de version de l’écran principal.',
      'L’écran principal montre le jeu en arrière-plan, de chaque côté du menu : vie du camp, Taverne, combats (1 contre 1, 2 contre 2, mêlées) et Bourg, en séquences de quelques secondes.',
    ],
    improvements: [
      'Le module Admin quitte l’écran principal : il s’ouvre désormais depuis Options › Administration (même code d’accès, mêmes outils).',
      'Nouvelle option « Animations de l’écran principal » (Options › Affichage) pour couper les séquences d’arrière-plan.',
    ],
  },
  {
    version: '0.42.0',
    date: '2026-10-08',
    title: 'Le potentiel fixe le plafond',
    gameplayChanges: [
      'Le potentiel fixe désormais un plafond personnel aux compétences (Lutte, Hast, Percussion, Endurance) : au-delà, l’entraînement ne rapporte plus rien.',
      'Le plafond suit le potentiel : une flamme gagnée le relève, une flamme perdue l’abaisse. Une valeur déjà acquise au-dessus est conservée.',
    ],
    balanceChanges: [
      'Plafonds : aucune flamme « modeste », 1 flamme « honorable », 2 flammes « élevé », 3 flammes « sans limite ». Les compétences ne grimpent plus à 100 dès la deuxième saison.',
    ],
    improvements: [
      'Fiche du combattant : « Potentiel · plafond », partie hachurée des barres hors de portée, 🔥 sur une compétence arrivée au plafond.',
      'Carnet de bord : un combattant au plafond est signalé au Centre (« LUT au plafond de son potentiel »).',
    ],
  },
  // Versions antérieures : conservées pour mémoire, jamais affichées (PATCH_NOTES_MIN_VERSION).
  {
    version: '0.41.0',
    date: '2026-10-08',
    title: 'Équipes enregistrées',
    newFeatures: [
      'Effectif engagé : jusqu’à 3 équipes de 8 combattants enregistrées et nommées, rappelées d’un clic.',
    ],
    improvements: [
      '« Sélection automatique » devient « Sélection de l’équipe Type » : les 8 plus hauts niveaux, quelle que soit la classe.',
    ],
  },
  {
    version: '0.40.0',
    date: '2026-10-08',
    title: 'Un camp vivant',
    graphics: [
      'Le Centre s’anime : les combattants nagent, mangent, luttent, frappent les mannequins, chargent le foin et fendent du bois.',
    ],
    gameplayChanges: ['L’Infirmerie est retirée du Centre.'],
  },
]);
