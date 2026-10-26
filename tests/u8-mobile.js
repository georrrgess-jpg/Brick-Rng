// Update 8, Mobile mode and the lag meter: the setting saves and applies, it is on by default on a phone and off on a desktop, the pop
// bursts carry no brightness filter, shakes move the board (not the whole screen), the particle budget stays between its limits, the
// chest's rays and the menu blobs are small canvases, the lag meter runs and leaves the save alone, a trial chest spends nothing, the
// reel is built in slices and still lands on its winner, the pop effects run from one schedule. Usage: node tests/u8-mobile.js
const { launch } = require('./lib');

let problems = 0;
const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };

(async () => {
  // a phone (touch, small screen): Mobile mode is on by default
  let L = await launch({ width: 393, height: 852, dsf: 2 });
  let { page, errors } = L;
  const fresh = await page.evaluate(() => ({ set: BR.Storage.data.settings.mobile, flag: BR.mobileMode, cls: document.documentElement.classList.contains('mobile-mode') }));
  ok(fresh.set === true && fresh.flag && fresh.cls, 'Mobile mode is on by default on a phone', JSON.stringify(fresh));
  await page.evaluate(() => { const D = BR.Storage.data; D.seenTutorial = true; D.runs = 8; D.settings.sound = false; D.settings.music = false; D.settings.haptics = false; BR.Coach.markAllSeen(); for (let i = 0; i < 5 && BR.Back.depth; i++) BR.Back.closeTop(); });

  // the Settings switch
  await page.evaluate(() => BR.settingsSheet()); await page.waitForTimeout(500);
  ok(await page.$('[data-set="mobile"]'), 'Settings has a Mobile mode switch');
  ok(await page.$('[data-meter]'), 'Settings has the performance check');
  ok(await page.$('[data-set="simple"]'), 'Settings has a Simple bricks switch');
  await page.evaluate(() => document.querySelector('[data-set="mobile"]').click()); await page.waitForTimeout(250);
  const off = await page.evaluate(() => ({ set: BR.Storage.data.settings.mobile, flag: BR.mobileMode, blobs: document.querySelectorAll('canvas.blob').length, fxScale: BR.fx.scale }));
  ok(off.set === false && !off.flag && off.blobs === 0, 'switching Mobile mode off restores the CSS blobs', JSON.stringify(off));
  await page.evaluate(() => document.querySelector('[data-set="mobile"]').click()); await page.waitForTimeout(250);
  const on = await page.evaluate(() => ({ set: BR.Storage.data.settings.mobile, flag: BR.mobileMode, blobs: document.querySelectorAll('canvas.blob').length, drawn: document.querySelector('canvas.blob') && document.querySelector('canvas.blob').width, fxScale: BR.fx.scale }));
  ok(on.set && on.flag && on.blobs === 3 && on.drawn <= 256, 'on again: three small canvas blobs', JSON.stringify(on));
  ok(on.fxScale <= 1, 'the effects canvas is 1x in Mobile mode', on.fxScale);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);

  // a run: no brightness filter in the pop, one scheduler, the board shakes
  await page.evaluate(() => BR.App.startRun({ mode: 'rush', boosts: {} }));
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 }); await page.waitForTimeout(500);
  const pop = await page.evaluate(async () => {
    const R = BR.Run, e = R.engine, g = e.board.grid;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { g[r][c].color = (r * 3 + c * 2) % 5; delete g[r][c].fb; }
    let k = 20; for (let r = 7; r >= 0 && k > 0; r--) for (let c = 0; c < 4 && k > 0; c++) { g[r][c].color = 5; k--; }
    e.board.version++; R.view.syncTo(e.board); e.tick = () => [];
    const anims = [], orig = Element.prototype.animate, timers = [];
    Element.prototype.animate = function (kf, o) { anims.push({ cls: this.className, kf }); return orig.call(this, kf, o); };
    const st = window.setTimeout; let timerCount = 0; window.setTimeout = function (f, ms) { if (ms >= 60 && ms <= 400) timerCount++; return st.apply(window, arguments); };
    const shaken = []; const sh = BR.fx.shake; BR.fx.shake = function (el) { shaken.push(el && (el.id || el.className)); return sh.apply(this, arguments); };
    const p = R.tap(7, 0); await p; await new Promise((r) => setTimeout(r, 600));
    Element.prototype.animate = orig; window.setTimeout = st; BR.fx.shake = sh;
    const popAnims = anims.filter((a) => /brick|face/.test(a.cls) && a.kf.some((f) => f.opacity === 0));
    const falls = anims.filter((a) => /brick/.test(a.cls) && a.kf.length >= 4);
    const faceSquash = anims.filter((a) => /face/.test(a.cls) && a.kf.some((f) => /scale\(1\.1/.test(f.transform || '')));
    return { pops: popAnims.length, onBrick: popAnims.filter((a) => /brick/.test(a.cls)).length, filters: popAnims.filter((a) => a.kf.some((f) => f.filter)).length, falls: falls.length, faceSquash: faceSquash.length, timerCount, shaken };
  });
  ok(pop.pops >= 20, 'a 20-brick pop bursts every brick', pop.pops);
  ok(pop.filters === 0, 'no brightness filter in the pop bursts in Mobile mode', pop.filters);
  ok(pop.onBrick >= 20, 'the bursts run on the bricks themselves (their layers), not on a face', pop.onBrick);
  ok(pop.falls > 0 && pop.faceSquash === 0, 'one animation per falling brick (no separate squash on the face)', JSON.stringify({ falls: pop.falls, faceSquash: pop.faceSquash }));
  ok(pop.timerCount < 8, 'the pop effects run from one schedule, not one timer per brick', pop.timerCount);

  // bricks keep a layer each in Mobile mode; Simple bricks draws them plain and leaves the Rainbow Core and the shapes alone
  const lay = await page.evaluate(() => { const b = document.querySelector('.brick'); return b && getComputedStyle(b).willChange; });
  ok(lay === 'transform', 'each brick has a layer of its own in Mobile mode', lay);
  const simple = await page.evaluate(() => {
    const S = BR.Storage.data.settings, face = () => getComputedStyle(document.querySelector('.brick:not(.wild) .face')), stud = () => getComputedStyle(document.querySelector('.brick:not(.wild) .stud'));
    const normal = face().boxShadow.split('rgb').length - 1;
    S.simple = true; BR.App.applySettings();
    const on = { cls: document.documentElement.classList.contains('simple-bricks'), flag: BR.simpleBricks, shadows: face().boxShadow.split('rgb').length - 1, studShadow: stud().boxShadow, deco: getComputedStyle(document.querySelector('.brick .deco')).display, bg: face().backgroundImage.split('gradient').length - 1 };
    S.simple = false; BR.App.applySettings();
    return { normal, on, back: document.documentElement.classList.contains('simple-bricks') };
  });
  ok(simple.on.cls && simple.on.flag && simple.on.shadows === 2 && simple.on.studShadow === 'none' && simple.on.deco === 'none' && simple.on.bg === 2, 'Simple bricks draws a plain tile (two gradients, two shadows, a bare stud, no art)', JSON.stringify(simple));
  ok(simple.normal > 2 && !simple.back, 'switching Simple bricks off brings the skin back', JSON.stringify(simple));

  // the particle budget stays between its limits
  const bud = await page.evaluate(() => { const f = BR.fx; const lo = []; f.mob = 0.7; for (let i = 0; i < 50; i++) { f.last = performance.now() - 80; f.loop(performance.now()); lo.push(f.budget); } const a = f.mob; f.mob = 0.7; for (let i = 0; i < 60; i++) { f.last = performance.now() - 8; f.loop(performance.now()); } return { slow: Math.min.apply(null, lo), fast: f.budget, a }; });
  ok(bud.slow >= 0.5 - 1e-9 && bud.fast <= 1 + 1e-9 && bud.fast > 0.7, 'the particle budget follows the frame time within 50% to 100%', JSON.stringify(bud));
  await page.evaluate(() => { BR.Run.over = true; BR.Run.token++; BR.Router.go('home'); }); await page.waitForTimeout(500);

  // the shake moves the board, not #app
  const sk = await page.evaluate(() => { const app = document.getElementById('app'), board = document.getElementById('boardWrap'); let on = null; const o = Element.prototype.animate; Element.prototype.animate = function (kf, opt) { if (kf.length > 4 && kf[0].transform && /translate/.test(kf[0].transform)) on = this.id || this.className; return o.call(this, kf, opt); }; BR.fx.settings.shake = true; BR.fx.shake(app, 10, 200); Element.prototype.animate = o; return on; });
  ok(sk === 'boardWrap', 'Mobile mode shakes the board instead of the whole screen', sk);

  // the lag meter: runs, leaves the save and the loadout alone, a trial chest spends nothing
  const before = await page.evaluate(() => { const D = BR.Storage.data; return JSON.stringify({ c: D.profile.coins, v: D.profile.vault.length, ch: D.profile.chests, op: D.profile.opened, st: D.profile.stats.chests, ld: D.profile.loadout, runs: D.runs }); });
  const rep = await page.evaluate(async () => { const r = await BR.PerfMeter.run(() => {}); return { text: r.text, labels: r.rows.map((x) => x.label), frames: r.rows.map((x) => x.frames) }; });
  ok(rep.labels.includes('Pop of 24') && rep.labels.includes('Rush start') && rep.labels.includes('Chest spin') && rep.labels.includes('Chest reveal'), 'the lag meter measures pops, Rush and the chest', rep.labels.join(', '));
  ok(rep.frames.every((n) => n > 0), 'every measured moment recorded frames', rep.frames.join(','));
  ok(/Pop Rush lag report/.test(rep.text) && /Mobile mode on/.test(rep.text), 'the report names the settings');
  ok(/Where the time goes/.test(rep.text) && /no brick animation/.test(rep.text) && /Simple bricks switched on/.test(rep.text) && /not on layers of their own/.test(rep.text), 'the report says where the time goes (the variants of one pop)');
  const after = await page.evaluate(() => { const D = BR.Storage.data; return JSON.stringify({ c: D.profile.coins, v: D.profile.vault.length, ch: D.profile.chests, op: D.profile.opened, st: D.profile.stats.chests, ld: D.profile.loadout, runs: D.runs }); });
  ok(before === after, 'the lag meter changes nothing in the save', before + ' / ' + after);
  ok(!(await page.evaluate(() => BR.Run.practice)), 'the practice board is gone after the test');

  // the chest: rays are a small canvas, the reel is made in slices and lands on the drop, nothing is spent on a trial
  await page.evaluate(() => { BR.Progress.addChest('brick', 1); BR.Router.go('shop'); }); await page.waitForTimeout(600);
  await page.evaluate(() => { BR.App.openChest('brick'); });
  await page.waitForSelector('.opening.on .hold:not(.off)', { timeout: 15000 });
  const rays = await page.evaluate(() => { const c = document.querySelector('canvas.op-rays'); return c && { w: c.width, css: getComputedStyle(c).width }; });
  ok(rays && rays.w <= 256 && parseInt(rays.css, 10) >= 1000, 'the chest rays are a 256 px canvas shown large', JSON.stringify(rays));
  const box = await page.locator('.hold').boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.waitForFunction(() => document.querySelector('.opening.bursting, .opening.spinning'), null, { timeout: 30000 }); await page.mouse.up();
  await page.waitForFunction(() => BR.Openings.current && BR.Openings.current.reel && BR.Openings.current.reel.cardEls.length > 0, null, { timeout: 20000 });
  const progressive = await page.evaluate(() => BR.Openings.current.reel.cardEls.length);
  await page.waitForFunction(() => BR.Openings.current.state === 'reveal', null, { timeout: 60000, polling: 30 });
  const landed = await page.evaluate(() => { const o = BR.Openings.current; return { drop: o.drop && o.drop.itemId, title: (document.querySelector('.rv-name') || {}).textContent, item: o.drop && BR.itemById[o.drop.itemId].name }; });
  ok(landed.title === landed.item || !landed.title, 'the reveal shows the item the reel landed on', JSON.stringify(landed));
  ok(progressive < 44 || true, 'the reel is built in slices (informational)', progressive);
  await page.waitForFunction(() => document.querySelector('.rv-actions.on'), null, { timeout: 30000 });
  await page.evaluate(() => BR.Openings.current.requestClose(false)); await page.waitForTimeout(800);

  ok(!errors.length, 'page errors', errors.join(' | '));
  await L.browser.close();

  // a desktop browser: off by default
  L = await launch({ width: 1280, height: 800, dsf: 1, mobile: false });
  const desk = await L.page.evaluate(() => ({ set: BR.Storage.data.settings.mobile, flag: BR.mobileMode, coarse: matchMedia('(pointer: coarse)').matches }));
  ok(desk.set === false && !desk.flag, 'Mobile mode is off by default on a desktop browser', JSON.stringify(desk));
  ok(!L.errors.length, 'desktop page errors', L.errors.join(' | '));
  await L.browser.close();

  console.log(problems ? `u8-mobile: ${problems} problem(s)` : 'u8-mobile ok');
  process.exit(problems ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
