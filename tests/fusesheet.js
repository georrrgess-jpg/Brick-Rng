// The fuse, every state, every cosmetic, for review by eye (and as a regression test: no console errors, the state machine reaches
// every state, the particle pool stays under 40, nothing on the fuse uses a filter, backdrop-filter or blend mode).
// Phone: iPhone 15 Pro (393x852 at 3x). Writes PNGs and prints their paths.
//   node tests/fusesheet.js [outdir]                 states sheets (rows = fuses, columns = states) + frame strips
//   node tests/fusesheet.js outdir --only=u_dragon   one fuse (or a few: --only=default,u_vine)
//   --nosheet skips the states sheets; --strips=gain,relit picks frame strips (gain lineblast spark relit rushstart rushend stageup burst); --slow=0.04 sets the slow-motion factor
//   node tests/fusesheet.js outdir --quick           states only, no strips (what the check run uses)
//   node tests/fusesheet.js outdir --size=360x640    another phone (also 844x390 for landscape)
const fs = require('fs');
const path = require('path');
const { launch } = require('./lib');

const OUT = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '/tmp/fusesheet');
const flag = (n) => (process.argv.find((a) => a.startsWith('--' + n + '=')) || '').split('=')[1];
const ONLY = flag('only') ? flag('only').split(',') : null, QUICK = process.argv.includes('--quick'), SLOW = +(flag('slow') || 0.04);
const [W, H] = (flag('size') || '393x852').split('x').map(Number);
fs.mkdirSync(OUT, { recursive: true });

const FUSES = ['default', 'u_rope', 'u_wire', 'u_neon', 'u_ice', 'u_plasma', 'u_candy', 'u_vine', 'u_rod', 'u_phoenix', 'u_dragon'];
// each column: the engine fields to hold, the data-z it must reach, and the face it must show
const STATES = [
  { id: 'calm', hold: 'e.fuse = 27', z: 'calm', x: 'calm' },
  { id: 'watch', hold: 'e.fuse = 13.5', z: 'watch', x: 'watch' },
  { id: 'low', hold: 'e.fuse = 6.8', z: 'low', x: 'worried' },
  { id: 'crit', hold: 'e.fuse = 3.1', z: 'crit', x: 'panic' },
  { id: 'spark', hold: 'e.fuse = 0; e.spark = 1.9; e.sparkUsed = true', z: 'spark', x: 'spark' },
  { id: 'frozen', hold: 'e.fuse = 17; e.rush.active = true; e.rush.left = 5.5; e.rush.meter = 100', z: 'frozen', x: 'cool' },
  { id: 'hold', hold: 'e.fuse = e.fuseMax; e.freeze = 1', z: 'hold', x: 'glad' },
];

// time dilation: the game's clock (performance.now and the rAF timestamps) runs at window.__scale, so a 350ms flight can be photographed
const SLOWMO = () => {
  let scale = 1, vt = 0, last = performance.now();
  const real = performance.now.bind(performance);
  const nowV = () => { const r = real(); vt += (r - last) * scale; last = r; return vt; };
  performance.now = nowV;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(nowV()));
  window.__scale = (k) => { nowV(); scale = k; };
  window.__vnow = () => nowV();
};

(async () => {
  let problems = 0;
  const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };
  const { browser, ctx, page, errors } = await launch({ width: W, height: H, dsf: 3, setup: SLOWMO });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Animation.enable');
  const rate = async (k) => { await cdp.send('Animation.setPlaybackRate', { playbackRate: k }); await page.evaluate((k) => window.__scale(k), k); };
  await page.evaluate(() => { const D = BR.Storage.data; D.seenTutorial = true; D.runs = 8; D.settings.sound = false; D.settings.music = false; D.settings.haptics = false; D.settings.perf = 'high'; BR.App.applySettings(); });

  const equip = (id) => page.evaluate((id) => {
    const P = BR.Progress;
    if (id === 'default') P.equip('default', 'fuse'); else { const inst = BR.Storage.data.profile.vault.find((v) => v.itemId === id) || P.keep({ itemId: id, shine: 'plain', seed: 5, counter: null }); P.equip(inst.uid, 'fuse'); }
    BR.Skins.apply();
    if (BR.Router.current === 'run') { BR.Run.over = true; BR.Run.token++; BR.Router.go('home', { instant: true }); }
    __app.startRun({ mode: 'rush', boosts: {} });
  }, id);
  const ready = () => page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 15000 });
  // hold the engine in a state: re-apply it every 25ms (the fuse keeps burning between writes, which is fine)
  const hold = (src) => page.evaluate((src) => {
    clearInterval(window.__hold);
    const set = () => { const e = BR.Run.engine; if (!e || e.over) return; e.rush.active = false; e.freeze = 0; e.spark = 0; new Function('e', src)(e); };
    set(); window.__hold = setInterval(set, 25);
  }, src);
  const release = () => page.evaluate(() => clearInterval(window.__hold));
  const rect = () => page.evaluate(() => { const r = document.getElementById('fuse').getBoundingClientRect(); return { x: 0, y: Math.max(0, Math.round(r.top - 18)), width: window.innerWidth, height: Math.round(r.height + 36) }; });
  const names = await page.evaluate(() => Object.fromEntries(BR.ITEMS.filter((i) => i.type === 'fuse').map((i) => [i.id, i.name]).concat([['default', BR.DEFAULTS.fuse.name]])));
  const list = process.argv.includes('--nosheet') ? [] : ONLY ? FUSES.filter((f) => ONLY.includes(f)) : FUSES;

  /* ---- 1. every fuse in every state ---- */
  const cells = {};
  for (const id of list) {
    await equip(id); await ready();
    for (const st of STATES) {
      await hold(st.hold);
      await page.waitForTimeout(st.id === 'frozen' ? 1000 : st.id === 'spark' ? 600 : 550);
      const info = await page.evaluate(() => { const d = BR.Fuse.debug(); const f = document.getElementById('fuse'); return Object.assign(d, { z2: f.dataset.z, x2: document.getElementById('bomb').dataset.x, n: BR.Fuse.parts.live }); });
      ok(info.z === st.z && info.z2 === st.z, id, st.id, 'state is', info.z, 'expected', st.z);
      ok(info.x2 === st.x, id, st.id, 'face is', info.x2, 'expected', st.x);
      ok(info.n <= 40, id, st.id, 'particles', info.n);
      const file = `${OUT}/cell-${id}-${st.id}.png`;
      await page.screenshot({ path: file, clip: await rect() });
      (cells[id] = cells[id] || {})[st.id] = file;
    }
    // nothing on the fuse animates a filter, a backdrop filter or a blend mode
    const bad = await page.evaluate(() => Array.from(document.querySelectorAll('#fuse, #fuse *')).filter((el) => { const c = getComputedStyle(el); return (c.filter && c.filter !== 'none') || (c.backdropFilter && c.backdropFilter !== 'none') || (c.mixBlendMode && c.mixBlendMode !== 'normal'); }).map((el) => el.className));
    ok(bad.length === 0, id, 'filter / blend on', bad.slice(0, 4));
    await release();
  }
  // contact sheets: rows = fuses, columns = states (two sheets so each cell stays readable)
  const sheets = [['sheet-a', ['calm', 'watch', 'low', 'crit']], ['sheet-b', ['spark', 'frozen', 'hold']]];
  const sp = await browser.newPage({ viewport: { width: 1400, height: 800 }, deviceScaleFactor: 1 });
  for (const [name, cols] of list.length ? sheets : []) {
    const html = `<body style="margin:0;background:#120c22;color:#cfc6ee;font:600 13px sans-serif"><table style="border-collapse:collapse"><tr><td></td>${cols.map((c) => `<td style="padding:4px 6px">${c}</td>`).join('')}</tr>${list.map((id) => `<tr><td style="padding:2px 6px;white-space:nowrap">${names[id]}</td>${cols.map((c) => `<td style="padding:2px"><img src="file://${cells[id][c]}" width="${cols.length > 3 ? 450 : 590}"></td>`).join('')}</tr>`).join('')}</table></body>`;
    fs.writeFileSync(`${OUT}/${name}.html`, html); await sp.goto('file://' + `${OUT}/${name}.html`); await sp.waitForTimeout(300);
    await sp.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); fs.unlinkSync(`${OUT}/${name}.html`);
    console.log('wrote', `${OUT}/${name}.png`);
  }
  await sp.close();

  /* ---- 1b. Reduce Motion and low-end phones: no particles, no running animations, but the readout still changes color and icon and the bomb still changes expression ---- */
  if (list.length) {
    const lookAt = (st) => page.evaluate(() => {
      const f = document.getElementById('fuse'), num = f.querySelector('.fz-num'), icon = Array.from(f.querySelectorAll('.fz-ico')).find((i) => getComputedStyle(i).display !== 'none');
      const running = Array.from(f.querySelectorAll('*')).filter((el) => el.getAnimations().some((a) => a.playState === 'running' && a.effect && a.effect.getTiming().iterations === Infinity)).map((el) => el.className.toString().slice(0, 30));
      return { z: f.dataset.z, x: document.getElementById('bomb').dataset.x, color: getComputedStyle(num).color, icon: icon ? icon.getAttribute('class') : '', live: BR.Fuse.parts.live, running };
    });
    for (const mode of ['reduced', 'low-end']) {
      await page.evaluate((mode) => { const s = BR.Storage.data.settings; s.reduced = mode === 'reduced'; s.perf = mode === 'low-end' ? 'low' : 'high'; BR.App.applySettings(); }, mode);
      await equip(list.includes('default') ? 'default' : list[0]); await ready();
      const seen = {};
      for (const st of STATES.filter((s) => ['calm', 'low', 'crit', 'frozen'].includes(s.id))) {
        await hold(st.hold); await page.waitForTimeout(700);
        seen[st.id] = await lookAt(st);
        ok(seen[st.id].live === 0, mode, st.id, 'particles', seen[st.id].live);
        ok(seen[st.id].running.length === 0, mode, st.id, 'animations still running on the fuse', seen[st.id].running.slice(0, 4));
        ok(seen[st.id].z === st.z && seen[st.id].x === st.x, mode, st.id, 'state/face', seen[st.id].z, seen[st.id].x);
        await page.screenshot({ path: `${OUT}/cell-${mode}-${st.id}.png`, clip: await rect() });
      }
      ok(new Set(Object.values(seen).map((v) => v.color)).size >= 3, mode, 'readout color does not change with the state', Object.values(seen).map((v) => v.color));
      ok(new Set(Object.values(seen).map((v) => v.icon)).size >= 3, mode, 'readout icon does not change with the state', Object.values(seen).map((v) => v.icon));
      ok(new Set(Object.values(seen).map((v) => v.x)).size === 4, mode, 'the face does not change with the state');
      await release();
    }
    await page.evaluate(() => { const s = BR.Storage.data.settings; s.reduced = false; s.perf = 'high'; BR.App.applySettings(); });
  }

  /* ---- 2. frame strips (slow motion): the chip flight, Last Spark and the relight, Rush start and end, stage-up, a Fuse brick ---- */
  if (!QUICK) {
    const WANT = flag('strips') ? flag('strips').split(',') : null;
    const strip = async (name, frames, region, every, cols) => {
      // frames photographed at least `every` ms of game time apart (the game's clock runs slowed, see rate(); a screenshot takes a
      // while, so each frame is labelled with the game time it was really taken at)
      const shots = [], times = [], zs = [];
      let first = null;
      for (let i = 0; i < frames; i++) {
        const t = await page.evaluate(() => window.__vnow());
        zs.push(await page.evaluate(() => BR.Fuse.z + '/' + BR.Fuse.debug().x));
        if (first == null) first = t;
        const f = `${OUT}/strip-${name}-${String(i).padStart(2, '0')}.png`;
        await page.screenshot({ path: f, clip: region });
        shots.push(f); times.push(Math.round(t - first));
        await page.waitForFunction(([t0, d]) => window.__vnow() - t0 >= d, [t, every], { timeout: 90000, polling: 20 });
      }
      const sp2 = await browser.newPage({ viewport: { width: 1400, height: 800 }, deviceScaleFactor: 1 });
      const w = Math.floor(1390 / cols);
      const hf = `${OUT}/strip-${name}.html`;
      fs.writeFileSync(hf, `<body style="margin:0;background:#120c22;display:flex;flex-wrap:wrap;gap:3px;padding:3px">${shots.map((s, i) => `<div style="position:relative"><img src="file://${s}" width="${w}" style="display:block"><b style="position:absolute;left:4px;top:2px;color:#fff;font:700 12px sans-serif;text-shadow:0 1px 2px #000">${times[i]}ms ${zs[i]}</b></div>`).join('')}</body>`);
      await sp2.goto('file://' + hf); await sp2.waitForTimeout(300);
      await sp2.screenshot({ path: `${OUT}/strip-${name}.png`, fullPage: true });
      await sp2.close();
      shots.forEach((s) => fs.unlinkSync(s)); fs.unlinkSync(hf);
      console.log('wrote', `${OUT}/strip-${name}.png`);
    };
    const bigPop = () => page.evaluate(() => { const e = BR.Run.engine; let best = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!best || p.cells.length > best.n)) best = { r, c, n: p.cells.length }; } return best && BR.Run.view.pagePoint(best.r, best.c); });
    const popNow = async () => { const a = await bigPop(); await page.mouse.click(a.x, a.y); };
    const calm = (fuse) => page.evaluate((fuse) => { const e = BR.Run.engine; e.rush.active = false; e.rush.meter = 0; e.rush.left = 0; e.freeze = 0; e.spark = 0; e.stageScore = 0; e.streak = 0; e.fuse = fuse; }, fuse);
    const fr = await rect();
    const tall = { x: 0, y: fr.y, width: fr.width, height: 340 };
    const scenarios = [
      ['gain', async () => { await calm(12); await page.waitForTimeout(400); await rate(SLOW); await popNow(); return [tall, 10, 55, 4]; }],
      ['lineblast', async () => {
        await calm(10);
        await page.evaluate(() => { const e = BR.Run.engine, B = e.board; for (let c = 0; c < 8; c++) B.grid[3][c].color = 1; B.version++; BR.Run.view.syncTo(B); });
        await page.waitForTimeout(500);
        const pt = await page.evaluate(() => BR.Run.view.pagePoint(3, 3));
        await rate(SLOW); await page.mouse.click(pt.x, pt.y); return [tall, 10, 70, 4];
      }],
      ['spark', async () => { await calm(0); await hold('e.fuse = 0; e.spark = 99; e.sparkUsed = true'); await page.waitForTimeout(400); await rate(SLOW); return [fr, 6, 140, 2]; }],
      ['relit', async () => { await hold('e.fuse = 0; e.spark = 99; e.sparkUsed = true'); await page.waitForTimeout(500); await release(); await page.evaluate(() => { const e = BR.Run.engine; e.spark = 2.4; e.fuse = 0; e.rush.meter = 0; e.streak = 0; }); await rate(SLOW); await popNow(); return [fr, 10, 60, 2]; }],
      ['rushstart', async () => { await calm(20); await page.evaluate(() => { BR.Run.engine.rush.meter = 99; }); await page.waitForTimeout(300); await rate(SLOW); await popNow(); return [fr, 10, 85, 2]; }],
      ['rushend', async () => { await rate(1); await page.evaluate(() => { const e = BR.Run.engine; e.rush.active = true; e.rush.left = 5; e.rush.meter = 100; e.fuse = 18; e.freeze = 0; }); await page.waitForTimeout(1300); await page.evaluate(() => { BR.Run.engine.rush.left = 0.04; }); await rate(SLOW); return [fr, 10, 70, 2]; }],
      ['stageup', async () => { await calm(7); await page.evaluate(() => { const e = BR.Run.engine; e.stageScore = e.goal - 1; }); await page.waitForTimeout(300); await rate(SLOW); await popNow(); return [fr, 10, 85, 2]; }],
      ['burst', async () => {
        await calm(20);
        await page.evaluate(() => { const e = BR.Run.engine, B = e.board; e.stage = 5; let best = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!best || p.cells.length > best.cells.length)) best = p; } const inG = new Set(best.cells.map((q) => q.r * 8 + q.c)); outer: for (let r = 7; r >= 0; r--) for (let c = 7; c >= 0; c--) if (B.grid[r][c] && !inG.has(r * 8 + c)) { B.grid[r][c].fb = 1; break outer; } B.version++; BR.Run.view.syncTo(B); });
        await page.waitForTimeout(400); await rate(SLOW); await popNow(); return [fr, 10, 70, 2];
      }],
    ];
    for (const id of (ONLY || ['default', 'u_candy', 'u_dragon'])) {
      await equip(id); await ready(); await release();
      for (const [name, run] of scenarios) {
        if (WANT && !WANT.includes(name)) continue;
        await rate(1);
        const [region, frames, every, cols] = await run();
        await strip(`${name}-${id}`, frames, region, every, cols);
        await rate(1); await release(); await page.waitForTimeout(1500);
        await page.evaluate(() => { const e = BR.Run.engine; if (e && e.stage > 1 && e.stage < 3) e.stage = 1; });
      }
    }
  }

  await browser.close();
  const real = errors.filter((e) => !/Failed to load resource/.test(e));
  ok(real.length === 0, 'console errors', real.slice(0, 5));
  console.log(problems ? problems + ' PROBLEMS' : 'fusesheet ok');
  process.exit(problems ? 1 : 0);
})();
