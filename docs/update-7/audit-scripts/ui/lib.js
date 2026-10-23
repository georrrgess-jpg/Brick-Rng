// Helpers for the Update 7 mobile UI audit (read-only on the game). Screenshots go to $AUDIT_OUT (default: the system temp folder).
// Every context is a phone: isMobile + hasTouch, so :hover never sticks and the viewport meta is honoured.
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', '..', '..', '..', 'index.html');
const OUT = process.env.AUDIT_OUT || path.join(require('os').tmpdir(), 'u7-ui');
const SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

// The sizes the audit covers. ins = simulated safe-area insets [top, bottom, left, right].
const SIZES = {
  se1: [320, 568], s360: [360, 640], s375: [375, 667], s390: [390, 844], s393: [393, 852], s412: [412, 915], s430: [430, 932],
  l667: [667, 375], l844: [844, 390],
};
const INSETS = { port: [59, 34, 0, 0], land: [0, 21, 59, 59] };

const wait = (page, ms) => page.waitForTimeout(ms);

async function launch({ width = 393, height = 852, dsf = 2, insets = null, large = false, perf = false, coach = false, setup } = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (['error'].includes(m.type())) errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  if (setup) await page.addInitScript(setup);
  await page.goto(URL);
  await page.waitForFunction(() => window.__app, null, { timeout: 10000 }).catch(() => {});
  if (!coach) await page.evaluate(() => { BR.Coach.markAllSeen(); });
  if (insets) await setInsets(page, insets, width > height);
  const cdp = await ctx.newCDPSession(page);
  page.__cdp = cdp;
  return { browser, ctx, page, errors, cdp };
}

/** Simulated safe areas: the inset variables plus a black notch / island drawn where a real phone has one. */
async function setInsets(page, [t, b, l, r], land) {
  await page.addStyleTag({ content: `:root{--sat:${t}px !important;--sab:${b}px !important;--sal:${l}px !important;--sar:${r}px !important}` });
  await page.evaluate(([t, b, l, r, land]) => {
    const mk = (css) => { const d = document.createElement('div'); d.className = 'sim-hw'; d.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;' + css; document.documentElement.appendChild(d); };
    if (!land) { mk(`left:calc(50% - 63px);top:11px;width:126px;height:37px;border-radius:20px;background:#000`); mk(`left:calc(50% - 70px);bottom:8px;width:140px;height:5px;border-radius:3px;background:#fff`); }
    else { mk(`left:11px;top:calc(50% - 63px);width:37px;height:126px;border-radius:20px;background:#000`); mk(`left:calc(50% - 90px);bottom:6px;width:180px;height:5px;border-radius:3px;background:#fff`); }
  }, [t, b, l, r, land]);
}

/** A returning player: level 6, 900 Coins, five items of each type, waiting chests, a streak and records. */
async function player(page, o = {}) {
  await page.evaluate((o) => {
    const st = BR.Storage.data, P = BR.Progress, pr = st.profile;
    st.settings.sound = false; st.settings.music = false; st.settings.haptics = false; st.seenTutorial = true; st.runs = o.runs != null ? o.runs : 12;
    pr.level = o.level || 6; pr.xp = Math.round(BR.xpForLevel(pr.level) * 0.4); pr.coins = o.coins != null ? o.coins : 900;
    st.best.rush = o.best != null ? o.best : 48250; st.bestStage.rush = 5; st.recent.rush = [21000, 33000, 48250];
    pr.records = pr.records || {}; pr.records.history = [8000, 12000, 21000, 15000, 33000, 48250, 29000, 40100];
    pr.stats.bricks = 5321; pr.stats.maxGroup = 14; pr.stats.bestCombo = 4;
    ['skin', 'pop', 'board', 'fuse'].forEach((t) => BR.DROP_ITEMS.filter((i) => i.type === t).slice(0, o.items != null ? o.items : 5).forEach((i, k) => { if (!P.owns(i.id)) P.keep({ itemId: i.id, shine: ['plain', 'glossy', 'holo', 'prism'][k % 4], seed: k + 3 }); }));
    pr.chests = Object.assign({ brick: 0, pop: 0, board: 0, fuse: 0, golden: 0 }, o.chests || { brick: 2, golden: 1 });
    pr.trophies = { first_run: 1, first_rush: 1, stage5: 1, daily1: 1 };
    if (o.large) st.settings.large = true;
    if (o.perfMode) st.settings.perfMode = true;
    if (o.resume) BR.Storage.saveRun({ mode: 'rush', stage: 2, score: 1234 }); else BR.Storage.clearRun();
    st.seen = Object.assign(st.seen || {}, { misDay: BR.Missions.ensure().day });
    BR.Storage.save(); BR.App.applySettings(); BR.Chrome.refresh(); BR.Router.go('shop', { instant: true }); BR.Router.go('home', { instant: true });
  }, o);
  await wait(page, 700);
}

const closeAll = (page) => page.evaluate(() => { while (BR.Back.depth) BR.Back.closeTop(); });

/** Screenshot the current screen at every scroll position of its .scroll (or `sel`). Returns the file list. */
async function shotScroll(page, name, { sel, settle = 300, max = 6 } = {}) {
  const info = await page.evaluate((sel) => { const el = sel ? document.querySelector(sel) : document.querySelector('.screen.on .scroll'); return el ? { sh: el.scrollHeight, ch: el.clientHeight } : null; }, sel || null);
  const files = [];
  if (!info) { const f = path.join(SHOTS, name + '.png'); await page.screenshot({ path: f }); return [f]; }
  const step = Math.max(100, info.ch - 120);
  let y = 0, k = 0;
  while (k < max) {
    await page.evaluate(([sel, y]) => { const el = sel ? document.querySelector(sel) : document.querySelector('.screen.on .scroll'); el.scrollTop = y; }, [sel || null, y]);
    await wait(page, settle);
    const f = path.join(SHOTS, `${name}${k ? '-' + k : ''}.png`);
    await page.screenshot({ path: f });
    files.push(f);
    if (y + info.ch >= info.sh - 2) break;
    y += step; k++;
  }
  await page.evaluate((sel) => { const el = sel ? document.querySelector(sel) : document.querySelector('.screen.on .scroll'); if (el) el.scrollTop = 0; }, sel || null);
  return files;
}

/** Geometry checks on what is on screen now: overflow, clipping, small or crowded targets, things under the insets or off screen. */
const AUDIT = ([MIN_HIT, ins]) => {
  const out = [];
  const vw = innerWidth, vh = innerHeight;
  const [sat, sab, sal, sar] = ins;
  const sel = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const vis = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
  const roots = '#topbar, #screens .screen.on, #layer-sheets .sheet.on, #layer-overlays, .results.on, #tabbar, #layer-opening .opening, #toasts';
  const els = [...document.querySelectorAll(roots)].flatMap((r) => [r, ...r.querySelectorAll('*')]);
  const seen = new Set();
  const push = (k, ...a) => { const key = k + a[0]; if (seen.has(key)) return; seen.add(key); out.push([k, ...a]); };
  // horizontal scroll of the document or a screen
  if (document.documentElement.scrollWidth > vw + 1) push('hscroll', 'document', document.documentElement.scrollWidth);
  for (const s of document.querySelectorAll('.screen.on .scroll, .sheet.on .sheet-body')) if (s.scrollWidth > s.clientWidth + 1) push('hscroll', sel(s), s.scrollWidth + '>' + s.clientWidth);
  const targets = [];
  for (const el of els) {
    if (el.closest('svg') || !vis(el)) continue;
    let anc = el, hidden = false; while (anc && anc !== document.body) { if (!vis(anc)) { hidden = true; break; } anc = anc.parentElement; }
    if (hidden) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el);
    const txt = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    const inScrollX = el.closest('.track, .filters, .reel, .op-reel, .strip');
    if (txt) {
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible' && !/INPUT|TEXTAREA/.test(el.tagName)) push('clip', sel(el), txt.slice(0, 32), el.scrollWidth + '>' + el.clientWidth);
      if (!inScrollX && (r.right > vw + 1 || r.left < -1)) push('offscreen-x', sel(el), txt.slice(0, 32), Math.round(r.left) + '..' + Math.round(r.right));
      if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) push('ellipsis', sel(el), txt.slice(0, 32));
    }
    const isCtl = el.matches('button, a[href], [role="button"], input:not([type="hidden"]), textarea, select, [data-act], [data-tab], [data-hold]');
    if (isCtl) {
      const w = el.offsetWidth || r.width, h = el.offsetHeight || r.height;
      targets.push({ el, r });
      if ((w < MIN_HIT - 0.5 || h < MIN_HIT - 0.5)) push('small-target', sel(el), (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24), Math.round(w) + 'x' + Math.round(h));
      // under the notch / home indicator / rounded sides
      const fixedLayer = el.closest('#layer-sheets, #tabbar, #topbar, .screen.on, .opening, .results');
      if (fixedLayer && (r.top < sat - 1 || r.bottom > vh - sab + 1 || r.left < sal - 1 || r.right > vw - sar + 1) && r.bottom > 0 && r.top < vh) {
        const sc = el.closest('.scroll, .sheet-body, .track');
        if (!sc) push('in-inset', sel(el), (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24), `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
      if (r.top >= vh || r.bottom <= 0 || r.left >= vw || r.right <= 0) { /* off screen: fine when inside a scroller */ const sc = el.closest('.scroll, .sheet-body, .track, .filters, .reel'); if (!sc) push('ctl-offscreen', sel(el), (el.textContent || '').trim().slice(0, 24), `${Math.round(r.top)}..${Math.round(r.bottom)}`); }
    }
  }
  // sheets taller than the screen, or whose body barely shows
  for (const s of document.querySelectorAll('.sheet.on')) {
    const r = s.getBoundingClientRect(), b = s.querySelector('.sheet-body');
    if (r.top < sat) push('sheet-top', sel(s), Math.round(r.top));
    if (b && b.scrollHeight > b.clientHeight + 4) push('sheet-scrolls', sel(s), `body ${b.clientHeight} of ${b.scrollHeight}`);
  }
  // overlapping targets: two controls that can both be hit (each owns the point at its centre) and whose boxes overlap by more than 4px
  const hit = (t) => { const cx = (t.r.left + t.r.right) / 2, cy = (t.r.top + t.r.bottom) / 2; if (cx < 0 || cy < 0 || cx > vw || cy > vh) return false; const e = document.elementFromPoint(cx, cy); return !!e && (t.el === e || t.el.contains(e)); };
  const vt = targets.filter((t) => t.r.bottom > 0 && t.r.top < vh && !t.el.closest('.board') && hit(t));
  for (let i = 0; i < vt.length; i++) for (let j = i + 1; j < vt.length; j++) {
    const a = vt[i], b = vt[j]; if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ox > 4 && oy > 4) push('overlap-target', sel(a.el) + ' & ' + sel(b.el), `${Math.round(ox)}x${Math.round(oy)}`);
  }
  // controls a finger cannot reach because something else sits on top of their centre (not counting content scrolled under the bars)
  for (const t of targets) {
    if (t.r.bottom <= 0 || t.r.top >= vh || t.el.closest('.board') || t.el.disabled) continue;
    const cx = (t.r.left + t.r.right) / 2, cy = (t.r.top + t.r.bottom) / 2; if (cx < 0 || cx > vw || cy < 0 || cy > vh) continue;
    const e = document.elementFromPoint(cx, cy); if (!e || t.el === e || t.el.contains(e)) continue;
    if (e.closest('#tabbar, #topbar, .sheet-back, .sheet, .sim-hw, #layer-opening') && !t.el.closest('.sheet, .opening')) continue;
    push('covered', sel(t.el), (t.el.getAttribute('aria-label') || t.el.textContent || '').trim().slice(0, 24), 'by ' + sel(e));
  }
  return out;
};
async function audit(page, ins = [0, 0, 0, 0]) { return page.evaluate(AUDIT, [44, ins]); }

module.exports = { launch, setInsets, player, closeAll, shotScroll, audit, wait, SIZES, INSETS, SHOTS, OUT, path, fs, URL };
