// Which nodes get restyled, and why, during pops (or idle with IDLE=1). env EVAL, INJECT.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('file:///home/user/Brick-Rng/index.html'); await page.waitForFunction(() => window.__app, null, { timeout: 15000 });
  await page.evaluate(() => { BR.Coach.markAllSeen(); const st = BR.Storage.data; st.settings.perf = 'high'; st.settings.haptics = false; st.runs = 12; BR.App.applySettings(); });
  if (process.env.INJECT) await page.addStyleTag({ content: process.env.INJECT });
  if (process.env.EVAL) await page.evaluate(process.env.EVAL);
  await page.evaluate(() => { Math.random = (() => { let x = 12345; return () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296); })(); __app.startRun({ mode: 'daily', boosts: {} }); });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 }); await page.waitForTimeout(800);
  const best = () => page.evaluate(() => { const e = BR.Run.engine; e.fuse = 25; let b = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!b || p.cells.length > b.n)) b = { r, c, n: p.cells.length }; } const pt = BR.Run.view.pagePoint(b.r, b.c); return { x: pt.x, y: pt.y, n: b.n }; });
  const a0 = await best(); await page.touchscreen.tap(a0.x, a0.y); await page.waitForTimeout(1500);
  await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.invalidationTracking'] });
  if (process.env.IDLE) await page.waitForTimeout(3000);
  else for (let i = 0; i < 3; i++) { const a = await best(); await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(1300); }
  const ev = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
  const inv = {}; let cnt = 0, recalc = 0, els = 0;
  ev.forEach((e) => {
    if (e.name === 'UpdateLayoutTree' && e.ph === 'X') { recalc++; els += (e.args && e.args.elementCount) || 0; }
    if (/StyleRecalcInvalidationTracking|StyleInvalidatorInvalidationTracking/.test(e.name)) {
      const d = e.args && e.args.data; if (!d) return; cnt++;
      const k = e.name.slice(0, 10) + ' ' + (d.nodeName || '?') + ' | ' + (d.reason || '') + (d.invalidationList ? ' ' + JSON.stringify(d.invalidationList).slice(0, 80) : '') + (d.extraData ? ' ' + String(d.extraData).slice(0, 40) : '');
      inv[k] = (inv[k] || 0) + 1;
    }
  });
  console.log('recalcs', recalc, 'elements', els, 'invalidations', cnt);
  Object.entries(inv).sort((a, b) => b[1] - a[1]).slice(0, +(process.env.N || 30)).forEach(([k, v]) => console.log(String(v).padStart(5), k));
  await browser.close();
})();
