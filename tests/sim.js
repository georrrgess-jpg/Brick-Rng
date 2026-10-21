// Headless engine simulation: invariants + balance for Rounds. Run: node tests/sim.js
global.window = global;
for (const f of ['rng', 'board', 'config', 'boosters', 'engine']) require('../js/' + f + '.js');
const BR = global.BR;

function check(e, label) {
  const B = e.board, ids = new Set();
  for (let r = 0; r < B.rows; r++) for (let c = 0; c < B.cols; c++) {
    const b = B.grid[r][c];
    if (!b) throw new Error(label + ': hole at ' + r + ',' + c);
    if (ids.has(b.id)) throw new Error(label + ': dup id');
    ids.add(b.id);
    if (b.color < 0 || b.color >= B.colorCount) throw new Error(label + ': bad color');
  }
  if (!B.hasMove(null)) throw new Error(label + ': no move');
  if (e.movesLeft < 0) throw new Error(label + ': negative moves');
  if (!Number.isFinite(e.score)) throw new Error(label + ': score NaN');
}

function allTaps(e) {
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p) out.push(p); }
  return out;
}

function run(policy, seed, maxRounds = 40) {
  const e = new BR.Engine({ seed });
  let boosters = 0, guard = 0;
  while (!e.over && guard++ < 4000) {
    // use boosters smartly when available (greedy bot only)
    if (policy !== 'random') {
      for (const t of BR.BOOSTER_ORDER) {
        if (e.inv[t] > 0 && e.movesLeft > 0) {
          let best = null, bn = 0;
          for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const n = e.boosterCells(t, r, c).length; if (n > bn) { bn = n; best = { r, c }; } }
          if (best && bn >= 8) { e.applyBooster(t, best.r, best.c); boosters++; check(e, 'booster'); }
        }
      }
    }
    if (e.roundCleared()) {
      e.shatter(); check(e, 'shatter');
      if (e.round >= maxRounds) break;
      e.nextRound();
      continue;
    }
    if (e.movesLeft <= 0) { e.over = true; break; }
    const taps = allTaps(e);
    if (!taps.length) throw new Error('no taps but hasMove');
    const p = policy === 'random' ? e.rng.pick(taps) : taps.reduce((a, b) => (b.points > a.points ? b : a));
    const res = e.commit(p);
    if (!res) throw new Error('commit null');
    check(e, policy + '#' + seed);
  }
  return { rounds: e.roundsCleared, score: e.score, pops: e.pops, boosters };
}

const avg = (a, k) => (a.reduce((s, r) => s + r[k], 0) / a.length).toFixed(1);
const dist = (a) => { const m = {}; a.forEach((r) => (m[r.rounds] = (m[r.rounds] || 0) + 1)); return Object.keys(m).sort((x, y) => x - y).map((k) => k + ':' + m[k]).join(' '); };
for (const policy of ['random', 'greedy']) {
  const runs = [];
  for (let s = 1; s <= 200; s++) runs.push(run(policy, s * 7919));
  console.log(policy.padEnd(8), 'roundsCleared avg', avg(runs, 'rounds').padStart(5), 'score', avg(runs, 'score').padStart(9), 'boosters', avg(runs, 'boosters'));
  console.log('         distribution (rounds:runs)', dist(runs));
}
console.log('goals', [1, 2, 3, 4, 5, 6, 8, 10, 12].map((r) => r + ':' + BR.goalFor(r)).join(' '));
console.log('invariants held');
