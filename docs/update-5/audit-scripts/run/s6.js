const H = require('./h.js');
const S = require('./sheet.js');
(async () => {
  const L = await H.boot({ slow: true, dsf: 2 });
  const { page } = L;
  await H.startRun(page, 'rush');
  const frames = async (name, fr, act) => {
    await L.rate(0.1); await act(); const t0 = Date.now(), items = [];
    for (const f of fr) { const w = f / 0.1 - (Date.now() - t0); if (w > 0) await page.waitForTimeout(w); items.push([f + 'ms', await H.shot(page, `${name}_${f}`)]); }
    await L.rate(1); await H.idle(page); await page.waitForTimeout(300);
    console.log(await S.make(`${H.OUT}/sheet_${name}.png`, items, 4, 300, name));
  };
  // ---- Fuse bricks: a defuse (b in the blue group), a tick (d), a burst (a)
  await page.evaluate(() => { const e = BR.Run.engine; e.fuse = 20; e.stage = 4; });
  await H.setBoard(page, ['02234560','1d345601','2a456012','34560123','b1111234','56012345','60123456','01234560']);
  await page.waitForTimeout(600);
  console.log(await H.shot(page, 'fb_rest'));
  await frames('fb_defuse_burst', [0, 80, 200, 350, 500, 800, 1100, 1500], () => H.tap(page, 4, 2));
  console.log(await H.shot(page, 'fb_after'));
  // ---- power-ups
  await page.evaluate(() => { const e = BR.Run.engine; e.inv = { hammer: 0, beam: 0, prism: 0 }; e.charge = 55; BR.Run.renderPower(null); });
  await page.waitForTimeout(500);
  console.log(await H.shot(page, 'pw_charging'));
  await page.evaluate(() => { const e = BR.Run.engine; e.inv = { hammer: 1, beam: 2, prism: 1 }; e.charge = 30; BR.Run.renderPower(['hammer']); });
  await page.waitForTimeout(900);
  console.log(await H.shot(page, 'pw_ready'));
  for (const t of ['hammer', 'beam', 'prism']) {
    await H.setBoard(page, ['01234560','12345601','23456012','34560123','45601234','56012345','60123456','01234560']);
    await page.evaluate((t) => BR.Run.onSlot(t), t);
    await page.waitForTimeout(400);
    console.log(await H.shot(page, `pw_${t}_armed`));
    await H.press(page, 3, 3); await page.waitForTimeout(300);
    console.log(await H.shot(page, `pw_${t}_aim`));
    await frames(`pw_${t}_use`, [0, 60, 150, 300, 500, 800], () => H.release(page));
  }
  console.log(L.errors);
  await L.browser.close();
})();
