const H = require('./h.js');
(async () => {
  const L = await H.boot({ width: 844, height: 390, dsf: 2 });
  const { page } = L;
  await H.startRun(page, 'rush'); await page.waitForTimeout(400);
  await page.click('#btnPause'); await page.waitForTimeout(700);
  console.log(await H.shot(page, 'land_pause'));
  const info = await page.evaluate(() => { const sh = document.querySelector('#layer-sheets .sheet, #layer-sheets [class*=sheet]'); const all = Array.from(document.querySelectorAll('#layer-sheets *')).filter((e) => e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflowY !== 'visible').map((e) => e.className + ' ' + e.scrollHeight + '/' + e.clientHeight + ' ' + getComputedStyle(e).overflowY); const b = document.querySelector('[data-p="leave"]').getBoundingClientRect(); return { leave: [b.top, b.bottom], vh: innerHeight, all }; });
  console.log(JSON.stringify(info));
  await L.browser.close();
})();
