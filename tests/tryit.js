// Try it: ten seconds on a practice board wearing the item from the item sheet. The saved loadout, a saved run and the run counter
// are untouched afterwards. Usage: node tests/tryit.js
const { launch } = require('./lib');
(async () => {
  let problems = 0;
  const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1 });
  await page.evaluate(() => { const st = BR.Storage.data; st.settings.sound = false; st.settings.music = false; st.runs = 12; BR.Progress.keep({ itemId: 'f_lava', shine: 'glossy', seed: 3 }); BR.Router.go('collection'); });
  await page.waitForTimeout(900);
  await page.evaluate(() => BR.Storage.saveRun({ marker: 'real-run' }));
  const before = await page.evaluate(() => JSON.stringify(BR.Storage.data.profile.loadout));
  await page.evaluate(() => { const v = BR.Storage.data.profile.vault.find((x) => x.itemId === 'f_lava'); BR.itemSheet(v.uid, 'skin'); });
  await page.waitForTimeout(900);
  await page.click('.sheet-actions .btn:has-text("Try it")');
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 15000 });
  ok(await page.evaluate(() => BR.Progress.equipped('skin').item.name === 'Magma'), 'the item is not worn during Try it');
  ok(await page.evaluate(() => JSON.stringify(BR.Storage.loadRun()) === '{"marker":"real-run"}'), 'a saved run was overwritten by the practice board');
  await page.waitForFunction(() => BR.Router.current === 'collection', null, { timeout: 20000 });
  ok(await page.evaluate((b) => JSON.stringify(BR.Storage.data.profile.loadout) === b, before), 'the loadout did not come back');
  ok(await page.evaluate(() => JSON.stringify(BR.Storage.loadRun()) === '{"marker":"real-run"}'), 'the saved run is gone after Try it');
  ok(await page.evaluate(() => BR.Storage.data.runs === 12), 'Try it counted as a run');
  ok(errors.length === 0, 'console errors', errors.join('|'));
  await browser.close();
  console.log(problems ? problems + ' PROBLEMS' : 'tryit ok');
  process.exit(problems ? 1 : 0);
})();
