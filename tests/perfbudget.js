// Performance budgets (Update 4). Phone-sized page (393x852 at 3x like an iPhone 15 Pro; BUDGET_DSF=2 to match the old numbers),
// CPU slowed 4x, software rendering: absolute times are inflated, an empty page is about 17 ms per frame, so the budgets
// are set against this harness. Every number is the median of RUNS runs. Exits 1 when a budget is exceeded.
// Usage: node tests/perfbudget.js [quick]      (quick = one run per measurement, no chest and growth checks)
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const QUICK = process.argv[2] === 'quick';
const RUNS = QUICK ? 1 : 3;
const DSF = +(process.env.BUDGET_DSF || 2);
// Frame budgets for tab switch, pop and reel are set from measurements on this harness (software raster, so one first frame of a
// new screen is 5 to 10 vsync intervals here and a fraction of that on a phone GPU). Script time is budgeted separately and is
// small: a tab switch runs 10 to 25 ms of script and a pop about 10 to 30 ms, both at 4x slowdown. They guard against going back
// to the old numbers (a 311 to 344 ms Collection switch, a 267 ms pop, a 430 to 880 ms freeze before the reel).
const B = {   // ms per frame unless noted
  homeIdle: 30, shopIdle: 30, collectionIdle: 32, passIdle: 30, missionsIdle: 30, profileIdle: 30,
  tabSwitchFrame: 190, scrollCollection: 40, scrollShop: 36, sheetOpen: 55, tabSwitchJs: 50, runIdle: 24, popAvg: 55, popMax: 140,
  runIdleS4: 30, popAvgS4: 80, popMaxS4: 220,   // (the Spire set is the heaviest loadout: Sigil, Constellation, Moonwick Tower, Moonrise and a hat)
  reelFreeze: 420,   // (the first style pass over the opening and its reel: 180 to 370 here when the strip holds boards and heavy skins; was 250 before Moonwick's 30 items) hiddenAnims: 0, animsPerScreen: 60, startupInteractive: 960, firstPaint: 240, nodesAfterCycle: 900, longTask: 80,
};
const results = []; let failed = 0;
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
const check = (name, value, budget, unit = 'ms') => { const ok = value <= budget; if (!ok) failed++; results.push([name, +value.toFixed(1), budget, unit, ok]); console.log((ok ? 'ok   ' : 'OVER ') + name.padEnd(26), String(+value.toFixed(1)).padStart(7) + unit, ' budget', budget + unit); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: DSF, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const t0 = Date.now();
  await page.goto(URL); await page.waitForFunction(() => window.__app, null, { timeout: 15000 });
  const boot = await page.evaluate(() => ({ fcp: (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0, now: performance.now() }));
  const cdp = await ctx.newCDPSession(page);
  if (process.env.BUDGET_CSS) await page.addStyleTag({ content: process.env.BUDGET_CSS });   // (an experiment: what a rule costs)
  await page.evaluate(() => {
    const P = BR.Progress, st = BR.Storage.data, pr = st.profile;
    BR.Coach.markAllSeen();
    st.settings.sound = false; st.settings.music = false; st.settings.haptics = false; st.settings.perf = 'high'; st.seenTutorial = true; st.runs = 12;
    pr.level = 9; pr.xp = 900; pr.coins = 99999; pr.chests = { brick: 6, pop: 2, board: 0, fuse: 0, golden: 1 }; pr.passTier = 8;
    st.best.rush = 184520; st.bestStage.rush = 7; st.recent.rush = [120000, 90000];
    const own = ['f_candy', 'f_slate', 'f_marble', 'f_glass', 'f_neon', 'f_lava', 'f_circuit', 'f_nova', 'f_aurora', 'f_chrome', 'f_heart', 'f_gumdrop', 'f_bubble', 'f_lantern', 'b_ember', 'b_petal', 'b_glass', 'b_pixel', 'b_bolt', 'b_fire', 'a_deepsea', 'a_foundry', 'a_orbit', 'a_greenhouse', 'a_holo', 'u_rope', 'u_neon', 'u_plasma', 'u_ice'];
    own.forEach((id, i) => { if (!P.owns(id)) P.keep({ itemId: id, shine: ['plain', 'glossy', 'holo', 'prism', 'plain'][i % 5], seed: (i * 733) % 10000 }); });
    BR.App.applySettings(); BR.Skins.apply();
  });
  const go = (id) => page.evaluate((id) => { window.dispatchEvent(new Event('pointerdown'));   // a touch: menus hold still after 20 s without one, which would flatter every number
     if (id === 'pass') { BR.Router.screens.missions.tab = 'pass'; BR.Router.go('missions'); BR.Router.rerender(); } else { BR.Router.screens.missions.tab = 'daily'; BR.Router.go(id); } }, id);
  const sleep = (ms) => page.waitForTimeout(ms);
  const frames = (ms, stopExpr) => page.evaluate(([ms, stopExpr]) => new Promise((res) => { const ts = []; let last = performance.now(); const end = last + ms; const stop = stopExpr ? new Function('return (' + stopExpr + ')') : null; const f = (n) => { ts.push(n - last); last = n; if (n < end && !(stop && stop())) requestAnimationFrame(f); else { ts.shift(); const s = ts.slice().sort((a, b) => a - b); res({ avg: ts.reduce((a, b) => a + b, 0) / Math.max(1, ts.length), p95: s[Math.floor(s.length * 0.95)] || 0, max: s[s.length - 1] || 0 }); } }; requestAnimationFrame(f); }), [ms, stopExpr || null]);
  const rep = async (fn) => { const r = []; for (let i = 0; i < RUNS; i++) r.push(await fn()); return r; };

  await page.touchscreen.tap(196, 3);   // the first tap of a session unlocks audio; a player has done that long before a run
  // visit every tab once like a player would, so left-behind screens hold their real content
  for (const s of ['shop', 'collection', 'pass', 'missions', 'profile', 'home']) { await go(s); await sleep(500); }
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  // ---- menus at rest
  for (const [id, key] of [['home', 'homeIdle'], ['shop', 'shopIdle'], ['collection', 'collectionIdle'], ['pass', 'passIdle'], ['missions', 'missionsIdle'], ['profile', 'profileIdle']]) {
    await go(id); await sleep(1200);
    check(key, med((await rep(() => frames(1500))).map((r) => r.avg)), B[key]);
    const an = await page.evaluate(() => { const all = document.getAnimations(); const hid = all.filter((a) => { const t = a.effect && a.effect.target; const sc = t && t.closest && t.closest('.screen'); return sc && !sc.classList.contains('on') && a.playState === 'running'; }).length; return { all: all.filter((a) => a.playState === 'running').length, hidden: hid, idle: document.documentElement.classList.contains('idle'), under: document.documentElement.classList.contains('under-overlay'), sheets: document.getElementById('layer-sheets').children.length, ov: document.getElementById('layer-overlays').children.length, sheetTitle: (document.querySelector('#layer-sheets .sheet') || {}).className + ':' + ((document.querySelector('#layer-sheets .sheet h2') || {}).textContent || '') + ((document.querySelector('#layer-sheets .coach-title') || {}).textContent || ''), op: document.getElementById('layer-opening').children.length }; });
    if (process.env.DEBUG_PERF) console.log('   debug', id, JSON.stringify(an));
    check(key.replace('Idle', ' running animations'), an.all, B.animsPerScreen, '');
    if (id === 'home') check('animations on hidden screens', an.hidden, B.hiddenAnims, '');
  }
  // ---- scrolling with real touch gestures
  for (const [id, key] of [['collection', 'scrollCollection'], ['shop', 'scrollShop']]) {
    await go(id); await sleep(1000);
    const r = await rep(async () => { const fp = frames(1400); await cdp.send('Input.synthesizeScrollGesture', { x: 196, y: 640, yDistance: -700, speed: 600, gestureSourceType: 'touch' }); const f = await fp; await cdp.send('Input.synthesizeScrollGesture', { x: 196, y: 300, yDistance: 700, speed: 1500, gestureSourceType: 'touch' }); await sleep(300); return f; });
    check(key, med(r.map((x) => x.avg)), B[key]);
  }
  // ---- a sheet over a screen
  await go('collection'); await sleep(800);
  const sh = await rep(async () => { await page.evaluate(() => BR.itemSheet(BR.Storage.data.profile.vault[0].uid, BR.itemById[BR.Storage.data.profile.vault[0].itemId].type)); await sleep(700); const f = await frames(1200); await page.evaluate(() => BR.Back.closeTop()); await sleep(600); return f; });
  check('sheetOpen', med(sh.map((x) => x.avg)), B.sheetOpen);
  // ---- tab switch: time the script work of Router.go (forced layouts included)
  const sw = await page.evaluate(async () => { const out = {}; for (const id of ['shop', 'collection', 'missions', 'profile', 'home']) { const t = performance.now(); BR.Router.go(id); out[id] = performance.now() - t; await new Promise((r) => setTimeout(r, 700)); } return out; });
  check('tabSwitchJs (worst tab)', Math.max(...Object.values(sw)), B.tabSwitchJs);
  // the longest frame while a tab opens (style and layout of the new screen land in that frame)
  const tabs = ['shop', 'collection', 'missions', 'profile', 'home'], tfr = {}; tabs.forEach((id) => { tfr[id] = []; });
  for (let i = 0; i < RUNS; i++) for (const id of tabs) { const fp = frames(900); await page.evaluate((id) => BR.Router.go(id), id); tfr[id].push((await fp).max); await sleep(300); }
  const tf = tabs.map((id) => [id, med(tfr[id])]);
  check('tabSwitchFrame (worst tab)', Math.max(...tf.map((x) => x[1])), B.tabSwitchFrame);
  console.log('  per tab', tf.map(([k, v]) => k + ' ' + v.toFixed(0)).join('  '));
  console.log('  per tab', Object.entries(sw).map(([k, v]) => k + ' ' + v.toFixed(0)).join('  '));
  if (process.env.DEBUG_PERF) console.log('  tab frames', JSON.stringify(tfr));
  if (process.env.STOP_AFTER_TABS) { await browser.close(); process.exit(failed ? 1 : 0); }

  // ---- the run
  await go('home'); await sleep(400);
  await page.evaluate(() => { __app.startRun({ mode: 'rush', boosts: {} }); });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 }); await sleep(800);
  check('runIdle', med((await rep(() => frames(1500))).map((r) => r.avg)), B.runIdle);
  const pops = [];
  for (let i = 0; i < RUNS; i++) {
    const a = await page.evaluate(() => { const e = BR.Run.engine; let best = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!best || p.cells.length > best.n)) best = { r, c, n: p.cells.length }; } const pt = BR.Run.view.pagePoint(best.r, best.c); return { x: pt.x, y: pt.y, n: best.n }; });
    const pr = frames(1300); await page.touchscreen.tap(a.x, a.y); pops.push(await pr); await sleep(900);
  }
  check('popAvg', med(pops.map((x) => x.avg)), B.popAvg); check('popMax (worst frame)', med(pops.map((x) => x.max)), B.popMax);
  await page.evaluate(() => { BR.Run.over = true; BR.Router.go('home', { instant: true }); }); await sleep(600);

  // ---- the heaviest Moonwick loadout: the full Spire set (Sigil, Constellation, Moonwick Tower, Moonrise) and a hat on Fizz
  await page.evaluate(() => {
    const P = BR.Progress;
    ['f_sigil', 'b_constellation', 'a_tower', 'u_moonrise'].forEach((id) => { if (!P.owns(id)) P.keep({ itemId: id, shine: 'plain', seed: 4242 }); const inst = BR.Storage.data.profile.vault.find((i) => i.itemId === id); P.equip(inst.uid, BR.itemById[id].type); });
    P.grantHat('h_wizard'); P.equipHat('h_wizard'); BR.Skins.apply();
    __app.startRun({ mode: 'rush', boosts: {} });
  });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 }); await sleep(800);
  check('runIdle (Spire set + hat)', med((await rep(() => frames(1500))).map((r) => r.avg)), B.runIdleS4);
  const pops4 = [];
  for (let i = 0; i < RUNS; i++) {
    const a = await page.evaluate(() => { const e = BR.Run.engine; let best = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!best || p.cells.length > best.n)) best = { r, c, n: p.cells.length }; } const pt = BR.Run.view.pagePoint(best.r, best.c); return { x: pt.x, y: pt.y, n: best.n }; });
    const pr = frames(1300); await page.touchscreen.tap(a.x, a.y); pops4.push(await pr); await sleep(900);
  }
  if (pops4.length) { check('popAvg (Spire set)', med(pops4.map((x) => x.avg)), B.popAvgS4); check('popMax (Spire set)', med(pops4.map((x) => x.max)), B.popMaxS4); }
  await page.evaluate(() => { BR.Run.over = true; const P = BR.Progress; ['skin', 'pop', 'board', 'fuse'].forEach((t) => P.equip('default', t)); P.equipHat('none'); BR.Skins.apply(); BR.Router.go('home', { instant: true }); }); await sleep(600);

  if (!QUICK) {
    // ---- the chest reel: the longest single frame while the spin starts
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => { BR.App.openChest('brick'); });
    await page.waitForSelector('.opening.on .hold:not(.off)', { timeout: 15000 });
    const box = await page.locator('.hold').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    const long = await frames(9000, 'document.querySelector(".reel") && document.querySelector(".reel").classList.contains("reel-h") && BR.Openings.current.reel && BR.Openings.current.reel.t > 0.6');
    await page.mouse.up();
    check('reelFreeze (longest frame)', long.max, B.reelFreeze);
    await page.waitForFunction(() => BR.Openings.current && BR.Openings.current.state !== 'spin', null, { timeout: 40000 }).catch(() => {}); await page.evaluate(() => { BR.Openings.current && BR.Openings.current.close(false); }); await sleep(900);
    // ---- growth: nodes after several runs and chests
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    for (let i = 0; i < 4; i++) { await page.evaluate(() => { __app.startRun({ mode: 'rush', boosts: {} }); }); await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 }); await sleep(300); await page.evaluate(() => { BR.Run.endRun('quit'); }); await page.waitForSelector('.results.on', { timeout: 20000 }); await sleep(700); await page.evaluate(() => { BR.Run.closeResults('home'); BR.Router.go('home'); }); await sleep(500); }
    for (const s of ['shop', 'collection', 'pass', 'missions', 'profile', 'home']) { await go(s); await sleep(300); }
    await sleep(1200);   // screens left behind are emptied a moment after they hide
    check('nodesAfterCycle', await page.evaluate(() => document.getElementsByTagName('*').length), B.nodesAfterCycle, '');
    // ---- the longest task over a short session
  }
  // startup: the median of five fresh loads (one load varies by 50 ms on this machine), unthrottled; a phone takes roughly 3 times as long
  const loads = [boot];
  for (let i = 0; i < 4; i++) {
    const c2 = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: DSF, hasTouch: true, isMobile: true });
    const p2 = await c2.newPage(); await p2.goto(URL); await p2.waitForFunction(() => window.__app, null, { timeout: 15000 });
    loads.push(await p2.evaluate(() => ({ fcp: (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0, now: performance.now() }))); await c2.close();
  }
  const bootMed = { fcp: med(loads.map((l) => l.fcp)), now: med(loads.map((l) => l.now)) };
  console.log('boot (median of 5): first paint ' + bootMed.fcp.toFixed(0) + ' ms, app ready ' + bootMed.now.toFixed(0) + ' ms (unthrottled)');
  check('startup (unthrottled, ready)', bootMed.now, B.startupInteractive / 3);
  check('first paint (unthrottled)', bootMed.fcp, B.firstPaint);
  console.log('errors', errors.length ? errors.join(' | ') : 'none');
  if (errors.length) failed++;
  await browser.close();
  console.log(failed ? failed + ' OVER BUDGET' : 'perfbudget ok');
  process.exit(failed ? 1 : 0);
})();
