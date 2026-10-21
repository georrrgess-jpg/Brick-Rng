const { launch } = require('./lib');
(async () => {
  const { browser, page, errors } = await launch({ width: 400, height: 780, mobile: true });
  await page.click('#btnPlay');
  await page.waitForFunction(() => !__brick.busy, null, { timeout: 15000 });
  await page.evaluate(() => { __brick.engine.need = 1e9; });
  const pt = await page.evaluate(() => { const a = __brick; const g = a.engine.bestGroup(); const q = a.view.pagePoint(g[0].r, g[0].c); return { x: q.x, y: q.y }; });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  // 1) press: preview must show, nothing popped yet
  await touch('touchStart', pt.x, pt.y); await page.waitForTimeout(250);
  const pressed = await page.evaluate(() => ({ hl: document.querySelectorAll('.brick.hl').length, score: __brick.engine.score }));
  console.log('pressed ->', pressed);
  // 2) slide off the board and release: must cancel
  await touch('touchMove', pt.x, 20); await page.waitForTimeout(150); await touch('touchEnd');
  await page.waitForTimeout(500);
  console.log('after cancel ->', await page.evaluate(() => ({ score: __brick.engine.score, hl: document.querySelectorAll('.brick.hl').length })));
  // 3) press + release on the group: pops
  await touch('touchStart', pt.x, pt.y); await page.waitForTimeout(120); await touch('touchEnd');
  await page.waitForTimeout(300);
  console.log('after tap ->', await page.evaluate(() => ({ score: __brick.engine.score, busy: __brick.busy })));
  await page.waitForFunction(() => !__brick.busy, null, { timeout: 15000 });
  // 4) tap on a lone brick: rejected, fuel unchanged
  const lone = await page.evaluate(() => { const a = __brick, e = a.engine; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (!e.plan(r, c)) { const q = a.view.pagePoint(r, c); return { x: q.x, y: q.y }; } return null; });
  if (lone) { const f0 = await page.evaluate(() => __brick.engine.fuel); await page.touchscreen.tap(lone.x, lone.y); await page.waitForTimeout(400); console.log('lone tap fuel', f0, '->', await page.evaluate(() => __brick.engine.fuel)); }
  // 5) idle hint appears
  await page.waitForTimeout(7500);
  console.log('idle hint shown', await page.evaluate(() => document.querySelector('.tap-hint').classList.contains('show')));
  await page.screenshot({ path: process.argv[2] + '/touch-hint.png' });
  console.log('errors', errors);
  await browser.close();
})();
