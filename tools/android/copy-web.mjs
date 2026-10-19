// Prépare le dossier www/ que Capacitor embarque dans l'application Android : une copie du jeu
// tel qu'il tourne dans le navigateur (index.html + assets, css, data, src), sans les tests, les
// outils, node_modules ni android/. Lancé par `npm run android:web` (et `npm run android:sync`).
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'www');
const ENTRIES = ['index.html', 'assets', 'css', 'data', 'src'];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const entry of ENTRIES) {
  const from = join(root, entry);
  if (!existsSync(from)) throw new Error(`copy-web : ${entry} introuvable`);
  cpSync(from, join(out, entry), { recursive: true });
}
console.log(`www/ prêt (${ENTRIES.join(', ')})`);
