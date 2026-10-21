// Layout and visual regressions that are cheap to check with numbers: things that once shipped broken stay fixed.
// Usage: node tests/visual.js
const { launch } = require('./lib');
(async () => {
  let problems = 0;
  const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };
  const { browser, page, errors } = await launch({ width: 390, height: 844, dsf: 1 });
  await page.evaluate(() => { const pr = BR.Storage.data.profile; BR.Storage.data.settings.sound = false; BR.Storage.data.seenTutorial = true; BR.Storage.data.runs = 6; pr.level = 6; pr.coins = 900; });

  // the Home logo is three bricks side by side (P O P), not stacked
  await page.evaluate(() => BR.Router.go('home')); await page.waitForTimeout(700);
  const xs = await page.evaluate(() => Array.from(document.querySelectorAll('.logo .lb')).map((b) => Math.round(b.getBoundingClientRect().left)));
  ok(xs.length === 3 && new Set(xs).size === 3 && xs[0] < xs[1] && xs[1] < xs[2], 'logo bricks overlap', xs);

  // the odds never say "1 in 2" or "1 in 1"
  const odds = await page.evaluate(() => { const out = []; for (const id of ['brick', 'pop', 'board', 'fuse', 'golden']) { const d = document.createElement('div'); d.innerHTML = BR.oddsHTML(id, BR.CHESTS[id].type || 'skin', { compact: id === 'brick' }); out.push(d.textContent); } return out.join(' | '); });
  ok(!/1 in [12]\b/.test(odds), 'odds say 1 in 1 or 1 in 2', odds.match(/1 in [12]\b/));

  // Pass rewards are numbered by the level that unlocks them, and the level-up row agrees
  await page.evaluate(() => { BR.Router.screens.missions.tab = 'pass'; BR.Router.go('missions'); BR.Router.rerender(); }); await page.waitForTimeout(900);
  const next = await page.evaluate(() => ({ node: document.querySelector('.pt.next .pt-n b').textContent, hero: document.querySelector('.phn-txt small').textContent, level: BR.Progress.level }));
  ok(+next.node === next.level + 1 && /Pass level 7/.test(next.hero), 'pass numbering off by one', next);
  const gained = await page.evaluate(() => { const P = BR.Progress; const before = P.level; const r = P.addXp(BR.xpForLevel(before) - P.xp); return { level: r.level, up: r.ups[0] && r.ups[0].level, tier: r.ups[0] && r.ups[0].tier }; });
  ok(gained.up === gained.level && gained.tier === gained.level - 1, 'level-up row mismatch', gained);

  // icons are line icons: a trophy in the results is not a solid blob
  const fill = await page.evaluate(() => { const d = document.createElement('div'); d.className = 'lvl-up'; d.innerHTML = '<span class="lu-n">' + BR.icon('trophy') + '</span>'; document.body.appendChild(d); const f = getComputedStyle(d.querySelector('svg')).fill; d.remove(); return f; });
  ok(fill === 'none', 'trophy icon is filled', fill);

  // after a run ends by the fuse, the next run's bomb is visible
  await page.evaluate(() => { __app.startRun({ mode: 'rush', boosts: {} }); });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 8000 });
  await page.evaluate(() => { BR.Run.endRun('fuse'); });
  await page.waitForSelector('.results.on', { timeout: 15000 }); await page.waitForTimeout(1500);
  await page.evaluate(() => { BR.Run.closeResults('home'); BR.Router.go('home'); }); await page.waitForTimeout(700);
  await page.evaluate(() => { __app.startRun({ mode: 'rush', boosts: {} }); });
  await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 8000 });
  const bomb = await page.evaluate(() => { const b = document.getElementById('bomb'); const r = b.getBoundingClientRect(); return { op: getComputedStyle(b).opacity, w: Math.round(r.width) }; });
  ok(+bomb.op === 1 && bomb.w >= 56, 'bomb is not restored after a fuse-out', bomb);

  console.log('errors', errors.length ? errors.join(' | ') : 'none');
  ok(errors.length === 0, 'console errors');
  await browser.close();
  console.log(problems ? problems + ' PROBLEMS' : 'visual ok');
  process.exit(problems ? 1 : 0);
})();
