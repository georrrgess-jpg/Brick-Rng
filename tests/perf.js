// Frame-time probe under 4x CPU throttle: idle board with each heavy item equipped, then a big pop. Usage: node tests/perf.js
const { launch } = require('./lib');
(async () => {
  const { browser, ctx, page } = await launch({ width: 390, height: 844, dsf: 2 });
  const cdp = await ctx.newCDPSession(page);
  await page.evaluate(() => { BR.Storage.data.settings.sound = false; BR.Storage.data.seenTutorial = true; BR.Storage.data.runs = 5; BR.Storage.data.settings.perf = 'high'; BR.App.applySettings(); });
  const probe = (ms) => page.evaluate((ms) => new Promise((res) => { const t = []; let last = performance.now(); const end = last + ms; const f = (n) => { t.push(n - last); last = n; if (n < end) requestAnimationFrame(f); else { t.shift(); t.sort((a, b) => a - b); res({ avg: t.reduce((a, b) => a + b, 0) / t.length, p95: t[Math.floor(t.length * 0.95)], max: t[t.length - 1], n: t.length }); } }; requestAnimationFrame(f); }), ms);
  const sets = [['classic', []], ['nova', ['f_nova']], ['lava', ['f_lava']], ['galaxy', ['f_galaxy']], ['clockwork', ['f_clock']], ['slime', ['f_slime']], ['deepsea', ['a_deepsea']], ['carnival', ['a_carnival']], ['volcano', ['a_volcano']], ['ink+nova', ['b_ink', 'b_nova']]];
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  for (const [name, ids] of sets) {
    await page.evaluate((ids) => {
      const P = BR.Progress; ['skin', 'pop', 'board', 'fuse'].forEach((t) => P.equip('default', t));
      ids.forEach((id) => { const it = BR.itemById[id]; const inst = BR.Storage.data.profile.vault.find((v) => v.itemId === id) || P.keep({ itemId: id, shine: 'plain', seed: 3, counter: null }); P.equip(inst.uid, it.type); });
      BR.Skins.apply(); if (BR.Router.current === 'run') { BR.Run.over = true; BR.Router.go('home', { instant: true }); }
      __app.startRun({ mode: 'rush', boosts: {} });
    }, ids);
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 });
    await page.waitForTimeout(500);
    const idle = await probe(1500);
    // a big pop
    const a = await page.evaluate(() => { const e = BR.Run.engine; let best = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!best || p.cells.length > best.n)) best = { r, c, n: p.cells.length }; } return BR.Run.view.pagePoint(best.r, best.c); });
    const pr = probe(1200); await page.mouse.click(a.x, a.y); const pop = await pr;
    console.log(name.padEnd(12), 'idle avg', idle.avg.toFixed(1) + 'ms p95', idle.p95.toFixed(1), '| pop avg', pop.avg.toFixed(1), 'p95', pop.p95.toFixed(1), 'max', pop.max.toFixed(1));
  }
  await browser.close();
})();
