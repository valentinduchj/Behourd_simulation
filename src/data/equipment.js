// Emplacements d'équipement. Les objets (armes, armures) seront définis plus tard
// dans un catalogue dédié ; un emplacement vide vaut null.
export const EQUIPMENT_SLOTS = Object.freeze([
  { id: 'mainHand', label: 'Arme principale' },
  { id: 'offHand', label: 'Main secondaire' },
  { id: 'head', label: 'Tête' },
  { id: 'torso', label: 'Torse' },
  { id: 'arms', label: 'Bras' },
  { id: 'legs', label: 'Jambes' },
]);

export function createEmptyEquipment() {
  return Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot.id, null]));
}
