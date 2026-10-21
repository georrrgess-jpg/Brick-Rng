const { launch } = require('./lib');
const OUT = process.argv[2];
const ITEM = process.argv[3] || 'f_lava';
const FINISH = process.argv[4] || 'holo';
(async () => {
  const { browser, page, errors } = await launch({ width: 400, height: 800, mobile: true });
  await page.evaluate(([item, finish]) => {
    const it = BR.itemById[item];
    BR.Progress.openGeode = function () { // keep real consume behaviour, force the drop
      const p = BR.Storage.data.profile; p.geodes.normal--; p.opened++;
      return { itemId: item, type: it.type, rarity: it.rarity, finish, seed: 4242, tracker: { stat: BR.ITEM_TYPES[it.type].tracker, value: 0 }, kind: 'normal', dup: false };
    };
  }, [ITEM, FINISH]);
  await page.click('#btnGeodes');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/g1-idle.png` });
  await page.click('#geodeBtn', { force: true }); await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/g2-tap1.png` });
  await page.click('#geodeBtn', { force: true }); await page.waitForTimeout(450);
  await page.click('#geodeBtn', { force: true }); await page.waitForTimeout(260);
  await page.screenshot({ path: `${OUT}/g3-shatter.png` });
  await page.waitForTimeout(3300);
  await page.screenshot({ path: `${OUT}/g4-reel.png` });
  await page.waitForFunction(() => document.getElementById('result').classList.contains('on'), null, { timeout: 20000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/g5-result.png` });
  await page.click('#btnEquip');
  await page.waitForTimeout(1400);
  console.log(await page.evaluate(() => ({ eq: BR.Progress.equipped('facet').item.name + '/' + BR.Progress.equipped('burst').item.name + '/' + BR.Progress.equipped('arena').item.name, vault: BR.Storage.data.profile.vault.length, geodes: BR.Progress.geodeCount(), overlayShown: document.getElementById('geode').classList.contains('show'), root: document.documentElement.className })));
  await page.screenshot({ path: `${OUT}/g6-after.png` });
  console.log('errors', errors);
  await browser.close();
})();
