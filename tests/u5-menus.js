// Update 5, menus: behaviour checks for every class of menu bug found in the audit (docs/update-5/audit-menus.md).
// Focus stays in sheets, tab badges, the status bar that never moves, keyboard reach, the hero that never overflows, Play above the fold in
// landscape, sheet widths, Larger text as one type scale, Reduce Motion without stagger delays, toasts, swaps, Boosts memory, the Pass track.
// Usage: node tests/u5-menus.js
const { spawnSync } = require('child_process');
const path = require('path');
const { launch } = require('./lib');

let problems = 0;
const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };
const wait = (page, ms) => page.waitForTimeout(ms);
// ONLY=portrait,hero,landscape node tests/u5-menus.js runs just those sections (static, portrait, hero, large, reduced, landscape, desktop, smooth)
const want = (n) => !process.env.ONLY || process.env.ONLY.split(',').includes(n);

/** A returning player: 12 runs, level 6, 900 Coins, five items of each type, two Brick Chests and a Golden Chest waiting. */
async function player(page, o = {}) {
  await page.evaluate((o) => {
    const st = BR.Storage.data, P = BR.Progress, pr = st.profile;
    st.settings.sound = false; st.settings.music = false; st.seenTutorial = true; st.runs = o.runs != null ? o.runs : 12;
    pr.level = 6; pr.xp = Math.round(BR.xpForLevel(6) * 0.4); pr.coins = o.coins != null ? o.coins : 900;
    st.best.rush = 48250; st.bestStage.rush = 5; st.recent.rush = [21000, 33000, 48250];
    ['skin', 'pop', 'board', 'fuse'].forEach((t) => BR.DROP_ITEMS.filter((i) => i.type === t).slice(0, 5).forEach((i, k) => { if (!P.owns(i.id)) P.keep({ itemId: i.id, shine: ['plain', 'glossy', 'holo', 'prism'][k % 4], seed: k + 3 }); }));
    pr.chests = Object.assign({ brick: 0, pop: 0, board: 0, fuse: 0, golden: 0 }, o.chests || { brick: 2, golden: 1 });
    pr.trophies = { first_run: 1, first_rush: 1, stage5: 1, daily1: 1 };
    if (o.large) st.settings.large = true;
    if (o.reduced) st.settings.reduced = true;
    if (o.resume) BR.Storage.saveRun({ mode: 'rush', stage: 2, score: 1234 }); else BR.Storage.clearRun();
    st.seen = Object.assign(st.seen || {}, { misDay: BR.Missions.ensure().day });
    BR.Storage.save(); BR.App.applySettings(); BR.Chrome.refresh(); BR.Router.go('shop', { instant: true }); BR.Router.go('home', { instant: true });
  }, o);
  await wait(page, 700);
}
/** Escape, then wait until the sheet has really left (its element is removed half a second later): a slow machine must not move the test on early. */
const esc = async (page) => { await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.sheet'), null, { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(150); };
const rect = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; }, sel);

(async () => {
  // ---------------------------------------------------------------- static: one type scale, nothing styled twice
  if (want('static')) {
    const r = spawnSync('python3', [path.resolve(__dirname, '..', 'tools', 'typescale.py'), '--check'], { encoding: 'utf8' });
    ok(r.status === 0, 'a menu text size is written as bare px (it would not grow with Larger text); run tools/typescale.py', r.stdout.trim().split('\n').slice(0, 4).join(' | '));
    const k = spawnSync('node', [path.resolve(__dirname, 'keyframes.js')], { encoding: 'utf8' });
    ok(k.status === 0, 'duplicate or undefined @keyframes', k.stdout.trim().split('\n').slice(0, 4).join(' | '));
  }

  // ---------------------------------------------------------------- portrait phone, returning player
  if (want('portrait')) {
    const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1, mobile: true });
    await player(page, { resume: true });

    // the status bar lives outside the screens, has a gear on every tab, and never moves
    ok(await page.evaluate(() => !document.querySelector('.screen').contains(document.getElementById('topbar')) && !document.querySelector('.screen .topbar')), 'the status bar is inside a screen');
    const bar0 = await rect(page, '#tbCoins'), gear0 = await rect(page, '#tbGear'), lv0 = await rect(page, '#tbLevel');
    const moves = [];
    for (const t of ['shop', 'collection', 'missions', 'profile', 'home']) {
      await page.evaluate((t) => BR.Router.go(t), t);
      for (const ms of [30, 120, 400]) { await wait(page, ms); const c = await rect(page, '#tbCoins'), g = await rect(page, '#tbGear'), l = await rect(page, '#tbLevel'); moves.push([t, ms, c.l - bar0.l, c.t - bar0.t, g.l - gear0.l, l.l - lv0.l]); }
      ok(await page.evaluate((t) => document.getElementById('tbTitle').textContent === ({ shop: 'Shop', collection: 'Collection', missions: 'Missions', profile: 'Profile', home: '' })[t], t), 'the title does not follow the tab', t);
      ok(await page.evaluate(() => !!document.getElementById('tbGear') && getComputedStyle(document.getElementById('tbGear')).display !== 'none'), 'no gear on', t);
    }
    ok(moves.every((m) => m.slice(2).every((d) => Math.abs(d) < 0.5)), 'the status bar moved during a tab switch', JSON.stringify(moves.filter((m) => m.slice(2).some((d) => Math.abs(d) >= 0.5)).slice(0, 3)));

    // a tab switch leaves no frame where neither screen shows: while the old screen fades the new one is already there
    await page.evaluate(() => BR.Router.go('shop')); await wait(page, 600);
    await page.evaluate(() => { window.__seen = []; BR.Router.go('collection'); const on = [...document.querySelectorAll('.screen')].filter((s) => s.classList.contains('on') || s.classList.contains('leaving')).map((s) => s.id); window.__seen.push(on.join(',')); });
    ok(await page.evaluate(() => /s-shop/.test(window.__seen[0]) && /s-collection/.test(window.__seen[0])), 'the old screen is not kept while the new one fades in', await page.evaluate(() => window.__seen[0]));
    await wait(page, 900);
    ok(await page.evaluate(() => !document.querySelector('.screen.leaving') && getComputedStyle(document.getElementById('s-shop')).display === 'none'), 'the old screen stayed (or its content was kept) after the fade');
    await page.evaluate(() => BR.Router.go('home')); await wait(page, 700);

    // tab badges: waiting chests on the Shop tab, new missions on the Missions tab
    ok(await page.evaluate(() => { const b = document.getElementById('badgeShop'); return b.classList.contains('show') && b.textContent === '3' && /3 chests/.test(b.closest('.tab').getAttribute('aria-label')); }), 'no Shop badge for 3 waiting chests');
    await page.evaluate(() => { BR.Storage.data.profile.chests = { brick: 0, pop: 0, board: 0, fuse: 0, golden: 0 }; BR.Router.rerender(); });
    ok(await page.evaluate(() => !document.getElementById('badgeShop').classList.contains('show')), 'the Shop badge stays with no chests');
    await page.evaluate(() => { BR.Storage.data.profile.chests = { brick: 2, pop: 0, board: 0, fuse: 0, golden: 1 }; BR.Router.rerender(); });
    await page.evaluate(() => { BR.Storage.data.seen.misDay = 'yesterday'; BR.Router.rerender(); });
    ok(await page.evaluate(() => document.getElementById('dotMissions').classList.contains('show')), 'no Missions dot for new missions');
    await page.evaluate(() => BR.Router.go('missions')); await wait(page, 500);
    await page.evaluate(() => BR.Router.go('home')); await wait(page, 500);
    ok(await page.evaluate(() => !document.getElementById('dotMissions').classList.contains('show')), 'the Missions dot stays after the missions were seen');

    // the chests banner is under the hero, above the fold, and opens a chest in one tap
    const g = await page.evaluate(() => { const h = document.querySelector('.hero').getBoundingClientRect(), b = document.querySelector('.banner').getBoundingClientRect(), tb = document.getElementById('tabbar').getBoundingClientRect(); return { heroBottom: h.bottom, bannerTop: b.top, bannerBottom: b.bottom, tabTop: tb.top }; });
    ok(g.bannerTop >= g.heroBottom - 1 && g.bannerBottom <= g.tabTop, 'the chests banner is not right under the hero and above the tab bar', JSON.stringify(g));
    await page.click('.banner'); await wait(page, 700);
    ok(await page.evaluate(() => !!(BR.Openings.current && !BR.Openings.current.closed)), 'tapping the chests banner did not open a chest');
    await page.evaluate(() => { BR.Openings.current.close(false); }); await wait(page, 800);

    // the Boosts memory: a remembered selection gives Home a chip that starts a run in one tap, paying for it
    await page.evaluate(() => { BR.Storage.data.boostsLast = ['longFuse']; BR.Storage.data.profile.coins = 900; BR.Router.rerender(); });
    const chip = await page.evaluate(() => { const c = document.querySelector('.chip-boost'); return c ? { text: c.textContent.replace(/\s+/g, ' ').trim(), spend: c.classList.contains('spend') } : null; });
    ok(chip && chip.spend && /Long Fuse/.test(chip.text) && /25/.test(chip.text), 'no Boosts chip on Home', JSON.stringify(chip));
    await page.evaluate(() => { window.__runs = []; const real = BR.App.startRun.bind(BR.App); BR.App.startRun = (o) => { window.__runs.push(JSON.stringify(o.boosts)); BR.Run.over = true; BR.Router.current = BR.Router.current; return undefined; }; window.__realStart = real; });
    await page.click('.chip-boost'); await wait(page, 200);
    ok(await page.evaluate(() => window.__runs.length === 1 && window.__runs[0] === '{"longFuse":true}' && BR.Progress.coins === 875), 'the chip did not start a run with the Boost and charge it', await page.evaluate(() => JSON.stringify([window.__runs, BR.Progress.coins])));
    // Play with a remembered "no Boosts" starts at once; with Boosts it asks
    await page.evaluate(() => { BR.Storage.data.boostsLast = []; BR.Progress.coins = 900; BR.Router.rerender(); window.__runs = []; });
    await page.click('.hero-play'); await wait(page, 200);
    ok(await page.evaluate(() => window.__runs.length === 1 && window.__runs[0] === '{}' && !document.querySelector('.sheet')), 'Play did not start straight away after a run with no Boosts');
    await page.evaluate(() => { BR.Storage.data.boostsLast = ['longFuse']; window.__runs = []; BR.Router.rerender(); });
    await page.click('.hero-play'); await wait(page, 700);
    ok(await page.evaluate(() => !!document.querySelector('.sheet.ready') && window.__runs.length === 0), 'Play with remembered Boosts did not open the Boosts sheet');
    // Start goes straight to the run: no Home flash in between (it used to wait 250 ms), the choice is remembered, and the toast is gone
    await page.evaluate(() => { BR.Router.go('home'); });
    await page.click('[data-boost="headStart"]'); await wait(page, 200);
    await page.evaluate(() => { window.__runs = []; document.getElementById('goBtn').click(); });
    await wait(page, 60);
    ok(await page.evaluate(() => window.__runs.length === 1 && window.__runs[0] === '{"headStart":true}'), 'Start waited before starting the run', await page.evaluate(() => JSON.stringify(window.__runs)));
    ok(await page.evaluate(() => JSON.stringify(BR.Storage.data.boostsLast) === '["headStart"]'), 'Start did not remember the Boosts');
    await wait(page, 700);
    await page.evaluate(() => { BR.App.startRun = window.__realStart; while (BR.Back.depth) BR.Back.closeTop(); });
    await page.evaluate(() => { BR.Progress.coins = 900; BR.Router.rerender(); });

    // Settings: a gear on every tab, two taps from anywhere to the sound switch, and the sheet keeps focus
    await page.evaluate(() => { BR.Storage.data.settings.sound = true; BR.App.applySettings(); BR.Router.go('collection'); }); await wait(page, 500);
    await page.click('#tbGear'); await wait(page, 700);
    ok(await page.evaluate(() => !!document.querySelector('.sheet.settings.on')), 'the gear did not open Settings');
    await page.evaluate(() => { document.querySelector('.sheet.settings [data-set="sound"]').click(); }); await wait(page, 100);
    ok(await page.evaluate(() => BR.Storage.data.settings.sound === false), 'the sound switch in Settings did not turn sound off');
    ok(await page.evaluate(() => document.querySelector('.sheet.settings [data-vol="sfxVol"]').closest('.vol').classList.contains('off')), 'the volume row did not dim when the sound went off');
    // Graphics: the thumb slides from where it was (the segment is not rebuilt)
    const seg0 = await page.evaluate(() => { const s = document.getElementById('perfSeg'); window.__seg = s; return s.style.getPropertyValue('--si'); });
    await page.click('[data-perf="high"]'); await wait(page, 100);
    ok(await page.evaluate((s0) => window.__seg.isConnected && window.__seg.style.getPropertyValue('--si') === '2' && s0 === '0', seg0), 'the Graphics control was rebuilt instead of sliding', seg0);
    await esc(page);

    // focus: into the sheet, trapped there, the page behind inert, back to the opener on Escape
    await page.evaluate(() => BR.Router.go('home')); await wait(page, 600);
    await page.evaluate(() => document.getElementById('tbCoins').focus());
    await page.keyboard.press('Enter'); await wait(page, 800);
    ok(await page.evaluate(() => !!document.activeElement.closest('.sheet')), 'focus did not move into the sheet', await page.evaluate(() => document.activeElement.className));
    ok(await page.evaluate(() => document.getElementById('screens').hasAttribute('inert') && document.getElementById('tabbar').hasAttribute('inert')), 'the page behind an open sheet is not inert');
    const walk = [];
    for (let i = 0; i < 9; i++) { await page.keyboard.press('Tab'); walk.push(await page.evaluate(() => !!document.activeElement.closest('.sheet'))); }
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Shift+Tab'); walk.push(await page.evaluate(() => !!document.activeElement.closest('.sheet'))); }
    ok(walk.every(Boolean), 'Tab left the open sheet', JSON.stringify(walk));
    await esc(page);
    ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'tbCoins'), 'focus did not return to the control that opened the sheet', await page.evaluate(() => document.activeElement.id || document.activeElement.className));
    ok(await page.evaluate(() => !document.getElementById('screens').hasAttribute('inert')), 'the page stayed inert after the sheet closed');
    // nested sheets: closing the top one hands focus and inertness to the one below
    await page.evaluate(() => { BR.settingsSheet(); }); await wait(page, 600);
    await page.evaluate(() => { BR.coinSheet(); }); await wait(page, 600);
    ok(await page.evaluate(() => document.querySelectorAll('.sheet[inert]').length === 1 && !!document.activeElement.closest('.sheet:not([inert])')), 'a sheet over a sheet leaves the lower one reachable');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => document.querySelectorAll('.sheet').length === 1, null, { timeout: 8000 }).catch(() => {}); await wait(page, 100);
    ok(await page.evaluate(() => document.querySelectorAll('.sheet[inert]').length === 0 || [...document.querySelectorAll('.sheet')].filter((s) => s.classList.contains('on') && s.hasAttribute('inert')).length === 0), 'the sheet below stayed inert');
    await esc(page);

    // every card, tile and badge can be reached with the keyboard
    const reach = {};
    for (const t of ['home', 'shop', 'collection', 'missions-pass', 'missions-trophies', 'profile']) {
      await page.evaluate((t) => { const M = BR.Router.screens.missions; if (t.startsWith('missions')) { M.tab = t.split('-')[1]; BR.Router.go('missions'); BR.Router.rerender(); } else BR.Router.go(t); }, t); await wait(page, 1700);
      reach[t] = await page.evaluate(() => { const bad = []; document.querySelectorAll('.screen.on [data-act], .screen.on [data-uid], .screen.on [data-tier], .screen.on [data-trophy], .screen.on [data-locked], .screen.on [data-equip], .screen.on [data-tab], .screen.on [data-type], .screen.on [data-rar]').forEach((el) => { if (el.matches('button, input, a[href], [tabindex="0"]') || el.querySelector('button') || el.closest('[tabindex="0"], button')) return; if (el.matches('.hero[data-act]') && el.querySelector('button')) return; bad.push(el.className || el.tagName); }); return bad; });
      ok(reach[t].length === 0, 'controls with no keyboard reach on', t, JSON.stringify(reach[t].slice(0, 4)));
    }
    // a card, its wear button and a Pass tile answer Enter
    await page.evaluate(() => BR.Router.go('collection')); await wait(page, 1500);
    await page.evaluate(() => document.querySelector('.icard[data-uid]:not([data-uid="default"]) .ic-hit').focus()); await page.keyboard.press('Enter'); await wait(page, 700);
    ok(await page.evaluate(() => !!document.querySelector('.sheet.detail-sheet.on')), 'Enter on a Collection card did not open it');
    await esc(page);
    ok(await page.evaluate(() => !!document.activeElement && document.activeElement.classList.contains('ic-hit')), 'focus did not return to the card that was opened', await page.evaluate(() => document.activeElement.className));

    // wearing an item is one tap from its card: Collection, then the circle
    const before = await page.evaluate(() => BR.Progress.equipped('skin').item.id);
    const target = await page.evaluate(() => { const b = document.querySelector('.icard:not(.eq) .eq-btn'); return b ? { uid: b.dataset.equip, name: b.getAttribute('aria-label') } : null; });
    await page.click('.icard:not(.eq) .eq-btn'); await wait(page, 500);
    const after = await page.evaluate(() => BR.Progress.equipped('skin').item.id);
    ok(target && after !== before && await page.evaluate((u) => BR.Progress.isEquipped(u), target.uid), 'the corner circle did not wear the item', JSON.stringify([before, after, target]));
    ok(await page.evaluate(() => !!document.querySelector('.icard.eq .eq-flag') && document.querySelectorAll('.icard.eq').length === 1), 'the worn flag did not move');
    ok(await page.evaluate(() => !!document.activeElement && document.activeElement.closest('.icard.eq')), 'focus was lost after wearing an item');
    // the rarity filter has an All chip, and the type switch keeps the segment (the thumb slides)
    ok(await page.evaluate(() => !!document.querySelector('.chip-btn[data-rar=""]') && document.querySelector('.chip-btn[data-rar=""]').classList.contains('on')), 'no All chip');
    await page.evaluate(() => { window.__seg = document.getElementById('colSeg'); document.querySelector('#colSeg [data-type="pop"]').click(); }); await wait(page, 100);
    ok(await page.evaluate(() => window.__seg.isConnected && window.__seg.style.getPropertyValue('--si') === '1'), 'the Collection type control was rebuilt instead of sliding');
    ok(await page.evaluate(() => !/\d\/\d/.test(document.getElementById('colSeg').textContent)), 'the count is still in the type control (it is in the ring)');
    // locked tiles are dark shapes, not a "?" box
    ok(await page.evaluate(() => { const q = document.querySelector('.lk .bdg-q'); return !q || getComputedStyle(q).display === 'none'; }), 'locked tiles still show a ? box');

    // the item sheet: demo sparks stay inside the preview well, and Try it returns to the sheet
    await page.evaluate(() => { const v = BR.Storage.data.profile.vault.find((x) => BR.itemById[x.itemId].type === 'skin'); BR.itemSheet(v.uid, 'skin'); }); await wait(page, 1200);
    ok(await page.evaluate(() => /inset/.test(document.getElementById('fx').style.clipPath)), 'the demo canvas is not clipped to the preview well');
    await esc(page);
    ok(await page.evaluate(() => !document.getElementById('fx').style.clipPath), 'the demo canvas stayed clipped after the sheet closed');

    // Shop: pity line says the real count, a chest you cannot afford says how much is missing, one earn list
    await page.evaluate(() => { BR.Storage.data.profile.coins = 100; BR.Storage.data.profile.chests.brick = 0; BR.Storage.data.profile.chests.golden = 0; BR.Storage.data.profile.pity.skin = 3; BR.Router.go('shop'); }); await wait(page, 800);
    ok(await page.evaluate(() => { const st = BR.Progress.chestStatus('brick'); return st.pityIn === 5 && new RegExp('within ' + st.pityIn + ' chests').test(document.querySelector('.cc-brick .pity small').textContent); }), 'the pity line does not say the real count', await page.evaluate(() => document.querySelector('.cc-brick .pity small').textContent));
    ok(await page.evaluate(() => /Need\s*250\s*more/.test(document.querySelector('.cc-brick .cc-act .btn').textContent)), 'a chest you cannot afford does not say how many Coins are missing', await page.evaluate(() => document.querySelector('.cc-brick .cc-act .btn').textContent));
    ok(await page.evaluate(() => !document.querySelector('.cc-badge')), 'the count bubble is still on the chest art');
    // the Coins sheet on the Shop has no button that does nothing
    await page.evaluate(() => BR.coinSheet()); await wait(page, 700);
    ok(await page.evaluate(() => ![...document.querySelectorAll('.sheet.on .btn')].some((b) => /Go to the Shop/.test(b.textContent))), 'the Coins sheet offers "Go to the Shop" on the Shop');
    await esc(page);
    // "Show me the chest" from a locked item scrolls to the chest and pulses it
    await page.evaluate(() => { BR.Router.go('collection'); }); await wait(page, 1200);
    await page.evaluate(() => { const it = BR.ITEMS.find((i) => i.type === 'fuse' && !BR.Progress.owns(i.id) && !i.pass); BR.lockedSheet(it.id); }); await wait(page, 800);
    await page.evaluate(() => { [...document.querySelectorAll('.sheet.on .btn')].find((b) => /Fuse Chest/.test(b.textContent)).click(); }); await wait(page, 1600);
    ok(await page.evaluate(() => { const c = document.querySelector('[data-chestcard="fuse"]'), sc = document.querySelector('#s-shop .scroll'); if (!c) return false; const a = c.getBoundingClientRect(), b = sc.getBoundingClientRect(); return BR.Router.current === 'shop' && a.top >= b.top - 2 && a.bottom <= b.bottom + 2 && c.classList.contains('pulse'); }), '"Show me the chest" did not land on the chest and pulse it');
    await page.evaluate(() => { BR.Storage.data.profile.coins = 900; });

    // Missions: one swap a day says so, the other swap buttons say why, and Undo gives the Coins and the mission back
    await page.evaluate(() => { const m = BR.Missions.ensure(); m.rerolls = 0; m.list.forEach((x) => { x.done = false; x.progress = 0; }); BR.Router.screens.missions.tab = 'daily'; BR.Router.go('missions'); }); await wait(page, 900);
    ok(await page.evaluate(() => /One swap a day/.test(document.querySelector('.reset-note').textContent)), 'nothing says the swap is once a day');
    const m0 = await page.evaluate(() => ({ text: BR.Missions.ensure().list[0].text, coins: BR.Progress.coins }));
    await page.click('.reroll[data-i="0"]'); await wait(page, 600);
    const m1 = await page.evaluate(() => ({ text: BR.Missions.ensure().list[0].text, coins: BR.Progress.coins, off: [...document.querySelectorAll('.reroll')].map((b) => b.classList.contains('off')), why: document.querySelector('.reroll.off') && document.querySelector('.reroll.off').dataset.why }));
    ok(m1.text !== m0.text && m1.coins === m0.coins - 30, 'the swap did not swap and charge', JSON.stringify([m0, m1]));
    ok(m1.off.length >= 2 && m1.off.every(Boolean) && /already swapped/.test(m1.why || ''), 'the other swap buttons did not stay visible and say why', JSON.stringify(m1));
    await page.click('.reroll.off', { force: true }); await wait(page, 300);
    ok(await page.evaluate(() => [...document.querySelectorAll('.toast')].some((t) => /already swapped/.test(t.textContent))), 'tapping a disabled swap did not explain itself');
    const tg = await page.evaluate(() => { const t = document.querySelector('.toast.has-act'), seg = document.getElementById('misSeg').getBoundingClientRect(), tb = document.getElementById('tabbar').getBoundingClientRect(); const r = t.getBoundingClientRect(); return { h: r.height, bottom: r.bottom, tabTop: tb.top, overlapsSeg: !(r.bottom < seg.top || r.top > seg.bottom), n: document.querySelectorAll('#toasts .toast').length, oneLine: getComputedStyle(t).whiteSpace }; });
    ok(tg.overlapsSeg === false && tg.bottom <= tg.tabTop && tg.n <= 2 && tg.oneLine === 'nowrap', 'a toast covers the Missions control or the tab bar, wraps, or stacks three', JSON.stringify(tg));
    await page.click('.toast .t-act'); await wait(page, 500);
    ok(await page.evaluate((m) => BR.Missions.ensure().list[0].text === m.text && BR.Progress.coins === m.coins, m0), 'Undo did not give back the mission and the Coins');
    ok(await page.evaluate(() => BR.Missions.ensure().rerolls === 0), 'Undo did not restore the daily swap');
    // a finished weekly challenge looks finished
    await page.evaluate(() => { const w = BR.Missions.ensure().weekly; w.done = true; w.progress = w.target; BR.Router.rerender(); }); await wait(page, 300);
    ok(await page.evaluate(() => { const w = document.querySelector('.mission.weekly'); return w.classList.contains('done') && /Paid/.test(w.textContent) && !!w.querySelector('.m-ico svg') && /Golden Chest/.test(w.textContent); }), 'a finished weekly challenge has no Done look');
    // a segment opens with its thumb under the active tab (the stagger's --i once overwrote the segment's index, so the thumb sat on the first tab)
    for (const tab of ['pass', 'trophies', 'daily']) {
      await page.evaluate((tab) => { BR.Router.go('home'); BR.Router.screens.missions.tab = tab; BR.Router.go('missions'); }, tab); await wait(page, 900);
      const th = await page.evaluate(() => { const seg = document.getElementById('misSeg'), t = seg.querySelector('.thumb').getBoundingClientRect(), on = seg.querySelector('button.on').getBoundingClientRect(); return { dx: Math.abs((t.left + t.right) / 2 - (on.left + on.right) / 2) }; });
      ok(th.dx < 3, 'the Missions thumb is not under the active tab on arrival', tab, JSON.stringify(th));
    }
    await page.evaluate(() => { BR.Router.go('collection'); BR.Router.screens.collection.type = 'board'; BR.Router.rerender(); }); await wait(page, 900);
    ok(await page.evaluate(() => { const seg = document.getElementById('colSeg'), t = seg.querySelector('.thumb').getBoundingClientRect(), on = seg.querySelector('button.on').getBoundingClientRect(); return Math.abs((t.left + t.right) / 2 - (on.left + on.right) / 2) < 3; }), 'the Collection thumb is not under the active type on arrival');
    await page.evaluate(() => { BR.Router.screens.collection.type = 'skin'; });
    // the Pass: a claimed Coins tier says when it was paid
    await page.evaluate(() => { BR.rewardSheet(1); }); await wait(page, 700);
    ok(await page.evaluate(() => /Paid when you reached level/.test(document.querySelector('.sheet.on .detail-desc').textContent) && !/right away/.test(document.querySelector('.sheet.on').textContent)), 'a claimed Coins tier says the Coins come right away');
    await esc(page);

    // Home: a finished week stops promising the shield, and the weeks are shown; a new player sees no placeholder stats
    await page.evaluate(() => { const k = BR.dayKey(); BR.Storage.data.profile.streak = { ring: 7, weeks: 2, last: k, shield: 1, best: 14 }; BR.Router.go('home'); BR.Router.rerender(); }); await wait(page, 800);
    ok(await page.evaluate(() => { const t = document.querySelector('.streak-card').textContent; return /Week complete/.test(t) && !/forgiven/.test(t) && /2 weeks finished/.test(t); }), 'the finished-week card still promises a forgiven day, or hides the weeks', await page.evaluate(() => document.querySelector('.streak-card').textContent));
    await page.evaluate(() => { const st = BR.Storage.data; st.best.rush = 0; st.bestStage.rush = 0; st.recent.rush = []; BR.Router.rerender(); }); await wait(page, 300);
    ok(await page.evaluate(() => { const t = document.querySelector('.hero-stats').textContent; return !/Stage\s*-/.test(t) && /first/i.test(t); }), 'a new player sees "BEST 0 · STAGE -"');
    ok(await page.evaluate(() => /Pass level 7/.test(document.querySelector('.pass-card').textContent) && !/Next reward/.test(document.querySelector('.pass-card').textContent)), 'the Pass card does not say "Next: Pass level 7"');

    ok(errors.length === 0, 'console errors (portrait)', errors.slice(0, 3).join(' | '));
    await browser.close();
  }

  // ---------------------------------------------------------------- the hero never overflows, at the small sizes and with Larger text; Play stays above the tab bar
  if (want('hero')) for (const [w, h] of [[360, 640], [375, 667], [393, 852], [430, 932]]) {
    for (const large of [false, true]) {
      const { browser, page } = await launch({ width: w, height: h, dsf: 1, mobile: true });
      await player(page, { large, resume: w < 400, runs: 12 });
      await page.evaluate(() => { BR.Storage.data.boostsLast = ['longFuse', 'headStart', 'rushStart']; BR.Router.rerender(); }); await wait(page, 500);
      // every piece of content (the glow that is cut off on purpose aside) lies inside the card; a text column may not push the art or Play out of it
      const r = await page.evaluate(() => { const H = document.querySelector('.hero'), p = document.querySelector('.hero-play').getBoundingClientRect(), hb = H.getBoundingClientRect(), a = document.querySelector('.hero-art').getBoundingClientRect(), tb = document.getElementById('tabbar').getBoundingClientRect(), c = document.querySelector('.chip-boost').getBoundingClientRect(); let out = 0; H.querySelectorAll('*').forEach((e) => { if (e.closest('.hero-glow') || e.closest('svg') || e.classList.contains('hero-glow')) return; const b = e.getBoundingClientRect(); if (!b.width) return; if (b.right > hb.right + 0.5 || b.left < hb.left - 0.5) out++; }); const cx = (p.left + p.right) / 2 - (hb.left + hb.right) / 2; return { over: Math.round(p.right - hb.right), under: Math.round(hb.left - p.left), artOver: Math.round(a.right - hb.right), out, playOffCentre: Math.round(cx), playBottom: Math.round(p.bottom), tabTop: Math.round(tb.top), chipOver: Math.round(c.right - hb.right) }; });
      ok(r.over <= 0 && r.under <= 0 && r.artOver <= 0 && r.out === 0 && Math.abs(r.playOffCentre) <= 1 && r.chipOver <= 0, `the hero overflows or Play is off centre at ${w}x${h}${large ? ' with Larger text' : ''}`, JSON.stringify(r));
      if (!large) ok(r.playBottom <= r.tabTop, `Play is below the tab bar at ${w}x${h}`, JSON.stringify(r));
      await browser.close();
    }
  }

  // ---------------------------------------------------------------- Larger text is one type scale; no zoom
  if (want('large')) {
    const sizes = {};
    for (const large of [false, true]) {
      const { browser, page } = await launch({ width: 393, height: 852, dsf: 1, mobile: true });
      await player(page, { large });
      await page.evaluate(() => { BR.Router.go('collection'); }); await wait(page, 900);
      await page.evaluate(() => BR.coinSheet()); await wait(page, 800);
      await page.evaluate(() => BR.toast('Marble equipped', 'good')); await wait(page, 600);
      sizes[large] = await page.evaluate(() => { const fs = (s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize); return { tab: fs('#tabbar .tab span'), title: fs('#tbTitle'), sheetTitle: fs('.sheet.on h2'), sheetBody: fs('.sheet.on .cs-next p'), toast: fs('.toast'), seg: fs('#colSeg button'), zoomScroll: getComputedStyle(document.querySelector('.screen.on .scroll')).zoom, zoomSheet: getComputedStyle(document.querySelector('.sheet.on .sheet-body')).zoom, chips: fs('.chip-btn') }; });
      await browser.close();
    }
    const a = sizes[false], b = sizes[true];
    for (const k of ['tab', 'title', 'sheetTitle', 'sheetBody', 'toast', 'seg', 'chips']) ok(Math.abs(b[k] / a[k] - 1.14) < 0.02, `Larger text does not scale ${k}`, a[k], b[k]);
    ok(a.zoomScroll === '1' && b.zoomScroll === '1' && b.zoomSheet === '1', 'Larger text still uses zoom', JSON.stringify(b));
  }
  // Larger text at the narrowest phone: no label runs into another, the chips wrap inside the screen
  if (want('large')) {
    const { browser, page } = await launch({ width: 360, height: 640, dsf: 1, mobile: true });
    await player(page, { large: true });
    await page.evaluate(() => BR.Router.go('collection')); await wait(page, 1600);
    const o = await page.evaluate(() => { const segs = [...document.querySelectorAll('#colSeg button')].map((b) => b.getBoundingClientRect()); const overlap = segs.some((a, i) => i && a.left < segs[i - 1].right - 1); const clipped = [...document.querySelectorAll('#colSeg button')].some((b) => b.scrollWidth > b.clientWidth + 1); const chips = [...document.querySelectorAll('.chip-btn')].map((b) => b.getBoundingClientRect()); const out = chips.some((c) => c.right > innerWidth + 0.5 || c.left < -0.5); const clipChip = [...document.querySelectorAll('.chip-btn')].some((b) => b.scrollWidth > b.clientWidth + 1); const tb = document.getElementById('tbTitle'); return { overlap, clipped, out, clipChip, titleCut: tb.scrollWidth > tb.clientWidth + 1 }; });
    ok(!o.overlap && !o.clipped && !o.out && !o.clipChip && !o.titleCut, 'Larger text at 360 overlaps, clips or runs off the screen', JSON.stringify(o));
    await browser.close();
  }

  // ---------------------------------------------------------------- Reduce Motion: no stagger delays
  if (want('reduced')) {
    const { browser, page } = await launch({ width: 393, height: 852, dsf: 1, mobile: true });
    await player(page, { reduced: true });
    await page.evaluate(() => BR.Router.go('shop')); await wait(page, 40);
    const r = await page.evaluate(() => [...document.querySelectorAll('#s-shop .stg')].map((n) => { const c = getComputedStyle(n); return { op: +c.opacity, name: c.animationName, delay: c.animationDelay }; }));
    ok(r.length > 3 && r.every((x) => x.op === 1 && (x.name === 'none' || parseFloat(x.delay) === 0)), 'Reduce Motion still staggers the blocks in', JSON.stringify(r.slice(0, 4)));
    ok(await page.evaluate(() => !document.querySelector('.screen.leaving')), 'Reduce Motion keeps the old screen to fade it');
    await browser.close();
  }
  // normal motion: the stagger is capped (the last block starts within 250 ms)
  if (want('reduced')) {
    const { browser, page } = await launch({ width: 393, height: 852, dsf: 1, mobile: true });
    await player(page, {});
    await page.evaluate(() => BR.Router.go('shop')); await wait(page, 40);
    const d = await page.evaluate(() => [...document.querySelectorAll('#s-shop .stg')].map((n) => parseFloat(getComputedStyle(n).animationDelay) * 1000));
    ok(Math.max(...d) <= 250, 'the stagger runs past 250 ms', Math.max(...d));
    await browser.close();
  }

  // ---------------------------------------------------------------- landscape: Play above the fold, a two-column hero, sheets that show their body
  if (want('landscape')) for (const [w, h] of [[844, 390], [932, 430], [667, 375]]) {
    for (const resume of [false, true]) {
      const { browser, page } = await launch({ width: w, height: h, dsf: 1, mobile: true });
      await player(page, { resume });
      await page.evaluate(() => { BR.Storage.data.boostsLast = ['longFuse', 'headStart', 'rushStart']; BR.Router.rerender(); }); await wait(page, 600);
      const r = await page.evaluate(() => { const p = document.querySelector('.hero-play').getBoundingClientRect(), t = document.getElementById('topbar').getBoundingClientRect(), hero = document.querySelector('.hero').getBoundingClientRect(), r = document.querySelector('.resume'), rb = r && r.getBoundingClientRect(), c = document.querySelector('.chip-boost').getBoundingClientRect(); return { playTop: p.top, playBottom: p.bottom, vh: innerHeight, topbar: t.bottom, heroRight: hero.right, vw: innerWidth, resumeVisible: r ? rb.bottom <= innerHeight : null, chipBottom: c.bottom, chipRight: c.right, heroR: hero.right }; });
      ok(r.playBottom <= r.vh - 4 && r.playTop >= r.topbar - 2, `Play is not above the fold in landscape ${w}x${h}${resume ? ' with Resume' : ''}`, JSON.stringify(r));
      ok(r.resumeVisible !== false, `the Resume card is below the fold in landscape ${w}x${h}`, JSON.stringify(r));
      ok(r.chipRight <= r.heroR + 1, `the Boosts chip runs out of the hero in landscape ${w}x${h}`, JSON.stringify(r));
      ok(await page.evaluate(() => document.querySelector('.hero').getBoundingClientRect().right < document.querySelector('.resume, .row2').getBoundingClientRect().left + 4), `the landscape Home is not two columns at ${w}x${h}`);
      await browser.close();
    }
  }
  if (want('landscape')) {
    const { browser, page, errors } = await launch({ width: 844, height: 390, dsf: 1, mobile: true });
    await player(page, {});
    const sheets = [['coins', () => BR.coinSheet()], ['ready', () => BR.readySheet('rush')], ['settings', () => BR.settingsSheet()], ['odds', () => BR.showOdds('brick')], ['item', () => { const v = BR.Storage.data.profile.vault.find((x) => BR.itemById[x.itemId].type === 'skin'); BR.itemSheet(v.uid, 'skin'); }]];
    for (const [name, fn] of sheets) {
      await page.evaluate(fn); await wait(page, 1100);
      const s = await page.evaluate(() => { const e = document.querySelector('.sheet.on'), b = e.getBoundingClientRect(), body = e.querySelector('.sheet-body'), t = document.querySelector('#toastsTop').getBoundingClientRect(); return { w: b.width, cx: (b.left + b.right) / 2, vw: innerWidth, top: b.top, bottom: b.bottom, vh: innerHeight, bodyH: body.clientHeight, scrolls: body.scrollHeight > body.clientHeight + 2, fade: body.dataset.fade || '', toastBottom: t.top + 44 }; });
      ok(s.w <= 560.5 && Math.abs(s.cx - s.vw / 2) <= 2, `the ${name} sheet is not a centred dialog of at most 560px in landscape`, JSON.stringify(s));
      ok(s.top >= 50 && s.bottom <= s.vh - 8, `the ${name} sheet runs into the toast strip or the edge in landscape`, JSON.stringify(s));
      ok(s.bodyH >= 150, `the ${name} sheet shows only ${Math.round(s.bodyH)}px of its body in landscape`, JSON.stringify(s));
      ok(!s.scrolls || s.fade.includes('b'), `the ${name} sheet scrolls with no fade at its edge`, JSON.stringify(s));
      await page.evaluate(() => { while (BR.Back.depth) BR.Back.closeTop(); }); await wait(page, 650);
    }
    // the pause sheet is two columns in landscape
    await page.evaluate(() => { BR.Sheet.open({ center: true, title: 'Paused', body: '<div class="stack pause-list"><button class="btn btn-xl" data-p="resume">Resume</button><button class="btn btn-dark">Restart</button><button class="btn btn-dark">Sound</button><button class="btn btn-dark">End run</button><button class="btn btn-text">Save and leave</button></div>' }); }); await wait(page, 800);
    ok(await page.evaluate(() => { const b = [...document.querySelectorAll('.sheet.on .pause-list .btn')].map((x) => x.getBoundingClientRect()); return b[1].top === b[2].top && b[1].left < b[2].left && document.querySelector('.sheet.on').getBoundingClientRect().height <= innerHeight - 8; }), 'the pause sheet is not two columns in landscape');
    ok(errors.length === 0, 'console errors (landscape)', errors.slice(0, 3).join(' | '));
    await browser.close();
  }

  // ---------------------------------------------------------------- desktop: sheets and screens at most 560px, the Pass track answers the wheel and has arrows
  if (want('desktop')) {
    const { browser, page, errors } = await launch({ width: 1280, height: 800, dsf: 1, mobile: false });
    await player(page, {});
    const w0 = await rect(page, '#topbar'); ok(w0.w <= 560.5, 'the status bar spans the desktop', w0.w);
    await page.evaluate(() => BR.coinSheet()); await wait(page, 900);
    const s = await rect(page, '.sheet.on'); ok(s.w <= 560.5 && Math.abs((s.l + s.r) / 2 - 640) <= 2, 'a desktop sheet is wider than 560px or off centre', JSON.stringify(s));
    const b = await page.evaluate(() => Math.max(...[...document.querySelectorAll('.sheet.on .sheet-actions .btn')].map((x) => x.getBoundingClientRect().width)));
    ok(b <= 560, 'a desktop sheet button is as wide as the page', b);
    await esc(page);
    await page.evaluate(() => { BR.Router.screens.missions.tab = 'pass'; BR.Router.go('missions'); }); await wait(page, 1800);
    const x0 = await page.evaluate(() => document.getElementById('passTrack').scrollLeft);
    const tr = await rect(page, '#passTrack');
    await page.mouse.move(tr.l + tr.w / 2, tr.t + tr.h / 2); await page.mouse.wheel(0, 260); await wait(page, 400);
    const x1 = await page.evaluate(() => document.getElementById('passTrack').scrollLeft);
    ok(Math.abs(x1 - x0) > 100, 'the mouse wheel does not scroll the Pass track', [x0, x1]);
    ok(await page.evaluate(() => { const a = document.querySelector('.track-arrow.r'); return a && getComputedStyle(a).display !== 'none' && a.getBoundingClientRect().width >= 44; }), 'no arrows on the Pass track on desktop');
    await page.click('.track-arrow.l'); await wait(page, 700);
    const x2 = await page.evaluate(() => document.getElementById('passTrack').scrollLeft);
    ok(x2 < x1 - 100, 'the left arrow does not page the Pass track', [x1, x2]);
    // keyboard: arrows walk tile to tile
    await page.evaluate(() => document.querySelector('.pt[data-tier="6"]').focus()); await page.keyboard.press('ArrowRight');
    ok(await page.evaluate(() => document.activeElement.dataset.tier === '7'), 'the arrow key does not move to the next Pass tile');
    ok(errors.length === 0, 'console errors (desktop)', errors.slice(0, 3).join(' | '));
    await browser.close();
  }

  // ---------------------------------------------------------------- Graphics: Smooth still lays out the menus
  if (want('smooth')) {
    const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1, mobile: true });
    await player(page, {});
    await page.evaluate(() => { BR.Storage.data.settings.perf = 'low'; BR.App.applySettings(); });
    for (const t of ['shop', 'collection', 'missions', 'profile', 'home']) { await page.evaluate((t) => BR.Router.go(t), t); await wait(page, 500); }
    ok(errors.length === 0, 'console errors (Smooth)', errors.slice(0, 3).join(' | '));
    await browser.close();
  }

  console.log(problems ? problems + ' PROBLEMS' : 'u5-menus ok');
  process.exit(problems ? 1 : 0);
})();
