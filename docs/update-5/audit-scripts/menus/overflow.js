// Text overflow / clipping audit across screens and sheets at several sizes, normal and larger text.
const { launch, returning, wait } = require('./u5lib');
const sizes = [[360, 640], [393, 852], [430, 932], [844, 390], [1280, 800]];
const audit = () => {
  const out = [];
  const vw = innerWidth;
  const sel = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  for (const el of document.querySelectorAll('#screens .screen.on *, #layer-sheets .sheet.on *, .results.on *, .tabbar *')) {
    if (el.closest('svg')) continue;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const txt = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (!txt) continue;
    // text wider than its box (clipped or ellipsised)
    if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible' && el.tagName !== 'TEXTAREA') out.push(['clip', sel(el), txt.slice(0, 30), el.scrollWidth + '>' + el.clientWidth]);
    // text past the viewport's right edge (not inside a horizontal scroller)
    const scroller = el.closest('.track, .filters');
    if (!scroller && (r.right > vw + 1 || r.left < -1)) out.push(['offscreen', sel(el), txt.slice(0, 30), Math.round(r.left) + '..' + Math.round(r.right)]);
    // text past its card's edge
    const card = el.closest('.seg button, .chip-btn, .tag, .btn, .pill, .lk, .pt-card, .res-chip, .rec, .stat');
    if (card && card !== el) { const cr = card.getBoundingClientRect(); if (r.right > cr.right + 1 || r.left < cr.left - 1) out.push(['spill', sel(el) + ' in ' + sel(card), txt.slice(0, 30), Math.round(r.right - cr.right)]); }
  }
  return out;
};
(async () => {
  const all = new Map();
  for (const [w, h] of sizes) for (const large of [false, true]) {
    const { browser, page } = await launch({ width: w, height: h, dsf: 1, mobile: w < 1000 });
    await returning(page, { chests: { brick: 2, golden: 1 } });
    await page.evaluate((large) => { BR.Storage.data.settings.large = large; BR.App.applySettings(); }, large);
    const steps = [
      ['home', () => BR.Router.go('home')], ['shop', () => BR.Router.go('shop')], ['col', () => BR.Router.go('collection')],
      ['col-pops', () => { BR.Router.screens.collection.type = 'pop'; BR.Router.rerender(); }],
      ['mis', () => { BR.Router.screens.missions.tab = 'daily'; BR.Router.go('missions'); }],
      ['pass', () => { BR.Router.screens.missions.tab = 'pass'; BR.Router.rerender(); }],
      ['tro', () => { BR.Router.screens.missions.tab = 'trophies'; BR.Router.rerender(); }],
      ['prof', () => BR.Router.go('profile')],
      ['coins', () => BR.coinSheet()], ['ready', () => BR.readySheet('rush')], ['odds', () => BR.showOdds('fuse')],
      ['item', () => { const v = BR.Storage.data.profile.vault[3]; BR.itemSheet(v.uid, BR.itemById[v.itemId].type); }],
      ['locked', () => { const it = BR.ITEMS.find((i) => i.type === 'board' && !BR.Progress.owns(i.id)); BR.lockedSheet(it.id); }],
    ];
    for (const [name, fn] of steps) {
      await page.evaluate(() => { while (BR.Back.depth) BR.Back.closeTop(); });
      await page.evaluate(fn); await wait(page, 1500);
      const r = await page.evaluate(audit);
      for (const x of r) { const k = x.slice(0, 3).join(' | '); if (!all.has(k)) all.set(k, new Set()); all.get(k).add(`${w}x${h}${large ? 'L' : ''}:${name}:${x[3]}`); }
    }
    await browser.close();
  }
  for (const [k, v] of all) console.log(k, '=>', [...v].slice(0, 6).join(', '), v.size > 6 ? `(+${v.size - 6})` : '');
})();
