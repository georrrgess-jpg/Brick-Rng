const H = require('./h.js');
const S = require('./sheet.js');
const BIG = ['33333333','33333333','01234560','12345601','23456012','34560123','45601234','56012345'];
async function scenario(name, w, h, prep, mode = 'rush', reason = 'fuse') {
  const L = await H.boot({ width: w, height: h, dsf: w > 800 ? 1 : 2, mobile: w < 1000 });
  const { page } = L;
  await page.evaluate(prep);
  await H.startRun(page, mode);
  if (mode !== 'chill') await page.evaluate(() => { BR.Run.engine.fuse = 25; });
  await H.setBoard(page, BIG);
  await H.tap(page, 0, 0); await H.idle(page); await page.waitForTimeout(500);
  await page.evaluate((reason) => { if (BR.Run.goal) BR.Run.goal.done = true; if (reason === 'fuse') { BR.Run.engine.fuse = 0.01; BR.Run.engine.sparkUsed = true; } else if (reason === 'moves') { BR.Run.engine.movesLeft = 0; BR.Run.endRun('moves'); } else BR.Run.endRun(reason); }, reason);
  await page.waitForSelector('.results.on', { timeout: 10000 });
  const items = [];
  await page.waitForTimeout(700); items.push(['0.7s', await H.shot(page, `res_${name}_a`)]);
  await page.waitForTimeout(2300); items.push(['3s', await H.shot(page, `res_${name}_b`)]);
  await page.waitForTimeout(2000); items.push(['5s', await H.shot(page, `res_${name}_c`)]);
  // scroll to bottom
  await page.evaluate(() => { const s = document.querySelector('.res-scroll'); s.scrollTop = s.scrollHeight; });
  await page.waitForTimeout(300); items.push(['5s scrolled', await H.shot(page, `res_${name}_d`)]);
  const ov = await page.evaluate(() => { const out = []; document.querySelectorAll('.results *').forEach((el) => { if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible' && el.clientWidth > 0) out.push(el.className + ' ' + el.scrollWidth + '>' + el.clientWidth); }); const r = document.querySelector('.results').getBoundingClientRect(); return { out, w: r.width, doc: document.documentElement.scrollWidth }; });
  console.log(name, JSON.stringify(ov), L.errors);
  await L.browser.close();
  return items;
}
(async () => {
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return BR.dayKey(d); };
  const all = (y) => `(() => { const D = BR.Storage.data, p = D.profile; D.best.rush = 300; D.best.daily = 300; D.best.chill = 300; p.xp = BR.xpForLevel(p.level) - 30; p.streak = { ring: 6, weeks: 0, last: '${y}', shield: 1, best: 6 }; BR.Storage.save(); })`;
  const y = await (async () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
  const prep = eval(all(y));
  const sheets = [];
  const a = await scenario('all393', 393, 852, prep); sheets.push(...a.map(([l, p]) => ['393 all ' + l, p]));
  const b = await scenario('plain393', 393, 852, () => { const D = BR.Storage.data; D.best.rush = 999999; D.runs = 9; BR.Storage.save(); }, 'rush', 'ended'); sheets.push(...b.map(([l, p]) => ['393 plain ' + l, p]));
  const c = await scenario('daily393', 393, 852, prep, 'daily'); sheets.push(...c.map(([l, p]) => ['393 daily ' + l, p]));
  const d = await scenario('chill393', 393, 852, () => {}, 'chill', 'moves'); sheets.push(...d.map(([l, p]) => ['393 chill ' + l, p]));
  const e = await scenario('all360', 360, 640, prep); sheets.push(...e.map(([l, p]) => ['360 all ' + l, p]));
  console.log(await S.make(`${H.OUT}/sheet_results.png`, sheets, 4, 260, 'results'));
})();
