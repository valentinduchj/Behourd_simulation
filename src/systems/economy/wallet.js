// Ressources du joueur (deniers aujourd'hui, d'autres ressources plus tard).

export function getResource(session, resource) {
  return session.player.resources[resource] ?? 0;
}

export function addResource(session, resource, amount) {
  session.player.resources[resource] = getResource(session, resource) + amount;
  session.markDirty();
  return amount;
}

export function canAfford(session, resource, amount) {
  return getResource(session, resource) >= amount;
}

/** Dépense si possible ; renvoie false sans rien modifier si le stock est insuffisant. */
export function spendResource(session, resource, amount) {
  if (!canAfford(session, resource, amount)) return false;
  session.player.resources[resource] = getResource(session, resource) - amount;
  session.markDirty();
  return true;
}

export const getDeniers = (session) => getResource(session, 'deniers');
