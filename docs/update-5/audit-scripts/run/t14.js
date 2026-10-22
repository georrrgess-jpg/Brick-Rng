const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 1 });
  const { page } = L;
  await H.startRun(page, 'rush');
  await page.evaluate(() => { BR.Run.engine.sparkUsed = true; BR.Run.engine.fuse = 0.01; });
  for (const ms of [300, 900, 1400]) {
    await page.waitForTimeout(ms === 300 ? 300 : 550);
    const r = await page.evaluate(() => { const v = document.getElementById('warnVignette'); const cs = getComputedStyle(v); const red = Array.from(document.querySelectorAll('#app *')).filter((e) => { const s = getComputedStyle(e); return +s.opacity > 0.05 && /255, 77, 109|255, 60, 90|220, 20|crit/.test(s.boxShadow + s.background + e.className); }).slice(0, 6).map((e) => e.id || String(e.className).slice(0, 40)); return { vig: v.className, vigOp: cs.opacity, z: BR.Fuse.z, fuseCls: document.getElementById('fuse').className, music: BR.Music && BR.Music.low, red }; });
    console.log(ms, JSON.stringify(r));
  }
  await H.shot(page, 'fuseout_red');
  await L.browser.close();
})();
