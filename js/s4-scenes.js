/* Series 4 "Moonwick" boards: the moments of Alchemy Lab, Observatory, Floating Isles and Moonwick Tower (BR.Skins.handlers, keyed by item.moment)
   and the badge scene of every Series 4 board (BR.Badge.custom).
   The art lives in css/s4-scenes.css. Everything here toggles a few small layers (the .s4x elements the equipped board adds to #bg, plus the
   gold marker on the Observatory's frame and the moonbeam of the Tower) and animates them on transform and opacity only:
     - a board's moments run at most two animations at a time, a Line Blast or a big pop ends within 600 ms, a Rush start, a Rush end and a
       stage-up within 900 ms; held states (the lit flasks in Rush) are inline styles that the matching end moment clears;
     - low-end phones and Reduce Motion run none (the layers are hidden by css and BR.Skins.onEvent skips Reduce Motion);
     - nothing is created at boot: the layers exist only while their board is equipped, and are removed when it is not. */
(function () {
  const BR = (window.BR = window.BR || {});
  const S = BR.Skins;
  if (!S || !S.handlers || !S.applyHooks) return;
  const $ = (id) => document.getElementById(id);
  const NAMES = ['library', 'glade', 'alchemy', 'observatory', 'isles', 'tower'];
  const which = (root) => NAMES.find((n) => root.classList.contains('board-' + n)) || null;
  const calm = () => !!(BR.lowEnd || BR.reducedMotion);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const audio = (name) => { try { if (BR.audio && BR.audio[name]) BR.audio[name](); } catch (e) { /* sound is optional */ } };
  const tone = (o) => { try { if (BR.audio && BR.audio.tone) BR.audio.tone(o); } catch (e) { /* sound is optional */ } };
  const noise = (o) => { try { if (BR.audio && BR.audio.noise) BR.audio.noise(o); } catch (e) { /* sound is optional */ } };
  /** a low bell: the strike, a ring that hangs on, and a quiet overtone */
  const bell = (f = 196, vol = 0.12) => { tone({ f, dur: 1.1, vol, attack: 0.004 }); tone({ f: f * 2.76, dur: 0.5, vol: vol * 0.32, attack: 0.004 }); tone({ f: f * 0.5, dur: 0.7, vol: vol * 0.5, attack: 0.008 }); };

  /* ------------------------------------------------------------------ small DOM helpers */
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const live = new Set();            // animations this file started, so a restart can cancel them
  /** run keyframes on a node; the animation is tracked until it ends and never outlives its budget */
  function play(node, frames, opts) {
    if (!node || !node.animate) return null;
    const a = node.animate(frames, Object.assign({ fill: 'none' }, opts));
    live.add(a);
    const done = () => live.delete(a);
    a.onfinish = done; a.oncancel = done;
    return a;
  }
  function add(bg, cls, where, parent) {
    const el = document.createElement('i');
    el.className = 's4x ' + cls;
    el.setAttribute('aria-hidden', 'true');
    if (where === 'under') { const ref = bg.querySelector('.scene-fx'); bg.insertBefore(el, ref || bg.firstChild); }
    else (parent || bg).appendChild(el);
    return el;
  }
  const spr = {};                    // the equipped board's layers by name
  let current = null;                // the equipped board
  let hold = { rush: false };        // held Rush states (so a stage-up or a restart can put them back)

  /** the stage the run is on (1 outside a run) */
  function stage() {
    const e = BR.Run && BR.Run.engine;
    const s = e && e.stage ? e.stage : parseInt(($('stageNum') || {}).textContent, 10);
    return clamp(s | 0 || 1, 1, 99);
  }

  /* ------------------------------------------------------------------ scaffolding (runs at the end of every apply())
     builds the layers for the equipped board, removes anything left from another one, and sets the run's windows and notch */
  function clearAll() {
    timers.forEach(clearTimeout); timers.clear();
    live.forEach((a) => { try { a.cancel(); } catch (e) { /* gone */ } }); live.clear();
    document.querySelectorAll('#bg .s4x, #boardWrap .s4x, #fxlayer .s4x').forEach((n) => n.remove());
    Object.keys(spr).forEach((k) => delete spr[k]);
    hold = { rush: false };
    const root = document.documentElement;
    root.classList.remove('s4-rush');
  }
  S.applyHooks.push((M, root) => {
    const board = which(root);
    clearAll();
    current = board;
    const bg = $('bg'), wrap = $('boardWrap');
    if (!board || !bg) return;
    if (board === 'alchemy') {
      ['flasklit', 'plume', 'sweep'].forEach((k) => { spr[k] = add(bg, k); });
      if (wrap) spr.drop = add(bg, 'drop', null, $('fxlayer'));
    } else if (board === 'observatory') {
      ['shutL', 'shutR', 'shoot'].forEach((k) => { spr[k] = add(bg, k, 'under'); });
      spr.scope = add(bg, 'scope');
      if (wrap) spr.notch = add(bg, 'notch', null, wrap);
      syncStage();
    } else if (board === 'isles') {
      spr.isl = add(bg, 'isl', 'under'); spr.falls = document.createElement('i'); spr.isl.appendChild(spr.falls);
      ['rainbow', 'rays', 'birds'].forEach((k) => { spr[k] = add(bg, k); });
    } else if (board === 'tower') {
      spr.moon = add(bg, 'moon', 'under');
      spr.bell = add(bg, 'bell');
      spr.win = [];
      for (let i = 0; i < 10; i++) { const w = add(bg, 'win'); w.style.bottom = i * 10 + '%'; spr.win.push(w); }
      spr.silver = add(bg, 'silver'); spr.owl = add(bg, 'owl');
      syncStage();
    }
  });

  /** the run's state in the scenery: the windows that are lit (Tower) and the notch the marker stands on (Observatory); reset with each run */
  function syncStage() {
    const st = stage();
    if (spr.win) spr.win.forEach((w, i) => { w.style.opacity = st > i ? '1' : '0'; });
    if (spr.notch) spr.notch.style.transform = `translateX(${notchX(st)}px)`;
  }
  function notchX(st) {
    const wrap = $('boardWrap'), w = wrap ? wrap.getBoundingClientRect().width : 369;
    const max = Math.max(1, Math.floor((w + 8 - 66) / 12));
    return Math.min(st - 1, max - 1) * 12;
  }
  /** where a layer sits on the screen, from its own rectangle */
  const rectOf = (el) => (el ? el.getBoundingClientRect() : null);

  /* ------------------------------------------------------------------ Alchemy Lab */
  const shapes = {
    alchemyLine(d, ctx) {
      const pl = spr.plume, sw = spr.sweep;
      play(pl, [
        { transform: 'scale(0.55, 0.15)', opacity: 0 },
        { transform: 'scale(1, 1)', opacity: 1, offset: 0.3 },
        { transform: 'scale(1.06, 1.2)', opacity: 1, offset: 0.62 },
        { transform: 'scale(1.1, 1.3)', opacity: 0 },
      ], { duration: 580, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' });
      play(sw, [
        { transform: 'translateX(-40%)', opacity: 0 },
        { transform: 'translateX(60%)', opacity: 0.95, offset: 0.35 },
        { transform: 'translateX(230%)', opacity: 0 },
      ], { duration: 580, easing: 'ease-in-out' });
      const r = rectOf(pl);
      if (r) for (let i = 0; i < 24; i++) ctx.fx.emit({ kind: 'spark', x: r.left + r.width * (0.3 + 0.4 * Math.random()), y: r.top + r.height * 0.75, vx: ctx.rnd(-60, 60), vy: ctx.rnd(-420, -170), g: 420, drag: 0.7, size: ctx.rnd(2.4, 5), max: ctx.rnd(0.4, 0.62), color: ['#c8ff6a', '#3dffa0', '#ffe27a'][i % 3] });
      noise({ dur: 0.45, vol: 0.07, from: 900, to: 2600, q: 0.8, type: 'bandpass', attack: 0.12 });
      tone({ f: 130, to: 74, dur: 0.3, vol: 0.12 });
    },
    alchemyRushStart() {
      const f = spr.flasklit; if (!f) return;
      hold.rush = true;
      play(f, [{ opacity: 0 }, { opacity: 1 }], { duration: 560, easing: 'ease-out' });
      f.style.opacity = '1';
      noise({ dur: 0.5, vol: 0.05, from: 500, to: 2400, q: 0.9, type: 'bandpass', attack: 0.2 });
    },
    alchemyRushEnd() {
      const f = spr.flasklit; if (!f || !hold.rush) return;
      hold.rush = false;
      f.style.opacity = '';
      play(f, [{ opacity: 1 }, { opacity: 0 }], { duration: 580, easing: 'ease-in' });
    },
    /** a drop of brew runs along the top pipe, down the copper edge of the screen and along the floor into the cauldron (a bright streak on the
        board's effect layer: it travels through the empty gutter, over no HUD) */
    alchemyStageUp(d, ctx) {
      const dr = spr.drop, pl = spr.plume, wrap = $('boardWrap'), fl = spr.flasklit;
      if (!dr || !pl || !wrap || !fl) return;
      const w = wrap.getBoundingClientRect(), r = pl.getBoundingClientRect(), th = fl.getBoundingClientRect().height;
      const X = (x) => x - w.left, Y = (y) => y - w.top;
      const gx = X(w.left - 6), pipeY = Y(th * 0.165 + 2), cx0 = X(window.innerWidth / 2 + 6);
      const bx = X(r.left + r.width / 2), by = Y(r.top + r.height * 0.75), ey = Y(r.top + r.height * 0.72), lip = bx - r.height * 0.3;
      const T = (x, y, a) => `translate(${(x - 13).toFixed(1)}px, ${(y - 53).toFixed(1)}px) rotate(${a}deg)`;
      play(dr, [
        { transform: T(cx0, pipeY, 90), opacity: 0 },
        { transform: T(cx0 - 14, pipeY, 90), opacity: 1, offset: 0.05 },
        { transform: T(gx, pipeY, 90), opacity: 1, offset: 0.3, easing: 'ease-in' },
        { transform: T(gx, pipeY + 12, 0), opacity: 1, offset: 0.36 },
        { transform: T(gx, ey - 6, 0), opacity: 1, offset: 0.7, easing: 'ease-in' },
        { transform: T(gx + 12, ey, -90), opacity: 1, offset: 0.75 },
        { transform: T(lip, ey, -90), opacity: 1, offset: 0.9, easing: 'ease-out' },
        { transform: T(bx, by, -20), opacity: 1, offset: 0.97 },
        { transform: T(bx, by + 4, 0), opacity: 0 },
      ], { duration: 880, easing: 'linear' });
      later(() => {
        const q = rectOf(pl); if (!q) return;
        const x = q.left + q.width / 2, y = q.top + q.height * 0.75;
        ctx.fx.ring(x, y, '#c8ff6a', 44, 0.4, 2);
        for (let i = 0; i < 7; i++) ctx.fx.emit({ kind: 'spark', x, y, vx: ctx.rnd(-90, 90), vy: ctx.rnd(-260, -90), g: 460, drag: 0.8, size: ctx.rnd(2, 3.6), max: 0.4, color: '#e8ffb0' });
        tone({ f: 880, to: 1320, dur: 0.14, vol: 0.09, attack: 0.002 }); tone({ f: 1320, dur: 0.2, vol: 0.05, at: 0.05 });
      }, 800);
    },
  };

  /* ------------------------------------------------------------------ Observatory */
  shapes.observatoryLine = function (d, ctx) {
    const sc = spr.scope, sh = spr.shoot;
    play(sc, [
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(-9deg)', offset: 0.32 },
      { transform: 'rotate(5deg)', offset: 0.68 },
      { transform: 'rotate(0deg)' },
    ], { duration: 580, easing: 'ease-in-out' });
    const r = rectOf(sh);
    const th = r ? r.width / 0.34 : 85;
    play(sh, [
      { transform: `translate(0, 0) rotate(66deg)`, opacity: 0 },
      { opacity: 1, offset: 0.2 },
      { transform: `translate(${(th * 0.3).toFixed(0)}px, ${(th * 0.74).toFixed(0)}px) rotate(66deg)`, opacity: 0 },
    ], { duration: 520, easing: 'cubic-bezier(0.3, 0.1, 0.6, 1)' });
    tone({ f: 660, to: 1760, dur: 0.3, vol: 0.05, attack: 0.02 });
  };
  shapes.observatoryRushStart = function () {
    const L = spr.shutL, R = spr.shutR; if (!L || !R) return;
    const h = L.getBoundingClientRect().height, d = Math.round(h * 0.34);
    hold.rush = d;
    play(L, [{ transform: 'translateX(0)' }, { transform: `translateX(${-d}px)` }], { duration: 800, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
    play(R, [{ transform: 'translateX(0)' }, { transform: `translateX(${d}px)` }], { duration: 800, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
    L.style.transform = `translateX(${-d}px)`; R.style.transform = `translateX(${d}px)`;
    spin(6);
    noise({ dur: 0.7, vol: 0.05, from: 180, to: 900, q: 0.9, type: 'bandpass', attack: 0.25 });
  };
  shapes.observatoryRushEnd = function () {
    const L = spr.shutL, R = spr.shutR; if (!L || !R || !hold.rush) return;
    const d = hold.rush; hold.rush = false;
    L.style.transform = ''; R.style.transform = '';
    play(L, [{ transform: `translateX(${-d}px)` }, { transform: 'translateX(0)' }], { duration: 800, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
    play(R, [{ transform: `translateX(${d}px)` }, { transform: 'translateX(0)' }], { duration: 800, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
    spin(1);
  };
  /** the orrery turns faster in Rush: a playback rate change keeps the planets where they are */
  function spin(rate) {
    const bg = $('bg'); if (!bg) return;
    document.getAnimations().forEach((a) => { if (a.effect && a.effect.target === bg && a.effect.pseudoElement === '::after' && a.updatePlaybackRate) a.updatePlaybackRate(rate); });
  }
  shapes.observatoryStageUp = function (d, ctx) {
    const mk = spr.notch; if (!mk) return;
    const st = stage(), from = notchX(st - 1), to = notchX(st);
    mk.style.transform = `translateX(${to}px)`;
    if (from !== to) play(mk, [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)`, offset: 0.7 }, { transform: `translateX(${to}px)` }], { duration: 700, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' });
    const r = rectOf(mk);
    if (r) { ctx.fx.sparks(r.left + r.width / 2, r.top + r.height * 0.7, '#ffe9a8', 8, 0.5, 0.45); }
    tone({ f: 1320, dur: 0.1, vol: 0.06, attack: 0.002 }); tone({ f: 1760, dur: 0.16, vol: 0.04, at: 0.06 });
  };

  /* ------------------------------------------------------------------ Floating Isles */
  shapes.islesLine = function (d, ctx) {
    play(spr.falls, [
      { transform: 'translateY(-30%)', opacity: 0 },
      { opacity: 1, offset: 0.22 },
      { transform: 'translateY(26%)', opacity: 0 },
    ], { duration: 580, easing: 'cubic-bezier(0.3, 0.1, 0.4, 1)' });
    const b = $('bg'), W = b ? b.getBoundingClientRect().width : window.innerWidth;
    play(spr.birds, [
      { transform: 'translate(0, 0)', opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { transform: `translate(${(W + 270).toFixed(0)}px, -14px)`, opacity: 1, offset: 0.88 },
      { transform: `translate(${(W + 290).toFixed(0)}px, -16px)`, opacity: 0 },
    ], { duration: 580, easing: 'linear' });
    noise({ dur: 0.5, vol: 0.06, from: 1800, to: 700, q: 0.7, type: 'bandpass', attack: 0.1 });
  };
  shapes.islesRushStart = function () {
    const isl = spr.isl, rb = spr.rainbow; if (!isl || !rb) return;
    hold.rush = true;
    isl.style.translate = '0 -12px';                                   // (a short CSS transition on the layer, see css/s4-scenes.css)
    play(rb, [{ opacity: 0 }, { opacity: 0.55 }], { duration: 760, easing: 'ease-out' });
    rb.style.opacity = '0.55';
  };
  shapes.islesRushEnd = function () {
    const isl = spr.isl, rb = spr.rainbow; if (!isl || !rb || !hold.rush) return;
    hold.rush = false;
    isl.style.translate = '';
    rb.style.opacity = '';
    play(rb, [{ opacity: 0.55 }, { opacity: 0 }], { duration: 700, easing: 'ease-in' });
  };
  shapes.islesStageUp = function (d, ctx) {
    const rays = spr.rays, wrap = $('boardWrap'), bg = $('bg'); if (!rays || !wrap || !bg) return;
    const w = wrap.getBoundingClientRect(), b = bg.getBoundingClientRect(), s = rays.getBoundingClientRect();
    rays.style.left = (w.left + w.width / 2 - b.left - s.width / 2).toFixed(0) + 'px';
    rays.style.top = (w.top + w.height / 2 - b.top - s.height / 2).toFixed(0) + 'px';
    play(rays, [
      { transform: 'rotate(0deg) scale(0.6)', opacity: 0 },
      { opacity: 1, offset: 0.3 },
      { transform: 'rotate(36deg) scale(1.1)', opacity: 0 },
    ], { duration: 880, easing: 'ease-out' });
    tone({ f: 523, dur: 0.5, vol: 0.05, attack: 0.05 }); tone({ f: 784, dur: 0.6, vol: 0.04, attack: 0.08, at: 0.1 });
  };

  /* ------------------------------------------------------------------ Moonwick Tower */
  const swing = (a1, a2, ms) => play(spr.bell, [
    { transform: 'rotate(0deg)' }, { transform: `rotate(${a1}deg)`, offset: 0.22 }, { transform: `rotate(${-a2}deg)`, offset: 0.5 },
    { transform: `rotate(${a2 * 0.4}deg)`, offset: 0.76 }, { transform: 'rotate(0deg)' },
  ], { duration: ms, easing: 'ease-in-out' });
  shapes.towerLine = function (d, ctx) {
    swing(14, 12, 580);
    bell(196, 0.14);
    // a moonbeam lances down onto the blasted line, drawn on the board's own effect layer (a narrow column of pale light, never a fill)
    const v = d && d.view, p = d && d.res && d.res.plan, layer = $('fxlayer');
    if (!v || !p || !layer || !v.layerPoint) return;
    const cell = v.cell, c0 = v.layerPoint(0, 0), col = p.lineV ? p.c : (p.c != null ? p.c : 3), row = p.lineH ? p.r : 7;
    const beam = document.createElement('i'); beam.className = 's4x beam';
    const top = c0.y - cell / 2, bottom = c0.y + row * cell + cell * 0.5;
    beam.style.cssText = `left:${(c0.x + col * cell - cell * 0.26).toFixed(1)}px;top:${top.toFixed(1)}px;width:${(cell * 0.52).toFixed(1)}px;height:${(bottom - top).toFixed(1)}px`;
    layer.appendChild(beam);
    const a = play(beam, [{ transform: 'scaleY(0)', opacity: 0.9 }, { transform: 'scaleY(1)', opacity: 0.9, offset: 0.3 }, { transform: 'scaleY(1)', opacity: 0 }], { duration: 560, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' });
    const gone = () => beam.remove();
    if (a) { a.addEventListener('finish', gone); a.addEventListener('cancel', gone); } else gone();
    later(gone, 700);
  };
  shapes.towerRushStart = function () {
    const m = spr.moon, sv = spr.silver; if (!m || !sv) return;
    hold.rush = true;
    play(m, [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-7%) scale(1.14)' }], { duration: 820, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)' });
    m.style.transform = 'translateY(-7%) scale(1.14)';
    play(sv, [{ opacity: 0 }, { opacity: 1 }], { duration: 820, easing: 'ease-out' });
    sv.style.opacity = '1';
    bell(147, 0.09);
  };
  shapes.towerRushEnd = function () {
    const m = spr.moon, sv = spr.silver; if (!m || !sv || !hold.rush) return;
    hold.rush = false;
    m.style.transform = ''; sv.style.opacity = '';
    play(m, [{ transform: 'translateY(-7%) scale(1.14)' }, { transform: 'translateY(0) scale(1)' }], { duration: 820, easing: 'ease-in-out' });
    play(sv, [{ opacity: 1 }, { opacity: 0 }], { duration: 820, easing: 'ease-in' });
  };
  shapes.towerStageUp = function (d, ctx) {
    const st = stage(), w = spr.win && spr.win[clamp(st - 1, 0, 9)];
    if (w) {
      const was = w.style.opacity === '1';
      w.style.opacity = '1';
      if (!was) play(w, [{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 1 }], { duration: 600, easing: 'ease-out' });
      const r = rectOf(w);
      if (r && !was) ctx.fx.sparks(r.left + 10, r.top + r.height / 2, '#ffe9a8', 8, 0.5, 0.5);
    }
    swing(9, 7, 880);
    bell(220, 0.1);
  };
  let lastOwl = 0;
  shapes.towerPop = function (d, ctx) {
    if (ctx.n < 12 || !spr.owl) return;
    const now = performance.now(); if (now - lastOwl < 4000) return;
    lastOwl = now;
    const b = $('bg'), W = b ? b.getBoundingClientRect().width : window.innerWidth;
    play(spr.owl, [
      { transform: 'translate(0, 6px)', opacity: 0 },
      { opacity: 1, offset: 0.14 },
      { transform: `translate(${(W + 100) * 0.5}px, -6px)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${(W + 100)}px, 4px)`, opacity: 1, offset: 0.88 },
      { transform: `translate(${(W + 110)}px, 4px)`, opacity: 0 },
    ], { duration: 580, easing: 'linear' });
  };

  /* ------------------------------------------------------------------ dispatch */
  S.handlers.push((type, d, ctx) => {
    if (!current || calm()) return;
    const M = ctx.M || {};
    if (type === 'line') {
      if (M.alchemy) shapes.alchemyLine(d, ctx);
      else if (M.observatory) shapes.observatoryLine(d, ctx);
      else if (M.isles) shapes.islesLine(d, ctx);
      else if (M.tower) shapes.towerLine(d, ctx);
    } else if (type === 'rushStart') {
      if (M.alchemy) shapes.alchemyRushStart(); else if (M.observatory) shapes.observatoryRushStart(); else if (M.isles) shapes.islesRushStart(); else if (M.tower) shapes.towerRushStart();
    } else if (type === 'rushEnd') {
      if (M.alchemy) shapes.alchemyRushEnd(); else if (M.observatory) shapes.observatoryRushEnd(); else if (M.isles) shapes.islesRushEnd(); else if (M.tower) shapes.towerRushEnd();
    } else if (type === 'stageUp') {
      if (M.alchemy) shapes.alchemyStageUp(d, ctx); else if (M.observatory) shapes.observatoryStageUp(d, ctx); else if (M.isles) shapes.islesStageUp(d, ctx); else if (M.tower) shapes.towerStageUp(d, ctx);
    } else if (type === 'pop') {
      if (M.tower) shapes.towerPop(d, ctx);
    }
  });
  // Reduce Motion skips BR.Skins.onEvent altogether, so the held Rush states are also cleared when a run starts (see clearAll) and
  // the lit windows and the notch follow the stage from the stage-up moment only (nothing is drawn in those modes)

  /* ------------------------------------------------------------------ badges: the scene itself, a different one for every board
     The art is css (css/s4-scenes.css, .s4b); a still badge (the reel) has no sparkle layer. */
  const SPARK = { library: 'd', glade: 'f', alchemy: 'b', observatory: 's', isles: 'c', tower: 'w' };
  const badge = (name) => (item, inst, still) => `<div class="s4b s4b-${name}"><i class="s4b-art"></i>${still ? '' : `<i class="s4b-fx ${SPARK[name]} a"></i><i class="s4b-fx ${SPARK[name]} b"></i>`}</div>`;
  const ids = { a_library: 'library', a_glade: 'glade', a_alchemy: 'alchemy', a_observatory: 'observatory', a_isles: 'isles', a_tower: 'tower' };
  const register = () => { if (BR.Badge && BR.Badge.custom) Object.keys(ids).forEach((id) => { BR.Badge.custom[id] = badge(ids[id]); }); };
  register();
  // js/badges.js loads after this file and creates BR.Badge, so the entries are added once the page has parsed
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', register); else register();
  BR.S4Scenes = { register, which };
})();
