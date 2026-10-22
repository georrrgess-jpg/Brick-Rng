const { launch, returning, wait, SHOTS, path } = require('./u5lib');
const { capture } = require('./frames');
(async () => {
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1 });
  await returning(page, { chests: { brick: 0, golden: 0 }, coins: 120 });
  await page.evaluate(() => { BR.Storage.data.profile.pity.pop = 3; BR.Storage.save(); BR.Router.go('shop'); }); await wait(page, 1500);
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, 'buy2-' + n + '.png') });
  await page.evaluate(() => document.querySelector('.cc-pop').scrollIntoView({ block: 'center' })); await wait(page, 400);
  await shot('short');
  let r = await capture(page, 'buy2-short', () => { const t = Date.now(); document.querySelector('.cc-pop [data-act="open"]').click(); return t; }, { ms: 800, every: 100, cols: 5, scale: 0.5, clip: { x: 0, y: 0, width: 393, height: 500 } });
  await page.evaluate(() => BR.showOdds('pop')); await wait(page, 900); await shot('odds-pity');
  const s = await page.evaluate(() => document.querySelector('.sheet.on .odds-sentence').textContent);
  console.log('sentence:', s);
  const pityTxt = await page.evaluate(() => [...document.querySelectorAll('.cc-pop .pity small, .cc-pop .pity')].map((e) => e.getAttribute('aria-label') || e.textContent));
  console.log('pity:', JSON.stringify(pityTxt));
  await page.evaluate(() => BR.Back.closeTop()); await wait(page, 600);
  // coin sheet when you cannot afford anything
  await page.evaluate(() => BR.coinSheet()); await wait(page, 900); await shot('coins-short');
  await page.evaluate(() => BR.Back.closeTop()); await wait(page, 600);
  // fine frames of the cut to black when a chest opens
  await page.evaluate(() => { BR.Storage.data.profile.coins = 900; BR.Storage.save(); BR.Router.rerender(); }); await wait(page, 600);
  r = await capture(page, 'buy2-cut', () => { const t = Date.now(); document.querySelector('.cc-pop [data-act="open"]').click(); return t; }, { ms: 340, every: 20, cols: 9, scale: 0.35 });
  console.log(r.n, JSON.stringify(r.gaps));
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
