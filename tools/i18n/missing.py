"""Phrases françaises du jeu pas encore traduites (anglais ou espagnol).

Usage (depuis la racine du jeu) :
    py -I tools/i18n/missing.py            → liste des phrases manquantes, avec leur fichier
    py -I tools/i18n/missing.py --json     → même chose en JSON (pour les traduire puis les ajouter)

Le catalogue est extrait du code (tools/i18n/extract.py) ; les dictionnaires sont src/i18n/en.js et
src/i18n/es.js ({ « texte français » : « traduction » }, une phrase à trous s'écrit avec {0}, {1}…).
Les noms propres (combattants, clubs, lieux…) sortent aussi : ils restent volontairement sans
traduction.
"""
import json, os, re, subprocess, sys, tempfile

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(os.path.dirname(here))


def load_dictionary(lang):
    text = open(os.path.join(root, 'src', 'i18n', f'{lang}.js'), encoding='utf-8').read()
    keys = set()
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith('"'):
            continue
        # « "clé": "valeur", » : la clé est la première chaîne JSON de la ligne.
        decoder = json.JSONDecoder()
        key, _ = decoder.raw_decode(line)
        keys.add(key)
    return keys


def main():
    out = os.path.join(tempfile.gettempdir(), 'behourd-catalog.json')
    subprocess.run([sys.executable, '-I', os.path.join(here, 'extract.py'), root, out], check=True, capture_output=True)
    catalog = json.load(open(out, encoding='utf-8'))
    en, es = load_dictionary('en'), load_dictionary('es')
    missing = [e for e in catalog if e['fr'] not in en or e['fr'] not in es]
    if '--json' in sys.argv:
        sys.stdout.reconfigure(encoding='utf-8')
        print(json.dumps([{'fr': e['fr'], 'files': e['files']} for e in missing], ensure_ascii=False, indent=1))
        return
    sys.stdout.reconfigure(encoding='utf-8')
    for e in missing:
        print(f"{e['files'][0]}\t{e['fr']}")
    print(f'{len(missing)} phrase(s) sans traduction complète (noms propres compris).')


if __name__ == '__main__':
    main()
