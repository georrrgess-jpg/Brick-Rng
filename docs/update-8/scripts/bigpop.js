// Big pops, Rush start, stage clear and chest frames under CPU throttle. env: ROOT (checkout), RATE (default 4), MOBILE=1 (Mobile mode on),
// PERF (high|auto|low), SKIN/SHINE (item id / shine), SOUND=0 (sound off). Prints per-moment frame stats.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const root = process.env.ROOT || '/home/user/Brick-Rng';
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + root + '/index.html'); await page.waitForFunction(() => window.__app, null, { timeout: 15000 });
  await page.evaluate((o) => {
    BR.Coach.markAllSeen(); const st = BR.Storage.data, P = BR.Progress; st.settings.perf = o.perf || 'high'; st.settings.haptics = false; st.runs = 12; st.seenTutorial = true; st.settings.sound = o.sound !== '0';
    if (o.mobile) st.settings.mobile = true; else st.settings.mobile = false;
    if (o.skin) { if (!P.owns(o.skin)) P.keep({ itemId: o.skin, shine: o.shine || 'plain', seed: 7 }); const inst = st.profile.vault.find((v) => v.itemId === o.skin); P.equip(inst.uid, 'skin'); }
    BR.App.applySettings(); BR.Skins.apply();
  }, { perf: process.env.PERF, skin: process.env.SKIN, shine: process.env.SHINE, mobile: process.env.MOBILE, sound: process.env.SOUND });
  if (process.env.INJECT) await page.addStyleTag({ content: process.env.INJECT });
  await page.waitForTimeout(800); await page.touchscreen.tap(196, 3);
  await page.evaluate(() => { Math.random = (() => { let x = 12345; return () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296); })(); __app.startRun({ mode: 'daily', boosts: {} }); });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 }); await page.waitForTimeout(800);
  await page.evaluate(() => { BR.Run.engine.tick = () => []; });
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.RATE || 4) });
  const run = (n, kind) => page.evaluate(async ([n, kind]) => {
    const R = BR.Run, e = R.engine, g = e.board.grid;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { g[r][c].color = (r * 3 + c * 2) % 5; delete g[r][c].fb; }
    if (kind === 'line') for (let c = 0; c < 8; c++) g[7][c].color = 5; else { let k = n; for (let r = 7; r >= 0 && k > 0; r--) for (let c = 0; c < 4 && k > 0; c++) { g[r][c].color = 5; k--; } }
    if (kind === 'stage') e.stageScore = Math.max(0, e.goal - 5);
    if (kind === 'rush') e.rush.meter = 98;
    e.board.version++; R.view.syncTo(e.board);
    for (let i = 0; i < 80 && !(R.canAct && !R.busy); i++) await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 400));
    const gaps = []; let last = performance.now(), on = true; const f = (t) => { if (!on) return; gaps.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f);
    const t0 = performance.now(); const p = R.tap(7, 0); const sync = performance.now() - t0; await p; await new Promise((r) => setTimeout(r, 700)); on = false;
    const s = gaps.slice(1).sort((a, b) => a - b), sum = gaps.reduce((a, b) => a + b, 0);
    return { frames: gaps.length, avg: sum / gaps.length, p90: s[Math.floor(s.length * 0.9)], max: s[s.length - 1], over50: gaps.filter((x) => x > 50).length, sync };
  }, [n, kind]);
  if (process.env.TRACE) await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
  const out = [];
  for (const [label, n, kind] of [['pop 6', 6], ['pop 12', 12], ['pop 20', 20], ['pop 24', 24], ['line', 0, 'line'], ['stage', 6, 'stage'], ['pop 12', 12], ['pop 24', 24], ['rush', 12, 'rush']]) {
    const r = await run(n, kind); out.push(label.padEnd(8) + ' avg ' + r.avg.toFixed(1).padStart(5) + ' p90 ' + String(Math.round(r.p90)).padStart(4) + ' max ' + String(Math.round(r.max)).padStart(4) + ' >50ms ' + String(r.over50).padStart(3) + ' tap-script ' + r.sync.toFixed(0).padStart(4) + 'ms');
  }
  if (process.env.TRACE) {
    const ev = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
    const names = {}; ev.filter((e) => e.ph === 'M' && e.name === 'thread_name').forEach((e) => { names[e.pid + ':' + e.tid] = e.args.name; });
    const by = {}; ev.filter((e) => e.ph === 'X' && e.dur).forEach((e) => { const t = names[e.pid + ':' + e.tid] || '?'; if (!/CrRendererMain|Compositor|Raster|CrGpuMain/.test(t)) return; if (/RunTask|ThreadController|TaskQueue/.test(e.name)) return; const k = t.replace(/\d+/g, '').slice(0, 14) + ' ' + e.name; by[k] = (by[k] || 0) + e.dur / 1000; });
    console.log(Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => k + ' ' + v.toFixed(0)).join(' | '));
  }
  console.log(out.join('\n')); console.log('errors', errors.join('|') || 'none');
  await browser.close();
})();
