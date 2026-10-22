// Engine rules: burn cap, pop-time floors, Last Spark, reshuffle refund, snapshot of the spark state.
global.window = global;
for (const f of ['rng', 'board', 'config', 'boosters', 'director', 'engine']) require('../js/' + f + '.js');
const BR = global.BR, assert = require('assert');

// burn grows to stage 8 then stops
assert.strictEqual(BR.burnRate(1), 1);
assert(Math.abs(BR.burnRate(8) - Math.pow(BR.CFG.fuse.burnGrowth, 7)) < 1e-9);
assert.strictEqual(BR.burnRate(20), BR.burnRate(8), 'burn is capped');
// pop time floor from stage 6, never below base
assert.strictEqual(BR.popTime(2, 9), 0.8); assert(Math.abs(BR.popTime(3, 5) - 1.2) < 1e-9); assert.strictEqual(BR.popTime(3, 6), 1.4); assert(BR.popTime(8, 6) > 1.4);
// goals keep growing after the burn stops
assert(BR.stageGoal(12) > BR.stageGoal(8) * 4);

const bigPlan = (e, min) => { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && p.n >= min) return p; } return null; };
const smallPlan = (e) => { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && p.n <= 3) return p; } return null; };

// Last Spark: the fuse reaches zero once, the board holds, a pop of 4+ relights it, the second zero ends the run
for (let seed = 1; seed < 30; seed++) {
  const e = new BR.Engine({ seed, mode: 'rush' });
  e.fuse = 0.2; e.freeze = 0;
  let ev = []; for (let i = 0; i < 20 && !e.spark; i++) ev = ev.concat(e.tick(0.1));
  assert(ev.some((x) => x.type === 'spark') && e.spark > 0 && !e.over, 'spark starts instead of ending the run');
  const before = e.fuse; e.tick(1.0); assert.strictEqual(e.fuse, before, 'fuse does not burn during the spark'); assert(e.spark > 0 && e.spark < BR.CFG.fuse.spark);
  const p = bigPlan(e, 4); if (!p) continue;
  const res = e.commit(p);
  assert(res.sparkSave && e.fuse >= BR.CFG.fuse.sparkFuse && e.spark === 0 && !e.over, 'a pop of 4+ relights the fuse');
  assert.strictEqual(e.stats.sparkSaves, 1);
  // second time: no more sparks
  e.fuse = 0.1; const ev2 = []; for (let i = 0; i < 10 && !e.over; i++) ev2.push(...e.tick(0.1));
  assert(e.over && e.endReason === 'fuse' && ev2.some((x) => x.type === 'fuseOut'), 'the second zero ends the run');
  // snapshot remembers the spark was used
  const e2 = new BR.Engine({ seed, mode: 'rush', snapshot: Object.assign(e.snapshot(), {}) }); assert.strictEqual(e2.sparkUsed, true);
}
// the window runs out: the run ends
{
  const e = new BR.Engine({ seed: 3, mode: 'rush' }); e.fuse = 0.1; e.freeze = 0;
  const ev = []; for (let i = 0; i < 60 && !e.over; i++) ev.push(...e.tick(0.1));
  assert(e.over && ev.some((x) => x.type === 'spark') && ev.some((x) => x.type === 'fuseOut'), 'spark then fuse out');
}
// a small pop during the spark that pays time keeps the run alive without the 6s relight
{
  const e = new BR.Engine({ seed: 5, mode: 'rush' }); e.fuse = 0.1; e.freeze = 0; for (let i = 0; i < 5; i++) e.tick(0.1);
  assert(e.spark > 0); const p = smallPlan(e);
  if (p) { const res = e.commit(p); assert(!res.sparkSave && e.fuse > 0 && e.fuse < BR.CFG.fuse.sparkFuse && e.spark === 0 && !e.over); }
}
// fuse brick penalty can not push the fuse negative during a spark
{
  const e = new BR.Engine({ seed: 9, mode: 'rush' }); e.stage = 5; e.fuse = 0.1; e.freeze = 0; for (let i = 0; i < 5; i++) e.tick(0.1);
  e.board.grid[0][0].fb = 1; const p = bigPlan(e, 2); if (p) { e.commit(p); assert(e.fuse >= 0, 'fuse never negative'); }
}
// Chill ignores all of it
{ const e = new BR.Engine({ seed: 2, mode: 'chill' }); for (let i = 0; i < 50; i++) e.tick(1); assert(!e.over && e.spark === 0); }
// Rush Start boost
{ const e = new BR.Engine({ seed: 2, mode: 'rush', boosts: { rushStart: true } }); assert.strictEqual(e.rush.meter, 60); const f = new BR.Engine({ seed: 2, mode: 'rush', boosts: { longFuse: true } }); assert.strictEqual(f.fuseMax, 40); }
// a power-up during the Last Spark gives time, so the window ends and the run goes on (it used to die 2 s later with a full fuse)
{
  const e = new BR.Engine({ seed: 5, mode: 'rush', boosts: { headStart: true } });
  e.fuse = 0.05; let ev = []; for (let i = 0; i < 5 && !e.spark; i++) ev = ev.concat(e.tick(0.1));
  assert(e.spark > 0 && !e.over, 'spark running');
  const cell = { r: 3, c: 3 }; const res = e.applyBooster('hammer', cell.r, cell.c);
  assert(res && res.sparkEnd && e.spark === 0 && e.fuse > 0, 'power-up ends the spark and keeps the fuse');
  const f0 = e.fuse; for (let i = 0; i < 10; i++) e.tick(0.1);
  assert(!e.over && e.fuse < f0 && e.spark === 0, 'the fuse burns normally again after the power-up (no phantom spark window left to expire)');
}
// resume does not refill the fuse, but never starts below the grace
{
  const e = new BR.Engine({ seed: 6, mode: 'rush' }); e.fuse = 12;
  const r1 = new BR.Engine({ seed: 6, mode: 'rush', snapshot: e.snapshot() }); assert.strictEqual(r1.fuse, 12, 'resumed fuse is the saved fuse');
  e.fuse = 1.2; const r2 = new BR.Engine({ seed: 6, mode: 'rush', snapshot: e.snapshot() }); assert.strictEqual(r2.fuse, BR.CFG.fuse.resumeGrace, 'a nearly empty fuse resumes with a short grace');
  e.rush.meter = 33; const r3 = new BR.Engine({ seed: 6, mode: 'rush', boosts: { rushStart: true }, snapshot: e.snapshot() }); assert.strictEqual(r3.rush.meter, 33, 'Rush Start does not top the meter up again on resume');
}
// ---- Update 4: the first run is kind: the fuse waits for the first pop and burns 15% slower until stage 2
{
  const e = new BR.Engine({ seed: 11, mode: 'rush', waitFirstPop: true, gentle: true });
  const f0 = e.fuse; e.tick(5); assert.strictEqual(e.fuse, f0, 'the fuse waits for the first pop');
  let tap = null; for (let r = 0; r < 8 && !tap; r++) for (let c = 0; c < 8 && !tap; c++) { const p = e.plan(r, c); if (p) tap = p; }
  e.commit(tap); const f1 = e.fuse; e.tick(2);
  const plain = new BR.Engine({ seed: 11, mode: 'rush' }); plain.fuse = f1; const fp = plain.fuse; plain.tick(2);
  assert(f1 - e.fuse < fp - plain.fuse - 1e-9, 'a gentle first run burns slower');
  assert(Math.abs((f1 - e.fuse) / (fp - plain.fuse) - 0.85) < 0.02, 'about 85%');
}
console.log('engine rules ok');
