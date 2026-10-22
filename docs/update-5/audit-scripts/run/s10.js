const H = require('./h.js');
const S = require('./sheet.js');
(async () => {
  for (const [w, h] of [[360, 640], [844, 390], [1280, 800]]) {
    const items = [];
    const L = await H.boot({ width: w, height: h, dsf: w === 360 ? 2 : 1, mobile: w < 1000 });
    const { page } = L;
    await H.startRun(page, 'rush'); await page.waitForTimeout(600);
    items.push(['rest', await H.shot(page, `sz${w}_rest`)]);
    const geo = await page.evaluate(() => { const ids = ['btnPause', 'score', 'fuse', 'stageStrip', 'boardWrap', 'rushBar', 'powerups', 'msgBand']; const o = {}; for (const id of ids) { const r = document.getElementById(id).getBoundingClientRect(); o[id] = [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; } o.vw = innerWidth; o.vh = innerHeight; o.scrollW = document.documentElement.scrollWidth; return o; });
    console.log(w, JSON.stringify(geo));
    // big pop (combo + callouts) mid-flight
    await page.evaluate(() => { BR.Run.engine.streak = 2; BR.Run.engine.fuse = 20; });
    await H.setBoard(page, ['01234560','12345601','23333402','34333363','45333334','56012345','60123456','01234560']);
    await H.tap(page, 3, 3); await page.waitForTimeout(120);
    items.push(['12+ pop 120ms', await H.shot(page, `sz${w}_pop`)]);
    await H.idle(page); await page.waitForTimeout(800);
    items.push(['after pop combo', await H.shot(page, `sz${w}_combo`)]);
    // rush + spark
    await page.evaluate(() => { const e = BR.Run.engine; e.rush.meter = 99; });
    await H.setBoard(page, ['01234560','12345601','23333012','34560123','45601234','56012345','60123456','01234560']);
    await H.tap(page, 2, 3); await page.waitForTimeout(500);
    items.push(['rush start 0.5s', await H.shot(page, `sz${w}_rush`)]);
    await H.idle(page);
    await page.evaluate(() => { const e = BR.Run.engine; e.rush.left = 0.01; });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { BR.Run.engine.fuse = 0.02; });
    await page.waitForTimeout(800);
    items.push(['last spark', await H.shot(page, `sz${w}_spark`)]);
    await page.evaluate(() => { BR.Run.engine.spark = 0; BR.Run.sparkEnd(false); BR.Run.engine.fuse = 20; });
    await page.waitForTimeout(400);
    await page.click('#btnPause'); await page.waitForTimeout(600);
    items.push(['pause', await H.shot(page, `sz${w}_pause`)]);
    console.log(L.errors);
    await L.browser.close();
    console.log(await S.make(`${H.OUT}/sheet_size_${w}.png`, items, w > 800 ? 3 : 5, w > 800 ? 440 : 250, `${w}x${h}`));
  }
})();
