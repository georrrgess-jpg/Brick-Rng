const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 1 });
  const { page } = L;
  await page.evaluate(() => { const P = BR.Progress; BR.DROP_ITEMS.filter((x) => x.type === 'fuse').forEach((x) => P.keep({ itemId: x.id, shine: 'plain', seed: 1 })); BR.Router.go('collection', { instant: true }); });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#colSeg [data-type="fuse"]').click());
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => Array.from(document.querySelectorAll('.bdg.t-fuse')).slice(0, 4).map((b) => { const br = b.getBoundingClientRect(), m = b.querySelector('.mini-fuse').getBoundingClientRect(), bomb = b.querySelector('.mf-bomb').getBoundingClientRect(), cs = getComputedStyle(b); return { badge: [br.left, br.top, br.width].map(Math.round), mini: [m.left, m.top, m.width, m.height].map(Math.round), bomb: [bomb.left, bomb.top, bomb.width].map(Math.round), overflow: cs.overflow, contain: cs.contain, inCard: b.parentElement.className }; }));
  console.log(JSON.stringify(r, null, 1));
  await L.browser.close();
})();
