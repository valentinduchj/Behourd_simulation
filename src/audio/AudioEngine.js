import { MUSIC_TRACKS, AMBIENCES, SOUND_EFFECTS, AUDIO_RULES } from '../data/audio.js';

// Moteur sonore (v0.74, fichiers seulement depuis la v0.74.1) : Web Audio. Trois bus sous un
// volume général :
//   musique   — fichiers MP3 en boucle, fondus enchaînés (jamais coupés net) ;
//   ambiances — enregistrements en boucle (plusieurs couches par lieu) et sons ponctuels au
//               hasard, fondus eux aussi, toujours sous la musique ;
//   effets    — fichiers courts (plusieurs variantes par effet, tirées au hasard).
// Aucun son n'est synthétisé : une ambiance ou un effet sans fichier déclaré (data/audio.js) ne
// joue simplement rien.
// Le navigateur n'autorise souvent le son qu'après une action du joueur : le moteur essaie de
// démarrer dès l'ouverture du jeu, sinon il retient ce qu'il doit jouer et démarre au premier clic
// (ou à la première touche). Sans Web Audio (environnement de test…) : silence, sans erreur.

const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext ?? window.webkitAudioContext) : null;
const rand = (min, max) => min + Math.random() * (max - min);

/**
 * Niveau de chaque bus (0 à 1) d'après les Options : { master, music, ambience, sfx }. Les
 * ambiances ont un plafond (AUDIO_RULES.ambienceCeiling) et baissent encore tant qu'une musique
 * joue : elles ne prennent jamais le pas sur elle.
 */
export function busLevels(get, { musicPlaying = false } = {}) {
  const pct = (key, fallback) => {
    const value = get(key);
    return Math.max(0, Math.min(100, Number(value === undefined || value === null ? fallback : value))) / 100;
  };
  return {
    master: get('audio.muted') ? 0 : pct('audio.master', 80),
    music: pct('audio.music', 70),
    ambience: pct('audio.ambience', 60) * AUDIO_RULES.ambienceCeiling * (musicPlaying ? AUDIO_RULES.ambienceUnderMusic : 1),
    sfx: pct('audio.sfx', 80),
  };
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.settings = null;
    this.unlocked = false;
    this.loops = new Map(); // 'music:id' | 'ambience:id' → { id, el, gain, volume, timer }
    this.tracks = new Map(); // musiques seulement (compatibilité : id → boucle)
    this.musicId = null; // musique voulue
    this.ambienceId = null; // ambiance voulue
    this.ambienceSeason = null;
    this.ambience = null; // ambiance en cours : { id, gain, layers: [{ file, source }], timers }
    this.buffers = new Map(); // fichier d'effet → AudioBuffer (ou promesse)
    this.lastHitAt = [];
  }

  // --- Mise en place ---

  /** Branche les Options (volumes, fondu), tente de démarrer tout de suite, sinon au premier clic. */
  attach(settings) {
    this.settings = settings;
    settings.onChange((key) => { if (key.startsWith('audio.')) this.applyVolumes(); });
    if (typeof document !== 'undefined') {
      const unlock = () => this.unlock();
      for (const type of ['pointerdown', 'keydown', 'touchstart']) document.addEventListener(type, unlock, { capture: true });
    }
  }

  /**
   * Ouverture du jeu : essaie de démarrer le son sans attendre de clic (accepté par certains
   * navigateurs). Refusé : rien ne se passe, le premier clic s'en chargera.
   */
  tryAutoplay() {
    if (!this.#ensureContext()) return;
    this.ctx.resume().then(() => { if (this.ctx.state === 'running') this.unlock(); }).catch(() => {});
  }

  #ensureContext() {
    if (this.ctx || !AudioContextClass) return this.ctx;
    try {
      this.ctx = new AudioContextClass();
    } catch {
      return null;
    }
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.ambienceBus = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    for (const b of [this.musicBus, this.ambienceBus, this.sfxBus]) b.connect(this.master);
    this.applyVolumes();
    return this.ctx;
  }

  /** Le son démarre (premier clic, ou ouverture si le navigateur l'accepte). */
  unlock() {
    if (!this.#ensureContext()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (this.unlocked) return;
    this.unlocked = true;
    this.preloadEffects();
    const music = this.musicId;
    this.musicId = null;
    this.setMusic(music);
    const ambience = this.ambienceId;
    this.ambienceId = null;
    this.setAmbience(ambience, { season: this.ambienceSeason });
  }

  #setting(key, fallback) {
    const value = this.settings?.get(key);
    return value === undefined || value === null ? fallback : value;
  }

  get crossfadeSeconds() {
    return Number(this.#setting('audio.crossfade', AUDIO_RULES.crossfadeSeconds)) || AUDIO_RULES.crossfadeSeconds;
  }

  /** Volumes des bus d'après les Options ; les ambiances restent toujours sous la musique. */
  applyVolumes() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const set = (param, value) => { param.cancelScheduledValues(now); param.setTargetAtTime(value, now, 0.08); };
    const levels = busLevels((key) => this.settings?.get(key), { musicPlaying: Boolean(this.musicId) });
    this.levels = levels;
    set(this.master.gain, levels.master);
    set(this.musicBus.gain, levels.music);
    set(this.ambienceBus.gain, levels.ambience);
    set(this.sfxBus.gain, levels.sfx);
  }

  // --- Boucles (musiques et ambiances) : fondus enchaînés ---

  #loop(kind, id) {
    const key = `${kind}:${id}`;
    if (this.loops.has(key)) return this.loops.get(key);
    const def = MUSIC_TRACKS[id];
    const file = def?.file;
    if (!file || !this.ctx) return null;
    const el = new Audio(file);
    el.loop = true;
    el.preload = 'auto';
    const source = this.ctx.createMediaElementSource(el);
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(kind === 'music' ? this.musicBus : this.ambienceBus);
    const loop = { id, kind, el, gain, volume: def.volume ?? 1, timer: null };
    this.loops.set(key, loop);
    if (kind === 'music') this.tracks.set(id, loop);
    return loop;
  }

  /** Fondu : `wantedId` monte (et reprend où il s'était arrêté), les autres boucles du même genre s'éteignent. */
  #crossfade(kind, wantedId, fade) {
    const now = this.ctx.currentTime;
    for (const loop of this.loops.values()) {
      if (loop.kind !== kind || loop.id === wantedId) continue;
      const g = loop.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + fade);
      clearTimeout(loop.timer);
      // Pause seulement une fois le fondu terminé : jamais d'arrêt net.
      loop.timer = setTimeout(() => {
        const current = kind === 'music' ? this.musicId : this.ambienceId;
        if (current !== loop.id) loop.el.pause();
      }, fade * 1000 + 120);
    }
    if (!wantedId) return;
    const loop = this.#loop(kind, wantedId);
    if (!loop) return;
    clearTimeout(loop.timer);
    loop.el.play().catch(() => {});
    const g = loop.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(loop.volume, now + fade);
  }

  /** Musique à jouer (identifiant de MUSIC_TRACKS, ou null : silence en fondu). */
  setMusic(id) {
    if (id === this.musicId) return;
    this.musicId = id ?? null;
    if (!this.unlocked || !this.ctx) return;
    this.#crossfade('music', this.musicId, this.crossfadeSeconds);
    this.applyVolumes();
  }

  /**
   * Ambiance à jouer (identifiant de AMBIENCES, ou null). Une ambiance mêle plusieurs boucles
   * (layers) et des sons ponctuels joués au hasard (oneShots) ; en hiver, ses couches d'hiver
   * (winterLayers) remplacent les autres. Fondu d'une ambiance à l'autre ; sans fichier : silence.
   */
  setAmbience(id, { season = null } = {}) {
    const same = id === this.ambienceId && season === this.ambienceSeason;
    this.ambienceId = id ?? null;
    this.ambienceSeason = season;
    if (same || !this.unlocked || !this.ctx) return;
    const fade = AUDIO_RULES.ambienceFadeSeconds;
    const now = this.ctx.currentTime;
    if (this.ambience) {
      const old = this.ambience;
      old.timers.forEach(clearTimeout);
      old.timers.length = 0;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + fade);
      // Arrêt une fois le fondu terminé : jamais d'arrêt net.
      setTimeout(() => { old.layers.forEach((layer) => { try { layer.source.stop(); } catch { /* déjà arrêtée */ } }); old.gain.disconnect(); }, fade * 1000 + 150);
      this.ambience = null;
    }
    const def = AMBIENCES[this.ambienceId];
    const layers = (season === 'winter' && def?.winterLayers) || def?.layers || [];
    if (!def || (!layers.length && !def.oneShots?.length)) return;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(def.volume ?? 1, now + fade);
    gain.connect(this.ambienceBus);
    const ambience = { id: this.ambienceId, gain, layers: [], timers: [] };
    for (const layer of layers) {
      // Boucle décodée (sans le petit blanc d'une balise <audio> qui reboucle), qui part d'un
      // endroit au hasard : deux visites ne sonnent pas pareil. Libérée en quittant le lieu.
      const level = this.ctx.createGain();
      level.gain.value = layer.volume ?? 1;
      level.connect(gain);
      this.#decode(layer.file).then((buffer) => {
        if (!buffer || this.ambience !== ambience) return;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(level);
        source.start(0, Math.random() * buffer.duration);
        ambience.layers.push({ file: layer.file, source });
      });
    }
    for (const shot of def.oneShots ?? []) {
      const [min, max] = shot.every ?? [10, 20];
      const schedule = () => {
        const timer = setTimeout(() => {
          if (this.ambience !== ambience) return;
          const file = shot.files[Math.floor(Math.random() * shot.files.length)];
          this.#playBuffer(file, { volume: shot.volume ?? 1, pitchJitter: shot.pitchJitter ?? 0, out: gain });
          schedule();
        }, rand(min, max) * 1000);
        ambience.timers.push(timer);
      };
      shot.files.forEach((file) => this.#buffer(file));
      schedule();
    }
    this.ambience = ambience;
  }

  // --- Effets (fichiers courts) ---

  #buffer(file) {
    if (this.buffers.has(file)) return this.buffers.get(file);
    const pending = fetch(file)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(file))))
      .then((data) => this.ctx.decodeAudioData(data))
      .then((buffer) => { this.buffers.set(file, buffer); return buffer; })
      .catch(() => { this.buffers.set(file, null); return null; });
    this.buffers.set(file, pending);
    return pending;
  }

  /** Décode un fichier sans le garder en mémoire (boucles d'ambiance : lourdes une fois décodées). */
  #decode(file) {
    return fetch(file)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(file))))
      .then((data) => this.ctx.decodeAudioData(data))
      .catch(() => null);
  }

  /** Précharge les effets (au déblocage), pour qu'ils partent à l'instant voulu. */
  preloadEffects() {
    if (!this.ctx) return;
    for (const def of Object.values(SOUND_EFFECTS)) for (const file of def.files ?? []) this.#buffer(file);
  }

  /** Joue un fichier court (tampon décodé) dans `out` (bus des effets par défaut). */
  #playBuffer(file, { volume = 1, pitchJitter = 0, out = this.sfxBus, maxSeconds = null } = {}) {
    const start = (buffer) => {
      if (!buffer || !this.ctx) return;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = pitchJitter ? rand(1 - pitchJitter, 1 + pitchJitter) : 1;
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain).connect(out);
      source.start();
      if (maxSeconds) {
        const t = this.ctx.currentTime;
        gain.gain.setValueAtTime(volume, t + Math.max(0, maxSeconds - 1));
        gain.gain.linearRampToValueAtTime(0, t + maxSeconds);
        source.stop(t + maxSeconds + 0.05);
      }
    };
    const cached = this.buffers.get(file);
    if (cached && !(cached instanceof Promise)) start(cached);
    else this.#buffer(file).then(start);
  }

  /**
   * Joue un effet (SOUND_EFFECTS) : une variante au hasard, légèrement transposée.
   * `intensity` (0 à 1) module le volume. Renvoie false si rien n'a été joué.
   */
  play(effect, { intensity = 1 } = {}) {
    const def = SOUND_EFFECTS[effect];
    if (!this.unlocked || !this.ctx || !def?.files?.length) return false;
    if (def.throttle) {
      const now = performance.now();
      this.lastHitAt = this.lastHitAt.filter((t) => now - t < 1000);
      if (this.lastHitAt.length >= AUDIO_RULES.maxHitsPerSecond) return false;
      this.lastHitAt.push(now);
    }
    const file = def.files[Math.floor(Math.random() * def.files.length)];
    this.#playBuffer(file, { volume: (def.volume ?? 1) * Math.max(0.3, Math.min(1, intensity)), pitchJitter: def.pitchJitter ?? 0, maxSeconds: def.maxSeconds ?? null });
    return true;
  }

  /** État (tests, Options) : ce qui est voulu et ce qui joue. */
  get state() {
    return { unlocked: this.unlocked, music: this.musicId, ambience: this.ambienceId, playingAmbience: this.ambience?.id ?? null };
  }
}

/** Le moteur sonore du jeu (un seul). */
export const audio = new AudioEngine();
