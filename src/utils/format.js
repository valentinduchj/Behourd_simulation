const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
});

export function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  return dateTimeFormatter.format(new Date(timestamp));
}

/**
 * « de » + nom de club avec contraction : « des Faucons de Dreux », « du Lion d'Or »,
 * « de la Mesnie de Caen », « de Rouen ».
 */
export function ofClub(name) {
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
  if (!count) return 'aucun spectateur';
  return `${count} spectateur${count > 1 ? 's' : ''}`;
}

/** Rang ordinal : « 1er », « 2e », « 12e ». */
export function ordinal(position) {
  return `${position}${position === 1 ? 'er' : 'e'}`;
}

export function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}
