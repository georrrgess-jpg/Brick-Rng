// Records a scripted play session to video so animation can be inspected frame by frame.
const path = require('path');
const fs = require('fs');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const OUT = process.argv[2];
const SCRIPT = process.argv[3] || 'pops';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const dir = path.join(OUT, 'video-' + SCRIPT);
  fs.rmSync(dir, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 820 }, deviceScaleFactor: 1, recordVideo: { dir, size: { width: 430, height: 820 } } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForFunction(() => window.__brick);
  await page.waitForTimeout(500);
  await page.click('#btnPlay');
  await page.waitForTimeout(2000);

  const tapBest = async () => {
    const pt = await page.evaluate(() => { const a = window.__brick; const g = a.engine.bestGroup(); const p = g[Math.floor(g.length / 2)]; const q = a.view.pagePoint(p.r, p.c); return { x: q.x, y: q.y }; });
    await page.mouse.move(pt.x, pt.y); await page.waitForTimeout(350);
    await page.mouse.down(); await page.mouse.up();
  };
  const waitIdle = async () => {
    for (let i = 0; i < 400; i++) {
      const st = await page.evaluate(() => ({ busy: window.__brick.busy, crate: window.__brick.inCrate }));
      if (!st.busy) return;
      if (st.crate) await handleCrate();
      await page.waitForTimeout(100);
    }
    throw new Error('stuck busy');
  };
  let crateSeen = 0;
  const handleCrate = async () => {
    if (!(await page.evaluate(() => !document.getElementById('btnOpenCrate').disabled && document.getElementById('crateStage').classList.contains('on')))) {
      if (await page.evaluate(() => document.getElementById('result').classList.contains('on') && document.getElementById('crate').classList.contains('show'))) {
        await page.waitForTimeout(1500);
        const st = await page.evaluate(() => { const r = document.getElementById('result'); const b = document.getElementById('btnEquip'); const cs = getComputedStyle(r); return { resultOn: r.classList.contains('on'), vis: cs.visibility, op: cs.opacity, crateShow: document.getElementById('crate').classList.contains('show'), rect: JSON.stringify(b.getBoundingClientRect()) }; });
        console.log('equip state', JSON.stringify(st));
        await page.click('#btnEquip', { timeout: 5000 }); crateSeen++;
        await page.waitForFunction(() => !window.__brick.inCrate, null, { timeout: 8000 });
      }
      return;
    }
    await page.waitForTimeout(1200);
    await page.click('#btnOpenCrate');
    await page.waitForTimeout(300);
  };

  if (process.env.FORCE_CORE) await page.evaluate((id) => { window.__brick.engine.rollCrate = () => BR.coreById[id]; }, process.env.FORCE_CORE);
  if (SCRIPT === 'crate') {
    await page.evaluate(() => { const e = window.__brick.engine; e.charge = e.need - 1; });
    await tapBest();
    await page.waitForTimeout(500);
    await waitIdle();
    await page.waitForTimeout(1200);
  }
  if (SCRIPT === 'pops') {
    for (let i = 0; i < 4; i++) { await tapBest(); await page.waitForTimeout(150); await waitIdle(); await page.waitForTimeout(250); }
  }
  console.log('errors', errors);
  await ctx.close(); await browser.close();
  console.log(fs.readdirSync(dir));
})();
