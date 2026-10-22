// A brand-new player opens the welcome chest: count taps and see what covers what.
const { launch, wait, SHOTS, path } = require('./u5lib');
(async () => {
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1, coach: true });
  const shot = (n) => page.screenshot({ path: path.join(SHOTS, 'fc-' + n + '.png') });
  await wait(page, 1500);
  await page.click('.sheet.on .btn'); await wait(page, 700);               // Let's pop
  console.log('after Lets pop:', await page.evaluate(() => BR.Router.current));
  await page.click('#tabbar .tab[data-tab="shop"]'); await wait(page, 1500); await shot('1-shop');
  await page.click('.cc-brick [data-act="open"]'); await wait(page, 2200); await shot('2-opening-card');
  console.log('card over opening:', await page.evaluate(() => !!document.querySelector('.sheet.on.coach')));
  await page.click('.sheet.on .btn'); await wait(page, 700); await shot('3-ready');
  const hb = await page.evaluate(() => { const r = document.querySelector('.opening [data-hold]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(hb.x, hb.y); await page.mouse.down(); await wait(page, 400); await page.mouse.up(); await wait(page, 300); await shot('4-short-hold');
  console.log('after a short press:', await page.evaluate(() => BR.Openings.current.state + ' ' + document.querySelector('.opening [data-label]').textContent + ' / ' + document.querySelector('.opening [data-sub]').textContent));
  await page.mouse.down(); await wait(page, 1600); await page.mouse.up();
  for (let i = 0; i < 100; i++) { const s = await page.evaluate(() => BR.Openings.current.state); if (s === 'done') break; await wait(page, 150); }
  await wait(page, 500); await shot('5-reveal');
  await page.click('.rv-actions [data-a="equip"]'); await wait(page, 500); await shot('6-equipped');
  await page.click('.rv-actions [data-a="done"]'); await wait(page, 1500); await shot('7-back');
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
