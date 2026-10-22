const { launch, returning, wait } = require('./u5lib');
const { capture } = require('./frames');
(async () => {
  const { browser, page } = await launch({ width: 393, height: 852, dsf: 1 });
  await returning(page, {});
  await page.evaluate(() => { BR.Storage.data.settings.reduced = true; BR.App.applySettings(); }); await wait(page, 800);
  let r = await capture(page, 'red-tab-home-profile', () => { const t = Date.now(); BR.Router.go('profile'); return t; }, { ms: 720, every: 60, cols: 7, scale: 0.4 });
  console.log(r.n, JSON.stringify(r.gaps));
  r = await capture(page, 'red-sheet', () => { const t = Date.now(); BR.coinSheet(); return t; }, { ms: 300, every: 50, cols: 7, scale: 0.4 });
  await browser.close();
})();
