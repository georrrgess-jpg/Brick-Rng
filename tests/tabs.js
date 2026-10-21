// Screenshots of the five tab screens. Usage: node tests/tabs.js <outdir> [seed profile json file]
const { launch } = require('./lib');
const OUT = process.argv[2];
(async () => {
  const { browser, page, errors } = await launch({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  // stock the profile so screens show realistic content
  await page.evaluate(() => {
    const P = BR.Progress, pr = BR.Storage.data.profile;
    pr.level = 4; pr.xp = 760; pr.coins = 1240; pr.chests = { brick: 2, pop: 0, board: 0, fuse: 0, golden: 1 };
    BR.Storage.data.best.rush = 184520; BR.Storage.data.bestStage.rush = 7; BR.Storage.data.best.daily = 98400; BR.Storage.data.runs = 12;
    pr.stats.bricks = 2210; pr.stats.maxGroup = 14;
    ['f_candy', 'f_marble', 'f_neon', 'f_lava', 'b_ember', 'b_bolt', 'a_deepsea', 'a_orbit', 'u_rope', 'u_neon', 'u_plasma'].forEach((id, i) => P.keep({ itemId: id, shine: ['plain', 'glossy', 'holo', 'prism', 'plain'][i % 5], seed: i * 733 % 10000, counter: i % 4 === 0 ? { stat: 'Bricks popped', value: 420 + i } : null }));
    P.equip(pr.vault.find((i) => i.itemId === 'f_neon').uid); P.equip(pr.vault.find((i) => i.itemId === 'a_orbit').uid);
    pr.trophies = { first_run: 1, first_rush: 1, stage5: 1 };
    BR.Skins.apply(); BR.Router.rerender();
  });
  const names = ['home', 'shop', 'collection', 'missions', 'profile'];
  for (const n of names) {
    await page.evaluate((id) => BR.Router.go(id), n);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${OUT}/t-${n}.png` });
  }
  console.log('errors', errors);
  await browser.close();
})();
