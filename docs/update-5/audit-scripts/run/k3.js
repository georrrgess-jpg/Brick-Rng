const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 2 });
  const { page } = L;
  for (const id of ['a_carnival', 'a_volcano', 'a_beach', 'a_foundry', 'a_market', 'a_storm']) {
    await H.equip(page, id, 'board');
    await H.startRun(page, 'rush');
    await page.waitForTimeout(700);
    await H.shot(page, `kb_${id}_top`, { x: 0, y: 0, width: 393, height: 240 });
    await H.shot(page, `kb_${id}_bottom`, { x: 0, y: 600, width: 393, height: 252 });
  }
  await L.browser.close();
})();
