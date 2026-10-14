import { h } from '../../utils/dom.js';

/** rows : [[libellé, valeur], …] */
export function DefinitionList(rows, { className = '' } = {}) {
  return h(
    'dl',
    { class: `definition-list ${className}`.trim() },
    rows.map(([label, value]) => h('div', { class: 'definition-row' }, h('dt', {}, label), h('dd', {}, value))),
  );
}
