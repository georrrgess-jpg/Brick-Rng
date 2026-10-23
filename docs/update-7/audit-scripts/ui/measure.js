// Numbers behind the findings, at every size: Home's Play button against the tab bar (with and without the Resume card, normal and
// Larger text), the top-bar title fitting, the run's board and brick size, the Tower back button, the run's Pause button.
// Usage: node measure.js   (prints one JSON line per configuration)
const { launch, player, wait, SIZES } = require('./lib');
(async () => {
  for (const [key, [w, h]] of Object.entries(SIZES)) {
    for (const large of [false, true]) {
      const { browser, page } = await launch({ width: w, height: h, dsf: 1 });
      const out = { key, w, h, large };
      for (const resume of [false, true]) {
        await player(page, { resume, large });
        await page.evaluate(() => BR.Router.go('home')); await wait(page, 1200);
        out[resume ? 'homeResume' : 'home'] = await page.evaluate(() => {
          const p = document.querySelector('.hero-play, .hero .btn'), tb = document.getElementById('tabbar'), disc = document.querySelector('.play-disc');
          const r = p.getBoundingClientRect(), t = tb.getBoundingClientRect(), d = disc.getBoundingClientRect();
          const land = innerWidth > innerHeight;
          return { playTop: Math.round(r.top), playBottom: Math.round(r.bottom), tabTop: Math.round(land ? innerHeight : t.top), discTop: Math.round(land ? innerHeight : d.top), visible: Math.max(0, Math.round(Math.min(r.bottom, land ? innerHeight : d.top) - r.top)), playH: Math.round(r.height) };
        });
      }
      out.titles = {};
      for (const t of ['shop', 'collection', 'missions', 'profile']) {
        await page.evaluate((t) => BR.Router.go(t), t); await wait(page, 700);
        out.titles[t] = await page.evaluate(() => { const e = document.getElementById('tbTitle'); return e.scrollWidth > e.clientWidth + 1 ? `CLIPPED ${e.scrollWidth}>${e.clientWidth}` : 'ok'; });
      }
      await page.evaluate(() => { const C = BR.Router.screens.collection; C.view = 'tower'; BR.Router.go('collection'); BR.Router.rerender(); }); await wait(page, 1500);
      out.towerBack = await page.evaluate(() => { const b = document.querySelector('[data-act="close-tower"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { cls: b.className, w: Math.round(r.width), h: Math.round(r.height), txt: b.textContent.trim() }; });
      await page.evaluate(() => { BR.Router.screens.collection.view = 'items'; });
      if (!large) {
        await page.evaluate(() => { while (BR.Back.depth) BR.Back.closeTop(); BR.Storage.clearRun(); BR.Router.go('home', { instant: true }); __app.startRun({ mode: 'rush', boosts: {} }); });
        await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 15000 }).catch(() => {});
        await wait(page, 500);
        out.run = await page.evaluate(() => { const b = document.getElementById('board').getBoundingClientRect(), p = document.getElementById('btnPause').getBoundingClientRect(), s = document.querySelector('.bslot').getBoundingClientRect(), f = document.getElementById('fuse').getBoundingClientRect(); return { board: Math.round(b.width), brick: +(b.width / 8).toFixed(1), screenW: innerWidth, hudW: Math.round(f.width), pause: `${Math.round(p.width)}x${Math.round(p.height)}`, slot: `${Math.round(s.width)}x${Math.round(s.height)}` }; });
        await page.evaluate(() => { BR.Run.over = true; BR.Run.token++; while (BR.Back.depth) BR.Back.closeTop(); BR.Storage.clearRun(); BR.Router.go('home', { instant: true }); __app.startRun({ mode: 'chill', boosts: {} }); });
        await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy && BR.Run.engine.chill, null, { timeout: 15000 }).catch(() => {});
        await wait(page, 500);
        out.chill = await page.evaluate(() => { const b = document.getElementById('board').getBoundingClientRect(), m = document.getElementById('msgBand').getBoundingClientRect(); return { board: Math.round(b.width), brick: +(b.width / 8).toFixed(1), freeBelow: Math.round(innerHeight - m.bottom) }; });
      }
      console.log(JSON.stringify(out));
      await browser.close();
    }
  }
})();
