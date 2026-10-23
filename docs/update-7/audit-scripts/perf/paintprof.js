// What the paint of a screen's first frame is made of: PaintImage events by image (data-URI SVGs show their start), and
// the number of display items. env WHAT=collection|shop|home|item (item = the item sheet over the Collection), RATE.
const L = require('./lib');
(async () => {
  const { browser, page, cdp } = await L.launch();
  await L.setup(page, {});
  const what = process.env.WHAT || 'collection';
  await page.touchscreen.tap(196, 3);
  for (const s of ['shop', 'collection', 'missions', 'home']) { await page.evaluate((s) => BR.Router.go(s), s); await page.waitForTimeout(500); }
  if (what === 'item') { await page.evaluate(() => BR.Router.go('collection')); await page.waitForTimeout(1500); }
  await L.throttle(cdp);
  const { ev } = await L.trace(browser, page, async () => {
    if (what === 'item') await page.evaluate(() => { const v = BR.Storage.data.profile.vault.find((x) => BR.itemById[x.itemId].type === 'skin'); BR.itemSheet(v.uid, 'skin'); });
    else await page.evaluate((w) => { window.dispatchEvent(new Event('pointerdown')); BR.Router.go(w); }, what);
    await page.waitForTimeout(1500);
  }, ['disabled-by-default-devtools.timeline.invalidationTracking']);
  const tid = (ev.find((x) => x.name === 'FireAnimationFrame' || x.name === 'Paint') || {}).tid;
  const img = {}; let pi = 0, piT = 0;
  ev.filter((x) => x.name === 'PaintImage' && x.ph === 'X').forEach((x) => { const u = String((x.args && x.args.data && x.args.data.url) || '(no url)'); const k = decodeURIComponent(u).replace(/^data:image\/svg\+xml[^,]*,/, 'svg:').slice(0, 110); const a = (img[k] = img[k] || { n: 0, ms: 0, px: 0 }); a.n++; a.ms += (x.tdur != null ? x.tdur : x.dur) / 1000; const d = x.args.data || {}; a.px += (d.width || 0) * (d.height || 0); pi++; piT += x.dur / 1000; });
  const paints = ev.filter((x) => x.name === 'Paint' && x.ph === 'X' && x.tid === tid);
  console.log(what, 'Paint events', paints.length, 'wall', paints.reduce((a, x) => a + x.dur / 1000, 0).toFixed(0), 'ms cpu', paints.reduce((a, x) => a + (x.tdur || x.dur) / 1000, 0).toFixed(0), 'ms | PaintImage', pi, 'events', piT.toFixed(0), 'ms');
  Object.entries(img).sort((a, b) => b[1].ms - a[1].ms).slice(0, 14).forEach(([k, v]) => console.log(String(v.n).padStart(5), 'x', v.ms.toFixed(1).padStart(6), 'ms cpu  ', k));
  // style invalidations that led to the biggest style recalcs
  const big = ev.filter((x) => x.name === 'UpdateLayoutTree' && x.ph === 'X' && x.tid === tid).sort((a, b) => b.dur - a.dur).slice(0, 2);
  for (const b of big) {
    const before = ev.filter((x) => /InvalidationTracking/.test(x.name) && x.ts <= b.ts && x.ts > b.ts - 300000 && x.tid === tid);
    const agg = {}; before.forEach((x) => { const d = x.args.data || {}; const k = x.name.replace('InvalidationTracking', '').slice(0, 14) + ' ' + (d.nodeName || '?').slice(0, 50) + ' | ' + (d.reason || '') + ' ' + (d.invalidationList ? JSON.stringify(d.invalidationList.map((q) => q.classes || q.attributes || q.ids || q.tagNames || (q.allDescendantsMightBeInvalid ? 'ALL' : q))).slice(0, 80) : ''); agg[k] = (agg[k] || 0) + 1; });
    console.log('STYLE', (b.dur / 1000).toFixed(0), 'ms wall', ((b.tdur || b.dur) / 1000).toFixed(0), 'cpu, elements', b.args && b.args.elementCount, '\n   ' + Object.entries(agg).sort((a, c) => c[1] - a[1]).slice(0, 8).map(([k, v]) => v + ' ' + k).join('\n   '));
  }
  await browser.close();
})();
