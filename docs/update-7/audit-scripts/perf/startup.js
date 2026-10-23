// Startup and memory at RATE: time to the app, first paint, splash gone, what the main thread did while loading (style sheet parse,
// script, style, layout), then memory: JS heap, DOM counters, every canvas (on page and off, through a createElement hook), and the
// layer tree (count, device pixels at DSF 3, biggest layers) on Home, in a run (Spire set) and on a chest reveal.
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const L = require('./lib');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
  await page.addInitScript(() => {
    window.__canv = []; const ce = Document.prototype.createElement;
    Document.prototype.createElement = function (t, o) { const el = ce.call(this, t, o); if (String(t).toLowerCase() === 'canvas') window.__canv.push(el); return el; };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: L.RATE });
  await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink.user_timing', 'loading'] });
  const t0 = Date.now();
  await page.goto(L.URL); await page.waitForFunction(() => window.__app, null, { timeout: 30000 });
  const tApp = Date.now() - t0;
  await page.waitForFunction(() => document.body.classList.contains('ready'), null, { timeout: 30000 });
  const tReady = Date.now() - t0;
  await page.waitForTimeout(1500);
  const ev = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
  const nav = await page.evaluate(() => ({ fcp: (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0, dcl: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd, load: performance.getEntriesByType('navigation')[0].loadEventEnd }));
  console.log(`STARTUP RATE ${L.RATE}: app ready ${tApp} ms (wall, from goto), splash gone ${tReady} ms, FCP ${nav.fcp.toFixed(0)}, DOMContentLoaded ${nav.dcl.toFixed(0)}, load ${nav.load.toFixed(0)}`);
  const by = L.totals(ev); console.log('   main (wall):', L.top(by.CrRendererMain, 10)); console.log('   main (cpu): ', L.top(by['cpu:CrRendererMain'], 10));
  const css = {}; ev.filter((e) => e.name === 'ParseAuthorStyleSheet' && e.ph === 'X').forEach((e) => { const u = String((e.args && e.args.data && e.args.data.styleSheetUrl) || '?').split('/').pop(); css[u] = (css[u] || 0) + e.dur / 1000; });
  console.log('   style sheet parse by file (ms):', L.top(css, 8));
  const js = {}; ev.filter((e) => (e.name === 'EvaluateScript' || e.name === 'v8.compile') && e.ph === 'X').forEach((e) => { const u = String((e.args && e.args.data && e.args.data.url) || (e.args && e.args.fileName) || '?').split('/').pop(); js[u] = (js[u] || 0) + e.dur / 1000; });
  console.log('   script evaluate by file (ms):', L.top(js, 8));
  const ult = ev.filter((e) => e.name === 'UpdateLayoutTree' && e.ph === 'X').sort((a, b) => b.dur - a.dur).slice(0, 3).map((e) => (e.dur / 1000).toFixed(0) + ' ms/' + ((e.args && e.args.elementCount) || '?') + ' el');
  console.log('   biggest style passes:', ult.join(', '));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  const mem = async (label) => {
    await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
    const h = await cdp.send('Runtime.getHeapUsage'); const d = await cdp.send('Memory.getDOMCounters');
    const cv = await page.evaluate(() => { const all = new Set([...document.querySelectorAll('canvas'), ...(window.__canv || [])]); let px = 0, n = 0, on = 0, big = []; all.forEach((c) => { const p = c.width * c.height; if (!p) return; n++; px += p; if (c.isConnected) on++; big.push([c.isConnected ? (c.id || c.className || 'canvas') : 'offscreen', c.width + 'x' + c.height, p]); }); big.sort((a, b) => b[2] - a[2]); return { n, on, mb: (px * 4) / 1048576, big: big.slice(0, 5).map((x) => x[0] + ' ' + x[1]).join(', ') }; });
    const lr = await L.layerReport(page, cdp, 3, 400);
    console.log(`MEMORY ${label}: JS heap ${(h.usedSize / 1048576).toFixed(1)} MB | DOM nodes ${d.nodes}, listeners ${d.jsEventListeners} | canvases ${cv.n} (${cv.on} on page) ${cv.mb.toFixed(1)} MB: ${cv.big} | layers ${lr.layers}, drawing ${lr.drawing}, ${lr.mpx.toFixed(1)} M device px (upper bound ~${lr.mb.toFixed(0)} MB)\n      biggest layers: ${lr.big.join(' | ')}`);
  };
  await L.setup(page, {});
  await page.waitForTimeout(800);
  await mem('home');
  for (const s of ['shop', 'collection', 'missions', 'profile', 'home']) { await page.evaluate((s) => BR.Router.go(s), s); await page.waitForTimeout(600); }
  await page.waitForTimeout(1200); await mem('home after visiting every tab');
  await L.setup(page, { skin: 'f_sigil', pop: 'b_constellation', board: 'a_tower', fuse: 'u_moonrise', hat: 'h_wizard' });
  await L.startRun(page, 'rush'); { const a = await L.bestTap(page); await page.touchscreen.tap(a.x, a.y); } await page.waitForTimeout(1500);
  await mem('run (Spire set)');
  await page.evaluate(() => { const e = BR.Run.engine; e.rush.meter = 99.5; e.rush.lastPop = e.time; }); { const a = await L.bestTap(page); await page.touchscreen.tap(a.x, a.y); } await page.waitForTimeout(1200);
  await mem('run in Rush (Spire set)');
  await page.evaluate(() => { BR.Run.over = true; BR.Router.go('home', { instant: true }); }).catch((e) => console.log('end run:', e.message)); await page.waitForTimeout(800);
  await page.evaluate(() => { BR.Progress.addChest('brick', 1); BR.Router.go('shop'); }); await page.waitForTimeout(800);
  await page.evaluate(() => BR.App.openChest('brick')); await page.waitForSelector('.opening.on .hold:not(.off)', { timeout: 15000 });
  const box = await page.locator('.hold').boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.waitForFunction(() => document.querySelector('.reel'), null, { timeout: 30000 }); await page.mouse.up(); await page.waitForTimeout(400);
  await mem('chest spin');
  await page.waitForFunction(() => document.querySelector('.rv-actions.on'), null, { timeout: 60000 }).catch(() => {}); await page.waitForTimeout(600);
  await mem('chest reveal');
  const sheets = await page.evaluate(() => { let rules = 0, kf = 0; for (const s of document.styleSheets) { try { const w = (l) => { for (const r of l) { if (r.type === 7) kf++; else if (r.cssRules && !r.selectorText) w(r.cssRules); else rules++; } }; w(s.cssRules); } catch (e) { /* ignore */ } } return { rules, kf, sheets: document.styleSheets.length }; });
  console.log('CSS:', JSON.stringify(sheets));
  await browser.close();
})();
