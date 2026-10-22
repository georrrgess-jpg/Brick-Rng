// The Boosts sheet before run 4: open from Play, pick, cannot afford, pay and start.
const { launch, returning, wait, SHOTS, path } = require('./u5lib');
const { capture } = require('./frames');
(async () => {
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1 });
  await returning(page, { runs: 3, coins: 40 });
  await wait(page, 1200);
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, 'boost-' + n + '.png') });
  let r = await capture(page, 'boost-open', () => { const t = Date.now(); document.querySelector('.hero').click(); return t; }, { ms: 660, every: 60, cols: 6, scale: 0.4 });
  await shot('0-open');
  await page.click('.boost[data-boost="longFuse"]'); await wait(page, 400); await shot('1-one');
  await page.click('.boost[data-boost="rushStart"]'); await wait(page, 300); await shot('2-short');
  const st = await page.evaluate(() => ({ label: document.querySelector('#goLabel').innerText, sum: document.querySelector('#boSum').innerText, toast: [...document.querySelectorAll('.toast')].map((t) => t.innerText) }));
  console.log(JSON.stringify(st));
  await page.click('.boost[data-boost="headStart"]'); await wait(page, 300); await shot('3-two');
  console.log(await page.evaluate(() => ({ label: document.querySelector('#goLabel').innerText, sum: document.querySelector('#boSum').innerText })));
  r = await capture(page, 'boost-start', () => { const t = Date.now(); document.querySelector('#goBtn').click(); return t; }, { ms: 1500, every: 100, cols: 8, scale: 0.4 });
  console.log('coins after', await page.evaluate(() => BR.Progress.coins));
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
