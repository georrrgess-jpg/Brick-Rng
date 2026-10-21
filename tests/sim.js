// Time-stepped simulation of Pop Rush: bots with human-like decision times play full runs.
// Checks board invariants every action and prints pacing numbers. Run: node tests/sim.js [quick]
global.window = global;
for (const f of ['rng', 'board', 'config', 'boosters', 'engine']) require('../js/' + f + '.js');
const BR = global.BR;
const QUICK = process.argv[2] === 'quick';

if (process.env.GROWTH) BR.CFG.stage.growth = +process.env.GROWTH;
if (process.env.BURN) BR.CFG.fuse.burnGrowth = +process.env.BURN;
if (process.env.POPBASE) BR.CFG.fuse.popBase = +process.env.POPBASE;
if (process.env.RGAIN) BR.CFG.rush.gainBase = +process.env.RGAIN;
if (process.env.RPER) BR.CFG.rush.gainPerExtra = +process.env.RPER;
if (process.env.RSTREAK) BR.CFG.rush.gainStreak = +process.env.RSTREAK;
if (process.env.MULT) BR.CFG.stage.multStep = +process.env.MULT;

function check(e, label) {
  const B = e.board, ids = new Set();
  for (let r = 0; r < B.rows; r++) for (let c = 0; c < B.cols; c++) {
    const b = B.grid[r][c];
    if (!b) throw new Error(label + ': hole at ' + r + ',' + c);
    if (ids.has(b.id)) throw new Error(label + ': dup id');
    ids.add(b.id);
    if (b.color < 0 || b.color >= B.colorCount) throw new Error(label + ': bad color ' + b.color + ' of ' + B.colorCount);
  }
  if (!B.hasMove(null)) throw new Error(label + ': no move');
  if (!Number.isFinite(e.score) || e.fuse < -1e-9 || e.fuse > e.fuseMax + 1e-9) throw new Error(label + ': bad score/fuse ' + e.score + ' ' + e.fuse);
}

function allTaps(e) {
  const out = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p) out.push(p); }
  return out;
}

/** skill: { think: mean seconds to choose a tap, lock: animation seconds per pop, greedy: 0..1, power: bool } */
function run(skill, seed, mode = 'rush') {
  const e = new BR.Engine({ seed, mode });
  const rng = BR.makeRng(seed ^ 0xabcdef);
  let guard = 0;
  const advance = (sec) => { for (let t = 0; t < sec && !e.over; t += 0.05) e.tick(Math.min(0.05, sec - t)); };
  while (!e.over && guard++ < 6000 && e.time < 1500) {
    // power-ups
    if (skill.power) {
      for (const t of BR.BOOSTER_ORDER) {
        if (e.inv[t] > 0 && !e.over) {
          let best = null, bn = 0;
          for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const n = e.boosterCells(t, r, c).length; if (n > bn) { bn = n; best = { r, c }; } }
          if (best && bn >= 7) { advance(skill.think * 0.6); if (e.over) break; const res = e.applyBooster(t, best.r, best.c); if (res) { check(e, 'power'); advance(skill.lock); } }
        }
      }
    }
    if (e.over) break;
    if (e.chill) {
      if (e.stageCleared()) { e.shatter(); e.nextRound(); continue; }
      if (e.movesLeft <= 0) { e.over = true; break; }
    }
    const taps = allTaps(e);
    if (!taps.length) throw new Error('no taps although hasMove');
    advance(Math.max(0.25, skill.think * (0.6 + rng.next() * 0.8)));
    if (e.over) break;
    const p = rng.chance(skill.greedy) ? taps.reduce((a, b) => (b.n > a.n || (b.n === a.n && b.points > a.points) ? b : a)) : rng.pick(taps);
    const res = e.commit(p);
    if (!res) break;
    check(e, 'pop');
    if (res.stageUp) advance(0.9); // stage wipe: fuse is frozen anyway
    advance(skill.lock);
  }
  const s = e.summary();
  return { stage: s.stage, time: s.time, score: s.score, rushes: s.rushes, pops: s.pops, bursts: e.stats.fuseBursts, defused: e.stats.defused, over: e.over };
}

const avg = (a, k) => (a.reduce((s, r) => s + r[k], 0) / a.length);
const N = QUICK ? 60 : 300;
const skills = {
  'casual  (1.8s, 40% smart)': { think: 1.8, lock: 0.5, greedy: 0.4, power: false },
  'average (1.2s, 80% smart)': { think: 1.2, lock: 0.5, greedy: 0.8, power: true },
  'sharp   (0.8s, 95% smart)': { think: 0.8, lock: 0.45, greedy: 0.95, power: true },
  'random  (0.5s, taps any) ': { think: 0.5, lock: 0.5, greedy: 0, power: false },
};
console.log('mode rush: stage reached / run seconds / rushes per run / fuse bricks burst vs defused');
for (const [name, sk] of Object.entries(skills)) {
  const runs = [];
  for (let s = 1; s <= N; s++) runs.push(run(sk, s * 7919));
  const stages = runs.map((r) => r.stage).sort((a, b) => a - b);
  console.log(name, 'stage avg', avg(runs, 'stage').toFixed(1), 'p10/p90', stages[Math.floor(N * 0.1)] + '/' + stages[Math.floor(N * 0.9)], '| time', avg(runs, 'time').toFixed(0) + 's', '| score', Math.round(avg(runs, 'score') / 1000) + 'k', '| rushes', avg(runs, 'rushes').toFixed(1), '| bursts/defused', avg(runs, 'bursts').toFixed(1) + '/' + avg(runs, 'defused').toFixed(1), '| all ended', runs.every((r) => r.over));
}
console.log('mode chill:');
{
  const runs = [];
  for (let s = 1; s <= N; s++) runs.push(run({ think: 1.0, lock: 0.5, greedy: 0.9, power: true }, s * 104729, 'chill'));
  console.log('  rounds avg', avg(runs, 'stage').toFixed(1), 'score', avg(runs, 'score').toFixed(0));
}
console.log('invariants held');
