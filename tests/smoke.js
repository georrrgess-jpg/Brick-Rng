const { launch } = require('./lib');
const OUT = process.argv[2];
(async () => {
  const { browser, page, errors } = await launch({ width: 400, height: 800 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/u1-menu.png' });
  await page.click('#btnPlay');
  await page.waitForTimeout(2600);
  await page.screenshot({ path: OUT + '/u1-game.png' });
  const info = await page.evaluate(() => { const a = __brick; const g = a.engine.bestGroup(); const q = a.view.pagePoint(g[0].r, g[0].c); return { x: q.x, y: q.y, n: g.length, moves: a.engine.movesLeft }; });
  await page.mouse.move(info.x, info.y); await page.waitForTimeout(250);
  await page.screenshot({ path: OUT + '/u1-hover.png' });
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(1800);
  console.log(await page.evaluate(() => ({ score: __brick.engine.score, moves: __brick.engine.movesLeft, busy: __brick.busy, bricks: document.querySelectorAll('#field .brick').length })));
  console.log('errors', errors);
  await browser.close();
})();
