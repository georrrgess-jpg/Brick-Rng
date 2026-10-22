const H = require('./h.js');
const B4 = ['01234560','12345601','23333012','34560123','45601234','56012345','60123456','01234560'];
(async () => {
  const L = await H.boot({ dsf: 2 });
  const { page } = L;
  await H.startRun(page, 'rush');
  // idle hint after 5s
  await page.waitForTimeout(5600);
  console.log(await H.shot(page, 'st_idlehint'));
  // low
  await page.evaluate(() => { BR.Run.engine.fuse = 6.8; });
  await page.waitForTimeout(900);
  console.log(await H.shot(page, 'st_low'));
  // critical
  await page.evaluate(() => { BR.Run.engine.fuse = 3.4; });
  await page.waitForTimeout(700);
  console.log(await H.shot(page, 'st_crit'));
  // heartbeat counts: critical for 2s
  await page.evaluate(() => { window.__hb = 0; const o = BR.audio.heartbeat; BR.audio.heartbeat = function () { window.__hb++; return o.apply(this, arguments); }; window.__beat = 0; const ob = BR.Fuse.beat; BR.Fuse.beat = function () { window.__beat++; return ob.apply(this, arguments); }; BR.Run.engine.fuse = 4.9; });
  const t0 = Date.now(); await page.waitForTimeout(2000);
  const crit = await page.evaluate(() => ({ hb: window.__hb, beat: window.__beat, fuse: BR.Run.engine.fuse }));
  console.log('critical 2s', crit, Date.now() - t0);
  // Last Spark
  await page.evaluate(() => { window.__hb = 0; window.__beat = 0; BR.Run.engine.fuse = 0.02; });
  await page.waitForFunction(() => BR.Run.engine.spark > 0, null, { timeout: 3000 });
  const s0 = Date.now();
  await page.waitForTimeout(500);
  console.log(await H.shot(page, 'st_spark'));
  await page.waitForTimeout(1200);
  const sp = await page.evaluate(() => ({ hb: window.__hb, beat: window.__beat, spark: BR.Run.engine.spark }));
  console.log('spark ~1.7s', sp, Date.now() - s0);
  // save it
  await H.setBoard(page, B4);
  await H.tap(page, 2, 3);
  await page.waitForTimeout(250);
  console.log(await H.shot(page, 'st_spark_save_250'));
  await page.waitForTimeout(500);
  console.log(await H.shot(page, 'st_spark_save_750'));
  await page.waitForTimeout(1200);
  console.log(await H.shot(page, 'st_spark_save_after'));
  console.log(L.errors);
  await L.browser.close();
})();
