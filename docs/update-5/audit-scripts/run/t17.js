const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 1 });
  const { page } = L;
  await H.startRun(page, 'rush');
  await page.evaluate(() => { BR.Run.engine.fuse = 0.02; });
  await page.waitForFunction(() => BR.Run.engine.spark > 0, null, { timeout: 4000 });
  await page.waitForFunction(() => BR.Run.over, null, { timeout: 5000 });
  for (const ms of [100, 600, 1200]) {
    await page.waitForTimeout(ms === 100 ? 100 : 550);
    const r = await page.evaluate(() => ({ z: BR.Fuse.z, vig: document.getElementById('warnVignette').className, vigOp: getComputedStyle(document.getElementById('warnVignette')).opacity, bombGone: document.getElementById('bomb').classList.contains('gone'), tipT: document.getElementById('spark').style.transform, readout: document.getElementById('fuseTime').getAttribute('aria-label'), m: document.getElementById('fuseTime').dataset.m }));
    console.log(ms, JSON.stringify(r));
    await H.shot(page, 'sparkmiss_' + ms);
  }
  await L.browser.close();
})();
