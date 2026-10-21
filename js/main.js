/* Game controller: wires engine, board view, HUD, crate and input together. */
(function () {
  const BR = window.BR;
  const $ = (id) => document.getElementById(id);
  const sleep = BR.sleep;

  const CALLOUTS = [
    { n: 16, text: 'INSANE!', color: '#ff5fa8' },
    { n: 12, text: 'HUGE!', color: '#ff8a3d' },
    { n: 8, text: 'GREAT!', color: '#ffd66b' },
    { n: 5, text: 'NICE!', color: '#7ee8ff' },
  ];

  class App {
    constructor() {
      BR.applyPalette();
      this.store = BR.Storage;
      this.audio = BR.Audio;
      this.fx = new BR.FX($('fx'));
      this.ui = new BR.UI();
      this.view = new BR.BoardView({
        boardEl: $('board'), field: $('field'), wrap: $('boardWrap'), layer: $('fxlayer'), fx: this.fx, audio: this.audio,
      });
      this.crate = new BR.CrateUI({ fx: this.fx, audio: this.audio });
      this.engine = new BR.Engine();

      this.mode = 'menu'; // 'menu' | 'game'
      this.paused = false;
      this.inCrate = false;
      this.over = false;
      this.busy = false;
      this.token = 0;
      this.pressed = false;
      this.hoverCell = null;
      this.hoverPlan = null;
      this.buffered = null;
      this.idleTimer = 0;
      this.popsThisRun = 0;

      this.bind();
      this.applySettings();
      this.ui.setBest(this.store.data.best);
      this.ui.renderCollection();
      this.ui.spawnMenuBricks();
      this.ui.showScreen('menu');
      this.ui.setCore(this.engine);
      this.ui.setFuel(this.engine.fuel, false);
    }

    /* ================= settings ================= */
    applySettings() {
      const s = this.store.data.settings;
      this.audio.setEnabled(s.sound);
      document.body.classList.toggle('muted', !s.sound);
      document.documentElement.classList.toggle('shapes', s.shapes);
      document.documentElement.classList.toggle('reduced', s.reduced);
      BR.reducedMotion = s.reduced;
      this.view.reduced = s.reduced;
      this.fx.settings.shake = s.shake;
      this.fx.settings.reduced = s.reduced;
      $('setSound').checked = s.sound;
      $('setShake').checked = s.shake;
      $('setShapes').checked = s.shapes;
      $('setReduced').checked = s.reduced;
    }

    /* ================= events ================= */
    bind() {
      const on = (id, fn) => $(id).addEventListener('click', (e) => { this.audio.unlock(); fn(e); });
      on('btnPlay', () => { this.audio.ui(); this.startRun(); });
      on('btnCollection', () => { this.audio.ui(); this.ui.renderCollection(); this.ui.showScreen('collection'); });
      on('btnCollBack', () => { this.audio.ui(); this.ui.showScreen(this.mode === 'game' ? 'game' : 'menu'); });
      on('btnSettings', () => { this.audio.ui(); this.ui.overlay('settings', true); });
      on('btnPauseSettings', () => { this.audio.ui(); this.ui.overlay('settings', true); });
      on('btnSettingsDone', () => { this.audio.ui(); this.ui.overlay('settings', false); });
      on('btnPause', () => this.setPaused(true));
      on('btnResume', () => this.setPaused(false));
      on('btnRestart', () => { this.setPaused(false, true); this.startRun(); });
      on('btnQuit', () => this.toMenu());
      on('btnAgain', () => { this.ui.overlay('gameover', false); this.startRun(); });
      on('btnGoMenu', () => { this.ui.overlay('gameover', false); this.toMenu(); });
      on('btnSound', () => { const s = this.store.data.settings; s.sound = !s.sound; this.store.save(); this.applySettings(); if (s.sound) this.audio.ui(); });
      on('btnResetData', () => {
        if (window.confirm('Reset best score and collection?')) { this.store.reset(); this.applySettings(); this.ui.setBest(0); this.ui.renderCollection(); }
      });

      const bindToggle = (id, key) => $(id).addEventListener('change', (e) => { this.store.data.settings[key] = e.target.checked; this.store.save(); this.applySettings(); this.audio.ui(); });
      bindToggle('setSound', 'sound'); bindToggle('setShake', 'shake'); bindToggle('setShapes', 'shapes'); bindToggle('setReduced', 'reduced');

      // board input: hover preview (mouse), press-to-preview / release-to-pop (touch + mouse)
      const el = this.view.boardEl;
      el.addEventListener('pointerdown', (e) => {
        if (e.button != null && e.button > 0) return;
        this.pressed = true;
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        this.markActive();
        this.updateHover(e);
      });
      el.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse' || this.pressed) this.updateHover(e);
      });
      el.addEventListener('pointerup', (e) => {
        if (!this.pressed) return;
        this.pressed = false;
        const cell = this.view.cellAt(e.clientX, e.clientY);
        if (cell) this.tap(cell.r, cell.c);
        else this.clearHover();
        if (e.pointerType !== 'mouse') this.clearHover();
      });
      el.addEventListener('pointercancel', () => { this.pressed = false; this.clearHover(); });
      el.addEventListener('pointerleave', (e) => { if (!this.pressed && e.pointerType === 'mouse') this.clearHover(); });
      el.addEventListener('contextmenu', (e) => e.preventDefault());

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          if (this.inCrate) return;
          if ($('settings').classList.contains('show')) { this.ui.overlay('settings', false); return; }
          if (this.mode === 'game' && !this.over) this.setPaused(!this.paused);
        }
      });
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'game' && !this.over && !this.inCrate && !this.paused) this.setPaused(true); });
    }

    get canPlay() { return this.mode === 'game' && !this.paused && !this.over && !this.inCrate; }

    /* ================= run lifecycle ================= */
    async startRun() {
      const token = ++this.token;
      this.engine = new BR.Engine();
      const e = this.engine;
      this.mode = 'game'; this.paused = false; this.over = false; this.inCrate = false; this.busy = true;
      this.buffered = null; this.popsThisRun = 0;
      this.ui.overlay('pause', false); this.ui.overlay('gameover', false); this.ui.overlay('settings', false);
      this.ui.showScreen('game');
      this.ui.hideHint();
      this.ui.setScore(0, false);
      this.ui.setBest(this.store.data.best);
      this.ui.setFuel(e.fuel, false);
      this.ui.setMeter(0, e.need, false);
      this.ui.setCombo(0, 1, false);
      this.ui.setCore(e);
      this.view.setWild(null);
      this.view.layout();
      this.audio.start();
      await sleep(this.view.reduced ? 50 : 260);
      this.view.layout();
      const ok = await this.view.build(e.board);
      if (!ok || token !== this.token) return;
      this.busy = false;
      if (!this.store.data.seenTutorial) {
        this.ui.showHint('<b>Tap</b> a group of 2 or more matching bricks', 0);
        this.view.showHint(e.bestGroup());
      }
      this.armIdle(this.store.data.seenTutorial ? 7000 : 2500);
    }

    toMenu() {
      this.token++;
      this.mode = 'menu'; this.paused = false; this.over = false; this.busy = false; this.inCrate = false;
      this.view.setHighlight(null); this.view.hideHint(); clearTimeout(this.idleTimer);
      this.ui.hideHint();
      this.ui.overlay('pause', false); this.ui.overlay('gameover', false);
      this.ui.setBest(this.store.data.best);
      this.ui.showScreen('menu');
    }

    setPaused(on, silent) {
      if (this.mode !== 'game' || this.over || this.inCrate) return;
      this.paused = on;
      if (!silent) this.audio.ui();
      this.ui.overlay('pause', on);
      if (on) { this.clearHover(); this.pressed = false; this.view.hideHint(); }
      else this.armIdle(7000);
    }

    /* ================= input ================= */
    refreshHover() {
      const lp = this.lastPointer;
      if (lp && lp.type === 'mouse' && this.canPlay && !this.busy) this.updateHover(lp);
    }
    updateHover(e) {
      this.lastPointer = { clientX: e.clientX, clientY: e.clientY, type: e.pointerType };
      if (!this.canPlay || this.busy) { this.clearHover(); return; }
      const cell = this.view.cellAt(e.clientX, e.clientY);
      if (!cell) { this.clearHover(); return; }
      if (this.hoverCell && this.hoverCell.r === cell.r && this.hoverCell.c === cell.c && this.hoverPlan && this.hoverPlan.version === this.engine.board.version) return;
      this.hoverCell = cell;
      const plan = this.engine.plan(cell.r, cell.c);
      this.hoverPlan = plan;
      this.view.setHighlight(plan);
    }
    clearHover() {
      this.hoverCell = null; this.hoverPlan = null;
      this.view.setHighlight(null);
    }

    markActive() {
      this.view.hideHint();
      this.armIdle(7000);
    }
    armIdle(ms) {
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => {
        if (this.canPlay && !this.busy) this.view.showHint(this.engine.bestGroup());
      }, ms);
    }

    async tap(r, c) {
      if (!this.canPlay) return;
      if (this.busy) { this.buffered = { r, c, t: performance.now() }; return; }
      const e = this.engine;
      const hp = this.hoverPlan;
      const plan = hp && hp.r === r && hp.c === c && hp.version === e.board.version ? hp : e.plan(r, c);
      if (!plan) {
        this.view.reject(r, c);
        this.audio.deny();
        this.clearHover();
        return;
      }
      await this.runTurn(plan);
    }

    flushBuffer() {
      const b = this.buffered;
      this.buffered = null;
      if (b && performance.now() - b.t < 800) this.tap(b.r, b.c);
    }

    /* ================= one turn ================= */
    async runTurn(plan) {
      const token = this.token;
      try {
        await this._runTurn(plan, token);
      } catch (err) {
        // Never leave the game locked if something unexpected throws mid-turn.
        console.error(err);
        if (token === this.token) { this.busy = false; this.inCrate = false; this.view.syncTo(this.engine.board); this.view.setWild(this.engine.wild()); this.ui.setScore(this.engine.score, false); this.ui.setFuel(this.engine.fuel, false); }
      }
    }

    async _runTurn(plan, token) {
      this.busy = true;
      this.clearHover();
      this.view.hideHint();
      const e = this.engine;
      const res = e.commit(plan);
      if (!res) { this.busy = false; return; }
      this.popsThisRun++;
      this.feedback(res);

      const ok = await this.view.playResult(res);
      if (!ok || token !== this.token) return;
      this.ui.refreshCoreBadge(e);

      await this.processCrates(token);
      if (token !== this.token) return;

      if (e.fuel <= 0) { await this.endRun(token); return; }
      this.busy = false;
      this.armIdle(7000);
      if (this.buffered) this.flushBuffer(); else this.refreshHover();
    }

    /** Everything the player should feel the instant a pop happens. */
    feedback(res) {
      const e = this.engine, ui = this.ui, p = res.plan, view = this.view;
      const n = p.n;
      this.audio.pop(n, e.streak);
      if (e.streak >= 2) this.audio.combo(e.streak);

      ui.setScore(e.score);
      ui.setFuel(e.fuel);
      ui.setMeter(Math.min(e.charge, e.need), e.need);
      ui.setCombo(e.streak, BR.comboMult(e.streak), true);
      if (res.comboBefore >= 2 && e.streak < 2) ui.callout('Combo lost', '#9aa8d6');

      const delta = res.fuelAfter - res.fuelBefore;
      if (delta !== 0) this.fuelFloat(delta);
      if (res.fuelAfter <= 5 && res.fuelAfter < res.fuelBefore) this.audio.lowFuel();

      // floating score at the group's center
      let sr = 0, sc = 0;
      p.primary.forEach((q) => { sr += q.r; sc += q.c; });
      sr /= n; sc /= n;
      const pos = view.layerPoint(sr, sc);
      pos.y -= view.cell * 0.15;
      const big = p.points >= 1000;
      ui.floatText('+' + p.points.toLocaleString(), pos.x, pos.y, {
        size: Math.min(46, 20 + Math.log2(Math.max(2, p.points)) * 2.2),
        color: p.line ? '#9ff0ff' : n >= 8 ? '#ffd66b' : '#fff',
        glow: p.line ? 'rgba(80,220,255,.8)' : n >= 8 ? 'rgba(255,200,60,.8)' : 'rgba(255,255,255,.4)',
        rise: 50 + Math.min(40, n * 3),
      });
      if (p.combo > 1) ui.floatText(`x${p.combo % 1 ? p.combo.toFixed(1) : p.combo} combo`, pos.x, pos.y + 24, { size: 14, color: '#ffb547', glow: 'rgba(255,150,40,.7)', rise: 40, delay: 90 });
      void big;

      const callout = p.line ? { text: 'LINE BLAST!', color: '#7ee8ff' } : CALLOUTS.find((c) => n >= c.n);
      if (callout) ui.callout(callout.text, callout.color);

      // impact
      const pt = view.pagePoint(sr, sc);
      if (n >= 5) { this.fx.ring(pt.x, pt.y, '#ffffff', 60 + n * 9, 0.5, 4); }
      if (n >= 6) this.fx.shake($('app'), Math.min(11, 2 + n * 0.7), 300 + Math.min(300, n * 20));
      if (n >= 10) this.fx.flash('#ffffff', Math.min(0.28, n * 0.014), 280);

      this.coreFlair(res, pt);

      if (p.line) {
        this.audio.line();
        this.fx.flash('#9ff0ff', 0.3, 520);
        this.fx.shake($('app'), 12, 480);
        if (p.lineH) this.beam('row', p.r);
        if (p.lineV) this.beam('col', p.c);
      }
      if (res.shuffle.length) setTimeout(() => this.ui.callout('Reshuffle', '#c4b5ff'), 700);

      // tutorial nudges
      if (!this.store.data.seenTutorial) {
        if (this.popsThisRun === 1) ui.showHint('Big groups <b>refund Fuel</b>. At zero, the run ends.', 4600);
        else if (this.popsThisRun === 4) { ui.showHint('Fill the <b>crate meter</b> to pull a Core that changes the rules.', 5200); this.store.data.seenTutorial = true; this.store.save(); }
      }
    }

    coreFlair(res, pt) {
      const core = this.engine.core;
      if (!core) return;
      const p = res.plan;
      if (core.id === 'bomb') {
        const origin = this.view.pagePoint(p.r, p.c);
        this.fx.explosion(origin.x, origin.y, '#ff9a3d', 0.9);
        this.fx.flash('#ffb066', 0.28, 360);
        this.fx.shake($('app'), 9, 380);
      } else if (core.id === 'laser' && p.n >= 6) {
        this.beam('row', p.r, '#ff6a6a'); this.beam('col', p.c, '#ff6a6a');
        this.audio.line();
      } else if (core.id === 'twin' && p.x > 0) {
        const mirror = this.view.pagePoint(p.r, BR.CFG.cols - 1 - p.c);
        this.fx.ring(mirror.x, mirror.y, '#eb4b4b', 90, 0.6, 5);
        this.fx.sparks(mirror.x, mirror.y, '#ff8f8f', 16, 1.4, 0.7);
      } else if (core.id === 'chain' && p.x > 0) {
        this.fx.ring(pt.x, pt.y, '#8847ff', 110, 0.6, 5);
      } else if (core.id === 'spark' && p.x > 0) {
        this.fx.sparks(pt.x, pt.y, '#ffe27a', 18, 1.5, 0.7);
      } else if (core.id === 'midas') {
        this.fx.sparks(pt.x, pt.y, '#ffd700', 22, 1.6, 0.9);
      } else if (core.id === 'singularity') {
        this.fx.ring(pt.x, pt.y, '#ffd700', 140, 0.8, 6);
      } else if (core.id === 'freeze') {
        this.fx.sparks(pt.x, pt.y, '#9fe8ff', 14, 1.1, 0.8);
      }
      if (core.id === 'freeze') this.ui.refreshCoreBadge(this.engine);
    }

    beam(kind, idx, color = '#9ff0ff') {
      const v = this.view, cell = v.cell, layer = $('fxlayer');
      const p0 = v.layerPoint(0, 0);
      const el = document.createElement('div');
      const len = cell * BR.CFG.cols;
      el.style.cssText = `position:absolute;pointer-events:none;z-index:4;border-radius:999px;background:linear-gradient(90deg,transparent,#fff 18%,${color} 50%,#fff 82%,transparent);box-shadow:0 0 34px 10px ${color}99;`;
      if (kind === 'row') {
        el.style.left = p0.x - cell / 2 + 'px'; el.style.top = p0.y + idx * cell - cell * 0.32 + 'px'; el.style.width = len + 'px'; el.style.height = cell * 0.64 + 'px';
      } else {
        el.style.background = `linear-gradient(180deg,transparent,#fff 18%,${color} 50%,#fff 82%,transparent)`;
        el.style.left = p0.x + idx * cell - cell * 0.32 + 'px'; el.style.top = p0.y - cell / 2 + 'px'; el.style.width = cell * 0.64 + 'px'; el.style.height = len + 'px';
      }
      layer.appendChild(el);
      const row = kind === 'row';
      const a = el.animate([
        { transform: row ? 'scaleX(0) scaleY(0.2)' : 'scaleY(0) scaleX(0.2)', opacity: 1 },
        { transform: 'scale(1,1)', opacity: 1, offset: 0.28 },
        { transform: row ? 'scaleX(1) scaleY(0.05)' : 'scaleY(1) scaleX(0.05)', opacity: 0 },
      ], { duration: 560, easing: 'cubic-bezier(0.2,0.8,0.3,1)', fill: 'forwards' });
      a.onfinish = () => el.remove();
    }

    fuelFloat(delta) {
      const host = $('fuelStat');
      const el = document.createElement('div');
      el.textContent = (delta > 0 ? '+' : '') + delta;
      el.style.cssText = `position:absolute;right:14px;top:8px;font-family:var(--font-display);font-weight:700;font-size:20px;pointer-events:none;color:${delta > 0 ? '#3ddc97' : '#ff8b99'};text-shadow:0 2px 0 rgba(0,0,0,.4)`;
      host.appendChild(el);
      const a = el.animate([
        { transform: 'translateY(8px) scale(0.6)', opacity: 0 },
        { transform: 'translateY(-4px) scale(1.15)', opacity: 1, offset: 0.2 },
        { transform: 'translateY(-26px) scale(1)', opacity: 0 },
      ], { duration: 900, easing: 'ease-out', fill: 'forwards' });
      a.onfinish = () => el.remove();
    }

    /* ================= crates ================= */
    async processCrates(token) {
      const e = this.engine;
      while (e.crateReady()) {
        this.ui.setMeter(e.need, e.need);
        this.audio.combo(6);
        await sleep(this.view.reduced ? 300 : 800);
        if (token !== this.token) return;
        const colorsBefore = e.board.colorCount;
        e.takeCrate();
        const core = e.rollCrate();
        const isNew = this.store.isNew(core.id);
        this.inCrate = true;
        this.view.hideHint();
        const choice = await this.crate.run({ core, isNew, current: e.core });
        if (token !== this.token) return;
        this.inCrate = false;
        this.store.record(core.id);
        this.ui.renderCollection();
        if (choice === 'equip') {
          e.equip(core);
          this.view.setWild(e.wild());
          this.ui.setCore(e, true);
        } else {
          const gain = e.scrap(core);
          this.ui.setFuel(e.fuel);
          this.fuelFloat(gain);
        }
        this.ui.setMeter(e.charge, e.need);
        if (e.board.colorCount > colorsBefore) setTimeout(() => this.ui.showHint('A <b>new brick color</b> joins the board', 3600), 500);
        await sleep(this.view.reduced ? 100 : 420);
      }
    }

    /* ================= game over ================= */
    async endRun(token) {
      const e = this.engine;
      this.over = true;
      this.clearHover();
      this.view.hideHint();
      this.ui.overlay('pause', false);
      const isBest = e.score > this.store.data.best;
      if (isBest) this.store.data.best = e.score;
      this.store.data.runs++;
      this.store.save();
      this.ui.setBest(this.store.data.best);
      this.audio.gameOver();
      this.ui.callout('Out of fuel', '#ff8b99');
      await sleep(this.view.reduced ? 200 : 650);
      await this.view.crumble();
      if (token !== this.token) return;

      $('goScore').textContent = '0';
      $('goPops').textContent = e.pops;
      $('goBiggest').textContent = e.biggest;
      $('goCombo').textContent = 'x' + BR.comboMult(e.maxCombo).toString().replace(/(\.\d).*/, '$1');
      $('goCrates').textContent = e.cratesOpened;
      $('goBest').classList.toggle('show', isBest && e.score > 0);
      const gc = $('goCore');
      if (e.core) { const r = BR.rarityById[e.core.rarity]; gc.style.setProperty('--rc', r.color); gc.innerHTML = `Final Core: <b>${e.core.name}</b>`; }
      else gc.textContent = 'You never equipped a Core';
      this.ui.overlay('gameover', true);
      this.ui.countTo($('goScore'), e.score, this.view.reduced ? 10 : 1100, 0);
      if (isBest && e.score > 0) this.audio.newBest();
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    window.__brick = app; // handy for debugging / tests
  });
})();
