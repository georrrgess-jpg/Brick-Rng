const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 2 });
  const { page } = L;
  await H.startRun(page, 'rush');
  await page.evaluate(() => { const e = BR.Run.engine; e.fuse = 25; const B = e.board; [0, 1, 2, 3, 4, 5, 6].forEach((col, i) => { const b = B.grid[0][i]; b.color = col; b.fb = 4; const u = B.grid[1][i]; u.color = col; delete u.fb; }); B.version++; BR.Run.view.syncTo(B); });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => { const b = document.getElementById('board').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height / 4 }; });
  console.log(await H.shot(page, 'fb_colors', r));
  console.log(await page.evaluate(() => Array.from(document.querySelectorAll('.brick.fusebrick')).slice(0, 7).map((b) => b.dataset.c + ':' + getComputedStyle(b.querySelector('.face')).backgroundImage.slice(0, 60))));
  await L.browser.close();
})();
