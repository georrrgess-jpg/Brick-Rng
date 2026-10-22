/* Series 3 "Carnival" pops: BR.PopRecipes (one call per popped brick) and the four pop moments
   (thunderpop, ink, novapop, firepop). Everything draws on the shared fx canvas; the moments add at most a
   handful of short-lived DOM nodes and never touch the board's layout.

   Recipes only use what fx.js already has: additive `spark` discs, source-over `shard`s (rect, tri, petal, star),
   `conf` paper, rings and bolts. Where a recipe needs to steer a particle after it was emitted (a bubble that
   pops, a coin that bounces) it keeps the particle object and edits it from a few setTimeouts that stop when it dies, so there is
   no loop of its own.

   About `n`: it is the particle budget of one brick and it shrinks as the pop grows (9 for up to six bricks, 7 up to
   fourteen, 5 up to twenty-eight, 3 beyond), then scales again for low-end and reduced motion. Recipes read n <= 7 as
   "this pop is a crowd" and thin themselves out (no per-brick rings, fewer layers) so a big pop stays readable and
   cheap. In the moments below `n` is the other one: the number of bricks in the group. */
(function () {
  const BR = (window.BR = window.BR || {});
  const PR = (BR.PopRecipes = BR.PopRecipes || {});
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const later = (fn, ms) => setTimeout(fn, ms);
  /** Emit a particle and hand the live object back (null at the particle cap) so a recipe can steer it later. */
  const put = (fx, p) => { const k = fx.parts.length; fx.emit(p); return fx.parts.length > k ? fx.parts[k] : null; };
  const alive = (p) => !!p && p.life < p.max;
  /** A short bright dot: the white "pop" at the heart of a burst. */
  const glint = (fx, x, y, size, max, color) => fx.emit({ kind: 'spark', x, y, size, max, color });

  /* The last group a moment saw, so the recipes of the same pop can lean away from its centre. */
  const G = { x: 0, y: 0, t: -1e9 };

  /* ===================================================================== COMMON */

  /** Confetti: a quick puff of paper squares that flutter down. */
  PR.confetti = function ({ x, y, glow, hi, n, power }) {
    const cols = [glow, hi, '#ff5fa8', '#ffd24a', '#4de1ff', '#6bff9e', '#b36bff', '#ffffff'];
    const k = Math.min(16, Math.ceil(n * 1.55));
    for (let i = 0; i < k; i++) {
      const a = rnd(0, TAU), sp = rnd(170, 470) * power;
      this.emit({ kind: 'conf', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140, g: 260, drag: 2.7, rot: rnd(0, TAU), vr: rnd(-13, 13), sway: rnd(0, TAU), size: rnd(9, 15), max: rnd(1.05, 1.6), color: cols[i % cols.length] });
    }
    glint(this, x, y, 9 + 3 * power, 0.1, '#ffffff');
  };

  /** Bubbles: soap bubbles drift up, then each one pops into a ring and a few drops. */
  PR.bubbles = function ({ x, y, n, power }) {
    const fx = this, k = clamp(Math.round(n / 2.2), 2, 4);
    /* body + rim add up to a pale pearl in the middle and a coloured edge: a soap-film look from two discs */
    const tints = [['#1a86ac', '#d050a0'], ['#6a58c0', '#30b8d0'], ['#2aa088', '#d070b0'], ['#4a7ac8', '#d0a040']];
    const a0 = rnd(0, TAU);
    for (let i = 0; i < k; i++) {
      const s = rnd(9, 13) * (0.9 + 0.1 * power), a = a0 + (i / k) * TAU + rnd(-0.4, 0.4);
      const bx = x + Math.cos(a) * rnd(13, 21), by = y + Math.sin(a) * rnd(11, 18) - 4;
      const vx = Math.cos(a) * rnd(50, 120), vy = rnd(-170, -80) + Math.sin(a) * 40, life = rnd(0.5, 0.95);
      const base = { vx, vy, g: -60, drag: 2.1, max: life / 0.3 };
      const t = tints[i % tints.length];
      const rim = put(fx, Object.assign({ kind: 'spark', x: bx, y: by, size: s * 1.1, color: t[1] }, base));
      const body = put(fx, Object.assign({ kind: 'spark', x: bx, y: by, size: s * 0.86, color: t[0] }, base));
      const spec = put(fx, Object.assign({ kind: 'spark', x: bx - s * 0.32, y: by - s * 0.36, size: s * 0.24, color: '#ffffff' }, base));
      later(() => {
        if (!alive(body)) return;
        const px = body.x, py = body.y;
        [rim, body, spec].forEach((p) => { if (p) p.max = 0; });
        fx.ring(px, py, '#e2f8ff', s * 2.2, 0.26, 2.4);
        for (let d = 0; d < 3; d++) { const q = rnd(0, TAU), sp = rnd(80, 190); fx.emit({ kind: 'spark', x: px, y: py, vx: Math.cos(q) * sp, vy: Math.sin(q) * sp, g: 300, drag: 2, size: rnd(1.4, 2.2), max: rnd(0.28, 0.45), color: '#e6fbff' }); }
      }, life * 1000);
    }
  };

  /* ===================================================================== RARE */

  /** Coins: gold coins toss up and spin, bounce once or twice on an invisible floor, then cash out with a glint. */
  PR.coins = function ({ x, y, n, power }) {
    const fx = this, k = clamp(Math.round(n * 0.45), 1, 5), floor = y + rnd(30, 38), coins = [];
    for (let i = 0; i < k; i++) {
      const s = rnd(8.2, 9.8), cx = x + rnd(-10, 10);
      const base = { vx: rnd(-110, 110), vy: -rnd(330, 470) * Math.min(1.2, power), g: 1700, drag: 0, max: 3 };
      const rim = put(fx, Object.assign({ kind: 'spark', x: cx, y, size: s, color: '#b8620a' }, base));
      if (!rim) break;
      const parts = [rim,
        put(fx, Object.assign({ kind: 'spark', x: cx, y, size: s * 0.8, color: '#ffc83d' }, base)),
        put(fx, Object.assign({ kind: 'spark', x: cx, y, size: s * 0.4, color: '#fff3b0' }, base))];
      coins.push({ s, parts });
      let bounces = 0;
      const land = (vy, py) => clamp(((-vy + Math.sqrt(Math.max(0, vy * vy + 2 * base.g * (floor - py)))) / base.g) * 1000, 30, 700);
      const step = () => {
        if (!alive(rim)) return;
        if (bounces >= 2) {
          const px = rim.x, py = rim.y;
          parts.forEach((p) => { if (p) p.max = 0; });
          fx.emit({ shape: 'star', x: px, y: py, size: 10, vx: 0, vy: -50, g: 0, drag: 1, max: 0.26, rot: rnd(0, 1), vr: 5, color: '#fff3b0' });
          return;
        }
        parts.forEach((p) => { if (p) { p.y = Math.min(p.y, floor); p.vy = -Math.abs(p.vy) * 0.5; p.vx *= 0.8; } });
        bounces++;
        glint(fx, rim.x, floor, 6, 0.12, '#fff3b0');
        later(step, land(rim.vy, rim.y));
      };
      later(step, land(base.vy, y));
    }
    /* spin: every 70ms each coin flips between its face (a round disc) and a turned, narrow ellipse */
    let tick = 0;
    const turn = (c, on) => {
      const r = c.parts[0], f = c.parts[1];
      if (!alive(r) || !f) return;
      if (on) { r.kind = f.kind = 'shard'; r.shape = f.shape = 'petal'; r.rot = f.rot = Math.PI / 2; r.sway = f.sway = 0; r.size = c.s * 0.98; f.size = c.s * 0.8; r.color = '#e8920c'; f.color = '#ffd24a'; }
      else { r.kind = f.kind = 'spark'; r.size = c.s; f.size = c.s * 0.8; r.color = '#b8620a'; f.color = '#ffc83d'; }
    };
    const spin = () => { tick++; coins.forEach((c, i) => turn(c, (tick + i * 2) % 5 < 2)); if (tick < 12) later(spin, 70); };
    if (coins.length) later(spin, 70);
    glint(this, x, y, 11, 0.1, '#ffd24a');
  };

  /** Leaves: autumn leaves tumble and sway down. */
  PR.leaves = function ({ x, y, glow, n, power }) {
    const cols = ['#ff8a3d', '#e8542c', '#ffc83d', '#c4541c', '#e0a030'];
    const k = Math.ceil(n * 0.85);
    for (let i = 0; i < k; i++) {
      const c = cols[i % cols.length], s = rnd(11, 16) * (0.9 + 0.1 * power), tri = i % 3 === 2;
      this.emit({ kind: 'shard', shape: tri ? 'tri' : 'petal', x: x + rnd(-6, 6), y, vx: rnd(-250, 250), vy: rnd(-420, -110), g: 320, drag: 1.7, rot: rnd(0, TAU), vr: rnd(-6, 6), size: tri ? s * 0.8 : s, max: rnd(1.15, 1.7), color: c, sway: rnd(0, TAU) });
    }
    glint(this, x, y, 8, 0.1, '#ffe0a0');
    if (n > 5) glint(this, x, y, 15, 0.16, glow); // the brick's own colour for a beat, so you can tell what popped
  };

  /* ===================================================================== EPIC */

  /** Neon: crisp rings pulse out in two colors, with neon rods and, on a small pop, a laser cross.
      Update 5: the rods are fatter and each one carries a soft glow of its own colour (a stepped additive disc that travels with it, so it reads as a lit
      tube and not a pill); the first ring is bolder, a ring in the popped brick's own colour follows it even in a crowd (so you can see what popped), and the
      core flares as a white four-point flash. */
  PR.neon = function ({ x, y, glow, n, power }) {
    const fx = this, C = ['#3dffd0', '#ff3dc8'], GLOW = ['#093e36', '#44093a', '#2a3030'], k = clamp(Math.round(n * 0.7), 3, 7), a0 = rnd(0, TAU);
    for (let i = 0; i < k; i++) {
      const a = a0 + (i / k) * TAU + rnd(-0.15, 0.15), sp = rnd(300, 520) * power, w = i % 3 === 2 ? 2 : i % 2, c = i % 3 === 2 ? '#ffffff' : C[i % 2], max = rnd(0.3, 0.42);
      const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
      this.emit({ kind: 'shard', shape: 'petal', x, y, vx, vy, g: 0, drag: 3.6, rot: a, vr: 0, sway: 0, size: 8.5, max, color: c });
      this.emit({ kind: 'spark', x, y, vx, vy, g: 0, drag: 3.6, size: 13, max, color: GLOW[w] });
      if (n >= 7) this.emit({ kind: 'spark', x, y, vx, vy, g: 0, drag: 3.6, size: 8, max, color: w === 2 ? '#4a5656' : w ? '#7a1068' : '#0e7a68' });
    }
    if (n >= 7 || power >= 1.4) {
      /* two short bolts laid end to end read as one straight, buzzing laser tube */
      const ax = Math.random() < 0.5 ? 0 : Math.PI / 2, col = C[(Math.random() * 2) | 0], seg = 16 * (0.9 + 0.1 * power);
      [0, Math.PI].forEach((d) => {
        const a = ax + d, cx = Math.cos(a), cy = Math.sin(a);
        for (let s = 0; s < 2; s++) this.bolt(x + cx * (6 + s * seg), y + cy * (6 + s * seg), x + cx * (6 + (s + 1) * seg), y + cy * (6 + (s + 1) * seg), col);
      });
    }
    const R = (30 + n * 3) * (0.9 + 0.1 * power);
    this.ring(x, y, C[0], R, 0.38, 6);
    this.ring(x, y, glow, R * 0.6, 0.32, 3.5);
    if (n > 7) { // a crowd of rings turns into a lattice, so a big pop keeps just the two
      later(() => fx.ring(x, y, C[1], R * 0.78, 0.3, 3.5), 70);
      later(() => fx.ring(x, y, '#ffffff', R * 0.5, 0.24, 2.2), 140);
    }
    this.emit({ shape: 'star', x, y, vx: 0, vy: 0, g: 0, drag: 1, size: 12 + 4 * power, max: 0.12, rot: Math.PI / 4, vr: 0, color: '#ffffff' });
    glint(this, x, y, 10, 0.1, '#ffffff');
    if (n > 5) glint(this, x, y, 16, 0.16, glow);
  };
  /** Snow: six-armed crystals and soft dots float up from the pop, then settle slowly.
      Update 5 (Glass and Snow looked alike: pale triangles on a pale blue): the flakes are now baked six-armed crystals with side twigs (white with a cold
      glow) that turn slowly and sway, the rest is soft round dots and a pool of frost under the pop. Nothing sharp, nothing fast, nothing in the brick's
      colour; Glass (js/u4-cosmetics.js) is the sharp, quick, tinted one. The crystals are steered by the shared loop in normal mode only. */
  const flakeImg = (v) => BR.FX.bake('u5flake' + v, 30, 30, (g, w, h) => {
    g.translate(w / 2, h / 2); g.lineCap = 'round'; g.strokeStyle = '#ffffff'; g.shadowColor = 'rgba(150,215,255,0.9)'; g.shadowBlur = 3;
    for (let a = 0; a < 6; a++) {
      g.save(); g.rotate((a * Math.PI) / 3);
      g.lineWidth = 1.9; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -13); g.stroke();
      g.lineWidth = 1.4; g.beginPath();
      if (v === 1) { g.moveTo(0, -5); g.lineTo(-4, -9); g.moveTo(0, -5); g.lineTo(4, -9); g.moveTo(0, -9); g.lineTo(-3, -12); g.moveTo(0, -9); g.lineTo(3, -12); }
      else { g.moveTo(-3.2, -9); g.lineTo(0, -13); g.lineTo(3.2, -9); g.moveTo(-2.4, -5.5); g.lineTo(2.4, -5.5); }
      g.stroke(); g.restore();
    }
    g.beginPath(); g.arc(0, 0, 2.4, 0, TAU); g.fillStyle = '#ffffff'; g.fill();
  });
  function flakeStep(p, dt, e) {
    p.sx = 0.72 + 0.28 * Math.cos(p.life * 2.3 + e.ph);
    p.vx += Math.sin(p.life * 3 + e.ph) * 46 * dt;
  }
  PR.snow = function ({ x, y, hi, n, power }) {
    const cols = ['#ffffff', '#d6efff', '#bfe8ff'], fx = this, U4 = BR.U4;
    const flakes = clamp(Math.round(n * 0.4), 1, 4), steered = !!U4 && !BR.lowEnd && !BR.reducedMotion;
    for (let i = 0; i < flakes; i++) {
      const k = fx.parts.length;
      if (fx.sprite) fx.sprite({ img: flakeImg(1 + (i % 2)), x: x + rnd(-8, 8), y: y + rnd(-6, 4), vx: rnd(-110, 110), vy: rnd(-190, -50), g: 50, drag: 2.5, size: rnd(13, 19), rot: rnd(0, TAU), vr: rnd(-1.4, 1.4), max: rnd(1.5, 2.1), a: 1 });
      if (steered && fx.parts.length > k) U4.steer(fx.parts[k], flakeStep, { ph: rnd(0, TAU) });
    }
    for (let i = 0; i < Math.ceil(n * 0.6); i++) {
      const a = rnd(0, TAU), sp = rnd(30, 190);
      this.emit({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 40, drag: 2.2, size: rnd(2.6, 4), max: rnd(1.1, 1.7), color: cols[i % 3] });
    }
    if (n > 5) { glint(this, x, y, 28, 0.3, '#05101a'); glint(this, x, y, 20, 0.32, '#0a1e30'); glint(this, x, y, 12, 0.34, '#12344c'); }
    glint(this, x, y, 5, 0.3, '#ffffff');
    for (let i = 0; i < (n > 5 ? 2 : 0); i++) { const a = rnd(0, TAU), sp = rnd(60, 160); this.emit({ shape: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, g: 0, drag: 1.8, size: rnd(4, 6), max: rnd(0.45, 0.7), rot: rnd(0, 1), vr: 3, color: '#dff3ff' }); }
    if (n > 5) glint(this, x, y, 4, 0.1, hi);
    if (n > 7) this.ring(x, y, '#bfe8ff', 38, 0.5, 2.4);
  };

  /* ===================================================================== LEGENDARY */

  /** Thunder: a yellow crack drops onto the brick, with a white flash star and a ring of sparks. */
  PR.thunder = function ({ x, y, glow, n, power }) {
    const big = power >= 1.4;
    if (n > 7 || big || Math.random() < 0.15) this.bolt(x + rnd(-14, 14), y - rnd(70, 100) * (big ? 2.2 : 1), x, y, '#ffe65a');
    this.emit({ shape: 'star', x, y, vx: 0, vy: 0, g: 0, drag: 1, size: (n > 7 ? 15 : 11) + 3 * power, max: 0.18, rot: rnd(0, 1), vr: 3, color: '#fffbd0' });
    glint(this, x, y, 12, 0.12, '#ffffff');
    if (n > 5) glint(this, x, y, 20, 0.2, glow);
    const cols = ['#fff6a8', '#ffe65a', '#9fb8ff'];
    for (let i = 0; i < Math.ceil(n * 1.1); i++) {
      const a = rnd(0, TAU), sp = rnd(240, 560) * power;
      this.emit({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, drag: 3.4, size: rnd(1.8, 3.4), max: rnd(0.28, 0.5), color: cols[i % 3] });
    }
    if (n > 7 || big) this.ring(x, y, '#fff3a0', 36 + 14 * power, 0.28, 3.4);
  };

  /** Ink: a glossy splat blooms where the brick was and dark drops streak out of it. */
  PR.ink = function ({ x, y, glow, n, power }) {
    /* a big pop leaves a splat in every cell, so each one is smaller and goes sooner and the next bricks stay readable */
    const crowd = n <= 7, life = crowd ? rnd(0.38, 0.55) : rnd(0.8, 1.1), rot0 = rnd(0, 1), L = n <= 5 ? 2 : crowd ? 3 : 5;
    const sz = (crowd ? rnd(11, 14) : rnd(17, 22)) * (0.9 + 0.1 * power);
    const lobe = (size, rot, color, max) => this.emit({ kind: 'shard', shape: 'petal', sway: 0, x, y, vx: 0, vy: 0, g: 0, drag: 1, rot, vr: 0, size, max, color });
    /* uneven lobes at uneven angles so it reads as a splat and not a flower */
    const k = [];
    for (let i = 0; i < L; i++) k.push([(i * Math.PI) / L + rnd(-0.28, 0.28), rnd(0.7, 1.15)]);
    k.forEach(([a, m]) => lobe(sz * m, rot0 + a, '#7a3df0', life));
    k.forEach(([a, m]) => lobe(sz * m * 0.68, rot0 + a + 0.12, '#1d0852', life));
    for (let i = 0; i < (n <= 3 ? 0 : n <= 5 ? 1 : crowd ? 2 : 4); i++) {
      const a = rnd(0, TAU), r = sz * rnd(0.95, 1.35);
      this.emit({ kind: 'shard', shape: 'petal', sway: 0, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, vx: 0, vy: 0, g: 0, drag: 1, rot: a, vr: 0, size: rnd(3.5, 6), max: life * 0.9, color: '#4a1fb0' });
    }
    if (n > 5) glint(this, x, y, sz * 1.5, 0.16, '#3a1a7a');
    glint(this, x - sz * 0.22, y - sz * 0.26, 3.2, life * 0.75, '#e0c8ff');
    const cols = ['#5a2ab8', '#7b3df0', '#3a1480', '#b58aff'];
    for (let i = 0; i < (n <= 3 ? 1 : Math.ceil(n * (n <= 5 ? 0.6 : 0.8))); i++) {
      const a = rnd(0, TAU), sp = rnd(210, 540) * power;
      const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp - 60;
      this.emit({ kind: 'shard', shape: 'petal', sway: 0, x, y, vx, vy, g: 520, drag: 3, rot: Math.atan2(vy, vx), vr: 0, size: rnd(5, 10), max: rnd(0.5, 0.95), color: i % 4 === 3 ? glow : cols[i % cols.length] });
    }
  };

  /* ===================================================================== MYTHIC */

  /** Supernova: a ring of stars collapses into the brick, then it goes off in a flash and a burst of stars. */
  PR.supernova = function ({ x, y, glow, n, power }) {
    const fx = this, T = 0.2, d = 4, R = 44 * (0.9 + 0.1 * power);
    const v0 = (R * d) / (Math.exp(d * T) - 1), k = clamp(n - 2, 4, 8);
    const cols = ['#fff2a8', '#ffffff', glow], stars = [];
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU + rnd(-0.2, 0.2), cx = Math.cos(a), cy = Math.sin(a);
      /* they live longer than the collapse so they stay bright until the flash takes them */
      stars.push(put(this, { shape: 'star', x: x + cx * R, y: y + cy * R, vx: -cx * v0, vy: -cy * v0, g: 0, drag: -d, size: 6, max: T * 1.9, rot: rnd(0, TAU), vr: 9, color: cols[i % 3] }));
    }
    later(() => {
      stars.forEach((p) => { if (p) p.max = 0; });
      /* a soft bloom built from stepped discs */
      if (n >= 6) { glint(fx, x, y, 38, 0.22, '#2a1a12'); glint(fx, x, y, 29, 0.24, '#4a3420'); }
      glint(fx, x, y, 21, 0.26, '#8a6a3a');
      glint(fx, x, y, 13, 0.28, '#d8b868');
      glint(fx, x, y, 7, 0.3, '#ffffff');
      if (n > 7 || power >= 1.4) fx.ring(x, y, '#fff2a8', 40 + n * 3 + 8 * power, 0.4, 4);
      const sc = ['#ffffff', '#fff2a8', '#ff9ad8'];
      for (let i = 0; i < Math.ceil(n * 0.55); i++) {
        const a = rnd(0, TAU), sp = rnd(300, 560);
        fx.emit({ shape: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3.2, size: rnd(8, 13), max: rnd(0.38, 0.62), rot: rnd(0, TAU), vr: rnd(-8, 8), color: sc[i % 3] });
      }
    }, T * 1000);
  };

  /** A tongue of flame: a stack of discs that narrows and cools toward the tip and leans the way it is blown. */
  const flame = (fx, x, y, vx, vy, s, life, lean, thin) => {
    const base = { vx, vy, g: -330, drag: 1.7, max: life };
    const layer = (size, color, dx, dy) => fx.emit(Object.assign({ kind: 'spark', x: x + dx, y: y + dy, size, color }, base));
    layer(s, '#d85a10', 0, 0);
    layer(s * 0.66, '#ffa02a', 0, 0);
    layer(s * 0.34, '#fff0b0', 0, 0);
    layer(s * 0.78, '#e8480e', lean * s * 0.55, -s * 0.62);
    if (!thin) layer(s * 0.5, '#b82408', lean * s * 1.15, -s * 1.3);
  };

  /** Dragon fire: tongues of flame sweep away from the group, hot at the base and red at the tip, with embers behind. */
  PR.dragonfire = function ({ x, y, n, power }) {
    const fresh = performance.now() - G.t < 700, dirFor = fresh ? Math.sign(x - G.x) || (Math.random() < 0.5 ? -1 : 1) : (Math.random() < 0.5 ? -1 : 1);
    const k = clamp(Math.round(n / 4.5), 1, 2);
    for (let i = 0; i < k; i++) {
      const dir = Math.random() < 0.75 ? dirFor : -dirFor;
      flame(this, x + rnd(-6, 6), y + rnd(-2, 8), dir * rnd(100, 300) * power, rnd(-190, -30), rnd(11, 15) * (0.9 + 0.1 * power), rnd(0.5, 0.78), dir, n <= 5);
    }
    for (let i = 0; i < (n <= 5 ? 1 : Math.ceil(n * 0.4)); i++) this.emit({ kind: 'spark', x, y, vx: rnd(-160, 160), vy: rnd(-320, -90), g: -60, drag: 1.2, size: rnd(1.6, 3), max: rnd(0.6, 1), color: pick(['#ffb02e', '#ff7a2a', '#ffe08a']) });
    if (n > 5) glint(this, x, y, 13, 0.1, '#ffd24a');
  };

  /* ===================================================================== MOMENTS */
  const centroid = (cells) => {
    let sx = 0, sy = 0;
    cells.forEach((q) => { sx += q.x; sy += q.y; });
    return { x: sx / cells.length, y: sy / cells.length };
  };
  const boardRect = (ctx, c) => {
    if (ctx.view) return ctx.view.boardEl.getBoundingClientRect();
    return { left: c.x - 160, right: c.x + 160, top: c.y - 220, bottom: c.y + 220, width: 320, height: 440 };
  };

  BR.Skins.handlers.push((type, d, ctx) => {
    if (BR.reducedMotion || (type !== 'pop' && type !== 'demo') || !ctx.cells || !ctx.cells.length) return;
    const { M, fx, rnd: r, cells, n } = ctx;
    if (!M.thunderpop && !M.ink && !M.novapop && !M.firepop) return;
    const c = centroid(cells), b = boardRect(ctx, c);
    G.x = c.x; G.y = c.y; G.t = performance.now();

    if (M.thunderpop && n >= 7) {
      const top = type === 'demo' ? c.y - 260 : b.top - 24;
      const x1 = c.x + r(-10, 10);
      fx.bolt(x1 + r(-50, 50), top, x1, c.y, '#fff2a0');
      fx.bolt(x1 + r(-30, 30), top, x1, c.y, '#9fb8ff');
      if (cells.length > 1) { const q = cells[(Math.random() * cells.length) | 0]; fx.bolt(c.x, c.y - 10, q.x, q.y, '#ffe65a'); }
      fx.ring(c.x, c.y, '#fff7b0', 70 + n * 5, 0.42, 5);
      fx.flash('#dfe8ff', clamp(0.1 + n * 0.012, 0.12, 0.28), 280);
      const bg = document.getElementById('bg');
      if (bg && !M.thunder) {
        let el = bg.querySelector('.bolt-flash');
        if (!el) { el = document.createElement('i'); el.className = 'bolt-flash'; bg.appendChild(el); }
        el.style.setProperty('--bx', ((c.x / window.innerWidth) * 100).toFixed(0) + '%');
        el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
      }
      if (BR.audio && BR.audio.crackle) BR.audio.crackle();
    }

    if (M.novapop && n >= 8) {
      const R = Math.max(b.width, 260) * 0.95;
      /* the ripple is the shockwave of the bricks' own implosions, so it leaves just after they flash */
      later(() => fx.ring(c.x, c.y, '#fff2a8', R, 0.7, 5), 270);
      later(() => fx.ring(c.x, c.y, '#ff9ad8', R * 0.85, 0.62, 3.5), 380);
      later(() => fx.ring(c.x, c.y, '#9ff0ff', R * 0.7, 0.55, 2.5), 490);
      later(() => fx.flash('#fff2a8', 0.16, 320), 270);
    }

    if (M.firepop && n >= 4) {
      const roar = n >= 8, k = roar ? 5 : 3;
      [-1, 1].forEach((dir) => {
        for (let i = 0; i < k; i++) {
          later(() => flame(fx, c.x + dir * r(0, 14), c.y + r(-10, 10), dir * r(300, 640), r(-90, 10), r(9, 13), r(0.42, 0.7), dir), i * 28);
        }
      });
      if (roar) {
        fx.shake(document.getElementById('app'), 6, 320);
        fx.flash('#ff7a2a', 0.14, 280);
        fx.ring(c.x, c.y, '#ff9a3d', 110, 0.42, 5);
        if (BR.audio && BR.audio.boom) BR.audio.boom();
      }
    }

    if (M.ink && n >= 3) inkStains(ctx, type, c);
  });

  /* Ink: a few dark blobs on the board floor behind the bricks, so the next bricks fall in front of them. */
  const BLOB = ['58% 42% 55% 45% / 48% 56% 44% 52%', '46% 54% 40% 60% / 58% 42% 58% 42%', '52% 48% 62% 38% / 44% 60% 40% 56%'];
  function inkStains(ctx, type, c) {
    const { view, cells, n, fx } = ctx;
    if (!view) {
      cells.slice(0, 4).forEach((q) => { for (let i = 0; i < 3; i++) fx.emit({ kind: 'shard', shape: 'petal', sway: 0, x: q.x, y: q.y, g: 0, drag: 1, rot: (i * Math.PI) / 3, size: 14, max: 0.9, color: '#3a1480' }); });
      return;
    }
    const board = view.boardEl, br = board.getBoundingClientRect(), cell = view.cell;
    const pts = n > 6 ? [cells[0], cells[Math.floor(cells.length / 2)], cells[cells.length - 1]] : [cells[0], cells[cells.length - 1]];
    pts.forEach((q, i) => {
      const el = document.createElement('i'), sz = cell * (1.5 + Math.min(1.5, n * 0.1)) * (i ? 0.85 : 1.1);
      el.style.cssText = `position:absolute;pointer-events:none;left:${q.x - br.left - sz / 2}px;top:${q.y - br.top - sz / 2}px;width:${sz}px;height:${sz}px;border-radius:${BLOB[i % 3]};background:radial-gradient(circle at 38% 32%,#8a52ff 0,#4a1fb0 30%,#1d0a52 68%,#0d0426 100%);box-shadow:0 0 ${sz * 0.3}px rgba(120,60,255,.45);will-change:transform,opacity`;
      board.insertBefore(el, board.firstChild);
      const a = el.animate([
        { transform: 'scale(0.2) rotate(0deg)', opacity: 0 },
        { transform: 'scale(1.1) rotate(' + (i * 25 - 20) + 'deg)', opacity: 0.95, offset: 0.18 },
        { transform: 'scale(1) rotate(' + (i * 25 - 20) + 'deg)', opacity: 0.85, offset: 0.55 },
        { transform: 'scale(0.96) rotate(' + (i * 25 - 20) + 'deg)', opacity: 0 },
      ], { duration: 1150, easing: 'ease-out' });
      a.onfinish = a.oncancel = () => el.remove();
    });
  }
})();
