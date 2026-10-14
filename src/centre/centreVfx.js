import { getRewardType } from '../systems/activities/rewards.js';

// Effets visuels du Centre (présentation) : d'après le carnet de la journée, un gain flottant
// au-dessus de chaque combattant dont l'activité a réussi (« +1 LUT », « −25 FAT », « +10 deniers »).

/** [{ x, y, text, tone, fighterId }] pour les activités réussies (combattants présents dans la scène). */
export function gainEffectsFromReport(report, scene) {
  if (!report) return [];
  return report.ofType('activity.reward').flatMap((entry) => {
    const placement = scene.getPlacement(entry.fighterId);
    if (!placement) return [];
    const { reward } = entry;
    const text = getRewardType(reward.type).describe({ ...reward, min: undefined, max: undefined, amount: reward.amount });
    const tone = reward.type === 'resource' ? 'resource' : reward.stat === 'fatigue' ? 'fatigue' : 'stat';
    return [{ x: placement.x, y: placement.y, text, tone, fighterId: entry.fighterId }];
  });
}

/** Centre (au sol) de l'installation d'une activité, pour un effet de chantier. */
export function activityAnchor(scene, activityId) {
  const activity = scene.getActivity(activityId);
  if (!activity) return null;
  const { x, y, w, h } = activity.area;
  return { x: x + w / 2, y: y + h / 2 };
}
