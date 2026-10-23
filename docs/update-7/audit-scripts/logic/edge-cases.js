// Part 2: targeted checks of engine.js, board.js and the rules around them. Each check prints what it found; nothing is asserted,
// so the script always runs to the end. Usage: node edge-cases.js [N=120]
const L = require('./lib'), BR = L.BR;
const { avg, pct } = L;
const N = +(process.argv[2] || 120);
const say = (id, msg) => console.log(`[${id}] ${msg}`);
const firstPlan = (e, f = () => true) => { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && f(p)) return p; } return null; };
const resume = (e) => new BR.Engine({ mode: e.mode, seed: e.seed, boosts: e.boosts, snapshot: JSON.parse(JSON.stringify(e.snapshot())), skill: e.skill });

// 1. Resume tops the fuse up to 6 s, and a resume during the Last Spark relights the fuse for free
{
  const e = new BR.Engine({ seed: 5, mode: 'rush', skill: 0.5 }); e.fuse = 0.5; e.freeze = 0;
  const r1 = resume(e);
  say('resume-grace', `fuse 0.5 s, Save and leave, Resume -> fuse ${r1.fuse} s (resumeGrace ${BR.CFG.fuse.resumeGrace}); the snapshot stays on the device, so this can be repeated`);
  const s = new BR.Engine({ seed: 5, mode: 'rush', skill: 0.5 }); s.fuse = 0.05; s.freeze = 0; for (let i = 0; i < 5 && !s.spark; i++) s.tick(0.1);
  const r2 = resume(s);
  say('resume-spark', `in the Last Spark (spark ${s.spark.toFixed(2)} s, fuse ${s.fuse}) Save and leave, Resume -> fuse ${r2.fuse} s, spark ${r2.spark}, sparkUsed ${r2.sparkUsed}: the save that needs a pop of ${BR.sparkNeed(s.stage)}+ is given for nothing (sparkFuse is ${BR.CFG.fuse.sparkFuse} s)`);
  // a player who does it every time the fuse drops under 2 s (outside Rush): how far does a run go?
  for (const [k, sk] of Object.entries(L.SKILLS)) {
    const rating = { casual: 0.5, average: 0.73, sharp: 0.89 }[k];
    const plain = [], scum = [];
    for (let seed = 1; seed <= 40; seed++) {
      plain.push(L.playRush(sk, seed * 7919, rating));
      let resumes = 0;
      const rs = L.playRush(sk, seed * 7919, rating, 'rush', null, { onTick: (e) => { if (!e.over && (e.fuse < 2 || e.spark > 0) && !e.rush.active && resumes < 400) { const r = resume(e); e.fuse = r.fuse; e.spark = 0; resumes++; } } });
      rs.resumes = resumes; scum.push(rs);
    }
    say('resume-grace', `${k}: normal runs reach stage ${avg(plain.map((s) => s.stage)).toFixed(1)} in ${avg(plain.map((s) => s.time)).toFixed(0)} s; Save-and-leave whenever the fuse is under 2 s: stage ${avg(scum.map((s) => s.stage)).toFixed(1)} in ${avg(scum.map((s) => s.time)).toFixed(0)} s (${avg(scum.map((s) => s.resumes)).toFixed(0)} resumes a run, ${pct(scum, (s) => s.time >= 1500)}% hit the 25-minute bot limit)`);
  }
}
// 2. Resuming in Rush loses the Rush; resuming reseeds the generator (a Daily is no longer the same board as everyone else's)
{
  const e = new BR.Engine({ seed: 9, mode: 'rush', skill: 0.5 }); e.rush.active = true; e.rush.left = 6; e.rush.meter = 100;
  const r = resume(e);
  say('resume-rush', `Save and leave with 6 s of Rush left -> resumed Rush active ${r.rush.active}, meter ${r.rush.meter}`);
  const seed = BR.dailySeed('d2026-10-23');
  const a = new BR.Engine({ seed, mode: 'daily' }), b = new BR.Engine({ seed, mode: 'daily' });
  for (let i = 0; i < 6; i++) { a.commit(firstPlan(a)); b.commit(firstPlan(b)); }
  const b2 = resume(b);
  for (let i = 0; i < 6; i++) { a.commit(firstPlan(a)); b2.commit(firstPlan(b2)); }
  const same = JSON.stringify(a.board.grid.map((row) => row.map((x) => x.color))) === JSON.stringify(b2.board.grid.map((row) => row.map((x) => x.color)));
  say('daily-resume', `two Daily runs, same taps, one saved and resumed after 6 pops: boards after 6 more pops identical? ${same}`);
}
// 3. Chill: the engine has no clock (results read 0:00), a snapshot does not keep the moves, and run.js never saves a Chill run
{
  const e = new BR.Engine({ seed: 3, mode: 'chill' });
  for (let i = 0; i < 8; i++) { e.tick(2); e.commit(firstPlan(e)); }
  say('chill-time', `8 pops and 16 s of ticks in Chill: summary().time = ${e.summary().time} (the results line prints Chill · Round n · 0:00)`);
  const r = resume(e);
  say('chill-snapshot', `Chill after 8 moves: movesLeft ${e.movesLeft}; snapshot -> restore: movesLeft ${r.movesLeft} (movesLeft is not in the snapshot). run.js saveSnap() skips Chill, so the pause sheet's "Save and leave" in Chill drops the run: no Coins, no XP, no streak, and the Rush run that was saved before it was already cleared by start()`);
}
// 4. Power-ups and Fuse bricks
{
  const e = new BR.Engine({ seed: 21, mode: 'rush', boosts: { headStart: true } }); e.stage = 5;
  e.board.grid[3][3].fb = 3; const before = e.fuse, defBefore = e.stats.defused;
  e.applyBooster('hammer', 3, 3);
  say('power-fusebrick', `a Hammer on a Fuse brick: it is gone, defused counted ${e.stats.defused - defBefore}, fuse ${before.toFixed(1)} -> ${e.fuse.toFixed(1)} (power bonus ${BR.CFG.fuse.powerBonus} only, no +${BR.CFG.fuse.defuse} defuse), and the other Fuse bricks do not tick`);
  // Fuse bricks that burst are counted as popped bricks (missions, Brick Breaker)
  const f = new BR.Engine({ seed: 22, mode: 'rush' }); f.stage = 5; let bursts = 0, bricks = 0;
  for (let i = 0; i < 40 && !f.over; i++) { const p = firstPlan(f, (q) => q.n <= 3) || firstPlan(f); const b0 = f.stats.bricks; const res = f.commit(p); bricks += f.stats.bricks - b0 - p.cells.length; bursts += res.bursts.length; f.fuse = f.fuseMax; }
  say('burst-count', `40 small pops at stage 5: ${bursts} Fuse bricks burst and stats.bricks grew by ${bricks} more than the bricks popped (a burst counts as a popped brick)`);
}
// 5. Chill shatter bricks count toward brick missions; out-of-moves with power-ups in hand
{
  const runs = []; for (let s = 1; s <= N; s++) { const r = L.playChill(L.SKILLS.average, s * 104729, 0.73); runs.push(r); }
  const shattered = avg(runs.map((r) => r.bricks - 0)), popped = avg(runs.map((r) => r.e.stats.bricks));
  const shatterBricks = avg(runs.map((r) => r.rounds.reduce((a, c) => a + Math.min(36, c.left * 3), 0)));
  say('chill-shatter', `average Chill run: ${popped.toFixed(0)} bricks counted, ${shatterBricks.toFixed(0)} of them (${((100 * shatterBricks) / popped).toFixed(0)}%) from the end-of-round shatter (they count for "Pop N bricks", colour missions and Brick Breaker)`);
  void shattered;
}
// 6. Trophies count Chill rounds as stages
{
  const out = [];
  for (const [k, sk] of Object.entries(L.SKILLS)) {
    const rating = { casual: 0.5, average: 0.73, sharp: 0.89 }[k];
    const rs = []; for (let s = 1; s <= N; s++) rs.push(L.playChill(sk, s * 104729, rating));
    out.push(`${k}: round 5 in ${pct(rs, (r) => r.stage >= 5)}% of Chill runs, round 10 in ${pct(rs, (r) => r.stage >= 10)}%`);
  }
  say('trophy-chill', `checkTrophies uses max(bestStage.rush, daily, chill), so Hot Streak (stage 5, 75 Coins), Fuse Master (stage 10, 200) and Beyond the Fuse (stage 12, 250) can be won with Chill rounds. ${out.join('; ')}`);
  // feed each mission kind the summary of a real Chill run: a kind that reads 0 can never move in Chill (no stage, no Rush, no Fuse bricks)
  const chillSum = L.playChill(L.SKILLS.average, 104729, 0.73).e.summary();
  const kinds = Object.entries(BR.MISSION_KINDS).filter(([k, m]) => k !== 'runs' && m.get(chillSum, { color: 0 }, 'chill') === 0).map(([k]) => k);
  say('missions-chill', `daily mission kinds that can never move in Chill: ${kinds.join(', ')} (${kinds.length} of ${Object.keys(BR.MISSION_KINDS).length}); weekly: weeklyStage`);
}
// 7. Combos: how often the board even offers a group big enough to grow the combo, by combo length (greedy average bot)
{
  const offer = {}, grow = {};
  for (let s = 1; s <= N; s++) {
    L.playRush(L.SKILLS.sharp, s * 7919, 0.89, 'rush', null, {
      afterPop: (e) => { const need = BR.comboNeed(e.streak); const best = e.bestGroup().length; const k = Math.min(e.streak, 8); offer[k] = offer[k] || [0, 0]; offer[k][1]++; if (best >= need) offer[k][0]++; },
    });
  }
  say('combo-offer', 'chance the next board offers a group of comboNeed or more, by current combo (sharp bot, Rush): ' + Object.keys(offer).sort((a, b) => a - b).map((k) => `combo ${k} needs ${BR.comboNeed(+k)}: ${Math.round((100 * offer[k][0]) / offer[k][1])}% (${offer[k][1]})`).join(', '));
  void grow;
}
// 8. Rush Start counts as one of the run's Rushes, so every later Rush needs 35% more
{
  for (const [k, sk] of Object.entries(L.SKILLS)) {
    const rating = { casual: 0.5, average: 0.73, sharp: 0.89 }[k];
    const a = [], b = [];
    for (let s = 1; s <= N; s++) { a.push(L.playRush(sk, s * 7919, rating)); b.push(L.playRush(sk, s * 7919, rating, 'rush', null, { engine: { boosts: { rushStart: true } } })); }
    const firstA = avg(a.filter((x) => x.log.rushStarts.length).map((x) => x.log.rushStarts[0])), firstB = avg(b.filter((x) => x.log.rushStarts.length).map((x) => x.log.rushStarts[0]));
    say('rush-start', `${k}: Rushes per run ${avg(a.map((x) => x.rushes)).toFixed(2)} -> ${avg(b.map((x) => x.rushes)).toFixed(2)} with Rush Start; first Rush at ${firstA.toFixed(0)} s -> ${firstB.toFixed(0)} s; Rush share ${Math.round(100 * avg(a.map((x) => x.rushShare)))}% -> ${Math.round(100 * avg(b.map((x) => x.rushShare)))}%; score ${Math.round(avg(a.map((x) => x.score)) / 1000)}k -> ${Math.round(avg(b.map((x) => x.score)) / 1000)}k`);
  }
}
// 9. Shuffles and dead boards
{
  let shuffles = 0, pops = 0, runs = 0;
  for (const [k, sk] of Object.entries(L.SKILLS)) for (let s = 1; s <= 60; s++) { const r = L.playRush(sk, s * 7919, 0.6); shuffles += r.log.shuffles; pops += r.stats ? 0 : r.pops; runs++; }
  say('shuffle', `reshuffles: ${(shuffles / runs).toFixed(2)} a Rush run over ${runs} runs (each pays +${BR.CFG.fuse.shuffleRefund} s)`);
  // a dead board of two colours (checkerboard) and of seven colours: ensureMove always finds a move and keeps the colour counts
  const rng = BR.makeRng(7);
  let worst = 0, changedCounts = 0;
  for (let t = 0; t < 2000; t++) {
    const k = 2 + (t % 6), b = new BR.Board(8, 8, k, rng);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) b.grid[r][c] = b.newBrick((r * 3 + c * (k > 2 ? 2 : 1) + (k > 2 ? r % 2 : 0)) % k);
    if (b.hasMove(null)) continue;
    const before = b.grid.flat().map((x) => x.color).sort().join();
    const re = b.ensureMove(null);
    if (!b.hasMove(null)) worst++;
    if (b.grid.flat().map((x) => x.color).sort().join() !== before) changedCounts++;
    void re;
  }
  say('dead-board', `forced dead boards of 2 to 7 colours: ${worst} left without a move after ensureMove, ${changedCounts} changed their colour counts (only the 60-try fallback may)`);
}
// 10. Last Spark: who gets saved, by stage
{
  const by = {};
  for (const [k, sk] of Object.entries(L.SKILLS)) {
    const rating = { casual: 0.5, average: 0.73, sharp: 0.89 }[k];
    for (let s = 1; s <= N; s++) {
      const r = L.playRush(sk, s * 7919, rating);
      if (!r.sparkUsed) continue;
      const st = Math.min(r.stage, 10); by[k] = by[k] || {}; by[k][st] = by[k][st] || [0, 0]; by[k][st][1]++; if (r.sparkSaves) by[k][st][0]++;
    }
  }
  for (const k of Object.keys(by)) say('spark-stage', `${k}: Last Spark used and saved, by the stage the run ended on: ` + Object.keys(by[k]).map((st) => `stage ${st} ${by[k][st][0]}/${by[k][st][1]}`).join(', '));
}
