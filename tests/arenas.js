const { launch } = require('./lib');
const OUT = process.argv[2];
(async () => {
  const { browser, page, errors } = await launch({ width: 400, height: 800, mobile: true });
  await page.evaluate(() => {
    BR.ITEMS.forEach((it, i) => BR.Progress.keep({ itemId: it.id, finish: 'matte', seed: i * 733 % 10000, tracker: null }));
    __brick.ui.refreshMenu();
  });
  await page.click('#btnVault'); await page.waitForTimeout(1100);
  await page.screenshot({ path: OUT + '/w1-vault-facets.png' });
  await page.click('#btnVaultBack');
  await page.click('#btnPlay');
  await page.waitForFunction(() => !__brick.busy, null, { timeout: 8000 });
  await page.evaluate(() => { __brick.store.data.seenTutorial = true; __brick.ui.hideHint(); __brick.view.hideHint(); });
  const arenas = ['a_deepsea', 'a_foundry', 'a_market', 'a_orbit', 'a_greenhouse'];
  for (const id of arenas) {
    await page.evaluate((i) => { const inst = BR.Storage.data.profile.vault.find((x) => x.itemId === i); BR.Progress.equip(inst.uid); BR.Skins.apply(); }, id);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/ar-${id}.png` });
  }
  console.log('errors', errors);
  await browser.close();
})();
