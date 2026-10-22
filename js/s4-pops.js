/* Series 4 "Moonwick" pops: recipes (BR.PopRecipes), pop moments (BR.Skins.handlers), sounds (BR.Audio.flavors) and badge art (BR.Badge.custom).
   Nine pops, each with its own material and motion (spec: docs/update-5/series-4-moonwick.md 3.2 and 3.5):
     Fireflies  wander on curving paths and blink                     Wishdust   a helix of glitter that spirals up
     Paper Birds  fold into flapping paper birds, drop scraps         Rune Burst  the popped colour's sigil flies out
     Gold Leaf  a gold glint, then flakes that turn over as they fall Sandfall   pours away as sand (hangs in the air in Rush)
     Whirlgate  spirals into a pinpoint; big pops open a portal       Constellation  every pop is drawn in star lines
     Wisps      friendly ghosts that sway upward
   How it is built
     * Every recipe is one function per popped brick, `this` = the FX, called with the per-brick budget `n` (9 for a group of up to six bricks,
       7 up to fourteen, 5 up to twenty-eight, 3 beyond; low-end and Reduce Motion scale it again inside fx.pop). Richness comes from baked
       bitmaps (FX.bake, one per palette colour, drawn lazily the first time they are needed), not from more particles: one sprite is a bird,
       a ghost, a glyph, a flake, or a comet with its own tail.
     * What moves after it was emitted is steered with BR.U4.steer (one shared loop, real elapsed time: 60 and 120 Hz look the same) and is
       released when the particle dies. Reduce Motion skips the steering and the moments, so a pop is plain emitted particles.
     * A pop moment (big pop, Line Blast, Rush start, stage-up) is a handler on BR.Skins.handlers. It adds at most 40 particles and 3 DOM
       sprites, ends inside 600 ms (Rush start and stage-up inside 900 ms), and only ever draws thin line work, soft particles, or sprites
       that are gone before they could hide a group highlight or a Fuse brick count. Low-end halves every count.
     * A pop is always drawn in the colour of the brick that went: each one carries `glow` / `hi` somewhere you cannot miss. */
(function () {
  const BR = (window.BR = window.BR || {});
  const PR = (BR.PopRecipes = BR.PopRecipes || {});
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const later = (fn, ms) => setTimeout(fn, ms);
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeIn = (t) => { t = clamp(t, 0, 1); return t * t * t; };
  const easeIO = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  /** A count scaled down on low-end phones (never below 1). */
  const cnt = (k) => Math.max(1, Math.round(k * (BR.lowEnd ? 0.5 : 1)));
  const now = () => performance.now();

  /* ------------------------------------------------------------------ colours */
  const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  /** t = 0 gives a, t = 1 gives b. Both are #rrggbb. */
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)); };
  const rgba = (h, a) => { const x = rgb(h); return `rgba(${x[0]},${x[1]},${x[2]},${a})`; };
  const WHITE = '#ffffff', GOLD = '#ffcf6b', SILVER = '#e8f0ff';
  /** The palette index of a brick colour, from its glow (or hi); -1 when it is not one of the seven. */
  const colorIndex = (glow, hi) => { const P = BR.PALETTE || []; for (let i = 0; i < P.length; i++) if (P[i].glow === glow || (hi && P[i].hi === hi)) return i; return -1; };
  /** hi / lo / glow of a colour, as a record (falls back to the glow alone for colours that are not in the palette). */
  const tints = (glow, hi) => { const i = colorIndex(glow, hi), P = i >= 0 ? BR.PALETTE[i] : null; return P ? { i, hi: P.hi, lo: P.lo, glow: P.glow } : { i: -1, hi: hi || glow, lo: mix(glow, '#000000', 0.45), glow }; };

  /* ------------------------------------------------------------------ the engine hooks every recipe uses */
  const steer = (p, fn, data) => { if (p && !BR.reducedMotion && BR.U4) BR.U4.steer(p, fn, data); };
  /** Emit a particle and hand the live object back (null at the particle cap). */
  const put = (fx, p) => { const k = fx.parts.length; fx.emit(p); return fx.parts.length > k ? fx.parts[k] : null; };
  const spr = (fx, o) => { const k = fx.parts.length; fx.sprite(o); return fx.parts.length > k ? fx.parts[k] : null; };
  const bake = (key, w, h, draw) => BR.FX.bake(key, w, h, draw);
  /** Device scale used for canvas shadows (shadowBlur ignores the context transform). */
  const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
  const brickSize = () => (BR.Run && BR.Run.view && BR.Run.view.cell) || 44;
  const boardRect = (ctx) => { const v = ctx && ctx.view; const el = (v && v.boardEl) || document.getElementById('board'); return el ? el.getBoundingClientRect() : { left: 0, top: 0, right: innerWidth, bottom: innerHeight, width: innerWidth, height: innerHeight }; };

  /* The pop the recipes are drawing right now, as the handler below saw it: its size, centre and a call counter, so a recipe can ration
     itself ("every second brick sends a bird") and lean away from the group. Stale after 800 ms; Reduce Motion never sets it (the handler
     does not run), and the recipes then fall back to counting their own calls. */
  const PC = { t: -1e9, last: -1e9, size: 0, cx: 0, cy: 0, k: 0, birds: 0, ghosts: 0, rush: false, nodes: null, portal: null, hang: 0 };
  function popInfo() {
    const t = now(), fresh = t - PC.t < 800;
    if (!fresh && t - PC.last > 350) { PC.k = 0; PC.birds = 0; PC.ghosts = 0; }
    PC.last = t; PC.k++;
    return { fresh, size: fresh ? PC.size : 0, k: PC.k, cx: fresh ? PC.cx : null, cy: fresh ? PC.cy : null };
  }
  const rushOn = () => { const e = BR.Run && BR.Run.engine; return !!(e && e.rush && e.rush.active) || PC.rush; };

  /* ------------------------------------------------------------------ shared bitmaps (baked the first time they are needed) */
  /** A soft round glow: a white-hot centre fading through the colour to nothing. */
  const glowImg = (col) => bake('s4glow' + col, 32, 32, (c) => {
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, rgba(mix(col, WHITE, 0.8), 1)); g.addColorStop(0.2, rgba(mix(col, WHITE, 0.35), 0.9)); g.addColorStop(0.5, rgba(col, 0.34)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, 32, 32);
  });
  /** A four-point sparkle: thin curved rays around a hot centre, with a soft halo in `halo`. */
  const star4Img = (core, halo) => bake('s4st4' + core + halo, 44, 44, (c) => {
    c.translate(22, 22);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 14); g.addColorStop(0, rgba(halo, 0.65)); g.addColorStop(1, rgba(halo, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 14, 0, TAU); c.fill();
    const ray = (r, k) => { c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(k, -k, r, 0); c.quadraticCurveTo(k, k, 0, r); c.quadraticCurveTo(-k, k, -r, 0); c.quadraticCurveTo(-k, -k, 0, -r); c.closePath(); };
    ray(21, 2.4); c.fillStyle = rgba(core, 0.95); c.fill();
    ray(9, 2.8); c.fillStyle = WHITE; c.fill();
  });

  /* ===================================================================== FIREFLIES (Common)
     A firefly is a warm yellow-green bulb in a halo of the brick's colour. It does not fly, it wanders: its heading is a smooth random
     walk (so the path curls), it drifts upward, and it blinks: the whole sprite drops to a quarter of its size and a quarter of its light
     every 120 to 260 ms. One soft glint in the brick's colour marks where the brick was. */
  const ffImg = (glow) => bake('s4ff' + glow, 52, 52, (c) => {
    const cx = 26, cy = 27;
    let g = c.createRadialGradient(cx, cy, 0, cx, cy, 26);
    g.addColorStop(0, rgba(mix(glow, WHITE, 0.45), 0.85)); g.addColorStop(0.3, rgba(glow, 0.5)); g.addColorStop(0.65, rgba(glow, 0.16)); g.addColorStop(1, rgba(glow, 0));
    c.fillStyle = g; c.fillRect(0, 0, 52, 52);
    // two pale, nearly clear wings behind the bulb
    c.fillStyle = 'rgba(235,255,225,.42)';
    [-1, 1].forEach((s) => { c.save(); c.translate(cx + s * 2.2, cy - 2.4); c.rotate(s * 0.62); c.beginPath(); c.ellipse(s * 3.4, -3.4, 5.6, 2.1, 0, 0, TAU); c.fill(); c.restore(); });
    // thorax, and the glowing abdomen
    c.fillStyle = '#26301a'; c.beginPath(); c.ellipse(cx, cy - 2.4, 2.4, 3, 0, 0, TAU); c.fill();
    g = c.createRadialGradient(cx, cy + 3.6, 0, cx, cy + 3.6, 6.4);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#f1ffa0'); g.addColorStop(0.75, '#c8ff4a'); g.addColorStop(1, 'rgba(200,255,74,0)');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy + 3.6, 6.4, 0, TAU); c.fill();
  });
  function fireflyStep(p, dt, e) {
    // the heading turns on a noisy angular velocity that always relaxes back to zero: gentle curls, never loops
    e.w += (-2.1 * e.w) * dt + 3.1 * Math.sqrt(dt) * rnd(-1.73, 1.73);
    e.h += e.w * dt;
    const sp = e.sp * (0.6 + 0.4 * Math.sin(p.life * 1.9 + e.ph));
    const k = 1 - Math.exp(-4.2 * dt);
    p.vx += (Math.cos(e.h) * sp - p.vx) * k;
    p.vy += (Math.sin(e.h) * sp - e.rise - p.vy) * k;
    e.bt -= dt;
    if (e.bt <= 0) { e.on = !e.on; e.bt = e.on ? rnd(0.16, 0.26) : rnd(0.12, 0.2); }
    e.s += ((e.on ? 1 : 0.26) - e.s) * (1 - Math.exp(-30 * dt));
    p.sx = p.sy = e.s * e.size;
    p.a = 0.3 + 0.7 * clamp((e.s - 0.26) / 0.74, 0, 1);
  }
  PR.fireflies = function ({ x, y, glow, hi, n, power }) {
    const fx = this, C = tints(glow, hi), k = Math.max(1, Math.ceil(n * 0.35));
    spr(fx, { img: glowImg(C.glow), x, y, size: 62, max: 0.3, a: 0.85, grow: 0.7, drag: 1 });
    for (let i = 0; i < k; i++) {
      const a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(70, 190) * (0.9 + 0.1 * power);
      const p = spr(fx, { img: ffImg(C.glow), x: x + rnd(-7, 7), y: y + rnd(-5, 5), vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, drag: 0.9, size: rnd(30, 38), max: rnd(1.4, 1.9), a: 1, fadeIn: 0.07, rot: 0 });
      steer(p, fireflyStep, { h: a, w: 0, sp: rnd(46, 72), rise: rnd(26, 46), ph: rnd(0, TAU), bt: rnd(0.04, 0.2), on: true, s: 1, size: 1 });
    }
  };

  /* ===================================================================== WISHDUST (Common)
     Glitter in a helix. Two strands of sparkles wind around a rising axis (x from the sine of the angle, depth from its cosine): the ones
     in front are bigger and brighter, the ones behind smaller and dimmer, so a flat canvas draws something round. White, pale gold, and a
     tint of the brick's colour. */
  function wishStep(p, dt, e) {
    const t = p.life / p.max, ang = e.ph + e.w * p.life, depth = Math.cos(ang) * 0.5 + 0.5;
    const open = easeOut(p.life / 0.16);
    p.x = e.x + Math.sin(ang) * e.R * open * (1 - 0.3 * t);
    p.y = e.y - e.rise * easeOut(t) - e.R * 0.5 * (1 - depth) * open;
    p.vx = p.vy = 0;
    p.sx = p.sy = e.s * (0.62 + 0.55 * depth) * (0.85 + 0.15 * Math.sin(p.life * 31 + e.ph * 3));
    p.a = e.a * (0.42 + 0.58 * depth);
    p.rot = p.life * e.spin + e.ph;
  }
  PR.wishdust = function ({ x, y, glow, hi, n, power }) {
    const fx = this, C = tints(glow, hi), k = clamp(n, 2, 10);
    const imgs = [star4Img(WHITE, mix(C.hi, WHITE, 0.3)), star4Img(GOLD, '#ffb347'), star4Img(mix(C.hi, WHITE, 0.25), C.glow), star4Img(WHITE, C.glow)];
    const J = Math.ceil(k / 2);
    for (let i = 0; i < k; i++) {
      const j = i >> 1, strand = i & 1, big = i % 3 === 0;
      const e = { x, y, ph: strand * Math.PI + j * 0.95 + rnd(-0.12, 0.12), w: rnd(8.2, 9.6) * (strand ? -1 : 1) * 1, R: rnd(9, 14) + (big ? 2 : 0), rise: lerp(58, 118, J > 1 ? j / (J - 1) : 0.5) * (0.92 + 0.08 * power), s: big ? 1 : 0.72, a: 1, spin: rnd(-2.5, 2.5) };
      const p = spr(fx, { img: imgs[i % imgs.length], x, y, size: big ? 17 : 12, rot: rnd(0, TAU), max: rnd(0.82, 1.05), a: 1, fadeIn: 0.05, vx: rnd(-26, 26), vy: rnd(-120, -60), drag: 1.6, g: 0 });
      steer(p, wishStep, e);
    }
    spr(fx, { img: glowImg(C.glow), x, y, size: 50, max: 0.26, a: 0.8, grow: 0.8 });
  };

  /* ===================================================================== PAPER BIRDS (Rare)
     The brick folds into a paper bird: flat paper in the brick's colour, a lit facet and a shaded one, white creases. It flaps (three
     baked wing positions, swapped every 70 ms), climbs away to the side, and tilts into its glide. Three scraps of paper flutter down
     from the fold. In a big pop only every second brick sends a bird (never more than six); the others send scraps only. */
  const BIRD_TIP = [[25, 1], [8, 12], [20, 40]];   // wing tip, up / level / down
  const birdImg = (C, frame) => bake('s4bird' + C.glow + frame, 56, 44, (c) => {
    const tip = BIRD_TIP[frame], edge = rgba(C.lo, 0.6);
    const poly = (pts, fill, stroke) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 0.9; c.lineJoin = 'round'; c.stroke(); } };
    const light = mix(C.hi, WHITE, 0.22), shade = mix(C.glow, '#000000', 0.2);
    poly([[19, 21], [33, 19], [tip[0] + 10, tip[1] + (frame === 2 ? -2 : 3)]], mix(C.glow, '#000000', 0.38), edge);   // the far wing, behind
    poly([[3, 28], [23, 19], [38, 15], [52, 20], [39, 23], [24, 26]], light, edge);                                   // back
    poly([[3, 28], [24, 26], [39, 23], [28, 33]], shade, edge);                                                      // belly
    poly([[38, 15], [52, 20], [39, 23]], mix(C.hi, WHITE, 0.6), edge);                                               // head
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 0.9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(23, 19); c.lineTo(24, 26); c.moveTo(24, 26); c.lineTo(39, 23); c.stroke();
    c.fillStyle = '#2a2640'; c.beginPath(); c.arc(43, 19.4, 1.15, 0, TAU); c.fill();
    // the near wing, two facets and a crease
    const b0 = [11, 22], b1 = [32, 18], bm = [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2];
    poly([b0, bm, tip], mix(C.hi, WHITE, 0.12), edge);
    poly([bm, b1, tip], mix(C.hi, WHITE, 0.5), edge);
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.moveTo(bm[0], bm[1]); c.lineTo(tip[0], tip[1]); c.stroke();
  });
  function birdStep(p, dt, e) {
    const u = p.life, pop = clamp(u / 0.15, 0, 1), s = 0.45 + 0.55 * (1 + 0.28 * Math.sin(Math.min(1, pop) * Math.PI)) * pop;
    p.img = e.frames[[0, 1, 2, 1][Math.floor(u / 0.07) % 4]];
    p.sx = e.dir * s; p.sy = s;
    const k = 1 - Math.exp(-2.6 * dt), t = u / p.max;
    const vyT = -e.up * (1 - 0.55 * t) + Math.cos(u * TAU / 0.28) * 36;
    p.vx += (e.dir * e.spd * (0.8 + 0.2 * t) - p.vx) * k;
    p.vy += (vyT - p.vy) * k;
    p.rot = -e.dir * clamp(Math.atan2(-p.vy, Math.abs(p.vx) + 1), -0.7, 0.7) * 0.6;
  }
  PR.birds = function ({ x, y, glow, hi, n, power }) {
    const fx = this, C = tints(glow, hi), info = popInfo(), big = info.size >= 7;
    let used = 1;
    spr(fx, { img: glowImg(C.glow), x, y, size: 58, max: 0.28, a: 0.9, grow: 0.7 });
    if ((!big || info.k % 2 === 1) && PC.birds < 6) {
      PC.birds++; used++;
      const dir = info.cx != null && Math.abs(x - info.cx) > 6 ? Math.sign(x - info.cx) : (PC.birds % 2 ? 1 : -1);
      const frames = [0, 1, 2].map((f) => birdImg(C, f));
      const p = spr(fx, { img: frames[1], x, y, vx: dir * rnd(110, 170), vy: rnd(-250, -190), g: 0, drag: 0.4, size: rnd(34, 40) * (0.92 + 0.08 * power), max: rnd(1.25, 1.55), a: 1, fadeIn: 0.05, sx: dir, rot: -dir * 0.3 });
      steer(p, birdStep, { frames, dir, up: rnd(95, 135), spd: rnd(125, 175) });
    }
    const cols = ['#f4ecd8', '#efe3c8', C.hi];
    for (let i = 0, k = Math.min(3, n - used); i < k; i++) {
      const a = rnd(-Math.PI * 0.9, -Math.PI * 0.1), v = rnd(70, 190);
      fx.emit({ kind: 'conf', x: x + rnd(-6, 6), y: y + rnd(-4, 4), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 190, drag: 2.3, rot: rnd(0, TAU), vr: rnd(-9, 9), sway: rnd(0, TAU), size: rnd(8, 12), max: rnd(0.95, 1.45), color: cols[i % 3] });
    }
  };

  /* ===================================================================== RUNE BURST (Rare)
     The brick's own sigil flies out as glowing strokes: Ruby a circle, Sapphire a diamond, Emerald a triangle, Topaz a square, Amethyst a
     hexagon, Amber a star, Aqua a cross (the outlines of the Shape hints, with an inner mark each). They spin a little and, as they fade,
     break into motes; a thin ring in the colour marks the brick. So the burst tells you which colour went, even without seeing the colour. */
  function sigilPath(c, i, cx, cy, r) {
    c.beginPath();
    const poly = (pts) => pts.forEach(([x, y], k) => (k ? c.lineTo(cx + x * r, cy + y * r) : c.moveTo(cx + x * r, cy + y * r)));
    if (i === 1) { poly([[0, -1], [1, 0], [0, 1], [-1, 0]]); c.closePath(); }
    else if (i === 2) { poly([[0, -0.9], [1, 0.88], [-1, 0.88]]); c.closePath(); }
    else if (i === 3) { const s = 0.82, k = 0.2; c.moveTo(cx - s * r + k * r, cy - s * r); c.arcTo(cx + s * r, cy - s * r, cx + s * r, cy + s * r, k * r); c.arcTo(cx + s * r, cy + s * r, cx - s * r, cy + s * r, k * r); c.arcTo(cx - s * r, cy + s * r, cx - s * r, cy - s * r, k * r); c.arcTo(cx - s * r, cy - s * r, cx + s * r, cy - s * r, k * r); c.closePath(); }
    else if (i === 4) { poly([[-0.5, -0.92], [0.5, -0.92], [1, 0], [0.5, 0.92], [-0.5, 0.92], [-1, 0]]); c.closePath(); }
    else if (i === 5) { const pts = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 0.45 : 1.02; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); } poly(pts); c.closePath(); }
    else if (i === 6) { const a = 0.34; poly([[-a, -1], [a, -1], [a, -a], [1, -a], [1, a], [a, a], [a, 1], [-a, 1], [-a, a], [-1, a], [-1, -a], [-a, -a]]); c.closePath(); }
    else c.arc(cx, cy, r, 0, TAU);
  }
  function sigilMark(c, i, cx, cy, r) {
    c.beginPath();
    if (i === 1) { c.moveTo(cx - 0.5 * r, cy); c.quadraticCurveTo(cx - 0.25 * r, cy - 0.34 * r, cx, cy); c.quadraticCurveTo(cx + 0.25 * r, cy + 0.34 * r, cx + 0.5 * r, cy); }
    else if (i === 2) { c.moveTo(cx, cy - 0.15 * r); c.lineTo(cx, cy + 0.6 * r); c.moveTo(cx - 0.3 * r, cy + 0.12 * r); c.lineTo(cx, cy - 0.15 * r); c.lineTo(cx + 0.3 * r, cy + 0.12 * r); }
    else if (i === 3) { c.moveTo(cx - 0.28 * r, cy + 0.5 * r); c.lineTo(cx - 0.28 * r, cy - 0.1 * r); c.arc(cx, cy - 0.1 * r, 0.28 * r, Math.PI, 0); c.lineTo(cx + 0.28 * r, cy + 0.5 * r); }
    else if (i === 4) { c.moveTo(cx, cy - 0.38 * r); c.lineTo(cx + 0.34 * r, cy); c.lineTo(cx, cy + 0.38 * r); c.lineTo(cx - 0.34 * r, cy); c.closePath(); }
    else if (i === 6) { c.arc(cx, cy, 0.2 * r, 0, TAU); }
    else { c.arc(cx, cy, 0.2 * r, 0, TAU); }
  }
  const sigilImg = (C) => bake('s4sig' + C.glow, 60, 60, (c) => {
    const i = Math.max(0, C.i), cx = 30, cy = 30, r = 19;
    c.lineJoin = c.lineCap = 'round';
    sigilPath(c, i, cx, cy, r); c.fillStyle = rgba(C.glow, 0.2); c.fill();
    c.shadowColor = C.glow; c.shadowBlur = 10 * dpr();
    c.strokeStyle = rgba(C.glow, 0.95); c.lineWidth = 4.6; sigilPath(c, i, cx, cy, r); c.stroke();
    c.shadowBlur = 0;
    c.strokeStyle = rgba(mix(C.hi, WHITE, 0.72), 1); c.lineWidth = 1.8; sigilPath(c, i, cx, cy, r); c.stroke();
    c.lineWidth = 1.5; sigilMark(c, i, cx, cy, r); c.stroke();
  });
  PR.runes = function ({ x, y, glow, hi, n, power }) {
    const fx = this, C = tints(glow, hi), img = sigilImg(C), info = popInfo();
    const g = n >= 7 ? 3 : n >= 5 ? 2 : 1, m = Math.max(0, Math.min(4, n - g));
    const crowd = info.size > 12;
    for (let i = 0; i < g; i++) {
      const main = i === 0, a = -Math.PI / 2 + (i % 2 ? 1 : -1) * rnd(0.55, 1.25) * (i > 2 ? 1.3 : 1), v = main ? 0 : rnd(170, 250) * (0.9 + 0.1 * power);
      const life = main ? rnd(0.56, 0.66) : rnd(0.6, 0.78);
      const p = spr(fx, { img, x: x + (main ? 0 : rnd(-4, 4)), y: y + (main ? -2 : rnd(-4, 4)), vx: main ? rnd(-14, 14) : Math.cos(a) * v, vy: main ? -28 : Math.sin(a) * v - 20, g: -10, drag: 3.1, size: main ? (crowd ? 24 : 31) : rnd(17, 22), rot: rnd(-0.5, 0.5), vr: rnd(-2.6, 2.6), max: life, a: 1, grow: main ? 0.55 : 0.3, fadeIn: 0.05 });
      const mi = Math.round(m / g) + (i === 0 && m % g ? 1 : 0);
      if (p && mi > 0) later(() => {
        if (!p || p.life >= p.max) return;
        for (let k = 0; k < mi; k++) { const b = rnd(0, TAU), s = rnd(30, 120); fx.emit({ kind: 'spark', x: p.x + rnd(-6, 6), y: p.y + rnd(-6, 6), vx: Math.cos(b) * s, vy: Math.sin(b) * s - 30, g: 60, drag: 1.8, size: rnd(1.8, 3.2), max: rnd(0.3, 0.5), color: k % 2 ? C.hi : WHITE }); }
      }, life * 1000 * 0.62);
    }
    if (info.size <= 6 || info.k % 3 === 1) fx.ring(x, y, C.glow, 30 + 4 * power, 0.34, 2.4);
  };

  /* ===================================================================== GOLD LEAF (Epic)
     For 80 ms the brick is gold (one gilded square the size of the brick), then it crumbles into crinkled leaf. A flake is a flat, bright
     gold face on one side and a deep gold face on the other, and as it falls it turns over (its height goes to a line and back, and the
     face that shows swaps), so it flickers between bright and dark. The dark face is gold shot with the brick's colour, so the pop still
     tells you what went. */
  const mulberry = (s) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const flakePts = (seed) => { const R = mulberry(seed), k = 6 + ((R() * 2) | 0), pts = []; for (let i = 0; i < k; i++) { const a = (i / k) * TAU + R() * 0.5, r = 8.2 + R() * 4.6; pts.push([14 + Math.cos(a) * r, 14 + Math.sin(a) * r * 0.9]); } return pts; };
  const flakeImg = (C, shape, dark) => bake('s4flake' + (dark ? C.glow : 'b') + shape + (dark ? 'd' : 'l'), 28, 28, (c) => {
    const pts = flakePts(shape * 31 + 7), tones = dark ? [mix('#7a4a0c', C.glow, 0.42), mix('#b87a1c', C.hi, 0.3), mix('#98600f', C.glow, 0.3), mix('#d9a032', C.hi, 0.22)] : ['#fff6c4', '#ffe27a', '#ffd04a', '#f6b73a'];
    c.lineJoin = 'round';
    // facets fan out from an off-centre crinkle point
    const o = [14 + (shape - 1) * 1.6, 13.5];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      c.beginPath(); c.moveTo(o[0], o[1]); c.lineTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.closePath();
      c.fillStyle = tones[i % tones.length]; c.fill();
    }
    c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]))); c.closePath();
    c.strokeStyle = dark ? 'rgba(60,30,0,.55)' : 'rgba(255,255,230,.85)'; c.lineWidth = 0.8; c.stroke();
    c.strokeStyle = dark ? 'rgba(255,225,150,.3)' : 'rgba(150,80,0,.28)'; c.lineWidth = 0.6;
    c.beginPath(); pts.forEach((q, i) => { if (i % 2 === 0) { c.moveTo(o[0], o[1]); c.lineTo(q[0], q[1]); } }); c.stroke();
  });
  /** The brick gilded: a rounded square of gold with a bevel, a diagonal shine, and a thin rim in the brick's colour. */
  const gildImg = (C) => bake('s4gild' + C.glow, 56, 56, (c) => {
    const rr = (x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
    rr(4, 4, 48, 48, 12);
    const g = c.createLinearGradient(8, 4, 48, 52); g.addColorStop(0, '#fff8cc'); g.addColorStop(0.4, '#ffd54a'); g.addColorStop(1, '#d88a14');
    c.fillStyle = g; c.fill();
    c.save(); rr(4, 4, 48, 48, 12); c.clip();
    const s = c.createLinearGradient(0, 0, 56, 56); s.addColorStop(0.3, 'rgba(255,255,255,0)'); s.addColorStop(0.45, 'rgba(255,255,255,.85)'); s.addColorStop(0.58, 'rgba(255,255,255,0)'); c.fillStyle = s; c.fillRect(0, 0, 56, 56);
    c.restore();
    rr(4, 4, 48, 48, 12); c.strokeStyle = rgba(mix(C.glow, GOLD, 0.25), 0.95); c.lineWidth = 3; c.stroke();
    rr(9, 9, 38, 38, 8); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.2; c.stroke();
  });
  function flakeStep(p, dt, e) {
    e.ph += e.w * dt;
    const flip = Math.cos(e.ph), front = flip >= 0;
    p.img = front ? e.bright : e.dark;
    p.sy = 0.14 + 0.86 * Math.abs(flip);
    p.sx = 1;
    p.vx += Math.sin(p.life * 4.4 + e.ph0) * 150 * dt;
    p.rot = e.r0 + Math.sin(p.life * 3.1 + e.ph0) * 0.55;
    p.vr = 0;
  }
  PR.goldleaf = function ({ x, y, glow, hi, n, power }) {
    const fx = this, C = tints(glow, hi), k = clamp(Math.round(n * 0.75), 2, 7);
    spr(fx, { img: gildImg(C), x, y, size: brickSize() * 0.96, max: 0.11, a: 1, grow: 0.1, drag: 1 });
    for (let i = 0; i < k; i++) {
      const sh = i % 3, a = rnd(-Math.PI * 0.95, -Math.PI * 0.05), v = rnd(60, 250) * (0.9 + 0.1 * power);
      const bright = flakeImg(C, sh, false), dark = flakeImg(C, sh, true);
      const p = spr(fx, { img: bright, x: x + rnd(-8, 8), y: y + rnd(-6, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 190, drag: 2.5, size: rnd(12, 18) * (0.92 + 0.08 * power), rot: rnd(0, TAU), max: rnd(1.1, 1.6), a: 1, fadeIn: 0.04 });
      steer(p, flakeStep, { bright, dark, ph: rnd(0, TAU), ph0: rnd(0, TAU), w: rnd(8.5, 14) * (Math.random() < 0.5 ? -1 : 1), r0: rnd(0, TAU) });
    }
  };

  /* ===================================================================== SANDFALL (Epic)
     The brick dissolves into sand: a puff of dust, fine square grains in a light tint of the colour and in sand tones, and short streaks
     of grains (a baked cluster, so one particle is a pinch of sand) that pour straight down in a narrow stream. In Rush time stands still:
     the grains hang in the air for 200 ms, trembling, before they fall. */
  const SAND = ['#ecd39a', '#dcb877', '#f5e6c0'];
  const sandPuff = (C) => bake('s4puff' + C.glow, 40, 40, (c) => {
    const col = mix('#e6c98c', C.hi, 0.3), g = c.createRadialGradient(20, 20, 0, 20, 20, 20);
    g.addColorStop(0, rgba(mix(col, WHITE, 0.4), 0.7)); g.addColorStop(0.5, rgba(col, 0.36)); g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g; c.fillRect(0, 0, 40, 40);
  });
  const sandStreak = (C, v) => bake('s4streak' + C.glow + v, 12, 38, (c) => {
    const R = mulberry(77 + v * 13), cols = [C.hi, mix(C.hi, WHITE, 0.5), SAND[0], SAND[1], WHITE];
    for (let i = 0; i < 17; i++) {
      const t = i / 17, y = 2 + t * 34 + R() * 3, x = 6 + (R() - 0.5) * (3.4 + t * 3.8);
      c.globalAlpha = 1 - t * 0.78; c.fillStyle = cols[(R() * cols.length) | 0]; c.fillRect(Math.round(x), Math.round(y), 2, R() < 0.3 ? 3 : 2);
    }
  });
  function sandHang(p, dt, e) {
    if (e.rel) return;
    if (p.life < e.hang) { p.vx = Math.sin(p.life * 55 + e.ph) * 7; p.vy = Math.cos(p.life * 47 + e.ph) * 6; return; }
    e.rel = 1; p.g = e.g; p.drag = 0.7; p.vy = rnd(10, 60); p.vx = rnd(-14, 14);
  }
  PR.sandfall = function ({ x, y, glow, hi, n, power }) {
    const fx = this, C = tints(glow, hi), rush = rushOn(), ss = Math.ceil(n / 3), gr = Math.max(1, Math.round(n * 1.05));
    spr(fx, { img: sandPuff(C), x, y: y + 2, size: brickSize() * 1.15, max: 0.42, a: 0.85, grow: 0.5, vy: 20, drag: 1.5 });
    const gcols = [C.hi, mix(C.hi, WHITE, 0.42), SAND[0], SAND[1], SAND[2], C.hi];
    const G = rush ? 900 : 1150;
    for (let i = 0; i < gr; i++) {
      const p = put(fx, { kind: 'shard', shape: 'pixel', x: x + rnd(-11, 11), y: y + rnd(-14, 4), vx: rnd(-34, 34), vy: rnd(-90, 90), g: G * rnd(0.85, 1.1), drag: rush ? 6 : 0.8, size: rnd(1.6, 2.7), spread: 0, max: rnd(0.55, 0.9), color: gcols[i % gcols.length], rot: 0, vr: 0 });
      if (rush && p) { p.g = 0; steer(p, sandHang, { hang: 0.2, g: G * rnd(0.85, 1.1), ph: rnd(0, TAU), rel: 0 }); }
    }
    for (let i = 0; i < ss; i++) {
      const p = spr(fx, { img: sandStreak(C, i % 2), x: x + rnd(-8, 8), y: y + rnd(-8, 2), vx: rnd(-16, 16), vy: rnd(20, 120), g: rush ? 0 : G, drag: rush ? 6 : 0.7, size: rnd(7, 10), max: rnd(0.5, 0.8), a: 1, fadeIn: 0.05, sy: 1.1 });
      if (rush && p) { p.g = 0; steer(p, sandHang, { hang: 0.2, g: G, ph: rnd(0, TAU), rel: 0 }); }
    }
  };

  /* ===================================================================== WHIRLGATE (Legendary)
     The brick is pulled into a tiny vortex: comets (a bright head with its own tail) wind inward on a spiral whose radius shrinks as the
     angle grows, so they spin faster the closer they get, and end in a pinpoint flash. A comet starts in the brick's colour, turns deep
     teal as it falls in, and ends gold. In a big pop every brick's comets spiral into the group's portal instead of their own centre. */
  const TEAL = '#27dcc6', TEAL_D = '#0e8c93', GOLD_D = '#d69220';
  const cometImg = (col, tail) => bake('s4comet' + col + tail, 104, 20, (c) => {
    const g = c.createLinearGradient(0, 0, 52, 0); g.addColorStop(0, rgba(tail, 0)); g.addColorStop(0.55, rgba(mix(tail, col, 0.5), 0.45)); g.addColorStop(1, rgba(col, 0.95));
    c.fillStyle = g; c.beginPath(); c.moveTo(1, 10); c.quadraticCurveTo(30, 5, 52, 5.2); c.arc(52, 10, 4.8, -Math.PI / 2, Math.PI / 2); c.quadraticCurveTo(30, 15, 1, 10); c.fill();
    const h = c.createRadialGradient(52, 10, 0, 52, 10, 9); h.addColorStop(0, '#ffffff'); h.addColorStop(0.4, rgba(mix(col, WHITE, 0.55), 0.9)); h.addColorStop(1, rgba(col, 0));
    c.fillStyle = h; c.beginPath(); c.arc(52, 10, 9, 0, TAU); c.fill();
  });
  function spiralStep(p, dt, e) {
    const t = clamp(p.life / p.max, 0, 1), s = Math.pow(t, 1.5), r = e.r0 * (1 - s);
    const m = easeIn(t), cx = lerp(e.x, e.tx, m), cy = lerp(e.y, e.ty, m);
    const a = e.a0 + e.dir * e.turns * TAU * s, nx = cx + Math.cos(a) * r, ny = cy + Math.sin(a) * r;
    const vx = nx - p.x, vy = ny - p.y;
    if (e.started && (vx || vy)) p.rot = Math.atan2(vy, vx);
    e.started = true;
    const sp = Math.hypot(vx, vy) / Math.max(dt, 0.001);
    p.x = nx; p.y = ny; p.vx = p.vy = 0;
    p.sx = clamp(sp / 330, 0.5, 1.5) * (1 - 0.35 * s); p.sy = 1 - 0.4 * s;
    p.img = t < 0.34 ? e.i0 : t < 0.72 ? e.i1 : e.i2;
    const fade = Math.min(1, (1 - t) * 2.2);
    p.a = (t < 0.88 ? 1 : (1 - t) / 0.12) / Math.max(0.22, fade);
    if (t > 0.9 && !e.flashed && e.grp && !e.grp.done) { e.grp.done = true; e.flashed = true; put(e.fx, { kind: 'spark', x: nx, y: ny, size: e.big ? 6 : 9, max: 0.14, color: WHITE }); if (!e.big) e.fx.ring(nx, ny, TEAL, 26, 0.3, 2); }
  }
  PR.whirlgate = function ({ x, y, glow, hi, n, power }) {
    const fx = this, C = tints(glow, hi), k = clamp(n - 2, 2, 7), p0 = PC.portal && now() - PC.portal.t < 700 ? PC.portal : null;
    const i0 = cometImg(mix(C.glow, WHITE, 0.15), C.lo), i1 = cometImg(TEAL, TEAL_D), i2 = cometImg('#ffe08a', GOLD_D);
    const dir = p0 ? p0.dir : Math.random() < 0.5 ? 1 : -1, a00 = rnd(0, TAU), grp = { done: false };
    for (let i = 0; i < k; i++) {
      const a0 = a00 + (i / k) * TAU, r0 = rnd(34, 50) * (0.9 + 0.1 * power);
      const p = spr(fx, { img: i0, x: x + Math.cos(a0) * r0, y: y + Math.sin(a0) * r0, size: rnd(46, 60), max: rnd(0.5, 0.62), a: 1, fadeIn: 0.05, rot: a0 + dir * Math.PI / 2 });
      if (BR.reducedMotion && p) { p.vx = -Math.cos(a0) * r0 / p.max; p.vy = -Math.sin(a0) * r0 / p.max; p.drag = 0; p.rot = a0 + Math.PI; }
      steer(p, spiralStep, { x, y, tx: p0 ? p0.x : x, ty: p0 ? p0.y : y, a0, r0, dir, turns: rnd(1.05, 1.4), i0, i1, i2, fx, grp, big: !!p0, started: false });
    }
  };

  /* ===================================================================== CONSTELLATION (Mythic)
     Each popped brick leaves a four-point star that twinkles for about a second, on a halo of its colour. The pop moment (below) joins the
     stars along the group's own adjacency with thin lines, drawn from the tapped brick one link every 40 ms: the exact shape that was popped,
     drawn in starlight. The stars sit where the moment put them (slightly off the brick centres, junction stars bigger), found by position. */
  const starNode = (x, y) => { const L = PC.nodes; if (!L || now() - PC.t > 900) return null; for (let i = 0; i < L.length; i++) if (Math.abs(L[i].gx - x) < 9 && Math.abs(L[i].gy - y) < 9) return L[i]; return null; };
  function starStep(p, dt, e) {
    const u = p.life, glide = easeOut(u / 0.16), pop = clamp(u / 0.12, 0, 1), s = e.s * (0.3 + 0.7 * pop) * (1 + 0.28 * Math.sin(pop * Math.PI) * (1 - pop + 0.5));
    p.x = lerp(e.x, e.px, glide); p.y = lerp(e.y, e.py, glide); p.vx = p.vy = 0;
    const tw = Math.sin(u * e.f + e.ph);
    p.sx = p.sy = s * (0.84 + 0.2 * tw);
    p.a = e.a * (0.78 + 0.22 * tw);
    if (e.rot) p.rot = u * e.rot;
  }
  PR.constellation = function ({ x, y, glow, hi, n, power }) {
    const fx = this, C = tints(glow, hi), nd = starNode(x, y), px = nd ? nd.x : x, py = nd ? nd.y : y, deg = nd ? nd.deg : 1;
    const e0 = { x, y, px, py, ph: rnd(0, TAU), f: rnd(15, 21), a: 1, s: 1, rot: 0 };
    const halo = spr(fx, { img: glowImg(C.glow), x, y, size: 46 + deg * 5, max: rnd(0.9, 1.05), a: 0.55, fadeIn: 0.06 });
    steer(halo, starStep, Object.assign({}, e0, { a: 0.55 }));
    const star = spr(fx, { img: star4Img(WHITE, mix(C.hi, WHITE, 0.2)), x, y, size: clamp(22 + deg * 3.5, 22, 34) * (0.92 + 0.08 * power), max: rnd(0.9, 1.05), a: 1, fadeIn: 0.04, rot: Math.PI / 4 * (Math.random() < 0.5 ? 0 : 1) });
    steer(star, starStep, Object.assign({}, e0, { rot: rnd(-0.5, 0.5) }));
    if (BR.reducedMotion && star) star.sx = star.sy = 1;
  };

  /* ===================================================================== WISPS (Epic, Pop Pass)
     A small friendly ghost: a pale body with two dark eyes and a hem shot with the brick's colour. It pops out with a squash, floats up on
     a sine-wave sway, blinks now and then, and fades. In a big pop only every second brick sends one (never more than six); the rest
     leave a couple of rising wisps of light in the brick's colour. */
  const ghostPath = (c, x0, y0, w, h) => {
    const r = w / 2, top = y0 + r;
    c.beginPath(); c.moveTo(x0, top); c.arc(x0 + r, top, r, Math.PI, 0);
    c.lineTo(x0 + w, y0 + h - 5);
    const k = 4, seg = w / k;
    for (let i = 0; i < k; i++) { const xa = x0 + w - i * seg, xb = xa - seg; c.quadraticCurveTo(xa - seg * 0.5, y0 + h + (i % 2 ? 2.5 : -4.5), xb, y0 + h - 5); }
    c.closePath();
  };
  const ghostImg = (C, blink) => bake('s4ghost' + C.glow + (blink ? 'b' : 'o'), 48, 56, (c) => {
    const x0 = 8, y0 = 6, w = 32, h = 40;
    let g = c.createRadialGradient(24, 26, 0, 24, 26, 26); g.addColorStop(0, 'rgba(210,236,255,.4)'); g.addColorStop(1, 'rgba(210,236,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 48, 56);
    // stub arms
    c.fillStyle = '#e3f1ff'; [[6, 29], [42, 29]].forEach(([ax, ay]) => { c.beginPath(); c.ellipse(ax, ay, 4.2, 3.2, ax < 24 ? -0.5 : 0.5, 0, TAU); c.fill(); });
    ghostPath(c, x0, y0, w, h);
    g = c.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#e8f4ff'); g.addColorStop(0.72, mix('#dcecff', C.hi, 0.35)); g.addColorStop(1, mix(C.hi, C.glow, 0.5));
    c.fillStyle = g; c.fill();
    c.strokeStyle = rgba(mix(C.lo, '#6a7fc0', 0.4), 0.55); c.lineWidth = 1; c.stroke();
    // face
    c.fillStyle = '#1d2142';
    if (blink) { c.strokeStyle = '#1d2142'; c.lineWidth = 1.7; c.lineCap = 'round'; [17, 31].forEach((ex) => { c.beginPath(); c.arc(ex, 21, 2.6, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }); }
    else { [17, 31].forEach((ex) => { c.beginPath(); c.ellipse(ex, 21, 2.7, 3.6, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + 0.9, 19.6, 0.95, 0, TAU); c.fill(); c.fillStyle = '#1d2142'; }); }
    c.fillStyle = 'rgba(255,140,170,.4)'; [[12, 27], [36, 27]].forEach(([bx, by]) => { c.beginPath(); c.ellipse(bx, by, 3.2, 2, 0, 0, TAU); c.fill(); });
    c.fillStyle = '#1d2142'; c.beginPath(); c.ellipse(24, 28, 2, 2.6, 0, 0, TAU); c.fill();
  });
  function ghostStep(p, dt, e) {
    const u = p.life, t = u / p.max, pop = clamp(u / 0.2, 0, 1);
    const sq = pop < 1 ? 0.5 + 0.5 * easeOut(pop) + 0.22 * Math.sin(pop * Math.PI) : 1, br = 0.04 * Math.sin(u * 7 + e.ph);
    p.sx = sq * (1 - br) * (pop < 0.5 ? 0.85 : 1); p.sy = sq * (1 + br) * (pop < 0.5 ? 1.18 : 1);
    const kk = Math.exp(-3.2 * u);
    p.vx = e.vx0 * kk + Math.cos(u * e.f + e.ph) * e.f * e.amp * (1 - kk);
    p.vy = e.vy0 * kk - e.rise * (1 - kk);
    p.rot = Math.sin(u * e.f + e.ph) * 0.2;
    e.bl -= dt;
    if (e.bl <= 0) { p.img = e.blink; if (e.bl < -0.11) { p.img = e.open; e.bl = rnd(0.7, 1.4); } }
  }
  PR.wisps = function ({ x, y, glow, hi, n, power }) {
    const fx = this, C = tints(glow, hi), info = popInfo(), big = info.size >= 7;
    spr(fx, { img: glowImg(C.glow), x, y, size: 58, max: 0.28, a: 0.9, grow: 0.7 });
    if ((!big || info.k % 2 === 1) && PC.ghosts < 6) {
      PC.ghosts++;
      const open = ghostImg(C, false), blink = ghostImg(C, true);
      const p = spr(fx, { img: open, x, y, vx: rnd(-34, 34), vy: rnd(-230, -170), g: 0, drag: 0.5, size: rnd(27, 32) * (0.92 + 0.08 * power), max: rnd(1.25, 1.55), a: 1, fadeIn: 0.05 });
      steer(p, ghostStep, { open, blink, vx0: p.vx, vy0: p.vy, ph: rnd(0, TAU), f: rnd(4.6, 6.2), amp: rnd(15, 24), rise: rnd(70, 100), bl: rnd(0.4, 1) });
      if (BR.reducedMotion && p) { p.vy = -90; p.drag = 0.8; }
    } else {
      for (let i = 0, k = Math.min(2, n - 1); i < k; i++) fx.emit({ kind: 'spark', x: x + rnd(-8, 8), y: y + rnd(-5, 5), vx: rnd(-26, 26), vy: rnd(-120, -60), g: -20, drag: 1.1, size: rnd(3.4, 5.2), max: rnd(0.6, 0.95), color: i ? WHITE : C.hi });
    }
  };

  /* ===================================================================== DOM sprites and the shared moment tools
     A moment draws with canvas particles (tagged `mo`, so the tests can find them), a few fading lines, and at most three DOM sprites in
     the shared layer #s3fx (transform and opacity only, removed when their animation ends). The style sheet below is injected the first
     time a moment needs it. */
  const memo = {};
  const once = (k, fn) => memo[k] || (memo[k] = fn());
  const CSS = `
.s4m{position:absolute;pointer-events:none;will-change:transform,opacity}
.s4m>svg{display:block;width:100%;height:100%;overflow:visible}
.s4-shim{overflow:hidden;border-radius:14px}
.s4-shim>b{position:absolute;top:-25%;bottom:-25%;left:0;width:34%;background:linear-gradient(90deg,rgba(255,222,120,0),rgba(255,226,140,.8) 42%,rgba(255,252,214,.95) 52%,rgba(255,226,140,.8) 62%,rgba(255,222,120,0));transform:translateX(-130%) skewX(-20deg)}
.s4-peek{overflow:hidden}
.s4-peek svg{display:block;width:100%;height:100%}
.s4-swirl{position:absolute;pointer-events:none;will-change:transform,opacity}
.s4-swirl>i{position:absolute;inset:0;animation:s4spin 24s linear infinite}
.s4-swirl>i>svg{display:block;width:100%;height:100%}
@keyframes s4spin{to{transform:rotate(360deg)}}
.s4-sky{position:absolute;inset:0;pointer-events:none;opacity:0}
`;
  const cssOnce = () => { if (memo.css || document.getElementById('s4pops-css')) { memo.css = 1; return; } memo.css = 1; const el = document.createElement('style'); el.id = 's4pops-css'; el.textContent = CSS; document.head.appendChild(el); };
  const spriteLayer = () => {
    let l = document.getElementById('s3fx');
    if (!l || !l.isConnected) { l = document.createElement('div'); l.id = 's3fx'; l.setAttribute('aria-hidden', 'true'); document.body.appendChild(l); }
    return l;
  };
  /** A sprite of w x h px centred on (x, y) that plays `frames` and removes itself. At most 26 live in the shared layer. */
  function dom(cls, x, y, w, h, frames, opts, inner) {
    cssOnce();
    const L = spriteLayer();
    if (L.childElementCount >= 26) return null;
    const el = document.createElement('i');
    el.className = 's4m ' + cls;
    el.style.cssText = `left:${(x - w / 2).toFixed(1)}px;top:${(y - h / 2).toFixed(1)}px;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px`;
    if (inner) el.innerHTML = inner;
    if (!el.animate) return null;
    L.appendChild(el);
    const a = el.animate(frames, Object.assign({ fill: 'forwards' }, opts));
    let fin = false;
    const done = () => { if (fin) return; fin = true; el.remove(); };
    a.onfinish = done; a.oncancel = done;
    setTimeout(done, (opts.duration || 600) + (opts.delay || 0) + 250);
    return el;
  }
  const mo = (fx, p) => { p.mo = 1; return put(fx, p); };
  const mspr = (fx, o) => { o.mo = 1; return spr(fx, o); };
  const mring = (fx, x, y, color, R, life, w) => { const k = fx.rings.length; fx.ring(x, y, color, R, life, w); if (fx.rings.length > k) fx.rings[fx.rings.length - 1].mo = 1; };
  const mlink = (fx, x0, y0, x1, y1, color, life, w, tag) => { const k = fx.links.length; fx.link(x0, y0, x1, y1, color, life, w); const l = fx.links[k]; if (l && fx.links.length > k) l[tag || 'mo'] = 1; };
  const sound = (name, ...a) => { if (BR.audio && typeof BR.audio[name] === 'function') { try { BR.audio[name](...a); } catch (e) { /* sound is optional */ } } };
  const hitStop = (n) => (n >= 8 ? Math.min(70, 40 + n) : 0);   // the pause the board makes before a big pop bursts (js/view.js)
  /** A tone on the shared audio bus (quiet, short): the celesta notes of Constellation. */
  const ping = (f, at, vol, dur) => { if (BR.audio && BR.audio.tone) BR.audio.tone({ f, at, vol, dur: dur || 0.2, attack: 0.004, cat: 'deco' }); };
  /** A line (row or column) of a Line Blast as page points, from the plan the engine made. */
  function lineOf(d) {
    const v = d.view, p = d.res && d.res.plan;
    if (!v || !p || !p.line) return null;
    const horiz = !!p.lineH, cols = BR.CFG.cols, rows = BR.CFG.rows, pts = [];
    for (let k = 0; k < (horiz ? cols : rows); k++) pts.push(horiz ? v.pagePoint(p.r, k) : v.pagePoint(k, p.c));
    return { horiz, pts, fixed: horiz ? p.r : p.c, at: horiz ? p.c : p.r, v, plan: p, color: BR.PALETTE[(p.color || 0) % 7] };
  }
  /** A rounded rectangle path around the board: at(s) is the point s px along it (clockwise from the top-left corner's end). */
  function perimeter(r, inset, rad) {
    const l = r.left - inset, t = r.top - inset, w = r.width + 2 * inset, h = r.height + 2 * inset, k = rad, sx = w - 2 * k, sy = h - 2 * k, q = Math.PI * k / 2, P = 2 * sx + 2 * sy + 4 * q;
    const at = (s) => {
      s = ((s % P) + P) % P;
      if (s < sx) return { x: l + k + s, y: t };
      s -= sx; if (s < q) { const a = s / k - Math.PI / 2; return { x: l + w - k + Math.cos(a) * k, y: t + k + Math.sin(a) * k }; }
      s -= q; if (s < sy) return { x: l + w, y: t + k + s };
      s -= sy; if (s < q) { const a = s / k; return { x: l + w - k + Math.cos(a) * k, y: t + h - k + Math.sin(a) * k }; }
      s -= q; if (s < sx) return { x: l + w - k - s, y: t + h };
      s -= sx; if (s < q) { const a = s / k + Math.PI / 2; return { x: l + k + Math.cos(a) * k, y: t + h - k + Math.sin(a) * k }; }
      s -= q; if (s < sy) return { x: l, y: t + h - k - s };
      s -= sy; const a = s / k + Math.PI; return { x: l + k + Math.cos(a) * k, y: t + k + Math.sin(a) * k };
    };
    return { P, at };
  }
  const readout = (G) => { const el = document.getElementById('fuseTime'); if (el) { const r = el.getBoundingClientRect(); if (r.width) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; } return { x: G.c0.x, y: G.c0.y - 260 }; };
  const MO = {};   // recipe -> { pop(G, d, ctx), line(d, ctx), rushStart(d, ctx), rushEnd(d, ctx), stageUp(d, ctx) }

  /* ===================================================================== GOLD LEAF moments */
  const GOLDS = ['#fff3b0', '#ffe27a', '#ffd04a', '#f6b73a'];
  const ALCHEMY = () => once('alch', () => {
    const shapes = '<circle r="46"/><rect x="-32.5" y="-32.5" width="65" height="65"/><path d="M0 -32.5L32.5 32.5H-32.5Z"/><circle cy="12.4" r="20"/>';
    let ticks = '';
    for (let i = 0; i < 24; i++) { const a = i * TAU / 24, r1 = i % 2 ? 49 : 52; ticks += `<path d="M${(Math.cos(a) * 46).toFixed(1)} ${(Math.sin(a) * 46).toFixed(1)}L${(Math.cos(a) * r1).toFixed(1)} ${(Math.sin(a) * r1).toFixed(1)}"/>`; }
    return `<svg viewBox="-56 -56 112 112" fill="none" stroke-linejoin="round" stroke-linecap="round"><g stroke="#ff9a1e" stroke-width="4.2" opacity=".5">${shapes}${ticks}</g><g stroke="#fff0b0" stroke-width="1.6">${shapes}${ticks}</g></svg>`;
  });
  MO.goldleaf = {
    pop(G, d, ctx) {
      const fx = ctx.fx, n = G.n, hit = hitStop(n);
      if (n >= 8) {
        const S = clamp(Math.max(G.box.x1 - G.box.x0, G.box.y1 - G.box.y0) + brickSize() * 1.5, 140, 190);
        dom('s4-alch', G.c0.x, G.c0.y, S, S, [
          { transform: 'scale(0.55) rotate(-34deg)', opacity: 0 },
          { transform: 'scale(0.95) rotate(-6deg)', opacity: 0.95, offset: 0.26 },
          { transform: 'scale(1.04) rotate(2deg)', opacity: 1, offset: 0.4 },
          { transform: 'scale(1.28) rotate(26deg)', opacity: 0 },
        ], { duration: 520, delay: 10, easing: 'cubic-bezier(0.2,0.7,0.3,1)' }, ALCHEMY());
        later(() => {
          const b = boardRect(ctx), R = Math.max(b.width, 260) * 0.92;
          mring(fx, G.c0.x, G.c0.y, '#ffe9a0', R, 0.42, 3.8);
          mring(fx, G.c0.x, G.c0.y, '#ff9a1e', R * 0.72, 0.36, 2.4);
          const k = cnt(14);
          for (let i = 0; i < k; i++) {
            const a = (i / k) * TAU + rnd(-0.1, 0.1), sp = rnd(150, 300);
            mo(fx, { shape: 'star', x: G.c0.x + Math.cos(a) * 34, y: G.c0.y + Math.sin(a) * 34, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3.2, size: rnd(6, 10), max: rnd(0.3, 0.4), rot: rnd(0, TAU), vr: rnd(-8, 8), color: GOLDS[i % 4] });
          }
        }, 60 + hit);
      }
      if (rushOn()) {
        // Rush: a second shower, fine gold dust, from every brick as it goes
        G.cells.slice(0, 12).forEach((q) => {
          const dist = G.plan && q.r >= 0 ? Math.abs(q.r - G.plan.r) + Math.abs(q.c - G.plan.c) : 0;
          later(() => { for (let k = 0, m = cnt(2); k < m; k++) mo(fx, { kind: 'spark', x: q.x + rnd(-12, 12), y: q.y + rnd(-10, 6), vx: rnd(-60, 60), vy: rnd(-130, 10), g: 340, drag: 1.5, size: rnd(1.5, 2.8), max: rnd(0.22, 0.3), color: pick(GOLDS) }); }, 70 + hit + Math.min(dist * 17, 150));
        });
      }
    },
    line(d, ctx) {
      const L = lineOf(d); if (!L) return;
      const fx = ctx.fx, v = L.v, cell = v.cell, p0 = v.layerPoint(0, 0), len = cell * BR.CFG.cols, host = document.getElementById('fxlayer');
      if (host) {
        // the beam turns molten gold: a hot core laid over the game's own beam
        const el = document.createElement('div');
        const g = L.horiz ? '90deg' : '180deg';
        el.style.cssText = `position:absolute;pointer-events:none;z-index:5;border-radius:999px;background:linear-gradient(${g},transparent,#fff3c0 16%,#ffbd2e 50%,#fff3c0 84%,transparent);box-shadow:0 0 26px 7px rgba(255,170,30,.7);will-change:transform,opacity;`;
        if (L.horiz) { el.style.left = p0.x - cell / 2 + 'px'; el.style.top = p0.y + L.fixed * cell - cell * 0.3 + 'px'; el.style.width = len + 'px'; el.style.height = cell * 0.6 + 'px'; }
        else { el.style.left = p0.x + L.fixed * cell - cell * 0.3 + 'px'; el.style.top = p0.y - cell / 2 + 'px'; el.style.width = cell * 0.6 + 'px'; el.style.height = len + 'px'; }
        host.appendChild(el);
        const a = el.animate([{ transform: L.horiz ? 'scaleX(0) scaleY(0.2)' : 'scaleY(0) scaleX(0.2)', opacity: 1 }, { transform: 'scale(1,1)', opacity: 1, offset: 0.28 }, { transform: L.horiz ? 'scaleX(1) scaleY(0.05)' : 'scaleY(1) scaleX(0.05)', opacity: 0 }], { duration: 540, easing: 'cubic-bezier(0.2,0.8,0.3,1)', fill: 'forwards' });
        a.onfinish = a.oncancel = () => el.remove();
        setTimeout(() => el.remove(), 800);
      }
      // flakes shake loose along the whole line
      const C = tints(L.color.glow, L.color.hi);
      L.pts.forEach((q, j) => {
        later(() => {
          for (let k = 0, m = cnt(2); k < m; k++) {
            const sh = (j + k) % 3, bright = flakeImg(C, sh, false), dark = flakeImg(C, sh, true);
            const p = mspr(fx, { img: bright, x: q.x + rnd(-10, 10), y: q.y + rnd(-6, 6), vx: rnd(-50, 50), vy: rnd(-120, -30), g: 560, drag: 1.2, size: rnd(12, 17), rot: rnd(0, TAU), max: rnd(0.34, 0.46), a: 1, fadeIn: 0.04 });
            steer(p, flakeStep, { bright, dark, ph: rnd(0, TAU), ph0: rnd(0, TAU), w: rnd(11, 16) * (Math.random() < 0.5 ? -1 : 1), r0: rnd(0, TAU) });
          }
        }, Math.abs(j - L.at) * 16);
      });
    },
    stageUp(d, ctx) {
      const strip = document.getElementById('stageStrip'); if (!strip) return;
      const r = strip.getBoundingClientRect(); if (!r.width) return;
      const el = dom('s4-shim', r.left + r.width / 2, r.top + r.height / 2, r.width, r.height, [{ opacity: 1 }, { opacity: 1, offset: 0.82 }, { opacity: 0 }], { duration: 760 }, '<b></b>');
      if (el && el.firstChild && el.firstChild.animate) el.firstChild.animate([{ transform: 'translateX(-130%) skewX(-20deg)' }, { transform: 'translateX(360%) skewX(-20deg)' }], { duration: 640, delay: 40, easing: 'cubic-bezier(0.35,0.1,0.4,1)', fill: 'both' });
      for (let i = 0, k = cnt(9); i < k; i++) later(() => mo(ctx.fx, { shape: 'star', x: r.left + r.width * (0.08 + 0.84 * (i / Math.max(1, k - 1))) + rnd(-8, 8), y: r.top + r.height * rnd(0.2, 0.8), vx: rnd(-20, 20), vy: rnd(-70, -20), drag: 1.4, size: rnd(5, 9), max: rnd(0.28, 0.4), rot: rnd(0, TAU), vr: rnd(-6, 6), color: GOLDS[i % 4] }), 40 + i * 62);
    },
  };

  /* ===================================================================== SANDFALL moments */
  /** Points of an hourglass (two cones meeting at the waist, a cap at each end), in px around its centre. */
  const HOURGLASS = () => once('hg', () => {
    const W = 19, H = 32, pts = [];
    for (let i = 0; i < 5; i++) { const x = -W + (i * 2 * W) / 4; pts.push([x, -H, 1], [x, H, 0]); }
    for (let k = 1; k <= 4; k++) { const t = k / 4; pts.push([-W * (1 - t), -H * (1 - t), 1], [W * (1 - t), -H * (1 - t), 1], [-W * (1 - t), H * (1 - t), 0], [W * (1 - t), H * (1 - t), 0]); }
    pts.push([0, -8, 1], [0, 8, 0]);
    return pts;
  });
  function hgStep(p, dt, e) {
    const u = p.life;
    if (u < e.g1) { const m = easeOut(u / e.g1); p.x = lerp(e.sx, e.tx, m); p.y = lerp(e.sy, e.ty, m); }
    else if (u < e.p0) { p.x = e.tx + Math.sin(u * 38 + e.ph) * 1.1; p.y = e.ty + (e.top ? (u - e.g1) * 16 : 0) + Math.cos(u * 33 + e.ph) * 1.1; }
    else { const m = clamp((u - e.p0) / e.fl, 0, 1), s = easeIn(m); p.x = lerp(e.tx, e.rx, s) + Math.sin(m * Math.PI) * e.arc; p.y = lerp(e.ty, e.ry, s); }
    p.vx = p.vy = 0;
  }
  const grainCols = (C) => [C.hi, mix(C.hi, WHITE, 0.42), SAND[0], SAND[1], SAND[2], C.hi];
  MO.sandfall = {
    pop(G, d, ctx) {
      const fx = ctx.fx, n = G.n; if (n < 8) return;
      const C = tints(G.col.glow, G.col.hi), ro = readout(G), cols = grainCols(C);
      let pts = HOURGLASS(); if (BR.lowEnd) pts = pts.filter((q, i) => i % 2 === 0);
      const t0 = 60;
      pts.forEach((q, i) => {
        const src = G.cells[(Math.random() * G.cells.length) | 0];
        const e = { sx: src.x + rnd(-14, 14), sy: src.y + rnd(-14, 14), tx: G.c0.x + q[0], ty: G.c0.y + q[1], top: q[2], rx: ro.x + rnd(-6, 6), ry: ro.y + rnd(-4, 4), g1: 0.1, p0: 0.29 + i * 0.003, fl: 0.14, ph: rnd(0, TAU), arc: rnd(-14, 14) };
        later(() => { const p = mo(fx, { kind: 'shard', shape: 'pixel', x: e.sx, y: e.sy, size: rnd(2.6, 3.6), spread: 0, max: e.p0 + e.fl, color: cols[i % cols.length], g: 0, drag: 0, rot: 0, vr: 0 }); steer(p, hgStep, e); }, t0);
      });
      // the shape, drawn thin behind the grains while they hold
      const W = 19, H = 32, cx = G.c0.x, cy = G.c0.y, lc = mix(SAND[2], C.hi, 0.25);
      later(() => {
        [[-W, -H, W, -H], [-W, H, W, H], [-W, -H, W, H], [W, -H, -W, H]].forEach((s) => mlink(fx, cx + s[0], cy + s[1], cx + s[2], cy + s[3], lc, 0.26, 1.3));
        sound('whoosh');
      }, t0 + 100);
      // the time chip lands in a sandy puff
      later(() => {
        mspr(fx, { img: sandPuff(C), x: ro.x, y: ro.y, size: 46, max: 0.2, a: 0.9, grow: 0.7 });
        for (let i = 0, k = cnt(6); i < k; i++) { const a = rnd(0, TAU), s = rnd(40, 120); mo(fx, { kind: 'spark', x: ro.x, y: ro.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 2.2, size: rnd(1.6, 2.8), max: rnd(0.14, 0.2), color: pick(SAND) }); }
      }, 370);
    },
    line(d, ctx) {
      const L = lineOf(d); if (!L) return;
      const fx = ctx.fx, C = tints(L.color.glow, L.color.hi), cols = grainCols(C);
      L.pts.forEach((q, j) => {
        const delay = (L.horiz ? Math.abs(j - L.at) : j) * 18;
        later(() => {
          mspr(fx, { img: sandStreak(C, j % 2), x: q.x + rnd(-6, 6), y: q.y, vx: rnd(-14, 14), vy: rnd(120, 260), g: 1500, drag: 0.5, size: rnd(8, 11), max: rnd(0.34, 0.44), a: 1, fadeIn: 0.04, sy: 1.2 });
          for (let k = 0, m = cnt(3); k < m; k++) mo(fx, { kind: 'shard', shape: 'pixel', x: q.x + rnd(-12, 12), y: q.y + rnd(-6, 8), vx: rnd(-26, 26), vy: rnd(60, 280), g: 1500, drag: 0.5, size: rnd(1.8, 3), spread: 0, max: rnd(0.32, 0.44), color: cols[(j + k) % cols.length], rot: 0, vr: 0 });
        }, delay);
      });
    },
    stageUp(d, ctx) {
      const fx = ctx.fx, b = boardRect(d.run ? { view: d.run.view } : ctx), k = cnt(40);
      for (let i = 0; i < k; i++) {
        const x = b.left + ((i + 0.5) / k) * b.width + rnd(-4, 4), c = i % 4 === 3 ? BR.PALETTE[i % 7].hi : pick(SAND);
        later(() => mo(fx, { kind: 'shard', shape: 'pixel', x, y: b.top - 8, vx: rnd(-12, 12), vy: rnd(160, 300), g: 1300, drag: 0.5, size: rnd(2, 3.4), spread: 0, max: rnd(0.5, 0.62), color: c, rot: 0, vr: 0 }), rnd(0, 150));
      }
    },
  };

  /* ===================================================================== WHIRLGATE moments */
  const portalSvg = (kind) => once('pg-' + kind, () => {
    if (kind === 'a') {
      let ticks = '', arms = '';
      for (let i = 0; i < 16; i++) { const a = i * TAU / 16; ticks += `M${(Math.cos(a) * 41).toFixed(1)} ${(Math.sin(a) * 41).toFixed(1)}L${(Math.cos(a) * 47).toFixed(1)} ${(Math.sin(a) * 47).toFixed(1)}`; }
      for (let k = 0; k < 3; k++) { let dd = ''; for (let i = 0; i <= 26; i++) { const t = i / 26, r = 5 + t * 34, a = k * TAU / 3 + t * 8; dd += (i ? 'L' : 'M') + (Math.cos(a) * r).toFixed(1) + ' ' + (Math.sin(a) * r).toFixed(1); } arms += dd; }
      return `<svg viewBox="-52 -52 104 104" fill="none" stroke-linecap="round" stroke-linejoin="round"><defs><radialGradient id="s4pa"><stop offset="0" stop-color="#021a22" stop-opacity=".1"/><stop offset=".6" stop-color="#06323a" stop-opacity=".3"/><stop offset="1" stop-color="#0a5560" stop-opacity=".34"/></radialGradient></defs><circle r="44" fill="url(#s4pa)"/><g stroke="#0e8c93" stroke-width="5" opacity=".5"><circle r="44"/></g><g stroke="#27dcc6" stroke-width="2.2"><circle r="44"/><path d="${ticks}"/></g><path d="${arms}" stroke="#8ff5e6" stroke-width="1.3" opacity=".7"/></svg>`;
    }
    let dia = '';
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8, x = Math.cos(a) * 44, y = Math.sin(a) * 44; dia += `M${(x * 1.07).toFixed(1)} ${(y * 1.07).toFixed(1)}L${(Math.cos(a + 0.09) * 40).toFixed(1)} ${(Math.sin(a + 0.09) * 40).toFixed(1)}L${(Math.cos(a - 0.09) * 40).toFixed(1)} ${(Math.sin(a - 0.09) * 40).toFixed(1)}Z`; }
    return `<svg viewBox="-52 -52 104 104" fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#a8660a" stroke-width="4.4" opacity=".45"><circle r="44"/></g><g stroke="#ffd36a" stroke-width="2"><circle r="44"/></g><path d="${dia}" fill="#ffe08a" stroke="#fff3c0" stroke-width=".8"/></svg>`;
  });
  const EYE = () => once('eye', () => `<svg viewBox="-50 -30 100 60" fill="none" stroke-linecap="round" stroke-linejoin="round"><defs><radialGradient id="s4ei" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#d8fff6"/><stop offset=".45" stop-color="#27dcc6"/><stop offset="1" stop-color="#0a6c78"/></radialGradient></defs><path d="M-46 0Q-22 -27 0 -27Q22 -27 46 0Q22 27 0 27Q-22 27 -46 0Z" fill="#02161c" fill-opacity=".8" stroke="#a8660a" stroke-width="5" opacity=".5"/><path d="M-46 0Q-22 -27 0 -27Q22 -27 46 0Q22 27 0 27Q-22 27 -46 0Z" fill="#031c23" fill-opacity=".85" stroke="#ffd36a" stroke-width="2.2"/><circle r="17" fill="url(#s4ei)" stroke="#8ff5e6" stroke-width="1"/><ellipse rx="3.4" ry="14" fill="#01070a"/><circle cx="-6" cy="-7" r="3" fill="#fff" opacity=".9"/><path d="M-30 -14Q-34 -22 -42 -22M30 -14Q34 -22 42 -22" stroke="#ffd36a" stroke-width="1.6"/></svg>`);
  const swirlSvg = () => once('swirl', () => {
    let arms = '';
    for (let k = 0; k < 4; k++) { let dd = ''; for (let i = 0; i <= 40; i++) { const t = i / 40, r = 8 + t * 88, a = k * TAU / 4 + t * 5.4; dd += (i ? 'L' : 'M') + (Math.cos(a) * r).toFixed(1) + ' ' + (Math.sin(a) * r).toFixed(1); } arms += `<path d="${dd}" stroke="${k % 2 ? '#ffd36a' : '#27dcc6'}"/>`; }
    return `<svg viewBox="-100 -100 200 200" fill="none" stroke-width="1.8" stroke-linecap="round"><g opacity=".9">${arms}</g><circle r="97" stroke="#27dcc6" stroke-width="1.4" opacity=".7"/><circle r="90" stroke="#ffd36a" stroke-width=".9" opacity=".5" stroke-dasharray="2 7"/></svg>`;
  });
  const RUSH = { swirl: null, sky: null, ghosts: 0 };
  const killEl = (k, ms) => {
    const el = RUSH[k]; RUSH[k] = null; if (!el) return;
    if (el.animate && ms) { const a = el.animate([{ opacity: +getComputedStyle(el).opacity || 1 }, { opacity: 0 }], { duration: ms, fill: 'forwards' }); a.onfinish = () => el.remove(); setTimeout(() => el.remove(), ms + 200); } else el.remove();
  };
  MO.whirlgate = {
    pop(G, d, ctx) {
      const fx = ctx.fx, n = G.n; if (n < 8) return;
      const c = G.c0, R = clamp(Math.max(G.box.x1 - G.box.x0, G.box.y1 - G.box.y0) / 2 + 40, 64, 120), S = R * 2, dir = Math.random() < 0.5 ? 1 : -1, tn = now();
      PC.portal = { x: c.x, y: c.y, t: tn, dir, R, close: tn + 440 };
      const open = [{ transform: 'scale(0.15) rotate(0deg)', opacity: 0 }, { transform: `scale(1.06) rotate(${dir * 36}deg)`, opacity: 1, offset: 0.28 }, { transform: `scale(1) rotate(${dir * 86}deg)`, opacity: 1, offset: 0.74 }, { transform: `scale(0.05) rotate(${dir * 124}deg)`, opacity: 0 }];
      dom('s4-pa', c.x, c.y, S, S, open, { duration: 470, easing: 'cubic-bezier(0.25,0.7,0.35,1)' }, portalSvg('a'));
      dom('s4-pb', c.x, c.y, S * 0.78, S * 0.78, open.map((f) => Object.assign({}, f, { transform: f.transform.replace(/rotate\(([-\d.]+)deg\)/, (m, a) => `rotate(${-a * 1.3}deg)`) })), { duration: 470, easing: 'cubic-bezier(0.25,0.7,0.35,1)' }, portalSvg('b'));
      if (n >= 12) dom('s4-eye', c.x, c.y, S * 0.7, S * 0.42, [{ transform: 'scaleY(0.04)', opacity: 0 }, { transform: 'scaleY(1)', opacity: 1, offset: 0.22 }, { transform: 'scaleY(1)', opacity: 1, offset: 0.62 }, { transform: 'scaleY(0.04)', opacity: 0 }], { duration: 230, delay: 150, easing: 'ease-in-out' }, EYE());
      // the portal draws in a little dust of its own
      const i1 = cometImg(TEAL, TEAL_D), i2 = cometImg('#ffe08a', GOLD_D);
      for (let i = 0, k = cnt(14); i < k; i++) {
        const a0 = (i / k) * TAU, r0 = R * rnd(0.85, 1.05);
        const p = mspr(fx, { img: i % 2 ? i1 : i2, x: c.x + Math.cos(a0) * r0, y: c.y + Math.sin(a0) * r0, size: rnd(34, 46), max: rnd(0.32, 0.42), a: 1, fadeIn: 0.05, rot: a0 + Math.PI / 2 });
        steer(p, spiralStep, { x: c.x, y: c.y, tx: c.x, ty: c.y, a0, r0, dir, turns: rnd(0.8, 1.1), i0: i1, i1, i2, fx, grp: null, big: true, started: false });
      }
      later(() => { mring(fx, c.x, c.y, TEAL, 40, 0.14, 3); mo(fx, { kind: 'spark', x: c.x, y: c.y, size: 14, max: 0.12, color: WHITE }); sound('thud', 0.6); }, 440);
    },
    line(d, ctx) {
      const L = lineOf(d); if (!L) return;
      const fx = ctx.fx, cell = L.v.cell, a = L.pts[0], b = L.pts[L.pts.length - 1];
      const A = L.horiz ? { x: a.x - cell * 0.55, y: a.y } : { x: a.x, y: a.y - cell * 0.55 }, B = L.horiz ? { x: b.x + cell * 0.55, y: b.y } : { x: b.x, y: b.y + cell * 0.55 }, S = cell * 1.9;
      const frames = (s) => [{ transform: 'scale(0.2) rotate(0deg)', opacity: 0 }, { transform: `scale(1) rotate(${s * 40}deg)`, opacity: 1, offset: 0.22 }, { transform: `scale(1) rotate(${s * 150}deg)`, opacity: 1, offset: 0.78 }, { transform: `scale(0.1) rotate(${s * 190}deg)`, opacity: 0 }];
      dom('s4-pa', A.x, A.y, S, S, frames(1), { duration: 520, easing: 'ease-out' }, portalSvg('a'));
      dom('s4-pa', B.x, B.y, S, S, frames(-1), { duration: 520, easing: 'ease-out' }, portalSvg('a'));
      // the beam passes from one gate into the other: comets stream along the line
      const ang = Math.atan2(B.y - A.y, B.x - A.x), len = Math.hypot(B.x - A.x, B.y - A.y), life = 0.32, ti = cometImg(TEAL, TEAL_D), gi = cometImg('#ffe08a', GOLD_D);
      for (let i = 0, k = cnt(14); i < k; i++) later(() => {
        const o = rnd(-cell * 0.18, cell * 0.18);
        mspr(fx, { img: i % 2 ? ti : gi, x: A.x - Math.sin(ang) * o, y: A.y + Math.cos(ang) * o, vx: Math.cos(ang) * len / life, vy: Math.sin(ang) * len / life, drag: 0, size: rnd(44, 60), rot: ang, max: life, a: 1, fadeIn: 0.05 });
      }, 90 + i * 16);
      later(() => { mring(fx, B.x, B.y, TEAL, cell * 1.1, 0.2, 2.6); mo(fx, { kind: 'spark', x: B.x, y: B.y, size: 10, max: 0.14, color: WHITE }); }, 330);
    },
    rushStart(d, ctx) {
      const fx = ctx.fx, b = boardRect(d.run ? { view: d.run.view } : ctx), cx = b.left + b.width / 2, cy = b.top + b.height / 2, bg = document.getElementById('bg');
      if (bg && !BR.lowEnd) {
        cssOnce(); killEl('swirl');
        const S = b.width * 1.62, el = document.createElement('div');
        el.className = 's4-swirl';
        el.style.cssText = `left:${(cx - S / 2).toFixed(1)}px;top:${(cy - S / 2).toFixed(1)}px;width:${S.toFixed(1)}px;height:${S.toFixed(1)}px;opacity:.34`;
        el.innerHTML = '<i>' + swirlSvg() + '</i>';
        bg.insertBefore(el, bg.querySelector('.vignette'));
        if (el.animate) el.animate([{ transform: 'scale(0.3)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 0.8, offset: 0.55 }, { transform: 'scale(1)', opacity: 0.34 }], { duration: 640, easing: 'cubic-bezier(0.2,0.7,0.3,1)' });
        RUSH.swirl = el;
      }
      // a ring of comets wheels once around the board as the gate opens
      const k = cnt(12), ti = cometImg(TEAL, TEAL_D), gi = cometImg('#ffe08a', GOLD_D), rx = b.width / 2 + 18, ry = b.height / 2 + 36;
      for (let i = 0; i < k; i++) {
        const a0 = (i / k) * TAU, dir = 1;
        const p = mspr(fx, { img: i % 2 ? ti : gi, x: cx + Math.cos(a0) * rx, y: cy + Math.sin(a0) * ry, size: rnd(46, 58), max: 0.62, a: 1, fadeIn: 0.08, rot: a0 + Math.PI / 2 });
        steer(p, orbitStep, { cx, cy, rx, ry, a0, dir });
      }
    },
    rushEnd() { killEl('swirl', 320); },
    stageUp(d, ctx) {
      const fx = ctx.fx, b = boardRect(d.run ? { view: d.run.view } : ctx), cx = b.left + b.width / 2, cy = b.top + b.height / 2, S = b.width * 1.18;
      dom('s4-pa', cx, cy, S, S, [{ transform: 'scale(1.5) rotate(0deg)', opacity: 0 }, { transform: 'scale(1) rotate(60deg)', opacity: 1, offset: 0.3 }, { transform: 'scale(0.06) rotate(150deg)', opacity: 1, offset: 0.54 }, { transform: 'scale(0.5) rotate(190deg)', opacity: 1, offset: 0.64 }, { transform: 'scale(1.55) rotate(250deg)', opacity: 0 }], { duration: 840, easing: 'ease-in-out' }, portalSvg('b'));
      later(() => {
        mring(fx, cx, cy, TEAL, b.width * 0.62, 0.4, 3.2); mo(fx, { kind: 'spark', x: cx, y: cy, size: 18, max: 0.16, color: WHITE });
        for (let i = 0, k = cnt(14); i < k; i++) { const a = (i / k) * TAU, s = rnd(180, 360); mo(fx, { kind: 'spark', x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 3.2, size: rnd(2, 3.6), max: rnd(0.26, 0.38), color: i % 2 ? TEAL : '#ffd36a' }); }
      }, 440);
    },
  };
  function orbitStep(p, dt, e) {
    const t = clamp(p.life / p.max, 0, 1), a = e.a0 + e.dir * TAU * easeIO(t) * 0.9, nx = e.cx + Math.cos(a) * e.rx, ny = e.cy + Math.sin(a) * e.ry;
    if (p.life > 0.001) p.rot = Math.atan2(ny - p.y, nx - p.x);
    p.x = nx; p.y = ny; p.vx = p.vy = 0;
    p.sx = 1 - 0.3 * t; p.sy = 1 - 0.3 * t;
  }

  /* ===================================================================== CONSTELLATION moments */
  const CREATURES = {
    stag: { pts: [[14, 45], [24, 48], [44, 43], [64, 45], [68, 58], [46, 58], [28, 58], [76, 32], [90, 35], [80, 40], [74, 26], [70, 14], [80, 12], [64, 8], [86, 4], [78, 66], [90, 62], [66, 72], [74, 84], [14, 66], [6, 60], [22, 72], [14, 84]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1], [3, 7], [7, 8], [8, 9], [9, 7], [7, 10], [10, 11], [10, 12], [11, 13], [12, 14], [4, 15], [15, 16], [4, 17], [17, 18], [6, 19], [19, 20], [6, 21], [21, 22]] },
    whale: { pts: [[94, 54], [84, 42], [66, 36], [46, 38], [28, 46], [18, 52], [6, 34], [14, 50], [4, 66], [28, 62], [48, 68], [70, 68], [86, 62], [82, 52], [58, 82], [62, 68], [80, 40], [78, 28], [70, 18], [88, 20]],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 5], [4, 9], [9, 10], [10, 11], [11, 12], [12, 0], [11, 15], [15, 14], [14, 10], [16, 17], [17, 18], [17, 19]] },
    fox: { pts: [[92, 48], [82, 40], [78, 24], [74, 38], [90, 26], [86, 38], [80, 54], [70, 44], [48, 40], [28, 46], [16, 38], [6, 26], [10, 48], [32, 58], [54, 58], [68, 56], [72, 78], [60, 80], [30, 80], [42, 80]],
      lines: [[1, 2], [2, 3], [1, 4], [4, 5], [1, 0], [0, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 9], [9, 13], [13, 14], [14, 15], [15, 7], [15, 16], [15, 17], [13, 18], [14, 19]] },
  };
  const creatureOf = (idx) => (idx === 0 || idx === 5 ? 'fox' : idx === 1 || idx === 6 ? 'whale' : 'stag');   // Ruby and Amber: fox, Sapphire and Aqua: whale, the rest: stag
  const creatureSvg = (kind, C) => once('cr-' + kind + C.glow, () => {
    const D = CREATURES[kind], deg = D.pts.map(() => 0);
    D.lines.forEach(([a, b]) => { deg[a]++; deg[b]++; });
    let path = ''; D.lines.forEach(([a, b]) => { path += `M${D.pts[a][0]} ${D.pts[a][1]}L${D.pts[b][0]} ${D.pts[b][1]}`; });
    const halo = mix(C.hi, WHITE, 0.15);
    let stars = '';
    D.pts.forEach(([x, y], i) => { const r = deg[i] >= 3 ? 2.9 : deg[i] === 1 ? 1.8 : 2.2; stars += `<circle cx="${x}" cy="${y}" r="${(r * 2.6).toFixed(1)}" fill="${halo}" opacity=".28"/><circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`; });
    return `<svg viewBox="0 0 100 100" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="${path}" stroke="${halo}" stroke-width="3.4" opacity=".3"/><path d="${path}" stroke="#eef4ff" stroke-width="1.2" opacity=".92"/>${stars}</svg>`;
  });
  /** The group as a constellation: stars at the brick centres (nudged a little), joined along the adjacency, tapped brick first. */
  function constellation(G) {
    const cells = G.cells, key = (q) => q.r * 16 + q.c, byKey = new Map();
    cells.forEach((q) => { q.deg = 0; q.gx = q.x; q.gy = q.y; byKey.set(key(q), q); });
    const edges = [], seen = new Set(), start = byKey.get(G.plan ? G.plan.r * 16 + G.plan.c : -1) || cells[0], queue = [start], tree = new Set([start]);
    const ek = (a, b) => (key(a) < key(b) ? key(a) + '-' + key(b) : key(b) + '-' + key(a));
    while (queue.length) {
      const a = queue.shift();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => { const b = byKey.get(key({ r: a.r + dr, c: a.c + dc })); if (b && !tree.has(b)) { tree.add(b); queue.push(b); edges.push([a, b]); seen.add(ek(a, b)); } });
    }
    cells.forEach((a) => [[0, 1], [1, 0]].forEach(([dr, dc]) => { const b = byKey.get(key({ r: a.r + dr, c: a.c + dc })); if (b && !seen.has(ek(a, b))) { seen.add(ek(a, b)); edges.push([a, b]); } }));
    const use = edges.slice(0, 14);
    use.forEach(([a, b]) => { a.deg++; b.deg++; });
    cells.forEach((q) => { q.x = q.gx + rnd(-4.5, 4.5); q.y = q.gy + rnd(-4.5, 4.5); });
    return { edges: use, nodes: cells.map((q) => ({ gx: q.gx, gy: q.gy, x: q.x, y: q.y, deg: q.deg })) };
  }
  const SKY = () => {
    const cons = (x0, y0, w, h) => {
      const pts = []; let x = x0, y = y0 + h * rnd(0.3, 0.7);
      for (let i = 0; i < 7; i++) { pts.push([x, y]); x += w / 6 + rnd(-6, 6); y = clamp(y + rnd(-h * 0.45, h * 0.45), y0, y0 + h); }
      let s = ''; pts.forEach((q, i) => { if (i) s += `M${pts[i - 1][0].toFixed(1)} ${pts[i - 1][1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}`; });
      const b = pts[3 + ((Math.random() * 2) | 0)]; s += `M${b[0].toFixed(1)} ${b[1].toFixed(1)}L${(b[0] + rnd(-20, 20)).toFixed(1)} ${(b[1] + rnd(-26, 26)).toFixed(1)}`;
      return `<path d="${s}" stroke="#dfe9ff" stroke-width="1" opacity=".5"/>` + pts.map((q, i) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${i % 3 === 0 ? 2.2 : 1.5}" fill="#fff" opacity=".85"/>`).join('');
    };
    const w = innerWidth, h = innerHeight;
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none" stroke-linecap="round">${cons(w * 0.2, h * 0.012, w * 0.5, 62)}${cons(w * 0.14, h * 0.915, w * 0.62, 50)}</svg>`;
  };
  function wheelStep(p, dt, e) {
    const t = clamp(p.life / p.max, 0, 1), s = e.s0 + easeIO(t) * e.P, q = e.path.at(s);
    p.x = q.x; p.y = q.y; p.vx = p.vy = 0;
    p.sx = p.sy = 0.7 + 0.3 * Math.sin(Math.min(1, t * 6) * 1.5708) * (1 - 0.3 * t);
  }
  MO.constellation = {
    pop(G, d, ctx) {
      const fx = ctx.fx, n = G.n, rush = rushOn(), C = tints(G.col.glow, G.col.hi);
      if (n >= 3 && G.plan) {
        const K = constellation(G);
        PC.nodes = K.nodes;
        const gap = Math.min(40, 440 / Math.max(1, K.edges.length)), lc = mix(C.hi, WHITE, 0.7), life = rush ? 1.8 : 0.9;
        K.edges.forEach(([a, b], i) => later(() => {
          const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, e = 8;
          mlink(fx, a.x + ux * e, a.y + uy * e, b.x - ux * e, b.y - uy * e, lc, life, 1.5, 'ln');
          mo(fx, { kind: 'spark', x: a.x, y: a.y, vx: dx / 0.04, vy: dy / 0.04, drag: 0, size: 3.6, max: 0.05, color: WHITE });
          if (i < 8) ping(BR.audio && BR.audio._degFreq ? BR.audio._degFreq(7 + i) : 880 * Math.pow(2, [0, 2, 4, 7, 9][i % 5] / 12), 0, 0.034, 0.2);
        }, 40 + i * gap));
      }
      if (n >= 8) {
        const b = boardRect(ctx), dir = G.c0.x > b.left + b.width / 2 ? -1 : 1, S = clamp(b.width * 0.5, 160, 200), kind = creatureOf(C.i);
        const p0 = { x: G.c0.x, y: G.c0.y }, p1 = { x: dir > 0 ? b.right + S * 0.3 : b.left - S * 0.3, y: clamp(G.c0.y - b.height * 0.12, b.top + S * 0.3, b.bottom - S * 0.4) };
        const frames = [], N = 14, flip = dir > 0 ? 1 : -1;
        for (let i = 0; i <= N; i++) {
          const u = i / N, e = easeIO(u * 0.9 + 0.05 * u), x = lerp(p0.x, p1.x, e), arc = -Math.sin(u * Math.PI) * 50, hop = -Math.abs(Math.sin(u * Math.PI * 3)) * 26;
          frames.push({ offset: u, opacity: u < 0.1 ? u * 10 : u > 0.82 ? (1 - u) / 0.18 : 1, transform: `translate(${(x - S / 2).toFixed(1)}px, ${(lerp(p0.y, p1.y, e) + arc + hop - S / 2).toFixed(1)}px) rotate(${(Math.cos(u * Math.PI * 3) * -7 * flip).toFixed(1)}deg) scale(${(flip * (0.8 + 0.28 * Math.sin(Math.min(1, u * 1.6) * 1.57))).toFixed(3)}, ${(0.8 + 0.28 * Math.sin(Math.min(1, u * 1.6) * 1.57)).toFixed(3)})` });
        }
        const el = dom('s4-beast', S / 2, S / 2, S, S, frames, { duration: 520, delay: 20, easing: 'linear' }, creatureSvg(kind, C));
        later(() => {
          for (let i = 0, k = cnt(12); i < k; i++) { const a = rnd(0, TAU), s = rnd(60, 190); mo(fx, { shape: 'star', x: p1.x - dir * S * 0.28 + rnd(-30, 30), y: p1.y + rnd(-30, 30), vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 2.4, size: rnd(6, 11), max: rnd(0.14, 0.18), rot: rnd(0, TAU), vr: rnd(-8, 8), color: i % 3 === 0 ? C.hi : WHITE }); }
        }, 410);
        if (!el) return;
      }
    },
    line(d, ctx) {
      const L = lineOf(d); if (!L) return;
      const fx = ctx.fx, fwd = L.at <= (L.pts.length - 1) / 2, a = fwd ? L.pts[0] : L.pts[L.pts.length - 1], b = fwd ? L.pts[L.pts.length - 1] : L.pts[0], cell = L.v.cell;
      const A = L.horiz ? { x: a.x + (fwd ? -cell : cell), y: a.y } : { x: a.x, y: a.y + (fwd ? -cell : cell) }, B = L.horiz ? { x: b.x + (fwd ? cell : -cell), y: b.y } : { x: b.x, y: b.y + (fwd ? cell : -cell) };
      const T = 0.34, vx = (B.x - A.x) / T, vy = (B.y - A.y) / T, C = tints(L.color.glow, L.color.hi);
      mo(fx, { kind: 'spark', x: A.x, y: A.y, vx, vy, drag: 0, size: 9, max: T, color: SILVER });
      mo(fx, { kind: 'spark', x: A.x, y: A.y, vx, vy, drag: 0, size: 17, max: T, color: mix(C.glow, SILVER, 0.4) });
      const steps = cnt(18);
      for (let i = 1; i <= steps; i++) later(() => { const u = i / steps, x = lerp(A.x, B.x, u), y = lerp(A.y, B.y, u); mo(fx, { kind: 'spark', x: x + rnd(-2, 2), y: y + rnd(-2, 2), vx: rnd(-14, 14), vy: rnd(-14, 14), drag: 1.4, size: rnd(3, 5.6), max: rnd(0.14, 0.2), color: i % 3 === 0 ? C.hi : SILVER }); }, (T * 1000 * i) / steps);
    },
    rushStart(d, ctx) {
      const bg = document.getElementById('bg'); if (!bg || BR.lowEnd) return;
      cssOnce(); killEl('sky');
      const el = document.createElement('div'); el.className = 's4-sky'; el.innerHTML = SKY();
      bg.insertBefore(el, bg.querySelector('.vignette'));
      if (el.animate) el.animate([{ opacity: 0 }, { opacity: 0.85 }], { duration: 700, fill: 'forwards', easing: 'ease-out' });
      RUSH.sky = el;
    },
    rushEnd() { killEl('sky', 360); },
    stageUp(d, ctx) {
      const fx = ctx.fx, b = boardRect(d.run ? { view: d.run.view } : ctx), path = perimeter(b, 9, 16), k = cnt(14), img = star4Img(WHITE, '#9fb8ff');
      for (let i = 0; i < k; i++) {
        const p = mspr(fx, { img, x: 0, y: 0, size: i % 3 === 0 ? 20 : 14, max: 0.84, a: 1, fadeIn: 0.1, rot: rnd(0, 1) });
        steer(p, wheelStep, { path, P: path.P, s0: (i / k) * path.P });
        if (p) { const q = path.at((i / k) * path.P); p.x = q.x; p.y = q.y; }
      }
    },
  };

  /* ===================================================================== WISPS moments */
  const bigGhost = (C) => once('bg-' + C.glow, () => `<svg viewBox="0 0 80 96"><defs><linearGradient id="s4g${C.i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#e8f4ff"/><stop offset=".74" stop-color="${mix('#dcecff', C.hi, 0.4)}"/><stop offset="1" stop-color="${mix(C.hi, C.glow, 0.5)}"/></linearGradient><radialGradient id="s4h${C.i}"><stop offset="0" stop-color="#d2ecff" stop-opacity=".5"/><stop offset="1" stop-color="#d2ecff" stop-opacity="0"/></radialGradient></defs><circle cx="40" cy="48" r="46" fill="url(#s4h${C.i})"/><ellipse cx="9" cy="52" rx="7" ry="5" fill="#e3f1ff" transform="rotate(-30 9 52)"/><ellipse cx="71" cy="46" rx="7" ry="5" fill="#e3f1ff" transform="rotate(40 71 46)"/><path d="M12 34A28 28 0 0 1 68 34V80Q61 94 54 80Q47 66 40 80Q33 94 26 80Q19 66 12 80Z" fill="url(#s4g${C.i})" stroke="${rgba(mix(C.lo, '#6a7fc0', 0.4), 0.55)}" stroke-width="1.4"/><ellipse cx="30" cy="34" rx="4.2" ry="5.6" fill="#1d2142"/><ellipse cx="50" cy="34" rx="4.2" ry="5.6" fill="#1d2142"/><circle cx="31.4" cy="32" r="1.5" fill="#fff"/><circle cx="51.4" cy="32" r="1.5" fill="#fff"/><ellipse cx="22" cy="44" rx="5" ry="3" fill="#ff8caa" opacity=".4"/><ellipse cx="58" cy="44" rx="5" ry="3" fill="#ff8caa" opacity=".4"/><ellipse cx="40" cy="46" rx="3.4" ry="4.4" fill="#1d2142"/></svg>`);
  function trackStep(p, dt, e) {
    const t = clamp(p.life / p.max, 0, 1), s = e.s0 + easeIO(t) * e.dist * e.dir, q = e.path.at(s);
    if (p.life > 0.001) p.rot = clamp((q.x - p.x) * 0.004, -0.4, 0.4);
    p.x = q.x; p.y = q.y; p.vx = p.vy = 0;
    p.sx = 1; p.sy = 1;
  }
  function zoomStep(p, dt, e) {
    const t = clamp(p.life / p.max, 0, 1), u = easeIO(t), off = Math.sin(t * 17 + e.ph) * e.amp;
    p.x = e.horiz ? lerp(e.a.x, e.b.x, u) : e.a.x + off;
    p.y = e.horiz ? e.a.y + off : lerp(e.a.y, e.b.y, u);
    p.vx = p.vy = 0;
    p.sx = p.sy = 0.9; p.rot = e.horiz ? (e.b.x > e.a.x ? 0.28 : -0.28) : 0;
  }
  MO.wisps = {
    pop(G, d, ctx) {
      const fx = ctx.fx, n = G.n; if (n < 8) return;
      const C = tints(G.col.glow, G.col.hi), c = G.c0, S = clamp(G.box.x1 - G.box.x0 + 70, 84, 130), H = S * 1.2;
      const rise = 120, sw = [];
      for (let i = 0; i <= 12; i++) { const u = i / 12, e = easeOut(u); sw.push({ offset: u, opacity: u < 0.12 ? u / 0.12 : u > 0.84 ? (1 - u) / 0.16 : 1, transform: `translate(${(Math.sin(u * 7) * 9).toFixed(1)}px, ${(-rise * e).toFixed(1)}px) rotate(${(Math.sin(u * 15) * 13 * (1 - u * 0.4)).toFixed(1)}deg) scale(${(0.55 + 0.5 * Math.min(1, u * 3)).toFixed(3)})` }); }
      dom('s4-ghost', c.x, c.y, S, H, sw, { duration: 540, delay: 20, easing: 'linear' }, bigGhost(C));
      later(() => {
        const gx = c.x + Math.sin(0.84 * 7) * 9, gy = c.y - rise * easeOut(0.84);
        for (let i = 0, k = cnt(14); i < k; i++) { const a = rnd(0, TAU), s = rnd(40, 160); mo(fx, { kind: 'spark', x: gx + rnd(-18, 18), y: gy + rnd(-22, 22), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, drag: 2, size: rnd(2.6, 5), max: rnd(0.12, 0.17), color: i % 3 === 0 ? C.hi : i % 3 === 1 ? WHITE : '#cdeaff' }); }
      }, 450);
    },
    line(d, ctx) {
      const L = lineOf(d); if (!L) return;
      const fx = ctx.fx, C = tints(L.color.glow, L.color.hi), open = ghostImg(C, false), cell = L.v.cell, pts = L.pts;
      const a = pts[0], b = pts[pts.length - 1], k = cnt(5);
      for (let i = 0; i < k; i++) later(() => {
        const rev = i % 2, A = rev ? b : a, B = rev ? a : b;
        const p = mspr(fx, { img: open, x: A.x, y: A.y, size: 26, max: 0.4, a: 1, fadeIn: 0.05 });
        steer(p, zoomStep, { a: A, b: B, horiz: L.horiz, amp: cell * 0.3 * (i % 2 ? 1 : -1), ph: rnd(0, TAU) });
        for (let t = 1; t <= 3; t++) later(() => mo(fx, { kind: 'spark', x: p ? p.x : A.x, y: p ? p.y : A.y, vx: rnd(-10, 10), vy: rnd(-10, 10), drag: 1.5, size: rnd(3, 5), max: rnd(0.14, 0.2), color: t % 2 ? C.hi : '#d8efff' }), t * 70);
      }, i * 45);
    },
    rushStart(d, ctx) {
      const fx = ctx.fx, b = boardRect(d.run ? { view: d.run.view } : ctx), path = perimeter(b, 17, 24), C = tints(BR.PALETTE[(Math.random() * 7) | 0].glow), k = cnt(6);
      for (let i = 0; i < k; i++) {
        const Ci = tints(BR.PALETTE[i % 7].glow), img = ghostImg(Ci, false), s0 = (i / k) * path.P;
        const p = mspr(fx, { img, x: 0, y: 0, size: 28, max: 0.84, a: 1, fadeIn: 0.1 });
        steer(p, trackStep, { path, s0, dist: path.P * 0.5, dir: 1 });
        if (p) { const q = path.at(s0); p.x = q.x; p.y = q.y; }
        for (let t = 1; t <= 4; t++) later(() => mo(fx, { kind: 'spark', x: p ? p.x : 0, y: p ? p.y : 0, vx: rnd(-8, 8), vy: rnd(-8, 8), drag: 1.5, size: rnd(3, 5), max: rnd(0.16, 0.22), color: t % 2 ? Ci.hi : '#d8efff' }), t * 150);
      }
    },
    stageUp(d, ctx) {
      const tag = document.getElementById('stageTag'); if (!tag) return;
      const r = tag.getBoundingClientRect(); if (!r.width) return;
      const C = tints(BR.PALETTE[(d.info && d.info.to ? d.info.to : 1) % 7].glow), W = 36, H = 34;
      cssOnce();
      const wrap = dom('s4-peek', r.left + 20, r.top + 3 - H / 2, W + 6, H, [{ opacity: 1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: 800 }, `<span style="position:absolute;left:3px;top:0;width:${W}px;height:${W * 1.2}px">${bigGhost(C)}</span>`);
      if (wrap && wrap.firstChild.animate) wrap.firstChild.animate([{ transform: `translateY(${H + 4}px) rotate(0deg)` }, { transform: 'translateY(2px) rotate(-6deg)', offset: 0.22 }, { transform: 'translateY(2px) rotate(7deg)', offset: 0.5 }, { transform: 'translateY(2px) rotate(-3deg)', offset: 0.7 }, { transform: `translateY(${H + 4}px) rotate(0deg)` }], { duration: 760, easing: 'ease-in-out', fill: 'both' });
    },
  };

  /* ===================================================================== the pop context, the moments, and the clean-up */
  const MINE = { fireflies: 1, wishdust: 1, birds: 1, runes: 1, goldleaf: 1, sandfall: 1, whirlgate: 1, constellation: 1, wisps: 1 };
  /** The group of a pop event as page points: every brick (from the engine's plan) in a run, the demo cells in a reveal. */
  function groupOf(type, d, ctx) {
    const v = ctx.view || d.view, plan = d.res && d.res.plan;
    let cells;
    if (plan && v) cells = plan.primary.map((q) => Object.assign({ r: q.r, c: q.c }, v.pagePoint(q.r, q.c)));
    else cells = (ctx.cells || []).map((q) => ({ x: q.x, y: q.y, r: -1, c: -1 }));
    let sx = 0, sy = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    cells.forEach((q) => { sx += q.x; sy += q.y; x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); });
    return { cells, n: ctx.n, plan, view: v, c0: { x: sx / cells.length, y: sy / cells.length }, box: { x0, y0, x1, y1 }, col: ctx.col ? ctx.col(0) : BR.PALETTE[0] };
  }
  BR.Skins.handlers.push((type, d, ctx) => {
    if (BR.reducedMotion) return;
    if (type === 'pop' || type === 'demo') {
      if (!ctx.cells || !ctx.cells.length) return;
      const rec = type === 'demo' ? (d.item && d.item.recipe) : BR.Skins.pop;
      if (!MINE[rec]) return;
      const G = groupOf(type, d, ctx);
      PC.t = now(); PC.size = ctx.n; PC.cx = G.c0.x; PC.cy = G.c0.y; PC.k = 0; PC.birds = 0; PC.ghosts = 0; PC.nodes = null; PC.portal = null;
      if (MO[rec] && MO[rec].pop) MO[rec].pop(G, d, ctx);
    } else if (type === 'line' || type === 'rushStart' || type === 'rushEnd' || type === 'stageUp') {
      if (type === 'rushStart') PC.rush = true; else if (type === 'rushEnd') PC.rush = false;
      const rec = BR.Skins.pop, m = MO[rec];
      if (m && m[type]) m[type](d, ctx);
      if (type === 'rushEnd') { killEl('swirl', 320); killEl('sky', 360); }
    }
  });
  // changing the pop (or the run ending) takes the Rush decorations down with it
  BR.Skins.applyHooks.push((M) => { const r = BR.Skins.pop; if (r !== 'whirlgate') killEl('swirl'); if (r !== 'constellation') killEl('sky'); });

  /* ===================================================================== sound textures (BR.Audio.flavors)
     Layered under the pitched pop note, each inside 210 ms and quiet: v is the level of the pop, f its pitch. Attacks are 3 to 10 ms, no
     saw or hard square, nothing above about 5 kHz, so the loudness and spectrum rules of tests/audio.js hold. */
  if (BR.Audio && BR.Audio.flavors) {
    const F = BR.Audio.flavors, hz = (x, top) => Math.min(top || 2600, x);
    F.fireflies = (f, v, n, pan, { tone, noise }) => {
      tone({ f: hz(f * 2, 2300), to: hz(f * 2.25, 2600), dur: 0.07, vol: v * 0.3, attack: 0.004, pan });                      // the pip
      tone({ f: hz(f * 3, 3000), dur: 0.05, vol: v * 0.1, at: 0.012, attack: 0.004, pan: -pan });
      noise({ dur: 0.17, vol: v * 0.13, from: 3600, to: 2400, q: 1.6, type: 'bandpass', attack: 0.02, pan });                 // the breath
    };
    F.wishdust = (f, v, n, pan, { tone, noise }) => {
      [1, 1.26, 1.498].forEach((r, i) => tone({ f: hz(f * 2 * r, 2800), dur: 0.1, vol: v * (0.26 - i * 0.03), at: i * 0.045, attack: 0.004, pan: i % 2 ? pan : -pan }));   // a rising three-note twinkle, pentatonic
      noise({ dur: 0.11, vol: v * 0.06, from: 4300, to: 3300, q: 3, type: 'bandpass', at: 0.03, attack: 0.01, pan, lp: 5000 });
    };
    F.birds = (f, v, n, pan, { note, noise }) => {
      [0, 0.055].forEach((at, i) => noise({ dur: 0.04, vol: v * 0.22, from: 3100 - i * 350, to: 1800, q: 1.2, type: 'bandpass', at, attack: 0.006, pan: i ? pan : -pan }));   // two quick flutters of paper
      note({ f, vol: v * 0.34, attack: 0.004, at: 0.085, pan, type: 'triangle', lp: [hz(f * 6, 3800), f * 1.4, 0.1], parts: [[1, 1, 0.12], [2, 0.1, 0.08, 'sine']] });       // a soft pluck
    };
    F.runes = (f, v, n, pan, { note, noise }) => {
      note({ f: hz(f * 3, 2400), vol: v * 0.26, attack: 0.003, pan, parts: [[1, 1, 0.17], [2.76, 0.28, 0.1]] });                  // glassy, a little out of tune with itself
      note({ f: hz(f * 3, 2400), vol: v * 0.22, attack: 0.003, pan: -pan, detune: 22, parts: [[1, 1, 0.15], [2.01, 0.2, 0.08]] });
      noise({ dur: 0.06, vol: v * 0.1, from: 4800, to: 3400, q: 2.2, type: 'bandpass', attack: 0.002, pan, lp: 5800 });
    };
    F.goldleaf = (f, v, n, pan, { note, tone, rnd }) => {
      note({ f: hz(f * 2, 2200), vol: v * 0.32, attack: 0.003, pan, parts: [[1, 1, 0.2], [2.76, 0.34, 0.14], [5.4, 0.14, 0.07]] });   // a bright bell
      for (let i = 0; i < 4; i++) tone({ f: hz(f * (4 + rnd() * 2.5), 3400), dur: 0.05, vol: v * 0.07, at: 0.02 + i * 0.035, attack: 0.003, pan: i % 2 ? pan : -pan });   // and its metal shimmer
    };
    F.sandfall = (f, v, n, pan, { noise, rnd }) => {
      for (let i = 0; i < 8; i++) noise({ dur: 0.02 + rnd() * 0.02, vol: v * (0.09 + rnd() * 0.07), from: 2800 + rnd() * 1400, to: 2200, q: 1.4, type: 'bandpass', at: i * 0.017 + rnd() * 0.008, attack: 0.003, pan: (rnd() * 2 - 1) * 0.4 });   // grains
      noise({ dur: 0.18, vol: v * 0.1, from: 1900, to: 900, q: 0.6, type: 'lowpass', attack: 0.01, pan });
    };
    F.whirlgate = (f, v, n, pan, { tone, noise, sub }) => {
      noise({ dur: 0.17, vol: v * 0.36, from: 2600, to: 320, q: 1.1, type: 'bandpass', attack: 0.012, pan });                      // a whoosh that falls away
      tone({ f: hz(f * 2.2, 2000), to: f * 0.5, dur: 0.15, vol: v * 0.2, attack: 0.006, pan: -pan });
      sub(92, 54, 0.1, v * 0.42, 0.1);                                                                                              // and a low thump
    };
    F.constellation = (f, v, n, pan, { note, tone, noise }) => {
      note({ f: hz(f * 2, 2300), vol: v * 0.22, attack: 0.003, pan, parts: [[1, 1, 0.2], [4, 0.16, 0.07], [6.1, 0.05, 0.04]] });  // a celesta
      tone({ f: hz(f * 3, 3000), dur: 0.12, vol: v * 0.07, at: 0.03, attack: 0.004, pan: -pan });
      noise({ dur: 0.14, vol: v * 0.045, from: 5200, to: 4400, q: 6, type: 'bandpass', attack: 0.02, pan, lp: 6200 });             // starlight
    };
    F.wisps = (f, v, n, pan, { tone, noise }) => {
      noise({ dur: 0.2, vol: v * 0.5, from: 560, to: 330, q: 7, type: 'bandpass', attack: 0.04, pan });                             // "ooh": two bands of breath sweeping down
      noise({ dur: 0.2, vol: v * 0.34, from: 1250, to: 880, q: 7, type: 'bandpass', attack: 0.05, pan: -pan });
      tone({ f: f * 0.5, dur: 0.17, vol: v * 0.1, attack: 0.01, pan });
    };
  }

  /* ===================================================================== badge art (BR.Badge.custom)
     Nine different silhouettes, each a bold shape that still reads at 36 px: a swooping trail of lights, a tall helix, a paper bird, a
     glowing glyph, a flake of gold leaf, an hourglass, a vortex, a star map, a ghost. js/badges.js loads after this file, so they are
     registered when the page has finished loading (before the app draws its first badge). */
  const BCSS = `
.s4b{width:7.6em;height:7.6em;overflow:visible;filter:drop-shadow(0 0 .3em rgba(255,255,255,.4))}
.bdg.still .s4b{filter:none}
.s4b *{transform-box:fill-box;transform-origin:center}
.s4b-bl{animation:s4bBl 2.1s ease-in-out infinite}
.s4b-tw{animation:s4bTw 2.4s ease-in-out infinite}
.s4b-sp{animation:s4bSp 9s linear infinite}
.s4b-fl{animation:s4bFl 3.2s ease-in-out infinite}
.s4b-wv{animation:s4bWv 2.6s ease-in-out infinite}
@keyframes s4bBl{0%,100%{opacity:1;transform:scale(1)}45%{opacity:.25;transform:scale(.45)}}
@keyframes s4bTw{0%,100%{opacity:.35;transform:scale(.6) rotate(0)}50%{opacity:1;transform:scale(1.1) rotate(45deg)}}
@keyframes s4bSp{to{transform:rotate(360deg)}}
@keyframes s4bFl{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-3px) rotate(6deg)}}
@keyframes s4bWv{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
`;
  const badgeCss = () => { if (memo.bcss || document.getElementById('s4badge-css')) { memo.bcss = 1; return; } memo.bcss = 1; const el = document.createElement('style'); el.id = 's4badge-css'; el.textContent = BCSS; document.head.appendChild(el); };
  const star4 = (x, y, r, fill, cls, extra) => { const k = r * 0.17; return `<path class="${cls || ''}" ${extra || ''} d="M${x} ${y - r}Q${x + k} ${y - k} ${x + r} ${y}Q${x + k} ${y + k} ${x} ${y + r}Q${x - k} ${y + k} ${x - r} ${y}Q${x - k} ${y - k} ${x} ${y - r}Z" fill="${fill}"/>`; };
  const svgB = (body) => `<svg class="s4b" viewBox="-50 -50 100 100" aria-hidden="true">${body}</svg>`;
  const DISC = '<circle r="47" fill="#0c0620" opacity=".17"/><circle r="36" fill="#0c0620" opacity=".16"/>';
  const ART = {
    b_fireflies: () => {
      const ff = (x, y, s, ph) => `<g transform="translate(${x} ${y}) scale(${s})"><g class="s4b-bl" style="animation-delay:${ph}s"><circle r="25" fill="url(#s4ffg)"/><ellipse cx="-6" cy="-7" rx="8" ry="3.2" fill="#fff" opacity=".6" transform="rotate(-35 -6 -7)"/><ellipse cx="6" cy="-7" rx="8" ry="3.2" fill="#fff" opacity=".6" transform="rotate(35 6 -7)"/><ellipse cy="-3" rx="4.4" ry="5.6" fill="#26301a"/><circle cy="7" r="7.4" fill="#e8ff5a" stroke="#4a5a10" stroke-width="1.2"/><circle cy="6" r="3.8" fill="#fff"/></g></g>`;
      return svgB(`<defs><radialGradient id="s4ffg"><stop offset="0" stop-color="#f6ffb0" stop-opacity=".95"/><stop offset=".45" stop-color="#c6f23c" stop-opacity=".5"/><stop offset="1" stop-color="#c6f23c" stop-opacity="0"/></radialGradient></defs>${DISC}<path d="M-40 34C-22 -8 6 44 36 -30" fill="none" stroke="#fff" stroke-width="2.2" stroke-dasharray="0.1 6" stroke-linecap="round" opacity=".7"/>${ff(-18, 14, 1.05, 0)}${ff(10, -2, 0.78, -0.7)}${ff(32, -26, 0.55, -1.4)}`);
    },
    b_wishdust: () => {
      const pts = [[0, -40, 11, 0], [-15, -26, 6, 1], [15, -17, 8, 2], [-15, -4, 10, 0.5], [15, 9, 7, 1.5], [-15, 22, 9, 2.5], [15, 35, 6, 0.8], [0, 44, 5, 1.8], [-34, -8, 4, 2.2], [34, -30, 4.5, 0.3]];
      let s = ''; pts.forEach(([x, y, r, d], i) => { s += star4(x, y, r + 3, i % 2 ? '#fff6c8' : '#ffffff', 's4b-tw', `style="animation-delay:${-d}s" stroke="#8a5a00" stroke-width=".9"`); });
      return svgB(`${DISC}<path d="M0 -40C-26 -30 26 -10 0 4C-26 18 26 34 0 44" fill="none" stroke="#ffd36b" stroke-width="2.6" stroke-linecap="round" opacity=".55"/><path d="M0 -40C26 -30 -26 -10 0 4C26 18 -26 34 0 44" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".5"/>${s}`);
    },
    b_birds: () => svgB(`${DISC}<g class="s4b-fl"><path d="M-8 2L18 -2L-2 -40Z" fill="#d9cdae" stroke="#7a6a44" stroke-width="1.6" stroke-linejoin="round" transform="translate(4 -2)"/><path d="M-44 20L-10 6L16 -6L46 6L20 16L-6 22Z" fill="#fff8e6" stroke="#7a6a44" stroke-width="2" stroke-linejoin="round"/><path d="M-44 20L-6 22L20 16L4 32Z" fill="#e0d4b6" stroke="#7a6a44" stroke-width="2" stroke-linejoin="round"/><path d="M16 -6L46 6L20 16Z" fill="#fffdf3" stroke="#7a6a44" stroke-width="2" stroke-linejoin="round"/><path d="M-16 8L16 0L-12 -46Z" fill="#fff" stroke="#7a6a44" stroke-width="2" stroke-linejoin="round"/><path d="M0 4L-12 -46" stroke="#cbbd98" stroke-width="1.6"/><circle cx="31" cy="3" r="1.8" fill="#2a2640"/><path d="M46 6L52 9L46 10Z" fill="#ff9a3d"/></g><g transform="translate(30 -30) scale(.46)"><path d="M-30 14L0 4L22 -4L34 6L12 12Z" fill="#ff8aa0" stroke="#7a2a3a" stroke-width="3"/><path d="M-6 6L12 -2L-4 -30Z" fill="#ffc2cf" stroke="#7a2a3a" stroke-width="3"/></g><g transform="translate(-30 -30) scale(.4)"><path d="M-30 14L0 4L22 -4L34 6L12 12Z" fill="#ffd36b" stroke="#7a5200" stroke-width="3.4"/><path d="M-6 6L12 -2L-4 -30Z" fill="#fff0a8" stroke="#7a5200" stroke-width="3.4"/></g>`),
    b_runes: () => svgB(`${DISC}<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M-15 -27L15 -27L31 0L15 27L-15 27L-31 0Z" fill="rgba(127,178,255,.3)" stroke="#2f6bff" stroke-width="11" opacity=".55"/><path d="M-15 -27L15 -27L31 0L15 27L-15 27L-31 0Z" stroke="#fff" stroke-width="4.6"/><path d="M0 -15L14 0L0 15L-14 0Z" stroke="#cfe0ff" stroke-width="3.4"/><circle r="3.6" fill="#fff" stroke="none"/></g><g class="s4b-sp" style="animation-duration:14s" fill="none" stroke="#e6f0ff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="-36" cy="-30" r="8"/><path d="M34 -36L42 -22L26 -22Z"/><path d="M34 26V42M26 34H42"/></g>`),
    b_goldleaf: () => {
      const f1 = [[-30, -6], [-14, -30], [10, -34], [32, -14], [30, 14], [8, 32], [-18, 26]], tones = ['#fff3b0', '#ffd34a', '#f6b73a', '#ffe27a', '#e49a24', '#ffd34a', '#fff0a0'];
      let s = ''; f1.forEach((p, i) => { const q = f1[(i + 1) % f1.length]; s += `<path d="M2 -2L${p[0]} ${p[1]}L${q[0]} ${q[1]}Z" fill="${tones[i]}"/>`; });
      return svgB(`${DISC}<g class="s4b-fl"><g stroke="#6b3d00" stroke-width="2.6" stroke-linejoin="round">${s}</g><path d="M2 -2L-30 -6M2 -2L10 -34M2 -2L30 14M2 -2L-18 26" stroke="#fff8d0" stroke-width="1.2" opacity=".8"/></g><g transform="translate(30 30) rotate(25) scale(.42)"><g stroke="#6b3d00" stroke-width="5" stroke-linejoin="round">${s}</g></g><g transform="translate(-34 28) rotate(-30) scale(.3)"><g stroke="#6b3d00" stroke-width="6" stroke-linejoin="round">${s}</g></g>${star4(-34, -34, 9, '#fff', 's4b-tw', 'stroke="#8a5a00" stroke-width=".8"')}${star4(36, -30, 6, '#fff6c8', 's4b-tw', 'style="animation-delay:-1.2s"')}`);
    },
    b_sandfall: () => {
      const gr = [[-38, -14], [-34, 4], [-40, 22], [36, -20], [38, 0], [34, 18], [-30, -34], [30, -38]];
      return svgB(`${DISC}<rect x="-30" y="-42" width="60" height="7" rx="3" fill="#b9803a" stroke="#5a3510" stroke-width="2"/><rect x="-30" y="35" width="60" height="7" rx="3" fill="#b9803a" stroke="#5a3510" stroke-width="2"/><path d="M-22 -35L22 -35L22 -27Q22 -10 4 0Q22 10 22 27L22 35L-22 35L-22 27Q-22 10 -4 0Q-22 -10 -22 -27Z" fill="rgba(255,255,255,.2)" stroke="#f6e7bf" stroke-width="3.4" stroke-linejoin="round"/><path d="M-17 -27L17 -27Q15 -12 3 -3L-3 -3Q-15 -12 -17 -27Z" fill="#f0cf8c"/><rect x="-1.2" y="-3" width="2.4" height="28" fill="#f0cf8c"/><path d="M-18 33Q-10 14 0 14Q10 14 18 33Z" fill="#f0cf8c" stroke="#a8782a" stroke-width="1.4"/><path d="M-6 22Q0 17 6 22" fill="none" stroke="#fff3cf" stroke-width="1.6" stroke-linecap="round"/>${gr.map(([x, y], i) => `<rect class="s4b-tw" style="animation-delay:${-i * 0.3}s" x="${x}" y="${y}" width="4" height="4" fill="${i % 2 ? '#ffe9b0' : '#f0cf8c'}" stroke="#7a4f1a" stroke-width=".8"/>`).join('')}`);
    },
    b_whirlgate: () => {
      let arms = '', arms2 = '';
      for (let k = 0; k < 3; k++) { let dd = ''; for (let i = 0; i <= 26; i++) { const t = i / 26, r = 4 + t * 34, a = k * TAU / 3 + t * 6.6; dd += (i ? 'L' : 'M') + (Math.cos(a) * r).toFixed(1) + ' ' + (Math.sin(a) * r).toFixed(1); } arms += `<path d="${dd}" stroke="#27dcc6" stroke-width="5"/>`; arms2 += `<path d="${dd}" stroke="#d8fff6" stroke-width="1.6"/>`; }
      let notch = ''; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; notch += `<path d="M${(Math.cos(a) * 41).toFixed(1)} ${(Math.sin(a) * 41).toFixed(1)}L${(Math.cos(a) * 48).toFixed(1)} ${(Math.sin(a) * 48).toFixed(1)}"/>`; }
      return svgB(`<defs><radialGradient id="s4wg"><stop offset="0" stop-color="#0b6a78"/><stop offset="1" stop-color="#021c24"/></radialGradient></defs><circle r="40" fill="url(#s4wg)" stroke="#ffd36a" stroke-width="3.4"/><g stroke="#ffd36a" stroke-width="3" stroke-linecap="round">${notch}</g><g class="s4b-sp" style="animation-duration:11s;animation-direction:reverse" fill="none" stroke-linecap="round">${arms}${arms2}</g><circle r="7" fill="#ffe08a" stroke="#a8660a" stroke-width="1.4"/><circle r="3.2" fill="#fff"/>`);
    },
    b_constellation: () => {
      const P = [[-28, 24], [-12, 8], [4, 16], [16, -2], [30, -10], [20, -28], [-2, -30]], L = 'M-28 24L-12 8L4 16L16 -2L30 -10M16 -2L20 -28L-2 -30';
      return svgB(`<defs><radialGradient id="s4cs"><stop offset="0" stop-color="#2a2f7a"/><stop offset="1" stop-color="#0a0c28"/></radialGradient></defs><circle r="43" fill="url(#s4cs)" stroke="#e8f0ff" stroke-width="3"/><circle r="38" fill="none" stroke="#e8f0ff" stroke-width=".8" opacity=".5"/><path d="${L}" stroke="#dfe9ff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".9"/>${P.map(([x, y], i) => star4(x, y, i === 3 ? 11 : i % 2 ? 6.5 : 8.5, i === 3 ? '#ffe9a0' : '#fff', 's4b-tw', `style="animation-delay:${-i * 0.4}s"`)).join('')}<circle cx="-30" cy="-16" r="1.6" fill="#fff" opacity=".8"/><circle cx="34" cy="14" r="1.4" fill="#fff" opacity=".7"/><circle cx="-8" cy="34" r="1.3" fill="#fff" opacity=".7"/>`);
    },
    b_wisps: () => {
      const ghost = '<path d="M-28 -14A28 28 0 0 1 28 -14V32Q21 46 14 32Q7 18 0 32Q-7 46 -14 32Q-21 18 -28 32Z"';
      return svgB(`<defs><linearGradient id="s4wh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#e8f4ff"/><stop offset=".8" stop-color="#c8eaff"/><stop offset="1" stop-color="#7ae8ff"/></linearGradient></defs>${DISC}<g class="s4b-wv"><g transform="translate(0 2)"><ellipse cx="-31" cy="4" rx="8" ry="5.4" fill="#e8f4ff" stroke="#5a6fa8" stroke-width="2" transform="rotate(-30 -31 4)"/><ellipse cx="31" cy="-2" rx="8" ry="5.4" fill="#e8f4ff" stroke="#5a6fa8" stroke-width="2" transform="rotate(40 31 -2)"/>${ghost} fill="url(#s4wh)" stroke="#5a6fa8" stroke-width="2.6" stroke-linejoin="round"/><ellipse cx="-10" cy="-12" rx="4.6" ry="6.2" fill="#1d2142"/><ellipse cx="10" cy="-12" rx="4.6" ry="6.2" fill="#1d2142"/><circle cx="-8.6" cy="-14.4" r="1.7" fill="#fff"/><circle cx="11.4" cy="-14.4" r="1.7" fill="#fff"/><ellipse cx="-19" cy="-1" rx="5" ry="3" fill="#ff8caa" opacity=".55"/><ellipse cx="19" cy="-1" rx="5" ry="3" fill="#ff8caa" opacity=".55"/><ellipse cy="0" rx="3.4" ry="4.4" fill="#1d2142"/></g></g><g transform="translate(-34 -30) scale(.34)"><g class="s4b-fl">${ghost} fill="#fff" stroke="#5a6fa8" stroke-width="6"/><circle cx="-9" cy="-10" r="4" fill="#1d2142"/><circle cx="9" cy="-10" r="4" fill="#1d2142"/></g></g>${star4(36, -32, 7, '#fff', 's4b-tw', '')}${star4(-36, 34, 5, '#cfe9ff', 's4b-tw', 'style="animation-delay:-1s"')}${star4(36, 34, 4, '#fff', 's4b-tw', 'style="animation-delay:-1.7s"')}`);
    },
  };
  const regBadges = () => {
    if (!BR.Badge) return false;
    BR.Badge.custom = BR.Badge.custom || {};
    Object.keys(ART).forEach((id) => { const f = ART[id]; BR.Badge.custom[id] = () => { badgeCss(); return f(); }; });
    return true;
  };
  if (!regBadges()) { window.addEventListener('DOMContentLoaded', regBadges); setTimeout(regBadges, 0); }

  /* exposed for tests/u5-pops.js */
  BR.S4Pops = { PC, MINE, RUSH };
})();
