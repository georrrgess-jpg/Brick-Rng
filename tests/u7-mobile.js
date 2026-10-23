// Update 7, phones (docs/update-7/audit-mobile-ui.md): the key geometry at 320x568, 360x640, 393x852 and 844x390 with notch insets.
// The run's HUD never wraps or clips and Pause is 44px; bricks are 32px or more at 320x568; the landscape results with insets never
// clip a number; the reveal card's name is clear of the art; Play is above the tab bar with the Resume card at 320x568 (also with
// Larger text); a swipe down closes a bottom sheet (and a small drag does not); every visible control has a press style.
// Usage: node tests/u7-mobile.js
const { launch } = require('./lib');

let problems = 0;
const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };
const wait = (page, ms) => page.waitForTimeout(ms);
const SIZES = { se1: [320, 568], s360: [360, 640], s393: [393, 852], l844: [844, 390] };
const INSETS = { port: [59, 34, 0, 0], land: [0, 21, 59, 59] };

async function open(key, { insets = false, large = false } = {}) {
  const [width, height] = SIZES[key];
  const r = await launch({ width, height, dsf: 1 });
  if (insets) {
    const [t, b, l, rr] = width > height ? INSETS.land : INSETS.port;
    await r.page.addStyleTag({ content: `:root{--sat:${t}px !important;--sab:${b}px !important;--sal:${l}px !important;--sar:${rr}px !important}` });
  }
  await r.page.evaluate((large) => {
    const st = BR.Storage.data, P = BR.Progress, pr = st.profile;
    st.settings.sound = false; st.settings.music = false; st.settings.haptics = false; st.seenTutorial = true; st.runs = 12;
    pr.level = 6; pr.xp = Math.round(BR.xpForLevel(6) * 0.4); pr.coins = 900;
    st.best.rush = 48250; st.bestStage.rush = 5; st.recent.rush = [21000, 33000, 48250];
    ['skin', 'pop', 'board', 'fuse'].forEach((t) => BR.DROP_ITEMS.filter((i) => i.type === t).slice(0, 3).forEach((i, k) => { if (!P.owns(i.id)) P.keep({ itemId: i.id, shine: 'plain', seed: k + 3 }); }));
    pr.chests = { brick: 2, pop: 0, board: 0, fuse: 0, golden: 1 };
    if (large) st.settings.large = true;
    st.seen = Object.assign(st.seen || {}, { misDay: BR.Missions.ensure().day });
    BR.Storage.save(); BR.App.applySettings(); BR.Chrome.refresh(); BR.Router.go('home', { instant: true });
  }, large);
  await wait(r.page, 500);
  r.cdp = await r.ctx.newCDPSession(r.page);
  return r;
}
const touch = (r, type, x, y) => r.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
async function drag(r, x, y, dx, dy, steps, stepMs) {
  await touch(r, 'touchStart', x, y);
  for (let i = 1; i <= steps; i++) { await touch(r, 'touchMove', x + (dx * i) / steps, y + (dy * i) / steps); await wait(r.page, stepMs); }
  await touch(r, 'touchEnd', x + dx, y + dy);
}
async function startRun(page, mode) {
  await page.evaluate((mode) => { while (BR.Back.depth) BR.Back.closeTop(); if (BR.Run.resultsEl) BR.Run.closeResults(); BR.Storage.clearRun(); BR.Router.go('home', { instant: true }); __app.startRun({ mode, boosts: {} }); }, mode);
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy && BR.Router.current === 'run', null, { timeout: 15000 });
  await wait(page, 600);
}
/** Text in a container that wraps onto a second line, is clipped or ellipsised. */
const BROKEN = (root) => [...document.querySelectorAll(root + ' *')].filter((e) => {
  const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || !e.getClientRects().length || +cs.opacity < 0.05) return false;
  let a = e; while (a && a !== document.body) { const s = getComputedStyle(a); if (+s.opacity < 0.05 || s.display === 'none') return false; a = a.parentElement; }
  const texts = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
  if (!texts.length || e.closest('.gl-txt, .hint, .combo span, .last-spark span, .aim-banner')) return false;   // (texts that may take two lines by design)
  // the line boxes of the element's own text: more than one line means it wrapped; past the edge of a clipping ancestor means it is cut
  const rg = document.createRange(), tops = new Set(); let lft = Infinity, rgt = -Infinity;
  for (const t of texts) { rg.selectNodeContents(t); for (const q of rg.getClientRects()) { if (q.width < 1) continue; tops.add(Math.round(q.top / 6)); lft = Math.min(lft, q.left); rgt = Math.max(rgt, q.right); } }
  if (tops.size > 1) return true;
  for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (s.overflowX !== 'visible') { const ar = a.getBoundingClientRect(); if (rgt > ar.right + 1 || lft < ar.left - 1) return true; break; } }
  return (e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible') || (cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1);
}).map((e) => (e.id || e.className) + ' "' + e.textContent.trim().slice(0, 24) + '"');

async function runChecks(key, insets) {
  const tag = key + (insets ? '+insets' : '');
  const r = await open(key, { insets });
  const { page } = r;
  for (const mode of ['rush', 'chill']) {
    await startRun(page, mode);
    await page.evaluate(() => { const e = BR.Run.engine; e.score = 1234567; BR.Run.setScore(e.score, false); BR.Run.bestRefresh(e.score); BR.Run.setCombo(5, 2.5, 8); });
    await wait(page, 500);
    const g = await page.evaluate(() => { const p = document.getElementById('btnPause').getBoundingClientRect(), b = document.getElementById('board').getBoundingClientRect(), f = document.getElementById(BR.Run.engine.chill ? 'chillbar' : 'fuse').getBoundingClientRect(); return { pw: p.width, ph: p.height, brick: b.width / 8, hud: f.width, board: b.width, bottom: document.getElementById('msgBand').getBoundingClientRect().bottom, vh: innerHeight }; });
    ok(g.pw >= 44 && g.ph >= 44, tag, mode, 'Pause is smaller than 44px', g.pw, g.ph);
    if (key === 'se1') ok(g.brick >= 32, tag, mode, 'bricks under 32px at 320x568', g.brick);
    if (SIZES[key][0] < SIZES[key][1]) ok(g.hud >= g.board, tag, mode, 'HUD row narrower than the board', g.hud, g.board);
    ok(g.bottom <= g.vh, tag, mode, 'the message band is off screen', g.bottom, g.vh);
    const broken = await page.evaluate(BROKEN, '#run');
    ok(!broken.length, tag, mode, 'HUD text wraps or is clipped:', broken.join(', '));
    if (mode === 'chill') {
      await page.evaluate(() => { const e = BR.Run.engine; document.getElementById('chillText').textContent = `Round ${e.stage} · goal reached!`; });
      const b2 = await page.evaluate(BROKEN, '.chillbar');
      ok(!b2.length, tag, 'Chill goal text wraps:', b2.join(', '));
    }
  }
  // results: end a Rush run
  await startRun(page, 'rush');
  // (one real pop first: a run with nothing popped shows a short "Nothing popped" card instead of the Coins)
  await page.evaluate(() => { const e = BR.Run.engine, B = e.board; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const b = B.grid[r][c]; b.color = r < 2 && c < 4 ? 0 : ((r * 3 + c) % 4) + 1; delete b.fb; } B.version++; BR.Run.view.syncTo(B); BR.Run.clearHover(); });
  const pt = await page.evaluate(() => { BR.Run.view._rc = null; return BR.Run.view.pagePoint(0, 0); });
  await touch(r, 'touchStart', pt.x, pt.y); await touch(r, 'touchEnd', pt.x, pt.y);
  await wait(page, 400); await page.waitForFunction(() => !BR.Run.busy, null, { timeout: 10000 }); await wait(page, 600);
  await page.evaluate(() => { const e = BR.Run.engine; e.score = 168000; BR.Run.setScore(e.score, false); e.fuse = 0.01; e.sparkUsed = true; });
  await page.waitForFunction(() => BR.Run.resultsEl, null, { timeout: 15000 }).catch(() => {});
  await wait(page, 4200);
  ok(await page.evaluate(() => !!document.querySelector('.results.on .coins-total')), tag, 'the results show no Coins total');
  const res = await page.evaluate(BROKEN, '.results.on :is(.res-coins, .res-actions, .res-score)');
  ok(!res.length, tag, 'results text wraps or is clipped:', res.join(', '));
  if (r.errors.length) ok(false, tag, 'console errors', r.errors.slice(0, 3).join(' | '));
  await r.browser.close();
}

async function homeChecks() {
  for (const large of [false, true]) {
    const r = await open('se1', { large });
    await r.page.evaluate(() => { BR.Storage.saveRun({ mode: 'rush', stage: 2, score: 1234 }); BR.Router.go('shop', { instant: true }); BR.Router.go('home', { instant: true }); });
    await wait(r.page, 1200);
    const g = await r.page.evaluate(() => { const p = document.querySelector('.hero-play').getBoundingClientRect(), d = document.querySelector('.play-disc').getBoundingClientRect(), t = document.getElementById('tabbar').getBoundingClientRect(); return { pb: p.bottom, disc: d.top, tab: t.top, resume: !!document.querySelector('.home .resume') }; });
    ok(g.resume, 'se1 home: the Resume card is missing');
    ok(g.pb <= g.disc && g.pb <= g.tab, 'se1 home' + (large ? ' (Larger text)' : ''), 'Play is under the tab bar', JSON.stringify(g));
    await r.page.evaluate(() => BR.Storage.clearRun());
    await r.browser.close();
  }
}

async function revealCheck() {
  const r = await open('se1');
  const { page } = r;
  await page.evaluate(() => { BR.Router.go('shop'); BR.App.openChest('brick'); });
  await page.waitForSelector('.opening.on .hold:not(.off)', { timeout: 10000 });
  await wait(page, 500);
  const chips = await page.evaluate(() => [...document.querySelectorAll('.opening.on .oc')].filter((e) => e.scrollWidth > e.clientWidth + 1).length);
  ok(!chips, 'se1 opening: odds chips overflow', chips);
  const see = await page.evaluate(() => document.querySelector('.opening.on .op-see').getBoundingClientRect().height);
  ok(see >= 44, 'se1 opening: "See everything inside" under 44px', see);
  const box = await page.locator('.opening.on .hold').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await touch(r, 'touchStart', cx, cy);
  await page.waitForFunction(() => BR.Openings.current && ['burst', 'spin'].includes(BR.Openings.current.state), null, { timeout: 8000 }).catch(() => {});
  await touch(r, 'touchEnd', cx, cy);
  await wait(page, 1800);
  const reel = await page.locator('.op-reel').boundingBox().catch(() => null);
  if (reel) { await touch(r, 'touchStart', reel.x + reel.width / 2, reel.y + reel.height / 2); await touch(r, 'touchEnd', reel.x + reel.width / 2, reel.y + reel.height / 2); }
  await page.waitForSelector('.rv.on .rv-actions.on', { timeout: 40000 });
  await wait(page, 1500);
  const g = await page.evaluate(() => { const n = document.querySelector('.rv-name').getBoundingClientRect(); const d = document.querySelector('.rv-demo > *') || document.querySelector('.rv-badge-big .bdg'); const a = d ? d.getBoundingClientRect() : null; return { nameTop: n.top, artBottom: a ? a.bottom : 0 }; });
  ok(g.artBottom <= g.nameTop + 2, 'se1 reveal: the item art covers the name', JSON.stringify(g));
  await page.evaluate(() => { const o = BR.Openings.current; if (o) o.requestClose(false); });
  if (r.errors.length) ok(false, 'reveal console errors', r.errors.slice(0, 3).join(' | '));
  await r.browser.close();
}

async function sheetSwipe() {
  const r = await open('s393');
  const { page } = r;
  const handle = async () => { await page.evaluate(() => BR.coinSheet()); await wait(page, 900); return page.locator('.sheet.on .sheet-handle').boundingBox(); };
  let b = await handle();
  await drag(r, b.x + b.width / 2, b.y + 2, 0, 30, 6, 40); await wait(page, 700);
  ok(await page.evaluate(() => !!document.querySelector('.sheet.on')), 'a small slow drag on the handle closed the sheet');
  const back = await page.evaluate(() => getComputedStyle(document.querySelector('.sheet.on')).transform);
  ok(back === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(back), 'the sheet did not spring back after a small drag', back);
  await page.evaluate(() => { while (BR.Back.depth) BR.Back.closeTop(); }); await wait(page, 600);
  b = await handle();
  await drag(r, b.x + b.width / 2, b.y + 2, 0, 260, 12, 16); await wait(page, 800);
  ok(await page.evaluate(() => !document.querySelector('.sheet.on')), 'a swipe down on the handle left the sheet open');
  await page.evaluate(() => { while (BR.Back.depth) BR.Back.closeTop(); }); await wait(page, 600);
  // a quick flick on the head
  await page.evaluate(() => BR.coinSheet()); await wait(page, 900);
  // (dispatched in the page with exact spacing: real touch events through CDP arrive too irregularly on a loaded machine to time a flick)
  await page.evaluate(() => {
    const h = document.querySelector('.sheet.on .sheet-head h2'), b = h.getBoundingClientRect(), x = b.left + 10, y = b.top + b.height / 2;
    const ev = (t, dy) => h.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y + dy }));
    const pause = (ms) => { const t = performance.now(); while (performance.now() - t < ms); };
    ev('pointerdown', 0); for (let i = 1; i <= 5; i++) { pause(12); ev('pointermove', i * 12); } ev('pointerup', 60);   // (60px: well under 30% of the sheet, so only the speed closes it)
  });
  await wait(page, 800);
  ok(await page.evaluate(() => !document.querySelector('.sheet.on')), 'a quick flick down on the sheet head left the sheet open');
  // the body still scrolls: a long sheet (Settings) scrolls on a drag inside its body
  await page.evaluate(() => { while (BR.Back.depth) BR.Back.closeTop(); }); await wait(page, 500);
  await page.evaluate(() => BR.openSettings ? BR.openSettings() : document.getElementById('tbGear').click()); await wait(page, 900);
  const body = await page.locator('.sheet.on .sheet-body').boundingBox();
  if (body) {
    const before = await page.evaluate(() => document.querySelector('.sheet.on .sheet-body').scrollTop);
    await drag(r, body.x + body.width / 2, body.y + body.height - 40, 0, -200, 10, 16); await wait(page, 700);
    const after = await page.evaluate(() => ({ st: document.querySelector('.sheet.on .sheet-body').scrollTop, open: !!document.querySelector('.sheet.on') }));
    ok(after.open, 'a drag inside the sheet body closed the sheet');
    ok(after.st > before || (await page.evaluate(() => { const b = document.querySelector('.sheet.on .sheet-body'); return b.scrollHeight <= b.clientHeight + 2; })), 'the sheet body did not scroll', before, after.st);
  }
  if (r.errors.length) ok(false, 'sheet console errors', r.errors.slice(0, 3).join(' | '));
  await r.browser.close();
}

/** Every visible control changes something when pressed (:active forced through CDP), also with Reduce Motion for the .stg cards. */
async function pressChecks() {
  const r = await open('s393');
  const { page, cdp } = r;
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  // (a press shows on the control, its contents or its card: :active also applies to the ancestors of the pressed element)
  const STYLE = (i) => { const e = document.querySelector(`[data-u7i="${i}"]`); const all = [e.parentElement, e, ...e.querySelectorAll('*')].slice(0, 13); return all.map((x) => { const s = getComputedStyle(x); return [s.transform, s.filter, s.boxShadow, s.backgroundColor, s.backgroundImage, s.opacity, s.color, s.borderColor, s.translate, s.scale].join('|'); }).join('#'); };
  const screens = [
    ['home', () => BR.Router.go('home', { instant: true })],
    ['missions', () => BR.Router.go('missions', { instant: true })],
    ['collection', () => BR.Router.go('collection', { instant: true })],
    ['profile', () => BR.Router.go('profile', { instant: true })],
    ['settings', () => { BR.Router.go('home', { instant: true }); document.getElementById('tbGear').click(); }],
  ];
  for (const reduced of [false, true]) {
    if (reduced) await page.evaluate(() => { BR.Storage.data.settings.reduced = true; BR.App.applySettings(); });
    for (const [name, go] of screens) {
      await page.evaluate(() => { while (BR.Back.depth) BR.Back.closeTop(); });
      await page.evaluate(go); await wait(page, 1300);
      const n = await page.evaluate(() => {
        document.querySelectorAll('[data-u7i]').forEach((e) => e.removeAttribute('data-u7i'));
        const root = document.querySelector('.sheet.on') || document;
        const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false; let a = e; while (a && a !== document.body) { const s = getComputedStyle(a); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false; a = a.parentElement; } const c = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); return !!c && (c === e || e.contains(c)); };
        let k = 0;
        root.querySelectorAll('button, [data-act], [role="button"], .pt, a[href]').forEach((e) => { if (e.disabled || e.closest('[inert]') || e.closest('.tabbar, #tabbar') && !e.matches('.tab, .play-disc')) return; if (e.parentElement && e.parentElement.closest('button, [data-act]')) return; if (vis(e)) e.setAttribute('data-u7i', k++); });
        return k;
      });
      const flat = [];
      for (let i = 0; i < n; i++) {
        const before = await page.evaluate(STYLE, i);
        await page.evaluate((i) => { document.querySelectorAll('[data-u7p]').forEach((e) => e.removeAttribute('data-u7p')); document.querySelector(`[data-u7i="${i}"]`).parentElement.setAttribute('data-u7p', ''); }, i);
        const { root: doc } = await cdp.send('DOM.getDocument', { depth: -1 });
        const par = await cdp.send('DOM.querySelector', { nodeId: doc.nodeId, selector: '[data-u7p]' });
        const me = await cdp.send('DOM.querySelector', { nodeId: doc.nodeId, selector: `[data-u7i="${i}"]` });
        const ids = [me.nodeId, par.nodeId].filter(Boolean);
        for (const n of ids) await cdp.send('CSS.forcePseudoState', { nodeId: n, forcedPseudoClasses: ['active'] });
        const during = await page.evaluate(STYLE, i);
        for (const n of ids) await cdp.send('CSS.forcePseudoState', { nodeId: n, forcedPseudoClasses: [] });
        if (before === during) flat.push(await page.evaluate((i) => { const e = document.querySelector(`[data-u7i="${i}"]`); return e.className + ' "' + (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 20) + '"'; }, i));
      }
      ok(!flat.length, name + (reduced ? ' (Reduce Motion)' : ''), `${flat.length} of ${n} controls have no press style:`, flat.join(', '));
    }
  }
  await r.browser.close();
}

(async () => {
  await Promise.all([runChecks('se1'), runChecks('s360'), runChecks('s393', true), runChecks('l844', true)]);
  await Promise.all([homeChecks(), revealCheck(), sheetSwipe()]);
  await pressChecks();
  console.log(problems ? `u7-mobile: ${problems} problem(s)` : 'u7-mobile: all checks passed');
  process.exit(problems ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
