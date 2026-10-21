/* Synthesized sound effects (Web Audio). No audio files; everything is generated. */
(function () {
  const BR = (window.BR = window.BR || {});
  let ctx = null;
  let master = null;
  let enabled = true;
  let lastTick = 0;
  const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain();
      master.gain.value = 0.55;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      master.connect(comp); comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone({ f = 440, to = null, type = 'sine', dur = 0.15, vol = 0.2, at = 0, attack = 0.006 }) {
    if (!enabled) return;
    const c = ensure(); if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function noise({ dur = 0.2, vol = 0.2, from = 4000, to = 400, at = 0, q = 0.8, type = 'lowpass' }) {
    if (!enabled) return;
    const c = ensure(); if (!c) return;
    const t = c.currentTime + at;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t);
  }

  const A = {
    unlock() { ensure(); },
    setEnabled(v) { enabled = !!v; },
    get enabled() { return enabled; },

    /** Pop pitch climbs with group size so bigger plays literally sound bigger. */
    pop(n, streak, flavor) {
      const i = Math.min(PENTA.length - 1, Math.max(0, n - 2) + Math.min(streak, 3));
      const f = 330 * Math.pow(2, PENTA[i] / 12);
      if (flavor === 'ember') noise({ dur: 0.22, vol: 0.13, from: 3000, to: 300, type: 'bandpass', q: 0.9 });
      else if (flavor === 'petal') tone({ f: f * 2, type: 'sine', dur: 0.5, vol: 0.07, at: 0.02 });
      else if (flavor === 'glass') { tone({ f: 2400 + i * 140, type: 'sine', dur: 0.3, vol: 0.07 }); noise({ dur: 0.12, vol: 0.09, from: 9000, to: 3000, type: 'highpass' }); }
      else if (flavor === 'pixel') [0, 1, 2].forEach((k) => tone({ f: f * (2 + k * 0.5), type: 'square', dur: 0.06, vol: 0.05, at: k * 0.045 }));
      else if (flavor === 'lightning') { noise({ dur: 0.22, vol: 0.14, from: 8000, to: 400, type: 'bandpass', q: 1.4 }); tone({ f: 900, to: 140, type: 'sawtooth', dur: 0.2, vol: 0.05 }); }
      tone({ f: f * 0.96, to: f * 1.08, type: 'triangle', dur: 0.18, vol: 0.24 });
      tone({ f: f * 2, type: 'sine', dur: 0.12, vol: 0.09, at: 0.01 });
      noise({ dur: 0.07, vol: 0.13, from: 6000, to: 900, type: 'highpass' });
      if (n >= 5) tone({ f: f * 1.5, type: 'sine', dur: 0.26, vol: 0.12, at: 0.05 });
      if (n >= 8) tone({ f: f * 2.01, type: 'sine', dur: 0.4, vol: 0.1, at: 0.09 });
    },
    land(strength = 1) { tone({ f: 120, to: 55, type: 'sine', dur: 0.1, vol: 0.12 * Math.min(1, strength) }); },
    deny() { tone({ f: 190, to: 120, type: 'square', dur: 0.13, vol: 0.07 }); tone({ f: 150, to: 95, type: 'square', dur: 0.14, vol: 0.06, at: 0.09 }); },
    combo(level) { tone({ f: 520 * Math.pow(2, Math.min(level, 8) / 12 * 2), type: 'sine', dur: 0.2, vol: 0.11, at: 0.04 }); },
    line() {
      noise({ dur: 0.55, vol: 0.2, from: 500, to: 7000, type: 'bandpass', q: 1.5 });
      [0, 4, 7, 12, 16].forEach((s, i) => tone({ f: 440 * Math.pow(2, s / 12), type: 'triangle', dur: 0.4, vol: 0.14, at: i * 0.05 }));
    },
    shuffle() { noise({ dur: 0.5, vol: 0.15, from: 300, to: 5000, type: 'bandpass', q: 2 }); tone({ f: 300, to: 700, type: 'sine', dur: 0.4, vol: 0.1 }); },
    recolor() { tone({ f: 700, to: 1100, type: 'sine', dur: 0.12, vol: 0.07 }); },
    ui() { tone({ f: 600, to: 760, type: 'sine', dur: 0.07, vol: 0.09 }); },
    start() { [0, 4, 7].forEach((s, i) => tone({ f: 330 * Math.pow(2, s / 12), type: 'triangle', dur: 0.3, vol: 0.14, at: i * 0.07 })); },
    lowFuel() { tone({ f: 880, type: 'square', dur: 0.08, vol: 0.05 }); tone({ f: 880, type: 'square', dur: 0.08, vol: 0.05, at: 0.13 }); },

    // ----- rounds, boosters, progression -----
    roundClear() { [0, 4, 7, 12].forEach((s, i) => tone({ f: 392 * Math.pow(2, s / 12), type: 'triangle', dur: 0.5, vol: 0.15, at: i * 0.09 })); tone({ f: 1568, type: 'sine', dur: 0.8, vol: 0.07, at: 0.4 }); },
    xpTick(i = 0) { tone({ f: 700 + Math.min(i, 10) * 55, type: 'sine', dur: 0.07, vol: 0.07 }); },
    levelUp() { [0, 4, 7, 12, 16, 19].forEach((s, i) => tone({ f: 440 * Math.pow(2, s / 12), type: 'triangle', dur: 0.45, vol: 0.13, at: i * 0.07 })); },
    boosterGain() { [0, 7, 12].forEach((s, i) => tone({ f: 880 * Math.pow(2, s / 12), type: 'sine', dur: 0.2, vol: 0.09, at: i * 0.05 })); },
    boosterArm() { tone({ f: 500, to: 900, type: 'triangle', dur: 0.12, vol: 0.09 }); },
    boosterUse(type) {
      if (type === 'hammer') { tone({ f: 160, to: 40, type: 'sine', dur: 0.4, vol: 0.4 }); noise({ dur: 0.35, vol: 0.25, from: 4000, to: 200 }); }
      else if (type === 'beam') { noise({ dur: 0.5, vol: 0.2, from: 400, to: 8000, type: 'bandpass', q: 1.6 }); tone({ f: 300, to: 1800, type: 'sawtooth', dur: 0.4, vol: 0.08 }); }
      else { [0, 4, 7, 12, 16].forEach((s, i) => tone({ f: 660 * Math.pow(2, s / 12), type: 'sine', dur: 0.35, vol: 0.1, at: i * 0.04 })); noise({ dur: 0.4, vol: 0.12, from: 6000, to: 1500, type: 'highpass' }); }
    },
    shatterBonus() { noise({ dur: 0.7, vol: 0.2, from: 6000, to: 200 }); tone({ f: 200, to: 50, type: 'sine', dur: 0.5, vol: 0.3 }); },
    // Geode opening
    geodeDrop() { tone({ f: 90, to: 40, type: 'sine', dur: 0.4, vol: 0.4, at: 0.3 }); noise({ dur: 0.3, vol: 0.2, from: 1500, to: 100, at: 0.3 }); },
    crack(i) { const k = i + 1; tone({ f: 110 / k, to: 40, type: 'sine', dur: 0.3, vol: 0.35 + k * 0.05 }); noise({ dur: 0.18 + k * 0.05, vol: 0.2 + k * 0.05, from: 7000, to: 600, type: 'highpass' }); tone({ f: 500 * k, to: 900 * k, type: 'triangle', dur: 0.25, vol: 0.06 }); },
    rockShatter() { noise({ dur: 0.9, vol: 0.45, from: 7000, to: 120, q: 0.6 }); tone({ f: 120, to: 32, type: 'sine', dur: 0.8, vol: 0.5 }); },
    // ----- crate (legacy names reused by the Geode reel) -----
    crateDrop() { tone({ f: 110, to: 45, type: 'sine', dur: 0.35, vol: 0.3, at: 0.35 }); noise({ dur: 0.25, vol: 0.18, from: 1200, to: 100, at: 0.35 }); },
    chargeUp(dur = 1) {
      tone({ f: 120, to: 760, type: 'sawtooth', dur, vol: 0.09, attack: 0.1 });
      tone({ f: 240, to: 1520, type: 'sine', dur, vol: 0.1, attack: 0.1 });
      noise({ dur, vol: 0.12, from: 200, to: 6000, type: 'bandpass', q: 1.2 });
    },
    boom() { tone({ f: 140, to: 38, type: 'sine', dur: 0.7, vol: 0.5 }); noise({ dur: 0.6, vol: 0.4, from: 6000, to: 120, q: 0.6 }); },
    tick(speed = 1) {
      if (!enabled) return;
      const c = ensure(); if (!c) return;
      const now = c.currentTime;
      if (now - lastTick < 0.018) return; // never stack ticks into a buzz
      lastTick = now;
      const s = Math.min(1, speed);
      tone({ f: 1500 - s * 500, to: 700, type: 'triangle', dur: 0.045, vol: 0.07 + s * 0.07, attack: 0.002 });
      tone({ f: 3000, type: 'sine', dur: 0.02, vol: 0.03, attack: 0.001 });
    },
    reveal(level) {
      const chords = [
        [0, 7],
        [0, 4, 7, 12],
        [0, 4, 7, 12, 16],
        [0, 4, 7, 12, 16, 19],
        [0, 4, 7, 12, 16, 19, 24, 28],
      ][Math.min(4, Math.max(0, level - 1))];
      chords.forEach((s, i) => {
        const f = 392 * Math.pow(2, s / 12);
        tone({ f, type: 'triangle', dur: 0.9 + level * 0.15, vol: 0.14, at: i * 0.07 });
        tone({ f: f * 2, type: 'sine', dur: 1.1 + level * 0.15, vol: 0.06, at: i * 0.07 });
      });
      if (level >= 3) { tone({ f: 90, to: 40, type: 'sine', dur: 0.9, vol: 0.4 }); noise({ dur: 0.8, vol: 0.22, from: 7000, to: 300, q: 0.5 }); }
      if (level >= 4) noise({ dur: 1.6, vol: 0.1, from: 3000, to: 9000, type: 'highpass', at: 0.1 });
      if (level >= 5) for (let i = 0; i < 10; i++) tone({ f: 1500 + Math.random() * 2500, type: 'sine', dur: 0.25, vol: 0.05, at: 0.2 + i * 0.09 });
    },
    equip() { [0, 7, 12, 19].forEach((s, i) => tone({ f: 330 * Math.pow(2, s / 12), type: 'sawtooth', dur: 0.22, vol: 0.07, at: i * 0.05 })); noise({ dur: 0.3, vol: 0.12, from: 800, to: 6000, type: 'bandpass' }); },
    scrap() { [0, 1, 2].forEach((_, i) => tone({ f: 1318 + i * 330, type: 'square', dur: 0.09, vol: 0.06, at: i * 0.07 })); },
    gameOver() { [7, 3, 0, -5].forEach((s, i) => tone({ f: 392 * Math.pow(2, s / 12), type: 'triangle', dur: 0.5, vol: 0.16, at: i * 0.17 })); },
    newBest() { [0, 4, 7, 12, 16, 19].forEach((s, i) => tone({ f: 523 * Math.pow(2, s / 12), type: 'triangle', dur: 0.4, vol: 0.13, at: 0.5 + i * 0.07 })); },
  };

  BR.Audio = A;
  // Browsers only allow audio after a gesture.
  ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => A.unlock(), { once: true, passive: true }));
})();
