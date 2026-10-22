const { launch, returning, wait } = require('./u5lib');
(async () => {
  const { browser, page } = await launch({ width: 393, height: 852, dsf: 1 });
  await returning(page, {});
  await page.evaluate(() => { const st = BR.Storage.data; st.lastDay = '2020-01-01'; st.profile.streak = { ring: 1, weeks: 0, last: BR.dayKey(new Date(Date.now() - 864e5)), shield: 1, best: 1 }; BR.Storage.save(); });
  const b = await page.evaluate(() => ({ coins: BR.Progress.coins, xp: BR.Storage.data.profile.xp, runs: BR.Storage.data.runs }));
  await page.evaluate(() => { BR.Storage.clearRun(); __app.startRun({ mode: 'rush', boosts: {} }); });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 15000 });
  await page.evaluate(() => BR.Run.pause()); await wait(page, 500);
  await page.locator('.sheet [data-p="end"]').click(); await wait(page, 500);
  await page.locator('.sheet.on .btn:has-text("End run")').last().click(); await wait(page, 4500);
  const a = await page.evaluate(() => ({ coins: BR.Progress.coins, xp: BR.Storage.data.profile.xp, runs: BR.Storage.data.runs, streak: BR.Storage.data.profile.streak.ring, score: document.querySelector('#resScore').textContent, rows: [...document.querySelectorAll('.res-card')].map((c) => c.innerText.replace(/\n+/g, ' | ')), banners: [...document.querySelectorAll('.res-banner')].map((x) => x.innerText.replace(/\n+/g, ' ')) }));
  console.log(JSON.stringify(b), JSON.stringify(a, null, 1));
  await browser.close();
})();
