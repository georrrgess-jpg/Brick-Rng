/* Series 3 skin moments: lantern frost gears slime galaxy phoenix. Registered through BR.Skins.handlers / applyHooks.
   Every moment is short (a pop's own effect is over inside 600ms), draws only on the effects layer (fx particles) or on
   one throw-away DOM sprite moved with transform and opacity, never takes a tap, and does nothing in reduced motion. */
(function () {
  const BR = (window.BR = window.BR || {});
  const Skins = BR.Skins;
  if (!Skins || !Skins.handlers) return;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /** Scale a particle count down on low-end phones (fx.sparks and fx.shards already do this themselves). */
  const cnt = (k) => Math.max(1, Math.round(k * (BR.lowEnd ? 0.5 : 1)));
  const hasAudio = (name) => !!(BR.audio && typeof BR.audio[name] === 'function');
  const sound = (name, ...a) => { if (hasAudio(name)) { try { BR.audio[name](...a); } catch (e) { /* sound is optional */ } } };

  /* A moment runs for the equipped Skin's key; the item-reveal demo passes the previewed item instead. */
  const active = (key, type, d, ctx) => (type === 'demo' ? !!(d && d.item && d.item.moment === key) : !!ctx.M[key]);
  const centroid = (cells) => {
    let x = 0, y = 0;
    cells.forEach((c) => { x += c.x; y += c.y; });
    return { x: x / cells.length, y: y / cells.length };
  };
  /** The board's rectangle in page coordinates: the real board in a run, the cells' bounding box in a reveal demo. */
  const boardRect = (d, ctx) => {
    if (ctx.view && ctx.view.boardEl) return ctx.view.boardEl.getBoundingClientRect();
    const cs = ctx.cells || [];
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9;
    cs.forEach((c) => { l = Math.min(l, c.x); t = Math.min(t, c.y); r = Math.max(r, c.x); b = Math.max(b, c.y); });
    if (!cs.length) return { left: 0, top: 0, right: innerWidth, bottom: innerHeight, width: innerWidth, height: innerHeight };
    const w = Math.max(120, r - l), h = Math.max(120, b - t);
    return { left: l - w * 0.4, top: t - h * 0.4, right: r + w * 0.4, bottom: b + h * 0.4, width: w * 1.8, height: h * 1.8 };
  };
  /** The element that wears the Skin: the board's field in a run, the preview's brick group in a reveal. */
  const skinHost = (d, type) => {
    if (type !== 'demo') return document.getElementById('field');
    let el = d.cells && d.cells[0];
    while (el && !(el.classList && Array.from(el.classList).some((c) => /^skin-/.test(c)))) el = el.parentElement;
    return el;
  };


  /* ------------------------------------------------------------------ per-color art for Phoenix and Galaxy
     Both skins draw a picture that has to carry each brick's own color. CSS cannot recolor an SVG background, and a
     mask-image would cost a render surface per brick, so one small SVG per palette color is built here from BR.PALETTE
     and injected as a stylesheet (css/s3-skins.css holds a plain gold phoenix and a plain spiral as the fallback). */
  const mixHex = (a, b, t) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const x = p(a), y = p(b);
    return '#' + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
  };
  const f2 = (n) => +n.toFixed(2);
  const svgUri = (svg) => 'url("data:image/svg+xml,' + svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23') + '")';
  const PHX_HALF = 'M56 50C60 40 70 28 80 16C84 11 88 7 94 3C93 10 92 15 90 20C93 18 96 18 99 18C97 24 95 29 92 33C95 33 97 34 99 36C96 41 92 45 87 48C89 49 90 51 91 53C84 57 74 58 66 56C62 55 58 54 56 52Z';
  const PHX_BODY = 'M50 15C54 15 57 19 57 24C57 28 55 31 54 33C58 38 60 46 58 54C57 60 55 64 53 68L50 72L47 68C45 64 43 60 42 54C40 46 42 38 46 33C45 31 43 28 43 24C43 19 46 15 50 15Z';
  const PHX_TAIL = 'M50 62C58 72 64 88 62 108C58 100 54 98 50 102C46 98 42 100 38 108C36 88 42 72 50 62Z';
  const PHX_CREST = 'M44 18C41 12 42 6 45 1C45 7 47 10 50 11C53 10 55 7 55 1C58 6 59 12 56 18Z';
  const PHX_SHAPE = `<path d='${PHX_HALF}'/><path d='${PHX_HALF}' transform='translate(100 0) scale(-1 1)'/><path d='${PHX_TAIL}'/><path d='${PHX_BODY}'/><path d='${PHX_CREST}'/>`;
  const PHX_LINES = 'M62 49L90 21M62 52L92 34M62 55L87 48M64 57L80 56';
  /** A phoenix with a dark outline whose feathers run from a light tint of the color down to a hot glow. */
  function phoenixSvg(p) {
    const stops = [[0, mixHex(p.hi, '#fff6c4', 0.4)], [0.32, mixHex(p.hi, '#ffe27a', 0.82)], [0.7, p.glow], [1, mixHex(p.lo, '#ff4a1a', 0.8)]];
    const grad = stops.map(([o, c]) => `<stop offset='${o}' stop-color='${c}'/>`).join('');
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-6 -5 112 118'><defs><linearGradient id='p' x1='0' y1='0' x2='0' y2='1'>${grad}</linearGradient><clipPath id='k'>${PHX_SHAPE}</clipPath></defs>`
      + `<g fill='url(#p)' stroke='#4a0a06' stroke-width='5' stroke-linejoin='round' paint-order='stroke'>${PHX_SHAPE}</g>`
      + `<g clip-path='url(#k)' fill='none' stroke='#5a0e06' stroke-opacity='.5' stroke-width='2.4' stroke-linecap='round'><path d='${PHX_LINES}'/><path d='${PHX_LINES}' transform='translate(100 0) scale(-1 1)'/><path d='M50 36V66M50 74V96' stroke-width='2'/><path d='M45 80L40 100M55 80L60 100' stroke-width='1.8'/></g><circle cx='50' cy='25' r='2.3' fill='#4a0a06'/></svg>`;
  }
  /** A spiral galaxy: two soft arms from a bright core, in the brick's color. */
  function galaxySvg(p) {
    let arms = '';
    for (let k = 0; k < 2; k++) {
      let d = '';
      for (let i = 0; i <= 40; i++) { const t = i / 40, r = 5 + 36 * t, a = k * Math.PI + t * 4.6; d += (i ? 'L' : 'M') + f2(50 + Math.cos(a) * r) + ' ' + f2(50 + Math.sin(a) * r); }
      arms += `<path d='${d}' fill='none' stroke='url(#a)' stroke-width='11' stroke-linecap='round' stroke-opacity='.92'/>`;
    }
    const core = mixHex(p.hi, '#ffffff', 0.5);
    return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><filter id='b' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='3.2'/></filter>`
      + `<radialGradient id='a' cx='50' cy='50' r='44' gradientUnits='userSpaceOnUse'><stop offset='0' stop-color='${core}'/><stop offset='.45' stop-color='${p.hi}'/><stop offset='1' stop-color='${p.glow}'/></radialGradient>`
      + `<radialGradient id='c'><stop offset='0' stop-color='#fff'/><stop offset='.4' stop-color='${core}'/><stop offset='1' stop-color='${p.hi}' stop-opacity='0'/></radialGradient></defs><g filter='url(#b)'>${arms}<circle cx='50' cy='50' r='17' fill='url(#c)'/></g></svg>`;
  }
  function bakeArt() {
    const pal = BR.PALETTE;
    if (!pal || !document.head || document.getElementById('s3-skin-art')) return;
    if (!pal.every((p) => /^#[0-9a-f]{6}$/i.test(p.hi) && /^#[0-9a-f]{6}$/i.test(p.lo) && /^#[0-9a-f]{6}$/i.test(p.glow))) return;   // the CSS fallbacks stay
    const el = document.createElement('style');
    el.id = 's3-skin-art';
    el.textContent = pal.map((p, i) => `.skin-phoenix [data-c="${i}"] .deco{background-image:${svgUri(phoenixSvg(p))}}.skin-galaxy [data-c="${i}"] .deco{background-image:${svgUri(galaxySvg(p))}}`).join('\n');
    document.head.appendChild(el);
  }
  bakeArt();

  /* ------------------------------------------------------------------ DOM sprites (transform + opacity only) */
  let layer = null, live = 0;
  const spriteLayer = () => {
    if (!layer || !layer.isConnected) {
      layer = document.createElement('div');
      layer.id = 's3fx';
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
    }
    return layer;
  };
  /** A sprite of `size` px centred on (x, y) that plays `frames` (transform/opacity keyframes) and then removes itself. */
  function sprite(cls, x, y, size, frames, opts) {
    if (live > 26) return null;
    const el = document.createElement('i');
    el.className = 's3-bit ' + cls;
    el.style.width = el.style.height = size + 'px';
    el.style.left = x - size / 2 + 'px';
    el.style.top = y - size / 2 + 'px';
    if (!el.animate) return null;
    spriteLayer().appendChild(el);
    live++;
    const a = el.animate(frames, Object.assign({ fill: 'forwards' }, opts));
    let fin = false;
    const done = () => { if (fin) return; fin = true; el.remove(); live--; };
    a.onfinish = done;
    a.oncancel = done;
    setTimeout(done, (opts.duration || 600) + (opts.delay || 0) + 250);
    return el;
  }
  const tr = (x, y, s, r) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s}) rotate(${r || 0}deg)`;
  /** A soft puff that grows and fades: frost mist, lantern glow. */
  const puff = (cls, x, y, size, dur) => sprite(cls, x, y, size, [{ transform: 'scale(0.35)', opacity: 0.9 }, { transform: 'scale(1.1)', opacity: 0.55, offset: 0.4 }, { transform: 'scale(1.35)', opacity: 0 }], { duration: dur, easing: 'ease-out' });

  /* ------------------------------------------------------------------ Lantern: a few glowing embers float up */
  function lantern(type, d, ctx) {
    const { fx, cells, n } = ctx;
    if (!cells || !cells.length || n < 3) return;
    const warm = ['#ffd36b', '#ffb347', '#fff2b8', '#ff9a3d'];
    const c0 = centroid(cells);
    const k = Math.min(cells.length, 4 + Math.floor(n / 3));
    for (let i = 0; i < k; i++) {
      const q = cells[i % cells.length];
      for (let j = 0; j < cnt(2); j++) fx.emit({ kind: 'spark', x: q.x + rnd(-10, 10), y: q.y + rnd(-6, 8), vx: rnd(-26, 26), vy: rnd(-190, -95), g: -60, drag: 0.9, size: rnd(3.4, 6), max: rnd(0.6, 0.95), color: pick(warm) });
    }
    if (n >= 6) {
      puff('s3-glow', c0.x, c0.y, 70 + n * 3, 440);
      for (let i = 0; i < cnt(3); i++) fx.emit({ kind: 'spark', x: c0.x + rnd(-24, 24), y: c0.y + rnd(-10, 14), vx: rnd(-18, 18), vy: rnd(-120, -70), g: -30, drag: 0.6, size: rnd(6, 8.5), max: rnd(0.8, 1), color: '#ffb347' });
    }
    if (n >= 8) fx.ring(c0.x, c0.y, '#ffd36b', 56 + n * 2, 0.4, 3);
  }

  /* ------------------------------------------------------------------ Ice Cube: pops shatter into frost */
  function frost(type, d, ctx) {
    const { fx, cells, n, col } = ctx;
    if (!cells || !cells.length) return;
    const c0 = centroid(cells), tint = col(0);
    cells.forEach((q, i) => {
      fx.shards(q.x, q.y, i % 2 ? '#e8f9ff' : tint.hi, cnt(4), 0.9, { shape: 'tri', size: 3.5, spread: 6, life: 0.5, g: 1100 });
      if (i % 3 === 0) fx.sparks(q.x, q.y, '#ffffff', 3, 0.9, 0.35);
    });
    fx.ring(c0.x, c0.y, '#bfeaff', 38 + Math.min(n, 12) * 3, 0.38, 3);
    if (n >= 3) puff('s3-mist', c0.x, c0.y, 70 + Math.min(n, 12) * 7, 460);
  }

  /* ------------------------------------------------------------------ Clockwork: big pops spin every gear */
  const spinning = new WeakMap();
  function spinGears(host) {
    if (!host) return;
    clearTimeout(spinning.get(host));
    host.classList.remove('gears-spin');
    void host.offsetWidth;
    host.classList.add('gears-spin');
    spinning.set(host, setTimeout(() => host.classList.remove('gears-spin'), 600));
  }
  function gears(type, d, ctx) {
    const { fx, cells, n } = ctx;
    if (!cells || !cells.length || n < 4) return;
    const c0 = centroid(cells);
    const k = Math.min(n >= 8 ? 5 : 3, cnt(5));
    for (let i = 0; i < k; i++) {
      const q = cells[i % cells.length], size = rnd(20, 32), a = rnd(-Math.PI, 0), dist = rnd(60, 130), spin = (Math.random() < 0.5 ? -1 : 1) * rnd(240, 480);
      const dx = Math.cos(a) * dist, dy = Math.sin(a) * dist;
      sprite('s3-gear', q.x, q.y, size, [
        { transform: tr(0, 0, 0.5, 0), opacity: 1 },
        { transform: tr(dx * 0.7, dy * 0.8 - 14, 1, spin * 0.6), opacity: 1, offset: 0.4 },
        { transform: tr(dx * 0.9, dy * 0.8 + 20, 1, spin * 0.85), opacity: 1, offset: 0.75 },
        { transform: tr(dx, dy + 70, 0.9, spin), opacity: 0 }], { duration: rnd(480, 580), easing: 'cubic-bezier(0.25, 0.7, 0.4, 1)' });
    }
    cells.forEach((q, i) => { if (i < 5) fx.shards(q.x, q.y, i % 2 ? '#e8b84a' : '#fff0b0', cnt(2), 0.8, { size: 2.5, spread: 3.5, life: 0.35, g: 1000 }); });
    if (n >= 8) {
      spinGears(skinHost(d, type));
      fx.ring(c0.x, c0.y, '#e8b84a', 70 + n * 2, 0.42, 4);
    }
  }

  /* ------------------------------------------------------------------ Slime: goo droplets, a squish, and eyes that follow your finger */
  function slimeGoo(type, d, ctx) {
    const { fx, cells, n, col } = ctx;
    if (!cells || !cells.length) return;
    cells.forEach((q, i) => {
      const p = col(i);
      for (let j = 0; j < cnt(3); j++) {
        const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), sp = rnd(140, 380);
        const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
        fx.emit({ shape: 'petal', x: q.x, y: q.y, vx, vy, rot: Math.atan2(vy, vx), vr: rnd(-3, 3), sway: rnd(0, 6.28), size: rnd(4.5, 8), max: rnd(0.4, 0.7), g: 900, drag: 0.6, color: j % 2 ? p.hi : p.glow });
      }
    });
    if (n >= 4) {
      const host = skinHost(d, type);
      if (host && host.animate && !BR.lowEnd) {
        const k = Math.min(1, n / 10);
        host.animate([
          { transform: 'scale(1, 1)' },
          { transform: `scale(${1 + 0.024 * k}, ${1 - 0.03 * k})`, offset: 0.3 },
          { transform: `scale(${1 - 0.01 * k}, ${1 + 0.012 * k})`, offset: 0.62 },
          { transform: 'scale(1, 1)' }], { duration: 380, easing: 'ease-out' });
      }
    }
  }

  /* the eyes: a light pointer tracker that writes two numbers (-1..1) on the board while Slime is equipped */
  const eyes = { on: false, raf: 0, x: 0, y: 0, ex: 0, ey: 0, idle: 0, board: null };
  const eyesSet = (b, ex, ey) => {
    eyes.ex = ex; eyes.ey = ey;
    b.style.setProperty('--ex', ex.toFixed(2));
    b.style.setProperty('--ey', ey.toFixed(2));
  };
  function eyesFlush() {
    eyes.raf = 0;
    const b = eyes.board || (eyes.board = document.getElementById('board'));
    if (!b || BR.reducedMotion) return;
    const r = b.getBoundingClientRect();
    if (!r.width) return;
    const ex = Math.round(clamp(((eyes.x - r.left) / r.width - 0.5) * 2.3, -1, 1) * 20) / 20;
    const ey = Math.round(clamp(((eyes.y - r.top) / r.height - 0.5) * 2.3, -1, 1) * 20) / 20;
    if (ex !== eyes.ex || ey !== eyes.ey) eyesSet(b, ex, ey);
    clearTimeout(eyes.idle);
    eyes.idle = setTimeout(() => { if (eyes.board) eyesSet(eyes.board, 0, 0); }, 1800);
  }
  function eyesMove(e) {
    if (BR.Router && BR.Router.current && BR.Router.current !== 'run') return;   // only the run screen has eyes to move
    eyes.x = e.clientX; eyes.y = e.clientY;
    if (!eyes.raf) eyes.raf = requestAnimationFrame(eyesFlush);
  }
  function eyesTrack(on) {
    if (on === eyes.on) return;
    eyes.on = on;
    const opt = { passive: true, capture: true };
    if (on) {
      eyes.board = document.getElementById('board');
      document.addEventListener('pointermove', eyesMove, opt);
      document.addEventListener('pointerdown', eyesMove, opt);
    } else {
      document.removeEventListener('pointermove', eyesMove, opt);
      document.removeEventListener('pointerdown', eyesMove, opt);
      cancelAnimationFrame(eyes.raf); eyes.raf = 0; clearTimeout(eyes.idle);
      if (eyes.board) { eyes.board.style.removeProperty('--ex'); eyes.board.style.removeProperty('--ey'); }
      eyes.board = null; eyes.ex = eyes.ey = 0;
    }
  }

  /* ------------------------------------------------------------------ Galaxy: a spiral of stars, and Rush lights the board */
  function galaxyPop(type, d, ctx) {
    const { fx, cells, n, col } = ctx;
    if (!cells || !cells.length || n < 3) return;
    const c0 = centroid(cells), p = col(0);
    const arms = n >= 8 ? 3 : 2, per = Math.min(7, 3 + Math.floor(n / 3));
    for (let arm = 0; arm < arms; arm++) {
      for (let i = 0; i < per; i++) {
        const a = (arm / arms) * Math.PI * 2 + i * 0.62, sp = 70 + i * 52;
        const big = i % 3 === 0;
        fx.emit({ shape: 'star', x: c0.x, y: c0.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, drag: 1.7, size: big ? rnd(7, 10) : rnd(4, 6), max: 0.5 + i * 0.045, rot: rnd(0, 6), vr: rnd(-5, 5), color: big ? '#ffffff' : (i % 2 ? p.hi : '#cfe2ff') });
      }
    }
    cells.forEach((q, i) => { if (i < 5) fx.sparks(q.x, q.y, i % 2 ? p.glow : '#b07aff', 2, 0.8, 0.4); });
    if (n >= 8) fx.ring(c0.x, c0.y, '#b07aff', 80 + n * 2, 0.45, 3);
  }
  function galaxyRush(d, ctx, on) {
    const run = d.run && d.run.el;
    if (!run) return;
    run.classList.toggle('galaxy-rush', on);
    if (!on) return;
    const b = d.view && d.view.boardEl ? d.view.boardEl.getBoundingClientRect() : null;
    if (!b) return;
    for (let i = 0; i < cnt(18); i++) ctx.fx.emit({ shape: 'star', x: b.left + rnd(0.05, 0.95) * b.width, y: b.top + rnd(0.05, 0.95) * b.height, vx: rnd(-14, 14), vy: rnd(-24, 4), g: 0, drag: 1, size: rnd(4, 9), max: rnd(0.4, 0.62), rot: rnd(0, 6), vr: rnd(-3, 3), color: pick(['#ffffff', '#cfe2ff', '#ffc4f0', '#9ff0ff']) });
  }

  /* ------------------------------------------------------------------ Phoenix: big pops send a phoenix flying across the board */
  const FLAME = ['#fff2a8', '#ffd23d', '#ff9a1e', '#ff5a1e'];
  const FEATHER = ['#ffd23d', '#ff8a1e', '#ff4d2e', '#fff2a8'];
  const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function phoenix(type, d, ctx) {
    const { fx, cells, n } = ctx;
    if (!cells || !cells.length || n < 4) return;
    if (n < 8) {
      cells.forEach((q, i) => { if (i % 2 === 0) fx.emit({ kind: 'spark', x: q.x, y: q.y, vx: rnd(-50, 50), vy: rnd(-170, -70), g: -30, drag: 1, size: rnd(2.6, 4.4), max: rnd(0.45, 0.75), color: pick(FLAME) }); });
      return;
    }
    const b = boardRect(d, ctx), c0 = centroid(cells);
    const dir = c0.x > b.left + b.width / 2 ? -1 : 1;                 // fly toward the far side
    const p0 = { x: dir > 0 ? b.left - 24 : b.right + 24, y: b.bottom - b.height * rnd(0.12, 0.3) };
    const p1 = { x: dir > 0 ? b.right + 24 : b.left - 24, y: b.top + b.height * rnd(0.04, 0.2) };
    const pc = { x: (p0.x + p1.x) / 2, y: Math.min(p0.y, p1.y) - b.height * 0.34 };
    const at = (t) => ({ x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * pc.x + t * t * p1.x, y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * pc.y + t * t * p1.y });
    const DUR = 540, size = clamp(b.width * 0.26, 56, 120);
    const frames = [];
    for (let i = 0; i <= 8; i++) {
      const o = i / 8, p = at(easeIO(o)), q = at(easeIO(Math.min(1, o + 0.04))), th = Math.atan2(q.x - p.x, -(q.y - p.y)) * 57.3;
      frames.push({ offset: o, opacity: o < 0.1 ? o * 10 : o > 0.9 ? (1 - o) * 10 : 1, transform: `translate(${(p.x - size / 2).toFixed(1)}px, ${(p.y - size / 2).toFixed(1)}px) rotate(${th.toFixed(1)}deg) scale(${(0.75 + 0.4 * Math.sin(o * Math.PI)).toFixed(2)})` });
    }
    sprite('s3-phx', size / 2, size / 2, size, frames, { duration: DUR, easing: 'linear' });
    // the trail: flame and feathers left along the flight path
    const steps = 9;
    for (let s = 1; s <= steps; s++) {
      setTimeout(() => {
        if (BR.reducedMotion) return;
        const t = easeIO(s / steps), p = at(t);
        for (let j = 0; j < cnt(7); j++) fx.emit({ kind: 'spark', x: p.x + rnd(-14, 14), y: p.y + rnd(-10, 16), vx: rnd(-60, 60) - dir * 60, vy: rnd(-70, 50), g: -40, drag: 1.2, size: rnd(3.5, 8), max: rnd(0.4, 0.75), color: pick(FLAME) });
        for (let j = 0; j < cnt(3); j++) fx.emit({ shape: 'petal', x: p.x + rnd(-8, 8), y: p.y + rnd(-4, 8), vx: rnd(-70, 70) - dir * 40, vy: rnd(-30, 90), g: 160, drag: 1.1, rot: rnd(0, 6.28), vr: rnd(-7, 7), size: rnd(6, 10), max: rnd(0.55, 0.9), color: pick(FEATHER), sway: rnd(0, 6.28) });
      }, (DUR / steps) * s * 0.96);
    }
    fx.ring(c0.x, c0.y, '#ff9a3d', 70 + n * 2, 0.4, 4);
    sound('whoosh');
  }

  /* ------------------------------------------------------------------ registration */
  Skins.handlers.push((type, d, ctx) => {
    if (BR.reducedMotion) return;
    if (type === 'pop' || type === 'demo') {
      if (active('lantern', type, d, ctx)) lantern(type, d, ctx);
      if (active('frost', type, d, ctx)) frost(type, d, ctx);
      if (active('gears', type, d, ctx)) gears(type, d, ctx);
      if (active('slime', type, d, ctx)) slimeGoo(type, d, ctx);
      if (active('galaxy', type, d, ctx)) galaxyPop(type, d, ctx);
      if (active('phoenix', type, d, ctx)) phoenix(type, d, ctx);
    } else if (type === 'rushStart') {
      if (ctx.M.galaxy) galaxyRush(d, ctx, true);
    } else if (type === 'rushEnd') {
      galaxyRush(d, ctx, false);
    }
  });

  Skins.applyHooks.push((M) => {
    eyesTrack(!!M.slime && !BR.reducedMotion);
    if (!M.galaxy) { const run = document.getElementById('run'); if (run) run.classList.remove('galaxy-rush'); }
    if (!M.gears) document.querySelectorAll('.gears-spin').forEach((el) => el.classList.remove('gears-spin'));
  });

  /* exposed for the tests in tests/ */
  BR.S3Skins = { lantern, frost, gears, slimeGoo, galaxyPop, phoenix, eyes, spinGears };
})();
