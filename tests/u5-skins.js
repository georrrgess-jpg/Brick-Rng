// Update 5, Series 4 "Moonwick" skins (css/s4-skins.css, js/s4-skins.js): the budgets that keep the nine new skins cheap, readable and safe.
//   1. baking is lazy: nothing of the series is baked at boot, a skin bakes its art the first time it is used
//   2. motion budget: at most 43 animations on the bricks at rest (one brick in three), only transform and opacity, no blend mode on a brick layer,
//      nothing animates .face
//   3. low-end and Reduce Motion: not one animation on the bricks and no moment at all
//   4. readability: the seven brick colours stay at least 12.5 apart at rest and in Rush (CIEDE2000 of the mean colour of each colour, the audit
//      measure of docs/update-5/audit-scripts/run/de.py; and the prototype measure, CIE76 of each brick's middle, which sees the sigils)
//   5. moments (Potion, Gemcut, Hourglass, Sigil, Moonglass): pop moments end within 600 ms, Rush start, Rush end and stage-up within 900 ms, at most
//      40 particles and 3 DOM sprites each, nothing is left behind (sprites, the turn class, the rune frame, the cork class)
//   6. the Fuse brick keeps its countdown (nothing of the skin reaches it) and with Shape hints on every hint shows white where the skin carries a sigil
//   7. badges draw at 36, 56, 72 and 120 px, still and animated, and the item sheet and reveal demo plays without leaving a sprite
//   8. the Moonglass slices follow the bricks while the Rush moon is up
// Usage: node tests/u5-skins.js [--quick]   (exit code 1 on a problem)
const { launch } = require('./lib');
const QUICK = process.argv.includes('--quick');
const SKINS = ['f_patchwork', 'f_glowcap', 'f_spellbook', 'f_origami', 'f_potion', 'f_gemcut', 'f_hourglass', 'f_sigil', 'f_moonglass'];
const MOMENTS = { f_potion: 'potion', f_gemcut: 'gem', f_hourglass: 'hourglass', f_sigil: 'sigil', f_moonglass: 'moonglass' };
const ANIMATED = ['f_potion', 'f_gemcut', 'f_hourglass', 'f_sigil'];
const MIN_DE = 12.5;
(async () => {
  let problems = 0;
  const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1 });
  await page.evaluate(() => { Object.keys(BR.Coach.CARDS).forEach((k) => { BR.Storage.data.seen[k] = true; }); BR.Storage.data.seen.whatsnew3 = true; BR.Storage.data.seen.whatsnew4 = true; BR.Storage.data.seenTutorial = true; BR.Storage.data.runs = 3; BR.Storage.data.settings.sound = false; BR.Storage.data.settings.music = false; BR.Storage.data.settings.perf = 'high'; BR.App.applySettings(); });

  // ---- 1. nothing baked at boot
  const bakedAtBoot = await page.evaluate(() => document.querySelectorAll('style[id^="s4-art-"]').length);
  ok(bakedAtBoot === 0, `${bakedAtBoot} Series 4 skin stylesheets were baked at boot (they bake on first use)`);

  const run = async (ids) => {
    await page.evaluate((ids) => {
      const P = BR.Progress; ['skin', 'pop', 'board', 'fuse'].forEach((t) => P.equip('default', t));
      ids.forEach((id) => { const it = BR.itemById[id]; const inst = BR.Storage.data.profile.vault.find((v) => v.itemId === id) || P.keep({ itemId: id, shine: 'plain', seed: 3, counter: null }); P.equip(inst.uid, it.type); });
      BR.Skins.apply(); BR.Run.over = true; if (BR.Router.current === 'run') BR.Router.go('home', { instant: true });
      __app.startRun({ mode: 'rush', boosts: {} });
    }, ids);
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 });
    await page.evaluate(() => { BR.Run.engine.fuse = 25; });
    await page.waitForTimeout(450);
  };
  /** The seven colours in a pattern where every colour touches every other (a late-stage board); fuse bricks are left alone. */
  const sevenBoard = () => page.evaluate(() => { Array.from(BR.Run.view.bricks.values()).forEach((rec) => { if (!rec.el.classList.contains('fusebrick')) rec.el.dataset.c = String((rec.c + 3 * rec.r) % 7); }); });
  const anims = () => page.evaluate(() => {
    const all = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target);
    const inField = (el) => !!el.closest('#field .brick');
    const mine = all.filter((a) => inField(a.effect.target) && a.animationName);
    return {
      field: mine.length,
      names: Array.from(new Set(mine.map((a) => a.animationName))),
      face: mine.filter((a) => a.effect.target.classList.contains('face') && !a.effect.pseudoElement).length,
      props: Array.from(new Set(all.filter((a) => inField(a.effect.target) && a.effect.getKeyframes).flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k)).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))))),
    };
  });
  const SAFE = new Set(['transform', 'opacity', 'translate', 'rotate', 'scale']);

  // ---- 2. the motion budget, and lazy baking
  for (const id of SKINS) {
    await run([id]);
    const key = id.replace('f_', '');
    const art = await page.evaluate((k) => !!document.getElementById('s4-art-' + k), key);
    const needsArt = ['patchwork', 'spellbook', 'potion', 'gemcut', 'sigil', 'moonglass'].includes(key);
    ok(art === needsArt, `${id}: baked stylesheet present ${art}, expected ${needsArt}`);
    const a = await anims();
    ok(a.field <= 43, `${id}: ${a.field} animations on the bricks at rest (max 43 of 64)`, a.names);
    ok(ANIMATED.includes(id) ? a.field > 0 : a.field === 0, `${id}: ${a.field} brick animations at rest (${ANIMATED.includes(id) ? 'it should move' : 'it should hold still'})`);
    ok(a.face === 0, `${id}: animates .face`);
    ok(a.props.every((p) => SAFE.has(p)), `${id}: animates a property other than transform and opacity`, a.props);
    const blend = await page.evaluate(() => Array.from(document.querySelectorAll('#field .brick *')).some((el) => !el.classList.contains('sheen') && getComputedStyle(el).mixBlendMode !== 'normal'));
    ok(!blend, `${id}: a brick layer uses a blend mode`);
    const layout = await page.evaluate(() => {
      const bad = new Set(['width', 'height', 'top', 'left', 'right', 'bottom', 'margin', 'padding', 'font-size', 'border-width']);
      return Array.from(document.styleSheets).flatMap((s) => { try { return Array.from(s.cssRules); } catch (e) { return []; } }).filter((r) => r.type === CSSRule.KEYFRAMES_RULE && /^(s4-|hg|sg)/.test(r.name)).flatMap((r) => Array.from(r.cssRules).flatMap((k) => Array.from(k.style))).filter((p) => bad.has(p));
    });
    ok(layout.length === 0, `${id}: a keyframe animates layout`, layout);
    console.log(`motion ${id.padEnd(14)} brick animations at rest: ${String(a.field).padStart(2)}  ${a.names.join(', ')}`);
  }

  // ---- 3. low-end and Reduce Motion hold still, and play no moment
  const planBoard = (rows) => page.evaluate((rows) => {
    const e = BR.Run.engine, B = e.board;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const b = B.grid[r][c]; b.color = +rows[r][c]; delete b.fb; }
    B.version++; BR.Run.view.syncTo(B); BR.Run.clearHover(); e.fuse = 25;
  }, rows);
  /** 8 x 8 digits: the seven-colour pattern with a block of colour 2 (and no other 2 anywhere), so the block is one group. */
  const blockRows = (cells) => Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (cells.some(([rr, cc]) => rr === r && cc === c) ? 2 : (c + 3 * r) % 7 === 2 ? 4 : (c + 3 * r) % 7)).join(''));
  const BIG = [2, 3, 4].flatMap((r) => [2, 3, 4, 5].map((c) => [r, c]));
  const LINE = [0, 1, 2, 3, 4, 5, 6, 7].map((c) => [3, c]);
  for (const mode of ['low', 'reduced']) {
    await page.evaluate((m) => { const s = BR.Storage.data.settings; s.reduced = m === 'reduced'; s.perf = m === 'low' ? 'low' : 'high'; BR.App.applySettings(); }, mode);
    for (const id of SKINS) {
      await run([id]);
      const a = await anims();
      ok(a.field === 0, `${mode}: ${id} still animates ${a.field} brick layers`, a.names);
      if (!MOMENTS[id]) continue;
      await planBoard(blockRows(BIG));
      const made = await page.evaluate(() => {
        const fx = BR.App.fx; let n = 0; const orig = ['emit', 'sprite', 'shards', 'sparks', 'link', 'ring'].map((k) => [k, fx[k]]);
        orig.forEach(([k, f]) => { fx[k] = function (...a) { n++; return f.apply(this, a); }; });
        const e = BR.Run.engine, p = e.plan(3, 3), v = BR.Run.view;
        BR.Skins.onEvent('pop', { res: { plan: p }, view: v, run: BR.Run });
        BR.Run.el.classList.add('rushing'); BR.Skins.onEvent('rushStart', { run: BR.Run, view: v }); BR.Skins.onEvent('stageUp', { run: BR.Run, info: { to: 2, mult: 1.5 } });
        BR.Run.el.classList.remove('rushing'); BR.Skins.onEvent('rushEnd', { run: BR.Run });
        orig.forEach(([k, f]) => { fx[k] = f; });
        return { n, sprites: document.querySelectorAll('.s3-bit').length, runes: document.querySelectorAll('.s4-runes').length, turn: document.querySelectorAll('.hg-turn').length };
      });
      ok(made.n === 0 && made.sprites === 0 && made.runes === 0 && made.turn === 0, `${mode}: ${id} played a moment`, made);
    }
  }
  await page.evaluate(() => { const s = BR.Storage.data.settings; s.reduced = false; s.perf = 'high'; BR.App.applySettings(); });

  // ---- 4. the seven colours stay apart, at rest and in Rush
  const PROBE = () => {
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const toLab = ([r, g, b]) => { const R = lin(r), G = lin(g), B = lin(b); const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883; const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]; };
    const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
    const de00 = (l1, l2) => {
      const [L1, a1, b1] = l1, [L2, a2, b2] = l2; const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
      const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7))); const a1p = (1 + G) * a1, a2p = (1 + G) * a2; const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
      const h1p = (deg(Math.atan2(b1, a1p)) + 360) % 360, h2p = (deg(Math.atan2(b2, a2p)) + 360) % 360; const dLp = L2 - L1, dCp = C2p - C1p;
      let dh = h2p - h1p; if (C1p * C2p === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
      const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dh / 2)); const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2; let hbp = h1p + h2p;
      if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hbp = hbp < 360 ? (hbp + 360) / 2 : (hbp - 360) / 2; else hbp /= 2; }
      const T = 1 - 0.17 * Math.cos(rad(hbp - 30)) + 0.24 * Math.cos(rad(2 * hbp)) + 0.32 * Math.cos(rad(3 * hbp + 6)) - 0.2 * Math.cos(rad(4 * hbp - 63));
      const dth = 30 * Math.exp(-(((hbp - 275) / 25) ** 2)); const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
      const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T; const Rt = -Math.sin(rad(2 * dth)) * Rc;
      return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
    };
    window.__probe = async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const k = img.width / innerWidth, view = BR.Run.view, f = view.field.getBoundingClientRect(), cell = view.cell;
      const recs = Array.from(view.bricks.values()).filter((r) => !r.el.classList.contains('fusebrick'));
      const mean = (x0, y0, w, h) => { const d = g.getImageData(Math.round(x0), Math.round(y0), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))).data; let R = 0, G = 0, B = 0, n = 0; for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; } return [R / n, G / n, B / n]; };
      const inner = recs.map((rec) => ({ col: +rec.el.dataset.c, rgb: mean((f.left + rec.c * cell + cell * 0.15) * k, (f.top + rec.r * cell + cell * 0.15) * k, cell * 0.7 * k, cell * 0.7 * k) }));
      const centre = recs.map((rec) => ({ col: +rec.el.dataset.c, lab: toLab(mean((f.left + rec.c * cell + cell * 0.3) * k, (f.top + rec.r * cell + cell * 0.3) * k, cell * 0.4 * k, cell * 0.4 * k)) }));
      const byCol = {}; inner.forEach((s) => { const a = byCol[s.col] || (byCol[s.col] = [0, 0, 0, 0]); a[0] += s.rgb[0]; a[1] += s.rgb[1]; a[2] += s.rgb[2]; a[3]++; });
      const cols = Object.keys(byCol).map(Number), labs = {}; cols.forEach((q) => { labs[q] = toLab([byCol[q][0] / byCol[q][3], byCol[q][1] / byCol[q][3], byCol[q][2] / byCol[q][3]]); });
      let m00 = 1e9, p00 = '';
      for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) { const v = de00(labs[cols[i]], labs[cols[j]]); if (v < m00) { m00 = v; p00 = BR.PALETTE[cols[i]].name + '/' + BR.PALETTE[cols[j]].name; } }
      let m76 = 1e9, p76 = '';
      for (let i = 0; i < centre.length; i++) for (let j = i + 1; j < centre.length; j++) if (centre[i].col !== centre[j].col) { const a = centre[i].lab, b = centre[j].lab, v = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); if (v < m76) { m76 = v; p76 = BR.PALETTE[centre[i].col].name + '/' + BR.PALETTE[centre[j].col].name; } }
      return { de00: +m00.toFixed(1), p00, brick76: +m76.toFixed(1), p76, n: cols.length };
    };
  };
  const probe = async () => {
    await page.evaluate(PROBE);
    await page.addStyleTag({ content: '#fx,#fxlayer,.tap-hint,#flash,.rush-banner,#s3fx,.chip{display:none!important}.brick.hinting .face{animation:none!important}' });
    const buf = await page.screenshot();
    return page.evaluate((b) => window.__probe(b), buf.toString('base64'));
  };
  const startRush = async () => {
    await page.evaluate(() => { const e = BR.Run.engine; e.rush.active = true; e.rush.left = 8; e.rush.meter = 100; BR.Run.rushStart(); });
    await page.waitForTimeout(1300);
  };
  const dist = {};
  for (const id of SKINS) {
    await run([id]);
    await sevenBoard();
    await page.waitForTimeout(300);
    const rest = await probe();
    ok(rest.n === 7, `${id}: the probe saw ${rest.n} colours`);
    ok(rest.de00 >= MIN_DE, `${id} at rest: closest pair ${rest.p00} is ${rest.de00} apart (CIEDE2000, needs ${MIN_DE})`);
    ok(rest.brick76 >= MIN_DE, `${id} at rest: closest bricks ${rest.p76} are ${rest.brick76} apart (needs ${MIN_DE})`);
    await startRush();
    await sevenBoard();
    await page.waitForTimeout(200);
    const rush = await probe();
    ok(rush.de00 >= MIN_DE, `${id} in Rush: closest pair ${rush.p00} is ${rush.de00} apart (CIEDE2000, needs ${MIN_DE})`);
    ok(rush.brick76 >= MIN_DE, `${id} in Rush: closest bricks ${rush.p76} are ${rush.brick76} apart (needs ${MIN_DE})`);
    dist[id] = { rest: rest.de00 + ' / ' + rest.brick76, rush: rush.de00 + ' / ' + rush.brick76 };
    console.log(`colours ${id.padEnd(14)} rest ${String(rest.de00).padStart(5)} / ${String(rest.brick76).padStart(5)} (${rest.p00})   Rush ${String(rush.de00).padStart(5)} / ${String(rush.brick76).padStart(5)} (${rush.p00})`);
  }

  // ---- 5. moments: time, particles, sprites, and nothing left behind
  /** Plays one moment and reads its timeline from what it asked for, not from the clock: every delayed call it makes (setTimeout) is run at once with
      its delay noted, and every particle, ring and animation it starts adds its own life, so the answer does not depend on how busy the machine is.
      Sprites and turning bricks are then watched for 1.5 s of real time to prove nothing is left behind. */
  const traceMoment = (type, extra) => page.evaluate(async ({ type, extra }) => {
    const fx = BR.App.fx, run = BR.Run, v = run.view, e = run.engine;
    let parts = 0, curDelay = 0, declared = 0, capturing = true;
    const sprites = [], jobs = [];
    const origST = window.setTimeout, origAnimate = Element.prototype.animate, orig = {};
    ['emit', 'sprite', 'shards', 'sparks', 'link', 'ring'].forEach((k) => { orig[k] = fx[k]; });
    const end = (ms) => { declared = Math.max(declared, ms); };
    window.setTimeout = function (fn, ms, ...a) {
      if (!capturing || (fn && fn.name === 'done')) return origST.call(window, fn, ms, ...a);   // a sprite's own safety timer runs as usual
      jobs.push([fn, (ms || 0) + curDelay]); return 0;
    };
    Element.prototype.animate = function (kf, o) {
      const opts = typeof o === 'number' ? { duration: o } : (o || {}), start = curDelay + (opts.delay || 0), stop = start + (opts.duration || 0);
      end(stop);
      if (this.classList && this.classList.contains('s3-bit')) sprites.push([start, stop]);
      return origAnimate.apply(this, arguments);
    };
    fx.emit = function (p) { parts++; end(curDelay + (p && p.max != null ? p.max : 0.8) * 1000); return orig.emit.apply(this, arguments); };
    fx.sprite = function (p) { parts++; end(curDelay + (p && p.max != null ? p.max : 0.8) * 1000); return orig.sprite.apply(this, arguments); };
    fx.shards = function (x, y, c, n, pw, o) { parts += Math.round((n == null ? 8 : n) * fx.budget); end(curDelay + ((o && o.life) || 0.55) * 1500); return orig.shards.apply(this, arguments); };
    fx.sparks = function (x, y, c, n, pw, life) { parts += Math.round((n == null ? 10 : n) * fx.budget); end(curDelay + (life == null ? 0.6 : life) * 1400); return orig.sparks.apply(this, arguments); };
    fx.link = function (x0, y0, x1, y1, c, life) { parts++; end(curDelay + (life == null ? 0.5 : life) * 1000); return orig.link.apply(this, arguments); };
    fx.ring = function (x, y, c, r, life) { end(curDelay + (life == null ? 0.5 : life) * 1000); return orig.ring.apply(this, arguments); };
    try {
      if (type === 'pop') BR.Skins.onEvent('pop', { res: { plan: e.plan(extra.r, extra.c) }, view: v, run });
      else if (type === 'line') BR.Skins.onEvent('line', { res: { plan: e.plan(extra.r, extra.c) }, view: v, run });
      else if (type === 'rushStart') { run.el.classList.add('rushing'); BR.Skins.onEvent('rushStart', { run, view: v }); }
      else if (type === 'rushEnd') { run.el.classList.remove('rushing'); BR.Skins.onEvent('rushEnd', { run }); }
      else if (type === 'stageUp') BR.Skins.onEvent('stageUp', { run, info: { to: 2, mult: 1.5 } });
      for (let i = 0; i < jobs.length && i < 500; i++) { const [fn, ms] = jobs[i]; curDelay = ms; try { fn(); } catch (err) { /* reported by the page error listener */ } curDelay = 0; }
    } finally {
      capturing = false; window.setTimeout = origST; Element.prototype.animate = origAnimate; Object.keys(orig).forEach((k) => { fx[k] = orig[k]; });
    }
    // how many DOM sprites are alive at the same time, by their declared windows
    let maxSprites = 0;
    sprites.forEach(([s]) => { maxSprites = Math.max(maxSprites, sprites.filter(([a, b]) => a <= s && s < b).length); });
    // the particle canvas ages a particle by at most 50 ms a frame, so on a busy machine they outlive the wall clock: give them up to 6 s
    const t0 = performance.now();
    await new Promise((res) => { const w = () => { if (performance.now() - t0 > 1500 && (fx.parts.length + fx.rings.length + fx.links.length === 0 || performance.now() - t0 > 6000)) res(); else setTimeout(w, 100); }; w(); });
    if (type === 'rushStart') run.el.classList.remove('rushing');
    return { parts, maxSprites, end: Math.round(declared), left: document.querySelectorAll('.s3-bit').length, runes: document.querySelectorAll('.s4-runes').length, turn: document.querySelectorAll('.hg-turn').length, live: fx.parts.length + fx.rings.length + fx.links.length };
  }, { type, extra });
  const BUDGET = { pop: 600, line: 600, rushStart: 900, rushEnd: 900, stageUp: 900 };
  const TOL = 0;
  for (const id of Object.keys(MOMENTS)) {
    await run([id]);
    for (const [name, type, rows, at] of [['pop of 2', 'pop', blockRows([[5, 2], [5, 3]]), { r: 5, c: 2 }], ['pop of 12', 'pop', blockRows(BIG), { r: 3, c: 3 }], ['Line Blast', 'line', blockRows(LINE), { r: 3, c: 3 }], ['Rush start', 'rushStart', null], ['Rush end', 'rushEnd', null], ['stage-up', 'stageUp', null]]) {
      if (rows) await planBoard(rows);
      const m = await traceMoment(type, at);
      const budget = BUDGET[type];
      ok(m.end <= budget + TOL, `${id}: ${name} lasts ${m.end} ms (budget ${budget})`);
      ok(m.live === 0, `${id}: ${name} left ${m.live} particles, rings or lines on the canvas after 1.5 s`);
      ok(m.parts <= 40, `${id}: ${name} made ${m.parts} particles (max 40)`);
      ok(m.maxSprites <= 3, `${id}: ${name} had ${m.maxSprites} DOM sprites at once (max 3)`);
      ok(m.left === 0 && m.turn === 0, `${id}: ${name} left ${m.left} sprites and ${m.turn} turning bricks behind`);
      console.log(`moment ${id.padEnd(14)} ${name.padEnd(11)} lasts ${String(m.end).padStart(4)} ms (of ${budget})  particles ${String(m.parts).padStart(2)}  sprites ${m.maxSprites}`);
      await page.waitForTimeout(150);
    }
    // the Rush frame of the Sigil skin counts the Rush down and goes with it
    if (id === 'f_sigil') {
      await page.evaluate(() => { const e = BR.Run.engine; e.rush.active = true; e.rush.left = 5.5; e.rush.meter = 100; BR.Run.rushStart(); });
      await page.waitForTimeout(500);
      const on = await page.evaluate(() => ({ frame: document.querySelectorAll('.s4-runes').length, lit: document.querySelectorAll('.s4-runes .rn.on').length, all: document.querySelectorAll('.s4-runes .rn').length }));
      ok(on.frame === 1 && on.all === 8, `Sigil: the Rush rune frame has ${on.all} runes in ${on.frame} frames`);
      ok(on.lit === 6, `Sigil: 5.5 seconds of Rush left should light 6 runes, lit ${on.lit}`);
      await page.evaluate(() => { BR.Run.engine.rush.left = 0.01; });
      await page.waitForTimeout(900);
      const gone = await page.evaluate(() => document.querySelectorAll('.s4-runes').length);
      ok(gone === 0, 'Sigil: the rune frame is still there after Rush');
    }
  }

  // ---- 6. the Fuse brick, and the Shape hints
  const fuseCheck = await page.evaluate(() => {
    const e = BR.Run.engine, B = e.board; const b = B.grid[4][4]; b.color = 1; b.fb = 3; B.version++; BR.Run.view.syncTo(B); BR.Run.clearHover();
    const rec = Array.from(BR.Run.view.bricks.values()).find((r) => r.r === 4 && r.c === 4);
    return { ok: !!(rec && rec.el.classList.contains('fusebrick')) };
  });
  ok(fuseCheck.ok, 'could not make a Fuse brick');
  const fuseLook = (rushing) => page.evaluate((rushing) => {
    const rec = Array.from(BR.Run.view.bricks.values()).find((r) => r.el.classList.contains('fusebrick'));
    if (!rec) return null;
    const el = rec.el, f = el.querySelector('.fcount'), face = el.querySelector('.face'), cs = getComputedStyle(face), r = f.getBoundingClientRect();
    // bricks do not take pointer events, so let them for a moment to ask what is painted on top at the countdown's middle
    const st = document.createElement('style'); st.textContent = '#field .brick, #field .brick * { pointer-events: auto !important; }'; document.head.appendChild(st);
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    st.remove();
    const vis = (n) => getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden' && getComputedStyle(n).opacity !== '0';
    return {
      sig: [cs.backgroundImage, cs.boxShadow, cs.borderRadius, getComputedStyle(face, '::after').content, getComputedStyle(face, '::after').backgroundColor].join('|'),
      count: r.width > 4 && r.height > 4 && vis(f), covered: !(top === f || f.contains(top) || (top && el.contains(top) && top.classList.contains('face'))), hidden: ['.stud', '.deco', '.sheen'].filter((q) => vis(el.querySelector(q))),
    };
  }, rushing);
  await run([]); await page.evaluate(() => { const B = BR.Run.engine.board, b = B.grid[4][4]; b.color = 1; b.fb = 3; B.version++; BR.Run.view.syncTo(B); BR.Run.clearHover(); });
  const classic = await fuseLook();
  for (const id of SKINS) {
    for (const rush of [false, true]) {
      await run([id]);
      await page.evaluate(() => { const B = BR.Run.engine.board, b = B.grid[4][4]; b.color = 1; b.fb = 3; B.version++; BR.Run.view.syncTo(B); BR.Run.clearHover(); });
      if (rush) await startRush();
      const f = await fuseLook();
      ok(f && f.count, `${id}${rush ? ' in Rush' : ''}: the Fuse brick countdown is not visible`);
      ok(f && !f.covered, `${id}${rush ? ' in Rush' : ''}: something covers the Fuse brick countdown`);
      ok(f && f.hidden.length === 0, `${id}: the Fuse brick shows its ${f && f.hidden.join(', ')} layer`);
      ok(f && classic && f.sig === classic.sig, `${id}${rush ? ' in Rush' : ''}: the Fuse brick face is styled by the skin (${f && f.sig.slice(0, 60)})`);
    }
  }
  // Shape hints: the white hint shows on every brick, at its own place, over whatever the skin draws
  await page.evaluate(() => { BR.Storage.data.settings.shapes = true; BR.App.applySettings(); });
  for (const id of SKINS) {
    await run([id]);
    await sevenBoard();
    await page.waitForTimeout(250);
    await page.addStyleTag({ content: '#fx,#fxlayer,.tap-hint,#flash,.chip{display:none!important}.brick.hinting .face{animation:none!important}' });
    const buf = await page.screenshot();
    const res = await page.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const k = img.width / innerWidth, out = {};
      Array.from(BR.Run.view.bricks.values()).forEach((rec) => {
        if (rec.el.classList.contains('fusebrick')) return;
        const st = rec.el.querySelector('.stud'), r = st.getBoundingClientRect(), cs = getComputedStyle(st);
        const w = Math.max(2, r.width * 0.3 * k), d = g.getImageData(Math.round((r.left + r.width / 2) * k - w / 2), Math.round((r.top + r.height / 2) * k - w / 2), Math.round(w), Math.round(w)).data;
        let L = 0, n = 0; for (let i = 0; i < d.length; i += 4) { L += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; n++; }
        const col = rec.el.dataset.c; (out[col] = out[col] || []).push({ L: L / n, vis: cs.opacity !== '0' && cs.display !== 'none', clip: cs.clipPath });
      });
      return out;
    }, buf.toString('base64'));
    for (const col of Object.keys(res)) {
      const dark = res[col].filter((s) => s.L < 205).length, hidden = res[col].filter((s) => !s.vis).length;
      ok(dark === 0 && hidden === 0, `${id} with Shape hints: ${dark} of the ${res[col].length} ${['Ruby', 'Sapphire', 'Emerald', 'Topaz', 'Amethyst', 'Amber', 'Aqua'][col]} hints are not white at their centre (${hidden} hidden)`);
    }
  }
  await page.evaluate(() => { BR.Storage.data.settings.shapes = false; BR.App.applySettings(); });

  // ---- 7. badges at 36, 56, 72 and 120 px, and the item sheet demo
  const badges = await page.evaluate(() => {
    const out = [];
    ['f_patchwork', 'f_glowcap', 'f_spellbook', 'f_origami', 'f_potion', 'f_gemcut', 'f_hourglass', 'f_sigil', 'f_moonglass'].forEach((id) => {
      const it = BR.itemById[id];
      [36, 56, 72, 120].forEach((size) => [true, false].forEach((still) => {
        const w = document.createElement('div'); w.innerHTML = BR.Badge.html(it, { shine: 'plain', seed: 5 }, { size, still });
        document.body.appendChild(w);
        const bdg = w.firstElementChild, art = bdg.querySelector('.s4b'), hero = bdg.querySelector('.s4b-k.kh .brick'), r = hero && hero.getBoundingClientRect(), b = bdg.getBoundingClientRect();
        out.push({ id, size, still, own: !!art, hero: r ? r.width / b.width : 0, mark: !!bdg.querySelector('.s4b-mark svg path'), rim: !!bdg.querySelector('.s4b-rim') });
        w.remove();
      }));
      const w = document.createElement('div'); w.innerHTML = BR.Badge.html(it, null, { size: 72, locked: true, still: true }); document.body.appendChild(w); out.push({ id, locked: !!w.querySelector('.s4b') }); w.remove();
    });
    return out;
  });
  badges.forEach((b) => {
    if (b.locked !== undefined) { ok(b.locked, `${b.id}: the locked badge has no art`); return; }
    ok(b.own && b.mark && b.rim, `${b.id} badge at ${b.size}px${b.still ? ' (still)' : ''} is not the Series 4 badge`, b);
    ok(b.hero >= 0.4, `${b.id} badge at ${b.size}px: the hero brick is only ${(b.hero * 100).toFixed(0)}% of the badge`);
  });
  const isBadgeAnim = await page.evaluate(() => {
    const w = document.createElement('div'); w.innerHTML = BR.Badge.html(BR.itemById.f_hourglass, null, { size: 120, still: false }); document.body.appendChild(w);
    const n = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && w.contains(a.effect.target)).length;
    const w2 = document.createElement('div'); w2.innerHTML = BR.Badge.html(BR.itemById.f_hourglass, null, { size: 120, still: true }); document.body.appendChild(w2);
    const m = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && w2.contains(a.effect.target)).length;
    w.remove(); w2.remove(); return { n, m };
  });
  ok(isBadgeAnim.m === 0, `a still Hourglass badge runs ${isBadgeAnim.m} animations`);
  for (const id of Object.keys(MOMENTS).concat(['f_patchwork', 'f_origami'])) {
    await page.evaluate(() => { BR.Router.go('home', { instant: true }); });
    const sheet = await page.evaluate(async (id) => {
      const it = BR.itemById[id], host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:40px;top:260px;width:260px;height:260px;z-index:50;display:grid;place-items:center';
      document.body.appendChild(host);
      const demo = BR.Openings.demo(host, it, { shine: 'plain', seed: 3 }, { silent: true, power: 1.2 });
      let maxSprites = 0, steps = 0;
      await new Promise((res) => { const t = () => { maxSprites = Math.max(maxSprites, document.querySelectorAll('.s3-bit').length); if (++steps > 270) res(); else requestAnimationFrame(t); }; requestAnimationFrame(t); });
      const wears = !!host.querySelector('.skin-' + id.replace('f_', '')), nb = host.querySelectorAll('.brick').length;
      demo.stop(); await new Promise((r) => setTimeout(r, 1500));
      const left = document.querySelectorAll('.s3-bit').length, turn = document.querySelectorAll('.hg-turn').length;
      host.remove();
      return { maxSprites, wears, nb, left, turn };
    }, id);
    ok(sheet.wears && sheet.nb === 9, `${id}: the demo does not show nine bricks wearing the skin`, sheet);
    ok(sheet.maxSprites <= 3, `${id}: the demo had ${sheet.maxSprites} sprites at once`);
    ok(sheet.left === 0 && sheet.turn === 0, `${id}: the demo left ${sheet.left} sprites and ${sheet.turn} turning bricks behind`);
  }

  // ---- 8. Moonglass: the Rush moon's slices follow the bricks
  await run(['f_moonglass']);
  await page.evaluate(() => { const e = BR.Run.engine; e.rush.active = true; e.rush.left = 8; e.rush.meter = 100; BR.Run.rushStart(); });
  await page.waitForTimeout(300);
  const tap = async () => {
    const p = await page.evaluate(() => { const e = BR.Run.engine; let best = null; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const q = e.plan(r, c); if (q && (!best || q.cells.length > best.n)) best = { r, c, n: q.cells.length }; } return best && BR.Run.view.pagePoint(best.r, best.c); });
    if (p) await page.mouse.click(p.x, p.y);
    await page.waitForFunction(() => !BR.Run.busy, null, { timeout: 8000 }).catch(() => { problems++; console.log('PROBLEM stuck'); });
  };
  for (let i = 0; i < 2; i++) { await tap(); await page.waitForTimeout(250); }
  const stale = await page.evaluate(() => { let n = 0; BR.Run.view.bricks.forEach((rec) => { if (rec.el.style.getPropertyValue('--r') !== String(rec.r) || rec.el.style.getPropertyValue('--c') !== String(rec.c)) n++; }); return n; });
  ok(stale === 0, `Moonglass: ${stale} panes show the moon slice of another row or column during Rush`);

  const real = errors.filter((e) => !/Failed to load resource/.test(e));
  ok(real.length === 0, 'console errors', real);
  console.log(problems ? problems + ' PROBLEMS' : 'u5 skins ok');
  await browser.close();
  process.exit(problems ? 1 : 0);
})();
