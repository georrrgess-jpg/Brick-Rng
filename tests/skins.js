const { launch } = require('./lib');
const OUT = process.argv[2];
(async () => {
  const { browser, page, errors } = await launch({ width: 400, height: 800, mobile: true });
  // stock the Vault with everything, at assorted finishes
  await page.evaluate(() => {
    const fin = ['matte', 'gloss', 'holo', 'prism'];
    BR.ITEMS.forEach((it, i) => BR.Progress.keep({ itemId: it.id, finish: 'matte', seed: i * 733 % 10000, tracker: i % 5 === 0 ? { stat: BR.ITEM_TYPES[it.type].tracker, value: i * 311 } : null }));
    BR.Storage.data.profile.shards = 480; BR.Storage.data.profile.xp = 320;
    __brick.ui.refreshMenu();
  });
  await page.click('#btnPlay');
  await page.waitForFunction(() => !__brick.busy, null, { timeout: 8000 });
  await page.evaluate(() => { __brick.store.data.seenTutorial = true; __brick.ui.hideHint(); __brick.view.hideHint(); });
  const facets = await page.evaluate(() => BR.ITEMS.filter((i) => i.type === 'facet').map((i) => i.id));
  const rect = await page.evaluate(() => { const r = document.getElementById('board').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  for (const fid of facets) {
    for (const fin of ['matte', 'holo']) {
      await page.evaluate(([id, f]) => { const inst = BR.Storage.data.profile.vault.find((i) => i.itemId === id); inst.finish = f; BR.Progress.equip(inst.uid); BR.Skins.apply(); }, [fid, fin]);
      await page.waitForTimeout(350);
      if (fin === 'matte' || fid === 'f_candy') await page.screenshot({ path: `${OUT}/sk-${fid}-${fin}.png`, clip: rect });
    }
  }
  console.log('errors', errors);
  await browser.close();
})();
