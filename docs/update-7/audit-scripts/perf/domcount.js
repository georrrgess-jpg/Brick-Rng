// DOM nodes by region on Home and in an idle run (Spire set), to see what a phone keeps alive.
const L = require('./lib');
(async () => {
  const { page, browser } = await L.launch();
  const count = () => page.evaluate(() => { const out = { all: document.getElementsByTagName('*').length }; ['bg', 'screens', 'tabbar', 'layer-sheets', 'layer-overlays', 'layer-opening', 'sprite', 'fx'].forEach((id) => { const e = document.getElementById(id); if (e) out[id] = e.getElementsByTagName('*').length; }); document.querySelectorAll('#screens > .screen').forEach((s) => { const n = s.getElementsByTagName('*').length; if (n) out[s.id] = n; }); const svgs = document.querySelectorAll('body > svg, svg[style*="display:none"], svg[width="0"]'); out.hiddenSvgDefs = [...svgs].reduce((a, s) => a + s.getElementsByTagName('*').length, 0); out.board = (document.getElementById('board') || { getElementsByTagName: () => [] }).getElementsByTagName('*').length; out.fuse = (document.getElementById('fuse') || { getElementsByTagName: () => [] }).getElementsByTagName('*').length; return out; });
  await L.setup(page, {}); await page.waitForTimeout(1000);
  console.log('home ', JSON.stringify(await count()));
  await L.setup(page, { skin: 'f_sigil', pop: 'b_constellation', board: 'a_tower', fuse: 'u_moonrise', hat: 'h_wizard' });
  await L.startRun(page, 'rush'); await page.waitForTimeout(1500);
  console.log('run  ', JSON.stringify(await count()));
  await browser.close();
})();
