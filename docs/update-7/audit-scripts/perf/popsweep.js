// The nine Moonwick pops (and Classic for reference), same Daily board each time: four biggest-group pops per pop, frame stats and
// main-thread CPU per frame during the pops, plus the fx canvas particle peak. RATE; POPS=comma list to override.
const L = require('./lib');
const POPS = (process.env.POPS || 'classic,b_fireflies,b_wishdust,b_birds,b_runes,b_goldleaf,b_sandfall,b_whirlgate,b_constellation,b_wisps').split(',');
(async () => {
  const { browser, page, cdp } = await L.launch();
  await L.setup(page, {});
  console.log('RATE', L.RATE);
  for (const pop of POPS) {
    await page.evaluate((pop) => {
      const P = BR.Progress, st = BR.Storage.data;
      if (pop === 'classic') P.equip('default', 'pop');
      else { if (!P.owns(pop)) P.keep({ itemId: pop, shine: 'plain', seed: 7 }); const inst = st.profile.vault.find((v) => v.itemId === pop); P.equip(inst.uid, 'pop'); }
      BR.Skins.apply();
      if (BR.Run && BR.Run.active) { BR.Run.over = true; BR.Router.go('home', { instant: true }); }
    }, pop);
    await page.waitForTimeout(500);
    await L.startRun(page, 'daily');
    await L.throttle(cdp);
    const { r, ev } = await L.trace(browser, page, async () => {
      await L.startFrames(page, "'pop'");
      await page.evaluate(() => { window.__pk = 0; const f = BR.App.fx; const o = f.loop; window.__pkT = setInterval(() => { window.__pk = Math.max(window.__pk, f.parts.length); }, 50); });
      for (let i = 0; i < 4; i++) { const a = await L.bestTap(page); await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(1300); }
      return L.stopFrames(page);
    });
    const pk = await page.evaluate(() => { clearInterval(window.__pkT); return window.__pk; });
    await L.throttle(cdp, 1);
    const st = L.stats(r.g.map(([s, e]) => e - s)); const pc = L.phaseCpu(ev, r).pop;
    console.log(pop.padEnd(16), L.fmtS(st), '| particles peak', pk, '|', pc ? L.fmtPh(pc) : '');
  }
  await browser.close();
})();
