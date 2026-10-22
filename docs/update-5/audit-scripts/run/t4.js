const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 1 });
  const { page } = L;
  // ---- stage-up readout: what number does the readout show during the respool?
  await H.startRun(page, 'rush');
  await page.evaluate(() => { const e = BR.Run.engine; e.fuse = 18; e.stageScore = e.goal - 10; });
  await H.setBoard(page, ['01234560','12345601','23333012','34560123','45601234','56012345','60123456','01234560']);
  await H.tap(page, 2, 3);
  const seq = await page.evaluate(async () => { const out = []; const t0 = performance.now(); while (performance.now() - t0 < 900) { await new Promise((r) => requestAnimationFrame(r)); const n = document.getElementById('fuseTime'); const txt = Array.from(n.querySelectorAll('.fz-dg i:first-child')).map((i) => i.textContent).join('|') + ' m=' + n.dataset.m + ' z=' + BR.Fuse.z; if (out[out.length - 1] !== txt) out.push(Math.round(performance.now() - t0) + 'ms ' + txt + ' aria=' + n.getAttribute('aria-label')); } return out; });
  console.log('stage-up readout:\n ' + seq.slice(0, 14).join('\n '));
  await H.idle(page); await page.waitForTimeout(1500);
  // ---- golden fallback through the day-7 streak prize
  const y = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1); return BR.dayKey(d); });
  await page.evaluate((y) => { const P = BR.Progress; BR.DROP_ITEMS.filter((x) => BR.rarityById[x.rarity].level >= 3).forEach((x) => P.keep({ itemId: x.id, shine: 'plain', seed: 1 })); const p = BR.Storage.data.profile; p.streak = { ring: 6, weeks: 0, last: y, shield: 1, best: 6 }; BR.Storage.save(); window.__c0 = BR.Progress.coins; }, y);
  await page.evaluate(() => BR.Run.endRun('ended'));
  await page.waitForSelector('.results.on', { timeout: 8000 }); await page.waitForTimeout(2500);
  const gb = await page.evaluate(() => ({ banner: (document.querySelector('.res-banner.streak') || {}).textContent, golden: BR.Progress.chestCount('golden'), coinsDelta: BR.Progress.coins - window.__c0 }));
  console.log('golden fallback via streak:', JSON.stringify(gb));
  await H.shot(page, 'streak_golden_fallback');
  await page.evaluate(() => BR.Run.closeResults());
  // ---- chill within the first runs: arrow tips point at hidden parts?
  await page.evaluate(() => { const D = BR.Storage.data; D.runs = 0; D.seen = {}; BR.Storage.save(); });
  await H.startRun(page, 'chill');
  for (let i = 0; i < 3; i++) { const g = await page.evaluate(() => BR.Run.engine.bestGroup()); await H.tap(page, g[0].r, g[0].c); await H.idle(page); await page.waitForTimeout(300); }
  const tip = await page.evaluate(() => { const t = document.querySelector('.tip-arrow'); if (!t) return null; const r = t.getBoundingClientRect(); return { text: t.textContent, rect: [r.left, r.top, r.width, r.height].map(Math.round) }; });
  console.log('chill tip:', JSON.stringify(tip));
  await H.shot(page, 'chill_tip');
  console.log(L.errors);
  await L.browser.close();
})();
