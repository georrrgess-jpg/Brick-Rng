const { launch, returning, wait } = require('./u5lib');
(async () => {
  const { browser, page } = await launch({ width: 393, height: 852, dsf: 1 });
  await returning(page, { level: 8, coins: 900 });
  const r = await page.evaluate(() => {
    const st = BR.Storage.data; st.bestStage.rush = 5;
    // no streak candidate, no chest candidate (coins enough), pass milestone far
    st.profile.streak = { ring: 0, weeks: 0, last: '', shield: 1, best: 0 };
    const out = {};
    for (const lv of [8, 9, 10, 11, 12]) { st.profile.level = lv; out[lv] = BR.nextGoal({ stage: 4 }); }
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
