// UI audit: on every screen and sheet, text is at least 12px and every control is at least 44px in both directions.
// Prints each offender once (by selector and size). Usage: node tests/uiaudit.js [--list]
const { launch } = require('./lib');
const LIST = process.argv.includes('--list');
const MIN_TEXT = 12, MIN_HIT = 44;
// controls that are decoration or are part of a larger tap target are skipped by selector
const SKIP_HIT = ['.bdg', '.brick', '.icard', '.lk', '.mode-card', '.hero', '.resume', '.banner', '.pass-card', '.mission-card', '.trophy', '.pt', '.boost'];   // whole cards and rows are big tap targets already
(async () => {
  let problems = 0;
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1 });
  await page.evaluate(() => {
    const st = BR.Storage.data; st.settings.sound = false; st.settings.music = false; st.runs = 12; st.seenTutorial = true;
    const P = BR.Progress; P.coins = 900; st.profile.level = 6;
    BR.DROP_ITEMS.slice(0, 20).forEach((i, n) => { if (!P.owns(i.id)) P.keep({ itemId: i.id, shine: 'glossy', seed: n }); });
  });
  const audit = (label) => page.evaluate(([label, MIN_TEXT, MIN_HIT, SKIP_HIT]) => {
    const out = [];
    const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
    const sel = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    const seen = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (!vis(el) || el.closest('svg') || el.closest('.hidden')) continue;
      const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
      if (hasText) { const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < MIN_TEXT - 0.01) { const k = 'T ' + sel(el) + ' ' + fs; if (!seen.has(k)) { seen.add(k); out.push([label, 'text ' + fs + 'px', sel(el), (el.textContent || '').trim().slice(0, 24)]); } } }
      if (el.matches('button, a[href], [role="button"], input:not([type="hidden"]), [data-act], [data-tab]') && !SKIP_HIT.some((s) => el.matches(s))) {
        const r = el.getBoundingClientRect();
        if (r.width < MIN_HIT - 0.5 || r.height < MIN_HIT - 0.5) { const k = 'H ' + sel(el) + Math.round(r.width) + 'x' + Math.round(r.height); if (!seen.has(k)) { seen.add(k); out.push([label, 'hit ' + Math.round(r.width) + 'x' + Math.round(r.height), sel(el), (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)]); } }
      }
    }
    return out;
  }, [label, MIN_TEXT, MIN_HIT, SKIP_HIT]);
  const all = [];
  const run = async (label, fn, wait = 900) => { await page.evaluate(fn); await page.waitForTimeout(wait); const r = await audit(label); all.push(...r); };
  await run('home', () => BR.Router.go('home'));
  await run('shop', () => BR.Router.go('shop'));
  await run('collection', () => BR.Router.go('collection'), 1500);
  await run('missions', () => { BR.Router.screens.missions.tab = 'daily'; BR.Router.go('missions'); BR.Router.rerender(); });
  await run('pass', () => { BR.Router.screens.missions.tab = 'pass'; BR.Router.go('missions'); BR.Router.rerender(); }, 1500);
  await run('trophies', () => { BR.Router.screens.missions.tab = 'trophies'; BR.Router.go('missions'); BR.Router.rerender(); });
  await run('profile', () => BR.Router.go('profile'));
  await page.evaluate(() => BR.Router.go('home')); await page.waitForTimeout(900);   // let the screen settle: animations pause under a sheet
  await run('ready', () => { BR.readySheet('rush'); }, 1000);
  await page.evaluate(() => BR.Back.closeTop()); await page.waitForTimeout(500);
  await run('odds', () => BR.showOdds('brick'), 900);
  await page.evaluate(() => BR.Back.closeTop()); await page.waitForTimeout(500);
  await run('coins', () => BR.coinSheet(), 900);
  await page.evaluate(() => BR.Back.closeTop()); await page.waitForTimeout(500);
  await run('item', () => { const v = BR.Storage.data.profile.vault[0]; BR.itemSheet(v.uid, BR.itemById[v.itemId].type); }, 1200);
  await page.evaluate(() => BR.Back.closeTop()); await page.waitForTimeout(500);
  await run('run', () => { BR.Router.go('home'); __app.startRun({ mode: 'rush', boosts: {} }); }, 2500);
  await run('pause', () => { BR.Run.pause(); }, 900);
  await page.evaluate(() => BR.Back.closeTop()); await page.waitForTimeout(400);
  await run('results', () => { BR.Run.endRun('quit'); }, 3500);
  const byKey = new Map();
  for (const [label, what, s, txt] of all) { const k = what + ' ' + s; if (!byKey.has(k)) byKey.set(k, { labels: new Set(), txt }); byKey.get(k).labels.add(label); }
  for (const [k, v] of byKey) { problems++; console.log('OFFENDER', k.padEnd(60), [...v.labels].join(','), JSON.stringify(v.txt)); }
  if (errors.length) { problems++; console.log('errors', errors.join(' | ')); }
  await browser.close();
  console.log(problems ? problems + ' offenders' : 'uiaudit ok');
  process.exit(LIST || !problems ? 0 : 1);
})();
