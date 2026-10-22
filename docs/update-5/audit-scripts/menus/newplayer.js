// A brand-new player at 393x852 with help on: Welcome card, Home, each tab's banner, the Pass card, the first chest card.
const { launch, shotScroll, wait, SHOTS, path } = require('./u5lib');
(async () => {
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1, coach: true });
  await page.evaluate(() => { BR.Storage.data.settings.sound = false; BR.Storage.data.settings.music = false; });
  await wait(page, 1600);
  await page.screenshot({ path: path.join(SHOTS, 'np-home-welcome.png') });
  const state = await page.evaluate(() => ({ depth: BR.Back.depth, seen: BR.Storage.data.seen, coins: BR.Progress.coins, chests: BR.Storage.data.profile.chests }));
  console.log(JSON.stringify(state));
  await page.evaluate(() => BR.Back.closeTop()); await wait(page, 700);
  await shotScroll(page, 'np-home');
  for (const s of ['shop', 'collection', 'missions', 'profile']) {
    await page.evaluate((s) => BR.Router.go(s), s); await wait(page, 1500);
    await shotScroll(page, 'np-' + s);
    console.log(s, 'depth', await page.evaluate(() => BR.Back.depth));
  }
  await page.evaluate(() => { BR.Router.screens.missions.tab = 'pass'; BR.Router.go('missions'); BR.Router.rerender(); BR.Coach.onScreen('missions'); }); await wait(page, 1500);
  await page.screenshot({ path: path.join(SHOTS, 'np-pass-card.png') });
  await page.evaluate(() => BR.Back.closeTop()); await wait(page, 700);
  await shotScroll(page, 'np-pass');
  console.log('errors', errors);
  await browser.close();
})();
