// Simulate the iPhone 15 Pro insets by overriding the inset variables (Chromium has no notch): portrait 59/34, landscape 59 left/right, 21 bottom.
const { launch, returning, wait, SHOTS, path } = require('./u5lib');
(async () => {
  for (const [w, h, css, tag] of [[393, 852, ':root{--sat:59px;--sab:34px}', 'sa-port'], [852, 393, ':root{--sal:59px;--sar:59px;--sab:21px}', 'sa-land']]) {
    const { browser, page, errors } = await launch({ width: w, height: h, dsf: 1 });
    await returning(page, {});
    await page.addStyleTag({ content: css });
    await page.evaluate(() => { const d = document.createElement('div'); d.id = 'island'; d.style.cssText = 'position:fixed;z-index:999;pointer-events:none;background:#000;border-radius:20px;'; document.body.appendChild(d); });
    if (w < h) await page.evaluate(() => { Object.assign(document.getElementById('island').style, { left: '135px', top: '11px', width: '125px', height: '37px' }); });
    else await page.evaluate(() => { Object.assign(document.getElementById('island').style, { left: '11px', top: '134px', width: '37px', height: '125px' }); });
    const shot = (n) => page.screenshot({ path: path.join(SHOTS, `${tag}-${n}.png`) });
    await page.evaluate(() => BR.Router.go('home')); await wait(page, 1300); await shot('home');
    await page.evaluate(() => BR.Router.go('collection')); await wait(page, 1300); await shot('col');
    await page.evaluate(() => { const v = BR.Storage.data.profile.vault[1]; BR.itemSheet(v.uid, BR.itemById[v.itemId].type); }); await wait(page, 900); await shot('item');
    await page.evaluate(() => BR.Back.closeTop()); await wait(page, 500);
    await page.evaluate(() => BR.coinSheet()); await wait(page, 800); await page.evaluate(() => BR.toast('Pixels equipped', 'good')); await wait(page, 500); await shot('coins-toast');
    await page.evaluate(() => BR.Back.closeTop()); await wait(page, 500);
    await page.evaluate(() => { BR.App.openChest('brick'); }); await wait(page, 1800); await shot('opening');
    await page.evaluate(() => BR.Back.closeTop()); await wait(page, 800);
    await page.evaluate(() => { __app.startRun({ mode: 'rush', boosts: {} }); });
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 15000 });
    await page.evaluate(() => BR.Run.endRun('ended')); await wait(page, 4500); await shot('results');
    console.log(tag, JSON.stringify(errors));
    await browser.close();
  }
})();
