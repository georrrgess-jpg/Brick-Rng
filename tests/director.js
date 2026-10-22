// How the board feels to play: bots of four skill levels play full Rush runs and we record, every turn, what the board offered
// (the biggest group, how many groups of 4+), how long the dry spells were (turns in a row with nothing of 4+), how often a big
// pop (8+) or a Line Blast came along, how often the board had to be reshuffled, and how far and how long the run went.
// With the tile director (js/director.js) this also checks its promises: boards are never dead, dry spells are short, a big pop
// comes round regularly, help rises when the fuse is low and falls when the player is cruising, Daily is the same for everyone,
// and everything is deterministic by seed.  Usage: node tests/director.js [quick]
global.window = global;
for (const f of ['rng', 'board', 'config', 'boosters', 'director', 'engine']) { try { require('../js/' + f + '.js'); } catch (e) { if (f !== 'director') throw e; } }
const BR = global.BR, assert = require('assert');
if (process.env.BURN) BR.CFG.fuse.burnGrowth = +process.env.BURN;
if (process.env.PPE) BR.CFG.fuse.popPerExtra = +process.env.PPE;
if (process.env.GROWTH) BR.CFG.stage.growth = +process.env.GROWTH;
const QUICK = process.argv[2] === 'quick';
const N = QUICK ? 40 : 160;

function offer(e) {
  const B = e.board, seen = new Uint8Array(64);
  let best = 0, n4 = 0, n3 = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (seen[r * 8 + c]) continue;
    const g = B.groupAt(r, c, null); g.forEach((p) => { seen[p.r * 8 + p.c] = 1; });
    if (g.length > best) best = g.length; if (g.length >= 4) n4++; if (g.length >= 3) n3++;
  }
  return { best, n4, n3 };
}

function run(sk, seed, extra = {}) {
  const e = new BR.Engine(Object.assign({ seed, mode: 'rush' }, extra));
  const rng = BR.makeRng(seed ^ 0x51ed);
  const advance = (sec) => { for (let t = 0; t < sec && !e.over; t += 0.05) e.tick(Math.min(0.05, sec - t)); };
  const m = { turns: 0, bestSum: 0, n4Sum: 0, dry: 0, dryMax: 0, dryRuns: [], pops: 0, big: 0, huge: 0, lines: 0, shuffles: 0, gapsBig: [], sinceBig: 0, pairsOnly: 0, assistLow: [], assistHigh: [] };
  let guard = 0;
  while (!e.over && guard++ < 4000 && e.time < 900) {
    const o = offer(e);
    m.turns++; m.bestSum += o.best; m.n4Sum += o.n4;
    if (o.best < 3) m.pairsOnly++;
    if (o.best < 4) { m.dry++; m.dryMax = Math.max(m.dryMax, m.dry); } else { if (m.dry) m.dryRuns.push(m.dry); m.dry = 0; }
    if (e.director) (e.fuse / e.fuseMax < 0.3 ? m.assistLow : m.assistHigh).push(e.director.assist());
    // choose a tap like a person of this skill: thinking time, then the biggest group with probability `greedy`
    const taps = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p) taps.push(p); }
    assert(taps.length, 'a board with no move');
    advance(e.spark > 0 ? 0.6 : Math.max(0.25, sk.think * (0.6 + rng.next() * 0.8)));
    if (e.over) break;
    const p = e.spark > 0 || rng.chance(sk.greedy) ? taps.reduce((a, b) => (b.n > a.n ? b : a)) : rng.pick(taps);
    const res = e.commit(p); if (!res) break;
    m.pops++;
    if (p.n >= 8) { m.big++; m.gapsBig.push(m.sinceBig); m.sinceBig = 0; } else m.sinceBig++;
    if (p.n >= 12) m.huge++;
    if (p.line) m.lines++;
    if (res.shuffle && res.shuffle.length) m.shuffles++;
    if (res.stageUp) advance(0.9);
    advance(sk.lock);
  }
  if (m.dry) m.dryRuns.push(m.dry);
  return Object.assign(m, { stage: e.stage, time: e.time, score: e.score, rushes: e.stats.rushes, over: e.over, e });
}

const skills = {
  casual: { think: 1.8, lock: 0.5, greedy: 0.4 },
  average: { think: 1.2, lock: 0.5, greedy: 0.8 },
  sharp: { think: 0.8, lock: 0.45, greedy: 0.95 },
  random: { think: 0.5, lock: 0.5, greedy: 0 },
};
const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0; };
const has = !!BR.Director;
console.log((has ? 'with the tile director' : 'without a tile director') + `, ${N} runs per bot`);
console.log('bot      best on offer  4+ groups  turns w/o a 4+ (mean run / p95 run / longest)  pairs-only  8+ every n pops  12+  lines  shuffles/run  stage  time   rushes');
const out = {};
for (const [k, sk] of Object.entries(skills)) {
  // a player's rating builds up over their runs: warm up from the starting rating the way the game does, then measure
  let rating = 0.4;
  if (has) for (let s = 1; s <= 30; s++) { const r = run(sk, 100003 * s, { skill: rating }); rating = BR.Director.rate(rating, { mode: 'rush', stage: r.stage }); }
  const rs = []; for (let s = 1; s <= N; s++) { const r = run(sk, s * 7919, has ? { skill: rating } : {}); rs.push(r); }
  out[k + 'Rating'] = rating;
  const T = rs.reduce((a, r) => a + r.turns, 0), P = rs.reduce((a, r) => a + r.pops, 0);
  const dryRuns = [].concat(...rs.map((r) => r.dryRuns));
  const o = out[k] = {
    best: rs.reduce((a, r) => a + r.bestSum, 0) / T, n4: rs.reduce((a, r) => a + r.n4Sum, 0) / T,
    dryMean: avg(dryRuns), dry95: pct(dryRuns, 0.95), dryMax: Math.max(...rs.map((r) => r.dryMax)),
    pairs: rs.reduce((a, r) => a + r.pairsOnly, 0) / T, bigEvery: P / Math.max(1, rs.reduce((a, r) => a + r.big, 0)),
    huge: rs.reduce((a, r) => a + r.huge, 0) / rs.length, lines: rs.reduce((a, r) => a + r.lines, 0) / rs.length,
    shuffles: rs.reduce((a, r) => a + r.shuffles, 0) / rs.length, stage: avg(rs.map((r) => r.stage)), time: avg(rs.map((r) => r.time)), rushes: avg(rs.map((r) => r.rushes)),
    gap95: pct([].concat(...rs.map((r) => r.gapsBig)), 0.95), timeMax: Math.max(...rs.map((r) => r.time)), allOver: rs.every((r) => r.over),
    assistLow: avg([].concat(...rs.map((r) => r.assistLow))), assistHigh: avg([].concat(...rs.map((r) => r.assistHigh))),
  };
  console.log(k.padEnd(8), o.best.toFixed(1).padStart(8), o.n4.toFixed(2).padStart(12), `${o.dryMean.toFixed(1)} / ${o.dry95} / ${o.dryMax}`.padStart(30), (100 * o.pairs).toFixed(1).padStart(22) + '%', o.bigEvery.toFixed(1).padStart(12), o.huge.toFixed(1).padStart(7), o.lines.toFixed(2).padStart(6), o.shuffles.toFixed(2).padStart(10), o.stage.toFixed(1).padStart(10), (o.time.toFixed(0) + 's').padStart(6), o.rushes.toFixed(1).padStart(6),
    has ? `  rating ${rating.toFixed(2)}, help when the fuse is low ${o.assistLow.toFixed(2)}, otherwise ${o.assistHigh.toFixed(2)}` : '');
}

if (has) {
  let problems = 0; const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };
  for (const [k, o] of Object.entries(out)) {
    if (k === 'random' || /Rating/.test(k)) continue;
    ok(o.pairs < 0.01, k, 'boards with nothing but pairs', o.pairs);
    ok(o.dry95 <= 2 && o.dryMax <= 4, k, 'dry spells too long', o.dry95, o.dryMax);
    ok(o.shuffles < 0.25, k, 'too many reshuffles', o.shuffles);
    ok(o.bigEvery <= 22, k, 'big pops too rare', o.bigEvery);
    ok(o.best < 11, k, 'the board hands out giant groups all the time (too easy)', o.best);
    ok(o.allOver && o.timeMax < 900, k, 'a run that never ends', o.timeMax);
  }
  // help rises as the fuse runs low, more in the Last Spark, after a dry spell, and less past the player's usual stage
  {
    const e = new BR.Engine({ seed: 3, mode: 'rush', skill: 0.5 }), d = e.director;
    e.fuse = e.fuseMax; const full = d.assist(); e.fuse = e.fuseMax * 0.1; const low = d.assist(); e.spark = 1; const spark = d.assist(); e.spark = 0;
    ok(low > full + 0.15 && spark > low, 'help does not rise with fuse pressure', full, low, spark);
    e.fuse = e.fuseMax; d.dry = 4; ok(d.assist() > full + 0.15, 'help does not rise after a dry spell'); d.dry = 0;
    e.stage = 12; ok(d.assist() < full, 'help does not taper past the usual stage');
    const weak = new BR.Engine({ seed: 3, mode: 'rush', skill: 0.1 }).director, strong = new BR.Engine({ seed: 3, mode: 'rush', skill: 0.9 }).director;
    ok(weak.assist() > strong.assist() + 0.1, 'a newer player does not get more help than a strong one');
    weak.e.stage = 4; ok(weak.assist() >= new BR.Engine({ seed: 3, mode: 'rush', skill: 0.1 }).director.assist(), 'a beginner loses help before stage 5');
  }
  ok(out.casual.stage < out.average.stage && out.average.stage < out.sharp.stage, 'skill no longer matters', out.casual.stage, out.average.stage, out.sharp.stage);
  // deterministic by seed and taps
  const a = run(skills.average, 4242, { skill: 0.5 }), b = run(skills.average, 4242, { skill: 0.5 });
  ok(a.score === b.score && a.turns === b.turns, 'not deterministic');
  // Daily: the same refills for every player whatever their skill rating, so the shared leaderboard stays fair
  const d1 = new BR.Engine({ seed: 77, mode: 'daily', skill: 0.05 }), d2 = new BR.Engine({ seed: 77, mode: 'daily', skill: 0.95 });
  ok(JSON.stringify(d1.board.grid.map((r) => r.map((x) => x.color))) === JSON.stringify(d2.board.grid.map((r) => r.map((x) => x.color))), 'Daily start differs by skill');
  for (let i = 0; i < 30 && !d1.over; i++) {
    const t = (e) => { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p) return p; } };
    d1.tick(i % 3 ? 0.6 : 0.1); d2.tick(0.2); d1.commit(t(d1)); d2.commit(t(d2));
  }
  ok(JSON.stringify(d1.board.grid.map((r) => r.map((x) => x.color))) === JSON.stringify(d2.board.grid.map((r) => r.map((x) => x.color))), 'Daily refills depend on the player');
  // the skill rating moves toward how far runs go, slowly, and stays in 0..1
  let s = 0.3; for (let i = 0; i < 30; i++) s = BR.Director.rate(s, { stage: 9, mode: 'rush', time: 200 });
  ok(s > 0.75 && s <= 1, 'skill does not rise for a strong player', s);
  for (let i = 0; i < 30; i++) s = BR.Director.rate(s, { stage: 1, mode: 'rush', time: 40 });
  ok(s < 0.2 && s >= 0, 'skill does not fall for a struggling player', s);
  ok(BR.Director.rate(0.5, { stage: 9, mode: 'daily' }) === 0.5 && BR.Director.rate(0.5, { stage: 9, mode: 'chill' }) === 0.5, 'Daily and Chill should not move the rating');
  // the first board of a run is readable: a real group to start with, never a flood
  for (let seed = 1; seed <= 200; seed++) { const e = new BR.Engine({ seed, mode: 'rush', skill: 0.5 }); const o = offer(e); ok(o.best >= 4 && o.best <= 9 && o.n3 >= 3, 'first board', seed, JSON.stringify(o)); if (problems > 5) break; }
  console.log(problems ? problems + ' PROBLEMS' : 'director ok');
  process.exit(problems ? 1 : 0);
}
