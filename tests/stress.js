// Bot plays the real UI (rounds, boosters, round clears, game overs) and opens Geodes.
// After every action the DOM bricks must equal engine state exactly.
// Usage: node tests/stress.js [reduced|full] [actions] [geodes]
const { launch } = require('./lib');
const REDUCED = process.argv[2] !== 'full';
const ACTIONS = +(process.argv[3] || 120);
const GEODES = +(process.argv[4] || 10);
(async () => {
  const { browser, page, errors } = await launch({ width: 430, height: 820, mobile: false });
  if (REDUCED) await page.evaluate(() => { BR.Storage.data.settings.reduced = true; __brick.applySettings(); });
  let problems = 0;
  const note = (...a) => { problems++; console.log('PROBLEM', ...a); };

  const verify = async (tag) => {
    const issues = await page.evaluate(() => {
      const a = __brick; const e = a.engine, v = a.view; const out = [];
      if (v.bricks.size !== 64) out.push('brick count ' + v.bricks.size);
      if (document.querySelectorAll('#field .brick').length !== 64) out.push('dom bricks ' + document.querySelectorAll('#field .brick').length);
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const b = e.board.grid[r][c]; const rec = v.bricks.get(b.id);
        if (!rec) { out.push('missing ' + r + ',' + c); continue; }
        if (rec.r !== r || rec.c !== c) out.push('pos ' + b.id);
        if (+rec.el.dataset.c !== b.color) out.push('color ' + r + ',' + c);
        const m = new DOMMatrixReadOnly(getComputedStyle(rec.el).transform);
        if (Math.abs(m.m41 - c * v.cell) > 1 || Math.abs(m.m42 - r * v.cell) > 1) out.push('visual ' + r + ',' + c);
      }
      if (e.movesLeft < 0) out.push('negative moves');
      return out;
    });
    if (issues.length) note(tag, issues.slice(0, 4));
    return issues.length === 0;
  };

  const settle = async () => {
    for (let i = 0; i < 400; i++) {
      const st = await page.evaluate(() => ({ busy: __brick.busy, rc: document.getElementById('roundclear').classList.contains('show'), go: document.getElementById('gameover').classList.contains('show') }));
      if (st.go) return 'over';
      if (st.rc) { await page.waitForTimeout(REDUCED ? 500 : 2600); await page.click('#btnNextRound'); await page.waitForTimeout(REDUCED ? 450 : 700); continue; }
      if (!st.busy) return 'idle';
      await page.waitForTimeout(100);
    }
    note('STUCK');
    return 'stuck';
  };

  await page.click('#btnPlay');
  await page.waitForFunction(() => !__brick.busy, null, { timeout: 10000 });
  let runs = 1, boosterUses = 0, rounds = 0;
  for (let n = 0; n < ACTIONS; n++) {
    const act = await page.evaluate(() => {
      const a = __brick, e = a.engine;
      const useB = BR.BOOSTER_ORDER.filter((t) => e.inv[t] > 0);
      if (useB.length && Math.random() < 0.5) {
        const t = useB[Math.floor(Math.random() * useB.length)];
        const r = Math.floor(Math.random() * 8), c = Math.floor(Math.random() * 8);
        const q = a.view.pagePoint(r, c);
        return { type: t, x: q.x, y: q.y };
      }
      const taps = [];
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (e.plan(r, c)) taps.push({ r, c });
      const p = taps[Math.floor(Math.random() * taps.length)];
      const q = a.view.pagePoint(p.r, p.c);
      return { x: q.x, y: q.y };
    });
    if (act.type) { await page.click(`.bslot[data-b="${act.type}"]`); await page.waitForTimeout(60); boosterUses++; }
    await page.mouse.click(act.x, act.y);
    const st = await settle();
    if (st === 'over') {
      await page.waitForTimeout(REDUCED ? 700 : 1500);
      const info = await page.evaluate(() => ({ score: __brick.engine.score, rounds: __brick.engine.roundsCleared, level: BR.Progress.level, xp: BR.Progress.xp, geodes: BR.Progress.geodeCount() }));
      rounds += info.rounds;
      await page.click('#btnAgain'); runs++;
      await page.waitForFunction(() => !__brick.busy, null, { timeout: 12000 }).catch(() => note('no restart'));
      continue;
    }
    if (st === 'stuck') break;
    await page.waitForTimeout(REDUCED ? 380 : 480);
    await verify('after action ' + n);
  }
  console.log('runs', runs, 'boosterUses', boosterUses, 'roundsCleared(prev runs)', rounds);
  const prof = await page.evaluate(() => ({ level: BR.Progress.level, xp: BR.Progress.xp, geodes: BR.Progress.geodeCount(), best: __brick.store.data.best }));
  console.log('profile after bot', prof);

  // ---- open Geodes (random equip / keep / dust) ----
  await page.evaluate(() => __brick.toMenu());
  await page.waitForTimeout(300);
  await page.evaluate((n) => { BR.Storage.data.profile.geodes = { normal: n, series: Math.floor(n / 4) }; __brick.ui.refreshMenu(); }, GEODES);
  const before = await page.evaluate(() => ({ g: BR.Progress.geodeCount(), vault: BR.Storage.data.profile.vault.length, shards: BR.Storage.data.profile.shards }));
  await page.evaluate(() => { window.__opening = __brick.openGeodes(); });
  let opened = 0;
  for (let guard = 0; guard < 4000; guard++) {
    const st = await page.evaluate(() => ({ phase: document.getElementById('geode').dataset.phase, show: document.getElementById('geode').classList.contains('show'), resOn: document.getElementById('result').classList.contains('on'), act: getComputedStyle(document.getElementById('resultActions')).opacity }));
    if (!st.show && opened >= 1 && !(await page.evaluate(() => __brick.geodeBusy))) break;
    if (st.phase === 'idle' && st.show) { await page.locator('#geodeBtn').click({ force: true }).catch(() => {}); if (!REDUCED) { await page.waitForTimeout(250); await page.locator('#geodeBtn').click({ force: true }).catch(() => {}); await page.waitForTimeout(250); await page.locator('#geodeBtn').click({ force: true }).catch(() => {}); } }
    else if (st.phase === 'result' && st.resOn && +st.act > 0.9) {
      await page.waitForTimeout(700);
      const pick = Math.random();
      await page.click(pick < 0.5 ? '#btnEquip' : '#btnKeep'); opened++;
      await page.waitForTimeout(REDUCED ? 450 : 700);
    }
    else await page.waitForTimeout(100);
  }
  await page.waitForFunction(() => !__brick.geodeBusy, null, { timeout: 10000 }).catch(() => note('geodes still busy'));
  const after = await page.evaluate(() => ({ g: BR.Progress.geodeCount(), vault: BR.Storage.data.profile.vault.length, shards: BR.Storage.data.profile.shards, dupes: 0 }));
  console.log('geodes before', before, 'after', after, 'opened via UI', opened);
  if (after.g !== 0) note('geodes left', after.g);
  if (after.vault + after.shards / 10 <= before.vault) note('items/shards did not grow');
  // loadout must point at real instances
  const lo = await page.evaluate(() => { const p = BR.Storage.data.profile; return Object.values(p.loadout).every((u) => u === 'default' || p.vault.some((i) => i.uid === u)); });
  if (!lo) note('loadout points at missing instance');
  console.log('problems', problems, 'errors', errors);
  await browser.close();
  process.exit(problems || errors.length ? 1 : 0);
})();
