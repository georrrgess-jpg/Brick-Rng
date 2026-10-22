// The results screen: a run with a level-up, a trophy, a streak day, a goal and mission progress. Frames + full scroll.
const { launch, returning, wait, shotScroll, SHOTS, path } = require('./u5lib');
const { capture } = require('./frames');
const W = +(process.argv[2] || 393), H = +(process.argv[3] || 852), TAG = process.argv[4] || 'res', REASON = process.argv[5] || 'fuse';
(async () => {
  const { browser, page, errors } = await launch({ width: W, height: H, dsf: 1, mobile: W < 1000 });
  await returning(page, { chests: { brick: 0, golden: 0 }, coins: 300 });
  await page.evaluate(() => {
    const st = BR.Storage.data, pr = st.profile;
    pr.xp = BR.xpForLevel(pr.level) - 15;            // the run levels up
    delete pr.trophies.first_run; delete pr.trophies.stage5;
    const y = new Date(Date.now() - 864e5); pr.streak = { ring: 2, weeks: 0, last: BR.dayKey(y), shield: 1, best: 2 };
    st.lastDay = BR.dayKey(y);
    BR.Storage.save();
  });
  const before = await page.evaluate(() => ({ coins: BR.Progress.coins, level: BR.Progress.level, chests: JSON.stringify(BR.Storage.data.profile.chests) }));
  await page.evaluate(() => { BR.Storage.clearRun(); __app.startRun({ mode: 'rush', boosts: {} }); });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 15000 }).catch(() => console.log('not started'));
  for (let n = 0; n < 14; n++) {
    await page.evaluate(() => { const e = BR.Run.engine; if (e.fuse < 8) e.fuse = e.fuseMax; });
    const q = await page.evaluate(() => { const e = BR.Run.engine, v = BR.Run.view; let best = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!best || p.cells.length > best.n)) best = { r, c, n: p.cells.length }; } return best ? v.pagePoint(best.r, best.c) : null; });
    if (!q) break;
    await page.mouse.click(q.x, q.y);
    for (let i = 0; i < 60; i++) { const b = await page.evaluate(() => BR.Run.busy || BR.Run.modal); if (!b) break; await wait(page, 60); }
  }
  const goal = await page.evaluate(() => BR.Run.goal && BR.Run.goal.text);
  console.log('goal', goal, 'score', await page.evaluate(() => BR.Run.engine.score));
  const r = await capture(page, TAG + '-in', eval(`(() => { const t = Date.now(); BR.Run.endRun('${REASON}'); return t; })`), { ms: 5200, every: 200, cols: 9, scale: 0.35 });
  // capture() evaluates without args: patch reason through a global
  void r;
  await wait(page, 1500);
  await page.screenshot({ path: path.join(SHOTS, TAG + '-top.png') });
  await shotScroll(page, TAG + '-scroll', { sel: '.res-scroll', max: 6 });
  const after = await page.evaluate(() => ({ coins: BR.Progress.coins, level: BR.Progress.level, chests: JSON.stringify(BR.Storage.data.profile.chests), card: document.querySelector('#resCoins').textContent, rows: [...document.querySelectorAll('.res-card')].map((c) => c.innerText.replace(/\n+/g, ' | ')), banners: [...document.querySelectorAll('.res-banner, .res-goal, .res-next, .res-gap, .new-best, .lvl-up')].map((b) => b.innerText.replace(/\n+/g, ' ')), btns: [...document.querySelectorAll('.res-actions .btn')].map((b) => b.innerText) }));
  console.log('before', JSON.stringify(before));
  console.log('after', JSON.stringify(after, null, 1));
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
