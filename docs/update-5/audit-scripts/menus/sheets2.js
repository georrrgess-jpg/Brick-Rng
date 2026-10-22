const { launch, returning, wait, SHOTS, path } = require('./u5lib');
(async () => {
  for (const [w, h] of [[844, 390], [1280, 800], [360, 640]]) {
    const { browser, page } = await launch({ width: w, height: h, dsf: 1, mobile: w < 1000 });
    await returning(page, {});
    const list = { coins: () => BR.coinSheet(), ready: () => BR.readySheet('rush'), odds: () => BR.showOdds('brick'), item: () => { const v = BR.Storage.data.profile.vault[1]; BR.itemSheet(v.uid, BR.itemById[v.itemId].type); }, locked: () => BR.lockedSheet(BR.ITEMS.find((i) => !BR.Progress.owns(i.id)).id), reward: () => BR.rewardSheet(9), save: () => BR.saveCodeSheet() };
    const out = {};
    for (const [k, fn] of Object.entries(list)) {
      await page.evaluate(fn); await wait(page, 800);
      out[k] = await page.evaluate(() => { const s = document.querySelector('.sheet.on'), b = s.querySelector('.sheet-body'), a = s.querySelector('.sheet-actions'); const r = s.getBoundingClientRect(); return { sheetW: Math.round(r.width), sheetH: Math.round(r.height), bodyVisible: b.clientHeight, bodyFull: b.scrollHeight, actionsH: a ? Math.round(a.getBoundingClientRect().height) : 0 }; });
      await page.evaluate(() => BR.Back.closeTop()); await wait(page, 500);
    }
    console.log(w, h, JSON.stringify(out));
    if (w === 1280) {
      await page.evaluate(() => BR.showOdds('brick')); await wait(page, 800);
      await page.click('.sheet.on [data-act="toggle-inside"]'); await wait(page, 900);
      await page.screenshot({ path: path.join(SHOTS, 'odds-inside-1280.png') });
      await page.evaluate(() => BR.Back.closeTop()); await wait(page, 500);
      // pass track with a mouse wheel
      await page.evaluate(() => { BR.Router.screens.missions.tab = 'pass'; BR.Router.go('missions'); }); await wait(page, 1600);
      const t = await page.evaluate(() => { const r = document.querySelector('.track').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, sl: document.querySelector('.track').scrollLeft }; });
      await page.mouse.move(t.x, t.y); await page.mouse.wheel(0, 400); await wait(page, 600);
      console.log('track scrollLeft before/after vertical wheel', t.sl, await page.evaluate(() => document.querySelector('.track').scrollLeft), 'page scrollTop', await page.evaluate(() => document.querySelector('.screen.on .scroll').scrollTop));
    }
    if (w === 360) {
      // toasts stacking
      await page.evaluate(() => { BR.toast('Pixels equipped', 'good'); BR.toast('New mission!', 'good'); BR.toast('Not enough Coins. Play a run to earn more!', 'bad'); BR.toast('Tips will show again as you visit each screen', 'good'); }); await wait(page, 600);
      await page.screenshot({ path: path.join(SHOTS, 'toasts-360.png') });
    }
    await browser.close();
  }
})();
