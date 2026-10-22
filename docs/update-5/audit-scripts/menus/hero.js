const { launch, returning, wait } = require('./u5lib');
(async () => {
  for (const [w, h] of [[360, 640], [375, 667], [393, 852], [430, 932], [844, 390]]) for (const large of [false, true]) for (const ret of [false, true]) {
    const { browser, page } = await launch({ width: w, height: h, dsf: 1 });
    if (ret) await returning(page, {});
    await page.evaluate((large) => { BR.Storage.data.settings.large = large; BR.App.applySettings(); BR.Router.rerender(); }, large);
    await wait(page, 300);
    const r = await page.evaluate(() => { const H = document.querySelector('.hero').getBoundingClientRect(), p = document.querySelector('.hero-play').getBoundingClientRect(), a = document.querySelector('.hero-art').getBoundingClientRect(); return { over: Math.round(p.right - H.right), art: Math.round(a.right - H.right), sw: document.querySelector('.hero').scrollWidth - document.querySelector('.hero').clientWidth }; });
    console.log(w, h, large ? 'large' : 'normal', ret ? 'returning' : 'new', JSON.stringify(r));
    await browser.close();
  }
})();
