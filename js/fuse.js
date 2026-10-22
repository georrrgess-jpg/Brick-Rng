/* The fuse (Update 4, section 5): one shared engine that draws every fuse cosmetic from its tokens (js/fuse-art.js).
   BR.Fuse owns the HUD block in index.html: Fizz the bomb (a face on a per-fuse body), the rope (one clip that scales, texture kept
   at its real size), the burning end (a three-layer flame plus ember, ash and heat that ride it), the readout (whole seconds, tenths
   under 10, rolling digits, an icon per state), time chips that fly from a pop to the readout, the urgency ramp, and one small
   particle canvas over the fuse area (at most 40 particles, drawn only while the run clock runs).

   Rules it keeps: nothing animates anything but transform and opacity; no getBoundingClientRect per frame (geometry is read in
   layout(), once per layout and on resize); every time-based change uses the dt it is given; no DOM is created per frame
   (the chips are a pool in the markup); with Reduce Motion or a low-end phone there are no particles, no flicker and no shake,
   but the readout still changes color and icon and the bomb still changes expression.

   API: init(host) layout() update(state, dt) gain(sec, from, kind, delayMs) burst(sec) stageUp() sparkStart() sparkEnd(saved)
        rushStart() rushEnd() setFuse(itemOrClass) beat() reset(state) fuseOut() bombPoint() destroy() */
(function () {
  const BR = (window.BR = window.BR || {});
  const A = BR.FuseArt;
  if (!A) return;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const now = () => performance.now();
  const rnd = (a, b) => a + Math.random() * (b - a);

  /* ------------------------------------------------------------------ colors */
  const parseColor = (c) => {
    if (c[0] === '#') { const n = c.length === 4 ? c.replace(/./g, (ch, i) => (i ? ch + ch : ch)) : c; return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16), 1]; }
    const m = c.match(/[\d.]+/g) || [255, 255, 255, 1];
    return [+m[0], +m[1], +m[2], m[3] != null ? +m[3] : 1];
  };
  const rgba = (c, a) => { const p = parseColor(c); return `rgba(${p[0]},${p[1]},${p[2]},${a == null ? p[3] : a})`; };

  /* ------------------------------------------------------------------ the generated stylesheet: every fuse's tokens as CSS custom properties */
  const ICE = { tongue: ['#a8dcff', '#58a8ff', '#3a6cf0'], core: ['#ffffff', '#d8f0ff'], halo: 'rgba(120,190,255,0.6)' };
  const frostBg = (c) => `repeating-linear-gradient(60deg, rgba(255,255,255,0.6) 0 1.5px, transparent 1.5px 7px), repeating-linear-gradient(-60deg, rgba(255,255,255,0.45) 0 1px, transparent 1px 9px), linear-gradient(180deg, rgba(255,255,255,0.9), ${rgba(c, 0.76)} 38%, rgba(140,195,240,0.7))`;
  function tokenCSS(cls, t) {
    const f = t.flame, b = t.bomb, F = b.face;
    const railH = t.railH || t.h + 2;
    const sel = `.${cls}`;
    const vars = [
      ['h', t.h + 'px'], ['rail-h', railH + 'px'], ['rope', t.rope.base], ['rope-lo', t.rope.low], ['rope-cr', t.rope.crit],
      ['gs0', t.gs[0]], ['gs1', t.gs[1]], ['gs2', t.gs[2]], ['rail-bg', t.rail.bg], ['rail-line', t.rail.line],
      ['tongue', A.flameURI(f.shape, 'tongue', f.tongue)], ['core', A.flameURI(f.shape, 'core', f.core)],
      ['tongue-ice', A.flameURI(f.shape, 'tongue', ICE.tongue)], ['core-ice', A.flameURI(f.shape, 'core', ICE.core)],
      ['halo', f.halo[0]], ['halo-ice', ICE.halo], ['fs', f.big ? 1.4 : 1.12],
      ['flame-all', A.flameAllURI(f.shape, { halo: f.halo, tongue: f.tongue, core: f.core })],
      ['ember-a', t.ember[0]], ['ember-b', t.ember[1]], ['ash', t.ash], ['heat', t.heat],
      ['body', A.bodyURI(b.kind, b.pal, null)], ['body-mini', A.bodyURI(b.kind, b.pal, F)],
      ['sclera', F.sclera], ['pupil', F.pupil], ['line', F.line], ['mouth', F.mouth || F.line], ['blush', F.blush], ['fy', F.ey - 36],
      ['cracks', A.cracksURI(t.cracks || '#ff5a3a', '#fff3d0')], ['frostb', A.frostBombURI(t.frost)], ['frost-bg', frostBg(t.frost)], ['wick', t.wick || t.ember[0]],
    ];
    let css = `${sel}{${vars.map(([k, v]) => `--fz-${k}:${v}`).join(';')}}\n`;
    if (t.rope.bare) css += `${sel} .fz-tex,${sel} .fz-hot,${sel} .fz-cr,${sel} .mf-fill{box-shadow:none}\n`;
    if (t.rope.flow) css += `${sel}.fuse .fz-flow{display:block;animation:fzFlow .7s linear infinite}\n`;
    if (f.ring) css += `${sel}.fuse .fz-ringfx{display:block}\n`;
    if (F.slit) css += `${sel}.fuse .fz-pupil{width:26%;margin-left:-13%;border-radius:40%}${sel}.fuse .fz-pupil::after{display:none}\n`;
    return css;
  }
  function buildSheet() {
    if (document.getElementById('fuseTokens')) return;
    const style = document.createElement('style');
    style.id = 'fuseTokens';
    // the Basic Cord doubles as the default for anything that has no fuse class yet
    let css = tokenCSS('fuse', A.TOKENS['fuse-classic']).replace(/^\.fuse\{/, '.fuse,.mini-fuse{');
    for (const [cls, t] of Object.entries(A.TOKENS)) css += tokenCSS(cls, t);
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ------------------------------------------------------------------ particles: one pool of 40, sprites drawn once, one small canvas */
  const MAXP = 40;
  const K = { spark: 0, ember: 1, smoke: 2, special: 3, ash: 4, shard: 5, glint: 6, arc: 7, wisp: 8 };
  const ADD = new Set([K.spark, K.ember, K.glint, K.wisp]);   // drawn with 'lighter' (glowing things); the rest are drawn normally

  function sprite(w, h, dpr, draw) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr); draw(g, w, h);
    return { c, w, h };
  }
  const SHAPES = {
    glow: (col) => (g, w, h) => { const r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, '#fff'); gr.addColorStop(0.22, col); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, w, h); },
    ember: (col) => (g, w, h) => { const r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, rgba(col, 1)); gr.addColorStop(0.45, rgba(col, 0.85)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, w, h); },
    smoke: (col) => (g, w, h) => { const r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r); const p = parseColor(col); gr.addColorStop(0, `rgba(${p[0]},${p[1]},${p[2]},${p[3]})`); gr.addColorStop(0.55, `rgba(${p[0]},${p[1]},${p[2]},${p[3] * 0.45})`); gr.addColorStop(1, `rgba(${p[0]},${p[1]},${p[2]},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h); },
    ash: (col) => (g, w, h) => { g.fillStyle = col; g.beginPath(); g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, 6.283); g.fill(); },
    sprinkle: (col) => (g, w, h) => { g.fillStyle = col; g.beginPath(); g.moveTo(h / 2, 0); g.arcTo(w, 0, w, h, h / 2); g.arcTo(w, h, 0, h, h / 2); g.arcTo(0, h, 0, 0, h / 2); g.arcTo(0, 0, w, 0, h / 2); g.fill(); },
    fleck: (col) => (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); },
    leaf: (col) => (g, w, h) => { g.fillStyle = col; g.strokeStyle = 'rgba(10,70,30,0.7)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0.5, h * 0.85); g.bezierCurveTo(0.5, h * 0.15, w * 0.5, 0, w - 0.5, h * 0.12); g.bezierCurveTo(w - 0.5, h * 0.7, w * 0.5, h, 0.5, h * 0.85); g.fill(); g.stroke(); g.beginPath(); g.moveTo(1.5, h * 0.8); g.lineTo(w * 0.8, h * 0.2); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.stroke(); },
    feather: (col, col2) => (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, col2 || col); gr.addColorStop(1, col); g.fillStyle = gr; g.beginPath(); g.moveTo(0, h / 2); g.quadraticCurveTo(w * 0.45, -h * 0.25, w, h / 2); g.quadraticCurveTo(w * 0.45, h * 1.25, 0, h / 2); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(1, h / 2); g.lineTo(w * 0.9, h / 2); g.stroke(); },
    shard: (col) => (g, w, h) => { g.fillStyle = col; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w, h); g.lineTo(0, h * 0.78); g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 0.7; g.stroke(); },
    glint: (col) => (g, w, h) => { const c = w / 2; g.fillStyle = rgba(col, 0.35); g.beginPath(); g.arc(c, c, c * 0.8, 0, 6.283); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(c, 0); g.lineTo(c + w * 0.1, c - w * 0.1); g.lineTo(w, c); g.lineTo(c + w * 0.1, c + w * 0.1); g.lineTo(c, h); g.lineTo(c - w * 0.1, c + w * 0.1); g.lineTo(0, c); g.lineTo(c - w * 0.1, c - w * 0.1); g.closePath(); g.fill(); },
    streak: (col) => (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(1, '#fff'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, 0); g.lineTo(w, h); g.closePath(); g.fill(); },
    mote: (col) => (g, w, h) => { const r = w / 2, gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, rgba(col, 0.95)); gr.addColorStop(0.35, rgba(col, 0.5)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(0, 0, w, h); },
    wisp: (col) => (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(1, rgba(col, 0.9)); g.fillStyle = gr; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w - h / 2, 0); g.lineTo(w - h / 2, h); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(w - h / 2, h / 2, h * 0.36, 0, 6.283); g.fill(); g.fillStyle = rgba(col, 0.6); g.beginPath(); g.arc(w - h / 2, h / 2, h * 0.5, 0, 6.283); g.fill(); },
    lick: (col, col2) => (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, col); gr.addColorStop(1, col2 || col); g.fillStyle = gr; g.beginPath(); g.moveTo(w / 2, 0); g.bezierCurveTo(w * 0.7, h * 0.3, w, h * 0.5, w * 0.8, h * 0.8); g.bezierCurveTo(w * 0.7, h, w * 0.3, h, w * 0.2, h * 0.8); g.bezierCurveTo(0, h * 0.5, w * 0.4, h * 0.35, w / 2, 0); g.fill(); },
  };
  /** size of each special shape, in css px */
  const SIZE = { sprinkle: [8, 3.4], leaf: [11, 8], feather: [16, 6], shard: [9, 9], fleck: [4, 2.4], streak: [16, 3.4], mote: [14, 14], wisp: [18, 8], lick: [8, 13], arc: [0, 0] };

  class Particles {
    constructor(cv) {
      this.cv = cv; this.ctx = cv.getContext('2d');
      this.dpr = 1; this.w = 0; this.h = 0;
      this.p = []; for (let i = 0; i < MAXP; i++) this.p.push({ on: false, k: 0, sp: null, x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, age: 0, life: 1, rot: 0, vr: 0, sc: 1, grow: 0, ph: 0, sway: 0, a: 1, pts: new Float32Array(12), col: '#fff' });
      this.live = 0; this.dirty = false; this.sp = null; this.spk = [];
    }
    resize(w, h) {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = w; this.h = h;
      this.cv.width = Math.round(w * this.dpr); this.cv.height = Math.round(h * this.dpr);
      this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
      this.dirty = true;
    }
    /** build the sprites a fuse's tokens ask for */
    setStyle(t) {
      const d = this.dpr, P = t.part, S = {};
      S.spark = P.spark.map((c) => sprite(13, 13, d, SHAPES.glow(c)));
      S.ember = P.ember.map((c) => sprite(10, 10, d, SHAPES.ember(c)));
      S.smoke = [sprite(24, 24, d, SHAPES.smoke(P.smoke))];
      S.ash = ['#8a7e74', '#6a6058', '#a79c90'].map((c) => sprite(3.6, 3, d, SHAPES.ash(c)));
      S.glint = ['#ffe58a', '#ffffff', '#ffd24a'].map((c) => sprite(13, 13, d, SHAPES.glint(c)));
      S.shard = ['#e8f8ff', '#bfe8ff', '#8fd0ff'].map((c) => sprite(9, 9, d, SHAPES.shard(c)));
      S.wisp = [];
      const sp = P.special;
      S.special = [];
      if (sp && sp.shape !== 'arc') {
        const sz = SIZE[sp.shape];
        S.special = sp.colors.map((c, i) => sprite(sz[0], sz[1], d, SHAPES[sp.shape](c, sp.colors[(i + 1) % sp.colors.length])));
      }
      this.sp = S; this.spec = sp; this.arcCols = sp && sp.shape === 'arc' ? sp.colors : null;
      this.kill();
    }
    kill() { for (const q of this.p) q.on = false; this.live = 0; this.clear(); }
    clear() { if (this.dirty) { this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.clearRect(0, 0, this.cv.width, this.cv.height); this.dirty = false; } }
    free(pri) {
      for (let i = 0; i < MAXP; i++) if (!this.p[i].on) return this.p[i];
      if (pri) { for (let i = 0; i < MAXP; i++) { const q = this.p[i]; if (q.on && (q.k === K.smoke || q.k === K.ash)) return q; } }
      return null;
    }
    spawn(k, x, y, pri) {
      const q = this.free(pri); if (!q) return null;
      if (!q.on) this.live++;
      q.on = true; q.k = k; q.x = x; q.y = y; q.age = 0; q.rot = 0; q.vr = 0; q.sc = 1; q.grow = 0; q.sway = 0; q.ph = Math.random() * 6.283; q.a = 1; q.g = 0; q.drag = 0; q.vx = 0; q.vy = 0;
      return q;
    }
    /* each recipe sets velocity, gravity, life and sprite */
    spark(x, y, up) {
      const q = this.spawn(K.spark, x, y); if (!q) return;
      const arr = this.sp.spark; q.sp = arr[(Math.random() * arr.length) | 0];
      q.vx = rnd(-70, 70) * (up || 1); q.vy = -rnd(30, 110) * (up || 1); q.g = 170; q.drag = 1.4; q.life = rnd(0.3, 0.62); q.sc = rnd(0.55, 1.1);
    }
    ember(x, y) {
      const q = this.spawn(K.ember, x, y); if (!q) return;
      const arr = this.sp.ember; q.sp = arr[(Math.random() * arr.length) | 0];
      q.vx = rnd(-26, 26); q.vy = -rnd(4, 34); q.g = 150; q.drag = 0.8; q.life = rnd(0.8, 1.35); q.sc = rnd(0.5, 0.85);
    }
    smoke(x, y) {
      const q = this.spawn(K.smoke, x, y); if (!q) return;
      q.sp = this.sp.smoke[0]; q.vx = rnd(5, 20); q.vy = -rnd(20, 38); q.g = 0; q.drag = 0.4; q.life = rnd(1.0, 1.5); q.sc = 0.5; q.grow = 0.85; q.a = 0.9;
    }
    ash(x, y) {
      const q = this.spawn(K.ash, x + rnd(4, 24), y + rnd(-3, 3)); if (!q) return;
      const arr = this.sp.ash; q.sp = arr[(Math.random() * arr.length) | 0];
      q.vx = rnd(4, 18); q.vy = rnd(8, 30); q.g = 70; q.drag = 0.5; q.life = rnd(0.7, 1.1); q.rot = rnd(0, 6.28); q.vr = rnd(-5, 5);
    }
    special(x, y, hint) {
      const sp = this.spec; if (!sp) return;
      const shape = sp.shape;
      if (shape === 'arc') {
        const q = this.spawn(K.arc, x, y); if (!q) return;
        const L = rnd(14, 32), a0 = rnd(-1.2, 1.2) - 1.5708 * (Math.random() < 0.5 ? 1 : -1) * 0, ang = hint === 'along' ? rnd(-0.5, 0.5) : a0 - 1.5708;
        q.life = rnd(0.07, 0.15); q.col = this.arcCols[(Math.random() * this.arcCols.length) | 0];
        for (let i = 0; i < 6; i++) { const u = i / 5; q.pts[i * 2] = Math.cos(ang) * L * u + (i && i < 5 ? rnd(-3.5, 3.5) : 0) * Math.sin(ang); q.pts[i * 2 + 1] = Math.sin(ang) * L * u + (i && i < 5 ? rnd(-4, 4) : 0); }
        return;
      }
      const q = this.spawn(K.special, x, y); if (!q) return;
      const arr = this.sp.special; q.sp = arr[(Math.random() * arr.length) | 0];
      switch (shape) {
        case 'sprinkle': q.vx = rnd(-46, 46); q.vy = -rnd(10, 70); q.g = 280; q.drag = 0.3; q.life = rnd(0.9, 1.4); q.rot = rnd(0, 6.28); q.vr = rnd(-9, 9); break;
        case 'fleck': q.vx = rnd(-40, 40); q.vy = -rnd(10, 60); q.g = 260; q.drag = 0.4; q.life = rnd(0.5, 0.9); q.rot = rnd(0, 6.28); q.vr = rnd(-12, 12); break;
        case 'leaf': q.x += rnd(2, 16); q.vx = rnd(-8, 22); q.vy = rnd(-6, 8); q.g = 38; q.drag = 0.9; q.sway = rnd(26, 46); q.life = rnd(1.5, 2.1); q.rot = rnd(0, 6.28); q.vr = rnd(-2.4, 2.4); break;
        case 'feather': q.vx = rnd(-14, 18); q.vy = -rnd(26, 54); q.g = -6; q.drag = 0.6; q.sway = rnd(18, 34); q.life = rnd(1.3, 1.8); q.rot = rnd(-1, 1); q.vr = rnd(-1.6, 1.6); break;
        case 'shard': q.vx = rnd(-30, 30); q.vy = -rnd(0, 40); q.g = 210; q.drag = 0.4; q.life = rnd(0.8, 1.2); q.rot = rnd(0, 6.28); q.vr = rnd(-8, 8); break;
        case 'mote': q.vx = rnd(-10, 14); q.vy = -rnd(6, 20); q.g = 0; q.drag = 0.3; q.sway = rnd(6, 14); q.life = rnd(1.2, 1.8); q.sc = rnd(0.5, 1); break;
        case 'wisp': { const a = rnd(0, 6.28), sp2 = rnd(70, 110); q.vx = Math.cos(a) * sp2; q.vy = Math.sin(a) * sp2; q.vr = rnd(5, 8) * (Math.random() < 0.5 ? 1 : -1); q.drag = 0.4; q.life = rnd(0.6, 0.95); break; }
        case 'lick': q.vx = rnd(-14, 14); q.vy = -rnd(60, 110); q.g = -30; q.drag = 0.8; q.life = rnd(0.35, 0.6); q.sc = rnd(0.7, 1.15); q.grow = -1.1; break;
        case 'streak': { const a = rnd(-2.9, -0.2), sp2 = rnd(170, 320); q.vx = Math.cos(a) * sp2; q.vy = Math.sin(a) * sp2; q.g = 380; q.drag = 1.1; q.life = rnd(0.22, 0.4); break; }
        default: break;
      }
    }
    shardAt(x, y, vx, vy) {
      const q = this.spawn(K.shard, x, y, true); if (!q) return;
      const arr = this.sp.shard; q.sp = arr[(Math.random() * arr.length) | 0];
      q.vx = vx; q.vy = vy; q.g = 520; q.drag = 0.3; q.life = rnd(0.55, 0.95); q.rot = rnd(0, 6.28); q.vr = rnd(-12, 12); q.sc = rnd(0.9, 1.5);
    }
    glintAt(x, y) {
      const q = this.spawn(K.glint, x, y, true); if (!q) return;
      const arr = this.sp.glint; q.sp = arr[(Math.random() * arr.length) | 0];
      q.vx = rnd(-14, 14); q.vy = -rnd(10, 40); q.g = 0; q.drag = 0.5; q.life = rnd(0.45, 0.8); q.sc = rnd(0.7, 1.35); q.rot = rnd(-0.4, 0.4);
    }
    step(dt) {
      for (let i = 0; i < MAXP; i++) {
        const q = this.p[i]; if (!q.on) continue;
        q.age += dt;
        if (q.age >= q.life) { q.on = false; this.live--; continue; }
        if (q.k === K.arc) continue;
        const dr = Math.max(0, 1 - q.drag * dt);
        q.vx *= dr; q.vy = q.vy * dr + q.g * dt;
        if (q.sway) q.vx += Math.sin(q.age * 4.2 + q.ph) * q.sway * dt * 3;
        q.x += q.vx * dt; q.y += q.vy * dt;
        q.rot += q.vr * dt; q.sc += q.grow * dt;
        if (q.k === K.special && this.spec && this.spec.shape === 'wisp') { const c = Math.cos(q.vr * dt), s = Math.sin(q.vr * dt), vx = q.vx * c - q.vy * s; q.vy = q.vx * s + q.vy * c; q.vx = vx; q.rot = Math.atan2(q.vy, q.vx); }
        if (q.k === K.special && this.spec && this.spec.shape === 'streak') q.rot = Math.atan2(q.vy, q.vx);
        if (q.k === K.spark && this.spec && this.spec.shape === 'streak') q.rot = Math.atan2(q.vy, q.vx);
      }
    }
    alpha(q) {
      const u = q.age / q.life;
      let a = u < 0.14 ? u / 0.14 : 1;
      if (u > 0.5) a *= 1 - (u - 0.5) / 0.5;
      return a * q.a;
    }
    draw() {
      const g = this.ctx, d = this.dpr;
      if (this.dirty) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.cv.width, this.cv.height); }
      if (!this.live) { this.dirty = false; return; }
      this.dirty = true;
      for (let pass = 0; pass < 2; pass++) {
        g.globalCompositeOperation = pass ? 'lighter' : 'source-over';
        for (let i = 0; i < MAXP; i++) {
          const q = this.p[i]; if (!q.on) continue;
          const add = ADD.has(q.k) || (q.k === K.special && this.spec && (this.spec.shape === 'mote' || this.spec.shape === 'wisp' || this.spec.shape === 'streak'));
          if (add !== !!pass) continue;
          const a = this.alpha(q);
          if (a < 0.02) continue;
          if (q.k === K.arc) {
            g.setTransform(d, 0, 0, d, q.x * d, q.y * d);
            g.globalAlpha = a * (Math.random() < 0.3 ? 0.4 : 1);
            g.lineJoin = 'round'; g.beginPath(); g.moveTo(q.pts[0], q.pts[1]); for (let j = 1; j < 6; j++) g.lineTo(q.pts[j * 2], q.pts[j * 2 + 1]);
            g.strokeStyle = rgba(q.col, 0.5); g.lineWidth = 3.4; g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 1.1; g.stroke();
            continue;
          }
          const s = q.sp; if (!s) continue;
          const sc = q.sc < 0.05 ? 0.05 : q.sc, c = Math.cos(q.rot) * sc, sn = Math.sin(q.rot) * sc;
          g.setTransform(c * d, sn * d, -sn * d, c * d, q.x * d, q.y * d);
          g.globalAlpha = a;
          g.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h);
        }
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
  }

  /* ------------------------------------------------------------------ the engine */
  const CHIP = {
    pop: { c: '#ffe58a', g: 'rgba(255,200,80,0.5)', dur: 350 },
    line: { c: '#ffd24a', g: 'rgba(255,210,74,0.9)', dur: 430, gold: true },
    defuse: { c: '#3ddc97', g: 'rgba(61,220,151,0.6)', dur: 350 },
    power: { c: '#7ee8ff', g: 'rgba(126,232,255,0.6)', dur: 350 },
    shuffle: { c: '#c4b5ff', g: 'rgba(196,181,255,0.6)', dur: 350 },
    spark: { c: '#ffe58a', g: 'rgba(255,200,80,0.7)', dur: 350 },
  };
  const MOOD = { calm: 'calm', watch: 'watch', low: 'worried', crit: 'panic', spark: 'spark', frozen: 'cool', hold: 'glad' };

  const Fuse = {
    host: null, ok: false, z: '', cls: '', tok: null,
    d: 30, fmax: 30, lastT: 30, floor: 0, pend: 0, spring: 0, v: 0, flying: [], resp: null, fast: false,
    tw: 240, L: 249, x0: -9, tx0: 0, tyH: 32, ty: 13, bx: 31, by: 32, bs: 62, wx: 0, wy: -40, rx: 200, ry: 32, cvH: 92, cvTop: 40, rushPeak: 0, tipKey: '',
    sp: 0, fshown: -1, mood: '', moodT: 0, moodNext: '', moodNext2: 0, prevZ: '', savedFlag: false, dgs: null,
    acc: { spark: 0, ember: 0, smoke: 0, ash: 0, special: 0, glint: 0 }, clock: 0, rushMax: 8, lastTick: -1, key: 0, hostRect: null, laid: false,

    init(host) {
      if (this.host === host && this.ok) return this;
      this.destroy();
      buildSheet();
      const q = (s) => host.querySelector(s);
      this.host = host;
      this.bomb = q('.bomb'); this.pulse = q('.fz-pulse'); this.track = q('.fuse-track');
      this.rope = q('.fuse-fill'); this.inn = q('.fz-in'); this.tip = q('.spark'); this.flare = q('.fz-flare');
      this.glint = q('.fz-glint'); this.gold = q('.fz-gold'); this.burnFlash = q('.fz-burnflash'); this.redFlash = q('.fz-redflash');
      this.time = q('.fuse-time'); this.numBox = q('.fz-numbox'); this.num = q('.fz-num');
      this.ringFg = q('.fz-ring .fg'); this.rringFg = q('.fz-rring .fg'); this.p4 = q('.fz-p4');
      this.cv = q('.fz-cv'); this.burstEl = q('.fz-burst'); this.chipEls = Array.from(host.querySelectorAll('.fz-chip')); this.chipI = 0;
      this.vig = document.getElementById('warnVignette');
      const dg = (c) => { const el = q('.fz-dg.' + c); return { el, cur: el.children[0], prev: el.children[1], val: el.children[0].textContent }; };
      this.dg = { t: dg('t'), o: dg('o'), x: dg('x') };
      this.parts = new Particles(this.cv);
      const F = BR.CFG.fuse; this.CRIT = F.critical; this.LOW = F.lowFrac;
      this.ok = true;
      this._onVis = () => { if (document.hidden) this.parts.kill(); };
      document.addEventListener('visibilitychange', this._onVis);
      this._onResize = () => this.layout();
      window.addEventListener('resize', this._onResize);
      this.sync();
      return this;
    },

    destroy() {
      if (!this.ok) return;
      document.removeEventListener('visibilitychange', this._onVis); window.removeEventListener('resize', this._onResize);
      [this.pulse, this.flare, this.numBox, this.glint, this.gold, this.burnFlash, this.redFlash, this.vig, this.burstEl].concat(this.chipEls).forEach((el) => { if (el) el.getAnimations().forEach((a) => a.cancel()); });
      this.parts.kill(); this.flying.length = 0; this.pend = 0; this.ok = false; this.host = null;
    },

    /** the loadout changed (BR.Skins.apply): read the equipped fuse and restyle */
    sync() { if (this.ok) this.setFuse(BR.Skins && BR.Skins.fuseCls); },
    setFuse(item) {
      if (!this.ok) return;
      const cls = typeof item === 'string' ? item : item && item.cls;
      const c = cls || 'fuse-classic';
      this.tok = A.tokensFor(c);
      if (c !== this.cls) { this.cls = c; this.parts.setStyle(this.tok); this.acc.special = 0; }
      if (!this.parts.sp) this.parts.setStyle(this.tok);
      this.rushMax = BR.CFG.rush.time;
    },

    /** read the geometry once: where the track, the bomb and the readout are, and how big the particle canvas is */
    layout() {
      const h = this.host;
      if (!this.ok || !h || !h.offsetWidth) return;
      const hr = h.getBoundingClientRect(), tr = this.track.getBoundingClientRect(), br = this.bomb.getBoundingClientRect(), rr = this.time.getBoundingClientRect();
      this.hostRect = { left: hr.left, top: hr.top, w: h.offsetWidth, h: h.offsetHeight };
      this.tw = this.track.offsetWidth;
      this.L = this.tw - this.x0;                                              // the rope runs from under the bomb to the readout
      this.ty = this.track.offsetHeight / 2;
      this.tx0 = tr.left - hr.left; this.tyH = tr.top - hr.top + this.ty;      // the track's origin and its middle line, inside the host
      this.bx = br.left - hr.left + br.width / 2; this.by = br.top - hr.top + br.height / 2; this.bs = br.width;
      this.rx = rr.left - hr.left + rr.width / 2; this.ry = rr.top - hr.top + rr.height / 2;
      // the bomb's own wick, in track coordinates (the flame jumps there in Last Spark)
      this.wx = this.bx - this.tx0; this.wy = this.by - this.bs * 0.5 - 5 - this.tyH;
      // the particle canvas covers the host and reaches 40px above it (the Last Spark flame sits on the bomb's wick) and 14px below
      const ch = this.hostRect.h + this.cvTop + 14;
      this.cv.style.marginTop = -this.cvTop + 'px'; this.parts.resize(this.hostRect.w, ch); this.cvH = ch;
      h.style.setProperty('--fz-w', this.L + 'px');
      this.setStep(this.fmax);
      if (this.parts.sp) this.parts.setStyle(this.tok || A.tokensFor('fuse-classic'));
      this.fshown = -1; this.laid = true;
    },
    setStep(fmax) { this.fmax = fmax; if (this.host) this.host.style.setProperty('--fz-step', (this.L * 5 / fmax).toFixed(2) + 'px'); },

    /** the page position of the bomb's middle (for explosions and bursts that belong on the big canvas) */
    bombPoint() {
      if (!this.hostRect) this.layout();
      const hr = this.hostRect; return hr ? { x: hr.left + this.bx, y: hr.top + this.by } : { x: 40, y: 120 };
    },
    tipPoint() {
      const hr = this.hostRect; if (!hr) return this.bombPoint();
      return { x: hr.left + this.tx0 + this.x0 + this.L * clamp(this.d / this.fmax, 0, 1), y: hr.top + this.tyH };
    },

    /** a new run: show the engine's fuse exactly, nothing in flight */
    reset(s) {
      if (!this.ok) return;
      this.flying.length = 0; this.pend = 0; this.resp = null; this.spring = 0; this.v = 0; this.fast = false; this.sp = 0; this.mood = ''; this.moodT = 0; this.prevZ = 'calm'; this.savedFlag = false;
      this.fmax = s && s.fuseMax ? s.fuseMax : 30; this.d = s && s.fuse != null ? s.fuse : this.fmax; this.lastT = this.d; this.floor = this.d; this.key = 0; this.fshown = -1; this.clock = 0;
      this.parts.kill(); this.z = ''; this.lastTick = -1;
      this.host.classList.remove('fz-shatter', 'fz-paused');
      this.chipEls.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
      if (this.vig) this.vig.classList.remove('on', 'lo');
      if (this.laid) this.setStep(this.fmax); else this.layout();
      if (s) this.update(s, 0);
    },

    /* ------------------------------------------------------------------ per frame */
    update(s, dt) {
      if (!this.ok) return;
      const still = BR.reducedMotion || BR.lowEnd;
      const fmax = s.fuseMax || 30;
      if (fmax !== this.fmax) { this.setStep(fmax); this.fshown = -1; }
      const rushOn = s.rush && (s.rush === true || s.rush.active);
      const running = !s.paused && !document.hidden;
      if (this.host.classList.contains('fz-paused') !== !!s.paused) this.host.classList.toggle('fz-paused', !!s.paused);
      if (running) this.clock += dt;

      /* ---- what the rope shows: the engine's fuse minus the gains still flying to it, springing on arrival, burning away fast on a burst */
      const tnow = now();
      if (this.flying.length) this.land(tnow);
      const sf = s.fuse > 0 ? s.fuse : 0;                                  // the engine can dip below zero for a frame on a Fuse brick
      let T = sf;
      const burning = running && !rushOn && !(s.freeze > 0) && !(s.spark > 0) && s.fuse > 0;
      if (this.pend > 0.0001) {
        if (burning) this.floor -= (s.burn || 1) * dt;
        T = clamp(Math.max(sf - this.pend, this.floor), 0, sf);
      } else this.floor = sf;
      this.lastT = T;
      if (this.resp) {
        const r = this.resp, u = clamp((tnow - r.t0) / r.dur, 0, 1);
        this.d = r.from + (r.to - r.from) * (1 - Math.pow(1 - u, 3)) + (u > 0.75 ? Math.sin((u - 0.75) * 12.566) * 0.012 * fmax * (1 - u) * 4 : 0);
        if (u >= 1) { this.resp = null; this.d = T; this.spring = 0.4; this.v = 0; }
      } else if (still) { this.d = T; }
      else if (this.spring > 0) {
        this.spring -= dt;
        const K2 = 480, C2 = 20, n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
        for (let i = 0; i < n; i++) { const a = K2 * (T - this.d) - C2 * this.v; this.v += a * h; this.d += this.v * h; }
        if (this.spring <= 0 || (Math.abs(this.v) < 0.02 && Math.abs(T - this.d) < 0.004)) { this.spring = 0; this.v = 0; this.d = T; }
      } else if (T > this.d + 0.0005) { this.d = T; }
      else if (T < this.d - 0.0005) {
        const burn = this.d - T;
        if (burn > 0.25 + (s.burn || 1) * dt * 2) this.fast = true;
        if (this.fast) { this.d = Math.max(T, this.d - 26 * dt); if (this.d <= T + 1e-4) this.fast = false; } else this.d = T;
      }
      const d = clamp(this.d, 0, fmax * 1.015);

      /* ---- the state ---- */
      let z;
      if (rushOn) z = 'frozen';
      else if (s.spark > 0) z = 'spark';
      else if (s.freeze > 0) z = 'hold';
      else {
        const was = this.z, hot = was === 'low' || was === 'crit', cr = was === 'crit';
        if (d <= this.CRIT + (cr ? 0.35 : 0)) z = 'crit';
        else if (d / fmax <= this.LOW + (hot ? 0.02 : 0) || d < 10 + (hot ? 0.3 : 0)) z = 'low';
        else if (d / fmax <= 0.5 + (was === 'calm' ? 0 : 0.02)) z = 'watch';
        else z = 'calm';
      }
      if (z !== this.z) this.enter(z, s);
      if (this.moodT > 0) { this.moodT -= dt; if (this.moodT <= 0) { this.mood = this.moodNext || ''; this.moodNext = ''; this.moodT = this.moodNext2 || 0; this.moodNext2 = 0; this.bomb.dataset.x = this.mood || MOOD[this.z]; } }

      /* ---- the rope and the burning end ---- */
      const f = d / fmax;
      if (Math.abs(f - this.fshown) > 0.0003) {
        this.fshown = f;
        const fs = f < 0.004 ? 0.004 : f;
        this.rope.style.transform = 'scaleX(' + fs.toFixed(4) + ')';
        this.inn.style.transform = 'scaleX(' + (1 / fs).toFixed(3) + ')';
        const vis = f >= 0.004 ? '' : 'hidden';
        if (this.rope.style.visibility !== vis) this.rope.style.visibility = vis;
      }
      // the flame jumps to the bomb's own wick in Last Spark and races back out when it is relit
      const target = z === 'spark' ? 1 : 0;
      if (this.sp !== target) { this.sp = still ? target : this.sp + clamp(target - this.sp, -dt / 0.3, dt / 0.2); }
      const sp = this.sp, e = sp * sp * (3 - 2 * sp);
      const rx = this.x0 + this.L * (f > 1 ? 1 : f);
      const tx = rx + (this.wx - rx) * e, ty = this.wy * e;
      const tk = Math.round(tx * 2) * 1000 + Math.round(ty * 2);
      if (tk !== this.tipKey) { this.tipKey = tk; this.tip.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0)'; }

      /* ---- the readout ---- */
      this.readout(z === 'spark' ? 0 : Math.min(d, sf), z, running, still);
      // Rush: the seconds count down in a ring around the readout; Last Spark: a ring drains around the bomb
      if (z === 'frozen' && s.rush && s.rush.left != null) {
        if (!(s.rush.left <= this.rushMax) && s.rush.left > this.rushPeak) this.rushPeak = s.rush.left;
        const pk = Math.max(this.rushMax, this.rushPeak || 0);
        this.setRing(this.rringFg, clamp(s.rush.left / pk, 0, 1), 163.36);
      }
      if (z === 'spark') this.setRing(this.ringFg, clamp(s.spark / BR.CFG.fuse.spark, 0, 1), 194.78);

      /* ---- particles ---- */
      const P = this.parts;
      if (still) { if (P.live || P.dirty) P.kill(); }
      else if (running) { this.emit(z, s, dt, f, tx, ty); if (P.live) P.step(dt); if (P.live || P.dirty) P.draw(); }
      this.prevZ = z;
    },

    /** a state change: the host's data-z, the face, the vignette, and one-off effects */
    enter(z, s) {
      const old = this.z, h = this.host;
      this.z = z; h.dataset.z = z;
      h.classList.toggle('low', z === 'low'); h.classList.toggle('crit', z === 'crit'); h.classList.toggle('frozen', z === 'frozen');
      if (!this.moodT) this.bomb.dataset.x = MOOD[z];
      const vig = this.vig;
      if (vig) { vig.classList.toggle('lo', z === 'low'); vig.classList.toggle('on', z === 'crit'); }
      if (old === 'spark' && z !== 'spark' && s.fuse > 0.05 && !s.over) this.relit(s);
      if (z === 'frozen') { this.rushPeak = 0; this.pop(this.flare, 1.5, 320); }
      if (z === 'spark') { this.pop(this.pulse, 1.18, 260); this.pop(this.flare, 1.4, 300); }
      this.key = 0;
    },

    /** the Last Spark window closed with a living fuse: the flame races back out along a new rope, Fizz is relieved, then winks */
    relit(s) {
      const tnow = now();
      this.resp = { t0: tnow, from: 0, to: Math.max(s.fuse, 0.1), dur: BR.reducedMotion ? 80 : 520 };
      if (this.z !== 'frozen' && this.z !== 'hold') this.setMood('glad', 0.9, this.savedFlag ? 'wink' : '', this.savedFlag ? 0.6 : 0);   // a pop of 4+ earns the wink; time from a power-up just earns relief
      this.pop(this.flare, 1.5, 420); this.pop(this.pulse, 1.14, 320);
      if (!BR.lowEnd && !BR.reducedMotion) { const P = this.parts, y = this.cvTop + this.tyH; for (let i = 0; i < 14; i++) { const q = P.spawn(K.spark, this.tx0 + this.wx, y + this.wy, true); if (q) { q.sp = P.sp.spark[i % P.sp.spark.length]; const a = rnd(-3.14, 0); q.vx = Math.cos(a) * rnd(60, 180); q.vy = Math.sin(a) * rnd(60, 160); q.g = 120; q.drag = 1.2; q.life = rnd(0.4, 0.8); q.sc = rnd(0.8, 1.4); } } }
    },
    setMood(m, t1, m2, t2) { this.mood = m; this.moodT = t1; this.moodNext = m2 || ''; this.moodNext2 = t2 || 0; this.bomb.dataset.x = m; },

    /* ------------------------------------------------------------------ the readout */
    readout(v, z, running, still) {
      let m, n;
      if (z === 'spark') { this.num.dataset.m = 'w'; return; }
      if (v >= 10) { m = 'w'; n = Math.floor(v + 1e-6); } else { m = 't'; n = Math.floor(v * 10 + 1e-6); }
      const key = n + (m === 't' ? 1000 : 0) + 1;                      // a number, so nothing is allocated per frame; 0 means "nothing shown yet"
      if (key === this.key) return;
      const old = this.key; this.key = key;
      if (this.num.dataset.m !== m) this.num.dataset.m = m;
      const dir = old && (old > 1000) === (m === 't') ? (old < key ? 1 : -1) : (m === 'w' ? 1 : -1);
      const roll = running && !still && !!old;
      let wholeChanged;
      if (m === 'w') { wholeChanged = this.setDigit(this.dg.t, String(Math.floor(n / 10)), roll, dir); wholeChanged = this.setDigit(this.dg.o, String(n % 10), roll, dir) || wholeChanged; }
      else { wholeChanged = this.setDigit(this.dg.o, String(Math.floor(n / 10)), roll, dir); this.setDigit(this.dg.x, String(n % 10), false, dir); }
      if (wholeChanged && roll && (z === 'low' || z === 'crit') && this.lastTick !== (m === 'w' ? n : Math.floor(n / 10))) {
        this.lastTick = m === 'w' ? n : Math.floor(n / 10);
        if (dir < 0) this.pop(this.numBox, z === 'crit' ? 1.22 : 1.14, 230);
      }
      if (wholeChanged) this.num.setAttribute('aria-label', (m === 'w' ? n : Math.floor(n / 10)) + ' seconds');
    },
    setDigit(slot, ch, roll, dir) {
      if (slot.val === ch) return false;
      const old = slot.val; slot.val = ch;
      slot.cur.textContent = ch;
      if (!roll) return true;
      slot.prev.textContent = old;
      const from = dir < 0 ? '-70%' : '70%', to = dir < 0 ? '70%' : '-70%';
      slot.cur.animate([{ transform: `translateY(${from})`, opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 170, easing: 'cubic-bezier(0.2,0.8,0.3,1)' });
      slot.prev.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${to})`, opacity: 0 }], { duration: 150, easing: 'ease-in' });
      return true;
    },
    /** drain a ring (a circle with a dash as long as its circumference): p is the share still left */
    setRing(el, p, len) {
      const v = (len * (1 - p)).toFixed(1);
      if (el.dataset.v !== v) { el.dataset.v = v; el.style.strokeDashoffset = v; }
    },
    /** a quick scale-and-back on an element (WAAPI: transform only) */
    pop(el, peak, ms) {
      if (!el || BR.reducedMotion) return;
      el.animate([{ transform: 'scale(1)' }, { transform: `scale(${peak})`, offset: 0.28 }, { transform: 'scale(1)' }], { duration: ms, easing: 'cubic-bezier(0.2,0.8,0.3,1)' });
    },

    /* ------------------------------------------------------------------ particles: how many, when */
    emit(z, s, dt, f, tx, ty) {
      const P = this.parts, a = this.acc;
      if (!P.sp || !this.hostRect) return;
      const y = this.cvTop + this.tyH + ty, px = this.tx0 + tx;     // the tip, in canvas coordinates
      let m = 1, spark = 1;
      if (z === 'watch') m = 1.5; else if (z === 'low') m = 2.2; else if (z === 'crit') { m = 3.2; const t = this.clock; spark = Math.sin(t * 23) + Math.sin(t * 37.3) > -0.5 ? 1 : 0.1; }
      else if (z === 'spark') { m = 3.6; } else if (z === 'hold') m = 0.4;
      const bm = clamp(1 + 0.2 * ((s.burn || 1) - 1), 1, 2);
      const live = P.live;
      if (z === 'frozen') {
        // the flame is still and blue: only the odd glint on the frost, and the Lightning Rod's arcs crackle along the rope
        a.glint += 1.6 * dt; while (a.glint >= 1) { a.glint -= 1; P.glintAt(this.tx0 + this.x0 + this.L * f * Math.random(), y + rnd(-6, 6)); }
        const sp = P.spec;
        if (sp && sp.shape === 'arc') { a.special += 7 * dt; while (a.special >= 1) { a.special -= 1; P.special(this.tx0 + this.x0 + this.L * f * Math.random(), y + rnd(-5, 5), 'along'); } }
        return;
      }
      if (live < 36) {
        a.spark += 4.6 * m * bm * spark * dt; while (a.spark >= 1) { a.spark -= 1; P.spark(px, y - 3); }
        a.ember += 1.3 * m * bm * dt; while (a.ember >= 1) { a.ember -= 1; P.ember(px, y); }
        a.smoke += 1.0 * m * dt; while (a.smoke >= 1) { a.smoke -= 1; P.smoke(px + 2, y - 8); }
        a.ash += 1.5 * m * dt; while (a.ash >= 1) { a.ash -= 1; P.ash(px, y); }
      } else { a.spark = a.ember = a.smoke = a.ash = 0; }
      const sp = P.spec;
      if (sp && live < MAXP - 2) { a.special += sp.rate * 0.8 * m * dt; while (a.special >= 1) { a.special -= 1; P.special(px, y); } }
      if (this.resp) { a.glint += 40 * dt; while (a.glint >= 1) { a.glint -= 1; P.glintAt(px - rnd(0, 10), y + rnd(-7, 7)); } }
    },
    /** one-off bursts (stage-up respool sparkle, frost cracking off, gold sparkles on a Line Blast) */
    burstGlints(x0, x1, n) {
      if (BR.reducedMotion || BR.lowEnd || !this.ok) return;
      const P = this.parts, y = this.cvTop + this.tyH;
      for (let i = 0; i < n; i++) P.glintAt(this.tx0 + this.x0 + this.L * (x0 + (x1 - x0) * Math.random()), y + rnd(-9, 9));
    },

    /* ------------------------------------------------------------------ time changes the player can see */
    /** +sec seconds: a chip flies from `from` (page coordinates of the popped group) to the readout, then the rope grows */
    gain(sec, from, kind, delayMs) {
      if (!this.ok || !(sec > 0)) return;
      if (!this.hostRect) this.layout();
      if (!this.hostRect) return;
      const C = CHIP[kind] || CHIP.pop, still = BR.reducedMotion;
      const dur = still ? 0 : C.dur, delay = delayMs || 0;
      const rec = { sec, kind: kind || 'pop', t0: now() + delay, dur, big: sec >= 3 || kind === 'line', gold: !!C.gold, from };
      if (!this.pend) this.floor = this.lastT;
      this.pend += sec; this.flying.push(rec);
      this.flyChip(rec, C);
    },
    flyChip(rec, C) {
      const el = this.chipEls[this.chipI++ % this.chipEls.length], hr = this.hostRect;
      el.textContent = '+' + (rec.sec >= 10 ? Math.round(rec.sec) : rec.sec.toFixed(1)) + 's';
      el.className = 'fz-chip' + (rec.big ? ' big' : rec.sec >= 1.5 ? ' mid' : '');
      el.style.setProperty('--c', C.c); el.style.setProperty('--cg', C.g);
      el.getAnimations().forEach((a) => a.cancel());
      const tx = this.rx, ty = this.ry - 2;
      if (BR.reducedMotion) { el.animate([{ opacity: 0, transform: `translate3d(${tx}px,${ty - 18}px,0) translate(-50%,-50%)` }, { opacity: 1, offset: 0.2, transform: `translate3d(${tx}px,${ty - 18}px,0) translate(-50%,-50%)` }, { opacity: 0, transform: `translate3d(${tx}px,${ty - 18}px,0) translate(-50%,-50%)` }], { duration: 700, delay: Math.max(0, rec.t0 - now()), fill: 'both' }); return; }
      const f = rec.from, sx = f ? f.x - hr.left : this.rx, sy = f ? f.y - hr.top : this.ry + 120;
      // an arc: the control point sits above the straight line, toward the side the chip comes from
      const cx = sx + (tx - sx) * 0.35 + (sx < tx ? -30 : 30), cy = Math.min(sy, ty) - 80;
      const N = 9, frames = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, e = Math.pow(u, 1.7), w = 1 - e;
        const x = w * w * sx + 2 * w * e * cx + e * e * tx, y = w * w * sy + 2 * w * e * cy + e * e * ty;
        const sc = (0.62 + 0.62 * Math.sin(Math.min(1, u * 1.6) * 1.5708)) * (1 - 0.45 * Math.pow(u, 4)) * (rec.big ? 1.14 : 1);
        frames.push({ transform: `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%) scale(${sc.toFixed(3)})`, opacity: u < 0.08 ? u / 0.08 : u > 0.88 ? 1 - (u - 0.88) / 0.12 : 1 });
      }
      el.animate(frames, { duration: rec.dur, delay: Math.max(0, rec.t0 - now()), easing: 'linear', fill: 'both' });
    },
    /** chips that have arrived: let the gain through, grow the rope with a little overshoot, glint, flare, ring */
    land(tnow) {
      for (let i = this.flying.length - 1; i >= 0; i--) {
        const r = this.flying[i];
        if (tnow < r.t0 + r.dur) continue;
        this.flying.splice(i, 1);
        this.pend = Math.max(0, this.pend - r.sec);
        if (this.flying.length === 0) this.pend = 0;
        this.arrive(r);
      }
    },
    arrive(r) {
      const f0 = clamp(this.d / this.fmax, 0, 1), f1 = clamp((this.d + r.sec) / this.fmax, 0, 1);
      this.spring = r.gold ? 0.9 : 0.7; this.v = 0;
      if (r.gold && !BR.reducedMotion) {
        // a Line Blast respools in one golden sweep: the rope grows over half a second, gold along the new piece
        this.resp = { t0: now(), from: this.d, to: Math.min(this.fmax, this.d + r.sec), dur: 520 }; this.spring = 0;
        if (this.gold) this.gold.animate([{ opacity: 0 }, { opacity: 0.8, offset: 0.2 }, { opacity: 0 }], { duration: 900 });
        this.burstGlints(f0, f1, 12);
      }
      if (!BR.reducedMotion) {
        const px0 = this.L * f0 - 17, px1 = this.L * f1 - 17;
        if (this.glint) this.glint.animate([{ transform: `translate3d(${px0}px,0,0)`, opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translate3d(${px1 + 8}px,0,0)`, opacity: 0.9, offset: 0.75 }, { transform: `translate3d(${px1 + 14}px,0,0)`, opacity: 0 }], { duration: r.gold ? 520 : 340, easing: 'ease-out' });
        this.pop(this.flare, r.big ? 1.7 : 1.3 + Math.min(0.3, r.sec * 0.08), r.big ? 420 : 300);
        this.pop(this.numBox, 1.14, 240);
      }
      if (r.big && this.burstEl) {
        const b = this.burstEl; b.style.left = this.rx + 'px'; b.style.top = this.ry + 'px';
        b.animate([{ transform: 'scale(0.5)', opacity: 0.95 }, { transform: 'scale(1.7)', opacity: 0 }], { duration: BR.reducedMotion ? 200 : 520, easing: 'ease-out' });
      }
      if (BR.audio && BR.audio.timeGain) BR.audio.timeGain(r.big ? 7 : Math.min(6, Math.round(r.sec * 2)));
      if (r.big && BR.audio && BR.audio.timeGain) setTimeout(() => BR.audio.timeGain(3), 90);
    },
    /** a Fuse brick bursts: the rope burns the seconds away at speed with a red flash, the readout shakes, a red chip drops out of it */
    burst(sec) {
      if (!this.ok || !(sec > 0)) return;
      if (!this.hostRect) this.layout();
      const f1 = clamp(this.d / this.fmax, 0, 1), f0 = clamp((this.d - sec) / this.fmax, 0, 1);
      this.fast = true; this.spring = 0; this.v = 0;
      if (BR.reducedMotion) { this.chipDrop(sec); return; }
      const bf = this.burnFlash;
      if (bf) { bf.style.left = this.L * f0 + 'px'; bf.style.width = Math.max(6, this.L * (f1 - f0)) + 'px'; bf.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0 }], { duration: 560, easing: 'ease-out' }); }
      if (this.redFlash) this.redFlash.animate([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, offset: 0.2, transform: 'scale(1.3)' }, { opacity: 0, transform: 'scale(1.6)' }], { duration: 520 });
      if (this.numBox && !BR.lowEnd) this.numBox.animate([{ translate: '0 0' }, { translate: '-5px 0', offset: 0.15 }, { translate: '5px 0', offset: 0.35 }, { translate: '-3px 0', offset: 0.55 }, { translate: '2px 0', offset: 0.75 }, { translate: '0 0' }], { duration: 320 });
      if (!BR.lowEnd) this.pop(this.pulse, 1.12, 260);
      this.setMood('panic', 0.7, '', 0);
      this.chipDrop(sec);
    },
    chipDrop(sec) {
      const el = this.chipEls[this.chipI++ % this.chipEls.length], x = this.rx, y = this.ry;
      el.textContent = '-' + (sec >= 10 ? Math.round(sec) : +sec.toFixed(1)) + 's';
      el.className = 'fz-chip big'; el.style.setProperty('--c', '#ff4d6d'); el.style.setProperty('--cg', 'rgba(255,60,90,0.7)');
      el.getAnimations().forEach((a) => a.cancel());
      if (BR.reducedMotion) { el.animate([{ opacity: 0, transform: `translate3d(${x}px,${y + 24}px,0) translate(-50%,-50%)` }, { opacity: 1, offset: 0.2, transform: `translate3d(${x}px,${y + 24}px,0) translate(-50%,-50%)` }, { opacity: 0, transform: `translate3d(${x}px,${y + 24}px,0) translate(-50%,-50%)` }], { duration: 800, fill: 'both' }); return; }
      el.animate([
        { opacity: 0, transform: `translate3d(${x}px,${y}px,0) translate(-50%,-50%) scale(0.6)` },
        { opacity: 1, offset: 0.14, transform: `translate3d(${x + 4}px,${y + 10}px,0) translate(-50%,-50%) scale(1.15)` },
        { opacity: 1, offset: 0.5, transform: `translate3d(${x + 10}px,${y + 34}px,0) translate(-50%,-50%) scale(1) rotate(5deg)` },
        { opacity: 0, transform: `translate3d(${x + 16}px,${y + 78}px,0) translate(-50%,-50%) scale(0.9) rotate(10deg)` },
      ], { duration: 820, easing: 'cubic-bezier(0.3,0.1,0.6,1)', fill: 'both' });
    },
    /** a chip with no time change behind it (a label like "+2s" from the board's middle) */
    chip(text, color, from) { const sec = parseFloat(text.replace(/[^\d.]/g, '')) || 1; this.gain(sec, from, color === '#c4b5ff' ? 'shuffle' : color === '#3ddc97' ? 'defuse' : color === '#7ee8ff' ? 'power' : 'pop'); },

    /** a stage-up: the rope respools from the bomb to full in about 0.6s; the freeze that follows holds with a cool shimmer */
    stageUp() {
      if (!this.ok) return;
      this.flying.length = 0; this.pend = 0;
      this.resp = { t0: now(), from: Math.min(this.d, 1), to: this.fmax, dur: BR.reducedMotion ? 80 : 620 };
      this.d = this.resp.from; this.fshown = -1;
      this.setMood('glad', 1.4, '', 0);
      this.pop(this.flare, 1.6, 380); this.pop(this.pulse, 1.1, 300);
      this.burstGlints(0, 0.9, 10);
    },
    sparkStart() { this.savedFlag = false; if (this.ok) this.pop(this.pulse, 1.2, 260); },
    sparkEnd(saved) { this.savedFlag = !!saved; },
    rushStart() { if (!this.ok) return; this.burstGlints(0, clamp(this.d / this.fmax, 0, 1), 8); this.pop(this.pulse, 1.12, 280); },
    /** Rush is over: the frost cracks off the rope and flies away in ice shards, and the flame comes back */
    rushEnd() {
      if (!this.ok) return;
      const h = this.host; h.classList.add('fz-shatter'); clearTimeout(this._sh); this._sh = setTimeout(() => h.classList.remove('fz-shatter'), 460);
      if (!BR.reducedMotion && !BR.lowEnd) {
        const P = this.parts, y = this.cvTop + this.tyH, f = clamp(this.d / this.fmax, 0, 1);
        for (let i = 0; i < 16; i++) P.shardAt(this.tx0 + this.x0 + this.L * f * Math.random(), y + rnd(-6, 6), rnd(-90, 90), -rnd(60, 200));
      }
      this.pop(this.flare, 1.8, 360);
    },
    /** the bomb goes off */
    fuseOut() { if (this.ok) this.setMood('boom', 5, '', 0); },
    /** the heartbeat (called with the sound): the bomb swells, the vignette and the number pulse */
    beat() {
      if (!this.ok || BR.reducedMotion) return;
      if (BR.lowEnd) return;
      this.pulse.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1)', offset: 0.2 }, { transform: 'scale(0.98)', offset: 0.42 }, { transform: 'scale(1.06)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: 340, easing: 'ease-out' });
      if (this.vig && this.vig.classList.contains('on')) this.vig.animate([{ opacity: 0.7 }, { opacity: 1, offset: 0.2 }, { opacity: 0.7 }], { duration: 380 });
      this.pop(this.numBox, 1.18, 260);
    },
    /** for tests and the fuse sheet */
    debug() { return { z: this.z, x: this.bomb && this.bomb.dataset.x, d: this.d, pend: this.pend, particles: this.parts ? this.parts.live : 0, cls: this.cls, mood: this.mood }; },
  };
  BR.Fuse = Fuse;
  if (BR.Skins && BR.Skins.applyHooks) BR.Skins.applyHooks.push(() => Fuse.sync());
})();
