const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 2 });
  const { page } = L;
  await H.startRun(page, 'rush');
  await page.evaluate(() => { BR.Run.engine.stage = 4; BR.Run.engine.fuse = 25; });
  await H.setBoard(page, ['0b234560','12345601','23333012','33333123','45601234','56012345','60123456','01234560']);
  await H.tap(page, 3, 2); await H.idle(page); await page.waitForTimeout(600);
  const before = await page.evaluate(() => { const e = BR.Run.engine; let fb = 0; e.board.grid.forEach((r) => r.forEach((b) => { if (b.fb) fb++; })); return { stage: e.stage, score: e.score, stageScore: e.stageScore, goal: e.goal, fb, streak: e.streak, time: e.time.toFixed(1), bar: document.getElementById('stageGoal').textContent }; });
  console.log('before', before);
  // pause sheet
  await page.click('#btnPause'); await page.waitForTimeout(600);
  console.log(await H.shot(page, 'pause_sheet'));
  await page.click('[data-p="settings"]'); await page.waitForTimeout(600);
  console.log(await H.shot(page, 'pause_quicksettings'));
  await page.evaluate(() => BR.Back && BR.Back.closeTop()); await page.waitForTimeout(500);
  console.log(await H.shot(page, 'pause_after_qs_close'));
  await page.click('[data-p="leave"]'); await page.waitForTimeout(1200);
  console.log(await H.shot(page, 'home_after_leave'));
  await page.click('[data-act="resume"]');
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 10000 });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => { const e = BR.Run.engine; let fb = 0; e.board.grid.forEach((r) => r.forEach((b) => { if (b.fb) fb++; })); return { stage: e.stage, score: e.score, stageScore: e.stageScore, goal: e.goal, fb, streak: e.streak, time: e.time.toFixed(1), bar: document.getElementById('stageGoal').textContent }; });
  console.log('after', after);
  console.log(await H.shot(page, 'resumed'));
  console.log(L.errors);
  await L.browser.close();
})();
