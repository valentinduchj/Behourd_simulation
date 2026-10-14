import { getSettingDefinitions } from '../../data/settingsSchema.js';

const STORAGE_KEY = 'settings';

/** Options du jeu, persistées séparément des sauvegardes de partie. */
export class SettingsSystem {
  constructor(storage) {
    this.storage = storage;
    this.listeners = new Set();
    this.values = this.#load();
  }

  get(key) {
    return this.values[key];
  }

  getAll() {
    return { ...this.values };
  }

  set(key, value) {
    if (!(key in this.values)) throw new Error(`Réglage inconnu : ${key}`);
    if (this.values[key] === value) return;
    this.values[key] = value;
    this.#persist();
    this.#emit(key, value);
  }

  reset() {
    const defaults = createDefaults();
    for (const [key, value] of Object.entries(defaults)) {
      if (this.values[key] !== value) {
        this.values[key] = value;
        this.#emit(key, value);
      }
    }
    this.#persist();
  }

  /** Abonnement aux changements ; renvoie une fonction de désabonnement. */
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  #load() {
    const values = createDefaults();
    const saved = this.storage.readJSON(STORAGE_KEY) ?? {};
    for (const def of getSettingDefinitions()) {
      if (def.key in saved && isValidValue(def, saved[def.key])) values[def.key] = saved[def.key];
    }
    return values;
  }

  #persist() {
    try {
      this.storage.writeJSON(STORAGE_KEY, this.values);
    } catch (error) {
      console.warn('Options non enregistrées :', error);
    }
  }

  #emit(key, value) {
    for (const listener of this.listeners) listener(key, value);
  }
}

function createDefaults() {
  return Object.fromEntries(getSettingDefinitions().map((def) => [def.key, def.default]));
}

function isValidValue(def, value) {
  switch (def.type) {
    case 'range':
      return typeof value === 'number' && value >= def.min && value <= def.max;
    case 'toggle':
      return typeof value === 'boolean';
    case 'select':
      return def.options.some((option) => option.value === value);
    default:
      return typeof value === typeof def.default;
  }
}
