const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 1 });
  const { page } = L;
  await H.startRun(page, 'rush');
  await page.evaluate(() => { BR.Run.engine.fuse = 25; });
  await H.setBoard(page, ['33333333','33333333','01234560','12345601','23456012','34560123','45601234','56012345']);
  await H.tap(page, 0, 0); await H.idle(page);
  await page.evaluate(() => BR.Run.endRun('ended'));
  await page.waitForSelector('.results.on'); await page.waitForTimeout(3000);
  console.log(await page.evaluate(() => Array.from(document.querySelectorAll('.res-mis svg')).map((s) => { const r = s.getBoundingClientRect(); return s.getAttribute('class') + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); })));
  await L.browser.close();
})();
