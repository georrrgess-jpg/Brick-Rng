// Idle cost of a menu screen, without throttling: how many style passes per second, how many elements each, and why (invalidation tracking).
// env WHERE=home|shop|collection, PM=1. Usage: node idleinval.js
const L = require('./lib');
(async () => {
  const { browser, page } = await L.launch();
  await L.setup(page, { pm: process.env.PM === '1' });
  const where = process.env.WHERE || 'home';
  await page.evaluate((w) => { window.dispatchEvent(new Event('pointerdown')); BR.Router.go(w === 'home' ? 'shop' : 'home'); }, where); await page.waitForTimeout(600);
  await page.evaluate((w) => { BR.Router.go(w); }, where); await page.waitForTimeout(2500);
  const { ev } = await L.trace(browser, page, async () => { await page.waitForTimeout(3000); }, ['disabled-by-default-devtools.timeline.invalidationTracking']);
  const tid = (ev.find((x) => x.name === 'UpdateLayoutTree') || {}).tid;
  const ult = ev.filter((x) => x.name === 'UpdateLayoutTree' && x.ph === 'X' && x.tid === tid);
  const fr = ev.filter((x) => x.name === 'BeginMainThreadFrame' || x.name === 'BeginFrame').length;
  const els = ult.map((x) => (x.args && x.args.elementCount) || 0);
  const by = L.totals(ev); const cpu = by['cpu:CrRendererMain'] || {};
  console.log(where, 'PM', process.env.PM || 0, '| style passes', ult.length, 'in 3 s, elements per pass avg', (els.reduce((a, b) => a + b, 0) / Math.max(1, els.length)).toFixed(1), 'max', Math.max(0, ...els), '| main CPU per second:', L.top(Object.fromEntries(Object.entries(cpu).map(([k, v]) => [k, v / 3])), 8, 1));
  const agg = {}; ev.filter((x) => /StyleRecalcInvalidationTracking|StyleInvalidatorInvalidationTracking/.test(x.name)).forEach((x) => { const d = x.args.data || {}; const k = (d.nodeName || '?').slice(0, 60) + ' | ' + (d.reason || '') + ' ' + (d.extraData || ''); agg[k] = (agg[k] || 0) + 1; });
  Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, v]) => console.log(String(v).padStart(5), k));
  await browser.close();
})();
