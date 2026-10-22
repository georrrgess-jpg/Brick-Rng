// Shared helpers for the Update 5 run/chest/cosmetics audit (scratch only).
const path = require('path');
const fs = require('fs');
const { launch } = require('/home/user/Brick-Rng/tests/lib.js');
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

// time dilation (borrowed from tests/fusesheet.js): performance.now and rAF timestamps run at window.__scale
const SLOWMO = () => {
  let scale = 1, vt = 0, last = performance.now();
  const real = performance.now.bind(performance);
  const nowV = () => { const r = real(); vt += (r - last) * scale; last = r; return vt; };
  performance.now = nowV;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(nowV()));
  window.__scale = (k) => { nowV(); scale = k; };
  // slow setTimeout too, so the view's sleeps keep pace with the slowed animations
  const st = window.setTimeout.bind(window);
  window.__realTimeout = st;
  window.setTimeout = (fn, ms, ...a) => st(fn, (ms || 0) / scale, ...a);
};

async function boot(o = {}) {
  const L = await launch(Object.assign({ width: 393, height: 852, dsf: 1, mobile: true }, o, { setup: o.slow ? SLOWMO : o.setup }));
  await L.page.evaluate((runs) => {
    const D = BR.Storage.data; D.seenTutorial = true; D.runs = runs; D.settings.sound = false; D.settings.music = false; D.settings.haptics = false; D.settings.perf = 'high';
    BR.App.applySettings(); BR.Storage.save();
  }, o.runs != null ? o.runs : 8);
  L.cdp = await L.ctx.newCDPSession(L.page);
  L.page.__cdp = L.cdp;
  if (o.slow) {
    await L.cdp.send('Animation.enable');
    L.rate = async (k) => { await L.cdp.send('Animation.setPlaybackRate', { playbackRate: k }); await L.page.evaluate((k) => window.__scale(k), k); };
  }
  return L;
}

async function equip(page, id, type) {
  await page.evaluate(({ id, type }) => {
    const P = BR.Progress;
    if (id === 'default') P.equip('default', type);
    else { let inst = BR.Storage.data.profile.vault.find((v) => v.itemId === id); if (!inst) inst = P.keep({ itemId: id, shine: 'plain', seed: 1234, counter: null }); P.equip(inst.uid, type || BR.itemById[id].type); }
    BR.Skins.apply();
  }, { id, type });
}

async function startRun(page, mode = 'rush', extra = {}) {
  await page.evaluate(({ mode, extra }) => {
    if (BR.Router.current === 'run') { BR.Run.over = true; BR.Run.token++; }
    if (BR.Run.resultsEl) BR.Run.closeResults();
    BR.Storage.clearRun();
    BR.Router.go('home', { instant: true });
    __app.startRun(Object.assign({ mode, boosts: {} }, extra));
  }, { mode, extra });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy && BR.Router.current === 'run', null, { timeout: 15000 });
}

/** rows: 8 strings of 8 chars; digits are colors, '*' keeps the current brick. Fuse bricks with a letter a-e (fb 1..5) on color 0. */
async function setBoard(page, rows) {
  await page.evaluate((rows) => {
    const e = BR.Run.engine, B = e.board;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const ch = rows[r][c]; if (ch === '*') continue;
      const b = B.grid[r][c];
      if (/[a-e]/.test(ch)) { b.color = 1; b.fb = ch.charCodeAt(0) - 96; }
      else { b.color = +ch; delete b.fb; }
    }
    B.version++;
    BR.Run.view.syncTo(B);
    BR.Run.clearHover();
  }, rows);
}

async function cellPoint(page, r, c) { return page.evaluate(({ r, c }) => { BR.Run.view._rc = null; return BR.Run.view.pagePoint(r, c); }, { r, c }); }
// touch input through CDP, so the run sees pointerType 'touch' (no mouse hover preview after a pop)
async function touch(page, type, x, y) { await page.__cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] }); }
async function tap(page, r, c) { const p = await cellPoint(page, r, c); await touch(page, 'touchStart', p.x, p.y); await touch(page, 'touchEnd', p.x, p.y); }
async function press(page, r, c) { const p = await cellPoint(page, r, c); await touch(page, 'touchStart', p.x, p.y); page.__last = p; }
async function release(page) { const p = page.__last || { x: 0, y: 0 }; await touch(page, 'touchEnd', p.x, p.y); }
async function tapXY(page, x, y) { await touch(page, 'touchStart', x, y); await touch(page, 'touchEnd', x, y); }

async function shot(page, name, clip) {
  const p = path.join(OUT, name + '.png');
  await page.screenshot({ path: p, clip });
  return p;
}
async function idle(page) { await page.waitForFunction(() => !BR.Run.busy, null, { timeout: 10000 }).catch(() => {}); }

module.exports = { touch, tapXY, boot, equip, startRun, setBoard, tap, press, release, shot, idle, cellPoint, OUT, SLOWMO };
