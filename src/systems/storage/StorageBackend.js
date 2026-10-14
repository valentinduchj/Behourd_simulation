// Accès au stockage persistant. Aujourd'hui localStorage ; demain un fichier
// (Electron/Tauri) ou un service distant, en gardant la même interface.

export class StorageBackend {
  constructor(prefix = '') {
    this.prefix = prefix;
    const local = detectLocalStorage();
    this.store = local ?? new MemoryStore();
    /** false si les données seront perdues à la fermeture (navigation privée, etc.). */
    this.persistent = local !== null;
  }

  read(key) {
    return this.store.getItem(this.prefix + key);
  }

  write(key, value) {
    this.store.setItem(this.prefix + key, value);
  }

  remove(key) {
    this.store.removeItem(this.prefix + key);
  }

  /** Clés (sans le préfixe global) commençant par `subPrefix`. */
  keys(subPrefix = '') {
    const fullPrefix = this.prefix + subPrefix;
    const result = [];
    for (let i = 0; i < this.store.length; i++) {
      const key = this.store.key(i);
      if (key?.startsWith(fullPrefix)) result.push(key.slice(this.prefix.length));
    }
    return result;
  }

  readJSON(key) {
    const raw = this.read(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  writeJSON(key, value) {
    this.write(key, JSON.stringify(value));
  }
}

function detectLocalStorage() {
  try {
    const storage = window.localStorage;
    const probe = '__behourd_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

class MemoryStore {
  #map = new Map();

  get length() {
    return this.#map.size;
  }

  key(index) {
    return [...this.#map.keys()][index] ?? null;
  }

  getItem(key) {
    return this.#map.has(key) ? this.#map.get(key) : null;
  }

  setItem(key, value) {
    this.#map.set(key, String(value));
  }

  removeItem(key) {
    this.#map.delete(key);
  }
}
