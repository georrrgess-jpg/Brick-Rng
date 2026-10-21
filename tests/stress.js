// Plays the real UI with a bot. After every turn, DOM bricks must equal engine state exactly.
const { launch } = require('./lib');
const REDUCED = process.argv[2] === 'reduced';
const TURNS = +(process.argv[3] || 25);
(async () => {
  const { browser, page, errors } = await launch({ width: 430, height: 820, mobile: false });
  if (REDUCED) await page.evaluate(() => { BR.Storage.data.settings.reduced = true; __brick.applySettings(); });
  let cores = await page.evaluate(() => BR.CORES.map((c) => c.id));
  if (process.env.ONLY) cores = process.env.ONLY.split(',');
  let problems = 0;
  for (const coreId of cores) {
    await page.click('#btnPlay');
    await page.waitForFunction(() => !__brick.busy, null, { timeout: 15000 });
    await page.evaluate((id) => { const a = __brick, e = a.engine; e.equip(BR.coreById[id]); a.view.setWild(e.wild()); a.ui.setCore(e); e.fuel = 40; a.ui.setFuel(40, false); }, coreId);
    for (let t = 0; t < TURNS; t++) {
      const tap = await page.evaluate(() => {
        const a = __brick, e = a.engine; const taps = [];
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p) taps.push({ r, c, n: p.n }); }
        const pick = taps[Math.floor(Math.random() * taps.length)];
        const q = a.view.pagePoint(pick.r, pick.c); return { x: q.x, y: q.y };
      });
      await page.mouse.click(tap.x, tap.y);
      // wait for the turn to finish, drive crates if they appear
      for (let i = 0; i < 300; i++) {
        const st = await page.evaluate(() => ({ busy: __brick.busy, crate: __brick.inCrate, over: __brick.over, stage: document.getElementById('crateStage').classList.contains('on') && !document.getElementById('btnOpenCrate').disabled, res: document.getElementById('result').classList.contains('on') && document.getElementById('crate').classList.contains('show') }));
        if (st.over) break;
        if (!st.busy) break;
        if (st.stage) { await page.waitForTimeout(150); await page.click('#btnOpenCrate').catch(() => {}); }
        else if (st.res) { await page.waitForTimeout(REDUCED ? 600 : 1500); await page.click(Math.random() < 0.7 ? '#btnEquip' : '#btnScrap').catch(() => {}); await page.waitForFunction(() => !__brick.inCrate, null, { timeout: 8000 }).catch(() => {}); }
        else await page.waitForTimeout(100);
        if (i === 299) { console.log('STUCK', coreId, t, JSON.stringify(await page.evaluate(() => ({ busy: __brick.busy, inCrate: __brick.inCrate, paused: __brick.paused, over: __brick.over, fuel: __brick.engine.fuel, charge: __brick.engine.charge, need: __brick.engine.need, crate: document.getElementById('crate').className, stage: document.getElementById('crateStage').className, reel: document.getElementById('reelStage').className, result: document.getElementById('result').className, openDisabled: document.getElementById('btnOpenCrate').disabled })))); await page.screenshot({ path: process.env.SHOT || '/tmp/stuck.png' }); problems++; }
      }
      await page.waitForTimeout(REDUCED ? 380 : 450); // let rebound/squash finish
      const check = await page.evaluate(() => {
        const a = __brick; if (a.over) return { over: true };
        const e = a.engine, v = a.view; const issues = [];
        if (v.bricks.size !== 64) issues.push('brick count ' + v.bricks.size);
        const dom = document.querySelectorAll('#field .brick').length;
        if (dom !== 64) issues.push('dom bricks ' + dom);
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
          const b = e.board.grid[r][c]; const rec = v.bricks.get(b.id);
          if (!rec) { issues.push('missing ' + r + ',' + c); continue; }
          if (rec.r !== r || rec.c !== c) issues.push('pos ' + b.id);
          if (+rec.el.dataset.c !== b.color) issues.push('color ' + r + ',' + c);
          const m = new DOMMatrixReadOnly(getComputedStyle(rec.el).transform);
          if (Math.abs(m.m41 - c * v.cell) > 1 || Math.abs(m.m42 - r * v.cell) > 1) issues.push('visual pos ' + r + ',' + c + ' got ' + Math.round(m.m41) + ',' + Math.round(m.m42));
        }
        return { issues };
      });
      if (check.over) break;
      if (check.issues.length) { console.log('MISMATCH', coreId, 'turn', t, check.issues.slice(0, 4)); problems++; break; }
    }
    console.log('ok', coreId);
    await page.evaluate(() => __brick.toMenu());
    await page.waitForTimeout(200);
  }
  console.log('problems', problems, 'errors', errors);
  await browser.close();
  process.exit(problems || errors.length ? 1 : 0);
})();
