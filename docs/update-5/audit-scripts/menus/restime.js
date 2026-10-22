// When does each part of the results appear? (simple run vs a run with many banners)
const { launch, returning, wait } = require('./u5lib');
(async () => {
  for (const many of [false, true]) {
    const { browser, page } = await launch({ width: 393, height: 852, dsf: 1 });
    await returning(page, {});
    if (many) await page.evaluate(() => { const pr = BR.Storage.data.profile; pr.xp = BR.xpForLevel(pr.level) - 15; delete pr.trophies.first_run; delete pr.trophies.stage5; const y = new Date(Date.now() - 864e5); pr.streak = { ring: 2, weeks: 0, last: BR.dayKey(y), shield: 1, best: 2 }; BR.Storage.save(); });
    else await page.evaluate(() => { const pr = BR.Storage.data.profile; pr.streak = { ring: 2, weeks: 0, last: BR.dayKey(), shield: 1, best: 2 }; BR.Storage.data.lastDay = BR.dayKey(); BR.Storage.save(); });
    await page.evaluate(() => { __app.startRun({ mode: 'rush', boosts: {} }); });
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 15000 });
    for (let n = 0; n < 6; n++) {
      const q = await page.evaluate(() => { const e = BR.Run.engine, v = BR.Run.view; let best = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!best || p.cells.length > best.n)) best = { r, c, n: p.cells.length }; } return best ? v.pagePoint(best.r, best.c) : null; });
      await page.mouse.click(q.x, q.y); await wait(page, 700);
    }
    await page.evaluate(() => {
      window.__t = {}; const t0 = performance.now();
      const mo = new MutationObserver(() => { const r = document.querySelector('.results'); if (!r) return; if (!__t.shown) __t.shown = performance.now() - t0; r.querySelectorAll('.rev.in').forEach((n) => { const k = n.className.split(' ')[0]; if (!(k in __t)) __t[k] = Math.round(performance.now() - t0); }); });
      mo.observe(document.body, { subtree: true, attributes: true, childList: true, attributeFilter: ['class'] });
      BR.Run.endRun('ended');
    });
    await wait(page, 6000);
    const t = await page.evaluate(() => ({ t: __t, n: document.querySelectorAll('.results .rev').length, fold: (() => { const a = document.querySelector('.res-actions').getBoundingClientRect().top; return [...document.querySelectorAll('.results .rev')].filter((x) => x.getBoundingClientRect().top > a).map((x) => x.className.split(' ')[0]); })(), xpTop: document.querySelector('#resXp').getBoundingClientRect().top }));
    console.log(many ? 'MANY' : 'SIMPLE', JSON.stringify(t));
    await browser.close();
  }
})();
