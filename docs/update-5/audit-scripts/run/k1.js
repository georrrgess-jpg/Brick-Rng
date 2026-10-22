const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 2 });
  const { page } = L;
  await page.evaluate(() => { const P = BR.Progress; BR.DROP_ITEMS.forEach((x, i) => P.keep({ itemId: x.id, shine: ['plain', 'glossy', 'holo', 'prism'][i % 4], seed: 100 + i })); BR.Storage.save(); });
  for (const t of ['skin', 'pop', 'board', 'fuse']) {
    await page.evaluate((t) => { BR.Router.go('collection', { instant: true }); }, t);
    await page.waitForTimeout(400);
    await page.evaluate((t) => { const b = document.querySelector(`#colSeg [data-type="${t}"]`); if (b) b.click(); }, t);
    await page.waitForTimeout(1200);
    console.log(await H.shot(page, `col_${t}`));
  }
  // one item sheet for a fuse
  await page.evaluate(() => { const c = document.querySelector('.scroll [data-uid], .scroll .col-card, .scroll .card-item'); if (c) c.click(); });
  await page.waitForTimeout(900);
  console.log(await H.shot(page, 'col_fuse_sheet'));
  console.log(L.errors);
  await L.browser.close();
})();
