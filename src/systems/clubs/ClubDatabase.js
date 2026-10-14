import { LEAGUE_DEFINITIONS, LEAGUE_CONFIG, RESERVE_POOL } from '../../data/leagues.js';
import { SPECIALTY_IDS } from '../../data/specialties.js';
import { getEmblemPattern, DEFAULT_PATTERN_ID } from '../../data/emblemPatterns.js';
import { resolveSpriteId } from '../../data/sprites.js';
import { Team } from '../../models/Team.js';
import { Fighter } from '../../models/Fighter.js';
import { Emblem, DEFAULT_EMBLEM_COLORS } from '../../models/Emblem.js';
import { resolveColor } from '../../data/palette.js';
import { assetUrl } from '../../utils/assets.js';
import { pick } from '../../utils/random.js';
import { generateFighterName, composeFighterName, firstNameOf } from '../generation/NameGenerator.js';
import { pickRandomSpriteId } from '../generation/FighterGenerator.js';
import { pickAICaptainIndex } from '../roster/CaptainService.js';
import { resolveClubLocationId } from '../geography/GeographyService.js';
import { getLocation } from '../geography/LocationService.js';

/**
 * Base des clubs de l'IA — données STATIQUES, hors sauvegarde de partie.
 *
 * Source : les fichiers data/leagues/*.json déclarés dans src/data/leagues.js (`clubsFile`),
 * qui donnent aussi la composition initiale de chaque division.
 * Les modifications faites dans le Module Admin sont enregistrées dans le navigateur
 * (stockage local, clé « clubdb.<ligue> ») et prennent le pas sur le fichier ;
 * l'Admin peut les exporter pour remplacer le fichier, ou revenir au fichier.
 *
 * Une partie ne copie pas ces clubs : elle les référence par identifiant. Une
 * modification s'applique donc aussi aux parties en cours.
 */
export class ClubDatabase {
  constructor() {
    this.storage = null;
    this.files = new Map(); // ligue → contenu du fichier
    this.data = new Map();  // ligue → données actives (fichier ou modifications locales)
    this.teams = new Map();
    this.fighters = new Map();
  }

  init(storage) {
    this.storage = storage;
    return this;
  }

  /** Charge les fichiers de clubs des divisions et de la réserve (clubs hors championnat). */
  async load() {
    this.#migrateLegacyOverrides();
    for (const pool of CLUB_POOLS) {
      const response = await fetch(assetUrl(pool.clubsFile), { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Fichier de clubs introuvable : ${pool.clubsFile}`);
      let file;
      try {
        file = await response.json();
      } catch (error) {
        throw new Error(`Fichier de clubs invalide (${pool.clubsFile}) : ${error.message}`);
      }
      this.files.set(pool.id, file);
    }
    for (const pool of CLUB_POOLS) {
      const override = this.#readOverride(pool.id);
      this.data.set(pool.id, normalizeLeagueData(structuredClone(override ?? this.files.get(pool.id))));
    }
    this.#rebuild();
    return this;
  }

  // --- Lecture ---

  /** Groupes de clubs gérés : les divisions puis la réserve. */
  listPools() {
    return CLUB_POOLS;
  }

  getClubIdsOfLeague(leagueDefId) {
    return (this.data.get(leagueDefId)?.clubs ?? []).map((club) => club.id);
  }

  /** Clubs pouvant compléter une division en sous-effectif : la réserve, puis tout autre club connu. */
  getReserveClubIds() {
    return [...new Set([...this.getClubIdsOfLeague(RESERVE_POOL.id), ...this.teams.keys()])];
  }

  /** Données brutes (modifiables par l'Admin) d'un club. */
  getClubData(clubId) {
    return this.#find(clubId)?.club ?? null;
  }

  getClubsData(leagueDefId) {
    return this.data.get(leagueDefId)?.clubs ?? [];
  }

  /** Club sous forme d'équipe (même modèle que le club du joueur). */
  getTeam(clubId) {
    return this.teams.get(clubId) ?? null;
  }

  getFighter(fighterId) {
    return this.fighters.get(fighterId) ?? null;
  }

  getFightersOfClub(clubId) {
    return (this.getTeam(clubId)?.fighterIds ?? []).map((id) => this.fighters.get(id)).filter(Boolean);
  }

  hasLocalChanges(leagueDefId) {
    return (this.storage?.read(overrideKey(leagueDefId)) ?? null) !== null;
  }

  /** Division d'origine (fichier) d'un club. */
  getInitialLeagueOf(clubId) {
    return this.#find(clubId)?.leagueDefId ?? null;
  }

  /**
   * Nombre de clubs de l'IA attendus dans le fichier d'une division : LEAGUE_CONFIG.teamCount,
   * moins la place du joueur dans sa division de départ. null pour la réserve (effectif libre).
   */
  getExpectedClubCount(leagueDefId) {
    const def = LEAGUE_DEFINITIONS.find((d) => d.id === leagueDefId);
    if (!def) return null;
    return LEAGUE_CONFIG.teamCount - (def.playerStart ? 1 : 0);
  }

  /** Vérifie que chaque fichier contient le nombre de clubs attendu. Renvoie la liste des problèmes. */
  validateCompositions() {
    return LEAGUE_DEFINITIONS.filter((def) => def.clubsFile).flatMap((def) => {
      const count = this.getClubIdsOfLeague(def.id).length;
      const expected = this.getExpectedClubCount(def.id);
      return count === expected ? [] : [`${def.name} : ${count} clubs au lieu de ${expected}.`];
    });
  }

  // --- Modification (Module Admin) ---

  updateClub(clubId, patch) {
    const found = this.#find(clubId);
    if (!found) throw new Error(`Club introuvable : ${clubId}`);
    const { club } = found;
    if (patch.name !== undefined) club.name = patch.name;
    if (patch.emblem !== undefined) club.emblem = patch.emblem;
    if (patch.colors !== undefined) club.colors = { ...club.colors, ...patch.colors };
    // Lieu (la Terre en découle) : un lieu inconnu est refusé.
    if (patch.locationId !== undefined) {
      if (!getLocation(patch.locationId)) throw new Error(`Lieu inconnu : ${patch.locationId}`);
      club.locationId = patch.locationId;
    }
    this.#commit(found.leagueDefId);
  }

  updateFighter(clubId, fighterId, patch) {
    const found = this.#find(clubId);
    const fighter = found?.club.fighters.find((f) => f.id === fighterId);
    if (!fighter) throw new Error(`Combattant introuvable : ${fighterId}`);
    // Le sprite est définitif : il n'est jamais modifiable.
    if (patch.name !== undefined) fighter.name = patch.name;
    if (patch.specialty !== undefined) {
      fighter.specialty = patch.specialty;
      // Changement de classe : un sprite devenu incompatible est remplacé (même variante).
      fighter.sprite = resolveSpriteId(fighter.specialty, fighter.sprite, fighter.id);
    }
    if (patch.score !== undefined) fighter.score = clampScore(patch.score);
    this.#commit(found.leagueDefId);
  }

  /** Ajoute un combattant ; son sprite est tiré au hasard et ne changera plus. */
  addFighter(clubId, { rng = Math.random, score = 50 } = {}) {
    const found = this.#find(clubId);
    if (!found) throw new Error(`Club introuvable : ${clubId}`);
    const { club } = found;
    const fighter = createClubFighterData({ id: nextFighterId(club), takenNames: club.fighters.map((f) => f.name), score, rng });
    club.fighters.push(fighter);
    this.#commit(found.leagueDefId);
    return fighter;
  }

  removeFighter(clubId, fighterId) {
    const found = this.#find(clubId);
    if (!found) throw new Error(`Club introuvable : ${clubId}`);
    found.club.fighters = found.club.fighters.filter((f) => f.id !== fighterId);
    this.#commit(found.leagueDefId);
  }

  /** Ajoute un club à une division (8 combattants générés, sprites tirés au hasard). */
  addClub(leagueDefId, { rng = Math.random } = {}) {
    const data = this.data.get(leagueDefId);
    if (!data) throw new Error(`Division inconnue : ${leagueDefId}`);
    const allIds = new Set([...this.teams.keys()]);
    let n = 1;
    while (allIds.has(`club_custom_${String(n).padStart(3, '0')}`)) n++;
    const usedNames = new Set([...this.teams.values()].map((team) => team.name));
    let name = 'Nouveau club';
    for (let i = 2; usedNames.has(name); i++) name = `Nouveau club ${i}`;
    const club = { id: `club_custom_${String(n).padStart(3, '0')}`, name, emblem: DEFAULT_PATTERN_ID, colors: { ...DEFAULT_EMBLEM_COLORS }, fighters: [] };
    club.colors = Object.fromEntries(Object.entries(club.colors).map(([slot, color]) => [slot, resolveColor(color)]));
    data.clubs.push(club);
    this.#commit(leagueDefId);
    for (let i = 0; i < 8; i++) this.addFighter(club.id, { rng });
    return this.getClubData(club.id);
  }

  removeClub(clubId) {
    const found = this.#find(clubId);
    if (!found) throw new Error(`Club introuvable : ${clubId}`);
    const data = this.data.get(found.leagueDefId);
    data.clubs = data.clubs.filter((club) => club.id !== clubId);
    this.#commit(found.leagueDefId);
  }

  /** Abandonne les modifications locales et revient au fichier de données. */
  resetToFile(leagueDefId) {
    this.storage?.remove(overrideKey(leagueDefId));
    this.data.set(leagueDefId, normalizeLeagueData(structuredClone(this.files.get(leagueDefId))));
    this.#rebuild();
  }

  /** Contenu JSON (lisible) à déposer dans data/leagues/ pour rendre les modifications permanentes. */
  exportLeague(leagueDefId) {
    return formatClubFile(this.data.get(leagueDefId), this.files.get(leagueDefId));
  }

  // --- Interne ---

  /** Modifications locales enregistrées avant la v0.7 sous l'ancien identifiant de la Ligue 2. */
  #migrateLegacyOverrides() {
    const legacy = this.storage?.readJSON('clubdb.fr-2');
    if (!legacy) return;
    if (this.storage.read(overrideKey('league_2')) === null) {
      this.storage.writeJSON(overrideKey('league_2'), { ...legacy, leagueId: 'league_2' });
    }
    this.storage.remove('clubdb.fr-2');
  }

  /**
   * Modifications locales d'un groupe. Un club qu'un fichier a déplacé vers un autre groupe
   * (ex. passage à 18 clubs par division : un club par division mis en réserve) n'est plus
   * conservé dans les modifications locales de son ancien groupe.
   */
  #readOverride(poolId) {
    const override = this.storage?.readJSON(overrideKey(poolId));
    if (!Array.isArray(override?.clubs)) return override ?? null;
    const ownFile = new Set((this.files.get(poolId)?.clubs ?? []).map((club) => club.id));
    const elsewhere = new Set([...this.files].filter(([id]) => id !== poolId).flatMap(([, file]) => (file.clubs ?? []).map((club) => club.id)));
    const clubs = override.clubs.filter((club) => ownFile.has(club?.id) || !elsewhere.has(club?.id));
    if (clubs.length === override.clubs.length) return override;
    const cleaned = { ...override, clubs };
    this.storage.writeJSON(overrideKey(poolId), cleaned);
    return cleaned;
  }

  #find(clubId) {
    for (const [leagueDefId, data] of this.data) {
      const club = data.clubs.find((c) => c.id === clubId);
      if (club) return { leagueDefId, club };
    }
    return null;
  }

  /** Nomme le capitaine d'un club (Module Admin) : un seul capitaine par club. */
  setCaptain(clubId, fighterId) {
    const found = this.#find(clubId);
    if (!found?.club.fighters.some((f) => f.id === fighterId)) throw new Error(`Combattant introuvable : ${fighterId}`);
    for (const fighter of found.club.fighters) {
      if (fighter.id === fighterId) fighter.captain = true;
      else delete fighter.captain;
    }
    this.#commit(found.leagueDefId);
  }

  #commit(leagueDefId) {
    this.data.get(leagueDefId).clubs.forEach(ensureClubCaptain);
    this.storage?.writeJSON(overrideKey(leagueDefId), this.data.get(leagueDefId));
    this.#rebuild();
  }

  /** Construit les équipes et combattants (modèles du jeu) à partir des données. */
  #rebuild() {
    this.teams.clear();
    this.fighters.clear();
    for (const data of this.data.values()) {
      for (const club of data.clubs) {
        const team = new Team({
          id: club.id,
          name: club.name,
          ownerId: null,
          // Lieu du club (Admin, sinon data/geography/clubLocations.js, sinon Terre lointaine).
          ...locateClub(club),
          emblem: new Emblem({ patternId: club.emblem, colors: club.colors }),
          fighterIds: club.fighters.map((f) => f.id),
          createdAt: 0,
        });
        this.teams.set(team.id, team);
        for (const f of club.fighters) this.fighters.set(f.id, createClubFighter(club.id, f));
      }
    }
  }
}

const overrideKey = (leagueDefId) => `clubdb.${leagueDefId}`;

function locateClub(club) {
  const location = getLocation(resolveClubLocationId(club.id, club));
  return { locationId: location.id, landId: location.landId };
}

/**
 * Données d'un nouveau combattant de club de l'IA (même format que data/leagues/*.json) :
 * nom, spécialité et sprite tirés au hasard (sprite définitif), niveau = `score`.
 * Seul générateur des combattants de l'IA : Module Admin et recrutements des clubs.
 */
export function createClubFighterData({ id, takenNames = [], score = 50, rng = Math.random }) {
  const used = new Set(takenNames.map((name) => firstNameOf(name)));
  const name = composeFighterName(generateFighterName(rng, used));
  const specialty = pick(rng, SPECIALTY_IDS);
  return {
    id,
    name,
    specialty,
    // Sprite tiré parmi les variantes de la classe, définitif.
    sprite: pickRandomSpriteId(specialty, rng),
    score: clampScore(score),
  };
}

/** Combattant de l'IA (modèle du jeu) à partir de ses données de club. */
export function createClubFighter(clubId, data, createdAt = 0) {
  return new Fighter({
    id: data.id,
    teamId: clubId,
    name: data.name,
    specialtyId: data.specialty,
    spriteId: data.sprite ?? undefined,
    score: data.score,
    stats: data.stats,
    isCaptain: data.captain === true,
    createdAt,
  });
}

/** Fichiers de clubs : chaque division qui en déclare un, puis la réserve. */
const CLUB_POOLS = Object.freeze([...LEAGUE_DEFINITIONS.filter((def) => def.clubsFile), RESERVE_POOL]);

function clampScore(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
}

function nextFighterId(club) {
  const taken = new Set(club.fighters.map((f) => f.id));
  for (let n = club.fighters.length + 1; ; n++) {
    const id = `${club.id}_f${String(n).padStart(2, '0')}`;
    if (!taken.has(id)) return id;
  }
}

/** Rend les données tolérantes aux erreurs de saisie dans le fichier. */
function normalizeLeagueData(data) {
  const clubs = Array.isArray(data?.clubs) ? data.clubs : [];
  return {
    ...data,
    clubs: clubs.filter((club) => club && club.id).map((club) => ({
      ...club,
      name: String(club.name ?? club.id),
      emblem: getEmblemPattern(club.emblem).id === club.emblem ? club.emblem : DEFAULT_PATTERN_ID,
      colors: Object.fromEntries(Object.entries({ ...DEFAULT_EMBLEM_COLORS, ...(club.colors ?? {}) })
        .map(([slot, color]) => [slot, resolveColor(color)])),
      fighters: (Array.isArray(club.fighters) ? club.fighters : []).map((fighter, index) => ({
        ...fighter,
        id: fighter.id ?? `${club.id}_f${String(index + 1).padStart(2, '0')}`,
        name: String(fighter.name ?? 'Inconnu'),
        specialty: SPECIALTY_IDS.includes(fighter.specialty) ? fighter.specialty : SPECIALTY_IDS[0],
        // Sprite de la classe du combattant (ancien sprite ou sprite absent : variante déduite de l'identifiant).
        sprite: resolveSpriteId(SPECIALTY_IDS.includes(fighter.specialty) ? fighter.specialty : SPECIALTY_IDS[0], fighter.sprite, fighter.id ?? `${club.id}_f${String(index + 1).padStart(2, '0')}`),
        score: clampScore(fighter.score ?? 0),
        captain: fighter.captain === true ? true : undefined,
      })),
    })).map(ensureClubCaptain),
  };
}

/**
 * Un club de l'IA a exactement un capitaine : s'il n'en a pas (fichier ancien, club créé ou
 * capitaine retiré dans l'Admin), le 1er ou le 2e combattant le devient ; s'il en a
 * plusieurs, seul le premier le reste.
 */
export function ensureClubCaptain(club) {
  const captains = club.fighters.filter((f) => f.captain === true);
  if (captains.length === 1) return club;
  if (captains.length > 1) {
    captains.slice(1).forEach((f) => { delete f.captain; });
    return club;
  }
  const index = pickAICaptainIndex(club.id, club.fighters.length);
  if (index >= 0) club.fighters[index].captain = true;
  return club;
}

/** Même mise en forme que les fichiers fournis : un combattant par ligne. */
function formatClubFile(data, original) {
  const json = (value) => JSON.stringify(value);
  const lines = ['{', `  "leagueId": ${json(data.leagueId ?? original?.leagueId)},`];
  if (original?.notice) lines.push(`  "notice": ${json(original.notice)},`);
  lines.push('  "clubs": [');
  data.clubs.forEach((club, ci) => {
    lines.push('    {');
    lines.push(`      "id": ${json(club.id)},`);
    lines.push(`      "name": ${json(club.name)},`);
    lines.push(`      "emblem": ${json(club.emblem)},`);
    lines.push(`      "colors": ${json(club.colors)},`);
    if (club.locationId) lines.push(`      "locationId": ${json(club.locationId)},`);
    lines.push('      "fighters": [');
    club.fighters.forEach((fighter, fi) => {
      const clean = Object.fromEntries(Object.entries(fighter).filter(([, value]) => value !== undefined));
      lines.push(`        ${json(clean)}${fi < club.fighters.length - 1 ? ',' : ''}`);
    });
    lines.push('      ]');
    lines.push(`    }${ci < data.clubs.length - 1 ? ',' : ''}`);
  });
  lines.push('  ]', '}');
  return `${lines.join('\n')}\n`;
}

/** Instance partagée par tout le jeu (initialisée au démarrage, voir main.js). */
export const clubDatabase = new ClubDatabase();
