// URL d'un fichier du projet (assets/, data/…) à partir de son chemin depuis la racine.
// Résolu par rapport à ce module : fonctionne quelle que soit la page qui l'importe.
export function assetUrl(path) {
  return new URL(`../../${path}`, import.meta.url).href;
}
