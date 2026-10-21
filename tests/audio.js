// Audio test: renders every sound effect and the soundtrack offline (OfflineAudioContext, through the same buses, compressor and
// soft limiter the game uses) and asserts loudness, clipping, pop shape and spectrum, the pitch rules, and the music rules.
//   node tests/audio.js                 full run (also writes /tmp/pop_rush_music.wav, a 10 minute session; takes a few minutes)
//   node tests/audio.js --quick         skips the 10 minute render and the two-pass self-similarity render
//   node tests/audio.js --calibrate     iterates per-sound level trims against their peak targets and prints the TRIM table
//   node tests/audio.js --skip-pops     dev: skips the big pop matrix
const fs = require('fs');
const path = require('path');
const { launch } = require('./lib');
const QUICK = process.argv.includes('--quick');
const CALIBRATE = process.argv.includes('--calibrate');
const SKIP_POPS = process.argv.includes('--skip-pops');
const NO_MUSIC = process.argv.includes('--no-music');             // dev: only the effects
const WAV_PATH = '/tmp/pop_rush_music.wav';

/* ---------- analysis helpers, loaded into the page ---------- */
const LIB = `(function () {
  const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));
  function peak(c) { let m = 0; for (const a of c) for (let i = 0; i < a.length; i++) { const v = a[i] < 0 ? -a[i] : a[i]; if (v > m) m = v; } return m; }
  function rms(c, i0, i1) { let s = 0, n = 0; for (const a of c) { for (let i = i0; i < i1; i++) s += a[i] * a[i]; n += i1 - i0; } return Math.sqrt(s / Math.max(1, n)); }
  /** Largest RMS over any window of win seconds (hop = win / 4), from second "from" to second "to". */
  function winRmsMax(c, sr, win, from, to) {
    const hop = Math.max(1, Math.round(win * sr / 4)), n = Math.min(c[0].length, to ? Math.round(to * sr) : c[0].length), blocks = [];
    for (let i = Math.round((from || 0) * sr); i + hop <= n; i += hop) { let s = 0; for (const a of c) for (let k = i; k < i + hop; k++) s += a[k] * a[k]; blocks.push(s / (hop * c.length)); }
    let best = 0, at = 0;
    for (let b = 0; b + 4 <= blocks.length; b++) { const m = (blocks[b] + blocks[b + 1] + blocks[b + 2] + blocks[b + 3]) / 4; if (m > best) { best = m; at = b; } }
    winRmsMax.at = (from || 0) + at * hop / sr;
    return Math.sqrt(best);
  }
  /** Seconds until the last sample louder than relDb under the sound's own peak. */
  function tailTime(c, sr, relDb) {
    const thr = peak(c) * Math.pow(10, relDb / 20); let last = 0;
    for (const a of c) for (let i = a.length - 1; i >= last; i--) if (Math.abs(a[i]) > thr) { last = i; break; }
    return last / sr;
  }
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
    }
  }
  function spectrum(c, sr, t0, t1, pad) {
    const i0 = Math.max(0, Math.round(t0 * sr)), i1 = Math.min(c[0].length, Math.round(t1 * sr)), len = i1 - i0;
    let n = 1; while (n < len * (pad || 1)) n <<= 1;
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < len; i++) { let s = 0; for (const a of c) s += a[i0 + i]; re[i] = (s / c.length) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / Math.max(1, len - 1))); }
    fft(re, im);
    const mag = new Float64Array(n / 2); for (let i = 0; i < n / 2; i++) mag[i] = re[i] * re[i] + im[i] * im[i];
    return { mag, binHz: sr / n };
  }
  /** Share of spectral energy above hz (DC excluded). */
  function hfShare(c, sr, hz) {
    const s = spectrum(c, sr, 0, c[0].length / sr, 1), k = Math.round(hz / s.binHz); let tot = 0, hi = 0;
    for (let i = 2; i < s.mag.length; i++) { tot += s.mag[i]; if (i >= k) hi += s.mag[i]; }
    return tot > 0 ? hi / tot : 0;
  }
  function centroid(c, sr, t0, t1) {
    const s = spectrum(c, sr, t0 || 0, t1 || c[0].length / sr, 1); let tot = 0, w = 0;
    for (let i = 2; i < s.mag.length; i++) { tot += s.mag[i]; w += s.mag[i] * i * s.binHz; }
    return tot > 0 ? w / tot : 0;
  }
  /** Strongest spectral peak between lo and hi Hz in the window, parabolic interpolation. */
  function fundamental(c, sr, t0, t1, lo, hi) {
    const s = spectrum(c, sr, t0, t1, 8), a = Math.floor(lo / s.binHz), b = Math.ceil(hi / s.binHz); let best = a;
    for (let i = a; i <= b; i++) if (s.mag[i] > s.mag[best]) best = i;
    const l = Math.log(s.mag[best - 1] + 1e-30), m = Math.log(s.mag[best] + 1e-30), r = Math.log(s.mag[best + 1] + 1e-30);
    const d = 0.5 * (l - r) / (l - 2 * m + r);
    return (best + (isFinite(d) ? d : 0)) * s.binHz;
  }
  /** Spans of digital silence (every sample under thr) longer than minSec between second "from" and second "to". */
  function silences(c, sr, thr, minSec, from, to) {
    const n = c[0].length, out = []; let start = -1;
    const e0 = Math.round(from * sr), e1 = Math.min(n, Math.round(to * sr));
    for (let i = e0; i < e1; i++) {
      let quiet = true; for (const a of c) if (a[i] > thr || a[i] < -thr) { quiet = false; break; }
      if (quiet) { if (start < 0) start = i; } else if (start >= 0) { if ((i - start) / sr > minSec) out.push([start / sr, (i - start) / sr]); start = -1; }
    }
    if (start >= 0 && (e1 - start) / sr > minSec) out.push([start / sr, (e1 - start) / sr]);
    return out;
  }
  /** Largest jump between neighbouring samples: a click or a step shows up here, smooth audio does not. */
  function maxStep(c, i0, i1) { let m = 0; for (const a of c) for (let i = Math.max(1, i0); i < i1; i++) { const d = Math.abs(a[i] - a[i - 1]); if (d > m) m = d; } return m; }
  function countOver(c, thr) { let n = 0; for (const a of c) for (let i = 0; i < a.length; i++) if (a[i] > thr || a[i] < -thr) n++; return n; }
  function wavSlice(c, i0, i1) {
    const n = i1 - i0, buf = new Int16Array(n * 2);
    for (let i = 0; i < n; i++) { for (let k = 0; k < 2; k++) { const v = Math.max(-1, Math.min(1, c[k][i0 + i])); buf[i * 2 + k] = Math.round(v * 32767); } }
    const bytes = new Uint8Array(buf.buffer); let s = '';
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(s);
  }
  const cut = (r) => r.ch.map((a) => a.subarray(Math.round(r.lead * r.sr)));
  return { cut, db, peak, rms, winRmsMax, tailTime, fft, spectrum, hfShare, centroid, fundamental, silences, maxStep, countOver, wavSlice };
})()`;

/* ---------- test drivers that run inside the page ---------- */
function pageSide() {
  const A = BR.Audio, Mu = BR.Music;
  window.AT = {
    /** One sound effect through the master chain (or raw), 2.4 s. */
    async sfx(name, args, bypass) {
      A._seed(11); A.setEnabled(true); A._trimOff = !!bypass;
      const r = await A._renderOffline(() => { A[name](...args); }, 2.4, { sr: 44100, bypass: !!bypass });
      A._trimOff = false;
      const c = AN.cut(r), sr = r.sr, pk = AN.peak(c);
      return { peak: pk, rms: AN.rms(c, 0, Math.round(sr * 2.4)), rms50: AN.winRmsMax(c, sr, 0.05), dur50: AN.tailTime(c, sr, -50), hf: AN.hfShare(c, sr, 7000), nan: c.some((a) => a.some((x) => !isFinite(x))) };
    },
    /** One pop; also returns the oscillator log so the attack and wave-type rules can be checked. */
    async pop(n, streak, flavor, timbre, seed, keepAudio) {
      A._seed(seed, timbre); A.setEnabled(true);
      const r = await A._renderOffline(() => { A.pop(n, streak, flavor); }, 0.55, { sr: 44100, log: true });
      const c = AN.cut(r), sr = r.sr, pk = AN.peak(c);
      const osc = r.log.filter((o) => o.k === 'osc');
      const bad = osc.filter((o) => (o.type === 'square' && Math.max(o.f, o.to || 0) > 2000) || o.type === 'sawtooth');
      const out = {
        peak: pk, rms50: AN.winRmsMax(c, sr, 0.05), dur50: AN.tailTime(c, sr, -50), hf: AN.hfShare(c, sr, 7000), bad: bad.length,
        atkMin: Math.min(...osc.map((o) => o.attack)), atkMax: Math.max(...osc.map((o) => o.attack)), longest: Math.max(...osc.map((o) => o.dur)),
        nan: c.some((a) => a.some((x) => !isFinite(x))), centroid: AN.centroid(c, sr, 0, 0.2),
      };
      if (keepAudio) out.samples = Array.from(c[0].subarray(0, Math.round(sr * 0.5)));
      return out;
    },
    async popPitch(n, streak, timbre, seed) {
      A._seed(seed, timbre); A.setEnabled(true);
      const f = A._popFreq(n, streak);
      const r = await A._renderOffline(() => { A.pop(n, streak, null); }, 0.45, { sr: 44100 });
      const c = AN.cut(r);
      const est = AN.fundamental(c, r.sr, 0.004, 0.14, f * 0.78, f * 1.28);
      return { f, est, det: A._popLog[A._popLog.length - 1].det };
    },
    /** A music scene: script = [{at, op, arg}] applied at the first scheduler step at or after `at` seconds. */
    async music(o) {
      Mu.setSeed(o.seed == null ? 42 : o.seed); Mu._log = o.log ? [] : null; Mu.setEnabled(true);
      Mu.setStage(1); Mu.setRush(false); Mu.setLow(false); Mu.setVolume(0.7); Mu.duck(false);
      const script = o.script.map((e) => Object.assign({}, e));
      let debug = null;
      const r = await A._renderOffline((t, off) => {
        for (const e of script) {
          if (e.done || t < e.at - 1e-6) continue;
          e.done = true; e.ctxT = off.currentTime;
          if (e.op === 'start') Mu.start(e.arg); else if (e.op === 'stop') Mu.stop(); else if (e.op === 'mode') Mu.setMode(e.arg);
          else if (e.op === 'stage') Mu.setStage(e.arg); else if (e.op === 'rush') Mu.setRush(e.arg); else if (e.op === 'low') Mu.setLow(e.arg);
          else if (e.op === 'stageUp') Mu.stageUp(); else if (e.op === 'sting') Mu.resultsSting(); else if (e.op === 'duck') Mu.duck(e.arg);
        }
        Mu.pump(o.ahead || 0.6);
        debug = Mu._debug();
      }, o.secs, { sr: o.sr || 32000, step: o.step || 0.25 });
      const c = AN.cut(r), sr = r.sr, n = c[0].length;
      const log = Mu._log; Mu._log = null;
      const stopAt = script.filter((e) => e.op === 'stop').map((e) => e.at)[0];
      const endCheck = stopAt != null ? stopAt - 0.3 : o.secs - 0.2;
      const res = {
        sr, lead: r.lead, peak: AN.peak(c), nan: c.some((a) => a.some((x) => !isFinite(x))), over98: AN.countOver(c, 0.98),
        rms: AN.rms(c, Math.round(4 * sr), Math.round(endCheck * sr)), rms1s: AN.winRmsMax(c, sr, 1, 4, endCheck), rms1sAt: 0,
        sil: AN.silences(c, sr, 1e-4, 0.3, 1.0, endCheck), maxStep: AN.maxStep(c, 0, n),
        tail: stopAt != null && !o.noTail ? AN.peak(c.map((a) => a.subarray(Math.round((stopAt + 3) * sr), Math.round((stopAt + 3.8) * sr)))) : null,
        script, log, debug,
      };
      res.rms1sAt = AN.winRmsMax.at;
      if (o.keep) window.__kept = { c, sr, lead: r.lead };
      return res;
    },
    /** Two back-to-back passes of the run piece: how many bars of the second are copies of the first. */
    async similarity(o) {
      Mu.setSeed(o.seed); Mu._log = null; Mu.setEnabled(true); Mu.setStage(4); Mu.setRush(false); Mu.setLow(false);
      const barDur = 4 * 60 / 110, passBars = 56, secs = barDur * passBars * 2 + 6;
      const r = await A._renderOffline((t) => { if (t === 0) Mu.start('run'); Mu.pump(0.6); }, secs, { sr: o.sr, step: 0.25 });
      const c = AN.cut(r), sr = r.sr, n = c[0].length, mono = new Float32Array(n);
      for (let i = 0; i < n; i++) mono[i] = (c[0][i] + c[1][i]) * 0.5;
      const corr = (a0, b0, len) => { let ab = 0, aa = 0, bb = 0; for (let i = 0; i < len; i++) { const x = mono[a0 + i], y = mono[b0 + i]; ab += x * y; aa += x * x; bb += y * y; } return ab / Math.sqrt(aa * bb + 1e-30); };
      const t0 = 0.06, len = Math.round(barDur * sr), cs = [];
      for (let k = 2; k < passBars; k++) cs.push(corr(Math.round((t0 + k * barDur) * sr), Math.round((t0 + (k + passBars) * barDur) * sr), len));
      const whole = corr(Math.round(t0 * sr), Math.round((t0 + passBars * barDur) * sr), Math.round(passBars * barDur * sr));
      return { whole, bars: cs.length, copies: cs.filter((v) => v > 0.95).length, meanCorr: cs.reduce((s, v) => s + v, 0) / cs.length, peak: AN.peak(c) };
    },
    keptStats() { const k = window.__kept; return { sec: k.c[0].length / k.sr, sr: k.sr }; },
    keptWav(i0, i1) { return AN.wavSlice(window.__kept.c, i0, i1); },
    keptMinutes() {
      const k = window.__kept, out = [];
      for (let m = 0; m * 60 < k.c[0].length / k.sr; m++) {
        const a = Math.round(m * 60 * k.sr), b = Math.min(k.c[0].length, Math.round((m + 1) * 60 * k.sr));
        out.push({ rms: AN.rms(k.c, a, b), peak: AN.peak(k.c.map((x) => x.subarray(a, b))) });
      }
      return out;
    },
  };
}

/* ---------- reporting ---------- */
let failures = 0;
function check(ok, msg) { if (!ok) { failures++; console.log('  FAIL', msg); } }
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const dbs = (x) => (x > 0 ? 20 * Math.log10(x) : -99);
function table(rows, cols) {
  const w = cols.map((c, i) => Math.max(c.length, ...rows.map((r) => String(r[i]).length)));
  console.log(cols.map((c, i) => (i === 0 ? c.padEnd(w[i]) : c.padStart(w[i]))).join('  '));
  rows.forEach((r) => console.log(r.map((v, i) => (i === 0 ? String(v).padEnd(w[i]) : String(v).padStart(w[i]))).join('  ')));
}
const PENT = [0, 2, 4, 7, 9];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const pc = (m) => ((m % 12) + 12) % 12;
const CHORD_PCS = [[0, 4, 7], [7, 11, 2], [9, 0, 4], [5, 9, 0]];       // C, G, Am, F
const ROOT_PC = [0, 7, 9, 5];

/* ---------- the test ---------- */
(async () => {
  const t0 = Date.now();
  const { browser, page, errors } = await launch({ width: 390, height: 844 });
  await page.addScriptTag({ content: 'window.AN = ' + LIB });
  await page.addScriptTag({ content: '(' + pageSide.toString() + ')()' });

  /* ================= 0. the public API the game calls ================= */
  console.log('== API ==');
  const src = fs.readdirSync(path.join(__dirname, '..', 'js')).filter((f) => f.endsWith('.js') && f !== 'audio.js' && f !== 'music.js')
    .map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n');
  const used = (re) => [...new Set([...src.matchAll(re)].map((m) => m[1]))];
  const api = await page.evaluate(() => ({ audio: Object.keys(BR.Audio), music: Object.keys(BR.Music), aType: Object.fromEntries(Object.keys(BR.Audio).map((k) => [k, typeof BR.Audio[k]])), mType: Object.fromEntries(Object.keys(BR.Music).map((k) => [k, typeof BR.Music[k]])) }));
  for (const n of used(/BR\.(?:audio|Audio)\.(\w+)/g)) check(api.audio.includes(n), 'game calls BR.audio.' + n + ' but it does not exist');
  for (const n of used(/BR\.Music\.(\w+)/g)) check(api.music.includes(n), 'game calls BR.Music.' + n + ' but it does not exist');
  for (const n of ['pop', 'lastSpark', 'lastSparkSave', 'fuseTick', 'setVolume', 'setKey', 'ui', 'tick']) check(api.aType[n] === 'function', 'BR.audio.' + n + ' should be a function');
  for (const n of ['start', 'stop', 'setMode', 'setStage', 'setLow', 'setRush', 'stageUp', 'resultsSting', 'duck', 'setEnabled', 'setVolume']) check(api.mType[n] === 'function', 'BR.Music.' + n + ' should be a function');
  const names = await page.evaluate(() => BR.Audio._names());
  console.log('BR.audio:', names.join(' '));
  console.log('BR.Music:', Object.keys(api.mType).filter((k) => !k.startsWith('_') && api.mType[k] === 'function').join(' '));

  /* ================= 1. pops ================= */
  const FLAVORS = [null, 'ember', 'petal', 'glass', 'pixel', 'lightning', 'fireworks', 'confetti', 'bubbles', 'coins', 'leaves', 'neon', 'snow', 'thunder', 'ink', 'supernova', 'dragonfire', 'no-such-flavor'];
  console.log('\n== Pops: every flavor x group size 2..14 x 3 timbres (max over the grid) ==');
  const popAgg = { peak: 0, rms50: 0, dur: 0, hf: 0, worstDur: '', worstHf: '' };
  const popRows = [];
  if (SKIP_POPS) { popAgg.peak = 0.3; popAgg.rms50 = 0.1; }
  for (const flavor of (SKIP_POPS ? [] : FLAVORS)) {
    let fp = 0, fr = 0, fd = 0, fh = 0;
    for (let n = 2; n <= 14; n++) {
      for (let timbre = 0; timbre < 3; timbre++) {
        const streak = n % 3 === 0 ? 7 : 1;
        const r = await page.evaluate((a) => AT.pop(a.n, a.streak, a.flavor, a.timbre, 100 + a.n * 7 + a.timbre), { n, streak, flavor, timbre });
        const tag = (flavor || 'classic') + ' n=' + n + ' timbre=' + timbre;
        check(!r.nan, 'NaN samples in pop ' + tag);
        check(r.peak <= 0.98, 'pop clips ' + tag + ' peak ' + r.peak.toFixed(3));
        check(r.dur50 <= 0.25, 'pop longer than 250 ms (' + f1(r.dur50 * 1000) + ' ms) ' + tag);
        check(r.hf <= 0.03, 'pop has ' + f1(r.hf * 100) + '% of energy above 7 kHz ' + tag);
        check(r.bad === 0, 'pop uses a saw or a square above 2 kHz ' + tag);
        check(r.atkMin >= 0.002 && r.atkMax <= 0.012, 'pop attack out of range ' + tag + ' ' + r.atkMin + '..' + r.atkMax);
        check(r.longest <= 0.23, 'pop decay ' + f1(r.longest * 1000) + ' ms is over 230 ms ' + tag);
        fp = Math.max(fp, r.peak); fr = Math.max(fr, r.rms50); fd = Math.max(fd, r.dur50); fh = Math.max(fh, r.hf);
        if (r.dur50 > popAgg.dur) { popAgg.dur = r.dur50; popAgg.worstDur = tag; }
        if (r.hf > popAgg.hf) { popAgg.hf = r.hf; popAgg.worstHf = tag; }
      }
    }
    popAgg.peak = Math.max(popAgg.peak, fp); popAgg.rms50 = Math.max(popAgg.rms50, fr);
    popRows.push([flavor || 'classic', f1(dbs(fp)), f1(dbs(fr)), f1(fd * 1000), f1(fh * 100) + '%']);
  }
  if (popRows.length) table(popRows, ['pop flavor', 'peak dBFS', 'rms50 dBFS', 'ms to -50dB', '>7kHz']);
  console.log('loudest pop: peak ' + popAgg.peak.toFixed(3) + ' (' + f1(dbs(popAgg.peak)) + ' dBFS), rms over 50 ms ' + f1(dbs(popAgg.rms50)) + ' dBFS; longest ' + f1(popAgg.dur * 1000) + ' ms (' + popAgg.worstDur + '); most energy above 7 kHz ' + f1(popAgg.hf * 100) + '% (' + popAgg.worstHf + ')');
  check(popAgg.peak <= 0.35 && popAgg.peak >= 0.2, 'loudest pop peak ' + popAgg.peak.toFixed(3) + ' is outside 0.2..0.35');

  /* ================= 2. the rest of the effects ================= */
  // [name, args, max seconds to -50 dB under its own peak, class]
  const SFX = [
    ['ui', [], 0.07, 'small'], ['land', [1], 0.2, 'small'], ['deny', [], 0.35, 'small'], ['combo', [3], 0.4, 'small'], ['combo', [8], 0.4, 'small'],
    ['line', [], 1.2, 'big'], ['shuffle', [], 0.9, 'mid'], ['recolor', [], 0.2, 'small'], ['start', [], 1.0, 'mid'], ['lowFuel', [], 0.5, 'small'],
    ['roundClear', [], 1.1, 'mid'], ['xpTick', [0], 0.2, 'small'], ['xpTick', [9], 0.2, 'small'], ['levelUp', [], 1.2, 'big'],
    ['boosterGain', [], 0.6, 'small'], ['boosterArm', [], 0.3, 'small'], ['boosterUse', ['hammer'], 0.7, 'mid'], ['boosterUse', ['beam'], 0.9, 'mid'], ['boosterUse', ['prism'], 0.8, 'mid'],
    ['shatterBonus', [], 0.8, 'mid'], ['heartbeat', [1], 0.5, 'small'], ['fuseTick', [10], 0.2, 'small'], ['fuseTick', [3], 0.3, 'small'], ['fuseTick', [1], 0.3, 'small'],
    ['timeGain', [3], 0.4, 'small'], ['burstFuse', [], 0.7, 'mid'], ['defuse', [], 0.7, 'mid'],
    ['rushStart', [], 1.2, 'big'], ['rushEnd', [], 1.0, 'big'], ['stageUp', [], 1.2, 'big'], ['lastSpark', [], 1.2, 'big'], ['lastSparkSave', [], 1.2, 'big'],
    ['fuseOut', [], 1.2, 'big'], ['gameOver', [], 1.2, 'big'], ['newBest', [], 1.2, 'big'],
    ['go', [], 0.6, 'small'], ['count', [], 0.25, 'small'], ['coin', [0], 0.3, 'small'], ['coin', [5], 0.3, 'small'],
    ['holdStart', [], 0.1, 'small'], ['holdTick', [0], 0.3, 'small'], ['holdTick', [0.5], 0.3, 'small'], ['holdTick', [1], 0.3, 'small'], ['drum', [6], 0.7, 'mid'],
    ['launch', [], 0.7, 'mid'], ['crackle', [], 0.6, 'small'], ['thud', [1.2], 0.45, 'mid'], ['bang', [], 1.0, 'mid'], ['glassBreak', [], 0.8, 'mid'],
    ['steam', [], 1.1, 'small'], ['brickBurst', [], 0.7, 'mid'], ['whoosh', [], 0.7, 'small'], ['sting', [], 1.4, 'mid'], ['crateDrop', [], 0.9, 'mid'],
    ['chargeUp', [1], 1.2, 'small'], ['boom', [], 1.0, 'mid'], ['tick', [1], 0.075, 'small'], ['tick', [0], 0.075, 'small'],
    ['reveal', [1], 1.1, 'mid'], ['reveal', [2], 1.3, 'mid'], ['reveal', [3], 1.4, 'mid'], ['reveal', [4], 1.6, 'mid'], ['reveal', [5], 1.8, 'mid'],
    ['equip', [], 0.6, 'mid'], ['scrap', [], 0.4, 'small'],
  ];
  const covered = new Set(SFX.map((s) => s[0]));
  const notSounds = new Set(['unlock', 'context', 'tone', 'noise', 'setEnabled', 'setVolume', 'setMusicVolume', 'setKey', 'pop']);
  for (const n of names) if (!notSounds.has(n)) check(covered.has(n), 'sound effect "' + n + '" is not covered by the test list');

  console.log('\n== Sound effects (through the master chain) ==');
  const rows = [], sfxRes = [];
  for (const [name, args, maxDur, cls] of SFX) {
    const r = await page.evaluate((a) => AT.sfx(a.name, a.args, false), { name, args });
    const label = name + (args.length ? '(' + args.join(',') + ')' : '');
    sfxRes.push({ name, label, cls, r });
    rows.push([label, cls, r.peak.toFixed(3), f1(dbs(r.peak)), f1(dbs(r.rms)), f1(dbs(r.rms50)), f1(r.dur50 * 1000), f1(r.hf * 100) + '%']);
    check(!r.nan, 'NaN samples in ' + label);
    check(r.peak <= 0.98, label + ' clips: peak ' + r.peak.toFixed(3));
    if (name !== 'holdStart') check(r.peak > 0.02, label + ' is nearly silent (peak ' + r.peak.toFixed(4) + ')');
    check(r.dur50 <= maxDur, label + ' lasts ' + f1(r.dur50 * 1000) + ' ms, over its limit of ' + maxDur * 1000 + ' ms');
    if (cls === 'big') check(r.dur50 <= 1.2, label + ' is a big moment and must stay under 1.2 s');
  }
  table(rows, ['sound', 'class', 'peak', 'dBFS', 'rms dB', 'rms50 dB', 'ms to -50dB', '>7kHz']);
  let loudest = { label: '', peak: 0 };
  for (const s of sfxRes) {
    if (s.r.peak > loudest.peak) loudest = { label: s.label, peak: s.r.peak };
    const rel = dbs(s.r.peak) - dbs(popAgg.peak);
    if (s.cls === 'big') check(rel <= 3.2, s.label + ' is ' + f1(rel) + ' dB above the loudest pop (limit about 3 dB for a big moment)');
    check(rel <= 6, s.label + ' is ' + f1(rel) + ' dB above the loudest pop (limit 6 dB)');
    if (['ui', 'tick', 'xpTick', 'coin', 'fuseTick', 'count', 'land', 'recolor', 'combo'].includes(s.name)) check(rel <= -6, s.label + ' (an everyday tick) should sit at least 6 dB under the loudest pop, is ' + f1(rel) + ' dB');
  }
  console.log('loudest effect: ' + loudest.label + ' ' + f1(dbs(loudest.peak)) + ' dBFS = ' + f1(dbs(loudest.peak) - dbs(popAgg.peak)) + ' dB vs the loudest pop');

  /* ================= 3. pitch rules ================= */
  console.log('\n== Pitch rules ==');
  const fr = await page.evaluate(() => {
    const A = BR.Audio, out = { grid: [], keyed: [] };
    for (let n = 2; n <= 14; n++) { const row = []; for (let s = 0; s <= 9; s++) row.push(A._popFreq(n, s)); out.grid.push(row); out.keyed.push([A._popFreq(n, 1, 2), A._popFreq(n, 6, 2)]); }
    return out;
  });
  const semis = (f, key) => 12 * Math.log2(f / 261.6256) - (key || 0);
  fr.grid.forEach((row, ni) => {
    const n = ni + 2;
    row.forEach((f, s) => { const st = semis(f); check(PENT.includes(((Math.round(st) % 12) + 12) % 12) && Math.abs(st - Math.round(st)) < 0.01, 'pop n=' + n + ' streak=' + s + ' is not on the C major pentatonic scale (' + st.toFixed(2) + ' semitones)'); });
    for (let s = 2; s <= 9; s++) check(row[s] >= row[s - 1] - 1e-6, 'pop n=' + n + ': combo streak ' + s + ' is lower than ' + (s - 1));
    check(Math.abs(row[6] / row[1] - 2) < 0.001, 'pop n=' + n + ': streak 6 should be exactly an octave above streak 1 (ratio ' + (row[6] / row[1]).toFixed(4) + ')');
    check(row[9] === row[6], 'pop n=' + n + ': the climb should stop at the octave (streak 9 vs 6)');
    check(row[0] === row[1], 'pop n=' + n + ': streak 0 and 1 are the same step');
    if (ni > 0) check(fr.grid[ni][1] >= fr.grid[ni - 1][1], 'pop pitch should not fall as the group grows (n=' + n + ')');
  });
  check(fr.grid[12][1] > fr.grid[0][1] * 1.9, 'a 14-brick pop should be at least ~an octave above a 2-brick pop');
  fr.keyed.forEach((k, ni) => { const st = semis(k[0], 2); check(PENT.includes(((Math.round(st) % 12) + 12) % 12), 'in the Rush key (+2) pop n=' + (ni + 2) + ' is not on the lifted pentatonic scale'); });
  check(Math.max(...fr.grid.flat()) <= 1600, 'the highest pop pitch ' + Math.round(Math.max(...fr.grid.flat())) + ' Hz is above 1.6 kHz');
  console.log('pop pitch range ' + Math.round(Math.min(...fr.grid.flat())) + ' to ' + Math.round(Math.max(...fr.grid.flat())) + ' Hz; streak 6 = one octave above streak 1; every note is on the pentatonic scale (also +2 in Rush)');

  // the rendered pitch agrees with the mapping, within the +-3% detune and the estimator
  let worst = 0;
  for (const n of [2, 3, 5, 8, 11, 14]) for (const s of [1, 3, 6]) {
    const r = await page.evaluate((a) => AT.popPitch(a.n, a.s, (a.n + a.s) % 3, 500 + a.n * 3 + a.s), { n, s });
    const ratio = r.est / r.f; worst = Math.max(worst, Math.abs(ratio - 1));
    check(Math.abs(ratio - 1) <= 0.045, 'rendered pop n=' + n + ' streak=' + s + ' measures ' + Math.round(r.est) + ' Hz, expected ' + Math.round(r.f) + ' Hz +-3% (off by ' + f1((ratio - 1) * 100) + '%)');
    check(Math.abs(r.det - 1) <= 0.0301, 'detune ' + r.det + ' is outside +-3%');
  }
  console.log('rendered pitch is within ' + f1(worst * 100) + '% of the mapped note (detune included)');
  // no two pops alike: random detune, and the three timbres rotate
  const rot = await page.evaluate(async () => {
    const A = BR.Audio; A._seed(900); A.setEnabled(true); const n0 = A._stats.pops;
    await A._renderOffline(() => { A.pop(5, 1, null); }, 3.2, { sr: 22050, step: 0.1 });
    return A._popLog.slice(-(A._stats.pops - n0)).map((e) => ({ t: e.timbre, d: e.det, lite: e.lite }));
  });
  check(rot.length >= 30, 'expected 30+ pops 100 ms apart, got ' + rot.length);
  const ts = rot.map((e) => e.t);
  check(ts.every((t, i) => i === 0 || t === (ts[i - 1] + 1) % 3), 'timbres do not rotate bell, pluck, marimba in turn: ' + ts.slice(0, 9).join(','));
  const ds = rot.map((e) => e.d);
  check(new Set(ds.map((d) => d.toFixed(5))).size === ds.length, 'two pops had exactly the same detune');
  check(Math.min(...ds) >= 0.97 && Math.max(...ds) <= 1.03 && Math.max(...ds) - Math.min(...ds) > 0.02, 'detune spread ' + Math.min(...ds).toFixed(3) + '..' + Math.max(...ds).toFixed(3) + ' should cover about +-3%');
  // the three timbres sound different, flavors are distinct, unknown flavors fall back to classic
  const tim = await page.evaluate(() => {
    const A = BR.Audio, out = [];
    return (async () => {
      const cs = [];
      for (let t = 0; t < 3; t++) { A._seed(77, t); A.setEnabled(true); const r = await A._renderOffline(() => A.pop(5, 1, null), 0.4, { sr: 44100 }); cs.push(AN.cut(r)); }
      const db = (c) => { const s = AN.spectrum(c, 44100, 0.003, 0.2, 2), o = []; let mx = 0; for (const m of s.mag) mx = Math.max(mx, m); for (let k = Math.round(100 / s.binHz); k < Math.round(6000 / s.binHz); k++) o.push(10 * Math.log10(s.mag[k] / mx + 1e-9)); return o; };
      const sp = cs.map(db);
      for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) { let d = 0; let n = 0; for (let i = 0; i < sp[a].length; i++) { if (Math.max(sp[a][i], sp[b][i]) < -50) continue; d += Math.abs(Math.max(sp[a][i], -90) - Math.max(sp[b][i], -90)); n++; } out.push({ a, b, d: d / Math.max(1, n) }); }
      return { out, cents: cs.map((c) => AN.centroid(c, 44100, 0, 0.2)) };
    })();
  });
  for (const p of tim.out) check(p.d > 5, 'timbres ' + p.a + ' and ' + p.b + ' have almost the same spectrum (mean difference ' + f1(p.d) + ' dB)');
  const cents = tim.cents;
  console.log('three timbres rotate in turn (bell, pluck, marimba) and differ in spectrum (mean dB difference bell/pluck ' + f1(tim.out[0].d) + ', bell/marimba ' + f1(tim.out[1].d) + ', pluck/marimba ' + f1(tim.out[2].d) + '); detune spread ' + Math.min(...ds).toFixed(3) + '..' + Math.max(...ds).toFixed(3) + ' over ' + rot.length + ' spaced pops');
  const flavorAudio = {};
  for (const fl of FLAVORS) flavorAudio[fl || 'classic'] = (await page.evaluate((fl) => AT.pop(6, 1, fl, 0, 31, true), fl)).samples;
  const rmsDiff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s / a.length); };
  check(rmsDiff(flavorAudio['no-such-flavor'], flavorAudio.classic) < 1e-7, 'an unknown flavor should play exactly the classic pop (difference ' + rmsDiff(flavorAudio['no-such-flavor'], flavorAudio.classic) + ')');
  const fnames = FLAVORS.filter((f) => f && f !== 'no-such-flavor');
  for (const fl of fnames) check(rmsDiff(flavorAudio[fl], flavorAudio.classic) > 1e-4, 'flavor "' + fl + '" sounds the same as classic');
  for (let a = 0; a < fnames.length; a++) for (let b = a + 1; b < fnames.length; b++) check(rmsDiff(flavorAudio[fnames[a]], flavorAudio[fnames[b]]) > 1e-4, 'flavors "' + fnames[a] + '" and "' + fnames[b] + '" sound the same');
  console.log('all ' + fnames.length + ' flavors differ from classic and from each other; an unknown flavor falls back to classic');

  /* ================= 4. rate limits, robustness ================= */
  console.log('\n== Rate limits ==');
  const live = await page.evaluate(async () => {
    const A = BR.Audio; A.setEnabled(true); A.unlock();
    await new Promise((r) => setTimeout(r, 300));
    const out = { state: A.context().ctx.state };
    if (out.state !== 'running') return out;
    const s0 = A._stats.ticks, d0 = A._stats.tickDrops;
    for (let i = 0; i < 200; i++) A.tick(1);
    out.burstAccepted = A._stats.ticks - s0; out.burstDropped = A._stats.tickDrops - d0;
    for (let k = 0; k < 40; k++) { A.tick(0.5); await new Promise((r) => setTimeout(r, 3)); }      // a fast steady stream: ticks every ~3 ms
    const tt = A._tickTimes.slice(-30); out.minGap = Math.min(...tt.slice(1).map((v, i) => v - tt[i]));
    await new Promise((r) => setTimeout(r, 60));
    const s1 = A._stats.ticks; A.tick(1); out.afterGap = A._stats.ticks - s1;
    const t = performance.now(), dr0 = A._stats.dropped;
    for (let i = 0; i < 300; i++) { A.pop(2 + (i % 12), i % 7, ['ember', 'glass', null, 'coins'][i % 4]); A.coin(i); A.xpTick(i); }
    out.burstMs = performance.now() - t;
    out.dropped = A._stats.dropped - dr0;
    return out;
  });
  if (live.state === 'running') {
    check(live.burstAccepted >= 1 && live.burstAccepted <= 2 && live.burstAccepted + live.burstDropped === 200, 'tick() burst: expected 1 (at most 2 if the audio clock stepped) accepted of 200, got ' + live.burstAccepted + '/' + live.burstDropped);
    check(live.minGap >= 0.018 - 1e-6, 'two ticks were only ' + f1(live.minGap * 1000) + ' ms apart on the audio clock (limit 18 ms)');
    check(live.afterGap === 1, 'tick() should work again after a gap');
    check(live.burstMs < 600, 'a burst of 900 sound calls took ' + f1(live.burstMs) + ' ms');
    console.log('tick(): 200 calls in one instant play ' + live.burstAccepted + ', a 3 ms stream never plays two closer than ' + f1(live.minGap * 1000) + ' ms (limit 18); 900 sound calls at once took ' + f1(live.burstMs) + ' ms, the voice budget dropped ' + live.dropped);
  } else console.log('live AudioContext is "' + live.state + '" here; skipped the live burst test');
  const budget = await page.evaluate(async () => {
    const A = BR.Audio; A._seed(3); A.setEnabled(true);
    const before = A._stats.dropped;
    const r = await A._renderOffline(() => { for (let i = 0; i < 160; i++) { A.coin(i); A.pop(8, 3, 'glass'); A.reveal(5); } }, 3, { sr: 44100 });
    return { peak: AN.peak(AN.cut(r)), dropped: A._stats.dropped - before, nan: AN.cut(r).some((a) => a.some((x) => !isFinite(x))) };
  });
  check(budget.dropped > 100 && budget.peak <= 0.98 && !budget.nan, 'overloaded render: dropped ' + budget.dropped + ', peak ' + budget.peak.toFixed(3));
  console.log('overload render (480 sounds at once): peak ' + budget.peak.toFixed(3) + ', ' + budget.dropped + ' voices dropped by the budget');

  /* ================= 5. music scenes ================= */
  if (!NO_MUSIC) {
  const SCENES = [
    { name: 'menu 96 BPM', secs: 90, script: [{ at: 0, op: 'start', arg: 'menu' }] },
    { name: 'run stage 1', secs: 90, script: [{ at: 0, op: 'start', arg: 'run' }] },
    {
      name: 'run stage 6 + rush', secs: 90,
      script: [{ at: 0, op: 'stage', arg: 6 }, { at: 0, op: 'start', arg: 'run' }, { at: 30.1, op: 'rush', arg: true }, { at: 50, op: 'low', arg: true }, { at: 62, op: 'low', arg: false }, { at: 70.3, op: 'rush', arg: false }],
    },
  ];
  console.log('\n== Music: 90 s scenes rendered offline through the music bus and master chain ==');
  const mrows = [];
  const barDurOf = (bpm) => 240 / bpm;
  for (const sc of SCENES) {
    const r = await page.evaluate((o) => AT.music(o), { secs: sc.secs, script: sc.script, log: true, seed: 42 });
    const bars = r.log.filter((e) => e.k === 'bar'), notes = r.log.filter((e) => e.k === 'note');
    mrows.push([sc.name, r.peak.toFixed(3), f1(dbs(r.peak)), f1(dbs(r.rms)), f1(dbs(r.rms1s)), String(r.sil.length), r.maxStep.toFixed(3), String(bars.length), String(notes.length)]);
    check(!r.nan, sc.name + ': NaN samples');
    check(r.peak <= 0.98 && r.over98 === 0, sc.name + ': samples over 0.98 (peak ' + r.peak.toFixed(3) + ')');
    check(r.sil.length === 0, sc.name + ': digital silence longer than 300 ms at ' + JSON.stringify(r.sil.slice(0, 3)));
    check(dbs(r.rms1s) <= dbs(popAgg.rms50) - 6, sc.name + ': loudest music second (' + f1(dbs(r.rms1s)) + ' dBFS) is less than 6 dB under the loudest pop rms (' + f1(dbs(popAgg.rms50)) + ' dBFS)');
    check(dbs(r.rms) >= -50, sc.name + ': music is nearly inaudible (rms ' + f1(dbs(r.rms)) + ' dBFS)');
    check(r.maxStep < 0.08, sc.name + ': a click or step of ' + r.maxStep.toFixed(3) + ' between neighbouring samples');

    const barRec = new Map(bars.map((b) => [b.mode + ':' + b.bar, b]));
    const mode = sc.script.find((e) => e.op === 'start').arg === 'menu' ? 'menu' : 'run';
    // tempo, key, harmony and sections
    for (const b of bars) {
      const want = mode === 'menu' ? 96 : (b.rush ? 124 : 110);
      check(b.bpm === want, sc.name + ': bar ' + b.bar + ' plays at ' + b.bpm + ' BPM, expected ' + want);
      check(b.key === (b.rush ? 2 : 0), sc.name + ': bar ' + b.bar + ' key ' + b.key);
      check(b.chord === ((b.bar % 8) >> 1), sc.name + ': bar ' + b.bar + ' has chord ' + b.chord + ', the progression should be I V vi IV two bars each');
    }
    const blocks = {};
    bars.forEach((b) => { const k = Math.floor(b.bar / 8); (blocks[k] = blocks[k] || new Set()).add(b.kind); });
    check(Object.values(blocks).every((s) => s.size === 1), sc.name + ': sections are not 8 bars long');
    check(new Set(bars.map((b) => b.kind)).size >= 2, sc.name + ': only one kind of section played');
    for (let i = 1; i < bars.length; i++) {
      if (bars[i].bpm === bars[i - 1].bpm) check(Math.abs((bars[i].t - bars[i - 1].t) - barDurOf(bars[i].bpm)) < 0.002, sc.name + ': bar ' + bars[i].bar + ' is not ' + barDurOf(bars[i].bpm).toFixed(3) + ' s after the last (' + (bars[i].t - bars[i - 1].t).toFixed(4) + ')');
    }
    // notes: right key, right scale, right chord, right stems for the stage
    const MELODIC = ['pluck', 'lead', 'rush', 'counter'];
    for (const n of notes) {
      const b = barRec.get(n.mode + ':' + n.bar); if (!b) continue;
      const rel = pc(n.midi - b.key);
      if (MELODIC.includes(n.stem)) check(PENT.includes(rel), sc.name + ': ' + n.stem + ' note ' + n.midi + ' (key ' + b.key + ') is not on the major pentatonic scale, bar ' + n.bar);
      if (n.stem === 'pad') check(CHORD_PCS[b.chord].includes(rel), sc.name + ': pad note ' + n.midi + ' is not in chord ' + b.chord + ', bar ' + n.bar);
      if (n.stem === 'bass') check(rel === ROOT_PC[b.chord] || rel === (ROOT_PC[b.chord] + 7) % 12, sc.name + ': bass note ' + n.midi + ' is not the root or fifth of chord ' + b.chord);
      if (n.stem === 'lead') check(b.kind === 'B' || b.rush, sc.name + ': lead melody plays in a section that is neither B nor Rush (bar ' + n.bar + ', ' + b.kind + ')');
      if (['pad', 'bass', ...MELODIC].includes(n.stem)) check(n.key === b.key && MAJOR.includes(rel), sc.name + ': a ' + n.stem + ' note is in the wrong key for its bar or outside the major scale: ' + n.midi);
    }
    for (const b of bars) {
      if (b.mode === 'menu') check(!b.L.drums && !b.L.lead && !b.L.counter && !b.L.rush, sc.name + ': the menu mix must be pad, pluck and soft bass only');
      else {
        if (b.L.drums) check(b.stage >= 2 || b.rush, sc.name + ': drums before stage 2 (bar ' + b.bar + ')');
        if (b.L.pluck) check(b.stage >= 3 || b.rush, sc.name + ': pluck before stage 3 (bar ' + b.bar + ')');
        if (b.L.counter) check(b.stage >= 5, sc.name + ': counter-melody before stage 5 (bar ' + b.bar + ')');
        if (b.L.rush) check(b.rush, sc.name + ': Rush layer outside Rush (bar ' + b.bar + ')');
        if (b.L.lead) check(b.kind === 'B' || b.rush, sc.name + ': lead outside B and Rush (bar ' + b.bar + ')');
        if (b.played >= 3) {
          if (b.stage >= 2) check(b.L.drums, sc.name + ': drums missing at stage ' + b.stage + ', bar ' + b.bar);
          if (b.stage >= 3) check(b.L.pluck, sc.name + ': pluck missing at stage ' + b.stage + ', bar ' + b.bar);
          if (b.stage >= 5) check(b.L.counter, sc.name + ': counter-melody missing at stage ' + b.stage + ', bar ' + b.bar);
        }
        if (b.low) check(b.L.pulse, sc.name + ': no pulse while the fuse is low');
      }
    }
    if (mode === 'run') check(notes.some((n) => n.stem === 'lead') || !bars.some((b) => b.kind === 'B' || b.rush), sc.name + ': a B section or Rush played but no lead melody was heard');
    if (sc.name === 'run stage 1') check(!notes.some((n) => ['kick', 'hat', 'rim', 'pluck', 'counter', 'rush', 'shaker'].includes(n.stem)), 'stage 1 should be pad, bass and (in B) the lead only');
    if (sc.name === 'menu 96 BPM') check(!notes.some((n) => ['kick', 'hat', 'rim', 'lead', 'counter', 'rush', 'shaker'].includes(n.stem)) && notes.some((n) => n.stem === 'pluck'), 'the menu has pad, pluck and bass, no drums or lead');
    if (sc.name === 'run stage 6 + rush') {
      const on = r.script.find((e) => e.op === 'rush' && e.arg), off = r.script.find((e) => e.op === 'rush' && !e.arg);
      const first = bars.find((b) => b.rush), back = bars.find((b) => !b.rush && b.t > off.ctxT);
      check(!!first && first.t >= on.ctxT && first.t - on.ctxT <= barDurOf(110) + 0.7, 'Rush should start on a bar line within a bar of setRush(true) (asked at ' + on.ctxT.toFixed(2) + ' s, started ' + (first && first.t.toFixed(2)) + ' s)');
      check(first && first.bpm === 124 && first.key === 2, 'Rush bar: 124 BPM and +2 semitones');
      check(!!back && back.t >= off.ctxT && back.t - off.ctxT <= barDurOf(124) + 0.7 && back.bpm === 110 && back.key === 0, 'Rush should end on a bar line within a bar of setRush(false)');
      check(bars.filter((b) => b.rush).length >= 6, 'Rush bars were not played');
      check(['rush', 'shaker', 'counter', 'pulse'].every((s) => notes.some((n) => n.stem === s)), 'stage 6 + rush should use the counter-melody, Rush layer and low pulse');
      check(notes.some((n) => n.stem === 'lead' && barRec.get(n.mode + ':' + n.bar).kind !== 'B'), 'the lead should play in Rush even outside B sections');
      console.log('  Rush: asked at ' + on.ctxT.toFixed(2) + ' s -> bar line at ' + first.t.toFixed(2) + ' s (124 BPM, key +2); released at ' + off.ctxT.toFixed(2) + ' s -> bar line at ' + back.t.toFixed(2) + ' s (110 BPM, key back)');
    }
  }
  table(mrows, ['scene', 'peak', 'dBFS', 'rms dB', 'loudest 1s dB', 'gaps>300ms', 'max step', 'bars', 'notes']);
  console.log('loudest pop rms(50ms) is ' + f1(dbs(popAgg.rms50)) + ' dBFS; the music must stay 6 dB under it');

  // stage-ups, the mode crossfade, stopping cleanly
  console.log('\n== Music: stage-ups, crossfade, results sting, stopping ==');
  const sw = await page.evaluate((o) => AT.music(o), {
    secs: 100, log: true, seed: 7,
    script: [
      { at: 0, op: 'start', arg: 'menu' }, { at: 20.2, op: 'mode', arg: 'run' },
      { at: 40, op: 'stage', arg: 2 }, { at: 40, op: 'stageUp' }, { at: 55, op: 'stage', arg: 3 }, { at: 55, op: 'stageUp' },
      { at: 70.4, op: 'mode', arg: 'menu' }, { at: 80, op: 'sting' }, { at: 86, op: 'stop' },
    ],
  });
  check(!sw.nan && sw.peak <= 0.98 && sw.over98 === 0, 'crossfade scene clips or has NaN (peak ' + sw.peak.toFixed(3) + ')');
  check(sw.sil.length === 0, 'crossfade scene has digital silence ' + JSON.stringify(sw.sil.slice(0, 2)));
  check(sw.maxStep < 0.08, 'crossfade scene click/step ' + sw.maxStep.toFixed(3));
  check(dbs(sw.rms1s) <= dbs(popAgg.rms50) - 6, 'crossfade scene: loudest second ' + f1(dbs(sw.rms1s)) + ' dBFS (at ' + sw.rms1sAt.toFixed(1) + ' s) is within 6 dB of the loudest pop');
  const swBars = sw.log.filter((e) => e.k === 'bar');
  const toRun = sw.script.find((e) => e.op === 'mode' && e.arg === 'run'), toMenu = sw.script.find((e) => e.op === 'mode' && e.arg === 'menu');
  const firstRun = swBars.find((b) => b.mode === 'run'), firstMenu2 = swBars.find((b) => b.mode === 'menu' && b.t > toMenu.ctxT - 1);
  check(firstRun && firstRun.t >= toRun.ctxT && firstRun.t - toRun.ctxT <= barDurOf(96) + 0.7, 'menu -> run crossfade should start on the next bar line');
  check(firstRun && firstRun.bpm === 110 && swBars.find((b) => b.mode === 'menu').bpm === 96, 'tempo should change 96 -> 110 with the mode');
  check(firstMenu2 && firstMenu2.t - toMenu.ctxT <= barDurOf(110) + 0.7, 'run -> menu crossfade should start on the next bar line');
  // the chord progression carries straight through a crossfade (same bar, same chord)
  const seq = swBars.slice().sort((a, b) => a.t - b.t);
  let jumps = 0; for (let i = 1; i < seq.length; i++) if (seq[i].bar !== seq[i - 1].bar + 1 && seq[i].bar !== seq[i - 1].bar) jumps++;
  check(jumps === 0, 'harmony jumped across a mode change (' + jumps + ' discontinuities)');
  // the riser lands on a bar line
  const risers = sw.log.filter((e) => e.k === 'note' && e.stem === 'riser');
  check(risers.length === 2, 'expected two risers for two stageUp() calls, got ' + risers.length);
  for (const rz of risers) check(swBars.some((b) => Math.abs(b.t - (rz.t + rz.len)) < 0.003), 'the riser ending at ' + (rz.t + rz.len).toFixed(3) + ' s does not land on a bar line');
  const stg = swBars.find((b) => b.mode === 'run' && b.stage === 3);
  console.log('  ' + risers.map((rz) => 'riser ' + rz.t.toFixed(2) + ' -> ' + (rz.t + rz.len).toFixed(2) + ' s (a bar line)').join(', ') + (stg ? '; stage 3 stems join at the bar line ' + stg.t.toFixed(2) + ' s' : ''));
  check(sw.tail !== null && sw.tail < 1e-4, 'music keeps sounding after stop(): peak ' + (sw.tail && sw.tail.toExponential(1)) + ' three seconds later');
  check(sw.debug.players === 0 && !sw.debug.timer && sw.debug.nodes === 0 && sw.debug.chain === 0, 'players/nodes leaked after stop: ' + JSON.stringify(sw.debug));
  console.log('  after stop(): silent within 3 s (peak ' + (sw.tail || 0).toExponential(1) + '), ' + sw.debug.players + ' players, ' + sw.debug.nodes + ' player nodes, ' + sw.debug.chain + ' bus nodes, timer ' + sw.debug.timer + '; mode crossfades keep the same bar and chord (no jumps)');

  // live: the real scheduler on a real AudioContext, also with the CPU throttled 4x (a phone), then stop and check that every node is released
  const liveStart = await page.evaluate(async () => {
    const A = BR.Audio, Mu = BR.Music; A.setEnabled(true); Mu.setEnabled(true); A.unlock();
    await new Promise((r) => setTimeout(r, 200));
    const c = A.context(); if (c.ctx.state !== 'running') return { state: c.ctx.state };
    Mu.stats.pumps = 0; Mu.stats.underruns = 0; Mu.stats.minMargin = 9; Mu.stats.maxPumpMs = 0; Mu.idleMs = 700;
    Mu.setStage(6); Mu.setRush(true); Mu.start('run');
    await new Promise((r) => setTimeout(r, 4500));
    return { state: c.ctx.state, mid: Mu._debug(), calm: Object.assign({}, Mu.stats) };
  });
  let liveMusic = liveStart;
  if (liveStart.state === 'running') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(async () => { const Mu = BR.Music; Mu.stats.pumps = 0; Mu.stats.underruns = 0; Mu.stats.minMargin = 9; Mu.stats.maxPumpMs = 0; await new Promise((r) => setTimeout(r, 6000)); });
    const hot = await page.evaluate(() => Object.assign({}, BR.Music.stats));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    liveMusic = Object.assign({}, liveStart, await page.evaluate(async () => {
      const A = BR.Audio, Mu = BR.Music, c = A.context();
      Mu.setMode('menu'); Mu.setRush(true); Mu.setLow(true); Mu.stageUp(); Mu.duck(true); Mu.duck(false); Mu.duckFor(600);
      await new Promise((r) => setTimeout(r, 800));
      Mu.stop();
      await new Promise((r) => setTimeout(r, 4200));
      return { end: Mu._debug(), key: A.key, state: c.ctx.state };
    }), { hot });
    check(liveMusic.mid.players === 1 && liveMusic.mid.timer, 'music did not start on the live context: ' + JSON.stringify(liveMusic.mid));
    // an underrun is a timer wake-up more than ~140 ms late; one stray one on a busy test machine is tolerated, a pattern is not
    check(liveMusic.calm.underruns <= 1 && liveMusic.calm.pumps > 80, 'live scheduler fell behind: ' + JSON.stringify(liveMusic.calm));
    check(hot.underruns <= 2 && hot.pumps > 20, 'live scheduler fell behind with the CPU throttled 4x: ' + JSON.stringify(hot));
    check(liveMusic.end.players === 0 && !liveMusic.end.timer && liveMusic.end.nodes === 0 && liveMusic.end.chain === 0 && !liveMusic.end.running, 'live music leaked after stop(): ' + JSON.stringify(liveMusic.end));
    check(liveMusic.key === 0, 'the pops stayed in the Rush key after stop() (key ' + liveMusic.key + ')');
    console.log('  live context: ' + liveMusic.mid.nodes + ' player nodes (+' + liveMusic.mid.chain + ' bus nodes) while playing, ' + liveMusic.end.nodes + ' and no timer 5 s after stop(), the bus released too; scheduler never late (' + liveMusic.calm.pumps + ' wake-ups, smallest margin ' + f1(liveMusic.calm.minMargin * 1000) + ' ms; with the CPU throttled 4x: ' + hot.pumps + ' wake-ups, margin ' + f1(hot.minMargin * 1000) + ' ms, longest wake-up ' + f1(hot.maxPumpMs) + ' ms)');
  } else console.log('  live AudioContext is "' + liveStart.state + '"; skipped the live start/stop test');

  // arrangement: sections re-sequence between passes, for every seed
  const plans = await page.evaluate(() => { const out = []; for (let s = 1; s <= 40; s++) { BR.Music.setSeed(s * 7919); out.push(BR.Music.plan(7 * 6)); } return out; });
  let allDiffer = true;
  const orders = new Set();
  for (const p of plans) {
    for (let e = 0; e < 5; e++) if (p.slice(e * 7, e * 7 + 7).join() === p.slice(e * 7 + 7, e * 7 + 14).join()) allDiffer = false;
    for (let e = 0; e < 6; e++) { const pass = p.slice(e * 7, e * 7 + 7); orders.add(pass.join()); check(pass[0] === 'A' && pass[6] === 'App' && pass.filter((k) => k === 'B').length === 2, 'a pass should open with A, close with A\'\' and have two B sections: ' + pass.join(' ')); }
  }
  check(allDiffer, 'two consecutive passes had the same section order');
  check(orders.size >= 4, 'only ' + orders.size + ' different section orders across 40 seeds');
  console.log('  section orders: ' + orders.size + ' different 7-section passes across 40 seeds, and consecutive passes never repeat the order');

  }

  /* ================= 6. long renders ================= */
  if (!QUICK && !NO_MUSIC) {
    console.log('\n== Music: two back-to-back passes of the run piece (' + (56 * 240 / 110 / 60).toFixed(1) + ' min each pass at stage 4... 2 passes) ==');
    const sim = await page.evaluate((o) => AT.similarity(o), { seed: 2024, sr: 22050 });
    console.log('  pass 2 against pass 1: whole-piece waveform correlation ' + sim.whole.toFixed(3) + '; ' + sim.copies + ' of ' + sim.bars + ' bars are near-copies (corr > 0.95); mean per-bar correlation ' + sim.meanCorr.toFixed(3));
    check(sim.peak <= 0.98, 'similarity render clips');
    check(sim.whole < 0.6, 'the second pass is too close to the first (whole-piece correlation ' + sim.whole.toFixed(3) + ')');
    check(sim.copies <= sim.bars * 0.25, 'too many bars repeat exactly across passes: ' + sim.copies + ' of ' + sim.bars);

    console.log('\n== Music: a 10 minute session -> ' + WAV_PATH + ' ==');
    const session = [
      { at: 0, op: 'start', arg: 'menu' }, { at: 40, op: 'mode', arg: 'run' },
      { at: 100, op: 'stage', arg: 2 }, { at: 100, op: 'stageUp' }, { at: 170, op: 'stage', arg: 3 }, { at: 170, op: 'stageUp' },
      { at: 240, op: 'stage', arg: 4 }, { at: 240, op: 'stageUp' }, { at: 285, op: 'rush', arg: true }, { at: 315, op: 'rush', arg: false },
      { at: 350, op: 'stage', arg: 5 }, { at: 350, op: 'stageUp' }, { at: 400, op: 'low', arg: true }, { at: 412, op: 'low', arg: false },
      { at: 430, op: 'rush', arg: true }, { at: 462, op: 'rush', arg: false }, { at: 470, op: 'stage', arg: 6 }, { at: 470, op: 'stageUp' },
      { at: 520, op: 'stop' }, { at: 521, op: 'sting' }, { at: 530, op: 'start', arg: 'menu' }, { at: 575, op: 'mode', arg: 'run' },
    ];
    const long = await page.evaluate((o) => AT.music(o), { secs: 600, script: session, log: false, seed: 1337, sr: 32000, step: 0.5, ahead: 1.0, keep: true, noTail: true });
    check(!long.nan && long.peak <= 0.98 && long.over98 === 0, '10 minute session clips or has NaN (peak ' + long.peak.toFixed(3) + ', ' + long.over98 + ' samples over 0.98)');
    check(long.maxStep < 0.08, '10 minute session: a click or step of ' + long.maxStep.toFixed(3));
    const gaps = long.sil.filter((g) => g[0] < 519);
    check(gaps.length === 0, '10 minute session has digital silence inside the music: ' + JSON.stringify(gaps.slice(0, 3)));
    check(dbs(long.rms1s) <= dbs(popAgg.rms50) - 6, '10 minute session: loudest second ' + f1(dbs(long.rms1s)) + ' dBFS is within 6 dB of the loudest pop');
    const mins = await page.evaluate(() => AT.keptMinutes());
    console.log('  peak ' + long.peak.toFixed(3) + ' (' + f1(dbs(long.peak)) + ' dBFS), loudest second ' + f1(dbs(long.rms1s)) + ' dBFS (at ' + long.rms1sAt.toFixed(1) + ' s); rms per minute (dBFS): ' + mins.map((m) => f1(dbs(m.rms))).join(' '));
    const st = await page.evaluate(() => AT.keptStats());
    const frames = Math.round(st.sec * st.sr), chunk = st.sr * 20, parts = [];
    for (let i = 0; i < frames; i += chunk) parts.push(Buffer.from(await page.evaluate((a) => AT.keptWav(a.i, a.j), { i, j: Math.min(frames, i + chunk) }), 'base64'));
    const data = Buffer.concat(parts), hdr = Buffer.alloc(44);
    hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
    hdr.writeUInt32LE(st.sr, 24); hdr.writeUInt32LE(st.sr * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
    fs.writeFileSync(WAV_PATH, Buffer.concat([hdr, data]));
    console.log('  wrote ' + WAV_PATH + ' (' + (data.length / 1048576).toFixed(1) + ' MB, ' + st.sec.toFixed(0) + ' s, ' + st.sr + ' Hz stereo 16-bit)');
  }

  /* ================= calibration (dev) ================= */
  if (CALIBRATE) {
    console.log('\n== Calibration: iterating per-sound trims until each peak (through the master chain) hits its target ==');
    const POP_T = 0.30;
    const CLASS_T = { big: 0.40, mid: 0.26, small: 0.10 };
    const TARGET = {
      ui: 0.11, land: 0.07, deny: 0.12, combo: 0.09, recolor: 0.07, lowFuel: 0.10, xpTick: 0.08, boosterGain: 0.12, boosterArm: 0.08, 'boosterUse:hammer': 0.26, 'boosterUse:beam': 0.2, 'boosterUse:prism': 0.2,
      heartbeat: 0.13, fuseTick: 0.09, timeGain: 0.08, go: 0.20, count: 0.10, coin: 0.09, holdTick: 0.12, crackle: 0.07, steam: 0.08,
      whoosh: 0.11, chargeUp: 0.10, scrap: 0.10, launch: 0.12, thud: 0.20, glassBreak: 0.22, equip: 0.20, sting: 0.26, tick: 0.075,
      drum: 0.20, shuffle: 0.14, rushEnd: 0.34, fuseOut: 0.36, holdStart: 0,
    };
    let tp = 1;
    for (let it = 0; it < 3; it++) {
      const peak = await page.evaluate(async ({ FLAVORS, tp }) => {
        BR.Audio._trim.pop = tp; let m = 0;
        for (const f of FLAVORS) for (const n of [3, 8, 14]) for (const tm of [0, 1, 2]) {
          BR.Audio._seed(100 + n * 7 + tm, tm); BR.Audio.setEnabled(true);
          const r = await BR.Audio._renderOffline(() => BR.Audio.pop(n, n === 8 ? 7 : 1, f), 0.5, { sr: 44100 });
          m = Math.max(m, AN.peak(AN.cut(r)));
        }
        return m;
      }, { FLAVORS, tp });
      console.log('pop trim', tp.toFixed(3), 'loudest pop peak', peak.toFixed(3));
      tp *= POP_T / peak;
    }
    const trims = { pop: +tp.toFixed(3) };
    const groups = {};
    const perVariant = new Set(['boosterUse', 'reveal']);
    for (const [name, args, , cls] of SFX) { const key = perVariant.has(name) ? name + ':' + args[0] : name; (groups[key] = groups[key] || { name, cls, args: [] }).args.push(args); }
    const REVEAL_T = { 1: 0.14, 2: 0.18, 3: 0.22, 4: 0.26, 5: 0.30 };
    for (const [key, g] of Object.entries(groups)) {
      const target = key.startsWith('reveal:') ? REVEAL_T[g.args[0][0]] : (TARGET[key] != null ? TARGET[key] : (TARGET[g.name] != null ? TARGET[g.name] : CLASS_T[g.cls]));
      if (!target) continue;
      let tr = 1, peak = 0;
      for (let it = 0; it < 4; it++) {
        peak = 0;
        for (const args of g.args) { await page.evaluate(({ key, tr }) => { BR.Audio._trim[key] = tr; }, { key, tr }); const r = await page.evaluate((a) => AT.sfx(a.name, a.args, false), { name: g.name, args }); peak = Math.max(peak, r.peak); }
        if (Math.abs(20 * Math.log10(peak / target)) < 0.4) break;
        tr *= target / Math.max(peak, 1e-5);
      }
      trims[key] = +tr.toFixed(3);
      console.log(key.padEnd(16), 'trim', tr.toFixed(3).padStart(7), 'peak', peak.toFixed(3), 'target', target);
    }
    console.log('\nTRIM = ' + JSON.stringify(trims));
  }

  /* ================= 7. audio never breaks the game ================= */
  console.log('\n== Robustness: no Web Audio at all, and a context that never starts ==');
  const callAll = () => {
    const A = BR.Audio, Mu = BR.Music, thrown = [];
    const tryIt = (label, fn) => { try { fn(); } catch (e) { thrown.push(label + ': ' + e.message); } };
    A._names().forEach((n) => { if (n === 'context') return; tryIt('audio.' + n, () => A[n](3, 2, 'glass')); });
    tryIt('pop flavors', () => ['ember', 'confetti', 'dragonfire', 'x', null, undefined].forEach((f) => A.pop(7, 3, f)));
    tryIt('pop junk', () => { A.pop(); A.pop(NaN, -4, 5); A.pop(99, 1e9, ''); });
    tryIt('volume', () => { A.setVolume(0.4); A.setVolume(7); A.setVolume('x'); });
    ['setEnabled', 'setStage', 'setRush', 'setLow', 'duck', 'duckFor', 'setVolume'].forEach((n) => tryIt('music.' + n, () => { Mu[n](true); Mu[n](false); Mu[n](3); }));
    tryIt('music.start', () => { Mu.setEnabled(true); Mu.start(); Mu.start('menu'); Mu.setMode('run'); Mu.setMode('menu'); Mu.stageUp(); Mu.resultsSting(); Mu.stop(); Mu.stop(); });
    return { thrown };
  };
  const bare = await launch({ width: 390, height: 844, setup: () => { window.AudioContext = undefined; window.webkitAudioContext = undefined; window.OfflineAudioContext = undefined; } });
  const r1 = await bare.page.evaluate('(' + callAll.toString() + ')()');
  check(r1.thrown.length === 0, 'with no AudioContext, calls threw: ' + r1.thrown.slice(0, 3).join(' | '));
  check(bare.errors.length === 0, 'console errors with no AudioContext: ' + bare.errors.slice(0, 2).join(' | '));
  await bare.browser.close();
  const sus = await launch({
    width: 390, height: 844, setup: () => {
      const Real = window.AudioContext;
      class Never extends Real { get state() { return 'suspended'; } resume() { return new Promise(() => { }); } }
      window.AudioContext = Never; window.webkitAudioContext = Never;
    },
  });
  const r2 = await sus.page.evaluate('(' + callAll.toString() + ')()');
  check(r2.thrown.length === 0, 'with a suspended AudioContext, calls threw: ' + r2.thrown.slice(0, 3).join(' | '));
  check(sus.errors.length === 0, 'console errors with a suspended AudioContext: ' + sus.errors.slice(0, 2).join(' | '));
  await sus.browser.close();
  console.log('  every method of BR.audio and BR.Music is safe to call with no AudioContext and with one that never starts');

  console.log('\nconsole errors/warnings in the game page:', errors.length ? errors.slice(0, 5) : 'none');
  check(errors.length === 0, 'console errors: ' + errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log('\n' + (failures ? failures + ' CHECK(S) FAILED' : 'all audio checks passed') + ' in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
