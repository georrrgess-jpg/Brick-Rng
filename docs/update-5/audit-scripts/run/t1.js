const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 2 });
  const { page } = L;
  await H.startRun(page, 'rush');
  await page.evaluate(() => { BR.Run.engine.fuse = 25; });
  for (const [t, c] of [['RELIT!', '#ffd66b'], ['HUGE!', '#ff8a3d'], ['Rush over', '#c4b5ff'], ['DEFUSED!', '#3ddc97']]) {
    await page.evaluate(([t, c]) => BR.Run.callout(t, c), [t, c]);
    await page.waitForTimeout(320);
    const r = await page.evaluate(() => { const el = document.querySelector('.callout'); const cs = getComputedStyle(el); return { op: cs.opacity, tr: cs.transform }; });
    console.log(t, JSON.stringify(r));
    await H.shot(page, 'callout_' + t.replace(/\W/g, ''), { x: 0, y: 260, width: 393, height: 200 });
    await page.waitForTimeout(1000);
  }
  await L.browser.close();
})();
