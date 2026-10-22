// End-to-end menus and chests on a phone viewport: every chest opens, drops are saved, reveal buttons work,
// the reduced-motion path works, Back/Escape behave, a finished set cannot be opened, and a chest never repeats an item.
// Usage: node tests/flow.js
const { launch } = require('./lib');
(async () => {
  const { browser, page, errors } = await launch({ width: 390, height: 844, dsf: 1 });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(1, 4).join(' | ')));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log('CONSOLE', m.text()); });
  let problems = 0;
  const note = (...a) => { problems++; console.log('PROBLEM', ...a); };
  const ok = (c, ...a) => { if (!c) note(...a); };
  await page.evaluate(() => { BR.Storage.data.settings.sound = false; BR.Storage.data.runs = 3; BR.Storage.data.seenTutorial = true; BR.Coach.markAllSeen(); BR.Storage.data.profile.coins = 6000; BR.Progress.addChest('golden', 2); });
  const dom = (sel) => page.evaluate((s) => { const b = document.querySelector(s); if (!b) throw new Error('missing ' + s); b.click(); }, sel);
  const S = () => page.evaluate(() => ({ coins: BR.Progress.coins, vault: BR.Storage.data.profile.vault.length, opened: BR.Storage.data.profile.opened, chests: Object.assign({}, BR.Storage.data.profile.chests) }));

  // menus render and the tab bar switches without errors
  for (const t of ['shop', 'collection', 'missions', 'profile', 'home']) {
    await page.click(`#tabbar .tab[data-tab="${t}"]`, { timeout: 8000 }).catch((e) => note('tab click', t, e.message.split('\n').slice(0, 6).join(' | '))); await page.waitForTimeout(500);
    ok(await page.evaluate((t) => document.getElementById('s-' + t).classList.contains('on'), t), 'tab did not open', t);
  }

  const openOne = async (chest, o = {}) => {
    const before = await S();
    await page.evaluate((c) => { BR.App.openChest(c); }, chest);
    if (chest === 'golden') { await page.waitForSelector('.op-picker button', { timeout: 8000 }); await page.waitForTimeout(1800); await page.click(`.op-picker button[data-type="${o.type || 'pop'}"]`); }
    await page.waitForSelector('.opening.on .hold:not(.off)', { timeout: 8000 }).catch(() => note('hold never ready', chest));
    const box = await page.locator('.hold').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    if (o.reduced) { await page.mouse.down(); await page.mouse.up(); }
    else {
      await page.mouse.down(); await page.waitForTimeout(450); await page.mouse.up(); // early release settles back, costs nothing
      const mid = await S(); ok(mid.coins === before.coins && mid.opened === before.opened, 'early release charged', chest);
      await page.waitForTimeout(700);
      await page.mouse.down();
    }
    await page.waitForSelector('.reel', { timeout: 15000 }).catch(async () => note('no reel', chest, JSON.stringify(await page.evaluate(() => { const o = BR.Openings.current; return o && { state: o.state, hold: o.hold, pressed: o.pressed, cls: o.root.className, canOpen: o.canOpen, coins: BR.Progress.coins }; }))));
    if (!o.reduced) await page.mouse.up();
    const mid = await S();
    ok(mid.vault === before.vault + 1, 'drop not saved at burst', chest, mid.vault, before.vault);
    if (!o.forced) ok(mid.opened === before.opened + 1, 'opened counter', chest);
    if (!o.reduced) {
      await page.waitForTimeout(1700);
      await page.click('.op-reel');                    // tap to skip after 1.5s
    }
    await page.waitForSelector('.rv.on .rv-actions.on', { timeout: 40000 }).catch(() => note('no reveal', chest));
    const info = await page.evaluate(() => ({ name: document.querySelector('.rv-name').textContent, rar: document.querySelector('.rv-rar').textContent, type: document.querySelector('.rv-type').textContent }));
    return { before, info };
  };

  const chests = [['brick', 'Skin'], ['pop', 'Pop'], ['board', 'Board'], ['fuse', 'Fuse'], ['golden', 'Pop']];
  for (const [id, type] of chests) {
    const { info } = await openOne(id, { type: type.toLowerCase() });
    ok(info.type.toLowerCase() === type.toLowerCase(), 'wrong item type from', id, info);
    if (id === 'golden') ok(['Epic', 'Legendary', 'Mythic'].includes(info.rar), 'golden rarity', info.rar);
    // Equip
    await dom('.rv-actions [data-a="equip"]'); await page.waitForTimeout(150);
    const eq = await page.evaluate((t) => BR.Progress.equipped(t.toLowerCase()).item.name, type);
    ok(eq === info.name, 'equip did not apply', id, eq, info.name);
    if (id === 'brick') { // Open another
      ok(await page.locator('[data-a="again"]').count() === 1, 'no open another');
      await dom('[data-a="again"]');
      await page.waitForSelector('.opening.on .hold:not(.off)', { timeout: 8000 }).catch(() => note('no second arrival'));
      const b2 = await S();
      const box = await page.locator('.hold').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.waitForSelector('.reel', { timeout: 15000 }).catch(() => note('no second reel')); await page.mouse.up();
      await page.waitForTimeout(1800); await page.click('.op-reel');
      await page.waitForSelector('.rv.on .rv-actions.on', { timeout: 40000 }).catch(() => note('no second reveal'));
      const a2 = await S(); ok(a2.opened === b2.opened + 1, 'second chest not opened');
    }
    await dom('.rv-actions [data-a="done"]'); await page.waitForTimeout(700);
    ok(await page.locator('.opening').count() === 0, 'overlay not removed', id);
  }

  // no sell button, no duplicate tag, and the collection really grows by one each time
  ok(await page.locator('[data-a="sell"]').count() === 0, 'sell button still exists');
  await page.evaluate(() => BR.Progress.addChest('brick', 1));
  const pre = await S();
  await openOne('brick');
  const post = await S(); ok(post.vault === pre.vault + 1, 'collection did not grow by one', pre.vault, post.vault);
  ok(await page.locator('.rv-badge.dup').count() === 0, 'duplicate badge shown');
  await dom('.rv-actions [data-a="done"]'); await page.waitForTimeout(600);

  // a finished set: every Skin owned, the chest says Complete and will not open
  const done = await page.evaluate(() => {
    const P = BR.Progress; const pr = BR.Storage.data.profile; const sp = pr.vault.slice();
    BR.DROP_ITEMS.filter((i) => i.type === 'skin').forEach((i) => { if (!P.owns(i.id)) P.keep({ itemId: i.id, shine: 'plain', seed: 3, counter: null }); });
    BR.Router.go('shop'); return { complete: BR.Progress.chestStatus('brick').complete, can: BR.Progress.canOpen('brick') };
  });
  ok(done.complete && !done.can, 'finished set can still be opened', done);
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => /Complete/.test(document.querySelector('.cc-brick .cc-act').textContent)), 'shop does not say Complete');
  await page.evaluate(() => BR.Router.go('home'));

  // Escape closes the arrival screen for free
  const b3 = await S();
  await page.evaluate(() => { BR.App.openChest('fuse'); });
  await page.waitForSelector('.opening.on .hold:not(.off)'); await page.keyboard.press('Escape'); await page.waitForTimeout(700);
  const a3 = await S(); ok(a3.coins === b3.coins, 'backing out cost coins'); ok(await page.locator('.opening').count() === 0, 'escape did not close');

  // a chest you cannot afford does not open
  await page.evaluate(() => { BR.Storage.data.profile.coins = 10; BR.Storage.data.profile.chests.brick = 0; });
  await page.evaluate(() => { BR.App.openChest('brick'); }); await page.waitForTimeout(1800);
  ok(await page.locator('.hold.off').count() === 1, 'unaffordable chest is openable');
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  await page.evaluate(() => { BR.Storage.data.profile.coins = 6000; });

  // reduced motion: one tap, short spin
  await page.evaluate(() => { BR.Storage.data.settings.reduced = true; BR.App.applySettings(); BR.Progress.addChest('pop', 1); });
  const t0 = Date.now();
  await openOne('pop', { reduced: true });
  console.log('reduced-motion opening took', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  await dom('.rv-actions [data-a="done"]').catch(async () => { note('done button unstable', JSON.stringify(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').map((a) => { const t = a.effect && a.effect.target; return (t && (t.className && t.className.baseVal != null ? t.className.baseVal : t.className || t.tagName)) + '|' + (a.animationName || a.transitionProperty || ''); }).slice(0, 12)))); await page.evaluate(() => BR.Openings.current && BR.Openings.current.close(false)); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { BR.Storage.data.settings.reduced = false; BR.App.applySettings(); });

  // two quick taps on "Pay and start" charge once and start one run
  await page.evaluate(() => { BR.Router.go('home'); BR.Storage.data.profile.coins = 500; BR.readySheet('rush'); }); await page.waitForTimeout(900);
  await page.click('[data-boost="longFuse"]');
  await page.evaluate(() => { window.__starts = 0; const real = BR.App.startRun.bind(BR.App); BR.App.startRun = (o) => { window.__starts++; return real(o); }; });
  await page.evaluate(() => { const b = document.getElementById('goBtn'); b.click(); b.click(); });
  await page.waitForTimeout(900);
  const dbl = await page.evaluate(() => ({ coins: BR.Progress.coins, price: BR.CFG.boosts.longFuse.cost, starts: window.__starts }));
  ok(dbl.coins === 500 - dbl.price, 'double tap charged twice', dbl); ok(dbl.starts === 1, 'double tap started two runs', dbl);
  await page.evaluate(() => { BR.Run.over = true; BR.Router.go('home', { instant: true }); }); await page.waitForTimeout(600);

  // a Golden Chest only offers types that still have an Epic or better, and stranded stock turns into Coins
  await page.evaluate(() => {
    const P = BR.Progress; BR.DROP_ITEMS.filter((i) => i.type === 'fuse' && BR.rarityById[i.rarity].level >= 3).forEach((i) => { if (!P.owns(i.id)) P.keep({ itemId: i.id, shine: 'plain', seed: 1 }); });
    BR.Storage.data.profile.chests.golden = 2; BR.App.openChest('golden');
  });
  await page.waitForSelector('.op-picker button', { timeout: 8000 }); await page.waitForTimeout(1800);
  ok(await page.evaluate(() => document.querySelector('.op-picker button[data-type="fuse"]').disabled), 'finished type is selectable on the Golden Chest');
  await page.keyboard.press('Escape'); await page.waitForTimeout(700);

  console.log('errors', errors.filter((e) => !/Failed to load resource/.test(e)));
  console.log('problems', problems);
  await browser.close();
  process.exit(problems || errors.some((e) => /pageerror/.test(e)) ? 1 : 0);
})();
