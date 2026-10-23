// Which elements own composited layers in an idle run (by element class), and their device-pixel area. env SKIN/POP/BOARD/FUSE/HAT, PM=1.
const L = require('./lib');
(async () => {
  const { page, cdp, browser } = await L.launch();
  await L.setup(page, { skin: process.env.SKIN, pop: process.env.POP, board: process.env.BOARD, fuse: process.env.FUSE, hat: process.env.HAT, pm: process.env.PM === '1' });
  await L.startRun(page, process.env.MODE || 'rush');
  await cdp.send('DOM.enable'); await cdp.send('DOM.getDocument', { depth: -1 }); await cdp.send('LayerTree.enable');
  let last = null; cdp.on('LayerTree.layerTreeDidChange', (e) => { if (e.layers) last = e.layers; });
  await page.waitForTimeout(2500);
  const by = {};
  for (const l of last || []) {
    let name = '(no node)';
    if (l.backendNodeId) { try { const d = await cdp.send('DOM.describeNode', { backendNodeId: l.backendNodeId }); const n = d.node; const at = {}; for (let i = 0; i < (n.attributes || []).length; i += 2) at[n.attributes[i]] = n.attributes[i + 1]; name = (n.localName || n.nodeName.toLowerCase()) + (at.id ? '#' + at.id : '') + (at.class ? '.' + at.class.split(' ').filter((c) => !/^(b3|on|show)$/.test(c)).slice(0, 2).join('.') : ''); } catch (e) { name = 'node?'; } }
    const k = name + (l.drawsContent ? '' : ' (no paint)'); by[k] = by[k] || { n: 0, px: 0 }; by[k].n++; by[k].px += l.drawsContent ? l.width * l.height * 9 : 0;
  }
  console.log('layers', (last || []).length);
  Object.entries(by).sort((a, b) => b[1].n - a[1].n || b[1].px - a[1].px).slice(0, 18).forEach(([k, v]) => console.log(String(v.n).padStart(4), k.padEnd(48), (v.px / 1e6).toFixed(2), 'M px'));
  await browser.close();
})();
