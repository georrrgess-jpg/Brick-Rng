// First-time tip cards: each shows once, never during a run, can be replayed, and a returning player gets the what's-new card
// instead of the welcome card. Usage: node tests/coach.js
const { launch } = require('./lib');
(async () => {
  let problems = 0;
  const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };
  const open = (page) => page.evaluate(() => !!document.querySelector('.sheet.coach'));
  const title = (page) => page.evaluate(() => (document.querySelector('.sheet.coach .coach-title') || {}).textContent || '');
  const close = async (page) => { await page.click('.sheet.coach .btn'); await page.waitForTimeout(650); };

  // ---- a brand new player
  {
    const { browser, page, errors } = await launch({ width: 390, height: 844, dsf: 1, coach: true });
    await page.evaluate(() => { BR.Storage.data.settings.sound = false; BR.Storage.data.seenTutorial = true; BR.Storage.data.runs = 0; BR.Storage.data.profile.coins = 2000; BR.Router.go('shop'); BR.Router.go('home'); });
    await page.waitForTimeout(1400);
    ok(await open(page) && /Welcome/.test(await title(page)), 'welcome card on first Home', await title(page));
    await close(page);
    const shown = [];
    for (const t of ['shop', 'collection', 'missions', 'profile']) {
      await page.evaluate((t) => BR.Router.go(t), t); await page.waitForTimeout(1300);
      const o = await open(page); shown.push(t + ':' + o);
      ok(o, 'card for first visit to', t);
      if (o) await close(page);
      await page.evaluate(() => BR.Router.go('home')); await page.waitForTimeout(300);
      await page.evaluate((t) => BR.Router.go(t), t); await page.waitForTimeout(1200);
      ok(!(await open(page)), 'card shown twice for', t);
    }
    // the Pass tab has its own card
    await page.evaluate(() => { BR.Router.go('home'); BR.Router.screens.missions.tab = 'pass'; BR.Router.go('missions'); BR.Router.rerender(); BR.Coach.onScreen('missions'); }); await page.waitForTimeout(1300);
    ok(await open(page) && /Pass/.test(await title(page)), 'pass card', await title(page));
    if (await open(page)) await close(page);
    // the boosts card appears with the sheet, the opening card with the first chest
    await page.evaluate(() => { BR.Router.go('home'); BR.readySheet('rush'); }); await page.waitForTimeout(1000);
    ok(await open(page) && /Boosts/.test(await title(page)), 'boosts card', await title(page));
    if (await open(page)) await close(page);
    await page.evaluate(() => BR.Back.closeTop()); await page.waitForTimeout(700);
    await page.evaluate(() => { BR.App.openChest('brick'); }); await page.waitForTimeout(3200);
    ok(await open(page) && /chest/i.test(await title(page)), 'opening card', await title(page));
    if (await open(page)) await close(page);
    await page.evaluate(() => { BR.Openings.current.close(false); }); await page.waitForTimeout(700);
    // never during a run
    await page.evaluate(() => { BR.Storage.data.seen = {}; __app.startRun({ mode: 'rush', boosts: {} }); });
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 8000 }).catch(() => {});
    ok(await page.evaluate(() => BR.Coach.show('shop') === false), 'a card was shown during a run');
    await page.evaluate(() => { BR.Run.exitToHome && BR.Run.exitToHome(); }); await page.waitForTimeout(800);
    // replay from Profile
    await page.evaluate(() => { Object.keys(BR.Coach.CARDS).forEach((k) => { BR.Storage.data.seen[k] = true; }); BR.Router.go('profile'); }); await page.waitForTimeout(600);
    await page.evaluate(() => { document.querySelector('[data-act="tips"]').click(); });
    ok(await page.evaluate(() => Object.keys(BR.Storage.data.seen).filter((k) => k !== 'whatsnew3').length === 0), 'tips were not reset');
    await page.evaluate(() => BR.Router.go('shop')); await page.waitForTimeout(1300);
    ok(await open(page), 'card did not come back after reset');
    ok(!/Update 3/.test(await title(page)), 'the what is new card came back with the tips');
    console.log('first visits:', shown.join(' '), '| errors', errors.length ? errors.join(' | ') : 'none');
    ok(errors.length === 0, 'console errors');
    await browser.close();
  }

  // ---- a returning player (older save): what's-new card once, no welcome card
  {
    const { browser, page, errors } = await launch({ width: 390, height: 844, dsf: 1, coach: true });
    await page.evaluate(() => { BR.Storage.data.settings.sound = false; BR.Storage.data.runs = 12; BR.Storage.data.notice = { kind: 'dupes', coins: 640 }; BR.Storage.data.seen = {}; BR.Router.go('shop'); BR.Router.go('home'); });
    await page.waitForTimeout(1500);
    const t = await title(page);
    ok(/Update 3/.test(t), 'what is new card for a returning player', t);
    ok(await page.evaluate(() => /640/.test(document.querySelector('.sheet.coach').textContent)), 'refund not mentioned');
    await close(page);
    ok(await page.evaluate(() => !BR.Storage.data.notice && !!BR.Storage.data.seen.whatsnew3), 'notice not cleared');
    await page.evaluate(() => { BR.Router.go('shop'); BR.Router.go('home'); }); await page.waitForTimeout(1300);
    ok(!(await open(page)), 'welcome card shown to a returning player');
    ok(errors.length === 0, 'console errors', errors.join('|'));
    await browser.close();
  }
  console.log(problems ? problems + ' PROBLEMS' : 'coach ok');
  process.exit(problems ? 1 : 0);
})();
