// Update 5, chest openings and the results' links to them: a press during the ring's drain is picked up, a complete chest offers no hold
// (and spare chests of a finished set become Coins), the streak banner shows what it really paid, the landing ring is behind the cards,
// toasts only appear between openings, the app hides only once the opening is opaque, every reveal shows the item's badge from the first
// frame, the first look on the board sits behind the card, a tap skips, the Midnight reveal for Series 4 Legendary and Mythic items
// (with Reduce Motion: still), results "Chests" opens the chest directly. Usage: node tests/u5-chests.js
const { launch } = require('./lib');

let problems = 0;
const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };

async function boot(o = {}) {
  const L = await launch(Object.assign({ width: 393, height: 852, dsf: 1 }, o));
  await L.page.evaluate(() => {
    const D = BR.Storage.data; D.seenTutorial = true; D.runs = 8; D.settings.sound = false; D.settings.music = false; D.settings.haptics = false; D.settings.perf = 'high';
    D.profile.coins = 9999; BR.App.applySettings(); BR.Storage.save();
  });
  await L.page.waitForTimeout(900);
  await L.page.evaluate(() => { BR.Coach.markAllSeen(); for (let i = 0; i < 5 && BR.Back.depth; i++) BR.Back.closeTop(); });
  return L;
}
const openChest = async (page, id) => {
  await page.evaluate((id) => { BR.App.openChest(id); }, id);
  await page.waitForFunction(() => BR.Openings.current && !BR.Openings.current.closed && BR.Openings.current.state === 'ready', null, { timeout: 15000 });
};
const closeChest = async (page) => {
  await page.evaluate(() => BR.Openings.current && BR.Openings.current.close(false));
  await page.waitForFunction(() => !document.querySelector('.opening'), null, { timeout: 5000 });
};
/** Start a reveal of a given item without the hold and the reel (the same code the opening runs after the reel). */
const forceReveal = (page, id, shine = 'glossy') => page.evaluate(({ id, shine }) => {
  const it = BR.itemById[id], P = BR.Progress;
  const drop = { itemId: id, type: it.type, rarity: it.rarity, shine, seed: 1234, chest: 'brick' };
  drop.inst = P.keep(drop);
  const op = BR.Openings.current;
  op.reelWrap.classList.remove('on'); op.root.classList.add('revealing');
  window.__rvStart = performance.now();
  op.reveal(drop);
}, { id, shine });

(async () => {
  const { browser, page, errors } = await boot();
  const mouseHold = async (ms) => { const box = await page.locator('.hold').boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(ms); };

  console.log("..", "the app hides only once the opening is opaque".slice(0, 60));
  await page.evaluate(() => { BR.App.openChest('brick'); });
  await page.waitForTimeout(120);
  const early = await page.evaluate(() => ({ cls: document.body.classList.contains('in-opening'), vis: getComputedStyle(document.getElementById('screens')).visibility, op: +getComputedStyle(document.querySelector('.opening')).opacity }));
  ok(!early.cls && early.vis === 'visible' && early.op < 0.98, 'the app is hidden before the opening is opaque (a black frame): ' + JSON.stringify(early));
  await page.waitForFunction(() => BR.Openings.current.state === 'ready', null, { timeout: 15000 });
  const late = await page.evaluate(() => ({ cls: document.body.classList.contains('in-opening'), op: +getComputedStyle(document.querySelector('.opening')).opacity }));
  ok(late.cls && late.op >= 0.98, 'the app stays on show under the finished opening: ' + JSON.stringify(late));

  console.log("..", "C-1: a press during the drain is picked up".slice(0, 60));
  const before = await page.evaluate(() => ({ coins: BR.Progress.coins, opened: BR.Storage.data.profile.opened }));
  await mouseHold(500); await page.mouse.up(); await page.waitForTimeout(100);
  const st1 = await page.evaluate(() => ({ s: BR.Openings.current.state, h: BR.Openings.current.hold }));
  ok(st1.s === 'holding' && st1.h > 0.05, 'the ring is not draining after a short release: ' + JSON.stringify(st1));
  await page.mouse.down();                               // pressed again while the ring drains
  await page.waitForFunction(() => ['burst', 'spin', 'reveal', 'done'].includes(BR.Openings.current.state), null, { timeout: 2600 })
    .catch(() => ok(false, 'a second press during the drain was ignored (the ring never filled)'));
  await page.mouse.up();
  const after = await page.evaluate(() => ({ coins: BR.Progress.coins, opened: BR.Storage.data.profile.opened }));
  ok(after.opened === before.opened + 1, 'the chest was not opened after the re-press');
  // the opening runs on: skip the reel, then the reveal (a tap skips), and check the landing ring sits under the cards
  await page.waitForFunction(() => BR.Openings.current.state === 'spin' && BR.Openings.current.reel && BR.Openings.current.reel.t > 1.6, null, { timeout: 20000 });
  await page.evaluate(() => { BR.Openings.current.reel.skip(); });
  await page.waitForFunction(() => document.querySelector('.reel-ring'), null, { timeout: 12000 }).catch(() => ok(false, 'no landing ring was drawn in the reel'));
  const ringOk = await page.evaluate(() => { const r = document.querySelector('.reel-ring'), s = document.querySelector('.reel-strip'); return r && s && r.parentNode === s.parentNode && !!(r.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING); });
  ok(ringOk, 'the landing ring is not behind the reel\'s cards');
  await page.waitForFunction(() => BR.Openings.current.state === 'done' || BR.Openings.current.state === 'reveal', null, { timeout: 20000 });
  await page.evaluate(() => BR.Openings.current._tl && BR.Openings.current._tl.skip());
  await page.waitForSelector('.rv.on .rv-actions.on', { timeout: 8000 });
  await closeChest(page);

  console.log("..", "C-6: toasts only between openings".slice(0, 60));
  await openChest(page, 'brick');
  await page.evaluate(() => { BR.toast('A toast during the opening', 'good'); });
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => !document.querySelector('#toasts .toast')), 'a toast was shown during an opening');
  await page.evaluate(() => BR.Openings.current.close(false));
  await page.waitForTimeout(260);
  await page.evaluate(() => { BR.App.openChest('pop'); });                     // the next opening starts before the held toasts would be released
  await page.waitForTimeout(1500);
  ok(await page.evaluate(() => !document.querySelector('#toasts .toast')), 'a held toast landed on the next opening');
  await page.waitForFunction(() => BR.Openings.current.state === 'ready', null, { timeout: 15000 });
  await page.evaluate(() => BR.Openings.current.close(false));
  await page.waitForFunction(() => document.querySelector('#toasts .toast'), null, { timeout: 3000 }).catch(() => ok(false, 'the held toast never came after the last opening closed'));
  await page.waitForFunction(() => !document.querySelector('#toasts .toast') && !document.querySelector('.opening'), null, { timeout: 6000 });

  console.log("..", "C-5 / A-6: the badge on every reveal card from the first frame; C-7 the look behind it".slice(0, 60));
  const ITEMS = [['f_candy', 'common'], ['f_marble', 'rare'], ['a_orbit', 'epic'], ['f_lava', 'legendary'], ['f_sigil', 'mythic'], ['u_runechain', 'legendary'], ['b_pixel', 'epic']];
  await openChest(page, 'brick');
  for (const [id, rar] of ITEMS) {
    // one in-page loop samples the reveal every 25 ms from the moment it is called (no round trips, so a busy machine cannot skew the times)
    const samples = await page.evaluate(({ id, shine }) => new Promise((resolve) => {
      const it = BR.itemById[id], P = BR.Progress;
      const drop = { itemId: id, type: it.type, rarity: it.rarity, shine, seed: 1234, chest: 'brick' };
      drop.inst = P.keep(drop);
      const op = BR.Openings.current;
      op.reelWrap.classList.remove('on'); op.root.classList.add('revealing');
      const vis = (el) => { if (!el) return 0; let o = 1; for (let n = el; n && n !== document.body; n = n.parentElement) o *= +getComputedStyle(n).opacity; const w = el.offsetWidth || el.getBoundingClientRect().width, h = el.offsetHeight || el.getBoundingClientRect().height; return w > 20 && h > 20 ? o : 0; };   // (the layout box: the flip of the card must not make its contents "invisible" edge-on)
      const q = (s) => document.querySelector(s);
      const out = [], t0 = performance.now();
      op.reveal(drop);
      const take = () => {
        const t = Math.round(performance.now() - t0);
        out.push({ t, dom: !!q('.rv-art .rv-badge-big .bdg') || !!q('.rv-art .rv-demo > *'), badge: Math.max(vis(q('.rv-art .rv-badge-big .bdg')), vis(q('.rv-art .rv-demo'))), seed: vis(q('.rv-seed .bdg')), card: vis(q('.rv-card')), cls: q('.rv').className });
        if (t < 1500) setTimeout(take, 25); else resolve(out);
      };
      take();
    }), { id, shine: 'glossy' });
    const night = /^(f_sigil|u_runechain)$/.test(id);
    const seen = (s) => s.badge > 0.3 || s.seed > 0.3;
    // the badge is on the card the moment the reveal is called (nothing to wait for), and the item is on screen in EVERY sample once the card has
    // had 250 ms. (Times are counted from the first frame in which the card or the dim seed shows: a busy machine can start the animation late,
    // and sampling is only as steady as the machine is.)
    const first = samples.find((s) => s.card > 0.05 || s.seed > 0.05);
    const tc = first ? first.t : 0;
    ok(samples[0].dom, `${id}: no badge on the card in the first frame`, JSON.stringify(samples[0]));
    ok(!!first, `${id}: neither the card nor the seed ever showed`, JSON.stringify(samples.slice(0, 6)));
    ok(samples.filter((s) => s.t >= tc + 250 && s.t < 1400).every(seen), `${id}: the item is off screen at ${samples.filter((s) => s.t >= tc + 250 && s.t < 1400 && !seen(s)).map((s) => s.t)} ms (card first showed at ${tc})`, JSON.stringify(samples.filter((s) => s.t >= tc && s.t < 1400).filter((s, i) => i % 6 === 0)));
    // no empty card: whenever the card shows, the item shows with it
    ok(samples.filter((s) => s.card > 0.2).every((s) => Math.max(s.badge, s.seed) >= s.card * 0.5), `${id}: an empty card at ${samples.filter((s) => s.card > 0.2 && Math.max(s.badge, s.seed) < s.card * 0.5).map((s) => s.t)} ms`, JSON.stringify(samples.filter((s) => s.card > 0.2).slice(0, 4)));
    ok(night === samples[samples.length - 1].cls.includes('night'), `${id}: ${night ? 'should use' : 'should not use'} the Midnight reveal`, samples[samples.length - 1].cls);
    // the first look behind the card: a whole board, wearing the item when it is a skin or a board
    await page.waitForFunction(() => document.querySelector('.rv.look-on'), null, { timeout: 8000 }).catch(() => ok(false, `${id}: the look never switched on`));
    const look = await page.evaluate(() => { const f = document.querySelector('.rv-look .lk-field'); return f && { n: f.querySelectorAll('.brick').length, cls: f.className, scene: document.querySelector('.rv-look .lk').className, op: +getComputedStyle(document.querySelector('.rv-look')).opacity }; });
    ok(look && look.n === 64, `${id}: the first look is not a whole board`, JSON.stringify(look));
    if (id === 'f_lava') ok(look && /skin-lava/.test(look.cls), 'the first look does not wear the new skin', look && look.cls);
    if (id === 'a_orbit') ok(look && /board-orbit/.test(look.scene), 'the first look does not show the new board', look && look.scene);
    await page.evaluate(() => BR.Openings.current._tl && BR.Openings.current._tl.skip());
    await page.waitForSelector('.rv.on .rv-actions.on', { timeout: 8000 });
    // reset for the next reveal (the opening stays open)
    await page.evaluate(() => { const op = BR.Openings.current; op.rv.classList.remove('on'); op.rv.className = 'rv'; if (op.demo) op.demo.stop(); op.state = 'ready'; });
  }
  await closeChest(page);

  console.log("..", "the Midnight reveal in detail (Mythic: the full sequence)".slice(0, 60));
  await openChest(page, 'brick');
  await forceReveal(page, 'f_sigil');
  const at = {};
  for (const ms of [250, 700, 1000, 1500, 2300]) {
    await page.waitForTimeout(ms - (at.last || 0)); at.last = ms;
    at[ms] = await page.evaluate(() => { const g = (s) => document.querySelector(s); const o = (s) => +getComputedStyle(g(s)).opacity; return { cls: g('.rv').className, moon: o('.rv-moon'), circle: o('.rv-circle'), stars: o('.rv-stars'), seed: o('.rv-seed'), card: o('.rv-card'), banner: g('.rv-banner').textContent, sig: !!g('.rc-sig .sg').innerHTML.trim() }; });
  }
  ok(at[250].cls.includes('night') && at[250].stars > 0.2 && at[250].seed > 0.2, 'night has not fallen with stars and the badge by 250 ms', JSON.stringify(at[250]));
  ok(at[700].moon > 0.6, 'the moon has not risen by 700 ms', JSON.stringify(at[700]));
  ok(at[1000].circle > 0.9 && at[1000].sig, 'the spell circle (with its sigil) is not drawn by 1000 ms', JSON.stringify(at[1000]));
  ok(at[1500].card > 0.5 && /Mythic/.test(at[1500].banner) && at[1500].cls.includes('eclipse'), 'the card has not eclipsed the moon by 1500 ms', JSON.stringify(at[1500]));
  // a tap skips to the card
  await page.evaluate(() => { const op = BR.Openings.current; op.rv.classList.remove('on'); op.rv.className = 'rv'; op.state = 'ready'; });
  await forceReveal(page, 'f_sigil'); await page.waitForTimeout(500);
  await page.mouse.click(20, 300);
  await page.waitForSelector('.rv.on .rv-actions.on', { timeout: 1500 }).catch(() => ok(false, 'a tap did not skip the reveal to the card'));
  ok(await page.evaluate(() => { const c = document.querySelector('.rv-card'); return +getComputedStyle(c).opacity === 1 && /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(getComputedStyle(c).transform); }), 'after a skip the card is not parked in place');
  await page.evaluate(() => { const op = BR.Openings.current; op.rv.classList.remove('on'); op.rv.className = 'rv'; op.state = 'ready'; });
  // the Legendary's short version has the moon but no spell circle
  await forceReveal(page, 'u_runechain'); await page.waitForTimeout(1200);
  const sh = await page.evaluate(() => ({ cls: document.querySelector('.rv').className, moon: +getComputedStyle(document.querySelector('.rv-moon')).opacity }));
  ok(sh.cls.includes('night') && sh.moon > 0.6 && !sh.cls.includes('circle-on'), 'the Legendary Midnight is not moon and corona only', JSON.stringify(sh));
  await page.waitForSelector('.rv.on .rv-actions.on', { timeout: 8000 });
  await closeChest(page);
  // Reduce Motion: the card and the moon, still
  await page.evaluate(() => { BR.Storage.data.settings.reduced = true; BR.App.applySettings(); });
  await openChest(page, 'brick');
  await forceReveal(page, 'f_sigil');
  await page.waitForTimeout(500);
  const rd = await page.evaluate(() => { const o = (s) => +getComputedStyle(document.querySelector(s)).opacity; return { card: o('.rv-card'), moon: o('.rv-moon'), banner: o('.rv-banner'), tf: getComputedStyle(document.querySelector('.rv-card')).transform, sigil: o('.rv-circle') }; });
  ok(rd.card === 1 && rd.moon === 1 && rd.banner === 1 && /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(rd.tf), 'Reduce Motion does not show the card and the moon still', JSON.stringify(rd));
  await closeChest(page);
  await page.evaluate(() => { BR.Storage.data.settings.reduced = false; BR.App.applySettings(); });

  console.log("..", "C-2: a complete chest offers no hold; spare chests of a finished set become Coins".slice(0, 60));
  await page.evaluate(() => { BR.DROP_ITEMS.filter((x) => x.type === 'skin').forEach((x) => BR.Progress.keep({ itemId: x.id, shine: 'plain', seed: 1 })); });
  await openChest(page, 'brick').catch(() => {});
  await page.waitForFunction(() => BR.Openings.current && BR.Openings.current.state === 'ready', null, { timeout: 15000 });
  const cm = await page.evaluate(() => ({ off: document.querySelector('.hold').classList.contains('off'), label: document.querySelector('[data-label]').textContent, can: BR.Openings.current.canOpen, complete: BR.Openings.current.complete }));
  ok(cm.off && !cm.can && cm.complete && /complete/i.test(cm.label), 'a complete chest still offers a hold', JSON.stringify(cm));
  const box = await page.locator('.hold').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up();
  ok(await page.evaluate(() => BR.Openings.current.state === 'ready' && BR.Openings.current.hold === 0), 'pressing a complete chest started a hold');
  await closeChest(page);

  console.log("..", "results: spare chests, the streak banner, Chests to the opening, scores, the board");
  await page.close();
  await browser.close();
  const R = await boot();
  const rp = R.page;
  const startAndEnd = async (setup) => {
    await rp.evaluate(() => { if (BR.Run.resultsEl) BR.Run.closeResults(); BR.Router.go('home', { instant: true }); });
    await rp.evaluate(() => __app.startRun({ mode: 'rush', boosts: {} }));
    await rp.waitForFunction(() => BR.Run.clock && !BR.Run.busy && BR.Router.current === 'run', null, { timeout: 15000 });
    if (setup) await rp.evaluate(setup);
    const t = await rp.evaluate(() => { const e = BR.Run.engine; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (e.plan(r, c)) return { r, c }; });
    await rp.evaluate(({ r, c }) => BR.Run.tap(r, c), t);
    await rp.evaluate(({ r, c }) => BR.Run.tap(r, c), t);
    await rp.waitForFunction(() => BR.Run.engine.stats.pops > 0, null, { timeout: 8000 }).catch(async () => console.log("NO POP", JSON.stringify(await rp.evaluate(() => ({ busy: BR.Run.busy, canAct: BR.Run.canAct, paused: BR.Run.paused, modal: BR.Run.modal, over: BR.Run.over, clock: BR.Run.clock, cur: BR.Router.current })))));
    await rp.evaluate(() => BR.Run.endRun('ended'));
    await rp.waitForSelector('.results.on', { timeout: 15000 });
  };
  // 1) the day-7 streak with the Golden set finished pays Coins instead of the chest, and the banner says so
  await rp.evaluate(() => {
    const P = BR.Progress; BR.DROP_ITEMS.filter((x) => BR.rarityById[x.rarity].level >= 3).forEach((x) => P.keep({ itemId: x.id, shine: 'plain', seed: 1 }));
    BR.Storage.data.profile.streak = { ring: 6, weeks: 0, last: BR.dayKey(new Date(Date.now() - 864e5)), shield: 1, best: 6 };
  });
  const coins0 = await rp.evaluate(() => BR.Progress.coins);
  await startAndEnd();
  await rp.waitForTimeout(600);
  const sk = await rp.evaluate(() => ({ t: (document.querySelector('.res-banner.streak') || {}).innerText || '', coins: BR.Progress.coins }));
  ok(/\+\s?800 Coins/.test(sk.t) && !/Golden Chest/.test(sk.t), 'the streak banner names the chest instead of the Coins it paid: ' + JSON.stringify(sk.t));
  ok(await rp.evaluate(() => BR.Progress.chestCount('golden') === 0), 'a Golden Chest was given although the set is finished');
  await rp.evaluate(() => BR.Run.closeResults());
  // 2) a Pass item that finishes a set turns the spare chests into Coins at once (results breakdown shows them)
  await rp.evaluate(() => {
    const P = BR.Progress, D = BR.Storage.data;
    BR.DROP_ITEMS.filter((x) => x.type === 'skin' && x.id !== 'f_candy').forEach((x) => P.keep({ itemId: x.id, shine: 'plain', seed: 1 }));
    D.profile.chests.brick = 2;
  });
  await rp.evaluate(() => { BR.Progress.keep({ itemId: 'f_candy', shine: 'plain', seed: 1 }); });   // the last skin arrives (as a Pass reward would)
  const c1 = await rp.evaluate(() => ({ coins: BR.Progress.coins, chests: BR.Progress.chestCount('brick') }));
  await startAndEnd();
  await rp.waitForTimeout(2300);
  const sp = await rp.evaluate(() => ({ chests: BR.Progress.chestCount('brick'), coins: BR.Progress.coins, rows: Array.from(document.querySelectorAll('.res-bd .res-row')).map((r) => r.innerText.replace(/\n/g, ' ')) }));
  ok(sp.chests === 0 && /Spare chests/.test(sp.rows.join('|')), 'spare chests of a finished set were not turned into Coins at the end of the run', JSON.stringify(sp), JSON.stringify(c1));
  const tot = await rp.evaluate(() => +document.getElementById('resCoins').textContent.replace(/\D/g, ''));
  ok(tot === sp.coins - c1.coins, `the Coins total (${tot}) misses the spare chests (balance changed by ${sp.coins - c1.coins})`);
  await rp.evaluate(() => BR.Run.closeResults());

  // 3) results "Chests": the opening fades in over the results (no Shop, no black in between), then the screen under it changes
  await rp.evaluate(() => { BR.Storage.data.profile.chests.pop = 1; BR.Storage.data.profile.chests.brick = 0; });
  await startAndEnd();
  await rp.waitForTimeout(700);
  ok(await rp.evaluate(() => BR.Back.depth === 1), 'the results are not on the Back stack');
  await rp.click('.res-actions [data-r="shop"]');
  const f1 = await rp.evaluate(() => new Promise((res) => setTimeout(() => res({ open: !!document.querySelector('.opening'), results: !!document.querySelector('.results'), cur: BR.Router.current, shop: document.getElementById('s-shop').classList.contains('on') }), 160)));
  ok(f1.open && f1.results && f1.cur === 'run' && !f1.shop, 'the opening does not start straight from the results', JSON.stringify(f1));
  await rp.waitForTimeout(1200);
  const f2 = await rp.evaluate(() => ({ results: !!document.querySelector('.results'), cur: BR.Router.current, depth: BR.Back.depth, open: !!document.querySelector('.opening.on'), z: [getComputedStyle(document.getElementById('layer-sheets')).zIndex, getComputedStyle(document.getElementById('layer-opening')).zIndex] }));
  ok(!f2.results && f2.cur === 'shop' && f2.open && f2.depth === 1 && f2.z[0] === '40' && f2.z[1] === '38', 'after the handoff the results are not gone and the Shop is not under the opening', JSON.stringify(f2));
  await rp.keyboard.press('Escape');
  await rp.waitForFunction(() => !document.querySelector('.opening'), null, { timeout: 5000 }).catch(() => ok(false, 'Escape did not close the opening that was opened from the results'));
  ok(await rp.evaluate(() => BR.Back.depth === 0 && BR.Router.current === 'shop'), 'the Back stack or screen is wrong after leaving the opening', await rp.evaluate(() => JSON.stringify({ d: BR.Back.depth, c: BR.Router.current })));

  // 4) the score counts up from the moment its row is visible, and the finished board is cleared once the results are on
  await rp.evaluate(() => { BR.Router.go('home', { instant: true }); });
  await rp.evaluate(() => __app.startRun({ mode: 'rush', boosts: {} }));
  await rp.waitForFunction(() => BR.Run.clock && !BR.Run.busy && BR.Router.current === 'run', null, { timeout: 15000 });
  await rp.evaluate(() => {
    const e = BR.Run.engine; e.score = 41730; e.stats.pops = 3; e.stats.bricks = 30;
    window.__first = null; const s = BR.Run.showResults.bind(BR.Run);
    BR.Run.showResults = function () {
      const r = s.apply(this, arguments);
      const tick = () => { const row = document.querySelector('.res-score'); if (!row) return requestAnimationFrame(tick); if (+getComputedStyle(row).opacity >= 0.15) { window.__first = document.getElementById('resScore').textContent; return; } requestAnimationFrame(tick); };
      requestAnimationFrame(tick); return r;
    };
    BR.Run.endRun('ended');
  });
  await rp.waitForSelector('.results.on', { timeout: 15000 });
  await rp.waitForTimeout(1600);
  const sc = await rp.evaluate(() => ({ first: window.__first, now: document.getElementById('resScore').textContent, bricks: BR.Run.view.bricks.size }));
  ok(sc.first != null && +sc.first.replace(/\D/g, '') < 41730 * 0.3, `the score already reads ${sc.first} when its row first shows (the count started unseen)`, JSON.stringify(sc));
  ok(sc.now === '41,730', 'the score did not finish counting', JSON.stringify(sc));
  ok(sc.bricks === 0, 'the finished board is still behind the results', JSON.stringify(sc));

  ok(errors.length === 0 && R.errors.length === 0, 'console errors', errors.concat(R.errors).join('|'));
  await R.browser.close();
  console.log(problems ? problems + ' PROBLEMS' : 'u5-chests ok');
  process.exit(problems ? 1 : 0);
})();
