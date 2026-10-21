const { launch } = require('./lib');
(async () => {
  const { browser, page, errors } = await launch({ width: 400, height: 780, mobile: true });
  await page.click('#btnPlay');
  await page.waitForFunction(() => !__brick.busy, null, { timeout: 15000 });
  await page.evaluate(() => { __brick.store.data.seenTutorial = true; __brick.engine.goal = 1e9; });
  const pt = await page.evaluate(() => { const a = __brick; const g = a.engine.bestGroup(); const q = a.view.pagePoint(g[0].r, g[0].c); return { x: q.x, y: q.y }; });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', pt.x, pt.y); await page.waitForTimeout(250);
  console.log('pressed ->', await page.evaluate(() => ({ hl: document.querySelectorAll('.brick.hl').length, score: __brick.engine.score, chip: document.querySelector('.chip').classList.contains('show') })));
  await touch('touchMove', pt.x, 20); await page.waitForTimeout(150); await touch('touchEnd'); await page.waitForTimeout(500);
  console.log('after cancel ->', await page.evaluate(() => ({ score: __brick.engine.score, moves: __brick.engine.movesLeft, hl: document.querySelectorAll('.brick.hl').length })));
  await touch('touchStart', pt.x, pt.y); await page.waitForTimeout(120); await touch('touchEnd'); await page.waitForTimeout(300);
  console.log('after tap ->', await page.evaluate(() => ({ score: __brick.engine.score, moves: __brick.engine.movesLeft })));
  await page.waitForFunction(() => !__brick.busy, null, { timeout: 15000 });
  const lone = await page.evaluate(() => { const a = __brick, e = a.engine; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (!e.plan(r, c)) { const q = a.view.pagePoint(r, c); return { x: q.x, y: q.y }; } return null; });
  if (lone) { const m0 = await page.evaluate(() => __brick.engine.movesLeft); await page.touchscreen.tap(lone.x, lone.y); await page.waitForTimeout(400); console.log('lone tap moves', m0, '->', await page.evaluate(() => __brick.engine.movesLeft)); }
  // booster by touch: arm hammer, tap board
  await page.touchscreen.tap(...(await page.evaluate(() => { const b = document.querySelector('.bslot[data-b="hammer"]').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })));
  await page.waitForTimeout(300);
  console.log('armed', await page.evaluate(() => __brick.armed));
  const q = await page.evaluate(() => { const c = __brick.view.pagePoint(4, 4); return [c.x, c.y]; });
  await page.touchscreen.tap(...q); await page.waitForTimeout(1200);
  console.log('hammer used', await page.evaluate(() => ({ armed: __brick.armed, inv: __brick.engine.inv.hammer, moves: __brick.engine.movesLeft })));
  await page.waitForFunction(() => !__brick.busy, null, { timeout: 15000 });
  await page.waitForTimeout(7500);
  console.log('idle hint shown', await page.evaluate(() => document.querySelector('.tap-hint').classList.contains('show') && document.querySelectorAll('.brick.hinting').length > 1));
  console.log('errors', errors);
  await browser.close();
})();
