// Mini-constructeur DOM : évite innerHTML (les noms saisis par le joueur ne sont jamais
// interprétés comme du HTML).

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  appendChildren(el, children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value !== undefined && value !== null) el.setAttribute(key, String(value));
  }
  appendChildren(el, children);
  return el;
}

function applyProps(el, props) {
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      for (const [prop, propValue] of Object.entries(value)) {
        if (propValue === undefined || propValue === null) continue;
        if (prop.startsWith('--')) el.style.setProperty(prop, propValue);
        else el.style[prop] = propValue;
      }
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  }
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}
