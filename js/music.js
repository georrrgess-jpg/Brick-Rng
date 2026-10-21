/* Synthesized music: a short arcade loop whose tempo climbs with the stage and doubles down in Rush Mode. */
(function () {
  const BR = (window.BR = window.BR || {});
  const ROOTS = [57, 57, 53, 55];             // A  A  F  G  (midi), one per bar
  const MINOR = [0, 3, 7, 12, 7, 3, 12, 15];  // arpeggio shape
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const M = {
    enabled: true, running: false, stage: 1, rush: false, duckLevel: 1,
    step: 0, nextT: 0, timer: 0, out: null, g: null,

    setEnabled(on) { this.enabled = on; if (!on) this.stop(); },
    setStage(n) { this.stage = n; },
    setRush(on) { this.rush = on; },
    duck(on) { if (this.g) this.g.gain.setTargetAtTime(on ? 0.15 : 1, this.ctx.currentTime, 0.15); },

    start() {
      if (!this.enabled || this.running) return;
      const c = BR.Audio.context();
      if (!c) return;
      this.ctx = c.ctx;
      this.g = this.ctx.createGain(); this.g.gain.value = 1;
      this.out = this.ctx.createGain(); this.out.gain.value = 0.16;
      this.g.connect(this.out); this.out.connect(c.master);
      this.running = true; this.step = 0; this.nextT = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 25);
    },
    stop() {
      if (!this.running) return;
      this.running = false; clearInterval(this.timer);
      try { const o = this.out; o.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); setTimeout(() => { try { o.disconnect(); } catch (e) { /* ignore */ } }, 600); } catch (e) { /* ignore */ }
    },
    get bpm() { return Math.min(158, 104 + this.stage * 4) * (this.rush ? 1.18 : 1); },

    schedule() {
      if (!this.running) return;
      while (this.nextT < this.ctx.currentTime + 0.14) {
        this.play(this.step, this.nextT);
        this.nextT += 60 / this.bpm / 4; // 16th notes
        this.step++;
      }
    },
    note(t, midi, dur, type, vol, dest) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(mtof(midi), t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || this.g); o.start(t); o.stop(t + dur + 0.05);
    },
    play(step, t) {
      const bar = Math.floor(step / 16) % 4, s = step % 16, root = ROOTS[bar];
      // kick on every beat, snare on 2 and 4
      if (s % 4 === 0) { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); o.connect(g); g.connect(this.g); o.start(t); o.stop(t + 0.2); }
      if ((s === 4 || s === 12) && (this.rush || this.stage > 2)) this.hit(t, 0.28, 2500);
      if (s % 2 === 1) this.hit(t, 0.1, 9000);
      // bass: driving 8ths
      if (s % 2 === 0) this.note(t, root - 24 + (s % 8 === 6 ? 7 : 0), 0.18, 'sawtooth', 0.34);
      // arpeggio
      if (s % 2 === 0) this.note(t, root + MINOR[(s / 2) % 8], 0.14, 'triangle', 0.3);
      if (this.rush && s % 2 === 1) this.note(t, root + 12 + MINOR[((s - 1) / 2) % 8], 0.1, 'square', 0.12);
      if (this.stage >= 5 && s === 0) this.note(t, root + 12, 0.6, 'sine', 0.25);
    },
    hit(t, vol, hp) {
      const len = Math.floor(this.ctx.sampleRate * 0.06), buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = this.ctx.createBufferSource(); s.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
      const g = this.ctx.createGain(); g.gain.value = vol;
      s.connect(f); f.connect(g); g.connect(this.g); s.start(t);
    },
  };
  BR.Music = M;
})();
