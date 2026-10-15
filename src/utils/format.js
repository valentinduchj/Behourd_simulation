import { currentLocale, getLanguage } from '../i18n/i18n.js';

export function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  return new Intl.DateTimeFormat(currentLocale(), { dateStyle: 'long', timeStyle: 'short' }).format(new Date(timestamp));
}

/**
 * « de » + nom de club avec contraction : « des Faucons de Dreux », « du Lion d'Or »,
 * « de la Mesnie de Caen », « de Rouen ».
 */
export function ofClub(name) {
  // Anglais : le nom seul (« Victory for Les Loups de Lille ») ; espagnol : « de » + nom.
  if (getLanguage() === 'en') return name;
  if (getLanguage() === 'es') return `de ${name}`;
  if (/^Les\s/.test(name)) return `des ${name.slice(4)}`;
  if (/^Le\s/.test(name)) return `du ${name.slice(3)}`;
  if (/^La\s/.test(name)) return `de la ${name.slice(3)}`;
  if (/^L[’']/.test(name)) return `de l’${name.slice(2)}`;
  return /^[AEIOUYÀÂÉÈÊÎÔÛ]/i.test(name) ? `d’${name}` : `de ${name}`;
}

/** Accord du verbe avec un nom de club : « Les Loups de Lille remportent », « Cerbères remporte ». */
export function clubVerb(name, singular, plural) {
  return /^Les\s/.test(name) ? plural : singular;
}

/** « aucun spectateur », « 1 spectateur », « 12 spectateurs ». */
export function crowdLabel(count) {
  if (getLanguage() === 'en') return count ? `${count} spectator${count > 1 ? 's' : ''}` : 'no spectators';
  if (getLanguage() === 'es') return count ? `${count} espectador${count > 1 ? 'es' : ''}` : 'ningún espectador';
  if (!count) return 'aucun spectateur';
  return `${count} spectateur${count > 1 ? 's' : ''}`;
}

/** Rang ordinal : « 1er » (« 1re » au féminin), « 2e », « 12e » ; « 1st » ; « 1.º ». */
export function ordinal(position, { feminine = false } = {}) {
  if (getLanguage() === 'en') {
    const tens = position % 100;
    const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[position % 10] ?? 'th');
    return `${position}${suffix}`;
  }
  if (getLanguage() === 'es') return `${position}.º`;
  return `${position}${position === 1 ? (feminine ? 're' : 'er') : 'e'}`;
}

export function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
