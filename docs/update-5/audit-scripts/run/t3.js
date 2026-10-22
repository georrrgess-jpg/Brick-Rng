const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 1 });
  const { page } = L;
  // ---- resume: stage progress, fuse bricks, time
  await H.startRun(page, 'rush');
  await page.evaluate(() => { BR.Run.engine.fuse = 25; });
  await H.setBoard(page, ['33333333','33333333','01234560','12345601','23456012','34560123','45601234','56012345']);
  await H.tap(page, 0, 0); await H.idle(page); await page.waitForTimeout(2500);
  const st = () => page.evaluate(() => { const e = BR.Run.engine; let fb = 0; e.board.grid.forEach((r) => r.forEach((b) => { if (b.fb) fb++; })); return { stage: e.stage, score: e.score, stageScore: e.stageScore, goal: e.goal, time: +e.time.toFixed(1), fb, hud: document.getElementById('stageGoal').textContent, bar: document.getElementById('stageFill').style.width }; });
  console.log('before leave', await st());
  await page.click('#btnPause'); await page.waitForTimeout(500);
  await page.click('[data-p="leave"]'); await page.waitForTimeout(900);
  await page.click('[data-act="resume"]');
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 10000 });
  console.log('after resume', await st());
  // fuse bricks at stage 4 via a real snapshot
  await page.evaluate(() => { const e = BR.Run.engine; e.stage = 4; e.goal = BR.stageGoal(4); e.board.grid[2][2].fb = 3; BR.Run.saveSnap(); });
  await page.click('#btnPause'); await page.waitForTimeout(500);
  await page.click('[data-p="leave"]'); await page.waitForTimeout(900);
  await page.click('[data-act="resume"]');
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 10000 });
  console.log('after resume with a fuse brick', await st());
  // ---- chest: re-press while the ring drains
  await page.evaluate(() => { BR.Run.over = true; BR.Run.token++; BR.Router.go('shop', { instant: true }); BR.Storage.data.profile.coins = 9999; BR.App.openChest('pop'); return 0; });
  await page.waitForFunction(() => BR.Openings.current && BR.Openings.current.state === 'ready', null, { timeout: 15000 });
  await page.waitForTimeout(500);
  const box = await page.locator('.opening.on .hold').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.waitForFunction(() => BR.Openings.current.hold > 0.6, null, { timeout: 5000 });
  await page.mouse.up(); await page.waitForTimeout(60);
  await page.mouse.down();
  const samples = [];
  for (let i = 0; i < 8; i++) { await page.waitForTimeout(250); samples.push(await page.evaluate(() => `${BR.Openings.current.state}:${BR.Openings.current.hold.toFixed(2)}:${BR.Openings.current.pressed}`)); }
  console.log('re-press while draining:', samples.join(' '));
  await page.mouse.up();
  console.log(L.errors);
  await L.browser.close();
})();
