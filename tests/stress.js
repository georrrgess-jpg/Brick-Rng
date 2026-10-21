// Bot plays the real UI: Rush (with stage-ups, power-ups, pause, End Run), Chill rounds, Daily. After every
// action the DOM bricks must equal the engine state exactly. Usage: node tests/stress.js [reduced|full] [actions]
const { launch } = require('./lib');
const REDUCED = process.argv[2] !== 'full';
const ACTIONS = +(process.argv[3] || 150);
(async () => {
  const { browser, page, errors } = await launch({ width: 390, height: 844 });
  await page.evaluate((reduced) => {
    BR.Storage.data.settings.reduced = reduced; BR.Storage.data.seenTutorial = true; BR.App.applySettings(); BR.Storage.save();
    BR.Storage.data.runs = 3;
  }, REDUCED);
  let problems = 0;
  const note = (...a) => { problems++; console.log('PROBLEM', ...a); };
  const R = '(window.BR.Run)';

  const verify = async (tag) => {
    await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations !== Infinity && a.playState === 'running').map((a) => a.finished.catch(() => 0))));
    const issues = await page.evaluate(() => {
      const run = BR.Run, e = run.engine, v = run.view; const out = [];
      const n = 64;
      if (v.bricks.size !== n) out.push('brick count ' + v.bricks.size);
      if (document.querySelectorAll('#field .brick').length !== n) out.push('dom bricks ' + document.querySelectorAll('#field .brick').length);
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const b = e.board.grid[r][c]; if (!b) { out.push('hole ' + r + ',' + c); continue; }
        const rec = v.bricks.get(b.id);
        if (!rec) { out.push('missing ' + r + ',' + c); continue; }
        if (rec.r !== r || rec.c !== c) out.push('pos ' + b.id);
        if (+rec.el.dataset.c !== b.color && !rec.el.classList.contains('wild')) out.push('color ' + r + ',' + c);
        const m = new DOMMatrixReadOnly(getComputedStyle(rec.el).transform);
        if (Math.abs(m.m41 - c * v.cell) > 1 || Math.abs(m.m42 - r * v.cell) > 1) out.push('visual ' + r + ',' + c);
      }
      if (e.movesLeft < 0) out.push('negative moves');
      if (!(e.fuse >= 0)) out.push('fuse ' + e.fuse);
      return out;
    });
    if (issues.length) note(tag, issues.slice(0, 4));
    return issues.length === 0;
  };

  const settle = async (mode) => {
    for (let i = 0; i < 300; i++) {
      const st = await page.evaluate(() => ({ busy: BR.Run.busy, over: BR.Run.over, modal: BR.Run.modal, res: !!document.querySelector('.results.on') }));
      if (st.res || st.over) return 'over';
      if (!st.busy && !st.modal) return 'idle';
      await page.waitForTimeout(60);
    }
    note('STUCK in', mode); return 'stuck';
  };

  const play = async (mode, actions) => {
    await page.evaluate((m) => { BR.Storage.clearRun(); __app.startRun({ mode: m, boosts: {} }); }, mode);
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 12000 }).catch(() => note('never started', mode));
    let stages = 0, powers = 0, pauses = 0;
    for (let n = 0; n < actions; n++) {
      // keep the fuse alive so the bot can reach higher stages
      await page.evaluate(() => { const e = BR.Run.engine; if (!e.chill && e.fuse < 6) e.fuse = e.fuseMax; });
      const act = await page.evaluate(() => {
        const run = BR.Run, e = run.engine, v = run.view;
        const have = BR.BOOSTER_ORDER.filter((t) => e.inv[t] > 0);
        if (have.length && Math.random() < 0.5) {
          const t = have[Math.floor(Math.random() * have.length)]; const r = Math.floor(Math.random() * 8), c = Math.floor(Math.random() * 8);
          const q = v.pagePoint(r, c); return { type: t, x: q.x, y: q.y };
        }
        const taps = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (e.plan(r, c)) taps.push({ r, c });
        if (!taps.length) return { type: 'none' };
        taps.sort((a, b) => e.plan(b.r, b.c).cells.length - e.plan(a.r, a.c).cells.length);
        const pick = Math.random() < 0.7 ? taps[Math.floor(Math.random() * Math.min(3, taps.length))] : taps[Math.floor(Math.random() * taps.length)];
        const q = v.pagePoint(pick.r, pick.c); return { type: 'tap', x: q.x, y: q.y };
      });
      if (act.type === 'none') { await page.evaluate(() => BR.Run.engine.board.shuffle && 0); await page.waitForTimeout(200); continue; }
      if (act.type !== 'tap') { await page.click('.bslot[data-b="' + act.type + '"]'); powers++; await page.waitForTimeout(60); }
      await page.mouse.click(act.x, act.y);
      const res = await settle(mode);
      if (res === 'over') return { over: true, n };
      if (res === 'stuck') return { stuck: true, n };
      await verify(mode + ' #' + n);
      if (n % 37 === 20) { // pause and resume
        await page.click('#btnPause'); await page.waitForTimeout(REDUCED ? 200 : 600); pauses++;
        const paused = await page.evaluate(() => BR.Run.paused);
        if (!paused) note('pause did not engage');
        const before = await page.evaluate(() => BR.Run.engine.fuse); await page.waitForTimeout(500);
        const after = await page.evaluate(() => BR.Run.engine.fuse);
        if (Math.abs(before - after) > 0.001) note('fuse moved while paused', before, after);
        await page.click('.sheet .btn:has-text("Resume")'); await page.waitForTimeout(REDUCED ? 300 : 700);
      }
      // give the bot some charge so power-ups get exercised
      if (n % 25 === 10) await page.evaluate(() => { BR.Run.engine.inv.hammer++; BR.Run.engine.inv.beam++; BR.Run.engine.inv.prism++; BR.Run.renderPower(null); });
    }
    return { n: actions, powers, pauses };
  };

  console.log('rush', JSON.stringify(await play('rush', ACTIONS)));
  // End Run from the pause menu
  let ended = await page.evaluate(() => !BR.Run.over);
  if (!ended) await page.waitForSelector('.results.on', { timeout: 12000 }).catch(() => note('no results after fuse out'));
  if (ended) {
    await page.click('#btnPause'); await page.waitForTimeout(500);
    await page.locator('.sheet .btn:has-text("End run")').first().click(); await page.waitForTimeout(500);
    await page.locator('.sheet .btn:has-text("End run")').last().click(); // confirm
    await page.waitForSelector('.results.on', { timeout: 12000 }).catch(() => note('no results after End Run'));
  }
  await page.waitForTimeout(REDUCED ? 800 : 5000);
  await page.screenshot({ path: process.env.SHOT_RES || '/tmp/res.png' });
  const resText = await page.evaluate(() => (document.querySelector('.results') || {}).innerText || '');
  if (!/Coins/i.test(resText)) note('results missing Coins', resText.slice(0, 120));
  await page.evaluate(() => BR.Run.closeResults && BR.Run.closeResults('home')); await page.waitForTimeout(800);
  const coinsAfter = await page.evaluate(() => BR.Storage.data.profile.coins);
  console.log('coins after rush run', coinsAfter);

  console.log('chill', JSON.stringify(await play('chill', Math.round(ACTIONS / 2))));
  await page.evaluate(() => { if (!BR.Run.over) BR.Run.endRun && BR.Run.endRun('quit'); }); await page.waitForTimeout(1500);
  await page.evaluate(() => BR.Run.closeResults && BR.Run.closeResults('home')); await page.waitForTimeout(600);
  console.log('daily', JSON.stringify(await play('daily', Math.round(ACTIONS / 3))));

  console.log('errors', errors.filter((e) => !/Failed to load resource/.test(e)));
  console.log('problems', problems);
  await browser.close();
  process.exit(problems || errors.some((e) => /pageerror/.test(e)) ? 1 : 0);
})();
