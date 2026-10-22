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
  // Update 5 (M-I6): the practice board ends on the item sheet it came from, so the player can equip what they just tried
  await page.waitForSelector('.sheet.detail-sheet.on', { timeout: 5000 }).catch(() => {});
  ok(await page.evaluate(() => { const t = document.querySelector('.sheet.detail-sheet.on h2'); return !!t && t.textContent === 'Magma'; }), 'Try it did not return to the item sheet');
  await page.evaluate(() => BR.Back.closeTop()); await page.waitForTimeout(600);
  ok(await page.evaluate((b) => JSON.stringify(BR.Storage.data.profile.loadout) === b, before), 'the loadout did not come back');
  ok(await page.evaluate(() => JSON.stringify(BR.Storage.loadRun()) === '{"marker":"real-run"}'), 'the saved run is gone after Try it');
  ok(await page.evaluate(() => BR.Storage.data.runs === 12), 'Try it counted as a run');

  // Update 5: practice is a look, not a run. From every way out (Pause, Stop; the API calls Restart used to reach) nothing is paid,
  // counted, saved or left equipped.
  const snap = () => page.evaluate(() => ({ coins: BR.Storage.data.profile.coins, runs: BR.Storage.data.runs, lo: JSON.stringify(BR.Storage.data.profile.loadout), run: JSON.stringify(BR.Storage.loadRun()), xp: BR.Storage.data.profile.xp + ':' + BR.Storage.data.profile.level }));
  const was = await snap();
  await page.evaluate(() => { const v = BR.Storage.data.profile.vault.find((x) => x.itemId === 'f_lava'); BR.itemSheet(v.uid, 'skin'); });
  await page.waitForTimeout(800);
  await page.click('.sheet-actions .btn:has-text("Try it")');
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 15000 });
  const tap = await page.evaluate(() => { const e = BR.Run.engine; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (e.plan(r, c)) return BR.Run.view.pagePoint(r, c); });
  await page.mouse.click(tap.x, tap.y); await page.waitForTimeout(900);
  await page.click('#btnPause'); await page.waitForTimeout(700);
  ok(await page.evaluate(() => !document.querySelector('.sheet [data-p="restart"]') && !document.querySelector('.sheet [data-p="leave"]') && !!document.querySelector('.sheet [data-p="stop"]')), 'the practice pause sheet still offers Restart or Save and leave');
  // the calls Restart made are harmless on a practice board
  await page.evaluate(() => BR.Run.bankSilently());
  { const m = await snap(); ok(m.coins === was.coins && m.runs === was.runs && m.xp === was.xp, 'bankSilently paid or counted a practice board', JSON.stringify(was), JSON.stringify(m)); }
  await page.click('.sheet [data-p="stop"]');
  await page.waitForFunction(() => BR.Router.current === 'collection', null, { timeout: 10000 });
  await page.waitForSelector('.sheet.detail-sheet.on', { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => BR.Back.closeTop()); await page.waitForTimeout(600);
  const after = await snap();
  ok(after.coins === was.coins && after.runs === was.runs && after.lo === was.lo && after.run === was.run && after.xp === was.xp, 'Stop trying it changed Coins, runs, XP, the loadout or the saved run', JSON.stringify(was), JSON.stringify(after));

  ok(errors.length === 0, 'console errors', errors.join('|'));
  await browser.close();
  console.log(problems ? problems + ' PROBLEMS' : 'tryit ok');
  process.exit(problems ? 1 : 0);
})();
