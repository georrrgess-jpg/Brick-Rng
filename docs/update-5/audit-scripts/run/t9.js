const H = require('./h.js');
(async () => {
  for (const [w, h] of [[393, 852], [360, 640]]) {
    const L = await H.boot({ width: w, height: h, dsf: 1 });
    const { page } = L;
    await H.startRun(page, 'rush');
    await page.evaluate(() => { BR.Run.engine.fuse = 0.02; });
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => { const b = document.getElementById('btnPause').getBoundingClientRect(); const pts = [[0.5, 0.5], [0.7, 0.8], [0.9, 0.9]].map(([fx, fy]) => { const el = document.elementFromPoint(b.left + b.width * fx, b.top + b.height * fy); return el ? (el.id || el.className.baseVal || el.className) : null; }); const fl = document.querySelector('.fz-flare').getBoundingClientRect(); return { pause: [b.left, b.top, b.right, b.bottom].map(Math.round), flare: [fl.left, fl.top, fl.right, fl.bottom].map(Math.round), hits: pts }; });
    console.log(w, JSON.stringify(r));
    await L.browser.close();
  }
})();
