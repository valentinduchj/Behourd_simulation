import { createId } from '../utils/id.js';
import { Emblem } from './Emblem.js';

/**
 * Équipe (compagnie). Elle référence ses combattants par identifiant : les combattants
 * eux-mêmes sont stockés à part dans la session, ce qui permettra transferts,
 * recrutements et équipes adverses sans dupliquer les données.
 */
export class Team {
  constructor(data = {}) {
    this.id = data.id ?? createId('team');
    this.name = data.name ?? 'Compagnie sans nom';
    this.ownerId = data.ownerId ?? null; // null = club contrôlé par l'IA
    this.leagueId = data.leagueId ?? null;
    // Localisation (systems/geography/) : Terre et lieu de la compagnie.
    this.landId = data.landId ?? null;
    this.locationId = data.locationId ?? null;
    this.emblem = data.emblem instanceof Emblem ? data.emblem : Emblem.fromJSON(data.emblem);
    this.fighterIds = [...(data.fighterIds ?? [])];
    this.reputation = data.reputation ?? 0;
    this.record = { fights: 0, wins: 0, losses: 0, ...(data.record ?? {}) };
    this.createdAt = data.createdAt ?? Date.now();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      ownerId: this.ownerId,
      leagueId: this.leagueId,
      landId: this.landId,
      locationId: this.locationId,
      emblem: this.emblem.toJSON(),
      fighterIds: [...this.fighterIds],
      reputation: this.reputation,
      record: { ...this.record },
      createdAt: this.createdAt,
    };
  }

  static fromJSON(data) {
    return new Team(data);
  }
}
