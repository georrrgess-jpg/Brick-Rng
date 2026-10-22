const { launch, returning, wait } = require('./u5lib');
const { capture } = require('./frames');
(async () => {
  const { browser, page } = await launch({ width: 393, height: 852, dsf: 2 });
  await returning(page, {});
  await wait(page, 1500);
  const r = await page.evaluate(() => { const a = document.querySelector('.hero-art').getBoundingClientRect(); const s = document.querySelector('.ba-spark'); return { a: a.toJSON(), anim: getComputedStyle(s).animationName, sheets: [...document.styleSheets].flatMap((ss) => { try { return [...ss.cssRules].filter((r) => r.type === 7 && (r.name === 'sparkFlick' || r.name === 'cardIn')).map((r) => ss.href.split('/').pop() + ':' + r.name + ' ' + r.cssText.slice(0, 80)); } catch (e) { return []; } }) }; });
  console.log(JSON.stringify(r, null, 1));
  const clip = { x: Math.round(r.a.x - 110) * 2, y: Math.round(r.a.y - 40) * 2, width: 240 * 2, height: 160 * 2 };
  const res = await capture(page, 'spark', () => Date.now(), { ms: 500, every: 50, cols: 11, scale: 0.5, clip });
  // the icard animation actually used
  await page.evaluate(() => BR.Router.go('collection')); await wait(page, 200);
  console.log(await page.evaluate(() => { const c = document.querySelector('.icard'); const a = c.getAnimations()[0]; return a ? JSON.stringify(a.effect.getKeyframes().map((k) => k.transform)) : 'none'; }));
  await browser.close();
})();
