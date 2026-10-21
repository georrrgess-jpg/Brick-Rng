/* Game controller: input, turn flow, rounds, boosters, XP / level-ups, Geodes and Vault wiring. */
(function () {
  const BR = window.BR;
  const $ = (id) => document.getElementById(id);
  const sleep = BR.sleep;
  const fmt = (n) => BR.fmt(n);

  const CALLOUTS = [
    { n: 16, text: 'INSANE!', color: '#ff5fa8' },
    { n: 12, text: 'HUGE!', color: '#ff8a3d' },
    { n: 8, text: 'GREAT!', color: '#ffd66b' },
    { n: 5, text: 'NICE!', color: '#7ee8ff' },
  ];
  const BOOSTER_COLOR = { hammer: '#ffb347', beam: '#7ae8ff', prism: '#d27aff' };

  class App {
    constructor() {
      BR.applyPalette();
      this.store = BR.Storage;
      this.audio = BR.Audio;
      this.fx = new BR.FX($('fx'));
      this.ui = new BR.UI();
      this.view = new BR.BoardView({ boardEl: $('board'), field: $('field'), wrap: $('boardWrap'), layer: $('fxlayer'), fx: this.fx, audio: this.audio });
      this.geode = new BR.GeodeUI({ fx: this.fx, audio: this.audio });
      this.vault = new BR.Vault({
        audio: this.audio,
        hooks: { openGeodes: () => this.openGeodes(), fused: (d) => this.fusedReveal(d), changed: () => this.ui.refreshMenu() },
      });
      this.engine = new BR.Engine();

      this.mode = 'menu'; // 'menu' | 'game' | 'vault'
      this.paused = false;
      this.over = false;
      this.busy = false;
      this.modal = false; // a full-screen flow (Geode, round clear, results) owns input
      this.token = 0;
      this.pressed = false;
      this.hoverCell = null;
      this.hoverPlan = null;
      this.buffered = null;
      this.idleTimer = 0;
      this.armed = null;
      this.flushed = true;
      this.popsThisRun = 0;

      this.bind();
      BR.Skins.apply();
      this.applySettings();
      this.ui.setBest(this.store.data.best);
      this.ui.spawnMenuBricks();
      this.ui.refreshMenu();
      this.ui.showScreen('menu');
      this.syncHud(false);
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
      $('setSound').checked = s.sound; $('setShake').checked = s.shake; $('setShapes').checked = s.shapes; $('setReduced').checked = s.reduced;
    }

    /* ================= events ================= */
    bind() {
      const on = (id, fn) => $(id).addEventListener('click', (e) => { this.audio.unlock(); fn(e); });
      on('btnPlay', () => { this.audio.ui(); this.startRun(); });
      on('btnGeodes', () => { this.audio.ui(); if (BR.Progress.geodeCount() > 0) this.openGeodes(); else this.openVault(); });
      on('btnVault', () => { this.audio.ui(); this.openVault(); });
      on('btnVaultBack', () => { this.audio.ui(); this.mode = 'menu'; this.ui.refreshMenu(); this.ui.showScreen('menu'); });
      on('btnSettings', () => { this.audio.ui(); this.ui.overlay('settings', true); });
      on('btnPauseSettings', () => { this.audio.ui(); this.ui.overlay('settings', true); });
      on('btnSettingsDone', () => { this.audio.ui(); this.ui.overlay('settings', false); });
      on('btnPause', () => this.setPaused(true));
      on('btnResume', () => this.setPaused(false));
      on('btnRestart', () => { this.abandonRun(); this.setPaused(false, true); this.startRun(); });
      on('btnQuit', () => this.toMenu());
      on('btnAgain', () => { this.ui.overlay('gameover', false); this.startRun(); });
      on('btnGoMenu', () => { this.ui.overlay('gameover', false); this.toMenu(); });
      on('btnGoGeodes', async () => { await this.openGeodes(); this.refreshGoGeodes(); });
      on('btnSound', () => { const s = this.store.data.settings; s.sound = !s.sound; this.store.save(); this.applySettings(); if (s.sound) this.audio.ui(); });
      on('btnResetData', (e) => {
        // Two-tap confirm (embedded viewers can suppress confirm()).
        const btn = e.currentTarget;
        if (btn.dataset.armed !== '1') {
          btn.dataset.armed = '1';
          btn.textContent = 'Tap again to erase everything';
          clearTimeout(this.resetTimer);
          this.resetTimer = setTimeout(() => { btn.dataset.armed = ''; btn.textContent = 'Reset all progress'; }, 3500);
          return;
        }
        clearTimeout(this.resetTimer);
        btn.dataset.armed = ''; btn.textContent = 'Reset all progress';
        this.store.reset(); BR.Skins.apply(); this.applySettings(); this.ui.setBest(0); this.ui.refreshMenu(); this.vault.render();
      });
      const bindToggle = (id, key) => $(id).addEventListener('change', (e) => { this.store.data.settings[key] = e.target.checked; this.store.save(); this.applySettings(); this.audio.ui(); });
      bindToggle('setSound', 'sound'); bindToggle('setShake', 'shake'); bindToggle('setShapes', 'shapes'); bindToggle('setReduced', 'reduced');

      // Boosters
      this.ui.el.slots.addEventListener('click', (e) => { const b = e.target.closest('.bslot'); if (b) { this.audio.unlock(); this.onSlot(b.dataset.b); } });

      // board input: hover preview (mouse), press-to-preview / release-to-pop (touch + mouse)
      const el = this.view.boardEl;
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
        const cell = this.view.cellAt(e.clientX, e.clientY);
        if (cell) this.tap(cell.r, cell.c); else this.clearHover();
        if (e.pointerType !== 'mouse') this.clearHover();
      });
      el.addEventListener('pointercancel', () => { this.pressed = false; this.clearHover(); });
      el.addEventListener('pointerleave', (e) => { if (!this.pressed && e.pointerType === 'mouse') this.clearHover(); });
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.armed) this.disarm(); });

      window.addEventListener('keydown', (e) => {
        if (this.modal) return;
        if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
          if ($('settings').classList.contains('show')) { this.ui.overlay('settings', false); return; }
          if (this.armed) { this.disarm(); return; }
          if (this.mode === 'game' && !this.over) this.setPaused(!this.paused);
        } else if (this.mode === 'game' && this.canPlay && ['1', '2', '3'].includes(e.key)) {
          this.onSlot(BR.BOOSTER_ORDER[+e.key - 1]);
        }
      });
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'game' && !this.over && !this.modal && !this.paused) this.setPaused(true); });
    }

    get canPlay() { return this.mode === 'game' && !this.paused && !this.over && !this.modal; }

    /* ================= HUD sync ================= */
    syncHud(animate = true) {
      const e = this.engine, ui = this.ui;
      ui.setScore(e.score, false);
      ui.setRound(e.round);
      ui.setMoves(e.movesLeft, animate);
      ui.setGoal(e.roundScore, e.goal, animate);
      ui.setCharge(e.charge, animate);
      ui.renderBoosters(e.inv, this.armed, null);
    }

    /* ================= run lifecycle ================= */
    async startRun() {
      const token = ++this.token;
      this.engine = new BR.Engine();
      const e = this.engine;
      this.mode = 'game'; this.paused = false; this.over = false; this.modal = false; this.busy = true;
      this.buffered = null; this.popsThisRun = 0; this.flushed = false; this.armed = null;
      ['pause', 'gameover', 'settings', 'roundclear'].forEach((id) => this.ui.overlay(id, false));
      this.ui.showScreen('game');
      this.ui.hideHint(); this.ui.aimBanner('');
      this.ui.setBest(this.store.data.best);
      this.ui.setCombo(0, 1, false);
      this.syncHud(false);
      this.view.layout();
      this.audio.start();
      await sleep(this.view.reduced ? 50 : 260);
      this.view.layout();
      const ok = await this.view.build(e.board);
      if (!ok || token !== this.token) return;
      this.busy = false;
      this.ui.callout('Round 1', '#8fc2ff');
      if (!this.store.data.seenTutorial) {
        this.ui.showHint('<b>Tap</b> a group of 2 or more matching bricks', 0);
        this.view.showHint(e.bestGroup());
      }
      this.armIdle(this.store.data.seenTutorial ? 7000 : 2500);
    }

    /** Leaving a run early still banks the XP and stats earned so far. */
    abandonRun() {
      if (this.mode === 'game' && !this.over) this.flushRun();
    }

    toMenu() {
      this.abandonRun();
      this.token++;
      this.mode = 'menu'; this.paused = false; this.over = false; this.busy = false; this.modal = false; this.armed = null;
      this.view.setHighlight(null); this.view.hideHint(); clearTimeout(this.idleTimer);
      this.ui.hideHint(); this.ui.aimBanner('');
      ['pause', 'gameover', 'roundclear'].forEach((id) => this.ui.overlay(id, false));
      this.ui.setBest(this.store.data.best);
      this.ui.refreshMenu();
      this.ui.showScreen('menu');
    }

    setPaused(on, silent) {
      if (this.mode !== 'game' || this.over || this.modal) return;
      this.paused = on;
      if (!silent) this.audio.ui();
      this.ui.overlay('pause', on);
      if (on) { this.clearHover(); this.pressed = false; this.view.hideHint(); }
      else this.armIdle(7000);
    }

    /* ================= input ================= */
    updateHover(e) {
      this.lastPointer = { clientX: e.clientX, clientY: e.clientY, type: e.pointerType };
      if (!this.canPlay || this.busy) { this.clearHover(); return; }
      const cell = this.view.cellAt(e.clientX, e.clientY);
      if (!cell) { this.clearHover(); return; }
      const ver = this.engine.board.version;
      if (this.hoverCell && this.hoverCell.r === cell.r && this.hoverCell.c === cell.c && this.hoverVer === ver && this.hoverArmed === this.armed) return;
      this.hoverCell = cell; this.hoverVer = ver; this.hoverArmed = this.armed;
      if (this.armed) {
        const cells = this.engine.boosterCells(this.armed, cell.r, cell.c);
        this.hoverPlan = null;
        this.view.setCellHighlight(cells, cells.length ? `${cells.length} bricks` : '');
      } else {
        this.hoverPlan = this.engine.plan(cell.r, cell.c);
        this.view.setHighlight(this.hoverPlan);
      }
    }
    refreshHover() {
      const lp = this.lastPointer;
      if (lp && lp.type === 'mouse' && this.canPlay && !this.busy) this.updateHover(lp);
    }
    clearHover() {
      this.hoverCell = null; this.hoverPlan = null;
      this.view.setHighlight(null);
    }
    markActive() { this.view.hideHint(); this.armIdle(7000); }
    armIdle(ms) {
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => { if (this.canPlay && !this.busy && !this.armed) this.view.showHint(this.engine.bestGroup()); }, ms);
    }

    async tap(r, c) {
      if (!this.canPlay) return;
      if (this.busy) { this.buffered = { r, c, t: performance.now() }; return; }
      const e = this.engine;
      if (this.armed) { await this.useBooster(this.armed, r, c); return; }
      const hp = this.hoverPlan;
      const plan = hp && hp.r === r && hp.c === c && hp.version === e.board.version ? hp : e.plan(r, c);
      if (!plan) { this.view.reject(r, c); this.audio.deny(); this.clearHover(); return; }
      await this.guarded((t) => this.runTurn(plan, t));
    }

    flushBuffer() {
      const b = this.buffered;
      this.buffered = null;
      if (b && performance.now() - b.t < 800) this.tap(b.r, b.c);
    }

    async guarded(fn) {
      const token = this.token;
      try { await fn(token); } catch (err) {
        // never leave the game locked if something throws mid-turn
        console.error(err);
        if (token === this.token) { this.busy = false; this.modal = false; this.view.syncTo(this.engine.board); this.syncHud(false); }
      }
    }

    /* ================= Boosters ================= */
    onSlot(type) {
      if (!this.canPlay || this.busy) return;
      const e = this.engine;
      if (e.inv[type] <= 0) {
        this.audio.deny();
        this.ui.showHint('Pops of 4+ charge the bar. Every full bar earns a Booster.', 3200);
        return;
      }
      if (this.armed === type) { this.disarm(); return; }
      this.armed = type;
      this.audio.boosterArm();
      this.clearHover();
      this.view.hideHint();
      this.ui.hideHint();
      this.ui.renderBoosters(e.inv, this.armed, null);
      this.ui.aimBanner(BR.BOOSTERS[type].aim, BOOSTER_COLOR[type]);
      if (this.lastPointer && this.lastPointer.type === 'mouse') this.updateHover(this.lastPointer);
    }
    disarm() {
      this.armed = null;
      this.clearHover();
      this.ui.aimBanner('');
      this.ui.renderBoosters(this.engine.inv, null, null);
    }

    async useBooster(type, r, c) {
      const e = this.engine;
      if (!e.board.get(r, c)) return;
      this.busy = true;
      this.clearHover();
      this.view.hideHint();
      this.ui.hideHint();
      const res = e.applyBooster(type, r, c);
      this.armed = null;
      this.ui.aimBanner('');
      if (!res) { this.busy = false; this.ui.renderBoosters(e.inv, null, null); return; }
      this.ui.renderBoosters(e.inv, null, null);
      await this.guarded(async (token) => {
        this.boosterFeedback(res);
        const ok = await this.view.playResult(res);
        if (!ok || token !== this.token) return;
        await this.afterAction(token);
      });
    }

    boosterFeedback(res) {
      const e = this.engine, p = res.plan, view = this.view, ui = this.ui;
      this.audio.boosterUse(res.type);
      ui.setScore(e.score);
      ui.setGoal(e.roundScore, e.goal);
      const pos = view.layerPoint(res.tap.r, res.tap.c);
      ui.floatText('+' + fmt(p.points), pos.x, pos.y, { size: 30, color: BOOSTER_COLOR[res.type], glow: BOOSTER_COLOR[res.type] });
      ui.callout(BR.BOOSTERS[res.type].name.toUpperCase() + '!', BOOSTER_COLOR[res.type]);
      const pt = view.pagePoint(res.tap.r, res.tap.c);
      this.fx.flash(BOOSTER_COLOR[res.type], 0.28, 380);
      this.fx.shake($('app'), res.type === 'hammer' ? 13 : 9, 420);
      if (res.type === 'hammer') { this.fx.explosion(pt.x, pt.y, '#ffb347', 1.1); }
      else if (res.type === 'beam') { this.beam('row', res.tap.r, '#7ae8ff'); this.beam('col', res.tap.c, '#7ae8ff'); }
      else {
        this.fx.ring(pt.x, pt.y, '#d27aff', 160, 0.7, 6);
        res.removed.slice(0, 14).forEach((q, i) => { const t = view.pagePoint(q.r, q.c); setTimeout(() => this.fx.bolt(pt.x, pt.y, t.x, t.y, BR.PALETTE[q.color].hi), i * 22); });
      }
    }

    /* ================= one turn ================= */
    async runTurn(plan, token) {
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
      await this.afterAction(token);
    }

    async afterAction(token) {
      const e = this.engine;
      if (e.roundCleared()) { await this.roundClear(token); if (token !== this.token) return; }
      else if (e.outOfMoves()) { await this.endRun(token); return; }
      this.ui.renderBoosters(e.inv, null, null);
      this.busy = false;
      this.armIdle(7000);
      if (this.buffered) this.flushBuffer(); else this.refreshHover();
    }

    /** Everything the player should feel the instant a pop happens. */
    feedback(res) {
      const e = this.engine, ui = this.ui, p = res.plan, view = this.view;
      const n = p.n;
      const flavor = BR.Skins.burst === 'classic' ? null : BR.Skins.burst;
      this.audio.pop(n, e.streak, flavor);
      if (e.streak >= 2) this.audio.combo(e.streak);

      ui.setScore(e.score);
      ui.setMoves(e.movesLeft);
      ui.setGoal(e.roundScore, e.goal);
      ui.setCharge(e.charge);
      ui.setCombo(e.streak, BR.comboMult(e.streak), true);
      if (res.comboBefore >= 2 && e.streak < 2) ui.callout('Combo lost', '#9aa8d6');
      if (res.boostersGained && res.boostersGained.length) {
        ui.renderBoosters(e.inv, this.armed, res.boostersGained);
        this.audio.boosterGain();
        setTimeout(() => ui.callout(BR.BOOSTERS[res.boostersGained[0]].name + ' ready!', BOOSTER_COLOR[res.boostersGained[0]]), 250);
      } else ui.renderBoosters(e.inv, this.armed, null);
      if (e.movesLeft <= 3 && e.movesLeft > 0 && !e.roundCleared()) this.audio.lowFuel();

      let sr = 0, sc = 0;
      p.primary.forEach((q) => { sr += q.r; sc += q.c; });
      sr /= n; sc /= n;
      const pos = view.layerPoint(sr, sc);
      pos.y -= view.cell * 0.15;
      ui.floatText('+' + fmt(p.points), pos.x, pos.y, {
        size: Math.min(46, 20 + Math.log2(Math.max(2, p.points)) * 2.2),
        color: p.line ? '#9ff0ff' : n >= 8 ? '#ffd66b' : '#fff',
        glow: p.line ? 'rgba(80,220,255,.8)' : n >= 8 ? 'rgba(255,200,60,.8)' : 'rgba(255,255,255,.4)',
        rise: 50 + Math.min(40, n * 3),
      });
      if (p.combo > 1) ui.floatText(`x${p.combo % 1 ? p.combo.toFixed(1) : p.combo} combo`, pos.x, pos.y + 24, { size: 14, color: '#ffb547', glow: 'rgba(255,150,40,.7)', rise: 40, delay: 90 });

      const callout = p.line ? { text: 'LINE BLAST!', color: '#7ee8ff' } : CALLOUTS.find((c) => n >= c.n);
      if (callout) ui.callout(callout.text, callout.color);

      const pt = view.pagePoint(sr, sc);
      if (n >= 5) this.fx.ring(pt.x, pt.y, '#ffffff', 60 + n * 9, 0.5, 4);
      if (n >= 6) this.fx.shake($('app'), Math.min(11, 2 + n * 0.7), 300 + Math.min(300, n * 20));
      if (n >= 10) this.fx.flash('#ffffff', Math.min(0.28, n * 0.014), 280);
      if (p.line) {
        this.audio.line();
        this.fx.flash('#9ff0ff', 0.3, 520);
        this.fx.shake($('app'), 12, 480);
        if (p.lineH) this.beam('row', p.r);
        if (p.lineV) this.beam('col', p.c);
      }
      if (res.shuffle.length) setTimeout(() => this.ui.callout('Reshuffle', '#c4b5ff'), 700);

      if (!this.store.data.seenTutorial) {
        if (this.popsThisRun === 1) ui.showHint('Reach the <b>goal bar</b> before you run out of moves.', 4800);
        else if (this.popsThisRun === 3) ui.showHint('Pops of 4+ <b>charge Boosters</b>. Tap one, then tap the board.', 5200);
        else if (this.popsThisRun === 5) { this.store.data.seenTutorial = true; this.store.save(); }
      }
    }

    beam(kind, idx, color) {
      color = color || BR.Skins.beam || '#9ff0ff';
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

    /* ================= rounds ================= */
    async roundClear(token) {
      const e = this.engine, ui = this.ui, view = this.view;
      this.view.setHighlight(null); this.view.hideHint();
      this.audio.roundClear();
      this.fx.flash('#ffe9a8', 0.25, 600);
      ui.callout(`Round ${e.round} clear!`, '#ffd66b');
      ui.setCombo(0, 1, false);
      await sleep(view.reduced ? 200 : 900);
      if (token !== this.token) return;

      // leftover moves shatter a patch of bricks for bonus points
      const left = e.movesLeft;
      let bonus = 0;
      if (left > 0) {
        const res = e.shatter();
        bonus = res.bonus;
        this.audio.shatterBonus();
        ui.setScore(e.score);
        ui.countTo($('movesVal'), 0, 600, left);
        ui.callout(`Move bonus +${fmt(bonus)}`, '#7ee8ff');
        this.fx.shake($('app'), 10, 420);
        const ok = await view.playResult(res);
        if (!ok || token !== this.token) return;
      }
      ui.setMoves(0, false);

      // XP for this round
      const rows = BR.Progress.roundRows(e, false);
      const daily = BR.Progress.dailyRow();
      if (daily) rows.push(daily);
      const xp = rows.reduce((a, r) => a + r.xp, 0);
      const res = BR.Progress.addXp(xp);
      this.store.data.best = Math.max(this.store.data.best, e.score);
      this.store.save();

      $('rcEyebrow').textContent = 'Round clear';
      $('rcTitle').textContent = 'Round ' + e.round;
      $('rcBonus').textContent = bonus ? `Move bonus +${fmt(bonus)}` : 'Cleared with no moves to spare';
      ui.renderRows($('rcRows'), rows, this.audio);
      $('rcGeode').textContent = ''; $('rcGeode').classList.remove('show');
      this.modal = true;
      ui.overlay('roundclear', true);
      this.animateXp('rc', res, rows.length);
      await new Promise((resolve) => {
        const btn = $('btnNextRound');
        const done = () => { btn.removeEventListener('click', done); window.removeEventListener('keydown', onKey, true); resolve(); };
        const onKey = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); done(); } };
        btn.addEventListener('click', done);
        window.addEventListener('keydown', onKey, true);
      });
      if (token !== this.token) return;
      this.audio.ui();
      ui.overlay('roundclear', false);
      this.modal = false;
      e.nextRound();
      this.syncHud(true);
      const colorsNew = e.board.colorCount;
      await sleep(250);
      ui.callout('Round ' + e.round, '#8fc2ff');
      ui.showHint(`Goal ${fmt(e.goal)}${(e.round === BR.CFG.sixthColorRound || e.round === BR.CFG.seventhColorRound) ? ' · <b>a new brick color</b> joins' : ''}`, 3000);
      void colorsNew;
    }

    /** Fill an XP bar from where it was, through any level-ups (each with a Geode), to where it is now. */
    async animateXp(prefix, res, rowCount) {
      const ui = this.ui, audio = this.audio;
      const ids = { fill: prefix + 'XpFill', text: prefix + 'XpText', lvl: prefix + 'Level', geode: prefix + 'Geode' };
      const g = $(ids.geode);
      const myToken = (this._xpToken = (this._xpToken || 0) + 1);
      ui.xpBar(ids.fill, ids.text, ids.lvl, res.from.level, res.from.xp, res.from.need, false);
      await sleep(BR.reducedMotion ? 100 : 450 + rowCount * 110);
      let level = res.from.level;
      for (const up of res.ups) {
        if (myToken !== this._xpToken) return;
        const need = BR.xpForLevel(level);
        ui.xpBar(ids.fill, ids.text, ids.lvl, level, need, need, true);
        await sleep(BR.reducedMotion ? 100 : 800);
        level = up.level;
        audio.levelUp();
        ui.xpBar(ids.fill, ids.text, ids.lvl, level, 0, BR.xpForLevel(level), false);
        g.textContent = `Level ${level}! ${up.kind === 'series' ? 'Series Geode' : 'Geode'} earned`;
        g.classList.remove('show'); void g.offsetWidth; g.classList.add('show');
        this.fx.confetti(['#ffd66b', '#8fc2ff', '#ffffff'], 36);
        await sleep(BR.reducedMotion ? 100 : 700);
      }
      if (myToken !== this._xpToken) return;
      ui.xpBar(ids.fill, ids.text, ids.lvl, res.level, res.xp, res.need, true);
    }

    /* ================= banking a run ================= */
    /** Add the XP/stats not yet banked (partial round, personal best, daily bonus). Returns a summary. */
    flushRun() {
      if (this.flushed) return null;
      this.flushed = true;
      const e = this.engine;
      const rows = e.roundScore > 0 || e.roundStats.lines || e.roundStats.big ? BR.Progress.roundRows(e, true) : [];
      const isBest = e.score > this.store.data.best;
      if (isBest) { this.store.data.best = e.score; if (e.score > 0) rows.push({ label: 'New personal best', xp: 200 }); }
      const daily = BR.Progress.dailyRow();
      if (daily) rows.push(daily);
      this.store.data.runs++;
      this.store.save();
      const xp = rows.reduce((a, r) => a + r.xp, 0);
      const res = BR.Progress.addXp(xp);
      BR.Progress.trackRun({ bricks: e.bricksPopped, biggest: e.biggest, rounds: e.roundsCleared });
      return { rows, res, isBest };
    }

    /* ================= game over ================= */
    async endRun(token) {
      const e = this.engine;
      this.over = true;
      this.clearHover(); this.view.hideHint(); this.ui.aimBanner(''); this.armed = null;
      this.ui.overlay('pause', false);
      this.audio.gameOver();
      this.ui.callout('Out of moves', '#ff8b99');
      await sleep(this.view.reduced ? 200 : 650);
      await this.view.crumble();
      if (token !== this.token) return;
      const sum = this.flushRun();
      this.ui.setBest(this.store.data.best);

      $('goScore').textContent = '0';
      $('goRounds').textContent = e.roundsCleared;
      $('goBiggest').textContent = e.biggest;
      $('goCombo').textContent = 'x' + BR.comboMult(e.maxCombo).toString().replace(/(\.\d).*/, '$1');
      $('goPops').textContent = e.bricksPopped;
      $('goBest').classList.toggle('show', !!(sum && sum.isBest && e.score > 0));
      $('goGeode').textContent = ''; $('goGeode').classList.remove('show');
      const trk = ['facet', 'burst', 'arena'].map((t) => BR.Progress.equipped(t)).filter((x) => x.inst && x.inst.tracker)
        .map((x) => `${x.item.name}: ${fmt(x.inst.tracker.value)} ${x.inst.tracker.stat.toLowerCase()}`);
      $('goTracker').textContent = trk.join('  ·  ');
      this.modal = true;
      this.ui.overlay('gameover', true);
      this.ui.renderRows($('goRows'), sum.rows, this.audio);
      this.ui.countTo($('goScore'), e.score, this.view.reduced ? 10 : 1100, 0);
      this.refreshGoGeodes();
      this.animateXp('go', sum.res, sum.rows.length);
      if (sum.isBest && e.score > 0) this.audio.newBest();
    }

    refreshGoGeodes() {
      const n = BR.Progress.geodeCount();
      $('btnGoGeodes').hidden = n === 0;
      $('goGeodeBadge').textContent = n;
    }

    /* ================= Geodes + Vault ================= */
    openVault() {
      this.mode = 'vault';
      this.vault.render();
      this.ui.showScreen('vault');
    }

    async openGeodes() {
      if (this.geodeBusy) return;
      this.geodeBusy = true;
      const wasModal = this.modal;
      this.modal = true;
      try {
        while (BR.Progress.geodeCount() > 0) {
          const kind = BR.Progress.nextGeodeKind();
          const remaining = BR.Progress.geodeCount();
          const out = await this.geode.run({ kind, remaining, getDrop: () => BR.Progress.openGeode() });
          if (!out) break;
          this.settleDrop(out);
          if (remaining <= 1) break;
        }
      } finally {
        this.modal = wasModal;
        this.geodeBusy = false;
        this.ui.refreshMenu();
        this.vault.render();
      }
    }

    settleDrop({ drop, choice }) {
      const P = BR.Progress;
      if (choice === 'dust') P.dust(drop);
      else {
        const inst = drop.inst || P.keep(drop);
        if (choice === 'equip') P.equip(inst.uid);
      }
      BR.Skins.apply();
      this.ui.refreshMenu();
    }

    async fusedReveal(drop) {
      const prevModal = this.modal;
      this.modal = true;
      drop.dup = false;
      const out = await this.geode.run({ kind: 'fusion', remaining: 1, skipCrack: true, getDrop: () => drop });
      this.modal = prevModal;
      if (out) this.settleDrop(out);
    }
  }

  const boot = () => {
    const app = new App();
    window.__brick = app; // handy for debugging / tests
    window.__sf = app;
  };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
