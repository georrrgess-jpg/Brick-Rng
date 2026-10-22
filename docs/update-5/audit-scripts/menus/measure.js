const { launch, returning, wait } = require('./u5lib');
(async () => {
  for (const [w, h] of [[393, 852], [360, 640]]) {
    const { browser, page } = await launch({ width: w, height: h, dsf: 1 });
    await returning(page, { chests: { brick: 1, golden: 0 } });
    await page.evaluate(() => BR.Router.go('profile')); await wait(page, 1200);
    const prof = await page.evaluate(() => ({ soundY: Math.round(document.querySelector('[data-set="sound"]').closest('.toggle').getBoundingClientRect().top), helpY: Math.round(document.querySelector('[data-act="tips"]').getBoundingClientRect().top), scrollH: document.querySelector('.screen.on .scroll').scrollHeight }));
    await page.evaluate(() => BR.Router.go('home')); await wait(page, 1200);
    const home = await page.evaluate(() => { const b = document.querySelector('.banner[data-act="go-shop"]'); const p = document.querySelector('.pass-card'); return { chestBannerY: b && Math.round(b.getBoundingClientRect().top), passCardY: Math.round(p.getBoundingClientRect().top), scrollH: document.querySelector('.screen.on .scroll').scrollHeight }; });
    await page.evaluate(() => BR.Router.go('collection')); await wait(page, 1400);
    const col = await page.evaluate(() => { const c = [...document.querySelectorAll('.icard')]; const l = document.querySelector('.col-locked-head'); return { firstCardY: Math.round(c[0].getBoundingClientRect().top), lockedHeadY: l && Math.round(l.getBoundingClientRect().top) }; });
    await page.evaluate(() => { BR.Router.screens.missions.tab = 'pass'; BR.Router.go('missions'); }); await wait(page, 1600);
    const pass = await page.evaluate(() => { const t = document.querySelector('.track'); return { trackY: Math.round(t.getBoundingClientRect().top), trackBottom: Math.round(t.getBoundingClientRect().bottom), tabTop: Math.round(document.querySelector('#tabbar').getBoundingClientRect().top) }; });
    console.log(w, h, JSON.stringify({ prof, home, col, pass }));
    await browser.close();
  }
})();
