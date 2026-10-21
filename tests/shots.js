// Screenshots of every screen at several viewports for layout review.
// Usage: node tests/shots.js <outdir> [WxH,WxH,...]
const { launch } = require('./lib');
const fs = require('fs');
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const SIZES = (process.argv[3] || '360x640,390x844,430x932,768x1024,844x390,1280x800').split(',').map((s) => s.split('x').map(Number));
(async () => {
  for (const [w, h] of SIZES) {
    const mobile = w < 800;
    const { browser, page, errors } = await launch({ width: w, height: h, dsf: 1, mobile });
    const tag = `${w}x${h}`;
    await page.evaluate(() => {
      const P = BR.Progress, pr = BR.Storage.data.profile;
      BR.Storage.data.settings.sound = false; BR.Storage.data.seenTutorial = true; BR.Storage.data.runs = 5;
      pr.level = 6; pr.xp = 900; pr.coins = 1840; pr.chests = { brick: 2, pop: 1, board: 0, fuse: 0, golden: 1 }; pr.passTier = 5;
      BR.Storage.data.best.rush = 184520; BR.Storage.data.bestStage.rush = 7;
      ['f_candy', 'f_marble', 'f_neon', 'f_lava', 'f_nova', 'b_ember', 'b_bolt', 'a_deepsea', 'a_orbit', 'u_rope', 'u_neon', 'u_plasma'].forEach((id, i) => P.keep({ itemId: id, shine: ['plain', 'glossy', 'holo', 'prism', 'plain'][i % 5], seed: i * 733 % 10000, counter: i % 4 === 0 ? { stat: 'Bricks popped', value: 420 + i } : null }));
      P.equip(pr.vault.find((i) => i.itemId === 'f_neon').uid); P.equip(pr.vault.find((i) => i.itemId === 'a_orbit').uid);
      BR.Skins.apply(); BR.Router.rerender();
    });
    for (const n of ['home', 'shop', 'collection', 'missions', 'profile']) {
      await page.evaluate((id) => BR.Router.go(id), n); await page.waitForTimeout(1300);
      await page.screenshot({ path: `${OUT}/${n}_${tag}.png` });
    }
    // run screen
    await page.evaluate(() => { __app.startRun({ mode: 'rush', boosts: {} }); });
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/run_${tag}.png` });
    // pause menu
    await page.click('#btnPause'); await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/pause_${tag}.png` });
    await page.evaluate(() => { document.querySelector('.sheet .btn')?.click(); });
    await page.waitForTimeout(500);
    await page.evaluate(() => { BR.Run.endRun('quit'); });
    await page.waitForSelector('.results.on', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(4200); await page.screenshot({ path: `${OUT}/results_${tag}.png` });
    await page.evaluate(() => { BR.Run.closeResults('home'); }); await page.waitForTimeout(800);
    // chest arrival + a forced Epic reveal
    await page.evaluate(() => { BR.Router.go('shop'); BR.App.openChest('brick'); });
    await page.waitForTimeout(2400); await page.screenshot({ path: `${OUT}/chest_${tag}.png` });
    await page.evaluate(() => { BR.Openings.current.close(false); });
    await page.waitForTimeout(600);
    await page.evaluate(() => { BR.Progress.addChest('pop', 1); BR.App.openChest('pop'); });
    await page.waitForSelector('.opening.on .hold:not(.off)', { timeout: 15000 });
    { const box = await page.locator('.hold').boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); }
    await page.waitForSelector('.reel', { timeout: 20000 }); await page.mouse.up(); await page.waitForTimeout(1700); await page.click('.op-reel').catch(() => {});
    await page.waitForSelector('.rv.on .rv-actions.on', { timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(2600); await page.screenshot({ path: `${OUT}/reveal_${tag}.png` });
    console.log(tag, errors.filter((e) => !/Failed to load resource/.test(e)));
    await browser.close();
  }
})();
