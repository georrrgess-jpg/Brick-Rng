const H = require('./h.js');
const S = require('./sheet.js');
(async () => {
  const L = await H.boot({ slow: true, dsf: 1 });
  const { page } = L;
  const grab = async (name, fr, act) => { await L.rate(0.1); await act(); const t0 = Date.now(), items = []; for (const f of fr) { const w = f / 0.1 - (Date.now() - t0); if (w > 0) await page.waitForTimeout(w); items.push([f + 'ms', await H.shot(page, `${name}_${f}`)]); } await L.rate(1); return items; };
  // board build (rain-in) at run start
  await page.evaluate(() => { BR.Router.go('home', { instant: true }); });
  const a = await grab('build', [0, 150, 300, 500, 700, 1000, 1300], () => page.evaluate(() => { BR.Storage.clearRun(); __app.startRun({ mode: 'rush', boosts: {} }); }));
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  // fuse out
  await page.evaluate(() => { BR.Run.engine.sparkUsed = true; });
  const b = await grab('fuseout', [0, 150, 400, 800, 1200, 1600, 2000, 2600], () => page.evaluate(() => { BR.Run.engine.fuse = 0.01; }));
  console.log(await S.make(`${H.OUT}/sheet_build_fuseout.png`, a.concat(b), 5, 230, 'board build (rain-in) / fuse out + crumble'));
  console.log(L.errors);
  await L.browser.close();
})();
