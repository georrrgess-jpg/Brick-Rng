// Part 1 prototype: the proposed Chill rules, monkeypatched onto the real engine through the bot's hooks, before and after.
// Usage: node chill-proto.js [N=240] [variant ...]    (variants: see VARIANTS below; default: all of them)
//
// Rules prototyped (numbers are the proposal; each can be switched on alone):
//   curve   goal = goalBase x growth^(round-1), rounded to 50 (today 1200 x 1.30)
//   carry   Banked moves: half the moves left at a clear (rounded down) carry into the next round, at most +10 (a round has at most 30);
//           the rest shatter for 100 each as today
//   refund  Big pops buy moves: a pop of 10+ gives +1 move, a Line Blast +2
//   lucky   Lucky brick (Chill only): once a round, after the round's 4th pop, one new brick is Lucky; popping it pays +1, +2, +2, +3, +3 or +5 moves
//   wind    Second Wind: once per run, moves run out within 15% of the goal -> +3 moves ("So close: 3 more moves")
//   hurrah  Power-ups never go to waste: power-ups in hand fire on their own (best cell) before an out-of-moves round is judged
//   stars   (scoring only) 3 stars = cleared in 10 moves or fewer, 2 stars = 15 or fewer, 1 star otherwise; counted per run
const L = require('./lib'), R = require('./chill-rules');
const args = process.argv.slice(2).filter((a) => a !== '--json');
const N = +(args[0] && /^\d+$/.test(args[0]) ? args.shift() : 240);
const pick = args;

const LUCKY = { at: 4, moves: [1, 2, 2, 3, 3, 5] };   // Lucky brick: once a round, after the 4th pop of the round, one new brick is Lucky (+1 to +5 moves, mean 2.7)
const PKG = { carry: { frac: 0.5, cap: 10 }, refund: { big: 10, add: 1, line: 2 }, lucky: LUCKY, wind: { within: 0.15, moves: 3 }, hurrah: true };
const VARIANTS = {
  today: { curve: 'today' },
  // one rule at a time, on today's goals
  carryOnly: { curve: 'today', carry: PKG.carry },
  refundOnly: { curve: 'today', refund: PKG.refund },
  luckyOnly: { curve: 'today', lucky: LUCKY },
  lastChance: { curve: 'today', wind: PKG.wind, hurrah: true },
  curveOnly: { curve: { base: 2400, growth: 1.12 } },
  // the package on two candidate curves
  pkg_2400x112: Object.assign({ curve: { base: 2400, growth: 1.12 } }, PKG),
  pkg_2600x113: Object.assign({ curve: { base: 2600, growth: 1.13 } }, PKG),
  // the proposal: a shorter bank (+5 at most) and a smaller Lucky prize keep an average run near 5 minutes
  proposal: { curve: { base: 2400, growth: 1.13 }, carry: { frac: 0.5, cap: 5 }, refund: PKG.refund, lucky: { at: 4, moves: [1, 2, 2, 3] }, wind: PKG.wind, hurrah: true },
  proposal_b: { curve: { base: 2200, growth: 1.15 }, carry: { frac: 0.5, cap: 5 }, refund: PKG.refund, lucky: { at: 4, moves: [1, 2, 2, 3] }, wind: PKG.wind, hurrah: true },
};

const RATINGS = R.ratings();
const names = pick.length ? pick : Object.keys(VARIANTS);
const all = names.map((n) => R.measure(n, VARIANTS[n], RATINGS, N));
if (process.argv.includes('--json')) { console.log(JSON.stringify(all, null, 1)); process.exit(0); }
console.log(`Chill prototype, ${N} runs per bot per variant (ratings ${Object.entries(RATINGS).map(([k, v]) => k + ' ' + v.toFixed(2)).join(', ')})`);
const cols = [['rounds', 'rounds'], ['p10/50/90', (o) => `${o.p10}/${o.p50}/${o.p90}`], ['sd', 'sd'], ['score', 'score'], ['score sd', 'scoreSd'], ['min', 'minutes'], ['moves', 'moves'], ['r1 moves', 'r1moves'], ['near<=15%', 'near15'], ['far>40%', 'far'], ['wasted pw', 'wasted'], ['wind', 'windUsed'], ['refund', 'refunds'], ['lucky', 'luckyMoves'], ['carry', 'carry'], ['close', 'close'], ['3*/2*/1*', (o) => `${o.star3}/${o.star2}/${o.star1}`], ['stars/run', 'starsPerRun'], ['best beaten', 'bestBeat'], ['round rec', 'roundRecord'], ['Coins', 'coins'], ['C/min', 'coinsPerMin'], ['XP/min', 'xpPerMin'], ['propC', 'coinsProp'], ['propC/min', 'coinsPropPerMin']];
for (const r of all) {
  console.log(`\n== ${r.name}  (goals ${r.curve}: ${r.goals})`);
  console.log('  bot     ' + cols.map(([h]) => h.padStart(11)).join(''));
  for (const [k, o] of Object.entries(r.bots)) console.log('  ' + k.padEnd(8) + cols.map(([, f]) => String(typeof f === 'function' ? f(o) : o[f]).padStart(11)).join(''));
}
