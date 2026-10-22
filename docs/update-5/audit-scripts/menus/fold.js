const { launch, returning, wait } = require('./u5lib');
(async () => {
  for (const [w, h] of [[844, 390], [932, 430], [667, 375], [360, 640]]) for (const resume of [false, true]) {
    const { browser, page } = await launch({ width: w, height: h, dsf: 1 });
    await returning(page, {});
    if (resume) await page.evaluate(() => { BR.Storage.saveRun({ mode: 'rush', stage: 2, score: 1234 }); BR.Router.rerender(); });
    await wait(page, 300);
    const r = await page.evaluate(() => { const p = document.querySelector('.hero-play').getBoundingClientRect(); const tb = document.querySelector('#tabbar').getBoundingClientRect(); return { playBottom: Math.round(p.bottom), playTop: Math.round(p.top), vh: innerHeight, tabTop: Math.round(tb.top) }; });
    console.log(w, h, resume ? 'resume' : 'no-resume', JSON.stringify(r));
    await browser.close();
  }
})();
