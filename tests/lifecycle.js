// Save and resume, reload persistence, Update 1 migration in the real page, and offline play through the service worker.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
let problems = 0; const note = (...a) => { problems++; console.log('PROBLEM', ...a); }; const ok = (c, ...a) => { if (!c) note(...a); };
(async () => {
  const srv = http.createServer((req, res) => {
    const f = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  }).listen(0);
  const base = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'allow' });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });

  // ---- Update 1 save migrates on first launch
  await page.addInitScript(() => { if (!localStorage.getItem('poprush.v3') && !sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('shardfall.v2', JSON.stringify({ v: 2, best: 5400, runs: 9, seenTutorial: true, settings: { sound: false }, profile: { level: 7, xp: 120, shards: 840, geodes: { normal: 2, series: 1 }, vault: [{ uid: 'i1', itemId: 'f_candy', finish: 'gloss', seed: 5, tracker: null }, { uid: 'i2', itemId: 'a_orbit', finish: 'matte', seed: 0, tracker: null }], loadout: { facet: 'i1', burst: 'default', arena: 'i2' }, seq: 3, opened: 4 } })); } });
  await page.goto(base); await page.waitForFunction(() => window.__app);
  const m = await page.evaluate(() => ({ coins: BR.Progress.coins, level: BR.Progress.level, vault: BR.Storage.data.profile.vault.map((v) => v.itemId + ':' + v.shine), loadout: BR.Storage.data.profile.loadout, chests: BR.Storage.data.profile.chests, best: BR.Storage.data.best.chill, passTier: BR.Storage.data.profile.passTier }));
  ok(m.coins === 840 + 300 * 2 + 600 + 200 && m.level === 7, 'migration coins/level', JSON.stringify(m));
  ok(m.vault.includes('f_candy:glossy') && m.vault.includes('a_orbit:plain'), 'migration items', JSON.stringify(m.vault));
  ok(m.passTier === 6, 'migration pass tier', m.passTier);
  console.log('migrated', JSON.stringify({ coins: m.coins, level: m.level, passTier: m.passTier }));

  // ---- start a run, play a few pops, save and leave, reload, resume
  await page.evaluate(() => { BR.Storage.data.settings.sound = false; BR.Storage.data.seenTutorial = true; BR.Storage.data.runs = 5; BR.Storage.data.settings.reduced = true; BR.App.applySettings(); __app.startRun({ mode: 'rush', boosts: {} }); });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy);
  for (let i = 0; i < 4; i++) {
    const a = await page.evaluate(() => { const e = BR.Run.engine; let best = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = e.plan(r, c); if (p && (!best || p.cells.length > best.n)) best = { r, c, n: p.cells.length }; } return BR.Run.view.pagePoint(best.r, best.c); });
    await page.mouse.click(a.x, a.y); await page.waitForFunction(() => !BR.Run.busy); await page.waitForTimeout(150);
  }
  const before = await page.evaluate(() => ({ score: BR.Run.engine.score, stage: BR.Run.engine.stage, grid: BR.Run.engine.board.grid.map((r) => r.map((b) => b.color).join('')).join('/') }));
  await page.click('#btnPause'); await page.waitForTimeout(500);
  await page.locator('.sheet .btn:has-text("Save and leave"), .sheet button:has-text("Save and leave")').first().click(); await page.waitForTimeout(900);
  ok(await page.evaluate(() => BR.Router.current === 'home'), 'save and leave did not go home');
  ok(await page.evaluate(() => !!document.querySelector('[data-act="resume"]')), 'no resume card');
  await page.reload(); await page.waitForFunction(() => window.__app);
  ok(await page.evaluate(() => !!document.querySelector('[data-act="resume"]')), 'resume card missing after reload');
  await page.evaluate(() => { document.querySelector('[data-act="resume"]').click(); });
  await page.waitForFunction(() => BR.Run && BR.Run.clock && !BR.Run.busy, null, { timeout: 12000 }).catch(() => note('resume never started'));
  const after = await page.evaluate(() => ({ score: BR.Run.engine.score, stage: BR.Run.engine.stage, grid: BR.Run.engine.board.grid.map((r) => r.map((b) => b.color).join('')).join('/') }));
  ok(after.score === before.score && after.stage === before.stage && after.grid === before.grid, 'resumed state differs', JSON.stringify(before), JSON.stringify(after));

  // ---- service worker precaches everything and the game opens offline
  await page.evaluate(() => { BR.Run.endRun && BR.Run.endRun('quit'); });
  await page.waitForTimeout(500);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => 1));
  const cached = await page.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks[0]); return (await c.keys()).length; });
  ok(cached >= 30, 'service worker cache too small', cached);
  await ctx.setOffline(true);
  await page.goto(base); await page.waitForFunction(() => window.__app, null, { timeout: 8000 }).catch(() => note('offline load failed'));
  ok(await page.evaluate(() => !!window.BR && !!BR.Openings && document.fonts.check('16px Fredoka')), 'offline app incomplete');
  console.log('cached files', cached);
  console.log('errors', errors);
  console.log('problems', problems);
  await browser.close(); srv.close();
  process.exit(problems || errors.length ? 1 : 0);
})();
