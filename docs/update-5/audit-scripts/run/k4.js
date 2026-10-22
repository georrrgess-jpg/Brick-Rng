const H = require('./h.js');
const S = require('./sheet.js');
const SMALL = ['01234560','12345601','23456012','34566123','45601234','56012345','60123456','01234560'];
const BIG = ['01234560','12345601','23333402','34333363','45333334','56012345','60123456','01234560'];
(async () => {
  const L = await H.boot({ slow: true, dsf: 1 });
  const { page } = L;
  const ids = ['default'].concat(await page.evaluate(() => BR.ITEMS.filter((i) => i.type === 'pop').map((i) => i.id)));
  const only = process.argv[2] ? process.argv[2].split(',') : null;
  const all = [];
  const clip = { x: 0, y: 100, width: 393, height: 540 };
  for (const id of ids) {
    if (only && !only.includes(id)) continue;
    await H.equip(page, id, 'pop');
    await H.startRun(page, 'rush');
    for (const [k, rows, tap] of [['small3', SMALL, [3, 4]], ['big12', BIG, [3, 3]]]) {
      await page.evaluate(() => { BR.Run.engine.fuse = 25; BR.Run.engine.streak = 0; });
      await H.setBoard(page, rows);
      await page.waitForTimeout(200);
      await L.rate(0.1);
      await H.tap(page, ...tap);
      const t0 = Date.now();
      for (const f of k === 'small3' ? [200, 450] : [200, 450, 800]) {
        const w = f / 0.1 - (Date.now() - t0); if (w > 0) await page.waitForTimeout(w);
        all.push([`${id} ${k} ${f}ms`, await H.shot(page, `kp_${id}_${k}_${f}`, clip)]);
      }
      await L.rate(1); await H.idle(page); await page.waitForTimeout(500);
    }
  }
  for (let i = 0; i < all.length; i += 20) console.log(await S.make(`${H.OUT}/sheet_kp_${only ? only.join('_') : 'all'}_${i / 20}.png`, all.slice(i, i + 20), 5, 230, 'pops mid-burst'));
  console.log(L.errors);
  await L.browser.close();
})();
