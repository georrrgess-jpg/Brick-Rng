const { launch, returning, wait, SHOTS, path } = require('./u5lib');
const { capture } = require('./frames');
(async () => {
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1 });
  await returning(page, {});
  const shot = (n, clip) => page.screenshot({ path: path.join(SHOTS, 'ix2-' + n + '.png'), clip });
  // Collection: Mythic filter with no Mythic owned
  await page.evaluate(() => BR.Router.go('collection')); await wait(page, 1500);
  await page.click('.chip-btn[data-rar="mythic"]'); await wait(page, 900); await shot('filter-mythic');
  // complete set: own every fuse
  await page.evaluate(() => { BR.ITEMS.filter((i) => i.type === 'fuse' && !i.isDefault).forEach((i, k) => { if (!BR.Progress.owns(i.id)) BR.Progress.keep({ itemId: i.id, shine: 'plain', seed: k }); }); BR.Router.screens.collection.type = 'fuse'; BR.Router.screens.collection.filter = null; BR.Router.rerender(); }); await wait(page, 1200);
  await page.evaluate(() => document.querySelector('.scroll').scrollTo(0, 99999)); await wait(page, 600); await shot('fuse-complete-bottom');
  // locked sheet -> Go to the Shop: where does it land?
  await page.evaluate(() => { BR.Router.screens.collection.type = 'board'; BR.Router.rerender(); }); await wait(page, 1500);
  await page.evaluate(() => document.querySelector('.scroll').scrollTo(0, 99999)); await wait(page, 600);
  await page.evaluate(() => document.querySelector('.lk[data-locked]').click()); await wait(page, 800);
  await page.evaluate(() => [...document.querySelectorAll('.sheet.on .btn')].find((b) => /Shop/.test(b.textContent)).click()); await wait(page, 1500);
  await shot('locked-to-shop');
  console.log('landed', await page.evaluate(() => ({ screen: BR.Router.current, top: document.querySelector('.screen.on .scroll').scrollTop, boardCardTop: Math.round(document.querySelector('.cc-board').getBoundingClientRect().top) })));
  // Try it
  await page.evaluate(() => { BR.Router.go('collection'); }); await wait(page, 1500);
  await page.evaluate(() => document.querySelector('.scroll').scrollTo(0, 300)); await wait(page, 300);
  await page.evaluate(() => { const c = [...document.querySelectorAll('.icard[data-uid]')].find((x) => x.dataset.uid !== 'default'); c.click(); }); await wait(page, 900);
  await page.evaluate(() => [...document.querySelectorAll('.sheet.on .btn')].find((b) => /Try it/.test(b.textContent)).click()); await wait(page, 2600);
  await shot('tryit');
  console.log('tryit band', await page.evaluate(() => document.querySelector('#msgBand').innerText.replace(/\n+/g, ' | ')));
  await wait(page, 9000); await shot('tryit-after');
  console.log('after tryit', await page.evaluate(() => ({ screen: BR.Router.current, top: document.querySelector('.screen.on .scroll') && document.querySelector('.screen.on .scroll').scrollTop, type: BR.Router.screens.collection.type })));
  // Coin sheet from the Shop: the "Go to the Shop" button
  await page.evaluate(() => BR.Router.go('shop')); await wait(page, 1200);
  await page.click('.coin-btn'); await wait(page, 700); await shot('coins-in-shop');
  console.log('errors', JSON.stringify(errors));
  await browser.close();
  // what's new: a returning player from Update 3
  const b2 = await launch({ width: 393, height: 852, dsf: 1, coach: true, setup: () => { const d = { v: 4, runs: 25, seen: { home: true, whatsnew3: true }, profile: { level: 8, coins: 600 } }; localStorage.setItem('poprush.v4', JSON.stringify(d)); } });
  await wait(b2.page, 1800); await b2.page.screenshot({ path: path.join(SHOTS, 'ix2-whatsnew.png') });
  console.log('whatsnew errors', JSON.stringify(b2.errors));
  await b2.browser.close();
})();
