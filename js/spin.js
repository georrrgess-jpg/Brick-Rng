/* The reel: physics for the chest spin, and the DOM strip that plays it.
   The landing is solved, not eased: a launch speed is found so friction alone carries the strip to just short
   of the winning card, then a damped spring pulls it in. Card-edge ticks come from the real position.
   Pure part (BR.Spin) is testable in Node; BR.Reel needs a browser. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  /* ------------------------------------------------------------------ physics */
  const P = {
    mu: 0.2,        // viscous drag (1/s): sets how fast the strip bleeds speed
    c: 230,         // constant drag (px/s^2): makes the end a slow crawl across the last cards
    vSwitch: 46,    // px/s: below this the spring takes over
    k: 820, zeta: 0.58, // spring that settles the last few pixels
    dt: 1 / 240,
  };
  const REDUCED = { mu: 1.5, c: 520, vSwitch: 60, k: 900, zeta: 0.8, dt: 1 / 240 };

  /** x(t) while only friction acts, launched at v0. Closed form. */
  function frictionAt(v0, t, p) {
    const a = v0 + p.c / p.mu;
    return (a / p.mu) * (1 - Math.exp(-p.mu * t)) - (p.c / p.mu) * t;
  }
  /** Time and distance until speed has dropped to vSwitch. */
  function frictionEnd(v0, p) {
    const a = v0 + p.c / p.mu, b = p.vSwitch + p.c / p.mu;
    const t = Math.log(a / b) / p.mu;
    return { t, x: frictionAt(v0, t, p) };
  }
  /** Launch speed whose friction phase ends exactly `target` px from the start. */
  function solveLaunch(target, p) {
    let lo = p.vSwitch + 1, hi = 40000;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (frictionEnd(mid, p).x < target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /**
   * Build the whole trajectory ahead of time.
   *   distance: px from start to the exact landing point
   *   short:    px the friction phase stops before the landing point (the spring pulls the rest)
   * Returns { xs, dt, duration, v0, tSwitch }. xs[i] is the position at t = i * dt.
   */
  function solve({ distance, short = 8, params = P }) {
    const p = params;
    const v0 = solveLaunch(Math.max(1, distance - short), p);
    const fe = frictionEnd(v0, p);
    const xs = [];
    const dt = p.dt;
    const nF = Math.ceil(fe.t / dt);
    for (let i = 0; i <= nF; i++) xs.push(frictionAt(v0, Math.min(i * dt, fe.t), p));
    // spring phase, integrated finely (semi-implicit Euler) and sampled at dt
    let x = fe.x, v = p.vSwitch;
    const h = dt / 8, w2 = p.k, damp = 2 * p.zeta * Math.sqrt(p.k);
    let t = nF * dt, guard = 0;
    // continue from the exact switch point; resample positions on the dt grid
    let tt = fe.t; x = fe.x;
    let next = nF + 1;
    while (guard++ < 400000) {
      v += (-w2 * (x - distance) - damp * v) * h; x += v * h; tt += h;
      while (next * dt <= tt + 1e-12) { xs.push(x); next++; }
      if (Math.abs(x - distance) < 0.02 && Math.abs(v) < 0.4 && tt > fe.t + 0.1) break;
    }
    xs.push(distance);
    return { xs: Float64Array.from(xs), dt, duration: (xs.length - 1) * dt, v0, tSwitch: fe.t, distance };
  }

  /** Position and speed at time t (seconds) from a solved table. */
  function at(tab, t) {
    const f = t / tab.dt, i = Math.floor(f);
    if (i >= tab.xs.length - 1) return { x: tab.xs[tab.xs.length - 1], v: 0, done: true };
    if (i < 0) return { x: tab.xs[0], v: 0, done: false };
    const a = tab.xs[i], b = tab.xs[i + 1];
    return { x: a + (b - a) * (f - i), v: (b - a) / tab.dt, done: false };
  }

  /** Times at which a marker at `markerX` crosses a card boundary (cards of `pitch`, first card starts at 0). */
  function crossings(tab, pitch, markerX) {
    const out = [];
    let prev = Math.floor((tab.xs[0] + markerX) / pitch);
    for (let i = 1; i < tab.xs.length; i++) {
      const k = Math.floor((tab.xs[i] + markerX) / pitch);
      if (k !== prev) { out.push({ t: i * tab.dt, index: k, dir: Math.sign(k - prev) }); prev = k; }
    }
    return out;
  }

  BR.Spin = { P, REDUCED, solve, at, crossings, frictionEnd, solveLaunch };

  /* ------------------------------------------------------------------ DOM reel */
  /**
   * Reel: builds a strip of item cards inside `host`, spins it to `target`, and reports edge ticks.
   * Built to be cheap: cards are still badges (no animation), the strip moves with one transform per frame, and
   * nothing is filtered or tilted, so a spin costs about the same as a static page.
   *   o.orient    'h' | 'v'
   *   o.cards     array of { item, inst }  (the real items)
   *   o.target    index in cards that must end under the marker
   *   o.jitter    -0.35..0.35 of a card: where inside the winning card the marker lands
   *   o.reduced   shorter, calmer spin
   *   o.onTick(speed01, index, skipping)   o.onLand()
   */
  class Reel {
    constructor(host, o) {
      this.host = host; this.o = o;
      this.h = o.orient !== 'v';
      this.reduced = !!o.reduced;
      this.build();
    }
    build() {
      const { host, o } = this;
      host.innerHTML = '';
      host.classList.add('reel', this.h ? 'reel-h' : 'reel-v');
      this.strip = document.createElement('div');
      this.strip.className = 'reel-strip';
      const frag = document.createDocumentFragment();
      this.cardEls = o.cards.map((c) => {
        const it = c.item, R = BR.rarityById[it.rarity];
        const el = document.createElement('div');
        el.className = 'rc';
        el.style.setProperty('--rc', R.color);
        el.innerHTML = `${BR.Badge.html(it, c.inst || null, { size: this.h ? 104 : 84, still: true })}<div class="rc-txt"><b class="rc-name">${it.name}</b><span class="rc-rar">${R.name}</span></div>`;
        frag.appendChild(el);
        return el;
      });
      this.strip.appendChild(frag);
      host.appendChild(this.strip);
      this.speedFx = document.createElement('i');
      this.speedFx.className = 'reel-speed';
      host.appendChild(this.speedFx);
      this.marker = document.createElement('div');
      this.marker.className = 'reel-marker';
      this.marker.innerHTML = '<i></i><i></i>';
      host.appendChild(this.marker);
      this.measure();
    }
    measure() {
      const r = this.host.getBoundingClientRect();
      this.vp = this.h ? r.width : r.height;
      const first = this.cardEls[0], second = this.cardEls[1];
      this.pitch = this.h ? (second ? second.offsetLeft - first.offsetLeft : first.offsetWidth) : (second ? second.offsetTop - first.offsetTop : first.offsetHeight);
      this.size = this.h ? first.offsetWidth : first.offsetHeight;
      this.pad = this.h ? first.offsetLeft : first.offsetTop;
      this.markerX = this.vp / 2;
    }
    /** Where the strip must have travelled for card `i` (plus jitter) to sit under the marker. */
    pos(i, jit = 0) { return this.pad + i * this.pitch + this.size / 2 + jit * this.size - this.markerX; }

    /** Place the strip so card `start` is under the marker, no motion. */
    park(start) { this.x = this.pos(start); this.apply(0); this.markAt(); }

    start(startIndex = 3) {
      const o = this.o;
      this.measure();
      this.startX = this.pos(startIndex);
      this.endX = this.pos(o.target, o.jitter || 0);
      const dist = this.endX - this.startX;
      this.sc = this.pitch / 116; // keep cards-per-second the same for any card size
      const base = this.reduced ? REDUCED : P;
      const params = Object.assign({}, base, { c: base.c * this.sc, vSwitch: base.vSwitch * this.sc });
      this.tab = solve({ distance: dist, short: (6 + Math.random() * 10) * this.sc, params });
      this.t = 0; this.scale = 1; this.skipping = false; this.done = false;
      this.lastIdx = -1; this.speed = 0;
      this.x = this.startX;
      this.apply(0);
      this.markAt();
      this.raf = requestAnimationFrame((n) => { this.prev = n; this.loop(n); });
      return this.tab.duration;
    }
    skip() {
      if (this.done || this.skipping) return;
      this.skipping = true;
    }
    stop() { cancelAnimationFrame(this.raf); this.done = true; }

    loop(now) {
      if (this.done) return;
      const dt = Math.min(0.05, Math.max(0, (now - this.prev) / 1000)); this.prev = now;
      if (this.skipping) this.scale = Math.min(9, this.scale + dt * 38);
      this.t += dt * this.scale;
      const s = at(this.tab, this.t);
      this.x = this.startX + s.x;
      const idx = Math.floor((this.x + this.markerX - this.pad) / this.pitch);
      if (idx !== this.lastIdx) {
        if (this.lastIdx >= 0 && this.o.onTick) this.o.onTick(Math.min(1, Math.abs(s.v) / this.sc / 3000), idx, this.skipping);
        this.lastIdx = idx;
      }
      this.speed = Math.abs(s.v);
      this.apply(s.v);
      this.markAt();
      if (s.done) { this.done = true; this.apply(0); this.markAt(); this.cardEls[this.o.target].classList.add('win'); if (this.o.onLand) this.o.onLand(); return; }
      this.raf = requestAnimationFrame((n) => this.loop(n));
    }

    apply(vRaw) {
      const v = Math.abs(vRaw) / (this.sc || 1);
      this.strip.style.transform = this.h ? `translate3d(${(-this.x).toFixed(2)}px,0,0)` : `translate3d(0,${(-this.x).toFixed(2)}px,0)`;
      // one opacity change stands in for motion blur: faint speed streaks fade in with the strip's speed
      if (this.speedFx) this.speedFx.style.opacity = Math.min(0.85, Math.max(0, (v - 900) / 2200)).toFixed(2);
    }
    markAt() {
      const i = Math.floor((this.x + this.markerX - this.pad) / this.pitch);
      if (i !== this.atIdx) {
        if (this.cardEls[this.atIdx]) this.cardEls[this.atIdx].classList.remove('at');
        if (this.cardEls[i]) this.cardEls[i].classList.add('at');
        this.atIdx = i;
      }
    }
  }
  BR.Reel = Reel;

  /* ------------------------------------------------------------------ strip content */
  /** Build the visible strip: filler cards drawn with the chest's real odds, the winner at `target`. */
  BR.buildStrip = function buildStrip(rng, chestId, type, drop, count) {
    const pool = BR.chestPool(chestId, type);
    const chest = BR.CHESTS[chestId];
    const target = count - 6; // six cards after the winner so the strip is never short at the end
    const cards = [];
    const weights = BR.RARITIES.map((r) => ({ r, w: chest.golden ? r.golden : r.weight }));
    for (let i = 0; i < count; i++) {
      if (i === target) { cards.push({ item: BR.itemById[drop.itemId], inst: { shine: drop.shine, seed: drop.seed } }); continue; }
      const r = rng.weighted(weights.filter((x) => x.w > 0), (x) => x.w).r;
      const list = pool.filter((x) => x.rarity === r.id);
      const item = rng.pick(list.length ? list : pool);
      const shine = rng.weighted(BR.SHINES, (f) => f.weight);
      cards.push({ item, inst: { shine: shine.id, seed: rng.int(10000) } });
    }
    return { cards, target };
  };
})();
