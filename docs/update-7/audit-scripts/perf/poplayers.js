// Layer churn during a pop: the composited layer count and device-pixel area sampled from LayerTree updates while one big pop
// plays (unthrottled; counts do not depend on speed). env LOADOUT-like SKIN/POP/BOARD, PM=1.
const L = require('./lib');
(async () => {
  const { page, cdp, browser } = await L.launch();
  await L.setup(page, { skin: process.env.SKIN, pop: process.env.POP, board: process.env.BOARD, fuse: process.env.FUSE, pm: process.env.PM === '1' });
  await L.startRun(page, 'daily');
  await cdp.send('LayerTree.enable');
  const samples = []; cdp.on('LayerTree.layerTreeDidChange', (e) => { if (e.layers) samples.push({ t: Date.now(), n: e.layers.length, d: e.layers.filter((l) => l.drawsContent).length, px: e.layers.reduce((a, l) => a + (l.drawsContent ? l.width * l.height : 0), 0) * 9 }); });
  await page.waitForTimeout(1500); const idle = samples.slice(-1)[0] || {}; samples.length = 0;
  for (let i = 0; i < 3; i++) { const a = await L.bestTap(page); await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(1300); }
  const mx = samples.reduce((m, s) => (s.n > m.n ? s : m), { n: 0 });
  console.log(`idle: ${idle.n} layers (${idle.d} drawing, ${(idle.px / 1e6).toFixed(1)} M device px) | during 3 pops: ${samples.length} layer-tree changes, peak ${mx.n} layers (${mx.d} drawing, ${(mx.px / 1e6).toFixed(1)} M px)`);
  await browser.close();
})();
