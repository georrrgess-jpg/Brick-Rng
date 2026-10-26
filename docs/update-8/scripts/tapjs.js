// CPU profile of only the tap handlers: total self time per function inside pointer events. env as popprof
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('file://' + (process.env.ROOT || '/home/user/Brick-Rng') + '/index.html'); await page.waitForFunction(() => window.__app, null, { timeout: 15000 });
  await page.evaluate((pm) => { BR.Coach.markAllSeen(); const st = BR.Storage.data; st.settings.haptics = false; st.runs = 12; st.settings.perf = 'high'; st.settings.perfMode = !!pm; BR.App.applySettings(); }, process.env.PM);
  await page.touchscreen.tap(196, 3);
  await page.evaluate(() => { Math.random = (() => { let x = 12345; return () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296); })(); __app.startRun({ mode: 'daily', boosts: {} }); });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 }); await page.waitForTimeout(800);
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const best = () => page.evaluate(() => { const e = BR.Run.engine; e.fuse = 25; let b = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!b || p.cells.length > b.n)) b = { r, c, n: p.cells.length }; } const pt = BR.Run.view.pagePoint(b.r, b.c); return { x: pt.x, y: pt.y, n: b.n }; });
  await page.evaluate(() => { window.__h = []; ['pointerdown', 'pointerup', 'click', 'touchend', 'touchstart'].forEach((t) => { window.addEventListener(t, () => { const t0 = performance.now(); window.__h.push([t, t0]); setTimeout(() => {}, 0); }, true); window.addEventListener(t, () => { const l = window.__h[window.__h.length - 1]; l.push(performance.now() - l[1]); }, false); }); });
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 100 }); await cdp.send('Profiler.start');
  for (let i = 0; i < 6; i++) { const a = await best(); await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(1400); }
  const { profile } = await cdp.send('Profiler.stop');
  const h = await page.evaluate(() => window.__h.filter((x) => x[2] > 1).map((x) => x[0] + ' ' + x[2].toFixed(0)));
  console.log('handlers (ms, throttled):', h.join(', '));
  // total (inclusive) time per function under any frame whose url is run.js:77-ish handler: approximate by inclusive time of named functions
  const nodes = new Map(profile.nodes.map((n) => [n.id, n])); const parent = new Map(); profile.nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)));
  const incl = new Map(); const tk = (n) => (n.callFrame.functionName || '(anon)') + ' ' + (n.callFrame.url || '').split('/').pop() + ':' + n.callFrame.lineNumber;
  profile.samples.forEach((id, i) => { const dt = (profile.timeDeltas[i] || 0) / 1000; const seen = new Set(); let cur = id; while (cur != null) { const k = tk(nodes.get(cur)); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + dt); } cur = parent.get(cur); } });
  console.log([...incl].filter(([k]) => !/^\((program|idle|root|garbage)/.test(k) && !/^ :-1/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, +(process.env.N || 40)).map(([k, v]) => v.toFixed(0).padStart(5) + ' ' + k).join('\n'));
  await browser.close();
})();
