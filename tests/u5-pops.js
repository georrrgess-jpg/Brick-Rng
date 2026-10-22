// Update 5 / Series 4 "Moonwick" pops (js/s4-pops.js): the budgets of spec section 3.0, checked on the real run screen.
//   1. particles per brick stay inside the budget on a 2, 6 and 16-brick group; birds and ghosts stay at six or fewer per pop
//   2. every pop moment adds at most 40 particles and 3 DOM sprites and ends inside 600 ms (Rush start and stage-up inside 900 ms);
//      lines drawn by Constellation stay inside their own life (0.9 s, twice that in Rush)
//   3. everything steered, every particle, line and sprite is released after 2.6 s (and the Rush decorations when Rush ends)
//   4. low-end halves the counts, Reduce Motion has no moments and steers nothing
//   5. the nine sound textures end inside 210 ms, are quiet and different from each other and from the classic pop
//   6. the nine badges are their own art, different from each other, at 36 to 120 px
//   7. no console errors
// It runs under a fake clock stepped at 60 Hz (the page's timers, requestAnimationFrame and, through a small sync, its Web Animations), so the
// durations are exact and do not depend on how busy the machine is.
// Usage: node tests/u5-pops.js [--only=b_birds,b_wisps] [--quick]
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const QUICK = process.argv.includes('--quick');
const POPS = ['b_fireflies', 'b_wishdust', 'b_birds', 'b_runes', 'b_goldleaf', 'b_sandfall', 'b_whirlgate', 'b_constellation', 'b_wisps'].filter((id) => !ONLY.length || ONLY.includes(id));
const MOMENT_POPS = ['b_goldleaf', 'b_sandfall', 'b_whirlgate', 'b_constellation', 'b_wisps'].filter((id) => POPS.includes(id));
/** Particles per brick the recipes may use, from the per-brick budget n (9 up to six bricks, 7 up to fourteen, 5 up to twenty-eight, 3 beyond). */
const CAP = {
  b_fireflies: (n) => Math.ceil(n * 0.35) + 1,      // fireflies, and one glint
  b_wishdust: (n) => Math.ceil(n * 1.1),            // spec: at most 1.1 x n
  b_birds: (n) => Math.min(n, 5),                   // a bird, three scraps, a glint
  b_runes: (n) => n,                                // glyphs, motes (the ring is not a particle)
  b_goldleaf: (n) => n,                             // flakes and the gilded glint
  b_sandfall: (n) => Math.ceil(n * 1.6),            // spec: at most 1.6 x n
  b_whirlgate: (n) => n,                            // comets and the pinpoint
  b_constellation: () => 2,                         // a star and its halo
  b_wisps: (n) => Math.min(n, 3),                   // a ghost and a glint (or two motes)
};
const SHAPES = {
  2: [[0, 0], [0, 1]],
  6: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]],
  9: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
  12: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3], [2, 0], [2, 1], [2, 2], [2, 3]],
  16: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 2], [1, 3], [2, 0], [2, 1], [2, 2], [2, 3], [3, 0], [3, 1], [3, 2], [3, 3]],
  8: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7]],
};
let problems = 0;
const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);

/* ---------- the page under a fake clock ---------- */
async function open({ perf = 'high', reduced = false } = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.clock.install();
  await page.goto(URL);
  await page.waitForFunction(() => window.__app, null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(({ perf, reduced }) => {
    BR.Coach.markAllSeen();
    const s = BR.Storage.data; s.seenTutorial = true; s.runs = 3; s.settings.sound = false; s.settings.perf = perf; s.settings.reduced = reduced; BR.App.applySettings();
  }, { perf, reduced });
  // let the first-run timers fire with the help cards marked as seen, and close anything that still opened
  await page.clock.runFor(1500);
  await page.evaluate(() => { BR.Coach.markAllSeen(); for (let i = 0; i < 4; i++) { try { BR.Back.closeTop(); } catch (e) { /* none open */ } } });
  await page.clock.runFor(600);
  await page.addScriptTag({ content: `
    window.__vt = 0;
    window.__sync = (dt) => {
      window.__vt += dt; const vt = window.__vt;
      for (const a of document.getAnimations()) {
        try {
          if (a.__v0 === undefined) { a.__v0 = vt - dt; a.__ended = false; if (a.playState === 'running') a.pause(); }
          const t = vt - a.__v0, ct = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
          if (ct && isFinite(ct.endTime) && t >= ct.endTime) { if (!a.__ended) { a.__ended = true; a.currentTime = ct.endTime; if (a.onfinish) { try { a.onfinish(); } catch (e) { /* ignore */ } } } }
          else a.currentTime = t;
        } catch (e) { /* ignore */ }
      }
    };
    window.__log = [];
    window.__hook = () => { const fx = BR.App.fx; if (fx.__hooked) return; fx.__hooked = true; const push = fx.parts.push.bind(fx.parts); fx.parts.push = (...a) => { a.forEach((p) => window.__log.push({ mo: !!p.mo, kind: p.kind })); return push(...a); }; };
    window.__alive = () => { const fx = BR.App.fx; return { p: fx.parts.filter((p) => p.mo).length, r: fx.rings.filter((r) => r.mo).length, l: fx.links.filter((l) => l.mo).length, s: document.querySelectorAll('.s4m').length }; };
  ` });
  return { browser, page, errors };
}
const frame = (page, ms) => page.clock.runFor(ms).then(() => page.evaluate((d) => window.__sync(d), ms));
async function run(page, ms, dt = 1000 / 60) { for (let t = 0; t < ms; t += dt) await frame(page, Math.min(dt, ms - t)); }
async function startRun(page, ids) {
  await page.evaluate((ids) => {
    const P = BR.Progress; ['skin', 'pop', 'board', 'fuse'].forEach((t) => P.equip('default', t));
    ids.forEach((id) => { const it = BR.itemById[id]; const inst = BR.Storage.data.profile.vault.find((v) => v.itemId === id) || P.keep({ itemId: id, shine: 'plain', seed: 3, counter: null }); P.equip(inst.uid, it.type); });
    BR.Skins.apply(); BR.Run.over = true; if (BR.Router.current === 'run') BR.Router.go('home', { instant: true });
    __app.startRun({ mode: 'rush', boosts: {} });
  }, ids);
  for (let i = 0; i < 80; i++) { await page.clock.runFor(100); if (await page.evaluate(() => !!(BR.Run.clock && !BR.Run.busy))) break; }
  await page.clock.runFor(400);
  await page.evaluate(() => { window.__vt = 0; window.__hook(); });
  await page.clock.pauseAt(Date.now() + 1e9).catch(() => {});
}
async function setBoard(page, cells, color) {
  await page.evaluate(({ cells, color }) => {
    const e = BR.Run.engine, B = e.board, view = BR.Run.view, others = [0, 1, 2, 3, 4, 5, 6].filter((c) => c !== color).slice(0, 5);
    for (let r = 0; r < B.rows; r++) for (let c = 0; c < B.cols; c++) { const b = B.grid[r][c]; b.color = others[(r + 2 * c) % 5]; b.fb = 0; }
    cells.forEach(([r, c]) => { B.grid[r][c].color = color; });
    B.version++; e.fuse = Math.max(e.fuse, 25); e.goal = 1e9; view.syncTo(B);   // (no stage-up from the pop itself: its moment is measured on its own)
  }, { cells, color });
}
const group = (size, r0 = 3, c0 = 2) => SHAPES[size].map(([r, c]) => [r + r0, c + (size === 8 ? 0 : c0)]);
async function tap(page, cell) {
  const p = await page.evaluate(({ r, c }) => BR.Run.view.pagePoint(r, c), { r: cell[0], c: cell[1] });
  await page.mouse.click(p.x, p.y);
  await page.mouse.move(2, 2);
}
const mid = (cells) => cells[Math.floor(cells.length / 2)];
const marks = (page) => page.evaluate(() => window.__log.length);
const since = (page, k) => page.evaluate((k) => window.__log.slice(k), k);

(async () => {
  const t0 = Date.now();
  const { browser, page, errors } = await open();
  const stage = async (pop, size, color = 1) => { await startRun(page, [pop]); const cells = group(size); await setBoard(page, cells, color); await run(page, 100); return cells; };
  const rows = [];

  /* ---------- 1. particles per brick, and the leak check, on groups of 2, 6 and 16 ---------- */
  console.log('== particles per brick (normal) ==');
  for (const pop of POPS) {
    const res = {};
    for (const size of [2, 6, 16]) {
      const cells = await stage(pop, size);
      const k = await marks(page);
      await tap(page, mid(cells));
      await run(page, 2600, 50);
      const log = await since(page, k);
      const n = size <= 6 ? 9 : size <= 14 ? 7 : size <= 28 ? 5 : 3;
      const mine = log.filter((p) => !p.mo).length, per = mine / size;
      res[size] = per;
      ok(per <= CAP[pop](n) + 1e-9, `${pop}: ${f1(per)} particles per brick on a group of ${size} (budget ${CAP[pop](n)} at n=${n})`);
      ok(per > 0, `${pop}: nothing was emitted on a group of ${size}`);
      const left = await page.evaluate(() => ({ live: BR.U4.live.length, parts: BR.App.fx.parts.length, links: BR.App.fx.links.length, rings: BR.App.fx.rings.length, sprites: document.querySelectorAll('#s3fx > *').length, birds: BR.S4Pops.PC.birds, ghosts: BR.S4Pops.PC.ghosts }));
      ok(left.live === 0, `${pop}: ${left.live} steered particles left after 2.6 s on a group of ${size}`);
      ok(left.parts === 0 && left.links === 0 && left.rings === 0 && left.sprites === 0, `${pop}: leftovers after 2.6 s (${JSON.stringify(left)})`);
      ok(left.birds <= 6 && left.ghosts <= 6, `${pop}: ${left.birds} birds and ${left.ghosts} ghosts in one pop (max 6)`);
    }
    rows.push([pop, f1(res[2]), f1(res[6]), f1(res[16])]);
  }
  console.log('pop'.padEnd(16) + 'per brick: 2'.padStart(14) + '6'.padStart(7) + '16'.padStart(7));
  rows.forEach((r) => console.log(r[0].padEnd(16) + r[1].padStart(14) + r[2].padStart(7) + r[3].padStart(7)));

  /* ---------- 2. the moments ---------- */
  console.log('\n== moments (normal): particles, sprites, last live moment, from the event ==');
  const measure = async (event, limit, fn) => {
    const k = await marks(page);
    await page.evaluate(() => { window.__t0 = performance.now(); });
    await fn();
    let last = 0, maxS = 0, maxL = 0;
    for (let t = 0; t <= 1300; t += 1000 / 60) {
      await frame(page, 1000 / 60);
      const a = await page.evaluate(() => window.__alive());
      if (a.p || a.r || a.l || a.s) last = t + 1000 / 60;
      maxS = Math.max(maxS, a.s);
    }
    const log = await since(page, k);
    return { last, maxS, mo: log.filter((p) => p.mo).length, all: log.length };
  };
  const mrows = [];
  const doMoments = async (opts) => {
    const out = {};
    for (const pop of MOMENT_POPS) {
      await startRun(page, [pop]);
      const col = 4;
      // big pop
      let cells = group(12); await setBoard(page, cells, col); await run(page, 100);
      let m = await measure('pop', 600, async () => { await tap(page, mid(cells)); });
      out[pop] = { pop: m };
      ok(m.mo <= 40 * (opts.low ? 0.6 : 1) + 1e-9, `${pop} big pop: ${m.mo} moment particles (max 40)`);
      ok(m.maxS <= 3, `${pop} big pop: ${m.maxS} DOM sprites at once (max 3)`);
      ok(m.last <= 600 + 1, `${pop} big pop: the moment lasts ${f1(m.last)} ms (max 600)`);
      await run(page, 1500, 50);
      // Line Blast
      cells = group(8, 4, 0); await setBoard(page, cells, col); await run(page, 100);
      m = await measure('line', 600, async () => { await tap(page, mid(cells)); });
      out[pop].line = m;
      ok(m.mo <= 40 + 1e-9, `${pop} Line Blast: ${m.mo} moment particles (max 40)`);
      ok(m.maxS <= 3, `${pop} Line Blast: ${m.maxS} DOM sprites at once (max 3)`);
      ok(m.last <= 600 + 1, `${pop} Line Blast: the moment lasts ${f1(m.last)} ms (max 600)`);
      await run(page, 1500, 50);
      // Rush start, Rush end, stage-up
      m = await measure('rushStart', 900, async () => { await page.evaluate(() => { BR.Skins.onEvent('rushStart', { run: BR.Run, view: BR.Run.view }); }); });
      out[pop].rush = m;
      ok(m.mo <= 40 + 1e-9, `${pop} Rush start: ${m.mo} moment particles (max 40)`);
      ok(m.maxS <= 3, `${pop} Rush start: ${m.maxS} DOM sprites at once (max 3)`);
      ok(m.last <= 900 + 1, `${pop} Rush start: the moment lasts ${f1(m.last)} ms (max 900)`);
      const decor = await page.evaluate(() => document.querySelectorAll('#bg .s4-swirl, #bg .s4-sky').length);
      if (!opts.low && (pop === 'b_whirlgate' || pop === 'b_constellation')) ok(decor === 1, `${pop}: expected one Rush decoration while Rush runs, found ${decor}`);
      if (opts.low) ok(decor === 0, `${pop}: low-end keeps no Rush decoration (found ${decor})`);
      await page.evaluate(() => { BR.Skins.onEvent('rushEnd', { run: BR.Run }); });
      await run(page, 800, 50);
      const decor2 = await page.evaluate(() => document.querySelectorAll('#bg .s4-swirl, #bg .s4-sky').length);
      ok(decor2 === 0, `${pop}: ${decor2} Rush decorations left after Rush ended`);
      m = await measure('stageUp', 900, async () => { await page.evaluate(() => { BR.Skins.onEvent('stageUp', { run: BR.Run, info: { to: 3, mult: 2 } }); }); });
      out[pop].stage = m;
      ok(m.mo <= 40 + 1e-9, `${pop} stage-up: ${m.mo} moment particles (max 40)`);
      ok(m.maxS <= 3, `${pop} stage-up: ${m.maxS} DOM sprites at once (max 3)`);
      ok(m.last <= 900 + 1, `${pop} stage-up: the moment lasts ${f1(m.last)} ms (max 900)`);
      // Rush: a pop in Rush adds its Rush beat (Gold Leaf dust) inside the same limits
      await page.evaluate(() => { BR.Skins.onEvent('rushStart', { run: BR.Run, view: BR.Run.view }); const e = BR.Run.engine; e.rush.active = true; e.rush.left = 8; });
      cells = group(9); await setBoard(page, cells, col); await run(page, 200);
      m = await measure('rushPop', 600, async () => { await tap(page, mid(cells)); });
      out[pop].rushPop = m;
      ok(m.mo <= 40 + 1e-9, `${pop} pop in Rush: ${m.mo} moment particles (max 40)`);
      ok(m.maxS <= 3, `${pop} pop in Rush: ${m.maxS} DOM sprites at once (max 3)`);
      ok(m.last <= 600 + 1, `${pop} pop in Rush: the moment lasts ${f1(m.last)} ms (max 600)`);
      await page.evaluate(() => { BR.Run.engine.rush.active = false; BR.Skins.onEvent('rushEnd', { run: BR.Run }); });
      await run(page, 2600, 50);
      const left = await page.evaluate(() => ({ live: BR.U4.live.length, parts: BR.App.fx.parts.length, links: BR.App.fx.links.length, rings: BR.App.fx.rings.length, sprites: document.querySelectorAll('#s3fx > *').length, decor: document.querySelectorAll('#bg .s4-swirl, #bg .s4-sky').length }));
      ok(left.live === 0 && left.parts === 0 && left.links === 0 && left.rings === 0 && left.sprites === 0 && left.decor === 0, `${pop}: leftovers after the moments (${JSON.stringify(left)})`);
    }
    return out;
  };
  const normal = await doMoments({});
  MOMENT_POPS.forEach((pop) => { const o = normal[pop]; mrows.push([pop, o.pop, o.line, o.rush, o.stage, o.rushPop]); });
  const cell = (m) => `${String(m.mo).padStart(2)}p ${m.maxS}s ${String(Math.round(m.last)).padStart(3)}ms`;
  console.log('pop'.padEnd(16) + ['big pop', 'line', 'rush start', 'stage-up', 'pop in rush'].map((s) => s.padStart(15)).join(''));
  mrows.forEach((r) => console.log(r[0].padEnd(16) + r.slice(1).map((m) => cell(m).padStart(15)).join('')));

  /* the lines Constellation draws stay inside their own life: 0.9 s, twice that in Rush */
  if (POPS.includes('b_constellation')) {
    for (const rush of [false, true]) {
      await startRun(page, ['b_constellation']);
      if (rush) await page.evaluate(() => { const e = BR.Run.engine; e.rush.active = true; e.rush.left = 8; });
      const cells = group(12); await setBoard(page, cells, 2); await run(page, 100);
      await tap(page, mid(cells));
      let last = 0, maxLinks = 0;
      for (let t = 0; t < 3200; t += 1000 / 60) { await frame(page, 1000 / 60); const n = await page.evaluate(() => BR.App.fx.links.length); maxLinks = Math.max(maxLinks, n); if (n) last = t; }
      ok(maxLinks <= 14, `constellation: ${maxLinks} lines at once on a group of 12 (max 14)`);
      ok(last <= (rush ? 1800 : 900) + 520 + 60, `constellation: lines last until ${Math.round(last)} ms${rush ? ' in Rush' : ''} (draw-in 520 ms plus ${rush ? 1.8 : 0.9} s)`);
      console.log(`constellation ${rush ? 'in Rush' : 'normal'}: up to ${maxLinks} lines, the last gone at ${Math.round(last)} ms`);
      await page.evaluate(() => { BR.Run.engine.rush.active = false; });
    }
  }

  /* ---------- 3. a pop in the middle of a pop: the steering is released even when the run is left ---------- */
  if (POPS.length === 9 || ONLY.length) {
    await startRun(page, [POPS[POPS.length - 1]]);
    const cells = group(16); await setBoard(page, cells, 3); await run(page, 100);
    await tap(page, mid(cells)); await run(page, 150);
    await page.evaluate(() => { BR.Run.over = true; BR.Router.go('home', { instant: true }); });
    await run(page, 3000, 50);
    const left = await page.evaluate(() => ({ live: BR.U4.live.length, parts: BR.App.fx.parts.length, sprites: document.querySelectorAll('#s3fx > *').length, decor: document.querySelectorAll('#bg .s4-swirl, #bg .s4-sky').length }));
    ok(left.live === 0 && left.parts === 0 && left.sprites === 0, `leaving the run in the middle of a pop leaves ${JSON.stringify(left)}`);
  }

  /* ---------- 4. low-end and Reduce Motion ---------- */
  const modes = QUICK ? [] : ['low', 'reduced'];
  for (const mode of modes) {
    console.log(`\n== ${mode} ==`);
    await page.evaluate((m) => { const s = BR.Storage.data.settings; s.reduced = m === 'reduced'; s.perf = m === 'low' ? 'low' : 'high'; BR.App.applySettings(); }, mode);
    for (const pop of POPS) {
      const cells = await stage(pop, 12);
      const k = await marks(page);
      await tap(page, mid(cells));
      await run(page, 120);
      const live = await page.evaluate(() => BR.U4.live.length);
      await run(page, 2500, 50);
      const log = await since(page, k);
      const nb = await page.evaluate(() => BR.App.fx.budget);
      const nBrick = Math.max(1, Math.round(7 * nb));
      const per = log.filter((p) => !p.mo).length / 12;
      ok(per <= CAP[pop](nBrick) + 1e-9 && per > 0, `${mode}: ${pop} used ${f1(per)} particles per brick (budget ${CAP[pop](nBrick)} at n=${nBrick})`);
      if (mode === 'reduced') {
        ok(live === 0, `reduced: ${pop} steered ${live} particles`);
        ok(log.filter((p) => p.mo).length === 0, `reduced: ${pop} played a moment (${log.filter((p) => p.mo).length} particles)`);
      }
      const left = await page.evaluate(() => ({ live: BR.U4.live.length, parts: BR.App.fx.parts.length, sprites: document.querySelectorAll('#s3fx > *').length }));
      ok(left.live === 0 && left.parts === 0 && left.sprites === 0, `${mode}: ${pop} leftovers ${JSON.stringify(left)}`);
    }
    if (mode === 'low') {
      const low = await doMoments({ low: true });
      MOMENT_POPS.forEach((pop) => {
        ['pop', 'line', 'stage'].forEach((ev) => {
          const a = normal[pop][ev].mo, b = low[pop][ev].mo;
          ok(b <= Math.ceil(a * 0.6) + 2, `low-end: ${pop} ${ev} moment uses ${b} particles, normal ${a} (should be about half)`);
        });
      });
      console.log('low-end moment particles (big pop / line / stage-up): ' + MOMENT_POPS.map((p) => `${p.slice(2)} ${low[p].pop.mo}/${low[p].line.mo}/${low[p].stage.mo}`).join(', '));
    }
    if (mode === 'reduced') {
      // a Line Blast and the Rush and stage-up events in Reduce Motion: nothing is drawn by a moment
      for (const pop of MOMENT_POPS) {
        await startRun(page, [pop]);
        const cells = group(8, 4, 0); await setBoard(page, cells, 2); await run(page, 100);
        const k = await marks(page);
        await tap(page, mid(cells)); await run(page, 100);
        await page.evaluate(() => { BR.Skins.onEvent('rushStart', { run: BR.Run, view: BR.Run.view }); BR.Skins.onEvent('stageUp', { run: BR.Run, info: { to: 3, mult: 2 } }); });
        await run(page, 300);
        const a = await page.evaluate(() => ({ s: document.querySelectorAll('.s4m').length, decor: document.querySelectorAll('#bg .s4-swirl, #bg .s4-sky').length }));
        const log = await since(page, k);
        ok(a.s === 0 && a.decor === 0 && log.filter((p) => p.mo).length === 0, `reduced: ${pop} drew a moment (${JSON.stringify(a)}, ${log.filter((p) => p.mo).length} particles)`);
      }
    }
    await page.evaluate(() => { const s = BR.Storage.data.settings; s.reduced = false; s.perf = 'high'; BR.App.applySettings(); });
  }

  /* ---------- 5. sound ---------- */
  console.log('\n== sound textures ==');
  await page.addScriptTag({ content: `
    window.__snd = async (flavor, n, seed) => {
      const A = BR.Audio; A._seed(seed, 0); A.setEnabled(true);
      const r = await A._renderOffline(() => { A.pop(n, 1, flavor); }, 0.55, { sr: 44100, log: true });
      const c = r.ch.map((a) => a.subarray(Math.round(r.lead * r.sr))), sr = r.sr;
      let pk = 0; for (const a of c) for (let i = 0; i < a.length; i++) pk = Math.max(pk, Math.abs(a[i]));
      let last = 0; const thr = pk * Math.pow(10, -50 / 20); for (const a of c) for (let i = a.length - 1; i >= last; i--) if (Math.abs(a[i]) > thr) { last = i; break; }
      // energy above 7 kHz (a plain DFT over the first 4096 samples is enough for a share)
      const N = 4096, re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = (c[0][i] + c[1][i]) * 0.5 * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
      for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
      for (let len = 2; len <= N; len <<= 1) { const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang); for (let i = 0; i < N; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } } }
      let tot = 0, hi = 0; const k7 = Math.round(7000 / (sr / N)); for (let i = 2; i < N / 2; i++) { const m = re[i] * re[i] + im[i] * im[i]; tot += m; if (i >= k7) hi += m; }
      const osc = r.log.filter((o) => o.k === 'osc');
      return { peak: pk, dur50: last / sr, hf: tot ? hi / tot : 0, bad: osc.filter((o) => o.type === 'sawtooth' || (o.type === 'square' && Math.max(o.f, o.to || 0) > 2000)).length, atkMin: Math.min(...osc.map((o) => o.attack)), atkMax: Math.max(...osc.map((o) => o.attack)), longest: Math.max(...osc.map((o) => o.dur)), nan: c.some((a) => a.some((x) => !isFinite(x))), samples: Array.from(c[0].subarray(0, Math.round(sr * 0.4))) };
    };
  ` });
  const names = POPS.map((p) => p.slice(2));
  const flavorNames = await page.evaluate(() => Object.keys(BR.Audio.flavors));
  const audio = {};
  for (const id of POPS) {
    const fl = await page.evaluate((id) => BR.itemById[id].recipe, id);
    ok(flavorNames.includes(fl), `${id}: no sound texture registered for "${fl}"`);
    let pk = 0, dur = 0, hf = 0, longest = 0;
    for (const n of [2, 6, 10, 14]) {
      const r = await page.evaluate((a) => window.__snd(a.fl, a.n, 100 + a.n), { fl, n });
      ok(!r.nan, `${fl} n=${n}: NaN samples`);
      ok(r.peak <= 0.35, `${fl} n=${n}: peak ${r.peak.toFixed(3)} is over the loudest existing pop (0.35)`);
      ok(r.peak >= 0.08, `${fl} n=${n}: peak ${r.peak.toFixed(3)} is too quiet to hear (min 0.08)`);
      ok(r.dur50 <= 0.25, `${fl} n=${n}: ${f1(r.dur50 * 1000)} ms to -50 dB (max 250)`);
      ok(r.hf <= 0.03, `${fl} n=${n}: ${f1(r.hf * 100)}% of the energy above 7 kHz (max 3%)`);
      ok(r.bad === 0, `${fl} n=${n}: a saw or a hard square`);
      ok(r.atkMin >= 0.002 && r.atkMax <= 0.012, `${fl} n=${n}: attack ${r.atkMin}..${r.atkMax} s is out of 2 to 12 ms`);
      ok(r.longest <= 0.23, `${fl} n=${n}: a note decays over ${f1(r.longest * 1000)} ms (max 230)`);
      pk = Math.max(pk, r.peak); dur = Math.max(dur, r.dur50); hf = Math.max(hf, r.hf); longest = Math.max(longest, r.longest);
    }
    audio[fl] = (await page.evaluate((fl) => window.__snd(fl, 6, 31), fl)).samples;
    console.log(fl.padEnd(14) + ` peak ${pk.toFixed(3)}  to -50 dB ${f1(dur * 1000)} ms  >7kHz ${f1(hf * 100)}%  longest note ${f1(longest * 1000)} ms`);
  }
  const classic = (await page.evaluate(() => window.__snd(null, 6, 31))).samples;
  const diff = (a, b) => { let s = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) s += (a[i] - b[i]) * (a[i] - b[i]); return Math.sqrt(s / Math.min(a.length, b.length)); };
  const keys = Object.keys(audio);
  keys.forEach((k) => ok(diff(audio[k], classic) > 1e-4, `sound texture "${k}" is the classic pop`));
  for (let a = 0; a < keys.length; a++) for (let b = a + 1; b < keys.length; b++) ok(diff(audio[keys[a]], audio[keys[b]]) > 1e-4, `sound textures "${keys[a]}" and "${keys[b]}" sound the same`);

  /* ---------- 6. badges ---------- */
  console.log('\n== badges ==');
  const badges = await page.evaluate((ids) => ids.map((id) => { const it = BR.itemById[id]; return { id, sizes: [36, 56, 72, 120].map((s) => BR.Badge.html(it, null, { size: s, still: s < 100 })), locked: BR.Badge.html(it, null, { size: 56, locked: true, still: true }) }; }), POPS);
  badges.forEach((b) => {
    b.sizes.forEach((h, i) => ok(/class="s4b"/.test(h), `${b.id}: the badge at ${[36, 56, 72, 120][i]} px is not its own art`));
    ok(!/<(script|image|foreignObject)|href=|url\(http/i.test(b.sizes[3]), `${b.id}: the badge pulls something in from outside`);
    ok(/s4b/.test(b.locked), `${b.id}: the locked badge lost its art`);
  });
  const art = badges.map((b) => b.sizes[3].replace(/style="--rc[^"]*"/, '').replace(/class="bdg[^"]*"/, ''));
  for (let a = 0; a < art.length; a++) for (let b = a + 1; b < art.length; b++) ok(art[a] !== art[b], `${badges[a].id} and ${badges[b].id} have the same badge`);
  console.log(badges.length + ' badges are their own art and differ from each other');

  const real = errors.filter((e) => !/Failed to load resource/.test(e));
  ok(real.length === 0, 'console errors', real);
  console.log(`\n${problems ? problems + ' PROBLEMS' : 'u5 pops ok'} (${f1((Date.now() - t0) / 1000)} s)`);
  await browser.close();
  process.exit(problems ? 1 : 0);
})();
