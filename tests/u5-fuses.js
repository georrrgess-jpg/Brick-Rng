// Update 5, Series 4 "Moonwick": the six new fuses, their moments, the 12 Fizz Hats, and the fuse badge box. Playwright (tests/lib.js); exit code 1 on a problem.
//   node tests/u5-fuses.js            everything
//   node tests/u5-fuses.js --quick    fewer hats and states (what the check run uses)
//   --only=badges,hats,moments,budget,lowend,api   just these parts
// What it checks (the budgets of docs/update-5/series-4-moonwick.md 3.0 and section 4):
//   api       js/hats.js and js/fuse-art.js load in Node with no DOM; the 12 hats have the agreed ids, rarities and earn strings; every body has an anchor
//   budget    per new fuse in every state: the particle pool stays at 40, nothing on the fuse uses a filter, backdrop filter or blend mode, nothing animates
//             but transform and opacity (the keyframes of every running animation and the transition properties), at most 1 hat element, nothing infinite on
//             the hat at rest (only the propeller in Rush and the wizard tip while panicking)
//   lowend    low-end and Reduce Motion: no particles, no running animation on the fuse or the hat, no sprites, no moment classes; the readout and face still change
//   moments   each moment ends in time (600ms; Rush start and stage-up 900ms), at most 3 sprites and 40 particles, clears with the run, nothing stuck after a reset
//   badges    the mini fuse's art lies inside its badge and is centred at 36, 56, 72 and 120px for all 17 fuses, and the hat badge too
//   hats      every hat on every body in every state: anchored on the head (not off it), never over the eyes, one element, hat survives states and a fuse change
const path = require('path');
const { launch } = require('./lib');
const flag = (n) => (process.argv.find((a) => a.startsWith('--' + n + '=')) || '').split('=')[1];
const QUICK = process.argv.includes('--quick');
const ONLY = flag('only') ? flag('only').split(',') : null;
const part = (n) => !ONLY || ONLY.includes(n);

let problems = 0;
const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } return !!c; };

const NEW = ['u_candle', 'u_wand', 'u_elixir', 'u_sandglass', 'u_runechain', 'u_moonrise'];
const BODIES = ['default', 'u_phoenix', 'u_dragon', 'u_sandglass', 'u_candle', 'u_wand', 'u_elixir', 'u_runechain', 'u_moonrise'];
const HATS = { h_party: 'common', h_top: 'rare', h_pom: 'common', h_propeller: 'rare', h_flower: 'rare', h_toque: 'common', h_wizard: 'epic', h_nightcap: 'common', h_tricorn: 'rare', h_halo: 'epic', h_mortar: 'epic', h_crown: 'legendary' };
const STATES = [
  { id: 'calm', hold: 'e.fuse = 27', z: 'calm', x: 'calm' },
  { id: 'watch', hold: 'e.fuse = 13.5', z: 'watch', x: 'watch' },
  { id: 'low', hold: 'e.fuse = 6.8', z: 'low', x: 'worried' },
  { id: 'crit', hold: 'e.fuse = 3.1', z: 'crit', x: 'panic' },
  { id: 'spark', hold: 'e.fuse = 0; e.spark = 1.9; e.sparkUsed = true', z: 'spark', x: 'spark' },
  { id: 'frozen', hold: 'e.fuse = 17; e.rush.active = true; e.rush.left = 5.5; e.rush.meter = 100', z: 'frozen', x: 'cool' },
  { id: 'hold', hold: 'e.fuse = e.fuseMax; e.freeze = 1', z: 'hold', x: 'glad' },
];

/* ------------------------------------------------------------------ api (Node, no browser) */
function apiTests() {
  global.window = undefined;
  for (const f of ['../js/fuse-art.js', '../js/hats.js']) { delete require.cache[require.resolve(f)]; require(f); }
  const B = globalThis.BR;
  ok(Array.isArray(B.HATS) && B.HATS.length === 12, 'BR.HATS has 12 hats', B.HATS && B.HATS.length);
  const earn = ['Free with Update 5', 'Season 4 Pass, tier 3', 'Season 4 Pass, tier 8', 'Season 4 Pass, tier 13', 'Season 4 Pass, tier 18', 'Season 4 Pass, tier 23', 'Season 4 Pass, tier 27', 'The first full 7-day streak week', 'The second full 7-day streak week', 'Save 25 runs with Last Spark', 'Complete any Moonwick set', 'Own 75 items'];
  Object.entries(HATS).forEach(([id, rar], i) => {
    const h = B.Hats.byId(id);
    ok(h && h.rarity === rar, 'hat', id, 'rarity', h && h.rarity, 'expected', rar);
    ok(h && h.name && h.desc && h.earn === earn[i], 'hat', id, 'name, desc and earn', h && h.earn);
    ok(h && B.Hats.svg(id).length > 400, 'hat', id, 'has art');
    ok(h && h.lip && h.lip.length === 3, 'hat', id, 'has a lip');
  });
  const kinds = Object.keys(B.FuseArt.BODY);
  for (const k of kinds) for (const id of Object.keys(HATS)) { const a = B.Hats.anchor(id, k); ok(a && isFinite(a.x) && isFinite(a.y) && a.s > 0.3 && a.s <= 1.1, 'anchor', id, k, a); }
  ok(B.Hats.kindOf('flask') === 'flask' && B.Hats.kindOf('classic') === 'ball' && B.Hats.kindOf('phoenix') === 'egg', 'hat classes of bodies');
  for (const k of ['wax', 'robe', 'flask', 'hourglass', 'golem', 'moon']) ok(B.FuseArt.BODY[k], 'body', k);
  for (const c of ['fuse-candle', 'fuse-wand', 'fuse-elixir', 'fuse-sandglass', 'fuse-runechain', 'fuse-moonrise']) {
    const t = B.FuseArt.TOKENS[c];
    ok(t && t.rope.base && t.rope.low && t.rope.crit && t.flame && t.ember && t.ash && t.heat && t.part.smoke && t.part.special && t.bomb && t.bomb.face, 'token block of', c);
    ok(['drip', 'twinkle', 'bubble', 'grain', 'chip', 'stardust'].includes(t.part.special.shape), 'special particle of', c, t.part.special.shape);
    const a = B.FuseArt.BODY[t.bomb.kind](t.bomb.pal, {}), b = B.FuseArt.BODY[t.bomb.kind](t.bomb.pal, { nt: true });
    ok(typeof a === 'string' && typeof b === 'string', 'body svg of', c);
  }
  ok(B.FuseArt.FLAME.candle, 'the candle flame shape');
  global.window = undefined;
}

/* ------------------------------------------------------------------ page helpers */
const ALLOWED = new Set(['transform', 'opacity', 'translate', 'rotate', 'scale', 'offset', 'easing', 'composite', 'computedOffset']);
(async () => {
  if (part('api')) apiTests();
  if (ONLY && ONLY.length === 1 && ONLY[0] === 'api') { console.log(problems ? problems + ' PROBLEMS' : 'u5-fuses ok'); process.exit(problems ? 1 : 0); }

  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 2 });
  await page.evaluate(() => { const D = BR.Storage.data; D.seenTutorial = true; D.runs = 8; D.settings.sound = false; D.settings.music = false; D.settings.haptics = false; D.settings.perf = 'high'; BR.App.applySettings(); });
  const equip = (id) => page.evaluate((id) => {
    const P = BR.Progress;
    if (id === 'default') P.equip('default', 'fuse'); else { const inst = BR.Storage.data.profile.vault.find((v) => v.itemId === id) || P.keep({ itemId: id, shine: 'plain', seed: 5, counter: null }); P.equip(inst.uid, 'fuse'); }
    BR.Skins.apply();
    if (BR.Router.current === 'run') { BR.Run.over = true; BR.Run.token++; BR.Router.go('home', { instant: true }); }
    __app.startRun({ mode: 'rush', boosts: {} });
  }, id);
  const ready = () => page.waitForFunction(() => BR.Run.clock && !BR.Run.busy && BR.Router.current === 'run', null, { timeout: 15000 });
  const hold = (src) => page.evaluate((src) => {
    clearInterval(window.__hold);
    const set = () => { const e = BR.Run.engine; if (!e || e.over) return; e.rush.active = false; e.freeze = 0; e.spark = 0; new Function('e', src)(e); };
    set(); window.__hold = setInterval(set, 25);
  }, src);
  const release = () => page.evaluate(() => clearInterval(window.__hold));
  const toState = async (st, ms) => { await hold(st.hold); await page.waitForFunction((z) => BR.Fuse.z === z, st.z, { timeout: 4000, polling: 30 }).catch(() => {}); await page.waitForTimeout(ms || (st.id === 'frozen' ? 900 : 650)); };

  /* what is running on the fuse: infinite animations, and the properties every animation and transition touches */
  const audit = () => page.evaluate((ALLOWED) => {
    const allowed = new Set(ALLOWED);
    const els = Array.from(document.querySelectorAll('#fuse, #fuse *'));
    const out = { infinite: [], badProps: [], filters: [], hats: document.querySelectorAll('#fuse .fz-hat').length, sprites: document.querySelectorAll('#fuse .mx-sprite').length, mx: Array.from(document.getElementById('fuse').classList).filter((c) => c.indexOf('mx-') === 0) };
    for (const el of els) {
      const c = getComputedStyle(el);
      if ((c.filter && c.filter !== 'none') || (c.backdropFilter && c.backdropFilter !== 'none') || (c.mixBlendMode && c.mixBlendMode !== 'normal')) out.filters.push(el.className.toString().slice(0, 30));
      for (const a of el.getAnimations()) {
        const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : {};
        const cls = (el.className.toString() + (el.dataset && el.dataset.part ? '[' + el.dataset.part + ']' : '')).slice(0, 36);
        if (a.playState === 'running' && t.iterations === Infinity) out.infinite.push(cls);
        const kf = a.effect && a.effect.getKeyframes ? a.effect.getKeyframes() : [];
        for (const f of kf) for (const k of Object.keys(f)) if (!allowed.has(k)) out.badProps.push(cls + ':' + k);
        if (a.transitionProperty && !allowed.has(a.transitionProperty) && !/^(--|color)/.test(a.transitionProperty)) out.badProps.push(cls + ' transition:' + a.transitionProperty);
      }
      // declared transitions on the hat and on the new layers: only transform and opacity
      const tp = c.transitionProperty;
      if (tp && tp !== 'all' && (el.matches('.fz-hat, .fz-hat *, .fx-lq, .fx-ph, .fx-halo, .fx-corona, .fx-hang, .rn, .rn::after') )) for (const p of tp.split(',').map((s) => s.trim())) if (p !== 'transform' && p !== 'opacity') out.badProps.push((el.className.toString() || el.tagName) + ' declares transition ' + p);
    }
    out.parts = BR.Fuse.parts ? BR.Fuse.parts.live : 0;
    return out;
  }, [...ALLOWED]);

  /* ================================================================== budget: every new fuse in every state */
  if (part('budget')) {
    for (const id of NEW) {
      await equip(id); await ready();
      for (const st of STATES) {
        await toState(st);
        const a = await audit();
        const info = await page.evaluate(() => ({ z: BR.Fuse.z, x: document.getElementById('bomb').dataset.x, kind: BR.Fuse.xKind, cls: BR.Fuse.cls }));
        ok(info.z === st.z && info.x === st.x, id, st.id, 'state/face', info.z, info.x);
        ok(a.parts <= 40, id, st.id, 'particles', a.parts);
        ok(a.filters.length === 0, id, st.id, 'filter or blend mode on', a.filters.slice(0, 3));
        ok(a.badProps.length === 0, id, st.id, 'animates something other than transform and opacity', a.badProps.slice(0, 4));
        ok(a.hats === 0, id, st.id, 'a hat that was not asked for');
      }
      await release();
      const body = await page.evaluate(() => { const b = document.getElementById('bomb').getBoundingClientRect(), f = document.getElementById('fuse'); return { bs: b.width, w: f.offsetWidth, h: f.offsetHeight, bk: f.dataset.bk }; });
      ok(body.bs > 40 && body.w > 300, id, 'bomb size', body);
    }
    // the sheet really holds its own: the body kind is applied, the stylesheet baked lazily
    const lazy = await page.evaluate(() => Array.from(document.querySelectorAll('style[data-fuse]')).map((s) => s.dataset.fuse));
    ok(lazy.length >= 6, 'per-fuse stylesheets are baked on first use', lazy);
    const boot = await page.evaluate(() => { const s = document.getElementById('fuseTokens'); return s ? s.textContent.length : 0; });
    ok(boot > 1000 && boot < 120000, 'the boot stylesheet holds only the Basic Cord', boot);
  }

  /* ================================================================== low-end and Reduce Motion */
  if (part('lowend')) {
    for (const mode of ['reduced', 'low-end']) {
      await page.evaluate((mode) => { const s = BR.Storage.data.settings; s.reduced = mode === 'reduced'; s.perf = mode === 'low-end' ? 'low' : 'high'; BR.App.applySettings(); }, mode);
      for (const id of NEW) {
        await equip(id); await ready();
        await page.evaluate(() => BR.Fuse.setHat('h_propeller'));
        const seen = {};
        for (const st of STATES.filter((s) => ['calm', 'low', 'crit', 'frozen'].includes(s.id))) {
          await toState(st, 700);
          const a = await audit();
          const color = await page.evaluate(() => getComputedStyle(document.querySelector('#fuse .fz-num')).color);
          seen[st.id] = { color, z: await page.evaluate(() => BR.Fuse.z), x: await page.evaluate(() => document.getElementById('bomb').dataset.x) };
          ok(a.parts === 0, mode, id, st.id, 'particles', a.parts);
          ok(a.infinite.length === 0, mode, id, st.id, 'animations still running', a.infinite.slice(0, 4));
        }
        ok(new Set(Object.values(seen).map((v) => v.color)).size >= 3, mode, id, 'readout colour does not change with the state');
        ok(new Set(Object.values(seen).map((v) => v.x)).size === 4, mode, id, 'the face does not change with the state');
        // a Rush start, a stage-up and a Last Spark: no moment
        await release();
        await page.evaluate(() => { BR.Skins.onEvent('rushStart', { run: BR.Run, view: BR.Run.view }); BR.Skins.onEvent('stageUp', { run: BR.Run, info: { to: 3 } }); BR.Fuse.sparkStart(); });
        await page.waitForTimeout(250);
        const a2 = await audit();
        ok(a2.sprites === 0 && a2.mx.length === 0, mode, id, 'a moment ran: sprites', a2.sprites, 'classes', a2.mx);
        await page.evaluate(() => BR.Fuse.sparkEnd(false));
      }
    }
    await page.evaluate(() => { const s = BR.Storage.data.settings; s.reduced = false; s.perf = 'high'; BR.App.applySettings(); });
  }

  /* ================================================================== moments: end in time, few sprites and particles, clean after the run */
  if (part('moments')) {
    const MOMENTS = [
      ['u_elixir', 'rushStart', 900], ['u_elixir', 'rushEnd', 600], ['u_elixir', 'stageUp', 900], ['u_elixir', 'spark', 600], ['u_elixir', 'sparkEnd', 600],
      ['u_sandglass', 'rushStart', 900], ['u_sandglass', 'rushEnd', 600], ['u_sandglass', 'stageUp', 900], ['u_sandglass', 'spark', 600], ['u_sandglass', 'sparkEnd', 900],
      ['u_runechain', 'rushStart', 900], ['u_runechain', 'rushEnd', 600], ['u_runechain', 'stageUp', 900], ['u_runechain', 'spark', 600], ['u_runechain', 'sparkEnd', 600],
      ['u_moonrise', 'rushStart', 900], ['u_moonrise', 'rushEnd', 600], ['u_moonrise', 'stageUp', 900], ['u_moonrise', 'spark', 600], ['u_moonrise', 'sparkEnd', 600], ['u_moonrise', 'line', 600],
    ];
    let cur = null;
    for (const [id, ev, limit] of MOMENTS) {
      if (cur !== id) { await equip(id); await ready(); await release(); cur = id; await page.waitForTimeout(300); }
      // a calm board: hold the fuse mid-way so nothing else is going on
      await hold('e.fuse = 20');
      await page.waitForTimeout(350);
      const t0 = Date.now();
      const trace = await page.evaluate(([ev, limit]) => new Promise((resolve) => {
        const F = BR.Fuse, host = document.getElementById('fuse'), t0 = performance.now(), rec = { maxSprites: 0, maxParts: 0, p0: F.parts.live, lastBusy: 0, events: 0 };
        const detail = ev === 'stageUp' ? { run: BR.Run, info: { to: 4 } } : { run: BR.Run, view: BR.Run.view, res: { plan: { n: 9, primary: [], color: 0 } } };
        if (ev === 'spark') F.sparkStart(); else if (ev === 'sparkEnd') F.sparkEnd(true); else BR.Skins.onEvent(ev, detail);
        const tick = () => {
          const t = performance.now() - t0;
          rec.maxSprites = Math.max(rec.maxSprites, host.querySelectorAll('.mx-sprite').length);
          rec.maxParts = Math.max(rec.maxParts, F.parts.live);
          // anything finite still running on the fuse (infinite loops are states, not moments)
          const who = [];
          Array.from(host.querySelectorAll('*')).forEach((el) => el.getAnimations().forEach((a) => { if (a.playState === 'running' && a.effect.getTiming().iterations !== Infinity && (a.effect.getTiming().duration + (a.effect.getTiming().delay || 0)) > 30 && !/fz-chip|fz-glint|fz-gold|fz-flare|fz-pulse|fz-numbox|fz-burst|fz-dg|vignette/.test(el.className.toString()) && el.tagName !== 'B') who.push(el.className.toString().slice(0, 24) + (a.transitionProperty ? ':' + a.transitionProperty : '')); }));
          if (who.length) { rec.lastBusy = t; rec.who = who.slice(0, 3).join(','); }
          if (t < limit + 350) requestAnimationFrame(tick); else resolve(rec);
        };
        tick();
      }), [ev, limit]);
      ok(trace.maxSprites <= 3, id, ev, 'sprites', trace.maxSprites);
      ok(trace.maxParts <= 40, id, ev, 'particles', trace.maxParts);
      ok(trace.lastBusy <= limit + 120, id, ev, 'was still moving at', Math.round(trace.lastBusy), 'ms (limit', limit + ')', trace.who);
      void t0;
      // a Rush that was started has to be ended by the run: put the host back to rest between moments
      await page.evaluate((ev) => { if (ev === 'rushStart') BR.Skins.onEvent('rushEnd', { run: BR.Run }); if (ev === 'spark') BR.Fuse.sparkEnd(false); }, ev);
      await page.waitForTimeout(150);
    }
    // nothing sticks: a new run clears every moment class and sprite
    for (const id of ['u_sandglass', 'u_runechain', 'u_elixir']) {
      await equip(id); await ready();
      await page.evaluate(() => { BR.Skins.onEvent('rushStart', { run: BR.Run, view: BR.Run.view }); BR.Fuse.sparkStart(); });
      await page.waitForTimeout(200);
      const mid = await audit();
      ok(mid.mx.length > 0, id, 'the moment set no class', mid.mx);
      await equip(id); await ready();       // restart: a new run
      const a = await audit();
      ok(a.mx.length === 0 && a.sprites === 0, id, 'moment classes or sprites survived a new run', a.mx, a.sprites);
    }
    // the hourglass turns over in Rush: the body rotates 180 degrees, the rope's socket and the face stay where they are, and it turns back
    await equip('u_sandglass'); await ready(); await release(); await hold('e.fuse = 20');
    await page.waitForTimeout(400);
    const rects = () => page.evaluate(() => { const r = (q) => { const b = document.querySelector(q).getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map((n) => +n.toFixed(1)); }; return { sock: r('#fuse .fx-sock'), face: r('#fuse .fz-face'), tf: getComputedStyle(document.querySelector('#fuse .fz-body')).transform }; });
    const r0 = await rects();
    await page.evaluate(() => BR.Skins.onEvent('rushStart', { run: BR.Run, view: BR.Run.view }));
    await page.waitForTimeout(900);
    const r1 = await rects();
    ok(r1.tf.indexOf('matrix(-1') === 0 || /matrix\(-0?\.9\d*|matrix\(-1/.test(r1.tf), 'the hourglass body is turned over in Rush', r1.tf);
    ok(JSON.stringify(r0.sock) === JSON.stringify(r1.sock) && JSON.stringify(r0.face) === JSON.stringify(r1.face), 'the socket and the face stay put when the hourglass turns', r0.sock, r1.sock);
    await page.evaluate(() => BR.Skins.onEvent('rushEnd', { run: BR.Run }));
    await page.waitForTimeout(900);
    const r2 = await rects();
    ok(r2.tf === 'none' || /matrix\(1, 0, 0, 1/.test(r2.tf), 'the hourglass turns back when Rush ends', r2.tf);
    // the golem carves a rune per stage and the count survives a reset
    await equip('u_runechain'); await ready();
    const rn = await page.evaluate(() => { const h = document.getElementById('fuse'); const a = h.dataset.rn; BR.Skins.onEvent('stageUp', { run: BR.Run, info: { to: 5 } }); return [a, h.dataset.rn, document.querySelectorAll('#fuse .rn').length]; });
    ok(rn[0] === '1' && rn[1] === '5' && rn[2] === 8, 'runes: one lit at stage 1, five at stage 5, eight on the body', rn);
    // the moon: one phase layer visible per state
    await equip('u_moonrise'); await ready();
    for (const [st, want] of [['calm', 0], ['watch', 1], ['low', 2], ['crit', 3], ['spark', 4]]) {
      await toState(STATES.find((s) => s.id === st), 900);
      const vis = await page.evaluate(() => Array.from(document.querySelectorAll('#fuse .fx-ph')).map((e) => +getComputedStyle(e).opacity > 0.6));
      const n = vis.findIndex(Boolean) + 1;
      ok(n === want || (want === 0 && vis.every((v) => !v)), 'moon phase at', st, vis);
    }
    await release();
  }

  /* ================================================================== the fuse badge box, 17 fuses, 4 sizes */
  if (part('badges')) {
    const res = await page.evaluate(() => {
      const out = [];
      const items = BR.ITEMS.filter((i) => i.type === 'fuse').concat([BR.DEFAULTS.fuse]);
      const w = document.createElement('div'); w.className = 'u5-badges';
      w.style.cssText = 'position:fixed;left:0;top:0;z-index:999;background:#150d2a;width:2400px;display:flex;flex-wrap:wrap;gap:40px;padding:20px';
      document.body.appendChild(w);
      const cells = [];
      for (const it of items) for (const s of [36, 56, 72, 120]) for (const still of [true, false]) { const c = document.createElement('div'); c.style.cssText = 'padding:6px'; c.innerHTML = BR.Badge.html(it, { shine: 'plain', seed: 1 }, { size: s, still }); w.appendChild(c); cells.push([it, s, still, c]); }
      for (const [it, s, still, c] of cells) {
        const b = c.querySelector('.bdg'), br = b.getBoundingClientRect();
        const parts = ['.mf-bomb', '.mf-track', '.mf-fill', '.mf-spark'].map((q) => b.querySelector(q)).filter(Boolean).map((e) => e.getBoundingClientRect());
        const u = { l: Math.min(...parts.map((p) => p.left)), t: Math.min(...parts.map((p) => p.top)), r: Math.max(...parts.map((p) => p.right)), b: Math.max(...parts.map((p) => p.bottom)) };
        const bf = b.querySelector('.bdg-fuse').getBoundingClientRect();
        out.push({ id: it.id, s, still, w: Math.round(br.width), box: Math.round(bf.width), over: +Math.max(br.left - u.l, br.top - u.t, u.r - br.right, u.b - br.bottom).toFixed(1), dx: +((u.l + u.r) / 2 - (br.left + br.width / 2)).toFixed(1), dy: +((u.t + u.b) / 2 - (br.top + br.height / 2)).toFixed(1), fill: +((u.r - u.l) / br.width).toFixed(2), ok: !!b.querySelector('.mf-bomb') });
      }
      w.remove();
      return out;
    });
    ok(res.length === 17 * 8, 'badge cells', res.length);
    for (const r of res) {
      ok(r.box === r.w, r.id, r.s, 'the fuse box is', r.box, 'not the badge', r.w);
      ok(r.over <= 0.6, r.id, r.s, r.still ? 'still' : 'live', 'art sticks out of the badge by', r.over, 'px');
      ok(Math.abs(r.dx) <= r.s * 0.1 && Math.abs(r.dy) <= r.s * 0.12, r.id, r.s, 'art is off-centre', r.dx, r.dy);
      ok(r.fill >= 0.6, r.id, r.s, 'art fills only', r.fill, 'of the badge');
    }
    // the same in the Collection (a still badge in a card) and in the reel: the cards must not grow
    await page.evaluate(() => BR.Router.go('collection', { instant: true }));
    await page.waitForTimeout(500);
    await page.evaluate(() => { const t = document.querySelector('#s-collection [data-type="fuse"], #s-collection .tab[data-tab="fuse"], #s-collection button[data-t="fuse"]'); if (t) t.click(); });
    await page.waitForTimeout(500);
    const col = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('#s-collection .bdg').forEach((b) => {
        if (!b.querySelector('.bdg-fuse')) return;
        const br = b.getBoundingClientRect(), p = Array.from(b.querySelectorAll('.mf-bomb, .mf-spark, .mf-track')).map((e) => e.getBoundingClientRect());
        const over = Math.max(br.left - Math.min(...p.map((x) => x.left)), br.top - Math.min(...p.map((x) => x.top)), Math.max(...p.map((x) => x.right)) - br.right, Math.max(...p.map((x) => x.bottom)) - br.bottom);
        if (over > 0.6) bad.push(Math.round(over));
      });
      return { n: document.querySelectorAll('#s-collection .bdg-fuse').length, bad };
    });
    ok(col.bad.length === 0, 'fuse badges in the Collection stick out', col);
    await page.evaluate(() => BR.Router.go('home', { instant: true }));
    // the hat badge: Fizz and the hat inside the plate
    const hb = await page.evaluate((ids) => {
      const out = [];
      const w = document.createElement('div'); w.style.cssText = 'position:fixed;left:0;top:0;z-index:999;background:#150d2a;display:flex;flex-wrap:wrap;gap:30px;padding:20px;width:1800px';
      document.body.appendChild(w);
      for (const id of ids) for (const s of [36, 56, 72, 120]) {
        const c = document.createElement('div'); c.innerHTML = BR.Hats.badge(id, s, { still: true }); w.appendChild(c);
        const b = c.querySelector('.bdg'); if (!b) { out.push({ id, s, none: true }); continue; }
        const br = b.getBoundingClientRect(), fz = b.querySelector('.hb-fizz').getBoundingClientRect(), ht = b.querySelector('.hb-hat'), hr = ht ? getComputedStyle(ht, null) : null;
        out.push({ id, s, over: +Math.max(br.left - fz.left, br.top - fz.top, fz.right - br.right, fz.bottom - br.bottom).toFixed(1), hat: !!(hr && hr.backgroundImage !== 'none') });
      }
      w.remove();
      return out;
    }, Object.keys(HATS));
    ok(hb.length === 48 && hb.every((r) => !r.none && r.hat), 'hat badges have art', hb.filter((r) => r.none || !r.hat).slice(0, 3));
    ok(hb.every((r) => r.over <= 0.6), 'hat badges: Fizz inside the plate', hb.filter((r) => r.over > 0.6).slice(0, 3));
  }

  /* ================================================================== hat art: the declared bounds match what is drawn, and every part's picture exists */
  if (part('hats') || part('art')) {
    const art = await page.evaluate(async () => {
      const out = [];
      for (const h of BR.HATS) {
        const draw = async (svg, w, hh) => { const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await img.decode(); const c = document.createElement('canvas'); c.width = w; c.height = hh; const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, hh); return g.getImageData(0, 0, w, hh).data; };
        const S = 8, B = BR.Hats.box, d = await draw(BR.Hats.svg(h.id), B.w * S, B.h * S);
        let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, n = 0;
        for (let y = 0; y < B.h * S; y++) for (let x = 0; x < B.w * S; x++) if (d[(y * B.w * S + x) * 4 + 3] > 60) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        const parts = [];
        for (let i = 0; i < (h.parts || []).length; i++) { const p = h.parts[i], dd = await draw(BR.Hats.svg(h.id, { part: i }), p.box[2] * 4, p.box[3] * 4); let k = 0; for (let j = 3; j < dd.length; j += 4) if (dd[j] > 60) k++; parts.push(k); }
        const live = h.parts ? await draw(BR.Hats.svg(h.id, { live: true }), B.w * 2, B.h * 2) : null;
        let liveN = 0; if (live) for (let j = 3; j < live.length; j += 4) if (live[j] > 60) liveN++;
        out.push({ id: h.id, n, bbox: [x0 / S + B.x, y0 / S + B.y, x1 / S + B.x, y1 / S + B.y], declared: h.bbox, parts, liveN, full: n / (S * S) });
      }
      return out;
    });
    for (const a of art) {
      ok(a.n > 500, a.id, 'draws nothing');
      ok(a.declared && a.bbox.every((v, i) => Math.abs(v - a.declared[i]) <= 1), a.id, 'the declared bounds', a.declared, 'are not what is drawn', a.bbox.map((v) => +v.toFixed(1)));
      ok(a.parts.every((k) => k > 80), a.id, 'a part draws nothing', a.parts);
      ok(a.bbox[0] > -8 && a.bbox[2] < 72 && a.bbox[1] > -34 && a.bbox[3] < 34, a.id, 'the art leaves the 96x80 box', a.bbox);
    }
  }

  /* ================================================================== hats: every hat on every body in every state */
  if (part('hats')) {
    const hatIds = QUICK ? ['h_party', 'h_wizard', 'h_propeller', 'h_halo', 'h_top'] : Object.keys(HATS);
    const states = QUICK ? STATES.filter((s) => ['calm', 'low', 'crit', 'spark', 'frozen'].includes(s.id)) : STATES;
    const bodies = QUICK ? ['default', 'u_dragon', 'u_sandglass', 'u_elixir', 'u_moonrise'] : BODIES;
    const probe = (hatId) => page.evaluate((hatId) => {
      const F = BR.Fuse, hat = document.querySelector('#fuse .fz-hat'), bomb = document.getElementById('bomb').getBoundingClientRect();
      if (!hat) return { missing: true };
      const h = BR.Hats.byId(hatId), B = BR.Hats.box;
      // two probes inside the hat at the ends of its lowest edge, and one in the middle: their page positions come out with every transform on the way
      const pr = [[h.lip[0], h.lip[2]], [(h.lip[0] + h.lip[1]) / 2, h.lip[2]], [h.lip[1], h.lip[2]]].map(([x, y]) => { const i = document.createElement('i'); i.className = 'u5probe'; i.style.cssText = `position:absolute;width:0;height:0;left:${((x - B.x) / B.w) * 100}%;top:${((y - B.y) / B.h) * 100}%`; hat.appendChild(i); const r = i.getBoundingClientRect(); const p = { x: r.left, y: r.top }; i.remove(); return p; });
      const eyes = Array.from(document.querySelectorAll('#fuse .fz-eye')).map((e) => e.getBoundingClientRect());
      const u = bomb.width / 64;
      // is any sample of the lowest edge inside an eye?
      let inEye = false;
      for (let t = 0; t <= 1; t += 0.1) { const x = pr[0].x + (pr[2].x - pr[0].x) * t, y = pr[0].y + (pr[2].y - pr[0].y) * t; for (const e of eyes) if (x > e.left + 1 && x < e.right - 1 && y > e.top + 1 && y < e.bottom - 1) inEye = true; }
      const lipMid = pr[1], eyeTop = Math.min(...eyes.map((e) => e.top));
      return { inEye, missing: false, midX: (lipMid.x - bomb.left) / u, midY: (lipMid.y - bomb.top) / u, eyeTopU: (eyeTop - bomb.top) / u, lowestU: (Math.max(...pr.map((p) => p.y)) - bomb.top) / u, hats: document.querySelectorAll('#fuse .fz-hat').length, z: F.z };
    }, hatId);
    for (const body of bodies) {
      await equip(body); await ready();
      const kind = await page.evaluate(() => BR.Fuse.xKind || BR.FuseArt.tokensFor(BR.Fuse.cls).bomb.kind);
      for (const hat of hatIds) {
        await page.evaluate((h) => BR.Fuse.setHat(h), hat);
        for (const st of states) {
          await toState(st, st.id === 'spark' ? 500 : 520);
          const p = await probe(hat);
          const tag = `${body}/${hat}/${st.id}`;
          if (!ok(!p.missing && p.hats === 1, tag, 'the hat element', p)) continue;
          ok(!p.inEye, tag, 'the hat covers an eye');
          // on the head: the middle of the lowest edge is over the bomb horizontally, and not below the eyes' tops
          ok(Math.abs(p.midX - 32) <= (st.id === 'spark' ? 22 : 14), tag, 'the hat is off the head sideways', Math.round(p.midX));
          ok(p.midY <= p.eyeTopU + 1 || hat === 'h_halo', tag, 'the middle of the hat\'s lowest edge is below the top of the eyes:', p.midY.toFixed(1), 'eyes', p.eyeTopU.toFixed(1));
          if (st.id !== 'spark') ok(p.midY > -22 && p.midY < 26, tag, 'the hat is off the head vertically', Math.round(p.midY));
        }
        if (!QUICK || hat === 'h_wizard') {
          // budget on the hat: nothing infinite at rest (calm, watch, low, hold), only the propeller in Rush and the wizard's tip when panicking
          for (const st of STATES.filter((s) => ['calm', 'watch', 'low', 'hold', 'frozen', 'crit'].includes(s.id))) {
            await toState(st, 450);
            const a = await audit();
            const inf = a.infinite.filter((c) => /fz-hat|hp/.test(c) || /\[(blades|tip)\]/.test(c));
            const allowed = (st.id === 'frozen' && hat === 'h_propeller') || (st.id === 'crit' && hat === 'h_wizard');
            ok(allowed ? inf.length <= 1 : inf.length === 0, `${body}/${hat}/${st.id}`, 'infinite animation on the hat', inf);
            ok(a.badProps.length === 0, `${body}/${hat}/${st.id}`, 'hat animates', a.badProps.slice(0, 3));
            ok(a.hats === 1, `${body}/${hat}/${st.id}`, 'hat elements', a.hats);
          }
        }
      }
      // the hat follows a change of fuse body and goes away when taken off
      await release();
    }
    // a fuse change keeps the hat and re-anchors it; taking it off removes it; a new run puts it back after a blast
    await equip('default'); await ready();
    await page.evaluate(() => BR.Fuse.setHat('h_top'));
    const a1 = await page.evaluate(() => { const h = document.querySelector('#fuse .fz-hat'); return h && [h.style.getPropertyValue('--hy'), h.style.getPropertyValue('--hs')]; });
    await equip('u_elixir'); await ready();
    const a2 = await page.evaluate(() => { const h = document.querySelector('#fuse .fz-hat'); return h && [h.style.getPropertyValue('--hy'), h.style.getPropertyValue('--hs')]; });
    ok(a1 && a2 && (a1[0] !== a2[0] || a1[1] !== a2[1]), 'the hat is re-anchored when the body changes', a1, a2);
    const keeps = await page.evaluate(() => !!document.querySelector('#fuse .fz-hat') && document.getElementById('fuse').classList.contains('hatted'));
    ok(keeps, 'the hat stays on after the fuse changed');
    // no topper under a hat: the body picture changes to the one without
    const nt = await page.evaluate(() => getComputedStyle(document.querySelector('#fuse .fz-body')).backgroundImage !== getComputedStyle(document.documentElement).getPropertyValue('x'));
    ok(nt, 'a body is drawn');
    // fuse out: the hat flies off, and a new run has it back on
    await page.evaluate(() => { BR.Fuse.fuseOut(); });
    await page.waitForTimeout(1000);
    const off = await page.evaluate(() => +getComputedStyle(document.querySelector('#fuse .fz-hat')).opacity);
    ok(off < 0.1, 'the hat flies off when the fuse is out', off);
    await equip('u_elixir'); await ready();
    const back = await page.evaluate(() => { const h = document.querySelector('#fuse .fz-hat'); return { o: +getComputedStyle(h).opacity, anim: h.getAnimations().length }; });
    ok(back.o > 0.9 && back.anim === 0, 'the hat is back after a new run', back);
    await page.evaluate(() => BR.Fuse.setHat(null));
    ok(await page.evaluate(() => !document.querySelector('#fuse .fz-hat') && !document.getElementById('fuse').classList.contains('hatted')), 'taking the hat off removes it');
    // an unknown id leaves Fizz bare
    await page.evaluate(() => BR.Fuse.setHat('h_nope'));
    ok(await page.evaluate(() => !document.querySelector('#fuse .fz-hat')), 'an unknown hat id is ignored');
    // the small preview wears a hat too
    const mini = await page.evaluate(() => {
      const w = document.createElement('div'); w.style.cssText = 'position:fixed;left:0;top:0;z-index:999;background:#150d2a;padding:20px';
      w.innerHTML = `<div class="mini-fuse fuse-candle"${BR.Hats.miniAttrs('h_crown', 'fuse-candle')}><span class="mf-bomb"></span><span class="mf-track"><i class="mf-fill"></i><b class="mf-spark"></b></span></div>`;
      document.body.appendChild(w);
      const bomb = w.querySelector('.mf-bomb'), cs = getComputedStyle(bomb, '::after'), r = { img: cs.backgroundImage !== 'none', w: parseFloat(cs.width) };
      w.remove(); return r;
    });
    ok(mini.img && mini.w > 40, 'the .mini-fuse preview draws the hat', mini);
  }

  const real = errors.filter((e) => !/Failed to load resource/.test(e));
  ok(real.length === 0, 'console errors', real.slice(0, 5));
  await browser.close();
  console.log(problems ? problems + ' PROBLEMS' : 'u5-fuses ok');
  process.exit(problems ? 1 : 0);
})();
