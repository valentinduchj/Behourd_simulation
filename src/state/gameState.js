// Partie courante (au plus une à la fois). Les écrans y accèdent via services.gameState.

let currentSession = null;
const listeners = new Set();

export const gameState = {
  get session() {
    return currentSession;
  },

  hasSession() {
    return currentSession !== null;
  },

  setSession(session) {
    currentSession = session;
    notify();
  },

  clear() {
    currentSession = null;
    notify();
  },

  onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

function notify() {
  for (const listener of listeners) listener(currentSession);
}
