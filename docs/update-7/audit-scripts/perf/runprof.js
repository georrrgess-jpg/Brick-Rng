// A run, phase by phase, at RATE: idle, six biggest pops (with tap latency from the Event Timing API), a Rush start, a stage wipe,
// the Last Spark and its save, and the results screen. Prints frame stats per phase, the longest frames' contents, main-thread
// totals and the JS that ran. Loadout: LOADOUT=default|spire|galaxy|potion|aurora|isles|alchemy|tower or SKIN/POP/BOARD/FUSE/SHINE/HAT.
// PM=1 Performance mode, PERF=auto|high|low, NOTRACE=1 frames only, MODE=daily|rush.
const L = require('./lib');
const PRESETS = {
  default: {},
  spire: { skin: 'f_sigil', pop: 'b_constellation', board: 'a_tower', fuse: 'u_moonrise', hat: 'h_wizard' },
  galaxy: { skin: 'f_galaxy' },
  potion: { skin: 'f_potion', shine: 'prism' },
  aurora: { skin: 'f_aurora', shine: 'holo' },
  isles: { board: 'a_isles', skin: 'f_hourglass', pop: 'b_sandfall' },
  alchemy: { skin: 'f_potion', pop: 'b_goldleaf', board: 'a_alchemy', fuse: 'u_elixir' },
  tower: { board: 'a_tower' },
};
(async () => {
  const name = process.env.LOADOUT || 'default';
  const o = Object.assign({}, PRESETS[name] || {}, ...['skin', 'pop', 'board', 'fuse', 'shine', 'hat'].filter((k) => process.env[k.toUpperCase()]).map((k) => ({ [k]: process.env[k.toUpperCase()] })));
  o.pm = process.env.PM === '1'; o.perf = process.env.PERF || 'high';
  const { browser, page, cdp, errors } = await L.launch();
  await L.setup(page, o);
  await page.evaluate(() => { window.__ev = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (/pointer|click/.test(e.name)) window.__ev.push({ name: e.name, start: e.startTime, dur: e.duration, delay: e.processingStart - e.startTime, proc: e.processingEnd - e.processingStart }); })).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch (e) { /* no Event Timing */ } });
  await L.startRun(page, process.env.MODE || 'daily');
  await L.throttle(cdp);
  await page.evaluate(() => { window.__phase = 'idle'; });
  const doTrace = !process.env.NOTRACE;
  const body = async () => {
    await L.startFrames(page, 'window.__phase');
    await page.waitForTimeout(1500);
    const sizes = [];
    await page.evaluate(() => { window.__phase = 'pop'; });
    for (let i = 0; i < 6; i++) { const a = await L.bestTap(page); sizes.push(a.n); await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(1400); }
    // Rush start: the next pop fills the meter
    await page.evaluate(() => { window.__phase = 'rush'; const e = BR.Run.engine; e.rush.meter = 99.5; e.rush.lastPop = e.time; });
    { const a = await L.bestTap(page); await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(1800); }
    { const a = await L.bestTap(page); await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(1400); }
    // stage wipe: the next pop clears the stage
    await page.evaluate(() => { window.__phase = 'stage'; const e = BR.Run.engine; e.rush.active = false; e.rush.left = 0; e.stageScore = Math.max(e.stageScore, e.goal - 5); });
    { const a = await L.bestTap(page); await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(2600); }
    // Last Spark: the fuse runs out, then a pop of 4+ saves it
    await page.evaluate(() => { window.__phase = 'spark'; const e = BR.Run.engine; e.rush.active = false; e.freeze = 0; e.fuse = 0.02; });
    await page.waitForTimeout(1500);
    { const a = await page.evaluate(() => { const e = BR.Run.engine; let b = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!b || p.cells.length > b.n)) b = { r, c, n: p.cells.length }; } const pt = BR.Run.view.pagePoint(b.r, b.c); return { x: pt.x, y: pt.y }; }); await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(1400); }
    // the end: fuse out with the spark used, results
    await page.evaluate(() => { window.__phase = 'end'; const e = BR.Run.engine; e.sparkUsed = true; e.rush.active = false; e.freeze = 0; e.fuse = 0.02; });
    await page.waitForFunction(() => BR.Run.resultsEl, null, { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { window.__phase = 'results'; });
    await page.waitForTimeout(3000);
    return { g: await L.stopFrames(page), sizes };
  };
  let r, ev = null;
  if (doTrace) ({ r, ev } = await L.trace(browser, page, body)); else r = await body();
  const lat = await page.evaluate(() => window.__ev);
  console.log(`LOADOUT ${name} ${JSON.stringify(o)} RATE ${L.RATE} | pop sizes ${r.sizes.join(',')}`);
  const phases = {}; r.g.g.forEach(([s, e, ph]) => { (phases[ph] = phases[ph] || []).push(e - s); });
  for (const [ph, a] of Object.entries(phases)) console.log('  ', ph.padEnd(8), L.fmtS(L.stats(a)));
  const ups = lat.filter((x) => x.name === 'pointerup');
  if (ups.length) console.log('   tap (pointerup -> next paint, Event Timing):', ups.map((x) => x.dur.toFixed(0)).join(', '), '| input delay', ups.map((x) => x.delay.toFixed(0)).join(','), '| handlers', ups.map((x) => x.proc.toFixed(0)).join(','));
  if (ev) {
    const by = L.totals(ev); for (const [t, m] of Object.entries(by)) if (/CrRendererMain/.test(t)) console.log('   ', t.padEnd(24), L.top(m, 9));
    const pc = L.phaseCpu(ev, r.g); for (const [ph, o] of Object.entries(pc)) console.log('   CPU', ph.padEnd(8), L.fmtPh(o));
    for (const ph of ['pop', 'rush', 'stage', 'spark', 'end', 'results']) L.longFrames(ev, r.g, ph === 'pop' ? 3 : 1, (x) => x[2] === ph).forEach((x) => console.log('    ', x));
  }
  console.log('errors', errors.join(' | ') || 'none');
  await browser.close();
})();
