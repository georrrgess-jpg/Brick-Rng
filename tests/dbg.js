const { launch } = require('./lib');
(async () => {
  const { browser, page } = await launch({ width: 400, height: 780 });
  await page.evaluate(() => { BR.Storage.record('spark'); window.__brick.ui.renderCollection(); });
  await page.click('#btnCollection'); await page.waitForTimeout(1500);
  console.log(await page.evaluate(() => {
    const c = document.querySelector('.ccard:not(.locked)'); const h = c.querySelector('h3'); const p = c.querySelector('p');
    const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)].join(','); };
    return JSON.stringify({ card: r(c), h3: r(h), p: r(p), h3color: getComputedStyle(h).color, h3op: getComputedStyle(h).opacity, ico: r(c.querySelector('.core-ico')), cardOverflow: getComputedStyle(c).overflow, display: getComputedStyle(c).display, html: c.innerHTML.slice(0, 200) });
  }));
  await browser.close();
})();
