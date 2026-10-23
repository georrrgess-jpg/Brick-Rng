// The five chest openings at one size: the chest ready to hold, the Golden picker before and after a pick, the hold half way,
// the reel, and the reveal card with its buttons. Holds use real touch events (CDP), so the hold ring sees a finger.
// Usage: node chests.js <sizeKey> [mode] [dsf]   mode: '' | insets
const { launch, player, audit, wait, SIZES, INSETS, SHOTS, OUT, path, fs } = require('./lib');
const [KEY = 's393', MODE = '', DSF = '2'] = process.argv.slice(2);
const [W, H] = SIZES[KEY];
const land = W > H;
const tag = KEY + (MODE ? '-' + MODE : '');
const touch = (page, type, x, y) => page.__cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
(async () => {
  const ins = MODE === 'insets' ? (land ? INSETS.land : INSETS.port) : [0, 0, 0, 0];
  const { browser, page, errors } = await launch({ width: W, height: H, dsf: +DSF, insets: MODE === 'insets' ? ins : null });
  await player(page, { coins: 9000, items: 2, chests: { brick: 1, pop: 1, board: 1, fuse: 1, golden: 2 } });
  const found = {};
  const shot = async (n) => { found[n] = await audit(page, ins); await page.screenshot({ path: path.join(SHOTS, `chest-${tag}-${n}.png`) }); };
  for (const id of ['brick', 'pop', 'board', 'fuse', 'golden']) {
    await page.evaluate(() => BR.Router.go('shop')); await wait(page, 600);
    await page.evaluate((id) => BR.App.openChest(id), id);
    if (id === 'golden') {
      await page.waitForSelector('.op-picker button', { timeout: 8000 }); await wait(page, 1900);
      await shot(id + '-0-pick');
      found.picker = await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }; return { picker: r('.op-picker'), chest: r('.op-chest'), hold: r('.hold'), odds: r('.op-odds'), sub: r('[data-sub]'), btn: [...document.querySelectorAll('.op-picker button')].map((b) => `${Math.round(b.offsetWidth)}x${Math.round(b.offsetHeight)}`) }; });
      const b = await page.locator('.op-picker button[data-type="board"]').boundingBox();
      await touch(page, 'touchStart', b.x + b.width / 2, b.y + b.height / 2); await touch(page, 'touchEnd', b.x + b.width / 2, b.y + b.height / 2);
      await wait(page, 600);
    }
    await page.waitForSelector('.opening.on .hold:not(.off)', { timeout: 10000 }).catch(() => console.log('hold not ready', id));
    await wait(page, 500);
    await shot(id + '-1-ready');
    found[id + '-geo'] = await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }; return { head: r('.op-head, .opening header'), chest: r('.op-chest'), odds: r('.op-odds'), hold: r('.hold'), label: r('[data-label]'), sub: r('[data-sub]'), vh: innerHeight }; });
    const box = await page.locator('.opening.on .hold').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await touch(page, 'touchStart', cx, cy);
    await page.waitForFunction(() => BR.Openings.current && BR.Openings.current.hold > 0.5, null, { timeout: 6000 }).catch(() => {});
    await shot(id + '-2-hold');
    await page.waitForFunction(() => BR.Openings.current && ['burst', 'spin'].includes(BR.Openings.current.state), null, { timeout: 8000 }).catch(() => console.log('no burst', id));
    await touch(page, 'touchEnd', cx, cy);
    await wait(page, 1500); await shot(id + '-3-spin');
    await wait(page, 300);
    const r = await page.locator('.op-reel').boundingBox().catch(() => null);
    if (r) { await touch(page, 'touchStart', r.x + r.width / 2, r.y + r.height / 2); await touch(page, 'touchEnd', r.x + r.width / 2, r.y + r.height / 2); }
    await page.waitForSelector('.rv.on .rv-actions.on', { timeout: 40000 }).catch(() => console.log('no reveal', id));
    await wait(page, 700);
    await shot(id + '-4-reveal');
    found[id + '-rv'] = await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)]; }; return { banner: r('.rv-banner'), card: r('.rv-card'), info: r('.rv-info'), actions: r('.rv-actions'), vh: innerHeight, rar: (document.querySelector('.rv-rar') || {}).textContent }; });
    await page.evaluate(() => { const o = BR.Openings.current; if (o) o.requestClose(false); }); await wait(page, 1200);
    await page.evaluate(() => { while (BR.Back.depth) BR.Back.closeTop(); }); await wait(page, 400);
  }
  fs.writeFileSync(path.join(OUT, `chest-${tag}.json`), JSON.stringify({ tag, W, H, errors, found }, null, 1));
  console.log(tag, 'errors', errors.length, errors.slice(0, 3).join(' | '));
  await browser.close();
})().catch((e) => { console.error(tag, e); process.exit(1); });
