/* The lag meter's second part (Update 8): "where the time goes". Frame times alone say how bad a moment is, not why; so this repeats one
   pop of 12 bricks with one suspect taken away at a time (the effects canvases, the shadows and filters on the bricks, the skin art, the
   HUD, the background scene, the bricks' own animation) and reports each variant's frame times next to the untouched one. Whichever
   variant brings the worst frames down is where the time goes on this phone. It runs on the practice board after the main test and
   saves nothing. */
(function () {
  const BR = window.BR;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // `css` is added for the variant; `on` / `off` switch something in the game and put it back; `idle` records frames without a pop
  const swap = (obj, key, val) => { const old = obj[key]; obj[key] = val; return () => { obj[key] = old; }; };
  const VARIANTS = [
    { id: 'no pop at all (frames of the idle board)', idle: true },
    { id: 'as it is' },
    { id: 'bricks drawn flat (colour only)', css: '.face { background: var(--lo) !important; box-shadow: none !important; filter: none !important; } .stud, .deco, .sheen { display: none !important; }' },
    { id: 'no shadows or filters on bricks', css: '.face, .stud { box-shadow: none !important; filter: none !important; }' },
    { id: 'no skin art on bricks', css: '.deco, .sheen, .stud { display: none !important; }' },
    { id: 'board frame and glow flat', css: '.board, .board-wrap, .field { box-shadow: none !important; } .field::after, .board::before, .board::after { display: none !important; }' },
    { id: 'music off', on: () => { const m = BR.Music; if (!m || !m.setEnabled) return () => {}; m.setEnabled(false); return () => m.setEnabled(BR.Storage.data.settings.music); } },
    { id: 'all sound off (music and effects)', on: () => { const m = BR.Music, a = BR.audio; if (m && m.setEnabled) m.setEnabled(false); if (a && a.setEnabled) a.setEnabled(false); return () => { if (m && m.setEnabled) m.setEnabled(BR.Storage.data.settings.music); if (a && a.setEnabled) a.setEnabled(BR.Storage.data.settings.sound); }; } },
    { id: 'particles not drawn', on: () => { const f = BR.fx, un = swap(f, '_kick', () => {}); const fz = BR.Fuse && BR.Fuse.parts; return () => { un(); f.parts.length = 0; }; } },
    { id: 'fuse (rope, flame, sparks) not updated', on: () => (BR.Fuse ? swap(BR.Fuse, 'update', () => {}) : () => {}) },
    { id: 'effects canvases hidden', css: '#fx, .fz-cv { display: none !important; }' },
    { id: 'HUD hidden', css: '.run-top, .fuse, .stagestrip, .rushbar, .powerups, .msgband, .chillbar { visibility: hidden !important; }' },
    { id: 'background scene hidden', css: '.bg, .vignette { display: none !important; }' },
    { id: 'bricks kept on their own layers', css: '.brick { will-change: transform; }' },
    { id: 'no brick animation (only the board changes)', stub: true },
    { id: 'as it is, again' },
  ];

  const median = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

  function setBoard(R, n) {
    const g = R.engine.board.grid;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { g[r][c].color = (r * 3 + c * 2) % 5; delete g[r][c].fb; }
    let k = n; for (let r = 7; r >= 0 && k > 0; r--) for (let c = 0; c < 4 && k > 0; c++) { g[r][c].color = 5; k--; }
    R.engine.board.version++; R.view.syncTo(R.engine.board);
  }
  async function ready(R) { for (let i = 0; i < 60 && !(R.canAct && !R.busy); i++) await sleep(100); await sleep(350); }

  async function idleFrames() {
    await sleep(300);
    const gaps = []; let last = performance.now(), on = true;
    const f = (t) => { if (!on) return; gaps.push(t - last); last = t; requestAnimationFrame(f); };
    requestAnimationFrame(f);
    await sleep(1500);
    on = false;
    return gaps.slice(1);
  }

  async function onePop(R) {
    setBoard(R, 12);
    await ready(R);
    const gaps = []; let last = performance.now(), on = true;
    const f = (t) => { if (!on) return; gaps.push(t - last); last = t; requestAnimationFrame(f); };
    requestAnimationFrame(f);
    await R.tap(7, 0);
    await sleep(700);
    on = false;
    return gaps.slice(1);
  }

  BR.PerfDiag = {
    async run(say) {
      const R = BR.Run, rows = [];
      let style = null, origAnimate = null;
      try {
        say && say('Where the time goes');
        await R.practiceMeter(BR.PerfMeter);
        await ready(R);
        R.engine.tick = () => [];
        for (const v of VARIANTS) {
          say && say(v.id);
          let undo = null;
          if (v.css) { style = document.createElement('style'); style.textContent = v.css; document.head.appendChild(style); }
          if (v.on) undo = v.on();
          if (v.stub) {
            origAnimate = Element.prototype.animate;
            Element.prototype.animate = function (kf, o) {
              const a = { finished: Promise.resolve(), cancel() {}, pause() {}, play() {}, onfinish: null };
              setTimeout(() => { try { a.onfinish && a.onfinish(); } catch (e) { /* ignore */ } }, 30 + ((o && o.delay) || 0));
              return a;
            };
          }
          await sleep(120);
          const all = [], worsts = [];
          for (let i = 0; i < 2; i++) { const g = v.idle ? await idleFrames() : await onePop(R); all.push.apply(all, g); worsts.push(g.length ? Math.max.apply(null, g) : 0); }
          if (origAnimate) { Element.prototype.animate = origAnimate; origAnimate = null; }
          if (style) { style.remove(); style = null; }
          if (undo) { try { undo(); } catch (e) { /* ignore */ } }
          rows.push({ id: v.id, median: median(all), worst: Math.max.apply(null, worsts), over50: all.filter((x) => x > 50).length, frames: all.length });
        }
      } catch (err) {
        console.error(err);
        rows.push({ id: 'stopped: ' + (err && err.message), median: 0, worst: 0, over50: 0, frames: 0 });
      } finally {
        if (origAnimate) Element.prototype.animate = origAnimate;
        if (style) style.remove();
        try { if (R.practice) R.endPractice(); } catch (e) { /* ignore */ }
      }
      return this.report(rows);
    },
    report(rows) {
      const col = (v, w) => String(v).padStart(w);
      const lines = ['Where the time goes (a pop of 12 bricks, two pops per line, or 1.5 s of the idle board; the line that drops the worst frames is the cause)', ''];
      lines.push('Variant'.padEnd(46) + col('median', 8) + col('worst', 8) + col('>50ms', 7));
      rows.forEach((r) => lines.push(r.id.padEnd(46) + col(Math.round(r.median), 8) + col(Math.round(r.worst), 8) + col(r.over50, 7)));
      return lines.join('\n');
    },
  };

  // the lag meter runs this after its own test, and adds it to the report
  if (BR.PerfMeter && !BR.PerfMeter._diag) {
    const orig = BR.PerfMeter.run;
    BR.PerfMeter._diag = true;
    BR.PerfMeter.run = async function (say) {
      const res = await orig.call(this, say);
      if (!res) return res;
      this.running = true;
      try {
        await sleep(600);
        const extra = await BR.PerfDiag.run(say);
        res.text += '\n\n' + extra;
      } catch (e) { console.error(e); } finally { this.running = false; }
      this.last = res;
      return res;
    };
  }
})();
