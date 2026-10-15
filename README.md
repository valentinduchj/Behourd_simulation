# Béhourd — Gestion de compagnie médiévale

Prototype (v0.39.0) d'un jeu de gestion de compagnie de béhourd : entraînement au Centre, journées de championnat dans La Lice (vue isométrique), trois divisions avec montées et descentes.

## Lancer le jeu

Double-cliquez sur **`lancer.bat`**. Il démarre un petit serveur local Python et ouvre `http://localhost:8642`.

Lancement manuel, depuis ce dossier :

```
py -m http.server 8642
```

puis ouvrez http://localhost:8642.

> Ouvrir `index.html` directement (`file://`) ne fonctionne pas : les navigateurs bloquent les modules JavaScript dans ce mode.

Le jeu est écrit en JavaScript pur (modules ES), sans dépendance ni étape de compilation.

### Version de test à envoyer (exécutable Windows)

```
powershell -ExecutionPolicy Bypass -File tools\launcher\build.ps1
```

Le script produit deux fichiers :
- `dist\Behourd.exe` (environ 8 Mo) ;
- `dist\Behourd-v<version>-test.zip` : l'exécutable et `LISEZ-MOI.txt`, la notice pour les testeurs. C'est ce fichier qu'on envoie.

Comment ça marche :
- **Contenu de l'exécutable** : le jeu (`index.html`, `assets`, `css`, `data`, `src`, sans les tests) et un petit serveur local (`tools/launcher/behourd_launcher.py`, compilé avec PyInstaller). Le testeur n'a rien à installer, pas même Python.
- **Au lancement** : il sert le jeu sur `http://127.0.0.1:8642/`, accessible depuis cet ordinateur seulement, puis ouvre le navigateur par défaut. Fermer la fenêtre noire arrête le jeu.
- **Port fixe** : il garde les sauvegardes (stockage du navigateur, lié à l'adresse) d'un lancement à l'autre.
- **Deuxième double-clic** : il rouvre le navigateur. Si le port est pris par un autre programme, un message l'explique.
- **Fabrication** : PyInstaller est installé dans un environnement isolé (`build\venv`), sans toucher au Python du système.
- **Non signé** : au premier lancement, Windows SmartScreen peut avertir le testeur. La notice explique la démarche (« Informations complémentaires » → « Exécuter quand même »). Seule une signature de code (certificat payant) supprime cet avertissement.
- **Module Admin** : il reste présent dans la version de test (Options › Administration, code `yn3yn3yn3`).

## Boucle de jeu

**Nouvelle partie**, en 3 étapes :
1. carte de l'Europe → la France (seul pays jouable) → carte des **Terres** → une Terre, puis un **lieu de départ** (voir « Terres et lieux ») → départ en **Ligue 3** ;
2. nom et couleurs de la compagnie ;
3. **création du capitaine** (voir ci-dessous) ; 7 autres combattants sont ensuite générés, pour 8 au total.

Le monde compte trois divisions de 18 équipes : Ligue 1 (18 clubs de l'IA), Ligue 2 (18) et Ligue 3 (17 plus votre compagnie).

**Format** : tout découle de `LEAGUE_CONFIG` (`data/leagues.js`) : `{ teamCount: 18, promotionCount: 3, relegationCount: 3, singleRoundRobin: true }`. Avec N = 18 :
- 17 adversaires et 17 journées (aller simple) ;
- 9 combats par journée, sans équipe au repos ;
- 153 combats par division et par saison.

**Fin de saison** : un vrai événement, déclenché **dès la résolution du dernier combat de championnat** (17e journée ; il n'y a jamais de journée 18). Il n'est pas nécessaire de passer une journée.

`SeasonService.finalizeSeason()` :
1. termine les journées restantes éventuelles et fige les classements finaux, qui ne seront jamais recalculés ;
2. enregistre l'historique de chaque club ;
3. détermine les montées et descentes : les 3 premiers montent, les 3 derniers descendent (rangs 16 à 18), entre divisions voisines ;
4. fait vieillir tous les combattants d'un an.

La saison passe alors à l'état « terminée ».

**Bilan** : le carnet du jour affiche **FIN DE LA SAISON** avec :
- le classement final de la division du joueur ;
- la situation de sa compagnie : promue, reléguée ou maintenue ;
- les promus et relégués des 3 ligues, avec noms, blasons et rangs.

**Calendrier** : les jours qui suivent la fin de saison sont grisés et sans événement. « Passer la journée » est remplacé par **Aller en Coupe de France** (sur le carnet et dans le bandeau, v0.57.0) ; la nouvelle saison se lance depuis l'écran du vainqueur de la Coupe. Aucun événement de la saison suivante n'existe avant ce choix.

**Commencer la nouvelle saison** (`SeasonService.startNextSeason()`) — rien ne démarre sans le joueur :
1. les montées et descentes s'appliquent ;
2. `validateLeagueSizes()` vérifie les nouvelles divisions (18 équipes, un club par division) ;
3. un nouveau calendrier de 17 journées est créé, la première 4 à 6 jours après la dernière (au plus tôt le lendemain).

**Historique des clubs** (`session.clubHistory`, sauvegardé) : une entrée par club et par saison, pour le club du joueur comme pour ceux de l'IA.
- **Contenu** : `{ season, leagueId, finalPosition, movement: NONE | PROMOTED | RELEGATED, toLeagueId }`, avec la ligue où le classement a été obtenu.
- **Durée** : jamais écrasé.
- **Affichage** : sur la fiche de chaque club (« Saison 3 — 2e — Ligue 2 — ↑ Promu en Ligue 1 ») et en bas de La Compagnie.
- **Anciennes sauvegardes** : l'historique est reconstruit depuis l'archive des saisons.

**Anciennes sauvegardes** (divisions de 19 ou 20 équipes) : la saison en cours se termine dans son format d'origine, sans toucher au classement. À sa fin, les divisions sont ramenées à 18 :
- le surplus d'une division descend d'un niveau ;
- le surplus de la Ligue 3 (ses derniers clubs de l'IA, jamais le joueur) quitte le championnat ;
- une division en sous-effectif est complétée par la réserve (`data/leagues/reserve.json`).

Le joueur suit son club, et le carnet de bord annonce le résultat.

**Hub de gestion.** Le calendrier est en haut. À droite se trouvent l'identité du club (niveau en étoiles), le trésor, la navigation, l'encart « Ma ligue » et la sauvegarde. Lieux :

- **La Compagnie** : les combattants avec leur niveau et leurs 6 statistiques, et l'effectif (x / 20). La fiche permet de renommer et d'affecter un combattant ; elle affiche aussi son palmarès (combats et manches joués, gagnés, perdus). Elle permet enfin de **congédier** le combattant, après confirmation : il est alors retiré définitivement de la partie (Centre, sélections, listes, niveau du club, sauvegarde). Le sprite se désature avec la fatigue et passe en noir et blanc à 100.
- **Le Centre** : un camp d'entraînement vivant en vue isométrique, entouré d'une lisière boisée, avec une cour autour du feu de camp. Il compte 6 lieux (voir « Le Centre : un camp vivant ») :
  - Banquet ;
  - Pôle Combat : Petite lice, Mannequins, Tas de foin (4 places chacun) ;
  - Forêt (2 places, jusqu'à 10 avec le Bûcheron) et Rivière.
- **La Taverne** : recrutement. Les 4 combattants proposés changent tous les 7 jours (jours dorés du calendrier). Leur prix dépend de leurs étoiles (voir « La Taverne ») ; il est fixé à leur arrivée. L'effectif est limité à 20 combattants (`MAX_TEAM_FIGHTERS`, `data/roster.js`) ; à 20 / 20, la Taverne l'indique et refuse tout recrutement.
- **La Ligue** : les 5 premiers des trois divisions (la vôtre en tête) et le classement complet de chacune (18 équipes). Les zones de montée (▲) et de descente (▼) sont calculées depuis le rang. Un clic sur un club ouvre son effectif.
- **La Lice** : aperçu du prochain combat.

**Journée normale** : affectations au Centre, puis **Passer la journée**. Le jeu déroule alors `GameDay → activités → événements → ligue → planification`, ouvre le **carnet de bord** de la journée et sauvegarde automatiquement (réglage dans Options). Sous le calendrier, seuls les 2 prochains événements sont affichés.

**Carnet de bord « Les Sceaux »** (v0.64.0, `ui/components/LogbookModal.js`, contenu préparé par `buildLogbookView` dans `ui/report/logbookFormats.js`) :
- **Sceau** : le combat du jour (rouge : victoire ; brun : défaite ; pourpre : Combat de la Reine ; doré : exempt, ou numéro du jour sans combat), avec le score, l'adversaire, la journée et le lieu.
- **Annonces** (bandeau doré) : combat du jour à disputer, Combat de la Reine proposé ou manqué, fin et lancement de saison, échec de sauvegarde.
- **Tuiles**, une par domaine présent ce jour-là, dans cet ordre : Classement (points), Trésor (toutes les rentrées comptées une seule fois : recette, Reine, Forêt regroupée, talents), Le Centre (une pastille par combattant affecté : « LUT +1 », « FAT −28 », « +8 deniers » pour la Forêt, « sans progrès », « rien gagné » pour une Forêt sans rentrée (v0.68.1), « au mieux »), Études (talent révélé, avec son étiquette), Potentiel, Taverne, Divers (tout type d'événement que le carnet ne range pas ailleurs). Une seule tuile ouverte à la fois ; à l'ouverture, la plus rare (`LOGBOOK_OPEN_FIRST`). Tuiles dorées : ce qui sort de l'ordinaire.
- **Rumeurs** : les recrutements des autres compagnies, sur une ligne qui se déplie. Pied de page : Centre fermé, sauvegarde.
- **Effets** : le sceau s'imprime à l'ouverture (effets visuels complets seulement, jamais si le système demande moins d'animations).

**Journée de championnat** (jour 4, puis 4 à 6 jours sans combat entre deux journées) :
- **Écart** : tiré au hasard à la génération du calendrier de la saison (`SEASON_CONFIG.daysBetweenMatches`).
- **Dates** : enregistrées dans les événements du calendrier ; recharger une partie ne provoque aucun nouveau tirage.

1. Le Centre est fermé et le bouton devient **⚔ COMBATTRE**, en rouge. L'écran du combat affiche le classement actuel des deux équipes (« 12e de Ligue 3 »), recalculé à chaque affichage.
2. On choisit un effectif de 8 combattants au maximum.
3. Pour chaque manche, on aligne 5 combattants et on les place dans La Lice.
4. La manche est résolue, puis la fatigue est appliquée. On recommence jusqu'à 2 manches gagnantes.
5. L'écran Victoire / Défaite s'affiche. Tous les autres combats de la journée, dans les trois divisions, sont simulés avec le même moteur. Les points sont attribués et les classements se mettent à jour.
6. On passe au jour suivant.

Une journée de championnat sautée par l'avance rapide (Admin › Temps) est disputée automatiquement.

## Colonne de droite : deux encarts (v0.80.0)

- **Ma compagnie** : La Compagnie (vos combattants), Le Coffre (inventaire, en fenêtre), La Ligue (classement).
- **Le domaine** : Le Centre, Le Bourg, La Taverne, Ma Lice, Le Scriptorium — chaque lieu s'ouvre d'un clic, sans passer par la carte ; les chemins et les portes des cartes restent le moyen de s'y rendre « à pied ». Le bouton du lieu affiché est surligné.
- **Données** : `src/ui/hub/hubLocations.js` (`HUB_NAV_GROUPS`) ; un bouton mène à un écran (`screen`) ou ouvre une fenêtre (`action`).

## Trois langues : français, anglais, espagnol (v0.79.0)

- **Choix de la langue** : drapeau en haut à droite de l'écran principal ; au clic, la liste Français / English / Español, chaque langue avec son drapeau. Le choix s'applique aussitôt (l'écran se redessine) et il est retenu (`localStorage`, clé `behourd.language`). Par défaut : français.
- **Principe** : le jeu reste écrit en français. Une couche de traduction (`src/i18n/i18n.js`) remplace à l'affichage chaque texte français par sa traduction, lue dans `src/i18n/en.js` et `src/i18n/es.js` (`{ « texte français » : « traduction » }`, 2 590 phrases chacune) :
  - l'interface HTML : textes et attributs (`title`, `aria-label`, `placeholder`, `alt`), suivis par un `MutationObserver` — fenêtres, bulles, carnet de bord compris ;
  - le texte dessiné sur les cartes (canvas : étiquettes des lieux, dégâts…) : `fillText`, `strokeText`, `measureText` passent par la traduction ;
  - les textes enrichis de l'Almanach : traduits en entier avant d'être découpés (gras, liens, valeurs des règles).
- **Phrases à trous** : un texte composé par le code (« Thierry est épuisé (fatigue 72) ») est reconnu grâce à sa forme française (« {0} est épuisé (fatigue {1}) ») ; la traduction place les trous où il faut et peut accorder (`{1?s:}`). Les morceaux assemblés (« · », « — », « : », « et »…) sont traduits un par un.
- **Noms propres** : jamais traduits — combattants, clubs, villes, châteaux, lieux, régions, titres des musiques, Béhourd, Coupe de France. Les pays d'Europe prennent leur nom dans la langue (« Spain », « España »).
- **Nombres et dates** : au format de la langue (`currentLocale()` : « 1 250 » / « 1,250 » / « 1.250 », « 14 octobre 2026 » / « 14 October 2026 »). Rangs : « 1er » / « 1st » / « 1.º ».
- **Glossaire** (à valider) : Lutteur / Hastier / Runner → Wrestler / Halberdier / Runner, Luchador / Alabardero / Corredor ; la Lice → the Lists, la Liza ; le Bourg → the Town, el Burgo ; deniers → deniers, denarios ; Combat de la Reine → Queen's Combat, Combate de la Reina ; Ligue 1 → League 1, Liga 1.
- **Ajouter du texte** : on écrit le jeu en français comme avant, puis `py -I tools/i18n/missing.py` liste les phrases sans traduction ; on les ajoute à `en.js` et `es.js`.
- **Contrôle** : un parcours automatique du jeu en anglais puis en espagnol (menus, Centre, Bourg, Taverne, Scriptorium, lice d'entraînement, Almanach complet, carnet de bord, combats, Coupe) ne laisse aucune phrase française en dehors des noms propres.

## Emblème de l'écran principal (v0.78.0)

- À chaque ouverture de la page, l'emblème au-dessus du titre est tiré au hasard : une des 15 partitions et trois couleurs distinctes de la palette (`createRandomEmblem`, le même tirage que les clubs ; `MENU_EMBLEM` dans `ui/screens/MainMenuScreen.js`).
- Il reste le même tant que la page est ouverte (retour au menu principal compris) ; un rechargement en tire un nouveau.

## Options en jeu (v0.77.0)

- **Bouton « ⚙ Options »** dans l'encart de la colonne de droite, entre « Succès » et « Sauvegarder » (au-dessus de « Menu principal »), sur tous les écrans du domaine.
- **Une fenêtre**, pas un changement d'écran : la partie reste ouverte et chaque réglage s'applique aussitôt (enregistré automatiquement). « Réinitialiser » (après confirmation) et « Fermer ».
- **Mêmes réglages** que l'écran Options du menu principal : les deux partagent `OptionsSections` (`ui/screens/OptionsScreen.js`), générées depuis `data/settingsSchema.js`. Fenêtre : `ui/components/OptionsModal.js`.
- **Sans le module Admin** en jeu : il quitte la partie ; il reste accessible depuis les Options du menu principal.

## Mesure d'audience (v0.76.1)

- **Balise Google** (gtag.js, identifiant `G-CNGBN6LNEW`) placée juste après `<head>` dans `index.html`. Elle se charge depuis googletagmanager.com à chaque ouverture du jeu, en ligne comme en local (lanceur), et ne touche à rien d'autre ; la page de tests (`tests/smoke.html`) ne la charge pas.
- Sans connexion, ou si un bloqueur l'empêche, le jeu fonctionne normalement.

## Le Centre : tri des affectations et bouton [+] du Banquet

- **Compétences au maximum** (v0.73.2) : dans le tableau des affectations, une compétence qui ne peut plus progresser s'affiche en rouge — à 100, ou au plafond fixé par le potentiel du combattant (`isStatMaxed`, `systems/fighters/stats.js`). Recalculé à chaque affichage : si le potentiel monte (ou avec le talent Prodige), la compétence redevient améliorable et perd sa couleur. Une infobulle et une légende l'expliquent ; les PV et la fatigue ne sont jamais concernés.

Depuis la v0.38.0 :

- **Tri du tableau « Affectations »** : un clic sur un en-tête trie par cette colonne ; un second clic inverse l'ordre. Colonnes : Combattant, Spécialité, Niveau, PV, FAT, LUT, HAS, PER, END.
- **Liste d'activité du tableau** (v0.68.1) : nom court du lieu (« 🎯 Mannequins (2/4) », option `compact` d'`ActivitySelect`), pour que le tableau tienne dans la largeur sans défilement. La fiche du combattant garde le nom complet (« Pôle Combat — Mannequins »).
  - Les colonnes de texte se trient de A à Z d'abord ; les colonnes chiffrées, de la plus haute valeur à la plus basse.
  - À égalité, les combattants sont départagés par leur nom.
  - La colonne triée porte une flèche ▲ ou ▼.
  - Le tri est conservé pendant la partie (jours qui passent, affectations) ; l'ordre de l'effectif, lui, ne change pas (`ui/hub/assignmentSort.js`).
- **Bouton [+] du Banquet**, posé dans la scène à droite de l'étiquette du Banquet : un clic y envoie tous les combattants dont la fatigue est **strictement supérieure** au seuil. Ceux qui sont déjà au Banquet, ou sous le seuil, restent à leur place.
  - Le seuil par défaut est 0 : tous les combattants fatigués y vont.
  - Le bouton ⚙ voisin ouvre le réglage du seuil (curseur de 0 à 100), aussi disponible dans Options › Jeu (`gameplay.banquetThreshold`). Le seuil est enregistré avec les options.
  - Le bouton est désactivé les jours de combat (Centre fermé).
  - Règle : `ActivityService.quickAssign`. Le lieu qui propose ce raccourci le déclare dans `data/activities.js` (`quickAssign: { stat, settingKey }`). Un autre lieu pourrait en recevoir un de la même façon.

### Encadrés des lieux et affectation rapide (v0.39.0)

Ces changements sont du confort de jeu seulement : gains, réussites, places, fatigue, améliorations et coûts des activités ne changent pas.

- **Encadrés masqués par défaut.** À l'ouverture du Centre, aucun encadré n'est affiché. Les lieux restent dessinés, et la carte est dégagée.
  - Au survol d'un lieu, son encadré apparaît : nom, effet, réussite, places, et désormais les combattants présents.
  - Un clic sur le lieu le **verrouille** : l'encadré reste affiché quand la souris s'en va. Un clic sur un autre lieu transfère la sélection ; un second clic sur le même lieu, un clic ailleurs ou Échap la libère.
  - Un seul encadré à la fois. Priorité : sélectionné > survolé > masqué (`CentreScreen.panelState`).
  - Le survol de l'encadré et de ses boutons garde le lieu ouvert, pour pouvoir cliquer dessus.
  - Avec un combattant sélectionné, un clic sur un lieu l'y affecte toujours, comme avant.
- **Boutons [+] et ⚙ sur tous les lieux** (Banquet, Petite lice, Mannequins, Tas de foin, Forêt, Rivière, et tout lieu ajouté plus tard). Ils n'apparaissent qu'avec l'encadré de leur lieu.
  - **Banquet** : inchangé (seuil de fatigue).
  - **Autres lieux** : ⚙ ouvre le réglage du lieu, avec la **classe ciblée** (Lutteur, Hastier, Runner ou toutes) et le **tri**. « Valider » enregistre le réglage et l'applique ; ensuite, **+** l'applique à nouveau.
  - Tris proposés : fatigue, niveau, et compétence du lieu (Lutte à la Petite lice, Arme d'hast aux Mannequins, Percussion au Tas de foin, Endurance à la Rivière), chacun croissant ou décroissant.
  - L'application place les premiers combattants retenus **dans les places libres seulement**, sans jamais dépasser la capacité ; dans un lieu sans limite, tous les combattants retenus.
  - Un combattant retenu quitte son activité précédente. Toutes les affectations passent par `ActivityService.assignActivity`.
- **Réglage de départ** :
  - lieu qui travaille l'attaque d'une classe : cette classe, niveau décroissant (ex. Petite lice → Lutteurs) ;
  - Forêt : toutes classes, niveau croissant ;
  - autres lieux : toutes classes, niveau décroissant.
  - Ces réglages sont décrits dans `data/activityAssignment.js`.
- **Données et règles** :
  - critères de tri extensibles dans `data/activityAssignment.js` (`ACTIVITY_SORT_CRITERIA`) : ajouter un critère (PV, âge, mises à terre…) se fait en ajoutant une entrée ;
  - règles dans `systems/activities/ActivityAssignmentService.js` ;
  - réglage de chaque lieu enregistré avec la partie (`session.activityAssignments`) ; les anciennes sauvegardes prennent les réglages de départ.

## Le Centre : un camp vivant (v0.40.0)

Refonte **visuelle** du Centre. Gains, réussites, places, fatigue, améliorations, coûts et règles d'affectation des six lieux ne changent pas.

- **Caméra plus proche** : camp resserré (17 × 14 cases, `data/centreLayout.js`), combattants plus grands, scène plus haute. Un lieu sélectionné rapproche la caméra (glissement progressif) ; une fois libéré, retour à la vue d'ensemble.
- **Chaque combattant s'active dans son lieu**, avec son sprite, son équipement et le tabard aux couleurs du club :
  - **Rivière** : il nage dans le courant, d'une rive à l'autre ; seul le haut du corps dépasse ; éclaboussures et cercles dans l'eau ;
  - **Banquet** : assis derrière la table, il porte un pilon à sa bouche ; miettes ;
  - **Petite lice** : les lutteurs se font face par paires et se fendent à tour de rôle ; poussière, étincelles au contact ; seul, il s'entraîne face à une place vide ;
  - **Mannequins** : il arme et frappe ; le mannequin tangue et perd de la paille ;
  - **Tas de foin** : il recule, prend son élan et charge la botte, qui s'écrase ; paille ;
  - **Forêt** : il lève la hache et fend la souche ; éclats de bois.
- **Gestes selon la classe et la fatigue** : un Lutteur s'engage davantage, un Hastier frappe de plus loin, un Runner est plus vif ; au-delà de 70 de fatigue, les gestes ralentissent (`CLASS_ANIMATION_STYLE`, `FATIGUE_ANIMATION`).
- **Jamais figé** : au repos dans la cour, un combattant respire, change d'appui, regarde autour de lui et fait quelques pas de temps en temps.
- **Déplacements** : une affectation, d'où qu'elle vienne (scène, liste, fiche, bouton [+]), envoie le combattant **à pied** vers sa place, par les allées ; retiré de son lieu, il revient à pied dans la cour. On sort du Banquet par son entrée, sans traverser la table. Chacun garde sa place quand un autre arrive ou part.
- **Le camp vit sans combattant** : vent dans les arbres, buissons et herbes ; drapeaux au vent ; fumée des feux ; feuilles qui tombent en Forêt ; courant, reflets et poisson qui saute à la Rivière ; brins de paille au Tas de foin ; poussière dorée dans la cour ; un vol d'oiseaux de temps en temps.
- **Sélection** : un combattant se sélectionne en cliquant sur sa silhouette, où qu'il soit (même en marche ou dans l'eau). Encadrés, [+] et ⚙ fonctionnent comme en v0.39 (masqué → survol → clic → verrouillé).
- **Performances** : particules plafonnées (`CENTRE_AMBIENCE.maxParticles`), décor et combattants hors du cadre non dessinés, gestes calculés sans mémoire d'une image à l'autre. Options › Effets visuels « Désactivés » : ni particules ni oiseaux (le vent et l'eau restent, ils font partie du décor).
- **Infirmerie retirée** : les PV ne baissent jamais en dehors des manches, et aucune autre règle ne dépendait d'elle. Une sauvegarde où un combattant y était encore affecté le remet au repos au chargement (`enforceActivityCapacities`).

**Architecture** — activité → contrôleur → animation, sans aucune règle de jeu dans la présentation :
- `data/centreVisuals.js` : la mise en scène de chaque lieu (`ACTIVITY_VISUALS` : `occupiedAnimation`, `byClass`, `idleAnimation`, `environmentVfx`, `interactionPoints`, `entrance`), les particules, l'ambiance, la caméra ;
- `centre/CentreVisualController.js` : constate les affectations et fait vivre chaque combattant (états `walking` / `active` / `idle`, trajets) ; l'animation se déduit de (combattant, classe, activité, état) ;
- `centre/animation/fighterAnimations.js` : les gestes, fonctions pures du temps (pose du sprite, déplacement, gerbes, réaction du décor) ;
- `centre/animation/environment.js` : vent, fumée, feuilles, oiseaux, réservoir de particules ;
- `centre/render/heldItems.js` : objets tenus (pilon, hache) ;
- `render/sprites.js` : `drawSpriteFigure` accepte une `pose` (inclinaison, miroir, écrasement, immersion).

Ajouter une animation (par arme, par saison, par niveau du lieu…) : une fonction dans `fighterAnimations.js`, puis son nom dans `ACTIVITY_VISUALS` (ou dans `byClass`).
## Effectif engagé : équipes enregistrées (v0.41.0)

Confort de jeu : les règles de composition et de combat ne changent pas.

- **Zone « Équipes »**, au-dessus des combattants de l'écran « Effectif engagé » : **Équipe Type**, puis les équipes du joueur, puis **Créer son équipe** (aucune équipe) ou **+** (1 ou 2 équipes). À 3 équipes, le bouton disparaît.
- **Création et modification** (✎) : une fenêtre demande un nom et exactement 8 combattants, avec les mêmes cartes que l'effectif. À la création, la sélection en cours est proposée au départ.
  - Le nom est nettoyé : forme Unicode normalisée, espaces superflus retirés. Il ne peut pas être vide et compte 24 caractères au plus (`SAVED_TEAM_RULES.maxNameLength`, `data/savedTeams.js`).
  - Sont refusés : moins ou plus de 8 combattants, un doublon, un combattant hors de la compagnie, une 4e équipe.
- **Rappel en un clic** : la sélection actuelle est remplacée par les combattants de l'équipe. Le bouton de la composition active est mis en évidence ; l'équipe Type l'est aussi quand la sélection correspond aux 8 meilleurs niveaux.
- **Combattant disparu** : il n'est jamais sélectionné. Le bouton affiche « 6/8 » et un message s'affiche : « Cette équipe n'est plus complète. 6 combattants disponibles sur 8. » La modification propose de le remplacer.
- **Suppression** (✕), après confirmation : seule la composition disparaît.
- Retoucher la sélection à la main ne modifie jamais une équipe ; seul « ✎ → Enregistrer » le fait.
- **Équipe Type** (l'ancien bouton « Sélection automatique », renommé « Sélection de l'équipe Type ») : les 8 combattants au plus haut niveau actuel, sans aucune contrainte de classe.
- **Données** : `session.player.savedTeams = [{ id, name, fighterIds }]`, sauvegardé avec le joueur. Seules les références des combattants sont gardées : leurs valeurs sont toujours celles du moment. Les anciennes sauvegardes démarrent sans équipe.
- **Règles** : `systems/match/SavedTeamService.js` (`createSavedTeam`, `updateSavedTeam`, `deleteSavedTeam`, `loadSavedTeam`, `validateSavedTeam`, `selectTypeTeam`).

## Une fatigue qui compte : courbatures, états, Banquet forcé (v0.75.0)

Mesure avant le changement : une compagnie qui part reposée finissait un combat avec **22** de fatigue en moyenne (9 combattants sur 10 sous 38). Or le malus de dégâts ne commence qu'à 50, et un seul repas au Banquet (−20 à −40) effaçait tout. La fatigue ne coûtait presque jamais rien.

Les règles **pendant** la manche ne changent pas (gain tour par tour, malus au-delà de 50, récupération entre deux manches) : elles sont les mêmes pour les deux camps. La pression vient **après** le combat et **au Centre**. Réglages dans `src/data/fatigue.js` (`FATIGUE_RULES`), valeurs « à valider » :

- **Courbatures du lendemain** (`FatigueService.applyMatchSoreness`, appelée par `MatchService.resolveRound` à la fin du combat) : chaque combattant du joueur qui a disputé au moins une manche prend **+15 par manche disputée**, **+10** s'il a été mis KO. Le plafond de Bon vivant s'applique. Une seule fois par combat (`match.soreness`, sauvegardé).
  - Concerne tous les vrais combats du joueur : championnat (joué ou en avance rapide), Combat de la Reine, Coupe de France. Jamais la Lice d'entraînement, ni une fatigue suivie le temps du combat (`match.playerFatigue === false`).
  - Mesure après : 44 de moyenne en partant reposé (28 % des combattants « Fatigué » ou plus) ; en partant à 40 (sans Banquet), 72 de médiane, soit « Épuisé ».
- **Trois états** (`getFatigueState`) :

| État | Fatigue | Effet |
|---|---|---|
| Reposé | sous 50 | aucun |
| Fatigué | dès 50 | malus de dégâts (inchangé) ; au Centre, réussite des entraînements et de la Forêt × 0,5 (jamais au Banquet) |
| Épuisé | dès 70 | il frappe bien moins fort ; il refuse tout lieu sauf le Banquet, et y est envoyé d'office |

  - Le talent **Sang-froid** repousse ces seuils de 10, comme celui des dégâts.
- **Banquet forcé** : un épuisé affecté ailleurs part au Banquet dès la fin du combat ; chaque matin, un épuisé encore ailleurs quitte son lieu et mange au Banquet le jour même (événement `activity.exhausted` au carnet de bord). Les affectations (liste, configurations, tableau) lui refusent tout autre lieu, avec la raison ; une configuration l'envoie au Banquet à la place et le signale. Le repos reste possible, mais ne fait toujours rien récupérer.
- **Interface** :
  - fin de combat (championnat, Reine, Coupe) : bloc « Courbatures du lendemain » (manches, KO, courbatures, fatigue, état) et liste des épuisés envoyés au Banquet ;
  - Centre : colonne Fatigue en orange (fatigué) puis rouge sombre (épuisé), avec une légende ; lieux grisés « — épuisé » dans la liste d'affectation ;
  - cartes de sélection et de placement : « Fatigue 72 / 100 · Épuisé », couleur selon l'état ;
  - carnet : « sans progrès (fatigué) » pour un entraînement manqué par fatigue ;
  - Almanach (article « La fatigue ») : courbatures et trois états, valeurs lues dans les règles.
- **Anciennes sauvegardes** : rien à migrer. Un combattant déjà épuisé partira au Banquet le prochain matin.
- **Correctif** : dans le tableau de fatigue d'une manche, un adversaire mis KO tôt (il récupère au sol) affiche désormais « −2 » et non « +-2 ».

## Le son : musiques, ambiances, effets (v0.74.0)

- **Musiques** (`assets/audio/music/`, déclarées dans `data/audio.js` › `MUSIC_TRACKS`, jouées en boucle) :

| Où | Musique |
|---|---|
| Le Centre, le Bourg, la Taverne, Ma Lice d'entraînement | Tableau de la Taverne |
| Le Scriptorium | Wistful Dawn |
| Dès qu'une manche se lance (Ligue, Reine, Coupe, lice d'entraînement), jusqu'à la fin du combat | Warlike Pulse |
| Écran principal, à l'ouverture du jeu (v0.74.1) | Tableau de la Taverne |
| Autres écrans (Compagnie, Ligue, Almanach…) | la musique en cours continue |

- **Fondus enchaînés** : jamais de coupure nette. L'ancienne musique descend pendant que la nouvelle monte (1,5, 3 ou 5 s, au choix dans les Options), et ne s'arrête qu'une fois à zéro ; une musique reprise repart où elle s'était arrêtée. En quittant un combat (ou à la fin d'un combat d'entraînement), retour en fondu à la musique du lieu.
- **Ambiances** (v0.74.1 : de vrais enregistrements, libres de droits ; plus aucun son synthétisé) : une par lieu, faite de boucles mêlées et de sons ponctuels au hasard (`AMBIENCES`) :

| Lieu | Ce qu'on entend |
|---|---|
| Le Centre | feu de camp et forêt (oiseaux) ; en hiver, le vent dans les arbres remplace la forêt |
| Le Bourg | un marché |
| La Taverne | conversations, rires, chopes, et l'âtre |
| Le Scriptorium | un âtre étouffé et des pages tournées de temps en temps |
| Ma Lice d'entraînement | le vent dans les arbres et des mannequins frappés |
| La Lice | la foule, avec des applaudissements |
| Le Château de Gabarnac, combats de Coupe | une grande foule, avec des applaudissements |

  - Boucles sans couture : extraits d'environ 1 min 30 dont la fin est fondue sur le début ; décodées et rebouclées sans blanc, elles partent d'un endroit au hasard à chaque visite.
  - D'un lieu à l'autre, les ambiances se fondent aussi.
- **Les ambiances restent sous la musique** : leur bus a un plafond (`ambienceCeiling`) et baisse encore tant qu'une musique joue (`ambienceUnderMusic`) — par défaut 0,18 contre 0,7 pour la musique (`busLevels`).
- **Effets** (vrais enregistrements) : coups sur l'armure et le métal (6 variantes), gros coups (4), KO (3), fanfare de victoire (ouverture d'un thème médiéval, 8 s en fondu), cloche à l'annonce d'un exploit. Chaque son est tiré parmi ses variantes et légèrement transposé, pour éviter la répétition. Les coups et KO suivent le rejeu de la manche ; « Passer à la fin » ne déclenche pas d'avalanche, et une mêlée est limitée à 8 coups audibles par seconde.
- **Crédits** (`AUDIO_CREDITS`, tous en licence **CC0** — utilisables sans condition, crédit facultatif) :
  - Joseph Sardin, BigSoundBank (bigsoundbank.com) : feu, forêt, marché, café, âtres, vent dans les arbres, foules, applaudissements (sons n° 0989, 2749, 2729, 0480, 2855, 0030, 0904, 2969, 2970, 3523, 0019, 0021) ;
  - Kenney (kenney.nl), packs Impact Sounds et RPG Audio : coups, KO, cloche, mannequins, pages ;
  - RandomMind (opengameart.org), « Medieval: Victory Theme » : la fanfare.
  - Préparation (découpe, raccord des boucles, volume harmonisé, MP3) faite avec ffmpeg ; fichiers dans `assets/audio/ambience/` et `assets/audio/sfx/`.
- **Options** (Audio) : volume général, musique, ambiances, effets, durée du fondu, couper le son. Tout est enregistré avec les options.
- **Navigateur** : le moteur essaie de lancer la musique dès l'ouverture du jeu ; si le navigateur l'interdit (le cas le plus courant), elle démarre au premier clic ou à la première touche sur l'écran principal.
- **Code** : `audio/AudioEngine.js` (Web Audio : bus, fondus, ambiances en couches, effets à variantes) ; `audio/AudioDirector.js` (aiguillage selon l'écran et les moments : `onScreen`, `startMoment('roundStart')`, `endMoment`, indices sonores du rejeu `buildCombatCues` / `playCombatCues`). Les écrans annoncent un moment ; les données disent ce qu'on entend.

## Succès (v0.73.0)

- **Catalogue** : 40 succès (`data/achievements.js`), numérotés, chacun avec une catégorie (combat, compétition, économie, améliorations, combattants, monde, Centre), une difficulté (11 faciles, 18 moyens, 11 difficiles ; v0.73.1 : n° 3, 6, 35 et 36 passés en Facile) et une icône. Les seuils sont réglés dans `ACHIEVEMENT_RULES`.
- **Une seule fois** : un succès obtenu est enregistré avec la partie (`session.achievements.unlocked[id] = { day, year, climateSeason, leagueSeason }`) et ne peut plus être obtenu de nouveau.
- **Pendant un combat** (v0.73.1) : les succès obtenus en cours de combat sont retenus (`holdAchievementAnnouncements`, écran de combat) et ne se dévoilent qu'à l'écran du résultat final, ou en quittant le combat.
- **Notification** : dès qu'il est obtenu dans la partie en cours (hors combat), un bandeau doré « Exploit accompli » s'affiche, avec son médaillon (`ui/components/AchievementToast.js` ; plusieurs succès s'annoncent l'un après l'autre). Obtenu pendant une journée, il entre aussi au carnet de bord (tuile « Succès », ouverte en premier).
- **Où les voir** : bouton « 🏅 Succès (n / 40) » dans l'encart Sauvegarde / Menu principal de tous les écrans du domaine. La fenêtre (v0.73.2) est la « Salle des exploits » :
  - un bandeau d'avancement (exploits accomplis, barre dorée, dernier exploit) et trois onglets : Tous, Obtenus, À conquérir ;
  - les succès rangés par catégorie, chacun en médaillon : doré et brillant une fois obtenu (avec sa date), de fer tant qu'il reste à conquérir (avec sa progression s'il a un seuil) ;
  - **ni numéro, ni difficulté** ne sont montrés au joueur, et il n'y a plus de tri par difficulté (ce sont des données internes) ;
  - **exploits secrets** : les succès difficiles restent visibles (nom, médaillon scellé « ? »), mais leur condition et leur progression sont cachées et remplacées par une phrase d'ambiance (`teaser`, `data/achievements.js`) ; elles se révèlent une fois l'exploit accompli (et dans son annonce).
- **Logique** : `systems/achievements/AchievementService.js`, branché aux endroits où les choses arrivent :

| Moment | Où | Succès |
|---|---|---|
| Manche jouée dans la Lice | `MatchService.resolveRound` (manche avec simulation du moteur) | 1, 2, 3, 5, 6, 7, 33, 36 |
| Combat terminé (toutes compétitions) | `MatchService.resolveRound` | 4, 35 (combats joués), 8, 40 |
| Combat de la Reine | `QueenCombatService.resolveQueenCombat` | 9, 37 (étoiles de l'adversaire au tirage) |
| Fin de saison | `SeasonService.finalizeSeason` | 10, 11, 12, 38 |
| Coupe de France | `FrenchCupManager.advanceStep` | 13, 14 |
| Recrutement | `TavernService.recruit` | 21, 39 |
| Achat au Bourg | `ShopService.buyItem`, `UpgradeService.purchaseUpgrade` | 17, 18, 20 |
| Second Bureau d'étude | `ScriptoriumUpgradeService.buyDeskUpgrade` | 19 |
| Talent révélé | `StudyService.completeDueStudies` | 22, 23, 24, 30 |
| Fin de journée | phase `achievements` (la dernière) | 15, 16, 25, 26, 27, 28, 29, 31, 32, 34 et tous les succès d'état |

- **Combats simulés** : les succès de manche (1 à 7, 33, 36) et 4, 35 ne comptent que les combats joués dans la Lice.
- **Compteurs** (`session.achievements.counters`) : achats au Boulanger, activités réussies au Centre, talents ordinaires découverts (au Scriptorium ou portés par une recrue ; un talent compte une fois, même remplacé ensuite), saisons de l'année où un combat a été gagné.
- **Anciennes sauvegardes** : les compteurs partent de 0. Au chargement, les succès qui se lisent dans la partie (deniers, améliorations, talents, étoiles, statut Élite, potentiel, trophées, palmarès, jour 101) sont accordés et annoncés au premier écran du domaine ; ceux liés à un événement ne comptent qu'à partir de maintenant.
- **Faisabilité du n° 37** : les clubs à 5 étoiles se trouvent aujourd'hui dans le vivier « Hors championnat » des combats de la Reine (tiré une fois sur deux).
## Deux talents par combattant (v0.72.0)

- **Règle** : chaque combattant du joueur peut avoir **deux talents** (`TALENT_RULES.maxPerFighter = 2`). Ils se révèlent comme le premier : par une étude au Bureau d'étude du Scriptorium (mêmes durées selon le potentiel, mêmes chances selon l'artefact, mêmes places).
- **Coûts** :
  - premier talent : étude gratuite ;
  - second talent (le combattant a déjà un talent) : étude **gratuite** ; le second talent s'ajoute au premier, jamais le même ;
  - remplacement (le combattant a ses deux talents) : **500 deniers**. On choisit le talent à remplacer, **premier ou second** ; il le garde jusqu'à la révélation, l'autre reste acquis.
- **Effets** : ceux des deux talents s'ajoutent, selon les règles habituelles (bonus de dégâts additionnés, statistiques de combat…).
- **Recrues de la Taverne** : elles arrivent toujours avec un talent au plus ; leur second se révèle au Scriptorium, gratuitement.
- **Détails** : voir « L'étude » plus bas (tableau, données, anciennes sauvegardes).
- **À valider** : deux talents peuvent cumuler leurs effets (par exemple deux bonus de dégâts finaux) ; aucun plafond particulier n'est appliqué.
## Écussons, fatigue en Coupe de France et Ma Lice d'entraînement (v0.71.0)

### Écussons : 15 partitions

- **Catalogue unique** : `data/emblemPatterns.js` (`EMBLEM_PATTERNS`), lu par la création du club (`NewTeamScreen`) et par le Module Admin (Gestion des clubs). Une partition ajoutée là apparaît partout.
- **Les 15 partitions** :
  - les 8 d'origine : Tiercé en pal, en fasce, en bande, Au chef et au pal, À la croix, Au sautoir, Au chevron, Écartelé ;
  - 7 nouvelles : **Émanché**, **Tiercé en barre**, **Tiercé en pairle**, **Chapé**, Coupé, Tranché, Taillé.
  - Chacune se dessine avec les 3 couleurs du club.
- **Affichage** : grille de 5 colonnes × 3 rangées (`.pattern-list`), 3 colonnes sur petit écran. L'aperçu se met à jour au clic.
- **Sauvegardes** : l'identifiant de la partition est enregistré tel quel ; un identifiant inconnu retombe sur la partition par défaut (`getEmblemPattern`).

### Coupe de France : fatigue remise à zéro au départ

- **Règle** : au début de chaque édition (`createEdition`), la fatigue de **tous** les combattants du joueur passe à 0 (`resetCupFatigue`, `systems/frenchCup/FrenchCupManager.js`).
- **Une seule fois** : le drapeau `cup.fatigueReset` est sauvegardé avec la Coupe. Un rechargement ne refait jamais la remise à zéro.
- **Ensuite, la vraie fatigue** (v0.73.1) : les combats de Coupe du joueur utilisent la vraie fatigue des combattants (`Match.playerFatigue = true`). Elle se garde d'un combat à l'autre, avec les règles habituelles (fatigue tour par tour, récupération entre deux manches) ; elle n'est plus remise à 0 entre deux tours. Les adversaires de Coupe partent reposés à chaque combat. Pendant la Coupe, le domaine est fermé : le Banquet n'est pas accessible, seuls les objets du Coffre (Pain au méteil) font redescendre la fatigue.
- **Ensuite** : les règles habituelles s'appliquent (fatigue des combats, repos…).

### Ma Lice d'entraînement

Un nouveau lieu du domaine, pour opposer ses propres combattants et comprendre le combat, **sans aucune conséquence** sur la partie.

- **Accès** : le chemin bas-gauche du Centre (entre la Forêt et la Rivière), autrefois fermé, mène à la lice. Il compte deux cases cliquables au bord de la carte (1 × 2, comme les autres chemins) et un poteau indicateur (sortie `centre_exit_south_west`, `data/locations.js`). Le chemin de droite de la lice (`training_path_east`) ramène au Centre, par le même fondu que les autres voyages.
- **La carte** (`ui/screens/TrainingScreen.js`, `training/TrainingRenderer.js`) :
  - une carte de 17 × 14 cases, comme le Centre : la lice 13 × 8, la bande des spectateurs, puis 1 case de décor à l'est et à l'ouest et 2 au nord et au sud (`layout.ringDepth`, nouveau : la ceinture de décor peut différer entre les côtés est/ouest et nord/sud ; `liceScenery` renvoie `offset: { x, y }`) ;
  - la lice en vue isométrique avec son décor dédié (`lice_training`, `data/liceDecorations.js` : mannequins, râteliers, tentes, bannières, feu de camp…), réservé à ce lieu ;
  - quelques compagnons qui regardent ;
  - le décor suit la saison de l'année (neige, feux éteints, feuilles…).
- **Le Marshal** (`MARSHAL`, `data/training.js` ; sprites `assets/sprites/training/`) :
  - tenue jaune à rayures noires, chapeau jaune, bâton à drapeau jaune ;
  - il se tient **dans la lice**, bien en vue, un peu plus grand qu'un spectateur ; il fait sa ronde au milieu du terrain, s'arrête et lève parfois son drapeau ;
  - il est trié en profondeur avec les combattants (`IsoRenderer.extraActors`) : jamais dessiné par-dessus eux ;
  - au survol : halo et étiquette ; au clic, il ouvre la préparation d'un combat (le bouton « Parler au Marshal » sous la carte fait de même) ;
  - pendant un combat, il se poste au milieu du bord arrière de la lice, loin des zones de placement (aux deux bouts), et donne le signal de départ.
- **Préparation** :
  1. choix du format : 1 contre 1, 3 contre 3 (par défaut) ou 5 contre 5 ;
  2. choix de la fatigue de départ : fatigue actuelle (par défaut) ou reposés ;
  3. composition des deux camps, A puis B (onglets, compteurs « encore N »), avec les cartes et filtres habituels. Un combattant ne peut être que dans un seul camp ; un combattant en étude au Scriptorium ne combat pas ;
  4. récapitulatif : format, camps, puis « Modifier la composition », « Lancer le combat » ou « Annuler ».
- **Combat** (`systems/training/TrainingCombatService.js`, `runTrainingCombat`) :
  - le **même moteur** que les combats officiels : placement automatique, `simulateRound`, IA, talents de combat, fatigue de la manche ;
  - les unités sont **temporaires**. Rien n'est écrit dans la partie : ni fatigue, ni statistiques, ni palmarès, ni mises à terre (aucun `onKnockout`), ni deniers, ni classement, ni calendrier ;
  - aucune règle de saison (`TRAINING_RULES.season = null`) : la saison ne change que le décor ;
  - le camp B porte des tabards contrastés (azur, ou gueules si la compagnie porte déjà l'azur).
- **Rejeu** : le même que dans la Lice (vitesses ×1/×2/×4, vue d'ensemble, « Passer à la fin »). À la fin, trois choix : « Relancer le même combat » (mêmes camps, nouveau tirage), « Modifier la composition » ou « Revenir à la lice ». On peut aussi quitter la lice par son chemin.
- **Journal détaillé** (`ui/report/trainingJournal.js`) :
  - case à cocher « Afficher le journal détaillé du combat » ;
  - console avec défilement, chronologique, qui se remplit au rythme du rejeu (début, attaques, renversements, survies à 1 PV, KO, temps morts, fin) ;
  - pour chaque coup : l'action, l'attaque et la défense avec leurs statistiques, les bonus déjà compris, les dégâts de base, l'aléa et le combo, la fatigue, le bonus final détaillé (position, objet, talents, réduction, saison), puis la valeur brute, l'arrondi et les PV restants ;
  - **valeurs reprises du moteur**, jamais recalculées : `computeDamage` renvoie aussi `raw`, `attackStat` et `defenseStats`, et le détail du coup porte `modifiers` ;
  - mémoire bornée : 800 entrées au plus (`journalMaxEntries`) ; le début est toujours gardé ;
  - les données sont temporaires et ne sont jamais ajoutées à l'historique du club.
- **À valider** :
  - la saison est ignorée dans les règles de l'entraînement ;
  - la fatigue de départ « actuelle » par défaut ;
  - la lice reste ouverte les jours de combat ;
  - « Relancer le même combat » rejoue les mêmes camps avec un nouveau tirage.

## Les quatre saisons de l'année (v0.70.0)

À ne pas confondre avec la **saison de championnat** (`league/SeasonService.js`) : les saisons de l'année tournent en continu, indépendamment des championnats.

### Calendrier

- **Durée** : une année dure 100 jours, en 4 saisons de 25 jours (`data/climate.js`, `CLIMATE_YEAR`). Jours 1–25 : été ☀ (jaune) ; 26–50 : automne 🍂 (orange) ; 51–75 : hiver ❄ (bleu neige) ; 76–100 : printemps 🌱 (vert). Au jour 101, l'été de l'année 2 commence.
- **Une partie** commence au jour 1, donc au premier jour de l'été.
- **Saison déduite du jour** (`systems/climate/ClimateService.js`, `getSeasonForDay`) : aucun compteur à part, rien ne peut se désynchroniser. Une ancienne sauvegarde garde son jour (jamais ramenée au jour 1) et reçoit la saison qui correspond.
- **Affichage** : la pastille de saison (icône + nom, lisible sans la couleur) s'affiche sous le jour, en haut à gauche. Chaque jour de la frise porte un liseré à la couleur de sa saison, et le premier jour d'une saison son icône.
- **Passage de saison** (phase `climate-season` de la journée, après les activités : le travail de la veille est réglé selon les règles de la veille) :
  - il est traité une seule fois (`session.climate.lastTransitionDay`, sauvegardé) ;
  - les affectations devenues impossibles sont libérées : les combattants passent au repos, sans être réaffectés ailleurs ;
  - une entrée est ajoutée au carnet de bord. Elle est mise en avant et nomme les combattants libérés ; le sceau du jour devient « ❄ L'hiver commence ».
  - Un rechargement ne recrée jamais la notification.
  - Au chargement (`ensureClimateState`), une affectation impossible (ancienne sauvegarde chargée en été…) est libérée sans notification.

### Règles (centralisées dans `data/climate.js`, appliquées par `ClimateService`)

| Saison | Le Centre | Combat |
|---|---|---|
| Été | Rivière asséchée : fermée | Hastiers −10 % d'efficacité (chaleur) |
| Automne | — | Runners −10 % d'efficacité (terrains humides) |
| Hiver | Forêt enneigée : fermée ; feux de camp éteints | — |
| Printemps | — | — |

- **Lieu fermé** : l'affectation est refusée avec la raison (« La rivière est asséchée en été. »), y compris par le bouton [+] et les configurations, qui signalent l'élément ignoré. La liste d'activité marque le lieu « fermé (été) ». La carte du lieu affiche « Fermé pour la saison », et l'étiquette de la scène aussi. À la réouverture, personne n'est renvoyé d'office.
- **Efficacité** (`combatSeasonFactor`) :
  - en combat joué, elle multiplie les dégâts finaux dans un ordre unique : `(1 + bonus additionnés) × (1 − réduction de la cible) × efficacité saisonnière` ;
  - dans les combats simulés, elle multiplie le niveau effectif de chaque combattant (`calculateLineupLevel(…, { season })`).
  - Les statistiques enregistrées ne changent jamais. Le malus s'affiche dans « Bonus au lancement » et sur les coups (« ☀ −10 % »).

### Talents saisonniers (8)

Ils sont dans `data/talents.js` (`season` sur le talent et sur chaque effet), obtenus par l'étude et la Taverne comme les autres, et sauvegardés pareil. Un effet saisonnier n'est actif que pendant sa saison (`TalentEffects.isEffectActive` ; sans saison connue, il est ignoré). Le nouveau type d'effet `seasonImmune` annule la pénalité saisonnière de la classe.

| Talent | Famille | Saison | Effet |
|---|---|---|---|
| Peau tannée | Ordinaire | Été | +5 % de dégâts finaux |
| Pas feutré | Ordinaire | Automne | +10 % de vitesse dans la lice |
| Sève nouvelle | Ordinaire | Printemps | +8 % de réussite au Centre |
| Fils du soleil | Rare | Été | Pénalité d'été annulée, +5 % de HAS |
| Coureur des brumes | Rare | Automne | Pénalité d'automne annulée, +5 % de dégâts finaux |
| Sang chaud | Rare | Hiver | +10 % d'Endurance, −5 % de dégâts reçus |
| Cœur de l'hiver | Épique | Hiver | +12 % de dégâts finaux pour lui, +4 % pour sa manche |
| Maître des saisons | Épique | Toute l'année | Aucune pénalité saisonnière, +4 % de dégâts finaux, +5 % de réussite au Centre |

- Les bonus de statistiques passent par les statistiques de combat, et les bonus de dégâts par les dégâts finaux : rien n'est compté deux fois.
- Hors de sa saison, le talent reste sur la fiche avec l'icône de sa saison, estompé (« inactif en ce moment »).
- **À valider** : le catalogue et les valeurs.

### Habillage visuel

- **Fichiers** : `data/climateVisuals.js` (palettes, détails, eau, météo, ciel) ; `render/seasonLook.js` (transformation des couleurs, détails au sol, eau, météo) ; `render/propRenderers.js` (décors partagés). La géométrie, les zones cliquables, les collisions et les animations ne changent pas.
- **Principe** : chaque vue porte sa saison (`view.season`). Le Centre la lit dans la partie, le Bourg la reçoit de son écran, et les lices la reçoivent de leur présentation (`buildLicePresentation`, combats de championnat, de la Reine et de Coupe). La Taverne et le Scriptorium n'en reçoivent jamais. La vitrine du menu principal garde l'aspect d'origine.
- **Été** : herbe jaunie, sols secs avec fissures et brins de paille, feuillage terne. La rivière du Centre est un lit asséché et fissuré, sans courant, sans poisson.
- **Automne** : arbres roux, rouges ou dorés (quelques conifères restent verts), feuilles mortes au sol, flaques sur les chemins, ciel couvert, feuilles qui tombent.
- **Hiver** :
  - neige au sol (l'arène des lices en reçoit moins, pour rester lisible), congères ;
  - sapins, buissons, toits, tentes, auvents et scierie enneigés ;
  - rivière froide aux plaques de glace (pas de gel complet) ;
  - feux de camp éteints : bûches noircies, cendres, ni flamme ni fumée ;
  - neige qui tombe.
- **Printemps** : herbe fraîche, pousses et fleurs, arbres en fleurs, pétales dans l'air ; les feux se rallument.
- **Contrôle** : Administration › La Lice (aperçu) propose un choix « Saison » pour voir les quatre variantes de chaque décor.

## Gestion de la compagnie : filtres, configurations du Centre, historique et palmarès (v0.69.0)

Quatre évolutions, toutes construites sur les données existantes (aucun compteur parallèle).

### Entraînement devenu inutile (carnet de bord et Centre)

- **Règle unique** : `ActivityService.isTrainingUseless(fighter, activity)`. Vrai quand le lieu fait progresser une **compétence** (Lutte, Hast, Percussion, Endurance) que le combattant a déjà portée au plafond de son **potentiel** (`isAtPotentialCap`). Le Banquet et la Forêt ne sont jamais concernés. Le niveau actuel n'entre pas en compte : un combattant fort mais loin de son plafond s'entraîne normalement.
- **Carnet de bord** : le combattant garde sa pastille dans la tuile du Centre, en gris foncé (« entraînement inutile », info-bulle avec le message). Sous les pastilles, une note explicite par combattant : « Entraînement inutile : Guillaume de Caen a atteint son potentiel maximal en HAS (Mannequins) ; cet entraînement ne le fait plus progresser. » Les autres cas « au mieux » (fatigue à 0, statistique à 100) ne changent pas.
- **Le Centre** : sous la liste d'activité du tableau des affectations, la mention « Entraînement inutile : potentiel atteint ». Elle est recalculée à chaque affichage : elle suit l'affectation et la progression du combattant.

### Filtres des combattants (effectif engagé, éditeur d'équipe)

- **Service** : `systems/fighters/FighterListFilter.js` (`organizeFighters`). Composant : `ui/components/FighterFilterBar.js`.
- **Classe** : toutes, ou chaque spécialité du jeu (Lutteurs, Hastiers, Runners ; une nouvelle spécialité apparaît d'elle-même).
- **Tri** : ordre de la compagnie, niveau décroissant ou croissant, nom, potentiel décroissant, fatigue croissante ou décroissante. Les tris par fatigue ne sont pas proposés dans l'éditeur d'équipe : c'est un état du moment, alors que l'équipe sert plus tard.
- **Comportement** : classe et tri se combinent ; « Réinitialiser » revient à l'affichage complet ; le compte « 4 affichés sur 9 » s'affiche quand un filtre est posé.
- **Sélection** : les filtres ne la modifient jamais. Un combattant sélectionné qui ne correspond plus au filtre reste affiché après les autres, en pointillés, avec la mention « hors filtre ». Le compte « 8 / 8 sélectionnés » reste visible.
- **À valider** : la barre de filtres est placée entre le titre « Combattants » et les cartes, et non sous la liste comme l'écrivait la spécification. Sous 8 à 20 cartes, elle serait hors de vue.

### Équipes enregistrées

Les fonctions demandées existaient déjà depuis la v0.41 : créer, nommer, modifier, supprimer avec confirmation, rappeler, et conserver après rechargement. Les nouveautés :

- les filtres ci-dessus, dans l'éditeur ;
- une équipe incomplète dit pourquoi : « Cette équipe n'est plus complète. 6 combattants disponibles sur 8 — 1 a quitté la compagnie ; en étude au Scriptorium : Amaury d'Arras. Les autres restent sélectionnés. »

Limites inchangées : 3 équipes de 8 combattants (`data/savedTeams.js`).

### Configurations d'affectation du Centre

- **Données** : `session.player.assignmentPresets`, soit `[{ id, name, assignments: [{ fighterId, activityId | null }], resetOthers }]`, sauvegardées avec le joueur. Elles ne contiennent que des références. Ce modèle est distinct de celui des équipes enregistrées. Les anciennes sauvegardes n'ont aucune configuration. Service : `systems/activities/AssignmentPresetService.js` ; règles : `data/assignmentPresets.js` (6 configurations au plus, 24 caractères).
- **Interface** (tableau des affectations, rubrique « Configurations ») :
  - un bouton par configuration l'applique d'un clic ; son info-bulle décrit la répartition ;
  - ✎ renomme la configuration, remplace son contenu par les affectations du moment, et règle l'option des absents ;
  - ✕ supprime la configuration, après confirmation ;
  - « + Enregistrer » capture les affectations actuelles (repos compris).
- **Application** (`planAssignmentPreset`, puis écriture) : tout est calculé avant d'écrire, ce qui la rend atomique.
  - Les combattants absents de la configuration (recrues arrivées depuis) gardent leur affectation. Avec l'option « Mettre au repos les combattants absents », ils passent au repos.
  - **Places** : les combattants hors configuration gardent leur place. Ceux de la configuration sont placés dans l'ordre enregistré ; au-delà des places, ils passent au repos, et c'est signalé (« Forêt complet : Thierry au repos »).
  - Un combattant parti, un lieu disparu ou un combattant en étude au Scriptorium sont ignorés et signalés ; leur affectation ne change pas. La configuration elle-même n'est jamais corrigée en silence, et son bouton porte ⚠ avec le nombre d'éléments devenus invalides.
  - Les jours de combat, le Centre est fermé : les configurations ne s'appliquent pas, mais on peut les enregistrer et les modifier.

### Historique des clubs harmonisé

Même présentation pour la Ligue et la Coupe de France (`ui/components/ClubHistory.js`, `formatHistoryEntry`) :

- **Saison 3** — 1er — Ligue 3 — Promotion en Ligue 2
- **Saison 4** — 8e — Ligue 2
- **Saison 4** — Quart de finale — Coupe de France

Règles :
- La saison est en gras, en premier. Une mention de promotion ou de relégation n'apparaît que si elle a eu lieu, et jamais pour la Coupe.
- Le stade de Coupe vient du stade enregistré (`cupStageName` : Phase de poule, Seizième, Huitième, Quart de finale, Demi-finale, Finaliste, Vainqueur), et non du libellé stocké. Les anciennes entrées s'affichent donc au nouveau format sans être réécrites.
- Les séparateurs « — » font partie du texte, pour la lecture d'écran et la copie.

### Palmarès des fiches de club

- **Place** : en haut à droite de l'en-tête de la fiche d'un club (joueur ou IA), à côté de l'emblème et des étoiles.
- **Distinctions** (`data/trophies.js`) :
  - les trophées de l'armoire : Calice d'or de la Coupe, Ligue 1, Ligue 2, Ligue 3 ;
  - des **rubans** propres aux fiches : 2e place en Ligue (argent, « 2 »), 3e place en Ligue (bronze, « 3 »), finaliste de la Coupe (or, étoile, queues bleues). Dessin : `render/trophies.js`, `drawRibbon`.
  - Chaque distinction s'affiche avec son nombre (« ×2 ») ; les trophées d'abord, puis les rubans après un séparateur. Une distinction que le club n'a pas n'est pas affichée ; un club sans aucune distinction n'affiche pas de palmarès.
- **Aucune saison** n'apparaît. L'info-bulle d'un ruban de place détaille les Ligues (« Ligue 1 ×1, Ligue 2 ×1 »).
- **Calcul** (`systems/trophies/PalmaresService.js`, `computePalmares`) : il est déduit à chaque affichage de l'historique du club (`session.clubHistory`), et jamais enregistré. Un rechargement ne peut donc rien dupliquer.
- **Lien avec l'armoire de la Taverne** : elle garde son propre registre (`session.trophies`). Elle reste propre à la compagnie du joueur et présente ses trophées un par un, avec leur saison.
- **À valider** :
  - les rubans de 2e et de 3e place sont communs aux trois Ligues (une 2e place en Ligue 3 vaut le même ruban qu'en Ligue 1), comme dans la liste de la spécification ;
  - le palmarès est affiché dans la fiche de club, qui s'ouvre depuis les classements, y compris pour sa propre compagnie ; l'écran « La Compagnie » ne l'affiche pas.

## Plafond des compétences selon le potentiel (v0.42.0)

Le potentiel (0 à 3 flammes) fixe jusqu'où les **compétences** (Lutte, Hast, Percussion, Endurance) peuvent progresser :

| Potentiel | Plafond | Libellé affiché |
|---|---|---|
| 0 flamme | 55 | modeste |
| 1 flamme | 70 | honorable |
| 2 flammes | 85 | élevé |
| 3 flammes | 100 | sans limite |

- **Au-delà, plus aucun gain.** La règle est appliquée dans `improveStat` / `canImproveStat` (`systems/fighters/stats.js`), le passage obligé de toute progression. PV et fatigue ne sont pas concernés.
- **Le plafond suit le potentiel actuel** : une flamme gagnée le relève ; un vétéran qui perd une flamme plafonne plus bas.
- **Valeur déjà au-dessus** (anciennes sauvegardes, flamme perdue) : elle est conservée, mais ne progresse plus. Aucune valeur n'est jamais réduite.
- **Au Centre** : un combattant au plafond n'est pas tiré au sort. Le carnet l'indique (« Déjà au mieux : Raoul (Petite lice, LUT au plafond de son potentiel) »).
- **Affichage sans chiffre** :
  - la fiche indique « Potentiel 🔥🔥 · plafond élevé » ;
  - sur les barres de compétences, la partie hors de portée est hachurée ;
  - 🔥 marque une compétence arrivée au plafond.
- **Combattants sans potentiel** (clubs de l'IA, définis par un score) : non concernés.
- Réglages : `POTENTIAL_CONFIG.skillCaps` et `skillCapLabels` (`data/fighterProfile.js`). L'Almanach (« L'âge et le potentiel ») présente le tableau des libellés.
## Écran principal : vitrine, Patch Notes, Administration (v0.43.0)

**Patch Notes**
- Le bouton **Patch Notes** se trouve sous le numéro de version. Il ouvre l'historique des évolutions, de la plus récente à la plus ancienne.
- Rubriques : nouvelles fonctionnalités, améliorations, modifications de gameplay, équilibrage, évolutions graphiques, corrections. Une rubrique vide n'est pas affichée.
- **Versions majeures seulement** (v0.76) : la fenêtre ne présente que 0.4, 0.5, 0.6, 0.7, 0.8… Chacune regroupe les versions qui la **précèdent** (0.6 = 0.51 à 0.60.x ; 0.7 = 0.61 à 0.70.x ; `getMilestoneId`) et n'affiche que ses grosses évolutions, écrites dans `PATCH_MILESTONES` (mêmes rubriques). Sous le titre : « Regroupe les versions 0.51 à 0.60.1 », la date de la dernière. Tant que son numéro n'est pas atteint (0.8 pendant les 0.7x), la majeure porte la mention « En cours » ; celle qui contient la version du jeu porte « Version actuelle ». Un test vérifie que chaque version détaillée a sa majeure et qu'une majeure garde 10 évolutions au plus.
- **Données** : `data/patchNotes.js`. Ajouter une version = ajouter son détail dans `PATCH_NOTES` (`{ version, date, title, newFeatures[], improvements[], gameplayChanges[], balanceChanges[], graphics[], fixes[] }`, gardé pour mémoire, plus affiché) et, si elle compte, une ligne dans la majeure qui la contient (`PATCH_MILESTONES`), sans toucher à l'interface.
- **Historique minimal** (détail des versions, `getDisplayedPatchNotes`) : `PATCH_NOTES_MIN_VERSION = '0.42.0'`. Les versions majeures, elles, remontent jusqu'à 0.4.
- Tri et filtre : `systems/patchNotes/PatchNoteService.js` (comparaison numérique : 0.100.0 > 0.42.0). Regroupement : `getDisplayedMilestones`. Affichage : `ui/components/PatchNotesModal.js`.

**Vitrine (arrière-plan animé)**
- De chaque côté du menu passent de courtes séquences de 3 à 6 secondes, chacune avec un fondu au noir à l'entrée et à la sortie :
  - le camp : Rivière, Banquet, Pôle Combat, Forêt, vue d'ensemble avec un combattant qui se déplace ;
  - la Taverne ;
  - des combats : 1 contre 1, 2 contre 2, mêlée à 4 contre 4 ;
  - un survol du Bourg.
- Les deux côtés sont décalés et ne montrent jamais la même séquence en même temps ; une même séquence ne passe jamais deux fois de suite.
- **Séquences rendues en direct** par les moteurs du jeu, avec deux clubs de démonstration générés pour l'occasion. Rien n'est lu ni écrit dans une partie. Les combats sont de vraies manches simulées par le moteur de combat, avec une caméra qui suit la mêlée.
- **Fichiers vidéo acceptés** : une entrée `{ source: { type: 'video', path: 'assets/videos/….webm' } }`. La vidéo est lue sans son et recadrée sans déformation. Un fichier absent ou illisible est écarté et la séquence suivante prend le relais.
- **Configuration** : `data/mainMenuShowcase.js`.
  - `MAIN_MENU_VIDEOS` : `id`, `category` (CAMP, TAVERNE, COMBAT, BOURG), `source`, `duration`, `position` (left, right, any), `priority`, `enabled`.
  - `SHOWCASE_TIMING` : fondus, noir entre deux séquences, opacité maximale (0,58), démarrage différé, 30 images/s.
- **Fonctionnement** : `ui/mainMenu/` — rotation (`showcaseRotation.js`), scènes (`showcaseScenes.js`), lecteur (`MainMenuShowcase.js`).
  - Une seule séquence par côté existe à la fois : elle est créée à son tour et détruite à la fin.
  - Le démarrage est différé : le menu répond tout de suite.
  - En quittant l'écran, tout est arrêté et libéré.
  - Les zones sont masquées sur un écran étroit (moins de 960 px) et ne recouvrent jamais le menu.
- **Désactivation** : Options › Affichage › « Animations de l'écran principal ». La vitrine est aussi coupée si le système demande moins d'animations.

**Administration**
- Le bouton « Module Admin » quitte l'écran principal. L'accès se fait par **Options › Administration › Ouvrir le module Admin**.
- Même code, même module, mêmes outils (`ui/admin/adminAccess.js`).
## Placement dans la Lice : écran tactique (v0.46.0)

Le placement tient sur un seul écran, **sans défilement**. Vérifié en 1280 × 720, 1440 × 900 et 1920 × 1080.

```
[en-tête compact : clubs, score, étapes]
[Manche N — placement · Formation (une ligne) · règle courte · décor et affluence]
[MON ÉQUIPE (5)]   [LA LICE]   [ADVERSAIRES (5)]
[état du placement · Modifier la sélection · Placement automatique · Le Coffre · Lancer la manche]
```

- **Cartes compactes** (`ui/components/PlacementFighterCard.js`) : le même composant sert à nos combattants et aux adversaires. Chaque carte montre le sprite, le nom (avec la couronne du capitaine), la classe, les étoiles, la fatigue du combat, les effets (🍷) et l'état.
- **États** :
  - à placer ;
  - **à placer maintenant** (sélectionné, en doré) ;
  - placé (🔒, grisé, non modifiable) ;
  - en attente pendant le tour adverse ;
  - adversaire « vient d'être placé » (encadré doré).
- **Compteurs** « 2 / 5 placés » au-dessus de chaque colonne. La barre d'état passe au vert quand tout est en place, et au rouge pendant le tour adverse.
- **Caméra** resserrée sur la lice pendant le placement : les cases sont plus grandes et le décor reste en bordure. La hauteur de la lice s'adapte à la fenêtre.
- **Rappel des classes** sur une ligne ; le détail (statistique d'attaque, bonus) est dans l'infobulle. La règle complète du placement est dans l'infobulle du titre.
- **Petites largeurs** :
  - jusqu'à 1 180 px, colonnes plus étroites, sans la pastille de fatigue ;
  - jusqu'à 860 px, les deux équipes passent côte à côte au-dessus de la lice ; jamais de défilement horizontal.
- **Règles inchangées** : alternance joueur / IA, case libre de sa zone, combattant posé non déplaçable, lancement une fois les 10 combattants placés. Les adversaires ne font que changer de place à l'écran.
## IA de combat : 8 profils intelligents (v0.67.0)

Les profils d'avant (Brouillon, Instinctif, Classique, Tacticien, Stratège, leurs versions 2) sont remplacés. Les sections v0.47 à v0.49 ci-dessous restent comme historique. Les combats sauvegardés avec un ancien profil sont redirigés (`LEGACY_AI_PROFILE_IDS`).

Huit manières **intelligentes** de combattre (`data/aiProfiles.js`), qui jouent chacune autrement avec la formation, le placement, la fatigue et les cibles :

| Profil | Affiché | Composition | Placement | En manche |
|---|---|---|---|---|
| **L'Ordonnance** (`ordonnance`) | ordonné | `disciplined` : les meilleurs tant qu'ils sont sous 50 de fatigue ; 2L 2H 1R | formation | réglages de base (`FIGHTER_AI_CONFIG`, aussi l'IA de vos combattants) |
| **Le Mur** (`mur`) | défensif | 2 Lutteurs, **3 Hastiers**, aucun Runner | formation en retrait | secourt ses blessés, Hastiers à distance, souffle juste avant 50 et plus longtemps |
| **La Chevauchée** (`chevauchee`) | offensif | `allIn` (meilleurs sauf épuisés) ; **2 Runners**, 2L, 1H | ligne avancée, Runners au centre | Runners dans le dos (poids ×4), décide tous les 2 tours, ne souffle qu'à 70 |
| **Le Marteau** (`marteau`) | écrasant | `duel` | **surcharge d'un flanc** (`overloadWeight`) | tous sur la même cible (concentration, achèvement, pas de limite de surnombre) |
| **La Guerre d'usure** (`usure`) | patient | `rotation` : personne au-delà de 40 tant qu'un remplaçant est frais | formation | vise les **épuisés** (`tiredWeight`), Hastiers et Runners prudents, souffle long |
| **Le Stratège** (`stratege`) | stratégique | `strategist` (prévoit l'adversaire, ménage ses fatigués s'il mène) | `anticipate` | achever, concentrer, secourir ; décide tous les 2 tours |
| **Le Tacticien** (`tacticien`) | tactique | `duel` (rapport de force réel) | `duel` | rapport de force pesé fort, achève les blessés, cherche un meilleur angle |
| **Le Chasseur de têtes** (`chasseur`) | impitoyable | `duel` | formation avancée | **capitaine** et **Hastiers** en priorité (`captainWeight`, `classPriority`), Runners dans le dos |

- **Nouveaux leviers :**
  - cibles : `tiredWeight`, `captainWeight`, `classPriority` (`TargetSelectionService`) ;
  - placement : `overloadWeight`, et `frontWeight` négatif pour une ligne en retrait ;
  - composition : `formation` propre au profil, nouvelles stratégies `disciplined`, `allIn`, `rotation` ;
  - souffle propre au profil (`breathe`).
- **Tirage** (`AI_PROFILE_BY_CLUB_STARS`) : une seule tranche, les 8 profils ont la même chance quel que soit le niveau du club. Toujours tiré une fois par combat et conservé (`match.aiProfileId`).
- **Affichage** : « Comportement défensif », « … écrasant »…, avec en infobulle le nom du profil et une description factuelle (`flavor`, v0.67.1), par exemple « Le Mur — 2 Lutteurs, 3 Hastiers, aucun Runner. Ligne en retrait. Protège ses blessés et souffle souvent. ». L'Almanach reprend les mêmes descriptions.
- **Tournoi de réglage** (banc d'essai, effectifs aléatoires échangés, 32 rencontres par affiche, 448 combats par profil, ± 5 points) :

| Profil | Victoires | Signature mesurée |
|---|---|---|
| Le Marteau | 59 % | 100 % de ses combattants sur un même flanc, 1,65 attaquant par cible (1,4 ailleurs) |
| Le Tacticien | 57 % | le plus de KO par manche (3,8) |
| Le Stratège | 55 % | 1,5 attaquant par cible, souffle 0,8 fois par manche |
| Le Chasseur de têtes | 54 % | le plus de coups sur le capitaine (18 %) et sur les Hastiers (38 %) |
| La Chevauchée | 48 % | 15 % de ses coups dans le dos (7 % ailleurs), manches les plus courtes, ne souffle presque jamais |
| L'Ordonnance | 45 % | la référence |
| La Guerre d'usure | 43 % | ligne en retrait, vise davantage les épuisés |
| Le Mur | 39 % | 55 % de ses coups à distance, aucun dans le dos, ligne la plus reculée |

  Au cours du réglage, souffler dès 30 de fatigue s'est révélé une erreur : sous 50, la fatigue ne coûte rien, donc souffler revient à renoncer à frapper sans aucun gain. Les profils patients soufflent désormais à 45, juste avant le seuil du malus.

## IA de combat : 5 profils et banc d'essai (v0.47.0, historique)

**Profils** (`data/aiProfiles.js`), du plus brouillon au plus sophistiqué. Chacun décide à trois moments : composition de la manche, placement, comportement en manche.

| # | Profil | Composition | Placement | En manche |
|---|---|---|---|---|
| 1 | Brouillon | au hasard | au hasard | cible au hasard ou presque, jamais de recul ni de repositionnement |
| 2 | Instinctif | meilleurs niveaux, fatigue ignorée | première ligne, sans lire les classes | surtout le plus proche, pas de recul |
| 3 | **Classique** | les moins fatigués (IA actuelle du jeu) | selon les classes (« counter ») | réglages actuels (`FIGHTER_AI_CONFIG`) |
| 4 | Tacticien | rapport de force réel contre l'effectif adverse | rapport de force réel (classes + stats + fatigue) | + achever les blessés, concentrer les coups |
| 5 | Stratège | prévoit la composition adverse, ménage ses combattants s'il mène | anticipe : garde ses contres pour la fin, évite l'exposition aux contres encore à venir | + secourir un allié blessé, Hastiers prudents, 2 reculs |

**Nouveaux leviers** (neutres par défaut, le jeu actuel est inchangé) :
- `simulateRound({ aiConfigBySide: { A, B } })` : une IA par camp ;
- termes de cible `finishWeight`, `focusWeight`, `protectWeight` (`TargetSelectionService`) ;
- `approach.exposureByClass` (`DecisionService`) ;
- placements `frontline`, `duel`, `anticipate` (`AIPlacementStrategy`), qui s'appuient sur `combat/engine/ai/duelEstimate.js` ;
- compositions `random`, `best`, `fresh`, `duel`, `strategist` (`systems/ai/LineupStrategies.js`).

**Banc d'essai** (`systems/ai/AIBenchService.js`, Module Admin › « Banc d'essai IA ») :
- **combats complets** simulés de bout en bout : 2 manches gagnantes, composition, placement alterné (le plus fort place en premier, puis chacun son tour), moteur de combat, fatigue des manches (20–50 / 50–60), KO selon la règle du jeu ;
- **équité** : chaque rencontre se joue deux fois, effectifs échangés ;
- **reproductible** : tout est tiré d'une graine.

**Premiers résultats** (graine « essai », 1 000 combats, 50 rencontres par duel, ± 5 points par profil) :

| Profil | Victoires |
|---|---|
| Brouillon | 14 % |
| Instinctif | 56 % |
| Classique | 55 % |
| Tacticien | 61 % |
| Stratège | 64 % |

En duel direct, le Stratège bat le Classique 59 % – 41 %. L'Instinctif fait jeu égal avec le Classique (53 % – 47 %) : composer avec « les moins fatigués » coûte, car la fatigue n'agit qu'au-delà de 50.
### Tacticien 2 et Stratège 2 (v0.48.0)

**Étude préalable** : 19 variantes, 200 combats chacune contre le Classique (± 7 points), en remplaçant un élément à la fois.

| Variante | Victoires contre le Classique |
|---|---|
| Classique + composition qui prévoit celle de l'adversaire | 62 % (+12 points, le plus gros levier) |
| Classique + composition par rapport de force réel | 58 % |
| Classique + placement « duel » | 43 % |
| Classique + placement « anticipation » | 45 % |
| Classique + comportement en manche du Tacticien | 47 % |
| Classique + comportement en manche du Stratège | 50 % |
| Stratège avec le comportement en manche actuel | 62 % |
| Stratège avec son propre comportement en manche | 57 % |

À retenir :
- la **composition** de la manche fait l'essentiel du gain ;
- le **placement par classes** actuel reste le meilleur : les placements « duel » et « anticipation » font perdre des points ;
- les réglages fins en manche ne comptent qu'à la marge (± 3 points).

**Nouveaux profils** :
- **Tacticien 2** : composition par rapport de force réel (`duel`), placement par classes, comportement actuel + achever les blessés.
- **Stratège 2** : composition qui prévoit celle de l'adversaire (`strategist`), placement par classes, coordination du Stratège, décision tous les 2 tours.

**Tournoi** (graine « tournoi-v2 », 3 000 combats, 300 par duel ; ± 3 points par profil, ± 6 par duel) :

|  | Classique | Tacticien | Stratège | Stratège 2 | Tacticien 2 |
|---|---|---|---|---|---|
| **Classique** | — | 46 % | 43 % | 42 % | 44 % |
| **Tacticien** | 54 % | — | 51 % | 48 % | 49 % |
| **Stratège** | 57 % | 49 % | — | 48 % | 45 % |
| **Stratège 2** | 58 % | 52 % | 52 % | — | 48 % |
| **Tacticien 2** | 56 % | 51 % | 55 % | 52 % | — |

| Profil | Victoires | Manches gagnées |
|---|---|---|
| Tacticien 2 | 54 % | 55 % |
| Stratège 2 | 53 % | 54 % |
| Tacticien | 51 % | 52 % |
| Stratège | 49 % | 51 % |
| Classique | 44 % | 39 % |

À retenir :
- Les quatre profils améliorés battent tous le Classique (56–58 %).
- Entre eux, les écarts restent minces. Le Tacticien 2 est le plus régulier : il ne perd nettement contre personne.
- Le Stratège 2 mise sur une prédiction (« l'adversaire alignera ses plus frais »), exacte contre le Classique mais moins fiable face aux autres profils. Contre un joueur humain, le Tacticien 2 est donc le plus sûr.

**Module Admin › Banc d'essai IA** : le choix des profils à confronter se fait par cases à cocher.
## Comportement des équipes adverses (v0.49.0 ; profils et tirage remplacés en v0.67.0, voir plus haut)

À chaque combat contre le joueur (championnat et Combat de la Reine), l'équipe adverse reçoit un **profil d'IA** tiré selon ses **étoiles actuelles** (`AI_PROFILE_BY_CLUB_STARS`, `data/aiProfiles.js`) :

| Club | Profils (poids) |
|---|---|
| 0 à 2★ | Classique 50 % · Tacticien 20 % · Stratège 20 % · Instinctif 10 % |
| 2,5 à 3,5★ | Tacticien 30 % · Stratège 30 % · Tacticien 2 20 % · Stratège 2 20 % |
| 4 à 5★ | Tacticien 2 50 % · Stratège 2 50 % |

Répartition revue en v0.49.1 (auparavant 0–2,5★ / 3–4,5★ / 5★).

- **Portée** : le profil décide de la composition de chaque manche, du placement et du comportement en manche des combattants de l'IA. Les combattants du joueur gardent l'IA habituelle ; l'effectif engagé de l'IA (ses 8 meilleurs) ne change pas.
- **Tirage** : une fois par combat, à partir d'une graine propre au combat (saison, jour, adversaire), conservé sur le combat (`match.aiProfileId`). Rouvrir l'écran ne change pas le comportement ; le combat suivant en tire un nouveau.
- **Affichage** sous le nom de l'équipe adverse, dans l'en-tête du combat (compact pendant le placement) :
  - « Comportement classique », « … instinctif », « … tactique », « … stratégique » ;
  - « … d'élite » pour Tacticien 2 et Stratège 2, avec une étiquette sombre et dorée ;
  - l'infobulle raconte la manière de combattre de la compagnie, en ton de chronique, sans parler d'IA (`flavor`, v0.49.2) ; le résumé technique (summary) reste réservé au banc d'essai.
- **Combats entre clubs de l'IA** : ils restent simulés comme avant (tirage par niveau).
- **Code** :
  - `systems/ai/OpponentAIService.js` : tranches, tirage, composition et placement de l'IA, libellé ;
  - `RoundService.resolveCombatRound` : `aiConfigBySide.B` ;
  - Almanach : « Le comportement des adversaires ».

## Coupe de France (v0.50.0)

Compétition **hors calendrier**, disputée à l'intersaison depuis la v0.57.0 (voir « Coupe de France de fin de saison » ci-dessus) ; à l'origine (v0.50), elle s'ouvrait à tout moment depuis la colonne de droite.

- **Équipes** : les 54 compagnies françaises, lues dans la partie (la compagnie du joueur + les 53 clubs des trois Ligues), avec leur identité (nom, blason, couleurs, effectif, niveau).
- **Tirage** : 9 poules de 6 (A à I), sans tête de série ni chapeau. L'ordre de tirage est fixé à la création de l'édition (graine) ; les places se remplissent A1, B1… I1, A2… I6. « Tirer la prochaine équipe » ou « Tout tirer » donnent le même résultat ; les boutons disparaissent une fois le tirage terminé.
- **Poules** : chacun affronte une fois les 5 autres (5 journées de 3 combats, méthode du cercle). Points du championnat ; départage : points → manches remportées → adversaires mis KO.
- **Qualification** : les 3 premiers de chaque poule (27) + les 5 meilleurs **4es** = 32 (*à valider* : la demande parlait de « 5 meilleurs troisièmes », ce qui ne fait pas 32 ; réglable dans `data/frenchCup.js`, `extraQualifiers`).
- **Tableau final** : 32 qualifiés tirés au sort, seizièmes → huitièmes → quarts → demies → finale. Tout le tableau existe dès le tirage ; un vainqueur prend la place suivante (aucun doublon, aucun éliminé ne revient).
- **Combats** : le moteur de combat habituel pour tous. Le combat du joueur se joue dans la Lice (`MatchScreen`, `params.cupMatchId`) ; les autres sont simulés (`AIBenchService.playBenchMatch`), chaque compagnie avec un comportement tiré selon ses étoiles. Après le combat du joueur, les autres combats de l'étape se disputent au retour au Château, puis l'étape suivante s'ouvre.
- **Isolation** : combats « isolés » (`Match.isolated`) : aucun palmarès, aucune mise à terre, aucun classement de Ligue, aucun jour qui passe. Statistiques propres à l'édition (`cup.fighterStats`).
- **Élimination** : la participation du joueur s'arrête ; « Simuler : <tour> » ou « Simuler jusqu'au vainqueur ».
- **Château de Gabarnac** (`frenchCup/GabarnacScene.js`, `GabarnacRenderer.js`, plan `data/gabarnacLayout.js`) : logis, remparts, tours à toit d'ardoise, porte fortifiée ; nombreux rangs de vigne animés par le vent (`vine`) ; habitants qui marchent et bavardent (bulles) ; les 8 combattants de l'équipe Type aux couleurs du club ; la **Lice** au centre (cliquable → prochain combat) et le **tableau de la Coupe** (`noticeBoard`, cliquable → résultats, poules, qualifiés, meilleurs combattants : meilleur tueur, meilleur combattant, plus de victoires — liste extensible `CUP_LEADERBOARDS`).
- **Mode autonome** : l'écran de la Coupe n'a ni calendrier, ni accès au Centre, au Bourg ou à la Taverne.
- **Fin** : écran « COUPE DE FRANCE · VAINQUEUR · blason · Champion de France », tableau final, palmarès des éditions (`session.frenchCupHistory`), « Commencer la nouvelle saison » (v0.57.0).
- **Décor de combat** : `lice_gabarnac` (`exclusiveTo: 'cup'`), affluence selon le tour (`FRENCH_CUP_RULES.crowd`, *à valider*).
- **Sauvegarde** : `session.frenchCup` (édition, graine, tirage, poules et combats, qualification, tableau, parcours du joueur, statistiques) ; sauvegarde automatique (si activée) à chaque tirage, combat et étape. Une ancienne sauvegarde s'ouvre sans Coupe.
- **Code** : `systems/frenchCup/` — `CupDraw` (tirage), `CupGroups` (calendrier, classement, qualification), `CupBracket` (tableau), `CupStatistics` (statistiques), `FrenchCupManager` (édition, étapes, simulations, sauvegarde) ; écran `ui/screens/FrenchCupScreen.js`.

### Immersion, arbre final et récompenses (v0.51.0)

- **Carte** : caméra rapprochée (`GABARNAC_LAYOUT.camera`, cadrage du monde et non de l'interface) ; 36 habitants de plus (spectateurs le long de la palissade, passants, groupes qui discutent, vendangeurs) ; les 8 combattants du joueur ne sont plus affichés, remplacés par 12 combattants de compagnies engagées (encore en lice si possible), aux couleurs de leur club (`pickAmbianceFighters`, lecture seule) ; une tente remplace la maison (aucune interaction n'y était liée).
- **Arbre final** (`ui/components/CupBracket.js`) : onglet « Arbre final » du tableau de la Coupe (et bouton « Arbre final » de l'en-tête). Lu dans `cup.bracket` à chaque affichage : affiches, scores, vainqueurs, places à venir (« à déterminer »), vainqueur final.
- **« Assister aux prochains combats »** (joueur éliminé, ou encore en lice quand les autres combats de son tour restent à jouer) : fenêtre de l'arbre ; pour chaque combat restant du tour, le résultat est d'abord calculé et enregistré (moteur de combat, source unique), puis dévoilé : score manche après manche d'après `match.roundWinners`, vainqueur en vert / perdant barré, blason qui glisse jusqu'à sa place du tour suivant. Tour fini → « Assister aux <tour suivant> », jusqu'à « Voir le vainqueur ». Rythme : ~0,75 s par manche, « Accélérer ×3 », « Passer l'animation ». Fermer la fenêtre s'arrête après le combat en cours ; rouvrir ne rejoue aucun résultat. Les poules restent disputées d'un coup au retour au Château.
- **Récompenses** (`FRENCH_CUP_RULES.rewards`) : 150 deniers par victoire en poules, puis 300 / 600 / 1 200 / 2 500 / 5 000 selon le tour remporté. Versées par `payVictoryReward` et inscrites sous l'identifiant du combat (`cup.rewards`) : jamais deux fois, même après chargement. « Victoire ! +150 deniers » à la fin du combat ; détail dans « Mon parcours » et sur l'écran du vainqueur. Les victoires antérieures à cette version (anciennes sauvegardes) ne sont pas payées rétroactivement.
- **Le Coffre** est fermé pendant les combats de la Coupe (`isChestLocked` : bouton masqué, `openChest` refusé) ; son contenu n'est pas touché.

## Statut « Elite » (v0.52.0)

Les **16 meilleurs combattants** de toutes les compagnies des Ligues 1, 2 et 3 (celle du joueur comprise) portent l'étiquette noire **Elite**, juste à gauche de leur classe : `[Elite] [Hastier]`.

- **Classement global** (`systems/rating/EliteService.js`, `ELITE_CONFIG` dans `data/ratings.js`) : effectifs actuels de toutes les compagnies des Ligues, triés par **niveau actuel** — le même que celui des étoiles (`RatingService.calculateFighterLevel`). Aucun quota par ligue ni par club : une compagnie peut n'en avoir aucun ou plusieurs.
- **Égalités** : identifiant du combattant (ordre alphabétique), donc jamais plus de 16 étiquettes. Le jeu n'avait pas de critère secondaire pour départager deux combattants.
- **Dynamique et jamais enregistré** : le statut se déduit du classement au moment de l'affichage (calculé une fois par passage d'affichage, puis recalculé). Progression, baisse, recrue, départ, retraite et changement de club sont donc pris en compte sans aucune donnée à mettre à jour. Un combattant hors des Ligues (recrue de la Taverne, club hors championnat) n'est pas éligible.
- **Affichage** (`EliteBadge` / `FighterClassTags`, `ui/components/SpecialtyBadge.js`) : cartes de la Compagnie, effectif engagé, placement dans la Lice, fiche du combattant, fiche de club, bilan de manche, tableau du Centre, Taverne, Coffre.

## Coupe de France de fin de saison (v0.57.0)

- **Accès** : plus de bouton « Coupe de France » dans la colonne. Une édition par intersaison : après le bilan de fin de saison, « Aller en Coupe de France » (carnet de bord et bandeau du calendrier) remplace « Commencer la nouvelle saison » (`openSeasonCup`, `getSeasonCupState` : closed / available / inProgress / finished). L'édition porte le numéro de la saison qui vient de finir (« Saison X quart de finale »).
- **Bloquante** : une fois ouverte, les écrans du domaine (Compagnie, Centre, Taverne, Bourg, Ligue) renvoient vers la Coupe jusqu'à la nouvelle saison (garde de `ui/screens/registerScreens.js` ; `redirectTo` peut désormais être une fonction). L'en-tête de la Coupe propose « Sauvegarder » et « Menu principal » ; recharger la partie ramène à la Coupe.
- **Abandonner la Coupe** (tant que la compagnie a au moins un combat à disputer) : forfait 0–2 sur ses combats restants (tous ceux de sa poule, ou celui du tour en cours), élimination immédiate, jamais qualifiée ; la Coupe continue jusqu'au vainqueur ; deniers gagnés conservés ; l'historique note le stade atteint (`abandonCup`).
- **Quitter la Coupe** (plus aucun combat à disputer) : toute la fin du tournoi est disputée d'un coup, puis l'écran du vainqueur. « Assister aux prochains combats » reste possible (poules : journée par journée ; tableau : arbre animé).
- **Nouvelle saison** : « Commencer la nouvelle saison ▸ » sur l'écran du vainqueur (montées et descentes, nouveau calendrier).
- **Anciennes sauvegardes** : une Coupe ouverte à la demande et inachevée est annulée au chargement, sans résultat ni historique (`cancelLegacyCup`).

## Équilibrage de la v0.56.0
- **Forêt** : les trois améliorations du Bûcheron s'arrêtent au 4e achat (Gain de deniers +60 au plus, Probabilité 90 % au plus, 10 places). Les sauvegardes qui avaient déjà dépassé gardent leurs achats.
- **Potentiel** : chances de gagner une flamme environ −20 % (18–25 ans : 16 / 8 / 4 % ; 26–31 ans : 40 / 24 / 1 %). Pertes après 32 ans inchangées.
- **Compagnie de départ** : compétences de 8 à 27 au lieu de 10 à 30 (`GAME_CONFIG.roster.startingSkillRange`), capitaine excepté (sa plage ne change pas). Recrues et clubs de l'IA inchangés.
- **Clubs de l'IA** : progression freinée ×1,5 (6,7 / 3,3 / 1,3 % par jour selon les étoiles) ; vieillissement inchangé.

## Palmarès, classements et trophées (v0.55.0)

- **Historique des clubs — Coupe de France** (`recordCupHistory`, `FrenchCupManager`) : à la fin d'une édition, chaque club participant reçoit une entrée `{ kind: 'cup', season, editionId, edition, stage, label }`, une seule fois par édition (ni au rechargement, ni à la réouverture). Intitulés (`FRENCH_CUP_RULES.historyLabels`) : « Phase de poule », « Saison X seizième de finale », « Saison X huitième de finale », « Saison X quart de finale », « Saison X demi-finale », « Finaliste », « Champion de France » — affichés « … — Coupe de France ». *À valider* : seizièmes et huitièmes n'étaient pas définis, même logique que les quarts. La saison est celle du championnat à l'ouverture de l'édition (`cup.season`).
- **Palmarès des combattants** (`FighterRecordService`, `CareerStatsService`) : ceux du joueur sur le combattant (`fighter.record`) ; ceux des clubs de l'IA désormais tenus dans la partie (`session.aiFighterRecords`), à partir des combats réellement disputés (championnat, Combats de la Reine). Les mises à terre ne sont comptées que lorsqu'elles sont constatées par le moteur de combat (combats contre le joueur) : les combats entre clubs de l'IA sont résolus par probabilité, sans mise à terre. La Coupe de France (combats isolés) garde ses propres statistiques.
- **Pancarte des classements** (Taverne, mur de gauche ; `FighterStatsService`, `ui/components/TavernBoards.js`) : niveau (en étoiles), mises à terre, victoires, défaites, combats disputés ; rang, combattant, club, valeur ; filtre Toutes les Ligues / une Ligue / Ma compagnie. Population : effectifs actuels des compagnies des Ligues (comme le statut Elite). **Mises à terre** : classement limité à la compagnie du joueur (`lockedScope`, filtre grisé sur « Ma compagnie », v0.55.1) — les combats entre clubs de l'IA, simulés, n'en produisent pas.
- **Trophées** (`data/trophies.js`, `systems/trophies/TrophyService.js`, `session.trophies`) : un trophée par titre — 1re place finale d'une Ligue (fin de saison, `generateSeasonHistory`) ou finale de Coupe gagnée (`finishCup`) ; jamais pour une 2e place ou une demi-finale ; identifiant du titre (compétition + saison ou édition) : jamais en double. Anciennes sauvegardes : retrouvés dans l'historique de la compagnie et le palmarès de Coupe (`ensureTrophies`).
- **Armoire à trophées** (Taverne, mur du fond ; `trophyCabinet` de `render/tavernProps.js`, dessins `render/trophies.js`) : quatre modèles (Ligue 3 gobelet de bronze, Ligue 2 coupe d'argent à couvercle, Ligue 1 grande coupe d'or, Coupe de France calice d'or couronné à ruban bleu) ; trois étagères de quatre, dans l'ordre des victoires, « +N » au-delà ; clic : vue rapprochée, trophées regroupés par compétition avec leur saison, sans limite. Fonctionnalité propre à la compagnie du joueur : rien pour les clubs de l'IA (leurs titres restent dans leur historique).

## Le Bourg
Lieu du domaine (chemin bas-droite du Centre) où l'on dépense ses deniers pour améliorer les infrastructures du Centre ou acheter des consommables. L'interface est une carte isométrique cliquable, comme le Centre :
- **Quatre zones d'artisans**, avec étiquette (cliquable comme la zone depuis la v0.68.1), surlignage au survol et ouverture d'une fenêtre au clic (aussi accessible par les cartes sous la carte) :
  - **le Menuisier**, dans son atelier sous tente : établi, poutres, tonneaux, caisses, charrette — il rabote une planche (copeaux) ;
  - **le Bûcheron**, à la scierie en lisière de forêt : troncs, souches — il fend une bûche à la hache (éclats) ;
  - **le Sénéchal**, devant son pavillon, avec son bureau et ses bannières — il écrit dans son registre et relève parfois la tête ;
  - **le Boulanger**, à son fournil au sud-ouest : tente de toile, four à pain en dôme (braise qui rougeoie, fumée), bois de chauffe, sacs de farine, étal de miches, pétrin, tonneau. Il tient une **boutique** (voir « Le Coffre et les consommables »).
- **21 habitants** décoratifs, non cliquables et sans effet sur le jeu : tournées avec arrêts (chacun son rythme), chalands au marché, conversations (bulles), aides au travail, un enfant qui court ; **2 chiens** et **2 bandes d'oiseaux**.

**Carte compacte et vivante (v0.54.0)** — même grille (17 × 14 cases) et même cadrage que le Centre ; un campement de **tentes** remplace les maisons (aucune interaction n'y était liée ; zones des artisans et chemin vers le Centre conservés). Tout réutilise le Centre :
- gestes : drawSpectator accepte la pose des animations du Centre ; marche et attente des habitants = FIGHTER_ANIMATIONS.walk / idle ; le Bûcheron reprend chop (hache de la Forêt) ; nouveaux gestes plane, write, knead (`borough/artisanAnimations.js`) et objets tenus (rabot, plume, pâte, centre/render/heldItems.js). Chaque artisan alterne travail et repos (work dans data/boroughLayout.js), avec un fondu entre les deux ; les zones cliquables ne changent pas ;
- ambiance : CentreAmbience (vent dans les arbres, feuilles, poussière dorée, vols d'oiseaux de passage, réservoir de particules : copeaux, farine) ;
- habitants : path + pauses (patrolAt, `borough/BoroughScene.js`) ; chiens et oiseaux posés : `borough/animals.js` (fonctions pures du temps). Un test vérifie qu'aucun habitant ni chien ne traverse une tente, un étal ou un décor, et qu'aucun arbre de la bordure ne cache un artisan.

**Améliorations** (`data/borough.js`, `systems/borough/UpgradeService.js`) :

| Artisan | Infrastructure | Amélioration (prix initial) |
|---|---|---|
| Menuisier | Petite lice | +1 LUTTE par réussite (200 → 2 400 → 12 000, **3 achats au plus**) · +10 % de réussite (75) · +2 places (100) |
| Menuisier | Mannequins | +1 HAST par réussite (200 → 2 400 → 12 000, **3 achats au plus**) · +10 % (75) · +2 places (100) |
| Menuisier | Tas de foin | +1 PER par réussite (200 → 2 400 → 12 000, **3 achats au plus**) · +10 % (75) · +2 places (100) |
| Bûcheron | Forêt | +15 deniers par tâche (150) · +10 % (200) · +2 places (300, **4 achats au plus** : 2 → 4 → 6 → 8 → 10 places) |
| Sénéchal | Rivière | +1 END par réussite (300) · +10 % (300) |
| Sénéchal | Banquet | Contrat de chasse : −10 fatigue par repas (200) |

- **Prix** : chaque amélioration a **son propre compteur d'achats**. Le 1er achat coûte le prix initial ; chaque prix suivant est le précédent **× 3, puis × 4, × 5, × 6…** (`UPGRADE_COST_PROGRESSION`, règle commune dans `getUpgradeCost`). Ex. places en Forêt : 300 → 900 → 3 600 → 18 000. Seul le compteur est sauvegardé (`session.upgrades`) ; prix, places et effets s'en déduisent.
- **Probabilité** : toutes les améliorations « Probabilité » ajoutent **+10 %** de réussite par achat (`CHANCE_UPGRADE_STEP`, réglage commun), 100 % au plus.
- **Prix fixés** (`costs`) : Lutte, Hast et Percussion (Pôle Combat) ont leurs prix achat par achat, 200 → 2 400 → 12 000 deniers, et **3 achats au plus** (gain +2, +3, puis +4 par réussite) ; la progression × 3, × 4… ne s'applique pas à elles.
- **Niveau maximal** (`maxLevel`) : Forêt : Gain de deniers, Probabilité et Places limités à 4 achats chacun (v0.56.0 : +60 deniers et 90 % de réussite au plus, 10 places ; une sauvegarde qui avait déjà dépassé garde ses achats) ; Lutte, Hast et Percussion à 3 achats, les niveaux suivants n'étant pas définis ; l'écran affiche « Niveau x / 4 », puis « Maximum atteint ». Les autres améliorations n'ont pas de maximum (sauf la probabilité, bornée à 100 %).
- **Ancienne sauvegarde** avec plus de combattants en Forêt que de places (2 de base depuis la v0.31.3, plus celles du Bûcheron) : les premiers y restent, les autres passent au repos au chargement.
- **Achat** : il débite les deniers et applique l'effet aussitôt. Il est bloqué faute de deniers (bouton désactivé, montant manquant indiqué), quand la probabilité atteint déjà 100 %, ou au niveau maximal.
- **Effets branchés sur le jeu existant**, sans logique parallèle. Les améliorations produisent l'activité « effective » du Centre (`getEffectiveActivity`), utilisée par la résolution quotidienne, les affectations et l'affichage :
  - gain par réussite (stat ou deniers) ;
  - probabilité (+15 points par niveau, 100 % au plus) ;
  - places.
- **Extension** : une nouvelle amélioration est une entrée de données ; un nouveau type d'effet s'ajoute dans `systems/borough/upgradeEffects.js`.

## La Taverne

La Taverne est un **lieu à explorer**, comme le Centre et le Bourg : l'intérieur d'une taverne médiévale en vue isométrique.
- **Le décor** : deux murs à colombages (fenêtres du soir, boucliers, bannière), une cheminée au feu animé, des étagères de vaisselle et des tonneaux en perce, le comptoir, cinq tables avec chandelles, assiettes et chopes, des bancs et des tabourets, un tapis, des lanternes, et deux clients attablés (simple décor).
- **Les recrues de l'offre** sont présentes dans la salle, chacune avec son sprite.
  - Elles **flânent** d'une place à l'autre en contournant le mobilier (recherche de chemin du combat), puis s'arrêtent quelques secondes. Leurs places de départ sont tirées au sort.
  - Ces déplacements sont purement visuels : ils ne touchent ni au combattant ni à son recrutement.
- **Survol d'une recrue** : une étiquette indique sa spécialité et ses étoiles (« 🔱 Hastier ★★½ »), calculées par le système central de notation. La ligne d'aide sous la scène donne aussi son nom.
- **Clic sur une recrue** : sa **fiche de recrutement** s'ouvre.
  - Elle montre le nom, le sprite, la spécialité, les étoiles, l'âge, le potentiel, les statistiques et le prix.
  - Le bouton **Recruter** applique les règles inchangées : place libre, deniers, paiement, ajout à l'effectif, retrait de l'offre.
  - La recrue engagée quitte la salle.
- **Le tavernier**, derrière le comptoir, est cliquable. Il annonce :
  - le niveau de la Taverne ;
  - les étoiles des prochaines recrues ;
  - la date de la prochaine rotation ;
  - l'amélioration suivante, avec son coût.
- **Accès sans la souris** : sous la scène, la carte du tavernier et la liste des recrues présentes mènent aux mêmes fenêtres.

**Niveau de la Taverne** (`data/tavern.js › TAVERN_LEVELS`, source unique des coûts et des plages) :

| Niveau | Coût | Recrues des rotations suivantes |
|---|---:|---|
| 1 | départ | 1★ à 2★ |
| 2 | 500 deniers | 1★ à 2,5★ |
| 3 | 2 500 deniers | 1★ à 3★ |
| 4 | 5 000 deniers | 1★ à 3,5★ |
| 5 (maximum) | 7 500 deniers | 1★ à 4★ |

Depuis la v0.45.0, une amélioration ne relève que la **borne haute** : des recrues à 1★ peuvent toujours se présenter. Le **prix d'une recrue dépend de ses étoiles**, quel que soit le niveau de la Taverne :

| Étoiles | Proposées dès le niveau | Prix |
|---|---|---:|
| 1★ à 2★ | 1 | niveau du combattant ± 10 (environ 1 à 50 deniers) |
| 2,5★ | 2 | 150 deniers |
| 3★ | 3 | 350 deniers |
| 3,5★ | 4 | 600 deniers |
| 4★ | 5 | 1 250 deniers |

Règle : barème fixe par étoiles (`RECRUITMENT_CONFIG.starPrices`, v0.53.0 ; auparavant 10 % du coût de l'amélioration). Les étoiles disponibles dès le départ gardent le prix « selon sa valeur ». Les étoiles sont tirées uniformément par demi-étoile dans la plage : au niveau 5, chacune des 7 valeurs de 1★ à 4★ a la même chance.

- **Amélioration** (`TavernUpgradeService`) :
  - elle est refusée au niveau maximal ou faute de deniers (montant manquant indiqué) ;
  - sinon elle débite le coût, fait passer le niveau à +1 et sauvegarde la partie si la sauvegarde automatique est active ;
  - **les recrues présentes ne changent pas** : la nouvelle plage vaut à partir de la prochaine rotation.
- **Rotation** (`TavernRotationService`) : elle décide **quand** l'offre change, comme avant (création de la partie, puis l'événement hebdomadaire du calendrier). Elle demande ensuite la plage d'étoiles du niveau actuel.
- **Génération** (`TavernRecruitmentGenerationService`) :
  - elle tire un nombre d'étoiles parmi ceux de la plage (par demi-étoile), puis un niveau dans la tranche correspondante du barème central (`data/ratings.js`) ;
  - elle répartit les 4 compétences autour de ce niveau (quelques écarts, la moyenne ne change pas) ;
  - le reste suit la génération habituelle : nom, sprite, âge, potentiel ;
  - un garde-fou vérifie, avec le système central d'étoiles, que la recrue tombe bien dans la plage ;
  - le **prix** d'une recrue est fixé à son arrivée, selon ses étoiles (tableau ci-dessus ; `TavernRotationService.getRecruitPriceForStars`). Le tavernier annonce le barème de la prochaine rotation et le prix des nouvelles étoiles débloquées par l'amélioration.
- **Sauvegarde** : le niveau est enregistré (`session.tavernLevel`), et les anciennes sauvegardes repartent au niveau 1. Les recrues présentes sont sauvegardées comme avant.
- **Architecture** (présentation séparée de la logique) :
  - `tavern/TavernScene.js` : scène, grille praticable, recrues ;
  - `tavern/TavernCharacter.js` : déplacement d'une recrue ;
  - `tavern/Tavernkeeper.js` : ce que dit le tavernier, d'après les services ;
  - `tavern/TavernInteractionService.js` : cible sous le pointeur, texte du survol ;
  - `tavern/TavernRenderer.js` : le dessin ;
  - `data/tavernLayout.js` : le plan, le mobilier, les places, le tavernier, les clients ;
  - `render/tavernProps.js` : le mobilier.

  On peut ajouter un personnage ou une interaction sans toucher aux services.

## Talents et Scriptorium (v0.59.0, Flavia v0.60.0)

Un **talent** est une aptitude propre à un combattant du joueur. Il se révèle au **Scriptorium**, ou arrive avec une recrue de la Taverne.

**Talents** (`data/talents.js`, `systems/talents/TalentService.js`)
- **Catalogue centralisé** : `id` stable, `name`, `rarity` (famille), `description`, `effect` (`type`, `params`), `sources` (`tavern`, `study`) et `weight` (tirage).
- **Familles** (`TALENT_RARITIES`), avec la couleur de leur étiquette :

  | Famille | Couleur | Cible à terme |
  |---|---|---|
  | Ordinaire | bleu clair | 30 talents |
  | Rare | orange | 10 talents |
  | Épique | noir | 3 talents |

- **Les 50 talents** (v0.62) : 33 ordinaires (niveau saison 1), 12 rares (saisons 2–3), 5 épiques (saison 4). La liste complète, avec l'effet exact de chacun, est dans l'Almanach (« Les talents ») et dans `data/talents.js`.
- **Effets typés** : chaque talent porte une liste `effects` de types connus (`finalDamage` avec sa condition, `aura`, `damageTaken`, `enemyContact`, `guardCaptain`, `combatStats`, `fatigueThreshold`, `comboHits`, `luckyRoll`, `moveSpeed`, `lastStand`, `roundFatigue`, `fatigueCap`, `squadFatigue`, `activityChance`, `activityReward`, `allyActivityChance`, `dailyDeniers`, `foresterDeniers`, `homeRewardMultiplier`, `homeWinDeniers`, `queenReward`, `recruitDiscount`, `studyDays`, `studyFactor`, `potentialFloor`, `potentialBoost`, `skillCapSteps`). Aucun système ne teste un talent par son nom : il demande à `systems/talents/TalentEffects.js` les effets d'un type.
- **Où ils agissent** :
  - **combat** (`combat/engine/TalentCombat.js`, au moment de chaque coup) : dans les manches disputées dans la lice. Les combats joués automatiquement (avance rapide) ne tiennent compte que du niveau. Les talents en jeu apparaissent dans les bonus de la manche (« ✦ Nom ») ;
  - **fatigue** (`FatigueService.applyRoundFatigue`), **Centre** (`ActivityService.defaultResolve` : réussite, gains, Écuyer) ;
  - **revenus quotidiens** (phase `talent-income` : Collecteur, Trésorier du roi ; ligne « Talents » du carnet) ;
  - **recette à domicile** (`awardHomeReward` : Trésorier, Héros local), **Reine** (Courtisan, Champion), **Taverne** (`getRecruitCost` : Marchandeur) ;
  - **Scriptorium** (`getStudyDuration` : Studieux, Érudit), **potentiel** (`updateFighterPotential` : Vieux loup, Précoce, Élu des dieux), **plafond** (`getStatCap` : Prodige).
- **Combat, « une fois par combat »** : `match.talentUses` (Inébranlable) ; lieu du match `match.location` (Enfant du pays, Voyageur) ; effectif engagé `match.squadIds` (Légende vivante).
- **Taverne** : une recrue talentueuse reçoit un talent tiré par famille, selon les chances de base (80 / 19 / 1 %).
- **Ajouter un talent** : une entrée dans `TALENTS`, avec des effets de types existants. Aucune interface ni aucun système n'est à modifier.
- **Deux talents par combattant** (v0.72 ; un seul de la v0.60 à la v0.71) : `fighter.talents` est une liste ordonnée d'au plus deux identifiants, sans doublon : `[premier, second]` (`TALENT_RULES.maxPerFighter`, normalisée au chargement). `setFighterTalentAt(session, fighter, talentId, slot)` remplace le talent d'une place (`slot` 0 ou 1) ou, sans `slot`, ajoute à la première place libre ; un doublon est refusé. Les effets des deux talents s'ajoutent (`TalentEffects` lit toute la liste).
- **Qui en a** :
  - les combattants du joueur : aucun talent au départ ;
  - les combattants de l'IA : jamais (ni tirage, ni attribution, ni affichage) ;
  - les recrues de la Taverne : 10 % de chances (`TALENT_RULES.tavernChance`). Le tirage est fait une fois, à l'arrivée de la recrue. Il a sa propre graine (l'identifiant de la candidature) : il ne change aucun autre tirage de la rotation. Il est enregistré avec la recrue.
- **Affichage** : uniquement les talents révélés, jamais d'étiquette vide.
  - La Compagnie : à droite de l'état (« Au repos — Fourbe »), les deux talents côte à côte.
  - Fiche du combattant et fiche de recrutement : entre la classe et les étoiles (« Lutteur | Fourbe | ★★ »).
  - Liste des recrues et survol d'une recrue dans la Taverne.

**Le Scriptorium** (`ui/screens/ScriptoriumScreen.js`, `scriptorium/`, `data/scriptoriumLayout.js`, `render/scriptoriumProps.js`)
- **Accès** : au bout du chemin nord-ouest du Centre. Il remplace le Centre de formation prévu.
- **Taille et décor** : petite salle de 13 × 10 cases, comme la Taverne. C'est une bibliothèque fortifiée : murs de pierre, poutres, rayonnages, pupitres de copistes, pupitre de lecture, globe, sphères armillaires, lunette, cartes célestes, chandeliers et appliques, rai de lumière de la fenêtre.
- **Un lieu vivant** :
  - copistes qui écrivent, moine qui lit (geste `read`), bailli aux rayonnages (geste `browse`) ;
  - moine, citoyen et bailli qui circulent ;
  - deux lecteurs qui discutent (devant le Bureau d'étude, loin du cabinet de Flavia).
  - Ces personnages réutilisent les gestes et les tournées du Bourg. Ils ne bloquent rien : seuls la porte et le Bureau d'étude sont cliquables.
- **La porte** ramène au Centre, par le chemin nord-ouest.
- **Le Bureau d'étude** : zone et meuble cliquables, avec bureau, livres, parchemins, astrolabe, sphère et mannequins. Sa plaque indique « Libre » ou « Nom — encore N jours ».

**L'étude** (`data/scriptorium.js`, `systems/talents/StudyService.js`)
- **Lancement** : clic sur le Bureau, choix d'un combattant ; talents actuels, ce que révélera l'étude, durée, coût et chances de chaque famille affichés, puis confirmation.
- **Ce que révèle l'étude** (v0.72, `getStudyPlan`) :
  | Talents du combattant | Étude | Coût | Bouton |
  |---|---|---|---|
  | aucun | son premier talent | gratuit | « Lancer l'étude » |
  | un | son second talent, qui s'ajoute au premier (jamais le même) | gratuit | « Révéler son second talent » |
  | deux | un nouveau talent qui REMPLACE celui qu'on choisit, premier ou second | 500 deniers (`STUDY_RULES.replaceCost`) | « Remplacer ce talent : 500 deniers » |
- **Coût** : le solde est vérifié et débité par `startStudy` (jamais à l'ouverture de l'interface ; jamais négatif) ; le bouton est grisé sous 500 deniers.
- **Remplacement** : la fenêtre propose « Talent à remplacer » (premier ou second, aucun choisi d'office) ; `startStudy(session, id, { slot })` l'exige. Pendant l'étude, il garde ses deux talents ; à la révélation, le nouveau prend la place choisie, et l'autre talent n'est jamais tiré (pas de doublon ; celui qu'on remplace peut revenir). Interrompue : talents conservés, 500 deniers non remboursés.
- **Anciennes sauvegardes** : une étude lancée avant la v0.72 (sans `mode`) se termine comme avant : payante, elle remplace le talent unique ; gratuite, elle révèle le premier.
- **Places** : 1 au départ (`STUDY_RULES.desks`), 2 avec l'amélioration de Flavia ; chaque étude a ses propres dates, une troisième est refusée par la logique de jeu.
- **Durée selon le potentiel** : 0 flamme → 25 jours, 1 → 20, 2 → 15, 3 → 10.
- **Données** : `session.studies` contient `{ id, fighterId, startDay, duration, endDay, status, talentId, closedOnDay, notified, mode, slot, cost, previousTalentId, rarity, odds }` (`mode` : `'first'` | `'second'` | `'replace'` ; `slot` : place révélée ou remplacée). L'état « en étude » s'en déduit à chaque lecture, sans être enregistré ailleurs.
- **Indisponibilité**, vérifiée par la logique de jeu et pas seulement par l'affichage :
  - le combattant quitte son activité ;
  - il est refusé par `assignActivity`, par l'affectation rapide et par le réglage d'un lieu ;
  - il est exclu de l'effectif automatique, de l'équipe Type et des équipes enregistrées, et retiré d'une manche même si une interface l'alignait ;
  - il est grisé dans la sélection d'un combat (« En étude au Scriptorium ») et absent du camp du Centre.
- **Fin de l'étude** (phase `studies` de la journée, calendrier du jeu) :
  - la famille est tirée À LA RÉVÉLATION selon l'artefact actif à ce moment (études en cours comprises), puis un talent de cette famille (repli sur les talents sans famille tant qu'une famille est vide) ; le résultat (famille, chances, talent) est enregistré une seule fois, jamais retiré au chargement ;
  - le carnet de bord annonce « Étude terminée : Nom a révélé le talent X. » (« son second talent X », ou le talent qu'il remplace) ;
  - le combattant redevient disponible.
- **Partie chargée après la date de fin** : l'étude se termine au chargement, sans rejouer de journée. La révélation est annoncée une fois, par un message à l'écran.
- **Interruption** : avec confirmation. Aucun talent n'est révélé, le temps passé est perdu (et le prix d'une nouvelle étude), seule sa place se libère et le combattant redevient disponible.

**La Professeure Flavia** (v0.60 : `data/scriptorium.js`, `systems/talents/ScriptoriumUpgradeService.js`, sprite `assets/sprites/scriptorium/professor_flavia.svg`)
- Robe vert forêt brodée d'or, couronne et voile, livre relié ; dans son cabinet (premier plan à gauche) : rayonnage, table de travail (manuscrits, astrolabe, sablier, chandelle), tapis vert, chandelier. Zone d'interaction logique de **4 × 4 cases** (illuminée au survol seulement), sans empiéter sur le Bureau d'étude. La salle passe à 13 × 13 cases.
- **Second Bureau d'étude** : 2 500 deniers, achat unique (`session.scriptorium.deskUpgrade`) ; un second bureau apparaît dans la salle.
- **Artefacts** (v0.61 : amélioration par paliers) : au départ seul le **Grimoire de guerre** est à vendre ; il débloque l'**Encyclopédie du guerrier**, qui débloque le **Traité de Poliorcétique** (`requires` dans `data/scriptorium.js`). Chaque palier est une configuration complète de chances qui remplace la précédente (jamais de cumul) ; le plus haut palier acquis est actif (`activeArtifactId`, normalisé au chargement). Plus de réactivation d'un palier inférieur. Identifiants inchangés dans les sauvegardes (`lugubre`, `brillant`, `grand`).

  | Configuration | Prix | Ordinaire | Rare | Épique |
  |---|---:|---:|---:|---:|
  | Aucune amélioration | gratuit | 80 % | 19 % | 1 % |
  | Grimoire de guerre | 2 000 | 60 % | 36 % | 4 % |
  | Encyclopédie du guerrier (après le Grimoire) | 6 000 | 50 % | 44 % | 6 % |
  | Traité de Poliorcétique (après l'Encyclopédie) | 10 000 | 20 % | 60 % | 20 % |

- Le Bureau d'étude et l'interface de choix affichent toujours les chances de la configuration active (celles réellement utilisées).
- **Flavia vit dans son cabinet** (v0.60.1, `scriptorium/FlaviaBehavior.js`) : elle lit à sa table, puis en sort par la gauche, flâne sur le tapis vert, alterne ses deux habitudes (v0.61) — aller au rayonnage sortir un **livre bleu** (2,2 s) puis le lire **4 secondes** sur le tapis vert (elle le repose à sa table), et caresser son chat : il l'attend assis (`requestPet`), elle se place à côté de lui à l'écran (sans le cacher), se penche, et il ronronne les yeux fermés sous de petits cœurs. Elle contourne sa table (point `hub`), ne quitte jamais son cabinet, et renonce si une souris surgit. La zone cliquable de 4 × 4 cases reste la même ; un clic sur Flavia elle-même fonctionne où qu'elle soit.
- **Le Sacré de Birmanie** (`scriptorium/CatBehavior.js`) : crème aux extrémités brunes, gants blancs, yeux bleus ; il se promène, regarde autour de lui, s'assoit, dort sur son coussin, boit et mange à ses gamelles. **La souris** sort d'un interstice du rayonnage en moyenne toutes les 20 s (± 6 s), le chat la remarque, la poursuit, puis guette le trou du mur où elle s'est réfugiée. Une seule poursuite à la fois ; tout avance avec les images affichées (rien ne s'accumule hors du Scriptorium) ; purement décoratif, rien n'est cliquable.
- **Départ du combattant** : une étude dont le combattant quitte la compagnie est annulée.

## Se déplacer dans le domaine (v0.44.0)

La carte elle-même sert à se déplacer : on va d'un lieu à l'autre par les chemins et les portes représentés.

| Lieu | Passage | Mène à |
|---|---|---|
| Le Centre (hub) | chemin haut-droite (nord-est) | La Taverne |
| Le Centre | chemin bas-droite (sud-est) | Le Bourg |
| Le Centre | chemin haut-gauche (nord-ouest) | Le Scriptorium (v0.59, à la place du Centre de formation prévu) |
| Le Centre | chemin bas-gauche (sud-ouest) | Ma Lice d'entraînement (v0.71 ; auparavant fermé) |
| Ma Lice d'entraînement | chemin de droite (est) | Le Centre |
| La Taverne | la porte | Le Centre |
| Le Scriptorium | la porte (mur de gauche) | Le Centre |
| Le Bourg | chemin haut-gauche (nord-ouest) | Le Centre |

- **Fondu** (v0.73.2) : le fondu au noir ne couvre que la carte (le canvas du lieu), jamais tout l'écran : il se pose sur la carte de départ, puis sur celle d'arrivée (`ui/navigation/travel.js`, `fitVeil`).
- **Repères** : un poteau indicateur marque chaque chemin ouvert. Un lieu à venir aurait une barrière (aucun aujourd'hui).
- **Ce qui se clique** (v0.68.1) : le bout de chemin au sol, et aussi le poteau lui-même (mât et planche, `exitAtSignpost`). Au Centre, un combattant dont la silhouette déborde sur le chemin (depuis la case de devant) ne le masque plus : seul celui qui se tient sur la case de sortie passe avant.
- **Survol** : le bout de chemin ou la porte s'illumine ; la destination s'affiche (« ↗ La Taverne · Prendre le chemin ») et le curseur change. La porte de la Taverne s'entrouvre.
- **Clic** : fondu au noir, puis le nouveau lieu apparaît.
- **Arrivée** : le passage d'arrivée luit un instant. Au Centre et au Bourg, la caméra part de ce chemin puis rejoint la vue d'ensemble ; dans la Taverne, on entre par la porte, qui s'ouvre.
- **Colonne de droite** : elle ne garde que les interfaces globales (La Compagnie, La Ligue, Le Coffre, l'Almanach) et l'entrée au Centre. Les onglets Taverne, Bourg et Ma Lice sont retirés.
- **Architecture** : aucune destination n'est écrite dans les cartes.
  - `data/locations.js` : `LOCATIONS` (lieu, écran, disponibilité) et `LOCATION_EXITS` (`source`, `destination`, `interactionType` path/door, `position`, `marker`, `enabled`, `transition`, `arrival` pour un retour cohérent, `direction`).
  - `systems/navigation/LocationNavigationService.js` : sorties d'un lieu, état ouvert / à venir / fermé, destination, voyage.
  - `ui/navigation/travel.js` : fondu et changement d'écran (`HubScreen.travel(exitId)`).
  - `render/exitMarkers.js` : poteaux, barrière, lueur, indication.
  - Ajouter un lieu = une entrée dans `LOCATIONS` (avec son écran) et ses sorties.

**Retraits**
- **Ma Lice** : écran, scène, accès, entrée de l'Almanach.
- **Le maître d'œuvre** : PNJ, dialogue, boutons, sprite, données.
- **Dépendances conservées** : le niveau de la lice du club (`session.liceLevel`, `data/liceUpgrades.js`, `systems/lice/`) sert toujours à la recette des victoires à domicile, au décor du terrain à domicile (`data/myLiceLayout.js › arena`) et au bonus de spectateurs. Aucune amélioration n'est proposée pour l'instant.
## L'Almanach

**L'Almanach** est la documentation du jeu, présentée comme un ouvrage médiéval : un livre ouvert sur parchemin, avec double filet, lettrines, filets ❖ et encadrés. Le bouton **📖 L'Almanach** se trouve dans la colonne de droite des écrans de gestion, sous Le Coffre.
- **Retour** : il ramène à l'écran d'origine (paramètre `returnTo`), la partie intacte. La touche Échap fait de même.
- **Lecture seule** : l'Almanach ne lit que les règles du jeu ; il ne modifie jamais une partie.

**Navigation (3 niveaux)** :
- **Catégories** : le sommaire, sur la page de gauche.
- **Articles** : ceux de la catégorie ouverte, listés dans le sommaire et sur la page de la catégorie (vignette, présentation, fiches).
- **Contenu** : l'article lui-même, avec fil d'Ariane (retour à la catégorie), liens entre articles, « Voir aussi » et article précédent ou suivant.

La catégorie et l'article actifs sont mis en évidence, et la dernière page lue est rouverte. Sur téléphone, le sommaire passe au-dessus de la page.

**Contenu** : 8 catégories (Le Monde, Les Combattants, Le Combat, Le Centre, Le Bourg, La Taverne, Le Coffre, Les Compétitions) et 32 articles, qui décrivent les mécaniques existantes sans en inventer.

**Architecture** (rien n'est codé dans l'interface) :
- `data/almanac/categories.js` et `data/almanac/articles/*.js` : catégories et articles en **données**. Un article est une liste de **blocs** : paragraphe d'ouverture avec lettrine, paragraphe, sous-titre, liste, encadré, exemple, tableau, fiches illustrées, illustration, séparateur. Le format est documenté dans `data/almanac/index.js`.
- **Valeurs du jeu** : dans les textes, `{{clé}}` insère une valeur **lue dans les règles** (`systems/almanac/almanacFacts.js` : seuil de fatigue, prix, places, points, bonus…). Aucun chiffre n'est recopié : si une règle change, l'Almanach suit. L'exemple de coup de l'article « Les attaques » est calculé par le moteur de dégâts lui-même.
- **Tableaux et fiches générés** : un bloc `{ type: 'table', source }` ou `{ type: 'collection', source }` est construit depuis les données (lieux du Centre, améliorations et leurs prix, consommables, spécialités, artisans, Combats de la Reine…).
- **Mise en forme et liens** : `**gras**` et `[[articleId|libellé]]` (lien vers un autre article).
- **Les modules** :
  - `AlmanacRepository` : lecture des données et contrôle de cohérence (identifiants, catégories, blocs, valeurs, tableaux, liens) ;
  - `AlmanacService` : textes résolus, tableaux générés, navigation ;
  - `ui/almanac/AlmanacArticle.js` : rendu des blocs ;
  - `ui/almanac/AlmanacCategory.js` : sommaire et page de catégorie ;
  - `ui/screens/AlmanacScreen.js` : l'écran.
- **Illustrations** (`ui/almanac/illustrations.js`, par `kind`) :
  - images du jeu : sprites des spécialités, artisans, objets, cycle des classes, étoiles ;
  - dessins faits d'après les règles : jauge de fatigue avec son seuil, plan de la lice et ses zones ;
  - vignettes des catégories : `assets/almanac/*.svg`.

  Les remplacer ou en ajouter ne touche pas à la navigation ; une illustration inconnue n'affiche rien.
- **Étendre** :
  - un nouvel article : une entrée de données ;
  - une nouvelle catégorie : une entrée dans `categories.js` ;
  - une nouvelle valeur : une ligne dans `ALMANAC_FACTS`.

  Les tests vérifient que toutes les valeurs, tous les liens et toutes les illustrations existent.
- **Niveaux chiffrés** : l'Almanach n'en affiche aucun pour un combattant. Il explique que les étoiles reflètent la moyenne des compétences, sans le barème chiffré.

## Le Coffre et les consommables

**Le Coffre** est l'inventaire du joueur. Le bouton **🧰 Le Coffre** se trouve dans la colonne de droite de tous les écrans de gestion, sous le Trésor ; il indique aussi le contenu (« 5 objets · 🍞 ×3 🍷 ×2 »). Il ouvre une fenêtre sans quitter l'écran ni toucher au déroulement de la journée. Après une utilisation ou une destruction, l'écran est réaffiché à la fermeture.

**Objets** (`data/items.js`) : chacun a `id`, `name`, `icon`, `sprite` (`assets/sprites/items/`), `description` et `consumable`. Il précise aussi où on peut l'utiliser (`usableIn`), sur qui (`target`) et son **effet** `{ type, value, duration }`.

| Consommable | Prix (Boulanger) | Utilisation | Effet | Durée |
|---|---|---|---|---|
| 🍞 Pain au méteil | 50 deniers | Hors combat (Le Coffre) et pendant le placement | Fatigue → 0 (`SET_FATIGUE`) | Définitif : la fatigue évolue ensuite normalement |
| 🍷 Hypocras | 50 deniers | Pendant le placement uniquement | +10 % de dégâts finaux (`FINAL_DAMAGE_BONUS`) | La manche qui suit, puis il disparaît |

- **Empilement** : les objets identiques n'occupent qu'une ligne (« Pain au méteil ×3 »). Seules les quantités sont sauvegardées (`session.inventory = { [itemId]: n }`) ; nom, image et description viennent des données.
- **Achat** (`systems/shop/ShopService.js`, offres dans `data/borough.js › BOROUGH_SHOPS`) : il vérifie les deniers, débite le prix, puis ajoute l'objet au Coffre (`InventoryService.addItem`). La quantité est mise à jour aussitôt, dans la boutique (« Dans le Coffre : ×3 ») et dans la colonne de droite. L'achat est refusé faute de deniers (bouton désactivé, montant manquant indiqué). Le Boulanger ne fait qu'acheter : il n'applique aucun effet.
- **Utiliser** : on choisit un combattant, puis on confirme (« Donner à … »). L'effet est appliqué, puis un exemplaire est consommé. Rien n'est consommé si l'utilisation est refusée.
  - Hors combat, on peut donner l'objet à tout combattant de la compagnie.
  - Pendant le placement, uniquement aux 5 combattants alignés pour la manche.
  - Les cibles impossibles sont grisées, avec leur raison (« La fatigue de X est déjà à 0. », « … en bénéficie déjà (non cumulable) »).
  - Sans aucun combattant valide, le bouton « Utiliser » est désactivé et la raison est affichée.
- **Détruire** : on choisit la quantité, avec un avertissement (« perdus définitivement ») et une confirmation. À 0, l'objet disparaît du Coffre.
- **Pendant le placement** : le bouton **🧰 Le Coffre** se trouve dans les actions de placement. Il est disponible à chaque nouvelle phase de placement (manches 1, 2 et 3), tant qu'il reste des exemplaires.
  - Le Pain agit tout de suite : la fatigue affichée et les couleurs du combattant changent aussitôt.
  - L'Hypocras affiche une pastille **🍷 +10 %** à côté du nom et au-dessus du combattant dans la lice.
- **Hypocras, non cumulable** : un combattant qui a déjà un Hypocras actif pour la prochaine manche ne peut pas en recevoir un second. L'objet reste alors dans le Coffre, donc jamais +20 %.
- **Effets temporaires** (`systems/items/CombatEffectService.js`) : `{ id, type, targetFighterId, value, duration, sourceItemId, matchId, createdOnDay, expiresAt: { matchId, round } }`, sauvegardés dans `session.activeEffects`. Ils ne sont jamais inscrits dans les statistiques du combattant.
  - **En début de manche**, `RoundService` lit les effets du combattant pour cette manche (`getRoundEffects`). Le moteur applique le bonus au moment de chaque coup, sur le **multiplicateur final** des dégâts, avant l'arrondi : 20 → 22.
  - **Cumul avec les bonus de position** : les bonus de dégâts finaux s'additionnent (Hastier à distance +20 % et Hypocras +10 % donnent ×1,3).
  - **Pendant la manche**, la pastille 🍷 reste visible au-dessus du combattant jusqu'à son KO ou la fin de la manche. Elle figure aussi dans « Bonus au lancement ».
  - **En fin de manche**, l'effet est supprimé (`expireRoundEffects`).
  - **Combat abandonné** : si l'on quitte un combat avant la manche (rechargement), ses effets sont supprimés à l'ouverture du combat suivant (`clearStaleEffects`).
- **Responsabilités** :
  - Boulanger (`ShopService`) : l'achat ;
  - `InventoryService` : le stockage et la consommation ;
  - `ConsumableService` : le contexte, les cibles et l'application des effets, via un registre par **type d'effet** (`EFFECT_HANDLERS`), jamais par objet ;
  - `CombatEffectService` : les effets temporaires ;
  - moteur de combat : le calcul des dégâts.
- **Ajouter un consommable** : une entrée dans `ITEMS`, plus une offre dans `BOROUGH_SHOPS` s'il se vend. Un nouveau type d'effet s'ajoute à `ITEM_EFFECT_TYPES` et à `EFFECT_HANDLERS`.
- **Anciennes sauvegardes** : elles s'ouvrent avec un Coffre vide et aucun effet.

## Mises à terre et médailles

Depuis la v0.37.0, chaque combattant **du joueur** tient une statistique de carrière : ses **mises à terre**, c'est-à-dire les adversaires qu'il a mis KO par son coup fatal.

- **Attribution** : le moteur de combat constate le KO dans `CombatController.strike` et appelle aussitôt `simulateRound({ onKnockout })` avec l'auteur du coup fatal. `systems/fighters/CareerStatsService.recordTakedown` ajoute alors +1, à lui seul. Les combattants qui ont frappé la cible avant ne reçoivent rien.
  - Chaque KO compte, à chaque manche, sans limite par manche ni par combat.
  - Cela vaut pour tous les combats joués dans la lice : championnat et Combats de la Reine.
  - Le calcul des dégâts n'est pas touché.
- **Donnée de carrière** : le compteur est enregistré sur le combattant, dans son palmarès (`fighter.record.takedowns`, lisible aussi par `fighter.takedowns`).
  - Un nouveau combattant commence à 0 ; une ancienne sauvegarde aussi.
  - Le compteur n'est jamais remis à zéro : ni entre deux combats, ni entre deux saisons, ni lors d'un changement de division.
- **Médailles** (`data/careerMedals.js`) : 🥉 Bronze 5, 🥈 Argent 25, 🥇 Or 50, 🏅 Platine 100, 💎 Diamant 300.
  - Elles sont **cumulatives** : une médaille gagnée ne disparaît jamais.
  - Elles sont déduites du compteur (`getUnlockedMedals`), jamais enregistrées.
  - `getNewMedals(avant, après)` détecte une médaille qui vient d'être débloquée. Chaque manche garde ses mises à terre et les médailles gagnées (`round.takedowns`), prêtes pour une future notification « Nouvelle médaille obtenue ! ».
- **Fiche du combattant** : une section « Carrière » sous le palmarès affiche le compteur, les médailles obtenues côte à côte de Bronze à Diamant, et la prochaine médaille à décrocher.
  - Les combattants de l'IA ne sont ni suivis ni affichés.
- **À valider** : un combat du joueur passé sans être joué (avance rapide) est tiré au sort, pas simulé dans la lice. Il n'y a donc pas de KO, ni de mise à terre.

## Capitaine

Réglages : `data/captain.js`. Logique : `systems/roster/CaptainService.js`. Pour l'instant, c'est un **statut d'identification seulement** : aucun bonus, aucun rôle en combat.

**Capitaine du joueur** : le premier combattant, créé par le joueur.
- **Choix du joueur** :
  - spécialité (Lutteur, Hastier ou Runner) ;
  - apparence parmi les 4 sprites de la spécialité choisie, définitive ;
  - nom, validé comme tout nom de combattant.
- **Règles appliquées** :
  - compétences de niveau tirées entre 15 et 35 ; PV et fatigue habituels ;
  - **21 ans** ;
  - potentiel d'au moins 2, tiré selon la répartition habituelle limitée à 2 et 3 ;
  - `isCaptain = true`.

**Statut** : `Fighter.isCaptain`, donnée explicite, sauvegardée et jamais déduite de la position dans l'effectif.
- **Unicité** : un seul capitaine par équipe (`setPlayerCaptain`, `checkSingleCaptain`).
- **Capitaine congédié** : le membre le plus ancien de la compagnie devient capitaine.

**Clubs de l'IA** : même modèle `Fighter`.
- **Données** : le capitaine est le 1er ou le 2e combattant du club, inscrit dans les fichiers (`"captain": true`) et modifiable dans Admin › Gestion des clubs (colonne « Capitaine »). La base de clubs garantit exactement un capitaine par club.
- **Capitaine qui part** : s'il quitte l'effectif dans une partie (congédié par un recrutement), le 1er ou le 2e de l'effectif restant devient capitaine, et c'est enregistré dans la partie (`aiCaptains`).

**Affichage** : une couronne 👑 à droite du nom (`CaptainCrown`, `FighterName`), séparée du nom enregistré, identique pour le joueur et l'IA. Elle apparaît sur les cartes, la fiche, la sélection pour un combat, le placement, les résultats, le Centre, les fiches de club et l'Admin.

**Anciennes sauvegardes** : le membre le plus ancien de la compagnie devient capitaine, sans changer ses caractéristiques.

## Âge et potentiel des combattants

Réglages : `data/fighterProfile.js`. Logique centralisée : `systems/fighters/PotentialService.js` (`updateFighterPotential`), sans dépendance à l'interface.

- **Âge** : tiré entre 18 et 35 ans à la création, puis **+1 an à chaque fin de saison** (`SeasonService.applyAgeIncrease`). Le nombre de jours écoulés n'y joue aucun rôle.
- **Potentiel** : capacité d'évolution future, de 0 à 3, affichée par une jauge de 3 flammes (🔥).
  - Tirage à la création (v0.53.0) : 0 → 60 %, 1 → 30 %, 2 → 8 %, 3 → 2 %. Le capitaine du joueur garde l'ancienne répartition (25 / 40 / 30 / 5 %, `captainDistribution`), restreinte à son potentiel minimal.
  - C'est une donnée de jeu enregistrée avec le combattant (`potential`), destinée au prochain système d'évolution. Ce n'est jamais une évolution garantie.
- **Évolution du potentiel** : une vérification **tous les 15 jours de jeu** (10 avant la v0.53.0), à partir du jour de création du combattant. Si des jours ont été sautés, les vérifications manquées sont rattrapées ; aucune n'a lieu au chargement.

  | Âge | Règle (potentiel actuel → chance) |
  |---|---|
  | 18–25 ans | +1 : 0 → 16 %, 1 → 8 %, 2 → 4 % (v0.56.0, avant 20 / 10 / 5) |
  | 26–31 ans | +1 : 0 → 40 %, 1 → 24 %, 2 → 1 % (v0.56.0, avant 50 / 30 / 1) |
  | 32 ans et plus | −1 : 1 → 1 %, 2 → 3 %, 3 → 5 % |

  Le potentiel reste toujours entre 0 et 3.
- **Carnet de bord** (tuile « Potentiel »), uniquement en cas de changement effectif : « Eudes (21 ans) a gagné du potentiel ! » ou « Eudes (35 ans) a perdu du potentiel. »
- **Affichage** : âge et flammes sur la fiche du combattant et sur les cartes de la Taverne.
- **Combattants concernés** : ceux de la compagnie du joueur et les recrues de la Taverne. Les combattants des clubs de l'IA ont un âge (18 à 31 ans à la création de la partie, 18 à 35 pour leurs recrues ; +1 par fin de saison ; retraite à 36 ans) qui sert à leur vieillissement, mais pas de potentiel.
- **Anciennes sauvegardes** : âge et potentiel sont tirés au premier chargement, puis enregistrés.

## Clubs de l'IA : recrutements, progression et niveau dynamique

Les clubs de l'IA évoluent au fil des journées. Le passage d'une journée suit l'ordre `activités → événements → retraites de l'IA → recrutements de l'IA → progression de l'IA → ligue`. Réglages communs : `data/aiRecruitment.js` (`AI_MAX_ROSTER_SIZE` 12, `AI_RETIREMENT_AGE` 36, `AI_MIN_ROSTER_AFTER_RETIREMENT` 9, `AI_DAILY_RECRUITMENT_CHANCE` 1 %, `AI_INITIAL_AGE_OFFSET` −2).

- **Tirage** : chaque jour, chaque club de l'IA a 1 % de chances de recruter. Le tirage est propre à chaque club ; cela vaut pour les 3 divisions et les clubs hors championnat.
- **Recrue** : construite autour d'un combattant **tiré au hasard parmi les 4e à 7e plus forts** du club (`referenceRange`). Son niveau est celui de ce combattant, avec un écart autorisé réglable (`levelSpread`, non défini : 0). Effectif plus court : les positions existantes de cette plage, sinon le plus faible. Elle reçoit un âge (18 à 35 ans).
  - Elle passe par le même générateur que les autres combattants de l'IA : nom, spécialité, sprite définitif.
  - Elle a un palmarès vierge.
- **Progression quotidienne** (`systems/clubs/AIProgressionService.js`, réglages `data/aiProgression.js`) : après les recrutements, un tirage par combattant de l'IA, une seule fois par jour (`aiProgressionDay`). Jamais pour les combattants du joueur.
  - **Moins de 32 ans** : +1 point de niveau (et non une étoile) avec 6,7 % de chance de 0 à 3 ★, 3,3 % à 3,5–4 ★, 1,3 % à 4,5–5 ★ (étoiles actuelles du combattant ; v0.56.0 : freiné ×1,5, avant 10 / 5 / 2 %).
  - **32 ans et plus** : plus de progression ; −1 point avec min(âge − 30, 5) % de chance (32 ans 2 %, 33 ans 3 %, 34 ans 4 %, 35 ans et plus 5 %).
  - Niveau borné entre 0 et 100 ; les étoiles du combattant et du club en sont recalculées par RatingService. Rien au carnet de bord.
  - **Historique** : chaque changement est enregistré (`aiProgressionEvents` : combattant, jour, niveau avant/après, variation) ; les événements de plus de 30 jours sont supprimés.
  - **Âge** : tiré une fois (18 à 31 ans, voir « Âge initial » ci-dessous) pour chaque combattant de l'IA (nouvelle partie ou sauvegarde antérieure), puis +1 an à chaque fin de saison.
- **Fiche d'un club adverse** : bouton **« Montrer la progression »** (« progression sur les 30 derniers jours » en dessous). Au clic, à droite du nom, d'après le **bilan net** des 30 derniers jours (`getProgressionIndicator`) : rien (0), ↑ (+1 ou +2), ↑↑ (+3), ↑↑↑ (+4 et plus), ↓ (−1 et moins). L'interface ne fait qu'afficher l'indicateur du service.
- **Effectif** : 12 combattants au maximum (`AI_MAX_ROSTER_SIZE`), quel que soit le type de recrutement. Une recrue qui porte l'effectif à 13 entraîne le congédiement immédiat du plus faible, selon le niveau numérique (jamais les étoiles, les PV ou la fatigue) : **départ lié au niveau**.
- **Retraite** : un combattant de l'IA qui atteint **36 ans** quitte aussitôt son club. L'âge augmente en fin de saison : la retraite est appliquée dans la foulée, puis vérifiée chaque jour (première phase de l'IA) et au chargement d'une sauvegarde. Un retraité n'est plus dans l'effectif, le niveau du club, les combats, la progression ni les recrues.
  - **Remplacement** : si l'effectif passe alors **sous 9**, une recrue le remplace aussitôt (même générateur, référence 4e à 7e), sans tirage de 1 %. À 9 ou plus, pas de remplacement.
- **Âge initial des combattants de l'IA** (nouvelle partie) : moyenne abaissée de 2 ans sans sortir des bornes : tirage entre 18 et 31 ans (moyenne 24,5) au lieu de 18–35 (26,5). Les combattants du joueur, son capitaine, les recrues de l'IA en cours de partie et les âges déjà enregistrés ne changent pas.
- **Historique d'effectif** (`session.clubRosterEvents`, sauvegardé) : chaque entrée et sortie, avec nom, âge, spécialité et jour figés au moment de l'événement :
  - `RECRUITMENT` : « Eudes (23 ans), nouvel hastier a été recruté. » (recrutement naturel ou remplacement) ;
  - `DEPART_NIVEAU` : « Jean (26 ans), a été congédié. » ;
  - `DEPART_RETRAITE` : « Marc (36 ans), est parti du club (retraite). »
  - Affiché dans la fiche du club (« Mouvements de l'effectif », du plus récent au plus ancien). Rien de plus au carnet de bord.
- **Niveau du club** : jamais enregistré. Le top 8, sa moyenne et les étoiles sont recalculés à chaque lecture (classements, fiches, Combats de la Reine). Un club ★★★ en début de saison peut donc passer ★★★½ puis ★★★★.
- **Carnet de bord** : « Un nouvel hastier a été recruté chez Les Ardents. », dans les rumeurs repliées en bas du carnet. Seuls les recrutements des clubs de la **division actuelle du joueur** sont annoncés ; la règle suit les montées et descentes.
- **Sauvegarde** : seules les données sources sont enregistrées.
  - **Effectif de la partie** de chaque club qui a recruté (`aiRosters`).
  - **Recrues** (`aiFighters`), avec leur niveau et leur âge.
  - **Évolution des combattants d'origine** (`aiFighterStates`) : écart de niveau par rapport à la base de clubs et âge. La base de clubs, partagée par toutes les parties, n'est jamais modifiée ; un score changé dans l'Admin reste donc pris en compte (plus l'écart de la partie).
  - **Historique de progression** (`aiProgressionEvents`) et dernier jour traité.
  - Niveaux et étoiles sont recalculés au chargement. Les combattants d'origine restent lus dans la base de clubs.
- **Module Admin** : les noms et scores des combattants d'origine s'appliquent toujours. En revanche, une fois qu'un club a recruté dans une partie, son effectif y est géré par la partie : un combattant ajouté ensuite dans l'Admin n'y apparaît pas.

## Combats de la Reine

Événements spéciaux, **indépendants du championnat**. Ils ne modifient ni le classement, ni les matchs joués, ni les montées et descentes, et ne remplacent jamais une journée de championnat. Réglages : `data/queenCombat.js`. Service : `systems/queen/QueenCombatService.js`.

- **Fréquence** : 15 à 18 jours après le précédent, en commençant par le début de partie. La date tirée est enregistrée.
- **Pas de doublon de date** : deux combats ne partagent jamais une journée. Une Reine qui tomberait sur une journée de championnat est décalée au premier jour libre suivant.
- **Calendrier** : type `queen` (`QUEEN_COMBAT`), en orange dans la frise, les prochains événements, le bandeau et le bouton **♛ COMBAT DE LA REINE**. Les couleurs viennent de la présentation (`EVENT_TYPES` et CSS). C'est une journée de combat : le Centre est fermé.
- **Le jour venu**, **5 adversaires** distincts sont tirés et enregistrés (`opponentOptions`), puis classés **du moins étoilé au plus étoilé**, de gauche à droite (à égalité, ordre du tirage) :
  - **origine** tirée pour chacun : Hors championnat 50 %, Ligue 2 20 %, Ligue 3 20 %, Ligue 1 10 %. Les ligues désignent les clubs qui y sont engagés cette saison ;
  - **récompense** fixée à ce moment : (barème selon les étoiles ★ 10, ★★ 30, ★★★ 60, ★★★★ 150, ★★★★★ 450 deniers ± 15 %, arrondi au denier) **× 2** (`rewardMultiplier`, propre aux Combats de la Reine). Un tirage de 8 devient 16, 410 devient 820. Le montant affiché est celui gagné en cas de victoire.
- **Autres Combats de la Reine** (`secondaryMatches: 4`) : le même jour, **4 combats IA contre IA** sont tirés en même temps que les propositions.
  - **8 clubs distincts**, tirés au hasard parmi **tous les clubs éligibles** (les 3 ligues et le hors championnat), **sans filtre de ligue** : Ligue 1 contre Ligue 3, hors championnat contre hors championnat, etc. Puis appariés deux à deux.
  - Les 5 adversaires proposés au joueur sont **explicitement exclus** du tirage, et le joueur n'y figure jamais : **13 clubs** en tout (5 + 8), tous différents. Un contrôle d'intégrité (`validateQueenDraw`) vérifie les nombres et l'absence de doublon.
  - **Écran de choix** : les 4 affiches (emblèmes, noms, origine) sous les cartes, **sans résultat**.
  - **Simulation** : après le combat du joueur, chacun est simulé **une seule fois** par le moteur de tous les combats IA (`MatchService.simulateMatch` : effectifs et manches automatiques, probabilité selon le niveau des 5 engagés, fatigue en cours de combat). Le résultat (vainqueur, manches) est enregistré dans l'événement et jamais recalculé.
  - **Page de résultat** : les 4 scores en manches (ex. 2 – 1), vainqueur en gras, au format des autres combats de la journée.
  - **Carnet de bord** : jamais. La simulation secondaire ne renvoie aucun événement de carnet ; seul le combat du joueur y figure.
  - **Conséquences** : celles que le moteur prévoit pour un combat IA hors championnat, c'est-à-dire aucune donnée durable (voir « À valider »). Les résultats restent enregistrés dans la sauvegarde.
  - Combat de la Reine **manqué** (avance rapide) : les 4 autres combats ont lieu quand même.
- **Choix** : le joueur choisit un seul adversaire, après confirmation. Le choix est définitif et enregistré aussitôt (sauvegarde automatique) ; les autres sont abandonnés.
- **Lice dédiée** (`arenaDecorationId: 'lice_queen'`) : les **abords du château**, utilisés par aucun autre combat. Même grille et même rendu que La Lice : terrain d'herbe, chemin pavé le long du grand côté avant, remparts et tours de pierre sobres à l'arrière, matériel militaire et utilitaire, sans dorures.
- **Combat** : même déroulement et même moteur qu'un combat de championnat.
  - **Fatigue** : par le système existant. Aucune valeur propre n'est définie pour la Reine (`fatigue: null`), donc la règle des combats de championnat s'applique.
  - **Récompense** : versée après le combat, en cas de **victoire** seulement ; en cas de défaite, 0 denier.
- **Avance rapide** (Admin › Temps) : un Combat de la Reine non disputé est **manqué** (aucun combat, aucune récompense).
- **Sauvegarde** : tout est enregistré dans l'événement du calendrier : date, propositions (club, origine, étoiles, récompense), combats secondaires et leurs résultats, état, adversaire choisi, résultat. Une ancienne sauvegarde sans combats secondaires les reçoit à l'ouverture de l'écran (hors adversaires déjà proposés).

**Clubs hors championnat** : `data/leagues/reserve.json` compte 14 clubs, modifiables dans Admin › Gestion des clubs › Hors championnat. Ils n'apparaissent dans aucun classement ni calendrier de championnat et ne sont pas concernés par les montées et descentes.

## La Lice : grille, décors et foule

**Grille de combat** (`data/arenas.js`) : 13 cases de longueur × 8 de largeur. Les deux camps se font face dans la longueur :
- camp du joueur : x 1 à 5 ;
- adversaire : x 7 à 11 ;
- la colonne x = 6 sépare les deux camps.

Chaque camp a 8 emplacements par défaut, sans lecture des classes ; la formation du béhourd est celle du placement automatique. La grille ne contient que des données de jeu.

**Présentation**, sans aucun effet sur le combat : grille, placements, manches et probabilités sont identiques quel que soit le décor ou l'affluence.

```
Combat (règles)                       Présentation
  data/arenas.js     grille 13 × 8      data/liceDecorations.js   décors
  MatchService       placements         data/crowd.js             affluence, placement de la foule
  RoundService       manches            data/spectators.js        11 sprites de spectateurs
                                         systems/crowd/CrowdService.js         calculateCrowdSize()
                                         combat/presentation/                  décor, foule, LicePresentation
                                         combat/render/IsoRenderer.js          rendu
```

**Décors** (`LICE_DECORATIONS`), décrits comme des données :
- **Contenu** : fond, sols (Lice, bande des spectateurs, alentours), palissade et éléments tirés au hasard (disposition stable).
- **Éléments hauts** (maisons, tentes, remparts, arbres) : seulement sur les côtés arrière ; les côtés avant, entre la caméra et La Lice, restent bas.
- **Décor d'un combat** : tiré selon les poids `weight` des décors, de façon stable pour un combat donné.

| Décor | Identifiant |
|---|---|
| Clairière forestière (décor d'origine) | `lice_forest` |
| Grève sablonneuse | `lice_sand` |
| Place du village | `lice_village` |
| Cour du château | `lice_castle` |
| Campement militaire | `lice_camp` |
| Abords du château (réservé aux Combats de la Reine, jamais tiré pour les autres combats) | `lice_queen` |

**Affluence** (`CrowdService.calculateCrowdSize(teamA, teamB, league)`, réglages dans `data/crowd.js`) :
1. Prestige d'un club = (N − rang) / (N − 1). Les clubs à égalité au classement partagent leur rang moyen, donc tous sont au milieu en début de saison.
2. Prestige du combat = moyenne des deux clubs.
3. Affluence de référence (Ligue 3) : interpolation de `referenceCurve`. Repères : 18e contre 16e → 1 ; 11e contre 6e → 12 ; 2e contre 1er → 40.
4. Effet de la division (`byTier`) : multiplicateur, minimum et maximum. Ligue 1 > Ligue 2 > Ligue 3, à classement égal.
5. Légère variation (± 12 %), stable pour un même combat.
6. Règle prioritaire pour un Combat de la Reine (`byCombatKind.queen`) : **au moins 50 spectateurs**.

**La Reine** : sprite unique (`assets/sprites/queen_sprite.svg`, `QUEEN_SPRITE`), hors du tirage des spectateurs.
- **Apparence** : couronne d'or, voile, robe pourpre, manteau d'hermine, sceptre.
- **Taille** : un peu plus grande que la foule (×1,18).
- **Place** : spectatrice privilégiée, sur un tapis pourpre au centre du grand côté arrière, au premier rang, avec de la place autour d'elle.
- **Présentation uniquement** : elle n'occupe aucune case et n'intervient pas dans le combat.

**Foule** (`combat/presentation/crowdLayout.js`) :
- **Placement** : deux rangées décalées le long de la palissade, à l'extérieur. Les longs côtés se remplissent d'abord, et le centre de chaque côté avant les extrémités.
- **Orientation** : vus de face derrière La Lice, de dos devant.
- **Variété** : sprite tiré parmi 11 profils (fréquences dans `data/spectators.js`), miroir aléatoire, taille légèrement variable.
- **Plafond** : 110 spectateurs dessinés au plus (`CROWD_LAYOUT.maxRendered`).
- **Lisibilité** : les combattants sont toujours dessinés par-dessus la foule et le décor.

Le sol est dessiné une fois dans un cache.

**Module Admin › La Lice (aperçu)** : choix du décor et du nombre de spectateurs.

**Module Admin** (Options › Administration) : code `yn3yn3yn3`. Il propose des outils pour modifier les statistiques, ajouter des deniers et avancer le temps.

## Clubs adverses (données modifiables)

Les clubs de l'IA sont définis dans **`data/leagues/league_1.json`** (18 clubs), **`league_2.json`** (18) et **`league_3.json`** (17, plus votre compagnie). **`reserve.json`** contient 14 clubs hors championnat (Combats de la Reine, complément d'une division en sous-effectif). Ces fichiers lisibles contiennent un combattant par ligne. Depuis la v0.28.0, ils reprennent les noms, emblèmes, couleurs, niveaux et capitaines définis dans le Module Admin (export « Exporter le fichier JSON » de chaque division). Pour reporter de nouvelles modifications de l'Admin dans le jeu et dans l'exécutable, exportez les 4 fichiers, remplacez ceux de `data/leagues/`, puis relancez `tools\launcher\build.ps1`.

**Répartition dans une nouvelle partie** (`LEAGUE_CONFIG.initialDistribution`, `distributeClubsByLevel`) : les 53 clubs des trois fichiers sont classés par **niveau**, c'est-à-dire la moyenne de leurs 8 meilleurs combattants.
- Les 18 plus forts vont en **Ligue 1**.
- Les 18 suivants vont en **Ligue 2**.
- Les 17 plus faibles vont en **Ligue 3**, avec votre compagnie.

À niveau égal, l'ordre des fichiers départage. Les niveaux de départ ne se chevauchent donc plus : Ligue 1 de 55,9 à 84,1, Ligue 2 de 31,1 à 54,6, Ligue 3 de 9,0 à 30,6. Dans les fichiers, ils se chevauchaient : par exemple Les Loups de Rouen (62,6) étaient en Ligue 2 et Les Lames de Noyon (51,3) en Ligue 1. Le fichier d'un club ne fixe donc plus sa division de départ ; il fixe seulement la taille de chaque division. Avec la valeur `'file'`, chaque club recommence dans la division de son fichier.

En cours de partie, les clubs changent de division au fil des saisons, et la sauvegarde garde les compositions. Les parties déjà commencées ne sont pas redistribuées.

```json
{
  "id": "club_007",
  "name": "La Compagnie Franche de Chartres",
  "emblem": "ecartele",
  "colors": {"primary": "#1f4e9c", "secondary": "#e0b43a", "tertiary": "#b3202a"},
  "fighters": [
    {"id": "club_007_f01", "name": "Geoffroy le Bref", "specialty": "lutteur", "sprite": "lutteur_04", "score": 40}
  ]
}
```

- `emblem` : partition de l'écu, parmi `pal`, `fasce`, `bande`, `chef`, `croix`, `sautoir`, `chevron`, `ecartele`. Pour en ajouter une : `src/data/emblemPatterns.js`.
- `score` : niveau global du combattant, de 0 à 100. **Il n'est jamais affiché au joueur**, qui ne voit que des étoiles.
- `sprite` : sprite du combattant, définitif, **forcément une variante de sa classe** (`<specialty>_01` à `_04`, voir « Sprites »). S'il est absent ou d'une autre classe (combattant ajouté à la main), une variante de sa classe est déduite de l'identifiant et reste donc stable.

**Module Admin › Gestion des clubs**, pour modifier les clubs sans toucher au fichier :

- choix de la division (Ligue 1, 2, 3 ou réserve), ajout ou retrait de clubs, avec le compte attendu (18 / 18 / 17, effectif libre pour la réserve). Un club engagé dans la partie en cours ne peut pas être retiré ;
- le nom, l'emblème et les couleurs, avec un aperçu ;
- la **Terre** et le **lieu** du club, choisis dans des listes tirées des données de géographie. Changer de Terre place le club sur le premier lieu de club de cette Terre. Le lieu choisi est exporté dans le fichier (`"locationId"`) ;
- les combattants : ajouter, renommer, changer la spécialité ou le score, supprimer.

Le sprite est affiché mais ne peut pas être modifié. Un combattant ajouté reçoit un sprite tiré au hasard parmi ceux de sa classe ; changer sa spécialité lui donne la même variante dans la nouvelle classe.

Les modifications sont enregistrées dans le navigateur et s'appliquent immédiatement, y compris aux parties en cours. **Exporter le fichier JSON** produit un fichier qui remplace le fichier `data/leagues/league_N.json` de la division pour rendre les modifications permanentes. **Revenir au fichier** abandonne les modifications locales.

Les sauvegardes ne copient pas les clubs adverses : elles les référencent par identifiant. Elles contiennent le club du joueur, ses combattants, les deniers, la date, la ligue, le classement et les activités.

## Terres et lieux

Le royaume est partagé en 4 **Terres**, chacune à sa couleur. Ce découpage remplace les régions administratives :

| Terre | Couleur | Régions |
|---|---|---|
| Ouest | orange | Normandie, Bretagne, Pays de la Loire |
| Nord | bleu | Île-de-France, Hauts-de-France, Grand Est |
| Centre | vert | Centre-Val de Loire, Bourgogne-Franche-Comté, Auvergne-Rhône-Alpes |
| Sud | marron | Nouvelle-Aquitaine, Occitanie, Provence, Corse |

**Création** : après la France, la carte des Terres s'affiche. Elle est volontairement grossière, sans départements. Au survol, une Terre est mise en évidence et son nom s'affiche ; un clic la choisit. La carte se resserre alors sur la Terre et montre ses 6 lieux de départ. Au survol, un lieu est mis en évidence et son nom s'affiche ; un clic le choisit. Le panneau propose les mêmes choix sous forme de liste, plus « Changer de Terre ». « S'installer » valide le lieu, puis la création continue comme avant. On débute toujours en Ligue 3, quel que soit le lieu.

| Terre | Lieux de départ |
|---|---|
| Ouest | Les Andelys, Château de Caen, Tour d'Oudon, Le Jardin aux Moines, Cité de Locronan, Abbaye de Maillezais |
| Nord | Faubourg de Lille, Parc Saint-Pierre, Château de Pierrefonds, Champ de Crécy, Foire de Provins, Remparts de Langres |
| Centre | Château de la Roche, Sentier de Morez, Donjon de Bressieux, Orée des Monts d'Ardèche, Palais Jacques-Cœur, Colline de Vézelay |
| Sud | Cité de Carcassonne, Tour de Campomoro, Moulin de Bargemon, Château de Cascastel, Cité de Saint-Émilion, Tours de La Rochelle |

Les 8 derniers lieux (v0.58) sont des sites réels, variés (cité, abbaye, foire, remparts, palais, colline, port), tous à plus de 40 km de tout autre lieu. L'Abbaye de Maillezais (Vendée) est légèrement remontée au nord sur la carte pour rester dans le contour grossier de la Terre de l'Ouest.

**Écrans de gestion** : la carte de la compagnie (colonne de droite) affiche une pastille à la couleur de la Terre, avec le nom du lieu dessous.

**Clubs** : chaque club des 3 ligues a sa Terre et son lieu. C'est un site historique ou médiéval cohérent avec sa région, indépendant de son nom. Exemples : Martel → Nord, Château de Vincennes ; Martel La Hire → Nord, Bois de Cergy. Les 53 lieux de clubs sont tous différents. Les clubs hors championnat (réserve) viennent de la **Terre lointaine** (gris-violet), hors de la carte de France.

**Données** (rien n'est écrit dans l'interface) : Terre → Lieu → Club.
- `data/geography/lands.js` : les Terres (`id`, `name`, `shortName`, `color`, `regions`, `countryId`, contours), plus le cadre de la carte par pays.
- `data/geography/locations.js` : les lieux (`id`, `name`, `landId`, `type` = `start` / `club` / `far`, coordonnées). La couleur d'un lieu est celle de sa Terre.
- `data/geography/clubLocations.js` : le lieu de chaque club. Un lieu choisi dans l'Admin prime sur cette table ; sans lieu connu, un club va en Terre lointaine.

**Sauvegarde** : l'équipe enregistre `landId` et `locationId`. La Terre découle toujours du lieu.

**Domicile / extérieur** : voir la section « Domicile et extérieur ». Elle s'appuie sur `GeographyService.getTeamLocation` (club → lieu → Terre).

## Domicile et extérieur (matchs de Ligue)

Depuis la v0.36.0, chaque match de **Ligue** du joueur se joue à domicile (🏠, dans sa lice) ou à l'extérieur (⚔, chez l'adversaire). Les Combats de la Reine ne sont pas concernés.

| Match de Ligue | Lieu | Affiché au-dessus du score | Terrain | Recette |
|---|---|---|---|---|
| 1, 3, 5… | 🏠 Domicile | nom du lieu du joueur (ex. « Château de Caen »), à la couleur de sa Terre | la lice du joueur | victoire : 20 à 50 deniers (lice niveau 1) |
| 2, 4, 6… | ⚔ Extérieur | la Terre de l'adversaire seulement (ex. « Sud »), à sa couleur | décor ordinaire, tiré de façon stable | aucune |
| Combat de la Reine | — | inchangé | lice de la Reine | — |

- **Alternance** (`systems/league/MatchLocationService.js`, règle dans `data/homeAway.js`) :
  - le 1er match de Ligue de chaque saison est à domicile, puis les lieux alternent strictement ;
  - seuls les matchs de Ligue du joueur comptent : une journée où il serait exempt et les Combats de la Reine ne décalent rien ;
  - aucun tirage aléatoire.
- **Enregistré avec le match** : le lieu est fixé à la création du calendrier de la saison et n'est jamais recalculé à l'affichage. Il est enregistré à deux endroits :
  - sur l'événement de calendrier du match (`data.location : 'HOME' | 'AWAY'`), qui sert de fiche du match du joueur (jour, adversaire, statut) ;
  - sur la rencontre de la division (`homeTeamId`).
- **Affichage** (`systems/league/VenueService.js`) : au-dessus du score de l'écran de combat. Le lieu figure aussi dans le carnet de bord, à l'annonce du combat et au résultat.
- **Terrain** (`combat/presentation/CombatArenaService.js`) :
  - à domicile, le décor est **la lice du joueur** (`LiceService.getLiceArenaDecoration`). Il reprend son sable, sa palissade, son herbe et ses maisons, râteliers et tonneaux (`data/myLiceLayout.js › arena`), des bannières aux couleurs de la compagnie, et les éléments `arenaProps` des améliorations acquises. La disposition est la même à chaque match à domicile ;
  - à l'extérieur, le tirage des décors ordinaires est inchangé.
- **Recette** (`systems/league/HomeRewardService.js`, table `HOME_REWARD_BY_LICE_LEVEL` dans `data/homeAway.js`) :
  - une victoire à domicile rapporte un montant tiré entre 20 et 50 deniers inclus (lice niveau 1) ;
  - elle est versée à la validation de la journée, que le combat ait été joué à la main ou automatiquement ;
  - elle est enregistrée sur le match (`data.homeReward`) et affichée au résultat et dans le carnet ;
  - rien pour une défaite ni à l'extérieur.
  - Un niveau de lice s'ajoute dans la table sans toucher au code.
- **Affluence** : à domicile, le bonus de la lice s'applique (neutre tant qu'aucune amélioration n'existe).
- **Anciennes sauvegardes** : les matchs de la saison en cours sans lieu le reçoivent au chargement, par la même règle (pas de hasard), puis il est enregistré.
- **À valider** :
  - un niveau de lice sans entrée dans la table reprend la recette du plus haut niveau défini en dessous ;
  - à l'extérieur, la Terre adverse est elle aussi affichée à sa couleur ;
  - le terrain à domicile reprend les éléments et les couleurs de la lice du club, pas une disposition exacte : la grille de combat (13 × 8) n'a pas la forme d'un enclos de lice.

**À valider** :
- une sauvegarde antérieure à la v0.32 reçoit un lieu de départ par défaut, déduit de l'identifiant de la compagnie (toujours le même, sans tirage aléatoire) ;
- une partie aléatoire (Admin, tests) reçoit un lieu de départ déduit du nom de la compagnie ;
- tous les clubs hors championnat partagent un lieu générique, « Au-delà des frontières » ;
- l'Admin choisit la Terre et le lieu d'un club parmi les lieux existants, mais ne crée ni ne renomme de lieu : les lieux se modifient dans `data/geography/locations.js` ;
- les coordonnées de quelques lieux côtiers (Campomoro, Calais, Barfleur, Brégançon, Roquebrune, Saint-Amand) sont légèrement rentrées pour rester dans les contours simplifiés.

## Sprites

Spectateurs : 11 profils dans `assets/sprites/spectators/`, chacun vu de face et de dos, déclarés dans `src/data/spectators.js` :
- bourgeois, bourgeoise ;
- paysan, paysanne ;
- marchand, seigneur, dame ;
- soldat, archer ;
- moine, enfant.

**Combattants : 12 sprites, 4 par classe.** Catalogue centralisé : `src/data/sprites.js`. Un sprite appartient à **une seule classe** (spécialité) :

| Classe | Sprites | Armure | Arme | Bouclier | Casque |
|---|---|---|---|---|---|
| Runner | `runner_01` à `04` | légère (gambeson, cuir) | — | petit bouclier rond | fermé à grille, type Wolfrib |
| Hastier | `hastier_01` à `04` | plates très lourdes, épaulières | hallebarde, hache d'armes, vouge, bec de corbin | aucun | très fermé (heaume, bassinet à bec, bouche de grenouille, armet) |
| Lutteur | `lutteur_01` à `04` | moyenne (mailles, brigandine, cotte) | épée | écu | salade, barbute, bassinet à camail, casque à nasal |

- **Identifiant, pas chemin** : le combattant enregistre sa classe (`specialtyId`) et son `spriteId` (ex. `hastier_03`) ; le catalogue associe l'identifiant à sa classe, sa variante et ses fichiers.
- **Fichiers** : `assets/sprites/fighters/<classe>/<classe>_<variante>_<animation>.svg` (ex. `hastier/hastier_03_idle.svg`). Identité, classe, variante et animation ne sont jamais mélangées.
- **Animations** : chaque variante déclare ses animations (`animations: { idle: { file, frames, fps } }`). Seule `idle` (image fixe) existe ; `walk`, `attack`, `hit`, `death`, `victory` sont prévues (`SPRITE_ANIMATIONS`). Une animation absente retombe sur `idle` (`getSpriteAsset(spriteId, animation)`), et le rendu accepte déjà une animation (`drawSpriteFigure({ animation })`). Ajouter une animation = ajouter son fichier et son nom dans le catalogue, sans toucher à la sélection ni aux sauvegardes.
- **API** : `getSpritesForClass(classe)` (les 4 variantes), `isValidSprite(classe, spriteId)`, `getSpriteAsset(spriteId, animation)`, `resolveSpriteId(classe, spriteId, graine)`.
- **Intégrité** (règle `classe du combattant = classe du sprite`) :
  - à la création : tirage parmi les variantes de la classe (combattants de départ, Taverne, recrues et clubs de l'IA, Admin) ; le capitaine ne peut choisir que parmi celles de sa spécialité ;
  - en mémoire : le modèle `Fighter` refuse un sprite d'une autre classe ; changer sa classe remplace aussitôt un sprite devenu incompatible par la **même variante** de la nouvelle classe (`runner_03` → `hastier_03`) ;
  - au chargement et à la sauvegarde : un sprite absent, ancien ou d'une autre classe est remplacé par une variante de la classe, déduite de l'identifiant du combattant (identique d'un chargement à l'autre), puis enregistré ;
  - Admin : changer la spécialité d'un combattant de club remplace son sprite de la même façon.
- **Création du capitaine** : les apparences n'apparaissent qu'une fois la spécialité choisie (« Lutteur 1 » à « Lutteur 4 »…) ; changer de spécialité met à jour la liste et la sélection.
- **Migration** : les anciens sprites (`fighter_sprite_01` à `07`) ont été retirés. Les fichiers `data/leagues/*.json` ont été convertis (chaque combattant a un sprite de sa classe) ; les sauvegardes et modifications locales de l'Admin sont converties au chargement.

Les sprites sont utilisés dans le Centre, l'arène, les cartes, les fiches et le Module Admin.

**Tabard aux couleurs du club** (v0.33.0) : chaque combattant porte la **couleur principale de son club** sur son tabard, pour reconnaître son équipe d'un coup d'œil au placement et en combat. Rien d'autre ne change : armure, casque, arme, bouclier et variante restent ceux du sprite.
- **Zone du tabard** : dans chaque fichier SVG, une zone porte l'attribut `data-club-color="primary"`. Sa couleur d'origine reste celle d'un combattant **sans club** (recrue de la Taverne).
  - Hastiers 01, 02 et 04, Lutteurs 01 et 03, Runner 04 : la cotte existante.
  - Lutteur 02 (brigandine), Lutteur 04 et Runners 01 et 02 (gambesons) : le vêtement de tissu ; les rivets, le matelassage et l'ourlet sont devenus des ombrages, pour suivre la couleur.
  - Hastier 03 (plates noircies) et Runner 03 (cuir clouté) : un tabard a été ajouté, étroit pour le Runner, afin de laisser voir le cuir.
- **Couleur dérivée, jamais enregistrée** : `fighter.teamId` → club → `emblem.resolvedColors()`. Le combattant ne stocke aucune couleur ; changer les couleurs d'un club dans l'Admin change aussitôt le tabard de tous ses combattants.
- **Rendu** (`src/render/sprites.js`) : sprite de base, plus la zone du tabard, plus les couleurs du club, donnent une image recolorée à la volée et gardée en mémoire. Aucun fichier n'est créé par club. Fonctions : `applyClubColors`, `getClubSpriteUrl`, `getFighterClubColors` ; option `clubColors` de `drawSpriteFigure`, options `team` ou `colors` de `FighterSprite`.
- **Où** : lice (placement et combat), Centre, cartes et fiches, Module Admin, aperçu du capitaine (aux couleurs choisies pour la compagnie).
- **Cache du navigateur** (v0.33.1) : l'adresse des sprites porte la version du jeu (`?v=0.33.1`) et le fichier source est relu sans cache. Un navigateur ne peut donc plus afficher une ancienne copie, sans zone de tabard, après une mise à jour.
- **Plus tard** : une bordure ou un motif s'ajoute en marquant une autre zone `data-club-color="secondary"` (ou `tertiary`) dans le SVG, sans toucher au code.

## Effets visuels des combats (VFX, lot 1)

Pendant le rejeu d'une manche, des particules accompagnent l'action (v0.34.0). Ce sont des effets de présentation seulement : le combat n'est jamais recalculé et aucune règle ne change.

| Effet | Déclencheur (événement de la simulation) | Rendu |
|---|---|---|
| Impact | chaque coup | étincelles jaunes au point de contact, dans le sens du coup ; plus nombreuses quand les dégâts sont plus forts |
| Coup avantagé | coup avantagé par la position : dans le dos, angle mort, à distance (`detail.highlight`) | gerbe orange plus large et bref éclair blanc |
| KO | coup qui met la cible à 0 PV | nuage de poussière qui s'élève puis retombe |
| Pas | chaque déplacement | petites bouffées de poussière aux pieds |
| Course du Runner | Runner qui se déplace | traînée de poussière le long du chemin |
| Renversement | Runner qui percute dans le dos en pleine course (événement `stun`) | poussière au sol et étoiles 💫 qui tournent au-dessus de la cible |

- **Réglages** : `src/data/vfx.js`, pour chaque effet : durée, nombre, vitesse, gravité, taille, couleurs, contour. Plafond de 220 particules à l'écran.
- **Calcul** : `src/combat/presentation/vfx.js`.
  - Les effets sont tirés des événements du rejeu, une fois par manche.
  - Les particules visibles à un instant donné sont une **fonction du seul temps du rejeu**, avec une graine propre à chaque événement. L'avance rapide, « Passer à la fin » et les vitesses ×1, ×2, ×4 restent donc cohérentes, et une même manche donne toujours les mêmes étincelles.
- **Dessin** : `IsoRenderer` (`#drawVfx`). Formes plates cernées de sombre, comme les sprites, pour rester lisibles sur le sable.
- **Option** : Options › Affichage › « Effets visuels des combats ».
  - « Complets », par défaut.
  - « Réduits » : moitié moins de particules, sans éclair. Ce niveau s'applique aussi si le système demande moins d'animations.
  - « Désactivés ».
- **Pas de son**. La secousse de caméra, le combo et la fin de manche sont arrivés avec le lot 4 (v0.63.0, ci-dessous).

## Effets visuels hors combat (VFX, lot 3)

Ces effets sont de la présentation seulement (v0.35.0). Ils suivent la même option que les combats : Options › Affichage › « Effets visuels des combats » (complets, réduits ou désactivés).

| Lieu | Déclencheur | Effet |
|---|---|---|
| Centre | « Passer la journée », **une fois le carnet de bord refermé** | gain flottant au-dessus de chaque combattant dont l'activité a réussi : « +1 LUT » (vert), « −28 FAT » (bleu), « +11 deniers » (or) ; rien pour un échec |
| Bourg | achat d'une amélioration, **une fois la fenêtre de l'artisan refermée** | coups de marteau, poussière et éclats de bois à l'atelier de l'artisan (un chantier par achat, trois au plus) |
| Centre | première visite après un achat au Bourg | même chantier **sur l'installation améliorée** (Petite lice, Mannequins, Forêt…) |
| Taverne | nouvelle rotation, à la première visite qui suit (ou après le carnet de bord) | la porte du mur de gauche s'ouvre sur la nuit, de la fumée entre, la porte se referme |
| Taverne | recrue engagée | deux chopes se rejoignent et trinquent là où se tenait la recrue, la mousse gicle |
| Carnet de bord | fin de saison | guirlande de bannières aux couleurs de la compagnie ; **confettis** en cas de montée ou de titre |

- **Pourquoi après la fermeture** : le carnet de bord et les fenêtres des artisans recouvrent la scène. Un effet joué pendant qu'ils sont ouverts serait perdu.
- **Réglages** : `src/data/vfx.js` (`SCENE_VFX`) : durées, tailles, couleurs, nombre de coups de marteau, ouverture de la porte, nombre de confettis.
- **Moteur partagé** avec la lice : `src/render/vfx/particles.js` (gerbes et dessin) et `src/render/vfx/sceneEffects.js` (effets des scènes, chacun calculé d'après son âge). Le niveau d'effets en vigueur est dans `src/render/vfx/vfxLevel.js`, tenu à jour par les Options.
- **Logique de déclenchement** :
  - `src/centre/centreVfx.js` : gains déduits du carnet de la journée, et centre des installations ;
  - `src/ui/hub/pendingVfx.js` : chantiers en attente et rotation déjà vue. C'est de la mémoire de la partie en cours, rien n'est sauvegardé.
- **Niveaux** :
  - « Réduits » : moitié moins de particules, bannières immobiles, moitié moins de confettis ;
  - « Désactivés » : aucun effet ;
  - si le système demande moins d'animations, les confettis sont masqués et les bannières ne bougent plus.
- **Porte de la Taverne** : déclarée dans `data/tavernLayout.js` (`walls.left`, `type: 'door'`).

## Effets visuels, lot 4 : talents et moments forts (v0.63.0)

Présentation seulement : aucune règle ne change. Même option que les autres effets (complets, réduits, désactivés), et le réglage « réduire les animations » du système limite aux effets réduits.

| # | Où | Déclencheur | Effet |
|---|---|---|---|
| A1 | Lice | coup modifié par un talent **de l'attaquant** (pas l'aura d'un allié), au plus une fois tous les 3 tours par talent | rune ✦ à la couleur de la famille (épique : noire cernée d'or), petite gerbe assortie |
| A2 | Lice | survie à 1 PV (événement `lastStand` du moteur) | halo doré, bouclier qui se brise en éclats ; scintillement pendant l'invulnérabilité (Immortel) |
| A3 | Lice | coup chanceux (`detail.lucky`) | trèfle qui tourne, étincelles vertes |
| A4 | Lice | coup de combo, dès le 2e (`detail.comboHits`) | compteur « ×2, ×3… » qui grossit, étincelles rouges |
| A5 | Lice | coup de 25 dégâts ou plus (« à valider ») | gerbe fournie, éclair, **tremblement** de 0,12 s et 3 px (effets complets seulement) |
| A6 | Lice | début de manche | lueur aux couleurs de sa compagnie sous chaque capitaine |
| A7 | Lice | fatigue de début de manche ≥ 60 (« à valider ») | gouttes de sueur toutes les 1,4 s ; vapeur grise en plus au-delà de 80 |
| A8 | Lice | fin de la manche | fanions du vainqueur au-dessus de ses combattants debout, poussière le long de la palissade (horloge de rendu : l'effet continue après l'arrêt du rejeu) |
| B1 | Scriptorium | première visite qui suit une révélation (30 jours au plus) | livre qui s'ouvre, pages qui tourbillonnent, rayons à la couleur de la famille, nom du talent ; plus long pour un épique |
| B2 | Scriptorium | pupitre occupé | points d'encre, poussière dorée de chandelle |
| B3 | Scriptorium | achat d'un artefact, **une fois la fenêtre de Flavia refermée** | l'artefact descend se poser sur la table de Flavia, onde de lumière, pages qui volent ; il y reste (reliure propre à chacun) |
| B4 | Partout | étiquettes de talents | reflet lent (rare), lueur pulsée (épique), en CSS ; seulement en effets complets |
| C1 | Fin de combat | victoire face à la Reine / en Coupe | pluie de pétales / d'étincelles d'or |
| C2 | Coupe | ouverture de l'arbre final après une qualification | le blason de la compagnie avance de sa place à la suivante, avec une traînée lumineuse ; une fois par qualification |

- **Réglages** : `src/data/vfx.js` (`VFX_CONFIG.talent`, `lastStand`, `lucky`, `combo`, `heavy`, `captain`, `fatigue` ; `SCENE_VFX.roundWin`, `reveal`, `study`, `artifact`, `victory`, `cupAdvance` ; couleurs des familles `TALENT_VFX_COLORS`). Apparence des artefacts : `look` dans `data/scriptorium.js` ; leur place sur la table : `flavia.artifactSpot` dans `data/scriptoriumLayout.js`.
- **Moteur** : le coup porte deux informations de présentation, `detail.lucky` et `detail.comboHits` (`CombatController`). Les événements visuels sont déduits du rejeu (`combat/presentation/vfx.js` ; tremblement : `shakeAt`).
- **Nouvelles formes** (`render/vfx/particles.js`) : rune, anneau au sol, bouclier, goutte, page, fanion, rayons, objet dessiné (livre).
- **Mémoire** : la cérémonie de révélation est marquée sur l'étude (`ceremonyShown`, `takeUnseenRevealCeremonies`). Une ancienne sauvegarde ne rejoue pas son historique au-delà de 30 jours. Les qualifications déjà montrées en Coupe restent en mémoire le temps de la session.
- **CSS** : le niveau d'effets est lisible sur `<html data-vfx="full|reduced|off">`.

## Combat Joueur contre IA

Quand le joueur affronte un club de l'IA (championnat, Combat de la Reine), chaque manche est un vrai combat simulé. Les combats IA contre IA gardent leur simulation par probabilité. Règles : `data/combatRules.js`.

**Déroulement d'une manche** : composition (5 combattants) → placement alterné → « Lancer la manche » → déplacements et combats → un camp entièrement KO → résultat → manche suivante.

- **Placement alterné** (`combat/engine/PlacementManager.js`) : aucun combattant n'est posé au départ. Chaque camp pose un combattant à tour de rôle sur une case libre de sa zone (bleue pour le joueur, rouge pour l'IA), jusqu'aux 10. **Qui commence** (`COMBAT_RULES.placementOrder`, `getFirstPlacingSide`) : à la 1re manche, l'équipe au niveau de club le plus élevé (égalité : le joueur) ; ensuite, cela alterne à chaque manche. Le message l'annonce (« … place en premier (niveau le plus élevé) »). Quand c'est à l'IA, « Au tour des [nom de l'équipe]… » s'affiche (par exemple « Au tour des Gonfanons de Soissons… ») et elle prend 1 à 2 s pour placer (`COMBAT_PLAYBACK.aiPlacementDelayMs`). Un combattant posé est verrouillé. Un camp qui n'a plus personne à poser laisse l'autre finir. Le joueur voit les 5 adversaires (sprite, classe, étoiles, fatigue ; jamais leurs statistiques de combat), et quel combattant l'IA vient de poser et où (anneau doré, message). Un bouton « Placement automatique » termine le placement du joueur avec la même logique que l'IA. « Lancer la manche » n'apparaît qu'une fois tout le monde posé.
- **Placement de l'IA** (`combat/engine/AIPlacementStrategy.js`, stratégie `formation`, réglages `AI_PLACEMENT_CONFIG`) : la **formation du béhourd** :
  - un Lutteur contre chaque barrière, un par grand côté ;
  - un Hastier juste derrière chaque Lutteur (1 à 2 cases en retrait, rangée ± 1) ;
  - le Runner au milieu de la largeur, sur la ligne avant.

  Un peu de hasard évite un placement figé. Les stratégies `duel` et `anticipate` (IA d'élite) partent de la même formation, puis tiennent compte du rapport de force. D'autres stratégies peuvent être ajoutées (`PLACEMENT_STRATEGIES`).
- **Composition de l'IA** (`systems/ai/LineupStrategies.js`, `withFormation`) : les stratégies réfléchies alignent 2 Lutteurs, 2 Hastiers et 1 Runner (`COMBAT_RULES.formation`), dans leur ordre de préférence, puis complètent avec les meilleurs restants si une classe manque. L'IA « instinctive » aligne ses meilleurs niveaux sans souci de formation.
- **IA des combattants** (`combat/engine/ai/`, réglages `FIGHTER_AI_CONFIG` dans `data/combatRules.js`) : chaque combattant, du joueur comme de l'adversaire, a sa propre IA. Les responsabilités sont séparées :
  - `FighterAIController` : cycles de décision et plan à suivre ;
  - `DecisionService` : l'action à mener ;
  - `TargetSelectionService` : le choix de la cible ;
  - `PathfindingService` : les chemins, indépendant de l'IA ;
  - `MovementController` : les pas effectifs ;
  - `CombatController` : les attaques.

  Les détails :
  - **États** : `IDLE`, `SEEK_TARGET`, `MOVE_TO_TARGET`, `ATTACK`, `REPOSITION`, `RETREAT`, `KO`. Chaque changement d'état produit un événement `ai` (avec sa raison).
  - **Cycles de décision** : pas à chaque tour, mais tous les 3 tours, décalés d'un combattant à l'autre (`decisionInterval`). Une décision est aussi prise aussitôt en cas de cible KO ou hors d'atteinte, de chemin bloqué, d'arrivée au contact, de coup dur (−20 % des PV max) ou de fin de recul. Pendant une approche, le chemin est recalculé tous les 2 tours, ou dès que la cible s'éloigne de la case visée.
  - **Casques fermés** (`COMBAT_RULES.vision`) : chaque combattant a une direction (`facing`) : au départ vers les adversaires, puis vers sa cible, sinon vers où il marche. Il ne voit que dans un cône de ± 60° autour. Un adversaire hors de ce cône n'existe pas pour son IA, sauf s'il l'a frappé dans les 4 derniers tours (`memoryTicks`). S'il ne perçoit plus personne, il cherche parmi tous.
  - **Choix de la cible** : un score de priorité parmi les adversaires perçus, plus de « l'adversaire le plus proche ». Il prend en compte :
    - les cases à parcourir (ou la distance plus une pénalité s'il est hors d'atteinte) ;
    - le rapport de force, calculé avec les règles de dégâts (tours pour le mettre KO face aux tours pour mourir) : un adversaire moins fort ou blessé est préféré ;
    - pour le Runner, un adversaire déjà aux prises avec l'un de ses alliés : son dos est offert (`target.backWeight`) ;
    - le danger (autres adversaires autour de lui, pesant plus si l'on est blessé) ;
    - la possibilité d'attaquer tout de suite ;
    - la cible actuelle (pour ne pas en changer sans cesse) ;
    - le surnombre (au-delà de 3 alliés sur la même cible) ;
    - un peu de hasard.

    Tous les coefficients sont réglables.
  - **Chemins** : A* et carte de distances sur la grille réelle, en 8 directions. Les cases des combattants debout sont occupées ; on ne se faufile pas en diagonale entre deux combattants qui se touchent. Un combattant derrière une ligne d'alliés la contourne, alors que l'ancien pas direct le laissait bloqué.
  - **Approche** : parmi les cases d'où il touche la cible (à son allonge), il choisit l'angle selon :
    - le coût du chemin ;
    - le nombre d'adversaires autour de la case ;
    - la valeur de la case pour son rôle (`tileBonus`) : contre la barrière pour le Lutteur (et mieux encore si la cible y est collée) ; à 2 cases sans adversaire au contact pour le Hastier ; dans le dos de la cible, hors de sa vue, pour le Runner (poids renforcé : `approach.bonusByClass`) ;
    - un peu de hasard.
  - **Repositionnement** : à son allonge, à chaque décision (35 % de chance), il peut glisser vers une case voisine d'où il touche encore la cible et plus favorable (un Hastier pris dans la mêlée recule ainsi à 2 cases). Loin d'une cible inaccessible, il fait un détour pour s'en rapprocher.
  - **Blocage** :
    - si la case suivante est prise, le chemin est recalculé, sinon il fait un pas de côté ;
    - après 3 échecs, la cible est écartée 4 tours et il en choisit une autre ;
    - sans aucune solution, il attend un tour et réessaie.

    Il ne reste jamais bloqué sur une décision impossible.
  - **Recul** : il recule dans deux cas :
    - à ≤ 25 % de ses PV, si les adversaires au contact doivent le mettre KO en ≤ 3 tours ;
    - à ≤ 45 % de ses PV, s'il a au moins 2 adversaires de plus que d'alliés à 2 cases.

    Il ne recule jamais s'il peut achever un adversaire au contact (1 coup), s'il est le dernier debout de son camp, ni s'il est plaqué contre la barrière par un Lutteur. Il vise une case à 3 pas au plus, à au moins 2 cases de tout adversaire, si possible près d'un allié. Le recul dure au plus 3 tours, une fois par manche, puis il réévalue la situation. Il ne frappe pas pendant qu'il recule.
- **Vitesse de déplacement** (`COMBAT_RULES.moveTilesPerTick`) : **0,7 case par tour**, soit l'ancienne vitesse (1 case par tour) réduite de 30 %. Chaque tour, un combattant qui se déplace cumule 0,7 et fait un pas dès qu'il a cumulé une case. La durée d'un tour (0,64 s), les attaques, les animations et les décisions ne changent pas. À l'écran, un combattant qui ne frappe pas pendant le tour marche sur tout le tour.
- **Attaques** (`ai/CombatController.js`) : chaque tour, tout combattant qui a sa cible à son **allonge** frappe une fois : au contact, ou à **2 cases pour le Hastier** (`COMBAT_RULES.reachByClass`), par-dessus l'épaule d'un allié. Ils frappent dans l'ordre d'endurance décroissante (le plus endurant frappe en premier). S'il ne touche pas sa cible mais qu'un adversaire perçu est à son allonge, il frappe celui-ci (opportunité). Un combattant qui recule, ou renversé, ne frappe pas. L'endurance d'un combattant de l'IA vaut son niveau ± 10 %, tirée une fois pour tout le combat.
- **Dégâts** (`CombatDamageCalculator.js`, réglages `COMBAT_RULES.damage`) : **10 × attaque ÷ défense × (1 + aléa + combo) × fatigue × bonus final**, arrondi, au moins 1.
  - **Plus de boucle de classes** (v0.65) : l'ancien « Hastier > Lutteur > Runner > Hastier, dégâts ×2 » a disparu ; c'est la position qui compte (bonus ci-dessous).
  - **Attaque** : la stat de classe (HAST pour le Hastier, LUTTE pour le Lutteur, PER pour le Runner).
  - **Défense** : moitié HAST + moitié stat de classe de la cible.
  - **Aléa (PER)** : un tirage par coup, entre 0 et la PER de l'attaquant en %, 50 % au plus (toujours positif).
  - **Combo (LUTTE)** : LUTTE ÷ 10 % par coup consécutif sur la même cible (LUTTE 20 : +2 %, +4 %, +6 %…), 5 coups au plus ; remis à zéro au changement de cible, à chaque manche et à chaque combat. Aléa et combo s'additionnent.
  - **Fatigue** (`COMBAT_RULES.fatigueDamage`) : aucun malus jusqu'à 50 ; au-delà, −2 % de dégâts par point (75 → 50 %, 100 → 0 %, puis le minimum de 1).
  - **Endurance** : l'ordre des coups.
  - Ex. Hastier HAS 60 contre Lutteur HAS 30 / LUT 45 (défense 37,5) : 10 × 60 ÷ 37,5 = 16 avant aléa, combo et bonus ; le Lutteur en retour : 10 × 45 ÷ 60 = 8. Un combattant de l'IA a son niveau (`score`) dans chaque compétence.
- **Bonus de position** (`COMBAT_RULES.bonuses`, `combat/engine/CombatSituation.js`), pour les deux camps. Valeurs « à valider » :
  - **Capitaine** 👑 : +15 % sur toutes ses stats de combat au début de chaque manche (il frappe donc aussi plus tôt) ;
  - **Lutteur contre la barrière** 🧱 : à 1 case au plus d'un bord de la lice, +20 % en LUTTE (attaque, combo, défense pour moitié) ;
  - **Cible plaquée** 🤼 : collée à la barrière quand un Lutteur la frappe, son combo monte d'un coup de plus, et elle ne peut plus reculer ;
  - **Hastier à distance** 🔱 : +20 % de dégâts finaux quand il frappe à 2 cases ; **dans la mêlée** ⛔ (un adversaire à son contact) : −20 % ;
  - **Runner dans le dos** 💥 : +30 % de dégâts finaux sur une cible qui ne le voit pas ; s'il arrive en courant (un pas ce tour-ci ou le précédent), il la **renverse** : elle perd son prochain tour (événement `stun`) ;
  - **Angle mort** 🪖 (casques fermés) : tout coup venu d'un adversaire que la cible ne voit pas fait +15 % de dégâts finaux, quelle que soit la classe (cumulé avec le Runner : +45 %).
  - Les bonus de dégâts finaux s'additionnent avec ceux des consommables et des talents. Chaque coup indique ses bonus (`detail.bonuses`) et s'il a été avantagé par la position (`detail.highlight` : dégâts flottants orange, gerbe orange).
- **Mesures** (banc d'essai, 136 manches, formation 2-2-1 des deux côtés) :
  - aucune manche bloquée, environ 14 tours par manche ;
  - le Lutteur frappe 58 % de ses coups contre la barrière ;
  - le Hastier frappe 84 % de ses coups à distance ;
  - la moitié des coups du Runner arrivent dans le dos, avec environ un renversement par manche ;
  - les dégâts par coup sont proches d'une classe à l'autre (14 à 15) ; le Hastier inflige le plus de dégâts au total, car son allonge le fait frapper plus souvent.
- **PV et KO** : chaque combattant commence la manche avec ses PV : 150 au plus depuis la v0.68 (100 avant ; les sauvegardes passent au format 8 et leurs PV sont multipliés par 1,5). Une manche dure environ 22 tours, contre 15 avec 100 PV. À 0 PV, il est KO : son IA s'arrête, il ne bouge plus, ne frappe plus, n'est plus visé et ne bloque plus aucune case. Il s'efface puis **disparaît de la lice** (`COMBAT_PLAYBACK.koFadeSeconds`, 0,8 s). Il reste dans le résultat de la manche et du combat, les statistiques et le palmarès. La manche s'arrête dès qu'un camp n'a plus aucun combattant actif.
- **Entre deux manches** : un KO ne vaut **que pour la manche**. À la suivante, tous les combattants, KO compris, retrouvent leurs PV et peuvent de nouveau être alignés (réglage `knockoutLastsWholeMatch: false` ; `true` les écarterait jusqu'à la fin du combat). Fatigue : elle évolue tour par tour pendant la manche, puis l'effectif récupère un peu avant la suivante (section « Fatigue pendant le combat », v0.66).
- **Fatigue pendant le combat** (v0.66, `combat/engine/RoundFatigue.js`, réglages `COMBAT_RULES.roundFatigue`, `COMBAT_RULES.lull`, `FIGHTER_AI_CONFIG.breathe`). Valeurs « à valider » :
  - **Debout** : chaque tour, +0,6 × (1 + tour ÷ 25). L'effort s'alourdit à mesure que la manche dure, et seuls ceux qui sont encore debout le subissent. (v0.68 : 0,8 et ÷ 15 avant ; recalibré pour que les manches plus longues à 150 PV finissent avec la même fatigue moyenne, environ 41.)
  - **Coups** : +0,6 par coup donné, +0,13 × dégâts par coup reçu (0,2 avant la v0.68). Un coup de 15 coûte environ 2 points à celui qui l'encaisse, trois fois plus qu'à celui qui le donne.
  - **Au sol (KO)** : −1,5 par tour ; plus il reste au sol, plus il récupère.
  - **Souffler** (IA, `DecisionService.shouldBreathe`, état `BREATHE`) :
    - conditions : supériorité numérique, fatigue ≥ 40, aucun adversaire au contact, un allié tient le combat ;
    - il se met hors de portée et récupère 0,8 par tour pendant 3 tours au plus ;
    - frappé, il réplique aussitôt ; ensuite, 4 tours sans souffler ;
    - chaque profil d'IA a son seuil (`breathe` dans `data/aiProfiles.js`) : la Chevauchée ne souffle qu'à 70, le Mur et la Guerre d'usure à 45 mais plus longtemps.
  - **Temps mort** (événement `lull`) :
    - conditions : au plus 2 contre 2 à égalité, fatigue moyenne des combattants debout ≥ 50, personne sous 25 % de ses PV ;
    - 15 % de chances par tour qu'il démarre ;
    - pendant 3 à 5 tours, chacun recule d'un pas et souffle, personne ne frappe ;
    - au plus 2 par manche, à au moins 6 tours d'écart.
  - **Dégâts** : c'est la fatigue du moment qui règle le malus (au-delà de 50, −2 % par point).
  - **Entre deux manches** (`FatigueService.applyEngineRoundFatigue`) : −10 pour les combattants qui viennent de combattre, −15 pour les remplaçants de l'effectif (`round.recovery`). Rien après la dernière manche.
  - **Talents** :
    - Souffle long : −20 % d'effort ;
    - Second souffle : récupère deux fois plus vite ;
    - Bon vivant : jamais au-dessus de 90 ;
    - Légende vivante : −25 % sur tous les gains de la compagnie.
  - **Affichage** :
    - une jauge sous les PV (bleue jusqu'à 50, ambre, puis rouge au-delà de 75), avec un repère au seuil de 50 ;
    - les couleurs du combattant suivent sa fatigue du moment ;
    - le message « Temps mort » pendant la pause ;
    - la sueur selon la fatigue du moment, et de la vapeur pour qui souffle.
  - **Le rejeu** reconstitue la fatigue de chacun tour par tour (événements `fatigue`), sans rien recalculer.
  - **Champ d'application** : championnat, Combat de la Reine et Coupe de France (fatigue réelle des combattants du joueur ; en Coupe, remise à 0 à l'entrée dans la compétition seulement). Les combats simulés (IA contre IA, avance rapide) gardent leurs forfaits (vainqueurs +20 à 50, vaincus +50 à 60).
- **Rejeu** (`combat/presentation/CombatPlayback.js`) : le moteur calcule toute la manche et produit des événements (« A attaque B », « B est KO ») ; la présentation les rejoue : déplacements, élans d'attaque échelonnés dans l'ordre d'endurance, barres de PV, dégâts flottants (orange si le coup est avantagé par la position), KO. Un tour dure 0,64 s à la vitesse ×1 (`COMBAT_PLAYBACK.tickSeconds`, ralenti de moitié) ; vitesses ×1, ×2, ×4 et « Passer à la fin ». Le score n'est dévoilé qu'au résultat de la manche, avec un bilan (KO, dégâts infligés par chacun).
  - **À l'écran** (v0.68.1) : au lancement, la page descend jusqu'à la lice, juste sous le rappel de la formation (collant, détaché par une ombre). Un simple redessin de la même étape (« Les moins fatigués », une case cochée) garde la position dans la page.
  - **Lisibilité en mêlée** (v0.68.1) : les barres de PV et les pastilles sont dessinées après tous les combattants (aucun sprite ne les cache) ; deux chiffres de dégâts au même endroit s'empilent au lieu de se recouvrir ; le compteur de combo « ×N » s'affiche à droite du chiffre (`VFX_CONFIG.combo.shiftX`), un seul par cible (le plus récent).
- **Lancement de la manche** : avant le premier tour, les combattants attendent à leur place un court instant (`COMBAT_PLAYBACK.introSeconds`, 2,6 s) : une pastille d'icônes au-dessus de chacun montre ses bonus (👑 capitaine, 🧱 Lutteur contre la barrière, objets, talents), et la liste « Bonus au lancement » les détaille camp par camp. Ils sont calculés aux positions de départ (`getStartingBonuses`). Les bonus du coup (distance, dos, angle mort, cible plaquée) dépendent de chaque échange et apparaissent sur les coups. La lueur du capitaine se joue pendant cette attente et s'éteint au premier tour (v0.68.1 ; avant, elle restait vide à sa place de départ pendant qu'il avançait). Libellés : `combat/presentation/bonusLabels.js`.
- **Caméra rapprochée** (`COMBAT_PLAYBACK.camera`, `IsoRenderer.setCameraTarget`) : dès le lancement, la caméra se rapproche des combattants encore debout et les suit en glissant doucement. Elle cadre ce groupe avec une marge de 0,8 case, au moins 6 × 4,5 cases (pas de zoom excessif sur un dernier duel) et au plus 10 × 7 cases centrées sur le groupe. Une marge haute de 1,8 case laisse voir les sprites, les barres de PV, les pastilles et les dégâts. Le bouton « 🔍 Vue d’ensemble » montre toute la lice, et « 🔍 Suivre le combat » rapproche de nouveau la caméra.
- **Rappel des rôles** (`ui/components/ClassRoles.js`) : en haut de l'écran pendant le combat (toujours visible en faisant défiler), et sur une ligne pendant le placement (détail en infobulle). Il comprend :
  - un schéma de la formation : la lice vue de dessus, un Lutteur contre chaque barrière, un Hastier derrière chacun, le Runner au centre et sa course dans le dos adverse ;
  - le rôle de chaque classe (stat d'attaque, bonus de position) ;
  - la règle des casques fermés.

  Tout est déduit des règles. L'Almanach montre le même schéma (« Les spécialités »).
- **Fatigue des adversaires** : fictive (le temps du combat, jamais enregistrée sur les combattants de l'IA). Au début de chaque combat, chacun reçoit une fatigue de départ tirée entre 0 et 15 (`COMBAT_RULES.aiStartingFatigue`), puis elle est cumulée d'une manche à l'autre avec les mêmes règles que celle du joueur ; elle réduit leurs dégâts et guide leur composition (les moins fatigués). Elle est visible : « Fatigue x / 100 » sur chaque adversaire pendant le placement, couleurs désaturées dans La Lice, et tableau « Fatigue de l'adversaire » au résultat de chaque manche.
- **Animations** : chaque combattant passe par les états `idle`, `moving`, `attacking`, `taking_damage`, `ko`, `victory`, reliés aux animations de sprite (`walk`, `attack`, `hit`, `death`, `victory` ; « idle » tant qu'elles n'existent pas). Le calcul du combat n'en dépend pas.
- **Avance rapide** (journée non disputée) : le combat du joueur reste simulé comme avant (probabilité).

## Règles en place

| Élément | Règle | Fichier |
|---|---|---|
| Statistiques | PV, Fatigue, Lutte, Force d'arme d'hast, Percussion, Endurance — toutes entre 0 et 100 | `data/stats.js` |
| Fatigue | Niveau de fatigue : 100 = épuisé, 0 = reposé. « Récupérer » la fait baisser | `data/stats.js` + `systems/fighters/stats.js` |
| Niveau du combattant | (Lutte + Hast + Percussion + Endurance) / 4, sans PV ni fatigue. Pour un combattant de l'IA défini par un `score`, ce score tient lieu de niveau | `systems/rating/RatingService.js` |
| Niveau du club | Moyenne des 8 meilleurs combattants, même calcul pour tous les clubs, recalculée à chaque lecture (jamais enregistrée) | `systems/rating/RatingService.js`, `data/ratings.js` |
| Étoiles | 0–5 : ☆ · 6–10 : ½ · 11–16 : ★ · 17–25 : ★½ · 26–40 : ★★ · 41–50 : ★★½ · 51–60 : ★★★ · 61–70 : ★★★½ · 71–85 : ★★★★ · 86–92 : ★★★★½ · 93–100 : ★★★★★. Un niveau non entier tombe dans le palier supérieur (10,25 → ★). Clubs : 5 emplacements (★★★½☆) ; combattants : étoiles obtenues seulement (★★½). La demi-étoile est une étoile à moitié remplie (graisse fixée à 400 : dans une carte en gras, le contour ☆ paraissait plein, corrigé en v0.68.1) | `data/ratings.js` → `getStarRating()` |
| Âge | 18 à 35 ans à la création, +1 an à chaque fin de saison | `data/fighterProfile.js`, `SeasonService.applyAgeIncrease` |
| Potentiel | 0 à 3 (🔥) : 60 / 30 / 8 / 2 % à la création (capitaine du joueur : 25 / 40 / 30 / 5 %) ; vérifié tous les 15 jours selon l'âge (18–25, 26–31, 32+) | `data/fighterProfile.js`, `systems/fighters/PotentialService.js` |
| Recrutements de l'IA | Chaque jour, 1 % par club (tirage indépendant). Recrue au niveau d'un des 4e à 7e plus forts (tirage ; écart réglable, non défini : 0). Progression quotidienne : +1 niveau à 10 / 5 / 2 % selon les étoiles, −1 à 2–5 % dès 32 ans (`data/aiProgression.js`). Au-delà de 12 combattants, le plus faible (niveau numérique) est congédié. Retraite à 36 ans, remplacement si l'effectif passe sous 9 | `data/aiRecruitment.js`, `systems/clubs/AIRecruitmentService.js` |
| Affichage | Aucun niveau ni score chiffré n'est montré au joueur (seulement dans le Module Admin) | `ui/components/Rating.js` |
| Capacité | Petite lice, Mannequins, Tas de foin : 4 combattants maximum (`capacity`) | `data/activities.js` |
| Journée de combat | Centre fermé, aucune activité résolue ce jour-là | `systems/calendar/dayStatus.js` |
| Combat | 2 manches gagnantes ; 8 combattants engagés au maximum, 5 par manche | `data/matchRules.js` |
| Manche (Joueur contre IA) | Placement alterné puis combat simulé : IA individuelle (cible par score de priorité, chemins et détours, approche par différents angles, repositionnement, recul en difficulté), vitesse 0,7 case par tour, attaque au contact par ordre d'endurance, dégâts = 10 × attaque ÷ défense (moitié HAST, moitié stat de classe) × 2 si avantage de classe × (1 + aléa PER + combo LUTTE) × fatigue (malus seulement au-delà de 50 : −2 % par point), au moins 1 ; bonus capitaine, Hastier non visé, Runner sur un côté, Lutteur entouré ; KO à 0 PV, pour la manche seulement ; fin dès qu'un camp est entièrement KO | `data/combatRules.js`, `combat/engine/` |
| Manche (IA contre IA) | Victoire selon le niveau de la manche (moyenne des 5 engagés de chaque camp) : 50 % ± 1,8 % par point d'écart (nulle à partir d'environ 28 points d'écart), borné entre 0 et 100 %. Le niveau du club (8 meilleurs) ne sert plus qu'à l'affichage | `systems/match/RoundService.js` |
| Palmarès | Seuls les combattants réellement engagés dans une manche sont comptés (manches ; combat si au moins une manche) | `systems/fighters/FighterRecordService.js` |
| Taverne | Rotation tous les 7 jours, 4 combattants ; prix selon les étoiles : jusqu'à 2★ niveau ± 10 (plancher 1 denier), puis 50 / 250 / 500 / 750 | `data/calendar.js`, `data/recruitment.js` |
| Fatigue (visuel) | Intensité des couleurs = 1 − fatigue / 100 | `systems/fighters/FatigueService.js` |
| Fatigue après une manche | Vainqueurs +20 à 50, vaincus +50 à 60 (plafond 100) | `data/matchRules.js` |
| Courbatures, états (v0.75) | +15 par manche disputée, +10 si KO ; Fatigué dès 50 (Centre × 0,5), Épuisé dès 70 (Banquet seulement) | `data/fatigue.js` |
| Points | Victoire 3 ; défaite avec une manche gagnée 1 ; défaite 2 – 0 : 0 | `data/leagues.js` |
| Format | 18 équipes par division, 3 montées, 3 descentes, aller simple | `LEAGUE_CONFIG` dans `data/leagues.js` |
| Rencontres | Tourniquet générique `generateSchedule(teams)` : N − 1 = 17 journées de N / 2 = 9 combats ; chaque équipe joue 17 combats contre 17 adversaires différents | `systems/league/ScheduleService.js` |
| Montées / descentes | Les `promotionCount` premiers et les `relegationCount` derniers, entre divisions voisines. Ligue 1 ▼ 16-18 · Ligue 2 ▲ 1-3 ▼ 16-18 · Ligue 3 ▲ 1-3 | `PROMOTION_RULES` (déduites) + `systems/league/PromotionService.js` |
| Fin de saison | Dès le dernier combat : classements finaux → historique des clubs → mouvements déterminés → âge +1 → bilan. Puis, au choix du joueur : mouvements appliqués → `validateLeagueSizes` (3 × 18) → nouveau calendrier | `systems/league/SeasonService.js` |
| Affluence des Combats de la Reine | Jamais moins de 50 spectateurs (davantage si le calcul habituel l'indique) ; La Reine assiste au combat | `data/crowd.js` (`byCombatKind`), `systems/crowd/CrowdService.js` |
| Activités | Lice / Mannequins / Foin 35 % +1 · Rivière 35 % +1 Endurance · Forêt 50 % +8 à +12 deniers (2 places ; améliorations : 4 achats au plus chacune) · Banquet 100 % −20 à −40 Fatigue | `data/activities.js` |

## Valeurs non définies (à fournir)

Ces valeurs sont isolées dans la configuration pour pouvoir les remplacer sans toucher au code :

- **Valeurs de départ des compétences** : tirage entre 10 et 30 pour tout combattant généré (compagnie de départ, Taverne) ; les combattants existants ne sont pas modifiés. **Provisoire** (champ `start` dans `data/stats.js`). PV de départ : 150 (v0.68) ; fatigue de départ : 0.
- **Départages** : `LEAGUE_RULES.tiebreakers` dans `data/leagues.js`. La liste est vide et l'égalité de points est tranchée par ordre alphabétique, pour un affichage stable. Le même ordre décide des montées et descentes à égalité.
- **Combat Joueur contre IA, non défini** (voir « Combat Joueur contre IA ») : vitesse propre à chaque classe (tous avancent d'une case par tour), rythme des attaques (une par tour), rôle de la Percussion autrement qu'en attaque du Runner, PV perdus durablement (blessures), placement de l'IA plus élaboré. Les combats IA contre IA restent décidés par le niveau moyen des 5 engagés.
- **Fatigue des combattants de l'IA** : elle est suivie pendant le combat (choix des 5 par manche), mais pas conservée ensuite. Ces combattants sont des données statiques, et aucune règle de récupération n'est définie pour eux.
- **Conséquences des autres Combats de la Reine** : le moteur n'en prévoit aucune de durable pour un combat IA hors championnat. Le classement n'est pas touché (règle des Combats de la Reine), le palmarès n'est tenu que pour les combattants du joueur, et la fatigue IA n'est pas conservée. Les résultats sont enregistrés mais n'influencent encore rien. Pistes à valider : bilan Reine par club, fatigue IA durable.
- **Fatigue propre aux Combats de la Reine** : `QUEEN_COMBAT_CONFIG.fatigue` (`data/queenCombat.js`) vaut `null`, donc la fatigue des combats de championnat s'applique.
- **Blessures, tournois, compétences des spécialités, stats propres au Runner** : non implémentés.

## Architecture

```
src/
  config/gameConfig.js    Constantes de conception
  core/                   Navigation (+ thème par écran), plateforme
  data/                   Données pures : stats, ratings, activités, plan du Centre, ligues,
                          géographie (carte), calendrier, recrutement, spécialités…
  models/                 Fighter, Team, Emblem, Player, Calendar, RecruitmentPool, League
  state/                  GameSession (partie en cours) et gameState
  systems/
    fighters/             stats.js (règles centrales : bornes, sens, fatigue) · ratings.js (niveaux, étoiles)
    activities/           Système générique d'activité, types de récompense et de condition
    rating/               RatingService : source unique des niveaux (combattant, club) et des étoiles
    clubs/                ClubDatabase : clubs de l'IA chargés depuis data/leagues/*.json + modifications Admin ;
                          ClubService (plus forts, plus faible, niveau actuel) ;
                          AIRecruitmentService (recrutements quotidiens des clubs de l'IA),
                          AIProgressionService (progression, vieillissement, historique 30 jours)
    league/               LeagueService (divisions), StandingsService (points, tri, zones ▲▼),
                          ScheduleService (calendrier des rencontres), PromotionService (règles de
                          montée/descente, invariant), SeasonService (création du monde, fin de saison)
    match/                RoundService (manche : niveau des 5 engagés, probabilité, tirage),
                          MatchService (déroulement d'un combat, sélection IA) et
                          MatchdayService (journée complète de championnat)
    fighters/             stats, ratings (niveaux), FatigueService, FighterRecordService (palmarès)
    tavern/               TavernService (offre, rotation, prix, recrutement)
    talents/              TalentService (catalogue, familles, tirage, attribution) ; StudyService (Scriptorium :
                          durée, coût, indisponibilité, fin, interruption, chargement) ; ScriptoriumUpgradeService
                          (Flavia : second Bureau, artefacts, chances actives)
    roster/               RosterService (20 combattants maximum : canRecruit, recruit, canDismiss, dismiss),
                          CaptainService (capitaine : création, désignation, unicité, migration)
    borough/              UpgradeService (améliorations du Bourg : coûts, achats, activités améliorées), upgradeEffects
    geography/            LandService (Terres), LocationService (lieux), GeographyService (lieu d'une équipe,
                          lieu par défaut, même Terre / même lieu, vérification des données)
    queen/                QueenCombatService (Combats de la Reine : dates, propositions, récompense, choix, résolution)
    calendar/             CalendarService (dates des journées et des Combats de la Reine, timeline,
                          prochain événement, nature du jour), scheduler, eventHandlers
    report/               DailyReportService : carnet de bord = liste d'événements structurés
                          (mis en forme par ui/report/logbookFormats.js)
    calendar/, time/      Planification, événements, passage d'une journée (dayPhases.js)
    recruitment/, economy/, roster/, generation/, game/, save/ (format v3), settings/, storage/
  render/                 Socle isométrique partagé
  centre/                 Scène du Centre et décor (propRenderers.js)
  borough/                Scène et rendu du Bourg (carte, artisans, habitants)
  scriptorium/            Scène et rendu du Scriptorium (bibliothèque, Bureau d'étude, personnages)
  combat/                 Arena (grille 13 × 8), simulation, presentation/ (décor, foule) et render/IsoRenderer
  admin/                  Module Admin
  ui/                     Composants (carte, classement, étoiles…) et écrans
```

### Étendre le jeu

- **Nouvelle ligue / nouveau pays jouable** : ajouter la définition dans `data/leagues.js` (`available: true`). Pour un nouveau pays, mettre aussi `selectable: true` dans `data/geography/europe.js`.
- **Nouvelle activité** : ajouter une entrée dans `data/activities.js`. Un nombre de places se fixe avec `capacity` ; un traitement spécifique, avec `resolve`.
- **Nouvelle statistique** : `data/stats.js`. Préciser `kind` et `polarity`, et mettre `level: true` si elle compte dans le niveau.
- **Nouvel effet du temps** (matchs, blessures, salaires, mercato, montées et descentes…) : ajouter une étape dans `systems/time/dayPhases.js`.
- **Résultats de championnat** : `recordResult` dans `systems/league/LeagueSystem.js`, appelé depuis `updateLeaguesForDay` une fois les règles définies.
- **Changement incompatible des sauvegardes** : incrémenter `SAVE_FORMAT_VERSION` et ajouter une migration (`systems/save/migrations.js`). Les sauvegardes v1 et v2 sont migrées automatiquement : par exemple, « runer » devient « runner ».

## Tests

`tests/smoke.html` (http://localhost:8642/tests/smoke.html) contient 679 vérifications (dont une saison complète avec montée et la reprise d'une ancienne sauvegarde). Elles couvrent :

- les stats, la fatigue, les niveaux et les étoiles ;
- la base de clubs et l'édition Admin ;
- les encadrés des lieux du Centre (masqués, survol, sélection unique) et l'affectation rapide de chaque lieu (classe, tri, places libres, réglage enregistré) ;
- le tri des affectations du Centre (9 colonnes, inversion) et le bouton [+] du Banquet (seuil strict, réglage 0–100) ;
- les mises à terre et médailles (coup fatal seul crédité, cumul sur plusieurs manches, sauvegarde, seuils cumulatifs, fiche) ;
- le domicile et l'extérieur (alternance, Combats de la Reine à part, sauvegarde et migration, affichage, terrain, recette de 20 à 50 deniers, table par niveau) ;
- les effets visuels hors combat (gains du Centre, chantiers du Bourg, porte et chopes de la Taverne, bannières et confettis de fin de saison, niveau désactivé) ;
- les effets visuels des combats (un effet par événement, fonction du seul temps du rejeu, niveaux complets / réduits / désactivés, plafond) ;
- les effets visuels du lot 4 (rune du talent de l'attaquant seul et couleur de famille, survie à 1 PV, trèfle, combo, gros coup et tremblement borné, lueur du capitaine, sueur et vapeur, fanions de fin de manche, révélation au Scriptorium une seule fois, artefact sur la table, pupitres occupés, pluie de victoire, qualification en Coupe, niveau lisible par le CSS, dessin de toutes les formes) ;
- le tabard aux couleurs du club (une zone par variante, seule zone recolorée, couleur dérivée du club) ;
- les Terres et les lieux : couleurs, régions, 6 lieux de départ par Terre (les 8 ajoutés à plus de 40 km de tout autre lieu), chaque lieu dans le contour de sa Terre, un lieu propre pour chacun des 53 clubs, Terre lointaine des clubs hors championnat, choix sur la carte, pastille du hub, sauvegarde et migration, Admin ;
- les talents et le Scriptorium : catalogue et familles, aucun talent au départ ni pour l'IA, 10 % à la Taverne (tirage conservé), durée selon le potentiel, indisponibilité (Centre, effectif, équipes, manches), fin au jour prévu et révélation unique, sauvegarde en cours et après la date de fin, interruption, départ du combattant, effets des 50 talents (combat : conditions, auras, Tacticien, Garde du corps, survie à 1 PV ; fatigue ; Centre et revenus ; domicile, Reine, Taverne ; études, potentiel, plafond ; une vraie manche avec talents), un seul talent et remplacement à 500 deniers (solde, interruption sans remboursement), second Bureau et études simultanées, artefacts (chances, sans cumul, dernier acheté actif), tirage à la révélation et jamais rejoué, zone de Flavia, chat et souris, interface (Bureau, confirmation, interruption, porte, étiquettes de La Compagnie, de la fiche et de la fiche de recrutement, carte grisée) ;
- la capacité des zones ;
- le moteur de combat : probabilité, fatigue, manches ;
- La Lice : grille 13 × 8, décors, affluence (repères de conception, ordre des divisions) et placement de la foule ;
- le calendrier des rencontres, les points et la journée de championnat ;
- l'espacement aléatoire des journées (4 à 6 jours) et sa conservation au chargement ;
- les Combats de la Reine :
  - dates, absence de conflit avec le championnat ;
  - propositions (origines ≈ 50 / 20 / 20 / 10 %, barème ± 15 %) ;
  - choix définitif, récompense seulement en cas de victoire, championnat inchangé ;
  - 4 combats IA contre IA : 13 clubs distincts, exclusion des 5 proposés, inter-ligues, simulés une fois, absents du carnet ;
  - combat manqué, sauvegarde ;
  - parcours complet dans l'interface ;
- l'effectif : limite de 20, Taverne refusée à 20 / 20, congédiement avec confirmation ;
- les étoiles avec demi-étoiles : bornes du barème, rendu graphique ;
- le combat Joueur contre IA :
  - dégâts (rapport attaque ÷ défense mixte, plus de boucle de classes, aléa PER plafonné, combo LUTTE plafonné et remis à zéro, fatigue, minimum 1), stat et allonge par classe ;
  - bonus de position : capitaine +15 %, Lutteur contre la barrière et cible plaquée, Hastier à distance ou dans la mêlée, Runner dans le dos et renversement, angle mort des casques fermés ; formation du placement et de la composition de l'IA ;
  - endurance de l'IA ±10 % tirée une fois, ordre d'attaque, cible la plus proche, nouvelle cible après un KO, surnombre ;
  - fin de manche, forfait, cases distinctes, résultat reproductible ; KO limités à la manche, PV récupérés, fatigue ;
  - placement alterné (tours, zones, cases occupées, verrouillage, camps inégaux), placement de l'IA ; plus fort niveau en premier puis alternance par manche, délai de 1 à 2 s de l'IA, message ;
  - rejeu (états d'animation, 0,64 s par tour) ; interface (placement, combat, bilan, retour des KO à la manche suivante) ; IA contre IA inchangé ;
  - rappel des classes (schéma en haut du combat et du placement) ; fatigue des adversaires (départ 0 à 15, cumulée, affichée) ; malus de fatigue au-delà de 50 (−2 % par point) ; bonus affichés au lancement de la manche ;
- les sprites des combattants :
  - 12 sprites, 4 par classe, fichiers présents et nommés par classe, variante et animation ;
  - `isValidSprite`, refus d'un sprite d'une autre classe, changement de classe (même variante) ;
  - migration des anciens sprites (sauvegardes, fichiers de clubs, Admin), stabilité ;
  - création du capitaine : seules les 4 apparences de la classe, mises à jour au changement de classe ;
- le Bourg :
  - coûts initiaux, prix × 3 puis × 4, × 5… par amélioration, probabilités +10 % ;
  - Forêt à 2 places, +2 par le Bûcheron (300 → 900 → 3 600 → 18 000, 4 achats au plus : 10 places), ancienne sauvegarde ;
  - débit, blocage faute de deniers ;
  - effets réels (places, gains, probabilité), persistance ;
  - interface ;
- le capitaine :
  - création (règles, interface) ;
  - capitaines des clubs de l'IA (1er ou 2e) ;
  - unicité, congédiement, migration ;
  - couronne ;
- la fin de saison :
  - clôture dès le dernier combat ;
  - bilan (classement final, mouvements des 3 ligues) ;
  - calendrier grisé ;
  - « Commencer la nouvelle saison » ;
  - historique des clubs (joueur et IA), âge +1 ;
- les Combats de la Reine : 5 adversaires classés par étoiles, gains × 2, lice dédiée (abords du château), 50 spectateurs au minimum, La Reine dans la foule ;
- les compétences de départ entre 10 et 30 ;
- l'âge et le potentiel :
  - répartitions initiales ;
  - +1 an tous les 200 jours ;
  - règles et bornes par tranche d'âge ;
  - vérification tous les 15 jours (avec rattrapage) ;
  - carnet seulement en cas de changement ;
  - sauvegarde, anciennes sauvegardes, fiche ;
- les recrutements de l'IA :
  - tirage de 1 % par club ;
  - recrue autour d'un des 4e à 7e plus forts (tirage), âge de la recrue ;
  - effectif de 12, départ lié au niveau au-delà ;
  - retraite à 36 ans (35 reste), remplacement sous 9, journée, fin de saison, ancienne sauvegarde ;
  - historique d'effectif (événements figés, textes, persistance, fiche) ; âge initial 18–31 ;
  - 9 → 10, puis 10 + 1 → 10 avec congédiement du plus faible ;
  - niveau du club recalculé ;
  - carnet limité à la ligue du joueur ;
  - sauvegarde ;
- la progression de l'IA :
  - chances par étoiles (10 / 5 / 2 %) et par âge (2 à 5 %) ;
  - niveau +1 / −1 borné, base de clubs intacte, joueur jamais touché, une fois par jour ;
  - indicateur sur 30 jours (bilan net), élagage de l'historique, persistance, âge +1 par saison ;
  - fiche de club (bouton, flèches) ;
- les migrations ;
- les langues (v0.79) : moteur de traduction (texte exact, trous, accords, icônes, séparateurs, noms propres gardés), dictionnaires anglais et espagnol complets et cohérents (trous et balises de l'Almanach), drapeau, bascule immédiate et mémorisée, texte des cartes ;
- l'emblème de l'écran principal (v0.78) : partition et trois couleurs distinctes tirées au hasard, affichées ;
- les Options en jeu (v0.77) : bouton avec Succès, Sauvegarder et Menu principal, mêmes réglages qu'au menu sans le module Admin, fenêtre (la partie reste ouverte) ;
- les Patch Notes (v0.76) : regroupement des versions (0.6 = 0.51 à 0.60.x), seules les majeures affichées (0.8 en cours, version actuelle), chaque version détaillée rattachée, 10 évolutions au plus, fenêtre ;
- la fatigue (v0.75) : trois états et Sang-froid, courbatures (par manche, KO, plafond de Bon vivant, une seule fois, sauvegardées), avance rapide comprise et jamais pour une fatigue suivie le temps du combat, Centre (épuisé refusé sauf au Banquet, envoyé d'office le matin, fatigué deux fois moins efficace), configurations, interface (colonne colorée, lieux grisés, bloc de fin de combat) ;
- le son (v0.74.1) : ambiances et effets en vrais enregistrements (tous les fichiers présents, licences CC0 créditées, aucune synthèse), musique principale à l'écran principal, camp sans oiseaux en hiver ;
- le son (v0.74) : fichiers présents, musique et ambiance de chaque lieu, Warlike Pulse au lancement de la manche et retour après le combat, foule de la Coupe, oiseaux absents en hiver, ambiances toujours sous la musique, volumes et coupure, coups et KO calés sur le rejeu (pas d'avalanche), silence avant le premier clic puis fondus enchaînés (arrêt programmé, jamais immédiat), Options ;
- la v0.73.2 : affectations (compétence à 100 ou au plafond du potentiel en rouge, couleur perdue quand le potentiel monte, jamais PV ni fatigue), Salle des exploits (catégories, onglets, ni numéro ni difficulté, exploits secrets révélés une fois obtenus, annonce sans difficulté), fondu limité à la carte (départ et arrivée) ;
- la v0.73.1 : succès n° 3, 6, 35, 36 faciles ; annonces retenues pendant le combat (aucune annonce avant la fin, puis toutes) ; Coupe de France (fatigue à 0 à l'entrée, vraie fatigue gardée d'un combat à l'autre, palmarès isolé, ancien combat isolé) ;
- les succès (v0.73) : catalogue (40, numéros, difficultés, noms validés), une seule fois, annonce, sauvegarde, ancienne sauvegarde (compteurs à 0, succès d'état au chargement), manche (hache, barrière, dos, capitaine, fatigue, trois armes), combat (Remontada, Sans partage, Hiver, quatre saisons), compétitions, combattants, Boulanger, Bourg, journée (carnet), branchement réel, interface (encart, fenêtre, filtres, annonce) ;
- les deux talents (v0.72) : modèle (deux au plus, sans doublon, ordre), plan d'étude (premier et second gratuits, remplacement à 500 deniers au choix), place exigée, révélation (ajout ou place choisie, jamais en double), carnet, ancienne étude, interface (bouton, choix du talent, coût) ;
- les écussons, la Coupe et la lice d'entraînement (v0.71) : 15 partitions (grille de 5 colonnes, même catalogue pour la création et l'Admin), fatigue remise à 0 une fois par édition (drapeau sauvegardé), composition (formats, camps exclusifs), combat isolé (partie strictement inchangée), journal fidèle au moteur (chronologique, borné), sorties, ronde du Marshal dans la lice, carte de 17 × 14, sortie du Centre sur 2 cases, écran (préparation, combat, console) ;
- les saisons de l'année (v0.70) : calendrier de 100 jours, pastille, lieux fermés et affectations libérées, passage unique (carnet, sauvegarde, ancienne sauvegarde, année 2), efficacité des classes (combat joué et simulé), 8 talents saisonniers, configurations, couleurs, eau, feux et météo des saisons, Taverne et Scriptorium inchangés ;
- la gestion de la compagnie (v0.69) :
  - entraînement inutile (règle, carnet, fenêtre) ;
  - filtres et tris (classe, niveau, nom, potentiel, fatigue, « hors filtre », barre) ;
  - équipe incomplète expliquée ;
  - configurations du Centre (capture, application, places, éléments invalides, absents au repos, persistance, limite) ;
  - historique harmonisé ;
  - palmarès (cumul, rubans, sans saison, déterministe, fiche de club) ;
- le parcours complet : création → Centre → « COMBATTRE » → manches → classement.

## Débogage

`window.behourd` donne accès aux services et au gestionnaire d'écrans depuis la console du navigateur.
