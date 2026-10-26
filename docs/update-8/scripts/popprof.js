// Profile pops: main-thread events by name, other threads, JS top functions. env: SKIN, BOARD, POP, FUSE item ids; PERF=high|low
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + (process.env.ROOT || '/home/user/Brick-Rng') + '/index.html'); await page.waitForFunction(() => window.__app, null, { timeout: 15000 });
  await page.evaluate((o) => {
    BR.Coach.markAllSeen(); const st = BR.Storage.data, P = BR.Progress; st.settings.perf = o.perf || 'high'; st.settings.haptics = false; st.runs = 12; st.seenTutorial = true;
    ['skin', 'pop', 'board', 'fuse'].forEach((t) => { const id = o[t]; if (!id) return; if (!P.owns(id)) P.keep({ itemId: id, shine: o.shine || 'plain', seed: 7 }); const inst = st.profile.vault.find((v) => v.itemId === id); P.equip(inst.uid, t); });
    BR.App.applySettings(); BR.Skins.apply();
  }, { shine: process.env.SHINE, perf: process.env.PERF, skin: process.env.SKIN, pop: process.env.POP, board: process.env.BOARD, fuse: process.env.FUSE });
  if (process.env.INJECT) await page.addStyleTag({ content: process.env.INJECT });
  if (process.env.EVAL) await page.evaluate(process.env.EVAL);
  await page.waitForTimeout(800);
  await page.touchscreen.tap(196, 3);
  await page.evaluate((m) => { Math.random = (() => { let x = 12345; return () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296); })(); __app.startRun({ mode: m, boosts: {} }); }, process.env.MODE || 'daily');
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 }); await page.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.RATE || 4) });
  const best = () => page.evaluate(() => { const e = BR.Run.engine; e.fuse = 25; let b = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!b || p.cells.length > b.n)) b = { r, c, n: p.cells.length }; } const pt = BR.Run.view.pagePoint(b.r, b.c); return { x: pt.x, y: pt.y, n: b.n }; });
  await page.evaluate(() => { window.__g = []; let last = performance.now(); const f = () => { const n = performance.now(); window.__g.push(n - last); last = n; if (!window.__stop) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  if (process.env.TRACE !== '0') await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute'] });
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 }); await cdp.send('Profiler.start');
  const sizes = [];
  for (let i = 0; i < 6; i++) { const a = await best(); sizes.push(a.n); await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(1400); }
  const { profile } = await cdp.send('Profiler.stop');
  const gaps = await page.evaluate(() => { window.__stop = true; return window.__g; });
  const s = gaps.slice(5).sort((a, b) => a - b), sum = gaps.reduce((a, b) => a + b, 0);
  console.log('pop sizes', sizes.join(','), '| frames', gaps.length, 'avg', (sum / gaps.length).toFixed(1), 'p90', s[Math.floor(s.length * 0.9)].toFixed(0), 'max', s[s.length - 1].toFixed(0), '| >50ms frames', gaps.filter((g) => g > 50).length);
  if (process.env.TRACE !== '0') {
    const ev = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
    const names = {}; ev.filter((e) => e.ph === 'M' && e.name === 'thread_name').forEach((e) => { names[e.pid + ':' + e.tid] = e.args.name; });
    const byThread = {};
    ev.filter((e) => e.ph === 'X' && e.dur).forEach((e) => { const t = names[e.pid + ':' + e.tid] || '?'; if (!/CrRendererMain|Compositor|Raster|VizCompositor|CrGpuMain/.test(t)) return; const k = t.replace(/\d+/g, ''); byThread[k] = byThread[k] || {}; if (/RunTask|ThreadController|TaskQueue/.test(e.name)) return; byThread[k][e.name] = (byThread[k][e.name] || 0) + e.dur / 1000; });
    for (const [t, m] of Object.entries(byThread)) console.log('  ', t.padEnd(26), Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([k, v]) => k + ' ' + v.toFixed(0)).join(' | '));
  }
  const nodes = new Map(profile.nodes.map((n) => [n.id, n])); const self = new Map();
  profile.samples.forEach((id, i) => { const n = nodes.get(id); const k = (n.callFrame.functionName || '(anon)') + ' ' + (n.callFrame.url || '').split('/').pop() + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + (profile.timeDeltas[i] || 0) / 1000); });
  console.log('   JS top:', [...self].filter(([k]) => !/^\((program|idle|root)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => k + ' ' + v.toFixed(0)).join(' | '));
  console.log('errors', errors.join('|') || 'none');
  await browser.close();
})();
