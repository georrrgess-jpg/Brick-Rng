const H = require('./h.js');
const S = require('./sheet.js');
const G5 = ['01234560','12345601','23333012','34560123','45601234','56012345','60123456','01234560'];
(async () => {
  const L = await H.boot({ slow: true, dsf: 1 });
  const { page } = L;
  await H.startRun(page, 'rush');
  const seq = async (name, setup, tapAt, frames) => {
    await page.evaluate(setup);
    await H.setBoard(page, G5);
    await page.waitForTimeout(150);
    await L.rate(0.1);
    await H.tap(page, ...tapAt);
    const t0 = Date.now(), items = [];
    for (const f of frames) { const w = f / 0.1 - (Date.now() - t0); if (w > 0) await page.waitForTimeout(w); items.push([f + 'ms', await H.shot(page, `${name}_${f}`)]); }
    await L.rate(1); await H.idle(page); await page.waitForTimeout(300);
    console.log(await S.make(`${H.OUT}/sheet_${name}.png`, items, 5, 260, name));
  };
  // Rush start alone
  await seq('rushstart', () => { const e = BR.Run.engine; e.fuse = 20; e.rush.meter = 99; }, [2, 3], [0, 100, 250, 400, 600, 800, 1000, 1300, 1600, 2000]);
  // Rush active steady
  await page.waitForTimeout(1500);
  console.log(await H.shot(page, 'rush_active'));
  // Rush end
  await page.evaluate(() => { BR.Run.engine.rush.left = 0.05; });
  await L.rate(0.1);
  const t0 = Date.now(); const items = [];
  for (const f of [0, 100, 200, 350, 500]) { const w = f / 0.1 - (Date.now() - t0); if (w > 0) await page.waitForTimeout(w); items.push([f + 'ms', await H.shot(page, `rushend_${f}`)]); }
  await L.rate(1);
  console.log(await S.make(`${H.OUT}/sheet_rushend.png`, items, 5, 260, 'rush end'));
  // stage-up alone
  await page.waitForTimeout(1500);
  await seq('stageup', () => { const e = BR.Run.engine; e.fuse = 12; e.rush.meter = 0; e.stageScore = e.goal - 10; e.score += 0; }, [2, 3], [0, 100, 250, 400, 600, 800, 1000, 1250, 1500, 2000]);
  console.log(L.errors);
  await L.browser.close();
})();
