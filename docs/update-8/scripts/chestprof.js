// A whole chest opening at 4x, DSF 3: frame stats per phase, and the longest frames' contents. env CHEST, OWN=n items owned, INJECT, EVAL
const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + (process.env.ROOT || '/home/user/Brick-Rng') + '/index.html'); await page.waitForFunction(() => window.__app, null, { timeout: 15000 });
  const chest = process.env.CHEST || 'brick';
  await page.evaluate((o) => { BR.Coach.markAllSeen(); const st = BR.Storage.data, P = BR.Progress; st.settings.perf = o.perf; st.settings.haptics = false; st.runs = 12; P.addChest(o.chest, 2); if (o.chest === 'golden') P.addChest('golden', 2); BR.App.applySettings(); }, { chest, perf: process.env.PERF || 'high' });
  if (process.env.INJECT) await page.addStyleTag({ content: process.env.INJECT });
  if (process.env.EVAL) await page.evaluate(process.env.EVAL);
  await page.touchscreen.tap(196, 3);
  await page.evaluate(() => BR.Router.go('shop')); await page.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  if (!process.env.NOTRACE) await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing'].concat(process.env.INV ? ['disabled-by-default-devtools.timeline.invalidationTracking'] : []) });
  await page.evaluate(() => { performance.mark('t0'); window.__g = []; window.__ph = []; let last = performance.now(); const f = () => { const n = performance.now(); const o = BR.Openings.current; window.__g.push([last, n, o ? o.state + (document.querySelector('.rv.on') ? '/rv' : '') : 'menu']); last = n; if (!window.__stop) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await page.evaluate((c) => { Math.random = (() => { let x = +(window.__seed || 777); return () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296); })(); BR.App.openChest(c); }, chest);
  await page.waitForSelector(chest === 'golden' ? '.opening.on .op-picker button' : '.opening.on .hold', { timeout: 15000 }); await page.waitForTimeout(700);
  if (chest === 'golden') { await page.click('.op-picker button'); await page.waitForTimeout(400); }
  await page.waitForSelector('.opening.on .hold:not(.off)', { timeout: 15000 });
  const box = await page.locator('.hold').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.waitForFunction(() => document.querySelector('.opening.bursting, .opening.spinning'), null, { timeout: 30000 }).catch(() => {}); await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('.rv-actions.on'), null, { timeout: 60000 }).catch(() => console.log('no actions'));
  await page.waitForTimeout(1500);
  const g = await page.evaluate(() => { window.__stop = true; return { g: window.__g, t0: performance.getEntriesByName('t0')[0].startTime }; });
  if (process.env.NOTRACE) { const phases = {}; g.g.forEach(([s, e, ph]) => { (phases[ph] = phases[ph] || []).push(e - s); }); for (const [ph, a] of Object.entries(phases)) { const s = a.slice().sort((x, y) => x - y); console.log(ph.padEnd(14), 'frames', a.length, 'avg', (a.reduce((x, y) => x + y, 0) / a.length).toFixed(0), 'p90', s[Math.floor(s.length * 0.9)].toFixed(0), 'max', s[s.length - 1].toFixed(0)); } await browser.close(); return; }
  const ev = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
  const phases = {}; g.g.forEach(([s, e, ph]) => { const p = (phases[ph] = phases[ph] || []); p.push(e - s); });
  for (const [ph, a] of Object.entries(phases)) { const s = a.slice().sort((x, y) => x - y); console.log(ph.padEnd(14), 'frames', a.length, 'avg', (a.reduce((x, y) => x + y, 0) / a.length).toFixed(0), 'p90', s[Math.floor(s.length * 0.9)].toFixed(0), 'max', s[s.length - 1].toFixed(0)); }
  const mark = ev.find((x) => x.name === 't0'); const off = mark.ts / 1000 - g.t0;
  const tid = (ev.find((x) => x.name === 'FireAnimationFrame') || {}).tid;
  const main = ev.filter((x) => x.ph === 'X' && x.tid === tid && x.dur && !/RunTask|ThreadController|TaskQueue/.test(x.name));
  const tot = {}; main.forEach((x) => { tot[x.name] = (tot[x.name] || 0) + x.dur / 1000; }); console.log('total main:', Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([k, v]) => k + ' ' + v.toFixed(0)).join(' | '));
  for (const [s, e, ph] of g.g.slice().sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, 5)) {
    const S = (s + off) * 1000, E = (e + off) * 1000; const agg = {};
    main.filter((x) => x.ts >= S - 500 && x.ts < E).forEach((x) => { let k = x.name; if (x.args && x.args.data && (x.args.data.functionName || x.args.data.url)) k += ' ' + (x.args.data.functionName || '') + '@' + String(x.args.data.url || '').split('/').pop() + ':' + (x.args.data.lineNumber || ''); if (x.args && x.args.elementCount) k += ' el' ; agg[k] = (agg[k] || 0) + x.dur / 1000; });
    console.log('frame', (e - s).toFixed(0), ph, ':', Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + ' ' + v.toFixed(0)).join(' | '));
  }
  if (process.env.INV) {
    const big = ev.filter((x) => x.name === 'UpdateLayoutTree' && x.ph === 'X' && x.dur > 40000 && x.tid === tid).sort((a, b) => b.dur - a.dur).slice(0, 5);
    for (const b of big) {
      const before = ev.filter((x) => /InvalidationTracking/.test(x.name) && x.ts <= b.ts && x.ts > b.ts - 400000 && x.tid === tid);
      const agg = {}; before.forEach((x) => { const d = x.args.data || {}; const k = x.name.slice(0, 10) + ' ' + (d.nodeName || '?').slice(0, 60) + ' | ' + (d.reason || '') + ' ' + (d.invalidationList ? JSON.stringify(d.invalidationList.map((q) => q.classes || q.attributes || q.ids || q.tagNames || (q.allDescendantsMightBeInvalid ? 'ALL' : q))).slice(0, 90) : '') + (d.selectors ? ' SEL ' + d.selectors.map((q) => q.selector).join(' ;; ').slice(0, 160) : ''); agg[k] = (agg[k] || 0) + 1; });
      console.log('STYLE', (b.dur / 1000).toFixed(0), 'ms elements', b.args && b.args.elementCount, '\n   ' + Object.entries(agg).sort((a, c) => c[1] - a[1]).slice(0, 8).map(([k, v]) => v + ' ' + k).join('\n   '));
    }
  }
  ev.filter((x) => x.name === 'UpdateLayoutTree' && x.ph === 'X' && x.dur > 60000 && x.tid === tid).forEach((x) => { const st = x.args && x.args.beginData && x.args.beginData.stackTrace; console.log('ULT', (x.dur / 1000).toFixed(0), 'els', x.args.elementCount, st ? st.slice(0, 4).map((f) => f.functionName + '@' + String(f.url).split('/').pop() + ':' + f.lineNumber).join(' < ') : '(frame)'); });
  console.log('errors', errors.join('|') || 'none');
  await browser.close();
})();
