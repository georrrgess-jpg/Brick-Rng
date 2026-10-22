/* Series 4 "Moonwick" fuses: the signature moments of Elixir, Sandglass, Runechain and Moonrise, and the badge of every fuse.
   The moments are registered through BR.Skins.handlers (events pop, demo, line, rushStart, rushEnd, stageUp; keys are the item's `moment`) and,
   for the Last Spark, through BR.Fuse.on('spark' | 'sparkEnd' | 'reset'), which js/fuse.js fires from the same calls js/run.js makes (the handler route also
   takes 'spark' and 'sparkEnd' if BR.Skins.onEvent forwards them: a repeated call inside 80ms is ignored).
   What a moment may do (spec 3.0): end within 600ms (Rush start and stage-up within 900ms), at most 40 particles and 3 sprites; transform and opacity
   only; nothing at all with Reduce Motion or on a low-end phone (the states in css/fuse.css still change). Every class a moment sets starts with `mx-` and
   BR.Fuse.reset() clears them, so a moment can never outlive its run. The Rush and Last Spark looks that last are CSS on data-z; the moments add the arrivals. */
(function () {
  const BR = (window.BR = window.BR || {});
  const S = BR.Skins;
  if (!S || !S.handlers || !BR.Fuse) return;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const F = () => BR.Fuse;
  const live = () => !!(F().ok && F().host && !BR.reducedMotion && !BR.lowEnd);
  const on = (key) => !!(S.moments && S.moments[key]);
  const audio = (name, a) => { try { if (BR.audio && BR.audio[name]) BR.audio[name](a); } catch (e) { /* sound is optional */ } };
  const cls = (c, v) => { const h = F().host; if (!h || (v && !live())) return; h.classList.toggle('mx-' + c, !!v); };   // a moment's class is only ever set where moments run
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const stamp = {};
  const once = (k) => { const t = performance.now(); if (stamp[k] && t - stamp[k] < 80) return false; stamp[k] = t; return true; };

  /* ---- sprites: a few small DOM elements on the fuse, animated with WAAPI (transform and opacity), gone when done. At most 3 at once. */
  let sprites = 0;
  function sprite(kind, ox, oy, frames, opt, style) {
    const f = F();
    if (!live() || sprites >= 3) return null;
    const el = document.createElement('i');
    el.className = 'mx-sprite mx-' + kind; el.setAttribute('aria-hidden', 'true');
    el.style.left = (f.bx + ox).toFixed(1) + 'px'; el.style.top = (f.by + oy).toFixed(1) + 'px';
    if (style) el.style.cssText += ';' + style;
    f.host.appendChild(el); sprites++;
    let gone = false;
    const done = () => { if (gone) return; gone = true; el.remove(); sprites--; };
    const a = el.animate(frames, Object.assign({ duration: 500, easing: 'ease-out', fill: 'forwards' }, opt));
    a.onfinish = done; a.oncancel = done;
    return el;
  }
  const ring = (color, ms, to, ox, oy) => sprite('ring', ox || 0, oy || 0, [{ transform: 'scale(0.5)', opacity: 0.95 }, { transform: `scale(${to})`, opacity: 0 }], { duration: ms, easing: 'cubic-bezier(0.2,0.7,0.3,1)' }, `--mxc:${color}`);
  const bomb = () => { const f = F(); return { bs: f.bs, u: f.bpx || f.bs / 64 }; };
  function clearAll() {
    timers.forEach(clearTimeout); timers.clear();
    const h = F().host;
    if (h) { h.querySelectorAll('.mx-sprite').forEach((n) => n.remove()); ['glow', 'pourback', 'wax'].forEach((c) => h.classList.remove('mx-' + c)); }   // (the classes a timer was going to remove)
    sprites = 0;
  }

  /* ------------------------------------------------------------------ Elixir: Fizz drinks the potion when Rush starts */
  const elixir = {
    rushStart() {
      if (!live()) return;
      const { bs, u } = bomb();
      F().bake(F().cls, ['nt']);                                                                           // (the uncorked flask is the body without its topper)
      cls('drank', true);                                                                                   // the liquid in the flask drops (css transition on transform)
      cls('glow', true); later(() => cls('glow', false), 900);
      sprite('cork', 0, -bs / 2 + 4 * u, [                                                                  // the cork pops off
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${(10 * u).toFixed(0)}px,${(-30 * u).toFixed(0)}px) rotate(300deg)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${(24 * u).toFixed(0)}px,${(-6 * u).toFixed(0)}px) rotate(640deg)`, opacity: 0 }], { duration: 560, easing: 'cubic-bezier(0.3,0.6,0.5,1)' });
      F().pop(F().pulse, 1.15, 440);
      F().burstAt('spark', 8, 0, -bs * 0.3, { speed: 120, g: 160, arc: [-2.6, -0.5], lift: 30 });
      F().burstAt('special', 6, 0, -bs * 0.2, { speed: 60, g: -20, arc: [-2.4, -0.7] });
      audio('whoosh');
    },
    rushEnd() {
      cls('drank', false);                                                                                  // the flask fills up again
      if (!live()) return;
      const { bs, u } = bomb();
      sprite('bub', 0, -bs / 2 + 6 * u, [{ transform: 'translate(0,0) scale(0.6)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translate(${(4 * u).toFixed(0)}px,${(-24 * u).toFixed(0)}px) scale(1.3)`, opacity: 0 }], { duration: 520 });   // a hiccup: one bubble
      F().pop(F().pulse, 1.08, 280);
    },
    stageUp() {
      if (!live()) return;
      const q = F().body.parentNode.querySelectorAll('.fx-lq');                                                // the tube refills with a glug: the liquid sloshes, a green sweep runs along the rope
      q.forEach((el) => el.animate([{ transform: 'translateY(40%)' }, { transform: 'translateY(28%)', offset: 0.35 }, { transform: 'translateY(46%)', offset: 0.7 }, { transform: 'translateY(40%)' }], { duration: 640, easing: 'ease-in-out' }));
      const g = F().gold; if (g) g.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.25 }, { opacity: 0 }], { duration: 700 });
      F().burstAt('special', 6, 0, -bomb().bs * 0.25, { speed: 70, g: -30, arc: [-2.6, -0.5] });
    },
    spark() { cls('boil', true); if (live()) F().burstAt('special', 5, 0, -bomb().bs * 0.3, { speed: 80, g: -40, arc: [-2.7, -0.4] }); },   // the flask boils
    sparkEnd() { cls('boil', false); },
  };

  /* ------------------------------------------------------------------ Sandglass: Fizz flips over in Rush and the sand stops */
  const sandglass = {
    rushStart() {
      cls('flip', true);                                                                                    // the body turns over with a bounce (css transition), the face stays upright
      if (!live()) return;
      F().burstAt('special', 10, 0, -4, { speed: 70, g: 420, arc: [-3.4, 0.25] });
      audio('thud', 0.8);
    },
    rushEnd() { cls('flip', false); if (live()) { F().pop(F().pulse, 1.06, 240); audio('thud', 0.6); } },    // flips back with a clack
    stageUp() {
      if (!live()) return;
      const a0 = F().host.classList.contains('mx-flip') ? 180 : 0;                                          // one full flip as the rope respools
      F().body.animate([{ transform: `rotate(${a0}deg)` }, { transform: `rotate(${a0 + 206}deg)`, offset: 0.6 }, { transform: `rotate(${a0 + 354}deg)`, offset: 0.82 }, { transform: `rotate(${a0 + 360}deg)` }], { duration: 760, easing: 'ease-in-out' });
      F().burstAt('special', 8, 0, 0, { speed: 80, g: 420, arc: [-3.3, 0.2] });
    },
    spark() { cls('slow', true); },                                                                          // the last grains fall in slow motion
    sparkEnd(d) { cls('slow', false); if (d && d.saved) { cls('pourback', true); later(() => cls('pourback', false), 900); } },   // relit: the sand pours back up the channel
  };

  /* ------------------------------------------------------------------ Runechain: the golem wakes in Rush, gains a rune each stage, sleeps in the Last Spark */
  const runechain = {
    rushStart() {
      cls('awake', true);                                                                                   // every rune blazes (css), a cyan aura
      if (!live()) return;
      ring('#7ae8ff', 640, 2.6);                                                                            // a shockwave leaves the bomb
      F().sweep(560);                                                                                       // a shimmer runs along the chain
      F().burstAt('special', 8, 0, 0, { speed: 130, g: 200 });
      F().pop(F().pulse, 1.12, 360);
      audio('crackle');
    },
    rushEnd() {
      cls('awake', false);
      if (!live()) return;
      F().setMood('yawn', 0.3, '', 0);                                                                       // the golem yawns and settles
      F().pop(F().pulse, 0.94, 520);
    },
    stageUp(d) {
      const n = Math.max(1, Math.min(8, (d && d.info && d.info.to) || 1)), h = F().host;
      h.dataset.rn = String(n);                                                                              // one more rune is carved per stage
      if (!live()) return;
      const r = F().body.querySelectorAll('.rn')[n - 1];
      if (r) r.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(2.2)', opacity: 1, offset: 0.3 }, { transform: 'scale(1)', opacity: 1 }], { duration: 600, easing: 'ease-out' });
      F().burstAt('special', 8, 0, 0, { speed: 110, g: 260 });
    },
    spark() { cls('sleep', true); },                                                                         // the eyes close
    sparkEnd(d) { cls('sleep', false); if (live() && d && d.saved) F().pop(F().pulse, 1.12, 260); },         // and snap open when it is relit
    reset(stage) { const h = F().host; if (h) h.dataset.rn = String(Math.max(1, Math.min(8, stage || 1))); },
  };

  /* ------------------------------------------------------------------ Moonrise: the phase shows the time left (css), the Last Spark is an eclipse */
  const moonrise = {
    rushStart() {
      if (!live()) return;
      ring('#e8f0ff', 820, 7.2);                                                                            // full-moon blaze: a silver ring spreads from the bomb across the HUD
      F().burstGlints(0, Math.min(1, F().d / F().fmax), 8);                                                  // stars twinkle along the rail
      F().burstAt('special', 8, 0, 0, { speed: 100, g: -10 });
      F().pop(F().pulse, 1.1, 340);
      audio('whoosh');
    },
    stageUp() {                                                                                              // the moon waxes from crescent to full in 0.6 s
      if (!live()) return;
      const ph = F().body.querySelectorAll('.fx-ph'); if (!ph.length) return;
      let c = 0;
      ph.forEach((el, i) => { if (+getComputedStyle(el).opacity > 0.5 && i < 3) c = i + 1; });
      if (!c) return;
      const h = F().host; h.classList.add('mx-wax'); later(() => h.classList.remove('mx-wax'), 760);
      const T = 600, step = T / (c + 0.5);
      for (let k = c; k >= 1; k--) {                                                                         // crescent (3), half (2), gibbous (1): each shows for one step
        const t0 = (c - k) * step, t1 = t0 + step * 1.1, fr = [{ opacity: k === c ? 1 : 0, offset: 0 }];
        if (t0 > 0) fr.push({ opacity: 0, offset: Math.max(0, (t0 - 1) / T) }, { opacity: 1, offset: t0 / T });
        fr.push({ opacity: 0, offset: Math.min(1, t1 / T) }, { opacity: 0, offset: 1 });
        ph[k - 1].animate(fr, { duration: T, easing: 'linear' });
      }
    },
    line() { if (live()) { F().sweep(460); F().burstGlints(0, Math.min(1, F().d / F().fmax), 6); } },       // a moonbeam runs from the moon along the rope to the flame
    spark() { cls('eclipse', true); if (live()) { ring('#ffcf7a', 520, 2.4); F().burstAt('spark', 8, 0, 0, { speed: 110, g: 0 }); } },   // the eclipse: the moon goes dark, the corona flares (css)
    sparkEnd(d) {
      cls('eclipse', false);
      if (!(live() && d && d.saved)) return;                                                                // relit: moonrise, the moon flares back to full with a shower of stardust
      const h = F().host.querySelector('.fx-halo');
      if (h) h.animate([{ transform: 'scale(1)', opacity: 0.5 }, { transform: 'scale(1.5)', opacity: 1, offset: 0.3 }, { transform: 'scale(1)', opacity: 0.5 }], { duration: 600, easing: 'ease-out' });
      F().burstAt('special', 12, 0, -6, { speed: 80, g: 90, arc: [-3.5, 0.35] });
    },
  };
  const MOMENTS = { elixir, sandglass, runechain, moonrise };

  /* ---- routes */
  S.handlers.push((type, d, ctx) => {
    const M = ctx.M || {};
    for (const k in MOMENTS) {
      if (!M[k]) continue;
      const fn = MOMENTS[k][type];
      if (!fn) continue;
      if ((type === 'spark' || type === 'sparkEnd') && !once(k + type)) continue;
      fn(d, ctx);
    }
  });
  BR.Fuse.on('spark', () => { for (const k in MOMENTS) if (on(k) && MOMENTS[k].spark && once(k + 'spark')) MOMENTS[k].spark(); });
  BR.Fuse.on('sparkEnd', (d) => { for (const k in MOMENTS) if (on(k) && MOMENTS[k].sparkEnd && once(k + 'sparkEnd')) MOMENTS[k].sparkEnd(d); });
  BR.Fuse.on('reset', () => {
    clearAll();
    if (on('runechain')) runechain.reset((BR.Run && BR.Run.engine && BR.Run.engine.stage) || 1);
  });
  S.applyHooks.push(() => clearAll());
  // a Rush that is already running when the page restores a saved run: the Rush look is CSS on data-z, nothing to catch up

  /* ------------------------------------------------------------------ badges: the mini fuse in a box of its own (css/badges.css .bdg-fuse). Every fuse gets one, so
     the stylesheet of its tokens is baked when its badge is first drawn (js/fuse.js bakes the rest in the quiet after the first paint). */
  const fuseBadge = (item, inst) => {
    const A = BR.FuseArt, cls2 = item.cls && A.TOKENS[item.cls] ? item.cls : 'fuse-classic';
    if (A.ensure) A.ensure(cls2, ['base', 'mini']);
    const shine = inst ? inst.shine : 'plain';
    return `<div class="bdg-fuse" data-fk="${A.TOKENS[cls2].bomb.kind}" style="--g:${item.glow || '#ffb347'}"><span class="fz-glow"></span><div class="mini-fuse ${item.cls || ''}" data-shine="${shine}"><span class="mf-bomb"></span><span class="mf-track"><i class="mf-fill"></i><b class="mf-spark"></b></span></div></div>`;
  };
  const registerBadges = () => {
    if (!BR.Badge || !BR.Badge.custom || !BR.ITEMS) return;
    BR.ITEMS.filter((i) => i.type === 'fuse').concat([BR.DEFAULTS.fuse]).forEach((it) => { BR.Badge.custom[it.id] = fuseBadge; });
  };
  // js/badges.js (loaded after this file) creates BR.Badge: register the badges once the page has loaded
  if (BR.Badge) registerBadges(); else window.addEventListener('DOMContentLoaded', registerBadges);
})();
