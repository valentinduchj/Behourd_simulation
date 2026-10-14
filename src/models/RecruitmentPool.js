import { Fighter } from './Fighter.js';

/**
 * Offre de recrutement de la Taverne. Une candidature : { id, fighter, cost }.
 * `generatedOnDay` vaut null tant qu'aucune offre n'a été générée.
 */
export class RecruitmentPool {
  constructor(data = {}) {
    this.candidates = (data.candidates ?? []).map((candidate) => ({
      id: candidate.id,
      cost: candidate.cost,
      fighter: candidate.fighter instanceof Fighter ? candidate.fighter : Fighter.fromJSON(candidate.fighter),
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
      candidates: this.candidates.map(({ id, cost, fighter }) => ({ id, cost, fighter: fighter.toJSON() })),
    };
  }

  static fromJSON(data) {
    return new RecruitmentPool(data ?? {});
  }
}
