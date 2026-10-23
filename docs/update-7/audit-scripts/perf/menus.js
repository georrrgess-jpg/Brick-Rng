// Menus at RATE (4 or 6): tab-switch first frames (with what ran in them), Home idle cost, Collection/Shop scroll, sheet opens,
// DOM size and layer memory per screen. Usage: RATE=6 node menus.js   (PM=1 for Performance mode; SKIP=layers to skip a part)
const L = require('./lib');
(async () => {
  const { browser, page, cdp, errors } = await L.launch();
  await L.setup(page, { pm: process.env.PM === '1', perf: process.env.PERF || 'high', skin: process.env.SKIN, board: process.env.BOARD });
  const skip = String(process.env.SKIP || '');
  const go = (id) => page.evaluate((id) => { window.dispatchEvent(new Event('pointerdown')); if (id === 'pass') { BR.Router.screens.missions.tab = 'pass'; BR.Router.go('missions'); BR.Router.rerender(); } else { if (id === 'missions') BR.Router.screens.missions.tab = 'daily'; BR.Router.go(id); } }, id);
  await page.touchscreen.tap(196, 3);
  for (const s of ['shop', 'collection', 'missions', 'profile', 'home']) { await go(s); await page.waitForTimeout(500); }
  await L.throttle(cdp);
  console.log('RATE', L.RATE, 'PM', process.env.PM || 0);

  // ---- tab switches: first frame, frames > 50 ms in the first second, and what the longest frame did
  const order = ['collection', 'shop', 'home', 'missions', 'profile', 'home', 'collection', 'home', 'shop', 'home'];
  const rows = {};
  for (const id of order) {
    await page.waitForTimeout(900);
    const { r, ev } = await L.trace(browser, page, async () => {
      await L.startFrames(page);
      await page.waitForTimeout(60);
      const t = await page.evaluate((id) => { const t0 = performance.now(); window.dispatchEvent(new Event('pointerdown')); if (id === 'missions') BR.Router.screens.missions.tab = 'daily'; BR.Router.go(id); return [t0, performance.now() - t0]; }, id);
      await page.waitForTimeout(1100);
      const g = await L.stopFrames(page);
      return { t, g };
    });
    const after = r.g.g.filter(([s, e]) => e > r.t[0]);
    const first = after.length ? after[0][1] - r.t[0] : 0;   // from the call to the end of the first frame that shows it
    const st = L.stats(after.map(([s, e]) => e - s));
    const lf = L.longFrames(ev, r.g, 1);
    (rows[id] = rows[id] || []).push(`go() js ${r.t[1].toFixed(0)} ms, call->first frame ${first.toFixed(0)} ms, then ${L.fmtS(st)}\n      ${lf[0] || ''}`);
  }
  for (const [id, v] of Object.entries(rows)) { console.log('TAB', id); v.forEach((x) => console.log('   ', x)); }

  // ---- idle cost per screen (2.5 s), main + compositor totals per second
  if (!skip.includes('idle')) for (const id of ['home', 'shop', 'collection', 'missions', 'profile']) {
    await go(id); await page.waitForTimeout(1500);
    const { r, ev } = await L.trace(browser, page, async () => { await L.startFrames(page); await page.waitForTimeout(2500); return L.stopFrames(page); });
    const by = L.totals(ev); const st = L.stats(r.g.map(([s, e]) => e - s));
    const anims = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
    const dom = await page.evaluate(() => document.getElementsByTagName('*').length);
    console.log('IDLE', id.padEnd(10), L.fmtS(st), '| running anims', anims, '| DOM', dom);
    for (const [t, m] of Object.entries(by)) console.log('     ', t.padEnd(24), L.top(m, 8));
  }

  // ---- scrolls (touch gesture), frames during the gesture
  if (!skip.includes('scroll')) for (const id of ['collection', 'shop']) {
    await go(id); await page.waitForTimeout(1500);
    const { r, ev } = await L.trace(browser, page, async () => {
      await L.startFrames(page);
      await cdp.send('Input.synthesizeScrollGesture', { x: 196, y: 640, yDistance: -900, speed: 800, gestureSourceType: 'touch' });
      await page.waitForTimeout(300);
      return L.stopFrames(page);
    });
    const st = L.stats(r.g.map(([s, e]) => e - s)); const by = L.totals(ev);
    console.log('SCROLL', id.padEnd(10), L.fmtS(st));
    for (const [t, m] of Object.entries(by)) console.log('     ', t.padEnd(24), L.top(m, 8));
    L.longFrames(ev, r, 2).forEach((x) => console.log('     ', x));
    await cdp.send('Input.synthesizeScrollGesture', { x: 196, y: 300, yDistance: 1600, speed: 3000, gestureSourceType: 'touch' }); await page.waitForTimeout(400);
  }

  // ---- sheets: item sheet (Collection), settings, odds (Shop), the ready-to-play sheet (Home)
  if (!skip.includes('sheet')) {
    const sheets = [
      ['collection', 'item', () => { const v = BR.Storage.data.profile.vault.find((x) => BR.itemById[x.itemId].type === 'skin'); BR.itemSheet(v.uid, 'skin'); }],
      ['home', 'settings', () => { const b = document.getElementById('tbGear'); b.click(); }],
      ['shop', 'odds', () => { const b = document.querySelector('[data-act="odds"]'); b.click(); }],
    ];
    for (const [scr, name, fn] of sheets) {
      await go(scr); await page.waitForTimeout(1200);
      const { r, ev } = await L.trace(browser, page, async () => { await L.startFrames(page); await page.waitForTimeout(40); const t0 = await page.evaluate(`(${fn.toString()})(), performance.now()`); await page.waitForTimeout(900); return { g: await L.stopFrames(page), t0 }; });
      const after = r.g.g.filter(([s, e]) => e > r.t0 - 5); const st = L.stats(after.map(([s, e]) => e - s));
      const dom = await page.evaluate(() => document.getElementsByTagName('*').length);
      console.log('SHEET', name.padEnd(9), L.fmtS(st), '| DOM', dom);
      L.longFrames(ev, r.g, 1).forEach((x) => console.log('     ', x));
      await page.evaluate(() => BR.Back.closeTop()); await page.waitForTimeout(700);
    }
  }

  // ---- layers and DOM per screen
  if (!skip.includes('layers')) for (const id of ['home', 'shop', 'collection', 'missions', 'profile']) {
    await go(id); await page.waitForTimeout(1500);
    const lr = await L.layerReport(page, cdp, 3, 600);
    const dom = await page.evaluate(() => ({ all: document.getElementsByTagName('*').length, screen: document.querySelector('.screen.on').getElementsByTagName('*').length, svg: document.querySelectorAll('svg').length, bg: document.getElementById('bg').getElementsByTagName('*').length }));
    console.log('LAYERS', id.padEnd(10), 'layers', lr.layers, 'drawing', lr.drawing, 'Mpx', lr.mpx.toFixed(1), '~MB', lr.mb.toFixed(0), '| DOM', JSON.stringify(dom), '\n       biggest:', lr.big.join(' | '));
  }
  console.log('errors', errors.join(' | ') || 'none');
  await browser.close();
})();
