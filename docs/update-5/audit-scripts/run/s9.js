const H = require('./h.js');
const S = require('./sheet.js');
(async () => {
  const items = [];
  // chill + daily
  {
    const L = await H.boot({ dsf: 1 });
    const { page } = L;
    await H.startRun(page, 'chill'); await page.waitForTimeout(400);
    items.push(['chill rest', await H.shot(page, 'mode_chill')]);
    await page.evaluate(() => { const e = BR.Run.engine; e.movesLeft = 1; e.stageScore = e.goal - 10; BR.Run.hudChill(false); });
    await H.setBoard(page, ['33334560','12345601','23456012','34560123','45601234','56012345','60123456','01234560']);
    await H.tap(page, 0, 0); await page.waitForTimeout(1300);
    items.push(['chill round clear', await H.shot(page, 'mode_chill_clear')]);
    await H.idle(page); await page.waitForTimeout(800);
    items.push(['chill next round', await H.shot(page, 'mode_chill_next')]);
    await H.startRun(page, 'daily'); await page.waitForTimeout(400);
    items.push(['daily rest', await H.shot(page, 'mode_daily')]);
    console.log(L.errors);
    await L.browser.close();
  }
  // first run: tutorial + arrow tips
  {
    const L = await H.boot({ dsf: 1, runs: 0 });
    const { page } = L;
    await page.evaluate(() => { const D = BR.Storage.data; D.seenTutorial = false; D.runs = 0; D.seen = {}; BR.Storage.save(); });
    await H.startRun(page, 'rush'); await page.waitForTimeout(500);
    items.push(['tutorial start', await H.shot(page, 'tut_start')]);
    const pop = async (label) => {
      const g = await page.evaluate(() => BR.Run.engine.bestGroup());
      await H.tap(page, g[0].r, g[0].c); await page.waitForTimeout(450);
      items.push([label, await H.shot(page, 'tut_' + label.replace(/\W+/g, '_'))]);
      await H.idle(page); await page.waitForTimeout(4400);
    };
    await pop('pop1 fuse tip'); await pop('pop2 stage tip'); await pop('pop3'); await pop('pop4');
    console.log(L.errors);
    await L.browser.close();
  }
  console.log(await S.make(`${H.OUT}/sheet_modes_tut.png`, items, 5, 250, 'modes + tutorial'));
})();
