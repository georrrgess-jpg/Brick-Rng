const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('file:///home/user/Brick-Rng/index.html'); await page.waitForFunction(() => window.__app, null, { timeout: 15000 });
  await page.evaluate((perf) => { BR.Coach.markAllSeen(); BR.Storage.data.settings.perf = perf; BR.App.applySettings(); }, process.env.PERF || 'high');
  if (process.env.INJECT) await page.addStyleTag({ content: process.env.INJECT });
  if (process.env.EVAL) await page.evaluate(process.env.EVAL);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('LayerTree.enable');
  let last = null; cdp.on('LayerTree.layerTreeDidChange', (e) => { if (e.layers) last = e.layers; });
  const report = async (label) => {
    await page.waitForTimeout(1200);
    const L = last || [];
    const area = L.reduce((a, l) => a + (l.drawsContent ? l.width * l.height : 0), 0);
    const named = {};
    for (const l of L.filter((x) => x.drawsContent)) {
      let name = '?';
      if (l.backendNodeId) { try { const d = await cdp.send('DOM.describeNode', { backendNodeId: l.backendNodeId }); const n = d.node; const attrs = {}; for (let i = 0; i < (n.attributes || []).length; i += 2) attrs[n.attributes[i]] = n.attributes[i + 1]; name = n.nodeName.toLowerCase() + (attrs.id ? '#' + attrs.id : '') + (attrs.class ? '.' + attrs.class.split(' ').slice(0, 2).join('.') : ''); } catch (e) { name = 'node?'; } }
      else name = '(no node)';
      named[name] = (named[name] || 0) + 1; (globalThis.__big = globalThis.__big || []).push([name, Math.round(l.width) + 'x' + Math.round(l.height), l.width * l.height]);
    }
    console.log(label, 'layers', L.length, 'drawing', L.filter((x) => x.drawsContent).length, 'px (device, M)', (L.reduce((a, l) => a + (l.drawsContent ? l.width * l.height : 0), 0) * 9 / 1e6).toFixed(1), 'area (css px^2 / screen)', (area / (393 * 852)).toFixed(1));
    console.log('    biggest:', (globalThis.__big || []).sort((a, b) => b[2] - a[2]).slice(0, 10).map((x) => x[0] + ' ' + x[1]).join(' | ')); globalThis.__big = [];
    console.log('   ', Object.entries(named).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => v + 'x ' + k).join(' | '));
  };
  await report('home');
  await page.evaluate(() => { __app.startRun({ mode: 'daily', boosts: {} }); });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 });
  await report('run');
  await browser.close();
})();
