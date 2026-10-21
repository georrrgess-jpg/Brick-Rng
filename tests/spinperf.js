// Frame time during the chest spin under 4x CPU throttle (software rendering, so only relative numbers matter).
// Usage: node tests/spinperf.js [chest]   exits 1 when the average frame exceeds the budget (default 40ms in this setup).
const { launch } = require('./lib');
const chest = process.argv[2] || 'brick';
const BUDGET = +(process.env.BUDGET || 40);
(async () => {
  const { browser, ctx, page } = await launch({ width: 390, height: 844, dsf: 2 });
  const cdp = await ctx.newCDPSession(page);
  await page.evaluate(() => { BR.Storage.data.settings.sound = false; BR.Storage.data.runs = 5; BR.Storage.data.profile.coins = 9000; BR.Storage.data.settings.perf = 'high'; BR.App.applySettings(); });
  await page.evaluate((c) => { BR.App.openChest(c); }, chest);
  await page.waitForSelector('.opening.on .hold:not(.off)', { timeout: 15000 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const box = await page.locator('.hold').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.waitForSelector('.reel', { timeout: 30000 }); await page.mouse.up();
  await page.waitForTimeout(1200);
  const t = await page.evaluate(() => new Promise((res) => {
    const ts = []; let last = performance.now(); const end = last + 3500;
    const f = (n) => { ts.push(n - last); last = n; if (n < end && !(BR.Openings.current && BR.Openings.current.reel && BR.Openings.current.reel.done)) requestAnimationFrame(f); else { ts.shift(); ts.sort((a, b) => a - b); res({ avg: ts.reduce((a, b) => a + b, 0) / ts.length, p95: ts[Math.floor(ts.length * 0.95)], max: ts[ts.length - 1], n: ts.length }); } };
    requestAnimationFrame(f);
  }));
  console.log(chest.padEnd(7), 'spin avg', t.avg.toFixed(1) + 'ms', 'p95', t.p95.toFixed(1), 'max', t.max.toFixed(1), 'frames', t.n, t.avg > BUDGET ? 'OVER BUDGET' : 'ok');
  await browser.close(); process.exit(t.avg > BUDGET ? 1 : 0);
})();
