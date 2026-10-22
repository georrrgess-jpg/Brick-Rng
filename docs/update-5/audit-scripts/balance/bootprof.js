const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const agg = {}; let total = 0; const urlT = {};
  for (let i = 0; i < 3; i++) {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
    await page.goto('file:///home/user/Brick-Rng/index.html');
    await page.waitForFunction(() => window.__app && document.querySelector('.screen.on'), null, { timeout: 30000 });
    const { profile } = await cdp.send('Profiler.stop');
    const self = {}; const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const dt = profile.timeDeltas; const counts = {};
    profile.samples.forEach((id, k) => { counts[id] = (counts[id] || 0) + (dt[k] || 0); });
    for (const [id, us] of Object.entries(counts)) {
      const n = byId.get(+id), cf = n.callFrame; if (cf.functionName === '(idle)' || cf.functionName === '(program)') continue;
      const key = (cf.url.split('/').pop() || cf.functionName) + ':' + (cf.functionName || '(anon)') + ':' + cf.lineNumber;
      agg[key] = (agg[key] || 0) + us / 1000; total += us / 1000;
      const u = cf.url.split('/').pop() || '(native ' + cf.functionName + ')'; urlT[u] = (urlT[u] || 0) + us / 1000;
    }
    await ctx.close();
  }
  console.log('busy ms per boot (unthrottled, avg of 3):', (total / 3).toFixed(0));
  console.log('by file:', Object.entries(urlT).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => k + ' ' + (v / 3).toFixed(1)).join(' | '));
  console.log('top functions:'); Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 22).forEach(([k, v]) => console.log('  ', (v / 3).toFixed(1).padStart(6), k));
  await browser.close();
})();
