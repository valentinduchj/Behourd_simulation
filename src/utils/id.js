// Identifiants uniques, préfixés par type d'entité (ex. "ftr_…", "team_…").
export function createId(prefix = 'id') {
  const random = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${random}`;
}
