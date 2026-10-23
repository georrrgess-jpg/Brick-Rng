// Part 2: the economy after the Update 6 Coin doubling. Usage: node economy.js [N=120]
//  1. What the catalogue costs, and what a player earns per run, per minute and per day (Update 5 vs Update 6 run Coins)
//  2. A day-by-day journey with the real Progress code (levels, the season track and its chests, chest openings with no duplicates,
//     pity, Golden Chests) until every chest item is owned: days and hours, Update 5 vs Update 6
//  3. Are missions, run goals and the streak still worth something next to a run?
//  4. Do Boosts pay for themselves now?
//  5. Restart farming: does quitting early pay more per minute than playing a run out (square-root Coins)?
const L = require('./lib'), BR = L.BR;
const { avg } = L;
const N = +(process.argv[2] || 120);
const U6 = Object.assign({}, BR.CFG.coin);
const U5 = Object.assign({}, U6, { scale: 14, stageStep: 1, firstOfDay: 20, dailyBonus: 15 });
const coinsWith = (cfg, s, o = {}) => { const keep = BR.CFG.coin; BR.CFG.coin = cfg; const c = BR.Progress.runCoins(s, o).total; BR.CFG.coin = keep; return c; };

// ---------- 1. the catalogue and income per run
const byType = {}; for (const x of BR.DROP_ITEMS) byType[x.type] = (byType[x.type] || 0) + 1;
const price = (t) => BR.CHESTS[BR.ITEM_TYPES[t].chest].cost;
const cost = BR.TYPE_ORDER.reduce((a, t) => a + byType[t] * price(t), 0);
console.log(`catalogue: ${BR.DROP_ITEMS.length} chest items (${BR.TYPE_ORDER.map((t) => byType[t] + ' ' + t).join(', ')}), ${cost} Coins to buy one chest per item`);
const trophyCoins = BR.TROPHIES.reduce((a, t) => a + t.coins, 0);
console.log(`one-time Coins from trophies: ${trophyCoins}`);

const ratings = {}, samples = {};
for (const [k, sk] of Object.entries(L.SKILLS)) {
  ratings[k] = L.warmRating(sk);
  samples[k] = []; for (let s = 1; s <= N; s++) samples[k].push(L.playRush(sk, s * 7919, ratings[k]));
}
console.log('\nper Rush run (no first-of-day):  Update 5 Coins / Update 6 Coins / XP / minutes (+0.8 menus) / Coins per minute U5 -> U6');
const perRun = {};
for (const k of Object.keys(samples)) {
  const rs = samples[k], c5 = avg(rs.map((s) => coinsWith(U5, s))), c6 = avg(rs.map((s) => coinsWith(U6, s))), xp = avg(rs.map((s) => s.xp)), min = avg(rs.map((s) => s.minutes)) + 0.8;
  perRun[k] = { c5, c6, xp, min };
  console.log(`  ${k.padEnd(8)} ${c5.toFixed(0).padStart(4)} / ${c6.toFixed(0).padStart(4)} / ${xp.toFixed(0)} XP / ${min.toFixed(2)} min / ${(c5 / min).toFixed(1)} -> ${(c6 / min).toFixed(1)} Coins/min`);
}

// ---------- 2. the journey: R runs a day, real Progress code, chests bought as soon as affordable
function journey(k, coinCfg, runsPerDay, seed, side = 1) {
  for (const key of Object.keys(L.mem)) delete L.mem[key];
  BR.Storage.reset();
  const P = BR.Progress, pr = BR.Storage.data.profile, rng = BR.makeRng(seed);
  pr.coins += trophyCoins;                         // generous: every trophy's Coins at once (most need long play)
  const tier = BR.missionTier(99, ratings[k]);
  const misDay = side * ['bricks', 'color', 'big'].map((m) => BR.MISSION_KINDS[m].reward[tier]).reduce((a, b) => a + b, 0) * 0.85;   // three missions, most of them done
  const goalHit = { casual: 0.45, average: 0.6, sharp: 0.7 }[k], goalCoins = 14.5 * side;
  let day = 0, minutes = 0, runs = 0, chestsBought = 0, chestsFree = 0, coinsIn = 0, done = false;
  const left = () => BR.DROP_ITEMS.filter((x) => !P.owns(x.id)).length;
  while (!done && day < 2000) {
    day++;
    for (let i = 0; i < runsPerDay; i++) {
      const s = samples[k][rng.int(samples[k].length)];
      const c = coinsWith(coinCfg, s, { firstOfDay: i === 0 }) + (rng.chance(goalHit) ? goalCoins : 0);
      P.earn(c); coinsIn += c; P.addXp(s.xp + (i === 0 ? 60 : 0)); minutes += s.minutes + 0.8; runs++;
    }
    P.earn(misDay); coinsIn += misDay;
    const dow = day % 7; if (dow === 3) P.earn(side * BR.CFG.streak.day3); if (dow === 0) { P.earn(side * BR.CFG.streak.day7Coins); P.addChest('golden', 1); P.earn(250 * side); P.addChest('golden', 1); }   // streak ring and the weekly mission
    // open everything we can: free chests first (Golden: the type with the most missing Epic+), then the cheapest unfinished type
    for (let guard = 0; guard < 200; guard++) {
      const free = ['golden'].concat(BR.CHEST_ORDER).find((id) => P.chestCount(id) > 0 && !P.chestStatus(id).complete);
      if (free) { const t = BR.CHESTS[free].golden ? BR.goldenTypes(P.ownedIds())[0] : null; const d = P.openChest(free, t); if (!d) { BR.Storage.data.profile.chests[free] = 0; continue; } P.keep(d); chestsFree++; continue; }
      const buy = BR.CHEST_ORDER.filter((id) => !P.chestStatus(id).complete).sort((a, b) => BR.CHESTS[a].cost - BR.CHESTS[b].cost).find((id) => P.coins >= BR.CHESTS[id].cost);
      if (!buy) break;
      const d = P.openChest(buy); if (d) P.keep(d); chestsBought++;   // (the opening screen keeps the drop at the reveal)
    }
    P.cashStranded();
    if (left() === 0) done = true;
  }
  return { day, hours: minutes / 60, runs, chestsBought, chestsFree, level: pr.level, seasonTier: pr.season.tier, coinsLeft: pr.coins, coinsIn: Math.round(coinsIn) };
}
console.log('\njourney to own every chest item (real Progress code; trophies paid at once, 3 missions a day at 85%, the streak never broken, the weekly mission every week):');
for (const [k, rpd] of [['casual', 5], ['average', 10], ['sharp', 15]]) {
  const a = journey(k, U5, rpd, 11), b = journey(k, U6, rpd, 11), c = journey(k, U6, rpd, 11, 2);
  console.log(`  ${k.padEnd(8)} ${rpd} runs a day: Update 5 ${a.day} days, ${a.hours.toFixed(1)} h, ${a.runs} runs (season tier ${a.seasonTier}) -> Update 6 ${b.day} days, ${b.hours.toFixed(1)} h, ${b.runs} runs (season tier ${b.seasonTier}, level ${b.level}); a chest every ${((b.hours * 60) / (b.chestsBought + b.chestsFree)).toFixed(0)} min (U5 ${((a.hours * 60) / (a.chestsBought + a.chestsFree)).toFixed(0)}); with missions, goals, streak and weekly Coins doubled too: ${c.day} days, ${c.hours.toFixed(1)} h`);
}
const seasonRuns = (k) => Math.round((BR.CFG.season.tiers * BR.CFG.season.xpPerTier) / (perRun[k].xp + 6));
console.log(`  runs to finish the season track: casual ${seasonRuns('casual')}, average ${seasonRuns('average')}, sharp ${seasonRuns('sharp')}`);

// ---------- 3. what the other Coin sources are worth next to a run
console.log('\nother sources, in runs of Coins (Update 5 -> Update 6):');
for (const k of Object.keys(perRun)) {
  const tier = BR.missionTier(99, ratings[k]), mis = avg(Object.values(BR.MISSION_KINDS).map((m) => m.reward[tier]));
  const p = perRun[k];
  console.log(`  ${k.padEnd(8)} a mission (${mis.toFixed(0)} Coins) = ${(mis / p.c5).toFixed(2)} -> ${(mis / p.c6).toFixed(2)} runs; a run goal (10-20) = ${(14.5 / p.c5).toFixed(2)} -> ${(14.5 / p.c6).toFixed(2)}; streak day 3 (120) = ${(120 / p.c5).toFixed(1)} -> ${(120 / p.c6).toFixed(1)}; a level-up (about ${BR.levelReward(15).amount}) = ${(BR.levelReward(15).amount / p.c5).toFixed(2)} -> ${(BR.levelReward(15).amount / p.c6).toFixed(2)}; reroll (30) = ${(30 / p.c6).toFixed(2)} runs`);
}

// ---------- 4. Boosts: extra Coins per run against the price
console.log('\nBoosts: Coins per run with the Boost minus without (same seeds), against its price:');
for (const [k, sk] of Object.entries(L.SKILLS)) {
  const base = avg(samples[k].map((s) => s.coins)), row = [];
  for (const [id, b] of Object.entries(BR.CFG.boosts)) {
    const rs = []; for (let s = 1; s <= N; s++) rs.push(L.playRush(sk, s * 7919, ratings[k], 'rush', null, { engine: { boosts: { [id]: true } } }));
    const d = avg(rs.map((s) => s.coins)) - base;
    row.push(`${b.name} +${d.toFixed(1)} for ${b.cost} (${d >= b.cost ? 'PAYS FOR ITSELF' : Math.round((100 * d) / b.cost) + '% back'}; stage ${avg(rs.map((s) => s.stage)).toFixed(1)})`);
  }
  console.log(`  ${k.padEnd(8)} (stage ${avg(samples[k].map((s) => s.stage)).toFixed(1)}) ` + row.join(' | '));
}

// ---------- 5. restart farming: play until stage k is cleared, then Restart (the run is banked), against playing every run out
console.log('\nrestart farming (Coins per minute; a restart costs about 0.15 min, a finished run 0.8 min of results and menus):');
for (const [k, sk] of Object.entries(L.SKILLS)) {
  const out = [];
  for (const stop of [1, 2, 3, 4, 5]) {
    const rs = []; for (let s = 1; s <= N; s++) {
      const e0 = L.playRush(sk, s * 7919, ratings[k], 'rush', null, { afterPop: (e) => { if (e.stats.stagesCleared >= stop && !e.over) { e.over = true; e.endReason = 'ended'; } } });
      rs.push(e0);
    }
    const c = avg(rs.map((s) => s.coins)), m = avg(rs.map((s) => s.minutes));
    out.push(`quit after stage ${stop}: ${(c / (m + 0.15)).toFixed(1)} (${(c / (m + 0.8)).toFixed(1)} with full menus)`);
  }
  // the tail: the time from the last stage-up to the end of the run, which pays only through the square root of the score
  const tail = avg(samples[k].map((s) => s.time - (s.log.stageTimes.length ? s.log.stageTimes[s.log.stageTimes.length - 1] : 0)));
  console.log(`  ${k.padEnd(8)} full runs: ${(perRun[k].c6 / perRun[k].min).toFixed(1)} | ${out.join(' | ')} | the tail after the last stage-up: ${tail.toFixed(0)} s of ${avg(samples[k].map((s) => s.time)).toFixed(0)} s`);
}

// ---------- 6. a fix for the tail: no stage cap (stage n pays 2n Coins at every stage) and +15 Coins when the fuse ends the run
console.log('\nthe same, with stageCap 12 and a +15 Coin "run complete" bonus for a run the fuse ends (Restart and End run do not get it):');
{
  const FIX = Object.assign({}, U6, { stageCap: 12 });
  for (const [k, sk] of Object.entries(L.SKILLS)) {
    const full = avg(samples[k].map((s) => coinsWith(FIX, s) + 15)), fm = avg(samples[k].map((s) => s.minutes));
    const out = [];
    for (const stop of [3, 4, 5]) {
      const rs = []; for (let s = 1; s <= N; s++) rs.push(L.playRush(sk, s * 7919, ratings[k], 'rush', null, { afterPop: (e) => { if (e.stats.stagesCleared >= stop && !e.over) { e.over = true; e.endReason = 'ended'; } } }));
      out.push(`quit after stage ${stop}: ${(avg(rs.map((s) => coinsWith(FIX, s))) / (avg(rs.map((s) => s.minutes)) + 0.15)).toFixed(1)}`);
    }
    console.log(`  ${k.padEnd(8)} full runs ${(full / (fm + 0.25)).toFixed(1)} Coins/min with 0.25 min between runs (${(full / (fm + 0.8)).toFixed(1)} with 0.8); ${full.toFixed(0)} Coins a run | ${out.join(' | ')}`);
  }
  for (const [k] of Object.entries(L.SKILLS)) console.log(`  today, ${k}: full runs ${(perRun[k].c6 / (perRun[k].min - 0.8 + 0.25)).toFixed(1)} Coins/min with 0.25 min between runs`);
}
