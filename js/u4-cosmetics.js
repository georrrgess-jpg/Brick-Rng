/* Update 4 cosmetics touch-up: one more motion idea for each of the six older pops, inside the same particle budget.
     Embers   rise white-hot and cool to red as they climb, wobbling in the heat
     Petals   curl outward in a swirl and turn to face the way they fly
     Glass    shards catch the light once each: a white glint as they tumble
     Pixels   hop on a grid as they scatter and fall, like a sprite explosion
     Lightning  sparks crackle in zigzags, and a pop's bricks are joined by short arcs
     Fireworks  the burst starts white and turns to its colour, then glitters as it falls
   js/fx.js keeps the original recipes as a fallback and hands these six over: each recipe below emits exactly the particles the original did,
   then steers them (colour, size, velocity) from one shared frame loop that runs only while a steered particle is alive. No DOM per particle;
   nothing here touches the canvas drawing code, and reduced motion / low-end phones get the original recipes untouched. */
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
     Sparks rise white-hot, turn orange and then dull red as they cool, and wobble sideways in the heat. */
  const HOT = '#fff0b8', COOL = '#d4442c';
  function emberStep(p, dt, e) {
    const t = p.life / p.max;
    p.color = t < 0.22 ? HOT : t < 0.62 ? e.c : COOL;
    p.vx += Math.sin(p.life * 12 + e.ph) * 340 * dt;       // heat wobble
    p.size = e.s * (0.78 + 0.22 * Math.sin(p.life * 31 + e.ph)) * (1 - t * 0.2);   // flicker
  }
  PR.u4ember = function ({ x, y, glow, n }) {
    const cols = ['#ff9a3d', '#ffcf3f', '#ff5468', glow];
    for (let i = 0; i < Math.ceil(n * 1.4); i++) {
      const c = pick(cols), s = rnd(1.8, 4.2);
      const p = put(this, { kind: 'spark', x: x + rnd(-8, 8), y, vx: rnd(-90, 90), vy: rnd(-260, -60), g: -90, drag: 1.1, size: s, max: rnd(0.8, 1.5), color: HOT });
      steer(p, emberStep, { c, s, ph: rnd(0, TAU) });
    }
    this.shards(x, y, glow, Math.ceil(n / 3), 0.55);
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
     Each shard catches the light once as it tumbles: for a moment it turns into a white four-point glint. */
  function glassStep(p, dt, e) {
    const a = p.life;
    if (!e.done && a >= e.t0) { e.done = 1; e.shape = p.shape; e.size = p.size; e.color = p.color; p.shape = 'star'; p.color = '#ffffff'; p.size = e.size * 1.9; }
    else if (e.done === 1 && a >= e.t0 + 0.09) { e.done = 2; p.shape = e.shape; p.color = e.color; p.size = e.size; }
  }
  PR.u4glass = function ({ x, y, n }) {
    const shards = batch(this, () => this.shards(x, y, '#dff7ff', Math.ceil(n * 1.4), 1.05, { shape: 'tri', size: 5, spread: 8, life: 0.6, g: 1300 }));
    shards.forEach((p) => { if (Math.random() < 0.55) steer(p, glassStep, { t0: p.max * rnd(0.25, 0.6), done: 0 }); });
    this.sparks(x, y, '#ffffff', Math.ceil(n / 2), 1.2, 0.4);
  };

  /* ===================================================================== PIXELS
     Pixels do not glide: they hop one cell of a 6px grid at a time, outward first and then falling faster and faster, like a sprite
     explosion in an old arcade game. Each hop is a one-frame velocity pulse computed from the real frame time, so it lands exactly on the grid. */
  const GRID = 6, STEP = 0.07;
  function pixelStep(p, dt, e) {
    if (e.moved) { p.vx = p.vy = 0; p.x = e.tx; p.y = e.ty; e.moved = false; }
    if (p.life < e.next) return;
    e.next += STEP; e.k++;
    const out = e.k <= e.burst;
    if (!out) e.fall += 0.55;
    e.gx += out ? e.dx : (e.k % 2 ? Math.sign(e.dx) : 0);
    e.gy += out ? e.dy : Math.max(1, Math.round(e.fall));
    e.tx = e.gx * GRID; e.ty = e.gy * GRID;
    p.vx = (e.tx - p.x) / e.dt; p.vy = (e.ty - p.y) / e.dt;
    e.dt = dt; e.moved = true;
  }
  PR.u4pixel = function ({ x, y, glow, hi, n }) {
    const cols = [glow, hi, '#ffffff'];
    for (let i = 0; i < Math.ceil(n * 1.6); i++) {
      const dirs = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]], d = pick(dirs);
      const gx = Math.round(x / GRID), gy = Math.round(y / GRID);
      const p = put(this, { kind: 'shard', shape: 'pixel', x: gx * GRID, y: gy * GRID, vx: 0, vy: 0, g: 0, drag: 0, size: 3 + ((Math.random() * 3) | 0) * 2, spread: 0, max: rnd(0.35, 0.7), color: pick(cols) });
      const mag = Math.random() < 0.6 ? 2 : 1;
      steer(p, pixelStep, { gx, gy, dx: d[0] * mag, dy: d[1] * mag, burst: 4 + ((Math.random() * 3) | 0), fall: 0, k: 0, next: rnd(0.02, 0.05), dt: 1 / 60, moved: false, tx: 0, ty: 0 });
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
