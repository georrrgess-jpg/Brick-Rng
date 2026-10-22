// Back button, Escape, tap outside, focus inside sheets, keyboard reachability of tappable things.
const { launch, returning, wait, SHOTS, path } = require('./u5lib');
(async () => {
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1, mobile: false });
  await returning(page, {});
  await wait(page, 1200);
  const out = {};
  // 1. focus after opening a sheet
  await page.evaluate(() => document.querySelector('.coin-btn').focus());
  await page.keyboard.press('Enter'); await wait(page, 700);
  out.afterOpen = await page.evaluate(() => ({ active: document.activeElement.className || document.activeElement.tagName, inSheet: !!document.activeElement.closest('.sheet') }));
  const tabs = [];
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); tabs.push(await page.evaluate(() => { const a = document.activeElement; return (a.closest('.sheet') ? 'SHEET:' : 'BEHIND:') + (a.getAttribute('aria-label') || a.textContent.trim().slice(0, 20) || a.className); })); }
  out.tabOrder = tabs;
  await page.screenshot({ path: path.join(SHOTS, 'a11y-tab-in-sheet.png') });
  await page.keyboard.press('Escape'); await wait(page, 600);
  out.afterEsc = await page.evaluate(() => ({ depth: BR.Back.depth, active: document.activeElement.className || document.activeElement.tagName }));
  // 2. tap outside closes; history length stays sane
  out.hist0 = await page.evaluate(() => history.length);
  await page.evaluate(() => BR.coinSheet()); await wait(page, 600);
  await page.mouse.click(200, 60); await wait(page, 600);
  out.tapOutside = await page.evaluate(() => ({ depth: BR.Back.depth, sheets: document.querySelectorAll('.sheet').length, hist: history.length }));
  // 3. the browser Back button closes a sheet
  await page.evaluate(() => BR.showOdds('pop')); await wait(page, 600);
  await page.goBack(); await wait(page, 700);
  out.backClosesSheet = await page.evaluate(() => ({ depth: BR.Back.depth, sheets: document.querySelectorAll('.sheet.on').length, screen: BR.Router.current }));
  // 4. keyboard reachability: tappable things that are not focusable
  const screens = ['home', 'shop', 'collection', 'missions', 'profile'];
  out.unfocusable = {};
  for (const s of screens) {
    await page.evaluate((s) => { if (s === 'missions') BR.Router.screens.missions.tab = 'pass'; BR.Router.go(s); }, s); await wait(page, 1600);
    out.unfocusable[s] = await page.evaluate(() => { const r = {}; document.querySelectorAll('.screen.on [data-uid], .screen.on [data-tier], .screen.on [data-act], .screen.on [data-locked], .screen.on [data-trophy], .screen.on .badge-ico').forEach((el) => { if (el.tabIndex < 0 && !el.matches('button, a, input')) { const k = el.className.split(' ')[0]; r[k] = (r[k] || 0) + 1; } }); return r; });
  }
  // 5. focus ring visible on a Collection card? on a tab?
  await page.evaluate(() => BR.Router.go('home')); await wait(page, 1200);
  await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await wait(page, 200);
  out.focus3 = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { el: a.className, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor }; });
  await page.screenshot({ path: path.join(SHOTS, 'a11y-focus-home.png') });
  // 6. results: is Back handled?
  await page.evaluate(() => { __app.startRun({ mode: 'rush', boosts: {} }); });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 15000 });
  out.runDepth = await page.evaluate(() => ({ depth: BR.Back.depth, hist: history.length }));
  await page.evaluate(() => BR.Run.endRun('ended')); await wait(page, 4500);
  out.results = await page.evaluate(() => ({ depth: BR.Back.depth, hist: history.length, active: document.activeElement.className || document.activeElement.tagName }));
  await page.keyboard.press('Escape'); await wait(page, 500);
  out.resultsAfterEsc = await page.evaluate(() => !!document.querySelector('.results.on'));
  console.log(JSON.stringify(out, null, 1));
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
