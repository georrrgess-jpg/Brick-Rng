/* The lag meter (Settings > Check performance). It plays a scripted test on a practice board and a trial chest that nothing is saved or
   paid from, records how long every frame takes around each moment (pops of rising size, a Line Blast, a stage clear, a Rush start, a
   chest hold, burst, spin and reveal), and writes a short plain-text report the player can copy and send. Update 8.
   Frame times come from requestAnimationFrame, the same thing the player feels; "script" is the time the tap's own code took before
   the first frame; "task" is the longest long task the browser reported (Chrome only). */
(function () {
  const BR = window.BR;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const raf = () => new Promise((r) => requestAnimationFrame(r));

  /** A rAF recorder: every frame's gap, tagged with the moment being measured. */
  function Recorder() {
    this.frames = []; this.tag = ''; this.tagFn = null; this.on = true; this.last = performance.now();
    const step = (t) => {
      if (!this.on) return;
      this.frames.push({ gap: t - this.last, tag: this.tagFn ? this.tagFn() : this.tag, t });
      this.last = t; requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  Recorder.prototype.stop = function () { this.on = false; };

  /** Long tasks and long animation frames where the browser reports them (Chrome and Edge; Safari does not). */
  function longWatch() {
    const w = { tasks: [], supported: false, obs: [] };
    ['longtask', 'long-animation-frame'].forEach((type) => {
      try {
        const o = new PerformanceObserver((list) => { list.getEntries().forEach((e) => w.tasks.push({ t: e.startTime, d: e.duration, type })); });
        o.observe({ type, buffered: false }); w.obs.push(o); w.supported = true;
      } catch (e) { /* not supported */ }
    });
    w.stop = () => w.obs.forEach((o) => { try { o.disconnect(); } catch (e) { /* ignore */ } });
    return w;
  }

  const median = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const stats = (rec, tag) => {
    const fr = rec.frames.filter((f) => f.tag === tag), g = fr.map((f) => f.gap);
    return { frames: g.length, median: median(g), worst: g.length ? Math.max.apply(null, g) : 0, over50: g.filter((x) => x > 50).length, from: fr.length ? fr[0].t - fr[0].gap : 0, to: fr.length ? fr[fr.length - 1].t : 0 };
  };

  /** A board with one group of exactly `n` bricks (a block four wide, bottom left) and no other group, or a full bottom row for a Line Blast. */
  function setBoard(R, n, line) {
    const g = R.engine.board.grid;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) g[r][c].color = (r * 3 + c * 2) % 5;   // neighbours always differ
    let at = null;
    if (line) { for (let c = 0; c < 8; c++) g[7][c].color = 5; at = { r: 7, c: 0 }; }
    else { let k = n; for (let r = 7; r >= 0 && k > 0; r--) for (let c = 0; c < 4 && k > 0; c++) { g[r][c].color = 5; k--; } at = { r: 7, c: 0 }; }
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) delete g[r][c].fb;
    R.engine.board.version++;
    R.view.syncTo(R.engine.board);
    return at;
  }

  async function ready(R) {
    for (let i = 0; i < 60 && !(R.canAct && !R.busy); i++) await sleep(100);
    await sleep(350);
  }

  const dpr = () => (window.devicePixelRatio || 1);
  const yn = (b) => (b ? 'on' : 'off');

  BR.PerfMeter = {
    running: false,
    /** Run the whole test. onStatus(text) is told what is being measured. Resolves with { text, rows }. */
    async run(onStatus) {
      if (this.running) return null;
      this.running = true;
      const say = (t) => { try { onStatus && onStatus(t); } catch (e) { /* ignore */ } };
      const D = BR.Storage.data, S = D.settings, keep = { sound: S.sound, haptics: S.haptics };
      const rec = new Recorder(), lw = longWatch(), rows = [], t0 = performance.now();
      const R = BR.Run;
      let tapWait = 900;
      try {
        for (let i = 0; i < 6 && BR.Back && BR.Back.depth; i++) BR.Back.closeTop();
        say('Starting the test board');
        await R.practiceMeter(this);
        await ready(R);
        const e = R.engine;

        const moment = async (label, setup, tapAt, extra) => {
          say(label);
          const at = setup();
          await ready(R);
          rec.tag = label;
          const ts = performance.now();
          const p = R.tap(at.r, at.c);
          const script = performance.now() - ts;
          await p;
          await sleep(tapWait);
          rec.tag = '';
          const st = stats(rec, label);
          const tasks = lw.tasks.filter((x) => x.t >= st.from - 5 && x.t <= st.to).map((x) => x.d);
          rows.push(Object.assign({ label, script, task: tasks.length ? Math.max.apply(null, tasks) : null }, st, extra || {}));
        };

        // pops of rising size
        for (const n of [2, 6, 12, 20, 24]) await moment('Pop of ' + n, () => setBoard(R, n, false));
        await moment('Line Blast', () => setBoard(R, 0, true));
        await moment('Stage clear', () => { const a = setBoard(R, 6, false); e.stageScore = Math.max(0, e.goal - 5); return a; });

        // the same big pops with sound and vibration off, to see what they cost on this phone
        S.sound = false; S.haptics = false; BR.App.applySettings();
        for (const n of [12, 24]) await moment('Pop of ' + n + ', sound and vibration off', () => setBoard(R, n, false));
        S.sound = keep.sound; S.haptics = keep.haptics; BR.App.applySettings();

        await moment('Rush start', () => { const a = setBoard(R, 12, false); e.rush.meter = 98; return a; });

        say('Leaving the test board');
        R.endPractice();
        await sleep(900);

        // a trial chest: hold, burst, spin and reveal; nothing is spent or kept
        say('Opening a trial chest');
        BR.Openings.open('brick', { trial: true });
        for (let i = 0; i < 60 && !(BR.Openings.current && BR.Openings.current.state === 'ready'); i++) await sleep(100);
        const o = BR.Openings.current;
        if (o && o.state === 'ready') {
          rec.tagFn = () => 'Chest ' + (o.state === 'ready' || o.state === 'holding' ? 'hold' : o.state);
          const h0 = performance.now();
          while (performance.now() - h0 < 1300) { o.setHold(Math.min(1, (performance.now() - h0) / 1200)); await raf(); }
          const c0 = performance.now();
          o.commit();
          for (let i = 0; i < 400 && !(document.querySelector('.rv-actions.on')) && !o.closed; i++) await sleep(50);
          await sleep(600);
          rec.tagFn = null;
          for (const ph of ['hold', 'burst', 'spin', 'reveal']) {
            const st = stats(rec, 'Chest ' + ph);
            if (!st.frames) continue;
            const tasks = lw.tasks.filter((x) => x.t >= st.from - 5 && x.t <= st.to).map((x) => x.d);
            rows.push(Object.assign({ label: 'Chest ' + ph, script: null, task: tasks.length ? Math.max.apply(null, tasks) : null }, st));
          }
          try { o.requestClose(false); } catch (err) { /* ignore */ }
          await sleep(900);
        } else rows.push({ label: 'Chest (could not start)', frames: 0, median: 0, worst: 0, over50: 0, script: null, task: null });
      } catch (err) {
        console.error(err);
        rows.push({ label: 'Test stopped: ' + (err && err.message), frames: 0, median: 0, worst: 0, over50: 0, script: null, task: null });
        try { if (R.practice) R.endPractice(); } catch (e2) { /* ignore */ }
      } finally {
        S.sound = keep.sound; S.haptics = keep.haptics; BR.App.applySettings();
        rec.stop(); lw.stop(); this.running = false;
      }
      const text = this.report(rows, performance.now() - t0, lw.supported);
      this.last = { text, rows };
      return this.last;
    },

    /** The plain-text report. */
    report(rows, ms, longSupported) {
      const D = BR.Storage.data.settings, G = BR.Gfx || {};
      const hz = G.refresh ? Math.round(1 / G.refresh) : '?';
      const f = (v, d = 0) => (v == null ? '-' : v.toFixed(d));
      const col = (v, w) => String(v).padStart(w);
      const lines = [];
      lines.push('Pop Rush lag report (Update 8)');
      lines.push('Device: ' + navigator.userAgent);
      lines.push(`Screen: ${innerWidth}x${innerHeight} at ${dpr()}x, about ${hz} Hz, ${navigator.hardwareConcurrency || '?'} cores, memory ${navigator.deviceMemory || '?'} GB`);
      lines.push(`Opened: ${window.top !== window ? 'inside another page (embedded)' : 'directly'}; home-screen app: ${(window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone ? 'yes' : 'no'}`);
      lines.push(`Settings: Mobile mode ${yn(BR.mobileMode)}, Graphics ${D.perf}${BR.lowEnd ? ' (effects lowered)' : ''}, Performance mode ${yn(D.perfMode)}, Sound ${yn(D.sound)}, Music ${yn(D.music)}, Vibration ${yn(D.haptics)}`);
      lines.push('');
      lines.push('Moment'.padEnd(40) + col('median', 8) + col('worst', 8) + col('>50ms', 7) + col('script', 8) + col('task', 7));
      rows.forEach((r) => {
        lines.push(r.label.padEnd(40) + col(f(r.median), 8) + col(f(r.worst), 8) + col(r.over50, 7) + col(f(r.script), 8) + col(longSupported ? f(r.task) : 'n/a', 7));
      });
      lines.push('');
      lines.push('Times are in milliseconds per frame (16.7 is smooth at 60 Hz). "script" is the tap code before the next frame, "task" the longest long task.');
      lines.push(`The whole test took ${Math.round(ms / 1000)} s.`);
      return lines.join('\n');
    },

    /** The Settings button: run the test and show the report in a sheet. */
    async start() {
      if (this.running) return;
      for (let i = 0; i < 6 && BR.Back && BR.Back.depth; i++) BR.Back.closeTop();
      BR.Router.go('home', { instant: true });
      BR.toast('Lag meter running: about two minutes. Please do not touch the screen.');
      const res = await this.run((t) => { try { if (BR.Run && BR.Run.practice && BR.Run.hint) BR.Run.hint('<b>Lag meter</b>: ' + BR.esc(t), 0); } catch (e) { /* ignore */ } });
      if (!res) return;
      BR.Router.go('profile');
      this.show(res.text);
    },

    show(text) {
      BR.Sheet.open({
        title: 'Lag report',
        body: `<p class="ready-sub">Tap <b>Copy report</b> and paste it into the chat. Lower numbers are better.</p><textarea class="code-box" rows="14" readonly aria-label="Lag report" style="font:12px/1.35 monospace;white-space:pre">${BR.esc(text)}</textarea><p class="code-info tiny"></p>`,
        actions: [{
          label: 'Copy report', close: false,
          onClick: (api) => {
            const box = api.el.querySelector('textarea'), info = api.el.querySelector('.code-info');
            const done = (ok) => { info.textContent = ok ? 'Copied.' : 'Could not copy automatically: press and hold the text, then choose Select all and Copy.'; };
            box.focus(); box.select();
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done(true), () => { try { done(document.execCommand('copy')); } catch (e) { done(false); } });
            else { try { done(document.execCommand('copy')); } catch (e) { done(false); } }
          },
        }, { label: 'Close', cls: 'btn-dark' }],
      });
    },
  };
})();
