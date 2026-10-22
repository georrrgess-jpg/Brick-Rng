const { launch, returning, wait, SHOTS, path } = require('./u5lib');
const { capture } = require('./frames');
(async () => {
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1 });
  await returning(page, { chests: { brick: 1, golden: 0 } });
  const endRun = async () => {
    await page.evaluate(() => { __app.startRun({ mode: 'rush', boosts: {} }); });
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 15000 });
    const q = await page.evaluate(() => { const e = BR.Run.engine, v = BR.Run.view; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (e.plan(r, c)) return v.pagePoint(r, c); });
    await page.mouse.click(q.x, q.y); await wait(page, 800);
    await page.evaluate(() => BR.Run.endRun('ended')); await wait(page, 4800);
  };
  await endRun();
  let r = await capture(page, 'res-home', () => { const t = Date.now(); document.querySelector('.results [data-r="home"]').click(); return t; }, { ms: 900, every: 60, cols: 8, scale: 0.4 });
  await wait(page, 600);
  await endRun();
  r = await capture(page, 'res-chests', () => { const t = Date.now(); document.querySelector('.results [data-r="shop"]').click(); return t; }, { ms: 1800, every: 100, cols: 10, scale: 0.35 });
  console.log('after Chests:', await page.evaluate(() => ({ screen: BR.Router.current, opening: !!(BR.Openings.current && !BR.Openings.current.closed) })));
  await page.evaluate(() => BR.Back.closeTop()); await wait(page, 900);
  await endRun();
  r = await capture(page, 'res-again', () => { const t = Date.now(); document.querySelector('.results [data-r="again"]').click(); return t; }, { ms: 900, every: 60, cols: 8, scale: 0.4 });
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
