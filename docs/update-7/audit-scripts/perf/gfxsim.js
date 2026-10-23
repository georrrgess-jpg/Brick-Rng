// How Auto graphics (BR.Gfx.sample in js/main.js) reacts to typical frame-time averages: a struggling phone, a 60 Hz phone that
// recovered, a 120 Hz phone, a phone in Low Power Mode (rAF capped at 30 fps). Feeds sample() directly; no timing involved.
const L = require('./lib');
(async () => {
  const { page, browser } = await L.launch();
  const out = await page.evaluate(() => {
    BR.Coach.markAllSeen(); BR.Storage.data.settings.perf = 'auto';
    const run = (label, seq) => { BR.Gfx.st = { low: false, flips: 0 }; BR.Gfx.save(); BR.App.applySettings(); const trace = seq.map((a) => { BR.Gfx.sample(a); return (BR.Gfx.st.low ? 'L' : 'H'); }).join(''); return `${label.padEnd(58)} ${trace}  (flips ${BR.Gfx.st.flips}, lowEnd ${BR.lowEnd})`; };
    const r = (a, n) => Array(n).fill(a);
    return [
      run('60 Hz phone, smooth (16.7 ms avg) x10', r(1 / 60, 10)),
      run('one slow 3 s window (30 ms) then smooth 60 Hz x20', [0.030].concat(r(1 / 60, 20))),
      run('Low Power Mode, 30 fps cap (33.3 ms) x3 then 60 Hz x20', r(1 / 30, 3).concat(r(1 / 60, 20))),
      run('120 Hz phone dips to 45 fps once, then 120 Hz x5', [0.022, 0.0275].concat(r(1 / 120, 5))),
      run('borderline 36-40 fps (25-28 ms) alternating x10', [0.025, 0.027, 0.025, 0.027, 0.025, 0.027, 0.025, 0.027, 0.025, 0.027]),
    ];
  });
  out.forEach((x) => console.log(x));
  await browser.close();
})();
