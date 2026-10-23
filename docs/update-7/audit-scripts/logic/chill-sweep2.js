// Part 1: what spreads Chill runs out (so a best can be beaten) — the director's Chill catch-up, a Lucky brick, full carry.
// Usage: node chill-sweep2.js [N=80]
const L = require('./lib'), R = require('./chill-rules');
const N = +(process.argv[2] || 80);
const RATINGS = R.ratings();
const P = { refund: { big: 10, add: 1, line: 2 }, wind: { within: 0.15, moves: 3 }, hurrah: true };
const LUCKY = { at: 4, moves: [1, 2, 2, 3, 3, 5] };
const V = {
  today: { curve: 'today' },
  today_noCatchup: { curve: 'today', noCatchup: true },
  today_lucky: { curve: 'today', lucky: LUCKY },
  pkg_half10: Object.assign({ curve: { base: 2400, growth: 1.1 }, carry: { frac: 0.5, cap: 10 } }, P),
  pkg_half10_noCatch: Object.assign({ curve: { base: 2400, growth: 1.1 }, carry: { frac: 0.5, cap: 10 }, noCatchup: true }, P),
  pkg_half10_lucky: Object.assign({ curve: { base: 2400, growth: 1.1 }, carry: { frac: 0.5, cap: 10 }, lucky: LUCKY }, P),
  pkg_half10_lucky_noCatch: Object.assign({ curve: { base: 2400, growth: 1.1 }, carry: { frac: 0.5, cap: 10 }, lucky: LUCKY, noCatchup: true }, P),
  pkg_full15_lucky_noCatch: Object.assign({ curve: { base: 2400, growth: 1.1 }, carry: { frac: 1, cap: 15 }, lucky: LUCKY, noCatchup: true }, P),
  pkg_16moves_lucky_noCatch: Object.assign({ curve: { base: 2000, growth: 1.1 }, moves: 16, carry: { frac: 0.5, cap: 8 }, lucky: LUCKY, noCatchup: true }, P),
};
const names = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(V);
console.log('variant'.padEnd(26) + ['casual', 'average', 'sharp'].map((k) => `${k}: rounds p10-p90 sd scoreSd min r1 near15 far best rec 3* lucky`.padEnd(66)).join(''));
for (const n of names) {
  const r = R.measure(n, V[n], RATINGS, N);
  console.log(n.padEnd(26) + Object.entries(r.bots).map(([k, o]) => `${o.rounds} ${o.p10}-${o.p90} ${o.sd} ${o.scoreSd} ${o.minutes} ${o.r1moves} ${o.near15} ${o.far} ${o.bestBeat} ${o.roundRecord} ${o.star3} ${o.luckyMoves}`.padEnd(66)).join(''));
}
