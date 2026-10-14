import { createId } from '../utils/id.js';
import { createBaseStats } from '../data/stats.js';
import { createEmptyEquipment } from '../data/equipment.js';
import { isValidSprite, resolveSpriteId } from '../data/sprites.js';
import { getSpecialty, SPECIALTY_IDS } from '../data/specialties.js';
import { createFighterRecord, cloneFighterRecord } from './FighterRecord.js';
import { TALENT_RULES } from '../data/talents.js';

/**
 * Combattant (du joueur ou d'un club de l'IA). Chaque bloc (stats, équipement…) est
 * fusionné avec ses valeurs par défaut : une sauvegarde ancienne reçoit automatiquement
 * les champs ajoutés dans une version plus récente.
 */
export class Fighter {
  constructor(data = {}) {
    this.id = data.id ?? createId('ftr');
    this.teamId = data.teamId ?? null;

    this.name = data.name ?? 'Inconnu';
    // Classe (spécialité) et sprite : toujours compatibles (data/sprites.js). Le sprite est
    // attribué à la création, définitif ; un sprite absent ou d'une autre classe (ancienne
    // sauvegarde, ancien sprite) est remplacé par une variante de la classe, déduite de
    // l'identifiant : elle reste donc stable d'un chargement à l'autre.
    this._specialtyId = SPECIALTY_IDS.includes(data.specialtyId) ? data.specialtyId : SPECIALTY_IDS[0];
    this._spriteId = resolveSpriteId(this._specialtyId, data.spriteId, this.id);
    // Score : niveau global fixé directement (combattants des clubs de l'IA). Null pour
    // les combattants du joueur, dont le niveau est calculé depuis leurs compétences.
    this.score = typeof data.score === 'number' ? data.score : null;

    this.stats = { ...createBaseStats(), ...(data.stats ?? {}) };
    // Identifiant de l'activité du Centre (data/activities.js), null = au repos.
    this.activityId = data.activityId ?? null;

    this.equipment = { ...createEmptyEquipment(), ...(data.equipment ?? {}) };
    this.skills = [...(data.skills ?? [])];
    this.progression = { level: 1, xp: 0, ...(data.progression ?? {}) };
    // Palmarès (combats et manches réellement disputés).
    this.record = createFighterRecord(data.record);
    // Âge en années : +1 à chaque fin de saison (systems/fighters/PotentialService.js).
    // Null : non défini (combattants des clubs de l'IA). Les sauvegardes v0.12 stockaient
    // l'âge à une date ({ age, day }) : cet âge est repris tel quel.
    this.age = typeof data.age === 'number' ? data.age : (data.ageOrigin?.age ?? null);
    // Potentiel (0 à 3) : capacité d'évolution future. Null : non défini.
    this.potential = typeof data.potential === 'number' ? data.potential : null;
    // Capitaine de son équipe (un seul par équipe ; systems/roster/CaptainService.js).
    this.isCaptain = data.isCaptain === true;
    // Jour de la dernière vérification du potentiel (une tous les 15 jours).
    this.potentialCheckDay = typeof data.potentialCheckDay === 'number' ? data.potentialCheckDay : null;
    // Talent révélé (identifiants de data/talents.js) : une liste d'AU PLUS UN élément (un seul
    // talent à la fois ; un nouveau le remplace, systems/talents/TalentService.js). Vide : aucun.
    // Talents révélés : deux au plus (TALENT_RULES.maxPerFighter), sans doublon ; l'ordre compte (1er, 2nd).
    this.talents = Array.isArray(data.talents) ? [...new Set(data.talents.filter((id) => typeof id === 'string'))].slice(0, TALENT_RULES.maxPerFighter) : [];

    this.createdAt = data.createdAt ?? Date.now();
  }

  get specialty() {
    return getSpecialty(this.specialtyId);
  }

  /** Mises à terre de la carrière (enregistrées dans le palmarès, CareerStatsService). */
  get takedowns() {
    return this.record.takedowns;
  }

  get specialtyId() {
    return this._specialtyId;
  }

  /** Changement de classe : un sprite devenu incompatible est aussitôt remplacé (même variante). */
  set specialtyId(classId) {
    if (!SPECIALTY_IDS.includes(classId)) throw new Error(`Spécialité inconnue : ${classId}`);
    this._specialtyId = classId;
    this._spriteId = resolveSpriteId(classId, this._spriteId, this.id);
  }

  get spriteId() {
    return this._spriteId;
  }

  /** Un sprite d'une autre classe est refusé : jamais de combinaison classe / sprite incohérente. */
  set spriteId(spriteId) {
    if (!isValidSprite(this._specialtyId, spriteId)) throw new Error(`Sprite ${spriteId} incompatible avec la classe ${this._specialtyId}.`);
    this._spriteId = spriteId;
  }

  toJSON() {
    return {
      id: this.id,
      teamId: this.teamId,
      name: this.name,
      specialtyId: this.specialtyId,
      spriteId: this.spriteId,
      score: this.score,
      stats: { ...this.stats },
      activityId: this.activityId,
      equipment: { ...this.equipment },
      skills: [...this.skills],
      progression: { ...this.progression },
      record: cloneFighterRecord(this.record),
      age: this.age,
      potential: this.potential,
      isCaptain: this.isCaptain,
      potentialCheckDay: this.potentialCheckDay,
      talents: [...this.talents],
      createdAt: this.createdAt,
    };
  }

  static fromJSON(data) {
    return new Fighter(data);
  }
}
