// The Moonwick Tower view of the Collection (js/tower.js, css/tower.css): Series 4 as a tower of lit windows.
//   Node:    the counting (floors, extras, next floor, summary, best instance) over owned sets of different sizes, and the markup's data attributes
//   Browser: the view mounted in the Collection screen with zero / a few / many / all items found, at 360x640, 393x852 (and 320x568 for the tap targets):
//     1. structure: 30 windows (5 floors x 4, the belfry's 2, the cellar's 8), found ones carry data-tw-item + data-tw-uid, missing ones data-tw-locked only,
//        the badges are filled in after the first frame, no horizontal overflow, the summary and the next-floor line say the right thing
//     2. every window is a real tap target: at least 44 x 44 px, inside the tower and the screen, not under the status bar or tab bar, and the point
//        under the finger belongs to the window (centre and the four corners)
//     3. taps reach opts.onItem(itemId, uid) / opts.onLocked(itemId), and event delegation on the data attributes works; the "next floor" button shows the floor
//     4. the bell: a floor that is newly complete rings once (belfry tolls, the floor's own bell swings when it scrolls into view, the windows flash), is
//        remembered in localStorage (and in memory when storage is blocked), and does not ring again on the next view
//     5. Reduce Motion: nothing in the view animates at all, and the bell is not started; low-end phones: the stars hold still
//     6. at rest only the eight stars move, and every animation (at rest and during the bell) uses transform / opacity only
//     7. the first frame (the HTML, inserting it, style and layout) costs under 40 ms at a 4x CPU slowdown, and the badges are built afterwards
//     8. a crest from BR.Sets.crest is used when it exists, and a fallback emblem is drawn when it does not
//   Screenshots (zero / a few / many / all, top, middle and foot of the tower, and the whole tower) go to --out=<dir> (default: the system temp folder).
// Usage: node tests/u5-tower.js [--node] [--out=dir] [--skip=shots,perf,bell]
const path = require('path');
const fs = require('fs');
const os = require('os');
const assert = require('assert');

const argv = process.argv.slice(2);
const opt = (k) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : null; };
const SKIP = (opt('skip') || '').split(',');
const ROOT = path.resolve(__dirname, '..');
let problems = 0;
const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } return !!c; };

/* ------------------------------------------------------------------ Node: the counting */
const mem = {};
global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
for (const f of ['config', 'items', 'tower']) require('../js/' + f + '.js');
const BR = global.BR, T = BR.Tower;
const S4 = BR.ITEMS.filter((x) => x.series === 4).map((x) => x.id);
const FLOOR_IDS = ['library', 'glade', 'alchemy', 'vault', 'spire'];
const setIds = (s) => BR.setItems(s).map((x) => x.id);
const sets = Object.fromEntries(FLOOR_IDS.map((s) => [s, setIds(s)]));
const PASS = ['f_moonglass', 'b_wisps'];

{
  assert.strictEqual(S4.length, 30, 'Series 4 is 28 chest items and 2 Pass exclusives');
  // floors
  let fl = T.floors(new Set());
  assert.deepStrictEqual(fl.map((f) => f.set), FLOOR_IDS, 'five floors, bottom up');
  assert.deepStrictEqual(fl.map((f) => f.name), FLOOR_IDS.map((s) => BR.SETS[s].name), 'the name is the set name');
  assert.deepStrictEqual(fl.map((f) => f.room), ['The Library', 'The Moon Garden', 'The Alchemy Lab', 'The Time Vault', 'The Spire']);
  for (const f of fl) {
    assert.strictEqual(f.total, 4); assert.strictEqual(f.have, 0); assert.strictEqual(f.done, false);
    assert.deepStrictEqual(f.items.map((x) => x.id).sort(), sets[f.set].slice().sort(), 'the floor holds its set\'s four items');
    assert.deepStrictEqual(f.items.map((x) => BR.itemById[x.id].type), ['skin', 'pop', 'board', 'fuse'], 'one window per type, in a fixed order');
    assert(f.items.every((x) => x.have === false));
  }
  // owned sets of different sizes
  const owned = new Set([sets.library[0], sets.library[1], sets.glade[2], 'f_candy', 'nonsense']);
  fl = T.floors(owned);
  assert.deepStrictEqual(fl.map((f) => f.have), [2, 1, 0, 0, 0], 'only the set items count (other items and unknown ids are ignored)');
  assert.deepStrictEqual(T.floors([...owned]).map((f) => f.have), [2, 1, 0, 0, 0], 'an array works as well as a Set');
  assert.deepStrictEqual(fl[0].items.map((x) => x.have).filter(Boolean).length, 2);
  fl = T.floors(new Set(sets.library.concat(sets.vault)));
  assert.deepStrictEqual(fl.map((f) => f.done), [true, false, false, true, false]);
  assert.deepStrictEqual(fl.map((f) => f.have), [4, 0, 0, 4, 0]);
  fl = T.floors(new Set([].concat(...Object.values(sets))));
  assert(fl.every((f) => f.done && f.have === 4), 'every set item: every floor done');
  assert(T.floors(new Set(PASS)).every((f) => f.have === 0), 'Pass exclusives are not in a set');
  // extras: the belfry and the cellar, and together with the floors exactly the 30 Series 4 items
  let [pass, cellar] = T.extras(new Set());
  assert.deepStrictEqual(pass.items.map((x) => x.id).sort(), PASS.slice().sort()); assert.strictEqual(cellar.total, 8);
  assert.strictEqual(pass.set, 'pass'); assert.strictEqual(cellar.set, 'cellar'); assert(pass.extra && cellar.extra);
  const everyId = [].concat(...T.floors(new Set()).concat(T.extras(new Set())).map((f) => f.items.map((x) => x.id)));
  assert.deepStrictEqual(everyId.slice().sort(), S4.slice().sort(), 'the tower shows each Series 4 item exactly once');
  assert(cellar.items.every((x) => !BR.itemById[x.id].set && !BR.itemById[x.id].pass), 'the cellar is the items that are in no set');
  assert.deepStrictEqual(cellar.items.map((x) => BR.itemById[x.id].rarity).slice(0, 2), ['common', 'common'], 'the cellar lists the easy ones first');
  [pass, cellar] = T.extras(new Set(PASS.concat(['f_patchwork'])));
  assert.strictEqual(pass.done, true); assert.strictEqual(cellar.have, 1);
  // next floor: the unfinished set with the fewest items left, the lowest floor on a tie
  assert.deepStrictEqual(T.nextFloor(new Set()), { set: 'library', name: 'Library', room: 'The Library', left: 4 }, 'a new player starts at the bottom');
  assert.strictEqual(T.nextFloor(new Set(sets.library.slice(0, 2))).set, 'library'); assert.strictEqual(T.nextFloor(new Set(sets.library.slice(0, 2))).left, 2);
  assert.strictEqual(T.nextFloor(new Set(sets.library.slice(0, 2).concat(sets.glade.slice(0, 3)))).set, 'glade', 'one left beats two left');
  assert.strictEqual(T.nextFloor(new Set(sets.library.slice(0, 2).concat(sets.glade.slice(0, 2)))).set, 'library', 'a tie goes to the lower floor');
  assert.strictEqual(T.nextFloor(new Set(sets.library.concat(sets.glade, sets.vault.slice(0, 1)))).set, 'vault', 'a finished floor is skipped');
  assert.strictEqual(T.nextFloor(new Set(sets.library.concat(sets.glade, sets.alchemy, sets.vault))).set, 'spire', 'the last floor is the next one');
  assert.strictEqual(T.nextFloor(new Set([].concat(...Object.values(sets)))), null, 'all five floors done: nothing next');
  assert.strictEqual(T.nextFloor([...sets.spire]).set, 'library');
  // the sentence
  assert.strictEqual(T.nextLine(new Set(sets.library.slice(0, 2))), '2 items to finish the Library');
  assert.strictEqual(T.nextLine(new Set(sets.library.concat(sets.glade.slice(0, 3)))), '1 item to finish the Moon Garden');
  assert.strictEqual(T.nextLine(new Set()), '4 items to finish the Library');
  assert(/five floors are lit. 10 rooms left to find/.test(T.nextLine(new Set([].concat(...Object.values(sets))))), T.nextLine(new Set([].concat(...Object.values(sets)))));
  assert(/complete/.test(T.nextLine(new Set(S4))));
  // the summary counts every Series 4 item the tower shows
  assert.deepStrictEqual(T.summary(new Set()), { have: 0, total: 30, floorsDone: 0, floors: 5 });
  assert.deepStrictEqual(T.summary(new Set(S4)), { have: 30, total: 30, floorsDone: 5, floors: 5 });
  assert.deepStrictEqual(T.summary(new Set(sets.library.concat(PASS, ['f_candy', 'f_patchwork']))), { have: 7, total: 30, floorsDone: 1, floors: 5 });
  // the best instance
  const vault = [{ uid: 'a', itemId: 'f_spellbook', shine: 'plain' }, { uid: 'b', itemId: 'f_spellbook', shine: 'prism' }, { uid: 'c', itemId: 'f_spellbook', shine: 'glossy' }, { uid: 'd', itemId: 'b_birds', shine: 'plain' }];
  assert.strictEqual(T.bestInst(vault, 'f_spellbook').uid, 'b'); assert.strictEqual(T.bestInst(vault, 'b_birds').uid, 'd'); assert.strictEqual(T.bestInst(vault, 'a_tower'), null);
  // the markup (no DOM needed): data attributes and counts
  const v2 = sets.library.concat(sets.glade.slice(0, 1), PASS).map((id, i) => ({ uid: 'u' + i, itemId: id, shine: 'plain' }));
  const h = T.html({ vault: v2, owned: new Set(v2.map((x) => x.itemId)) });
  const count = (re) => (h.match(re) || []).length;
  assert.strictEqual(count(/data-tw-item="/g), 7, 'a found window per owned Series 4 item'); assert.strictEqual(count(/data-tw-uid="/g), 7);
  assert.strictEqual(count(/data-tw-locked="/g), 23, 'a missing window per missing item'); assert.strictEqual(count(/class="tw-win /g), 30);
  assert(/data-tw-item="f_spellbook" data-tw-uid="u0"/.test(h), 'the uid is the instance in the vault');
  assert(!/data-tw-locked="f_spellbook"/.test(h) && /data-tw-locked="a_glade"/.test(h));
  assert.strictEqual(count(/tw-floor f-library done/g), 1, 'the complete floor is marked'); assert(/tw-floor f-glade next/.test(h), 'the floor to finish is marked');
  const h2 = T.html({ vault: [], owned: new Set(['f_spellbook']), attrs: { item: 'data-x', uid: 'data-y', locked: 'data-z' } });
  assert(/data-x="f_spellbook"/.test(h2) && /data-z="a_tower"/.test(h2) && !/data-tw-item/.test(h2), 'the attribute names can be changed');
  assert(/Moonwick Tower/.test(h) && />7<small>\/30</.test(h), 'the count');
  console.log('Node: floors, extras, nextFloor, nextLine, summary, bestInst and the markup: ok');
}
if (argv.includes('--node')) { console.log(problems ? problems + ' problem(s)' : 'ok'); process.exit(problems ? 1 : 0); }

/* ------------------------------------------------------------------ browser */
const { launch } = require('./lib');
const OUT = opt('out') || path.join(os.tmpdir(), 'u5-tower-shots');
if (!SKIP.includes('shots')) fs.mkdirSync(OUT, { recursive: true });
const KEY = T.KEY;
const SCEN = {
  zero: [],
  few: ['f_spellbook', 'b_fireflies', 'f_glowcap', 'u_candle', 'f_patchwork'],
  many: ['f_spellbook', 'b_birds', 'a_library', 'u_candle', 'f_glowcap', 'b_fireflies', 'a_glade', 'u_wand', 'f_potion', 'u_elixir', 'f_hourglass', 'b_sandfall', 'a_observatory', 'f_sigil', 'f_gemcut', 'b_wishdust', 'f_moonglass', 'a_isles'],
  all: S4,
};
const SAFE = new Set(['transform', 'opacity', 'translate', 'rotate', 'scale']);
const KFS = new Set(['offset', 'easing', 'composite', 'computedOffset']);

async function run(width, height, o) {
  const tag = width + 'x' + height;
  const { browser, page, errors } = await launch({ width, height, dsf: 2 });
  await page.waitForFunction(() => window.__app, null, { timeout: 180000 });
  await page.evaluate(() => { BR.Coach.markAllSeen(); BR.Storage.data.settings.sound = false; BR.Storage.data.settings.music = false; BR.Storage.data.settings.perf = 'high'; BR.App.applySettings(); BR.Router.go('collection', { instant: true }); });
  if (!(await page.evaluate(() => !!BR.Tower))) {   // (index.html loads the Tower now; inject a copy only into a page that does not have it)
    await page.addStyleTag({ path: path.join(ROOT, 'css', 'tower.css') });
    await page.addScriptTag({ path: path.join(ROOT, 'js', 'tower.js') });
  }
  await page.waitForTimeout(500);

  // mount the view in the Collection screen the way js/screens.js will: a .scroll with the HTML in it, then afterRender
  const mount = (ids, o = {}) => page.evaluate(({ ids, o, KEY }) => {
    const sh = ['plain', 'glossy', 'holo', 'prism'];
    BR.Storage.data.profile.vault = ids.map((id, i) => ({ uid: 'i' + (i + 1).toString(36), itemId: id, shine: sh[i % 4], seed: 3 + i }));
    BR.reducedMotion = !!o.reduced; BR.lowEnd = !!o.low;
    document.documentElement.classList.toggle('reduced', !!o.reduced); document.documentElement.classList.toggle('low-end', !!o.low);
    if (o.forget) BR.Tower.forget();
    if (o.celebrated) localStorage.setItem(KEY, JSON.stringify(o.celebrated));
    window.__calls = [];
    const scr = document.getElementById('s-collection');
    scr.innerHTML = '<div class="scroll">' + BR.Tower.html({ onItem: (id, uid) => window.__calls.push(['item', id, uid]), onLocked: (id) => window.__calls.push(['locked', id]) }) + '</div>';
    BR.Tower.afterRender(scr);
  }, { ids, o, KEY });
  const hydrated = () => page.waitForFunction(() => !document.querySelector('.tw-glass:not(.hy)'), null, { timeout: 20000 });
  const scrollTo = (sel, block = 'center') => page.evaluate(([sel, block]) => { document.querySelector(sel).scrollIntoView({ block }); }, [sel, block]);
  // the animations running inside the view: { name, props }
  const running = () => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.tw'))
    .map((a) => ({ name: a.animationName || a.transitionProperty || '?', props: Array.from(new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k)))) })));
  const motion = async (what) => { const r = await running(); r.forEach((a) => ok(a.props.every((p) => SAFE.has(p) || KFS.has(p)), tag, what, 'animates more than transform and opacity:', JSON.stringify(a))); return r; };

  /* ---- 1 + 2: structure and tap targets, for each amount of progress ---- */
  for (const [name, ids] of Object.entries(SCEN)) {
    await mount(ids, { forget: true, celebrated: ['library', 'glade', 'alchemy', 'vault', 'spire'] });   // (the bells are not the point here)
    const first = await page.evaluate(() => ({ glassCount: document.querySelectorAll('.tw-glass').length, unfilled: document.querySelectorAll('.tw-glass:not(.hy)').length, badges: document.querySelectorAll('.tw-glass .bdg').length }));
    ok(first.glassCount === 30 && first.unfilled === 30 && first.badges === 0, tag, name, 'the first frame has the windows and no badge yet', JSON.stringify(first));
    await hydrated();
    const s = await page.evaluate((ids) => {
      const w = Array.from(document.querySelectorAll('.tw-win'));
      const found = w.filter((x) => x.hasAttribute('data-tw-item')), miss = w.filter((x) => x.hasAttribute('data-tw-locked'));
      const sc = document.querySelector('#s-collection .scroll'), tw = document.querySelector('.tw');
      const id = (x) => x.getAttribute('data-tw-item') || x.getAttribute('data-tw-locked');
      return {
        n: w.length, found: found.length, miss: miss.length, both: w.filter((x) => x.hasAttribute('data-tw-item') && x.hasAttribute('data-tw-locked')).length,
        uidOk: found.every((x) => { const u = x.getAttribute('data-tw-uid'); return u && BR.Progress.instance(u) && BR.Progress.instance(u).itemId === x.getAttribute('data-tw-item'); }),
        ids: new Set(w.map(id)).size, foundSet: found.map(id).sort(), want: ids.slice().sort(),
        badges: document.querySelectorAll('.tw-glass .bdg').length, lockedBadges: document.querySelectorAll('.tw-win.off .tw-glass .bdg.locked').length, stillBadges: document.querySelectorAll('.tw-glass .bdg.still').length,
        sum: document.querySelector('.tw-ring b').textContent, line: (document.querySelector('.tw-next span') || {}).textContent,
        floors: Array.from(document.querySelectorAll('.tw-floor[data-set]')).map((f) => f.dataset.set + ':' + f.querySelectorAll('.tw-win.on').length + (f.classList.contains('done') ? ':done' : '') + (f.classList.contains('next') ? ':next' : '')),
        chips: Array.from(document.querySelectorAll('.tw-chip')).map((c) => c.textContent),
        overflow: { scroll: sc.scrollWidth - sc.clientWidth, tw: tw.scrollWidth - tw.clientWidth, sky: document.querySelector('.tw-sky').getBoundingClientRect().right - innerWidth },
        truncated: Array.from(document.querySelectorAll('.tw-ft b, .tw-ft small')).filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent),
      };
    }, ids);
    ok(s.n === 30 && s.found === ids.length && s.miss === 30 - ids.length && s.both === 0, tag, name, 'windows', JSON.stringify([s.n, s.found, s.miss, s.both]));
    ok(s.uidOk, tag, name, 'every found window carries the uid of its vault entry');
    ok(s.ids === 30, tag, name, 'thirty different items');
    ok(JSON.stringify(s.foundSet) === JSON.stringify(s.want), tag, name, 'the found windows are the owned items');
    ok(s.badges === 30 && s.stillBadges === 30 && s.lockedBadges === 30 - ids.length, tag, name, 'a still badge in every window (locked ones silhouetted)', JSON.stringify([s.badges, s.stillBadges, s.lockedBadges]));
    ok(s.sum.replace(/\s/g, '') === ids.length + '/30', tag, name, 'the count', s.sum);
    ok(s.overflow.scroll <= 0 && s.overflow.tw <= 0 && s.overflow.sky <= 0, tag, name, 'no horizontal overflow', JSON.stringify(s.overflow));
    ok(!s.truncated.length, tag, name, 'floor names and sub-lines are not cut off:', s.truncated.join(' | '));
    ok(s.floors.length === 7, tag, name, 'belfry, five floors, cellar', s.floors.join(' '));
    if (name === 'zero') ok(s.line === '4 items to finish the Library' && s.chips.every((c) => /^0\/\d$/.test(c)), tag, name, s.line, s.chips.join(' '));
    if (name === 'many') ok(s.line === '1 item to finish the Time Vault' && s.floors.join(' ') === 'pass:1 spire:1 vault:3:next alchemy:2 glade:4:done library:4:done cellar:3', tag, name, s.line, s.floors.join(' '));
    if (name === 'all') ok(/complete/.test(s.line) && s.floors.every((f) => /done/.test(f)) && s.chips.every((c) => c.split('/')[0] === c.split('/')[1]), tag, name, 'all complete', s.line, s.floors.join(' '));

    // every window: a real tap target
    const bad = await page.evaluate(async () => {
      const out = [], vw = innerWidth, tb = document.getElementById('topbar').getBoundingClientRect(), nav = document.getElementById('tabbar').getBoundingClientRect();
      for (const w of document.querySelectorAll('.tw-win')) {
        w.scrollIntoView({ block: 'center' });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const r = w.getBoundingClientRect(), sky = document.querySelector('.tw-sky').getBoundingClientRect(), id = w.getAttribute('data-tw-item') || w.getAttribute('data-tw-locked');
        const why = [];
        if (r.width < 44 || r.height < 44) why.push('size ' + r.width.toFixed(1) + 'x' + r.height.toFixed(1));
        if (r.left < sky.left || r.right > sky.right || r.left < 0 || r.right > vw) why.push('outside the tower or the screen');
        if (r.top < tb.bottom - 0.5 || r.bottom > nav.top + 0.5) why.push('under the status bar or tab bar');
        for (const [fx, fy] of [[0.5, 0.5], [0.15, 0.2], [0.85, 0.2], [0.15, 0.9], [0.85, 0.9]]) {
          const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
          if (!hit || !w.contains(hit)) why.push('covered at ' + fx + ',' + fy + ' by ' + (hit ? hit.className || hit.tagName : 'nothing'));
        }
        if (why.length) out.push(id + ': ' + why.join('; '));
      }
      return out;
    });
    ok(!bad.length, tag, name, 'tap targets:', bad.join(' | '));

    // screenshots: top, middle and foot of the tower, then the whole tower
    if (o.shots && !SKIP.includes('shots')) {
      for (const [at, f] of [['top', 0], ['mid', 0.45], ['foot', 1]]) {
        await page.evaluate((f) => { const sc = document.querySelector('#s-collection .scroll'); sc.scrollTop = (sc.scrollHeight - sc.clientHeight) * f; }, f);
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(OUT, `tower-${tag}-${name}-${at}.png`) });
      }
      if (o.whole) {
        await page.setViewportSize({ width, height: 1900 }); await page.waitForTimeout(500);
        await page.evaluate(() => { document.querySelector('#s-collection .scroll').scrollTop = 0; });
        await page.locator('.tw').screenshot({ path: path.join(OUT, `tower-${tag}-${name}-whole.png`) });
        await page.setViewportSize({ width, height }); await page.waitForTimeout(300);
      }
    }
  }

  // Larger text: the strips still hold their words and nothing sticks out sideways
  await page.evaluate(() => document.documentElement.classList.add('large-text'));
  for (const name of ['zero', 'all']) {
    await mount(SCEN[name], { forget: true, celebrated: ['library', 'glade', 'alchemy', 'vault', 'spire'] });
    const lt = await page.evaluate(() => { const sc = document.querySelector('#s-collection .scroll'); return { ov: sc.scrollWidth - sc.clientWidth, cut: Array.from(document.querySelectorAll('.tw-ft b, .tw-ft small, .tw-next span')).filter((e) => e.scrollWidth > e.clientWidth + 0.5).map((e) => e.textContent) }; });
    ok(lt.ov <= 0 && !lt.cut.length, tag, name, 'Larger text: no overflow, no cut-off words', JSON.stringify(lt));
  }
  await page.evaluate(() => document.documentElement.classList.remove('large-text'));

  /* ---- 3: taps and delegation ---- */
  await mount(SCEN.many, { forget: true, celebrated: ['library', 'glade'] });
  await hydrated();
  const tap = async (sel) => {
    await scrollTo(sel); await page.waitForTimeout(80);
    const c = await page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
    await page.touchscreen.tap(c[0], c[1]); await page.waitForTimeout(60);
  };
  await tap('.tw-win[data-tw-item="f_potion"]');
  await tap('.tw-win[data-tw-locked="a_tower"]');
  await tap('.tw-win[data-tw-item="f_moonglass"]');
  const calls = await page.evaluate(() => window.__calls);
  const uid = await page.evaluate(() => document.querySelector('.tw-win[data-tw-item="f_potion"]').getAttribute('data-tw-uid'));
  ok(JSON.stringify(calls[0]) === JSON.stringify(['item', 'f_potion', uid]), tag, 'onItem(itemId, uid) on a found window', JSON.stringify(calls));
  ok(calls[1] && calls[1][0] === 'locked' && calls[1].length === 2 && /^[fbau]_/.test(calls[1][1]), tag, 'onLocked(itemId) on a missing window', JSON.stringify(calls));
  ok(calls[2] && calls[2][1] === 'f_moonglass' && calls.length === 3, tag, 'a belfry window works like the others, and one tap is one call', JSON.stringify(calls));
  // a caller that delegates on the data attributes (js/screens.js)
  const del = await page.evaluate(() => {
    const scr = document.getElementById('s-collection'), seen = [];
    scr.addEventListener('click', (e) => { const a = e.target.closest('[data-tw-item]'), b = e.target.closest('[data-tw-locked]'); if (a) seen.push(['item', a.dataset.twItem, a.dataset.twUid]); else if (b) seen.push(['locked', b.dataset.twLocked]); });
    document.querySelector('.tw-win[data-tw-item="a_library"] .tw-sill').click(); document.querySelector('.tw-win[data-tw-locked="a_tower"] .tw-glass').click(); document.querySelector('.tw-chip').click();
    return seen;
  });
  ok(del.length === 2 && del[0][0] === 'item' && del[0][1] === 'a_library' && !!del[0][2] && del[1][0] === 'locked' && del[1][1] === 'a_tower', tag, 'event delegation on the data attributes (a click on a child counts for its window)', JSON.stringify(del));
  // the next-floor button shows the floor (and marks it for a moment)
  await page.evaluate(() => { document.querySelector('#s-collection .scroll').scrollTop = 0; });
  await page.waitForTimeout(100);
  await page.evaluate(() => document.querySelector('.tw-next').click());
  await page.waitForTimeout(1100);
  const jump = await page.evaluate(() => { const r = document.querySelector('.tw-floor.next').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, spot: document.querySelector('.tw-floor.next').classList.contains('spot'), vh: innerHeight }; });
  ok(jump.spot && jump.top > 0 && jump.bottom < jump.vh, tag, 'the "next floor" button scrolls to the floor and marks it', JSON.stringify(jump));

  /* ---- 4: the bell, once ---- */
  if (!SKIP.includes('bell')) {
    await mount(SCEN.many, { forget: true });                      // Library and Glade are complete and have never rung
    await page.waitForTimeout(1200);
    let b = await page.evaluate((KEY) => ({ arch: !!document.querySelector('.tw-arch.ring'), saved: JSON.parse(localStorage.getItem(KEY) || 'null'), rung: BR.Tower.rung.slice() }), KEY);
    ok(b.arch, tag, 'the belfry tolls when the view opens on a newly complete floor');
    ok(JSON.stringify((b.saved || []).slice().sort()) === '["glade","library"]', tag, 'the floors that were celebrated are remembered', JSON.stringify(b.saved));
    ok(b.rung.length === 0, tag, 'a floor far off screen has not rung yet', JSON.stringify(b.rung));
    await motion('belfry bell');
    await scrollTo('.tw-floor.f-library'); await page.waitForTimeout(450);
    const ring = await page.evaluate(() => ({ cls: document.querySelector('.tw-floor.f-library').classList.contains('ringing'), flashes: document.querySelectorAll('.tw-floor.f-library .tw-flash').length, rung: BR.Tower.rung.slice() }));
    const ra = await motion('floor bell');
    ok(ring.cls && ring.flashes === 4 && ring.rung.includes('library') && ring.rung.every((x) => x === 'library' || x === 'glade'), tag, 'the floor\'s bell rings when it scrolls into view, and its four windows flash', JSON.stringify(ring));
    ok(ra.some((a) => a.name === 'twSwing') && ra.some((a) => a.name === 'twRip') && ra.some((a) => a.name === 'twFlash'), tag, 'swing, rings and flash are running', JSON.stringify(ra.map((a) => a.name)));
    await scrollTo('.tw-floor.f-glade'); await page.waitForTimeout(3200);
    b = await page.evaluate(() => ({ ringing: document.querySelectorAll('.ringing, .tw-flash, .tw-arch.ring').length, rung: BR.Tower.rung.slice().sort() }));
    ok(b.ringing === 0 && b.rung.join() === 'glade,library', tag, 'each bell rang once and everything was cleaned up', JSON.stringify(b));
    // a second view: nothing rings
    await mount(SCEN.many, {});
    for (const f of ['library', 'glade']) { await scrollTo('.tw-floor.f-' + f); await page.waitForTimeout(250); }
    await page.waitForTimeout(500);
    b = await page.evaluate(() => ({ ringing: document.querySelectorAll('.ringing, .tw-flash, .tw-arch.ring').length, rung: BR.Tower.rung.length }));
    ok(b.ringing === 0 && b.rung === 2, tag, 'the next view does not ring the same floors again', JSON.stringify(b));
    // a third floor is completed: only that one rings
    await mount(SCEN.many.concat(['f_potion', 'b_goldleaf', 'a_alchemy', 'u_elixir'].filter((x) => !SCEN.many.includes(x))), {});
    await page.waitForTimeout(1200);
    ok(await page.evaluate(() => !!document.querySelector('.tw-arch.ring')), tag, 'a newly complete floor tolls the belfry');
    await scrollTo('.tw-floor.f-alchemy'); await page.waitForTimeout(300);
    for (const f of ['library', 'glade']) { await scrollTo('.tw-floor.f-' + f); await page.waitForTimeout(250); }
    b = await page.evaluate(() => BR.Tower.rung.slice().sort());
    ok(b.join() === 'alchemy,glade,library' && b.filter((x) => x === 'alchemy').length === 1, tag, 'only the new floor rang', JSON.stringify(b));
    await page.waitForTimeout(3000);
    // blocked storage: the view still renders and still rings only once
    await page.evaluate(() => { window.__sg = Storage.prototype.getItem; window.__ss = Storage.prototype.setItem; Storage.prototype.getItem = () => { throw new Error('blocked'); }; Storage.prototype.setItem = () => { throw new Error('blocked'); }; });
    await mount(SCEN.many, { forget: false });
    await page.evaluate(() => { BR.Tower.forget(); });
    const err0 = errors.length;
    await mount(SCEN.many, {});
    await hydrated();
    await page.waitForTimeout(900);
    const a1 = await page.evaluate(() => !!document.querySelector('.tw-arch.ring'));
    await page.waitForTimeout(2800);
    await mount(SCEN.many, {});
    await page.waitForTimeout(1200);
    const a2 = await page.evaluate(() => ({ arch: !!document.querySelector('.tw-arch.ring'), windows: document.querySelectorAll('.tw-win').length }));
    await page.evaluate(() => { Storage.prototype.getItem = window.__sg; Storage.prototype.setItem = window.__ss; });
    ok(a1 && !a2.arch && a2.windows === 30 && errors.length === err0, tag, 'with localStorage blocked the view renders, rings once per session, and raises no error', JSON.stringify([a1, a2, errors.slice(err0)]));
    await page.waitForTimeout(500);
  }

  /* ---- 5 + 6: Reduce Motion, low-end, and what moves at rest ---- */
  await mount(SCEN.many, { forget: true, reduced: true });
  await hydrated();
  for (const f of ['pass', 'spire', 'vault', 'alchemy', 'glade', 'library', 'cellar']) { await scrollTo('.tw-floor[data-set="' + f + '"]'); await page.waitForTimeout(150); }
  await page.waitForTimeout(1000);
  let r = await running();
  ok(r.length === 0, tag, 'Reduce Motion: nothing in the view animates', JSON.stringify(r));
  let rm = await page.evaluate((KEY) => ({ calm: document.querySelector('.tw').classList.contains('calm'), ring: document.querySelectorAll('.ringing, .tw-flash, .tw-arch.ring').length, rung: BR.Tower.rung.length, saved: localStorage.getItem(KEY), swing: document.getAnimations().some((a) => a.animationName === 'twSwing') }), KEY);
  ok(rm.calm && rm.ring === 0 && rm.rung === 0 && !rm.swing, tag, 'Reduce Motion: no bell, no flash, no ring', JSON.stringify(rm));
  ok(rm.saved === null, tag, 'Reduce Motion: the floors stay unseen, so a later view can celebrate them', String(rm.saved));
  await mount(SCEN.many, { forget: true, low: true });
  await hydrated(); await page.waitForTimeout(1500);
  r = await running();
  ok(!r.some((a) => a.name === 'twTwinkle'), tag, 'low-end: the stars hold still', JSON.stringify(r.map((a) => a.name)));
  await mount(SCEN.few, { forget: true });
  await hydrated(); await page.waitForTimeout(1400);
  r = await motion('at rest');
  ok(r.length === 8 && r.every((a) => a.name === 'twTwinkle'), tag, 'at rest only the eight stars move', JSON.stringify(r.map((a) => a.name)));
  await mount(SCEN.few, { forget: true, reduced: true });
  await hydrated(); await page.waitForTimeout(600);
  ok((await running()).length === 0, tag, 'Reduce Motion with nothing complete: still');

  /* ---- 8: crests ---- */
  await page.evaluate(() => { const r = BR.Sets; delete BR.Sets; window.__realSets = r; });   // (js/sets.js is loaded by index.html now: take it away for the fallback check)
  await mount(SCEN.many, { forget: true, celebrated: ['library', 'glade'] });
  let cr = await page.evaluate(() => ({ fallback: document.querySelectorAll('.tw-crest[class*="c-"]').length, custom: document.querySelectorAll('.tw-crest svg').length }));
  ok(cr.fallback === 7 && cr.custom === 0, tag, 'without BR.Sets a fallback emblem is drawn on every floor', JSON.stringify(cr));
  await page.evaluate(() => { BR.Sets = { crest: (id, size) => '<svg data-fake="' + id + '" width="' + size + '" height="' + size + '"></svg>' }; });
  await mount(SCEN.many, { forget: true, celebrated: ['library', 'glade'] });
  cr = await page.evaluate(() => ({ fallback: document.querySelectorAll('.tw-crest[class*="c-"]').length, fake: Array.from(document.querySelectorAll('.tw-crest svg[data-fake]')).map((s) => s.dataset.fake + ':' + s.getAttribute('width')) }));
  ok(cr.fallback === 0 && cr.fake.join() === 'pass:28,spire:28,vault:28,alchemy:28,glade:28,library:28,cellar:28', tag, 'BR.Sets.crest(setId, size) is used when it exists', JSON.stringify(cr));
  await page.evaluate(() => { BR.Sets = { crest: () => { throw new Error('broken'); } }; });
  await mount(SCEN.few, { forget: true });
  ok(await page.evaluate(() => document.querySelectorAll('.tw-crest[class*="c-"]').length === 7), tag, 'a crest function that throws falls back to the emblem');
  await page.evaluate(() => { if (window.__realSets) BR.Sets = window.__realSets; else delete BR.Sets; });   // (the real js/sets.js comes back for the rest)

  /* ---- 7: the first frame at a 4x CPU slowdown ---- */
  if (o.perf && !SKIP.includes('perf')) {
    await mount(SCEN.many, { forget: true, celebrated: ['library', 'glade'] }); await hydrated();
    const cdp = await page.context().newCDPSession(page);
    const meds = [];
    for (let round = 0; round < 3; round++) {
      const t = [];
      for (let n = 0; n < 9; n++) {
        await page.evaluate(() => { document.getElementById('s-collection').innerHTML = ''; });
        await page.waitForTimeout(100);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        t.push(await page.evaluate(() => { const scr = document.getElementById('s-collection'), t0 = performance.now(); scr.innerHTML = '<div class="scroll">' + BR.Tower.html() + '</div>'; scr.offsetHeight; return performance.now() - t0; }));
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      }
      t.sort((a, b) => a - b);
      meds.push(t[4]);
      if (t[4] < 40) break;                                         // (a busy machine can spoil a round: it passes when one round's median is under the budget)
    }
    const best = Math.min(...meds);
    console.log(`  first frame at 4x CPU slowdown: median ${best.toFixed(1)} ms (rounds: ${meds.map((m) => m.toFixed(1)).join(', ')}); budget 40 ms`);
    ok(best < 40, tag, 'the first frame costs ' + best.toFixed(1) + ' ms at 4x CPU slowdown (budget 40)');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const hy = await page.evaluate(() => new Promise((res) => {
      const scr = document.getElementById('s-collection'); scr.innerHTML = '<div class="scroll">' + BR.Tower.html() + '</div>';
      const t0 = performance.now(); BR.Tower.afterRender(scr);
      const left = () => document.querySelectorAll('.tw-glass:not(.hy)').length, first = left();
      const f = () => { if (!left()) res({ first, ms: performance.now() - t0 }); else requestAnimationFrame(f); }; f();
    }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(`  badges built after the first frame, 4x slowdown: ${hy.first} windows in ${hy.ms.toFixed(0)} ms, in small steps`);
    ok(hy.first === 30 && hy.ms < 6000, tag, 'the badges fill in after the first frame', JSON.stringify(hy));
  }

  ok(!errors.length, tag, 'console errors:', errors.join(' | '));
  await browser.close();
  console.log(tag + ' done');
}

(async () => {
  await run(360, 640, { shots: true, whole: true, perf: true });
  await run(393, 852, { shots: true, whole: true });
  await run(320, 568, {});
  if (!SKIP.includes('shots')) console.log('screenshots in ' + OUT);
  console.log(problems ? problems + ' problem(s)' : 'ok');
  process.exit(problems ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
