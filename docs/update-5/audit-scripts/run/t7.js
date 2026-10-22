const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 1 });
  const { page } = L;
  await H.equip(page, 'a_beach', 'board');
  await H.startRun(page, 'rush');
  await page.waitForTimeout(500);
  console.log(await page.evaluate(() => { const g = document.getElementById('stageGoal'); const cs = getComputedStyle(g); return { color: cs.color, ts: cs.textShadow, app: document.getElementById('app').className, root: document.documentElement.className.slice(0, 200), body: document.body.className }; }));
  await L.browser.close();
})();
