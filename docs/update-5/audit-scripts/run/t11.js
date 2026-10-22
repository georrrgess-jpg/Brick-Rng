const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 1 });
  const { page } = L;
  await H.startRun(page, 'rush');
  await page.evaluate(() => { BR.Run.engine.sparkUsed = true; BR.Run.engine.fuse = 1.2; });
  await page.waitForFunction(() => BR.Run.over, null, { timeout: 5000 });
  for (const ms of [500, 1200, 1800]) {
    await page.waitForTimeout(ms === 500 ? 500 : 650);
    const st = await page.evaluate(() => { const f = document.querySelector('.fz-flare'); const tip = document.getElementById('spark'); const cs = getComputedStyle(tip); return { z: BR.Fuse.z, vig: document.getElementById('warnVignette').className, bombGone: document.getElementById('bomb').classList.contains('gone'), tipOpacity: cs.opacity, tipVis: cs.visibility, tipTransform: tip.style.transform, fuseCls: document.getElementById('fuse').className }; });
    console.log(ms, JSON.stringify(st));
    await H.shot(page, 'natural_fuseout_' + ms, { x: 0, y: 90, width: 393, height: 110 });
  }
  await L.browser.close();
})();
