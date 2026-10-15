import { h } from '../../utils/dom.js';
import { gameState } from '../../state/gameState.js';
import { getFighterTalents, getTalentRarity, getTalentStyle } from '../../systems/talents/TalentService.js';
import { getClimateSeason, getCurrentSeason } from '../../systems/climate/ClimateService.js';
import { t } from '../../i18n/i18n.js';

/**
 * Étiquette d'un talent, aux couleurs de sa famille (data/talents.js) : aucune règle ici, le
 * talent et ses couleurs viennent de TalentService.
 */
export function TalentBadge(talent, session = gameState.session) {
  const style = getTalentStyle(talent);
  const rarity = getTalentRarity(talent);
  // Talent saisonnier (v0.70) : icône de sa saison ; hors de sa saison, il reste affiché mais
  // estompé (« inactif en ce moment »).
  const season = talent.season && talent.season !== 'all' ? getClimateSeason(talent.season) : null;
  const now = session?.calendar ? getCurrentSeason(session) : null;
  const dormant = Boolean(season && now && now.id !== season.id);
  const seasonNote = season ? ` (actif en ${season.name.toLowerCase()}${now ? (dormant ? ` — inactif en ce moment : ${now.name.toLowerCase()}` : ' — actif en ce moment') : ''})` : '';
  return h(
    'span',
    {
      class: `badge talent-badge ${dormant ? 'is-dormant' : ''}`.trim(),
      'data-talent': talent.id,
      'data-rarity': rarity?.id ?? 'none',
      style: { '--talent-color': style.color, '--talent-text': style.text, '--talent-border': style.border },
      // Langue (v0.79) : description et note de saison traduites à part (texte assemblé).
      title: `Talent${rarity ? ` ${rarity.name.toLowerCase()}` : ''} — ${t(talent.description)}${t(seasonNote)}`,
    },
    talent.name,
    season ? h('span', { class: 'talent-season', 'aria-hidden': 'true' }, ` ${season.icon}`) : null,
  );
}

/**
 * Étiquettes des talents RÉVÉLÉS d'un combattant ; rien (liste vide) s'il n'en a pas : jamais
 * d'étiquette vide ni de mention « aucun talent ». session : partie en cours par défaut.
 */
export function TalentBadges(fighter, session = gameState.session) {
  return getFighterTalents(session, fighter).map((talent) => TalentBadge(talent, session));
}
