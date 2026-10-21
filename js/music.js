/* Pop Rush soundtrack. Composed, not random, and synthesized with Web Audio (no files, works offline).

   Harmony   C major pentatonic over I - V - vi - IV (C, G, Am, F), two bars per chord, so a section is 8 bars. No minor key:
             the tension in a run comes from the fuse, not the music.
   Tempo     menu 96 BPM, run 110, Rush 124 (Rush also lifts the key +2 semitones). Changes land on a bar line.
   Form      a run piece is seven 8-bar sections (about two minutes at 110 BPM) built from A, A', B and A''. The order is re-drawn
             from a seeded random each pass (and per-section arp, bass and melody variants too), so a long session never repeats
             exactly. The lead melody only plays in B and in Rush, which keeps it a treat.
   Stems     pad (detuned triangles, low-pass), round bass (sine + a little triangle), soft pluck arp, brushed drums, lead
             (short FM bell), counter melody, and a Rush layer (bright arps + shaker). Every stem is oscillators or filtered noise.
   Adaptive  setStage (drums from 2, pluck from 3, counter-melody from 5), setLow (fuse under 25%: thin pad + quiet pulse),
             setRush (rush layer + key lift on the next bar), stageUp (riser that lands on the next bar), setMode('menu'|'run')
             crossfades, duck, resultsSting.
   Engine    a look-ahead scheduler (a timer every 40 ms queues 16th notes 200 ms ahead), so it never stutters on a phone.
             Players fade in and out smoothly and disconnect every node when they die. */
(function () {
  'use strict';
  const BR = (window.BR = window.BR || {});
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const noop = () => { };

  const BPM = { menu: 96, run: 110, rush: 124 };
  const RUSH_KEY = 2;                 // semitones
  const INTERVAL = 40;                // ms between scheduler wake-ups
  const LOOKAHEAD = 0.2;              // seconds of 16th notes queued ahead (widens by itself if the timer is ever late)
  const SECTION_BARS = 8;
  const EPOCH_SECTIONS = 7;           // A A' B A'' pass: seven sections, about two minutes at 110 BPM
  const EPOCH_BARS = SECTION_BARS * EPOCH_SECTIONS;
  const MIX = 1.26;                   // overall level of the stems (+2 dB); tests/audio.js holds the loudest second 6+ dB under the loudest pop

  /* ---------- seeded randomness ---------- */
  function hash(a, b) {
    let h = (a ^ 0x9e3779b9) + Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return (h ^ (h >>> 15)) >>> 0;
  }
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------- the composition ---------- */
  // I V vi IV in C. root = bass note, pad = smooth voice-leading, ladder = notes of the pentatonic scale that sit well on the chord.
  const CHORDS = [
    { name: 'C', root: 36, pad: [55, 60, 64], ladder: [60, 64, 67, 69, 72, 74, 76] },
    { name: 'G', root: 43, pad: [55, 59, 62], ladder: [62, 64, 67, 69, 74, 76, 79] },
    { name: 'Am', root: 45, pad: [57, 60, 64], ladder: [64, 67, 69, 72, 74, 76, 79] },
    { name: 'F', root: 41, pad: [57, 60, 65], ladder: [60, 62, 67, 69, 72, 74, 79] },
  ];
  // bass, one bar: [step 0-15, semitones above the chord root (0, 7, 12 only), length in steps, velocity]
  const BASS = [
    [[0, 0, 6, 1], [8, 0, 4, 0.8], [12, 7, 3, 0.6]],
    [[0, 0, 3, 1], [4, 0, 2, 0.6], [8, 7, 3, 0.85], [12, 12, 3, 0.65]],
    [[0, 0, 8, 1], [8, 0, 2, 0.7], [10, 7, 2, 0.65], [12, 0, 4, 0.8]],
    [[0, 0, 4, 1], [6, 7, 2, 0.7], [8, 0, 4, 0.9], [14, 7, 2, 0.55]],
  ];
  const BASS_B = [
    [[0, 0, 3, 1], [3, 0, 2, 0.7], [6, 7, 2, 0.75], [8, 0, 3, 0.9], [11, 0, 2, 0.65], [14, 12, 2, 0.7]],
    [[0, 0, 2, 1], [3, 0, 2, 0.7], [6, 0, 2, 0.7], [8, 7, 3, 0.85], [12, 0, 2, 0.8], [14, 7, 2, 0.6]],
  ];
  const BASS_MENU = [[0, 0, 8, 0.8], [8, 7, 8, 0.5]];
  // pluck arp, indices into the chord's ladder per 16th (-1 = rest)
  const ARP = [
    [0, -1, 2, -1, 1, -1, 3, -1, 2, -1, 4, -1, 3, -1, 1, -1],
    [0, -1, 1, -1, 2, -1, 4, -1, 3, -1, 2, -1, 1, -1, 2, -1],
    [2, -1, 4, -1, 3, -1, 2, -1, 1, -1, 3, -1, 5, -1, 4, -1],
    [0, -1, 2, -1, 4, -1, 2, -1, 3, -1, 5, -1, 3, -1, 2, -1],
    [0, 2, 1, -1, 3, -1, 2, 4, -1, 3, -1, 1, 2, -1, 4, -1],
    [4, -1, 3, -1, 2, -1, 3, -1, 4, -1, 6, -1, 5, -1, 4, -1],
  ];
  const MENU_MASK = [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0];
  const RUSH_ARP = [
    [4, 5, 6, 5, 4, 5, 6, 5, 3, 4, 5, 4, 3, 4, 5, 6],
    [2, 4, 5, 4, 2, 4, 6, 4, 3, 5, 6, 5, 3, 5, 4, 2],
  ];
  // lead melody: three phrase variants x four chord groups (2 bars = 32 steps each): [step, midi, length in steps]
  const PHRASES = [
    [
      [[0, 76, 3], [3, 74, 1], [4, 76, 4], [8, 79, 4], [12, 76, 2], [14, 74, 2], [16, 72, 6], [22, 74, 2], [24, 76, 8]],
      [[0, 74, 3], [3, 76, 1], [4, 79, 4], [8, 76, 4], [12, 74, 2], [14, 76, 2], [16, 74, 6], [22, 69, 2], [24, 67, 8]],
      [[0, 72, 3], [3, 74, 1], [4, 76, 4], [8, 79, 4], [12, 76, 2], [14, 72, 2], [16, 76, 6], [22, 74, 2], [24, 72, 8]],
      [[0, 69, 3], [3, 72, 1], [4, 74, 4], [8, 72, 4], [12, 69, 2], [14, 67, 2], [16, 69, 6], [22, 72, 2], [24, 74, 4], [28, 76, 4]],
    ],
    [
      [[2, 79, 2], [4, 76, 2], [6, 79, 2], [8, 81, 4], [12, 79, 2], [14, 76, 2], [18, 74, 2], [20, 76, 4], [24, 72, 4], [28, 74, 4]],
      [[2, 79, 2], [4, 74, 2], [6, 79, 2], [8, 81, 4], [12, 79, 2], [14, 74, 2], [18, 76, 2], [20, 74, 4], [24, 69, 4], [28, 74, 4]],
      [[2, 76, 2], [4, 72, 2], [6, 76, 2], [8, 79, 4], [12, 76, 2], [14, 72, 2], [18, 74, 2], [20, 76, 4], [24, 81, 4], [28, 79, 4]],
      [[2, 74, 2], [4, 69, 2], [6, 72, 2], [8, 74, 4], [12, 72, 2], [14, 69, 2], [18, 67, 2], [20, 69, 4], [24, 72, 4], [28, 76, 4]],
    ],
    [
      [[0, 79, 4], [4, 76, 4], [8, 74, 4], [12, 76, 4], [16, 72, 8], [24, 74, 4], [28, 76, 4]],
      [[0, 79, 4], [4, 76, 4], [8, 74, 4], [12, 69, 4], [16, 67, 8], [24, 69, 4], [28, 74, 4]],
      [[0, 81, 4], [4, 79, 4], [8, 76, 4], [12, 72, 4], [16, 76, 8], [24, 74, 4], [28, 72, 4]],
      [[0, 81, 4], [4, 79, 4], [8, 74, 4], [12, 72, 4], [16, 69, 8], [24, 72, 4], [28, 74, 4]],
    ],
  ];
  // counter-melody (stage 5+): one long note per bar, two per chord group
  const COUNTER = [[67, 69], [62, 64], [64, 67], [69, 67]];
  // seven-section passes. A = statement, Ap = A', B = bridge with the lead melody, App = A'' (return, with a fill)
  const TEMPLATES = [
    ['A', 'Ap', 'B', 'A', 'Ap', 'B', 'App'],
    ['A', 'B', 'Ap', 'A', 'B', 'Ap', 'App'],
    ['A', 'Ap', 'A', 'B', 'Ap', 'B', 'App'],
    ['A', 'Ap', 'B', 'Ap', 'A', 'B', 'App'],
    ['A', 'A', 'Ap', 'B', 'A', 'B', 'App'],
    ['A', 'Ap', 'B', 'A', 'B', 'Ap', 'App'],
    ['A', 'B', 'A', 'Ap', 'B', 'Ap', 'App'],
    ['A', 'A', 'B', 'Ap', 'A', 'B', 'App'],
  ];

  /** The plan for section number si: kind plus per-section variants, all derived from the seed (cached). */
  function sectionInfo(M, si) {
    const c = M._plan;
    if (c.seed !== M.seed) { c.seed = M.seed; c.list = []; c.tpl = []; c.lastB = -1; }
    const tplFor = (epoch) => {
      if (c.tpl[epoch] != null) return c.tpl[epoch];
      const r = rng(hash(M.seed, 1000 + epoch));
      let t = Math.floor(r() * TEMPLATES.length);
      if (epoch > 0 && t === tplFor(epoch - 1)) t = (t + 1 + Math.floor(r() * (TEMPLATES.length - 1))) % TEMPLATES.length;
      return (c.tpl[epoch] = t);
    };
    while (c.list.length <= si) {
      const i = c.list.length, epoch = Math.floor(i / EPOCH_SECTIONS), pos = i % EPOCH_SECTIONS;
      const r = rng(hash(M.seed, 77 + i * 13));
      const prev = c.list[i - 1];
      const kind = TEMPLATES[tplFor(epoch)][pos];
      const info = {
        index: i, epoch, kind,
        arp: prev ? (prev.arp + 1 + Math.floor(r() * 5)) % ARP.length : Math.floor(r() * ARP.length),
        bass: prev ? (prev.bass + 1 + Math.floor(r() * 3)) % BASS.length : Math.floor(r() * BASS.length),
        bassB: Math.floor(r() * BASS_B.length),
        voice: Math.floor(r() * 3),
        phrase: Math.floor(r() * PHRASES.length),
        rushArp: Math.floor(r() * RUSH_ARP.length),
      };
      if (kind === 'B') { info.phrase = (c.lastB + 1 + Math.floor(r() * 2)) % PHRASES.length; c.lastB = info.phrase; }
      else if (prev && info.phrase === prev.phrase) info.phrase = (info.phrase + 1) % PHRASES.length;
      c.list.push(info);
    }
    return c.list[si];
  }

  /* ---------- the engine ---------- */
  const M = {
    enabled: true, running: false, mode: 'run', stage: 1, rush: false, low: false, volume: 0.7,
    seed: (Math.random() * 4294967296) >>> 0,
    lookahead: LOOKAHEAD, idleMs: 45000, idleTimer: 0, players: [], timer: 0, chain: null, cursor: 0, _plan: { seed: null, list: [], tpl: [], lastB: -1 },
    _log: null, _solo: null, _wanted: null, _holdDuck: false,
    stats: { pumps: 0, underruns: 0, minMargin: 9, maxPumpMs: 0 },     // scheduler health: an underrun means a note was due before the timer woke up

    get bpm() { const p = this.players[this.players.length - 1]; return p ? p.ap.bpm : 0; },
    get keyOffset() { const p = this.players[this.players.length - 1]; return p ? p.ap.key : 0; },

    setSeed(n) { this.seed = n >>> 0; },
    /** Section kinds of the first n sections for the current seed (A, Ap, B, App). */
    plan(n) { const out = []; for (let i = 0; i < n; i++) out.push(sectionInfo(this, i).kind); return out; },

    setEnabled(on) {
      on = !!on;
      if (on === this.enabled) return;
      this.enabled = on;
      if (!on) { const m = this.running ? this.mode : null; this.stop(); this._wanted = m; }
      else if (this._wanted) { const m = this._wanted; this._wanted = null; this.start(m); }
    },
    /** Music volume 0..1 (default 0.7, which sits 9 dB under the effects). */
    setVolume(v) { this.volume = clamp(+v || 0, 0, 1); if (BR.Audio && BR.Audio.setMusicVolume) BR.Audio.setMusicVolume(this.volume); },
    setStage(n) { this.stage = clamp(Math.round(+n) || 1, 1, 12); },
    setRush(on) { this.rush = !!on; },
    setLow(on) { on = !!on; if (on === this.low) return; this.low = on; for (const p of this.players) p.applyLow(); },   // safe to call every frame
    /** duck(true) takes the music about 6 dB down and holds it (pause, sheets) until duck(false); duck(true, ms) lets go by itself. */
    duck(on, ms) {
      if (on && ms > 0) { this.duckFor(ms); return; }
      this._holdDuck = !!on;
      const d = this.chain && this.chain.duck; if (!d) return;
      const t = d.context.currentTime;
      try { d.gain.cancelScheduledValues(t); d.gain.setTargetAtTime(on ? 0.5 : 1, t, on ? 0.1 : 0.25); } catch (e) { /* ignore */ }
    },
    /** About 6 dB down for ms milliseconds, then back; big sound effects call this themselves. */
    duckFor(ms) {
      const d = this.chain && this.chain.duck; if (!d || !this.players.length) return;
      const t = d.context.currentTime, back = t + (ms || 600) / 1000;
      try {
        d.gain.cancelScheduledValues(t);
        d.gain.setTargetAtTime(0.5, t, 0.04);
        d.gain.setTargetAtTime(this._holdDuck ? 0.5 : 1, back, 0.28);
      } catch (e) { /* ignore */ }
    },

    /** Build the shared reverb and bus ahead of time (call after the first tap) so the first start() has nothing heavy left to do. */
    prepare() { const c = BR.Audio && BR.Audio.context(); if (c) { this.ensureChain(c); this.armIdle(); } },
    start(mode) {
      mode = mode === 'menu' ? 'menu' : 'run';
      if (!this.enabled) { this._wanted = mode; return; }
      const c = BR.Audio && BR.Audio.context(); if (!c) return;
      if (this.running) { this.setMode(mode); return; }
      this._wanted = null;
      if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = 0; }
      const chain = this.ensureChain(c);
      this.mode = mode; this.running = true;
      const bar = Math.ceil(this.cursor / EPOCH_BARS) * EPOCH_BARS;   // every start opens on a fresh pass
      const p = new Player(this, c, mode, { bar, startT: c.ctx.currentTime + 0.06, fadeIn: mode === 'menu' ? 1.8 : 1.2, intro: mode === 'menu' ? 0 : 2 });
      this.players.push(p);
      if (!c.offline && !this.timer) this.timer = setInterval(() => this.pump(), INTERVAL);
      if (chain) this.duck(this._holdDuck);
      this.pump();
    },
    stop() {
      this._wanted = null;
      this.liftKey(0);
      if (!this.running) return;
      this.running = false;
      for (const p of this.players) p.retire(p.ctx.currentTime, 0.2, 0.2);
    },
    /** The pops follow the music's key; Rush lifts it, anything that ends the music puts it back. */
    liftKey(k) { try { if (BR.Audio && BR.Audio.setKey) BR.Audio.setKey(k); } catch (e) { /* ignore */ } },
    /** Crossfade to the menu or run arrangement; the new one enters on the next bar line, in the same bar of the same chord. */
    setMode(mode) {
      mode = mode === 'menu' ? 'menu' : 'run';
      if (!this.running) { this.mode = mode; return; }
      const cur = this.players[this.players.length - 1];
      if (!cur || cur.mode === mode) return;
      this.mode = mode;
      const c = BR.Audio.context(); if (!c) return;
      const bT = cur.boundaryTime();
      cur.retire(bT, 0.5, 0.5);
      this.players.push(new Player(this, c, mode, { bar: cur.step === 0 ? cur.bar : cur.bar + 1, startT: bT, fadeIn: 1.6, intro: 0 }));
    },
    /** A riser that lands on the next bar line, where the new stage's stems join. */
    stageUp() { const p = this.players[this.players.length - 1]; if (this.running && p) p.wantRiser = true; },
    /** A short sting that resolves to the menu key (C major). Plays even if the soundtrack has stopped. */
    resultsSting() {
      if (!this.enabled) return;
      const c = BR.Audio && BR.Audio.context(); if (!c) return;
      if (!c.offline && c.ctx.state !== 'running') return;
      try { this.duckFor(2200); sting(this, c); } catch (e) { /* ignore */ }
    },

    /* --- shared graph: duck -> music bus, with one reverb --- */
    ensureChain(c) {
      if (this.chain && this.chain.ctx === c.ctx) return this.chain;
      if (this.chain) this.dropChain();
      const x = c.ctx, ch = { ctx: c.ctx, nodes: [], offline: !!c.offline };
      const mk = (n) => { ch.nodes.push(n); return n; };
      ch.duck = mk(x.createGain()); ch.duck.gain.value = 1; ch.duck.connect(c.music);
      // a gentle glue compressor: the loudest passages (Rush, a B section with every stem) are held close to the quiet ones
      ch.bus = mk(x.createDynamicsCompressor());
      ch.bus.threshold.value = -22; ch.bus.knee.value = 10; ch.bus.ratio.value = 2.5; ch.bus.attack.value = 0.03; ch.bus.release.value = 0.3;
      const post = mk(x.createGain()); post.gain.value = 0.66;          // takes back the compressor's automatic make-up gain
      ch.bus.connect(post); post.connect(ch.duck);
      ch.noise = noiseBuffer(x);
      if (!BR.lowEnd && x.createConvolver) {
        try {
          const conv = mk(x.createConvolver()); conv.buffer = impulse(x);
          ch.revSend = mk(x.createGain()); ch.revSend.gain.value = 1;
          const ret = mk(x.createGain()); ret.gain.value = 0.3;
          ch.revSend.connect(conv); conv.connect(ret); ret.connect(ch.duck);
        } catch (e) { ch.revSend = null; }
      }
      this.chain = ch;
      return ch;
    },
    /** The shared bus and reverb stay for a while after the music stops (the next run starts at once), then everything is released. */
    armIdle() {
      if (!this.chain || this.players.length) return;
      if (this.chain.offline) { this.dropChain(); return; }
      if (this.idleTimer) clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => { this.idleTimer = 0; if (!this.players.length) this.dropChain(); }, this.idleMs);
    },
    dropChain() {
      if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = 0; }
      const ch = this.chain; this.chain = null; if (!ch) return;
      for (const n of ch.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
    },

    /** Scheduler wake-up (called by the timer; tests call it with their own clock). */
    pump(ahead) {
      const a = ahead || this.lookahead, t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      for (let i = this.players.length - 1; i >= 0; i--) {
        const p = this.players[i], now = p.ctx.currentTime;
        if (p.endAt == null && p.nextT > 0) { const m = p.nextT - now; this.stats.pumps++; if (m < this.stats.minMargin) this.stats.minMargin = m; if (m < 0 && p.barsPlayed > 0) { this.stats.underruns++; if (!ahead) this.lookahead = Math.min(0.5, this.lookahead + 0.08); } }
        try { p.tick(now, a); } catch (e) { /* the soundtrack must never break the game */ }
        if (p.deadAt != null && now >= p.deadAt) { p.destroy(); this.players.splice(i, 1); }
      }
      if (!this.players.length) {
        if (this.timer) { clearInterval(this.timer); this.timer = 0; }
        this.running = false;
        this.armIdle();
      }
      const ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
      if (ms > this.stats.maxPumpMs) this.stats.maxPumpMs = ms;
    },
    /** Drop everything immediately (used when switching to an offline test context). */
    _reset() {
      if (this.timer) { clearInterval(this.timer); this.timer = 0; }
      for (const p of this.players) p.destroy();
      this.players = []; this.running = false; this.dropChain();
      this._wanted = null;
    },
    _debug() { return { players: this.players.length, nodes: this.players.reduce((n, p) => n + p.nodes.length, 0), chain: this.chain ? this.chain.nodes.length : 0, timer: !!this.timer, running: this.running }; },
  };
  // the audio engine tells the music when its context is replaced (offline test renders)
  M._pump = (ahead) => M.pump(ahead);

  const BASS_CURVE = (() => { const n = 1024, c = new Float32Array(n), k = 2.4, d = Math.tanh(k); for (let i = 0; i < n; i++) c[i] = Math.tanh(k * ((i / (n - 1)) * 2 - 1)) / d; return c; })();

  function noiseBuffer(x) {
    const len = x.sampleRate * 2, b = x.createBuffer(1, len, x.sampleRate), d = b.getChannelData(0);
    let s = 0x2545f491;
    for (let i = 0; i < len; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; d[i] = ((s >>> 0) / 2147483648) - 1; }
    return b;
  }
  /** A small, dark room: decaying noise, a little smoothed so it never hisses. */
  function impulse(x) {
    const sec = 1.5, len = Math.floor(x.sampleRate * sec), b = x.createBuffer(2, len, x.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let s = 0x1234567 + ch * 7919, lp = 0;
      for (let i = 0; i < len; i++) {
        s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
        const n = ((s >>> 0) / 2147483648) - 1, e = Math.pow(1 - i / len, 3.2);
        lp += (n - lp) * 0.5; d[i] = lp * e * (i < 400 ? i / 400 : 1);
      }
    }
    return b;
  }

  /* ---------- a player renders the music for one mode ---------- */
  class Player {
    constructor(owner, c, mode, o) {
      this.M = owner; this.ctx = c.ctx; this.mode = mode; this.bar = o.bar; this.step = 0; this.nextT = o.startT;
      this.sd = 60 / BPM[mode === 'menu' ? 'menu' : 'run'] / 4;
      this.barsPlayed = 0; this.intro = o.intro || 0; this.endAt = null; this.deadAt = null; this.wantRiser = false;
      this.ap = { stage: 1, rush: false, low: false, bpm: BPM[mode === 'menu' ? 'menu' : 'run'], key: 0 };
      this.sec = null; this.L = {}; this.padGate = null; this.noise = owner.chain.noise; this.long = [];
      this.rand = rng(hash(owner.seed, o.bar * 31 + 5));
      this.nodes = [];
      this.build(owner.chain, o);
    }
    mkGain(v) { const n = this.ctx.createGain(); n.gain.value = v; this.nodes.push(n); return n; }
    mkFilter(type, f, q) { const n = this.ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q == null ? 0.7 : q; this.nodes.push(n); return n; }
    build(ch, o) {
      const x = this.ctx, menu = this.mode === 'menu';
      this.sum = this.mkGain(1);
      this.tone = this.mkFilter('lowpass', 6200, 0.6);
      this.fadeIn = this.mkGain(0.0001);
      this.fadeOut = this.mkGain(1);
      this.sum.connect(this.tone); this.tone.connect(this.fadeIn); this.fadeIn.connect(this.fadeOut); this.fadeOut.connect(ch.bus);
      this.fadeIn.gain.setValueAtTime(0.0001, o.startT);
      this.fadeIn.gain.linearRampToValueAtTime(1, o.startT + (o.fadeIn || 1));
      // stems (levels are the mix: the music bus sits 9 dB under the effects on top of this)
      const boost = menu ? 1.3 : 1;                  // the menu is the only thing playing, so it can sit a little higher
      const lv = { pad: 0.28 * boost, bass: 0.08 * boost, pluck: 0.35 * boost, drums: 0.25, lead: 0.22, counter: 0.085, rush: 0.17, pulse: 0.25, fx: 0.2 };
      this.lv = lv; this.st = {};
      for (const k of Object.keys(lv)) { lv[k] *= MIX; const g = this.mkGain(lv[k]); g.connect(this.sum); this.st[k] = g; }
      this.padLP = this.mkFilter('lowpass', menu ? 1100 : 1400, 0.5); this.padLP.connect(this.st.pad);
      this.bassLP = this.mkFilter('lowpass', 900, 0.7); this.bassLP.connect(this.st.bass);
      // a touch of tanh warms the sine: the 2nd/3rd harmonics are what a phone speaker can actually play
      this.bassShaper = x.createWaveShaper(); this.bassShaper.curve = BASS_CURVE; this.nodes.push(this.bassShaper); this.bassShaper.connect(this.bassLP);
      // tempo-synced echo (dotted eighth) and the shared reverb
      this.echoIn = this.mkGain(1);
      this.delay = x.createDelay(1.5); this.delay.delayTime.value = this.sd * 3; this.nodes.push(this.delay);
      const fbLP = this.mkFilter('lowpass', 2100, 0.5), fb = this.mkGain(0.34), ret = this.mkGain(0.42);
      this.echoIn.connect(this.delay); this.delay.connect(ret); ret.connect(this.sum); this.delay.connect(fbLP); fbLP.connect(fb); fb.connect(this.delay);
      const send = (from, to, amt) => { if (!to) return; const g = this.mkGain(amt); from.connect(g); g.connect(to); };
      send(this.st.pluck, this.echoIn, 0.55); send(this.st.lead, this.echoIn, 0.4); send(this.st.rush, this.echoIn, 0.32);
      send(this.st.pad, ch.revSend, 0.5); send(this.st.pluck, ch.revSend, 0.25); send(this.st.lead, ch.revSend, 0.35);
      send(this.st.counter, ch.revSend, 0.4); send(this.st.rush, ch.revSend, 0.2);
    }
    boundaryTime() { return this.step === 0 ? this.nextT : this.nextT + (16 - this.step) * this.sd; }
    /** Stop scheduling at time t, fade out (time constant tau) and die once every tail has ended. */
    retire(t, tau, tail) {
      this.endAt = t;
      const now = this.ctx.currentTime;
      try { this.fadeOut.gain.setTargetAtTime(0, Math.max(now, t), tau); } catch (e) { /* ignore */ }
      const dieAt = Math.max(now, t) + tau * 7 + (tail || 0) + 0.3;
      this.deadAt = dieAt + 1.0;
      // cut the long voices (pad, counter) once the fade has made them inaudible, so nothing keeps running unheard
      for (const v of this.long) { if (v.end > dieAt) { try { v.o.stop(dieAt); } catch (e) { /* ignore */ } } }
    }
    destroy() {
      for (const n of this.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
      this.nodes = []; this.long = []; this.padGate = null; this.dead = true;
    }
    applyLow() {
      const low = this.M.low, t = this.ctx.currentTime;
      try {
        this.st.pad.gain.setTargetAtTime(low ? this.lv.pad * 0.5 : this.lv.pad, t, 0.35);
        this.padLP.frequency.setTargetAtTime(low ? 520 : this.padCut || 1400, t, 0.35);
      } catch (e) { /* ignore */ }
    }

    tick(now, ahead) {
      let guard = 0;
      while (this.nextT < now + ahead && guard++ < 600) {
        if (this.endAt != null && this.nextT >= this.endAt - 1e-6) break;
        if (this.wantRiser) { this.wantRiser = false; this.riser(now); }
        this.advance(this.nextT >= now - 0.03);        // after a stall (a background tab) late steps are skipped, not blurted out
      }
    }
    advance(play) {
      const t = this.nextT;
      try {
        if (this.step === 0) this.barStart(t, play);
        if (play) this.playStep(t);
      } catch (e) { /* one bad step must never stop the clock */ }
      this.nextT = t + this.sd;
      if (++this.step === 16) { this.step = 0; this.bar++; this.barsPlayed++; this.M.cursor = Math.max(this.M.cursor, this.bar); }
    }
    ev(stem, midi, t, vel, len) { const L = this.M._log; if (L) L.push({ k: 'note', stem, midi, t, vel, len, bar: this.bar, step: this.step, key: this.ap.key, mode: this.mode }); }

    /* ----- bar line: apply requested changes, plan the bar ----- */
    barStart(t, play) {
      const m = this.M, ap = this.ap, menu = this.mode === 'menu';
      const prevKey = ap.key;
      ap.stage = m.stage; ap.rush = !menu && m.rush; ap.low = !menu && m.low;
      ap.bpm = menu ? BPM.menu : (ap.rush ? BPM.rush : BPM.run);
      ap.key = ap.rush ? RUSH_KEY : 0;
      this.sd = 60 / ap.bpm / 4;
      const bis = this.bar % SECTION_BARS, si = Math.floor(this.bar / SECTION_BARS);
      this.sec = sectionInfo(m, si);
      this.bis = bis; this.ci = bis >> 1; this.chord = CHORDS[this.ci];
      const kind = this.sec.kind, intro = this.barsPlayed < this.intro;
      this.L = {
        pad: true, bass: true, fx: !intro,
        pluck: !intro && (menu || ap.stage >= 3 || ap.rush),
        drums: !intro && !menu && (ap.stage >= 2 || ap.rush),
        lead: !intro && !menu && (kind === 'B' || ap.rush),
        counter: !intro && !menu && ap.stage >= 5,
        rush: !intro && !menu && ap.rush,
        pulse: ap.low,
      };
      if (m._solo) for (const k of Object.keys(this.L)) if (m._solo.indexOf(k) < 0) this.L[k] = false;
      if (m._log) m._log.push({ k: 'bar', t, bar: this.bar, played: this.barsPlayed, bis, chord: this.ci, kind, sec: si, bpm: ap.bpm, key: ap.key, stage: ap.stage, rush: ap.rush, low: ap.low, mode: this.mode, L: Object.assign({}, this.L) });
      if (!play) return;
      const dsp = this.ctx.currentTime;
      // tempo-synced echo, pad brightness by section
      try {
        this.delay.delayTime.setTargetAtTime(this.sd * 3, Math.max(t, dsp), 0.05);
        this.padCut = (menu ? 1100 : 1400) + (kind === 'B' ? 500 : 0) + (ap.rush ? 400 : 0);
        this.padLP.frequency.setTargetAtTime(ap.low ? 520 : this.padCut * (bis % 2 ? 1.22 : 0.86), Math.max(t, dsp), 0.6);   // the pad breathes: opens on the second bar of a chord
        this.st.pad.gain.setTargetAtTime(ap.low ? this.lv.pad * 0.5 : this.lv.pad, Math.max(t, dsp), 0.5);
      } catch (e) { /* ignore */ }
      // the pops follow the music's key
      if (prevKey !== ap.key || this.barsPlayed === 0) this.sendKey(t, ap.key);
      // pad: one chord per two bars, restarted at once if the key lifts in the middle of a chord
      const chordStart = bis % 2 === 0;
      if (chordStart || prevKey !== ap.key) {
        if (!chordStart && this.padGate) { try { this.padGate.gain.setTargetAtTime(0.0001, Math.max(t, dsp), 0.2); } catch (e) { /* ignore */ } }
        const bars = chordStart ? 2 : 1, dur = bars * 16 * this.sd;
        const pv = this.chord.pad.slice();
        if (this.sec.voice === 1) pv[2] += 12; else if (this.sec.voice === 2) pv[0] += 12;      // open voicing / inversion: the pad changes colour between sections
        this.padChord(t, pv.map((n) => n + ap.key), dur, kind, !chordStart);
      }
    }
    sendKey(t, key) {
      const A = BR.Audio; if (!A || !A.setKey) return;
      const c = A.context(); if (!c || c.offline) return;
      const wait = Math.max(0, (t - this.ctx.currentTime) * 1000);
      if (wait < 20) A.setKey(key); else setTimeout(() => { if (!this.dead && this.endAt == null) A.setKey(key); }, wait);
    }

    /* ----- one 16th note ----- */
    playStep(t0) {
      const L = this.L, ap = this.ap, s = this.step, key = ap.key, sec = this.sec, kind = sec.kind, ch = this.chord, sd = this.sd;
      const menu = this.mode === 'menu', bis = this.bis, last = bis === 7;
      // a little swing on the off-sixteenths: loose in the menu and runs, tighter in Rush
      const t = t0 + ((s & 1) ? sd * (menu ? 0.07 : (ap.rush ? 0.04 : 0.1)) : 0);
      const jit = () => (this.rand() - 0.5) * 0.010;
      // bass
      if (L.bass) {
        const pat = menu ? BASS_MENU : (kind === 'B' ? BASS_B[sec.bassB] : BASS[sec.bass]);
        for (const [st, semi, len, vel] of pat) if (st === s) this.bassNote(t, ch.root + semi + key, len * sd, vel * (menu ? 0.8 : 1));
      }
      // pluck arp
      if (L.pluck) {
        let idx = ARP[sec.arp][s];
        const intense = ap.stage >= 4 || ap.rush;
        if (menu && !MENU_MASK[s]) idx = -1;
        if (!menu && idx < 0 && intense && s % 2 === 1 && this.rand() < 0.4) idx = Math.floor(this.rand() * 5);   // ghost notes
        if (idx >= 0) {
          const accent = s % 4 === 0 ? 1 : (s % 2 === 0 ? 0.72 : 0.42);
          const vel = 0.5 * accent * (menu ? 0.8 : 1) * (kind === 'B' ? 0.72 : 1) * (0.92 + this.rand() * 0.16);
          this.pluckNote(t + jit(), ch.ladder[idx] + key, vel, menu ? 0.42 : 0.3, ((s >> 1) % 2 ? 0.28 : -0.28));
        }
        if (last && s >= 12 && !menu && ap.stage >= 3) this.pluckNote(t, ch.ladder[Math.min(6, s - 9)] + key, 0.3, 0.2, 0.2);   // run into the next section
      }
      // drums
      if (L.drums) this.drums(t, s, bis, kind, last);
      // lead melody
      if (L.lead) {
        const s32 = (bis & 1) * 16 + s, ph = PHRASES[sec.phrase][this.ci];
        for (const [st, midi, len] of ph) if (st === s32) {
          const vel = (st === 0 ? 0.95 : 0.8) * (kind === 'B' ? 1 : 0.8) * (0.92 + this.rand() * 0.14);
          this.leadNote(t + jit(), midi + key, vel, Math.min(1.6, len * sd * 1.05));
        }
      }
      // counter-melody: one long note a bar
      if (L.counter && s === 0) this.counterNote(t, COUNTER[this.ci][bis & 1] + key, 16 * sd);
      // Rush layer: bright 16th arps and a shaker
      if (L.rush) {
        const idx = RUSH_ARP[(sec.rushArp + (this.bar & 1)) % RUSH_ARP.length][s];
        if (!(s % 4 === 3 && this.rand() < 0.5)) this.rushBell(t + jit(), ch.ladder[Math.min(6, Math.max(0, idx))] + key + (idx < 3 ? 12 : 0), (s % 4 === 0 ? 0.5 : 0.34));
        this.shaker(t, s % 4 === 2 ? 0.9 : (s % 2 === 0 ? 0.55 : 0.3));
      }
      // low fuse: a quiet pulse on every beat
      if (L.pulse && s % 4 === 0) this.pulse(t, s === 0 ? 1 : 0.7, ch.root + 12 + key);
      // section boundaries: a soft reversed swell through the last half-bar, a brushed crash on the downbeat
      if (L.fx) {
        if (last && s === 8) this.swell(t0, 8 * sd, menu ? 0.5 : 1);
        if (bis === 0 && s === 0 && this.barsPlayed > 0) this.crash(t0, menu ? 0.5 : 1);
      }
    }

    drums(t, s, bis, kind, last) {
      const ap = this.ap, stage = ap.stage, rush = ap.rush;
      const lightBars = kind === 'App' && bis < 4;            // A'' opens with the kick laid out
      let kick = [];
      if (rush) kick = [0, 4, 8, 12];
      else if (stage <= 2) kick = [0, 8];
      else if (stage === 3) kick = [0, 8, 14];
      else kick = [0, 6, 8, 14];
      if (!lightBars && kick.indexOf(s) >= 0) this.kick(t, s === 0 ? 1 : 0.8);
      const backbeat = stage >= 3 || rush;
      if (backbeat && (s === 4 || s === 12)) this.rim(t, 0.55);
      // brushed hats: off-beat eighths, with sixteenth ghosts when it gets busy
      if (s % 4 === 2) this.hat(t, 0.5, 0.075);
      else if ((stage >= 4 || rush) && s % 2 === 0) this.hat(t, 0.3, 0.04);
      else if (stage >= 4 && s % 2 === 1 && this.rand() < 0.35) this.hat(t, 0.16, 0.03);
      if (last && s >= 13 && stage >= 3) this.hat(t, 0.3 + (s - 13) * 0.12, 0.03);                  // fill
    }

    /* ----- instruments ----- */
    keepLong(o, end) {
      const now = this.ctx.currentTime;
      this.long = this.long.filter((v) => v.end > now);
      this.long.push({ o, end });
    }
    tidy(osc, nodes) { osc.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } } }; }
    env(g, t, peak, att, dur, floor) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), t + att);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, floor == null ? peak * 0.002 : floor), t + Math.max(att + 0.01, dur));
    }
    src(t, dur) {
      const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
      s.start(t, this.rand() * 1.6); s.stop(t + dur + 0.03);
      return s;
    }
    padChord(t0, notes, dur, kind, restart) {
      const x = this.ctx, now = x.currentTime, t = Math.max(t0, now + 0.01);
      dur -= t - t0; if (dur < 0.3) return;
      const mix = x.createGain(), gate = x.createGain(), vol = 0.1 * (kind === 'B' ? 1.1 : 1), att = restart ? 0.3 : 0.55, rel = 1.0;
      mix.gain.setValueAtTime(0.0001, t);
      mix.gain.linearRampToValueAtTime(vol, t + att);
      mix.gain.setValueAtTime(vol, t + dur);
      mix.gain.linearRampToValueAtTime(0.0001, t + dur + rel);
      mix.connect(gate); gate.connect(this.padLP);
      const oscs = [];
      notes.forEach((m, i) => {
        for (const d of [-7, 6]) {
          const o = x.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = d + (i - 1) * 1.5;
          o.connect(mix); o.start(t); o.stop(t + dur + rel + 0.05); oscs.push(o); this.keepLong(o, t + dur + rel + 0.05);
          this.ev('pad', m, t, 1, dur);
        }
      });
      this.tidy(oscs[oscs.length - 1], [mix, gate]);
      this.padGate = gate;
    }
    bassNote(t, midi, len, vel) {
      const x = this.ctx, f = mtof(midi), o = x.createOscillator(), o2 = x.createOscillator(), g = x.createGain(), h = x.createGain();
      o.type = 'sine'; o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f; h.gain.value = 0.4;
      o.connect(g); o2.connect(h); h.connect(g);
      const dur = Math.max(0.1, len * 0.96);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.012);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vel * 0.3), t + dur * 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.07);
      g.connect(this.bassShaper);
      o.start(t); o.stop(t + dur + 0.1); o2.start(t); o2.stop(t + dur + 0.1);
      this.tidy(o, [g, h]);
      this.ev('bass', midi, t, vel, dur);
    }
    pluckNote(t, midi, vel, dur, pan) {
      const x = this.ctx, f = mtof(midi), o = x.createOscillator(), o2 = x.createOscillator(), h = x.createGain(), fl = x.createBiquadFilter(), g = x.createGain();
      o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2; h.gain.value = 0.3;
      fl.type = 'lowpass'; fl.Q.value = 0.9;
      fl.frequency.setValueAtTime(Math.min(5200, f * 8), t); fl.frequency.exponentialRampToValueAtTime(Math.max(380, f * 1.25), t + 0.16);
      o.connect(fl); o2.connect(h); h.connect(fl); fl.connect(g);
      this.env(g, t, vel, 0.004, dur);
      const nodes = [h, fl, g];
      if (x.createStereoPanner) { const p = x.createStereoPanner(); p.pan.value = pan || 0; g.connect(p); p.connect(this.st.pluck); nodes.push(p); } else g.connect(this.st.pluck);
      o.start(t); o.stop(t + dur + 0.03); o2.start(t); o2.stop(t + dur + 0.03);
      this.tidy(o, nodes);
      this.ev('pluck', midi, t, vel, dur);
    }
    /** Short FM bell: a sine carrier whose modulator fades fast, so it rings like a tine. */
    fmBell(t, midi, vel, dur, dest, idx, ratio) {
      const x = this.ctx, f = mtof(midi), c = x.createOscillator(), m = x.createOscillator(), mg = x.createGain(), g = x.createGain();
      c.type = 'sine'; c.frequency.value = f; m.type = 'sine'; m.frequency.value = f * ratio;
      const depth = Math.min(f * idx, 2200);
      mg.gain.setValueAtTime(depth, t); mg.gain.exponentialRampToValueAtTime(Math.max(1, depth * 0.06), t + 0.32);
      m.connect(mg); mg.connect(c.frequency); c.connect(g);
      const end = Math.max(0.0003, vel * Math.exp(-dur / 0.55));
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(Math.max(0.0002, vel), t + 0.006);
      g.gain.exponentialRampToValueAtTime(end, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.16);
      g.connect(dest);
      c.start(t); c.stop(t + dur + 0.2); m.start(t); m.stop(t + dur + 0.2);
      this.tidy(c, [mg, g]);
    }
    leadNote(t, midi, vel, dur) { this.fmBell(t, midi, vel * 0.55, dur, this.st.lead, 1.9, 2); this.ev('lead', midi, t, vel, dur); }
    rushBell(t, midi, vel) { this.fmBell(t, midi, vel * 0.5, 0.2, this.st.rush, 1.5, 3); this.ev('rush', midi, t, vel, 0.2); }
    counterNote(t, midi, dur) {
      const x = this.ctx, f = mtof(midi), g = x.createGain(), fl = x.createBiquadFilter();
      fl.type = 'lowpass'; fl.frequency.value = 1300; fl.Q.value = 0.5;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3, t + 0.14);
      g.gain.setValueAtTime(0.3, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.35);
      g.connect(fl); fl.connect(this.st.counter);
      let last = null;
      for (const d of [-5, 6]) { const o = x.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = d; o.connect(g); o.start(t); o.stop(t + dur + 0.4); last = o; this.keepLong(o, t + dur + 0.4); }
      this.tidy(last, [g, fl]);
      this.ev('counter', midi, t, 0.3, dur);
    }
    kick(t, vel) {
      const x = this.ctx, o = x.createOscillator(), g = x.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(128, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.1);
      this.env(g, t, vel * 0.8, 0.004, 0.24);
      o.connect(g); g.connect(this.st.drums); o.start(t); o.stop(t + 0.28);
      const b = x.createOscillator(), bg = x.createGain();                    // a short knock a phone speaker can play
      b.type = 'triangle'; b.frequency.setValueAtTime(190, t); b.frequency.exponentialRampToValueAtTime(95, t + 0.05);
      this.env(bg, t, vel * 0.42, 0.003, 0.06); b.connect(bg); bg.connect(this.st.drums); b.start(t); b.stop(t + 0.09);
      this.tidy(o, [g, bg]); this.ev('kick', 0, t, vel, 0.24);
    }
    rim(t, vel) {
      const x = this.ctx, n = this.src(t, 0.05), f = x.createBiquadFilter(), g = x.createGain(), o = x.createOscillator(), og = x.createGain();
      f.type = 'bandpass'; f.frequency.value = 1750; f.Q.value = 3;
      this.env(g, t, vel * 0.5, 0.002, 0.045);
      n.connect(f); f.connect(g); g.connect(this.st.drums);
      o.type = 'sine'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(600, t + 0.03);
      this.env(og, t, vel * 0.22, 0.002, 0.04); o.connect(og); og.connect(this.st.drums); o.start(t); o.stop(t + 0.07);
      this.tidy(n, [f, g, og]); this.ev('rim', 0, t, vel, 0.05);
    }
    /** Brushed hat: noise that swells for a few ms and then falls away, band-limited so it never hisses. */
    hat(t, vel, dur) {
      const x = this.ctx, n = this.src(t, dur + 0.02), f = x.createBiquadFilter(), g = x.createGain();
      f.type = 'bandpass'; f.frequency.value = 5600; f.Q.value = 0.8;
      this.env(g, t, vel * 0.5, 0.012, dur + 0.01);
      n.connect(f); f.connect(g); g.connect(this.st.drums);
      this.tidy(n, [f, g]); this.ev('hat', 0, t, vel, dur);
    }
    swell(t, dur, vel) {
      const x = this.ctx, n = this.src(t, dur), f = x.createBiquadFilter(), g = x.createGain();
      f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(3600, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * vel, t + dur - 0.01); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.02);
      n.connect(f); f.connect(g); g.connect(this.st.fx);
      this.tidy(n, [f, g]); this.ev('swell', 0, t, vel, dur);
    }
    crash(t, vel) {
      const x = this.ctx, n = this.src(t, 0.9), f = x.createBiquadFilter(), g = x.createGain();
      f.type = 'bandpass'; f.Q.value = 0.6; f.frequency.value = 3000;
      this.env(g, t, 0.2 * vel, 0.006, 0.8);
      n.connect(f); f.connect(g); g.connect(this.st.fx);
      this.tidy(n, [f, g]); this.ev('crash', 0, t, vel, 0.8);
    }
    shaker(t, vel) {
      const x = this.ctx, n = this.src(t, 0.06), f = x.createBiquadFilter(), g = x.createGain();
      f.type = 'bandpass'; f.frequency.value = 4800; f.Q.value = 1;
      this.env(g, t, vel * 0.36, 0.006, 0.05);
      n.connect(f); f.connect(g); g.connect(this.st.rush);
      this.tidy(n, [f, g]); this.ev('shaker', 0, t, vel, 0.05);
    }
    pulse(t, vel, midi) {
      const x = this.ctx, o = x.createOscillator(), g = x.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(mtof(midi), t); o.frequency.exponentialRampToValueAtTime(mtof(midi) * 0.82, t + 0.16);
      this.env(g, t, vel * 0.3, 0.012, 0.2);
      o.connect(g); g.connect(this.st.pulse); o.start(t); o.stop(t + 0.24);
      this.tidy(o, [g]); this.ev('pulse', midi, t, vel, 0.2);
    }
    /** Riser that ends on the next bar line: noise sweeping up, a rising tone, then a soft impact and a bell on the downbeat. */
    riser(now) {
      const x = this.ctx, barDur = 16 * this.sd;
      let end = this.boundaryTime();
      if (end - now < 0.7) end += barDur;
      const t0 = Math.max(now + 0.03, end - 2.2), len = end - t0, key = this.ap.key;
      const n = this.src(t0, len), f = x.createBiquadFilter(), g = x.createGain();
      f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(3600, end);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.16, end - 0.02); g.gain.linearRampToValueAtTime(0.0001, end + 0.02);
      n.connect(f); f.connect(g); g.connect(this.st.rush);
      const o = x.createOscillator(), og = x.createGain(), lp = x.createBiquadFilter();
      o.type = 'triangle'; o.frequency.setValueAtTime(mtof(60 + key), t0); o.frequency.exponentialRampToValueAtTime(mtof(84 + key), end);
      lp.type = 'lowpass'; lp.frequency.value = 1800;
      og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(0.1, end - 0.02); og.gain.linearRampToValueAtTime(0.0001, end + 0.03);
      o.connect(lp); lp.connect(og); og.connect(this.st.rush); o.start(t0); o.stop(end + 0.06);
      // landing
      const k = x.createOscillator(), kg = x.createGain();
      k.type = 'sine'; k.frequency.setValueAtTime(70, end); k.frequency.exponentialRampToValueAtTime(40, end + 0.4);
      this.env(kg, end, 0.5, 0.01, 0.6); k.connect(kg); kg.connect(this.st.drums); k.start(end); k.stop(end + 0.66);
      this.fmBell(end, 72 + key, 0.3, 0.9, this.st.lead, 1.2, 2);
      this.tidy(n, [f, g, og, lp]); this.tidy(k, [kg]);
      this.ev('riser', 0, t0, 1, len);
    }
  }

  /** Results sting: a bell run over G that lands on a full C chord (the menu key), with a soft pad swell and bass. */
  function sting(owner, c) {
    const x = c.ctx, t = x.currentTime + 0.05;
    const out = x.createGain(); out.gain.value = 0.5;
    const lp = x.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    out.connect(lp); lp.connect(c.music);
    const nodes = [out, lp];
    const bell = (at, midi, vel, dur) => {
      const f = mtof(midi), car = x.createOscillator(), mod = x.createOscillator(), mg = x.createGain(), g = x.createGain();
      car.frequency.value = f; mod.frequency.value = f * 2;
      const depth = Math.min(f * 1.3, 1800); mg.gain.setValueAtTime(depth, t + at); mg.gain.exponentialRampToValueAtTime(Math.max(1, depth * 0.06), t + at + 0.3);
      mod.connect(mg); mg.connect(car.frequency); car.connect(g);
      g.gain.setValueAtTime(0.0001, t + at); g.gain.linearRampToValueAtTime(vel, t + at + 0.006); g.gain.exponentialRampToValueAtTime(0.0002, t + at + dur);
      g.connect(out); car.start(t + at); car.stop(t + at + dur + 0.05); mod.start(t + at); mod.stop(t + at + dur + 0.05); nodes.push(mg, g);
      return car;
    };
    [67, 69, 74, 79].forEach((m, i) => bell(i * 0.13, m, 0.22, 0.5));                           // G4 A4 D5 G5 (pentatonic, over V)
    let last = null;
    [72, 76, 79, 84].forEach((m, i) => { last = bell(0.62 + i * 0.03, m, 0.26, 2.0); });         // C chord
    const pad = x.createGain(); pad.gain.setValueAtTime(0.0001, t + 0.55); pad.gain.linearRampToValueAtTime(0.05, t + 1.0); pad.gain.linearRampToValueAtTime(0.0001, t + 3.0);
    pad.connect(out); nodes.push(pad);
    [48, 55, 60, 64].forEach((m) => { for (const d of [-6, 6]) { const o = x.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = d; o.connect(pad); o.start(t + 0.55); o.stop(t + 3.1); } });
    const b = x.createOscillator(), bg = x.createGain(); b.frequency.value = mtof(36);
    bg.gain.setValueAtTime(0.0001, t + 0.6); bg.gain.linearRampToValueAtTime(0.22, t + 0.65); bg.gain.exponentialRampToValueAtTime(0.0002, t + 2.4);
    b.connect(bg); bg.connect(out); b.start(t + 0.6); b.stop(t + 2.5); nodes.push(bg);
    last.onended = () => { setTimeout(() => { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } } }, 1200); };
  }

  // the soundtrack must never be able to break the game: every public method swallows its own errors
  ['setEnabled', 'setVolume', 'setStage', 'setRush', 'setLow', 'duck', 'duckFor', 'start', 'stop', 'setMode', 'stageUp', 'resultsSting'].forEach((name) => {
    const fn = M[name];
    M[name] = function () { try { return fn.apply(M, arguments); } catch (e) { if (name === 'start' || name === 'setMode') { try { M._reset(); } catch (e2) { /* ignore */ } } } };
  });

  BR.Music = M;
})();
