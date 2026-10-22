// Real touch events on a phone viewport: tap pops, press previews, sliding off the board cancels, a buffered tap
// during an animation still counts, and the page never scrolls or zooms.
const { launch } = require('./lib');
(async () => {
  const { browser, ctx, page, errors } = await launch({ width: 390, height: 844, dsf: 2 });
  const cdp = await ctx.newCDPSession(page);
  let problems = 0; const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };
  await page.evaluate(() => { BR.Storage.data.settings.sound = false; BR.Storage.data.seenTutorial = true; BR.Storage.data.runs = 5; BR.Storage.data.settings.reduced = true; BR.App.applySettings(); __app.startRun({ mode: 'rush', boosts: {} }); });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy);
  const target = () => page.evaluate(() => { const e = BR.Run.engine; let best = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!best || p.cells.length > best.n)) best = { r, c, n: p.cells.length }; } const q = BR.Run.view.pagePoint(best.r, best.c); return { x: q.x, y: q.y, n: best.n }; });
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });

  // press shows the preview, release pops
  let t = await target();
  const s0 = await page.evaluate(() => BR.Run.engine.score);
  await touch('touchStart', t.x, t.y); await page.waitForTimeout(160);
  ok(await page.evaluate(() => document.querySelectorAll('#field .brick.hl').length) >= 2, 'press did not highlight the group');
  ok(await page.evaluate(() => document.getElementById('field').classList.contains('has-hl')), 'no dimming while pressing');
  await touch('touchEnd'); await page.waitForTimeout(500);
  ok(await page.evaluate((s) => BR.Run.engine.score > s, s0), 'release did not pop');
  await page.waitForFunction(() => !BR.Run.busy);

  // press, slide off the board, release: nothing happens
  t = await target();
  const s1 = await page.evaluate(() => BR.Run.engine.score);
  await touch('touchStart', t.x, t.y); await page.waitForTimeout(100);
  await touch('touchMove', 195, 800); await page.waitForTimeout(100);
  await touch('touchEnd'); await page.waitForTimeout(400);
  ok(await page.evaluate((s) => BR.Run.engine.score === s, s1), 'slide-off popped anyway');
  ok(await page.evaluate(() => document.querySelectorAll('#field .brick.hl').length) === 0, 'highlight stuck after cancel');

  // page does not scroll or zoom
  await page.touchscreen.tap(195, 60);
  await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 400, yDistance: -300, gestureSourceType: 'touch' }).catch(() => {});
  ok(await page.evaluate(() => window.scrollY === 0 && document.documentElement.scrollTop === 0 && window.visualViewport.scale === 1), 'page scrolled or zoomed');

  // rapid taps never desync the board
  for (let i = 0; i < 8; i++) { t = await target(); await page.touchscreen.tap(t.x, t.y); await page.waitForTimeout(60); }
  await page.waitForFunction(() => !BR.Run.busy, null, { timeout: 10000 });
  const bad = await page.evaluate(() => { const e = BR.Run.engine, v = BR.Run.view; let n = 0; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const b = e.board.grid[r][c], rec = v.bricks.get(b.id); if (!rec || rec.r !== r || rec.c !== c || +rec.el.dataset.c !== b.color) n++; } return n; });
  ok(bad === 0, 'board desynced after rapid taps', bad);
  // a sheet that is closing lets taps through at once: right after Resume, nothing of the fading sheet or its backdrop can be hit
  await page.click('#btnPause'); await page.waitForTimeout(700);
  await page.click('.sheet [data-p="resume"]');
  const hit = await page.evaluate(() => { let n = 0, any = 0; for (let y = 20; y < 840; y += 40) for (let x = 10; x < 390; x += 40) { const el = document.elementFromPoint(x, y); if (el && el.closest('#layer-sheets')) n++; any++; } return { n, any, stillThere: document.querySelectorAll('#layer-sheets .sheet').length }; });
  ok(hit.stillThere === 1 && hit.n === 0, 'a closing sheet still catches taps', JSON.stringify(hit));
  await page.waitForTimeout(700);
  ok(await page.evaluate(() => document.getElementById('layer-sheets').style.pointerEvents === 'none' && !document.getElementById('layer-sheets').children.length), 'the sheet layer kept catching taps after it closed');
  // touch targets
  const small = await page.evaluate(() => Array.from(document.querySelectorAll('#btnPause, .bslot')).filter((b) => b.getBoundingClientRect().height < 44 || b.getBoundingClientRect().width < 44).map((b) => b.id || b.className));
  ok(small.length === 0, 'touch targets under 44px', small);
  console.log('errors', errors.filter((e) => !/Failed to load resource/.test(e)), 'problems', problems);
  await browser.close(); process.exit(problems ? 1 : 0);
})();
