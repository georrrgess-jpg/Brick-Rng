const { launch } = require('./lib');
const OUT = process.argv[2];
(async () => {
  const { browser, page, errors } = await launch({ width: 400, height: 800, mobile: true });
  const waitIdle = () => page.waitForFunction(() => !__brick.busy || __brick.modal, null, { timeout: 20000 });
  await page.click('#btnPlay');
  await page.waitForFunction(() => !__brick.busy, null, { timeout: 8000 });
  await page.evaluate(() => { __brick.store.data.seenTutorial = true; });
  const best = () => page.evaluate(() => { const a = __brick, g = a.engine.bestGroup(), q = a.view.pagePoint(g[0].r, g[0].c); return { x: q.x, y: q.y }; });

  // --- booster: arm hammer and hover
  await page.click('.bslot[data-b="hammer"]'); await page.waitForTimeout(300);
  let q = await page.evaluate(() => { const q = __brick.view.pagePoint(3, 3); return q; });
  await page.mouse.move(q.x, q.y); await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/f1-aim.png' });
  await page.mouse.click(q.x, q.y); await page.waitForTimeout(450);
  await page.screenshot({ path: OUT + '/f2-hammer.png' });
  await waitIdle(); await page.waitForTimeout(600);
  console.log('after hammer', await page.evaluate(() => ({ score: __brick.engine.score, moves: __brick.engine.movesLeft, inv: __brick.engine.inv })));

  // --- round clear
  await page.evaluate(() => { const e = __brick.engine; e.roundScore = e.goal - 5; e.movesLeft = 9; __brick.syncHud(false); __brick.engine.rng.int(1); });
  q = await best(); await page.mouse.click(q.x, q.y);
  await page.waitForFunction(() => document.getElementById('roundclear').classList.contains('show'), null, { timeout: 20000 });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: OUT + '/f3-roundclear.png' });
  await page.click('#btnNextRound'); await page.waitForTimeout(1600);
  await page.screenshot({ path: OUT + '/f4-round2.png' });
  console.log('round2', await page.evaluate(() => ({ round: __brick.engine.round, moves: __brick.engine.movesLeft, goal: __brick.engine.goal, level: BR.Progress.level, geodes: BR.Progress.geodeCount() })));

  // --- game over
  await waitIdle();
  await page.evaluate(() => { const e = __brick.engine; e.movesLeft = 1; e.roundScore = 0; __brick.syncHud(false); });
  q = await best(); await page.mouse.click(q.x, q.y);
  await page.waitForFunction(() => document.getElementById('gameover').classList.contains('show'), null, { timeout: 20000 });
  await page.waitForTimeout(3800);
  await page.screenshot({ path: OUT + '/f5-gameover.png' });
  console.log('best', await page.evaluate(() => __brick.store.data.best), 'level', await page.evaluate(() => BR.Progress.level));
  console.log('errors', errors);
  await browser.close();
})();
