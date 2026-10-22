/* Series 3 board and fuse moments: auroraSky (board), rod and hatch (fuse). Registered through BR.Skins.handlers / applyHooks.
   Everything here only toggles classes and animates a few elements on transform and opacity; the art lives in css/s3-scenes.css. */
(function () {
  const BR = (window.BR = window.BR || {});
  const S = BR.Skins;
  if (!S || !S.handlers || !S.applyHooks) return;
  const $ = (id) => document.getElementById(id);
  const audio = (name) => { try { if (BR.audio && BR.audio[name]) BR.audio[name](); } catch (e) { /* sound is optional */ } };
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

  /* ------------------------------------------------------------------ scaffolding (runs on every apply())
     - the Aurora's ripple band inside the background
     - any leftover moment state from a previous run is cleared
     (the fuses' own particles, sprinkles, leaves and feathers, are drawn by js/fuse.js on the fuse's canvas) */
  function clearMoments() {
    timers.forEach(clearTimeout); timers.clear();
    const fuse = $('fuse'), app = $('app');
    if (fuse) fuse.classList.remove('sc-hatching');
    if (app) app.classList.remove('sc-hot');
    document.querySelectorAll('.sc-hatch').forEach((n) => n.remove());
  }
  S.applyHooks.push((M, root) => {
    clearMoments();
    const bg = $('bg');
    if (bg) {
      const have = bg.querySelector('.sc-surge');
      if (root.classList.contains('board-aurora')) { if (!have) bg.appendChild(Object.assign(document.createElement('i'), { className: 'sc-surge' })); }
      else if (have) have.remove();
    }
  });

  /* ------------------------------------------------------------------ auroraSky: a Line Blast ripples the aurora brighter across the sky (700ms) */
  function auroraSky(ctx) {
    const app = $('app'), bg = $('bg'), fx = ctx.fx, rnd = ctx.rnd;
    if (!app) return;
    app.classList.add('sc-hot');
    if (auroraSky.t) clearTimeout(auroraSky.t);
    auroraSky.t = setTimeout(() => app.classList.remove('sc-hot'), 700);
    if (BR.lowEnd) return;
    const band = bg && bg.querySelector('.sc-surge');
    if (band && band.animate) band.animate([
      { transform: 'translate3d(-45%, 0, 0)', opacity: 0 },
      { opacity: 1, offset: 0.22 },
      { opacity: 0.9, offset: 0.62 },
      { transform: 'translate3d(185%, 0, 0)', opacity: 0 },
    ], { duration: 700, easing: 'cubic-bezier(0.3, 0.1, 0.4, 1)' });
    // a ripple of light motes sweeping along the top of the screen, left to right
    const W = window.innerWidth, cols = ['#7affd9', '#a8ffe8', '#ff9ae6', '#9ab8ff'];
    for (let i = 0; i < 12; i++) later(() => fx.emit({ kind: 'spark', x: (W * (i + 0.5)) / 12, y: rnd(24, 150), vx: rnd(40, 110), vy: rnd(-18, 18), g: 0, drag: 1.2, size: rnd(2.2, 4.4), max: rnd(0.45, 0.8), color: cols[i % 4] }), i * 46);
    audio('whoosh');
  }

  /* ------------------------------------------------------------------ rod: arcs crackle along the fuse for the length of a Rush
     (the small arcs that run along the rope are particles on the fuse's own canvas, js/fuse.js; these are the big bolts on the effects canvas) */
  function rodStart(d, ctx) {
    if (BR.lowEnd) return;
    audio('crackle');
    const tr = $('fuseTrack'), bomb = $('bomb');
    if (!tr || !bomb) return;
    const r = tr.getBoundingClientRect(), b = bomb.getBoundingClientRect(), y = r.top + r.height / 2;
    for (let i = 0; i < 3; i++) later(() => ctx.fx.bolt(b.left + b.width * 0.7 + i * 14, y + ctx.rnd(-6, 6), r.left + r.width * ((i + 1) / 3.2), y + ctx.rnd(-9, 9), '#9fd8ff'), i * 90);
  }
  function rodPop(d, ctx) {
    const run = d.run && d.run.el;
    if (!run || !run.classList.contains('rushing') || BR.lowEnd) return;
    const f = $('fuseFill'), tr = $('fuseTrack');
    if (!f || !tr) return;
    const fr = f.getBoundingClientRect(), r = tr.getBoundingClientRect(), y = r.top + r.height / 2;
    const x0 = fr.left + ctx.rnd(0, Math.max(8, fr.width - 46));
    ctx.fx.bolt(x0, y + ctx.rnd(-7, 7), x0 + ctx.rnd(24, 48), y + ctx.rnd(-9, 9), '#9fd8ff');
  }

  /* ------------------------------------------------------------------ hatch: at a Rush start the egg bomb cracks, a little phoenix hatches
     and flies off. The bomb is hidden while the overlay (two egg halves, a bird with flapping wings) plays for ~1.9s. */
  function hatch(d, ctx) {
    const fuse = $('fuse'), bomb = $('bomb'), app = $('app');
    if (!fuse || !bomb || !app) return;
    audio('crackle');
    const r = bomb.getBoundingClientRect(), a = app.getBoundingClientRect(), k = (r.width || 62) / 62, fx = ctx.fx;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;       // page coordinates, for the canvas effects
    const hx = cx - a.left, hy = cy - a.top;                          // the overlay lives inside #app, which shakes at a Rush start
    if (BR.lowEnd) { fx.sparks(cx, cy, '#ffd24a', 14, 1.2, 0.5); return; }
    document.querySelectorAll('.sc-hatch').forEach((n) => n.remove());
    const host = document.createElement('div');
    host.className = 'sc-hatch';
    host.style.setProperty('--fz-egg', BR.FuseArt.bodyURI('phoenix', {}, null));          // the egg halves are the bomb's own body
    host.style.cssText += `;left:${hx.toFixed(1)}px;top:${hy.toFixed(1)}px;transform:scale(${k.toFixed(3)});--sc-fx:${((window.innerWidth - hx + 90) / k).toFixed(0)}px;--sc-fy:${((-hy - 100) / k).toFixed(0)}px`;
    host.innerHTML = '<div class="sc-egg"><i class="sc-half b"></i><i class="sc-half t"></i><i class="sc-crack"></i></div><i class="sc-flash"></i><div class="sc-bird"><i class="pw l"></i><i class="pw r"></i><i class="pb"></i></div>';
    app.appendChild(host);
    fuse.classList.add('sc-hatching');
    const bird = host.querySelector('.sc-bird');
    later(() => { fx.sparks(cx, cy, '#ffd24a', 26, 1.6, 0.7); fx.sparks(cx, cy, '#ff8a2a', 16, 1.1, 0.8); fx.ring(cx, cy, '#ffb02e', 86 * k, 0.5, 4); audio('boom'); }, 430);
    // sparks trail the bird as it flies off
    [1180, 1290, 1400, 1510].forEach((t) => later(() => {
      const b = bird.getBoundingClientRect();
      fx.sparks(b.left + b.width / 2, b.top + b.height / 2, '#ffcf3f', 5, 0.7, 0.5);
    }, t));
    later(() => audio('whoosh'), 1150);
    later(() => fuse.classList.remove('sc-hatching'), 1750);
    later(() => host.remove(), 2050);
  }

  /* ------------------------------------------------------------------ dispatch */
  S.handlers.push((type, d, ctx) => {
    const M = ctx.M;
    if (type === 'line') { if (M.auroraSky) auroraSky(ctx); }
    else if (type === 'pop') { if (M.rod) rodPop(d, ctx); }
    else if (type === 'rushStart') { if (M.rod) rodStart(d, ctx); if (M.hatch) hatch(d, ctx); }
  });
})();
