const H = require('./h.js');
const S = require('./sheet.js');
const PICK = { common: { skin: 'f_candy', pop: 'b_ember', board: 'a_deepsea', fuse: 'u_rope' }, rare: { skin: 'f_marble', pop: 'b_glass', board: 'a_market', fuse: 'u_neon' }, epic: { skin: 'f_neon', pop: 'b_pixel', board: 'a_orbit', fuse: 'u_ice' }, legendary: { skin: 'f_lava', pop: 'b_bolt', board: 'a_storm', fuse: 'u_plasma' }, mythic: { skin: 'f_nova', pop: 'b_fire', board: 'a_holo', fuse: 'u_dragon' } };
const TYPE = { brick: 'skin', pop: 'pop', board: 'board', fuse: 'fuse' };
async function open(page, chest, rarity, type, full, tag) {
  const t = TYPE[chest] || type;
  const itemId = PICK[rarity][t];
  await page.evaluate(({ itemId, t, rarity }) => {
    const D = BR.Storage.data; D.profile.coins = 99999;
    window.__force = { itemId, type: t, rarity };
    if (!window.__patched) { window.__patched = true; const orig = BR.rollChest; BR.rollChest = function (...a) { const f = window.__force; if (f) return { itemId: f.itemId, type: f.type, rarity: f.rarity, shine: f.shine || 'glossy', seed: 77 }; return orig.apply(this, a); }; }
    // make sure the forced item is not owned
    D.profile.vault = D.profile.vault.filter((v) => v.itemId !== itemId);
    BR.Storage.save();
  }, { itemId, t, rarity });
  if (chest === 'golden') await page.evaluate(() => BR.Progress.addChest('golden', 1));
  await page.evaluate((c) => { BR.App.openChest(c); return 0; }, chest);
  await page.waitForFunction(() => BR.Openings.current && BR.Openings.current.state === 'ready', null, { timeout: 15000 });
  const items = [];
  const snap = async (l) => items.push([`${tag} ${l}`, await H.shot(page, `ch_${tag}_${l.replace(/\W+/g, '_')}`)]);
  if (chest === 'golden') { if (full) await snap('golden picker'); await page.evaluate((t) => BR.Openings.current.pickType(t), type); }
  await page.waitForTimeout(700);
  if (full) await snap('idle');
  const box = await page.locator('.opening.on .hold').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  if (full) {
    await page.waitForFunction(() => BR.Openings.current.hold > 0.5, null, { timeout: 5000 }); await snap('hold50');
    await page.waitForFunction(() => BR.Openings.current.hold > 0.92, null, { timeout: 5000 }); await snap('hold92');
  }
  await page.waitForFunction(() => BR.Openings.current.state === 'burst', null, { timeout: 5000 });
  await page.mouse.up();
  if (full) { await page.waitForTimeout(120); await snap('burst120'); await page.waitForTimeout(400); await snap('burst520'); }
  await page.waitForFunction(() => BR.Openings.current.state === 'spin', null, { timeout: 8000 });
  if (full) {
    await page.waitForTimeout(250); await snap('reel250');
    await page.waitForTimeout(900); await snap('reel1150');
    await page.waitForTimeout(1500); await snap('reel2650');
  }
  await page.waitForFunction(() => document.querySelector('.reel-host.landed'), null, { timeout: 20000 });
  await snap('landed');
  await page.waitForFunction(() => BR.Openings.current.state === 'reveal', null, { timeout: 8000 });
  const t0 = Date.now();
  for (const ms of [150, 700, 1400, 2400]) { const w = ms - (Date.now() - t0); if (w > 0) await page.waitForTimeout(w); await snap('reveal' + ms); }
  await page.waitForFunction(() => BR.Openings.current.state === 'done', null, { timeout: 8000 });
  await page.waitForTimeout(500); await snap('done');
  await page.evaluate(() => BR.Openings.current.close(false));
  await page.waitForTimeout(700);
  return items;
}
(async () => {
  const L = await H.boot({ dsf: 1 });
  const { page } = L;
  await page.evaluate(() => BR.Router.go('shop', { instant: true }));
  const which = (process.argv[2] || 'full').split(',');
  if (which.includes('full')) {
    for (const [c, r] of [['brick', 'epic'], ['pop', 'legendary'], ['board', 'rare'], ['fuse', 'mythic'], ['golden', 'mythic']]) {
      const items = await open(page, c, r, c === 'golden' ? 'board' : null, true, c);
      console.log(await S.make(`${H.OUT}/sheet_chest_${c}.png`, items, 5, 240, `${c} (${r})`));
    }
  }
  if (which.includes('rar')) {
    const items = [];
    for (const r of ['common', 'rare', 'epic', 'legendary', 'mythic']) items.push(...(await open(page, 'brick', r, null, false, 'brick_' + r)));
    console.log(await S.make(`${H.OUT}/sheet_chest_rarities.png`, items, 6, 210, 'brick chest reveal per rarity'));
  }
  console.log(L.errors);
  await L.browser.close();
})();
