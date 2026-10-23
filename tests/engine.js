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
  e.fuse = 1.2; const r2 = new BR.Engine({ seed: 6, mode: 'rush', snapshot: e.snapshot() }); assert.strictEqual(r2.fuse, 1.2, 'a nearly empty fuse resumes as it was (no top-up)');
  // Update 7: the clock waits for the first pop after a resume, then burns as usual
  r2.tick(5); assert.strictEqual(r2.fuse, 1.2, 'the fuse holds until the first pop after a resume');
  { const g = r2.bestGroup(); r2.commit(r2.plan(g[0].r, g[0].c)); const f = r2.fuse; r2.tick(0.5); assert(r2.fuse < f, 'after a pop the fuse burns again'); }
  // Update 7: Save and leave during the Last Spark comes back in the Last Spark, not with a relit fuse
  { const ls = new BR.Engine({ seed: 9, mode: 'rush' }); ls.fuse = 0.05; let ev = []; for (let i = 0; i < 5 && !ls.spark; i++) ev = ev.concat(ls.tick(0.1));
    assert(ls.spark > 0 && ls.fuse === 0, 'in the Last Spark');
    const rs = new BR.Engine({ seed: 9, mode: 'rush', snapshot: JSON.parse(JSON.stringify(ls.snapshot())) });
    assert.strictEqual(rs.fuse, 0, 'no free fuse after resuming in the Last Spark'); assert(rs.spark > 0 && rs.sparkUsed, 'still in the Last Spark');
    const old = JSON.parse(JSON.stringify(ls.snapshot())); delete old.spark; old.v = 2;
    const ro = new BR.Engine({ seed: 9, mode: 'rush', snapshot: old }); assert(ro.fuse === 0 && ro.spark > 0, 'an Update 6 save made in the Last Spark resumes in it'); }
  // Update 7: a resumed Daily continues the same board sequence as an unbroken one
  { const mk = () => new BR.Engine({ seed: 77, mode: 'daily' }); const a = mk(), b = mk();
    const step = (e) => { const g = e.bestGroup(); e.commit(e.plan(g[0].r, g[0].c)); };
    for (let i = 0; i < 6; i++) { step(a); step(b); }
    const rb = new BR.Engine({ seed: 77, mode: 'daily', snapshot: JSON.parse(JSON.stringify(b.snapshot())) });
    for (let i = 0; i < 6; i++) { step(a); step(rb); }
    assert.strictEqual(JSON.stringify(rb.board.grid.map((r) => r.map((x) => x.color))), JSON.stringify(a.board.grid.map((r) => r.map((x) => x.color))), 'a resumed Daily is still the same board as everyone else'); }
  // Update 7: Chill counts the run's length (the results showed 0:00)
  { const ch = new BR.Engine({ seed: 4, mode: 'chill' }); const g = ch.bestGroup(); ch.commit(ch.plan(g[0].r, g[0].c)); const left = ch.movesLeft;
    const rc = new BR.Engine({ seed: 4, mode: 'chill', snapshot: JSON.parse(JSON.stringify(ch.snapshot())) });
    assert.strictEqual(rc.movesLeft, left, 'a saved Chill run comes back with its moves'); assert.strictEqual(rc.score, ch.score); }
  { const ch = new BR.Engine({ seed: 4, mode: 'chill' }); ch.tick(2); ch.tick(1.5); assert(Math.abs(ch.time - 3.5) < 1e-9, 'Chill counts time'); assert.strictEqual(ch.movesLeft, BR.CFG.chill.moves, 'and no moves are spent by the clock'); }
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

// ---- Update 5: Save and leave, then Resume, gives back the same run (stage progress, clock, combo, Fuse bricks, power-up order)
{
  let checked = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const e = new BR.Engine({ seed, mode: 'rush', skill: 0.6 }), rng = BR.makeRng(seed);
    e.stage = 4; e.goal = BR.stageGoal(4);
    // play until there are Fuse bricks and some stage progress, at a steady pace so the fuse never runs out
    for (let i = 0; i < 40 && !e.over; i++) {
      e.tick(0.8); e.fuse = Math.max(e.fuse, 10);
      const taps = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p) taps.push(p); }
      e.commit(rng.pick(taps));
    }
    let fbs = 0; for (const row of e.board.grid) for (const b of row) if (b.fb) fbs++;
    const snap = JSON.parse(JSON.stringify(e.snapshot()));
    const r = new BR.Engine({ seed, mode: 'rush', snapshot: snap });
    const grid = (x, f) => JSON.stringify(x.board.grid.map((row) => row.map(f)));
    assert.strictEqual(r.stage, e.stage); assert.strictEqual(r.score, e.score);
    assert.strictEqual(r.stageScore, e.stageScore, 'the stage bar comes back');
    assert.strictEqual(r.time, e.time, 'the run clock comes back');
    assert.strictEqual(r.streak, e.streak, 'the combo comes back');
    assert.strictEqual(r.maxCombo, e.maxCombo); assert.strictEqual(r.charge, e.charge); assert.strictEqual(r.cursor, e.cursor);
    assert.deepStrictEqual(r.inv, e.inv); assert.deepStrictEqual(r.stats, e.stats);
    assert.strictEqual(grid(r, (b) => b.color), grid(e, (b) => b.color), 'the board colors come back');
    assert.strictEqual(grid(r, (b) => b.fb || 0), grid(e, (b) => b.fb || 0), 'the Fuse bricks and their countdowns come back');
    assert.strictEqual(r.goal, e.goal); assert.strictEqual(r.sparkUsed, e.sparkUsed);
    assert.strictEqual(r.fuse, e.fuse, 'the fuse is the saved fuse');
    if (fbs) checked++;
  }
  assert(checked >= 3, 'the round trip was checked with Fuse bricks on the board (' + checked + ' of 12 runs)');
  // an old (v1) snapshot still loads: the stage bar starts empty, as it did
  const e1 = new BR.Engine({ seed: 3, mode: 'rush' }); const old = JSON.parse(JSON.stringify(e1.snapshot())); ['stageScore', 'time', 'streak', 'fuseBricks', 'cursor'].forEach((k) => delete old[k]); old.v = 1;
  const r1 = new BR.Engine({ seed: 3, mode: 'rush', snapshot: old }); assert.strictEqual(r1.stageScore, 0); assert.strictEqual(r1.time, 0);
}
console.log('save and resume round trip ok');
