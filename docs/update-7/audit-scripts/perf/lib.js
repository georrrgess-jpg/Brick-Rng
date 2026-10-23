// Shared harness for the Update 7 low-end performance audit (read-only: nothing here changes the game).
// Chromium with no GPU, 393 x 852 at deviceScaleFactor 3, isMobile + hasTouch, CPU slowed with CDP (RATE=4 default, RATE=6 for a
// low-end Android stand-in). Absolute times are higher than on a phone (software raster); compare runs with each other.
// env: ROOT (game folder), RATE, PERF (high|auto|low), PM=1 (Performance mode)
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const ROOT = process.env.ROOT || path.resolve(__dirname, '..', '..', '..', '..');
const URL = 'file://' + ROOT + '/index.html';
const RATE = +(process.env.RATE || 4);

async function launch(opts = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'].concat(opts.args || []) });
  const ctx = await browser.newContext({ viewport: { width: opts.width || 393, height: opts.height || 852 }, deviceScaleFactor: opts.dsf || 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(URL); await page.waitForFunction(() => window.__app, null, { timeout: 20000 });
  const cdp = await ctx.newCDPSession(page);
  return { browser, ctx, page, cdp, errors };
}

/** A player with a full-ish save: most of Series 2-4 owned with mixed shines, the loadout given by o.{skin,pop,board,fuse}. */
async function setup(page, o = {}) {
  await page.evaluate((o) => {
    BR.Coach.markAllSeen();
    const st = BR.Storage.data, P = BR.Progress, pr = st.profile;
    st.settings.perf = o.perf || 'high'; st.settings.perfMode = !!o.pm; st.settings.haptics = false; st.settings.sound = false; st.settings.music = false;
    st.runs = 12; st.seenTutorial = true; pr.level = 14; pr.coins = 99999; pr.chests = { brick: 6, pop: 2, board: 1, fuse: 1, golden: 1 }; pr.passTier = 8;
    st.best.rush = 184520; st.bestStage.rush = 7;
    if (o.own !== false) BR.ITEMS.filter((it, i) => !it.pass && i % 4 !== 3).forEach((it, i) => { if (!P.owns(it.id)) P.keep({ itemId: it.id, shine: ['plain', 'glossy', 'holo', 'prism', 'plain'][i % 5], seed: (i * 733) % 10000 }); });
    ['skin', 'pop', 'board', 'fuse'].forEach((t) => { const id = o[t]; if (!id) return; if (!P.owns(id)) P.keep({ itemId: id, shine: o.shine || 'plain', seed: 7 }); const inst = st.profile.vault.find((v) => v.itemId === id); if (o.shine) inst.shine = o.shine; P.equip(inst.uid, t); });
    if (o.hat) { P.grantHat(o.hat); P.equipHat(o.hat); }
    BR.App.applySettings(); BR.Skins.apply(); BR.App.spawnBgBricks();
  }, o);
}

const throttle = (cdp, rate = RATE) => cdp.send('Emulation.setCPUThrottlingRate', { rate });
const seeded = (page, seed = 12345) => page.evaluate((s) => { Math.random = (() => { let x = s; return () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296); })(); }, seed);

/** rAF gaps, collected in the page until stopFrames(). Each entry [start, end, tag()] */
const startFrames = (page, tagExpr) => page.evaluate((tagExpr) => {
  const tag = tagExpr ? new Function('return (' + tagExpr + ')') : () => '';
  window.__g = []; window.__stop = false; performance.mark('t0'); let last = performance.now();
  const f = () => { const n = performance.now(); window.__g.push([last, n, tag()]); last = n; if (!window.__stop) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}, tagExpr || null);
const stopFrames = (page) => page.evaluate(() => { window.__stop = true; return { g: window.__g, t0: performance.getEntriesByName('t0').pop().startTime }; });
const stats = (gaps) => { const s = gaps.slice().sort((a, b) => a - b); const sum = gaps.reduce((a, b) => a + b, 0); return { n: gaps.length, avg: gaps.length ? sum / gaps.length : 0, p90: s[Math.floor(s.length * 0.9)] || 0, max: s[s.length - 1] || 0, over50: gaps.filter((g) => g > 50).length }; };
const fmtS = (x) => `n ${x.n} avg ${x.avg.toFixed(1)} p90 ${x.p90.toFixed(0)} max ${x.max.toFixed(0)} >50 ${x.over50}`;

const CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing', 'v8.execute'];
async function trace(browser, page, fn, extra = []) {
  await browser.startTracing(page, { categories: CATS.concat(extra) });
  const r = await fn();
  const ev = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
  return { r, ev };
}
/** Main-thread totals by event name, and the same for the compositor/raster threads. */
function totals(ev) {
  const names = {}; ev.filter((e) => e.ph === 'M' && e.name === 'thread_name').forEach((e) => { names[e.pid + ':' + e.tid] = e.args.name; });
  const by = {};
  ev.filter((e) => e.ph === 'X' && e.dur).forEach((e) => {
    const t = (names[e.pid + ':' + e.tid] || '?').replace(/\d+/g, ''); if (!/CrRendererMain|Compositor|Raster|VizCompositor|CrGpuMain/.test(t)) return;
    if (/RunTask|ThreadController|TaskQueue|RunNormalPriorityTask|ProxyMain/.test(e.name)) return;
    by[t] = by[t] || {}; by[t][e.name] = (by[t][e.name] || 0) + e.dur / 1000;
    const c = 'cpu:' + t; by[c] = by[c] || {}; by[c][e.name] = (by[c][e.name] || 0) + (e.tdur != null ? e.tdur : e.dur) / 1000;   // thread CPU time: not inflated by other processes on the machine
  });
  return by;
}
const top = (m, n = 9, d = 0) => Object.entries(m || {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => k + ' ' + v.toFixed(d)).join(' | ');
/** What ran on the main thread inside each of the longest frames. */
function longFrames(ev, g, k = 4, filter) {
  const mark = ev.filter((x) => x.name === 't0').pop(); if (!mark) return [];
  const off = mark.ts / 1000 - g.t0;
  const tid = (ev.find((x) => x.name === 'FireAnimationFrame') || {}).tid;
  const main = ev.filter((x) => x.ph === 'X' && x.tid === tid && x.dur && !/RunTask|ThreadController|TaskQueue/.test(x.name));
  const list = g.g.filter((x) => !filter || filter(x)).slice().sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, k);
  return list.map(([s, e, ph]) => {
    const S = (s + off) * 1000, E = (e + off) * 1000; const agg = {};
    main.filter((x) => x.ts >= S - 500 && x.ts < E).forEach((x) => { let key = x.name; const d = x.args && x.args.data; if (d && (d.functionName || d.url)) key += ' ' + (d.functionName || '') + '@' + String(d.url || '').split('/').pop() + ':' + (d.lineNumber || ''); if (x.name === 'UpdateLayoutTree' && x.args && x.args.elementCount) key += ''; agg[key] = (agg[key] || 0) + x.dur / 1000; });
    const ult = main.filter((x) => x.ts >= S - 500 && x.ts < E && x.name === 'UpdateLayoutTree').reduce((a, x) => a + ((x.args && x.args.elementCount) || 0), 0);
    const cpu = ev.filter((x) => x.ph === 'X' && x.tid === tid && /^(RunTask|ThreadControllerImpl::RunTask)$/.test(x.name) && x.ts >= S - 500 && x.ts < E).reduce((a, x) => a + (x.tdur != null ? x.tdur : x.dur) / 1000, 0);
    return `frame ${(e - s).toFixed(0)} ${ph || ''} (main CPU ${cpu.toFixed(0)}, styled ${ult}): ` + top(agg, 7);
  });
}
/** JS self time from a CDP CPU profile. */
function jsTop(profile, n = 14) {
  const nodes = new Map(profile.nodes.map((x) => [x.id, x])); const self = new Map();
  profile.samples.forEach((id, i) => { const x = nodes.get(id); const k = (x.callFrame.functionName || '(anon)') + ' ' + (x.callFrame.url || '').split('/').pop() + ':' + x.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + (profile.timeDeltas[i] || 0) / 1000); });
  return [...self].filter(([k]) => !/^\((program|idle|root)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => k + ' ' + v.toFixed(0)).join(' | ');
}
/** Inclusive JS time per function. */
function jsIncl(profile, n = 30) {
  const nodes = new Map(profile.nodes.map((x) => [x.id, x])); const parent = new Map(); profile.nodes.forEach((x) => (x.children || []).forEach((c) => parent.set(c, x.id)));
  const incl = new Map(); const tk = (x) => (x.callFrame.functionName || '(anon)') + ' ' + (x.callFrame.url || '').split('/').pop() + ':' + x.callFrame.lineNumber;
  profile.samples.forEach((id, i) => { const dt = (profile.timeDeltas[i] || 0) / 1000; const seen = new Set(); let cur = id; while (cur != null) { const k = tk(nodes.get(cur)); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + dt); } cur = parent.get(cur); } });
  return [...incl].filter(([k]) => !/^\((program|idle|root|garbage)/.test(k) && !/^ :-1/.test(k) && !/^\(anon\) :-1/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => v.toFixed(0).padStart(6) + ' ' + k).join('\n');
}
/** Biggest pop: the group plan that clears the most bricks right now. */
const bestTap = (page) => page.evaluate(() => { const e = BR.Run.engine; if (!e.chill) e.fuse = Math.max(e.fuse, 25); let b = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!b || p.cells.length > b.n)) b = { r, c, n: p.cells.length }; } if (!b) return null; const pt = BR.Run.view.pagePoint(b.r, b.c); return { x: pt.x, y: pt.y, n: b.n }; });
async function startRun(page, mode = 'daily', seed = 12345) {
  await page.touchscreen.tap(196, 3);
  await page.evaluate(([m, s]) => { Math.random = (() => { let x = s; return () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296); })(); __app.startRun({ mode: m, boosts: {} }); }, [mode, seed]);
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 }); await page.waitForTimeout(800);
}
/** Layer tree: count, drawing layers, device-pixel area (x DSF^2), approx GPU bytes (4 B/px), and the biggest ones by node. */
async function layerReport(page, cdp, dsf = 3, wait = 1200) {
  await cdp.send('DOM.enable').catch(() => {}); await cdp.send('LayerTree.enable').catch(() => {});
  let last = null; const h = (e) => { if (e.layers) last = e.layers; }; cdp.on('LayerTree.layerTreeDidChange', h);
  await page.waitForTimeout(wait);
  // force at least one more commit so the event fires with the current tree
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(200); cdp.off('LayerTree.layerTreeDidChange', h);
  const L = last || []; const draw = L.filter((x) => x.drawsContent);
  const big = [];
  for (const l of draw.slice().sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 8)) {
    let name = '(no node)';
    if (l.backendNodeId) { try { const d = await cdp.send('DOM.describeNode', { backendNodeId: l.backendNodeId }); const n = d.node; const at = {}; for (let i = 0; i < (n.attributes || []).length; i += 2) at[n.attributes[i]] = n.attributes[i + 1]; name = n.nodeName.toLowerCase() + (at.id ? '#' + at.id : '') + (at.class ? '.' + at.class.split(' ').slice(0, 2).join('.') : ''); } catch (e) { name = 'node?'; } }
    big.push(name + ' ' + Math.round(l.width) + 'x' + Math.round(l.height));
  }
  const px = draw.reduce((a, l) => a + l.width * l.height, 0) * dsf * dsf;
  await cdp.send('LayerTree.disable').catch(() => {});
  return { layers: L.length, drawing: draw.length, mpx: px / 1e6, mb: px * 4 / 1048576, big };
}

/** Main-thread CPU (thread time, so other load on the machine does not count) per frame, by phase tag, with the top event names. */
function phaseCpu(ev, g) {
  const mark = ev.filter((x) => x.name === 't0').pop(); if (!mark) return {};
  const off = mark.ts / 1000 - g.t0;
  const tid = (ev.find((x) => x.name === 'FireAnimationFrame') || {}).tid;
  const tasks = ev.filter((x) => x.ph === 'X' && x.tid === tid && /^(RunTask|ThreadControllerImpl::RunTask)$/.test(x.name)).sort((a, b) => a.ts - b.ts);
  const inner = ev.filter((x) => x.ph === 'X' && x.tid === tid && x.dur && !/RunTask|ThreadController|TaskQueue/.test(x.name));
  const out = {};
  for (const [s, e, ph] of g.g) {
    const S = (s + off) * 1000, E = (e + off) * 1000; const o = (out[ph] = out[ph] || { frames: 0, cpu: 0, worst: 0, names: {}, wall: 0 });
    o.frames++; o.wall += e - s;
    let c = 0; for (const t of tasks) { if (t.ts >= E) break; if (t.ts >= S) c += (t.tdur != null ? t.tdur : t.dur) / 1000; }
    o.cpu += c; o.worst = Math.max(o.worst, c);
  }
  for (const [ph, o] of Object.entries(out)) {
    const ranges = g.g.filter((x) => x[2] === ph).map(([s, e]) => [(s + off) * 1000, (e + off) * 1000]);
    for (const x of inner) { if (ranges.some(([S, E]) => x.ts >= S && x.ts < E)) o.names[x.name] = (o.names[x.name] || 0) + (x.tdur != null ? x.tdur : x.dur) / 1000; }
  }
  return out;
}
const fmtPh = (o) => `frames ${o.frames}, main CPU/frame ${(o.cpu / o.frames).toFixed(1)} ms (worst ${o.worst.toFixed(0)}), wall/frame ${(o.wall / o.frames).toFixed(0)} | ` + top(Object.fromEntries(Object.entries(o.names).map(([k, v]) => [k, v / o.frames])), 7, 1);
module.exports = { launch, setup, throttle, seeded, startFrames, stopFrames, stats, fmtS, trace, totals, top, longFrames, jsTop, jsIncl, bestTap, startRun, layerReport, phaseCpu, fmtPh, RATE, ROOT, URL };
