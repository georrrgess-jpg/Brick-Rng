// Part 1: a grid over the Chill goal curve, moves per round and the carry rule (with Big pops buy moves, Second Wind and the power-up
// rule on), to find a curve where skill and luck spread the runs out instead of every run ending on the same round.
// Usage: node chill-sweep.js [N=80] [moves=20]
const L = require('./lib'), R = require('./chill-rules');
const N = +(process.argv[2] || 80), MOVES = (process.argv[3] || '20').split(',').map(Number);
const RATINGS = R.ratings();
const BASES = (process.env.BASES || '2400,3000').split(',').map(Number), GROWTHS = (process.env.GROWTHS || '1.10,1.13,1.16').split(',').map(Number);
const CARRIES = { half10: { frac: 0.5, cap: 10 }, full15: { frac: 1, cap: 15 } };
const extra = { refund: { big: 10, add: 1, line: 2 }, wind: { within: 0.15, moves: 3 }, hurrah: true };
console.log('variant'.padEnd(34) + ['casual', 'average', 'sharp'].map((k) => `${k}: rounds p10-p90 sd min r1 near far best rec 3*`.padEnd(60)).join(''));
for (const moves of MOVES) for (const base of BASES) for (const growth of GROWTHS) for (const [cn, carry] of Object.entries(CARRIES)) {
  const name = `m${moves} ${base}x${growth} ${cn}`;
  const r = R.measure(name, Object.assign({ curve: { base, growth }, moves, carry }, extra), RATINGS, N);
  console.log(name.padEnd(34) + Object.entries(r.bots).map(([k, o]) => `${o.rounds} ${o.p10}-${o.p90} ${o.sd} ${o.minutes} ${o.r1moves} ${o.near15} ${o.far} ${o.bestBeat} ${o.roundRecord} ${o.star3}`.padEnd(60)).join(''));
}
