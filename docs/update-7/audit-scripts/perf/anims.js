// Running animations on a screen, grouped by keyframes and target, with whether the compositor can run them alone
// (transform/opacity/filter only) or they need the main thread every frame (anything else: custom properties,
// background-position, box-shadow, width...). Also the trace's compositeFailed reasons.
// env: WHERE=home|shop|collection|run (default home), SKIN/POP/BOARD/FUSE for the run loadout, PM=1
const L = require('./lib');
(async () => {
  const { browser, page, errors } = await L.launch();
  await L.setup(page, { pm: process.env.PM === '1', skin: process.env.SKIN, pop: process.env.POP, board: process.env.BOARD, fuse: process.env.FUSE, shine: process.env.SHINE });
  const where = process.env.WHERE || 'home';
  if (where === 'run' || where === 'rush') {
    await L.startRun(page, process.env.MODE || 'rush');
    const a = await L.bestTap(page); await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(1500);
    if (where === 'rush') { await page.evaluate(() => { const e = BR.Run.engine; if (e.startRush) e.startRush(); else if (BR.Run.rushStart) BR.Run.rushStart(); }); }
    await page.waitForTimeout(2500);
  } else { await page.evaluate((w) => { window.dispatchEvent(new Event('pointerdown')); BR.Router.go(w); }, where); await page.waitForTimeout(2500); }
  const { r, ev } = await L.trace(browser, page, async () => {
    await page.waitForTimeout(1500);
    return page.evaluate(() => {
      const COMP = /^(transform|opacity|filter|translate|rotate|scale|offset|backdropFilter)$/;
      return document.getAnimations().filter((a) => a.playState === 'running').map((a) => {
        const t = a.effect && a.effect.target; const n = t ? t.tagName.toLowerCase() + (t.id ? '#' + t.id : '') + '.' + String(t.className && t.className.baseVal != null ? t.className.baseVal : t.className).split(' ').slice(0, 2).join('.') + (a.effect.pseudoElement || '') : '?';
        const props = a.effect.getKeyframes ? [...new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((x) => !/^(offset|easing|composite|computedOffset)$/.test(x))))] : [];
        const r = t && t.getBoundingClientRect ? t.getBoundingClientRect() : { width: 0, height: 0 };
        return { name: a.animationName || 'waapi', props: props.join(','), main: props.some((p) => !COMP.test(p)), n, area: Math.round(r.width * r.height) };
      });
    });
  }, ['blink.animations', 'devtools.timeline.async']);
  const by = {}; let mainCount = 0, mainArea = 0;
  r.forEach((x) => { const k = (x.main ? 'MAIN ' : 'comp ') + x.name + ' [' + x.props + '] ' + x.n; by[k] = by[k] || { c: 0, area: 0 }; by[k].c++; by[k].area += x.area; if (x.main) { mainCount++; mainArea += x.area; } });
  console.log(where, 'running', r.length, '| main-thread (non-compositable property)', mainCount, 'covering', mainArea, 'css px^2');
  Object.entries(by).sort((a, b) => (b[0].startsWith('MAIN') - a[0].startsWith('MAIN')) || b[1].c - a[1].c).forEach(([k, v]) => console.log(String(v.c).padStart(4), k.slice(0, 150), v.area ? ' area ' + v.area : ''));
  const fail = {}; ev.filter((e) => e.name === 'Animation' && e.args && e.args.data && e.args.data.compositeFailed).forEach((e) => { const d = e.args.data; const k = (d.name || '?') + ' fail=' + d.compositeFailed + ' ' + JSON.stringify(d.unsupportedProperties || ''); fail[k] = (fail[k] || 0) + 1; });
  console.log('compositeFailed (trace):'); Object.entries(fail).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log('   ', v, k));
  console.log('errors', errors.join(' | ') || 'none');
  await browser.close();
})();
