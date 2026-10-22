// What the fuse costs per frame, under a 4x CPU throttle (a mid-range phone is a few times slower than the machine this runs on).
// For each cosmetic and each situation the same run is traced twice for a few seconds: with the fuse HUD running, and with it switched
// off (its per-frame function replaced by nothing and #fuse display:none). The main thread's busy time per frame (every top-level
// event in the trace: script, style, layout, layerize, paint, commit, GC) with the fuse on minus off is what the fuse costs. The JS time of
// the fuse's own per-frame call is measured too. Budget: 1.5 ms per frame on a phone, so 1.5 x the throttle here. Exit code 1 above it.
//   node tests/fuseperf.js                  the new fuse (this checkout)
//   node tests/fuseperf.js --root=/path     another checkout of the game, for comparison (for the old HUD: the commit before Update 4)
//   node tests/fuseperf.js --fast           fewer cosmetics (what the check run uses)
//   --only=default,u_rope  just these cosmetics     --scen=calm,crit  just these situations
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const flag = (n) => (process.argv.find((a) => a.startsWith('--' + n + '=')) || '').split('=')[1];
const ROOT = path.resolve(flag('root') || path.join(__dirname, '..'));
const RATE = +(flag('rate') || 4), FAST = process.argv.includes('--fast'), SECS = +(flag('secs') || 3), BUDGET = 1.5 * RATE;
const FUSES = flag('only') ? flag('only').split(',') : FAST ? ['default', 'u_dragon'] : ['default', 'u_rope', 'u_candy', 'u_vine', 'u_phoenix', 'u_dragon'];

// engine states to hold while measuring
const SCEN = [
  { id: 'calm', hold: 'e.fuse = 24' },
  { id: 'low', hold: 'e.fuse = 7' },
  { id: 'crit', hold: 'e.fuse = 3.2' },
  { id: 'rush', hold: 'e.fuse = 18; e.rush.active = true; e.rush.left = 7; e.rush.meter = 100' },
  { id: 'gains', hold: 'e.fuse = 20', gains: true },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + ROOT + '/index.html');
  await page.waitForFunction(() => window.__app, null, { timeout: 10000 });
  await page.evaluate(() => { Object.keys(BR.Coach.CARDS).forEach((k) => { BR.Storage.data.seen[k] = true; }); BR.Storage.data.seen.whatsnew3 = true; const D = BR.Storage.data; D.seenTutorial = true; D.runs = 8; D.settings.sound = false; D.settings.music = false; D.settings.haptics = false; D.settings.perf = 'high'; BR.App.applySettings(); });
  const cdp = await ctx.newCDPSession(page);
  const isNew = await page.evaluate(() => !!BR.Fuse);

  const equip = (id) => page.evaluate((id) => {
    const P = BR.Progress;
    if (id === 'default') P.equip('default', 'fuse'); else { const inst = BR.Storage.data.profile.vault.find((v) => v.itemId === id) || P.keep({ itemId: id, shine: 'plain', seed: 5, counter: null }); P.equip(inst.uid, 'fuse'); }
    BR.Skins.apply();
    if (BR.Router.current === 'run') { BR.Run.over = true; BR.Run.token++; BR.Router.go('home', { instant: true }); }
    __app.startRun({ mode: 'rush', boosts: {} });
  }, id);
  // the fuse's per-frame entry point is BR.Run.hudFuse in both versions; wrap it for its own JS time
  await page.evaluate(() => {
    const R = BR.Run;
    if (!R.__orig) R.__orig = R.hudFuse;
    window.__st = { n: 0, t: 0, max: 0, off: false };
    R.hudFuse = function (dt) { if (window.__st.off) return; const t0 = performance.now(); R.__orig.call(R, dt); const d = performance.now() - t0; const s = window.__st; s.n++; s.t += d; if (d > s.max) s.max = d; };
  });
  const hold = (src, gains) => page.evaluate(([src, gains]) => {
    clearInterval(window.__hold); clearInterval(window.__gain);
    const set = () => { const e = BR.Run.engine; if (!e || e.over) return; e.rush.active = false; e.freeze = 0; e.spark = 0; new Function('e', src)(e); };
    set(); window.__hold = setInterval(set, 25);
    if (gains) window.__gain = setInterval(() => { const e = BR.Run.engine; if (!e || e.over || !BR.Fuse) return; e.fuse = Math.min(e.fuseMax, e.fuse + 1.2); BR.Fuse.gain(1.2, { x: 120 + Math.random() * 150, y: 500 }, 'pop'); }, 600);
  }, [src, !!gains]);

  // one traced window: main-thread busy time per animation frame (top-level events only, so nothing is counted twice)
  const traced = async (off) => {
    await page.evaluate((off) => { window.__st.off = off; document.getElementById('fuse').style.display = off ? 'none' : ''; }, off);
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.__st.n = 0; window.__st.t = 0; window.__st.max = 0; });
    const events = [];
    const on = (d) => events.push(...d.value);
    cdp.on('Tracing.dataCollected', on);
    await cdp.send('Tracing.start', { categories: 'devtools.timeline', transferMode: 'ReportEvents' });
    await page.waitForTimeout(SECS * 1000);
    const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
    await cdp.send('Tracing.end'); await done;
    cdp.off('Tracing.dataCollected', on);
    const st = await page.evaluate(() => Object.assign({}, window.__st));
    const byTid = {};
    for (const e of events) if (e.ph === 'X' && e.name === 'FireAnimationFrame') byTid[e.tid] = (byTid[e.tid] || 0) + 1;
    const tid = Object.entries(byTid).sort((a, b) => b[1] - a[1])[0][0];
    const evs = events.filter((e) => String(e.tid) === tid && e.ph === 'X' && e.dur != null).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    let end = -1, busy = 0, frames = 0, js = 0;
    for (const e of evs) {
      if (e.name === 'FireAnimationFrame') frames++;
      if (e.ts >= end) { busy += e.dur; end = e.ts + e.dur; } else if (e.ts + e.dur > end) { busy += e.ts + e.dur - end; end = e.ts + e.dur; }
    }
    frames = Math.max(1, frames);
    return { busy: busy / 1000 / frames, frames, js: st.n ? st.t / st.n : 0, jsMax: st.max };
  };

  console.log(`${isNew ? 'new fuse' : 'old HUD'} at ${RATE}x CPU throttle, ${SECS}s windows. ms per frame: "fuse" = main-thread busy time with the fuse minus without it; "JS" = its per-frame function alone`);
  console.log('cosmetic      situation  frames   busy(on)  busy(off)    fuse     JS avg   JS max');
  let worst = 0, worstJs = 0, bad = 0, sum = 0, n = 0;
  for (const id of FUSES) {
    await equip(id);
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 30000 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
    for (const sc of SCEN.filter((x) => !flag("scen") || flag("scen").split(",").includes(x.id))) {
      await hold(sc.hold, sc.gains);
      await page.waitForTimeout(500);
      // alternate on / off / on / off ... and take the medians, so slow drift in the machine does not read as a cost
      const on = [], off = [];
      for (let i = 0; i < 3; i++) { on.push(await traced(false)); off.push(await traced(true)); }
      const med = (a, k) => a.map((x) => x[k]).sort((p, q) => p - q)[1];
      const cost = med(on, 'busy') - med(off, 'busy'), js = med(on, 'js'), jsMax = Math.max(...on.map((x) => x.jsMax));
      worst = Math.max(worst, cost); worstJs = Math.max(worstJs, js); sum += cost; n++;
      console.log(`${id.padEnd(13)} ${sc.id.padEnd(9)} ${String(Math.round(med(on, 'frames'))).padStart(6)}  ${med(on, 'busy').toFixed(2).padStart(9)}  ${med(off, 'busy').toFixed(2).padStart(9)}  ${cost.toFixed(2).padStart(6)}  ${js.toFixed(2).padStart(8)}  ${jsMax.toFixed(2).padStart(7)}`);
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await page.evaluate(() => { clearInterval(window.__hold); clearInterval(window.__gain); });
  }
  console.log(`\nfuse cost per frame at ${RATE}x: worst ${worst.toFixed(2)} ms, mean ${(sum / n).toFixed(2)} ms (budget ${BUDGET.toFixed(1)} ms = 1.5 ms on a phone); the fuse's JS alone: worst average ${worstJs.toFixed(2)} ms`);
  if (errors.length) { console.log('page errors', errors.slice(0, 3)); bad++; }
  if (isNew) { if (worst > BUDGET) { console.log('PROBLEM fuse over budget'); bad++; } if (worstJs > BUDGET) { console.log('PROBLEM fuse JS over budget'); bad++; } }
  await browser.close();
  console.log(bad ? bad + ' PROBLEMS' : (isNew ? 'fuseperf ok' : 'measured'));
  process.exit(bad ? 1 : 0);
})();
