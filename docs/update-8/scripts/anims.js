const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('file:///home/user/Brick-Rng/index.html'); await page.waitForFunction(() => window.__app, null, { timeout: 15000 });
  await page.evaluate((pm) => { BR.Coach.markAllSeen(); const st = BR.Storage.data; st.settings.haptics = false; st.runs = 12; st.settings.perf = 'high'; st.settings.perfMode = !!pm; BR.App.applySettings(); }, process.env.PM);
  if (process.env.WHERE === 'home') { await page.waitForTimeout(2500); }
  else { await page.evaluate(() => { __app.startRun({ mode: 'daily', boosts: {} }); }); await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 }); await page.waitForTimeout(6000); }
  const list = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').map((a) => { const t = a.effect && a.effect.target; const n = t ? t.tagName.toLowerCase() + (t.id ? '#' + t.id : '') + '.' + String(t.className.baseVal != null ? t.className.baseVal : t.className).split(' ').slice(0, 3).join('.') + (a.effect.pseudoElement || '') : '?'; const kf = a.effect.getKeyframes ? [...new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((x) => !/offset|easing|composite|computedOffset/.test(x))))].join(',') : ''; return (a.animationName || 'waapi') + ' [' + kf + '] ' + n; }));
  const c = {}; list.forEach((k) => { c[k] = (c[k] || 0) + 1; });
  console.log('running', list.length); Object.entries(c).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(String(v).padStart(3), k.slice(0, 170)));
  await browser.close();
})();
