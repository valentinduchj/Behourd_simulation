// Retour vibrant (v0.93, application Android) : une courte vibration confirme les gestes qui
// comptent — cocher un combattant, lancer une manche, gagner, buter sur une limite (8 / 8).
// Plugin Capacitor Haptics dans l'application ; dans un navigateur de téléphone, l'API vibrate
// si elle existe ; ailleurs (ordinateur), rien. Le son coupé (Options) ne coupe pas les
// vibrations : ce sont deux choses distinctes.

const PATTERNS = Object.freeze({
  tap: { impact: 'LIGHT', ms: 12 },
  select: { impact: 'MEDIUM', ms: 18 },
  heavy: { impact: 'HEAVY', ms: 35 },
  success: { notification: 'SUCCESS', ms: [20, 60, 30] },
  warning: { notification: 'WARNING', ms: [30, 50, 30] },
});

let enabled = true;
let lastKind = null;

/** Vibrations actives ou non (désactivées sur ordinateur : l'interface mobile les allume). */
export function setHapticsEnabled(value) {
  enabled = Boolean(value);
}

/** Dernière vibration demandée (essais). */
export function lastHaptic() {
  return lastKind;
}

function plugin() {
  const capacitor = globalThis.Capacitor;
  if (!capacitor?.isNativePlatform?.()) return null;
  return capacitor.Plugins?.Haptics ?? null;
}

/** Une vibration : 'tap', 'select', 'heavy', 'success' ou 'warning'. */
export function haptic(kind = 'tap') {
  const pattern = PATTERNS[kind];
  if (!enabled || !pattern) return false;
  lastKind = kind;
  try {
    const native = plugin();
    if (native) {
      const done = pattern.notification ? native.notification?.({ type: pattern.notification }) : native.impact?.({ style: pattern.impact });
      done?.catch?.(() => {});
      return true;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern.ms);
      return true;
    }
  } catch { /* vibration indisponible : sans effet */ }
  return false;
}
