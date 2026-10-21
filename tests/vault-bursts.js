const { launch } = require('./lib');
const OUT = process.argv[2];
(async () => {
  const { browser, page, errors } = await launch({ width: 400, height: 800, mobile: true });
  await page.evaluate(() => {
    const fin = ['matte', 'gloss', 'holo', 'prism', 'matte'];
    BR.ITEMS.forEach((it, i) => { BR.Progress.keep({ itemId: it.id, finish: fin[i % 5], seed: i * 733 % 10000, tracker: i % 5 === 0 ? { stat: BR.ITEM_TYPES[it.type].tracker, value: i * 311 } : null }); });
    for (let k = 0; k < 6; k++) BR.Progress.keep({ itemId: 'f_slate', finish: 'matte', seed: k, tracker: null });
    BR.Storage.data.profile.shards = 480; BR.Storage.data.profile.xp = 320; BR.Storage.data.profile.geodes = { normal: 2, series: 1 };
    BR.Progress.equip(BR.Storage.data.profile.vault.find((i) => i.itemId === 'f_neon').uid); BR.Skins.apply();
    __brick.ui.refreshMenu();
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/v0-menu.png' });
  await page.click('#btnVault'); await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '/v1-facets.png' });
  await page.click('#vaultTabs button[data-tab="burst"]'); await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/v2-bursts.png' });
  await page.click('#vaultTabs button[data-tab="arena"]'); await page.waitForTimeout(900);
  await page.screenshot({ path: OUT + '/v3-arenas.png' });
  await page.click('#vaultTabs button[data-tab="fusion"]'); await page.waitForTimeout(700);
  for (let k = 0; k < 5; k++) { await page.locator('#vaultGrid .vcard:has-text("Slate Tile")').nth(k).click(); await page.waitForTimeout(80); }
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/v4-fusion.png' });
  await page.click('#btnVaultBack'); await page.waitForTimeout(400);

  // bursts mid-pop
  await page.click('#btnPlay');
  await page.waitForFunction(() => !__brick.busy, null, { timeout: 8000 });
  await page.evaluate(() => { __brick.store.data.seenTutorial = true; __brick.ui.hideHint(); __brick.view.hideHint(); });
  const bursts = ['b_ember', 'b_petal', 'b_glass', 'b_pixel', 'b_bolt'];
  for (const bid of bursts) {
    await page.evaluate((id) => { const inst = BR.Storage.data.profile.vault.find((i) => i.itemId === id); BR.Progress.equip(inst.uid); BR.Skins.apply(); }, bid);
    await page.waitForFunction(() => !__brick.busy, null, { timeout: 8000 });
    const q = await page.evaluate(() => { const a = __brick; a.engine.roundScore = 0; a.engine.movesLeft = 20; const g = a.engine.bestGroup(), p = g[Math.floor(g.length / 2)], c = a.view.pagePoint(p.r, p.c); return { x: c.x, y: c.y }; });
    await page.mouse.click(q.x, q.y);
    await page.waitForTimeout(140);
    await page.screenshot({ path: `${OUT}/b-${bid}.png`, clip: { x: 0, y: 130, width: 400, height: 460 } });
    await page.waitForTimeout(1200);
  }
  console.log('errors', errors);
  await browser.close();
})();
