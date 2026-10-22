const { launch, returning, wait } = require('./u5lib');
const { capture } = require('./frames');
(async () => {
  const { browser, page } = await launch({ width: 393, height: 852, dsf: 1 });
  await returning(page, { chests: { brick: 2, golden: 1 } });
  await wait(page, 1200);
  for (const [a, b] of [['home', 'shop'], ['shop', 'profile'], ['profile', 'missions']]) {
    await page.evaluate((a) => BR.Router.go(a), a); await wait(page, 1400);
    const r = await capture(page, `tabfine-${a}-${b}`, eval(`(() => { const t = Date.now(); document.querySelector('#tabbar .tab[data-tab="${b}"]').click(); return t; })`), { ms: 255, every: 17, cols: 8, scale: 0.45 });
    console.log(a, b, r.n, JSON.stringify(r.gaps));
  }
  await browser.close();
})();
