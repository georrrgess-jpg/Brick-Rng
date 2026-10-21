// Screenshots of the sheets: odds, item details, run setup, pass, trophies, trade-up, settings. Usage: node tests/sheets.js <outdir>
const { launch } = require('./lib');
const fs = require('fs'); const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const { browser, page, errors } = await launch({ width: 390, height: 844, dsf: 1 });
  await page.evaluate(() => {
    const P = BR.Progress, pr = BR.Storage.data.profile;
    BR.Storage.data.settings.sound = false; BR.Storage.data.seenTutorial = true; BR.Storage.data.runs = 5;
    pr.level = 6; pr.coins = 1840; pr.chests = { brick: 2, pop: 1, board: 0, fuse: 0, golden: 1 }; pr.passTier = 5; pr.xp = 300;
    ['f_candy', 'f_slate', 'f_candy', 'f_slate', 'f_candy', 'f_marble', 'f_neon', 'f_lava', 'f_nova', 'b_ember', 'b_bolt', 'b_fire', 'a_deepsea', 'a_orbit', 'a_holo', 'u_rope', 'u_neon', 'u_dragon'].forEach((id, i) => P.keep({ itemId: id, shine: ['plain', 'glossy', 'holo', 'prism', 'plain'][i % 5], seed: i * 733 % 10000, counter: i % 4 === 0 ? { stat: 'Bricks popped', value: 420 + i } : null }));
    P.equip(pr.vault.find((i) => i.itemId === 'f_neon').uid);
    BR.Skins.apply(); BR.Router.rerender();
  });
  const shot = async (n, wait = 900) => { await page.waitForTimeout(wait); await page.screenshot({ path: `${OUT}/${n}.png` }); };
  const closeTop = async () => { await page.evaluate(() => BR.Back.closeTop()); await page.waitForTimeout(600); };
  await page.evaluate(() => BR.Router.go('shop')); await page.waitForTimeout(900);
  await page.evaluate(() => BR.showOdds('brick')); await shot('odds');
  await page.evaluate(() => { document.querySelector('.sheet .odds-more')?.click(); }); await shot('odds_inside'); await closeTop();
  await page.evaluate(() => BR.Router.go('collection')); await page.waitForTimeout(900);
  for (const [type, id] of [['skin', 'f_lava'], ['pop', 'b_fire'], ['board', 'a_holo'], ['fuse', 'u_dragon']]) {
    await page.evaluate((id) => BR.itemSheet(BR.Storage.data.profile.vault.find((v) => v.itemId === id).uid), id); await shot('item_' + type, 1400); await closeTop();
  }
  await page.evaluate(() => BR.Router.go('home')); await page.waitForTimeout(900);
  await page.evaluate(() => BR.readySheet('rush')); await shot('ready'); await closeTop();
  await page.evaluate(() => BR.Router.go('missions')); await page.waitForTimeout(900);
  await page.evaluate(() => { const t = Array.from(document.querySelectorAll('#s-missions .seg button')); t[1] && t[1].click(); }); await shot('pass', 1200);
  await page.evaluate(() => { const t = Array.from(document.querySelectorAll('#s-missions .seg button')); t[2] && t[2].click(); }); await shot('trophies', 1200);
  await page.evaluate(() => BR.Router.go('profile')); await page.waitForTimeout(900);
  await page.evaluate(() => { document.querySelector('#s-profile .scroll').scrollTop = 600; }); await shot('profile_settings');
  console.log(errors.filter((e) => !/Failed to load resource/.test(e)));
  await browser.close();
})();
