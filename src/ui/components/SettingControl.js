import { h } from '../../utils/dom.js';

/** Contrôle d'un réglage décrit dans data/settingsSchema.js. */
export function SettingControl(def, value, onChange) {
  const id = `setting-${def.key.replace(/[^a-z0-9]/gi, '-')}`;
  let control;
  let output = null;

  switch (def.type) {
    case 'range':
      output = h('output', { class: 'setting-output', for: id }, formatValue(def, value));
      control = h('input', {
        id, type: 'range', class: 'range', min: def.min, max: def.max, step: def.step ?? 1, value,
        oninput: (event) => {
          const next = Number(event.target.value);
          output.textContent = formatValue(def, next);
          onChange(next);
        },
      });
      break;
    case 'toggle':
      control = h('input', {
        id, type: 'checkbox', class: 'toggle', checked: Boolean(value),
        onchange: (event) => onChange(event.target.checked),
      });
      break;
    case 'select':
      control = h(
        'select',
        { id, class: 'select', onchange: (event) => onChange(def.options[event.target.selectedIndex].value) },
        def.options.map((option) =>
          h('option', { value: String(option.value), selected: option.value === value }, option.label)),
      );
      break;
    default:
      control = h('span', { class: 'muted' }, `Type « ${def.type} » non géré`);
  }

  return h(
    'div',
    { class: `setting-row ${def.planned ? 'is-planned' : ''}`.trim() },
    h(
      'div',
      { class: 'setting-text' },
      h('label', { class: 'setting-label', for: id }, def.label, def.planned ? h('span', { class: 'tag' }, 'à venir') : null),
      def.description ? h('p', { class: 'setting-description' }, def.description) : null,
    ),
    h('div', { class: 'setting-control' }, control, output),
  );
}

function formatValue(def, value) {
  return `${value}${def.unit ? ` ${def.unit}` : ''}`;
}
