// A real Update 4.1 save (level 34, 48 items, a Rush run in progress with its older v1 snapshot) opens in this build:
// nothing is lost, the Season 4 track starts at zero, the run resumes with its score, and nothing throws.
// tests/fixtures/save-4.1.json is the localStorage of that build (both keys), made by playing it in a browser.
const fs = require('fs'), path = require('path');
const { launch } = require('./lib');
const save = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'save-4.1.json'), 'utf8'));
let bad = 0;
const ok = (c, m, ...x) => { if (!c) { bad++; console.log('FAIL', m, ...x); } };
(async () => {
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1,
    setup: `(() => { const d = ${JSON.stringify(save)}; if (!localStorage.getItem('poprush.v4')) Object.keys(d).forEach((k) => localStorage.setItem(k, d[k])); })();` });
  await page.waitForTimeout(1200);
  const old = JSON.parse(save['poprush.v4']).profile, oldRun = JSON.parse(save['poprush.run']);
  const now = await page.evaluate(() => { const pr = BR.Storage.data.profile; return { level: pr.level, coins: pr.coins, owned: pr.vault.length, season: BR.Progress.seasonStatus(), hat: BR.Progress.equippedHat(), loadout: pr.loadout, run: !!BR.Storage.loadRun(), hasHats: Array.isArray(pr.hats) }; });
  ok(now.level === old.level, 'level kept', now.level, old.level);
  ok(now.coins === old.coins, 'Coins kept', now.coins, old.coins);
  ok(now.owned === old.vault.length, 'every item kept', now.owned, old.vault.length);
  ok(now.season.tier === 0 && now.season.xp === 0 && !now.season.done, 'the season track starts at zero', JSON.stringify(now.season));
  ok(now.hasHats && now.hat === null, 'no hat is worn until one is chosen');
  ok(now.run, 'the saved run is still there');
  await page.evaluate(() => { BR.Coach.markAllSeen(); BR.App.resume(); });
  await page.waitForFunction(() => BR.Router.current === 'run' && BR.Run.clock, null, { timeout: 8000 }).catch(() => {});
  const r = await page.evaluate(() => ({ score: BR.Run.engine.score, stage: BR.Run.engine.stage, fuse: BR.Run.engine.fuse }));
  ok(r.score === oldRun.score && r.stage === oldRun.stage, 'the old run resumes with its score and stage', JSON.stringify(r), oldRun.score, oldRun.stage);
  // it can be played on: one pop, and the score goes up
  const before = r.score;
  const a = await page.evaluate(() => { const e = BR.Run.engine; let best = null; for (let i = 0; i < 8; i++) for (let c = 0; c < 8; c++) { const p = e.plan(i, c); if (p && (!best || p.cells.length > best.n)) best = { i, c, n: p.cells.length }; } const pt = BR.Run.view.pagePoint(best.i, best.c); return { x: pt.x, y: pt.y }; });
  await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(1200);
  ok(await page.evaluate(() => BR.Run.engine.score) > before, 'the resumed run can be played on');
  ok(errors.length === 0, 'console errors', errors.join(' | '));
  await browser.close();
  console.log(bad ? bad + ' failures' : 'upgrade ok');
  process.exit(bad ? 1 : 0);
})();
