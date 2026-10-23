// The prototype Chill rules as hooks for lib.playChill, and one measuring function shared by chill-proto.js and chill-sweep.js.
// A variant: { curve: {base, growth} | name, moves (per round), carry: {frac, cap}, refund: {big, add, line}, wind: {within, moves}, hurrah }
const L = require('./lib'), BR = L.BR;
const { avg, pct, quant } = L;
const CURVES = {
  today: { base: 1200, growth: 1.3 },
  c1: { base: 1600, growth: 1.22 },
  c2: { base: 1800, growth: 1.2 },
  c3: { base: 2000, growth: 1.18 },
  c4: { base: 1800, growth: 1.22 },
};
const FULL = { carry: { frac: 0.5, cap: 10 }, refund: { big: 10, add: 1, line: 2 }, wind: { within: 0.15, moves: 3 }, hurrah: true };
/** Stars for a cleared round: 3 = cleared in half the round's moves or fewer, 2 = three quarters or fewer, 1 = otherwise. */
const starsFor = (used, per = BR.CFG.chill.moves) => (used <= per * 0.5 ? 3 : used <= per * 0.75 ? 2 : 1);
const origGoal = BR.chillGoal;
// noCatchup: the tile director's Chill catch-up (more help when behind the pace a 20-move round needs) is switched off for this run
const origAssist = BR.Director.prototype.assist;
BR.Director.prototype.assist = function () { const e = this.e; if (!e._noCatch) return origAssist.call(this); const s = e.stageScore; e.stageScore = e.goal; const a = origAssist.call(this); e.stageScore = s; return a; };

function hooks(v) {
  return {
    init(e, ctx) { if (v.noCatchup) e._noCatch = true; ctx.luckyId = null; ctx.lucky = 0; ctx.luckyMoves = 0; ctx.windUsed = false; ctx.windSaved = false; ctx.refunds = 0; ctx.carryTotal = 0; ctx.hurrahFired = 0; ctx.hurrahSaved = 0; },
    afterPop(e, res, ctx) {
      if (v.lucky) {
        // a Lucky brick: once a round, after the round's v.lucky.at-th pop, one new brick is Lucky; popping it (or shattering it) pays a random prize of moves
        if (ctx.luckyId != null && res.removed.some((x) => x.id === ctx.luckyId)) { const m = e.rng.pick(v.lucky.moves); e.movesLeft += m; ctx.lucky++; ctx.luckyMoves += m; ctx.luckyId = null; ctx.luckyDone = true; }
        if (ctx.luckyId == null && !ctx.luckyDone && ctx.roundPops === v.lucky.at && res.spawns.length) ctx.luckyId = e.rng.pick(res.spawns).id;
      }
      if (!v.refund) return;
      const n = res.plan.n, add = res.plan.line ? v.refund.line : n >= v.refund.big ? v.refund.add : 0;
      if (add) { e.movesLeft += add; ctx.refunds += add; }
    },
    onRoundClear(e, ctx) {
      if (!v.carry) return;
      const carry = Math.min(v.carry.cap, Math.floor(e.movesLeft * v.carry.frac));
      ctx.carry = carry; ctx.carryTotal += carry; e.movesLeft -= carry;
    },
    afterNextRound(e, ctx) { ctx.luckyId = null; ctx.luckyDone = false; if (v.carry && ctx.carry) { e.movesLeft += ctx.carry; ctx.carry = 0; } },
    onOutOfMoves(e, ctx) {
      if (v.hurrah) {
        for (const t of BR.BOOSTER_ORDER) while (e.inv[t] > 0) {
          let best = null, bn = 0; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const k = e.boosterCells(t, r, c).length; if (k > bn) { bn = k; best = { r, c }; } }
          if (!best) break; e.applyBooster(t, best.r, best.c); ctx.hurrahFired++;
        }
        if (e.stageCleared()) { ctx.hurrahSaved++; return true; }
      }
      if (v.wind && !ctx.windUsed && e.stageScore >= (1 - v.wind.within) * e.goal) { ctx.windUsed = true; ctx.windSaved = true; e.movesLeft += v.wind.moves; return true; }
      return false;
    },
  };
}

function measure(name, v, RATINGS, N) {
  const C = typeof v.curve === 'string' ? CURVES[v.curve] : v.curve;
  const movesBefore = BR.CFG.chill.moves; if (v.moves) BR.CFG.chill.moves = v.moves;
  BR.chillGoal = (r) => Math.round((C.base * Math.pow(C.growth, r - 1)) / 50) * 50;
  const res = { name, curve: `${C.base} x ${C.growth}, ${BR.CFG.chill.moves} moves`, goals: Array.from({ length: 14 }, (_, i) => BR.chillGoal(i + 1)).join(' '), bots: {} };
  for (const [k, sk] of Object.entries(L.SKILLS)) {
    const rating = RATINGS[k];
    const runs = []; for (let s = 1; s <= N; s++) runs.push(L.playChill(sk, s * 104729, rating, { hooks: hooks(v) }));
    const rounds = runs.map((r) => r.stage), clears = [].concat(...runs.map((r) => r.rounds));
    const stars = clears.map((c) => starsFor(c.movesUsed));
    // best-beaten rate: runs come in blocks of 40 (one "player" each); in runs 11 to 40, how often is the best so far beaten?
    let beats = 0, tries = 0;
    for (let b = 0; b + 40 <= runs.length; b += 40) { let best = 0; for (let i = 0; i < 40; i++) { const sc = runs[b + i].score; if (i >= 10) { tries++; if (sc > best) beats++; } best = Math.max(best, sc); } }
    // ... and the round record (what the Home card and results show): runs 11 to 40 that reach a new best round
    let rbeats = 0;
    for (let b = 0; b + 40 <= runs.length; b += 40) { let best = 0; for (let i = 0; i < 40; i++) { const st = runs[b + i].stage; if (i >= 10 && st > best) rbeats++; best = Math.max(best, st); } }
    const r1 = runs.map((r) => (r.rounds[0] ? r.rounds[0].movesUsed : BR.CFG.chill.moves));
    const starRun = runs.map((r) => r.rounds.reduce((a, c) => a + starsFor(c.movesUsed), 0));
    res.bots[k] = {
      rounds: +avg(rounds).toFixed(2), p10: quant(rounds, 0.1), p50: quant(rounds, 0.5), p90: quant(rounds, 0.9), sd: +Math.sqrt(avg(rounds.map((x) => (x - avg(rounds)) ** 2))).toFixed(2),
      minutes: +avg(runs.map((r) => r.minutes)).toFixed(2), moves: Math.round(avg(runs.map((r) => r.moves))), r1moves: +avg(r1).toFixed(1),
      near15: pct(runs, (r) => r.endProgress >= 0.85), near10: pct(runs, (r) => r.endProgress >= 0.9), far: pct(runs, (r) => r.endProgress < 0.6),
      wasted: pct(runs, (r) => r.powerCouldFinish), windUsed: pct(runs, (r) => r.ctx.windUsed), windCleared: pct(runs.filter((r) => r.ctx.windUsed), (r) => r.stage > (r.ctx.windRound || 0) && true),
      hurrahSaved: +avg(runs.map((r) => r.ctx.hurrahSaved)).toFixed(2),
      refunds: +avg(runs.map((r) => r.ctx.refunds)).toFixed(1), lucky: +avg(runs.map((r) => r.ctx.lucky)).toFixed(1), luckyMoves: +avg(runs.map((r) => r.ctx.luckyMoves)).toFixed(1),
      scoreSd: Math.round(Math.sqrt(avg(runs.map((r) => (r.score - avg(runs.map((x) => x.score))) ** 2)))), carry: +avg(runs.map((r) => r.ctx.carryTotal)).toFixed(1),
      close: pct(clears, (c) => c.left <= 3), star3: pct(stars, (x) => x === 3), star2: pct(stars, (x) => x === 2), star1: pct(stars, (x) => x === 1), starsPerRun: +avg(starRun).toFixed(1),
      score: Math.round(avg(runs.map((r) => r.score))), coins: Math.round(avg(runs.map((r) => r.coins))), xp: Math.round(avg(runs.map((r) => r.xp))),
      coinsPerMin: +(avg(runs.map((r) => r.coins)) / avg(runs.map((r) => r.minutes))).toFixed(1), xpPerMin: Math.round(avg(runs.map((r) => r.xp)) / avg(runs.map((r) => r.minutes))),
      // proposed Chill pay: rounds cleared pay their stage step without the cap of 7, plus 1 Coin per star
      coinsProp: Math.round(avg(runs.map((r) => propCoins(r, starsFor)))), bestBeat: Math.round((100 * beats) / Math.max(1, tries)), roundRecord: Math.round((100 * rbeats) / Math.max(1, tries)),
    };
    res.bots[k].coinsPropPerMin = +(res.bots[k].coinsProp / res.bots[k].minutes).toFixed(1);
  }
  BR.chillGoal = origGoal; BR.CFG.chill.moves = movesBefore;
  return res;
}
function propCoins(r, sf) {
  const C = BR.CFG.coin; let st = 0;
  for (let s = 1; s <= Math.min(r.stagesCleared, 12); s++) st += C.stageStep * Math.min(s, 7);   // 2,4,..14, then 14 a round up to 12 rounds
  return Math.round(C.scale * Math.sqrt(r.score / C.ref)) + st + r.rounds.reduce((a, c) => a + sf(c.movesUsed), 0);
}


function ratings() { const R = {}; for (const [k, sk] of Object.entries(L.SKILLS)) R[k] = L.warmRating(sk); return R; }
module.exports = { CURVES, hooks, measure, starsFor, propCoins, ratings };
