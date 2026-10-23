// Update 7, Auto graphics (BR.Gfx in js/main.js): fed with frame times directly (no timing involved), it must lower effects on a
// phone that struggles, come back up on a 60 Hz screen after about 20 good seconds, never lower them because of a 30 fps cap (iOS Low
// Power Mode) or the gap of a hidden tab, and not flap on a borderline phone. Usage: node tests/u7-gfx.js
const { launch } = require('./lib');

let problems = 0;
const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };

(async () => {
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1 });
  const out = await page.evaluate(() => {
    BR.Coach.markAllSeen(); BR.Storage.data.settings.perf = 'auto'; BR.toast = () => {};
    const G = BR.Gfx, rep = (a, n) => Array(n).fill(a);
    const fresh = () => { G.st = { low: false, flips: 0, upNeed: 7 }; G.buf = []; G.good = 0; G.refresh = 1 / 60; G.lastUp = -1e9; G.save(); BR.App.applySettings(); };
    // windows of 180 frames: each window is described by its frame times (a list repeated to 180, with jitter)
    const win = (dts) => { const b = []; for (let i = 0; i < G.WINDOW; i++) b.push(dts[i % dts.length] * (1 + ((i * 7919) % 11 - 5) / 400)); return b; };
    const run = (windows) => { fresh(); return windows.map((w) => { w.forEach((dt) => G.frame(dt)); return G.st.low ? 'L' : 'H'; }).join(''); };
    const smooth60 = win([1 / 60]), smooth120 = win([1 / 120]), lpm30 = win([1 / 30]);
    const slow60 = win([1 / 60, 1 / 60, 1 / 60, 0.05, 0.05]);            // a 60 Hz phone that misses badly in busy moments: avg ~30 ms
    const slow120 = win([1 / 120, 1 / 120, 0.05, 0.05]);                 // a 120 Hz phone in trouble
    const border = win([1 / 60, 1 / 60, 0.035]);                         // 60 Hz, avg ~23 ms: neither slow nor good
    const r = {};
    r.smooth = run(rep(smooth60, 10));
    r.recover60 = run([slow60].concat(rep(smooth60, 12)));
    r.lpm = run(rep(lpm30, 6).concat(rep(smooth60, 4)));
    r.lpmRefresh = G.refresh;
    r.recover120 = run([slow120].concat(rep(smooth120, 10)));
    r.border = run(rep(border, 10));
    r.flap = run([slow60].concat(rep(smooth60, 7), [slow60], rep(smooth60, 7), rep(smooth60, 7)));
    r.flapNeed = G.st.upNeed;
    // a hidden tab: the long gap is never a slow frame (and the window starts again)
    fresh(); for (let i = 0; i < 150; i++) G.frame(1 / 60); G.frame(4.2); for (let i = 0; i < 100; i++) G.frame(1 / 60);
    r.hidden = (G.st.low ? 'L' : 'H') + ' buf ' + G.buf.length;
    // the old API still works (a plain average, judged against the last detected refresh)
    fresh(); G.sample(0.030); r.oldLow = G.st.low; for (let i = 0; i < 7; i++) G.sample(1 / 60); r.oldUp = !G.st.low;
    r.lowEnd = BR.lowEnd;
    fresh();
    return r;
  });
  console.log(JSON.stringify(out));
  ok(out.smooth === 'HHHHHHHHHH', 'a smooth 60 Hz phone was lowered', out.smooth);
  ok(/^L+H+$/.test(out.recover60) && out.recover60.indexOf('H') <= 9, 'a 60 Hz phone that recovered did not get its effects back within about 20 s', out.recover60);
  ok(!out.lpm.includes('L'), 'a 30 fps cap (Low Power Mode) lowered the effects', out.lpm);
  ok(Math.abs(out.lpmRefresh - 1 / 60) < 0.001, 'the refresh rate was not read again after Low Power Mode ended', out.lpmRefresh);
  ok(/^L+H+$/.test(out.recover120), 'a 120 Hz phone that recovered did not get its effects back', out.recover120);
  ok(out.border === 'HHHHHHHHHH', 'a borderline phone (23 ms average at 60 Hz) was lowered', out.border);
  ok(out.flapNeed > 7, 'coming down again soon after going up did not make the next step up slower', out.flapNeed, out.flap);
  ok((out.flap.match(/LH|HL/g) || []).length <= 3, 'Auto graphics flapped', out.flap);
  ok(out.hidden.startsWith('H') && out.hidden.endsWith('buf 100'), 'a hidden tab counted as a slow frame', out.hidden);
  ok(out.oldLow && out.oldUp, 'sample(avg) no longer lowers and raises', out.oldLow, out.oldUp);
  ok(!errors.length, 'page errors', errors.join(' | '));
  await browser.close();
  console.log(problems ? problems + ' PROBLEMS' : 'u7-gfx ok');
  process.exit(problems ? 1 : 0);
})();
