import { createId } from '../utils/id.js';
import { CALENDAR_CONFIG } from '../data/calendar.js';

/**
 * Temps du monde de jeu. Un événement :
 * { id, typeId, day, title, data, status: 'scheduled' | 'done', outcome }
 */
export class Calendar {
  constructor(data = {}) {
    this.currentDay = data.currentDay ?? CALENDAR_CONFIG.startDay;
    this.events = (data.events ?? []).map((event) => ({ ...event, data: { ...(event.data ?? {}) } }));
    // Dernier jour pour lequel les événements récurrents ont été planifiés.
    this.scheduledThrough = data.scheduledThrough ?? this.currentDay;
  }

  addEvent({ typeId, day, title, data = {} }) {
    const event = { id: createId('evt'), typeId, day, title, data, status: 'scheduled', outcome: null };
    this.events.push(event);
    return event;
  }

  /** Événements à venir (après aujourd'hui), du plus proche au plus lointain. */
  getUpcoming(limit = Infinity) {
    return this.events
      .filter((event) => event.status === 'scheduled' && event.day > this.currentDay)
      .sort((a, b) => a.day - b.day)
      .slice(0, limit);
  }

  getEventsOn(day) {
    return this.events.filter((event) => event.day === day);
  }

  daysUntil(event) {
    return event.day - this.currentDay;
  }

  /** Ne conserve que les derniers événements passés. */
  pruneHistory(keep = CALENDAR_CONFIG.historySize) {
    const past = this.events.filter((e) => e.status !== 'scheduled').sort((a, b) => b.day - a.day);
    const removed = new Set(past.slice(keep).map((e) => e.id));
    if (removed.size) this.events = this.events.filter((e) => !removed.has(e.id));
  }

  toJSON() {
    return {
      currentDay: this.currentDay,
      scheduledThrough: this.scheduledThrough,
      events: this.events.map((event) => ({ ...event, data: { ...event.data } })),
    };
  }

  static fromJSON(data) {
    return new Calendar(data ?? {});
  }
}
