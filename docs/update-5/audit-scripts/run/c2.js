const H = require('./h.js');
const S = require('./sheet.js');
(async () => {
  const L = await H.boot({ dsf: 1 });
  const { page } = L;
  const items = [];
  // own every skin -> Brick Chest complete; own every Epic+ item of every type -> Golden complete
  await page.evaluate(() => { const P = BR.Progress; BR.DROP_ITEMS.filter((x) => x.type === 'skin' || BR.rarityById[x.rarity].level >= 3).forEach((x) => P.keep({ itemId: x.id, shine: 'plain', seed: 1 })); BR.Storage.data.profile.coins = 5000; BR.Storage.save(); BR.Router.go('shop', { instant: true }); });
  await page.waitForTimeout(800);
  items.push(['shop complete', await H.shot(page, 'cc_shop')]);
  await page.evaluate(() => window.scrollTo(0, 0));
  const st = await page.evaluate(() => ({ brick: BR.Progress.chestStatus('brick'), golden: BR.Progress.chestStatus('golden'), canB: BR.Progress.canOpen('brick') }));
  console.log(JSON.stringify(st));
  // open the complete Brick Chest screen directly (deep link / results "Chests" path)
  await page.evaluate(() => { BR.App.openChest('brick'); return 0; });
  await page.waitForFunction(() => BR.Openings.current && BR.Openings.current.state === 'ready', null, { timeout: 15000 });
  await page.waitForTimeout(600);
  items.push(['brick complete: opening screen', await H.shot(page, 'cc_brick_open')]);
  const foot = await page.evaluate(() => ({ label: document.querySelector('[data-label]').textContent, sub: document.querySelector('[data-sub]').textContent, off: document.querySelector('.hold').classList.contains('off') }));
  console.log('brick complete foot', foot);
  const box = await page.locator('.opening.on .hold').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.waitForTimeout(1600); await page.mouse.up(); await page.waitForTimeout(200);
  items.push(['brick complete: after hold', await H.shot(page, 'cc_brick_hold')]);
  console.log('state', await page.evaluate(() => ({ s: BR.Openings.current.state, coins: BR.Progress.coins, toasts: Array.from(document.querySelectorAll('#toasts *')).map((t) => t.textContent).join('|') })));
  await page.evaluate(() => BR.Openings.current.close(false)); await page.waitForTimeout(600);
  // golden fallback: grant a golden chest when the golden set is complete
  const paid = await page.evaluate(() => { const c0 = BR.Progress.coins; const r = BR.Progress.addChest('golden', 1); return { r, delta: BR.Progress.coins - c0, have: BR.Progress.chestCount('golden') }; });
  console.log('golden fallback', paid);
  await page.evaluate(() => { BR.Storage.data.profile.chests.golden = 1; BR.App.openChest('golden'); return 0; });
  await page.waitForFunction(() => BR.Openings.current && BR.Openings.current.state === 'ready', null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  items.push(['golden complete: opening screen (forced count)', await H.shot(page, 'cc_golden_open')]);
  console.log('golden foot', await page.evaluate(() => ({ label: document.querySelector('.opening.on [data-label]').textContent, sub: document.querySelector('.opening.on [data-sub]').textContent })));
  console.log(L.errors);
  await L.browser.close();
  console.log(await S.make(`${H.OUT}/sheet_chest_complete.png`, items, 4, 280, 'complete chests'));
})();
