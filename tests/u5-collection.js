// Update 5 menus that Moonwick added: the Hats tab (wear, take off, Try it, where a hat comes from), the Shop's "new" chips and spotlight,
// and the what's-new card. Phone sizes 393x852 and 360x640.
const { launch } = require('./lib');
let bad = 0;
const ok = (c, m, ...x) => { if (!c) { bad++; console.log('FAIL', m, ...x); } };
(async () => {
  for (const [w, h] of [[393, 852], [360, 640]]) {
    const { browser, page, errors } = await launch({ width: w, height: h, dsf: 1 });
    // ---- the Hats tab
    await page.evaluate(() => { ['h_top', 'h_wizard'].forEach((x) => BR.Progress.grantHat(x)); BR.Router.go('collection'); });
    await page.waitForTimeout(500);
    await page.click('#colSeg button[data-type="hat"]'); await page.waitForTimeout(700);
    const tab = await page.evaluate(() => ({ cards: document.querySelectorAll('.icard[data-hatcard]').length, locked: document.querySelectorAll('[data-hatlock]').length, ring: (document.querySelector('.col-prog') || {}).textContent }));
    ok(tab.cards === 4, 'cards: no hat, Party Hat and two earned hats', tab.cards);
    ok(tab.locked === 12 - 3, 'every hat that is not earned is a silhouette with a way to earn it', tab.locked);
    ok(/3\s*\/\s*12/.test(tab.ring || ''), 'the ring counts earned hats', tab.ring);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    ok(wide, 'no sideways scroll on the Hats tab');
    await page.click('.icard[data-hatcard="h_wizard"] .eq-btn'); await page.waitForTimeout(500);
    ok(await page.evaluate(() => BR.Progress.equippedHat() === 'h_wizard' && !!document.querySelector('#fuse .fz-hat')), 'wearing a hat from its card puts it on Fizz');
    await page.click('.icard[data-hatcard="none"] .eq-btn'); await page.waitForTimeout(400);
    ok(await page.evaluate(() => BR.Progress.equippedHat() === null && !document.querySelector('#fuse .fz-hat')), 'No hat takes it off');
    // a locked hat says how to earn it, and a Pass hat leads to the Pass
    await page.evaluate(() => document.querySelector('[data-hatlock="h_pom"]').click()); await page.waitForTimeout(600);
    ok(await page.evaluate(() => /Season 4 Pass/.test(document.querySelector('.sheet').textContent) && /See the Pop Pass/.test(document.querySelector('.sheet').textContent)), 'a locked Pass hat names its tier and links to the Pass');
    await page.evaluate(() => document.querySelector('.sheet [data-close]').click()); await page.waitForTimeout(700);
    // Try it puts the hat on the practice board and the real loadout comes back
    await page.evaluate(() => document.querySelector('.icard[data-hatcard="h_top"] .ic-hit').click()); await page.waitForTimeout(700);
    await page.evaluate(() => [...document.querySelectorAll('.sheet button')].find((b) => /Try it/.test(b.textContent)).click()); await page.waitForTimeout(1500);
    ok(await page.evaluate(() => BR.Router.current === 'run' && BR.Run.practice && document.querySelector('#fuse .fz-hat') && document.querySelector('#fuse .fz-hat').dataset.hat === 'h_top'), 'Try it shows the hat on Fizz in a practice run');
    await page.evaluate(() => BR.Run.endPractice()); await page.waitForTimeout(900);
    ok(await page.evaluate(() => BR.Router.current === 'collection' && BR.Storage.data.profile.loadout.hat === 'none'), 'after Try it the real hat choice is back');
    ok(await page.evaluate(() => !!document.querySelector('.sheet') && /Top Hat/.test(document.querySelector('.sheet').textContent)), 'after Try it the hat sheet is back, as it is for every other item');
    await page.evaluate(() => { const c = document.querySelector('.sheet [data-close]'); if (c) c.click(); }); await page.waitForTimeout(700);
    // ---- the Shop
    await page.evaluate(() => BR.Router.go('shop')); await page.waitForTimeout(800);
    const shop = await page.evaluate(() => ({ chips: [...document.querySelectorAll('.cc-info .tag.moon')].map((e) => e.textContent), spot: !!document.querySelector('.spotlight'), ovf: [...document.querySelectorAll('.tag.moon')].some((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().height > 30) }));
    ok(shop.chips.length === 4 && shop.chips.every((t) => /^\d+ new$/.test(t.trim())), 'each chest says how many Moonwick items are still to find', JSON.stringify(shop.chips));
    ok(shop.spot && !shop.ovf, 'the spotlight shows and the chips do not wrap', JSON.stringify(shop));
    await page.click('.spotlight'); await page.waitForTimeout(900);
    ok(await page.evaluate(() => { const s = document.querySelector('.sheet'); return !!s && /Show me the/.test(s.textContent) && !/Equip/.test(s.textContent); }), 'the spotlight opens a preview with a way to the chest, not an Equip button');
    ok(errors.length === 0, 'console errors', errors.join(' | '));
    await browser.close();
  }
  console.log(bad ? bad + ' failures' : 'u5-collection ok');
  process.exit(bad ? 1 : 0);
})();
