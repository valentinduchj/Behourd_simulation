"""Catalogue des textes français du jeu (src/**/*.js) : chaînes simples et gabarits (`…${x}…`
devient « …{0}… »). Écrit catalog.json : [{ fr, kind, files }]."""
import os, re, sys, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jstok import tokens
from unesc import unescape_js

root = sys.argv[1]
out_path = sys.argv[2]

SKIP_FILES = {
    os.path.normpath('src/data/names.js'),
    os.path.normpath('src/i18n/en.js'),
    os.path.normpath('src/i18n/es.js'),
    os.path.normpath('src/i18n/i18n.js'),
}
LETTER = re.compile(r"[A-Za-zÀ-ÿŒœ]")
ACCENT = re.compile(r"[À-ÿŒœ’«»]")
IDENT = re.compile(r"^[a-z][A-Za-z0-9_]*([.:/-][A-Za-z0-9_]+)*$")
CSSISH = re.compile(r"^[a-z0-9-]+( [a-z0-9-]+)*$")  # « btn btn-primary », « is-active »
CODEISH = re.compile(r"^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|M[0-9 .,-]|[0-9.]+(px|rem|em|%|s|ms|deg)?$|url\(|var\(|\.\.?/|https?:)")


def is_text(s):
    s2 = s.strip()
    if not s2 or not LETTER.search(s2):
        return False
    if CODEISH.search(s2):
        return False
    if IDENT.match(s2) and not ACCENT.search(s2):
        return False
    if CSSISH.match(s2) and not ACCENT.search(s2) and ' ' in s2:
        # classes CSS (« btn btn-sm ») : minuscules et tirets ; une vraie phrase a souvent d'autres signes
        words = s2.split()
        if all('-' in w or len(w) <= 3 for w in words) or any('-' in w for w in words):
            return False
    if re.match(r"^[a-z]+(-[a-z]+)+$", s2):
        return False
    # Une vraie phrase / un libellé : majuscule, espace, accent ou apostrophe typographique.
    return bool(s2[0].isupper() or ' ' in s2 or ACCENT.search(s2))


def walk(text_src, rel, found):
    for t in tokens(text_src):
        if t['kind'] == 's':
            if is_text(t['text']):
                found.append((unescape_js(t['text']), 'text', rel))
        else:
            parts = [unescape_js(p) for p in t['parts']]
            tmpl = ''.join(p + (f'{{{i}}}' if i < len(t['exprs']) else '') for i, p in enumerate(parts))
            literal = ''.join(parts)
            if t['exprs'] and is_text(literal):
                found.append((tmpl, 'tmpl', rel))
            elif not t['exprs'] and is_text(literal):
                found.append((literal, 'text', rel))
            for e in t['exprs']:
                walk(e, rel, found)


found = []
for d, _, fs in os.walk(os.path.join(root, 'src')):
    for f in fs:
        if not f.endswith('.js'):
            continue
        p = os.path.join(d, f)
        rel = os.path.normpath(os.path.relpath(p, root))
        if rel in SKIP_FILES:
            continue
        src = open(p, encoding='utf-8').read()
        # Patch Notes : seules les versions majeures sont affichées.
        if rel.endswith(os.path.normpath('data/patchNotes.js')):
            cut = src.find('export const PATCH_NOTES =')
            if cut > 0:
                src = src[:cut]
        # Lignes d'import / export from, console.* : jamais affichées.
        src = re.sub(r"^\s*(import|export)\b[^;]*from\s*'[^']*';", '', src, flags=re.M)
        src = re.sub(r"console\.(log|warn|error|info|debug)\([^;]*\);", '', src)
        walk(src, rel, found)

entries = collections.OrderedDict()
for text, kind, rel in found:
    key = (text, kind)
    if key not in entries:
        entries[key] = {'fr': text, 'kind': kind, 'files': []}
    if rel not in entries[key]['files']:
        entries[key]['files'].append(rel.replace(os.sep, '/'))
items = list(entries.values())
json.dump(items, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
words = sum(len(i['fr'].split()) for i in items)
print('entrées', len(items), 'gabarits', sum(1 for i in items if i['kind'] == 'tmpl'), 'mots', words)
by = collections.Counter(f for i in items for f in i['files'][:1])
for f, c in by.most_common(15):
    print(c, f)
