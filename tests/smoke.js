const { launch } = require('./lib');
const OUT = process.argv[2];
(async () => {
  const { browser, page, errors } = await launch();
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + '/01-menu.png' });
  await page.click('#btnPlay');
  await page.waitForTimeout(2200);
  await page.screenshot({ path: OUT + '/02-game.png' });
  // hover a group (desktop style) via mouse position computed from engine
  const cell = await page.evaluate(() => {
    const a = window.__brick; const g = a.engine.bestGroup(); const p = g[0];
    const pt = a.view.pagePoint(p.r, p.c); return { x: pt.x, y: pt.y, n: g.length };
  });
  console.log('best group size', cell.n);
  await page.mouse.move(cell.x, cell.y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/03-hover.png' });
  console.log('errors:', errors);
  await browser.close();
})();
