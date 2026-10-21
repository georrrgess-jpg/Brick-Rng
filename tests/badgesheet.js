// Every item as a badge on one sheet per type, in all four shines, so the whole catalogue can be reviewed side by side.
// Usage: node tests/badgesheet.js <outdir> [size]
const { launch } = require('./lib');
const fs = require('fs');
const out = process.argv[2] || '/tmp/badgesheet'; const size = +(process.argv[3] || 92);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const { browser, page, errors } = await launch({ width: 1300, height: 900, dsf: 1, mobile: false });
  for (const type of ['skin', 'pop', 'board', 'fuse']) {
    await page.evaluate(([type, size]) => {
      document.querySelectorAll('.badge-sheet').forEach((n) => n.remove());
      const w = document.createElement('div'); w.className = 'badge-sheet';
      w.style.cssText = 'position:fixed;inset:0;z-index:999;background:#150d2a;overflow:auto;padding:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(' + (size + 24) + 'px,1fr));gap:14px 10px;align-content:start';
      const items = BR.ITEMS.filter((i) => i.type === type).sort((a, b) => BR.RARITIES.findIndex((r) => r.id === a.rarity) - BR.RARITIES.findIndex((r) => r.id === b.rarity));
      items.forEach((it, n) => {
        ['plain', 'glossy', 'holo', 'prism'].forEach((sh) => {
          const c = document.createElement('div'); c.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;font:700 11px sans-serif;color:#cbbfe8;text-align:center';
          c.innerHTML = BR.Badge.html(it, { shine: sh, seed: 300 + n * 17 }, { size }) + `<span>${it.name}${sh === 'plain' ? '' : ' · ' + sh}</span>`;
          w.appendChild(c);
        });
      });
      document.body.appendChild(w);
    }, [type, size]);
    await page.waitForTimeout(600);
    const h = await page.evaluate(() => document.querySelector('.badge-sheet').scrollHeight);
    await page.setViewportSize({ width: 1300, height: Math.min(h + 10, 4000) });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/badges-${type}.png` });
    await page.setViewportSize({ width: 1300, height: 900 });
  }
  console.log(errors.join('\n') || 'no errors');
  await browser.close();
})();
