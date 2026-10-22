const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 2 });
  const { page } = L;
  const y = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return BR.dayKey(d); });
  await page.evaluate((y) => { const P = BR.Progress; BR.DROP_ITEMS.filter((x) => BR.rarityById[x.rarity].level >= 3).forEach((x) => P.keep({ itemId: x.id, shine: 'plain', seed: 1 })); P.checkTrophies(); const p = BR.Storage.data.profile; p.streak = { ring: 6, weeks: 0, last: y, shield: 1, best: 6 }; BR.Storage.save(); }, y);
  await H.startRun(page, 'rush');
  await page.evaluate(() => BR.Run.endRun('ended'));
  await page.waitForSelector('.results.on'); await page.waitForTimeout(2600);
  const r = await page.evaluate(() => ({ banner: document.querySelector('.res-banner.streak').textContent, golden: BR.Progress.chestCount('golden') }));
  console.log(r);
  const box = await page.evaluate(() => { const b = document.querySelector('.res-banner.streak').getBoundingClientRect(); return { x: 0, y: b.top - 10, width: 393, height: b.height + 20 }; });
  console.log(await H.shot(page, 'streak_banner', box));
  await L.browser.close();
})();
