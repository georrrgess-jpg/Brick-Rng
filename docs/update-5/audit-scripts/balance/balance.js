// Balance census for the Update 5 plan. Usage: node balance.js <repo root> [N]
const ROOT = process.argv[2], N = +(process.argv[3] || 150);
global.window = global;
const fs = require('fs');
for (const f of ['rng', 'board', 'config', 'boosters', 'items', 'chests', 'pass', 'director', 'engine']) { const p = ROOT + '/js/' + f + '.js'; if (fs.existsSync(p)) require(p); }
const BR = global.BR;
const hasDir = !!BR.Director;
// XP for a run (copy of Progress.runXpRows, the version of the given root if it differs)
const xpFor = (s, isBest) => { let x = Math.floor(s.score / 600); for (let k = 1; k <= s.stagesCleared; k++) x += 20 + 4 * k; x += 10 * s.rushes + 10 * s.lineBlasts + 6 * s.bigPops; if (isBest) x += 80; return x; };
const C = BR.CFG.coin;
const coinsFor = (s) => { let st = 0; for (let k = 1; k <= Math.min(s.stagesCleared, C.stageCap); k++) st += C.stageStep * k; return Math.round(C.scale * Math.sqrt(s.score / C.ref)) + st; };

function run(sk, seed, mode, rating) {
  const e = new BR.Engine({ seed, mode, skill: rating });
  const rng = BR.makeRng(seed ^ 0xabcdef);
  const adv = (sec) => { for (let t = 0; t < sec && !e.over; t += 0.05) e.tick(Math.min(0.05, sec - t)); };
  const pw = { earned: 0, used: 0, bricks: { hammer: [], beam: [], prism: [] } };
  let g = 0, sparkStarts = 0, prevInv = 0;
  while (!e.over && g++ < 6000 && e.time < 1500) {
    if (sk.power) for (const t of BR.BOOSTER_ORDER) if (e.inv[t] > 0 && !e.over) {
      let best = null, bn = 0; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const n = e.boosterCells(t, r, c).length; if (n > bn) { bn = n; best = { r, c }; } }
      if (best && bn >= 7) { adv(sk.think * 0.6); if (e.over) break; const res = e.applyBooster(t, best.r, best.c); if (res) { pw.used++; pw.bricks[t].push(bn); adv(sk.lock); } }
    }
    if (e.over) break;
    if (e.chill) { if (e.stageCleared()) { e.shatter(); e.nextRound(); continue; } if (e.movesLeft <= 0) { e.over = true; break; } }
    const taps = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p) taps.push(p); }
    const sp = e.spark > 0;
    adv(sp ? 0.5 + rng.next() * sk.think * 0.5 : Math.max(0.25, sk.think * (0.6 + rng.next() * 0.8)));
    if (e.over) break;
    const p = sp || rng.chance(sk.greedy) ? taps.reduce((a, b) => (b.n > a.n || (b.n === a.n && b.points > a.points) ? b : a)) : rng.pick(taps);
    const res = e.commit(p); if (!res) break;
    if (res.spark) sparkStarts++;
    if (res.boostersGained) pw.earned += res.boostersGained.length;
    if (res.stageUp) adv(0.9); adv(sk.lock);
  }
  const s = e.summary(); s.sparkUsed = e.sparkUsed; s.pw = pw; s.bursts = e.stats.fuseBursts; s.mode = mode;
  return s;
}
const skills = {
  casual: { think: 1.8, lock: 0.5, greedy: 0.4, power: false },
  average: { think: 1.2, lock: 0.5, greedy: 0.8, power: true },
  sharp: { think: 0.8, lock: 0.45, greedy: 0.95, power: true },
};
const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const pctOf = (a, f) => Math.round(100 * a.filter(f).length / a.length);
const out = {};
for (const [k, sk] of Object.entries(skills)) {
  let rating = 0.4;
  if (hasDir) for (let s = 1; s <= 30; s++) rating = BR.Director.rate(rating, { mode: 'rush', stage: run(sk, 100003 * s, 'rush', rating).stage });
  const rs = []; for (let s = 1; s <= N; s++) rs.push(run(sk, s * 7919, 'rush', rating));
  const ds = []; for (let s = 1; s <= Math.round(N / 3); s++) ds.push(run(sk, BR.dailySeed('d2026-11-' + String(1 + (s % 28)).padStart(2, '0')), 'daily', rating));
  const cs = []; for (let s = 1; s <= Math.round(N / 3); s++) cs.push(run(Object.assign({}, sk, { think: 1.0 }), s * 104729, 'chill', rating));
  const xp = avg(rs.map((s) => xpFor(s, false)));
  const o = out[k] = {
    rating: +rating.toFixed(2), stage: +avg(rs.map((s) => s.stage)).toFixed(1), time: Math.round(avg(rs.map((s) => s.time))), score: Math.round(avg(rs.map((s) => s.score)) / 1000) + 'k',
    xpPerRun: Math.round(xp), coinsPerRun: Math.round(avg(rs.map(coinsFor))),
    passRunsFor30: Math.round((function () { let need = 0; for (let l = 1; l <= 30; l++) need += BR.xpForLevel(l); return need / (xp + 60 / 10); })()),
    rushes: +avg(rs.map((s) => s.rushes)).toFixed(1), sparkUsedPct: pctOf(rs, (s) => s.sparkUsed), sparkSavePct: pctOf(rs, (s) => s.sparkSaves > 0),
    lineBlasts: +avg(rs.map((s) => s.lineBlasts)).toFixed(2), bigPops10: +avg(rs.map((s) => s.bigPops)).toFixed(1), biggest: +avg(rs.map((s) => s.biggest)).toFixed(1), maxCombo: +avg(rs.map((s) => s.maxCombo)).toFixed(1),
    powerEarned: +avg(rs.map((s) => s.pw.earned)).toFixed(1), powerUsed: +avg(rs.map((s) => s.pw.used)).toFixed(1),
    powerBricks: Object.fromEntries(['hammer', 'beam', 'prism'].map((t) => [t, +avg([].concat(...rs.map((s) => s.pw.bricks[t]))).toFixed(1)])),
    fuseBursts: +avg(rs.map((s) => s.bursts)).toFixed(1), defused: +avg(rs.map((s) => s.defused)).toFixed(1),
    // missions: chance a single run meets a 'max' target, runs needed for a 'sum' target (middle tier)
    m_stage5: pctOf(rs, (s) => s.stage >= 5), m_stage6: pctOf(rs, (s) => s.stage >= 6), m_rush3: pctOf(rs, (s) => s.rushes >= 3), m_big10: pctOf(rs, (s) => s.biggest >= 10), m_big12: pctOf(rs, (s) => s.biggest >= 12),
    m_lines2_runs: +(2 / Math.max(0.01, avg(rs.map((s) => s.lineBlasts)))).toFixed(1), m_power5_runs: +(5 / Math.max(0.01, avg(rs.map((s) => s.powerUsed)))).toFixed(1), m_bricks250_runs: +(250 / avg(rs.map((s) => s.bricks))).toFixed(1),
    weeklyStage8: pctOf(rs, (s) => s.stage >= 8),
    // run goals (retention.js)
    g_line: pctOf(rs, (s) => s.lineBlasts >= 1), g_chain4: pctOf(rs, (s) => s.maxCombo >= 4), g_big12: pctOf(rs, (s) => s.biggest >= 12), g_rush2: pctOf(rs, (s) => s.rushes >= 2), g_defuse: pctOf(rs, (s) => (s.defused || 0) >= 1),
    trophy_stage10: pctOf(rs, (s) => s.stage >= 10), trophy_250k: pctOf(rs, (s) => s.score >= 250000),
    daily: { stage: +avg(ds.map((s) => s.stage)).toFixed(1), score: Math.round(avg(ds.map((s) => s.score)) / 1000) + 'k', m_daily120k: pctOf(ds, (s) => s.score >= 120000) },
    chill: { rounds: +avg(cs.map((s) => s.stage)).toFixed(1), score: Math.round(avg(cs.map((s) => s.score))) },
  };
}
console.log(JSON.stringify({ root: ROOT, director: hasDir, out }, null, 1));
