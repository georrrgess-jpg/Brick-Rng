// Update 5, Series 4 "Moonwick" set crests and flourishes (js/sets.js, css/sets.css): what a full set adds to a run, and that it adds nothing else.
//   node tests/u5-sets.js            everything, with pictures
//   node tests/u5-sets.js --quick    no pictures (what the check run uses)
//   SHOTS_DIR=/some/dir node tests/u5-sets.js    where the pictures go (default: the system temp folder, u5-sets)
// Part 1 needs no browser (the pure API loads in Node, no DOM at load):
//   api        the five sets in order, four items each (one per type), statusOf, wornFrom, worn, fires (which event plays which set), the crests as SVG
//              (self-contained, well formed, one per set, 22/44/88px), the caps; the stylesheet has no animation of its own and the script no write to the game
// Part 2 drives the real page (the files are injected by the test, index.html is not touched), each set on its own page:
//   crest      wearing a full set puts ONE crest element between the stage label and the stage goal (22px, no children, clear of the text), it pops once per
//              run on transform and opacity only and then holds still; a mixed loadout, the default loadout and Reduce Motion behave; nothing at all
//              (no timer, no animation, no particle) happens when no full set is worn
//   flourish   each set's event plays its flourish: at most 30 particles (every canvas particle, link, ring and DOM layer, counted from outside by wrapping the
//              fx object and watching the DOM), none after 900 ms, DOM layers animate transform and opacity only, everything stays inside the board's box
//              (so never over the HUD), none of it over the game's own big texts (the stage wipe, the Rush banner, callouts: DOM layers sit below them,
//              canvas pieces never touch their boxes), nothing is left behind, the engine and the save are untouched, once per 6 s, the right event for the right set
//              (Spire: the first stage-up of a run and every Rush start; Vault: only a SAVED Last Spark), results stops it, Reduce Motion and low-end play nothing
//   demo       BR.Sets.flourish(id, element) plays inside any element (the Try it board, the Tower view), restores the element, and can be stopped
// The flourish checks run on a virtual clock (timers, frames, performance.now and every Web Animation are stepped by the test), so a busy machine cannot
// make a duration look wrong. Exit code 1 on a problem.
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const QUICK = process.argv.includes('--quick');
const OUT = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'u5-sets');
const ORDER = ['library', 'glade', 'alchemy', 'vault', 'spire'];
const SET_ITEMS = {
  library: ['f_spellbook', 'b_birds', 'a_library', 'u_candle'], glade: ['f_glowcap', 'b_fireflies', 'a_glade', 'u_wand'], alchemy: ['f_potion', 'b_goldleaf', 'a_alchemy', 'u_elixir'],
  vault: ['f_hourglass', 'b_sandfall', 'a_observatory', 'u_sandglass'], spire: ['f_sigil', 'b_constellation', 'a_tower', 'u_moonrise'],
};
const EVENT = { library: 'line', glade: 'stageUp', alchemy: 'rushStart', vault: 'sparkEnd', spire: 'rushStart' };
const NAMES = { library: 'Library', glade: 'Glade', alchemy: 'Alchemy', vault: 'Time Vault', spire: 'Spire' };
let problems = 0;
const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } return !!c; };
const info = (...a) => console.log(...a);

(async () => {
  /* ================================================================== 1. the pure API, in Node */
  globalThis.BR = {};
  require(path.join(ROOT, 'js/items.js'));
  require(path.join(ROOT, 'js/sets.js'));
  const S = BR.Sets;
  ok(S && typeof S.statusOf === 'function', 'BR.Sets did not load in Node');
  ok(JSON.stringify(S.list.map((s) => s.id)) === JSON.stringify(ORDER), 'the five sets are not in order', S.list.map((s) => s.id));
  ok(S.CAP.ms === 900 && S.CAP.particles === 30 && S.CAP.gap === 6000, 'the caps are not 900 ms, 30 particles, 6 s', S.CAP);
  ok(typeof S.flourish === 'undefined' && typeof S.onEvent === 'undefined', 'the browser half exists in Node');
  ORDER.forEach((id) => {
    const e = S.get(id), items = BR.setItems(id);
    ok(e && e.name === NAMES[id] && e.flourish === BR.SETS[id].flourish, `${id}: name or flourish name`, e && e.name);
    ok(JSON.stringify(e.items) === JSON.stringify(SET_ITEMS[id]), `${id}: items`, e.items);
    ok(items.length === 4 && new Set(items.map((x) => x.type)).size === 4 && BR.TYPE_ORDER.every((t) => items.some((x) => x.type === t)), `${id}: not one item of each type`);
    ok(items.every((x) => x.set === id), `${id}: an item of another set`);
    ok(typeof e.trigger === 'string' && e.on.length > 0 && e.blurb.length > 20 && /^#[0-9a-f]{6}$/i.test(e.tint), `${id}: entry data`);
  });
  ok(S.get('nope') === undefined, 'get of an unknown set');

  // statusOf
  const allIds = SET_ITEMS.library;
  let st = S.statusOf('library', new Set());
  ok(st.have === 0 && st.total === 4 && JSON.stringify(st.missing) === JSON.stringify(allIds), 'statusOf, nothing owned', st);
  st = S.statusOf('library', new Set(['f_spellbook', 'u_candle', 'b_runes', 'f_candy']));
  ok(st.have === 2 && st.total === 4 && JSON.stringify(st.missing) === JSON.stringify(['b_birds', 'a_library']), 'statusOf, two owned (and items of other sets ignored)', st);
  st = S.statusOf('spire', SET_ITEMS.spire);
  ok(st.have === 4 && st.missing.length === 0, 'statusOf, an array of ids, all owned', st);
  st = S.statusOf('glade', null);
  ok(st.have === 0 && st.total === 4 && st.missing.length === 4, 'statusOf, no owned set', st);
  st = S.statusOf('nope', new Set(['x']));
  ok(st.have === 0 && st.total === 0 && st.missing.length === 0, 'statusOf, unknown set', st);
  const own = new Set(['f_potion']); S.statusOf('alchemy', own); ok(own.size === 1, 'statusOf changed the set it was given');

  // wornFrom and worn
  const item = (id) => BR.itemById[id];
  ORDER.forEach((id) => {
    ok(S.wornFrom(SET_ITEMS[id].map(item)) === id, `wornFrom: the full ${id} set`);
    const other = ORDER[(ORDER.indexOf(id) + 1) % 5];
    const mixed = SET_ITEMS[id].map(item); mixed[2] = item(SET_ITEMS[other][2]);
    ok(S.wornFrom(mixed) === null, `wornFrom: ${id} with one board of ${other}`);
    const dflt = SET_ITEMS[id].map(item); dflt[3] = BR.DEFAULTS.fuse;
    ok(S.wornFrom(dflt) === null, `wornFrom: ${id} with the default fuse`);
    ok(S.wornFrom(SET_ITEMS[id].slice(0, 3).map(item)) === null, `wornFrom: only three items of ${id}`);
  });
  ok(S.wornFrom(null) === null && S.wornFrom([]) === null && S.wornFrom(BR.TYPE_ORDER.map((t) => BR.DEFAULTS[t])) === null, 'wornFrom of nothing or the defaults');
  ok(S.wornFrom(['f_patchwork', 'b_wishdust', 'a_isles', 'u_runechain'].map(item)) === null, 'wornFrom: four Series 4 items that belong to no set');
  ok(S.worn() === null, 'worn() without a game');
  BR.Progress = { equipped: (t) => ({ item: item(SET_ITEMS.vault[BR.TYPE_ORDER.indexOf(t)]) }) };
  ok(S.worn() === 'vault', 'worn() reads the loadout through BR.Progress.equipped');
  delete BR.Progress;

  // fires: which event plays which set
  const EVENTS = ['pop', 'demo', 'line', 'rushStart', 'rushEnd', 'stageUp', 'spark', 'sparkEnd', 'results'];
  const WANT = {
    library: (t) => t === 'line', glade: (t) => t === 'stageUp', alchemy: (t) => t === 'rushStart', vault: (t, d) => t === 'sparkEnd' && d.saved, spire: (t, d, first) => (t === 'stageUp' && first) || t === 'rushStart',
  };
  ORDER.forEach((id) => EVENTS.forEach((t) => [[{ saved: true }, true], [{ saved: false }, false]].forEach(([d, first]) => {
    ok(S.fires(id, t, d, first) === !!WANT[id](t, d, first), `fires(${id}, ${t}, saved ${d.saved}, first ${first}) is ${S.fires(id, t, d, first)}`);
  })));
  ok(!S.fires('nope', 'line', {}, true), 'fires: an unknown set');
  ok(S.fires('spire', 'stageUp', {}, true) && !S.fires('spire', 'stageUp', {}, false) && S.fires('spire', 'rushStart', {}, false), 'Spire: the first stage-up and every Rush start');
  ok(!S.fires('vault', 'sparkEnd', { saved: false }, false) && !S.fires('vault', 'spark', { saved: true }, false), 'Vault: only a saved Last Spark (sparkEnd), not its start');

  // the crests
  const svgs = {};
  const wellFormed = (svg) => {
    const stack = [], re = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g; let m, last = 0;
    while ((m = re.exec(svg))) {
      if (svg.slice(last, m.index).trim()) return 'text between tags';
      last = re.lastIndex;
      if (m[3] && /\s[\w:-]+=(?!")/.test(m[3])) return 'unquoted attribute in ' + m[0].slice(0, 40);
      if (m[1]) { if (stack.pop() !== m[2]) return 'closing ' + m[2] + ' does not match'; } else if (!m[4]) stack.push(m[2]);
    }
    return stack.length || svg.slice(last).trim() ? 'unclosed ' + stack.join(',') : '';
  };
  ORDER.forEach((id) => {
    [22, 44, 88].forEach((size) => {
      const svg = S.crest(id, size);
      ok(svg.startsWith('<svg ') && svg.endsWith('</svg>'), `crest ${id} ${size}: not an svg`);
      const bad = wellFormed(svg); ok(!bad, `crest ${id} ${size}: not well formed (${bad})`);
      ok(svg.includes(`width="${size}"`) && svg.includes(`height="${size}"`) && svg.includes('viewBox="0 0 32 32"'), `crest ${id} ${size}: size or view box`);
      ok(!/\bid=|url\(#|undefined|NaN|<script|<image|<text|<foreignObject/.test(svg), `crest ${id} ${size}: has an id, a reference, a script, an image, text or an undefined`);
      ok(/#e8f0ff/i.test(svg) && /#ffcf6b/i.test(svg) && /#0b0e2b/i.test(svg), `crest ${id} ${size}: not silver, gold and midnight`);
      ok(svg.includes(`aria-label="${NAMES[id]} set"`), `crest ${id} ${size}: aria label`);
      if (size === 22) svgs[id] = svg;
    });
    ok(S.crest(id).includes('width="22"'), `crest ${id}: the default size is not 22`);
    ok(S.crest(id, 22).length < S.crest(id, 44).length, `crest ${id}: the 22px art keeps the 44px hairlines`);
    const uri = S.crestUri(id);
    ok(uri.startsWith('url("data:image/svg+xml,') && uri.endsWith('")') && !/[<>#]/.test(uri.slice(24, -2)) && !/"/.test(uri.slice(24, -2)), `crestUri ${id}: not a clean data uri`);
  });
  ok(new Set(Object.values(svgs)).size === 5, 'two sets share one crest');
  ok(S.crest('nope', 22) === '', 'a crest for an unknown set is not empty');

  // the files: cosmetic only, nothing animates at rest
  const css = fs.readFileSync(path.join(ROOT, 'css/sets.css'), 'utf8'), js = fs.readFileSync(path.join(ROOT, 'js/sets.js'), 'utf8');
  ok(!/@keyframes|animation|transition|filter|blend|backdrop/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'css/sets.css animates, transitions, filters or blends');
  ok(/html\.reduced \.sf-stage, html\.low-end \.sf-stage \{ display: none/.test(css), 'css/sets.css does not hide the stage in Reduce Motion and low-end');
  ok(/\.set-crest \{[^}]*width: 22px; height: 22px/.test(css), 'the crest is not 22px');
  ok(!/Progress\.(?!equipped)|Storage\.(save|data\.\w+\s*[=+-])|engine\.\w+\s*(=[^=]|\+=|-=)|BR\.Run\.(?!engine\b|view\b)\w+\s*=[^=]/.test(js.replace(/\/\*[\s\S]*?\*\//g, '')), 'js/sets.js writes to the game');
  ok(!/claude|sonnet|opus|haiku|anthropic|gpt/i.test(js + css), 'a model name in the set files');
  info(`api ok (${ORDER.length} sets, ${Object.keys(svgs).length} crests)`);

  /* ================================================================== 2. the pictures that do not need the game: every crest at 22, 44, 88 */
  const { chromium } = require('/opt/node-tools/node_modules/playwright');
  const { launch, URL } = require('./lib');
  const shot = (name, buf) => { if (!QUICK) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, name), buf); } };
  if (!QUICK) {
    const row = (size) => ORDER.map((id) => `<div>${S.crest(id, size)}</div>`).join('');
    const html = `<html><body style="margin:0;background:#120b22;color:#aa9fcb;font:12px sans-serif;padding:14px"><style>.r{display:flex;gap:18px;align-items:center;margin:4px 0 14px}</style>` +
      [22, 44, 88].map((s) => `<div>${s}px</div><div class="r">${row(s)}</div>`).join('') + `</body></html>`;
    const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
    for (const dsf of [1, 3]) {
      const pg = await (await b.newContext({ viewport: { width: 640, height: 300 }, deviceScaleFactor: dsf })).newPage();
      await pg.setContent(html); shot(`crests-${dsf}x.png`, await pg.screenshot());
    }
    await b.close();
  }

  /* ================================================================== 3. the page */
  const SETUP = () => { Object.keys(BR.Coach.CARDS).forEach((k) => { BR.Storage.data.seen[k] = true; }); BR.Storage.data.seen.whatsnew3 = true; BR.Storage.data.seen.whatsnew4 = true; BR.Storage.data.seenTutorial = true; BR.Storage.data.runs = 3; const s = BR.Storage.data.settings; s.sound = false; s.music = false; s.perf = 'high'; s.reduced = false; BR.App.applySettings(); };
  /** a fresh page of the game with the two set files injected (index.html is not touched) */
  const fresh = async (browser) => {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: QUICK ? 1 : 2, hasTouch: true, isMobile: true });
    const page = await ctx.newPage(), errors = [];
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.goto(URL);
    await page.waitForFunction(() => window.__app, null, { timeout: 8000 });
    await page.evaluate(() => BR.Coach.markAllSeen());
    await page.evaluate(SETUP);
    return { page, ctx, errors };
  };
  const inject = async (page) => {
    const before = await page.evaluate(() => ({ h: BR.Skins.handlers.length, a: BR.Skins.applyHooks.length, art: !!document.getElementById('setsArt'), crest: !!document.getElementById('setCrest') }));
    // (index.html loads the set files now; a copy is injected only into a page that does not have them, so the files are never loaded twice)
    const loaded = await page.evaluate(() => !!BR.Sets);
    if (!loaded) {
      await page.addStyleTag({ path: path.join(ROOT, 'css/sets.css') });
      await page.addScriptTag({ path: path.join(ROOT, 'js/sets.js') });
    }
    const after = await page.evaluate(() => ({ h: BR.Skins.handlers.length, a: BR.Skins.applyHooks.length, art: !!document.getElementById('setsArt'), crest: !!document.getElementById('setCrest'), api: ['flourish', 'onEvent', 'refresh', 'rest', 'worn'].every((k) => typeof BR.Sets[k] === 'function') }));
    ok(loaded ? after.h === before.h && after.a === before.a : after.h === before.h + 1 && after.a === before.a + 1, 'the set files must add exactly one handler and one apply hook', before, after);
    ok(!after.art && !after.crest, 'nothing is baked or drawn at load (the crest and the art come on first use)');
    ok(after.api, 'the browser API is not complete');
  };
  const wear = (page, ids) => page.evaluate((ids) => {
    const P = BR.Progress; ['skin', 'pop', 'board', 'fuse'].forEach((t) => P.equip('default', t));
    ids.forEach((id) => { const it = BR.itemById[id]; const inst = BR.Storage.data.profile.vault.find((v) => v.itemId === id) || P.keep({ itemId: id, shine: 'plain', seed: 3, counter: null }); P.equip(inst.uid, it.type); });
    BR.Skins.apply();
  }, ids);
  const startRun = async (page) => {
    await page.evaluate(() => { BR.Run.over = true; if (BR.Router.current === 'run') BR.Router.go('home', { instant: true }); __app.startRun({ mode: 'rush', boosts: {} }); });
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 });
    await page.evaluate(() => { BR.Run.engine.fuse = 25; });
    await page.waitForTimeout(250);
  };
  /** Spies that tell timers, animations and fx calls made by js/sets.js (its file name is in the stack) from the game's own; the positive control is in the test */
  const SPY = () => {
    if (window.__spy) return;
    const S = (window.__spy = { timers: 0, anims: [], fx: 0 });
    const mine = () => /sets\.js/.test(new Error().stack || '');
    const st = window.setTimeout; window.setTimeout = function (...a) { if (mine()) S.timers++; return st.apply(this, a); };
    const an = Element.prototype.animate; Element.prototype.animate = function (kf, o) { if (mine() || this.id === 'setCrest') S.anims.push({ id: this.id, cls: this.className, keys: Array.from(new Set(kf.flatMap((k) => Object.keys(k)))) }); return an.apply(this, arguments); };
    ['emit', 'sprite', 'link', 'ring', 'sparks', 'shards'].forEach((k) => { const f = BR.fx[k]; BR.fx[k] = function (...a) { if (mine()) S.fx++; return f.apply(this, a); }; });
  };
  const spy = (page) => page.evaluate(() => ({ timers: __spy.timers, anims: __spy.anims.slice(), fx: __spy.fx }));
  const spyReset = (page) => page.evaluate(() => { __spy.timers = 0; __spy.anims.length = 0; __spy.fx = 0; });
  /** the data each event carries (what js/run.js sends) */
  const DATA = () => {
    window.__D = (type, o = {}) => {
      const run = BR.Run, view = run.view;
      if (type === 'line') return { res: { plan: { line: true, lineH: !o.vert, lineV: !!o.vert, r: o.r == null ? 3 : o.r, c: o.c == null ? 4 : o.c } }, view, run };
      if (type === 'stageUp') return { run, info: { from: 1, to: 2, mult: 1.5 } };
      if (type === 'rushStart') return { run, view };
      if (type === 'sparkEnd') return { run, saved: o.saved !== false };
      if (type === 'spark') return { run, view };
      if (type === 'rushEnd') return { run };
      if (type === 'results') return { run };
      if (type === 'pop') return { res: { plan: { n: 3, primary: [{ r: 0, c: 0 }, { r: 0, c: 1 }, { r: 1, c: 0 }], color: 1, line: false } }, view, run };
    };
  };
  const fire = (page, type, o) => page.evaluate(([type, o]) => BR.Skins.onEvent(type, __D(type, o)), [type, o]);
  const rects = (page) => page.evaluate(() => {
    const R = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
    const q = (s) => document.querySelector(s);
    return { board: R(BR.Run.view.boardEl), strip: R(q('#stageStrip')), tag: R(q('#stageTag')), goal: R(q('#stageGoal')), mult: R(q('#multTag')), crest: q('#setCrest') ? R(q('#setCrest')) : null, row: R(q('#stageStrip .ss-row')), score: R(q('#score')), time: R(q('#fuseTimeBox')), band: R(q('#msgBand')) };
  });
  const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const SAFE = new Set(['transform', 'opacity', 'offset', 'easing', 'composite', 'computedOffset']);

  /* ---------------------------------------------------------------- 3a. no full set: nothing happens
     and the crest of each set (real time) */
  {
    const { page, errors } = await fresh(browser);
    await inject(page);
    await page.evaluate(SPY); await page.evaluate(DATA);
    let s;
    const noneCases = {
      'the default loadout': [], 'three of four Library items': SET_ITEMS.library.slice(0, 3), 'four Series 4 items of no set': ['f_patchwork', 'b_wishdust', 'a_isles', 'u_runechain'],
      'the Library set with the Glade board': [SET_ITEMS.library[0], SET_ITEMS.library[1], SET_ITEMS.glade[2], SET_ITEMS.library[3]],
    };
    for (const [label, ids] of Object.entries(noneCases)) {
      await wear(page, ids); await startRun(page);
      const r = await page.evaluate(() => ({ worn: BR.Sets.worn(), crests: document.querySelectorAll('#setCrest, .set-crest').length, stage: document.querySelectorAll('.sf-stage').length }));
      ok(r.worn === null && r.crests === 0 && r.stage === 0, `${label}: worn ${r.worn}, crests ${r.crests}, stages ${r.stage}`);
      await spyReset(page);
      await page.evaluate(() => { BR.Sets.rest(); ['pop', 'line', 'rushStart', 'stageUp', 'spark', 'sparkEnd', 'rushEnd', 'results'].forEach((t) => BR.Skins.onEvent(t, __D(t))); BR.Skins.apply(); });
      s = await spy(page);
      ok(s.timers === 0 && s.fx === 0 && s.anims.length === 0, `${label}: the set code made ${s.timers} timers, ${s.fx} fx calls, ${s.anims.length} animations with no full set worn`, s);
      ok(await page.evaluate(() => !document.getElementById('setsArt')), `${label}: art was baked with no full set worn`);
    }

    // positive control: the spy sees a timer that sets.js makes (a flourish of the Library, played here on purpose)
    await wear(page, SET_ITEMS.library);
    await startRun(page);
    await spyReset(page);
    await fire(page, 'line');
    s = await spy(page);
    ok(s.timers >= 1 && s.fx > 0 && s.anims.length > 0, 'spy control: a Library flourish should make timers, fx calls and animations the spy can see', s);
    await page.waitForFunction(() => !BR.Sets.last || true); await page.waitForTimeout(1100);


    // the crest of every set
    for (const id of ORDER) {
      await wear(page, SET_ITEMS[id]);
      await spyReset(page);
      await startRun(page);
      const r = await rects(page);
      const c = await page.evaluate(() => {
        const el = document.getElementById('setCrest'), cs = el && getComputedStyle(el);
        return el && { n: document.querySelectorAll('#setCrest, .set-crest').length, set: el.dataset.set, kids: el.childElementCount, parent: el.parentNode.className, prev: el.previousElementSibling && el.previousElementSibling.id, next: el.nextElementSibling && el.nextElementSibling.id, w: cs.width, h: cs.height, display: cs.display, bg: cs.backgroundImage.slice(0, 22), label: el.getAttribute('aria-label'), role: el.getAttribute('role'), anims: el.getAnimations().length, worn: BR.Sets.worn(), pe: cs.pointerEvents };
      });
      ok(!!c, `${id}: no crest in the HUD`);
      if (!c) continue;
      ok(c.n === 1 && c.set === id && c.worn === id, `${id}: crests ${c.n}, set ${c.set}`);
      ok(c.kids === 0, `${id}: the crest has ${c.kids} children (it is one element)`);
      ok(c.parent === 'ss-row' && c.prev === 'stageTag' && (c.next === 'stageGoal' || c.next === 'modeTag'), `${id}: the crest is not between the stage label and the goal`, c.parent, c.prev, c.next);
      ok(c.w === '22px' && c.h === '22px' && c.display !== 'none' && c.bg.startsWith('url("data:image/svg'), `${id}: crest box or picture`, c.w, c.h, c.bg);
      ok(c.label === NAMES[id] + ' set' && c.role === 'img' && c.pe === 'none', `${id}: crest label, role or pointer events`, c.label);
      ok(r.crest && Math.abs(r.crest.w - 22) < 0.5 && Math.abs(r.crest.h - 22) < 0.5, `${id}: crest rect`, r.crest);
      ok(!hit(r.crest, r.tag) && !hit(r.crest, r.goal) && !hit(r.crest, r.mult), `${id}: the crest overlaps the stage text`);
      ok(r.crest.l >= r.row.l && r.crest.r <= r.row.r && r.crest.t >= r.strip.t - 2 && r.crest.b <= r.strip.b + 2 && r.goal.w > 40, `${id}: the crest leaves the stage row, or squeezes the goal (${r.goal.w}px)`);
      ok(r.crest.l >= r.tag.r + 4, `${id}: the crest is ${r.crest.l - r.tag.r}px from the stage label`);
      // it pops once on transform and opacity, then holds still
      s = await spy(page);
      const pops = s.anims.filter((a) => a.id === 'setCrest');
      ok(pops.length === 1 && pops[0].keys.every((k) => SAFE.has(k)), `${id}: the crest pop ran ${pops.length} times (once per run) with ${pops[0] && pops[0].keys}`);
      await page.evaluate(() => BR.Skins.apply());
      s = await spy(page);
      ok(s.anims.filter((a) => a.id === 'setCrest').length === 1, `${id}: apply() popped the crest again`);
      await page.waitForTimeout(700);
      const rest = await page.evaluate(() => ({ crest: document.getElementById('setCrest').getAnimations().length, stage: document.querySelectorAll('.sf-stage').length, mine: document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.set-crest, .sf-stage')).length }));
      ok(rest.crest === 0 && rest.stage === 0 && rest.mine === 0, `${id}: something of the set animates at rest`, rest);
      await spyReset(page); await page.waitForTimeout(900);
      s = await spy(page);
      ok(s.timers === 0 && s.fx === 0 && s.anims.length === 0, `${id}: the set code makes timers or particles while nothing happens`, s);
      // the stage strip's own behaviour is untouched: the stage number still changes
      ok(await page.evaluate(() => document.getElementById('stageNum').textContent === String(BR.Run.engine.stage)), `${id}: the stage label`);
      if (!QUICK) {
        const q = await page.evaluate(() => { const r = document.getElementById('stageStrip').getBoundingClientRect(); return { x: Math.max(0, r.left - 8), y: r.top - 8, width: r.width + 16, height: r.height + 16 }; });
        shot(`hud-${id}.png`, await page.screenshot({ clip: q }));
      }
      // through the public path in real time: the right event plays, the flourish ends, nothing is left in fx or the DOM
      const real = await page.evaluate(async ([type]) => {
        const fx = BR.fx, base = { p: fx.parts.length, l: fx.links.length, r: fx.rings.length, live: BR.U4.live.length }, t0 = performance.now(), was = BR.Sets.last;
        BR.Run.clock = false; BR.Sets.rest();
        BR.Skins.onEvent(type, __D(type));
        const played = BR.Sets.last !== was && BR.Sets.last.set === BR.Sets.worn();
        let n = 0; while ((document.querySelector('.sf-stage') || fx.parts.length > base.p || fx.links.length > base.l || fx.rings.length > base.r) && performance.now() - t0 < 3000) { await new Promise((r) => requestAnimationFrame(r)); n++; }
        await new Promise((r) => setTimeout(r, 100));
        BR.Run.clock = true;
        return { played, ms: Math.round(performance.now() - t0), stage: document.querySelectorAll('.sf-stage').length, extra: [fx.parts.length - base.p, fx.links.length - base.l, fx.rings.length - base.r, BR.U4.live.length - base.live], last: BR.Sets.last && { set: BR.Sets.last.set, ms: BR.Sets.last.ms, particles: BR.Sets.last.particles } };
      }, [EVENT[id]]);
      ok(real.played && real.stage === 0 && real.extra.every((x) => x <= 0) && real.ms < 2600, `${id}: ${EVENT[id]} in real time: played ${real.played}, left ${real.stage} stages and ${real.extra} particles, took ${real.ms} ms`, real);
      info(`crest ${id.padEnd(8)} in the HUD, pop ${pops.length}x ${pops[0] && pops[0].keys}; real-time ${EVENT[id]}: ${real.last && real.last.particles} particles, ${real.last && real.last.ms} ms (ended after ${real.ms} ms)`);
    }

    // Reduce Motion and low-end: the crest stays (still), no pop, no flourish
    for (const mode of ['reduced', 'low']) {
      await page.evaluate((m) => { const s = BR.Storage.data.settings; s.reduced = m === 'reduced'; s.perf = m === 'low' ? 'low' : 'high'; BR.App.applySettings(); }, mode);
      await wear(page, SET_ITEMS.alchemy); await spyReset(page); await startRun(page);
      const r = await page.evaluate(() => ({ crests: document.querySelectorAll('#setCrest').length, anims: document.getElementById('setCrest').getAnimations().length }));
      s = await spy(page);
      ok(r.crests === 1, `${mode}: the crest is missing`);
      ok(mode === 'reduced' ? s.anims.filter((a) => a.id === 'setCrest').length === 0 : s.anims.filter((a) => a.id === 'setCrest').every((a) => a.keys.every((k) => SAFE.has(k))), `${mode}: the crest pop`, s.anims);
      await page.waitForTimeout(700);
      await spyReset(page);
      for (const id of ORDER) {
        await wear(page, SET_ITEMS[id]);
        await page.evaluate(() => { BR.Sets.rest(); ['line', 'stageUp', 'rushStart', 'sparkEnd'].forEach((t) => BR.Skins.onEvent(t, __D(t))); });
        const h = await page.evaluate((id) => !!BR.Sets.flourish(id, document.getElementById('board')), id);
        s = await spy(page);
        const st = await page.evaluate(() => document.querySelectorAll('.sf-stage').length);
        ok(!h && s.fx === 0 && s.timers === 0 && s.anims.filter((a) => a.id !== 'setCrest').length === 0 && st === 0, `${mode}: ${id} played a flourish (handle ${h}, ${s.fx} fx calls, ${s.timers} timers, ${st} stages)`, s);
      }
    }
    await page.evaluate(() => { const s = BR.Storage.data.settings; s.reduced = false; s.perf = 'high'; BR.App.applySettings(); });
    ok(errors.length === 0, 'console errors', errors.slice(0, 5));
    await page.context().close();
  }

  /* ---------------------------------------------------------------- 3b. the flourishes, one page per set, on a virtual clock */
  const CLOCK = () => {
    if (window.__vc) return;
    const real = { animate: Element.prototype.animate, now: performance.now.bind(performance) };
    let t = real.now(), rid = 0, tid = 5e6; const rafs = new Map(), timers = new Map(), anims = [];
    window.requestAnimationFrame = (cb) => { rafs.set(++rid, cb); return rid; };
    window.cancelAnimationFrame = (id) => { rafs.delete(id); };
    window.setTimeout = (fn, ms, ...a) => { const id = ++tid; timers.set(id, { at: t + (ms || 0), fn, a }); return id; };
    window.clearTimeout = (id) => { timers.delete(id); };
    performance.now = () => t;
    Element.prototype.animate = function (...args) { const a = real.animate.apply(this, args); a.pause(); a.__t0 = t; anims.push(a); return a; };
    window.__vc = {
      get t() { return t; }, timers,
      step(ms, each) {
        const n = Math.max(1, Math.round(ms / (1000 / 60)));
        for (let i = 0; i < n; i++) {
          t += 1000 / 60;
          Array.from(timers.entries()).filter(([, v]) => v.at <= t).sort((a, b) => a[1].at - b[1].at).forEach(([id, v]) => { if (timers.has(id)) { timers.delete(id); v.fn(...v.a); } });
          const q = Array.from(rafs.entries()); rafs.clear(); q.forEach(([, cb]) => cb(t));
          for (let k = anims.length - 1; k >= 0; k--) { const a = anims[k]; if (a.playState === 'idle') { anims.splice(k, 1); continue; } try { a.currentTime = t - a.__t0; } catch (e) { /* done */ } }
          if (each) each(t);
        }
      },
    };
  };
  /** Plays one event through BR.Sets.onEvent (or a demo through BR.Sets.flourish) on the virtual clock and reports everything it did, from outside. */
  const TRACE = () => {
    window.__trace = (kind, arg, o = {}) => {
      const fx = BR.fx, vc = window.__vc, t0 = performance.now();
      const T = { calls: 0, ends: [], others: 0, keys: new Set(), dom: new Set(), bad: [], seen: new Set() };
      const orig = {}; ['emit', 'sprite', 'link', 'ring', 'sparks', 'shards', 'confetti', 'explosion', 'firework', 'bolt'].forEach((k) => { orig[k] = fx[k]; });
      const rel = () => performance.now() - t0;
      fx.emit = function (p) { T.calls++; T.ends.push(rel() + (p.max != null ? p.max : 0.8) * 1000); return orig.emit.apply(this, arguments); };
      fx.sprite = function (p) { T.calls++; T.ends.push(rel() + (p.max != null ? p.max : 0.8) * 1000); return orig.sprite.apply(this, arguments); };
      fx.link = function (a, b, c, d, e, life) { T.calls++; T.ends.push(rel() + (life == null ? 0.5 : life) * 1000); return orig.link.apply(this, arguments); };
      fx.ring = function (x, y, c, r, life) { T.calls++; T.ends.push(rel() + (life == null ? 0.5 : life) * 1000); return orig.ring.apply(this, arguments); };
      ['sparks', 'shards', 'confetti', 'explosion', 'firework', 'bolt'].forEach((k) => { fx[k] = function () { T.others++; return orig[k].apply(this, arguments); }; });
      const oa = Element.prototype.animate;
      Element.prototype.animate = function (kf, opts) { T.ends.push(rel() + (opts.delay || 0) + opts.duration); kf.forEach((k) => Object.keys(k).forEach((p) => T.keys.add(p))); return oa.apply(this, arguments); };
      const mo = new MutationObserver(() => {}); mo.observe(document.body, { childList: true, subtree: true });
      const base = { parts: new Set(fx.parts), links: new Set(fx.links), rings: new Set(fx.rings), live: BR.U4.live.length };
      const B = BR.Run.view.boardEl.getBoundingClientRect(), box = o.box || { l: B.left, t: B.top, r: B.right, b: B.bottom };
      const before = { eng: JSON.stringify(BR.Run.engine.snapshot()), sav: JSON.stringify(BR.Storage.data) };
      const was = BR.Sets.last;
      let handle = null;
      if (kind === 'event') BR.Sets.onEvent(arg, __D(arg, o)); else handle = BR.Sets.flourish(arg, o.host);
      const played = BR.Sets.last !== was;
      const mine = () => ({ p: fx.parts.filter((p) => !base.parts.has(p)), l: fx.links.filter((p) => !base.links.has(p)), r: fx.rings.filter((p) => !base.rings.has(p)) });
      const sample = () => {
        document.querySelectorAll('.sf-stage, .sf-stage *').forEach((n) => T.dom.add(n));
        const m = mine(); m.p.forEach((p) => T.seen.add(p)); m.l.forEach((p) => T.seen.add(p)); m.r.forEach((p) => T.seen.add(p));
        const inB = (x, y, tol = 2) => x >= box.l - tol && x <= box.r + tol && y >= box.t - tol && y <= box.b + tol;
        m.p.forEach((p) => { if (!inB(p.x, p.y)) T.bad.push(`particle ${Math.round(p.x)},${Math.round(p.y)} at ${Math.round(rel())}`); });
        m.l.forEach((l) => { if (!inB(l.x0, l.y0) || !inB(l.x1, l.y1)) T.bad.push(`link at ${Math.round(rel())}`); });
        m.r.forEach((r) => { if (r.x - r.radius < box.l - 2 || r.x + r.radius > box.r + 2 || r.y - r.radius < box.t - 2 || r.y + r.radius > box.b + 2) T.bad.push(`ring ${Math.round(r.x)},${Math.round(r.y)} r${Math.round(r.radius)}`); });
        document.querySelectorAll('.sf-stage').forEach((st) => { const q = st.getBoundingClientRect(), cs = getComputedStyle(st); if (Math.abs(q.left - (o.stageBox || box).l) > 1.5 || Math.abs(q.top - (o.stageBox || box).t) > 1.5 || cs.overflow !== 'hidden') T.bad.push('stage box ' + [q.left, q.top, q.width, q.height].map(Math.round)); });
      };
      let stageGone = null, mid = null;
      if (played) {
        sample(); mid = null;
        vc.step(900 + 120, (t) => { sample(); const ms = t - t0; if (mid === null && ms >= 150) mid = document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.sf-stage')).flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k))); if (stageGone === null && ms > 50 && !document.querySelector('.sf-stage')) stageGone = ms; });
      }
      vc.step(100);
      const left = mine();
      Object.keys(orig).forEach((k) => { fx[k] = orig[k]; }); Element.prototype.animate = oa;
      const recs = mo.takeRecords(); mo.disconnect();
      const added = new Set(); recs.forEach((r) => r.addedNodes.forEach((n) => { if (n.nodeType === 1) { added.add(n); n.querySelectorAll('*').forEach((c) => added.add(c)); } }));
      const after = { eng: JSON.stringify(BR.Run.engine.snapshot()), sav: JSON.stringify(BR.Storage.data) };
      const last = BR.Sets.last;
      return {
        played, handle: handle && { set: handle.set, ms: handle.ms, particles: handle.particles }, last: last && { set: last.set, ms: last.ms, particles: last.particles },
        calls: T.calls, dom: added.size, domSeen: T.dom.size, others: T.others, end: Math.round(Math.max(0, ...T.ends)), keys: Array.from(T.keys), midKeys: Array.from(new Set(mid || [])), bad: T.bad.slice(0, 5), nBad: T.bad.length,
        stageGone: stageGone && Math.round(stageGone), leftover: [left.p.length, left.l.length, left.r.length], live: BR.U4.live.length - base.live, stages: document.querySelectorAll('.sf-stage').length,
        engineSame: before.eng === after.eng, saveSame: before.sav === after.sav, seen: T.seen.size,
      };
    };
  };
  /** Plays the REAL game event (so its own big texts are up: the stage wipe, the Rush banner, the callouts) and checks, frame by frame, that nothing of the
      set covers any visible text: the canvas sprites of the flourish never touch a text's box, and the DOM layers are always below the text (hit-testing with
      pointer events switched on for everything). */
  const TEXT = () => {
    window.__text = (type) => {
      const fx = BR.fx, run = BR.Run, orig = BR.Sets.onEvent, mine = [];
      BR.Sets.onEvent = function (t, d, c) { const before = new Set(fx.parts); const out = orig.call(this, t, d, c); fx.parts.forEach((p) => { if (!before.has(p) && p.kind === 'img') mine.push(p); }); return out; };
      BR.Sets.rest();
      if (type === 'stageUp') run.stageBeat({ from: 1, to: 2, mult: 1.5 }, run.token);
      else if (type === 'rushStart') { run.rushStart(); run.rushShow(); }
      else if (type === 'sparkEnd') run.sparkEnd(true);
      else if (type === 'line') { run.callout('GREAT!', '#ffd66b'); BR.Skins.onEvent('line', __D('line')); }
      const hs = document.createElement('style'); hs.textContent = 'html.hit *{pointer-events:auto!important}'; document.head.appendChild(hs);
      const hits = {}, seen = new Set(); let checked = 0, over = 0, stages = 0;
      for (let f = 0; f < 75; f++) {
        window.__vc.step(16.7);
        const texts = Array.from(document.querySelectorAll('.stage-wipe.go .sw-text span, .stage-wipe.go .sw-text b, .stage-wipe.go .sw-text em, #rushBanner.go span, .callout, #score, #stageTag, #stageGoal, #multTag, #fuseTime, #goalLine.show, #lastSpark.on b'))
          .map((el) => { const q = el.getBoundingClientRect(); return { el, l: q.left, t: q.top, r: q.right, b: q.bottom, name: el.id || el.className || el.tagName }; })
          .filter((q) => q.r - q.l > 2 && q.b - q.t > 2 && getComputedStyle(q.el).opacity > 0.3);
        texts.forEach((q) => seen.add(q.name));
        mine.forEach((p) => {
          if (p.life >= p.max || p.a < 0.02) return;
          const vis = p.a * Math.min(1, (1 - p.life / p.max) * 2.2); if (vis < 0.25) return;
          const w = p.size * Math.max(Math.abs(p.sx), 0.01), h = w * (p.img.height / p.img.width) * Math.abs(p.sy / (p.sx || 1)), rad = Math.min(w, h) * 0.42;
          texts.forEach((q) => { if (p.x + rad > q.l && p.x - rad < q.r && p.y + rad > q.t && p.y - rad < q.b) hits[q.name] = (hits[q.name] || 0) + 1; });
        });
        if (document.querySelector('.sf-stage')) {
          stages++;
          document.documentElement.classList.add('hit');
          texts.forEach((q) => {
            if (q.el.id === 'score' || q.el.id === 'stageTag') return;
            const stack = document.elementsFromPoint((q.l + q.r) / 2, (q.t + q.b) / 2), ti = stack.indexOf(q.el), si = stack.findIndex((e) => e.closest && e.closest('.sf-stage'));
            if (si >= 0 && ti >= 0) { checked++; if (si < ti) over++; }
          });
          document.documentElement.classList.remove('hit');
        }
      }
      BR.Sets.onEvent = orig; hs.remove(); run.el.classList.remove('rushing');
      ['rushBanner', 'stageWipe'].forEach((id) => document.getElementById(id).classList.remove('go')); document.querySelectorAll('.callout').forEach((n) => n.remove());   // the game's own texts are put away for the pictures that follow
      return { sprites: mine.length, hits, seen: Array.from(seen), checked, over, stages };
    };
  };
  const clockStep = (page, ms) => page.evaluate((ms) => window.__vc.step(ms), ms);
  const trace = (page, kind, arg, o) => page.evaluate(([k, a, o]) => window.__trace(k, a, o), [kind, arg, o || {}]);

  const sheetOf = async (shots, labels, file, cols = 4, w = 320) => {
    const html = `<html><body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:4px;font:12px sans-serif;color:#fff">${shots.map((b, i) => `<div style="position:relative"><img width="${w}" src="data:image/png;base64,${b.toString('base64')}"><span style="position:absolute;left:4px;top:2px;text-shadow:0 0 3px #000">${labels[i]}</span></div>`).join('')}</body></html>`;
    const pg = await browser.newPage({ viewport: { width: cols * (w + 4), height: 400 } });
    await pg.setContent(html); shot(file, await pg.screenshot({ fullPage: true })); await pg.close();
  };

  const summary = [];
  for (const id of ORDER) {
    const { page, errors } = await fresh(browser);
    await inject(page);
    await page.evaluate(DATA);
    await wear(page, SET_ITEMS[id]);
    await startRun(page);
    await page.evaluate(() => { BR.Run.clock = false; });   // a flourish is looked at on a still board: the fuse does not burn while the clock is ours
    await page.evaluate(CLOCK); await page.evaluate(TRACE); await page.evaluate(TEXT);
    const art0 = await page.evaluate(() => !!document.getElementById('setsArt'));
    ok(art0 === (id !== 'glade'), `${id}: art baked at run start ${art0} (every set but the Glade has DOM art, baked when the run starts so the first flourish does not stall)`);
    const geo = await rects(page);
    ok(!hit(geo.board, geo.strip) && !hit(geo.board, geo.score) && !hit(geo.board, geo.time) && !hit(geo.board, geo.band), `${id}: the board's box overlaps HUD text, so "inside the board" would not mean "clear of text"`);

    const type = EVENT[id];
    await page.evaluate(() => BR.Sets.rest());
    const t = await trace(page, 'event', type);
    ok(t.played, `${id}: ${type} did not play the flourish`);
    ok(t.last && t.last.set === id, `${id}: the flourish that played was ${t.last && t.last.set}`);
    ok(t.calls + t.dom <= 30, `${id}: ${t.calls} fx calls + ${t.dom} DOM nodes = ${t.calls + t.dom} particles (max 30)`);
    ok(t.last && t.calls + t.dom === t.last.particles, `${id}: the budget says ${t.last && t.last.particles} but ${t.calls + t.dom} were made (${t.calls} fx, ${t.dom} DOM)`);
    ok(t.last && t.last.particles <= 30 && t.last.particles >= 12, `${id}: ${t.last && t.last.particles} particles is thin or over the cap`);
    ok(t.end <= 900, `${id}: something lasts until ${t.end} ms (max 900)`);
    ok(t.last && t.end <= t.last.ms + 1 && t.last.ms <= 900 && t.last.ms >= 600, `${id}: it declares ${t.last && t.last.ms} ms but its last piece ends at ${t.end} ms (and a flourish should fill the time)`);
    ok(t.stageGone != null ? t.stageGone <= 940 : true, `${id}: the stage was removed at ${t.stageGone} ms`);
    ok(t.others === 0, `${id}: it used ${t.others} fx helpers that make particles by the dozen`);
    ok(t.keys.every((k) => SAFE.has(k)), `${id}: a DOM layer animates ${t.keys.filter((k) => !SAFE.has(k))}`);
    ok(t.midKeys.every((k) => SAFE.has(k)), `${id}: a running animation uses ${t.midKeys.filter((k) => !SAFE.has(k))}`);
    ok(t.nBad === 0, `${id}: ${t.nBad} pieces left the board's box (the HUD is outside it)`, t.bad);
    ok(t.stages === 0 && t.leftover.every((n) => n === 0) && t.live === 0, `${id}: left behind: ${t.stages} stages, particles/links/rings ${t.leftover}, ${t.live} steered`, t);
    ok(t.engineSame && t.saveSame, `${id}: the engine or the save changed (engine ${t.engineSame}, save ${t.saveSame})`);
    const art1 = await page.evaluate(() => !!document.getElementById('setsArt'));
    ok(art1 === (id !== 'glade'), `${id}: baked art present ${art1}`);
    summary.push(`${id.padEnd(8)} ${type.padEnd(9)} ${String(t.last && t.last.particles).padStart(2)} particles (${t.calls} fx + ${t.dom} DOM)  ends ${String(t.end).padStart(3)} ms  stage gone ${t.stageGone || '-'}`);

    // once per 6 s: a second event, a second later, plays nothing; after 6 s it plays again
    await clockStep(page, 1000);
    const again = await trace(page, 'event', type);
    ok(!again.played && again.calls === 0 && again.dom === 0, `${id}: played again after 1 s (${again.calls} fx calls)`);
    await clockStep(page, 5100);
    const later = await trace(page, 'event', type);
    ok(later.played && later.calls + later.dom <= 30 && later.engineSame, `${id}: did not play again after 6 s`);
    // the cap holds for every variant: five more plays
    let worst = 0, worstMs = 0;
    for (let i = 0; i < 5; i++) { await clockStep(page, 6100); const v = await trace(page, 'event', type, { vert: i % 2 === 1, r: (i * 3) % 8, c: (i * 5 + 1) % 8 }); worst = Math.max(worst, v.calls + v.dom); worstMs = Math.max(worstMs, v.end); ok(v.played && v.nBad === 0 && v.leftover.every((n) => n === 0) && v.stages === 0, `${id}: play ${i + 2}: played ${v.played}, ${v.nBad} outside the board`, v.bad); }
    ok(worst <= 30 && worstMs <= 900, `${id}: over 5 more plays the worst was ${worst} particles, ${worstMs} ms`);

    // the other events play nothing
    const wrong = ['pop', 'rushEnd', 'spark', 'results', 'line', 'stageUp', 'rushStart', 'sparkEnd'].filter((e) => !(e === type));
    await clockStep(page, 6100);
    for (const e of wrong) {
      const should = (id === 'spire' && e === 'stageUp') || (id === 'library' && e === 'line') || (id === 'glade' && e === 'stageUp') || (id === 'alchemy' && e === 'rushStart') || (id === 'vault' && e === 'sparkEnd') || (id === 'spire' && e === 'rushStart');
      if (should) continue;
      const w = await trace(page, 'event', e, { saved: false });
      ok(!w.played && w.calls === 0 && w.dom === 0, `${id}: ${e} played a flourish`);
    }
    if (id === 'vault') { await clockStep(page, 6100); const w = await trace(page, 'event', 'sparkEnd', { saved: false }); ok(!w.played, 'vault: an UNSAVED Last Spark played Time Turn'); }
    if (id === 'spire') {
      // first stage-up of a run, then only Rush starts; a new run (a new engine) starts counting again
      await clockStep(page, 6100);
      await page.evaluate(() => { BR.Run.engine = new BR.Engine({ mode: 'rush', seed: 11, boosts: {} }); BR.Run.engine.fuse = 25; });
      const a = await trace(page, 'event', 'stageUp'); ok(a.played, 'spire: the first stage-up of a run did not play');
      await clockStep(page, 6100);
      const b = await trace(page, 'event', 'stageUp'); ok(!b.played, 'spire: the second stage-up of a run played');
      const c = await trace(page, 'event', 'rushStart'); ok(c.played, 'spire: a Rush start did not play');
      await clockStep(page, 6100);
      await page.evaluate(() => { BR.Run.engine = new BR.Engine({ mode: 'rush', seed: 12, boosts: {} }); BR.Run.engine.fuse = 25; });
      const d = await trace(page, 'event', 'stageUp'); ok(d.played, 'spire: the first stage-up of the next run did not play');
    }

    // through the public path (BR.Skins.onEvent): the handler is wired
    await clockStep(page, 6100);
    const wired = await page.evaluate(([type]) => { const was = BR.Sets.last; BR.Skins.onEvent(type, __D(type)); const p = BR.Sets.last !== was; return p; }, [type]);
    ok(wired, `${id}: BR.Skins.onEvent does not reach the set (the handler is not registered)`);
    await clockStep(page, 1100);

    // results stops a flourish that is still playing (Glade, Alchemy, Vault have DOM layers to see it)
    await clockStep(page, 6100);
    const stopped = await page.evaluate(([type]) => { BR.Sets.onEvent(type, __D(type)); window.__vc.step(200); const during = document.querySelectorAll('.sf-stage').length; BR.Skins.onEvent('results', __D('results')); const after = document.querySelectorAll('.sf-stage').length; window.__vc.step(100); return { during, after, parts: BR.fx.parts.length }; }, [type]);
    ok(stopped.after === 0 && (id === 'library' || id === 'spire' || stopped.during === 1), `${id}: results left ${stopped.after} stages (during: ${stopped.during})`, stopped);
    await clockStep(page, 1100);

    // never over text: the real event, with the game's own texts up (the Spire also on its Rush start)
    for (const ev of id === 'spire' ? ['stageUp', 'rushStart'] : [type]) {
      await clockStep(page, 6100);
      if (id === 'spire' && ev === 'stageUp') await page.evaluate(() => { BR.Run.engine = new BR.Engine({ mode: 'rush', seed: 13, boosts: {} }); BR.Run.engine.fuse = 25; });   // the first stage-up of a run
      const tx = await page.evaluate((ev) => window.__text(ev), ev);
      ok(Object.keys(tx.hits).length === 0, `${id}: on ${ev} its pieces cover text: ${JSON.stringify(tx.hits)}`);
      ok(tx.over === 0 && tx.checked > 20 && tx.stages > 20, `${id}: on ${ev} its DOM layers were above the game's text ${tx.over} times of ${tx.checked} (stage up for ${tx.stages} frames)`);
      ok(ev !== 'stageUp' || tx.seen.includes('swNum'), `${id}: the stage wipe's text never showed in the check`, tx.seen);
      ok(ev !== 'rushStart' || tx.seen.includes('SPAN'), `${id}: the Rush banner's text never showed in the check`, tx.seen);
      await clockStep(page, 1500);
    }

    // Reduce Motion and low-end on the virtual clock too: no flourish, no fx call, no timer
    for (const mode of ['reduced', 'low']) {
      await page.evaluate((m) => { const s = BR.Storage.data.settings; s.reduced = m === 'reduced'; s.perf = m === 'low' ? 'low' : 'high'; BR.App.applySettings(); BR.Sets.rest(); }, mode);
      const r = await trace(page, 'event', type);
      ok(!r.played && r.calls === 0 && r.dom === 0 && !(await page.evaluate(() => [...document.querySelectorAll('.sf-stage')].length)), `${id}: ${mode} played the flourish`);
      const hnd = await page.evaluate((id) => !!BR.Sets.flourish(id, document.getElementById('board')), id);
      ok(!hnd, `${id}: ${mode}: BR.Sets.flourish played`);
    }
    await page.evaluate(() => { const s = BR.Storage.data.settings; s.reduced = false; s.perf = 'high'; BR.App.applySettings(); BR.Sets.rest(); });

    // a demo inside any element (every set, whether worn or not)
    if (id === 'library') {
      for (const sid of ORDER) {
        const host = await page.evaluate(() => { let h = document.getElementById('demoHost'); if (!h) { h = document.createElement('div'); h.id = 'demoHost'; h.style.cssText = 'position:fixed;left:30px;top:120px;width:230px;height:230px;border-radius:18px;z-index:5;background:#223'; document.body.appendChild(h); } const r = h.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
        await clockStep(page, 300);
        const d = await page.evaluate(([sid, host]) => { const h = document.getElementById('demoHost'); return window.__trace('demo', sid, { host: h, box: host, stageBox: host }); }, [sid, host]);
        ok(d.played && d.handle && d.handle.set === sid && d.calls + d.dom <= 30 && d.end <= 900 && d.nBad === 0 && d.stages === 0 && d.leftover.every((n) => n === 0) && d.keys.every((k) => SAFE.has(k)) && d.others === 0, `demo ${sid} in an element: ${JSON.stringify({ played: d.played, calls: d.calls, dom: d.dom, end: d.end, bad: d.bad, stages: d.stages, left: d.leftover, keys: d.keys })}`);
        const pos = await page.evaluate(() => document.getElementById('demoHost').style.position);
        ok(pos === 'fixed' || pos === '', `demo ${sid}: the host's position is now ${pos}`);
      }
      await page.evaluate(() => document.getElementById('demoHost').remove());
      // the context the Skins handlers get ({ fx, view }) works too: the stage goes into the run's own effect layer
      const vctx = await page.evaluate(() => {
        window.__vc.step(7000);
        const h = BR.Sets.flourish('spire', { fx: BR.fx, view: BR.Run.view }), st = document.querySelectorAll('#fxlayer > .sf-stage').length;
        window.__vc.step(1000);
        return { ok: !!h, st, after: document.querySelectorAll('.sf-stage').length };
      });
      ok(vctx.ok && vctx.st === 1 && vctx.after === 0, 'demo: a { fx, view } context', vctx);
      // a plain (static) host gets position: relative while it plays and is given back; stop() ends it
      const sp = await page.evaluate(() => {
        const h = document.createElement('div'); h.id = 'staticHost'; h.style.cssText = 'width:200px;height:200px;margin:300px 0 0 20px'; document.getElementById('app').appendChild(h);
        window.__vc.step(7000);
        const hd = BR.Sets.flourish('vault', h); window.__vc.step(120);
        const during = { pos: h.style.position, stage: h.querySelectorAll('.sf-stage').length };
        hd.stop(); window.__vc.step(60);
        const after = { pos: h.style.position, stage: h.querySelectorAll('.sf-stage').length, any: document.querySelectorAll('.sf-stage').length };
        const h2 = BR.Sets.flourish('glade', h), h3 = BR.Sets.flourish('alchemy', h); window.__vc.step(60);
        const restart = { stages: document.querySelectorAll('.sf-stage').length };
        window.__vc.step(1100); h.remove();
        return { during, after, restart, tail: document.querySelectorAll('.sf-stage').length, h2: !!h2, h3: !!h3 };
      });
      ok(sp.during.pos === 'relative' && sp.during.stage === 1 && sp.after.pos === '' && sp.after.stage === 0 && sp.after.any === 0, 'demo: a static host, stop()', sp);
      ok(sp.restart.stages === 1 && sp.tail === 0, 'demo: an explicit call restarts a running flourish (one stage at a time)', sp);
    }

    // the pictures: frames of the flourish
    if (!QUICK) {
      await page.evaluate(() => { BR.Sets.rest(); });
      const frames = [60, 160, 260, 360, 460, 560, 680, 800], shots = [];
      const r = await page.evaluate(() => { const b = BR.Run.view.boardEl.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
      await page.evaluate(([type]) => BR.Sets.onEvent(type, __D(type)), [type]);
      let at = 0;
      for (const f of frames) { await clockStep(page, f - at); at = f; shots.push(await page.screenshot({ clip: { x: Math.max(0, r.x - 8), y: r.y - 8, width: r.w + 16, height: r.h + 16 } })); }
      await sheetOf(shots, frames.map((f) => f + ' ms'), `flourish-${id}.png`);
    }
    ok(errors.length === 0, `${id}: console errors`, errors.slice(0, 5));
    await page.context().close();
  }
  await browser.close();
  console.log(summary.join('\n'));
  if (!QUICK) info('pictures in ' + OUT);
  console.log(problems ? `${problems} problem(s)` : 'u5-sets: all good');
  process.exit(problems ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
