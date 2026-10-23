// CSS selector statistics (the DevTools "selector stats" trace): which selectors cost the most time to match during
// a scenario, plus a static census of the stylesheet (rules per file, rules whose rightmost part is not a class/id/tag and
// so are tried against every element). env WHAT=collection|shop|home|pop (default collection), RATE.
const L = require('./lib');
(async () => {
  const { browser, page, cdp, errors } = await L.launch();
  await L.setup(page, { skin: process.env.SKIN, pop: process.env.POP, board: process.env.BOARD, fuse: process.env.FUSE });
  const what = process.env.WHAT || 'collection';
  // static census
  const census = await page.evaluate(() => {
    const out = []; let all = 0, univ = 0, attrOnly = 0, pseudoEl = 0; const univEx = [];
    for (const sh of document.styleSheets) {
      let rules = 0, sels = 0, u = 0; const name = (sh.href || 'inline').split('/').pop();
      const walk = (list) => { for (const r of list) { if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText) { rules++; for (const s of r.selectorText.split(/,(?![^(]*\))/)) { sels++; const last = s.trim().split(/\s+|>|\+|~/).filter(Boolean).pop() || ''; const core = last.replace(/::?[a-z-]+(\([^)]*\))?/g, ''); if (/^[.#]|^[a-z]/i.test(core)) { if (/^\[/.test(core)) attrOnly++; } else if (/^\[/.test(core)) { attrOnly++; } else { u++; if (univEx.length < 40) univEx.push(name + ': ' + s.trim().slice(0, 90)); } if (/::/.test(last)) pseudoEl++; } } } };
      try { walk(sh.cssRules); } catch (e) { continue; }
      all += sels; univ += u; out.push([name, rules, sels, u]);
    }
    return { out, all, univ, attrOnly, pseudoEl, univEx, kf: [...document.styleSheets].reduce((a, sh) => { try { return a + [...sh.cssRules].filter((r) => r.type === 7).length; } catch (e) { return a; } }, 0) };
  });
  console.log('selectors', census.all, '| rightmost part has no class/id/tag (checked on every element):', census.univ, '| attribute-keyed', census.attrOnly, '| ::pseudo rules', census.pseudoEl, '| @keyframes', census.kf);
  census.out.sort((a, b) => b[2] - a[2]).forEach(([n, r, s, u]) => console.log('   ', n.padEnd(16), 'rules', String(r).padStart(5), 'selectors', String(s).padStart(5), 'universal-bucket', u));
  console.log('   universal-bucket examples:\n     ' + census.univEx.slice(0, 25).join('\n     '));

  await page.touchscreen.tap(196, 3);
  if (what === 'pop') await L.startRun(page, 'daily');
  else { for (const s of ['shop', 'collection', 'home']) { await page.evaluate((s) => BR.Router.go(s), s); await page.waitForTimeout(500); } }
  await L.throttle(cdp);
  const { ev } = await L.trace(browser, page, async () => {
    if (what === 'pop') { for (let i = 0; i < 3; i++) { const a = await L.bestTap(page); await page.touchscreen.tap(a.x, a.y); await page.waitForTimeout(1300); } }
    else { await page.evaluate((w) => { window.dispatchEvent(new Event('pointerdown')); BR.Router.go(w); }, what); await page.waitForTimeout(1500); }
  }, ['disabled-by-default-blink.debug']);
  const agg = {}; let n = 0;
  ev.filter((e) => e.args && (e.args.selector_stats || (e.args.data && e.args.data.selector_stats))).forEach((e) => {
    const st = e.args.selector_stats || e.args.data.selector_stats; n++;
    (st.selector_timings || []).forEach((s) => { const k = s.selector + ' @' + (s.style_sheet_id || ''); const a = (agg[s.selector] = agg[s.selector] || { us: 0, att: 0, match: 0, fast: 0 }); a.us += s['elapsed (us)'] || 0; a.att += s.match_attempts || 0; a.match += s.match_count || 0; a.fast += s.fast_reject_count || 0; });
  });
  const list = Object.entries(agg).sort((a, b) => b[1].us - a[1].us);
  const tot = list.reduce((a, [, v]) => a + v.us, 0), att = list.reduce((a, [, v]) => a + v.att, 0);
  console.log(`\nselector stats events ${n}, selectors seen ${list.length}, total match time ${(tot / 1000).toFixed(1)} ms, match attempts ${att}`);
  list.slice(0, +(process.env.N || 30)).forEach(([k, v]) => console.log(String((v.us / 1000).toFixed(2)).padStart(7), 'ms', String(v.att).padStart(7), 'tries', String(v.match).padStart(6), 'hits', ' ', k.slice(0, 120)));
  console.log('errors', errors.join(' | ') || 'none');
  await browser.close();
})();
