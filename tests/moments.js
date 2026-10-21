// Equips every item with a signature moment and plays a few pops (including a Rush start) to prove none of them throws.
// Usage: node tests/moments.js [outdir]   (screenshots go to outdir when given)
const { launch } = require('./lib');
const fs = require('fs');
const out = process.argv[2];
if (out) fs.mkdirSync(out, { recursive: true });
(async () => {
  const { browser, page, errors } = await launch({ width: 390, height: 844, dsf: 1 });
  await page.evaluate(() => { BR.Storage.data.seenTutorial = true; BR.Storage.data.runs = 3; BR.Storage.data.settings.sound = false; BR.App.applySettings(); });
  const ids = await page.evaluate(() => BR.ITEMS.filter((i) => i.moment).map((i) => i.id));   // every item that has a signature moment
  console.log(ids.length + ' items with moments');
  let bad = 0;
  for (const id of ids) {
    await page.evaluate((id) => {
      const P = BR.Progress, it = BR.itemById[id];
      let inst = BR.Storage.data.profile.vault.find((v) => v.itemId === id) || P.keep({ itemId: id, shine: 'plain', seed: 5, counter: null });
      P.equip(inst.uid, it.type); BR.Skins.apply();
      if (BR.Router.current === 'run') { BR.Run.over = true; BR.Router.go('home', { instant: true }); }
      __app.startRun({ mode: 'rush', boosts: {} });
    }, id);
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 8000 });
    const tap = async () => {
      const a = await page.evaluate(() => { const e = BR.Run.engine; let best = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!best || p.cells.length > best.n)) best = { r, c, n: p.cells.length }; } return best && BR.Run.view.pagePoint(best.r, best.c); });
      if (a) await page.mouse.click(a.x, a.y);
      await page.waitForFunction(() => !BR.Run.busy, null, { timeout: 8000 }).catch(() => { bad++; console.log('stuck', id); });
    };
    await page.evaluate(() => { BR.Run.engine.rush.meter = 99; });
    for (let i = 0; i < 3; i++) { await tap(); await page.waitForTimeout(80); }
    if (out) await page.screenshot({ path: `${out}/${id}.png` });
    await page.waitForTimeout(250);
  }
  const real = errors.filter((e) => !/Failed to load resource/.test(e));
  console.log(real.length ? real : 'no errors', bad ? 'stuck ' + bad : '');
  await browser.close();
  process.exit(real.length || bad ? 1 : 0);
})();
