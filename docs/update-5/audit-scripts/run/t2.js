const H = require('./h.js');
(async () => {
  const L = await H.boot({ dsf: 1 });
  const { page } = L;
  await H.startRun(page, 'rush');
  await page.waitForTimeout(1500);
  const out = await page.evaluate(async () => {
    document.querySelectorAll('.callout,.float').forEach((n) => n.remove());
    BR.Run.callout('TEST', '#ffd66b');
    BR.Run.floatText('+999', 100, 100, {});
    const c = document.querySelector('.callout'), f = document.querySelector('.float');
    const rows = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 1150) {
      await new Promise((r) => setTimeout(r, 50));
      const t = Math.round(performance.now() - t0);
      rows.push(`${t}ms callout op=${(+getComputedStyle(c).opacity).toFixed(2)} float op=${(+getComputedStyle(f).opacity).toFixed(2)}`);
    }
    return rows;
  });
  console.log(out.join('\n'));
  await L.browser.close();
})();
