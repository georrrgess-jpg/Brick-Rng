const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 2 });
  const { page } = L;
  for (const id of ['default', 'a_beach', 'a_greenhouse']) {
    await H.equip(page, id, 'board');
    await H.startRun(page, 'rush');
    for (const [st, f] of [['calm', 25], ['low', 7], ['crit', 3.2]]) {
      await page.evaluate((f) => { BR.Run.engine.fuse = f; }, f);
      await page.waitForTimeout(st === 'calm' ? 300 : 1300);
      const c = await page.evaluate(() => getComputedStyle(document.querySelector('#fuseTime .fz-dg i')).color + ' z=' + BR.Fuse.z);
      console.log(id, st, c);
      await H.shot(page, `ro_${id}_${st}`, { x: 0, y: 100, width: 393, height: 90 });
    }
  }
  await L.browser.close();
})();
