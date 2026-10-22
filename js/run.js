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
  /* The message hierarchy on the board (Update 5): ONE slot at the centre of the board belongs to the callouts, in this order. */
  const PRI = { system: 100, line: 70, power: 70, size: 60, news: 55, small: 40 };
  const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);

  const Run = {
    view: null, engine: null, token: 0, mode: 'rush', boosts: {},
    clock: false, busy: false, paused: false, modal: false, over: true, armed: null, leaving: false,
    pressed: false, hoverCell: null, hoverPlan: null, hoverVer: -1, hoverArmed: null, buffered: null, lastPointer: null,
    idleTimer: 0, popsThisRun: 0, last: 0, hb: 0, warned: false, perfN: 0, perfSum: 0,
    lane: { cur: null, q: [], timer: 0, busyUntil: 0, batch: false }, pendingRush: false, goalFlashUntil: 0,

    /* ===================================================================== setup */
    init(app) {
      this.app = app;
      this.fx = app.fx;
      this.view = new BR.BoardView({ boardEl: $('board'), field: $('field'), wrap: $('boardWrap'), layer: $('fxlayer'), fx: this.fx, audio: BR.audio });
      BR.Router.register('run', {
        onShow: () => { BR.Skins.apply(); this.view.layout(); this.measure(); this.kick(); },
        // leaving the run empties the board (a new run builds it again), so a menu session does not carry 300 hidden nodes
        onHide: () => setTimeout(() => { if (BR.Router.current !== 'run') this.view.reset(); }, 700),
      });
      this.el = $('run');
      BR.Fuse.init($('fuse'));
      this.buildSlots();
      // a small tag by the stage label names the mode that is not plain Rush (Daily), so the run never forgets what it is
      $('stageTag').insertAdjacentHTML('afterend', '<i class="ss-mode" id="modeTag" aria-hidden="true"></i>');
      this.bind();
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.active && !this.over && !this.paused && !this.modal && this.clock) this.pause(true); });
      window.addEventListener('resize', () => this.measure());
      this.kick();
    },
    /** The frame loop only runs while the run screen is showing: menus do not wake the page every frame for nothing. */
    kick() { if (this._looping) return; this._looping = true; requestAnimationFrame((t) => { this.last = t; this.frame(t); }); },
    get active() { return BR.Router.current === 'run'; },
    get canAct() { return this.active && !this.over && !this.paused && !this.modal && this.clock; },
    measure() { BR.Fuse.layout(); this.placeBanners(); },
    /** The big banners (RUSH!, the stage wipe's text) sit on the middle of the board, the same place the callouts own. Read once per layout. */
    placeBanners() {
      const wrap = this.view && this.view.wrap, run = $('s-run');
      if (!wrap || !run || !wrap.offsetWidth) return;
      const w = wrap.getBoundingClientRect(), r = run.getBoundingClientRect();
      run.style.setProperty('--mid', (w.top - r.top + w.height / 2).toFixed(1) + 'px');
      run.style.setProperty('--midx', (w.left - r.left + w.width / 2).toFixed(1) + 'px');   // (in landscape the board is not in the middle of the screen)
    },

    buildSlots() {
      $('slots').innerHTML = BR.BOOSTER_ORDER.map((id) => `<button class="bslot empty" data-b="${id}" aria-label="${BR.BOOSTERS[id].name}: ${BR.BOOSTERS[id].desc}"><i class="bfill"></i>${BR.powerIcon(id)}<span class="bname">${BR.BOOSTERS[id].name}</span><span class="bsub"></span><em class="bcount">0</em></button>`).join('');
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
        if (this._tipDone) this._tipDone();
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
        if (this.resultsEl && (e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) { const b = this.resultsEl.querySelector('[data-r="again"]'); if (b) { e.preventDefault(); b.click(); } return; }
        if (!this.active || this.over || this.modal) return;
        if (e.key === 'p' || e.key === 'P') { if (!this.paused) this.pause(); }
        else if (e.key === 'Escape' && this.armed) this.disarm();
        else if (this.canAct && ['1', '2', '3'].includes(e.key)) this.onSlot(BR.BOOSTER_ORDER[+e.key - 1]);
        // play with the keyboard: arrows move a cursor over the board (the group under it is previewed), Enter or Space pops it
        else if (this.canAct && !this.busy && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          e.preventDefault();
          const k = this.kbCell || { r: 3, c: 3 }, d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
          this.kbCell = { r: Math.max(0, Math.min(BR.CFG.rows - 1, k.r + d[0])), c: Math.max(0, Math.min(BR.CFG.cols - 1, k.c + d[1])) };
          this.hoverCell = this.kbCell; this.hoverVer = this.engine.board.version; this.hoverArmed = this.armed;
          if (this.armed) { const cells = this.engine.boosterCells(this.armed, this.kbCell.r, this.kbCell.c); this.hoverPlan = null; this.view.setCellHighlight(cells, cells.length ? `${cells.length} bricks` : ''); }
          else { this.hoverPlan = this.engine.plan(this.kbCell.r, this.kbCell.c); this.view.setHighlight(this.hoverPlan); }
        } else if (this.canAct && !this.busy && this.kbCell && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.tap(this.kbCell.r, this.kbCell.c); }
      });
    },

    /* ===================================================================== starting / resuming */
    start(opts) {
      const mode = opts.mode, boosts = opts.boosts || {};
      const st = S();
      if (mode === 'daily') { st.daily = { day: BR.dayKey(), score: 0, stage: 0 }; BR.Storage.save(); }
      const tutorial = !st.seenTutorial && mode === 'rush';
      const seed = mode === 'daily' ? BR.dailySeed('d' + BR.dayKey()) : undefined;
      const engine = new BR.Engine({ mode, seed, boosts, startHammer: tutorial, waitFirstPop: tutorial, gentle: tutorial, skill: st.profile.skill });
      BR.Storage.clearRun();
      return this.begin(engine, { tutorial, goal: mode === 'rush' ? BR.Goals.pick() : null });
    },
    resume() {
      const snap = BR.Storage.loadRun();
      if (!snap) return;
      const engine = new BR.Engine({ mode: snap.mode, seed: snap.seed, boosts: snap.boosts || {}, snapshot: snap, skill: S().profile.skill });
      return this.begin(engine, { resumed: true, goal: snap.goal || null });
    },

    async begin(engine, o = {}) {
      const token = ++this.token;
      if (this.resultsEl) this.closeResults();   // a run that starts from the results (Play again, Beat it) takes them away as it begins
      this.engine = engine; this.mode = engine.mode; this.boosts = engine.boosts;
      this.clock = false; this.busy = true; this.paused = false; this.modal = false; this.over = false; this.leaving = false;
      this.armed = null; this.buffered = null; this.popsThisRun = 0; this.tutorial = !!o.tutorial; this.warned = false; this.hb = 0;
      this.ending = false; this.pendingRush = false; this.goalFlashUntil = 0; this.clearLane();
      this.goal = o.goal || null; this.renderGoal();
      this.practice = o.practice || null;
      this.el.classList.toggle('chill', engine.chill);
      this.el.classList.toggle('daily', engine.mode === 'daily'); $('modeTag').textContent = engine.mode === 'daily' ? 'Daily' : '';
      $('stageWipe').classList.remove('go'); $('rushBanner').classList.remove('go');
      this.el.classList.remove('rushing', 'sparking'); $('lastSpark').classList.remove('on');
      if (this._tipDone) this._tipDone();
      $('bomb').getAnimations().forEach((a) => a.cancel()); $('bomb').classList.remove('gone');   // the fuse-out explosion leaves the bomb gone; every run starts with it back
      BR.Fuse.reset(this.fuseState());
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
      this.callout(o.resumed ? (engine.chill ? `Round ${engine.stage}` : `Stage ${engine.stage}`) : this.mode === 'daily' ? 'Daily Rush' : this.mode === 'chill' ? 'Chill' : 'Get ready', '#8fc2ff', { pri: PRI.system });
      await sleep(this.view.reduced ? 100 : 650);
      if (token !== this.token) return;
      BR.audio.go(); BR.haptic('tap');
      this.callout('GO!', '#ffd66b', { pri: PRI.system });
      this.busy = false; this.clock = true;
      if (this.practice) this.practiceTimer();
      if (this.tutorial) { this.hint('<b>Tap</b> a group of 2 or more matching bricks', 0); this.view.showHint(engine.bestGroup()); }
      this.armIdle(this.tutorial ? 1800 : 5000);
      this.saveSnap();
    },

    saveSnap() { if (this.engine && !this.practice && !this.engine.over && !this.engine.chill) BR.Storage.saveRun(Object.assign(this.engine.snapshot(), { goal: this.goal })); },

    /**
     * Try it: ten seconds on a practice board that wears the item you were looking at. Nothing is saved or paid, a run in
     * progress is left alone, and the loadout you had is put back the moment it ends.
     */
    practiceItem(item, inst) {
      const pr = BR.Storage.data.profile, type = item.type;
      this.practice = { item, type, prev: pr.loadout[type], iv: 0 };
      pr.loadout[type] = inst && inst.uid ? inst.uid : 'default';
      const engine = new BR.Engine({ mode: 'rush', seed: (Date.now() ^ 0x5bd1e995) >>> 0, boosts: {} });
      if (type !== 'fuse') engine.tick = () => [];   // the fuse does not burn: this is a look, not a run
      return this.begin(engine, { practice: this.practice, goal: null });
    },
    practiceTimer() {
      const pz = this.practice, end = performance.now() + 10000;
      const tick = () => {
        if (this.practice !== pz) return;
        const left = Math.max(0, Math.ceil((end - performance.now()) / 1000));
        if (!this.paused) this.hint(`Trying <b>${BR.esc(pz.item.name)}</b> · ${left}s. Pop some bricks!`, 0);
        if (left <= 0) this.endPractice();
      };
      tick(); pz.iv = setInterval(tick, 400);
    },
    endPractice() {
      const pz = this.practice; if (!pz) return;
      clearInterval(pz.iv); this.practice = null;
      BR.Storage.data.profile.loadout[pz.type] = pz.prev;   // the real loadout comes back before anything can save it
      this.over = true; this.clock = false; this.token++; this.modal = false;
      this.hideHint(); this.clearHover(); this.view.hideHint();
      BR.Skins.apply();
      for (let i = 0; i < 10 && BR.Back && BR.Back.depth; i++) BR.Back.closeTop();
      BR.Router.go('collection');
    },

    /** The run goal sits in the message band when nothing more urgent is showing. */
    renderGoal() {
      const g = this.goal, el = $('goalLine');
      el.innerHTML = g ? `<span class="gl-ico">${g.done ? BR.icon('check') : BR.icon('flag')}</span><span class="gl-txt">${g.done ? 'Goal reached' : 'Goal'}: <b>${BR.esc(g.text)}</b></span><span class="gl-rw">+${g.reward}${g.done ? ' Coins' : BR.coin('gl-coin')}</span>` : '';
      el.classList.toggle('show', !!g); el.classList.toggle('done', !!(g && g.done));
      this.band();
    },
    /** After every action: is the run goal met? Pays at the end of the run, celebrates now. */
    checkGoal() {
      const g = this.goal;
      if (!g || g.done || !BR.Goals.met(g, this.engine.summary())) return;
      g.done = true;
      // the goal speaks in the message band (it never takes the middle of the board): the pill turns green and holds the band for a moment
      this.goalFlashUntil = performance.now() + 2800;
      this.renderGoal(); BR.replay($('goalLine'), 'hit');
      clearTimeout(this._goalT); this._goalT = setTimeout(() => this.band(), 2850);
      BR.audio.boosterGain(); BR.haptic('win');
    },

    /* ===================================================================== per-frame loop */
    frame(now) {
      if (!this.active) { this._looping = false; return; }
      requestAnimationFrame((t) => this.frame(t));
      const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000)); this.last = now;
      if (!this.engine) return;
      // performance probe: lower effects automatically if the phone is struggling
      if (this.clock && !this.paused && !this.modal && BR.Storage.data.settings.perf === 'auto') {
        this.perfSum += dt; this.perfN++;
        if (this.perfN >= 180) { const avg = this.perfSum / this.perfN; this.perfN = 0; this.perfSum = 0; BR.Gfx.sample(avg); }
      }
      const e = this.engine;
      if (this.clock && !this.paused && !this.modal && !this.over) {
        const events = e.tick(dt);
        for (const ev of events) {
          if (ev.type === 'rushEnd') this.rushEnd();
          else if (ev.type === 'spark') this.sparkStart();
          else if (ev.type === 'fuseOut') this.endRun('fuse');
        }
        if (e.spark > 0) this.sparkTick(dt);
      }
      // once the run is over nothing in the fuse reacts any more: no state change, no warning vignette coming back over the explosion
      if (!e.chill && !this.over) { this.hudFuse(dt); this.heartbeat(dt); }
    },
    /** One clock for the heartbeat: the sound, the bomb's pulse, the vignette and the haptic tick all come from here (never two timers). */
    heartbeat(dt) {
      const e = this.engine;
      if (!this.clock || this.paused || this.modal || this.over || e.over) return;
      const frozen = e.rush.active || e.freeze > 0;
      const sparking = e.spark > 0, crit = e.fuse <= BR.CFG.fuse.critical && !frozen;
      if (!sparking && !crit) return;
      this.hb -= dt;
      if (this.hb > 0) return;
      this.hb = sparking ? 0.3 : 0.32 + 0.5 * (e.fuse / BR.CFG.fuse.critical);
      BR.audio.heartbeat(1); BR.Fuse.beat();
      if (sparking) BR.haptic('tick');
    },

    /** Last Spark: the fuse hit zero. One short window to land a pop of 4 or more. */
    sparkStart() {
      const e = this.engine;
      this.hb = 0;
      this.el.classList.add('sparking');
      $('lastSpark').classList.add('on'); this.band();
      BR.audio.lastSpark && BR.audio.lastSpark(); BR.haptic('boom'); BR.Fuse.sparkStart();
      this.fx.flash('#ff4d6d', 0.3, 360); this.fx.shake($('app'), 10, 360);
      if (BR.Music && BR.Music.duck) BR.Music.duck(true);
      this.hideHint(); this.view.showHint(e.bestGroup());
      if (BR.Skins.onEvent) BR.Skins.onEvent('spark', { run: this, view: this.view });
    },
    sparkTick() {
      $('lsFill').style.transform = `scaleX(${Math.max(0, this.engine.spark / BR.CFG.fuse.spark).toFixed(3)})`;   // (the beat itself is heartbeat(), one clock)
    },
    sparkEnd(saved) {
      this.el.classList.remove('sparking');
      $('lastSpark').classList.remove('on'); this.band();
      this.view.hideHint();
      if (BR.Music && BR.Music.duck) BR.Music.duck(false);
      BR.Fuse.sparkEnd(saved);
      if (BR.Skins.onEvent) BR.Skins.onEvent('sparkEnd', { run: this, saved: !!saved });
      if (saved) {
        BR.audio.lastSparkSave && BR.audio.lastSparkSave(); BR.haptic('win');
        this.callout('RELIT!', '#ffd66b', { pri: PRI.size + 5 }); this.fx.flash('#ffd66b', 0.3, 400);
        const bp = BR.Fuse.bombPoint(); this.fx.explosion(bp.x, bp.y - 26, '#ffb02e', 1.2);
      }
    },

    /** What the fuse HUD needs from the engine (one object, reused: nothing is allocated per frame). */
    fuseState() {
      const e = this.engine, s = this.fz || (this.fz = {});
      s.fuse = e.fuse; s.fuseMax = e.fuseMax; s.burn = e.burn; s.rush = e.rush; s.freeze = e.freeze; s.spark = e.spark; s.over = e.over;
      s.paused = this.paused || !this.clock || this.modal || this.over;
      return s;
    },
    hudFuse(dt) {
      const e = this.engine;
      BR.Fuse.update(this.fuseState(), dt);     // the rope, flame, readout, Fizz, chips, particles and the warning vignette (js/fuse.js)
      const f = Math.max(0, Math.min(1, e.fuse / e.fuseMax));
      const frozen = e.rush.active || e.freeze > 0;
      const crit = e.fuse <= BR.CFG.fuse.critical && !frozen && !e.over;
      // the music turns tense when the fuse is low; a soft tick each second from 8s, a light haptic tick each second when critical
      if (BR.Music && BR.Music.setLow) BR.Music.setLow(f <= BR.CFG.fuse.lowFrac && !frozen && !e.over && this.clock && !this.paused);
      if (this.clock && !this.paused && !frozen && !e.over && e.fuse > 0 && e.fuse < 8) {
        const sec = Math.ceil(e.fuse);
        if (sec !== this.tickSec) { this.tickSec = sec; if (BR.audio.fuseTick) BR.audio.fuseTick(sec); if (crit) BR.haptic('tick'); }
      } else this.tickSec = 0;
      // the one-time warning (the heartbeat itself is heartbeat(): one clock for the sound, the bomb and the vignette)
      if (crit && this.clock && !this.paused && e.spark <= 0) {
        if (!this.warned) { this.warned = true; this.callout('FUSE!', '#ff4d6d', { pri: PRI.news }); }
      } else if (e.fuse > BR.CFG.fuse.critical + 1) this.warned = false;
      // rush meter
      const R = BR.CFG.rush, bar = $('rushBar');
      if (e.rush.active) { $('rushFill').style.width = Math.min(100, (e.rush.left / R.time) * 100).toFixed(1) + '%'; $('rushLabel').textContent = `RUSH x${R.mult}  ${e.rush.left.toFixed(1)}s`; }
      else { $('rushFill').style.width = e.rush.meter.toFixed(1) + '%'; if ($('rushLabel').textContent !== 'RUSH') $('rushLabel').textContent = 'RUSH'; }
      bar.classList.toggle('hot', e.rush.meter >= 70 && !e.rush.active);
    },

    /* ===================================================================== HUD */
    hudAll(animate) {
      const e = this.engine;
      this.setScore(e.score, false);
      $('stageNum').textContent = e.stage;
      this.setMult(false);
      this.band();
      this.hudStageBar(false);
      this.renderPower(null);
      $('rushFill').style.width = '0%';
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
      if (score > base) {
        el.className = 'best-line beat'; $('bestText').textContent = 'NEW BEST!';
        if (!this.beatFired && announce !== false) {
          this.beatFired = true;
          BR.audio.newBest(); BR.haptic('win'); this.callout('NEW BEST!', '#ffd66b', { pri: PRI.news }); this.fx.confetti(['#ffd66b', '#ff3d8b', '#3de1ff', '#fff'], 50, -20);
        }
      } else if (f >= 0.8) { el.className = 'best-line close'; $('bestText').textContent = `${fmt(base - score)} to beat`; }
      else { el.className = 'best-line'; $('bestText').textContent = `BEST ${fmt(base)}`; }
    },
    setMult(slam) {
      const e = this.engine, m = e.mult;   // the real multiplier: the stage's, times Rush's while Rush is on
      const t = $('multTag'); t.textContent = 'x' + (Number.isInteger(m) ? m : m.toFixed(1)) + ' points';
      if (slam) BR.replay(t, 'slam');
    },
    /** The stage bar. After a stage-clearing pop it first fills to the top of the stage that was cleared (`stageUp`); stageBeat() turns it over. */
    hudStageBar(animate = true, stageUp) {
      const e = this.engine, f = $('stageFill');
      let sc = e.stageScore, goal = e.goal;
      if (stageUp) { goal = BR.stageGoal(stageUp.from); sc = goal; }
      if (!animate) f.style.transition = 'none';
      f.style.width = Math.max(0, Math.min(100, (sc / goal) * 100)).toFixed(1) + '%';
      $('stageGoal').textContent = `${fmt(Math.min(sc, goal))} / ${fmt(goal)}`;
      if (!animate) requestAnimationFrame(() => { f.style.transition = ''; });
    },
    hudChill(animate = true) {
      const e = this.engine;
      $('movesNum').textContent = e.movesLeft;
      const f = $('chillFill');
      if (!animate) f.style.transition = 'none';
      f.style.width = Math.min(100, (e.stageScore / e.goal) * 100) + '%';
      if (!animate) requestAnimationFrame(() => { f.style.transition = ''; });
      $('chillText').textContent = e.stageScore >= e.goal ? `Round ${e.stage} · goal reached!` : `Round ${e.stage} · ${fmt(e.stageScore)} / ${fmt(e.goal)}`;
      $('stageNum').textContent = e.stage;
    },
    renderPower(gained) {
      const e = this.engine, next = e.nextPower(), pct = Math.round((e.charge / BR.CFG.power.charge) * 100);
      for (const id of BR.BOOSTER_ORDER) {
        const el = this.slotEls[id], n = e.inv[id], isNext = id === next;
        const sub = el.querySelector('.bsub'), cnt = el.querySelector('.bcount');
        if (cnt.textContent !== String(n)) cnt.textContent = n;
        // the next slot to fill shows the charge inside it, so there is no separate bar to decode
        const label = isNext && n <= 0 ? pct + '%' : isNext ? '+' + pct + '%' : '';
        if (sub.textContent !== label) sub.textContent = label;
        el.querySelector('.bfill').style.transform = isNext ? `scaleY(${(pct / 100).toFixed(2)})` : 'scaleY(0)';
        el.classList.toggle('empty', n <= 0);
        el.classList.toggle('next', isNext);
        el.classList.toggle('armed', this.armed === id);
        if (gained && gained.includes(id)) BR.replay(el, 'gain');
      }
    },
    /* ---------------------------------------------------------------- the message lane
       One slot at the centre of the board belongs to the callouts. One shows at a time; a bigger one cuts a smaller one short, the
       others wait their turn and are dropped when they have gone stale. The big banners (the stage wipe, RUSH!) take the slot while
       they play. Score floats rise from the popped group but keep clear of the slot; time chips fly to the fuse; the run goal
       speaks in the message band. */
    callout(text, color, o = {}) {
      const L = this.lane, now = performance.now();
      const pri = o.pri != null ? o.pri : PRI.small;
      if ((L.cur && L.cur.text === text) || L.q.some((q) => q.text === text)) return;
      const m = { text, color: color || '#ffd66b', pri, at: now, t0: 0, el: null, anim: null, wait: o.wait != null ? o.wait : pri >= PRI.line ? 900 : 380, dur: BR.reducedMotion ? 700 : o.dur || (pri >= PRI.system ? 1150 : 920) };
      if (L.cur && pri >= L.cur.pri + 15 && now - L.cur.t0 > 140) this.cutLane();
      L.q.push(m);
      if (!L.batch) this.pumpLane();   // inside feedback() the messages of one pop are collected first, so the most important one shows first
    },
    /** Show the next waiting message if the slot is free. */
    pumpLane() {
      const L = this.lane, now = performance.now();
      clearTimeout(L.timer);
      if (L.cur) return;                                            // its animation's end pumps again
      if (now < L.busyUntil) { L.timer = setTimeout(() => this.pumpLane(), L.busyUntil - now + 4); return; }
      L.q = L.q.filter((m) => now - m.at <= m.wait);                // stale messages are dropped, not shown late
      if (!L.q.length) return;
      L.q.sort((a, b) => b.pri - a.pri || a.at - b.at);
      this.showCallout(L.q.shift());
    },
    showCallout(m) {
      const L = this.lane, layer = $('fxlayer');
      const W = this.view._ww || layer.clientWidth || 320;
      const size = clampN(W * 0.085, 26, 46);
      const el = BR.el(`<div class="callout">${m.text}</div>`);
      el.style.setProperty('--cc', m.color); el.style.fontSize = size.toFixed(1) + 'px';
      layer.appendChild(el);
      // (the easing belongs to each step: one easing on the whole animation bends the key times, and the text started fading after a third of its life)
      const a = el.animate([
        { transform: 'translate(-50%,-50%) scale(0.3) rotate(-6deg)', opacity: 0, easing: 'cubic-bezier(0.2,0.8,0.3,1)' },
        { transform: 'translate(-50%,-50%) scale(1.2) rotate(2deg)', opacity: 1, offset: 0.2, easing: 'cubic-bezier(0.2,0.8,0.3,1)' },
        { transform: 'translate(-50%,-54%) scale(1) rotate(0)', opacity: 1, offset: 0.66, easing: 'ease-in' },
        { transform: 'translate(-50%,-78%) scale(0.92)', opacity: 0 },
      ], { duration: m.dur, easing: 'linear', fill: 'both' });
      m.el = el; m.anim = a; m.t0 = performance.now(); L.cur = m;
      a.onfinish = () => { el.remove(); if (L.cur === m) { L.cur = null; this.pumpLane(); } };
    },
    /** Cut the message that is showing short (a bigger moment needs the slot). */
    cutLane() {
      const L = this.lane, m = L.cur;
      if (!m) return 0;
      L.cur = null;
      if (m.anim) { m.anim.onfinish = null; m.anim.cancel(); }
      if (m.el) m.el.remove();   // a hard cut: the bigger moment takes its place on the same frame, so two pieces of text are never on screen together (even if a frame is late)
      return 0;
    },
    /** A banner (the stage wipe, RUSH!) holds the slot for `ms`: whatever is showing is cut, the rest waits. Returns how long the banner
        must wait for the cut message to leave (0 when the slot was free), so two pieces of text are never on screen together. */
    occupy(ms) {
      const wait = this.cutLane();
      const L = this.lane; L.busyUntil = Math.max(L.busyUntil, performance.now() + wait + ms);
      return wait;
    },
    clearLane() {
      const L = this.lane; clearTimeout(L.timer);
      L.q.length = 0; L.cur = null; L.busyUntil = 0;
      document.querySelectorAll('#fxlayer .callout, #fxlayer .float').forEach((n) => n.remove());
    },
    /** Is the middle of the board spoken for right now (or about to be)? */
    laneBusy() { const L = this.lane; return !!(L.cur || L.q.length || performance.now() < L.busyUntil); },

    /**
     * A score float: rises from the popped group. It stays inside the board and out of the callout slot (the band across the
     * middle) whenever the slot is in use, so no two pieces of text ever sit on each other. o.sub is a small second line
     * (the combo). Geometry is estimated from the text, never measured.
     */
    floatText(text, x, y, o = {}) {
      const W = this.view._ww || 320, size = o.size || 22, sub = o.sub;
      const h = size * 1.12 + (sub ? 17 : 0), w = Math.max(48, String(text).length * size * 0.6, sub ? sub.length * 8 : 0);
      let rise = o.rise || 56;
      x = clampN(x, w / 2 + 6, Math.max(w / 2 + 6, W - w / 2 - 6));
      let top = y - rise - h * 0.6, bot = y + h * 0.6;
      if (o.avoidLane !== false && (o.lane || this.laneBusy())) {
        const half = clampN(W * 0.085, 26, 46) * 1.2 + 8, zt = W / 2 - half, zb = W / 2 + half;
        if (bot > zt && top < zb) {                                  // the float's path crosses the slot: put it above or below it
          if (y <= W / 2 + 4) {
            y = Math.min(y, zt - 4 - h * 0.6);
            rise = Math.max(8, Math.min(rise, y - h * 0.6 - 4));
          } else {
            const lo = zb + 4 + h * 0.6;                              // lowest the float may start so that its rise stays under the slot
            y = Math.min(W - 4 - h * 0.6, Math.max(y, lo));
            rise = Math.max(8, Math.min(rise, y - lo));
          }
        }
      }
      y = clampN(y, h * 0.6 + 2, W - h * 0.6 - 2);
      const el = BR.el(`<div class="float"><b>${text}</b>${sub ? `<i>${sub}</i>` : ''}</div>`);
      el.firstChild.style.fontSize = size + 'px'; el.style.color = o.color || '#fff';
      if (o.glow) el.style.setProperty('--fc', o.glow);
      el.style.left = x + 'px'; el.style.top = y + 'px';
      $('fxlayer').appendChild(el);
      const a = el.animate([
        { transform: 'translate(-50%,-50%) scale(0.4)', opacity: 0 },
        { transform: `translate(-50%,calc(-50% - ${(rise * 0.2).toFixed(0)}px)) scale(1.14)`, opacity: 1, offset: 0.16 },
        { transform: `translate(-50%,calc(-50% - ${(rise * 0.4).toFixed(0)}px)) scale(1)`, opacity: 1, offset: 0.42 },
        { transform: `translate(-50%,calc(-50% - ${rise}px)) scale(0.96)`, opacity: 0 },
      ], { duration: BR.reducedMotion ? 600 : o.dur || 880, delay: o.delay || 0, easing: 'cubic-bezier(0.2,0.7,0.3,1)', fill: 'both' });
      a.onfinish = () => el.remove();
      return { x, y, rise, h };   // where it ended up (layer coordinates), so the time chip can leave from clear air above it
    },
    /** Where a time chip leaves from: above the score float and, while the slot is in use, above the slot too. The float rises and the chip
        flies off to the fuse (a moment after the pop), so the two never share a place. */
    chipFrom(fl, dx = 0) {
      const view = this.view, rc = view._rects(), W = view._ww || 320;
      let y = rc.wt + fl.y - fl.rise * 0.45 - fl.h * 0.62 - 26;
      if (this.laneBusy()) y = Math.min(y, rc.wt + W / 2 - (clampN(W * 0.085, 26, 46) * 1.2 + 8) - 22);
      return { x: rc.wl + clampN(fl.x + dx, 40, W - 40), y };
    },
    /** A "+1.8s" chip that flies from `from` (page coordinates) to the fuse readout (js/fuse.js). Kept as a thin shim for older callers. */
    fuseFloat(text, color, from) { BR.Fuse.chip(text, color, from); },
    hint(html, ms = 4200) {
      const h = $('hint'); clearTimeout(this.hintT);
      h.innerHTML = `<span>${html}</span>`; h.classList.add('show'); this.band();
      if (ms) this.hintT = setTimeout(() => { h.classList.remove('show'); this.band(); }, ms);
    },
    hideHint() { clearTimeout(this.hintT); $('hint').classList.remove('show'); this.band(); },
    setCombo(streak, mult, popped) {
      const c = $('combo');
      if (streak >= 2) {
        $('comboX').textContent = 'Combo x' + (Number.isInteger(mult) ? mult : mult.toFixed(1));
        $('comboSub').textContent = `${streak} big pops in a row`;
        c.classList.add('show'); c.classList.toggle('hot', mult >= 2.5); c.classList.toggle('max', mult >= 4);
        if (popped) BR.replay(c, 'pop');
        this.comboOn = true;
      } else if (this.comboOn) { c.classList.remove('show', 'hot', 'max', 'pop'); this.comboOn = false; }
      this.band();
    },
    /** The message band shows one thing at a time: Last Spark, then a power-up being aimed, the goal for a moment when it is reached,
        then a hint, then the combo, then the goal. */
    band() {
      const b = $('msgBand'), flash = performance.now() < this.goalFlashUntil && $('goalLine').classList.contains('show');
      const top = $('lastSpark').classList.contains('on') ? 'spark' : $('aimBanner').classList.contains('show') ? 'aim' : flash ? 'goal' : $('hint').classList.contains('show') ? 'hint' : $('combo').classList.contains('show') ? 'combo' : $('goalLine').classList.contains('show') ? 'goal' : '';
      if (b.dataset.top !== top) b.dataset.top = top;
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
      if (e.inv[type] <= 0) { BR.audio.deny(); BR.haptic('err'); this.hint('Pop <b>4 or more</b> bricks at once to charge a power-up', 3200); return; }
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
      b.classList.toggle('show', !!text); $('boardWrap').classList.toggle('aiming', !!text); $('boardWrap').style.setProperty('--bc', color || ''); this.band();
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
        if (res.stageUp) { await this.stageBeat(res.stageUp, token); if (token !== this.token) return; }
        await this.afterAction(res, token);
      });
    },
    powerFeedback(res) {
      const e = this.engine, p = res.plan, view = this.view;
      BR.audio.boosterUse(res.type); BR.haptic('big');
      if (res.sparkEnd && this.el.classList.contains('sparking')) this.sparkEnd(false);   // the power-up bought time: the Last Spark window is over
      this.setScore(e.score); this.hudStageBar(true, res.stageUp);
      if (!res.stageUp) this.callout(BR.BOOSTERS[res.type].name.toUpperCase() + '!', PCOL[res.type], { pri: PRI.power });
      const pos = view.layerPoint(res.tap.r, res.tap.c);
      const fl = this.floatText('+' + fmt(p.points), pos.x, pos.y, { size: 30, color: PCOL[res.type], glow: PCOL[res.type], lane: !!res.stageUp });
      if (res.stageUp) this.stageNow(res.stageUp);
      const pt = view.pagePoint(res.tap.r, res.tap.c);
      this.fx.flash(PCOL[res.type], 0.28, 380);
      this.fx.shake($('boardWrap'), res.type === 'hammer' ? 9 : 6, 380);
      if (res.type === 'hammer') this.fx.explosion(pt.x, pt.y, '#ffb347', 1.1);
      else if (res.type === 'beam') { this.beam('row', res.tap.r, '#7ae8ff'); this.beam('col', res.tap.c, '#7ae8ff'); }
      else { this.fx.ring(pt.x, pt.y, '#d27aff', 160, 0.7, 6); res.removed.slice(0, 14).forEach((q, i) => { const t = view.pagePoint(q.r, q.c); setTimeout(() => this.fx.bolt(pt.x, pt.y, t.x, t.y, BR.PALETTE[q.color].hi), i * 22); }); }
      if (res.timeGain) BR.Fuse.gain(res.timeGain, this.chipFrom(fl), 'power', 170);
      this.checkGoal();
    },

    /* ===================================================================== one turn */
    async runTurn(plan, token) {
      this.busy = true; this.clearHover(); this.view.hideHint();
      const e = this.engine;
      // a pop that clears the stage deals its refill with the NEW stage's colours, so the colour that joins the board drops in with
      // the refill and is there when the band passes (the engine counts the colours only after it has dealt them)
      if (!e.chill && e.stageScore + plan.points >= e.goal) {
        const C = BR.CFG.stage, nx = e.stage + 1, want = nx >= C.seventhColor ? 7 : nx >= C.sixthColor ? 6 : 5;
        if (e.board.colorCount < want) e.board.colorCount = want;
      }
      const res = e.commit(plan);
      if (!res) { this.busy = false; return; }
      this.popsThisRun++;
      this.feedback(res);
      const ok = await this.view.playResult(res);
      if (!ok || token !== this.token) return;
      // the stage-up band passes in front of the board that is already refilled, then the turn is over
      if (res.stageUp) { await this.stageBeat(res.stageUp, token); if (token !== this.token) return; }
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

    /** Everything the player should feel the instant a pop happens. The callouts it raises are collected first (lane.batch) and then
        sorted by importance, so RELIT! is not starved by a size callout that happened to be created a line earlier. */
    feedback(res) {
      const L = this.lane;
      L.batch = true;
      try { this.feedbackNow(res); } finally { L.batch = false; this.pumpLane(); }
    },
    feedbackNow(res) {
      const e = this.engine, p = res.plan, view = this.view, n = p.n;
      const flavor = BR.Skins.pop === 'classic' ? null : BR.Skins.pop;
      BR.audio.pop(n, e.streak, flavor);
      if (e.streak >= 2) BR.audio.combo(e.streak);
      BR.haptic(n >= 8 ? 'big' : 'pop');
      this.setScore(e.score);
      this.hudStageBar(true, res.stageUp);   // a pop that clears the stage fills the bar to the top first; the stage-up beat turns it over
      if (e.chill) this.hudChill();
      this.setCombo(e.streak, BR.comboMult(e.streak), true);
      const su = res.stageUp, rs = !e.chill && res.rushStart, big = !!(su || rs);
      // ---- the message lane (see callout): the stage-up and the start of Rush are the big moments; they take the slot and the size
      // callout steps aside. Everything else waits its turn or is dropped.
      if (res.comboBefore >= 2 && e.streak < 2) this.callout('Combo lost', '#9aa8d6');
      if (res.boostersGained && res.boostersGained.length) {
        this.renderPower(res.boostersGained); BR.audio.boosterGain(); BR.haptic('stage');
        setTimeout(() => this.callout(BR.BOOSTERS[res.boostersGained[0]].name + ' ready!', PCOL[res.boostersGained[0]], { pri: PRI.news }), 250);
      } else this.renderPower(null);
      const co = p.line ? { text: 'LINE BLAST!', color: '#7ee8ff', pri: PRI.line } : CALLOUTS.find((c) => n >= c.n);
      if (co && !big) this.callout(co.text, co.color, { pri: co.pri || PRI.size });

      let sr = 0, sc = 0;
      p.primary.forEach((q) => { sr += q.r; sc += q.c; });
      sr /= n; sc /= n;
      const pos = view.layerPoint(sr, sc); pos.y -= view.cell * 0.15;
      const pt = view.pagePoint(sr, sc);
      // the score rises from the group, in one piece with its combo tag, and keeps out of the slot (floatText knows the lane)
      const fl = this.floatText('+' + fmt(p.points), pos.x, pos.y, {
        lane: big,
        size: Math.min(46, 20 + Math.log2(Math.max(2, p.points)) * 2), color: p.line ? '#9ff0ff' : n >= 8 ? '#ffd66b' : '#fff',
        glow: p.line ? 'rgba(80,220,255,.8)' : n >= 8 ? 'rgba(255,200,60,.8)' : 'rgba(255,255,255,.4)', rise: 50 + Math.min(40, n * 3),
        sub: p.combo > 1 ? `x${p.combo % 1 ? p.combo.toFixed(1) : p.combo} combo` : '',
      });
      if (n >= 5) this.fx.ring(pt.x, pt.y, '#ffffff', 60 + n * 9, 0.5, 4);
      if (n >= 6) this.fx.shake($('boardWrap'), Math.min(7, 1.5 + n * 0.45), 260 + Math.min(240, n * 16));   // the board shakes, not the whole screen, and never much
      if (n >= 10) this.fx.flash('#ffffff', Math.min(0.28, n * 0.014), 280);
      if (p.line) {
        BR.audio.line(); BR.haptic('boom'); this.fx.flash('#9ff0ff', 0.3, 520); this.fx.shake($('boardWrap'), 7, 420);
        if (!BR.reducedMotion) $('board').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.02)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 170, easing: 'ease-out' });   // a small camera punch
        if (p.lineH) this.beam('row', p.r); if (p.lineV) this.beam('col', p.c);
      }
      if (res.shuffle.length) setTimeout(() => this.callout('Reshuffle', '#c4b5ff'), 700);

      // the fuse
      if (!e.chill) {
        // time changes fly to the readout as chips (js/fuse.js); the chime plays when each one arrives. The chip leaves from the group,
        // but never from inside the slot in the middle of the board, so it does not cross a callout on its way up.
        const from = this.chipFrom(fl);
        if (res.timeGain > 0) BR.Fuse.gain(res.timeGain, from, p.line ? 'line' : 'pop', 170);
        if (res.defused) { BR.audio.defuse(); BR.haptic('stage'); BR.Fuse.gain(res.defused * BR.CFG.fuse.defuse, this.chipFrom(fl, fl.x > 200 ? -70 : 70), 'defuse', 330); this.callout('DEFUSED!', '#3ddc97', { pri: PRI.news }); }
        if (res.bursts && res.bursts.length) { BR.audio.burstFuse(); BR.Fuse.burst(res.bursts.length * BR.CFG.fuse.burstPenalty); this.callout('FUSE BRICK!', '#ff4d6d', { pri: PRI.news }); }
        if (rs) { this.rushStart(); if (su) this.pendingRush = true; else this.rushShow(); }   // stage-up first, then Rush
        if (su) this.stageNow(su);
        if (res.spark) this.sparkStart();
        else if (this.el.classList.contains('sparking') && e.spark <= 0) this.sparkEnd(!!res.sparkSave);
        if (res.shuffleRefund) { const bw = $('boardWrap').getBoundingClientRect(); BR.Fuse.gain(res.shuffleRefund, { x: bw.left + bw.width / 2, y: bw.top + bw.height / 2 }, 'shuffle', 700); }
      }
      this.checkGoal();
      if (BR.Skins.onEvent) BR.Skins.onEvent('pop', { res, view, run: this });
      if (p.line && BR.Skins.onEvent) BR.Skins.onEvent('line', { res, view, run: this });

      if (this.popsThisRun === 1) this.hideHint();   // "tap a group" has done its job
      // the first runs name each part of the HUD the first time it does something (one arrow callout at a time, once per player)
      if (S().runs < 3 || this.tutorial) {
        if (res.timeGain > 0) this.tip('fuse', 'fuse', 'This is your <b>time</b>. Every pop adds more.');
        if (this.popsThisRun >= 2) { if (e.chill) this.tip('stage', 'chillbar', 'Fill this to clear the <b>round</b> before your moves run out.'); else this.tip('stage', 'stageStrip', 'Fill this to clear the <b>stage</b>. Each stage pays more.'); }
        if (e.rush.meter > 0 && !e.rush.active) this.tip('rush', 'rushBar', 'Pops of 4+ fill <b>Rush</b>. Full: 3x points!');
        if (e.charge > 0) this.tip('power', 'slots', 'Pops of 4+ also charge a <b>power-up</b>. Tap one, then the board.');
      }
      if (this.tutorial && this.popsThisRun === 8) { S().seenTutorial = true; BR.Storage.save(); this.tutorial = false; }
    },

    /** An arrow callout that names a HUD part. Shown once per player; only one at a time; gone after a few seconds or the next tap. */
    tip(key, targetId, html, ms = 4200) {
      const seen = S().seen, flag = 'rt_' + key;
      if (seen[flag] || this._tip) return;
      seen[flag] = true; BR.Storage.save();
      const t = $(targetId).getBoundingClientRect(), run = this.el.getBoundingClientRect();
      const el = BR.el(`<div class="tip-arrow"><span>${html}</span></div>`);
      this.el.appendChild(el);
      const w = Math.min(280, run.width - 24), cx = t.left - run.left + t.width / 2;
      const left = Math.max(12, Math.min(run.width - w - 12, cx - w / 2));
      const below = t.top - run.top < run.height * 0.5;
      el.style.cssText = `width:${w}px;left:${left}px;${below ? `top:${t.bottom - run.top + 8}px` : `bottom:${run.bottom - t.top + 8}px`}`;
      el.style.setProperty('--ax', Math.max(18, Math.min(w - 18, cx - left)) + 'px');
      el.classList.add(below ? 'below' : 'above');
      this._tip = el;
      const done = () => { clearTimeout(timer); el.classList.add('out'); setTimeout(() => el.remove(), 260); if (this._tip === el) { this._tip = null; this._tipDone = null; } };
      const timer = setTimeout(done, ms);
      this._tipDone = done;
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
    /** Rush starts: the board turns pink and the multiplier changes at once (this is the state). The show (the banner, the flash) is rushShow(). */
    rushStart() {
      this.el.classList.add('rushing'); this.setMult(true);
      if (BR.Music) BR.Music.setRush(true);
      this.hideHint();
    },
    /** The show of a Rush start: it plays at once, or after the stage-up band when the same pop cleared a stage. It holds the slot while it plays. */
    rushShow() {
      if (this.over) return;
      this.pendingRush = false;
      const token = this.token, still = BR.reducedMotion;
      const wait = still ? 0 : this.occupy(1150);       // the banner takes the slot (and waits for a message it cut to leave)
      const play = () => {
        if (token !== this.token || this.over) return;
        BR.audio.rushStart(); BR.haptic('rush'); BR.Fuse.rushStart();
        if (still) this.callout('RUSH!', '#ff8fc0', { pri: PRI.system + 1, wait: 800 }); else BR.replay($('rushBanner'), 'go');   // (Reduce Motion: a still callout)
        this.fx.flash('#ff3d8b', 0.4, 600); this.fx.shake($('app'), 14, 600);
        this.fx.confetti(['#ff3d8b', '#ffb23d', '#fff6c8', '#8a4dff'], 36, 0);
        if (BR.Skins.onEvent) BR.Skins.onEvent('rushStart', { run: this, view: this.view });
      };
      if (wait) setTimeout(play, wait); else play();
    },
    rushEnd() {
      this.el.classList.remove('rushing'); this.setMult(true);
      BR.audio.rushEnd(); BR.haptic('tick'); BR.Fuse.rushEnd();
      this.callout('Rush over', '#b99cff');   // (a stronger lilac than before: the pale one disappeared on bright boards, R-12)
      if (BR.Music) BR.Music.setRush(false);
      if (BR.Skins.onEvent) BR.Skins.onEvent('rushEnd', { run: this });
    },
    /** A stage is cleared: what is true at once (the fuse respools, the music and the save follow the new stage). The show is stageBeat(). */
    stageNow(info) {
      void info;
      BR.Fuse.stageUp();
      this.warned = false;
      if (BR.Music) BR.Music.setStage(this.engine.stage);
      this.saveSnap();
    },
    /**
     * The stage-up show. It plays after the pop and the refill have landed, so the band passes in front of a board that is already
     * full (the new colour is on it). The HUD turns over under the band while it covers the board, and the turn is released the
     * moment the band has gone by (the fuse holds still for 1.4 s, so nothing is lost). Resolves then.
     */
    async stageBeat(info, token) {
      const e = this.engine, reduced = this.view.reduced, C = BR.CFG.stage;
      const wait = BR.reducedMotion ? 0 : this.occupy(1000);
      if (wait) { await sleep(wait); if (token !== this.token) return; }    // a message that was showing leaves first
      BR.audio.stageUp(); BR.haptic('stage');
      if (BR.Music) BR.Music.stageUp();
      $('swNum').textContent = info.to; $('swMult').textContent = 'x' + info.mult.toFixed(1);
      if (BR.reducedMotion) this.callout(`Stage ${info.to}  x${info.mult.toFixed(1)}`, '#ffd66b', { pri: PRI.system + 1, wait: 800 });   // (Reduce Motion has no wipe: a still callout)
      else { const w = $('stageWipe'); BR.replay(w, 'go'); clearTimeout(this._swT); this._swT = setTimeout(() => w.classList.remove('go'), 1150); }
      this.fx.flash('#ffffff', 0.35, 500); this.fx.shake($('app'), 10, 420);
      if (BR.Skins.onEvent) BR.Skins.onEvent('stageUp', { run: this, info });
      await sleep(reduced ? 80 : 380);                       // the band is across the board: turn the HUD over under it
      if (token !== this.token) return;
      $('stageNum').textContent = info.to;
      BR.replay($('stageTag'), 'slam');
      this.setMult(true);
      this.hudStageBar();
      await sleep(reduced ? 120 : 270);                      // the band has gone by
      if (token !== this.token) return;
      const newColor = info.to === C.sixthColor ? 5 : info.to === C.seventhColor ? 6 : -1;
      if (newColor >= 0) { this.view.pulseColor(newColor); setTimeout(() => this.hint('A <b>new brick color</b> joins the board', 3000), 400); }
      else if (info.to === BR.CFG.fuseBrick.fromStage) setTimeout(() => this.hint('<b>Fuse bricks</b> are ticking. Pop them to defuse!', 3600), 400);
      if (this.pendingRush) setTimeout(() => { if (token === this.token) this.rushShow(); }, reduced ? 60 : 340);   // stage-up first, then Rush (the band's text has gone by then)
      void e;
    },
    async chillClear(token) {
      const e = this.engine, view = this.view;
      view.setHighlight(null); view.hideHint();
      BR.audio.roundClear(); this.fx.flash('#ffe9a8', 0.25, 600);
      const left = e.movesLeft, stars = left >= 8 ? 3 : left >= 4 ? 2 : 1;
      this.callout(`Round ${e.stage} clear!  ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, '#ffd66b', { pri: PRI.system });
      this.chillStars = (this.chillStars || 0) + stars;
      await sleep(view.reduced ? 200 : 900);
      if (token !== this.token) return;
      if (e.movesLeft > 0) {
        const res = e.shatter();
        BR.audio.shatterBonus(); this.setScore(e.score);
        this.callout(`Move bonus +${fmt(res.bonus)}`, '#7ee8ff', { pri: PRI.line, wait: 1600 }); this.fx.shake($('app'), 10, 420);
        const ok = await view.playResult(res);
        if (!ok || token !== this.token) return;
      }
      e.nextRound();
      this.hudChill(); this.hudStageBar(false); $('stageNum').textContent = e.stage;
      await sleep(250);
      this.callout('Round ' + e.stage, '#8fc2ff', { pri: PRI.line, wait: 1600 });
    },

    /* ===================================================================== pause (with End Run) */
    pause(silent) {
      if (!this.active || this.over || this.paused || this.modal) return;
      this.paused = true; this.leaving = false;
      this.saveSnap();
      this.clearHover(); this.view.hideHint(); if (this.armed) this.disarm();
      if (BR.Music) BR.Music.duck(true);
      if (!silent) BR.audio.ui();
      // Try it is a look, not a run: it can be resumed or stopped, and nothing else (no Restart, no Save and leave)
      const body = this.practice
        ? `<div class="stack pause-list">
        <button class="btn btn-xl" data-p="resume">${BR.icon('play')} Resume</button>
        <button class="btn btn-dark" data-p="settings">${BR.icon('sound')} Sound and vibration</button>
        <button class="btn btn-dark" data-p="stop">${BR.icon('flag')} Stop trying it</button></div>`
        : `<div class="stack pause-list">
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
        else if (k === 'stop') { this.leaving = true; sh.close(); this.endPractice(); }
        else if (k === 'end') this.confirmEnd(sh);
        else if (k === 'restart' && !this.practice) { this.leaving = true; sh.close(); this.bankSilently(); setTimeout(() => this.start({ mode: this.mode === 'daily' ? 'rush' : this.mode, boosts: this.mode === 'rush' ? this.boosts : {} }), 350); }
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
      if (this.practice) return;   // a practice board never pays, counts or saves
      if (!this.engine || this.over || this.engine.stats.pops === 0) { BR.Storage.clearRun(); return; }
      this.over = true; this.clock = false;
      this.finalize(this.engine.summary(), 'ended', true);
      BR.Storage.clearRun();
    },
    exitToHome() {
      if (this.practice) { this.endPractice(); return; }
      this.over = true; this.clock = false; this.token++;
      BR.Router.go('home');
    },

    /* ===================================================================== ending + results */
    async endRun(reason) {
      if (this.practice) { this.endPractice(); return; }
      if (this.over && this.ending) return;
      const token = this.token;
      this.over = true; this.ending = true; this.clock = false; this.busy = true;
      this.clearHover(); this.view.hideHint(); this.hideHint(); this.aimBanner(''); this.armed = null;
      this.pendingRush = false; this.clearLane();
      // the run is over: the warning vignette goes and stays gone (nothing in the fuse updates any more, see frame())
      const vg = $('warnVignette'); vg.classList.remove('on', 'lo'); vg.getAnimations().forEach((a) => a.cancel());   // (a heartbeat pulse that is still running would keep it lit for another 0.4 s)
      $('lastSpark').classList.remove('on'); this.band();
      if (BR.Music && BR.Music.duck) BR.Music.duck(false);   // a missed Last Spark leaves the held duck on
      if (this.el.classList.contains('rushing') && BR.Skins.onEvent) BR.Skins.onEvent('rushEnd', { run: this });   // so Rush-only moments clean up
      this.el.classList.remove('rushing', 'sparking');
      if (BR.Music) BR.Music.stop();
      const e = this.engine;
      if (reason === 'fuse') {
        // the bomb goes off
        BR.audio.fuseOut(); BR.haptic('boom');
        const bomb = BR.Fuse.bombPoint(); BR.Fuse.fuseOut();
        this.fx.flash('#ffffff', 0.9, 700);
        this.fx.explosion(bomb.x, bomb.y, '#ff7a4d', 1.8);
        this.fx.shake($('app'), 22, 900);
        $('bomb').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.8)', opacity: 0.9, offset: 0.25 }, { transform: 'scale(0.2)', opacity: 0 }], { duration: 650, easing: 'ease-out' }).onfinish = () => $('bomb').classList.add('gone');
        this.callout('FUSE OUT!', '#ff4d6d', { pri: PRI.system });
        await sleep(this.view.reduced ? 250 : 900);
        await this.view.crumble();
      } else if (reason === 'moves') {
        BR.audio.gameOver(); this.callout('Out of moves', '#ff8b99', { pri: PRI.system });
        await sleep(this.view.reduced ? 200 : 650); await this.view.crumble();
      } else { BR.audio.gameOver(); await sleep(250); }
      if (token !== this.token) return;
      const sum = e.summary();
      const res = this.finalize(sum, reason, false);
      BR.Storage.clearRun();
      this.ending = false;
      this.showResults(sum, res, reason);
    },

    /** What a Pass level-up paid in Coins (a Coins reward, or the Coins a chest or item turned into). */
    levelCoins(u) { return u.paid || (u.reward && u.reward.kind === 'coins' ? u.reward.amount : 0); },

    /**
     * Pay out a finished run: Coins, XP, missions, scores, trophies. Returns what the results screen shows.
     * A run with no pops pays nothing, is not counted and lights no streak (it is as if it never happened).
     * `earned` is every Coin the run paid, from every source, and equals the change in the balance; `breakdown` explains it.
     */
    finalize(sum, reason, silent) {
      const st = S(), P = BR.Progress, mode = this.mode;
      const daily = mode === 'daily';
      if (!(sum.pops > 0)) {
        this.goal = null;
        const lv = { level: P.level, xp: P.xp, need: P.need };
        return { empty: true, coins: { points: 0, stages: 0, daily: 0, first: 0, total: 0 }, isBest: false, rows: [], xp: { gained: 0, from: lv, level: lv.level, xp: lv.xp, need: lv.need, ups: [] }, missions: [], trophies: [], daily, prevBest: st.best[mode], par: 0, goal: null, streak: null, earned: 0, breakdown: [], balance: { from: P.coins, to: P.coins } };
      }
      const bal0 = P.coins;
      const today = BR.dayKey();
      const firstOfDay = st.lastDay !== today; if (firstOfDay) st.lastDay = today;
      const coins = P.runCoins(sum, { daily, firstOfDay });
      // the tile director's skill rating follows how far Rush runs go when the fuse ends them (a quit or a restart does not count)
      if (!silent && reason === 'fuse' && BR.Director) st.profile.skill = BR.Director.rate(st.profile.skill, sum);
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
      const goal = this.goal && mode === 'rush' ? { text: this.goal.text, reward: this.goal.reward, done: !!(this.goal.done || BR.Goals.met(this.goal, sum)) } : null;
      if (goal && goal.done) P.earn(goal.reward);
      this.goal = null;
      const streak = BR.Streak.advance();
      BR.Records.update(sum, mode);
      const trophies = P.checkTrophies();
      // a Pass reward that finished a set (an item, not a chest opening) leaves chests of that set with nothing to find: they turn into Coins now
      const spare = P.cashStranded();
      BR.Storage.save();
      // ---- every Coin the run paid, in one total that is exactly the change in the balance
      const bal1 = P.coins, earned = bal1 - bal0;
      const items = [
        ['Points', coins.points], ['Stages cleared', coins.stages], ['Daily Rush', coins.daily], ['First run of the day', coins.first],
        ['Run goal', goal && goal.done ? goal.reward : 0],
        ['Missions', missions.reduce((a, m) => a + (m.justDone ? m.mission.reward + (m.mission.chestCoins || 0) : 0), 0)],
        ['Trophies', trophies.reduce((a, t) => a + t.coins, 0)],
        ['Streak', streak ? (streak.coins || 0) + (streak.chestPaid || 0) : 0],
        ['Spare chests turned into Coins', spare],
      ];
      // what is left is the Pass: the Coins the level-ups paid (the only other source)
      const rest = earned - items.reduce((a, it) => a + it[1], 0);
      items.push([xp.ups.length ? 'Level rewards' : 'Other', rest]);
      const breakdown = items.filter((it) => it[1] > 0).map(([label, c]) => ({ label, coins: c }));
      return { coins, isBest, rows, xp, missions, trophies, daily, prevBest, par, goal, streak, earned, breakdown, balance: { from: bal0, to: bal1 } };
    },

    /** Run `fn` once `el` is on screen inside the results' scroll area AND its own reveal has started (a count never runs unseen). */
    whenShown(el, fn) {
      if (!el) return;
      let seen = false, shown = false, done = false;
      const go = () => { if (!done && seen && shown) { done = true; setTimeout(() => { if (this.resultsEl) fn(); }, BR.reducedMotion ? 0 : 60); } };
      el._onIn = () => { shown = true; go(); };
      // (observed against the viewport: whichever box scrolls, a row clipped by its overflow does not count as seen)
      if (!window.IntersectionObserver || !this.resultsEl) { seen = true; go(); return; }
      const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { seen = true; io.disconnect(); go(); } }, { threshold: 0.25 });
      io.observe(el);
    },

    showResults(sum, r, reason) {
      this.modal = true;
      const mode = this.mode, P = BR.Progress, empty = !!r.empty, rm = BR.reducedMotion;
      const lastBoosts = Object.keys(this.boosts || {}).filter((k) => this.boosts[k]);
      const titles = { fuse: 'FUSE OUT!', moves: 'OUT OF MOVES', ended: 'RUN OVER' };
      const canShop = ['golden'].concat(BR.CHEST_ORDER).some((id) => P.canOpen(id));
      const round = mode === 'chill' ? 'Round' : 'Stage';
      // ---- the rewards, each shown once: Coins (one total with its breakdown), XP, one compact banner per level-up, trophies grouped
      const coinsCard = empty ? '' : `<div class="res-card res-coins rev"><h3><span>Coins earned</span><span class="coins-total">${BR.coin()}<b id="resCoins">+0</b></span></h3>
            <div class="res-bd">${r.breakdown.map((b) => `<div class="res-row"><span>${b.label}</span><b>+${fmt(b.coins)} Coins</b></div>`).join('')}</div></div>`;
      const xpGain = r.rows.reduce((a, x) => a + x.xp, 0);
      const xpCard = empty ? '' : `<div class="res-card res-xpc rev"><h3><span>XP</span><span class="muted num">+${fmt(xpGain)} XP</span></h3>
            <div class="xp-line"><div class="bar tall cyan"><i id="resXp" style="width:${(r.xp.from.xp / r.xp.from.need) * 100}%"></i></div><small class="num" id="resXpText">Level ${r.xp.from.level} · ${fmt(r.xp.from.xp)} / ${fmt(r.xp.from.need)}</small></div>
            <div class="xp-src">${r.rows.map((x) => `<span>${BR.esc(x.label)} <b>+${fmt(x.xp)}</b></span>`).join('')}</div></div>`;
      const ups = r.xp.ups.map((u) => { const c = this.levelCoins(u); return `<div class="res-banner lvl rev rwait"><span>${BR.icon('star')}</span><b>Level ${u.level}!</b><small>${c ? '+' + fmt(c) + ' Coins' : BR.rewardLabel(u.reward)}</small></div>`; }).join('');
      const tcoins = r.trophies.reduce((a, t) => a + t.coins, 0);
      const trophies = r.trophies.length ? `<div class="res-banner trophy rev"><span>${BR.icon('trophy')}</span><b>${r.trophies.length === 1 ? 'Trophy: ' + BR.esc(r.trophies[0].name) : r.trophies.length + ' trophies'}</b><small>${r.trophies.length > 1 ? r.trophies.map((t) => BR.esc(t.name)).join(', ') + ' · ' : ''}+${fmt(tcoins)} Coins</small></div>` : '';
      const sk = r.streak, skCoins = sk ? (sk.coins || 0) + (sk.chestPaid || 0) : 0;   // what the streak REALLY paid (a finished Golden set pays Coins instead of the chest)
      const streak = sk ? `<div class="res-banner streak rev"><span>${BR.icon('sun')}</span><b>${sk.ring >= 7 ? 'Streak: week complete!' : `Streak: day ${sk.ring}`}</b><small>${[skCoins ? '+' + fmt(skCoins) + ' Coins' : '', sk.chest && !sk.chestPaid ? 'a Golden Chest' : '', sk.shielded ? 'a missed day was forgiven' : '', sk.broken ? 'a new week starts' : ''].filter(Boolean).join(' and ') || 'Come back tomorrow'}</small></div>` : '';
      const mis = r.missions.map((m) => `<div class="res-mis ${m.justDone ? 'done' : ''}"><div class="t"><span>${m.justDone ? BR.icon('check', 'ck') + ' ' : ''}${BR.esc(m.mission.text)}</span><b>${m.justDone ? '+' + m.mission.reward + ' Coins' : fmt(m.after) + '/' + fmt(m.mission.target)}</b></div><div class="bar ${m.weekly ? 'gold' : 'green'}"><i data-to="${(m.after / m.mission.target) * 100}" style="width:${(m.before / m.mission.target) * 100}%"></i></div></div>`).join('');
      // after the very first run: players who cannot tell the colors apart can get a symbol on every brick
      const shapesOffer = !empty && !S().settings.shapes && !S().seen.shapesTip && S().runs <= 2 ? `<div class="res-card rev shapes-offer"><h3>Hard to tell the colors apart?</h3><p class="tiny">Shape hints put a small symbol on every brick.</p><button class="btn btn-dark btn-sm" data-r="shapes">Turn on shape hints</button></div>` : '';
      const goalLine = r.goal ? `<div class="res-goal rev ${r.goal.done ? 'done' : ''}"><span>${BR.icon(r.goal.done ? 'check' : 'flag')}</span><b>${r.goal.done ? 'Goal reached' : 'Goal missed'}: ${BR.esc(r.goal.text)}</b>${r.goal.done ? `<em>+${r.goal.reward} Coins</em>` : ''}</div>` : '';
      const nextLine = empty ? '' : BR.nextGoal({ stage: sum.stage, mode });
      let chase = '';
      if (r.isBest && sum.score > 0) chase = `<div class="new-best rev">New best</div>${r.prevBest > 0 ? `<div class="res-gap rev good">${fmt(sum.score - r.prevBest)} more than your old best</div>` : ''}`;
      else if (r.prevBest > 0 && !empty) {
        const gap = r.prevBest - sum.score, near = sum.score >= r.prevBest * 0.85;
        chase = `<div class="res-gap rev ${near ? 'near' : ''}">${near ? `So close: ${fmt(gap)} short of your best` : `Your best is ${fmt(r.prevBest)}`}</div>`;
      }
      if (mode === 'daily' && r.par > 0 && !empty) chase += `<div class="res-gap rev ${sum.score >= r.par ? 'good' : ''}">${sum.score >= r.par ? 'Above' : 'Below'} your recent average of ${fmt(r.par)}</div>`;
      const beatIt = !r.isBest && r.prevBest > 0 && mode !== 'daily' && !empty;
      const html = `<div class="results" id="results">
        <div class="res-scroll">
          <div class="res-hero">${empty ? '' : `<div class="res-top"><span class="pill gold res-bal" aria-label="Your Coins">${BR.coin()}<b class="num" id="resBal">${fmt(r.balance.from)}</b></span></div>`}
          <div class="res-title out rev">${titles[reason] || 'RUN OVER'}</div>
          <div class="res-sub rev">${mode === 'daily' ? 'Daily Rush' : mode === 'chill' ? 'Chill' : 'Rush'} · ${round} ${sum.stage} · ${Math.floor(sum.time / 60)}:${String(Math.floor(sum.time % 60)).padStart(2, '0')}</div>
          <div class="res-score rev"><small>Score</small><b id="resScore">0</b></div>
          ${empty ? '<div class="res-card rev res-none"><h3>Nothing popped</h3><p class="tiny">A run needs at least one pop to count. Nothing was paid and nothing was counted.</p></div>' : ''}
          ${chase}</div><div class="res-rest">${coinsCard}${xpCard}${ups}${trophies}${streak}${goalLine}${nextLine ? `<div class="res-next rev">Next: ${BR.esc(nextLine)}</div>` : ''}
          ${mis ? `<div class="res-card res-mc rev"><h3>Missions</h3>${mis}</div>` : ''}
          ${empty ? '' : `<div class="res-chips rev"><div class="res-chip"><b>${sum.stagesCleared}</b><small>${mode === 'chill' ? 'Rounds cleared' : 'Stages cleared'}</small></div><div class="res-chip"><b>${sum.biggest}</b><small>Biggest pop</small></div><div class="res-chip"><b>${sum.rushes}</b><small>Rush Modes</small></div></div>`}
          ${shapesOffer}</div>
        </div>
        <div class="res-actions">
          ${mode === 'daily' && !empty ? `<button class="btn btn-xl" data-r="share">${BR.icon('share')} Share result</button>` : `<button class="btn btn-xl" data-r="again">${BR.icon('play')} ${beatIt ? 'Beat it' : 'Play again'}</button>`}
          <div class="row">${canShop ? `<button class="btn btn-gold" data-r="shop">${BR.icon('gift')} Chests</button>` : ''}<button class="btn btn-dark" data-r="home">Home</button></div>
        </div></div>`;
      const host = $('layer-overlays');
      const node = BR.el(html);
      host.appendChild(node);
      host.style.pointerEvents = 'auto';
      this.resultsEl = node; BR.under(1);
      // a sheet (the Boosts for "Play again") or a chest opening (the "Chests" button) opened from the results belongs ABOVE them
      $('layer-sheets').style.zIndex = '70'; $('layer-opening').style.zIndex = '65';
      // Back and Escape leave the results for Home, like Home does
      this.backEntry = BR.Back.push(() => { this.backEntry = null; this.closeResults(true); BR.Router.go('home'); });
      if (BR.Music && BR.Music.resultsSting) BR.Music.resultsSting();
      requestAnimationFrame(() => node.classList.add('on'));
      BR.Router.setTabs(false);
      // ---- choreography. The action bar belongs to the screen (it fades in on its own, well inside 0.6 s). Rows that are on screen reveal
      // one after another in a fast stagger; rows below the fold are simply there. Each count starts when its own row is in view.
      const scroll = node.querySelector('.res-scroll'), sr = scroll.getBoundingClientRect();
      const revs = Array.from(node.querySelectorAll('.rev')).filter((n) => !n.classList.contains("rwait"));
      const onFold = revs.map((n) => n.getBoundingClientRect().top - sr.top < sr.height - 8);
      const nOn = onFold.filter(Boolean).length, step = rm ? 0 : Math.min(70, 400 / Math.max(1, nOn));
      let k = 0;
      revs.forEach((n, i) => {
        const at = rm ? 0 : onFold[i] ? 80 + k++ * step : 0;
        const show = () => { n.classList.add('in'); if (n._onIn) n._onIn(); };
        if (at) setTimeout(() => { if (this.resultsEl === node) show(); }, at); else show();
      });
      this.whenShown(node.querySelector('.res-score'), () => { BR.countTo($('resScore'), sum.score, rm ? 10 : 1200, 0); BR.audio.xpTick(0); if (r.isBest && sum.score > 0) setTimeout(() => BR.audio.newBest(), 700); });
      if (!empty) {
        this.whenShown(node.querySelector('.res-coins'), () => {
          BR.countTo($('resCoins'), r.earned, rm ? 10 : 1100, 0, (n) => '+' + fmt(n));
          BR.countTo($('resBal'), r.balance.to, rm ? 10 : 1100, r.balance.from);
          for (let i = 0; i < 6 && !rm; i++) setTimeout(() => BR.audio.coin(i), i * 120);
        });
        const holds = Array.from(node.querySelectorAll('.res-banner.rwait'));
        this.whenShown(node.querySelector('.res-xpc'), () => this.animateXp(r.xp, holds));
        setTimeout(() => holds.forEach((n) => n.classList.add('in')), 3200);   // (a level-up is never left hidden if the XP row stays below the fold)
      }
      this.whenShown(node.querySelector('.res-mc'), () => node.querySelectorAll('.bar i[data-to]').forEach((b) => { b.style.width = b.dataset.to + '%'; }));
      node.addEventListener('click', (e) => {
        const b = e.target.closest('[data-r]'); if (!b) return;
        BR.audio.ui(); BR.haptic('tap');
        const k = b.dataset.r;
        if (k === 'again') this.playAgain(mode, empty ? [] : lastBoosts);
        else if (k === 'share') this.share(sum);
        else if (k === 'shapes') { S().settings.shapes = true; S().seen.shapesTip = true; BR.Storage.save(); BR.App.applySettings(); BR.toast('Shape hints are on. Change it any time in Profile.', 'good'); b.closest('.shapes-offer').remove(); }
        else if (k === 'shop') this.resultsToChest();
        else { this.closeResults(); BR.Router.go('home'); }
      });
      // the finished board has no reason to stay behind the results: it is cleared once they are fully on, so no stale board shows when they leave
      setTimeout(() => { if (this.resultsEl === node && this.over) this.view.reset(); }, 520);
      if (BR.Skins.onEvent) BR.Skins.onEvent('results', { run: this });
    },
    /** "Play again" / "Beat it": Rush offers the Boosts used last time (the results stay up behind the sheet, and go when the run begins);
        Chill and the short first runs start at once. */
    playAgain(mode, lastBoosts) {
      if (mode === 'rush' && S().runs >= BR.CFG.boostsFromRun && BR.readySheet) {
        BR.readySheet('rush', { preset: lastBoosts });
        this.preselectBoosts(lastBoosts);
        return;
      }
      this.closeResults(); this.start({ mode, boosts: {} });
    },
    /** Pick last time's Boosts on the sheet that has just opened (the ones the player can afford, in order). */
    preselectBoosts(ids) {
      if (!ids || !ids.length) return;
      const layer = $('layer-sheets'), sheet = layer && layer.lastElementChild;
      if (!sheet || !sheet.querySelector) return;
      let left = BR.Progress.coins;
      ids.forEach((id) => {
        const b = sheet.querySelector(`.boost[data-boost="${id}"]`), cost = BR.CFG.boosts[id] && BR.CFG.boosts[id].cost;
        if (b && cost != null && cost <= left && !b.classList.contains('on')) { left -= cost; b.click(); }
      });
    },
    /** "Chests": the opening fades in over the results, and only then does the screen under it change (no Shop, no black, in between). */
    resultsToChest() {
      const P = BR.Progress, own = ['golden'].concat(BR.CHEST_ORDER).find((id) => P.chestCount(id) > 0 && !P.chestStatus(id).complete);
      if (!own) { this.closeResults(); BR.Router.go('shop'); return; }
      BR.App.openChest(own);
      setTimeout(() => {
        if (this.resultsEl) this.closeResults(false, { silent: true, instant: true });
        if (BR.Router.current !== 'shop') BR.Router.go('shop');
      }, 520);
    },
    async animateXp(xp, banners) {
      const fill = $('resXp'), text = $('resXpText');
      if (!fill) return;
      const rm = BR.reducedMotion, gap = (ms) => sleep(rm ? Math.min(ms, 60) : ms);
      let level = xp.from.level, k = 0;
      for (const up of xp.ups) {
        if (!$('resXp')) return;
        fill.style.width = '100%'; text.textContent = `Level ${level} · full`;
        await gap(800);
        if (!$('resXp')) return;
        level = up.level; BR.audio.levelUp(); BR.haptic('win');
        if (banners[k]) banners[k].classList.add('in');
        k++;
        fill.style.transition = 'none'; fill.style.width = '0%'; void fill.offsetWidth; fill.style.transition = '';
        this.fx.confetti(['#ffd66b', '#3de1ff', '#ff3d8b', '#fff'], 40);
        await gap(500);
      }
      if (!$('resXp')) return;
      fill.style.width = (xp.xp / xp.need) * 100 + '%';
      text.textContent = `Level ${xp.level} · ${fmt(xp.xp)} / ${fmt(xp.need)}`;
    },
    closeResults(fromBack, o = {}) {
      const n = this.resultsEl; if (!n) return;
      if (this.backEntry) {
        const be = this.backEntry; this.backEntry = null;
        if (!fromBack) { if (o.silent) be.noHist = true; BR.Back.release(be); }   // (silent: another screen has already pushed its own entry on top)
      }
      BR.under(-1);
      this.resultsEl = null; this.modal = false; this.ending = false;
      const host = $('layer-overlays');
      host.style.pointerEvents = 'none'; n.style.pointerEvents = 'none';
      const gone = () => { n.remove(); if (!this.resultsEl) { $('layer-sheets').style.zIndex = ''; $('layer-opening').style.zIndex = ''; } };
      if (o.instant) { gone(); return; }
      n.classList.remove('on');
      setTimeout(gone, 420);
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
