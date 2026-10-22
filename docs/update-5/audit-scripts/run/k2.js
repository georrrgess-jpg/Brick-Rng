const H = require('./h.js');
const S = require('./sheet.js');
const ROWS = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => String((c + 3 * r) % 7)).join(''));
(async () => {
  const mode = process.argv[2] || 'skin';
  const L = await H.boot({ dsf: mode === 'skin' ? 2 : 1 });
  const { page } = L;
  const ids = await page.evaluate((t) => ['default'].concat(BR.ITEMS.filter((i) => i.type === t).map((i) => i.id)), mode);
  const rest = [], rush = [];
  for (const id of ids) {
    await H.equip(page, id, mode);
    await H.startRun(page, 'rush');
    await page.evaluate(() => { BR.Run.engine.fuse = 25; BR.Run.engine.stage = 6; });
    await H.setBoard(page, ROWS);
    await page.waitForTimeout(700);
    const clip = mode === 'skin' ? await page.evaluate(() => { const r = document.getElementById('boardWrap').getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }) : undefined;
    const name = await page.evaluate((id) => id === 'default' ? (BR.DEFAULTS[BR.Run ? 'skin' : 'skin'].name) : BR.itemById[id].name, id);
    rest.push([`${id} ${name}`, await H.shot(page, `k_${mode}_${id}_rest`, clip)]);
    await page.evaluate(() => { const e = BR.Run.engine; e.rush.active = true; e.rush.left = 8; e.rush.meter = 100; BR.Run.rushStart(); });
    await page.waitForTimeout(1500);
    rush.push([`${id} rush`, await H.shot(page, `k_${mode}_${id}_rush`, clip)]);
    await page.evaluate(() => { BR.Run.engine.rush.left = 0.01; });
    await page.waitForTimeout(300);
  }
  const all = [];
  rest.forEach((r, i) => { all.push(r); all.push(rush[i]); });
  const per = mode === 'skin' ? 8 : 6;
  for (let i = 0; i < all.length; i += per * 2) console.log(await S.make(`${H.OUT}/sheet_k_${mode}_${i / (per * 2)}.png`, all.slice(i, i + per * 2), 4, mode === 'skin' ? 330 : 250, `${mode} rest / rush`));
  console.log(L.errors);
  await L.browser.close();
})();
