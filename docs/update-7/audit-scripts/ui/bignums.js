// Layout under growing numbers at 320x568 and 360x640: a six-digit Coin balance in the status bar, a big chest count on the Shop tab,
// a long name. Prints whether the title still fits and where the pill ends; screenshots the status bar on each tab.
// Usage: node bignums.js
const { launch, player, wait, SHOTS, path } = require('./lib');
(async () => {
  for (const [w, h] of [[320, 568], [360, 640]]) {
    const { browser, page } = await launch({ width: w, height: h, dsf: 2 });
    for (const coins of [900, 12345, 123456]) {
      await player(page, { coins, chests: { brick: 12, golden: 3 } });
      for (const t of ['shop', 'collection', 'missions', 'profile']) {
        await page.evaluate((t) => BR.Router.go(t), t); await wait(page, 700);
        const r = await page.evaluate(() => { const e = document.getElementById('tbTitle'), c = document.getElementById('tbCoins').getBoundingClientRect(); return { title: e.textContent, fits: e.scrollWidth <= e.clientWidth + 1, titleW: e.clientWidth, need: e.scrollWidth, pillW: Math.round(c.width), pillRight: Math.round(c.right) }; });
        console.log(w, coins, t, JSON.stringify(r));
        if (t === 'collection' || t === 'missions') await page.screenshot({ path: path.join(SHOTS, `bignum-${w}-${coins}-${t}.png`), clip: { x: 0, y: 0, width: w, height: 70 } });
      }
    }
    await browser.close();
  }
})();
