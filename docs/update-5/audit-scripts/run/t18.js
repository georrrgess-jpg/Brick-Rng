const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 1, runs: 12 });
  const { page } = L;
  const before = await page.evaluate(() => { BR.Progress.keep({ itemId: 'f_lava', shine: 'glossy', seed: 3 }); BR.Storage.saveRun({ marker: 'real-run' }); return { loadout: JSON.stringify(BR.Storage.data.profile.loadout), runs: BR.Storage.data.runs, coins: BR.Progress.coins }; });
  await page.evaluate(() => { const v = BR.Storage.data.profile.vault.find((x) => x.itemId === 'f_lava'); BR.Run.practiceItem(BR.itemById.f_lava, v); });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 15000 });
  const g = await page.evaluate(() => BR.Run.engine.bestGroup()); await H.tap(page, g[0].r, g[0].c); await H.idle(page);
  await page.click('#btnPause'); await page.waitForTimeout(500);
  await page.click('[data-p="restart"]');
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 15000 });
  await page.waitForTimeout(11000);
  const after = await page.evaluate(() => ({ loadout: JSON.stringify(BR.Storage.data.profile.loadout), equippedSkin: BR.Progress.equipped('skin').item.name, runs: BR.Storage.data.runs, coins: BR.Progress.coins, savedRun: JSON.stringify(BR.Storage.loadRun() || null).slice(0, 40), route: BR.Router.current, practice: !!BR.Run.practice, hint: document.getElementById('hint').textContent }));
  console.log('before', before); console.log('after', after);
  await L.browser.close();
})();
