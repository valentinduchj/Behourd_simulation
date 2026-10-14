import { createId } from '../../utils/id.js';
import { SaveError } from './saveFormat.js';
import { serializeSession, deserializeSession } from './serialization.js';
import { initializeWorld } from '../game/worldSetup.js';

const SLOT_PREFIX = 'save.';

/**
 * Sauvegardes multiples, une par partie. Chaque partie garde son identifiant de
 * sauvegarde : sauvegarder à nouveau écrase la même entrée.
 */
export class SaveSystem {
  constructor(storage) {
    this.storage = storage;
  }

  /** Résumés des sauvegardes, les plus récentes d'abord. */
  listSaves() {
    return this.storage
      .keys(SLOT_PREFIX)
      .map((key) => this.#readSummary(key))
      .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
  }

  hasSaves() {
    return this.storage.keys(SLOT_PREFIX).length > 0;
  }

  save(session) {
    if (!session.saveId) session.saveId = createId('save');
    const file = serializeSession(session);
    try {
      this.storage.writeJSON(SLOT_PREFIX + session.saveId, file);
    } catch (error) {
      throw new SaveError(`Écriture impossible (${error.message}).`);
    }
    session.markSaved(file.meta.savedAt);
    return file.meta;
  }

  load(saveId) {
    const raw = this.storage.read(SLOT_PREFIX + saveId);
    if (raw === null) throw new SaveError('Sauvegarde introuvable.');

    let file;
    try {
      file = JSON.parse(raw);
    } catch {
      throw new SaveError('La sauvegarde est corrompue.');
    }
    const session = deserializeSession(file);
    initializeWorld(session);
    session.saveId = saveId;
    session.dirty = false;
    return session;
  }

  delete(saveId) {
    this.storage.remove(SLOT_PREFIX + saveId);
  }

  deleteAll() {
    for (const key of this.storage.keys(SLOT_PREFIX)) this.storage.remove(key);
  }

  #readSummary(key) {
    const id = key.slice(SLOT_PREFIX.length);
    try {
      const file = JSON.parse(this.storage.read(key));
      return { id, corrupted: false, ...file.meta };
    } catch {
      return { id, corrupted: true };
    }
  }
}
