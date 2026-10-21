// Equips every item in turn and screenshots the run screen so each skin, board and fuse can be reviewed.
// Usage: node tests/gallery.js <outdir> [type]
const { launch } = require('./lib');
const fs = require('fs');
const out = process.argv[2] || '/tmp/gallery'; const only = process.argv[3];
fs.mkdirSync(out, { recursive: true });
(async () => {
  const { browser, page, errors } = await launch({ width: 390, height: 844, dsf: 1 });
  await page.evaluate(() => { BR.Storage.data.seenTutorial = true; BR.Storage.data.runs = 3; BR.Storage.data.settings.sound = false; BR.App.applySettings(); });
  const items = await page.evaluate(() => BR.ITEMS.map((i) => ({ id: i.id, type: i.type })).concat(['skin', 'pop', 'board', 'fuse'].map((t) => ({ id: 'default:' + t, type: t }))));
  for (const it of items) {
    if (only && it.type !== only) continue;
    if (it.type === 'pop') continue;
    await page.evaluate((it) => {
      const P = BR.Progress;
      if (it.id.startsWith('default')) P.equip('default', it.type);
      else { let inst = BR.Storage.data.profile.vault.find((v) => v.itemId === it.id); if (!inst) inst = P.keep({ itemId: it.id, shine: 'plain', seed: 1234, counter: null }); P.equip(inst.uid, it.type); }
      BR.Skins.apply();
      BR.Run.over = true; if (BR.Router.current === 'run') BR.Router.go('home', { instant: true });
      __app.startRun({ mode: 'rush', boosts: {} });
    }, it);
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 8000 }).catch(() => {});
    // pop a couple of groups so the effects show, then freeze on a moment with the fuse mid-burn
    await page.evaluate(() => { BR.Run.engine.fuse = 17; });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${it.type}_${it.id.replace(':', '_')}.png` });
  }
  console.log('errors', errors);
  await browser.close();
})();
