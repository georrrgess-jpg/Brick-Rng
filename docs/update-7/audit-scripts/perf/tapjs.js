// JS inclusive time (CPU profile) of the run's big moments, one profile per moment: a plain pop, the pop that starts Rush, the
// pop that clears a stage, the Last Spark start, the run end (results build). LOADOUT presets as runprof.js. RATE.
const L = require('./lib');
const PRESETS = { default: {}, spire: { skin: 'f_sigil', pop: 'b_constellation', board: 'a_tower', fuse: 'u_moonrise', hat: 'h_wizard' }, potion: { skin: 'f_potion', shine: 'prism' } };
(async () => {
  const name = process.env.LOADOUT || 'spire';
  const { browser, page, cdp } = await L.launch();
  await L.setup(page, Object.assign({}, PRESETS[name]));
  await L.startRun(page, 'daily');
  await L.throttle(cdp);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  const moment = async (label, prep, act, wait) => {
    if (prep) await page.evaluate(prep);
    await cdp.send('Profiler.start');
    const t0 = Date.now(); await act(); await page.waitForTimeout(wait);
    const { profile } = await cdp.send('Profiler.stop');
    console.log(`\n== ${label} (${name}, ${L.RATE}x)\n` + L.jsIncl(profile, +(process.env.N || 22)));
  };
  const tap = async () => { const a = await L.bestTap(page); await page.touchscreen.tap(a.x, a.y); };
  await moment('plain pop', null, tap, 1300);
  await moment('Rush start', () => { const e = BR.Run.engine; e.rush.meter = 99.5; e.rush.lastPop = e.time; }, tap, 1800);
  await moment('stage clear', () => { const e = BR.Run.engine; e.rush.active = false; e.rush.left = 0; e.stageScore = Math.max(e.stageScore, e.goal - 5); }, tap, 2600);
  await moment('Last Spark start', () => { const e = BR.Run.engine; e.freeze = 0; e.fuse = 0.02; }, async () => {}, 1200);
  await moment('run end + results', () => { const e = BR.Run.engine; e.sparkUsed = true; e.spark = 0.01; e.freeze = 0; e.fuse = 0.0; }, async () => {}, 3500);
  await browser.close();
})();
