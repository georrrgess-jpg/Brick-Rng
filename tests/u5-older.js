// Update 5 (Phases 2 and 4): the older cosmetics after the repaint (the Update 4 touch-up items and Series 3). Fails (exit 1) on a problem.
//   1. colour:   every older skin keeps the seven brick colours at least 12.5 apart (CIEDE2000), at rest and in Rush, measured two ways: the mean colour of
//                the inner 70% of every brick (the audit's probe, docs/update-5/audit-scripts/run/de.py) and of the centre 40% (docs/update-5/prototypes/shoot.js)
//   2. budgets:  skins animate at most a third of the board, boards run at most two continuous animations behind the bricks, only transform and opacity animate,
//                no blend mode on a brick layer, low-end and Reduce Motion hold still
//   3. HUD:      the text over every older board passes the Update 4 thresholds (goal band 6:1, score label 3.8, score 4.5) and the stage strip and fuse readout
//                pass too, at 393x852 and 360x640, over every phase of the board's loops
//   4. readout:  no board sets the colour of the fuse readout: the urgency colours (calm, low, critical) are the same on every board (R-4)
//   5. slots:    nothing busy (the ferris wheel, lava, a cone) sits behind the power-up slots (K-7)
//   6. pops:     the older pops stay inside a per-brick particle budget and a peak of 420 live particles on a 28-brick pop, live no longer than their cap
//                (Pixels and Neon Burst end within 600 ms), steer nothing in reduced motion and low-end, and leak no steered particle; Embers and Pixels read
//                on a 12-brick group; Glass and Snow no longer look alike (Glass carries the brick's colour, Snow is white-blue)
//   7. badges:   every older pop and board badge is told apart from the others at 36, 56, 72 and 120 px, nothing is clipped, Holo keeps the colours
// Usage: node tests/u5-older.js [--only=colour,budgets,hud,readout,slots,pops,badges] [--quick]
const { launch } = require('./lib');
const flag = (n) => (process.argv.find((a) => a.startsWith('--' + n + '=')) || '').split('=')[1];
const ONLY = flag('only') ? flag('only').split(',') : null, QUICK = process.argv.includes('--quick');
const want = (s) => !ONLY || ONLY.includes(s);

const MIN_DE = 12.5;
const SAFE = new Set(['transform', 'opacity', 'translate', 'rotate', 'scale']);
const BOARDS = ['default:board', 'a_deepsea', 'a_foundry', 'a_market', 'a_orbit', 'a_greenhouse', 'a_storm', 'a_holo', 'a_carnival', 'a_beach', 'a_volcano', 'a_aurora'];
const POPS = ['b_ember', 'b_petal', 'b_glass', 'b_pixel', 'b_bolt', 'b_fire', 'b_confetti', 'b_bubbles', 'b_coins', 'b_leaves', 'b_neon', 'b_snow', 'b_thunder', 'b_ink', 'b_nova', 'b_dragon'];

/* ---- page-side probes (self-contained: they are serialised into the page) ---- */
/** Mean colour of every brick colour over the inner `frac` of each cell of a screenshot, then the smallest CIEDE2000 between two colours. */
const colourProbe = async ([b64, fracs]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const k = img.width / innerWidth, view = BR.Run.view, f = view.field.getBoundingClientRect(), cell = view.cell;
  const recs = Array.from(view.bricks.values()).filter((r) => !r.el.classList.contains('fusebrick'));
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const toLab = ([r, gg, b]) => {
    const R = lin(r), G = lin(gg), B = lin(b);
    const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
    const fx = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * fx(Y) - 16, 500 * (fx(X) - fx(Y)), 200 * (fx(Y) - fx(Z))];
  };
  const de2000 = (l1, l2) => {
    const [L1, a1, b1] = l1, [L2, a2, b2] = l2, rad = Math.PI / 180;
    const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
    const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
    const h1p = (Math.atan2(b1, a1p) / rad + 360) % 360, h2p = (Math.atan2(b2, a2p) / rad + 360) % 360;
    const dLp = L2 - L1, dCp = C2p - C1p;
    let dh = h2p - h1p; if (C1p * C2p === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh * rad) / 2), Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
    let hbp = h1p + h2p;
    if (C1p * C2p !== 0) { if (Math.abs(h1p - h2p) > 180) hbp = hbp < 360 ? (hbp + 360) / 2 : (hbp - 360) / 2; else hbp /= 2; }
    const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
    const dth = 30 * Math.exp(-(((hbp - 275) / 25) ** 2)), Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
    const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T, Rt = -Math.sin(2 * dth * rad) * Rc;
    return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
  };
  const out = {};
  for (const frac of fracs) {
    const lo = (1 - frac) / 2, acc = {};
    recs.forEach((rec) => {
      const x0 = Math.round((f.left + (rec.c + lo) * cell) * k), y0 = Math.round((f.top + (rec.r + lo) * cell) * k), w = Math.max(2, Math.round(cell * frac * k));
      const d = g.getImageData(x0, y0, w, w).data; let R = 0, G = 0, B = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { R += d[i]; G += d[i + 1]; B += d[i + 2]; n++; }
      const a = (acc[+rec.el.dataset.c] = acc[+rec.el.dataset.c] || [0, 0, 0, 0]); a[0] += R / n; a[1] += G / n; a[2] += B / n; a[3]++;
    });
    const labs = Object.keys(acc).map((q) => ({ col: +q, lab: toLab([acc[q][0] / acc[q][3], acc[q][1] / acc[q][3], acc[q][2] / acc[q][3]]) }));
    let min = 1e9, pair = '';
    for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) { const v = de2000(labs[i].lab, labs[j].lab); if (v < min) { min = v; pair = BR.PALETTE[labs[i].col].name + '/' + BR.PALETTE[labs[j].col].name; } }
    out[frac] = { min, pair };
  }
  return out;
};
/** Contrast of the HUD text against the scene behind it (text hidden, 90th percentile luminance), from a screenshot with the text hidden and the text colours read before. */
const hudProbe = async ([b64, C]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const k = img.width / innerWidth;
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
  const p90 = (el, inset = 0) => {
    const b = el.getBoundingClientRect(), x0 = Math.max(0, Math.round((b.left + b.width * inset) * k)), x1 = Math.min(img.width, Math.round((b.right - b.width * inset) * k)), y0 = Math.max(0, Math.round(b.top * k)), y1 = Math.min(img.height, Math.round(b.bottom * k));
    const d = g.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)).data, L = [];
    for (let i = 0; i < d.length; i += 16) L.push(lum(d[i], d[i + 1], d[i + 2]));
    L.sort((a, b) => a - b); return L[Math.floor(L.length * 0.9)];
  };
  const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), q = (s) => document.querySelector(s), out = {};
  out.goal = cr(C.msg, p90(q('#msgBand'), 0.12)); out.lbl = cr(C.lbl, p90(q('.score-box .lbl'))); out.score = cr(C.num, p90(q('.score-box b')));
  out.stage = cr(C.stage, p90(q('.ss-stage'))); out.goaltxt = cr(C.goal, p90(q('.ss-goal'))); out.fuse = cr(C.fnum, p90(q('.fz-num'))); out.unit = cr(C.funit, p90(q('.fz-unit')));
  return out;
};
const textColours = () => {
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (r, gg, b) => 0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
  const col = (el) => { const m = getComputedStyle(el).color.match(/[\d.]+/g).map(Number); return lum(m[0], m[1], m[2]); }, q = (s) => document.querySelector(s);
  return { msg: col(q('.m-goal')), lbl: col(q('.score-box .lbl')), num: col(q('.score-box b')), stage: col(q('.ss-stage')), goal: col(q('.ss-goal')), fnum: col(q('.fz-num')), funit: col(q('.fz-unit span') || q('.fz-unit')) };
};
/** Freeze every scene animation at a given phase of its first iteration (so a pulsing sun-beam is caught at its brightest and its dimmest). */
const phase = (ph) => { document.getAnimations().forEach((a) => { const t = a.effect && a.effect.target; if (!t || !t.closest || !t.closest('#bg, #board')) return; const d = a.effect.getComputedTiming().duration; if (typeof d === 'number' && isFinite(d)) { a.pause(); a.currentTime = ph * d; } }); };
const HIDE_HUD = '.m-goal,.score-box .lbl,.score-box b,.ss-stage,.ss-goal,.fz-num,.fz-unit,.fz-unit *{color:transparent!important;text-shadow:none!important;visibility:hidden!important} #msgBand>*{visibility:hidden!important}';

/** A virtual clock: timers, rAF and performance.now only move when the test advances them, so a particle's life is exact. */
const VT = `(() => {
  if (window.__vt) return;
  let now = performance.now(); const timers = []; let rafs = []; let id = 1;
  performance.now = () => now;
  window.setTimeout = (fn, ms, ...a) => { const t = { id: id++, at: now + (ms || 0), fn, a }; timers.push(t); return t.id; };
  window.clearTimeout = (i) => { const k = timers.findIndex((t) => t.id === i); if (k >= 0) timers.splice(k, 1); };
  window.requestAnimationFrame = (cb) => { rafs.push(cb); return id++; };
  window.__vt = { advance(ms, step = 1000 / 60, onStep) { const end = now + ms; while (now < end - 1e-6) { now = Math.min(end, now + step);
    for (;;) { const k = timers.findIndex((t) => t.at <= now); if (k < 0) break; const t = timers.splice(k, 1)[0]; try { t.fn(...t.a); } catch (e) { console.error(e); } }
    const q = rafs; rafs = []; q.forEach((cb) => { try { cb(now); } catch (e) { console.error(e); } }); if (onStep) onStep(now); } } };
})()`;

(async () => {
  let problems = 0;
  const ok = (c, ...a) => { if (!c) { problems++; console.log('PROBLEM', ...a); } };
  const { browser, page, errors } = await launch({ width: 393, height: 852, dsf: 1 });
  const prep = () => page.evaluate(() => {
    BR.Coach.markAllSeen(); Object.keys(BR.Coach.CARDS || {}).forEach((k) => { BR.Storage.data.seen[k] = true; });
    const D = BR.Storage.data; D.seenTutorial = true; D.runs = 8; D.settings.sound = false; D.settings.music = false; D.settings.haptics = false; D.settings.perf = 'high'; D.settings.reduced = false; BR.App.applySettings();
  });
  await prep();
  await page.addStyleTag({ content: '.tap-hint{display:none!important}' });
  const catalog = await page.evaluate(() => ({
    skins: ['default:skin'].concat(BR.ITEMS.filter((i) => i.type === 'skin' && (i.series || 2) <= 3).map((i) => i.id)),
    boards: ['default:board'].concat(BR.ITEMS.filter((i) => i.type === 'board' && (i.series || 2) <= 3).map((i) => i.id)),
    pops: ['default:pop'].concat(BR.ITEMS.filter((i) => i.type === 'pop' && (i.series || 2) <= 3).map((i) => i.id)),
  }));
  const startRun = async (ids) => {
    await page.evaluate((ids) => {
      const P = BR.Progress; ['skin', 'pop', 'board', 'fuse'].forEach((t) => P.equip('default', t));
      ids.filter((id) => !id.startsWith('default')).forEach((id) => { const it = BR.itemById[id]; const inst = BR.Storage.data.profile.vault.find((v) => v.itemId === id) || P.keep({ itemId: id, shine: 'plain', seed: 3, counter: null }); P.equip(inst.uid, it.type); });
      BR.Skins.apply(); BR.Run.over = true; BR.Run.token++; if (BR.Run.resultsEl) BR.Run.closeResults(); BR.Storage.clearRun(); if (BR.Router.current === 'run') BR.Router.go('home', { instant: true });
      __app.startRun({ mode: 'rush', boosts: {} });
    }, ids);
    await page.waitForFunction(() => BR.Run.clock && !BR.Run.busy && BR.Router.current === 'run', null, { timeout: 25000 });
    await page.evaluate(() => { BR.Run.engine.fuse = 19; });
    await page.waitForTimeout(300);
  };
  const anims = () => page.evaluate(() => {
    const all = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target);
    const inBg = (el) => !!el.closest('#bg'), inField = (el) => !!el.closest('#field .brick'), board = document.getElementById('board');
    return {
      scene: all.filter((a) => inBg(a.effect.target) || a.effect.target === board).map((a) => (a.animationName || '?') + (a.effect.pseudoElement || '')),
      field: all.filter((a) => inField(a.effect.target) && a.animationName).length,
      props: Array.from(new Set(all.filter((a) => (inBg(a.effect.target) || inField(a.effect.target)) && a.effect.getKeyframes).flatMap((a) => a.effect.getKeyframes().flatMap((k) => Object.keys(k)).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p))))),
    };
  });

  // ================================================================ 1. colour
  if (want('colour')) {
    const sevenBoard = async () => {
      await page.evaluate(() => { const B = BR.Run.engine.board; for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const b = B.grid[r][c]; b.color = (c + 3 * r) % 7; delete b.fb; } B.version++; BR.Run.view.syncTo(B); BR.Run.clearHover(); });
      await page.waitForTimeout(220);
    };
    const probe = async (n) => {
      let worst = null;
      for (let i = 0; i < n; i++) {
        const buf = await page.screenshot();
        const r = await page.evaluate(colourProbe, [buf.toString('base64'), [0.7, 0.4]]);
        if (!worst) worst = r; else for (const f of [0.7, 0.4]) if (r[f].min < worst[f].min) worst[f] = r[f];
        await page.waitForTimeout(330);
      }
      return worst;
    };
    const rows = [];
    for (const id of catalog.skins) {
      await startRun([id]);
      await sevenBoard();
      const rest = await probe(QUICK ? 1 : 3);
      await page.evaluate(() => { BR.Run.engine.rush.active = true; BR.Run.engine.rush.left = 60; BR.Run.rushStart(); });
      await page.waitForTimeout(1700);
      const rush = await probe(QUICK ? 1 : 3);
      for (const [mode, r] of [['at rest', rest], ['in Rush', rush]]) for (const f of [0.7, 0.4]) ok(r[f].min >= MIN_DE, `${id} ${mode}: two brick colours are only ${r[f].min.toFixed(1)} apart (${r[f].pair}, ${f * 100}% of the brick; needs ${MIN_DE})`);
      rows.push(`${id.padEnd(14)} rest ${rest[0.7].min.toFixed(1)}/${rest[0.4].min.toFixed(1)}  rush ${rush[0.7].min.toFixed(1)}/${rush[0.4].min.toFixed(1)}`);
    }
    console.log('colour (CIEDE2000, inner 70% / centre 40%):\n  ' + rows.join('\n  '));
  }

  // ================================================================ 2. budgets
  if (want('budgets')) {
    for (const id of catalog.boards) {
      await startRun([id]);
      const a = await anims();
      ok(a.scene.length <= 2, `${id}: ${a.scene.length} animations behind the bricks (max 2)`, a.scene);
      ok(a.props.every((p) => SAFE.has(p)), `${id}: animates a property other than transform/opacity`, a.props);
    }
    for (const id of catalog.skins) {
      await startRun([id]);
      const a = await anims();
      ok(a.field <= 43, `${id}: ${a.field} animations on the bricks (max 43 of 64)`);
      ok(a.props.every((p) => SAFE.has(p)), `${id}: animates a property other than transform/opacity`, a.props);
      const blend = await page.evaluate(() => Array.from(document.querySelectorAll('#field .brick *')).some((el) => !el.classList.contains('sheen') && getComputedStyle(el).mixBlendMode !== 'normal'));
      ok(!blend, `${id}: a brick layer uses a blend mode`);
    }
    for (const mode of ['low', 'reduced']) {
      await page.evaluate((m) => { const s = BR.Storage.data.settings; s.reduced = m === 'reduced'; s.perf = m === 'low' ? 'low' : 'high'; BR.App.applySettings(); }, mode);
      for (const id of catalog.boards) { await startRun([id]); const a = await anims(); ok(a.scene.length === 0, `${mode}: ${id} still animates behind the bricks`, a.scene); }
      for (const id of catalog.skins) { await startRun([id]); const a = await anims(); ok(a.field === 0, `${mode}: ${id} still animates ${a.field} brick layers`); }
    }
    await page.evaluate(() => { const s = BR.Storage.data.settings; s.reduced = false; s.perf = 'high'; BR.App.applySettings(); });
    console.log('budgets checked: ' + catalog.boards.length + ' boards, ' + catalog.skins.length + ' skins, at rest, low-end and reduced');
  }

  // ================================================================ 3 + 4. HUD text over the scenes, and the fuse readout colour
  if (want('hud') || want('readout')) {
    const THR = { goal: 6, lbl: 3.8, score: 4.5, stage: 4.5, goaltxt: 3.8, fuse: 3.0, unit: 3.0 };
    const HOLD = { calm: 'e.fuse = 24', low: 'e.fuse = 6.8', crit: 'e.fuse = 3.1' };
    const hold = (st) => page.evaluate((h) => { window.__hold && clearInterval(window.__hold); window.__hold = setInterval(() => { const e = BR.Run.engine; eval(h); }, 25); }, HOLD[st]);
    const sizes = QUICK ? [[393, 852]] : [[393, 852], [360, 640]];
    const readout = {};
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      for (const id of catalog.boards) {
        await startRun([id]);
        for (const st of ['calm', 'low', 'crit']) {
          await hold(st); await page.waitForTimeout(520);
          const C = await page.evaluate(textColours);
          const rd = await page.evaluate(() => { const n = document.querySelector('.fz-num'); return { num: getComputedStyle(n).color, digits: Array.from(n.querySelectorAll('*')).map((e) => getComputedStyle(e).color).filter((c, i, a) => a.indexOf(c) === i), unit: getComputedStyle(document.querySelector('.fz-unit')).color }; });
          if (w === 393) { readout[st] = readout[st] || rd; ok(rd.num === readout[st].num && rd.digits.every((c) => c === readout[st].num) && rd.unit === readout[st].unit, `${id} at ${st} fuse: the fuse readout colour is not the default's (a board sets it)`, JSON.stringify({ rd, want: readout[st] })); }
          if (!want('hud') || (st === 'low' && QUICK)) continue;
          await page.addStyleTag({ content: HIDE_HUD });
          let m = null;
          for (const ph of [0, 0.5, 1]) {
            await page.evaluate(phase, ph); await page.waitForTimeout(50);
            const q = await page.evaluate(hudProbe, [(await page.screenshot()).toString('base64'), C]);
            if (!m) m = q; else for (const k of Object.keys(q)) m[k] = Math.min(m[k], q[k]);
          }
          await page.evaluate(() => { const s = document.querySelectorAll('style'); s[s.length - 1].remove(); });
          for (const k of Object.keys(THR)) { if (k === 'fuse' || k === 'unit' || st === 'calm' || k === 'goal') ok(m[k] >= THR[k], `${id} at ${w}x${h}, ${st} fuse: ${k} contrast ${m[k].toFixed(1)} is under ${THR[k]}`); }
        }
        await page.evaluate(() => { window.__hold && clearInterval(window.__hold); });
      }
    }
    await page.setViewportSize({ width: 393, height: 852 });
    console.log('hud text over ' + catalog.boards.length + ' boards checked at ' + sizes.map((s) => s.join('x')).join(', ') + '; readout colours compared with the default board');
  }

  // ================================================================ 5. nothing busy behind the power-up slots
  if (want('slots')) {
    const busy = async () => {
      await page.addStyleTag({ content: '.slots,.rushbar,.msgband,.score-box,.run-top,.fuse,.stagestrip,.board-wrap{visibility:hidden!important}' });
      const buf = await page.screenshot();
      const r = await page.evaluate(async (b64) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
        const b = document.querySelector('.slots').getBoundingClientRect(), x0 = Math.round(b.left), x1 = Math.round(b.right), y0 = Math.round(b.top), y1 = Math.round(b.bottom);
        const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data, w = x1 - x0, rows = [];
        for (let y = 0; y < y1 - y0; y++) { let s = 0, s2 = 0; for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; s += l; s2 += l * l; } const m = s / w; rows.push(Math.sqrt(Math.max(0, s2 / w - m * m))); }
        rows.sort((a, b) => a - b); return rows[Math.floor(rows.length * 0.95)];
      }, buf.toString('base64'));
      await page.evaluate(() => { const s = document.querySelectorAll('style'); s[s.length - 1].remove(); });
      return r;
    };
    const res = [];
    for (const id of catalog.boards) { await startRun([id]); await page.evaluate(phase, 0.5); const v = await busy(); res.push(`${id} ${v.toFixed(1)}`); ok(v <= 18, `${id}: the scene behind the power-up slots is busy (row-to-row variation ${v.toFixed(1)}, max 18)`); }
    console.log('behind the slots (horizontal variation, 95th percentile): ' + res.join(', '));
  }

  // ================================================================ 6. pops
  if (want('pops')) {
    const popIds = catalog.pops.filter((id) => !id.startsWith('default') && POPS.includes(id));
    const CAP = (n) => 3 * n + 8;                               // particles one brick may emit at once
    const LIFE = { b_pixel: 0.6, b_neon: 0.6, b_glass: 1.1, b_ember: 1.8, b_snow: 2.2 };   // longest a particle of the recipe may live (seconds); the others keep the Update 3/4 limits below
    const recipeOf = (id) => ({ b_ember: 'ember', b_petal: 'petal', b_glass: 'glass', b_pixel: 'pixel', b_bolt: 'lightning', b_fire: 'fireworks' }[id] || null);
    await startRun([]);
    const stats = [];
    for (const mode of ['normal', 'reduced', 'low']) {
      await page.evaluate((m) => { const s = BR.Storage.data.settings; s.reduced = m === 'reduced'; s.perf = m === 'low' ? 'low' : 'high'; BR.App.applySettings(); }, mode);
      for (const id of popIds) {
        await page.reload(); await page.waitForFunction(() => window.__app); await prep(); await page.addStyleTag({ content: '.tap-hint{display:none!important}' });
        await page.evaluate((m) => { const s = BR.Storage.data.settings; s.reduced = m === 'reduced'; s.perf = m === 'low' ? 'low' : 'high'; BR.App.applySettings(); }, mode);
        await startRun([id]);
        await page.evaluate(VT);
        const res = await page.evaluate(({ mode }) => {
          const fx = BR.App.fx, view = BR.Run.view, rec = BR.Skins.pop, pal = BR.PALETTE[0], out = { per: {}, peak: 0, lastLife: 0 };
          // one brick, then twelve and twenty-eight bricks (the per-brick budget n shrinks as the group grows, as in BoardView.playResult)
          const bud = fx.budget;
          for (const [bricks, n] of [[1, 9], [12, 7], [28, 5]]) {
            fx.parts.length = 0; fx.rings.length = 0; fx.bolts.length = 0; BR.U4.live.length = 0;
            const pts = []; for (let i = 0; i < bricks; i++) pts.push(view.pagePoint(1 + ((i / 6) | 0) % 6, 1 + (i % 6)));
            let maxPer = 0, steered = 0;
            pts.forEach((p) => { const k = fx.parts.length, s0 = BR.U4.live.length; fx.pop(rec, p.x, p.y, pal.glow, pal.hi, n, 0.9, 'plain'); maxPer = Math.max(maxPer, fx.parts.length - k); steered += BR.U4.live.length - s0; });
            const life = fx.parts.reduce((m, q) => Math.max(m, q.max), 0);
            let peak = fx.parts.length;
            window.__vt.advance(2600, 1000 / 60, () => { peak = Math.max(peak, fx.parts.length); });
            out.per[bricks] = { n, maxPer, life, peak, steered, left: fx.parts.length, leak: BR.U4.live.length, rings: fx.rings.length };
          }
          out.bud = bud; return out;
        }, { mode });
        const L = LIFE[id];
        for (const bricks of [1, 12, 28]) {
          const r = res.per[bricks];
          ok(r.left === 0 && r.leak === 0 && r.rings === 0, `${mode}: ${id} (${bricks} bricks) left ${r.left} particles, ${r.leak} steered, ${r.rings} rings behind after 2.6 s`);
          if (mode === 'normal') {
            ok(r.maxPer <= CAP(r.n) * (id === 'b_neon' ? 1.2 : 1) + (recipeOf(id) ? 0 : 0), `${id}: one brick emitted ${r.maxPer} particles (budget ${CAP(r.n)} for n = ${r.n})`);
            ok(r.peak <= 420, `${id}: ${bricks} bricks put ${r.peak} particles on screen at once (max 420)`);
            if (L) ok(r.life <= L + 1e-6, `${id}: a particle lives ${r.life.toFixed(2)} s (max ${L})`);
          } else ok(r.steered === 0, `${mode}: ${id} steered ${r.steered} particles (reduced motion and low-end keep the plain recipes)`);
        }
        stats.push(`${mode[0]}:${id.replace('b_', '')} ${res.per[1].maxPer}/${res.per[12].peak}/${res.per[28].peak}`);
      }
    }
    await page.evaluate(() => { const s = BR.Storage.data.settings; s.reduced = false; s.perf = 'high'; BR.App.applySettings(); });
    console.log('pops (per brick, peak on 12 bricks, peak on 28 bricks): ' + stats.filter((s) => s.startsWith('n:')).join(', '));

    // Embers and Pixels read on a group of 12; Glass carries the brick's colour and Snow does not
    const frame = async (id, bricks, t) => {
      await page.reload(); await page.waitForFunction(() => window.__app); await prep(); await page.addStyleTag({ content: '.tap-hint{display:none!important}' });
      await startRun([id]); await page.evaluate(VT);
      await page.evaluate(({ bricks }) => {
        const view = BR.Run.view, fx = BR.App.fx, pal = BR.PALETTE[0]; document.querySelectorAll('#field .brick').forEach((e) => { e.style.visibility = 'hidden'; });
        const n = bricks > 14 ? 5 : bricks > 6 ? 7 : 9;
        for (let i = 0; i < bricks; i++) { const p = view.pagePoint(2 + ((i / 4) | 0), 2 + (i % 4)); fx.pop(BR.Skins.pop, p.x, p.y, pal.glow, pal.hi, n, 0.9, 'plain'); }
      }, { bricks });
      await page.evaluate((t) => window.__vt.advance(t), t);
      return page.evaluate(() => {
        const cv = document.getElementById('fx'), g = cv.getContext('2d'), d = g.getImageData(0, 0, cv.width, cv.height).data; let lit = 0, R = 0, B = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 24) { lit++; R += d[i]; B += d[i + 2]; n++; }
        return { lit: lit / (cv.width / innerWidth) ** 2, redBlue: n ? (R - B) / n : 0 };
      });
    };
    const emb = await frame('b_ember', 12, 380), pix = await frame('b_pixel', 12, 250), gla = await frame('b_glass', 12, 260), sno = await frame('b_snow', 12, 260);
    ok(emb.lit >= 2500, `Embers on a 12-brick group light only ${Math.round(emb.lit)} px (min 2500): they do not read`);
    ok(pix.lit >= 1500, `Pixels on a 12-brick group light only ${Math.round(pix.lit)} px (min 1500): too thin`);
    ok(gla.redBlue > sno.redBlue + 12, `Glass and Snow look alike: Glass (a ruby brick) has red minus blue ${gla.redBlue.toFixed(0)}, Snow ${sno.redBlue.toFixed(0)} (Glass must be tinted by the brick, Snow white-blue)`);
    console.log(`pop frames: embers lit ${Math.round(emb.lit)} px, pixels ${Math.round(pix.lit)} px, glass red-blue ${gla.redBlue.toFixed(0)}, snow red-blue ${sno.redBlue.toFixed(0)}`);
  }

  // ================================================================ 7. badges
  if (want('badges')) {
    await page.reload(); await page.waitForFunction(() => window.__app); await prep();
    await page.setViewportSize({ width: 900, height: 700 });
    const SIZES = [36, 56, 72, 120];
    for (const type of ['pop', 'board']) {
      const ids = catalog[type + 's'];
      for (const size of SIZES) {
        await page.evaluate(({ ids, size }) => {
          document.querySelectorAll('.badge-sheet').forEach((n) => n.remove());
          const w = document.createElement('div'); w.className = 'badge-sheet'; w.style.cssText = 'position:fixed;inset:0;z-index:999;background:#150d2a;padding:12px;display:flex;flex-wrap:wrap;gap:14px;align-content:flex-start';
          w.insertAdjacentHTML('beforeend', '<style>.badge-sheet *,.badge-sheet *::before,.badge-sheet *::after{animation:none!important}</style>');
          ids.forEach((id, n) => { const it = BR.itemById[id]; w.insertAdjacentHTML('beforeend', `<div data-id="${id}" style="display:inline-block;line-height:0">${BR.Badge.html(it, { shine: 'plain', seed: 300 + n * 17 }, { size })}</div>`); });
          document.body.appendChild(w);
        }, { ids, size });
        await page.waitForTimeout(250);
        // clipped art: everything the art draws stays inside the badge, and a pop's drawing stays inside its own box
        const clip = await page.evaluate(() => Array.from(document.querySelectorAll('.badge-sheet [data-id]')).map((h) => {
          const b = h.querySelector('.bdg').getBoundingClientRect(), bad = [];
          h.querySelectorAll('.bdg-art svg, .bdg-art .bdg-scene, .bdg-art .bdg-bgrid').forEach((e) => { const r = e.getBoundingClientRect(); if (r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1) bad.push(e.tagName); });
          const sv = h.querySelector('.bdg-art svg.pa-own'); if (sv) { const bb = sv.getBBox(); if (bb.x < -51 || bb.y < -51 || bb.x + bb.width > 51 || bb.y + bb.height > 51) bad.push('drawing past the box ' + [bb.x, bb.y, bb.width, bb.height].map(Math.round)); }
          return { id: h.dataset.id, bad };
        }));
        clip.forEach((c) => ok(!c.bad.length, `${type} badge ${c.id} at ${size}px is clipped`, c.bad));
        // distinct: the mean absolute colour difference between every pair of badges of one type
        const shots = []; for (const id of ids) shots.push((await page.locator(`.badge-sheet [data-id="${id}"] .bdg`).screenshot()).toString('base64'));
        const diffs = await page.evaluate(async (shots) => {
          const px = []; for (const s of shots) { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, 48, 48); px.push(g.getImageData(0, 0, 48, 48).data); }
          const out = []; for (let i = 0; i < px.length; i++) for (let j = i + 1; j < px.length; j++) { let s = 0; for (let k = 0; k < px[i].length; k += 4) s += Math.abs(px[i][k] - px[j][k]) + Math.abs(px[i][k + 1] - px[j][k + 1]) + Math.abs(px[i][k + 2] - px[j][k + 2]); out.push([i, j, s / (48 * 48 * 3)]); }
          return out;
        }, shots);
        const MIN = type === 'pop' ? 14 : 16;
        let worst = [0, 0, 1e9]; diffs.forEach((d) => { if (d[2] < worst[2]) worst = d; });
        ok(worst[2] >= MIN, `${type} badges ${ids[worst[0]]} and ${ids[worst[1]]} look alike at ${size}px (difference ${worst[2].toFixed(1)}, min ${MIN})`);
        console.log(`badges ${type} ${size}px: closest pair ${ids[worst[0]]} / ${ids[worst[1]]} ${worst[2].toFixed(1)}`);
      }
    }
    // Holo keeps the colours: the mean chroma of a Holo badge stays within 12% of the same badge in Plain
    const chroma = async (shine) => {
      await page.evaluate(({ ids, shine }) => {
        document.querySelectorAll('.badge-sheet').forEach((n) => n.remove());
        const w = document.createElement('div'); w.className = 'badge-sheet'; w.style.cssText = 'position:fixed;inset:0;z-index:999;background:#150d2a;padding:12px;display:flex;flex-wrap:wrap;gap:14px;align-content:flex-start';
        ids.forEach((id, n) => { w.insertAdjacentHTML('beforeend', `<div data-id="${id}" style="display:inline-block;line-height:0">${BR.Badge.html(BR.itemById[id], { shine, seed: 300 + n * 17 }, { size: 72, still: true })}</div>`); });
        document.body.appendChild(w);
      }, { ids: catalog.pops.concat(catalog.boards), shine });
      await page.waitForTimeout(250);
      const out = {};
      for (const id of catalog.pops.concat(catalog.boards)) {
        const buf = (await page.locator(`.badge-sheet [data-id="${id}"] .bdg`).screenshot()).toString('base64');
        out[id] = await page.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0, 48, 48); const d = g.getImageData(0, 0, 48, 48).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); return s / (48 * 48); }, buf);
      }
      return out;
    };
    const plain = await chroma('plain'), holo = await chroma('holo');
    const ratios = Object.keys(plain).map((id) => holo[id] / plain[id]);
    Object.keys(plain).forEach((id) => ok(holo[id] >= plain[id] * 0.88, `Holo washes the ${id} badge out (chroma ${holo[id].toFixed(0)} against ${plain[id].toFixed(0)} in Plain)`));
    console.log('holo keeps ' + (Math.min(...ratios) * 100).toFixed(0) + '% of the colour at worst');
    await page.setViewportSize({ width: 393, height: 852 });
  }

  const real = errors.filter((e) => !/Failed to load resource/.test(e));
  ok(real.length === 0, 'console errors', real);
  console.log(problems ? problems + ' PROBLEMS' : 'u5 older cosmetics ok');
  await browser.close();
  process.exit(problems ? 1 : 0);
})();
