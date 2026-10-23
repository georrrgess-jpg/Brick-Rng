// Shared setup for the Update 7 logic audit: loads the pure game logic into Node (no DOM), and gives bots that play whole runs
// the way the real run controller (js/run.js) sequences them. Read-only: nothing here writes to the game files.
//
//   const L = require('./lib'); const BR = L.BR;
//   L.playChill(skill, seed, rating, opts) -> per-run record (rounds, moves, minutes, near miss, score by round, Coins, XP)
//   L.playRush(skill, seed, rating, mode, want) -> per-run record (the same bot as tests/balance.js)
//
// Timing model (seconds a person spends, used for "minutes" and "per minute"):
//   Rush: the engine clock (the bot advances it while it "thinks" and while the pop animates, like tests/balance.js), plus 3 s for
//         "Get ready / GO" and the fuse-out crumble.
//   Chill: no clock in the engine (Engine.tick returns at once in Chill, so summary().time is always 0), so the bot keeps its own:
//         think + 0.55 s of pop animation per move (Chill plays the pop and the fall at full length, Rush at 0.75 / 0.82),
//         2.2 s per round clear (flash, 0.9 s, the shatter, 0.25 s, the "Round n" callout), 0.6 x think + 0.55 s per power-up,
//         and 3 s for the start and the out-of-moves crumble. People think longer with no clock: casual 2.6 s, average 2.0 s, sharp 1.5 s.
const path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
global.window = global;
const mem = {};
global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
for (const f of ['rng', 'board', 'config', 'boosters', 'items', 'chests', 'director', 'engine', 'storage', 'pass', 'progress', 'missions', 'retention']) require(ROOT + '/js/' + f + '.js');
const BR = global.BR;

const SKILLS = {
  casual: { think: 1.8, chillThink: 2.6, lock: 0.5, greedy: 0.4, power: false },
  average: { think: 1.2, chillThink: 2.0, lock: 0.5, greedy: 0.8, power: true },
  sharp: { think: 0.8, chillThink: 1.5, lock: 0.45, greedy: 0.95, power: true, planner: true },
};

const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const pct = (a, f) => Math.round((100 * a.filter(f).length) / Math.max(1, a.length));
const quant = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0; };

/** Coins and XP exactly as Progress.runCoins / Progress.runXpRows compute them (no first-of-day, no new-best bonus). */
const coinsFor = (s, opts = {}) => BR.Progress.runCoins(s, opts).total;
const xpFor = (s, opts = {}) => BR.Progress.runXpRows(s, opts).reduce((a, r) => a + r.xp, 0);

/** Every tap the board offers. */
function allTaps(e) { const out = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p) out.push(p); } return out; }
/** One plan per group (the same group tapped at different cells is the same move). */
function uniqueTaps(e) {
  const seen = new Set(), out = [];
  for (const p of allTaps(e)) { const k = p.primary.map((q) => q.r * 8 + q.c).sort((a, b) => a - b).join(','); if (!seen.has(k)) { seen.add(k); out.push(p); } }
  return out;
}

/** Biggest group left after removing `cells` and letting gravity act (the refill is unknown, so new cells count as empty). */
function bestAfter(board, cells) {
  const g = board.grid.map((row) => row.map((b) => (b ? b.color : -1)));
  for (const p of cells) g[p.r][p.c] = -1;
  for (let c = 0; c < 8; c++) { const col = []; for (let r = 7; r >= 0; r--) if (g[r][c] >= 0) col.push(g[r][c]); for (let r = 7, i = 0; r >= 0; r--, i++) g[r][c] = i < col.length ? col[i] : -1; }
  return BR.Director.measure(g, 8, 8).best;
}

/** The bot's choice. Greedy: the biggest group (ties: the most points). Planner (sharp in Chill): points now plus what the next board keeps. */
function pick(e, taps, sk, rng, forceBig) {
  if (!forceBig && !rng.chance(sk.greedy)) return rng.pick(taps);
  if (sk.planner && e.chill) {
    let best = null, bv = -Infinity;
    for (const p of taps) {
      const fb = bestAfter(e.board, p.cells);
      let v = p.points + 0.5 * 10 * fb * fb;
      if (e.streak >= 1 && p.n < 4) v -= 60 * e.streak;   // do not break a combo with a small pop
      if (v > bv) { bv = v; best = p; }
    }
    return best;
  }
  return taps.reduce((a, b) => (b.n > a.n || (b.n === a.n && b.points > a.points) ? b : a));
}

/** Use every power-up that clears 7+ bricks, as tests/balance.js does. Returns seconds spent. */
function usePowers(e, sk, think, lock, onRes) {
  let t = 0;
  if (!sk.power) return t;
  for (const type of BR.BOOSTER_ORDER) {
    while (e.inv[type] > 0 && !e.over) {
      let best = null, bn = 0;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const n = e.boosterCells(type, r, c).length; if (n > bn) { bn = n; best = { r, c }; } }
      if (!best || bn < 7) break;
      const res = e.applyBooster(type, best.r, best.c);
      if (!res) break;
      t += think * 0.6 + lock;
      if (onRes) onRes(res);
      if (e.chill && e.stageCleared()) return t;
    }
  }
  return t;
}

/**
 * One Chill run, sequenced like js/run.js: after every pop or power-up, a cleared round shatters its leftover moves and the next
 * round begins; a pop that leaves 0 moves short of the goal ends the run AT ONCE (afterAction -> endRun('moves')), even with
 * power-ups in hand. opts.hooks lets a prototype change the rules: { afterPop(e, res, ctx), onRoundClear(e, ctx), onEnd(e, ctx) -> bool continue }.
 */
function playChill(sk, seed, rating, opts = {}) {
  const e = new BR.Engine({ seed, mode: 'chill', skill: rating });
  const rng = BR.makeRng(seed ^ 0xc0ffee);
  const think = sk.chillThink, lock = 0.55, H = opts.hooks || {};
  const ctx = { secs: 3, rounds: [], roundStartScore: 0, movesUsed: 0, totalMoves: 0, pops: 0, powerUsed: 0, endProgress: 0, heldPowerAtEnd: 0, powerCouldFinish: false, extra: {} };
  if (H.init) H.init(e, ctx);
  let guard = 0;
  const roundClear = () => {
    const left = e.movesLeft;
    ctx.rounds.push({ round: e.stage, movesUsed: ctx.roundPops, left, score: e.stageScore, goal: e.goal, pointsPerMove: e.stageScore / Math.max(1, ctx.roundPops) });
    ctx.roundPops = 0;
    if (H.onRoundClear) H.onRoundClear(e, ctx);
    if (e.movesLeft > 0) e.shatter();
    e.nextRound();
    if (H.afterNextRound) H.afterNextRound(e, ctx);
    ctx.secs += 2.2;
  };
  ctx.roundPops = 0;
  while (!e.over && guard++ < 4000) {
    if (e.stageCleared()) { roundClear(); continue; }
    // power-ups (they cost no move in Chill)
    if (sk.power) {
      ctx.secs += usePowers(e, sk, think, lock, (res) => { ctx.powerUsed++; if (H.afterPower) H.afterPower(e, res, ctx); });
      if (e.stageCleared()) { roundClear(); continue; }
    }
    const taps = uniqueTaps(e);
    if (!taps.length) throw new Error('no taps although the board has a move');
    const p = pick(e, taps, sk, rng, false);
    ctx.secs += Math.max(0.6, think * (0.6 + rng.next() * 0.8)) + lock;
    const res = e.commit(p);
    if (!res) break;
    ctx.pops++; ctx.totalMoves++; ctx.roundPops++;
    if (H.afterPop) H.afterPop(e, res, ctx);
    if (e.stageCleared()) { roundClear(); continue; }
    if (e.outOfMoves()) {
      if (H.onOutOfMoves && H.onOutOfMoves(e, ctx)) continue;   // a prototype rule can save the run (a Second Wind, power-ups that fire)
      ctx.endProgress = e.stageScore / e.goal;
      ctx.heldPowerAtEnd = e.inv.hammer + e.inv.beam + e.inv.prism;
      // could the power-ups in hand have finished the round? (each scores its bricks x perBrick)
      let pot = 0; for (const t of BR.BOOSTER_ORDER) if (e.inv[t] > 0) { let bn = 0; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) bn = Math.max(bn, e.boosterCells(t, r, c).length); pot += e.inv[t] * bn * BR.BOOSTERS[t].perBrick; }
      ctx.powerCouldFinish = pot > 0 && e.stageScore + pot >= e.goal;
      e.over = true; e.endReason = 'moves';
      break;
    }
  }
  const s = e.summary();
  s.minutes = ctx.secs / 60;
  if (H.finish) H.finish(e, s, ctx);
  s.coins = coinsFor(s); s.xp = xpFor(s);
  return Object.assign(s, { ctx, rounds: ctx.rounds, endProgress: ctx.endProgress, moves: ctx.totalMoves, powerCouldFinish: ctx.powerCouldFinish, heldPowerAtEnd: ctx.heldPowerAtEnd, e });
}

/** One Rush (or Daily) run: the bot of tests/balance.js. */
function playRush(sk, seed, rating, mode = 'rush', want = null, opts = {}) {
  const e = new BR.Engine(Object.assign({ seed, mode, skill: rating }, opts.engine || {}));
  if (want) e.setWant(want);
  const rng = BR.makeRng(seed ^ 0xabcdef);
  let rushT = 0;
  const adv = (sec) => { for (let t = 0; t < sec && !e.over; t += 0.05) { const d = Math.min(0.05, sec - t); if (e.rush.active) rushT += d; const ev = e.tick(d); if (opts.onTick) opts.onTick(e, ev); } };
  let g = 0;
  const log = { sparkStarts: 0, shuffles: 0, rushStarts: [], stageTimes: [], pops: [] };
  while (!e.over && g++ < 6000 && e.time < 1500) {
    if (sk.power) for (const t of BR.BOOSTER_ORDER) if (e.inv[t] > 0 && !e.over) {
      let best = null, bn = 0; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const n = e.boosterCells(t, r, c).length; if (n > bn) { bn = n; best = { r, c }; } }
      if (best && bn >= 7) { adv(sk.think * 0.6); if (e.over) break; const res = e.applyBooster(t, best.r, best.c); if (res) { if (res.stageUp) log.stageTimes.push(e.time); adv(sk.lock); } }
    }
    if (e.over) break;
    const taps = allTaps(e);
    const sp = e.spark > 0;
    adv(sp ? 0.5 + rng.next() * sk.think * 0.5 : Math.max(0.25, sk.think * (0.6 + rng.next() * 0.8)));
    if (e.over) break;
    const p = sp || rng.chance(sk.greedy) ? taps.reduce((a, b) => (b.n > a.n || (b.n === a.n && b.points > a.points) ? b : a)) : rng.pick(taps);
    const res = e.commit(p); if (!res) break;
    log.pops.push({ t: e.time, n: p.n, streak: e.streak, combo: p.combo, stage: e.stage });
    if (res.spark) log.sparkStarts++;
    if (res.shuffle && res.shuffle.length) log.shuffles++;
    if (res.rushStart) log.rushStarts.push(e.time);
    if (res.stageUp) { log.stageTimes.push(e.time); adv(0.9); }
    adv(sk.lock);
    if (opts.afterPop) opts.afterPop(e, res);
  }
  const s = e.summary();
  s.minutes = (e.time + 3) / 60; s.rushShare = rushT / Math.max(1, e.time);
  s.coins = coinsFor(s, { daily: mode === 'daily' }); s.xp = xpFor(s, { daily: mode === 'daily' });
  s.sparkUsed = e.sparkUsed; s.log = log; s.e = e; s.bursts = e.stats.fuseBursts;
  return s;
}

/** The tile director's rating for a bot after 30 warm-up Rush runs, as tests/balance.js does. */
function warmRating(sk, n = 30) {
  let rating = 0.4;
  for (let s = 1; s <= n; s++) rating = BR.Director.rate(rating, { mode: 'rush', stage: playRush(sk, 100003 * s, rating).stage });
  return rating;
}

module.exports = { BR, ROOT, SKILLS, avg, pct, quant, coinsFor, xpFor, allTaps, uniqueTaps, bestAfter, pick, playChill, playRush, warmRating, mem };
