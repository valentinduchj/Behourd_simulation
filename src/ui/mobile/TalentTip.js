// Bulle d'info des talents (v0.88, téléphone) : sans souris, pas de survol. Toucher l'étiquette
// d'un talent (fiche d'un combattant, Compagnie, Taverne, combat…) affiche une bulle juste
// au-dessus : nom, famille et effet du talent. Un autre toucher, n'importe où, la referme.
// Le texte vient de l'infobulle de l'étiquette (TalentBadge, attribut title, déjà traduit).

const AUTO_HIDE_MS = 7000;
let tip = null;
let anchor = null;
let timer = null;

/** Découpe le texte d'infobulle « Talent rare — effet (saison) » en { kind, text }. */
export function parseTalentTitle(title = '') {
  const at = title.indexOf(' — ');
  if (at < 0) return { kind: '', text: title.trim() };
  return { kind: title.slice(0, at).trim(), text: title.slice(at + 3).trim() };
}

export function hideTalentTip() {
  clearTimeout(timer);
  tip?.remove();
  tip = null;
  anchor = null;
}

/** Affiche la bulle d'un talent au-dessus de son étiquette (en dessous s'il n'y a pas la place). */
export function showTalentTip(badge) {
  hideTalentTip();
  const title = badge.getAttribute('title') || badge.dataset.tip || '';
  // Le title reste sur l'étiquette (lecteurs d'écran) ; gardé aussi à part pour les retouches.
  badge.dataset.tip = title;
  const { kind, text } = parseTalentTitle(title);
  const name = badge.firstChild?.textContent?.trim() || badge.textContent.trim();
  tip = document.createElement('div');
  tip.className = 'talent-tip';
  tip.setAttribute('role', 'tooltip');
  tip.style.setProperty('--talent-color', badge.style.getPropertyValue('--talent-color') || '#6b5a44');
  const head = document.createElement('strong');
  head.className = 'talent-tip-name';
  head.textContent = name;
  const family = document.createElement('span');
  family.className = 'talent-tip-kind';
  family.textContent = kind;
  const body = document.createElement('p');
  body.className = 'talent-tip-text';
  body.textContent = text;
  tip.append(head, kind ? family : '', body);
  document.body.append(tip);
  anchor = badge;
  place(tip, badge);
  timer = setTimeout(hideTalentTip, AUTO_HIDE_MS);
  return tip;
}

function place(el, badge) {
  const margin = 8;
  const r = badge.getBoundingClientRect();
  const w = el.offsetWidth;
  const hgt = el.offsetHeight;
  const left = Math.max(margin, Math.min(window.innerWidth - w - margin, r.left + r.width / 2 - w / 2));
  const above = r.top - hgt - 8;
  const top = above >= margin ? above : Math.min(window.innerHeight - hgt - margin, r.bottom + 8);
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
  el.classList.toggle('is-below', above < margin);
  // Pointe de la bulle vers l'étiquette.
  el.style.setProperty('--tip-arrow', `${Math.round(r.left + r.width / 2 - left)}px`);
}

/**
 * Branche la bulle : un toucher sur une étiquette de talent l'ouvre (sans déclencher la carte
 * ou le bouton qui la contient) ; tout autre toucher, un défilement ou un changement d'écran la
 * referme. Renvoie la fonction de débranchement.
 */
export function installTalentTips(root = document) {
  const onClick = (event) => {
    const badge = event.target.closest?.('.talent-badge');
    if (!badge) {
      if (tip && !tip.contains(event.target)) hideTalentTip();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (anchor === badge) hideTalentTip();
    else showTalentTip(badge);
  };
  const onScroll = () => { if (tip) hideTalentTip(); };
  root.addEventListener('click', onClick, true);
  root.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
  return () => {
    root.removeEventListener('click', onClick, true);
    root.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onScroll);
    hideTalentTip();
  };
}
