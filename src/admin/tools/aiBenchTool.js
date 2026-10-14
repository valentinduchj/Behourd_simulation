import { h } from '../../utils/dom.js';
import { AI_PROFILES } from '../../data/aiProfiles.js';
import { runAIBench, winRateMargin } from '../../systems/ai/AIBenchService.js';

// Module Admin › Banc d'essai IA : tournoi entre les 5 profils d'IA (data/aiProfiles.js), en
// combats complets simulés (systems/ai/AIBenchService.js). Aucune partie n'est touchée.

const pct = (value) => `${Math.round(value * 100)} %`;

function resultTable(result) {
  const { profiles, matrix, totals } = result;
  const cell = (i, j) => {
    if (i === j) return h('td', { class: 'bench-cell is-self' }, '—');
    const c = matrix[i][j];
    const rate = c.matches ? c.wins / c.matches : 0;
    const tone = rate >= 0.55 ? 'is-win' : rate <= 0.45 ? 'is-loss' : 'is-even';
    return h('td', { class: `bench-cell ${tone}`, title: `${c.wins} / ${c.matches} combats · manches ${c.roundsWon} / ${c.rounds}` }, pct(rate));
  };
  return h(
    'div',
    { class: 'bench-results' },
    h('table', { class: 'assign-table bench-matrix' },
      h('caption', {}, 'Taux de victoire du profil en ligne contre le profil en colonne'),
      h('thead', {}, h('tr', {}, h('th', {}, ''), profiles.map((p) => h('th', { title: p.summary }, `${p.rank}. ${p.name}`)))),
      h('tbody', {}, profiles.map((p, i) => h('tr', {}, h('th', { scope: 'row', title: p.summary }, `${p.rank}. ${p.name}`), profiles.map((_, j) => cell(i, j)))))),
    h('table', { class: 'assign-table bench-totals' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Profil'), h('th', { class: 'num' }, 'Victoires'), h('th', { class: 'num' }, 'Combats'), h('th', { class: 'num' }, 'Manches gagnées'), h('th', { class: 'num' }, 'Tours / manche'))),
      h('tbody', {}, profiles.map((p, i) => {
        const t = totals[i];
        return h('tr', {},
          h('td', {}, `${p.rank}. ${p.name}`),
          h('td', { class: 'num' }, `${pct(t.winRate)} ± ${Math.round(winRateMargin(t.wins, t.matches) * 100)}`),
          h('td', { class: 'num' }, `${t.wins} / ${t.matches}`),
          h('td', { class: 'num' }, `${t.roundsWon} / ${t.rounds}`),
          h('td', { class: 'num' }, t.avgTicks.toFixed(1)));
      }))),
  );
}

export const aiBenchTool = {
  id: 'ai-bench',
  label: 'Banc d’essai IA',
  description: 'Tournoi entre les profils d’IA de combat choisis, en combats complets simulés (composition, placement, manches, fatigue, KO). Aucune partie n’est modifiée.',
  status: 'ready',
  render() {
    const pairsInput = h('input', { class: 'input input-num', type: 'number', min: 1, max: 200, value: 20, id: 'bench-pairs', 'aria-label': 'Rencontres par duel' });
    const seedInput = h('input', { class: 'input', type: 'text', value: 'banc', id: 'bench-seed', 'aria-label': 'Graine' });
    const progress = h('progress', { class: 'bench-progress', max: 1, value: 0, hidden: true });
    const status = h('p', { class: 'muted bench-status' });
    const results = h('div', { class: 'bench-output' });
    const run = h('button', {
      type: 'button', class: 'btn btn-primary',
      onclick: async () => {
        const picked = [...run.closest('.ai-bench').querySelectorAll('.bench-pick:checked')].map((box) => box.value);
        if (picked.length < 2) {
          status.textContent = 'Choisissez au moins deux profils.';
          return;
        }
        const pairs = Math.max(1, Math.min(200, Math.round(Number(pairsInput.value) || 20)));
        pairsInput.value = pairs;
        run.disabled = true;
        progress.hidden = false;
        const started = performance.now();
        const duels = (picked.length * (picked.length - 1)) / 2;
        status.textContent = `Tournoi en cours : ${duels} duels × ${pairs} rencontres équitables (${duels * pairs * 2} combats)…`;
        try {
          const result = await runAIBench({
            profiles: picked, pairs, seed: seedInput.value || 'banc',
            onProgress: (done, total) => { progress.max = total; progress.value = done; },
          });
          const matches = result.totals.reduce((s, t) => s + t.matches, 0) / 2;
          status.textContent = `${matches} combats simulés en ${((performance.now() - started) / 1000).toFixed(1)} s. Même graine, mêmes résultats.`;
          results.replaceChildren(resultTable(result));
        } catch (error) {
          status.textContent = `Erreur : ${error.message}`;
        } finally {
          run.disabled = false;
          progress.hidden = true;
        }
      },
    }, 'Lancer le tournoi');
    return h(
      'div',
      { class: 'admin-tool-body ai-bench' },
      h('ul', { class: 'bench-profiles' }, AI_PROFILES.map((p) => h('li', {}, h('label', {}, h('input', { type: 'checkbox', class: 'bench-pick', value: p.id, checked: true }), ' ', h('strong', {}, p.name), ` — ${p.summary}`)))),
      h('div', { class: 'button-row bench-controls' },
        h('label', { class: 'field-label', for: 'bench-pairs' }, 'Rencontres par duel'), pairsInput,
        h('label', { class: 'field-label', for: 'bench-seed' }, 'Graine'), seedInput,
        run),
      h('p', { class: 'muted' }, 'Chaque rencontre se joue deux fois, effectifs échangés : seule la stratégie fait la différence. 20 rencontres ≈ 400 combats, ± 7 points d’incertitude par profil.'),
      progress,
      status,
      results,
    );
  },
};
