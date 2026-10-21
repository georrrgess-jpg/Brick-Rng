// Spin physics: 1,000 random landings must end exactly on the winning card, with sane timing and ticks.
global.window = global;
require('../js/spin.js');
const { Spin } = BR;
let bad = 0; const fail = (...a) => { if (bad++ < 6) console.log('FAIL', ...a); };
const pitch = 116, marker = 195;
const stats = { dur: [], maxv: [], ticks: [], over: 0 };
for (let n = 0; n < 1000; n++) {
  const cards = 54 + Math.floor(Math.random() * 6);
  const dist = (cards - 3) * pitch + (Math.random() - 0.5) * 0.7 * 108;
  const short = 6 + Math.random() * 10;
  const tab = Spin.solve({ distance: dist, short });
  const last = tab.xs[tab.xs.length - 1];
  if (Math.abs(last - dist) > 0.05) fail('landing', n, last, dist);
  // monotone until the spring overshoot, never moves backwards by more than a few pixels
  let maxBack = 0, peak = 0;
  for (let i = 1; i < tab.xs.length; i++) { const d = tab.xs[i] - tab.xs[i - 1]; peak = Math.max(peak, d / tab.dt); if (d < 0) maxBack = Math.max(maxBack, -d); }
  if (maxBack > 0.5) fail('backwards step', n, maxBack);
  const over = Math.max(...tab.xs) - dist;
  if (over > 14) fail('overshoot', n, over);
  if (over > 0.5) stats.over++;
  if (tab.duration < 5.3 || tab.duration > 7.4) fail('duration', n, tab.duration);
  const cr = Spin.crossings(tab, pitch, marker);
  const expectedMin = Math.floor((dist + marker) / pitch) - Math.floor((tab.xs[0] + marker) / pitch);
  if (cr.length < expectedMin) fail('ticks', n, cr.length, expectedMin);
  // the tease: the last second crosses at most ~3 card edges and the final edge comes late
  const lastSec = cr.filter((c) => c.t > tab.duration - 1.0).length;
  const tease = cr.filter((c) => c.t > tab.duration - 1.8).length;
  if (lastSec > 3) fail('last second too fast', n, lastSec);
  if (tease < 1) fail('no tease across the last cards', n, tease);
  stats.dur.push(tab.duration); stats.maxv.push(peak); stats.ticks.push(cr.length);
}
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log('duration avg %s min %s max %s', avg(stats.dur).toFixed(2), Math.min(...stats.dur).toFixed(2), Math.max(...stats.dur).toFixed(2));
console.log('peak speed avg %s px/s, ticks avg %s, with overshoot %s/1000', avg(stats.maxv).toFixed(0), avg(stats.ticks).toFixed(1), stats.over);
// reduced motion: about two seconds
const rd = Spin.solve({ distance: 12 * pitch, short: 8, params: Spin.REDUCED });
console.log('reduced duration', rd.duration.toFixed(2));
if (rd.duration > 3.2) fail('reduced too long', rd.duration);
console.log(bad ? bad + ' failures' : 'spin ok');
process.exit(bad ? 1 : 0);
