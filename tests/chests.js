// Every chest, start to finish: art parts exist, the hold moves the right parts (the fuse chest's needle included),
// the burst throws them away, the reel and reveal follow. Records a video of each opening and cuts a frame sheet so the
// motion can be reviewed by eye.   Usage: OUT=/some/dir node tests/chests.js [chest]
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const OUT = process.env.OUT || path.join(require('os').tmpdir(), 'chests-test');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const EXPECT = {
  brick: ['piece', 'straps', 'leak', 'lid', 'glow', 'body'],
  pop: ['half-l', 'half-r', 'lid', 'glow'],
  board: ['body', 'board', 'glass', 'frost', 'cracks', 'glow'],
  fuse: ['body', 'needle', 'lid', 'glow'],
  golden: ['body', 'leak', 'lid', 'glow', 'glints'],
};
let failed = 0;
const ok = (c, m) => { if (!c) { failed++; console.log('  FAIL', m); } };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  for (const chest of Object.keys(EXPECT)) {
    if (only && only !== chest) continue;
    const dir = path.join(OUT, chest); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, recordVideo: { dir, size: { width: 390, height: 844 } } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.goto(URL);
    await page.waitForFunction(() => window.__app, null, { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => { BR.Coach.markAllSeen(); BR.Storage.data.settings.sound = false; BR.Storage.data.runs = 5; BR.Storage.data.profile.coins = 9000; BR.App.applySettings(); });
    console.log(chest);
    await page.evaluate((c) => { if (c === 'golden') BR.Progress.addChest('golden', 2); BR.App.openChest(c); }, chest);
    if (chest === 'golden') { await page.waitForFunction(() => BR.Openings.current && BR.Openings.current.state === 'ready', null, { timeout: 15000 }); await page.evaluate(() => BR.Openings.current.pickType('skin')); }
    await page.waitForSelector('.opening.on .hold:not(.off)', { timeout: 15000 });
    await page.waitForTimeout(400);
    const probe = () => page.evaluate((c) => {
      const ch = document.querySelector('.op-chest .chest'); const out = { names: {}, rect: {}, op: {} };
      ch.querySelectorAll('[data-p]').forEach((e) => { const n = e.dataset.p; out.names[n] = (out.names[n] || 0) + 1; if (!out.rect[n]) { const r = e.querySelector('svg').getBoundingClientRect(); out.rect[n] = [r.left, r.top, r.width, r.height]; const t = getComputedStyle(e); out.op[n] = +t.opacity; out[n + 'T'] = t.transform; } });
      const w = ch.querySelector('.c-fusewire'); if (w) out.dash = w.style.strokeDasharray;
      const cr = ch.querySelector('.cp-cracks path'); if (cr) out.crack = +cr.style.strokeDashoffset;
      return out;
    }, chest);
    const rest = await probe();
    for (const n of EXPECT[chest]) ok(rest.names[n], `part ${n} exists`);
    if (chest === 'brick') ok(rest.names.piece >= 12, 'brick pieces ' + rest.names.piece);
    // hold about 70% of the way, probe, then let go and check it relaxes
    const box = await page.locator('.hold').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.waitForFunction(() => BR.Openings.current.hold > 0.7, null, { timeout: 5000 });
    const held = await probe();
    const dy = (n) => held.rect[n][1] - rest.rect[n][1];
    if (chest === 'brick' || chest === 'golden') ok(dy('lid') < -2, `${chest} lid lifts under hold (dy ${dy('lid').toFixed(1)})`);
    if (chest === 'brick') ok(held.op.leak > 0.4, 'brick light leaks through the seams ' + held.op.leak);
    if (chest === 'golden') ok(held.op.leak > 0.4, 'golden light leaks ' + held.op.leak);
    if (chest === 'pop') ok(held.dash && held.dash !== rest.dash, 'pop fuse burns down ' + held.dash);
    if (chest === 'board') { ok(held.crack < 99, 'board cracks draw in ' + held.crack); ok(held.op.frost > 0.1, 'board frosts ' + held.op.frost); }
    if (chest === 'fuse') { const m = held.needleT.match(/matrix\(([^,]+),([^,]+)/); const ang = m ? Math.atan2(+m[2], +m[1]) * 180 / Math.PI : -999; ok(ang > -60, 'fuse needle swings round to ' + ang.toFixed(0) + ' deg'); }
    ok(held.op.glow > 0.5, 'glow rises ' + held.op.glow);
    await page.mouse.up();
    await page.waitForFunction(() => BR.Openings.current.hold < 0.25 || BR.Openings.current.state === 'ready', null, { timeout: 5000 });
    // now all the way
    await page.waitForFunction(() => BR.Openings.current.state === 'ready', null, { timeout: 5000 });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.waitForFunction(() => BR.Openings.current.state === 'burst', null, { timeout: 5000 });
    await page.mouse.up();
    const t0 = await page.evaluate(() => performance.now());
    await page.waitForTimeout(950);
    const gone = await probe();
    const moved = (n) => Math.hypot(gone.rect[n][0] - rest.rect[n][0], gone.rect[n][1] - rest.rect[n][1]);
    if (chest !== 'pop' && chest !== 'board') ok(gone.op.lid < 0.2 || moved('lid') > 80, `${chest} lid thrown away`);
    if (chest === 'pop') ok(gone.op['half-l'] < 0.2 && gone.op['half-r'] < 0.2, 'pop halves gone');
    if (chest === 'board') ok(gone.op.glass < 0.2, 'board glass shattered');
    // the spin and the reveal
    await page.waitForSelector('.reel', { timeout: 20000 });
    await page.waitForSelector('.rv.on', { timeout: 40000 });
    await page.waitForTimeout(2500);
    ok(await page.evaluate(() => !!document.querySelector('.rv-actions.on')), 'reveal actions appear');
    ok(await page.evaluate(() => !document.querySelector('.rv-actions [data-a="sell"]')), 'no sell button');
    console.log('  errors:', errors.length ? errors.join(' | ') : 'none');
    ok(errors.length === 0, 'no console errors');
    await ctx.close();
    const vid = fs.readdirSync(dir).find((f) => f.endsWith('.webm'));
    if (vid) {
      // frames: the idle, the hold, the burst at 100 ms steps
      try {
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dir, vid), '-vf', 'fps=6,scale=195:-1,tile=8x6', '-frames:v', '1', path.join(OUT, `${chest}-frames.png`)]);
      } catch (e) { console.log('  ffmpeg failed', e.message.slice(0, 80)); }
    }
  }
  await browser.close();
  console.log(failed ? `${failed} FAILED` : 'chests ok');
  process.exit(failed ? 1 : 0);
})();
