const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 1 });
  const { page } = L;
  for (const id of ['a_beach', 'default', 'a_greenhouse', 'a_aurora']) {
    await H.equip(page, id, 'board');
    await H.startRun(page, 'rush');
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => { const g = (s) => { const e = document.querySelector(s); const c = getComputedStyle(e); return c.color + ' / ' + c.textShadow.slice(0, 40); }; return { num: g('#fuseTime .fz-dg i'), unit: g('.fz-unit span'), stageGoal: g('#stageGoal'), stageNum: g('#stageNum'), multTag: g('#multTag'), lbl: g('.score-box .lbl') }; });
    console.log(id, JSON.stringify(r));
  }
  await L.browser.close();
})();
