/* Update 4 cosmetics touch-up: one more motion idea for each of the six older pops, inside the same particle budget (Update 5 lifts four of them).
     Embers   rise white-hot and cool to red as they climb, wobbling in the heat (Update 5: denser and longer, with a soft glow, a trail and a rising heat plume)
     Petals   curl outward in a swirl and turn to face the way they fly
     Glass    Update 4: shards catch the light once each. Update 5: brick-coloured baked shards that tumble, flip and glint, so it no longer looks like Snow
     Pixels   hop on a grid as they scatter and fall, like a sprite explosion (Update 5: a white flash block, more and chunkier pixels, afterimage trails)
     Lightning  sparks crackle in zigzags, and a pop's bricks are joined by short arcs
     Fireworks  the burst starts white and turns to its colour, then glitters as it falls
   js/fx.js keeps the original recipes as a fallback and hands these six over. Update 4 emitted exactly the particles the original did; Update 5's four
   repainted ones (Embers, Glass, Pixels) emit more, inside the per-brick budget tests/u5-older.js enforces (3n + 8 particles per brick and 420 live on screen).
   Each recipe steers its particles (colour, size, position or velocity) from one shared frame loop that runs only while a steered particle is alive. No DOM
   per particle; nothing here touches the canvas drawing code, and reduced motion / low-end phones get the original recipes untouched. */
(function () {
  const BR = (window.BR = window.BR || {});
  const PR = (BR.PopRecipes = BR.PopRecipes || {});
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const calm = () => !!(BR.reducedMotion || BR.lowEnd);

  /* ------------------------------------------------------------------ the shared steering loop
     steer(p, fn, data): from now until particle p dies, fn(p, dt, data) runs once per frame (dt in seconds, real elapsed time, so it behaves
     the same at 60 and 120 Hz). The particle's own age is p.life / p.max. */
  const live = [];
  let running = false, last = 0;
  function tick(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i];
      if (e.p.life >= e.p.max) { live.splice(i, 1); continue; }
      e.fn(e.p, dt, e);
    }
    if (live.length) requestAnimationFrame(tick); else running = false;
  }
  function steer(p, fn, data) {
    if (!p) return;
    live.push(Object.assign({ p, fn }, data));
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
  }
  /** Emit a particle and hand the live object back (null at the particle cap). */
  const put = (fx, p) => { const k = fx.parts.length; fx.emit(p); return fx.parts.length > k ? fx.parts[k] : null; };
  /** Run a batch emitter (fx.sparks, fx.shards) and hand back the particles it added. */
  const batch = (fx, fn) => { const k = fx.parts.length; fn(); return fx.parts.slice(k); };
  BR.U4 = { steer, put, batch, live };

  /* ===================================================================== EMBERS
     Update 5: the embers were a handful of 2px sparks that nearly vanished on a big group. Now every brick throws real embers: bigger, longer-lived,
     white-hot at the start and cooling through yellow and orange to dull red as they climb, wobbling in the heat. Every fourth ember is a leader: it
     wears a soft glow (a baked radial-gradient sprite that follows it and cools with it) and leaves a short trail of sparks. Each brick also lifts one wide,
     soft plume of heat, and a group of twelve or more bricks adds up to a column of rising glow above the whole group instead of a sprinkle. Budget per
     brick: n + 1 embers, a glow for each leader, a trail only while the crowd is small (n >= 7), one plume, ceil(n / 3) shards. Only the embers are steered. */
  const E_HOT = '#fff4c8', E_Y = '#ffd24a', E_R = '#e0401c', E_D = '#7c1a10';
  const GLOW_RGB = [[255, 178, 70], [255, 120, 30], [214, 52, 12], [120, 26, 16]], GLOW_A = [0.85, 0.6, 0.38, 0.2];
  const glowImg = (k) => BR.FX.bake('u5emberglow' + k, 48, 48, (g, w, h) => {
    const c = GLOW_RGB[k], gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, `rgba(${c},0.8)`); gr.addColorStop(0.3, `rgba(${c},0.3)`); gr.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const heatImg = () => BR.FX.bake('u5heat', 64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,120,36,0.5)'); gr.addColorStop(0.4, 'rgba(230,70,18,0.2)'); gr.addColorStop(1, 'rgba(200,40,10,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const putImg = (fx, o) => { const k = fx.parts.length; if (fx.sprite) fx.sprite(o); return fx.parts.length > k ? fx.parts[k] : null; };
  function emberStep(p, dt, e) {
    const t = p.life / p.max;
    p.color = t < 0.14 ? E_HOT : t < 0.3 ? E_Y : t < 0.56 ? e.c : t < 0.82 ? E_R : E_D;
    p.vx += Math.sin(p.life * 11 + e.ph) * 300 * dt;                  // heat wobble
    p.size = e.s * (0.82 + 0.18 * Math.sin(p.life * 29 + e.ph)) * (1 - t * 0.12);   // flicker
    const h = e.halo;
    if (h && h.life < h.max) { const k = t < 0.3 ? 0 : t < 0.58 ? 1 : t < 0.82 ? 2 : 3; h.x = p.x; h.y = p.y; h.img = e.glows[k]; h.a = GLOW_A[k]; }
    if (e.trail > 0) {
      e.tcd -= dt;
      if (e.tcd <= 0) { e.tcd = 0.055; e.trail--; e.fx.emit({ kind: 'spark', x: p.x, y: p.y, vx: p.vx * 0.12 + rnd(-18, 18), vy: 24 + rnd(0, 26), g: -50, drag: 2, size: p.size * 0.78, max: rnd(0.2, 0.32), color: t < 0.3 ? E_Y : e.c }); }
    }
  }
  PR.u4ember = function ({ x, y, glow, n, power }) {
    const fx = this, cols = ['#ff8a1e', '#ff8a1e', '#ff6a24', '#ffa53c'], crowd = n < 7, glows = [0, 1, 2, 3].map(glowImg);
    for (let i = 0; i < n + 1; i++) {
      const s = rnd(2.8, 5.4), life = rnd(1.0, 1.75), lead = i % 4 === 0;
      const p = put(fx, { kind: 'spark', x: x + rnd(-9, 9), y: y + rnd(-4, 6), vx: rnd(-110, 110), vy: rnd(-340, -90), g: -140, drag: 0.9, size: s, max: life, color: E_HOT });
      if (!p) continue;
      const halo = lead ? putImg(fx, { img: glows[0], x: p.x, y: p.y, size: s * 7.5, max: life, a: GLOW_A[0] }) : null;
      steer(p, emberStep, { c: pick(cols), s, ph: rnd(0, TAU), halo, glows, fx, trail: lead && !crowd ? 2 : 0, tcd: rnd(0.02, 0.06) });
    }
    // heat: a wide soft plume per brick that rises; twelve of them overlap into one column of glow over the group
    putImg(fx, { img: heatImg(), x: x + rnd(-6, 6), y, vx: rnd(-20, 20), vy: rnd(-150, -90), g: -120, drag: 1.2, size: crowd ? rnd(34, 46) : rnd(46, 62), max: rnd(0.55, 0.85), a: crowd ? 0.9 : 0.75, grow: 0.5 });
    fx.shards(x, y, glow, Math.ceil(n / 3), 0.55);
    if (n >= 5) fx.emit({ kind: 'spark', x, y, size: 7 + 3 * power, max: 0.1, color: '#fff0c8' });
  };

  /* ===================================================================== PETALS
     Petals curl outward in a swirl (their velocity turns, a little faster at first) and point the way they are going. */
  function petalStep(p, dt, e) {
    const t = p.life / p.max, w = e.w * (1 - t * 0.7) * dt, c = Math.cos(w), s = Math.sin(w);
    const vx = p.vx * c - p.vy * s, vy = p.vx * s + p.vy * c;
    p.vx = vx; p.vy = vy;
    p.rot = Math.atan2(vy, vx) + e.tilt * Math.sin(p.life * 6 + e.ph);
    p.vr = 0;
  }
  PR.u4petal = function ({ x, y, glow, hi, n }) {
    const cols = [glow, '#ffd1e6', '#ffffff', hi], dir = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < Math.ceil(n * 0.9); i++) {
      const p = put(this, { kind: 'shard', shape: 'petal', x, y, vx: rnd(-190, 190), vy: rnd(-260, -50), g: 150, drag: 1.3, rot: rnd(0, TAU), vr: rnd(-6, 6), size: rnd(5, 9), max: rnd(1.2, 2), color: pick(cols), sway: rnd(0, TAU) });
      steer(p, petalStep, { w: dir * (i % 3 === 2 ? -1 : 1) * rnd(2.6, 4.4), tilt: rnd(0.2, 0.7), ph: rnd(0, TAU) });
    }
  };

  /* ===================================================================== GLASS
     Update 5 (the Glass and Snow pops looked alike: pale triangles in a pale blue). Glass is now sharp and fast and carries the brick's own colour:
     each shard is a baked, irregular pane (white at one corner, the brick's colour across the body, a bright cut edge) that bursts out, tumbles and
     drops hard; as it turns edge-on it flips and flashes white. A few pinpoint glints and one white crack-star mark the break. Snow (js/s3-pops.js) is
     the opposite: slow, white-blue, soft crystals that float. Budget per brick: ceil(n * 1.1) shards (each steered once), ceil(n / 2) glints. */
  const mixHex = (a, b, t) => {
    const q = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const x = q(a), y = q(b);
    return '#' + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
  };
  const shardImg = (color) => BR.FX.bake('u5shard:' + color, 16, 24, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.38, mixHex(color, '#ffffff', 0.62)); gr.addColorStop(1, mixHex(color, '#14223c', 0.72));
    g.beginPath(); g.moveTo(w * 0.52, 1); g.lineTo(w - 1.5, h * 0.58); g.lineTo(w * 0.6, h - 1); g.lineTo(2, h * 0.72); g.closePath();
    g.fillStyle = gr; g.fill();
    g.lineJoin = 'miter'; g.lineWidth = 1.5; g.strokeStyle = '#ffffff'; g.stroke();
    g.beginPath(); g.moveTo(w * 0.52, 1); g.lineTo(w * 0.46, h * 0.86); g.lineWidth = 0.9; g.strokeStyle = 'rgba(255,255,255,0.8)'; g.stroke();
  });
  const putSprite = (fx, o) => { const k = fx.parts.length; if (fx.sprite) fx.sprite(o); return fx.parts.length > k ? fx.parts[k] : null; };
  function glassStep(p, dt, e) {
    const k = Math.cos(p.life * e.w + e.ph);
    p.sx = 0.14 + 0.86 * Math.abs(k);                     // the shard turns over as it falls
    p.a = Math.abs(k) < 0.22 ? 1 : 0.9;
    if (e.glint && !p.glinted && Math.abs(k) < 0.14) { p.glinted = true; e.fx.emit({ shape: 'star', x: p.x, y: p.y, vx: p.vx * 0.2, vy: p.vy * 0.2, g: 0, drag: 2, size: e.s * 0.9, max: 0.1, rot: 0, vr: 0, color: '#ffffff' }); }
  }
  PR.u4glass = function ({ x, y, glow, hi, n, power }) {
    const fx = this, tints = [glow, hi, '#bfeaff', glow];
    for (let i = 0; i < Math.ceil(n * 1.1); i++) {
      const a = rnd(0, TAU), sp = rnd(160, 520) * power, s = rnd(11, 18) * (n < 7 ? 1.1 : 0.95);
      const p = putSprite(fx, { img: shardImg(tints[i % tints.length]), x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 190, g: 1500, drag: 0.7, size: s, rot: rnd(0, TAU), vr: rnd(-11, 11), max: rnd(0.62, 1.0), a: 1 });
      if (p) steer(p, glassStep, { w: rnd(9, 17), ph: rnd(0, TAU), s, fx, glint: Math.random() < 0.6 });
    }
    this.sparks(x, y, '#ffffff', Math.ceil(n / 2), 1.2, 0.35);
    this.emit({ shape: 'star', x, y, vx: 0, vy: 0, g: 0, drag: 1, size: 11 + 4 * power, max: 0.09, rot: rnd(0, 1), vr: 0, color: '#ffffff' });
  };

  /* ===================================================================== PIXELS
     Update 5: the pixels were a sparse scatter of small squares that were gone in under half a second. Now every brick breaks into a proper sprite
     explosion: a white block flashes where the brick was, chunky pixels burst out along the eight directions of an old arcade game one 6px cell at
     a time, then fall faster and faster; each flashes white, then holds its own tone (the brick's light colour, its glow or white) and ends dark and the leaders leave a short trail of
     afterimages in the cells they just left. Pixels live 0.45 to 0.6 s (the pop moment still ends inside 600 ms). A hop sets the pixel's position
     on the grid directly, so it lands exactly on a cell at any frame rate. Budget per brick: ceil(2.4n) pixels (all steered), a trail of two afterimages
     behind every third one, and one flash block while the crowd is small enough to read (n >= 7). */
  const GRID = 6, STEP = 0.052;
  const DIRS = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]];
  function pixelStep(p, dt, e) {
    const t = p.life / p.max;
    p.color = t < 0.1 ? '#ffffff' : t < 0.7 ? e.tone : e.lo;
    if (p.life < e.next) return;
    e.next += STEP; e.k++;
    const out = e.k <= e.burst;
    if (!out) e.fall += 0.6;
    if (e.trail > 0) { e.trail--; e.fx.emit({ kind: 'shard', shape: 'pixel', x: p.x, y: p.y, vx: 0, vy: 0, g: 0, drag: 0, size: e.s * 0.7, spread: 0, max: 0.13, color: p.color }); }
    e.gx += out ? e.dx : (e.k % 2 ? Math.sign(e.dx) : 0);
    e.gy += out ? e.dy : Math.max(1, Math.round(e.fall));
    p.x = e.gx * GRID; p.y = e.gy * GRID;
    p.size = e.s * (t > 0.72 ? 0.62 : 1);
  }
  PR.u4pixel = function ({ x, y, glow, hi, n }) {
    const fx = this, crowd = n < 7, sizes = crowd ? [7, 9, 11] : [5, 7, 9], tones = [hi, glow, '#ffffff', hi, glow];
    const gx = Math.round(x / GRID), gy = Math.round(y / GRID);
    const lo = mixHex(glow, '#12081e', 0.55);
    if (!crowd) fx.emit({ kind: 'shard', shape: 'pixel', x: gx * GRID, y: gy * GRID, vx: 0, vy: 0, g: 0, drag: 0, size: 12, spread: 0, max: 0.07, color: '#ffffff' });
    for (let i = 0; i < Math.ceil(n * 2.4); i++) {
      const d = pick(DIRS), mag = Math.random() < 0.55 ? 3 : 2, s = pick(sizes);
      const p = put(fx, { kind: 'shard', shape: 'pixel', x: gx * GRID, y: gy * GRID, vx: 0, vy: 0, g: 0, drag: 0, size: s, spread: 0, max: rnd(0.46, 0.6), color: '#ffffff' });
      steer(p, pixelStep, { fx, tone: tones[i % 5], lo, s, gx, gy, dx: d[0] * mag, dy: d[1] * mag, burst: 3 + ((Math.random() * 3) | 0), fall: 0, k: 0, next: rnd(0.012, 0.04), trail: i % 3 === 0 ? 2 : 0 });
    }
  };

  /* ===================================================================== LIGHTNING
     Sparks do not fly straight: they crackle along jagged zigzags, changing heading every few frames. And bricks popped together in one wave
     are joined by short arcs (a handful per pop, never one per brick). */
  function zigStep(p, dt, e) {
    e.cd -= dt;
    if (e.cd > 0) return;
    e.cd = rnd(0.025, 0.05);
    const sp = Math.hypot(p.vx, p.vy), a = Math.atan2(p.vy, p.vx) + rnd(-1.4, 1.4);
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
  }
  const chain = { x: 0, y: 0, t: -1e9, k: 0 };
  PR.u4lightning = function ({ x, y, glow, n }) {
    const sparks = batch(this, () => this.sparks(x, y, '#d6e8ff', Math.ceil(n * 1.1), 1.3, 0.35));
    sparks.forEach((p) => steer(p, zigStep, { cd: rnd(0, 0.04) }));
    this.shards(x, y, glow, Math.ceil(n / 2), 0.7);
    const now = performance.now();
    if (now - chain.t > 260) chain.k = 0;
    if (now - chain.t < 160 && chain.k < 5 && Math.hypot(x - chain.x, y - chain.y) < 150) { this.bolt(chain.x, chain.y, x, y, '#cfe4ff'); chain.k++; }
    chain.x = x; chain.y = y; chain.t = now;
  };

  /* ===================================================================== FIREWORKS
     The burst starts white-hot and turns to its colour in a beat, then the sparks glitter (flicker in size) as they fall. */
  function fireStep(p, dt, e) {
    const t = p.life / p.max;
    p.color = t < 0.2 ? '#ffffff' : e.c;
    if (t > 0.45) p.size = e.s * (Math.random() < 0.5 ? 0.3 : 1);
  }
  PR.u4fireworks = function ({ x, y, glow, n, power }) {
    const cols = [glow, '#ff6b9a', '#6bffb2', '#6bb8ff', '#ffd36b'];
    const sparks = batch(this, () => this.sparks(x, y, pick(cols), Math.ceil(n * 1.1), 1.35, 0.55));
    sparks.forEach((p) => steer(p, fireStep, { c: p.color, s: p.size }));
    this.shards(x, y, glow, Math.ceil(n / 3), 0.6);
    if (power >= 1.4 && Math.random() < 0.7) this.firework(x, y, x + rnd(-60, 60), Math.max(80, y - rnd(150, 260)), pick(cols), pick(['peony', 'ring', 'willow', 'star']));
  };

  /* fx.js asks for these through here so that reduced motion and low-end phones keep the original recipes */
  BR.U4.recipe = (name) => (calm() ? null : PR['u4' + name] || null);
})();
