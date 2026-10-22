const H = require('./h.js');
const S = require('./sheet.js');
const BOARDS = {
  n2:   ['01234560','12345601','23456012','34066123','45601234','56012345','60123456','01234560'],
  n8:   ['01234560','12345601','23333332','34333363','45601234','56012345','60123456','01234560'],
  n12:  ['01234560','12345601','23333402','34333363','45333334','56012345','60123456','01234560'],
  n16:  ['01234560','12345601','23333402','34333363','45333334','56333345','60123456','01234560'],
  n24:  ['01234560','13333331','23333332','34333363','45333334','56012345','60123456','01234560'],
  line: ['01234560','12345601','23456012','44444444','45601234','56012345','60123456','01234560'],
  n12top: ['33334560','33335601','33336012','34560123','45601234','56012345','60123456','01234560'],
};
const TAPS = { n2: [3, 3], n8: [2, 3], n12: [3, 3], n16: [3, 3], n24: [2, 3], line: [3, 0], n12top: [0, 0] };
const FR = [0, 40, 90, 150, 230, 330, 480, 700, 1000];
(async () => {
  const L = await H.boot({ slow: true, dsf: 1 });
  const { page } = L;
  const which = process.argv[2] ? process.argv[2].split(',') : Object.keys(BOARDS);
  const pre = process.argv[3] || 'pop';
  if (process.argv[4]) await H.equip(page, process.argv[4]);
  await H.startRun(page, 'rush');
  for (const k of which) {
    await page.evaluate(() => { const e = BR.Run.engine; e.fuse = 25; });
    await H.setBoard(page, BOARDS[k]);
    await page.waitForTimeout(150);
    const items = [];
    await H.press(page, ...TAPS[k]); await page.waitForTimeout(200);
    items.push(['press', await H.shot(page, `${pre}_${k}_press`)]);
    const SL = 0.1;
    await L.rate(SL);
    await H.release(page);
    const t0 = Date.now();
    for (const f of FR) {
      const wait = f / SL - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait);
      items.push([`${f}ms`, await H.shot(page, `${pre}_${k}_${f}`)]);
    }
    await L.rate(1);
    await H.idle(page); await page.waitForTimeout(400);
    console.log(await S.make(`${H.OUT}/sheet_${pre}_${k}.png`, items, 5, 260, `${pre} ${k}`));
  }
  console.log(L.errors);
  await L.browser.close();
})();
