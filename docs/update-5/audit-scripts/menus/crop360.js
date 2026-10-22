const { launch, returning, wait, SHOTS, path } = require('./u5lib');
(async () => {
  for (const [w, h, large] of [[360, 640, false], [393, 852, true], [360, 640, true]]) {
    const { browser, page } = await launch({ width: w, height: h, dsf: 3 });
    await returning(page, {});
    await page.evaluate((large) => { BR.Storage.data.settings.large = large; BR.App.applySettings(); BR.Router.rerender(); }, large);
    await wait(page, 1500);
    const r = await page.evaluate(() => { const h = document.querySelector('.hero').getBoundingClientRect(); const b = document.querySelector('.hero-body').getBoundingClientRect(); const p = document.querySelector('.hero-play').getBoundingClientRect(); const s = document.querySelector('.hero-stats').getBoundingClientRect(); return { hero: [h.left, h.right, h.top, h.bottom], body: [b.left, b.right], play: [p.left, p.right, p.top, p.bottom], stats: [s.left, s.right] }; });
    console.log(w, h, large, JSON.stringify(r));
    await page.screenshot({ path: path.join(SHOTS, `hero-${w}${large ? 'L' : ''}.png`), clip: { x: 0, y: r.hero[2] - 4, width: w, height: r.hero[3] - r.hero[2] + 8 } });
    await page.evaluate(() => BR.Router.go('collection')); await wait(page, 1500);
    const seg = await page.evaluate(() => document.querySelector('#colSeg').getBoundingClientRect().toJSON());
    await page.screenshot({ path: path.join(SHOTS, `seg-${w}${large ? 'L' : ''}.png`), clip: { x: 0, y: seg.top - 4, width: w, height: seg.height + 8 + 140 } });
    await browser.close();
  }
})();
