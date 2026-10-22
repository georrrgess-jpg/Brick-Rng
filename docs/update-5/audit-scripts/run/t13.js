const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 1 });
  const { page } = L;
  await H.startRun(page, 'rush');
  const r = await page.evaluate(() => { const e = BR.Run.engine, B = e.board; [0, 1, 2, 3, 4, 5, 6].forEach((col, i) => { const b = B.grid[0][i]; b.color = col; b.fb = 4; const u = B.grid[1][i]; u.color = col; delete u.fb; }); B.grid[0][7].color = 0; B.grid[1][7].color = 1; B.version++; BR.Run.view.syncTo(B); return [0, 1, 2, 3].map((c) => { const p = e.plan(0, c); return p ? p.n + ' bricks, color ' + p.primary.map((q) => B.grid[q.r][q.c].color).join('') : null; }); });
  console.log(r);
  await L.browser.close();
})();
