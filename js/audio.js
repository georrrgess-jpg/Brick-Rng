/* Pop Rush sound effects. Everything is synthesized with Web Audio: no audio files, works offline.

   Signal path
     voices -> sfx in (two 7 kHz low-pass stages) -> SFX volume --------\
     music engine (js/music.js) -> music bus (about -9 dB under SFX) ----> master -> compressor -> limiter -> soft clip -> out

   House rules (UPDATE-3 section 12)
     * every pop is a pitched note on the C major pentatonic scale: group size picks the step, the combo streak climbs
       one step per link (a full octave at streak 6), +-3% random detune, three timbres in rotation (bell, pluck, marimba)
     * attack about 3 ms, pop decay under 220 ms, no saw waves, no square waves above 2 kHz, no bright noise
     * only the "big moments" (Line Blast, Rush start/end, stage-up, Last Spark, game over, new best, level up) get a sub
       layer plus a bright layer, each under 1.2 s and within about 3 dB of the loudest pop
     * decorative sounds are rate-limited: a voice budget drops the quietest voice when it is exceeded
   Public names are kept stable for the rest of the game; the music engine shares the same context and buses. */
(function () {
  'use strict';
  const BR = (window.BR = window.BR || {});

  const PENT = [0, 2, 4, 7, 9];                // major pentatonic, semitones above the key note
  const C4 = 261.6256;
  const MUSIC_BASE = 0.355;                    // -9 dB under the SFX bus at the default music volume
  const MUSIC_DEFAULT = 0.7;
  const TOTAL_VOICES = 44;                     // notes alive at once
  const DECO_VOICES = 9;                       // decorative notes alive at once

  let G = null;                                // the graph in use (live context, or an offline one while testing)
  let failedAt = -1e9;
  let enabled = true;
  let sfxVol = 1;
  let musicVol = MUSIC_DEFAULT;
  let keyShift = 0;                            // semitones; the music engine lifts the key during Rush
  let timbreIdx = 0;
  let scope = 1;                               // per-sound level trim while a sound is being built
  let lastTick = -1;
  let rnd = Math.random;
  const popLog = [];
  const tickTimes = [];                        // context times of accepted ticks (for the rate-limit test)
  const stats = { ticks: 0, tickDrops: 0, dropped: 0, pops: 0 };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const noop = () => { };
  /** resume()/suspend() return a promise on modern browsers and nothing on old Safari. */
  function ctxCall(ctx, fn) { try { const p = ctx[fn](); if (p && p.catch) p.catch(noop); } catch (e) { /* ignore */ } }
  const rr = (a, b) => a + rnd() * (b - a);
  function mulberry(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* Calibrated per-sound level trims, measured through the master chain (`node tests/audio.js --calibrate` prints a fresh table to paste here).
     The loudest pop peaks at 0.30 (-10.5 dBFS); big moments at 0.40 (+2.5 dB); everyday ticks well under. */
  const TRIM = {
    pop: 1.08, ui: 1.454, land: 0.769, deny: 1.234, combo: 1.544, line: 1.482, shuffle: 3.088, recolor: 1.409, start: 1.482,
    lowFuel: 1.958, roundClear: 1.429, xpTick: 1, levelUp: 1.668, boosterGain: 1.377, boosterArm: 1.387,
    'boosterUse:hammer': 0.698, 'boosterUse:beam': 2.465, 'boosterUse:prism': 1.345, shatterBonus: 0.932, heartbeat: 1,
    fuseTick: 0.713, timeGain: 1.156, burstFuse: 0.907, defuse: 2.176, rushStart: 1.059, rushEnd: 1.73, stageUp: 1.467,
    lastSpark: 1.42, lastSparkSave: 1.52, fuseOut: 1.142, gameOver: 1.118, newBest: 1.702, go: 1.558, count: 1, coin: 1.367,
    holdTick: 0.632, drum: 1.407, launch: 1.81, crackle: 2.643, thud: 0.79, bang: 0.703, glassBreak: 1, steam: 1.679,
    brickBurst: 0.81, whoosh: 2.9, sting: 1.093, crateDrop: 1.232, chargeUp: 1.852, boom: 0.723, tick: 1, 'reveal:1': 1,
    'reveal:2': 1.155, 'reveal:3': 0.748, 'reveal:4': 0.876, 'reveal:5': 1, equip: 2.717, scrap: 1.204,
  };

  /* ---------- pitch ---------- */
  /** Frequency of scale degree d (0 = C4, 5 = C5, 10 = C6) in the current key. */
  function degFreq(d, key) {
    const k = key == null ? keyShift : key;
    const di = Math.floor(d);
    const oct = Math.floor(di / 5), s = ((di % 5) + 5) % 5;
    return C4 * Math.pow(2, (oct * 12 + PENT[s] + k) / 12);
  }
  /** Scale degree of a pop: group size picks the step, each combo link climbs one more (a full octave at streak 6). */
  function popDegree(n, streak) {
    return 2 + clamp((n | 0) - 2, 0, 6) + clamp((streak | 0) - 1, 0, 5);
  }

  /* ---------- graph ---------- */
  function softClipCurve() {
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
      c[i] = Math.sign(x) * (a < 0.7 ? a : 0.7 + 0.25 * Math.tanh((a - 0.7) / 0.25)); // never above 0.91
    }
    return c;
  }
  function buildGraph(ctx, o) {
    o = o || {};
    const g = { ctx, offline: !!o.offline, log: o.log || null, voices: [], recent: [], noiseBuf: null, unlocked: false };
    const lp1 = ctx.createBiquadFilter(); lp1.type = 'lowpass'; lp1.frequency.value = 7000; lp1.Q.value = 0.54;
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 7000; lp2.Q.value = 1.31;
    g.sfxIn = lp1; lp1.connect(lp2);
    g.sfxVol = ctx.createGain(); g.sfxVol.gain.value = Math.pow(sfxVol, 1.6);
    lp2.connect(g.sfxVol);
    g.music = ctx.createGain(); g.music.gain.value = musicGain(musicVol);
    g.master = ctx.createGain(); g.master.gain.value = 0.58;
    g.sfxVol.connect(g.master); g.music.connect(g.master);
    let tail = g.master;
    if (!o.bypass) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.003; comp.release.value = 0.12;
      const lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -3; lim.knee.value = 1; lim.ratio.value = 20; lim.attack.value = 0.0005; lim.release.value = 0.07;
      tail.connect(comp); comp.connect(lim); tail = lim;
    }
    const clip = ctx.createWaveShaper(); clip.curve = softClipCurve();
    tail.connect(clip); clip.connect(ctx.destination);
    g.clip = clip;
    return g;
  }
  function musicGain(v) { v = clamp(v, 0, 1); return v <= 0 ? 0 : MUSIC_BASE * Math.pow(v / MUSIC_DEFAULT, 1.6); }

  /** The graph, creating the AudioContext on first use. Null when Web Audio is unavailable. */
  function graph() {
    if (G) return G;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (now - failedAt < 3000) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { failedAt = now; return null; }
    let ctx = null;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; } }
    if (!ctx) { failedAt = now; return null; }
    try { G = buildGraph(ctx); } catch (e) { failedAt = now; try { ctx.close(); } catch (e2) { /* ignore */ } return null; }
    try {
      document.addEventListener('visibilitychange', () => {
        if (!G || G.offline) return;
        ctxCall(G.ctx, document.hidden ? 'suspend' : 'resume');
      });
      // a phone call or the lock screen can interrupt the context; the next touch brings it back
      window.addEventListener('pointerdown', () => { if (G && !G.offline && G.ctx.state !== 'running' && !document.hidden) ctxCall(G.ctx, 'resume'); }, { passive: true, capture: true });
    } catch (e) { /* ignore */ }
    return G;
  }
  /** The graph for a sound that should be heard now: only while the context is actually running (or offline). */
  function live() {
    if (!enabled) return null;
    const g = graph(); if (!g) return null;
    if (g.offline) return g;
    if (g.ctx.state !== 'running') { ctxCall(g.ctx, 'resume'); return null; }
    return g;
  }
  function noiseBuffer(g) {
    if (g.noiseBuf) return g.noiseBuf;
    const c = g.ctx, len = Math.floor(c.sampleRate * 2), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let s = 0x1234abcd;
    for (let i = 0; i < len; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; d[i] = ((s >>> 0) / 2147483648) - 1; }
    g.noiseBuf = b;
    return b;
  }

  /* ---------- voices and the voice budget ---------- */
  function admit(g, v) {
    const list = g.voices, now = g.ctx.currentTime;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].t1 < now) list.splice(i, 1);
    const make = (cat, max) => {
      const cur = list.filter((x) => x.t0 <= v.t0 && x.t1 > v.t0 && (cat === 'all' || x.cat === cat));
      if (cur.length < max) return true;
      let q = v;
      for (const x of cur) if (x.vol < q.vol) q = x;          // drop the quietest
      if (q === v) return false;
      try { q.kill(); } catch (e) { /* ignore */ }
      list.splice(list.indexOf(q), 1);
      return true;
    };
    if (v.cat === 'deco' && !make('deco', DECO_VOICES)) { stats.dropped++; return false; }
    if (!make('all', TOTAL_VOICES)) { stats.dropped++; return false; }
    list.push(v);
    return true;
  }
  function finish(g, v, nodes, oscs, endNode) {
    v.kill = () => {
      const now = g.ctx.currentTime;
      try { v.out.gain.cancelScheduledValues(now); v.out.gain.setTargetAtTime(0, now, 0.004); } catch (e) { /* ignore */ }
      for (const o of oscs) { try { o.stop(now + 0.03); } catch (e) { /* ignore */ } }
    };
    endNode.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } } };
  }

  /** One pitched note made of partials. o: f, to, parts [[ratio, amp, dur, type?, toRatio?]], vol, at, attack, lp, q, pan, cat. */
  function note(o) {
    const g = o.g || live(); if (!g) return null;
    const c = g.ctx, t = c.currentTime + (o.at || 0), att = Math.max(0.002, o.attack == null ? 0.004 : o.attack);
    const vol = (o.vol == null ? 0.1 : o.vol) * scope;
    if (!(vol > 1e-4) || !(o.f > 0)) return null;
    const parts = o.parts;
    let end = 0, longest = 0;
    parts.forEach((p, i) => { if (p[2] > end) { end = p[2]; longest = i; } });
    const v = { t0: t, t1: t + end + 0.06, vol, cat: o.cat || 'sfx', kill: null, out: null };
    if (!admit(g, v)) return null;
    const out = c.createGain(); v.out = out;
    const nodes = [out];
    let tail = out;
    if (o.lp) {
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.q || 0.7;
      if (Array.isArray(o.lp)) { f.frequency.setValueAtTime(o.lp[0], t); f.frequency.exponentialRampToValueAtTime(Math.max(80, o.lp[1]), t + (o.lp[2] || end)); } else f.frequency.value = o.lp;
      tail.connect(f); tail = f; nodes.push(f);
    }
    if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); tail.connect(p); tail = p; nodes.push(p); }
    tail.connect(o.dest || g.sfxIn);
    const oscs = [];
    let endOsc = null;
    parts.forEach((p, i) => {
      const ratio = p[0], a = p[1], d = Math.max(p[2], att + 0.012);
      let type = p[3] || o.type || 'sine';
      const top = Math.max(o.f, o.to || 0) * ratio;
      if (type === 'sawtooth') type = 'triangle';                    // no saws in the effects
      if (type === 'square' && top > 1800) type = 'triangle';        // no hard waves up high
      const osc = c.createOscillator(); osc.type = type;
      osc.frequency.setValueAtTime(o.f * ratio, t);
      const to = p[4] ? o.f * p[4] : (o.to ? o.to * ratio : 0);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t + d);
      if (o.detune) osc.detune.value = o.detune;
      const e = c.createGain(), pk = vol * a;
      e.gain.setValueAtTime(0.0001, t);
      e.gain.linearRampToValueAtTime(pk, t + att);
      e.gain.exponentialRampToValueAtTime(Math.max(0.00003, pk * 0.001), t + d);
      osc.connect(e); e.connect(out);
      osc.start(t); osc.stop(t + d + 0.04);
      nodes.push(osc, e);
      if (g.log) g.log.push({ k: 'osc', type, f: o.f * ratio, to, dur: d, attack: att, vol: pk, cat: v.cat });
      if (i === longest) endOsc = osc;
      oscs.push(osc);
    });
    finish(g, v, nodes, oscs, endOsc || oscs[0]);
    return v;
  }

  /** Simple sine/triangle tone, kept for callers that used the old helper. */
  function tone(o) {
    return note({ f: o.f || 440, to: o.to || 0, type: o.type, at: o.at, vol: o.vol, attack: o.attack, lp: o.lp, pan: o.pan, cat: o.cat, parts: [[1, 1, o.dur || 0.15]] });
  }

  /** Filtered noise burst. o: dur, vol, from, to, q, type, at, attack, lp, pan, cat. Noise is always low-passed so it never turns harsh. */
  function noise(o) {
    const g = o.g || live(); if (!g) return null;
    const c = g.ctx, t = c.currentTime + (o.at || 0), dur = Math.max(0.02, o.dur || 0.2);
    const vol = (o.vol == null ? 0.1 : o.vol) * scope;
    if (!(vol > 1e-4)) return null;
    const att = Math.min(dur * 0.8, Math.max(0.002, o.attack == null ? 0.004 : o.attack));
    const v = { t0: t, t1: t + dur + 0.06, vol, cat: o.cat || 'sfx', kill: null, out: null };
    if (!admit(g, v)) return null;
    let type = o.type || 'lowpass';
    if (type === 'highpass') type = 'bandpass';
    const from = Math.min(o.from || 3000, 7000), to = Math.min(o.to || 400, 7000);
    const src = c.createBufferSource(); src.buffer = noiseBuffer(g); src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = o.q == null ? 0.8 : o.q;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, to), t + dur);
    const safe = c.createBiquadFilter(); safe.type = 'lowpass'; safe.frequency.value = o.lp || 5200; safe.Q.value = 0.5;
    const out = c.createGain(); v.out = out;
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(vol, t + att);
    out.gain.exponentialRampToValueAtTime(Math.max(0.00003, vol * 0.001), t + dur);
    src.connect(f); f.connect(safe); safe.connect(out);
    const nodes = [src, f, safe, out];
    let tail = out;
    if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); out.connect(p); tail = p; nodes.push(p); }
    tail.connect(o.dest || g.sfxIn);
    src.start(t, rnd() * 1.6); src.stop(t + dur + 0.04);
    if (g.log) g.log.push({ k: 'noise', type, from, to, dur, vol, cat: v.cat });
    finish(g, v, nodes, [src], src);
    return v;
  }

  /* ---------- building blocks ---------- */
  const high = (f) => Math.min(1, Math.max(0.35, 1.5 - f / 1700));       // fewer upper partials as the pitch climbs
  function bell(f, at, vol, dur, pan, cat) {
    const k = high(f);
    return note({ f, at, vol, attack: 0.004, pan, cat, parts: [[1, 1, dur], [2, 0.26 * k, dur * 0.62], [2.76, 0.1 * k, dur * 0.34]] });
  }
  function marimba(f, at, vol, dur, pan, cat) {
    return note({ f, at, vol, attack: 0.003, pan, cat, parts: [[1, 1, dur], [3.93, 0.2 * high(f), Math.min(0.06, dur * 0.4)], [0.5, 0.2, dur * 0.65]] });
  }
  function pluck(f, at, vol, dur, pan, cat) {
    return note({ f, at, vol, attack: 0.003, pan, cat, type: 'triangle', lp: [Math.min(5200, f * 6), f * 1.6, 0.14], parts: [[1, 1, dur], [2, 0.14, dur * 0.6, 'sine']] });
  }
  /** Round low thump with a little 2nd/3rd harmonic so small phone speakers still carry it. */
  function sub(f0, f1, at, vol, dur) {
    return note({ f: f0, to: f1, at, vol, attack: 0.008, parts: [[1, 1, dur], [2, 0.3, dur * 0.7], [3, 0.12, dur * 0.5]] });
  }
  function swish(at, dur, f0, f1, vol, q, pan) {
    return noise({ dur, vol, from: f0, to: f1, q: q == null ? 1.1 : q, type: 'bandpass', at, attack: dur * 0.38, pan, lp: 4800 });
  }
  function twinkles(at, vol, count, spread, d0, d1) {
    for (let i = 0; i < count; i++) bell(degFreq(Math.floor(rr(d0, d1))), at + i * spread * rr(0.7, 1.3), vol * rr(0.7, 1.1), rr(0.14, 0.24), rr(-0.4, 0.4));
  }
  /** Minimum spacing between calls of a repeating sound, on the audio clock. */
  function gap(name, secs) {
    const g = G; if (!g) return true;
    const last = g.gaps || (g.gaps = {}), now = g.ctx.currentTime;
    if (last[name] != null && now >= last[name] && now - last[name] < secs) return false;
    last[name] = now;
    return true;
  }
  function bigMoment(ms) { try { if (BR.Music && BR.Music.duckFor) BR.Music.duckFor(ms || 650); } catch (e) { /* ignore */ } }

  /* ---------- pops ---------- */
  const POP_VOL = 0.2;

  const TIMBRES = [
    // 0: soft bell (glassy: the upper partials are inharmonic)
    (f, v, pan) => note({ f, vol: v, attack: 0.003, pan, parts: [[1, 1, 0.21], [2, 0.26 * high(f), 0.15], [2.76, 0.22 * high(f), 0.1], [5.4, 0.06 * high(f), 0.04]] }),
    // 1: pluck (a triangle through a low-pass that closes fast: bright for a moment, then round)
    (f, v, pan) => note({ f, vol: v * 1.1, attack: 0.003, pan, type: 'triangle', lp: [Math.min(5200, f * 7), f * 1.2, 0.12], parts: [[1, 1, 0.2], [3, 0.1 * high(f), 0.08, 'sine']] }),
    // 2: marimba (woody: a strong 4th partial that dies at once, a soft octave below, and a tiny mallet tick)
    (f, v, pan) => {
      noise({ dur: 0.014, vol: v * 0.22, from: 1700, to: 800, q: 0.9, type: 'bandpass', attack: 0.002, pan, lp: 2600 });
      return note({ f, vol: v, attack: 0.003, pan, parts: [[1, 1, 0.22], [3.93, 0.3 * high(f), 0.05], [0.5, 0.3, 0.16]] });
    },
  ];

  /** Gentle, distinct texture layered under the pitched note. f = pitch of the pop, v = its level. Everything ends inside 210 ms. */
  const FLAVOR = {
    ember(f, v, n, pan) {
      noise({ dur: 0.18, vol: v * 0.5, from: 1500, to: 420, q: 0.8, type: 'bandpass', attack: 0.006, pan });
      tone({ f: 124, to: 74, dur: 0.12, vol: v * 0.5, attack: 0.004 });
      for (let i = 0; i < 2; i++) noise({ dur: 0.025, vol: v * 0.2, from: 3000, to: 1900, q: 2, type: 'bandpass', at: 0.05 + i * 0.045 + rnd() * 0.03, pan });
    },
    dragonfire(f, v, n, pan) {
      FLAVOR.ember(f, v * 0.9, n, pan);
      note({ f: f * 0.5, to: f * 0.34, type: 'triangle', vol: v * 0.45, attack: 0.008, lp: 520, parts: [[1, 1, 0.2]] });
      noise({ dur: 0.2, vol: v * 0.42, from: 760, to: 260, q: 0.7, type: 'bandpass', attack: 0.015, pan });
    },
    petal(f, v, n, pan) {
      tone({ f: f * 2, to: f * 1.9, dur: 0.2, vol: v * 0.28, attack: 0.008, at: 0.015, pan: -pan });
      noise({ dur: 0.16, vol: v * 0.1, from: 2300, to: 1800, q: 2, type: 'bandpass', attack: 0.03, pan });
    },
    glass(f, v, n, pan) {
      const a = Math.min(3300, f * 3.01), b = Math.min(4200, f * 4.7);
      tone({ f: a, dur: 0.16, vol: v * 0.3, attack: 0.003, pan: -pan });
      tone({ f: b, dur: 0.1, vol: v * 0.16, attack: 0.003, at: 0.012, pan });
      noise({ dur: 0.05, vol: v * 0.12, from: 4300, to: 2800, q: 1.5, type: 'bandpass', attack: 0.002, pan });
    },
    pixel(f, v) {
      [1, 1.26, 1.5].forEach((m, k) => tone({ f: f * m, type: 'square', dur: 0.045, vol: v * 0.2, at: k * 0.035, attack: 0.003 }));
    },
    lightning(f, v, n, pan) {
      noise({ dur: 0.1, vol: v * 0.34, from: 2300, to: 520, q: 1.1, type: 'bandpass', attack: 0.002, pan });
      tone({ f: 1500, to: 240, dur: 0.1, vol: v * 0.24, attack: 0.002, pan: -pan });
    },
    fireworks(f, v, n, pan) {
      tone({ f, to: f * 2, dur: 0.09, vol: v * 0.26, attack: 0.004, pan });
      noise({ dur: 0.1, vol: v * 0.3, from: 1700, to: 500, q: 0.7, type: 'bandpass', at: 0.09, attack: 0.003, pan });
      tone({ f: Math.min(3200, f * 3), dur: 0.1, vol: v * 0.16, at: 0.1, attack: 0.003, pan: -pan });
    },
    confetti(f, v, n, pan) {
      for (let i = 0; i < 5; i++) noise({ dur: 0.02, vol: v * 0.13, from: 2600, to: 3200, q: 2.5, type: 'bandpass', at: i * 0.028 + rnd() * 0.015, attack: 0.002, pan: rr(-0.5, 0.5) });
      noise({ dur: 0.15, vol: v * 0.08, from: 2000, to: 1500, q: 0.8, type: 'bandpass', attack: 0.04, pan });
    },
    bubbles(f, v, n, pan) {
      [0, 0.045, 0.09].forEach((at, k) => {
        const b = f * 0.5 * [1, 1.5, 1.26][k] * rr(0.98, 1.03);
        tone({ f: b, to: b * 1.7, dur: 0.07, vol: v * 0.3, at, attack: 0.004, pan: rr(-0.4, 0.4) });
      });
    },
    coins(f, v, n, pan) {
      tone({ f: Math.min(3000, f * 2), dur: 0.12, vol: v * 0.3, attack: 0.003, pan });
      tone({ f: Math.min(3300, f * 3), dur: 0.12, vol: v * 0.22, at: 0.05, attack: 0.003, pan: -pan });
    },
    leaves(f, v, n, pan) {
      for (let i = 0; i < 3; i++) noise({ dur: 0.05, vol: v * 0.12, from: 3000, to: 2200, q: 0.7, type: 'bandpass', at: i * 0.045, attack: 0.012, pan: rr(-0.4, 0.4) });
      tone({ f: f * 0.5, to: f * 0.42, dur: 0.16, vol: v * 0.2, attack: 0.012, pan });
    },
    neon(f, v, n, pan) {
      note({ f: f * 0.5, to: f, type: 'triangle', vol: v * 0.3, attack: 0.004, lp: 3000, pan, parts: [[1, 1, 0.1]] });
      note({ f: f * 0.5, to: f, type: 'triangle', vol: v * 0.24, attack: 0.004, lp: 3000, pan: -pan, detune: 14, parts: [[1, 1, 0.1]] });
      tone({ f: f * 2, dur: 0.09, vol: v * 0.1, at: 0.02, attack: 0.003 });
    },
    snow(f, v, n, pan) {
      tone({ f: Math.min(2300, degFreq(popDegree(n, 1) + 5)), dur: 0.2, vol: v * 0.2, at: 0.015, attack: 0.006, pan: -pan });
      tone({ f: Math.min(2600, degFreq(popDegree(n, 1) + 7)), dur: 0.16, vol: v * 0.15, at: 0.055, attack: 0.006, pan });
      noise({ dur: 0.08, vol: v * 0.06, from: 4000, to: 3000, q: 3, type: 'bandpass', attack: 0.01, pan });
    },
    thunder(f, v, n, pan) {
      sub(78, 48, 0, v * 0.55, 0.2);
      noise({ dur: 0.22, vol: v * 0.55, from: 420, to: 120, q: 0.7, type: 'lowpass', attack: 0.01, pan });
      noise({ dur: 0.12, vol: v * 0.3, from: 520, to: 140, q: 0.7, type: 'lowpass', at: 0.06, attack: 0.01, pan });
    },
    ink(f, v, n, pan) {
      tone({ f: 540, to: 170, dur: 0.11, vol: v * 0.45, attack: 0.004, pan });
      noise({ dur: 0.08, vol: v * 0.4, from: 1200, to: 320, q: 0.7, type: 'lowpass', attack: 0.003, pan });
    },
    supernova(f, v, n, pan) {
      tone({ f: f * 2, to: f * 3, dur: 0.15, vol: v * 0.26, attack: 0.004, lp: 3600, pan });
      tone({ f: Math.min(3300, f * 4), dur: 0.12, vol: v * 0.1, at: 0.03, attack: 0.004, pan: -pan });
      sub(95, 60, 0, v * 0.45, 0.15);
    },
  };

  /** All the layers of a pop. A burst of pops in one frame drops to the pitched note alone. */
  function popNow(g, n, streak, flavor) {
    const c = g.ctx, now = c.currentTime;
    g.recent = g.recent.filter((t) => now - t < 0.09);
    if (g.recent.length >= 9) return;
    const lite = g.recent.length >= 4;
    g.recent.push(now);
    const deg = popDegree(n, streak);
    const det = 1 + (rnd() * 2 - 1) * 0.03;
    const f = degFreq(deg) * det;
    const timbre = timbreIdx++ % 3;
    const pan = (rnd() * 2 - 1) * 0.22;
    const trim = Math.min(1.12, Math.pow(660 / f, 0.3));
    const v = POP_VOL * trim * (0.9 + 0.1 * clamp((n - 2) / 8, 0, 1)) * (lite ? 0.8 : 1);
    TIMBRES[timbre](f, v, pan);
    stats.pops++;
    popLog.push({ n, streak, flavor: flavor || null, timbre, f, det, deg, lite });
    if (popLog.length > 400) popLog.shift();
    noise({ dur: 0.012, vol: v * 0.25, from: 1900, to: 900, q: 0.8, type: 'bandpass', attack: 0.002, pan, lp: 2800 });
    if (lite) return;
    // bigger groups add chord tones from the same scale
    const hi = high(f);                                       // the higher the pop, the gentler its extra partials
    if (n >= 5) tone({ f: degFreq(deg + 2) * det, dur: 0.17, vol: v * 0.34 * hi, at: 0.02, attack: 0.004, pan: -pan });
    if (n >= 8) tone({ f: Math.min(2800, degFreq(deg + 5) * det), dur: 0.18, vol: v * 0.2 * hi, at: 0.035, attack: 0.004, pan });
    if (n >= 11) sub(88, 58, 0, v * 0.4, 0.13);
    if (streak >= 6) tone({ f: Math.min(2800, f * 2), dur: 0.18, vol: v * 0.16 * hi, at: 0.03, attack: 0.004, pan: -pan });
    const fn = flavor && Object.prototype.hasOwnProperty.call(FLAVOR, flavor) ? FLAVOR[flavor] : null;
    if (fn) fn(f, v, n, pan);
    else if (flavor && A.flavors[flavor]) A.flavors[flavor](f, v, n, pan, { tone, noise, note, rnd, sub });   // Series 4 pop textures, registered from js/s4-pops.js
  }

  /* ---------- the public API ---------- */
  const A = {
    flavors: {},   // BR.Audio.flavors[recipe] = (f, v, n, pan, { tone, noise, note, rnd, sub }) => void; each ends inside 210 ms
    get enabled() { return enabled; },
    get volume() { return sfxVol; },
    get key() { return keyShift; },
  };
  function def(name, fn, o) {
    o = o || {};
    A[name] = function () {
      const g = live(); if (!g) return;
      const prev = scope;
      const v = TRIM[name + ':' + arguments[0]];                     // a few sounds are trimmed per variant (booster type, reveal level)
      scope = A._trimOff ? 1 : (v != null ? v : (TRIM[name] == null ? 1 : TRIM[name]));
      try { if (o.big) bigMoment(o.big === true ? 650 : o.big); fn.apply(null, arguments); } catch (e) { /* audio must never break the game */ } finally { scope = prev; }
    };
  }

  Object.assign(A, {
    /** Unlock audio on the first touch (phones refuse to play before a gesture). */
    unlock() {
      const g = graph(); if (!g || g.offline) return;
      try {
        if (g.ctx.state !== 'running') ctxCall(g.ctx, 'resume');
        if (!g.unlocked) { g.unlocked = true; const b = g.ctx.createBuffer(1, 1, 22050), s = g.ctx.createBufferSource(); s.buffer = b; s.connect(g.ctx.destination); s.start(0); }
      } catch (e) { /* ignore */ }
    },
    /** Shared context and buses (used by the music engine). */
    context() { const g = graph(); return g ? { ctx: g.ctx, master: g.master, music: g.music, sfx: g.sfxIn, offline: g.offline } : null; },
    tone(o) { try { return tone(o || {}); } catch (e) { return null; } },
    noise(o) { try { return noise(o || {}); } catch (e) { return null; } },
    setEnabled(v) { enabled = !!v; },
    /** Effects volume 0..1 (default 1). */
    setVolume(v) {
      sfxVol = clamp(+v || 0, 0, 1);
      if (G && !G.offline) { try { G.sfxVol.gain.setTargetAtTime(Math.pow(sfxVol, 1.6), G.ctx.currentTime, 0.02); } catch (e) { /* ignore */ } }
    },
    /** Music bus level; BR.Music.setVolume calls this. 0.7 is -9 dB under the effects. */
    setMusicVolume(v) {
      musicVol = clamp(+v || 0, 0, 1);
      if (G && !G.offline) { try { G.music.gain.setTargetAtTime(musicGain(musicVol), G.ctx.currentTime, 0.03); } catch (e) { /* ignore */ } }
    },
    /** Key of the pops in semitones above C (the music engine lifts it +2 during Rush). */
    setKey(semi) { keyShift = +semi || 0; },
  });

  /* ----- play ----- */
  /** Pop of n bricks, at combo `streak`, wearing `flavor` (unknown flavors play the classic pop). */
  A.pop = function (n, streak, flavor) {
    const g = live(); if (!g) return;
    const prev = scope; scope = A._trimOff ? 1 : (TRIM.pop == null ? 1 : TRIM.pop);
    try { popNow(g, clamp(Math.round(+n || 3), 2, 14), Math.max(0, Math.floor(+streak || 0)), flavor); } catch (e) { /* audio must never break the game */ } finally { scope = prev; }
  };

  def('land', (s = 1) => { sub(132, 72, 0, 0.1 * clamp(s, 0, 1), 0.08); });
  def('deny', () => {
    note({ f: 330, to: 262, type: 'triangle', vol: 0.12, attack: 0.005, lp: 1500, parts: [[1, 1, 0.1]] });
    note({ f: 262, to: 208, type: 'triangle', vol: 0.12, attack: 0.005, at: 0.085, lp: 1500, parts: [[1, 1, 0.12]] });
  });
  def('combo', (level = 2) => { bell(degFreq(7 + clamp((level | 0) - 2, 0, 5)), 0.04, 0.075, 0.22, rr(-0.3, 0.3), 'deco'); });

  /* ----- big moments: a sub layer and a bright layer, under 1.2 s ----- */
  def('line', () => {
    sub(92, 46, 0, 0.3, 0.3);
    swish(0, 0.42, 500, 3400, 0.1, 1.2);
    [3, 5, 7, 8, 10].forEach((d, i) => bell(degFreq(d), 0.035 + i * 0.05, 0.12, 0.6, (i - 2) * 0.12));
    twinkles(0.22, 0.045, 5, 0.07, 10, 13);
  }, { big: true });
  def('rushStart', () => {
    swish(0, 0.5, 350, 3800, 0.12, 1.1);
    note({ f: 110, to: 330, vol: 0.09, attack: 0.05, lp: 1500, parts: [[1, 1, 0.5], [2, 0.3, 0.45, 'sine']] });
    sub(70, 40, 0.38, 0.34, 0.6);
    [0, 2, 3, 5, 7, 8].forEach((d, i) => bell(degFreq(d + 3), 0.4 + i * 0.03, 0.1, 0.7, (i - 2.5) * 0.14));
    twinkles(0.55, 0.04, 5, 0.06, 10, 13);
  }, { big: 900 });
  def('rushEnd', () => {
    note({ f: 660, to: 220, vol: 0.09, attack: 0.02, lp: 1800, parts: [[1, 1, 0.55], [2, 0.2, 0.4]] });
    noise({ dur: 0.45, vol: 0.07, from: 2600, to: 300, q: 0.7, type: 'bandpass', attack: 0.04 });
    sub(80, 50, 0.1, 0.18, 0.35);
    bell(degFreq(5), 0.32, 0.07, 0.5);
  }, { big: true });
  def('stageUp', () => {
    sub(88, 44, 0, 0.3, 0.45);
    swish(0, 0.4, 700, 3600, 0.09, 1.3);
    [0, 2, 3, 5].forEach((d, i) => bell(degFreq(d + 5), 0.06 + i * 0.075, 0.13, 0.62, (i - 1.5) * 0.15));
    twinkles(0.32, 0.045, 4, 0.07, 11, 14);
  }, { big: true });
  def('lastSpark', () => {
    // a flicker of hope: a little rising glint that hangs on one warm note
    for (let i = 0; i < 4; i++) noise({ dur: 0.03, vol: 0.05, from: 2800, to: 1800, q: 2, type: 'bandpass', at: i * 0.07 + rnd() * 0.02, attack: 0.003, pan: rr(-0.3, 0.3) });
    note({ f: degFreq(5), to: degFreq(10), vol: 0.1, attack: 0.02, lp: 3200, parts: [[1, 1, 0.5], [2, 0.18, 0.4]] });
    bell(degFreq(10), 0.42, 0.12, 0.7);
    bell(degFreq(8), 0.5, 0.08, 0.6, 0.15);
    sub(110, 70, 0.4, 0.2, 0.4);
  }, { big: true });
  def('lastSparkSave', () => {
    // relief: the spark catches, a bright arpeggio and a soft thump
    sub(80, 44, 0, 0.28, 0.45);
    [0, 2, 3, 5, 7, 8, 10].forEach((d, i) => bell(degFreq(d + 3), 0.03 + i * 0.06, 0.11, 0.7, (i - 3) * 0.1));
    swish(0, 0.35, 600, 3000, 0.07, 1.2);
    twinkles(0.4, 0.045, 5, 0.06, 10, 14);
  }, { big: true });
  def('gameOver', () => {
    [8, 7, 5, 3].forEach((d, i) => { marimba(degFreq(d), i * 0.17, 0.15, 0.5, (i - 1.5) * 0.1); bell(degFreq(d - 5), i * 0.17 + 0.02, 0.05, 0.45); });
    sub(60, 42, 0.5, 0.26, 0.65);
    note({ f: 196, to: 150, type: 'triangle', vol: 0.05, at: 0.5, attack: 0.08, lp: 700, parts: [[1, 1, 0.65]] });
  }, { big: true });
  def('newBest', () => {
    sub(90, 48, 0, 0.26, 0.35);
    [0, 2, 3, 5, 7, 8, 10].forEach((d, i) => bell(degFreq(d + 3), 0.03 + i * 0.07, 0.12, 0.6, (i - 3) * 0.1));
    twinkles(0.5, 0.05, 6, 0.06, 10, 14);
  }, { big: true });
  def('levelUp', () => {
    sub(88, 46, 0, 0.26, 0.4);
    [0, 2, 3, 5, 7].forEach((d, i) => bell(degFreq(d + 3), 0.03 + i * 0.075, 0.12, 0.65, (i - 2) * 0.12));
    twinkles(0.4, 0.04, 4, 0.07, 10, 13);
  }, { big: true });

  /* ----- everyday sounds ----- */
  def('shuffle', () => {
    swish(0, 0.45, 300, 3000, 0.1, 1.5);
    note({ f: 300, to: 620, vol: 0.05, attack: 0.04, lp: 1600, parts: [[1, 1, 0.4]] });
  });
  def('recolor', () => { tone({ f: 700, to: 980, dur: 0.08, vol: 0.06, attack: 0.004, cat: 'deco' }); });
  def('ui', () => { note({ f: 620, to: 740, vol: 0.085, attack: 0.003, lp: 3500, parts: [[1, 1, 0.04], [2, 0.18, 0.025]] }); });
  def('start', () => {
    [3, 5, 7].forEach((d, i) => bell(degFreq(d + 2), i * 0.07, 0.11, 0.5, (i - 1) * 0.12));
    sub(100, 60, 0, 0.12, 0.2);
  });
  def('lowFuel', () => {
    if (!gap('lowFuel', 1.2)) return;
    bell(degFreq(7), 0, 0.05, 0.25);
    bell(degFreq(7), 0.13, 0.04, 0.25);
  });
  def('roundClear', () => {
    [3, 5, 7, 8].forEach((d, i) => bell(degFreq(d + 2), i * 0.09, 0.11, 0.6, (i - 1.5) * 0.12));
    twinkles(0.3, 0.04, 3, 0.08, 10, 13);
    sub(100, 62, 0, 0.12, 0.25);
  });
  def('xpTick', (i = 0) => { marimba(degFreq(5 + clamp(i | 0, 0, 9)), 0, 0.075, 0.09, 0, 'deco'); });
  def('boosterGain', () => { [5, 7, 8].forEach((d, i) => bell(degFreq(d + 3), i * 0.055, 0.075, 0.28, (i - 1) * 0.15)); });
  def('boosterArm', () => { note({ f: 500, to: 900, type: 'triangle', vol: 0.07, attack: 0.01, lp: 2400, parts: [[1, 1, 0.12]] }); });
  def('boosterUse', (type) => {
    if (type === 'hammer') {
      sub(150, 46, 0, 0.3, 0.32);
      noise({ dur: 0.25, vol: 0.14, from: 1700, to: 220, q: 0.7, type: 'lowpass', attack: 0.003 });
      marimba(degFreq(8), 0.01, 0.1, 0.25);
    } else if (type === 'beam') {
      swish(0, 0.45, 400, 3500, 0.12, 1.6);
      note({ f: 300, to: 1500, vol: 0.06, attack: 0.05, lp: 2800, parts: [[1, 1, 0.4]] });
      bell(degFreq(10), 0.3, 0.08, 0.4);
    } else {
      [0, 2, 3, 5, 7].forEach((d, i) => bell(degFreq(d + 5), i * 0.045, 0.09, 0.4, (i - 2) * 0.14));
      swish(0, 0.35, 900, 3200, 0.05, 1);
      sub(110, 70, 0, 0.1, 0.2);
    }
  });
  def('shatterBonus', () => {
    noise({ dur: 0.45, vol: 0.12, from: 3600, to: 400, q: 0.7, type: 'bandpass', attack: 0.004 });
    for (let i = 0; i < 6; i++) tone({ f: rr(1700, 3500), dur: 0.16, vol: 0.045, at: i * 0.04, attack: 0.003, pan: rr(-0.5, 0.5) });
    sub(160, 55, 0, 0.22, 0.4);
  });
  def('heartbeat', (level = 1) => {
    if (!gap('heartbeat', 0.5)) return;                      // a heartbeat, not a motor: never closer than half a second
    const l = clamp(+level || 1, 0.2, 2);
    sub(78, 52, 0, 0.17 * l, 0.14);
    sub(70, 46, 0.16, 0.13 * l, 0.15);
  });
  /** One soft tick per second while the fuse is under 10 s (secondsLeft 10..1); pitch climbs as it runs down. Never an alarm. */
  def('fuseTick', (sec = 5) => {
    if (!gap('fuseTick', 0.4)) return;
    const s = clamp(Math.ceil(+sec || 5), 1, 10), d = 5 + clamp(10 - s, 0, 6);
    note({ f: degFreq(d), vol: 0.07 + (10 - s) * 0.004, attack: 0.002, lp: 3500, parts: [[1, 1, 0.05], [2, 0.2, 0.03]] });
    if (s <= 3) sub(84, 56, 0, 0.1, 0.1);
  });
  def('timeGain', (n = 3) => { bell(degFreq(7 + (n % 4)), 0, 0.07, 0.2, 0, 'deco'); });
  def('burstFuse', () => {
    sub(130, 48, 0, 0.26, 0.32);
    noise({ dur: 0.3, vol: 0.16, from: 2200, to: 200, q: 0.6, type: 'lowpass', attack: 0.004 });
    marimba(degFreq(3), 0.02, 0.08, 0.3); marimba(degFreq(1), 0.1, 0.07, 0.3);
  });
  def('defuse', () => { [3, 5, 7, 8].forEach((d, i) => bell(degFreq(d + 3), i * 0.05, 0.075, 0.38, (i - 1.5) * 0.14)); sub(100, 66, 0, 0.08, 0.18); });
  def('fuseOut', () => {
    sub(110, 36, 0, 0.3, 0.7);
    noise({ dur: 0.75, vol: 0.12, from: 2600, to: 120, q: 0.6, type: 'lowpass', attack: 0.01 });
    marimba(degFreq(3), 0.02, 0.09, 0.4); marimba(degFreq(0), 0.14, 0.08, 0.5);
  }, { big: true });
  def('go', () => { bell(degFreq(5), 0, 0.1, 0.16); bell(degFreq(8), 0.11, 0.12, 0.34); });
  def('count', () => { marimba(degFreq(3), 0, 0.1, 0.1, 0, 'deco'); });
  def('coin', (i = 0) => {
    const d = 7 + ((i | 0) % 6);
    bell(degFreq(d), 0, 0.065, 0.13, 0, 'deco');
    bell(degFreq(d + 2), 0.05, 0.045, 0.13, 0, 'deco');
  });

  /* ----- chest rituals ----- */
  def('holdStart', () => { });
  def('holdTick', (p = 0) => {
    p = clamp(+p || 0, 0, 1);
    sub(88 + p * 90, 58 + p * 50, 0, 0.1 + p * 0.1, 0.13);
    marimba(degFreq(Math.floor(p * 8)), 0.015, 0.04 + p * 0.05, 0.1, 0, 'deco');
  });
  def('drum', (n = 6) => { for (let i = 0; i < n; i++) sub(118 - i * 3, 66, i * 0.06, 0.12 + Math.min(i, 8) * 0.008, 0.11); });
  def('launch', () => {
    note({ f: 420, to: 1500, vol: 0.05, attack: 0.03, lp: 3000, parts: [[1, 1, 0.38]] });
    swish(0, 0.4, 900, 3200, 0.05, 1.3);
    sub(110, 70, 0, 0.08, 0.1);
  });
  def('crackle', () => { for (let i = 0; i < 7; i++) noise({ dur: 0.03, vol: 0.06, from: 2800, to: 1800, q: 1.5, type: 'bandpass', at: 0.04 + i * 0.05 + rnd() * 0.03, attack: 0.003, pan: rr(-0.4, 0.4), cat: 'deco' }); });
  def('thud', (p = 1) => { sub(110, 50, 0, 0.22 * p, 0.18); noise({ dur: 0.08, vol: 0.07 * p, from: 900, to: 160, q: 0.7, type: 'lowpass', attack: 0.003 }); });
  def('bang', () => {
    sub(150, 40, 0, 0.3, 0.55);
    noise({ dur: 0.42, vol: 0.18, from: 3000, to: 150, q: 0.6, type: 'lowpass', attack: 0.004 });
    bell(degFreq(10), 0.02, 0.07, 0.4);
  });
  def('glassBreak', () => {
    noise({ dur: 0.34, vol: 0.13, from: 3500, to: 1400, q: 0.8, type: 'bandpass', attack: 0.003 });
    for (let i = 0; i < 6; i++) tone({ f: rr(1600, 3800), dur: 0.18, vol: 0.05, at: i * 0.03, attack: 0.003, pan: rr(-0.5, 0.5) });
    sub(180, 70, 0, 0.14, 0.25);
  });
  def('steam', () => { noise({ dur: 0.85, vol: 0.075, from: 1500, to: 3000, q: 0.8, type: 'bandpass', attack: 0.18 }); });
  def('brickBurst', () => {
    sub(120, 45, 0, 0.26, 0.38);
    noise({ dur: 0.3, vol: 0.16, from: 3200, to: 200, q: 0.6, type: 'lowpass', attack: 0.004 });
    [5, 7, 8].forEach((d, i) => marimba(degFreq(d), 0.03 + i * 0.045, 0.06, 0.16));
  });
  def('whoosh', () => { swish(0, 0.46, 300, 3500, 0.1, 1); });
  def('sting', () => {
    sub(62, 44, 0, 0.22, 1.0);
    [0, 2, 3, 5].forEach((d, i) => bell(degFreq(d), i * 0.04, 0.09, 1.0, (i - 1.5) * 0.14));
    swish(0, 0.8, 400, 2600, 0.05, 0.9);
  });
  def('crateDrop', () => { sub(110, 46, 0.35, 0.22, 0.3); noise({ dur: 0.22, vol: 0.1, from: 1200, to: 140, q: 0.7, type: 'lowpass', at: 0.35, attack: 0.003 }); });
  def('chargeUp', (dur = 1) => {
    dur = clamp(+dur || 1, 0.2, 3);
    note({ f: 140, to: 700, vol: 0.05, attack: 0.1, lp: 2400, parts: [[1, 1, dur], [2, 0.5, dur]] });
    swish(0, dur, 200, 3500, 0.05, 1.2);
  });
  def('boom', () => { sub(130, 38, 0, 0.3, 0.65); noise({ dur: 0.5, vol: 0.2, from: 2600, to: 120, q: 0.6, type: 'lowpass', attack: 0.004 }); });
  A.tick = function (speed) {
    const g = live(); if (!g) return;
    const now = g.ctx.currentTime;
    if (now - lastTick < 0.018 && now >= lastTick) { stats.tickDrops++; return; }   // never stack ticks into a buzz
    lastTick = now; stats.ticks++; if (!g.offline) { tickTimes.push(now); if (tickTimes.length > 64) tickTimes.shift(); }
    const s = clamp(speed == null ? 1 : +speed, 0, 1), prev = scope;
    scope = A._trimOff ? 1 : (TRIM.tick == null ? 1 : TRIM.tick);
    try { note({ f: 1350 - s * 350, to: 720, type: 'triangle', vol: 0.05 + s * 0.045, attack: 0.002, lp: 3600, cat: 'deco', parts: [[1, 1, 0.045], [2, 0.12, 0.025, 'sine']] }); } catch (e) { /* ignore */ } finally { scope = prev; }
  };
  def('reveal', (level = 1) => {
    level = clamp(Math.round(+level || 1), 1, 5);
    const chords = [[0, 3], [0, 2, 3, 5], [0, 2, 3, 5, 7], [0, 2, 3, 5, 7, 8], [0, 2, 3, 5, 7, 8, 10, 12]][level - 1];
    chords.forEach((d, i) => bell(degFreq(d + 3), i * 0.07, 0.1, 0.7 + level * 0.13, (i - chords.length / 2) * 0.1));
    if (level >= 3) { sub(76, 44, 0, 0.26, 0.6); swish(0, 0.5, 500, 3200, 0.07, 1); }
    if (level >= 4) twinkles(0.1, 0.04, 6, 0.1, 10, 14);
    if (level >= 5) twinkles(0.3, 0.05, 8, 0.09, 10, 14);
  });
  def('equip', () => {
    [3, 5, 7, 8].forEach((d, i) => pluck(degFreq(d + 3), i * 0.05, 0.09, 0.22, (i - 1.5) * 0.12));
    swish(0, 0.28, 800, 3000, 0.045, 1);
  });
  def('scrap', () => { [7, 8, 10].forEach((d, i) => marimba(degFreq(d), i * 0.07, 0.07, 0.11, 0, 'deco')); });

  /* ---------- testing support ---------- */
  A._trimOff = false;
  A._trim = TRIM;
  A._seed = (s, timbre) => { rnd = s == null ? Math.random : mulberry(s); timbreIdx = timbre | 0; lastTick = -1; };
  A._popFreq = (n, streak, key) => degFreq(popDegree(clamp(Math.round(+n || 3), 2, 14), Math.max(0, Math.floor(+streak || 0))), key == null ? 0 : key);
  A._popDegree = popDegree;
  A._popLog = popLog;
  A._stats = stats;
  A._tickTimes = tickTimes;
  A._degFreq = degFreq;
  A._flavors = Object.keys(FLAVOR);
  A._graph = () => G;
  /** Render sounds into an OfflineAudioContext instead of the speakers. fn(t, ctx) is called at t = 0 (after opts.lead seconds of
      silence, so the master compressors are warm) and, when opts.step is set, every step seconds while rendering, so look-ahead
      schedulers run exactly as live. Resolves {sr, lead, ch:[Float32Array, Float32Array], log}. */
  A._renderOffline = async function (fn, seconds, opts) {
    opts = opts || {};
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const sr = opts.sr || 44100, lead = opts.lead == null ? 0.25 : opts.lead, len = Math.max(256, Math.ceil((seconds + lead) * sr));
    const off = new OAC(2, len, sr);
    const prev = G, prevScope = scope, prevLast = lastTick;
    const g = buildGraph(off, { offline: true, bypass: !!opts.bypass, log: opts.log ? [] : null });
    G = g; lastTick = -1;
    if (BR.Music && BR.Music._reset) BR.Music._reset();
    let err = null;
    const step = opts.step || 0, total = seconds + lead;
    const call = (t) => { try { fn(t, off); } catch (e) { err = err || e; } };
    try {
      const arm = (t) => {
        if (t >= total - Math.max(step, 0.01) * 0.5) return;
        off.suspend(t).then(() => { call(t - lead); if (step > 0) arm(t + step); off.resume(); });   // register the next stop before resuming, or the render runs past it
      };
      if (lead > 0) arm(lead); else { call(0); if (step > 0) arm(step); }
      const buf = await off.startRendering();
      if (err) throw err;
      return { sr, lead, ch: [buf.getChannelData(0), buf.getChannelData(1)], log: g.log };
    } finally {
      if (BR.Music && BR.Music._reset) BR.Music._reset();
      G = prev; scope = prevScope; lastTick = prevLast;
    }
  };
  A._names = () => Object.keys(A).filter((k) => typeof A[k] === 'function' && k[0] !== '_');

  BR.Audio = A;
  // Browsers only allow audio after a gesture.
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => A.unlock(), { once: true, passive: true }));
})();
