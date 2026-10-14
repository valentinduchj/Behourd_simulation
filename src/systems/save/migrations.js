import { SAVE_FORMAT_VERSION, SaveError } from './saveFormat.js';

// v2 → v3 pour un combattant : la spécialité mal orthographiée devient « runner » ;
// Force et Vitesse disparaissent (les nouvelles stats prennent leur valeur de base) ;
// l'ancienne activité « training » (Pôle Combat unique) est remplacée par trois zones.
const LEGACY_SPECIALTY_IDS = { runer: 'runner' };
const REMOVED_ACTIVITY_IDS = new Set(['training']);

function migrateFighterV2(fighter) {
  if (!fighter) return fighter;
  const { strength, speed, ...stats } = fighter.stats ?? {};
  return {
    ...fighter,
    specialtyId: LEGACY_SPECIALTY_IDS[fighter.specialtyId] ?? fighter.specialtyId,
    stats,
    activityId: REMOVED_ACTIVITY_IDS.has(fighter.activityId) ? null : fighter.activityId ?? null,
  };
}

// MIGRATIONS[n] transforme une sauvegarde au format n en format n + 1.
// Les données absentes (ligue, calendrier, Taverne…) sont complétées ensuite par initializeWorld.
// v3 → v4 : les clubs de l'IA (et leurs combattants) copiés dans la sauvegarde sont
// retirés — ils viennent désormais de data/clubs/*.json. La ligue est recréée au
// chargement (classement vierge : aucun résultat n'existait encore). L'apparence
// générée disparaît : le sprite est déduit de l'identifiant, donc stable.
const stripAppearance = ({ appearance, ...fighter } = {}) => fighter;

// v7 → v8 (v0.68) : la barre de PV passe de 100 à 150 ; les PV enregistrés suivent (× 1,5,
// 150 au plus), pour l'effectif comme pour les recrues de la Taverne.
const HP_SCALE = 1.5;
const HP_MAX = 150;
function scaleFighterHp(fighter) {
  if (!fighter?.stats || typeof fighter.stats.hp !== 'number') return fighter;
  return { ...fighter, stats: { ...fighter.stats, hp: Math.min(HP_MAX, Math.round(fighter.stats.hp * HP_SCALE)) } };
}

const MIGRATIONS = {
  7: (file) => ({
    ...file,
    formatVersion: 8,
    data: {
      ...file.data,
      fighters: (file.data.fighters ?? []).map(scaleFighterHp),
      recruitment: file.data.recruitment && {
        ...file.data.recruitment,
        candidates: (file.data.recruitment.candidates ?? []).map((c) => ({ ...c, fighter: scaleFighterHp(c.fighter) })),
      },
    },
  }),
  // v6 → v7 : l'ancienne « Ligue 2 » (identifiant 'fr-2') devient la division 'league_2'.
  // Sa saison en cours est conservée (clubs, classement, rencontres disputées) ; les
  // deux autres divisions et la saison sont complétées au chargement (SeasonService.
  // adoptLegacySeason). Les combats futurs sont replanifiés selon le calendrier des rencontres.
  6: (file) => {
    const data = file.data;
    const playerTeamId = data.player?.teamId;
    const leagues = (data.leagues ?? []).map((league) => {
      const definitionId = league.definitionId === 'fr-2' ? 'league_2' : league.definitionId === 'fr-1' ? 'league_1' : league.definitionId;
      return { ...league, id: definitionId, definitionId };
    });
    const playerLeague = leagues.find((league) => (league.teamIds ?? []).includes(playerTeamId));
    const currentDay = data.calendar?.currentDay ?? 1;
    return {
      ...file,
      formatVersion: 7,
      data: {
        ...data,
        leagues,
        season: null,
        teams: (data.teams ?? []).map((team) => (team.id === playerTeamId ? { ...team, leagueId: playerLeague?.id ?? null } : team)),
        calendar: data.calendar && {
          ...data.calendar,
          events: (data.calendar.events ?? []).filter((event) =>
            !(event.typeId === 'combat' && event.status === 'scheduled' && event.day > currentDay)),
        },
      },
    };
  },
  // v5 → v6 : les événements futurs sont replanifiés (rotations de la Taverne, plus de
  // tournois). Les événements du jour (combat éventuel) et passés sont conservés.
  // L'ancien bilan de combat des combattants, jamais utilisé, est remplacé par le
  // palmarès (complété à vide par le modèle).
  5: (file) => {
    const calendar = file.data.calendar;
    if (!calendar) return { ...file, formatVersion: 6 };
    const currentDay = calendar.currentDay ?? 1;
    return {
      ...file,
      formatVersion: 6,
      data: {
        ...file.data,
        calendar: {
          ...calendar,
          events: (calendar.events ?? []).filter((event) =>
            event.typeId !== 'tournament' && !(event.status === 'scheduled' && event.day > currentDay)),
          scheduledThrough: currentDay,
        },
      },
    };
  },
  // v4 → v5 : les combats prévus sont replanifiés selon le calendrier des rencontres
  // (numéro de journée, adversaire). Les événements passés sont conservés.
  4: (file) => {
    const calendar = file.data.calendar;
    if (!calendar) return { ...file, formatVersion: 5 };
    const currentDay = calendar.currentDay ?? 1;
    return {
      ...file,
      formatVersion: 5,
      data: {
        ...file.data,
        calendar: {
          ...calendar,
          events: (calendar.events ?? []).filter((event) => event.status !== 'scheduled'),
          scheduledThrough: currentDay - 1,
        },
      },
    };
  },
  3: (file) => {
    const data = file.data;
    // Tout club autre que celui du joueur était un club de l'IA généré.
    const playerTeamId = data.player?.teamId;
    const aiTeamIds = new Set((data.teams ?? []).filter((team) => team.id !== playerTeamId).map((team) => team.id));
    return {
      ...file,
      formatVersion: 4,
      data: {
        ...data,
        teams: (data.teams ?? []).filter((team) => !aiTeamIds.has(team.id)).map((team) => ({ ...team, leagueId: null })),
        fighters: (data.fighters ?? []).filter((fighter) => !aiTeamIds.has(fighter.teamId)).map(stripAppearance),
        recruitment: data.recruitment && {
          ...data.recruitment,
          candidates: (data.recruitment.candidates ?? []).map((c) => ({ ...c, fighter: stripAppearance(c.fighter) })),
        },
        leagues: [],
      },
    };
  },
  2: (file) => ({
    ...file,
    formatVersion: 3,
    data: {
      ...file.data,
      fighters: (file.data.fighters ?? []).map(migrateFighterV2),
      recruitment: file.data.recruitment && {
        ...file.data.recruitment,
        candidates: (file.data.recruitment.candidates ?? []).map((c) => ({ ...c, fighter: migrateFighterV2(c.fighter) })),
      },
    },
  }),
  // v1 → v2 : prénom + épithète fusionnés en un nom ; suppression de l'état physique
  // (moral, fatigue, blessures) et des stats Endurance / Défense ; ajout de l'activité.
  1: (file) => ({
    ...file,
    formatVersion: 2,
    data: {
      ...file.data,
      fighters: (file.data.fighters ?? []).map((fighter) => {
        const { firstName, epithet, condition, stats = {}, ...rest } = fighter;
        const { endurance, defense, ...keptStats } = stats;
        return {
          ...rest,
          name: rest.name ?? (epithet ? `${firstName} ${epithet}` : firstName),
          stats: keptStats,
          activityId: null,
        };
      }),
    },
  }),
};

export function migrateSave(file) {
  if (!file || typeof file !== 'object' || !file.data) {
    throw new SaveError('Format de sauvegarde invalide.');
  }

  let current = file;
  let version = current.formatVersion ?? 1;

  if (version > SAVE_FORMAT_VERSION) {
    throw new SaveError('Cette sauvegarde provient d’une version plus récente du jeu.');
  }

  while (version < SAVE_FORMAT_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new SaveError(`Aucune migration depuis le format ${version}.`);
    current = migrate(current);
    version = current.formatVersion;
  }
  return current;
}
