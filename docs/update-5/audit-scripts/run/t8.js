const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 1 });
  const { page } = L;
  await H.startRun(page, 'rush');
  for (const withRush of [true, false]) {
    await page.evaluate((wr) => { const e = BR.Run.engine; e.fuse = 24; e.stageScore = e.goal - 10; e.rush.meter = wr ? 99 : 0; e.rush.active = false; }, withRush);
    await H.setBoard(page, ['01234560','13333331','23333332','34333363','45333334','56012345','60123456','01234560']);
    await H.tap(page, 2, 3);
    const seq = await page.evaluate(async () => { const out = []; const t0 = performance.now(); let last = ''; while (performance.now() - t0 < 1200) { await new Promise((r) => requestAnimationFrame(r)); const n = document.getElementById('fuseTime'); const txt = n.getAttribute('aria-label'); const s = `${txt} d=${BR.Fuse.d.toFixed(1)} z=${BR.Fuse.z} pend=${BR.Fuse.pend.toFixed(1)} fly=${BR.Fuse.flying.length}`; if (txt !== last) { out.push(Math.round(performance.now() - t0) + 'ms ' + s); last = txt; } } return out; });
    console.log(withRush ? 'RUSH + STAGE-UP' : 'STAGE-UP only', '\n ' + seq.join('\n '));
    await H.idle(page); await page.waitForTimeout(1500);
    await page.evaluate(() => { const e = BR.Run.engine; if (e.rush.active) e.rush.left = 0.01; });
    await page.waitForTimeout(500);
  }
  await L.browser.close();
})();
