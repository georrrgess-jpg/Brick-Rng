const { launch } = require('/home/user/Brick-Rng/tests/lib.js');
(async () => {
  const { browser, page } = await launch({ width: 700, height: 300, dsf: 2, mobile: false });
  const r = await page.evaluate(() => {
    const w = document.createElement('div'); w.style.cssText = 'position:fixed;inset:0;z-index:999;background:#150d2a;padding:10px;display:flex;gap:10px;align-items:flex-start';
    const it = BR.itemById.u_dragon;
    w.innerHTML = BR.Badge.html(it, { shine: 'plain', seed: 3 }, { size: 104 }) + '<div id="fixed">' + BR.Badge.html(it, { shine: 'plain', seed: 3 }, { size: 104 }) + '</div>';
    document.body.appendChild(w);
    const st = document.createElement('style'); st.textContent = '#fixed .bdg-fuse .mini-fuse{zoom:1;transform:rotate(-16deg) scale(calc(var(--k) * 1.1 * 0.62))}'; document.head.appendChild(st);
    const m = (sel) => { const b = document.querySelector(sel + ' .bdg').getBoundingClientRect(), f = document.querySelector(sel + ' .mf-bomb').getBoundingClientRect(), s = document.querySelector(sel + ' .mf-spark').getBoundingClientRect(); return { badge: [b.left, b.right].map(Math.round), bomb: [f.left, f.right].map(Math.round), spark: [s.left, s.right].map(Math.round) }; };
    return { orig: m('div[style*="fixed"] > :first-child'.replace(' > :first-child','')), };
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: __dirname + '/shots/badge_fuse_zoomtest.png' });
  const m = await page.evaluate(() => Array.from(document.querySelectorAll('.bdg.t-fuse')).slice(-2).map((b) => { const r = b.getBoundingClientRect(), f = b.querySelector('.mf-bomb').getBoundingClientRect(), s = b.querySelector('.mf-spark').getBoundingClientRect(); return { badge: [r.left, r.right].map(Math.round), bomb: [f.left, f.right].map(Math.round), spark: [s.left, s.right].map(Math.round) }; }));
  console.log(JSON.stringify(m));
  await browser.close();
})();
