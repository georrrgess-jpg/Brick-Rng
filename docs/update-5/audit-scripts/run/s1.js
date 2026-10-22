const H = require('./h.js');
(async () => {
  const { browser, page, errors } = await H.boot({ dsf: 2 });
  await H.startRun(page, 'rush');
  await page.waitForTimeout(400);
  console.log(await H.shot(page, 'r01_rest'));
  // HUD geometry
  const geo = await page.evaluate(() => { const ids = ['btnPause','score','bestLine','fuse','stageStrip','boardWrap','board','rushBar','powerups','msgBand']; const o = {}; for (const id of ids) { const r = document.getElementById(id).getBoundingClientRect(); o[id] = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; } return o; });
  console.log(JSON.stringify(geo));
  // press preview
  await H.setBoard(page, ['00001111','00001111','22223333','22223333','44445555','44445555','66660000','66660000']);
  await page.waitForTimeout(100);
  await H.press(page, 0, 0);
  await page.waitForTimeout(250);
  console.log(await H.shot(page, 'r02_press8'));
  await H.release(page);
  await page.waitForTimeout(90);
  console.log(await H.shot(page, 'r03_pop8_90ms'));
  await page.waitForTimeout(250);
  console.log(await H.shot(page, 'r04_pop8_340ms'));
  await page.waitForTimeout(800);
  console.log(await H.shot(page, 'r05_pop8_after'));
  console.log(errors);
  await browser.close();
})();
