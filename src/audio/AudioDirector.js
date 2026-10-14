import { SCREEN_AUDIO, DEFAULT_SCREEN_AUDIO, MOMENT_MUSIC, AUDIO_RULES } from '../data/audio.js';
import { getCurrentSeason } from '../systems/climate/ClimateService.js';
import { audio } from './AudioEngine.js';

// Aiguillage du son selon l'écran et les moments du jeu (v0.74). Les écrans ne choisissent jamais
// une musique : ils annoncent un moment (« la manche se lance », « le combat est fini ») et les
// données (data/audio.js) disent ce qu'on entend.
//
// Règles :
//   - chaque lieu a sa musique et son ambiance (SCREEN_AUDIO) ; 'keep' garde la musique en cours ;
//   - la musique de combat ne vit que dans le combat : en quittant l'écran de combat (ou à la fin
//     d'un combat d'entraînement), on revient en fondu à la musique du dernier lieu ;
//   - jamais de coupure nette : tout passe par les fondus du moteur.

const HOME_MUSIC = 'taverne';

export class AudioDirector {
  constructor(engine = audio, { sessionOf = () => null } = {}) {
    this.engine = engine;
    this.sessionOf = sessionOf;
    this.placeMusic = null; // musique du dernier lieu visité
    this.moment = null; // moment en cours ('roundStart'…)
    this.screenId = null;
  }

  #season() {
    const session = this.sessionOf();
    try { return session?.calendar ? getCurrentSeason(session).id : null; } catch { return null; }
  }

  /** Nouvel écran : sa musique et son ambiance. */
  onScreen(id, params = {}) {
    this.screenId = id;
    const config = SCREEN_AUDIO[id] ?? DEFAULT_SCREEN_AUDIO;
    let ambience = config.ambience;
    // Combat de Coupe de France : la grande foule du Château de Gabarnac.
    if (id === 'match' && params?.cupMatchId) ambience = SCREEN_AUDIO['french-cup'].ambience;
    // Un moment (combat) ne survit pas à son écran.
    if (this.moment && id !== 'match') this.moment = null;
    if (config.music && config.music !== 'keep') {
      this.placeMusic = config.music;
      this.engine.setMusic(config.music);
    } else if (config.music === null) {
      this.engine.setMusic(null);
    } else if (this.engine.musicId === MOMENT_MUSIC.roundStart && !this.moment) {
      // On sort d'un combat vers un écran sans musique propre : retour à celle du dernier lieu.
      this.engine.setMusic(this.placeMusic ?? HOME_MUSIC);
    }
    this.engine.setAmbience(ambience, { season: this.#season() });
  }

  /** Un moment du jeu : 'roundStart' (une manche se lance). */
  startMoment(moment) {
    const music = MOMENT_MUSIC[moment];
    if (!music) return;
    this.moment = moment;
    this.engine.setMusic(music);
  }

  /** Fin du moment (combat d'entraînement terminé…) : retour à la musique du lieu. */
  endMoment() {
    if (!this.moment) return;
    this.moment = null;
    const config = SCREEN_AUDIO[this.screenId] ?? DEFAULT_SCREEN_AUDIO;
    const music = config.music && config.music !== 'keep' ? config.music : (this.placeMusic ?? HOME_MUSIC);
    this.engine.setMusic(music);
  }

  /** Effet sonore (raccourci). */
  play(effect, options) {
    return this.engine.play(effect, options);
  }
}

/** L'aiguilleur du jeu (installé au démarrage, main.js). */
export const audioDirector = new AudioDirector();

/** Indices d'effets sonores d'un rejeu de manche : [{ time (s, intro comprise), effect, intensity }]. */
export function buildCombatCues(playback, { bigHitDamage = AUDIO_RULES.bigHitDamage } = {}) {
  const cues = [];
  const intro = playback.introSeconds ?? 0;
  const step = playback.tickSeconds;
  playback.byTick.forEach((bucket, tick) => {
    if (!tick) return;
    bucket.attacks.forEach((attack, i) => {
      const time = intro + (tick - 1 + 0.5 + (0.5 * i) / bucket.attacks.length) * step;
      const effect = attack.hpAfter <= 0 ? 'ko' : attack.damage >= bigHitDamage ? 'bigHit' : 'hit';
      cues.push({ time, effect, intensity: Math.min(1, 0.4 + (attack.damage ?? 0) / 40) });
    });
  });
  return cues.sort((a, b) => a.time - b.time);
}

/**
 * Joue les indices passés entre deux instants du rejeu. Un saut (« Passer à la fin », vitesse
 * élevée) ne déclenche pas une avalanche de sons : au-delà de `maxJump` secondes, rien ne joue.
 */
export function playCombatCues(cues, from, to, { director = audioDirector, maxJump = 1.2 } = {}) {
  if (!cues?.length || to <= from || to - from > maxJump) return 0;
  let played = 0;
  for (const cue of cues) {
    if (cue.time <= from) continue;
    if (cue.time > to) break;
    if (director.play(cue.effect, { intensity: cue.intensity })) played += 1;
  }
  return played;
}
