const { launch } = require('/home/user/Brick-Rng/tests/lib.js');
(async () => {
  const { browser, page, errors } = await launch({ width: 900, height: 700, dsf: 2, mobile: false });
  await page.evaluate(() => {
    const w = document.createElement('div');
    w.style.cssText = 'position:fixed;inset:0;z-index:999;background:#150d2a;padding:10px;display:flex;flex-direction:column;gap:10px';
    for (const size of [56, 72, 104]) {
      const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;align-items:flex-end';
      BR.ITEMS.filter((i) => i.type === 'fuse').concat([BR.DEFAULTS.fuse]).forEach((it) => { const c = document.createElement('div'); c.innerHTML = BR.Badge.html(it, { shine: 'plain', seed: 3 }, { size }); row.appendChild(c); });
      w.appendChild(row);
    }
    document.body.appendChild(w);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: __dirname + '/shots/badge_fuse_sizes.png' });
  // what is inside a 56px fuse badge
  const info = await page.evaluate(() => { const b = document.querySelector('.badge-sheet') ; const el = document.querySelectorAll('[class*=badge]')[0]; return el ? el.outerHTML.slice(0, 1500) : 'none'; });
  console.log(info);
  console.log(errors);
  await browser.close();
})();
