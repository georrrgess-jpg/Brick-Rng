// Frame time during the chest spin under 4x CPU throttle (software rendering, so only relative numbers matter).
// Usage: node tests/spinperf.js [chest]   exits 1 when the spin's average frame is over BUDGET ms.
// This environment has no GPU and runs 4x throttled, so the numbers are only comparable with each other: the old reel with
// animated previews averaged 165 ms (horizontal) and 324 ms (vertical); a phone does the same work several times faster.
const { launch } = require('./lib');
const chest = process.argv[2] || 'brick';
const BUDGET = +(process.env.BUDGET || 65);
(async () => {
  const { browser, ctx, page } = await launch({ width: 390, height: 844, dsf: 2 });
  const cdp = await ctx.newCDPSession(page);
  await page.evaluate(() => { BR.Storage.data.settings.sound = false; BR.Storage.data.runs = 5; BR.Storage.data.profile.coins = 9000; BR.Storage.data.settings.perf = 'high'; BR.App.applySettings(); });
  const frames = (ms, stop) => page.evaluate(([ms, stop]) => new Promise((res) => {
    const ts = []; let last = performance.now(); const end = last + ms;
    const f = (n) => { ts.push(n - last); last = n; const over = n >= end || (stop && BR.Openings.current && BR.Openings.current.reel && BR.Openings.current.reel.done); if (!over) requestAnimationFrame(f); else { ts.shift(); ts.sort((a, b) => a - b); res({ avg: ts.reduce((a, b) => a + b, 0) / ts.length, p95: ts[Math.floor(ts.length * 0.95)], max: ts[ts.length - 1], n: ts.length }); } };
    requestAnimationFrame(f);
  }), [ms, stop]);
  await page.evaluate((c) => { BR.App.openChest(c); }, chest);
  await page.waitForSelector('.opening.on .hold:not(.off)', { timeout: 15000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const box = await page.locator('.hold').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.waitForSelector('.reel', { timeout: 30000 }); await page.mouse.up();
  await page.waitForTimeout(1200);
  const t = await frames(3500, true);
  console.log(chest.padEnd(7), 'spin avg', t.avg.toFixed(1) + 'ms', 'p95', t.p95.toFixed(1), 'max', t.max.toFixed(1), 'frames', t.n, t.avg > BUDGET ? 'OVER BUDGET' : 'ok');
  await browser.close(); process.exit(t.avg > BUDGET ? 1 : 0);
})();
