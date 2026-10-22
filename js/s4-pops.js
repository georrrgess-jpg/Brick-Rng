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

  /* ===================================================================== the pop context and the moments */
  const MINE = { fireflies: 1, wishdust: 1, birds: 1, runes: 1, goldleaf: 1, sandfall: 1, whirlgate: 1, constellation: 1, wisps: 1 };
  /** The group of a pop event as page points: every brick (from the engine's plan) in a run, the demo cells in a reveal. */
  function groupOf(type, d, ctx) {
    const v = ctx.view || d.view, plan = d.res && d.res.plan;
    let cells;
    if (plan && v) cells = plan.primary.map((q) => Object.assign({ r: q.r, c: q.c }, v.pagePoint(q.r, q.c)));
    else cells = (ctx.cells || []).map((q) => ({ x: q.x, y: q.y, r: -1, c: -1 }));
    let sx = 0, sy = 0; cells.forEach((q) => { sx += q.x; sy += q.y; });
    const tap = plan && v ? Object.assign({ r: plan.r, c: plan.c }, v.pagePoint(plan.r, plan.c)) : cells[0];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; cells.forEach((q) => { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); });
    return { cells, n: ctx.n, plan, view: v, tap, c0: { x: sx / cells.length, y: sy / cells.length }, box: { x0, y0, x1, y1 }, col: ctx.col ? ctx.col(0) : BR.PALETTE[0] };
  }

  BR.Skins.handlers.push((type, d, ctx) => {
    if (BR.reducedMotion) return;
    if ((type === 'pop' || type === 'demo') && ctx.cells && ctx.cells.length) {
      const rec = type === 'demo' ? d.item && d.item.recipe : BR.Skins.pop;
      if (!MINE[rec]) return;
      const G = groupOf(type, d, ctx);
      PC.t = now(); PC.size = ctx.n; PC.cx = G.c0.x; PC.cy = G.c0.y; PC.k = 0; PC.birds = 0; PC.ghosts = 0; PC.nodes = null; PC.portal = null;
    }
  });

  /* exposed for tests/u5-pops.js */
  BR.S4Pops = { PC, MINE };
})();
