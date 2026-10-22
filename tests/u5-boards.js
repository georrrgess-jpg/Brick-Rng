// Series 4 "Moonwick" boards (css/s4-scenes.css, js/s4-scenes.js): the budgets that keep the six new boards cheap, readable and still.
//   1. the seven brick colours stay at least as readable as on Midnight (WCAG contrast of brick vs board surface, bricks hidden)
//   2. the run HUD text over each scene passes the Update 4 contrast test (goal band 6:1, score label 3.8:1, score 4.5:1) and the other
//      HUD text (stage, goal count, fuse readout) is readable too; no busy art behind the power-up slots; the fuse readout colour is untouched
//   3. a board runs at most two continuous animations behind the bricks, animates only transform and opacity, uses no blend mode
//   4. low-end and Reduce Motion hold still (no idle animation, no moments)
//   5. moments end in time (600 ms; Rush start and stage-up 900 ms), add at most two short animations, and leave nothing stuck behind
//   6. the frame lines up with the bricks (nothing of the frame is drawn over the brick field)
// Usage: node tests/u5-boards.js [--only=a_tower,a_isles] [--skip=contrast,hud,motion,still,moments,frame]
const { launch } = require('./lib');
const argv = process.argv.slice(2);
const opt = (k) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1].split(',') : null; };
const ONLY = opt('only'), SKIP = opt('skip') || [];
const ALL = ['a_library', 'a_glade', 'a_alchemy', 'a_observatory', 'a_isles', 'a_tower'];
const BOARDS = ONLY || ALL;
const want = (s) => !SKIP.includes(s);
const SIZES = [[393, 852], [360, 640], [430, 932], [844, 390]];
const HUD_SIZES = [[393, 852], [360, 640], [430, 932]];

(async () => {
  let problems = 0;
  const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1 });
  const setup = () => page.evaluate(() => { BR.Storage.data.seenTutorial = true; BR.Storage.data.runs = 12; BR.Storage.data.settings.sound = false; BR.Storage.data.settings.music = false; BR.Storage.data.settings.perf = 'high'; BR.App.applySettings(); });
  await setup();
  const run = async (ids) => {
    await page.evaluate((ids) => {
      const P = BR.Progress; ['skin', 'pop', 'board', 'fuse'].forEach((t) => P.equip('default', t));
      ids.forEach((id) => { const it = BR.itemById[id]; const inst = BR.Storage.data.profile.vault.find((v) => v.itemId === id) || P.keep({ itemId: id, shine: 'plain', seed: 3, counter: null }); P.equip(inst.uid, it.type); });
      BR.Skins.apply(); BR.Run.over = true; if (BR.Router.current === 'run') BR.Router.go('home', { instant: true });
      __app.startRun({ mode: 'rush', boosts: {} });
    }, ids);
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy, null, { timeout: 20000 });
    await page.waitForTimeout(350);
  };
  const SAFE = new Set(['transform', 'opacity', 'translate', 'rotate', 'scale']);
  // animations that run behind or on the board (the scene) and what they animate
  const anims = () => page.evaluate(() => {
    const all = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target);
    const inBg = (el) => !!el.closest('#bg'), board = document.getElementById('board');
    const scene = all.filter((a) => inBg(a.effect.target) || a.effect.target === board);
    return {
      scene: scene.map((a) => (a.animationName || a.transitionProperty || '?') + (a.effect.pseudoElement || '')),
      props: Array.from(new Set(scene.filter((a) => a.effect.getKeyframes).flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k)).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))))),
    };
  });
  const blendUsers = () => page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('#bg, #bg *, #board, #board *').forEach((el) => {
      for (const ps of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, ps);
        if (cs.mixBlendMode !== 'normal') bad.push((el.id || el.className) + (ps || '') + ' mix-blend-mode ' + cs.mixBlendMode);
        if (cs.backgroundBlendMode && cs.backgroundBlendMode.split(',').some((v) => v.trim() !== 'normal')) bad.push((el.id || el.className) + (ps || '') + ' background-blend-mode');
        if (cs.filter !== 'none' && /^#bg$|^bg$/.test(el.id || el.className)) bad.push((el.id || el.className) + (ps || '') + ' filter ' + cs.filter);
      }
    });
    return bad;
  });
  // a screenshot of the page with the given css applied (and removed again)
  const shotWith = async (css) => {
    const h = await page.addStyleTag({ content: css });
    const buf = await page.screenshot();
    await h.evaluate((el) => el.remove());
    return buf;
  };
  const NOANIM = '*,*::before,*::after{animation:none!important;transition:none!important}';
  // pixel analysis in the page (so it needs no image library)
  const analyse = (buf, fn, arg) => page.evaluate(async ({ b64, src, arg }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
    const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const p90 = (b, inset = 0, q = 0.9) => {
      const x0 = Math.max(0, Math.round(b.left + b.width * inset)), x1 = Math.min(img.width, Math.round(b.right - b.width * inset)), y0 = Math.max(0, Math.round(b.top)), y1 = Math.min(img.height, Math.round(b.bottom));
      if (x1 <= x0 || y1 <= y0) return 0;
      const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data, L = [];
      for (let i = 0; i < d.length; i += 16) L.push(lum(d[i], d[i + 1], d[i + 2]));
      L.sort((a, b) => a - b); return L[Math.floor(L.length * q)];
    };
    const stats = (b) => {
      const x0 = Math.max(0, Math.round(b.left)), x1 = Math.min(img.width, Math.round(b.right)), y0 = Math.max(0, Math.round(b.top)), y1 = Math.min(img.height, Math.round(b.bottom));
      const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data; let s = 0, s2 = 0, k = 0, mx = 0;
      for (let i = 0; i < d.length; i += 16) { const L = lum(d[i], d[i + 1], d[i + 2]); s += L; s2 += L * L; k++; if (L > mx) mx = L; }
      const m = s / k; return { mean: m, sd: Math.sqrt(Math.max(0, s2 / k - m * m)), max: mx };
    };
    const col = (el) => { const m = getComputedStyle(el).color.match(/[\d.]+/g).map(Number); return lum(m[0], m[1], m[2]); };
    const rect = (el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    return new Function('img', 'g', 'lum', 'cr', 'p90', 'stats', 'col', 'rect', 'arg', 'return (' + src + ')(arg)').call(null, img, g, lum, cr, p90, stats, col, rect, arg);
  }, { b64: buf.toString('base64'), src: fn.toString(), arg });

  // ---- 1. seven-colour readability: bricks hidden, WCAG contrast of every brick colour against the board surface
  const surfaceFn = () => {
    const f = rect(document.getElementById('field')), cell = f.width / 8;
    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const cols = BR.PALETTE.map((p) => { const a = hex(p.hi), b = hex(p.lo); return { mid: lum((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), lo: lum(...b) }; });
    const surf = [];
    for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) {
      const x0 = Math.round(f.left + q * cell + cell * 0.2), y0 = Math.round(f.top + r * cell + cell * 0.2), w = Math.max(2, Math.round(cell * 0.6));
      const d = g.getImageData(x0, y0, w, w).data; let R = 0, G = 0, B = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
      surf.push(lum(R / n, G / n, B / n));
    }
    return { mid: Math.min(...cols.flatMap((c) => surf.map((s) => cr(c.mid, s)))), lo: Math.min(...cols.flatMap((c) => surf.map((s) => cr(c.lo, s)))) };
  };
  const surface = async () => analyse(await shotWith(NOANIM + '#field .brick,#field .tap-hint{visibility:hidden!important} #fxlayer,.rush-glow{display:none!important}'), surfaceFn);
  if (want('contrast')) {
    for (const [w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h });
      await run([]); const base = await surface();
      for (const id of BOARDS) {
        await run([id]); const s = await surface();
        ok(s.mid >= base.mid - 0.02 && s.lo >= base.lo - 0.02, `${id} at ${w}x${h}: worst brick contrast mid ${s.mid.toFixed(2)} lo ${s.lo.toFixed(2)} is below Midnight's ${base.mid.toFixed(2)} / ${base.lo.toFixed(2)}`);
      }
      console.log(`contrast ${w}x${h}: Midnight worst mid ${base.mid.toFixed(2)} lo ${base.lo.toFixed(2)}`);
    }
  }

  // ---- 2. the run HUD over the scene
  // text hidden, 90th percentile luminance of the scene behind each text against its colour; the readout colour is the fuse's own
  const hudFn = () => {
    const out = {};
    const q = (s) => document.querySelector(s);
    const lbl = q('.score-box .lbl'), num = q('.score-box b'), tag = q('.ss-stage'), goal = q('.ss-goal'), fnum = q('#fuseTime'), unit = q('.fz-unit');
    out.msg = cr(col(q('.m-goal')), p90(rect(q('#msgBand')), 0.12));
    out.lbl = cr(col(lbl), p90(rect(lbl)));
    out.num = cr(col(num), p90(rect(num)));
    out.stage = cr(col(tag), p90(rect(tag)));
    out.count = cr(col(goal), p90(rect(goal)));
    out.fuse = cr(col(fnum), p90(rect(fnum)));
    out.unit = cr(col(unit), p90(rect(unit)));
    return out;
  };
  const HUDHIDE = NOANIM + '.msgband>*,.score-box,.ss-stage,.ss-goal,#fuseTime,.fz-unit{visibility:hidden!important}';
  const hud = async () => {
    // the real colours are read with the text visible; the pixels behind with the text hidden
    const colors = await page.evaluate(() => { const g = (s) => getComputedStyle(document.querySelector(s)).color; return { unit: g('.fz-unit'), unitSpan: g('.fuse-time .fz-unit span'), num: g('#fuseTime'), goal: g('.ss-goal'), stage: g('.ss-stage') }; });
    const buf = await shotWith(HUDHIDE);
    const res = await analyse(buf, hudFn);
    return { res, colors };
  };
  const REF = {};
  if (want('hud')) {
    for (const [w, h] of HUD_SIZES) {
      await page.setViewportSize({ width: w, height: h });
      for (const id of ['default:board'].concat(BOARDS)) {
        await run(id.startsWith('default') ? [] : [id]);
        const { res, colors } = await hud();
        const key = w + 'x' + h;
        if (id.startsWith('default')) { REF[key] = colors; console.log(`hud ${key} Midnight: goal ${res.msg.toFixed(1)} label ${res.lbl.toFixed(1)} score ${res.num.toFixed(1)} stage ${res.stage.toFixed(1)} count ${res.count.toFixed(1)} fuse ${res.fuse.toFixed(1)} unit ${res.unit.toFixed(1)}`); continue; }
        console.log(`hud ${key} ${id.padEnd(14)} goal ${res.msg.toFixed(1)} label ${res.lbl.toFixed(1)} score ${res.num.toFixed(1)} stage ${res.stage.toFixed(1)} count ${res.count.toFixed(1)} fuse ${res.fuse.toFixed(1)} unit ${res.unit.toFixed(1)}`);
        ok(res.msg >= 6 && res.lbl >= 3.8 && res.num >= 4.5, `${id} at ${key}: HUD text over the scene is hard to read (goal ${res.msg.toFixed(1)}, score label ${res.lbl.toFixed(1)}, score ${res.num.toFixed(1)}; needs 6 / 3.8 / 4.5)`);
        ok(res.stage >= 4.5 && res.count >= 4.5 && res.unit >= 4.5 && res.fuse >= 4.5, `${id} at ${key}: the stage tag, goal count or fuse readout is hard to read (stage ${res.stage.toFixed(1)}, count ${res.count.toFixed(1)}, readout ${res.fuse.toFixed(1)}, unit ${res.unit.toFixed(1)}; needs 4.5)`);
        ok(colors.unit === REF[key].unit && colors.unitSpan === REF[key].unitSpan && colors.num === REF[key].num, `${id}: changes the fuse readout colour (${colors.unit}, ${colors.num}; the default board has ${REF[key].unit}, ${REF[key].num})`);
      }
    }
    // no stylesheet rule of the six boards may colour the fuse readout (static check of css/s4-scenes.css)
    const text = require('fs').readFileSync(require('path').resolve(__dirname, '..', 'css', 's4-scenes.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const sheet = [];
    text.replace(/([^{}]+)\{([^{}]*)\}/g, (m, sel, body) => { if (/fuse-time|fz-num|fz-unit|fuse-fill|fuseTime|\.fuse\b/.test(sel) && /(^|[;\s])color\s*:/.test(body)) sheet.push(sel.trim().slice(0, 80)); return m; });
    ok(sheet.length === 0, 'css/s4-scenes.css sets the colour of the fuse readout', sheet);
    // busy art behind the power-up slots: the scene around and between the slots is calm and dark
    for (const [w, h] of HUD_SIZES) {
      await page.setViewportSize({ width: w, height: h });
      for (const id of BOARDS) {
        await run([id]);
        const buf = await shotWith(NOANIM + '#powerups .bslot{visibility:hidden!important}');
        const s = await analyse(buf, () => { const r = rect(document.getElementById('powerups')); return stats(r); });
        console.log(`slots ${w}x${h} ${id.padEnd(14)} behind the slots: mean ${s.mean.toFixed(3)} sd ${s.sd.toFixed(3)} max ${s.max.toFixed(3)}`);
        ok(s.sd <= 0.05 && s.mean <= 0.1, `${id} at ${w}x${h}: busy or bright art behind the power-up slots (mean ${s.mean.toFixed(3)}, sd ${s.sd.toFixed(3)})`);
      }
    }
  }
  await page.setViewportSize({ width: 393, height: 852 });

  // ---- 3. motion budget at rest
  if (want('motion')) {
    for (const id of ['default:board'].concat(BOARDS)) {
      await run(id.startsWith('default') ? [] : [id]);
      const a = await anims();
      ok(a.scene.length <= 2, `${id}: ${a.scene.length} animations behind the bricks (max 2)`, a.scene);
      console.log(`motion ${id.padEnd(15)} behind the bricks: ${a.scene.join(', ') || 'nothing'}`);
      ok(a.props.every((p) => SAFE.has(p)), `${id}: animates a property other than transform/opacity`, a.props);
      const bl = await blendUsers();
      ok(bl.length === 0, `${id}: blend mode or filter behind the bricks`, bl);
    }
  }

  // ---- moments: fire an event on the real Skins hook and watch every animation the equipped board's layers (.s4x) start
  const MOMENTS = { a_alchemy: ['line', 'rushStart', 'rushEnd', 'stageUp'], a_observatory: ['line', 'rushStart', 'rushEnd', 'stageUp'], a_isles: ['line', 'rushStart', 'rushEnd', 'stageUp'], a_tower: ['line', 'pop', 'rushStart', 'rushEnd', 'stageUp'] };
  const BUDGET = { line: 600, pop: 600, rushStart: 900, rushEnd: 900, stageUp: 900 };
  const fire = (type, watchMs) => page.evaluate(async ({ type, watchMs }) => {
    const R = BR.Run, v = R.view;
    const mine = (a) => { const t = a.effect && a.effect.target; return !!(t && t.closest && t.closest('.s4x')); };
    const base = new Set(document.getAnimations());
    const parts0 = BR.App.fx.parts.length;
    const seen = new Map(); let maxConc = 0, maxParts = 0;
    const t0 = performance.now();
    const sample = () => {
      const now = performance.now() - t0; let conc = 0;
      document.getAnimations().forEach((a) => {
        if (base.has(a) || !mine(a)) return;
        if (!seen.has(a)) { const ct = a.effect.getComputedTiming(); const props = a.effect.getKeyframes ? Array.from(new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k)))).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p)) : [a.transitionProperty]; seen.set(a, { end: now + Math.max(0, ct.endTime - (ct.localTime || 0)), props, who: a.effect.target.className }); }
        if (a.playState === 'running') conc++;
      });
      maxConc = Math.max(maxConc, conc); maxParts = Math.max(maxParts, BR.App.fx.parts.length - parts0);
    };
    if (type === 'line') BR.Skins.onEvent('line', { res: { plan: { r: 3, c: 4, lineH: true, lineV: false, n: 8 } }, view: v, run: R });
    else if (type === 'pop') BR.Skins.onEvent('pop', { res: { plan: { n: 14, primary: [{ r: 3, c: 3 }, { r: 3, c: 4 }], color: 1 } }, view: v, run: R });
    else if (type === 'rushStart') BR.Skins.onEvent('rushStart', { run: R, view: v });
    else if (type === 'rushEnd') BR.Skins.onEvent('rushEnd', { run: R });
    else if (type === 'stageUp') { R.engine.stage = (R.engine.stage || 1) + 1; BR.Skins.onEvent('stageUp', { run: R, info: { to: R.engine.stage, from: R.engine.stage - 1, mult: 1.5 } }); }
    sample();
    await new Promise((res) => { const iv = setInterval(sample, 16); setTimeout(() => { clearInterval(iv); res(); }, watchMs); });
    const arr = Array.from(seen.values());
    return { count: arr.length, end: Math.max(0, ...arr.map((s) => s.end)), maxConc, maxParts, props: Array.from(new Set(arr.flatMap((s) => s.props))), who: arr.map((s) => s.who) };
  }, { type, watchMs });
  const layerState = () => page.evaluate(() => Array.from(document.querySelectorAll('#bg .s4x, #boardWrap .s4x')).map((el) => { const cs = getComputedStyle(el); return el.className + '|' + cs.opacity + '|' + cs.transform + '|' + cs.translate; }));
  const stuck = () => page.evaluate(() => ({ running: document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.s4x')).length, beams: document.querySelectorAll('#fxlayer .s4x').length }));

  // ---- 4. low-end and reduced hold still: no idle animation, no moments, the static scene
  if (want('still')) {
    for (const mode of ['low', 'reduced']) {
      await page.evaluate((m) => { const s = BR.Storage.data.settings; s.reduced = m === 'reduced'; s.perf = m === 'low' ? 'low' : 'high'; BR.App.applySettings(); }, mode);
      for (const id of BOARDS) {
        await run([id]);
        const a = await anims();
        ok(a.scene.length === 0, `${mode}: ${id} still animates behind the bricks`, a.scene);
        const shown = await page.evaluate(() => Array.from(document.querySelectorAll('#bg .s4x')).filter((e) => getComputedStyle(e).display !== 'none').length);
        ok(shown === 0, `${mode}: ${id} leaves ${shown} moment layers showing (the static scene is the whole picture)`);
        for (const ev of ['line', 'pop', 'rushStart', 'rushEnd', 'stageUp']) {
          const m = await fire(ev, 120);
          ok(m.count === 0 && m.maxParts === 0, `${mode}: ${id} plays a ${ev} moment (${m.count} animations, ${m.maxParts} particles)`);
        }
      }
    }
    await page.evaluate(() => { const s = BR.Storage.data.settings; s.reduced = false; s.perf = 'high'; BR.App.applySettings(); });
  }

  // ---- 5. moments: time, count, particles and leftovers
  if (want('moments')) {
    for (const id of Object.keys(MOMENTS)) {
      await run([id]);
      const before = await layerState();
      for (const ev of MOMENTS[id]) {
        const m = await fire(ev, BUDGET[ev] + 400);
        const tag = `${id} ${ev}`;
        console.log(`moment ${tag.padEnd(24)} ends at ${m.end.toFixed(0)} ms, ${m.count} animations (${m.maxConc} at once), ${m.maxParts} particles, on ${m.props.join('/')}`);
        ok(m.count > 0, `${tag}: no moment played`);
        ok(m.end <= BUDGET[ev] + 60, `${tag}: ends at ${m.end.toFixed(0)} ms (limit ${BUDGET[ev]})`);
        ok(m.maxConc <= 2, `${tag}: ${m.maxConc} short animations at once (limit 2)`, m.who);
        ok(m.maxParts <= 40, `${tag}: ${m.maxParts} particles (limit 40)`);
        ok(m.props.every((p) => SAFE.has(p)), `${tag}: animates ${m.props.join(', ')}`);
        const s = await stuck();
        ok(s.running === 0 && s.beams === 0, `${tag}: something is still running or left behind after the moment`, s);
      }
      // after Rush has ended the layers are back where they started (the stage and the notch are state, so they are compared by hand)
      const after = await layerState();
      const rest = (l) => l.filter((x) => !/(win|notch)/.test(x.split('|')[0]));
      ok(JSON.stringify(rest(before)) === JSON.stringify(rest(after)), `${id}: a layer is stuck after the moments`, { before: rest(before), after: rest(after) });
      // a new run starts clean (windows and notch reset)
      await run([id]);
      const fresh = await layerState();
      ok(JSON.stringify(fresh.filter((x) => /win/.test(x.split('|')[0]))) === JSON.stringify(before.filter((x) => /win/.test(x.split('|')[0]))), `${id}: the windows did not reset for the new run`);
    }
    // the Tower's windows follow the stage: one more lit per stage-up, all of them after ten
    await run(['a_tower']);
    const lit = () => page.evaluate(() => Array.from(document.querySelectorAll('#bg .s4x.win')).filter((w) => parseFloat(getComputedStyle(w).opacity) > 0.5).length);
    const l0 = await lit(); await fire('stageUp', 800); const l1 = await lit(); await fire('stageUp', 800); const l2 = await lit();
    ok(l0 === 1 && l1 === 2 && l2 === 3, `a_tower: lit windows ${l0}, ${l1}, ${l2} (expected 1, 2, 3 as the stage goes up)`);
    await run(['a_observatory']);
    const notch = () => page.evaluate(() => { const m = document.querySelector('#boardWrap .s4x.notch'); return m ? Math.round(new DOMMatrix(getComputedStyle(m).transform).m41) : -1; });
    const n0 = await notch(); await fire('stageUp', 900); const n1 = await notch();
    ok(n0 === 0 && n1 === 12, `a_observatory: the marker is at ${n0} then ${n1} (expected 0, 12: one notch per stage)`);
  }

  // ---- 6. the frame lines up with the bricks: nothing of it is drawn over the brick field
  if (want('frame')) {
    const diffIn = async (css) => {
      const a = await shotWith(NOANIM + '#field .brick,#field .tap-hint{visibility:hidden!important} #fxlayer,.rush-glow,.s4x{display:none!important}');
      const b = await shotWith(NOANIM + '#field .brick,#field .tap-hint{visibility:hidden!important} #fxlayer,.rush-glow,.s4x{display:none!important}' + css);
      return page.evaluate(async ({ a, b }) => {
        const load = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(i, 0, 0); return g; };
        const ga = await load(a), gb = await load(b), f = document.getElementById('field').getBoundingClientRect();
        const x = Math.round(f.left), y = Math.round(f.top), w = Math.round(f.width), h = Math.round(f.height);
        const da = ga.getImageData(x, y, w, h).data, db = gb.getImageData(x, y, w, h).data; let n = 0;
        for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 6) n++;
        return n;
      }, { a: a.toString('base64'), b: b.toString('base64') });
    };
    for (const [w, h] of [[393, 852], [360, 640]]) {
      await page.setViewportSize({ width: w, height: h });
      for (const id of BOARDS) {
        await run([id]);
        const ring = await diffIn('.board-wrap::before,.board-wrap::after{display:none!important}');
        const tool = await diffIn('.board::after{display:none!important}');
        ok(ring === 0, `${id} at ${w}x${h}: the frame ring or its corners reach into the brick field (${ring} pixels)`);
        ok(tool === 0, `${id} at ${w}x${h}: the inner frame lines reach into the brick field (${tool} pixels)`);
        // the ring sits outside the board: the board keeps the size the layout gave it
        const g = await page.evaluate(() => { const b = document.getElementById('board').getBoundingClientRect(), wr = document.getElementById('boardWrap').getBoundingClientRect(), f = document.getElementById('field').getBoundingClientRect(); return { dw: Math.abs(b.width - wr.width), dh: Math.abs(b.height - wr.height), fl: f.left - b.left, ft: f.top - b.top }; });
        ok(g.dw < 0.5 && g.dh < 0.5 && g.fl > 4 && g.ft > 4, `${id} at ${w}x${h}: the board and its brick field moved`, g);
      }
    }
    await page.setViewportSize({ width: 393, height: 852 });
  }

  const real = errors.filter((e) => !/Failed to load resource/.test(e));
  ok(real.length === 0, 'console errors', real);
  console.log(problems ? problems + ' PROBLEMS' : 'u5 boards ok');
  await browser.close();
  process.exit(problems ? 1 : 0);
})();
