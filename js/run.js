/* The run: clock loop, fuse HUD, input, turns, Rush Mode, stages, power-ups, pause (with End Run) and results. */
(function () {
  const BR = (window.BR = window.BR || {});
  const { $, sleep, fmt } = BR;
  const S = () => BR.Storage.data;
  const CALLOUTS = [
    { n: 16, text: 'INSANE!', color: '#ff5fa8' },
    { n: 12, text: 'HUGE!', color: '#ff8a3d' },
    { n: 8, text: 'GREAT!', color: '#ffd66b' },
    { n: 5, text: 'NICE!', color: '#7ee8ff' },
  ];
  const PCOL = { hammer: '#ffb347', beam: '#7ae8ff', prism: '#d27aff' };

  const Run = {
    view: null, engine: null, token: 0, mode: 'rush', boosts: {},
    clock: false, busy: false, paused: false, modal: false, over: true, armed: null, leaving: false,
    pressed: false, hoverCell: null, hoverPlan: null, hoverVer: -1, hoverArmed: null, buffered: null, lastPointer: null,
    idleTimer: 0, popsThisRun: 0, last: 0, hb: 0, warned: false, sparkT: 0, perfN: 0, perfSum: 0, shownFuse: '', trackW: 300,

    /* ===================================================================== setup */
    init(app) {
      this.app = app;
      this.fx = app.fx;
      this.view = new BR.BoardView({ boardEl: $('board'), field: $('field'), wrap: $('boardWrap'), layer: $('fxlayer'), fx: this.fx, audio: BR.audio });
      BR.Router.register('run', { onShow: () => { BR.Skins.apply(); this.view.layout(); this.measure(); } });
      this.el = $('run');
      this.buildSlots();
      this.bind();
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.active && !this.over && !this.paused && !this.modal && this.clock) this.pause(true); });
      window.addEventListener('resize', () => this.measure());
      requestAnimationFrame((t) => { this.last = t; this.frame(t); });
    },
    get active() { return BR.Router.current === 'run'; },
    get canAct() { return this.active && !this.over && !this.paused && !this.modal && this.clock; },
    measure() { const t = $('fuseTrack'); if (t && t.clientWidth) this.trackW = t.clientWidth; },

    buildSlots() {
      $('slots').innerHTML = BR.BOOSTER_ORDER.map((id) => `<button class="bslot empty" data-b="${id}" aria-label="${BR.BOOSTERS[id].name}: ${BR.BOOSTERS[id].desc}">${BR.powerIcon(id)}<span class="bname">${BR.BOOSTERS[id].name}</span><em class="bcount">0</em></button>`).join('');
      this.slotEls = {};
      $('slots').querySelectorAll('.bslot').forEach((el) => { this.slotEls[el.dataset.b] = el; });
    },

    bind() {
      const view = this.view, el = view.boardEl;
      $('btnPause').addEventListener('click', () => { BR.audio.ui(); BR.haptic('tap'); this.pause(); });
      $('slots').addEventListener('click', (e) => { const b = e.target.closest('.bslot'); if (b) { BR.audio.unlock(); this.onSlot(b.dataset.b); } });
      el.addEventListener('pointerdown', (e) => {
        if (e.button != null && e.button > 0) return;
        this.pressed = true;
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        this.markActive();
        this.updateHover(e);
      });
      el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || this.pressed) this.updateHover(e); });
      el.addEventListener('pointerup', (e) => {
        if (!this.pressed) return;
        this.pressed = false;
        const cell = view.cellAt(e.clientX, e.clientY);
        if (cell) this.tap(cell.r, cell.c); else this.clearHover();
        if (e.pointerType !== 'mouse') this.clearHover();
      });
      el.addEventListener('pointercancel', () => { this.pressed = false; this.clearHover(); });
      el.addEventListener('pointerleave', (e) => { if (!this.pressed && e.pointerType === 'mouse') this.clearHover(); });
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.armed) this.disarm(); });
      window.addEventListener('keydown', (e) => {
        if (!this.active || this.over || this.modal) return;
        if (e.key === 'p' || e.key === 'P') { if (!this.paused) this.pause(); }
        else if (e.key === 'Escape' && this.armed) this.disarm();
        else if (this.canAct && ['1', '2', '3'].includes(e.key)) this.onSlot(BR.BOOSTER_ORDER[+e.key - 1]);
      });
    },

    /* ===================================================================== starting / resuming */
    start(opts) {
      const mode = opts.mode, boosts = opts.boosts || {};
      const st = S();
      if (mode === 'daily') { st.daily = { day: BR.dayKey(), score: 0, stage: 0 }; BR.Storage.save(); }
      const tutorial = !st.seenTutorial && mode === 'rush';
      const seed = mode === 'daily' ? BR.dailySeed('d' + BR.dayKey()) : undefined;
      const engine = new BR.Engine({ mode, seed, boosts, startHammer: tutorial });
      BR.Storage.clearRun();
      return this.begin(engine, { tutorial });
    },
    resume() {
      const snap = BR.Storage.loadRun();
      if (!snap) return;
      const engine = new BR.Engine({ mode: snap.mode, seed: snap.seed, boosts: snap.boosts || {}, snapshot: snap });
      return this.begin(engine, { resumed: true });
    },

    async begin(engine, o = {}) {
      const token = ++this.token;
      this.engine = engine; this.mode = engine.mode; this.boosts = engine.boosts;
      this.clock = false; this.busy = true; this.paused = false; this.modal = false; this.over = false; this.leaving = false;
      this.armed = null; this.buffered = null; this.popsThisRun = 0; this.tutorial = !!o.tutorial; this.warned = false; this.hb = 0;
      this.el.classList.toggle('chill', engine.chill);
      this.el.classList.remove('rushing', 'sparking'); $('lastSpark').classList.remove('on');
      this.bestBase = S().best[this.mode] || 0; this.beatFired = false; this.chillStars = 0;
      $('warnVignette').classList.remove('on');
      const rush = !engine.chill;
      this.view.tune = { fall: rush ? 0.82 : 1, pop: rush ? 0.75 : 1 };
      this.view.reduced = BR.reducedMotion;
      this.hudAll(false);
      BR.Router.go('run', { instant: true });
      BR.Skins.apply();
      this.view.layout(); this.measure();
      BR.audio.start();
      if (BR.Music) { BR.Music.setStage(engine.stage); BR.Music.setRush(false); BR.Music.start(); }
      await sleep(this.view.reduced ? 50 : 300);
      this.view.layout(); this.measure();
      const ok = await this.view.build(engine.board);
      if (!ok || token !== this.token) return;
      // ready... go
      this.callout(o.resumed ? `Stage ${engine.stage}` : this.mode === 'daily' ? 'Daily Rush' : this.mode === 'chill' ? 'Chill' : 'Get ready', '#8fc2ff');
      await sleep(this.view.reduced ? 100 : 650);
      if (token !== this.token) return;
      BR.audio.go(); BR.haptic('tap');
      this.callout('GO!', '#ffd66b');
      this.busy = false; this.clock = true;
      if (this.tutorial) { this.hint('<b>Tap</b> a group of 2 or more matching bricks', 0); this.view.showHint(engine.bestGroup()); }
      this.armIdle(this.tutorial ? 1800 : 5000);
      this.saveSnap();
    },

    saveSnap() { if (this.engine && !this.engine.over && !this.engine.chill) BR.Storage.saveRun(this.engine.snapshot()); },

    /* ===================================================================== per-frame loop */
    frame(now) {
      requestAnimationFrame((t) => this.frame(t));
      const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000)); this.last = now;
      if (!this.active || !this.engine) return;
      // performance probe: lower effects automatically if the phone is struggling
      if (this.clock && !this.paused && BR.Storage.data.settings.perf === 'auto' && !BR.autoLow) {
        this.perfSum += dt; this.perfN++;
        if (this.perfN >= 180) { if (this.perfSum / this.perfN > 0.026) { BR.autoLow = true; BR.App.applySettings(); } this.perfN = 0; this.perfSum = 0; }
      }
      const e = this.engine;
      if (this.clock && !this.paused && !this.modal && !this.over) {
        const events = e.tick(dt);
        for (const ev of events) {
          if (ev.type === 'rushEnd') this.rushEnd();
          else if (ev.type === 'spark') this.sparkStart();
          else if (ev.type === 'fuseOut') this.endRun('fuse');
        }
        if (e.spark > 0) this.sparkTick();
      }
      if (!e.chill) this.hudFuse(dt);
    },

    /** Last Spark: the fuse hit zero. One short window to land a pop of 4 or more. */
    sparkStart() {
      const e = this.engine;
      this.el.classList.add('sparking');
      $('lastSpark').classList.add('on');
      BR.audio.lastSpark && BR.audio.lastSpark(); BR.haptic('boom');
      this.fx.flash('#ff4d6d', 0.3, 360); this.fx.shake($('app'), 10, 360);
      if (BR.Music && BR.Music.duck) BR.Music.duck(true);
      this.hideHint(); this.view.showHint(e.bestGroup());
    },
    sparkTick() {
      const e = this.engine;
      $('lsFill').style.transform = `scaleX(${Math.max(0, e.spark / BR.CFG.fuse.spark).toFixed(3)})`;
      this.hb -= 0.016;
      if (this.hb <= 0) { BR.audio.heartbeat(1); BR.haptic('tick'); this.hb = 0.3; }
    },
    sparkEnd(saved) {
      this.el.classList.remove('sparking');
      $('lastSpark').classList.remove('on');
      this.view.hideHint();
      if (BR.Music && BR.Music.duck) BR.Music.duck(false);
      if (saved) {
        BR.audio.lastSparkSave && BR.audio.lastSparkSave(); BR.haptic('win');
        this.callout('RELIT!', '#ffd66b'); this.fx.flash('#ffd66b', 0.3, 400);
        const r = $('spark').getBoundingClientRect(); this.fx.explosion(r.left + r.width / 2, r.top + r.height / 2, '#ffb02e', 1.2);
        this.fuseFloat(`+${BR.CFG.fuse.sparkFuse}s`, '#ffe58a');
      }
    },

    hudFuse(dt) {
      const e = this.engine, fuse = $('fuse');
      const f = Math.max(0, Math.min(1, e.fuse / e.fuseMax));
      $('fuseFill').style.transform = `scaleX(${f.toFixed(4)})`;
      const x = -6 + (this.trackW + 6) * f;
      $('spark').style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
      const txt = e.fuse.toFixed(1);
      if (txt !== this.shownFuse) { this.shownFuse = txt; $('fuseTime').textContent = txt; }
      const frozen = e.rush.active || e.freeze > 0;
      const crit = e.fuse <= BR.CFG.fuse.critical && !frozen && !e.over;
      fuse.classList.toggle('low', f <= BR.CFG.fuse.lowFrac && !frozen);
      fuse.classList.toggle('crit', crit);
      fuse.classList.toggle('frozen', frozen);
      $('warnVignette').classList.toggle('on', crit && !this.paused);
      // the music turns tense when the fuse is low, and the last ten seconds tick once a second
      if (BR.Music && BR.Music.setLow) BR.Music.setLow(f <= BR.CFG.fuse.lowFrac && !frozen && !e.over && this.clock && !this.paused);
      if (this.clock && !this.paused && !frozen && !e.over && e.fuse > 0 && e.fuse < 10) {
        const sec = Math.ceil(e.fuse);
        if (sec !== this.tickSec) { this.tickSec = sec; if (BR.audio.fuseTick) BR.audio.fuseTick(sec); }
      } else this.tickSec = 0;
      // heartbeat + one-time warning
      if (crit && this.clock && !this.paused) {
        this.hb -= dt;
        if (this.hb <= 0) { BR.audio.heartbeat(1); BR.haptic('tick'); this.hb = 0.32 + 0.5 * (e.fuse / BR.CFG.fuse.critical); }
        if (!this.warned) { this.warned = true; this.callout('FUSE!', '#ff4d6d'); }
      } else if (e.fuse > BR.CFG.fuse.critical + 1) this.warned = false;
      // rush meter
      const R = BR.CFG.rush, bar = $('rushBar');
      if (e.rush.active) { $('rushFill').style.width = Math.min(100, (e.rush.left / R.time) * 100).toFixed(1) + '%'; $('rushLabel').textContent = `RUSH x${R.mult}  ${e.rush.left.toFixed(1)}s`; }
      else { $('rushFill').style.width = e.rush.meter.toFixed(1) + '%'; if ($('rushLabel').textContent !== 'RUSH') $('rushLabel').textContent = 'RUSH'; }
      bar.classList.toggle('hot', e.rush.meter >= 70 && !e.rush.active);
      // spark particles
      if (this.clock && !this.paused && !BR.lowEnd && !frozen) {
        this.sparkT -= dt;
        if (this.sparkT <= 0) { this.sparkT = 0.05; const r = $('spark').getBoundingClientRect(); this.fx.emit({ kind: 'spark', x: r.left + r.width / 2, y: r.top + r.height / 2, vx: (Math.random() - 0.5) * 80, vy: -30 - Math.random() * 90, g: 160, drag: 1.5, size: 1.2 + Math.random() * 2, max: 0.35 + Math.random() * 0.3, color: Math.random() < 0.5 ? '#ffd24a' : '#ff8a3d' }); }
      }
    },

    /* ===================================================================== HUD */
    hudAll(animate) {
      const e = this.engine;
      this.setScore(e.score, false);
      $('stageNum').textContent = e.stage;
      this.setMult(false);
      this.hudStageBar(false);
      this.renderPower(null);
      $('chargeFill').style.width = (e.charge / BR.CFG.power.charge) * 100 + '%';
      $('rushFill').style.width = '0%';
      this.shownFuse = '';
      if (e.chill) this.hudChill(false);
      else this.hudFuse(0);
      void animate;
    },
    setScore(v, animate = true) {
      const el = $('score');
      if (animate) BR.countTo(el, v, 450); else { el.textContent = fmt(v); BR.countTo(el, v, 0, v); }
      this.bestRefresh(v, animate);
    },
    /** The score to beat: a bar under the score that fills toward your best, pulses when it is close, turns gold when beaten. */
    bestRefresh(score, announce) {
      const base = this.bestBase, el = $('bestLine');
      if (!(base > 0)) { el.className = 'best-line none'; return; }
      const f = Math.min(1, score / base);
      $('bestFill').style.width = (f * 100).toFixed(1) + '%';
      if (score >= base) {
        el.className = 'best-line beat'; $('bestText').textContent = 'NEW BEST!';
        if (!this.beatFired && announce !== false) {
          this.beatFired = true;
          BR.audio.newBest(); BR.haptic('win'); this.callout('NEW BEST!', '#ffd66b'); this.fx.confetti(['#ffd66b', '#ff3d8b', '#3de1ff', '#fff'], 50, -20);
        }
      } else if (f >= 0.8) { el.className = 'best-line close'; $('bestText').textContent = `${fmt(base - score)} to beat`; }
      else { el.className = 'best-line'; $('bestText').textContent = `BEST ${fmt(base)}`; }
    },
    setMult(slam) {
      const e = this.engine, m = e.chill ? 1 : BR.stageMult(e.stage);
      const t = $('multTag'); t.textContent = 'x' + m.toFixed(1);
      if (slam) { t.classList.remove('slam'); void t.offsetWidth; t.classList.add('slam'); }
    },
    hudStageBar(animate = true) {
      const e = this.engine, f = $('stageFill');
      if (!animate) f.style.transition = 'none';
      f.style.width = Math.max(0, Math.min(100, (e.stageScore / e.goal) * 100)).toFixed(1) + '%';
      if (!animate) { void f.offsetWidth; f.style.transition = ''; }
    },
    hudChill(animate = true) {
      const e = this.engine;
      $('movesNum').textContent = e.movesLeft;
      const f = $('chillFill');
      if (!animate) f.style.transition = 'none';
      f.style.width = Math.min(100, (e.stageScore / e.goal) * 100) + '%';
      if (!animate) { void f.offsetWidth; f.style.transition = ''; }
      $('chillText').textContent = e.stageScore >= e.goal ? 'Goal reached!' : `${fmt(e.stageScore)} / ${fmt(e.goal)}`;
      $('stageNum').textContent = e.stage;
    },
    renderPower(gained) {
      const e = this.engine;
      for (const id of BR.BOOSTER_ORDER) {
        const el = this.slotEls[id];
        el.querySelector('.bcount').textContent = e.inv[id];
        el.classList.toggle('empty', e.inv[id] <= 0);
        el.classList.toggle('armed', this.armed === id);
        if (gained && gained.includes(id)) { el.classList.remove('gain'); void el.offsetWidth; el.classList.add('gain'); }
      }
    },
    callout(text, color) {
      const el = BR.el(`<div class="callout">${text}</div>`);
      el.style.setProperty('--cc', color || '#ffd66b');
      $('fxlayer').appendChild(el);
      const a = el.animate([
        { transform: 'translate(-50%,-50%) scale(0.3) rotate(-6deg)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1.22) rotate(2deg)', opacity: 1, offset: 0.22 },
        { transform: 'translate(-50%,-56%) scale(1) rotate(0)', opacity: 1, offset: 0.62 },
        { transform: 'translate(-50%,-110%) scale(0.9)', opacity: 0 },
      ], { duration: BR.reducedMotion ? 700 : 1100, easing: 'cubic-bezier(0.2,0.8,0.3,1)', fill: 'both' });
      a.onfinish = () => el.remove();
    },
    floatText(text, x, y, o = {}) {
      const el = BR.el(`<div class="float">${text}</div>`);
      el.style.fontSize = (o.size || 22) + 'px'; el.style.color = o.color || '#fff';
      if (o.glow) el.style.setProperty('--fc', o.glow);
      el.style.left = x + 'px'; el.style.top = y + 'px';
      $('fxlayer').appendChild(el);
      const a = el.animate([
        { transform: 'translate(-50%,-50%) scale(0.4)', opacity: 0 },
        { transform: 'translate(-50%,-62%) scale(1.18)', opacity: 1, offset: 0.16 },
        { transform: 'translate(-50%,-68%) scale(1)', opacity: 1, offset: 0.4 },
        { transform: `translate(-50%,calc(-50% - ${o.rise || 56}px)) scale(0.96)`, opacity: 0 },
      ], { duration: BR.reducedMotion ? 600 : o.dur || 950, delay: o.delay || 0, easing: 'cubic-bezier(0.2,0.7,0.3,1)', fill: 'both' });
      a.onfinish = () => el.remove();
    },
    /** A floating "+1.8s" that rises from the fuse's burning tip. */
    fuseFloat(text, color) {
      const run = this.el.getBoundingClientRect(), sp = $('spark').getBoundingClientRect();
      const el = BR.el(`<div class="fuse-float" style="color:${color}">${text}</div>`);
      el.style.left = (sp.left - run.left + sp.width / 2) + 'px'; el.style.top = (sp.top - run.top) + 'px';
      this.el.appendChild(el);
      const a = el.animate([{ transform: 'translate(-50%,0) scale(0.6)', opacity: 0 }, { transform: 'translate(-50%,-14px) scale(1.15)', opacity: 1, offset: 0.2 }, { transform: 'translate(-50%,-38px) scale(1)', opacity: 0 }], { duration: 900, easing: 'ease-out', fill: 'forwards' });
      a.onfinish = () => el.remove();
      const f = $('fuse'); f.classList.remove('gain'); void f.offsetWidth; f.classList.add('gain');
    },
    hint(html, ms = 4200) {
      const h = $('hint'); clearTimeout(this.hintT);
      h.innerHTML = html; h.classList.add('show');
      if (ms) this.hintT = setTimeout(() => h.classList.remove('show'), ms);
    },
    hideHint() { clearTimeout(this.hintT); $('hint').classList.remove('show'); },
    setCombo(streak, mult, popped) {
      const c = $('combo');
      if (streak >= 2) {
        $('comboX').textContent = 'x' + (Number.isInteger(mult) ? mult : mult.toFixed(1));
        c.classList.add('show'); c.classList.toggle('hot', mult >= 2.5); c.classList.toggle('max', mult >= 4);
        if (popped) { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
        this.comboOn = true;
      } else if (this.comboOn) { c.classList.remove('show', 'hot', 'max', 'pop'); this.comboOn = false; }
    },

    /* ===================================================================== input */
    updateHover(e) {
      this.lastPointer = { clientX: e.clientX, clientY: e.clientY, pointerType: e.pointerType };
      if (!this.canAct || this.busy) { this.clearHover(); return; }
      const cell = this.view.cellAt(e.clientX, e.clientY);
      if (!cell) { this.clearHover(); return; }
      const ver = this.engine.board.version;
      if (this.hoverCell && this.hoverCell.r === cell.r && this.hoverCell.c === cell.c && this.hoverVer === ver && this.hoverArmed === this.armed) return;
      this.hoverCell = cell; this.hoverVer = ver; this.hoverArmed = this.armed;
      if (this.armed) {
        const cells = this.engine.boosterCells(this.armed, cell.r, cell.c);
        this.hoverPlan = null;
        this.view.setCellHighlight(cells, cells.length ? `${cells.length} bricks` : '');
      } else { this.hoverPlan = this.engine.plan(cell.r, cell.c); this.view.setHighlight(this.hoverPlan); }
    },
    refreshHover() { const lp = this.lastPointer; if (lp && lp.pointerType === 'mouse' && this.canAct && !this.busy) this.updateHover(lp); },
    clearHover() { this.hoverCell = null; this.hoverPlan = null; this.view.setHighlight(null); },
    markActive() { this.view.hideHint(); this.armIdle(5000); },
    armIdle(ms) {
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => { if (this.canAct && !this.busy && !this.armed) this.view.showHint(this.engine.bestGroup()); }, ms);
    },

    async tap(r, c) {
      if (!this.canAct) return;
      if (this.busy) { this.buffered = { r, c, t: performance.now() }; return; }
      const e = this.engine;
      if (this.armed) { await this.usePower(this.armed, r, c); return; }
      const hp = this.hoverPlan;
      const plan = hp && hp.r === r && hp.c === c && hp.version === e.board.version ? hp : e.plan(r, c);
      if (!plan) { this.view.reject(r, c); BR.audio.deny(); BR.haptic('err'); this.clearHover(); return; }
      await this.guarded((t) => this.runTurn(plan, t));
    },
    flushBuffer() { const b = this.buffered; this.buffered = null; if (b && performance.now() - b.t < 800) this.tap(b.r, b.c); },
    async guarded(fn) {
      const token = this.token;
      try { await fn(token); } catch (err) {
        console.error(err);
        if (token === this.token) { this.busy = false; this.modal = false; this.view.syncTo(this.engine.board); this.hudAll(false); }
      }
    },

    /* ===================================================================== power-ups */
    onSlot(type) {
      if (!this.canAct || this.busy) return;
      const e = this.engine;
      if (e.inv[type] <= 0) { BR.audio.deny(); BR.haptic('err'); this.hint('Pops of 4+ fill the bar. Every full bar earns a power-up.', 3200); return; }
      if (this.armed === type) { this.disarm(); return; }
      this.armed = type; BR.audio.boosterArm(); BR.haptic('tap');
      this.clearHover(); this.view.hideHint(); this.hideHint();
      this.renderPower(null);
      this.aimBanner(BR.BOOSTERS[type].aim, PCOL[type]);
      if (this.lastPointer && this.lastPointer.pointerType === 'mouse') this.updateHover(this.lastPointer);
    },
    disarm() { this.armed = null; this.clearHover(); this.aimBanner(''); this.renderPower(null); },
    aimBanner(text, color) {
      const b = $('aimBanner'); b.textContent = text || ''; b.style.setProperty('--bc', color || '');
      b.classList.toggle('show', !!text); $('boardWrap').classList.toggle('aiming', !!text); $('boardWrap').style.setProperty('--bc', color || '');
    },
    async usePower(type, r, c) {
      const e = this.engine;
      if (!e.board.get(r, c)) return;
      this.busy = true; this.clearHover(); this.view.hideHint(); this.hideHint();
      const res = e.applyBooster(type, r, c);
      this.armed = null; this.aimBanner('');
      if (!res) { this.busy = false; this.renderPower(null); return; }
      this.renderPower(null);
      await this.guarded(async (token) => {
        this.powerFeedback(res);
        const ok = await this.view.playResult(res);
        if (!ok || token !== this.token) return;
        await this.afterAction(res, token);
      });
    },
    powerFeedback(res) {
      const e = this.engine, p = res.plan, view = this.view;
      BR.audio.boosterUse(res.type); BR.haptic('big');
      this.setScore(e.score); this.hudStageBar();
      const pos = view.layerPoint(res.tap.r, res.tap.c);
      this.floatText('+' + fmt(p.points), pos.x, pos.y, { size: 30, color: PCOL[res.type], glow: PCOL[res.type] });
      this.callout(BR.BOOSTERS[res.type].name.toUpperCase() + '!', PCOL[res.type]);
      const pt = view.pagePoint(res.tap.r, res.tap.c);
      this.fx.flash(PCOL[res.type], 0.28, 380);
      this.fx.shake($('app'), res.type === 'hammer' ? 13 : 9, 420);
      if (res.type === 'hammer') this.fx.explosion(pt.x, pt.y, '#ffb347', 1.1);
      else if (res.type === 'beam') { this.beam('row', res.tap.r, '#7ae8ff'); this.beam('col', res.tap.c, '#7ae8ff'); }
      else { this.fx.ring(pt.x, pt.y, '#d27aff', 160, 0.7, 6); res.removed.slice(0, 14).forEach((q, i) => { const t = view.pagePoint(q.r, q.c); setTimeout(() => this.fx.bolt(pt.x, pt.y, t.x, t.y, BR.PALETTE[q.color].hi), i * 22); }); }
      if (res.timeGain) { this.fuseFloat(`+${res.timeGain.toFixed(1)}s`, '#7ee8ff'); }
    },

    /* ===================================================================== one turn */
    async runTurn(plan, token) {
      this.busy = true; this.clearHover(); this.view.hideHint();
      const e = this.engine;
      const res = e.commit(plan);
      if (!res) { this.busy = false; return; }
      this.popsThisRun++;
      this.feedback(res);
      const ok = await this.view.playResult(res);
      if (!ok || token !== this.token) return;
      await this.afterAction(res, token);
    },

    async afterAction(res, token) {
      const e = this.engine;
      if (e.over) { await this.endRun(e.endReason === 'fuse' ? 'fuse' : 'ended'); return; }
      if (e.chill) {
        if (e.stageCleared()) { await this.chillClear(token); if (token !== this.token) return; }
        else if (e.outOfMoves()) { await this.endRun('moves'); return; }
      }
      this.renderPower(null);
      this.busy = false;
      this.armIdle(this.engine.rush.active ? 3000 : 5000);
      if (this.buffered) this.flushBuffer(); else this.refreshHover();
    },

    /** Everything the player should feel the instant a pop happens. */
    feedback(res) {
      const e = this.engine, p = res.plan, view = this.view, n = p.n;
      const flavor = BR.Skins.pop === 'classic' ? null : BR.Skins.pop;
      BR.audio.pop(n, e.streak, flavor);
      if (e.streak >= 2) BR.audio.combo(e.streak);
      BR.haptic(n >= 8 ? 'big' : 'pop');
      this.setScore(e.score);
      this.hudStageBar();
      if (e.chill) this.hudChill();
      $('chargeFill').style.width = (e.charge / BR.CFG.power.charge) * 100 + '%';
      this.setCombo(e.streak, BR.comboMult(e.streak), true);
      if (res.comboBefore >= 2 && e.streak < 2) this.callout('Combo lost', '#9aa8d6');
      if (res.boostersGained && res.boostersGained.length) {
        this.renderPower(res.boostersGained); BR.audio.boosterGain(); BR.haptic('stage');
        setTimeout(() => this.callout(BR.BOOSTERS[res.boostersGained[0]].name + ' ready!', PCOL[res.boostersGained[0]]), 250);
      } else this.renderPower(null);

      let sr = 0, sc = 0;
      p.primary.forEach((q) => { sr += q.r; sc += q.c; });
      sr /= n; sc /= n;
      const pos = view.layerPoint(sr, sc); pos.y -= view.cell * 0.15;
      this.floatText('+' + fmt(p.points), pos.x, pos.y, {
        size: Math.min(46, 20 + Math.log2(Math.max(2, p.points)) * 2), color: p.line ? '#9ff0ff' : n >= 8 ? '#ffd66b' : '#fff',
        glow: p.line ? 'rgba(80,220,255,.8)' : n >= 8 ? 'rgba(255,200,60,.8)' : 'rgba(255,255,255,.4)', rise: 50 + Math.min(40, n * 3),
      });
      if (p.combo > 1) this.floatText(`x${p.combo % 1 ? p.combo.toFixed(1) : p.combo} combo`, pos.x, pos.y + 24, { size: 14, color: '#ffb547', glow: 'rgba(255,150,40,.7)', rise: 40, delay: 90 });
      const co = p.line ? { text: 'LINE BLAST!', color: '#7ee8ff' } : CALLOUTS.find((c) => n >= c.n);
      if (co) this.callout(co.text, co.color);

      const pt = view.pagePoint(sr, sc);
      if (n >= 5) this.fx.ring(pt.x, pt.y, '#ffffff', 60 + n * 9, 0.5, 4);
      if (n >= 6) this.fx.shake($('app'), Math.min(11, 2 + n * 0.7), 300 + Math.min(300, n * 20));
      if (n >= 10) this.fx.flash('#ffffff', Math.min(0.28, n * 0.014), 280);
      if (p.line) {
        BR.audio.line(); BR.haptic('boom'); this.fx.flash('#9ff0ff', 0.3, 520); this.fx.shake($('app'), 12, 480);
        if (p.lineH) this.beam('row', p.r); if (p.lineV) this.beam('col', p.c);
      }
      if (res.shuffle.length) setTimeout(() => this.callout('Reshuffle', '#c4b5ff'), 700);

      // the fuse
      if (!e.chill) {
        if (res.timeGain > 0) { BR.audio.timeGain(Math.min(6, n)); this.fuseFloat(`+${res.timeGain.toFixed(1)}s`, '#ffe58a'); }
        if (res.defused) { BR.audio.defuse(); BR.haptic('stage'); setTimeout(() => this.fuseFloat(`+${(res.defused * BR.CFG.fuse.defuse).toFixed(0)}s`, '#3ddc97'), 200); this.callout('DEFUSED!', '#3ddc97'); }
        if (res.bursts && res.bursts.length) { BR.audio.burstFuse(); setTimeout(() => this.fuseFloat(`-${res.bursts.length * BR.CFG.fuse.burstPenalty}s`, '#ff4d6d'), 150); this.callout('FUSE BRICK!', '#ff4d6d'); }
        if (res.rushStart) this.rushStart();
        if (res.stageUp) this.stageUp(res.stageUp);
        if (res.spark) this.sparkStart();
        else if (this.el.classList.contains('sparking') && e.spark <= 0) this.sparkEnd(!!res.sparkSave);
        if (res.shuffleRefund) this.fuseFloat(`+${res.shuffleRefund}s`, '#c4b5ff');
      }
      if (BR.Skins.onEvent) BR.Skins.onEvent('pop', { res, view, run: this });
      if (p.line && BR.Skins.onEvent) BR.Skins.onEvent('line', { res, view, run: this });

      if (this.tutorial) {
        if (this.popsThisRun === 1) this.hint('Every pop adds time to the <b>fuse</b>. Bigger pops add more.', 4800);
        else if (this.popsThisRun === 4) this.hint('Chain pops of 4+ to fill the <b>Rush</b> bar below.', 5200);
        else if (this.popsThisRun === 8) { this.hint('Pops of 4+ also charge your <b>power-ups</b>. Tap one, then the board.', 5200); S().seenTutorial = true; BR.Storage.save(); this.tutorial = false; }
      }
    },

    beam(kind, idx, color) {
      color = color || BR.Skins.beam || '#9ff0ff';
      const v = this.view, cell = v.cell, p0 = v.layerPoint(0, 0), len = cell * BR.CFG.cols;
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;pointer-events:none;z-index:4;border-radius:999px;background:linear-gradient(90deg,transparent,#fff 18%,${color} 50%,#fff 82%,transparent);box-shadow:0 0 34px 10px ${color}99;`;
      if (kind === 'row') { el.style.left = p0.x - cell / 2 + 'px'; el.style.top = p0.y + idx * cell - cell * 0.32 + 'px'; el.style.width = len + 'px'; el.style.height = cell * 0.64 + 'px'; }
      else { el.style.background = `linear-gradient(180deg,transparent,#fff 18%,${color} 50%,#fff 82%,transparent)`; el.style.left = p0.x + idx * cell - cell * 0.32 + 'px'; el.style.top = p0.y - cell / 2 + 'px'; el.style.width = cell * 0.64 + 'px'; el.style.height = len + 'px'; }
      $('fxlayer').appendChild(el);
      const row = kind === 'row';
      const a = el.animate([{ transform: row ? 'scaleX(0) scaleY(0.2)' : 'scaleY(0) scaleX(0.2)', opacity: 1 }, { transform: 'scale(1,1)', opacity: 1, offset: 0.28 }, { transform: row ? 'scaleX(1) scaleY(0.05)' : 'scaleY(1) scaleX(0.05)', opacity: 0 }], { duration: 560, easing: 'cubic-bezier(0.2,0.8,0.3,1)', fill: 'forwards' });
      a.onfinish = () => el.remove();
    },

    /* ===================================================================== Rush Mode + stages */
    rushStart() {
      this.el.classList.add('rushing');
      BR.audio.rushStart(); BR.haptic('rush');
      const b = $('rushBanner'); b.classList.remove('go'); void b.offsetWidth; b.classList.add('go');
      this.fx.flash('#ff3d8b', 0.4, 600); this.fx.shake($('app'), 14, 600);
      const run = this.el.getBoundingClientRect();
      this.fx.confetti(['#ff3d8b', '#ffb23d', '#fff6c8', '#8a4dff'], 36, run.top);
      if (BR.Music) BR.Music.setRush(true);
      if (BR.Skins.onEvent) BR.Skins.onEvent('rushStart', { run: this, view: this.view });
      this.hideHint();
    },
    rushEnd() {
      this.el.classList.remove('rushing');
      BR.audio.rushEnd(); BR.haptic('tick');
      this.callout('Rush over', '#c4b5ff');
      if (BR.Music) BR.Music.setRush(false);
      if (BR.Skins.onEvent) BR.Skins.onEvent('rushEnd', { run: this });
    },
    stageUp(info) {
      const e = this.engine;
      BR.audio.stageUp(); BR.haptic('stage');
      $('swNum').textContent = info.to; $('swMult').textContent = 'x' + info.mult.toFixed(1);
      const w = $('stageWipe'); w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
      setTimeout(() => w.classList.remove('go'), 1300);
      $('stageNum').textContent = info.to;
      const t = $('stageTag'); t.classList.remove('slam'); void t.offsetWidth; t.classList.add('slam');
      this.setMult(true);
      setTimeout(() => this.hudStageBar(), 60);
      this.fx.flash('#ffffff', 0.35, 500); this.fx.shake($('app'), 10, 420);
      this.warned = false;
      if (BR.Music) { BR.Music.setStage(e.stage); BR.Music.stageUp(); }
      this.saveSnap();
      const C = BR.CFG.stage;
      if (info.to === C.sixthColor || info.to === C.seventhColor) setTimeout(() => this.hint('A <b>new brick color</b> joins the board', 3000), 900);
      else if (info.to === BR.CFG.fuseBrick.fromStage) setTimeout(() => this.hint('<b>Fuse bricks</b> are ticking. Pop them to defuse!', 3600), 900);
      if (BR.Skins.onEvent) BR.Skins.onEvent('stageUp', { run: this, info });
    },
    async chillClear(token) {
      const e = this.engine, view = this.view;
      view.setHighlight(null); view.hideHint();
      BR.audio.roundClear(); this.fx.flash('#ffe9a8', 0.25, 600);
      const left = e.movesLeft, stars = left >= 8 ? 3 : left >= 4 ? 2 : 1;
      this.callout(`Round ${e.stage} clear!  ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, '#ffd66b');
      this.chillStars = (this.chillStars || 0) + stars;
      await sleep(view.reduced ? 200 : 900);
      if (token !== this.token) return;
      if (e.movesLeft > 0) {
        const res = e.shatter();
        BR.audio.shatterBonus(); this.setScore(e.score);
        this.callout(`Move bonus +${fmt(res.bonus)}`, '#7ee8ff'); this.fx.shake($('app'), 10, 420);
        const ok = await view.playResult(res);
        if (!ok || token !== this.token) return;
      }
      e.nextRound();
      this.hudChill(); this.hudStageBar(false); $('stageNum').textContent = e.stage;
      await sleep(250);
      this.callout('Round ' + e.stage, '#8fc2ff');
    },

    /* ===================================================================== pause (with End Run) */
    pause(silent) {
      if (!this.active || this.over || this.paused || this.modal) return;
      this.paused = true; this.leaving = false;
      this.saveSnap();
      this.clearHover(); this.view.hideHint(); if (this.armed) this.disarm();
      if (BR.Music) BR.Music.duck(true);
      if (!silent) BR.audio.ui();
      const body = `<div class="stack pause-list">
        <button class="btn btn-xl" data-p="resume">${BR.icon('play')} Resume</button>
        <button class="btn btn-dark" data-p="restart">${BR.icon('reroll')} Restart</button>
        <button class="btn btn-dark" data-p="settings">${BR.icon('sound')} Sound and vibration</button>
        <button class="btn btn-dark" data-p="end">${BR.icon('flag')} End run</button>
        <button class="btn btn-text" data-p="leave">Save and leave</button></div>`;
      const sh = BR.Sheet.open({ center: true, title: 'Paused', body, dismissable: true, onClose: () => { this.paused = false; if (BR.Music) BR.Music.duck(false); if (!this.leaving && !this.over) this.armIdle(4000); } });
      sh.el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-p]'); if (!b) return;
        const k = b.dataset.p;
        BR.audio.ui(); BR.haptic('tap');
        if (k === 'resume') sh.close();
        else if (k === 'settings') this.quickSettings();
        else if (k === 'end') this.confirmEnd(sh);
        else if (k === 'restart') { this.leaving = true; sh.close(); this.bankSilently(); setTimeout(() => this.start({ mode: this.mode === 'daily' ? 'rush' : this.mode, boosts: {} }), 350); }
        else if (k === 'leave') { this.leaving = true; sh.close(); this.saveSnap(); this.exitToHome(); }
      });
    },
    confirmEnd(pauseSheet) {
      BR.Sheet.open({
        center: true, title: 'End this run?',
        body: '<p class="ready-sub">Your score and Coins are kept. Your run ends now.</p>',
        actions: [
          { label: 'Keep playing', cls: 'btn-dark', onClick: () => {} },
          { label: 'End run', cls: '', onClick: () => { this.leaving = true; pauseSheet.close(); setTimeout(() => this.endRun('ended'), 300); } },
        ],
        row: true,
      });
    },
    quickSettings() {
      const s = S().settings;
      const tog = (k, l, sub) => `<label class="toggle"><span><b>${l}</b><small>${sub}</small></span><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}><i></i></label>`;
      const sh = BR.Sheet.open({ title: 'Sound and vibration', body: tog('sound', 'Sound effects', 'Pops, chests and the fuse') + tog('music', 'Music', 'The beat speeds up with the fuse') + tog('haptics', 'Vibration', 'Buzz on pops') + tog('shake', 'Screen shake', 'Impact on big pops') });
      sh.el.addEventListener('change', (e) => { const k = e.target.dataset.set; if (k) { S().settings[k] = e.target.checked; BR.Storage.save(); this.app.applySettings(); if (k === 'music' && e.target.checked) BR.Music.start(); } });
    },
    /** Bank XP, Coins and stats for a run that is being abandoned (restart). */
    bankSilently() {
      if (!this.engine || this.over || this.engine.stats.pops === 0) { BR.Storage.clearRun(); return; }
      this.over = true; this.clock = false;
      this.finalize(this.engine.summary(), 'ended', true);
      BR.Storage.clearRun();
    },
    exitToHome() {
      this.over = true; this.clock = false; this.token++;
      BR.Router.go('home');
    },

    /* ===================================================================== ending + results */
    async endRun(reason) {
      if (this.over && this.ending) return;
      const token = this.token;
      this.over = true; this.ending = true; this.clock = false; this.busy = true;
      this.clearHover(); this.view.hideHint(); this.hideHint(); this.aimBanner(''); this.armed = null;
      $('warnVignette').classList.remove('on'); $('lastSpark').classList.remove('on');
      if (this.el.classList.contains('rushing') && BR.Skins.onEvent) BR.Skins.onEvent('rushEnd', { run: this });   // so Rush-only moments clean up
      this.el.classList.remove('rushing', 'sparking');
      if (BR.Music) BR.Music.stop();
      const e = this.engine;
      if (reason === 'fuse') {
        // the bomb goes off
        BR.audio.fuseOut(); BR.haptic('boom');
        const bomb = $('bomb').getBoundingClientRect();
        this.fx.flash('#ffffff', 0.9, 700);
        this.fx.explosion(bomb.left + bomb.width / 2, bomb.top + bomb.height / 2, '#ff7a4d', 1.8);
        this.fx.shake($('app'), 22, 900);
        $('bomb').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.8)', opacity: 0.9, offset: 0.25 }, { transform: 'scale(0.2)', opacity: 0 }], { duration: 650, fill: 'forwards', easing: 'ease-out' });
        this.callout('FUSE OUT!', '#ff4d6d');
        await sleep(this.view.reduced ? 250 : 900);
        await this.view.crumble();
      } else if (reason === 'moves') {
        BR.audio.gameOver(); this.callout('Out of moves', '#ff8b99');
        await sleep(this.view.reduced ? 200 : 650); await this.view.crumble();
      } else { BR.audio.gameOver(); await sleep(250); }
      if (token !== this.token) return;
      const sum = e.summary();
      const res = this.finalize(sum, reason, false);
      BR.Storage.clearRun();
      this.ending = false;
      this.showResults(sum, res, reason);
    },

    /** Pay out a finished run: Coins, XP, missions, scores, trophies. Returns what the results screen shows. */
    finalize(sum, reason, silent) {
      const st = S(), P = BR.Progress, mode = this.mode, e = this.engine;
      const daily = mode === 'daily';
      const today = BR.dayKey();
      const firstOfDay = st.lastDay !== today; if (firstOfDay) st.lastDay = today;
      const coins = P.runCoins(sum, { daily, firstOfDay });
      P.earn(coins.total);
      const prevBest = st.best[mode];
      const isBest = sum.score > prevBest;
      const rec = (st.recent[mode] = st.recent[mode] || []);
      const par = rec.length ? Math.round(rec.reduce((a, b) => a + b, 0) / rec.length) : 0;
      rec.push(sum.score); while (rec.length > 5) rec.shift();
      if (isBest) st.best[mode] = sum.score;
      st.bestStage[mode] = Math.max(st.bestStage[mode], sum.stage);
      if (daily) { st.daily.score = sum.score; st.daily.stage = sum.stage; }
      st.runs++;
      const rows = P.runXpRows(sum, { daily, isBest: isBest && sum.score > 0, firstOfDay });
      const xp = P.addXp(rows.reduce((a, r) => a + r.xp, 0));
      P.trackRun(sum, mode);
      const missions = BR.Missions.applyRun(sum, mode);
      const trophies = P.checkTrophies();
      BR.Storage.save();
      void e; void reason; void silent;
      return { coins, isBest, rows, xp, missions, trophies, daily, prevBest, par };
    },

    showResults(sum, r, reason) {
      this.modal = true;
      const mode = this.mode, P = BR.Progress;
      const titles = { fuse: 'FUSE OUT!', moves: 'OUT OF MOVES', ended: 'RUN OVER' };
      const canShop = BR.CHEST_ORDER.some((id) => P.canOpen(id));
      const mis = r.missions.map((m) => `<div class="res-mis rev ${m.justDone ? 'done' : ''}"><div class="t"><span>${m.justDone ? BR.icon('check', 'ck') + ' ' : ''}${BR.esc(m.mission.text)}</span><b>${m.justDone ? '+' + m.mission.reward + ' Coins' : fmt(m.after) + '/' + fmt(m.mission.target)}</b></div><div class="bar ${m.weekly ? 'gold' : 'green'}"><i data-to="${(m.after / m.mission.target) * 100}" style="width:${(m.before / m.mission.target) * 100}%"></i></div></div>`).join('');
      const ups = r.xp.ups.map((u) => `<div class="lvl-up rev"><span class="lu-n">${u.level}</span><span class="lu-t"><b>Level ${u.level}!</b><small>Pop Pass reward</small></span><span class="lu-rw">${BR.rewardChip(u.reward)}</span></div>`).join('');
      const trophies = r.trophies.map((t) => `<div class="lvl-up rev"><span class="lu-n">${BR.icon('trophy')}</span><span class="lu-t"><b>${t.name}</b><small>Trophy earned · +${t.coins} Coins</small></span></div>`).join('');
      let chase = '';
      if (r.isBest && sum.score > 0) chase = `<div class="new-best rev">New best</div>${r.prevBest > 0 ? `<div class="res-gap rev good">${fmt(sum.score - r.prevBest)} more than your old best</div>` : ''}`;
      else if (r.prevBest > 0) {
        const gap = r.prevBest - sum.score, near = sum.score >= r.prevBest * 0.85;
        chase = `<div class="res-gap rev ${near ? 'near' : ''}">${near ? `So close: ${fmt(gap)} short of your best` : `Your best is ${fmt(r.prevBest)}`}</div>`;
      }
      if (mode === 'daily' && r.par > 0) chase += `<div class="res-gap rev ${sum.score >= r.par ? 'good' : ''}">${sum.score >= r.par ? 'Above' : 'Below'} your par of ${fmt(r.par)}</div>`;
      const beatIt = !r.isBest && r.prevBest > 0 && mode !== 'daily';
      const html = `<div class="results" id="results"><div class="res-scroll">
          <div class="res-title out rev">${titles[reason] || 'RUN OVER'}</div>
          <div class="res-sub rev">${mode === 'daily' ? 'Daily Rush' : mode === 'chill' ? 'Chill' : 'Rush'} · Stage ${sum.stage} · ${Math.floor(sum.time / 60)}:${String(Math.floor(sum.time % 60)).padStart(2, '0')}</div>
          <div class="res-score rev"><small>Score</small><b id="resScore">0</b></div>
          ${chase}
          <div class="res-chips rev"><div class="res-chip"><b>${sum.stagesCleared}</b><small>Stages cleared</small></div><div class="res-chip"><b>${sum.biggest}</b><small>Biggest pop</small></div><div class="res-chip"><b>${sum.rushes}</b><small>Rush Modes</small></div></div>
          <div class="res-card rev"><h3>Coins <span class="coins-total">${BR.coin()}<b id="resCoins">0</b></span></h3>
            <div class="res-row"><span>Points</span><b>${r.coins.points}</b></div><div class="res-row"><span>Stages cleared</span><b>${r.coins.stages}</b></div>
            ${r.coins.daily ? `<div class="res-row"><span>Daily Rush</span><b>+${r.coins.daily}</b></div>` : ''}${r.coins.first ? `<div class="res-row"><span>First run of the day</span><b>+${r.coins.first}</b></div>` : ''}</div>
          ${mis ? `<div class="res-card rev"><h3>Missions</h3>${mis}</div>` : ''}
          <div class="res-card rev"><h3>XP <span class="muted num">+${fmt(r.rows.reduce((a, x) => a + x.xp, 0))}</span></h3>
            ${r.rows.map((x) => `<div class="res-row"><span>${BR.esc(x.label)}</span><b>+${fmt(x.xp)}</b></div>`).join('')}
            <div class="xp-line"><div class="bar tall cyan"><i id="resXp" style="width:${(r.xp.from.xp / r.xp.from.need) * 100}%"></i></div><small class="num" id="resXpText">Level ${r.xp.from.level} · ${fmt(r.xp.from.xp)} / ${fmt(r.xp.from.need)}</small></div></div>
          ${ups}${trophies}
        </div>
        <div class="res-actions rev">
          ${mode === 'daily' ? `<button class="btn btn-xl" data-r="share">${BR.icon('share')} Share result</button>` : `<button class="btn btn-xl" data-r="again">${BR.icon('play')} ${beatIt ? 'Beat it' : 'Play again'}</button>`}
          <div class="row">${canShop ? `<button class="btn btn-gold" data-r="shop">${BR.icon('gift')} Open a chest</button>` : ''}<button class="btn btn-dark" data-r="home">Home</button></div>
        </div></div>`;
      const host = $('layer-overlays');
      const node = BR.el(html);
      host.appendChild(node);
      host.style.pointerEvents = 'auto';
      this.resultsEl = node;
      if (BR.Music && BR.Music.resultsSting) BR.Music.resultsSting();
      requestAnimationFrame(() => node.classList.add('on'));
      BR.Router.setTabs(false);
      // choreography
      const revs = node.querySelectorAll('.rev');
      const step = BR.reducedMotion ? 0 : 140;
      revs.forEach((n, i) => setTimeout(() => n.classList.add('in'), 250 + i * step));
      setTimeout(() => { BR.countTo($('resScore'), sum.score, BR.reducedMotion ? 10 : 1300, 0); BR.audio.xpTick(0); }, 400);
      setTimeout(() => { BR.countTo($('resCoins'), r.coins.total, BR.reducedMotion ? 10 : 1100, 0); for (let i = 0; i < 6 && !BR.reducedMotion; i++) setTimeout(() => BR.audio.coin(i), i * 120); }, 900 + step * 3);
      setTimeout(() => node.querySelectorAll('.bar i[data-to]').forEach((b) => { b.style.width = b.dataset.to + '%'; }), 1500);
      if (r.isBest && sum.score > 0) setTimeout(() => BR.audio.newBest(), 1000);
      this.animateXp(r.xp, r.xp.ups.length);
      node.addEventListener('click', (e) => {
        const b = e.target.closest('[data-r]'); if (!b) return;
        BR.audio.ui(); BR.haptic('tap');
        const k = b.dataset.r;
        if (k === 'again') { this.closeResults(); this.start({ mode, boosts: {} }); }
        else if (k === 'share') this.share(sum);
        else if (k === 'shop') {
          this.closeResults(); BR.Router.go('shop');
          const own = ['golden'].concat(BR.CHEST_ORDER).find((id) => BR.Progress.chestCount(id) > 0);
          if (own) setTimeout(() => BR.App.openChest(own), 450);
        }
        else { this.closeResults(); BR.Router.go('home'); }
      });
      if (BR.Skins.onEvent) BR.Skins.onEvent('results', { run: this });
    },
    async animateXp(xp, n) {
      const fill = $('resXp'), text = $('resXpText');
      if (!fill) return;
      await sleep(BR.reducedMotion ? 100 : 1700);
      let level = xp.from.level;
      for (const up of xp.ups) {
        if (!$('resXp')) return;
        fill.style.width = '100%'; text.textContent = `Level ${level} · full`;
        await sleep(BR.reducedMotion ? 80 : 800);
        level = up.level; BR.audio.levelUp(); BR.haptic('win');
        fill.style.transition = 'none'; fill.style.width = '0%'; void fill.offsetWidth; fill.style.transition = '';
        this.fx.confetti(['#ffd66b', '#3de1ff', '#ff3d8b', '#fff'], 40);
        await sleep(BR.reducedMotion ? 60 : 500);
      }
      fill.style.width = (xp.xp / xp.need) * 100 + '%';
      text.textContent = `Level ${xp.level} · ${fmt(xp.xp)} / ${fmt(xp.need)}`;
      void n;
    },
    closeResults() {
      const n = this.resultsEl; if (!n) return;
      n.classList.remove('on');
      setTimeout(() => { n.remove(); $('layer-overlays').style.pointerEvents = 'none'; }, 400);
      this.resultsEl = null; this.modal = false; this.ending = false;
    },
    /** Share a Daily Rush result: an image if the device can share files, otherwise text. */
    async share(sum) {
      const text = `Pop Rush Daily ${BR.dayKey()}: ${fmt(sum.score)} points, stage ${sum.stage}. Can you beat it?`;
      try {
        const blob = await BR.shareImage(sum);
        const file = blob && new File([blob], 'pop-rush-daily.png', { type: 'image/png' });
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
        if (navigator.share) { await navigator.share({ text }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(text); BR.toast('Result copied. Paste it anywhere!', 'good'); } catch (e) { BR.toast(text); }
    },
  };

  /** Draw a 1080x1350 share card. */
  BR.shareImage = function (sum) {
    return new Promise((resolve) => {
      try {
        const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
        const g = c.getContext('2d');
        const bg = g.createLinearGradient(0, 0, 1080, 1350); bg.addColorStop(0, '#2a1060'); bg.addColorStop(0.6, '#7a1d6a'); bg.addColorStop(1, '#ff5a3d');
        g.fillStyle = bg; g.fillRect(0, 0, 1080, 1350);
        g.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = -2; i < 14; i++) g.fillRect(i * 140, 0, 60, 1350);
        const cols = ['#ff5468', '#ffcf3f', '#4a8dff'];
        ['P', 'O', 'P'].forEach((ch, i) => { const x = 250 + i * 190, y = 150; g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.roundRect(x, y + 12, 170, 170, 40); g.fill(); g.fillStyle = cols[i]; g.beginPath(); g.roundRect(x, y, 170, 170, 40); g.fill(); g.fillStyle = '#fff'; g.font = '700 110px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText(ch, x + 85, y + 125); });
        g.font = '700 190px Fredoka, sans-serif'; g.textAlign = 'center'; const tg = g.createLinearGradient(0, 330, 0, 480); tg.addColorStop(0, '#fff6c8'); tg.addColorStop(1, '#ff3d8b'); g.fillStyle = tg; g.fillText('RUSH', 540, 470);
        g.fillStyle = '#ffffffcc'; g.font = '700 46px Nunito, sans-serif'; g.fillText('DAILY RUSH · ' + BR.dayKey(), 540, 590);
        g.fillStyle = '#fff'; g.font = '700 230px Fredoka, sans-serif'; g.fillText(fmt(sum.score), 540, 860);
        g.font = '700 64px Fredoka, sans-serif'; g.fillStyle = '#ffe58a'; g.fillText(`Stage ${sum.stage}  ·  ${sum.rushes} Rush Mode${sum.rushes === 1 ? '' : 's'}`, 540, 990);
        g.fillStyle = '#ffffffaa'; g.font = '700 44px Nunito, sans-serif'; g.fillText('Can you beat it?', 540, 1200);
        c.toBlob((b) => resolve(b), 'image/png');
      } catch (e) { resolve(null); }
    });
  };

  BR.Run = Run;
})();
