import re
def unescape_js(s):
    BS = chr(92)
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        if c == BS and i + 1 < len(s):
            n = s[i + 1]
            if n == 'n': out.append(chr(10)); i += 2; continue
            if n == 't': out.append(chr(9)); i += 2; continue
            if n == 'u' and s[i+2:i+3] == '{':
                j = s.index('}', i); out.append(chr(int(s[i+3:j], 16))); i = j + 1; continue
            if n == 'u':
                out.append(chr(int(s[i+2:i+6], 16))); i += 6; continue
            out.append(n); i += 2; continue
        out.append(c); i += 1
    return ''.join(out)
