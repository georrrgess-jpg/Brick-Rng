// Contact sheet: node sheet.js out.png cols cellW "label|path" ...   (or require and call make())
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
async function make(out, items, cols = 4, cellW = 300, title = '') {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: cols * (cellW + 8) + 8, height: 200 } });
  const html = `<html><body style="margin:0;background:#222;font:12px sans-serif;color:#fff">${title ? `<div style="padding:4px 8px;font-size:14px">${title}</div>` : ''}<div style="display:grid;grid-template-columns:repeat(${cols},${cellW}px);gap:8px;padding:8px">${items.map(([l, p]) => `<div><img src="file://${p}" style="width:${cellW}px;display:block"><div style="padding:2px 0">${l}</div></div>`).join('')}</div></body></html>`;
  fs.writeFileSync(require('os').tmpdir() + '/_u5_sheet.html', html);
  await page.goto('file://' + require('os').tmpdir() + '/_u5_sheet.html');
  await page.waitForLoadState('load');
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  return out;
}
module.exports = { make };
if (require.main === module) { const [out, cols, w, ...rest] = process.argv.slice(2); make(out, rest.map((s) => s.split('|')), +cols, +w).then((p) => console.log(p)); }
