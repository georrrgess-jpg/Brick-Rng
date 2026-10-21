// Shared Playwright helpers. Usage: const { launch } = require('./lib');
const path = require('path');
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');

async function launch({ width = 430, height = 900, mobile = true } = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto(URL);
  await page.waitForFunction(() => window.__brick);
  return { browser, ctx, page, errors };
}
module.exports = { launch, URL };
