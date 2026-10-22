// First-time help: three moments get a card (Welcome, the first chest, the Pop Pass), every other screen gets a one-line
// banner with a close button, the first runs start with no Boosts sheet, nothing is shown during a run, tips can be
// replayed, and a returning player gets the what's-new card instead of the welcome card. Usage: node tests/coach.js
const { launch } = require('./lib');
(async () => {
  let problems = 0;
  const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };
  const open = (page) => page.evaluate(() => !!document.querySelector('.sheet.coach'));
  const title = (page) => page.evaluate(() => (document.querySelector('.sheet.coach .coach-title') || {}).textContent || '');
  const close = async (page) => { await page.click('.sheet.coach .btn'); await page.waitForTimeout(650); };
  const banner = (page, t) => page.evaluate((t) => !!document.querySelector(`#s-${t}.on .tipbar[data-tip="${t}"]`), t);

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
      const b = await banner(page, t); shown.push(t + ':' + b);
      ok(b, 'banner for first visit to', t);
      ok(!(await open(page)), 'a modal card blocks', t);
      if (b) await page.click(`#s-${t} .tipbar .tb-x`);
      await page.waitForTimeout(200);
      ok(!(await banner(page, t)), 'banner did not close', t);
      await page.evaluate(() => BR.Router.go('home')); await page.waitForTimeout(300);
      await page.evaluate((t) => BR.Router.go(t), t); await page.waitForTimeout(1200);
      ok(!(await banner(page, t)), 'banner came back after it was closed', t);
    }
    // the Pass tab keeps its card
    await page.evaluate(() => { BR.Router.go('home'); BR.Router.screens.missions.tab = 'pass'; BR.Router.go('missions'); BR.Router.rerender(); BR.Coach.onScreen('missions'); }); await page.waitForTimeout(1300);
    ok(await open(page) && /Pass/.test(await title(page)), 'pass card', await title(page));
    if (await open(page)) await close(page);

    // the first runs start at once; the Boosts sheet appears from the fourth, with no extra card on top of it
    await page.evaluate(() => { BR.Router.go('home'); }); await page.waitForTimeout(500);
    await page.evaluate(() => { document.querySelector('[data-act="play-rush"]').click(); }); await page.waitForTimeout(800);
    ok(await page.evaluate(() => BR.Router.current === 'run' && !document.querySelector('.sheet')), 'the first run did not start straight away');
    await page.evaluate(() => { BR.Run.exitToHome(); BR.Storage.data.runs = BR.CFG.boostsFromRun; BR.Router.go('home'); }); await page.waitForTimeout(700);
    await page.evaluate(() => { document.querySelector('[data-act="play-rush"]').click(); }); await page.waitForTimeout(900);
    ok(await page.evaluate(() => !!document.querySelector('.sheet .boosts')), 'no Boosts sheet from the fourth run');
    ok(!(await open(page)), 'a card covers the Boosts sheet');
    await page.evaluate(() => BR.Back.closeTop()); await page.waitForTimeout(700);

    // the opening card comes with the first chest
    await page.evaluate(() => { BR.App.openChest('brick'); }); await page.waitForTimeout(3200);
    ok(await open(page) && /chest/i.test(await title(page)), 'opening card', await title(page));
    if (await open(page)) await close(page);
    await page.evaluate(() => { BR.Openings.current.close(false); }); await page.waitForTimeout(700);
    // never during a run
    await page.evaluate(() => { BR.Storage.data.seen = {}; __app.startRun({ mode: 'rush', boosts: {} }); });
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 8000 }).catch(() => {});
    ok(await page.evaluate(() => BR.Coach.show('home', { force: false }) === false), 'a card was shown during a run');
    await page.evaluate(() => { BR.Storage.data.seen.whatsnew4 = true; BR.Run.exitToHome && BR.Run.exitToHome(); }); await page.waitForTimeout(800);
    // replay from Profile
    await page.evaluate(() => { BR.Coach.markAllSeen(); BR.Router.go('profile'); }); await page.waitForTimeout(600);
    await page.evaluate(() => { document.querySelector('[data-act="tips"]').click(); });
    ok(await page.evaluate(() => Object.keys(BR.Storage.data.seen).filter((k) => !/^whatsnew/.test(k)).length === 0), 'tips were not reset');
    await page.evaluate(() => BR.Router.go('shop')); await page.waitForTimeout(1300);
    ok(await banner(page, 'shop'), 'banner did not come back after reset');
    ok(!/Update 4/.test(await title(page)), 'the what is new card came back with the tips', await title(page), await page.evaluate(() => JSON.stringify(BR.Storage.data.seen)));
    console.log('first visits:', shown.join(' '), '| errors', errors.length ? errors.join(' | ') : 'none');
    ok(errors.length === 0, 'console errors', errors.join('|'));
    await browser.close();
  }

  // ---- a returning player (older save): what's-new card once, no welcome card
  {
    const { browser, page, errors } = await launch({ width: 390, height: 844, dsf: 1, coach: true });
    await page.evaluate(() => { BR.Storage.data.settings.sound = false; BR.Storage.data.runs = 12; BR.Storage.data.notice = { kind: 'dupes', coins: 640 }; BR.Storage.data.seen = {}; BR.Router.go('shop'); BR.Router.go('home'); });
    await page.waitForTimeout(1500);
    const t = await title(page);
    ok(/Update 4/.test(t), 'what is new card for a returning player', t);
    ok(await page.evaluate(() => /640/.test(document.querySelector('.sheet.coach').textContent)), 'refund not mentioned');
    await close(page);
    ok(await page.evaluate(() => !BR.Storage.data.notice && !!BR.Storage.data.seen.whatsnew4), 'notice not cleared');
    await page.evaluate(() => { BR.Router.go('shop'); BR.Router.go('home'); }); await page.waitForTimeout(1300);
    ok(!(await open(page)), 'welcome card shown to a returning player');
    ok(errors.length === 0, 'console errors', errors.join('|'));
    await browser.close();
  }
  console.log(problems ? problems + ' PROBLEMS' : 'coach ok');
  process.exit(problems ? 1 : 0);
})();
