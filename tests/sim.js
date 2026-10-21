// Headless engine simulation: invariants + balance numbers. Run: node tests/sim.js
global.window = global;
for (const f of ['rng', 'board', 'cores', 'engine']) require('../js/' + f + '.js');
const BR = global.BR;

function check(e, label) {
  const B = e.board;
  const ids = new Set();
  for (let r = 0; r < B.rows; r++) for (let c = 0; c < B.cols; c++) {
    const b = B.grid[r][c];
    if (!b) throw new Error(label + ': hole at ' + r + ',' + c);
    if (ids.has(b.id)) throw new Error(label + ': dup id');
    ids.add(b.id);
    if (b.color < 0 || b.color >= B.colorCount) throw new Error(label + ': bad color ' + b.color);
  }
  if (!B.hasMove(e.wild())) throw new Error(label + ': no move');
  if (e.fuel < 0 || e.fuel > BR.CFG.maxFuel) throw new Error(label + ': fuel ' + e.fuel);
  if (!Number.isFinite(e.score)) throw new Error(label + ': score NaN');
}

function allTaps(e) {
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p) out.push(p); }
  return out;
}

function run(policy, seed, forcedCore) {
  const e = new BR.Engine({ seed });
  const stats = { pops: 0, crates: 0, n: 0 };
  while (!e.over && stats.pops < 600) {
    const taps = allTaps(e);
    if (!taps.length) throw new Error('no taps but hasMove');
    let p;
    if (policy === 'random') p = e.rng.pick(taps);
    else if (policy === 'greedy' || policy === 'nocore') p = taps.reduce((a, b) => (b.points > a.points ? b : a));
    else p = taps.reduce((a, b) => (b.net * 1000 + b.points > a.net * 1000 + a.points ? b : a));
    const res = e.commit(p);
    if (!res) throw new Error('commit null');
    check(e, policy + '#' + seed + ' pop ' + stats.pops);
    stats.pops++; stats.n += p.n;
    while (e.takeCrate()) {
      stats.crates++;
      const core = forcedCore ? BR.coreById[forcedCore] : e.rollCrate();
      if (policy === 'nocore') e.scrap(core);
      else if (e.rng.chance(0.7)) e.equip(core); else e.scrap(core);
    }
    if (e.fuel <= 0) e.over = true;
  }
  return { score: e.score, pops: stats.pops, crates: stats.crates, avgN: stats.n / stats.pops, maxCombo: e.maxCombo, over: e.over };
}

function summarize(name, runs) {
  const avg = (k) => (runs.reduce((a, r) => a + r[k], 0) / runs.length).toFixed(1);
  console.log(name.padEnd(14), 'score', avg('score').padStart(8), 'pops', avg('pops').padStart(6), 'crates', avg('crates').padStart(5), 'avgGroup', avg('avgN'), 'ended', runs.filter((r) => r.over).length + '/' + runs.length);
}

for (const policy of ['random', 'greedy', 'nocore']) {
  const runs = [];
  for (let s = 1; s <= 120; s++) runs.push(run(policy, s * 7919));
  summarize(policy, runs);
}
console.log('--- per-core (greedy policy, core forced every crate) ---');
for (const core of BR.CORES) {
  const runs = [];
  for (let s = 1; s <= 40; s++) runs.push(run('greedy', s * 104729, core.id));
  summarize(core.id, runs);
}
console.log('invariants held for all runs');
