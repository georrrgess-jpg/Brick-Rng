// Missions swap and completed, streak states, Pass reward sheets, level badge, Profile actions, what's new, Try it.
const { launch, returning, wait, SHOTS, path } = require('./u5lib');
const { capture } = require('./frames');
(async () => {
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1 });
  await returning(page, {});
  const shot = (n, clip) => page.screenshot({ path: path.join(SHOTS, 'ix-' + n + '.png'), clip });
  // Missions: swap
  await page.evaluate(() => { BR.Router.screens.missions.tab = 'daily'; BR.Router.go('missions'); }); await wait(page, 1500);
  const c0 = await page.evaluate(() => BR.Progress.coins);
  let r = await capture(page, 'ix-swap', () => { const t = Date.now(); document.querySelector('[data-act="reroll"]').click(); return t; }, { ms: 900, every: 100, cols: 5, scale: 0.5, clip: { x: 0, y: 0, width: 393, height: 520 } });
  await wait(page, 300); await shot('swap-after');
  console.log('swap: coins', c0, '->', await page.evaluate(() => BR.Progress.coins), 'swap buttons left', await page.evaluate(() => document.querySelectorAll('[data-act="reroll"]').length));
  // Missions: one done, weekly done
  await page.evaluate(() => { const m = BR.Missions.ensure(); m.list[0].progress = m.list[0].target; m.list[0].done = true; m.weekly.progress = m.weekly.target; m.weekly.done = true; BR.Storage.save(); BR.Router.rerender(); }); await wait(page, 600); await shot('mis-done');
  await page.evaluate(() => BR.Router.go('home')); await wait(page, 1300);
  await page.evaluate(() => document.querySelector('.mission-card').scrollIntoView({ block: 'center' })); await wait(page, 300);
  const mc = await page.evaluate(() => document.querySelector('.mission-card').getBoundingClientRect().toJSON());
  await shot('home-mis-done', { x: 0, y: Math.max(0, mc.top - 10), width: 393, height: mc.height + 20 });
  // Streak states
  const states = {
    s0new: { ring: 0, weeks: 0, last: '', shield: 1, best: 0 },
    s2yday: { ring: 2, weeks: 0, last: -1, shield: 1, best: 2 },
    s3today: { ring: 3, weeks: 0, last: 0, shield: 1, best: 3 },
    s6shield: { ring: 6, weeks: 0, last: -2, shield: 1, best: 6 },
    s4broken: { ring: 4, weeks: 1, last: -4, shield: 0, best: 11 },
    s7done: { ring: 7, weeks: 0, last: 0, shield: 1, best: 7 },
    s7next: { ring: 7, weeks: 0, last: -1, shield: 1, best: 7 },
  };
  for (const [k, s] of Object.entries(states)) {
    await page.evaluate((s) => { if (typeof s.last === 'number') s.last = BR.dayKey(new Date(Date.now() + s.last * 864e5)); BR.Storage.data.profile.streak = s; BR.Storage.save(); BR.Router.rerender(); }, s);
    await wait(page, 300);
    await page.evaluate(() => document.querySelector('.streak-card').scrollIntoView({ block: 'center' })); await wait(page, 200);
    const b = await page.evaluate(() => document.querySelector('.streak-card').getBoundingClientRect().toJSON());
    await shot('streak-' + k, { x: 0, y: Math.max(0, b.top - 6), width: 393, height: b.height + 12 });
    console.log(k, await page.evaluate(() => document.querySelector('.streak-card').innerText.replace(/\n+/g, ' ')));
  }
  // level badge -> Pass, reward sheets
  await page.evaluate(() => document.querySelector('.scroll').scrollTo(0, 0));
  await page.click('.lvl-badge'); await wait(page, 1600);
  console.log('badge ->', await page.evaluate(() => BR.Router.current + '/' + BR.Router.screens.missions.tab));
  for (const tier of [3, 6, 9]) { await page.evaluate((t) => BR.rewardSheet(t), tier); await wait(page, 800); await shot('reward-' + tier); await page.evaluate(() => BR.Back.closeTop()); await wait(page, 500); }
  // the Pass track tile tap
  await page.evaluate(() => document.querySelector('.pt.next').click()); await wait(page, 800); await shot('reward-tap-next');
  await page.evaluate(() => BR.Back.closeTop()); await wait(page, 500);
  // Profile: graphics switch frames, reset arming, trophies card
  await page.evaluate(() => BR.Router.go('profile')); await wait(page, 1500);
  await page.evaluate(() => document.querySelector('#perfSeg').scrollIntoView({ block: 'center' })); await wait(page, 300);
  const sg = await page.evaluate(() => document.querySelector('#perfSeg').getBoundingClientRect().toJSON());
  r = await capture(page, 'ix-perf', () => { const t = Date.now(); document.querySelector('[data-perf="high"]').click(); return t; }, { ms: 500, every: 50, cols: 6, scale: 0.6, clip: { x: 0, y: Math.round(sg.top - 120), width: 393, height: 240 } });
  r = await capture(page, 'ix-toggle', () => { const t = Date.now(); document.querySelector('[data-set="shapes"]').click(); return t; }, { ms: 500, every: 50, cols: 6, scale: 0.6 });
  await page.evaluate(() => document.querySelector('[data-act="reset"]').scrollIntoView({ block: 'center' })); await wait(page, 300);
  await page.click('[data-act="reset"]'); await wait(page, 300); await shot('reset-armed');
  // restore: bad code then good code
  await page.evaluate(() => BR.restoreSheet()); await wait(page, 700);
  await page.fill('.sheet.on textarea', 'hello'); await page.click('.sheet.on .sheet-actions .btn'); await wait(page, 300); await shot('restore-bad');
  const code = await page.evaluate(() => BR.Storage.exportCode());
  await page.fill('.sheet.on textarea', code); await page.click('.sheet.on .sheet-actions .btn'); await wait(page, 300); await shot('restore-good');
  await page.evaluate(() => BR.Back.closeTop()); await wait(page, 500);
  // Help: show the tips again
  await page.click('[data-act="tips"]'); await wait(page, 400); await shot('tips-again');
  console.log('after tips: seen', JSON.stringify(await page.evaluate(() => BR.Storage.data.seen)));
  await page.evaluate(() => BR.Router.go('shop')); await wait(page, 1500); await shot('tips-shop');
  await page.evaluate(() => BR.Router.go('home')); await wait(page, 1500); await shot('tips-home');
  console.log('home after tips depth', await page.evaluate(() => BR.Back.depth));
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
