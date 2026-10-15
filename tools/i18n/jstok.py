"""Tokeniseur JS minimal : chaînes '…', "…" et gabarits `…${…}…`, en sautant les commentaires
et les expressions régulières littérales les plus courantes."""
BS = chr(92)


def tokens(src):
    i = 0
    n = len(src)
    out = []
    prev_sig = ''  # dernier caractère significatif (pour distinguer / division et / regex)
    while i < n:
        c = src[i]
        if src.startswith('//', i):
            j = src.find('\n', i)
            i = n if j < 0 else j
            continue
        if src.startswith('/*', i):
            j = src.find('*/', i + 2)
            i = n if j < 0 else j + 2
            continue
        if c == '/' and prev_sig in '(,=:[!&|?{};+-*%<>~^' :
            # regex littérale
            j = i + 1
            in_class = False
            while j < n:
                if src[j] == BS:
                    j += 2
                    continue
                if src[j] == '[':
                    in_class = True
                elif src[j] == ']':
                    in_class = False
                elif src[j] == '/' and not in_class:
                    break
                elif src[j] == '\n':
                    break
                j += 1
            j += 1
            while j < n and src[j].isalpha():
                j += 1
            i = j
            prev_sig = ')'
            continue
        if c in '\'"':
            j = i + 1
            buf = []
            while j < n and src[j] != c:
                if src[j] == BS:
                    buf.append(src[j:j + 2])
                    j += 2
                    continue
                buf.append(src[j])
                j += 1
            out.append({'kind': 's', 'text': ''.join(buf), 'start': i, 'end': j + 1})
            i = j + 1
            prev_sig = ')'
            continue
        if c == '`':
            j, parts, exprs = parse_template(src, i)
            out.append({'kind': 't', 'parts': parts, 'exprs': exprs, 'start': i, 'end': j})
            i = j
            prev_sig = ')'
            continue
        if not c.isspace():
            prev_sig = c if not (c.isalnum() or c in '_$') else 'a'
        i += 1
    return out


def parse_template(src, i):
    """Renvoie (fin, morceaux, expressions) d'un gabarit commençant à src[i] == '`'."""
    n = len(src)
    j = i + 1
    parts = ['']
    exprs = []
    while j < n and src[j] != '`':
        if src[j] == BS:
            parts[-1] += src[j:j + 2]
            j += 2
            continue
        if src.startswith('${', j):
            depth = 1
            k = j + 2
            while k < n and depth:
                ch = src[k]
                if ch == '`':
                    k, _, _ = parse_template(src, k)
                    continue
                if ch in '\'"':
                    m = k + 1
                    while m < n and src[m] != ch:
                        m += 2 if src[m] == BS else 1
                    k = m + 1
                    continue
                if ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                k += 1
            exprs.append(src[j + 2:k - 1])
            parts.append('')
            j = k
            continue
        parts[-1] += src[j]
        j += 1
    return j + 1, parts, exprs
