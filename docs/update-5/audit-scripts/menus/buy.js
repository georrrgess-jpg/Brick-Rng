// Buying a chest from the Shop: tap the price, the opening arrives, hold, reveal, Done, back to the Shop.
const { launch, returning, wait, SHOTS, path } = require('./u5lib');
const { capture } = require('./frames');
(async () => {
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1 });
  await returning(page, { chests: { brick: 0, golden: 1 }, coins: 900 });
  await page.evaluate(() => BR.Router.go('shop')); await wait(page, 1500);
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, 'buy-' + n + '.png') });
  // scroll the pop chest into view
  await page.evaluate(() => document.querySelector('.cc-pop').scrollIntoView({ block: 'center' })); await wait(page, 400);
  await shot('0-shop');
  let r = await capture(page, 'buy-tap', () => { const t = Date.now(); document.querySelector('.cc-pop [data-act="open"]').click(); return t; }, { ms: 1500, every: 100, cols: 8, scale: 0.4 });
  console.log('tap', r.n, JSON.stringify(r.gaps));
  await shot('1-arrived');
  const hb = await page.evaluate(() => { const r = document.querySelector('.opening [data-hold]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(hb.x, hb.y); await page.mouse.down(); await wait(page, 1700); await page.mouse.up();
  for (let i = 0; i < 100; i++) { const s = await page.evaluate(() => BR.Openings.current && BR.Openings.current.state); if (s === 'done') break; await wait(page, 150); }
  await wait(page, 600);
  await shot('2-reveal');
  console.log('coins after', await page.evaluate(() => BR.Progress.coins));
  r = await capture(page, 'buy-done', () => { const t = Date.now(); document.querySelector('.rv-actions [data-a="done"]').click(); return t; }, { ms: 1500, every: 100, cols: 8, scale: 0.4 });
  console.log('done', r.n, JSON.stringify(r.gaps));
  await shot('3-back');
  // Golden chest: the picker
  await page.evaluate(() => document.querySelector('.scroll').scrollTo(0, 0)); await wait(page, 300);
  await page.evaluate(() => document.querySelector('.cc-golden [data-act="open"]').click()); await wait(page, 1800);
  await shot('4-golden');
  await page.evaluate(() => BR.Back.closeTop()); await wait(page, 900);
  // not enough Coins
  await page.evaluate(() => { BR.Progress.coins = 120; BR.Storage.save(); BR.Router.rerender(); }); await wait(page, 500);
  await page.evaluate(() => document.querySelector('.cc-board').scrollIntoView({ block: 'center' })); await wait(page, 400);
  await shot('5-short');
  r = await capture(page, 'buy-short', () => { const t = Date.now(); document.querySelector('.cc-board [data-act="open"]').click(); return t; }, { ms: 900, every: 100, cols: 5, scale: 0.5 });
  // a completed chest
  await page.evaluate(() => { BR.ITEMS.filter((i) => i.type === 'fuse' && !i.pass && !i.isDefault).forEach((i, k) => { if (!BR.Progress.owns(i.id)) BR.Progress.keep({ itemId: i.id, shine: 'plain', seed: k }); }); BR.Storage.save(); BR.Router.rerender(); }); await wait(page, 500);
  await page.evaluate(() => document.querySelector('.cc-fuse').scrollIntoView({ block: 'center' })); await wait(page, 400);
  await shot('6-complete');
  await page.evaluate(() => BR.showOdds('fuse')); await wait(page, 900); await shot('7-complete-odds');
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
