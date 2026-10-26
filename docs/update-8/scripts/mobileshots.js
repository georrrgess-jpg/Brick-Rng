// Screens in Mobile mode against Pretty: Home, a run, a chest ready, hold, reveal. env OUT (folder). Writes <mode>-<name>.png
const L = require('/home/user/Brick-Rng/tests/lib');
const OUT = (process.env.OUT || '/tmp') + '/';
(async () => {
  for (const mode of ['pretty', 'mobile']) {
    const { browser, page, errors } = await L.launch({ width: 393, height: 852, dsf: 2 });
    await page.evaluate((m) => { const D = BR.Storage.data; D.seenTutorial = true; D.runs = 8; D.settings.perf = 'high'; D.settings.mobile = m === 'mobile'; D.settings.music = false; D.settings.sound = false; BR.Coach.markAllSeen(); BR.App.applySettings(); BR.Progress.addChest('brick', 2); }, mode);
    await page.waitForTimeout(1200); await page.screenshot({ path: OUT + mode + '-home.png' });
    await page.evaluate(() => BR.App.startRun({ mode: 'rush', boosts: {} })); await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy); await page.waitForTimeout(1500);
    await page.screenshot({ path: OUT + mode + '-run.png' });
    await page.evaluate(() => { BR.Run.over = true; BR.Run.token++; BR.Router.go('shop'); }); await page.waitForTimeout(800);
    await page.evaluate(() => { Math.random = (() => { let x = 99; return () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296); })(); BR.App.openChest('brick'); });
    await page.waitForSelector('.opening.on .hold:not(.off)'); await page.waitForTimeout(1500); await page.screenshot({ path: OUT + mode + '-chest.png' });
    const box = await page.locator('.hold').boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.waitForTimeout(900); await page.screenshot({ path: OUT + mode + '-hold.png' });
    await page.waitForFunction(() => document.querySelector('.reel')); await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('.rv-actions.on'), null, { timeout: 60000 }); await page.waitForTimeout(600); await page.screenshot({ path: OUT + mode + '-reveal.png' });
    console.log(mode, errors.join(' | ') || 'no errors', 'rays canvas:', await page.evaluate(() => !!document.querySelector('canvas.op-rays, canvas.rv-rays')));
    await browser.close();
  }
})();
