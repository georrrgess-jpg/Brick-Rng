const { launch } = require('./lib');
const OUT = process.argv[2];
(async () => {
  const { browser, page, errors } = await launch({ width: 430, height: 820 });
  await page.click('#btnPlay');
  await page.waitForTimeout(2300);
  const pt = await page.evaluate(() => { const a = window.__brick; const g = a.engine.bestGroup(); const p = g[0]; const q = a.view.pagePoint(p.r, p.c); return { x: q.x, y: q.y, n: g.length }; });
  console.log('group', pt.n);
  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(150);
  await page.mouse.down(); await page.mouse.up();
  const t0 = Date.now();
  for (let i = 0; i < 6; i++) {
    await page.screenshot({ path: `${OUT}/anim-${i}.png`, clip: { x: 0, y: 0, width: 430, height: 820 } });
    console.log('shot', i, Date.now() - t0, 'ms');
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/anim-end.png` });
  console.log('state', await page.evaluate(() => ({ busy: window.__brick.busy, score: window.__brick.engine.score, fuel: window.__brick.engine.fuel })));
  console.log('errors', errors);
  await browser.close();
})();
