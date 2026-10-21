const { launch } = require('./lib');
const OUT = process.argv[2];
const mode = process.argv[3] || 'mobile';
(async () => {
  const mobile = mode === 'mobile';
  const { browser, page, errors } = await launch(mobile ? { width: 400, height: 780 } : { width: 1280, height: 800, mobile: false });
  await page.evaluate(() => { document.documentElement.style.setProperty('--x', '0'); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/s-${mode}-menu.png` });
  // game with equipped core + some score
  await page.click('#btnPlay');
  await page.waitForTimeout(2300);
  await page.evaluate(() => {
    const a = window.__brick, e = a.engine;
    e.score = 12450; e.fuel = 17; e.charge = 540; e.streak = 3;
    e.equip(BR.coreById.rainbow); a.view.setWild(e.wild()); a.ui.setCore(e, true);
    a.ui.setScore(12450, false); a.ui.setFuel(17, false); a.ui.setMeter(540, e.need, false); a.ui.setCombo(3, 2, true);
    a.ui.setBest(30210);
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/s-${mode}-game-core.png` });
  await page.evaluate(() => { const e = window.__brick.engine; e.fuel = 4; window.__brick.ui.setFuel(4, false); });
  await page.click('#btnPause'); await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/s-${mode}-pause.png` });
  await page.click('#btnPauseSettings'); await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/s-${mode}-settings.png` });
  await page.click('#btnSettingsDone'); await page.waitForTimeout(300);
  await page.click('#btnQuit'); await page.waitForTimeout(500);
  // collection with some discovered
  await page.evaluate(() => { const s = BR.Storage; ['spark', 'bomb', 'rainbow', 'midas'].forEach((id) => s.record(id)); s.record('spark'); window.__brick.ui.renderCollection(); });
  await page.click('#btnCollection'); await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/s-${mode}-collection.png` });
  await page.click('#btnCollBack'); await page.waitForTimeout(400);
  // game over
  await page.click('#btnPlay'); await page.waitForTimeout(2300);
  await page.evaluate(() => { const a = window.__brick, e = a.engine; e.score = 48210; e.pops = 61; e.biggest = 14; e.maxCombo = 5; e.cratesOpened = 4; e.equip(BR.coreById.bomb); e.fuel = 0; a.endRun(a.token); });
  await page.waitForTimeout(3800);
  await page.screenshot({ path: `${OUT}/s-${mode}-gameover.png` });
  console.log('errors', errors);
  await browser.close();
})();
