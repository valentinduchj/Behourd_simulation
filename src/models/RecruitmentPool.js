import { Fighter } from './Fighter.js';

/**
 * Offre de recrutement de la Taverne. Une candidature : { id, fighter, cost, gift? }.
 * `gift` (v0.99) : recrue ramenée d'une expédition du Baron ({ placeId, byId }) — offerte,
 * elle reste à la Taverne aux rotations jusqu'à son engagement.
 * `generatedOnDay` vaut null tant qu'aucune offre n'a été générée.
 */
export class RecruitmentPool {
  constructor(data = {}) {
    this.candidates = (data.candidates ?? []).map((candidate) => ({
      id: candidate.id,
      cost: candidate.cost,
      fighter: candidate.fighter instanceof Fighter ? candidate.fighter : Fighter.fromJSON(candidate.fighter),
      ...(candidate.gift ? { gift: { ...candidate.gift } } : {}),
    }));
    this.generatedOnDay = data.generatedOnDay ?? null;
  }

  get isGenerated() {
    return this.generatedOnDay !== null;
  }

  getCandidate(candidateId) {
    return this.candidates.find((candidate) => candidate.id === candidateId) ?? null;
  }

  setCandidates(candidates, day) {
    this.candidates = candidates;
    this.generatedOnDay = day;
  }

  removeCandidate(candidateId) {
    this.candidates = this.candidates.filter((candidate) => candidate.id !== candidateId);
  }

  toJSON() {
    return {
      generatedOnDay: this.generatedOnDay,
      candidates: this.candidates.map(({ id, cost, fighter, gift }) => ({ id, cost, fighter: fighter.toJSON(), ...(gift ? { gift: { ...gift } } : {}) })),
    };
  }

  static fromJSON(data) {
    return new RecruitmentPool(data ?? {});
  }
}
