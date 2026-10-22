const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 1, runs: 0 });
  const { page } = L;
  await page.evaluate(() => { const D = BR.Storage.data; D.runs = 0; D.seen = Object.assign({}, D.seen); Object.keys(D.seen).filter((k) => k.startsWith('rt_')).forEach((k) => delete D.seen[k]); BR.Storage.save(); });
  await H.startRun(page, 'chill');
  for (let i = 0; i < 4; i++) {
    await H.setBoard(page, ['33334560','12345601','23456012','34560123','45601234','56012345','60123456','01234560']);
    await H.tap(page, 0, 0); await page.waitForTimeout(500);
    const tip = await page.evaluate(() => { const t = document.querySelector('.tip-arrow'); if (!t) return null; const r = t.getBoundingClientRect(); return { text: t.textContent, rect: [r.left, r.top, r.width, r.height].map(Math.round), seen: Object.keys(BR.Storage.data.seen).filter((k) => k.startsWith('rt_')) }; });
    console.log('pop', i + 1, JSON.stringify(tip));
    if (tip) await H.shot(page, 'chill_tip_' + i);
    await H.idle(page); await page.waitForTimeout(4500);
  }
  await L.browser.close();
})();
