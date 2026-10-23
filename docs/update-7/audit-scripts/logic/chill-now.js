// Part 1: how Chill plays today. Three bots (casual, average, sharp) play N Chill runs each, sequenced like js/run.js, and the same
// bots play Rush for comparison. Usage: node chill-now.js [N=300] [--json]
const L = require('./lib'), BR = L.BR;
const N = +(process.argv[2] && /^\d+$/.test(process.argv[2]) ? process.argv[2] : 300);
const { avg, pct, quant } = L;

function census(runs) {
  const rounds = runs.map((r) => r.stage);
  const clears = [].concat(...runs.map((r) => r.rounds));
  const hist = {}; rounds.forEach((x) => { hist[x] = (hist[x] || 0) + 1; });
  // P(clear round k | reached k)
  const pass = {};
  for (let k = 1; k <= 14; k++) { const reached = runs.filter((r) => r.stage >= k).length; const cleared = runs.filter((r) => r.stage > k).length; if (reached) pass[k] = Math.round((100 * cleared) / reached); }
  // the score at the end of each round (cumulative, with the shatter bonus)
  const leftByRound = {}; for (const c of clears) (leftByRound[c.round] = leftByRound[c.round] || []).push(c.left);
  const stars = clears.map((c) => (c.left >= 8 ? 3 : c.left >= 4 ? 2 : 1));
  return {
    rounds: +avg(rounds).toFixed(2), roundsP10: quant(rounds, 0.1), roundsP50: quant(rounds, 0.5), roundsP90: quant(rounds, 0.9), hist,
    passRate: pass,
    moves: Math.round(avg(runs.map((r) => r.moves))), minutes: +avg(runs.map((r) => r.minutes)).toFixed(2), minP10: +quant(runs.map((r) => r.minutes), 0.1).toFixed(1), minP90: +quant(runs.map((r) => r.minutes), 0.9).toFixed(1),
    score: Math.round(avg(runs.map((r) => r.score))),
    // how the run ends: the share of the last goal reached when the moves ran out
    endProgress: +avg(runs.map((r) => r.endProgress)).toFixed(2),
    nearMiss90: pct(runs, (r) => r.endProgress >= 0.9), nearMiss80: pct(runs, (r) => r.endProgress >= 0.8), farMiss: pct(runs, (r) => r.endProgress < 0.6),
    // one more ordinary pop (the run's median pop score) would have cleared it
    onePopShort: pct(runs, (r) => r.endProgress > 0 && (1 - r.endProgress) * r.e.goal <= medianPop(r)),
    powerCouldFinish: pct(runs, (r) => r.powerCouldFinish), heldPower: +avg(runs.map((r) => r.heldPowerAtEnd)).toFixed(2),
    leftAtClear: +avg(clears.map((c) => c.left)).toFixed(1), leftByRound: Object.fromEntries(Object.entries(leftByRound).map(([k, v]) => [k, +avg(v).toFixed(1)])),
    stars: { three: pct(clears, (c) => c.left >= 8), two: pct(clears, (c) => c.left >= 4 && c.left < 8), one: pct(clears, (c) => c.left < 4) }, starsPerRun: +avg(runs.map((r) => r.rounds.reduce((a, c) => a + (c.left >= 8 ? 3 : c.left >= 4 ? 2 : 1), 0))).toFixed(1),
    starAvg: +avg(stars).toFixed(2),
    maxCombo: +avg(runs.map((r) => r.maxCombo)).toFixed(1), biggest: +avg(runs.map((r) => r.biggest)).toFixed(1), combo3: pct(runs, (r) => r.maxCombo >= 3),
    powerUsed: +avg(runs.map((r) => r.powerUsed)).toFixed(1), bricks: Math.round(avg(runs.map((r) => r.bricks))),
    coins: Math.round(avg(runs.map((r) => r.coins))), xp: Math.round(avg(runs.map((r) => r.xp))),
    coinsPerMin: +(avg(runs.map((r) => r.coins)) / avg(runs.map((r) => r.minutes))).toFixed(1), xpPerMin: Math.round(avg(runs.map((r) => r.xp)) / avg(runs.map((r) => r.minutes))),
  };
}
function medianPop(r) { return 10 * 4 * 4; }   // a pop of 4 (160 points) is the "one more ordinary pop"

function scoreCurve(runs) {
  // the cumulative score at the end of each round, over the runs that cleared it
  const by = {};
  for (const r of runs) { let acc = 0; for (const c of r.rounds) { acc += c.score + c.left * BR.CFG.chill.shatterPerMove; (by[c.round] = by[c.round] || []).push(acc); } }
  return Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { goal: BR.chillGoal(+k), cum: Math.round(avg(v)), n: v.length }]));
}

const out = { N, goals: Array.from({ length: 12 }, (_, i) => BR.chillGoal(i + 1)), bots: {} };
for (const [k, sk] of Object.entries(L.SKILLS)) {
  const rating = L.warmRating(sk);
  const chill = []; for (let s = 1; s <= N; s++) chill.push(L.playChill(sk, s * 104729, rating));
  const rush = []; for (let s = 1; s <= Math.round(N / 2); s++) rush.push(L.playRush(sk, s * 7919, rating));
  const c = census(chill);
  c.curve = scoreCurve(chill);
  const r = { stage: +avg(rush.map((x) => x.stage)).toFixed(1), minutes: +avg(rush.map((x) => x.minutes)).toFixed(2), score: Math.round(avg(rush.map((x) => x.score))), coins: Math.round(avg(rush.map((x) => x.coins))), xp: Math.round(avg(rush.map((x) => x.xp))) };
  r.coinsPerMin = +(r.coins / r.minutes).toFixed(1); r.xpPerMin = Math.round(r.xp / r.minutes);
  // with 0.8 min of menus and results per run (tests/sim.js), what an hour pays
  const hour = (coins, min) => Math.round((60 / (min + 0.8)) * coins);
  out.bots[k] = { rating: +rating.toFixed(2), chill: c, rush: r, coinsPerHour: { chill: hour(c.coins, c.minutes), rush: hour(r.coins, r.minutes) } };
}
if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }

console.log(`Chill today (${N} runs per bot). Goals by round: ${out.goals.join(', ')}`);
for (const [k, o] of Object.entries(out.bots)) {
  const c = o.chill, r = o.rush;
  console.log(`\n== ${k} (rating ${o.rating})`);
  console.log(`  rounds reached ${c.rounds} (p10 ${c.roundsP10}, median ${c.roundsP50}, p90 ${c.roundsP90}); ${c.moves} moves, ${c.minutes} min (p10 ${c.minP10}, p90 ${c.minP90}); score ${c.score}`);
  console.log(`  clear rate by round (%): ${Object.entries(c.passRate).map(([kk, v]) => kk + ':' + v).join(' ')}`);
  console.log(`  ends: ${c.nearMiss90}% within 10% of the goal, ${c.nearMiss80}% within 20%, ${c.farMiss}% further than 40% away (mean ${c.endProgress} of the goal); one pop of 4 short: ${c.onePopShort}%`);
  console.log(`  ended holding power-ups: ${c.heldPower} on average; ${c.powerCouldFinish}% of runs ended "out of moves" with power-ups in hand that would have cleared the round`);
  console.log(`  leftover moves at a clear ${c.leftAtClear} (by round ${JSON.stringify(c.leftByRound)}); stars per clear: 3* ${c.stars.three}% 2* ${c.stars.two}% 1* ${c.stars.one}%; stars per run ${c.starsPerRun}`);
  console.log(`  max combo ${c.maxCombo} (combo 3+ in ${c.combo3}% of runs), biggest pop ${c.biggest}, power-ups used ${c.powerUsed}, bricks ${c.bricks}`);
  console.log(`  pays ${c.coins} Coins + ${c.xp} XP a run = ${c.coinsPerMin} Coins/min, ${c.xpPerMin} XP/min   | Rush: stage ${r.stage}, ${r.minutes} min, ${r.coins} Coins + ${r.xp} XP = ${r.coinsPerMin} Coins/min, ${r.xpPerMin} XP/min`);
  console.log(`  an hour of play (0.8 min of menus per run): Chill ${o.coinsPerHour.chill} Coins, Rush ${o.coinsPerHour.rush} Coins`);
  console.log(`  score curve (cumulative at the end of each round): ${Object.entries(c.curve).slice(0, 10).map(([kk, v]) => `r${kk} ${v.cum}`).join(', ')}`);
}
