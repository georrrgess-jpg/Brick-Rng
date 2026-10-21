/* Rules engine (pure logic, deterministic by seed). Three modes share one board:
   rush  - a burning fuse you keep lit by popping; stages speed it up; Rush Mode is the x3 fever
   daily - the same game on a date-seeded board
   chill - the original relaxed 20-move rounds, no clock */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  BR.comboMult = (streak) => Math.min(4, 1 + 0.5 * (Math.max(streak, 1) - 1));

  BR.Engine = class Engine {
    constructor(opts = {}) {
      this.seed = opts.seed != null ? opts.seed : (Date.now() ^ 0x9e3779b9) >>> 0;
      this.mode = opts.mode || 'rush';
      this.boosts = opts.boosts || {};
      this.startHammer = !!opts.startHammer;
      this.reset(opts.snapshot);
    }

    get chill() { return this.mode === 'chill'; }

    reset(snap) {
      const C = BR.CFG;
      this.rng = BR.makeRng(snap ? (this.seed + snap.stage * 7919) >>> 0 : this.seed);
      this.board = new BR.Board(C.rows, C.cols, 5, this.rng);
      this.board.randomFill();
      this.score = 0;
      this.stage = 1;
      this.stageScore = 0;
      this.goal = this.chill ? BR.chillGoal(1) : BR.stageGoal(1);
      this.fuseMax = C.fuse.start + (this.boosts.longFuse ? 10 : 0);
      this.fuse = this.fuseMax;
      this.freeze = 0;
      this.movesLeft = C.chill.moves;
      this.streak = 0;
      this.maxCombo = 0;
      this.time = 0;
      this.rush = { meter: this.boosts.rushStart ? 60 : 0, active: false, left: 0, lastPop: this.boosts.rushStart ? 0 : -99 };
      this.charge = 0;
      this.cursor = 0;
      this.inv = { hammer: this.boosts.headStart || this.startHammer ? 1 : 0, beam: 0, prism: 0 };
      this.stats = { pops: 0, bricks: 0, biggest: 0, bigPops: 0, lineBlasts: 0, powerUsed: 0, rushes: 0, stagesCleared: 0, fuseBursts: 0, defused: 0, colors: [0, 0, 0, 0, 0, 0, 0], stageLines: 0, stageBig: 0 };
      this.over = false;
      this.endReason = null;
      this.sparkUsed = false; this.spark = 0; // Last Spark: one save per run
      if (snap) this._restore(snap);
      this._colorsForStage();
    }

    /* ---------- queries ---------- */
    get mult() { return (this.chill ? 1 : BR.stageMult(this.stage)) * (this.rush.active ? BR.CFG.rush.mult : 1); }
    get burn() { return this.chill ? 0 : BR.burnRate(this.stage); }
    stageCleared() { return this.stageScore >= this.goal; }
    outOfMoves() { return this.chill && this.movesLeft <= 0 && !this.stageCleared(); }
    bestGroup() { return this.board.bestGroup(null); }

    /* ---------- the clock ---------- */
    /** Advance real time by dt seconds. Returns events: rushEnd, fuseOut. */
    tick(dt) {
      if (this.over || this.chill) return [];
      const C = BR.CFG, ev = [];
      this.time += dt;
      const r = this.rush;
      if (r.active) {
        r.left -= dt;
        if (r.left <= 0) { r.active = false; r.left = 0; r.meter = 0; ev.push({ type: 'rushEnd' }); }
      } else if (this.time - r.lastPop > C.rush.drainDelay) {
        r.meter = Math.max(0, r.meter - C.rush.drain * dt);
      }
      if (this.freeze > 0) this.freeze = Math.max(0, this.freeze - dt);
      else if (!r.active && !(this.spark > 0)) {
        this.fuse -= dt * this.burn;
        if (this.fuse <= 0) { this.fuse = 0; this._fuseZero(ev); }
      }
      if (this.spark > 0 && !this.over) {
        this.spark -= dt;
        if (this.spark <= 0) { this.spark = 0; this.over = true; this.endReason = 'fuse'; ev.push({ type: 'fuseOut' }); }
      }
      return ev;
    }

    /** The fuse reached zero: the first time, Last Spark holds the board still for a moment; after that the run ends. */
    _fuseZero(ev) {
      if (!this.sparkUsed) { this.sparkUsed = true; this.spark = BR.CFG.fuse.spark; ev.push({ type: 'spark' }); return; }
      this.over = true; this.endReason = 'fuse'; ev.push({ type: 'fuseOut' });
    }

    /* ---------- planning a tap ---------- */
    plan(r, c) {
      const B = this.board;
      if (this.over || !B.get(r, c) || (this.chill && this.movesLeft <= 0)) return null;
      const primary = B.groupAt(r, c, null);
      if (primary.length < 2) return null;
      const n = primary.length;
      const k = (p) => p.r * B.cols + p.c;
      const taken = new Set(primary.map(k));
      let minR = 99, maxR = -1, minC = 99, maxC = -1;
      for (const p of primary) { minR = Math.min(minR, p.r); maxR = Math.max(maxR, p.r); minC = Math.min(minC, p.c); maxC = Math.max(maxC, p.c); }
      const lineH = minC === 0 && maxC === B.cols - 1;
      const lineV = minR === 0 && maxR === B.rows - 1;
      const lineCells = [];
      const addLine = (p) => { if (!taken.has(k(p)) && B.get(p.r, p.c)) { taken.add(k(p)); lineCells.push(p); } };
      if (lineH) for (let cc = 0; cc < B.cols; cc++) addLine({ r, c: cc });
      if (lineV) for (let rr = 0; rr < B.rows; rr++) addLine({ r: rr, c });
      const line = lineH || lineV;
      const streakAfter = n >= 4 ? this.streak + 1 : 0;
      const combo = n >= 4 ? BR.comboMult(streakAfter) : 1;
      const base = 10 * n * n + (line ? 500 : 0);
      const points = Math.round(base * combo * this.mult);
      return {
        kind: 'pop', r, c, n, primary, extras: [], lineCells, line, lineH, lineV,
        cells: primary.concat(lineCells), streakAfter, combo, points,
        timeGain: this.chill ? 0 : BR.popTime(n, this.stage) + (line ? BR.CFG.fuse.lineBonus : 0),
        color: primary.color, version: B.version,
      };
    }

    /* ---------- committing a tap ---------- */
    commit(plan) {
      if (this.over) return null;
      if (!plan || plan.version !== this.board.version) plan = plan && this.plan(plan.r, plan.c);
      if (!plan) return null;
      const C = BR.CFG, B = this.board, ev = [];
      const comboBefore = this.streak;
      if (this.chill) this.movesLeft--;
      this.streak = plan.streakAfter;
      this.maxCombo = Math.max(this.maxCombo, this.streak);
      this.stats.pops++;
      this.stats.biggest = Math.max(this.stats.biggest, plan.n);
      if (plan.n >= 10) { this.stats.bigPops++; this.stats.stageBig++; }
      if (plan.line) { this.stats.lineBlasts++; this.stats.stageLines++; }
      this._score(plan.points);

      // Fuse bricks: popping one defuses it; every other one ticks down.
      const cells = plan.cells.slice();
      const inCells = new Set(cells.map((p) => p.r * B.cols + p.c));
      let defused = 0;
      const bursts = [], ticks = [];
      for (const p of plan.cells) { const b = B.grid[p.r][p.c]; if (b && b.fb) defused++; }
      if (!this.chill) {
        for (let r = 0; r < B.rows; r++) for (let c = 0; c < B.cols; c++) {
          const b = B.grid[r][c];
          if (!b || !b.fb || inCells.has(r * B.cols + c)) continue;
          b.fb--;
          if (b.fb <= 0) { bursts.push({ r, c, id: b.id, color: b.color }); cells.push({ r, c }); }
          else ticks.push({ id: b.id, fb: b.fb });
        }
        if (defused) { this.fuse = Math.min(this.fuseMax, this.fuse + defused * C.fuse.defuse); this.stats.defused += defused; }
        if (bursts.length) { this.fuse -= bursts.length * C.fuse.burstPenalty; this.stats.fuseBursts += bursts.length; }
        this.fuse = Math.min(this.fuseMax, this.fuse + plan.timeGain);
      }

      const res = this._clear(cells, { r: plan.r, c: plan.c });
      if (!this.chill && res.shuffle && res.shuffle.length) { this.fuse = Math.min(this.fuseMax, this.fuse + C.fuse.shuffleRefund); res.shuffleRefund = C.fuse.shuffleRefund; }
      res.plan = plan; res.kind = 'pop';
      res.comboBefore = comboBefore; res.bursts = bursts; res.ticks = ticks; res.defused = defused;
      res.timeGain = plan.timeGain; res.events = ev;

      // Rush meter
      if (!this.chill) {
        const R = C.rush, r = this.rush;
        if (r.active) r.left = Math.min(R.maxTime, r.left + R.popExtend);
        else if (plan.n >= 4) {
          r.meter = Math.min(100, r.meter + R.gainBase + (plan.n - 4) * R.gainPerExtra + Math.max(0, this.streak - 1) * R.gainStreak);
          if (r.meter >= 100) { r.active = true; r.left = R.time; this.stats.rushes++; res.rushStart = true; }
        }
        r.lastPop = this.time;
      }
      // fresh Fuse bricks from stage 4
      if (!this.chill && this.stage >= C.fuseBrick.fromStage) {
        let have = 0;
        for (let r = 0; r < B.rows; r++) for (let c = 0; c < B.cols; c++) if (B.grid[r][c].fb) have++;
        if (have < C.fuseBrick.max && res.spawns.length && this.rng.chance(C.fuseBrick.chance)) {
          const s = this.rng.pick(res.spawns);
          B.grid[s.r][s.c].fb = C.fuseBrick.count; s.fb = C.fuseBrick.count;
        }
      }
      res.boostersGained = this._addCharge(plan.n >= 4 ? (plan.n - 2) * 4 + this.streak : 0);
      this._afterScore(res);
      if (!this.chill) {
        if (this.spark > 0) {
          if (this.fuse < 0) this.fuse = 0;
          // a pop during Last Spark: 4+ bricks relight the fuse, anything else just buys the time it pays
          if (plan.n >= 4) { this.fuse = Math.max(this.fuse, BR.CFG.fuse.sparkFuse); res.sparkSave = true; this.stats.sparkSaves = (this.stats.sparkSaves || 0) + 1; }
          if (this.fuse > 0) this.spark = 0;
        } else if (this.fuse <= 0) {
          this.fuse = 0;
          const ev2 = []; this._fuseZero(ev2);
          if (this.over) res.fuseOut = true; else res.spark = true;
        }
      }
      return res;
    }

    /* ---------- power-ups ---------- */
    boosterCells(type, r, c) {
      const b = BR.BOOSTERS[type];
      if (!b || !this.board.get(r, c)) return [];
      return b.cells(this.board, r, c);
    }

    /** Use a power-up on r,c. Costs no move; adds a little fuse. */
    applyBooster(type, r, c) {
      if (this.over || !(this.inv[type] > 0)) return null;
      const cells = this.boosterCells(type, r, c);
      if (!cells.length) return null;
      this.inv[type]--;
      this.stats.powerUsed++;
      const points = Math.round(cells.length * BR.BOOSTERS[type].perBrick * this.mult);
      this._score(points);
      if (!this.chill) this.fuse = Math.min(this.fuseMax, this.fuse + BR.CFG.fuse.powerBonus);
      const res = this._clear(cells, { r, c });
      res.kind = 'booster'; res.type = type; res.boostersGained = []; res.bursts = []; res.ticks = []; res.timeGain = this.chill ? 0 : BR.CFG.fuse.powerBonus;
      res.plan = { kind: 'booster', n: cells.length, points, r, c, primary: cells, combo: 1, line: false };
      this._afterScore(res);
      // a power-up during the Last Spark gives time (and a stage-up refills the fuse), so the window is over: the run goes on
      if (!this.chill && this.spark > 0 && this.fuse > 0) { this.spark = 0; res.sparkEnd = true; }
      return res;
    }

    /* ---------- Chill mode round flow ---------- */
    shatter() {
      const left = Math.max(0, this.movesLeft);
      const bonus = left * BR.CFG.chill.shatterPerMove;
      const all = [];
      for (let r = 0; r < this.board.rows; r++) for (let c = 0; c < this.board.cols; c++) all.push({ r, c });
      this.rng.shuffle(all);
      const cells = left > 0 ? all.slice(0, Math.min(36, left * 3)) : [];
      this.score += bonus;
      const res = this._clear(cells, { r: 3, c: 3 });
      res.kind = 'shatter'; res.bonus = bonus; res.movesLeft = left;
      res.plan = { kind: 'shatter', n: cells.length, points: bonus, r: 3, c: 3, primary: cells, combo: 1, line: false };
      return res;
    }

    nextRound() {
      this.stats.stagesCleared++;
      this.stage++;
      this.movesLeft = BR.CFG.chill.moves;
      this.goal = BR.chillGoal(this.stage);
      this.stageScore = 0;
      this.streak = 0;
      this.stats.stageLines = 0; this.stats.stageBig = 0;
      this._colorsForStage();
    }

    /* ---------- save / resume ---------- */
    snapshot() {
      return {
        v: 1, mode: this.mode, seed: this.seed, boosts: this.boosts, stage: this.stage, score: this.score,
        inv: Object.assign({}, this.inv), charge: this.charge, stats: JSON.parse(JSON.stringify(this.stats)),
        maxCombo: this.maxCombo, sparkUsed: this.sparkUsed, fuse: this.fuse, rushMeter: this.rush.active ? 0 : this.rush.meter, colors: this.board.grid.map((row) => row.map((b) => b.color)),
      };
    }
    _restore(s) {
      this.stage = s.stage; this.score = s.score; this.inv = Object.assign({}, s.inv); this.charge = s.charge || 0;
      this.stats = Object.assign(this.stats, s.stats); this.maxCombo = s.maxCombo || 0; this.sparkUsed = !!s.sparkUsed;
      // resuming must not refill the fuse (Save and leave would be a free refill), but a few seconds of grace keep it from ending at once
      if (!this.chill && s.fuse != null) this.fuse = Math.min(this.fuseMax, Math.max(+s.fuse || 0, BR.CFG.fuse.resumeGrace));
      if (s.rushMeter != null) this.rush.meter = s.rushMeter;
      this.goal = this.chill ? BR.chillGoal(this.stage) : BR.stageGoal(this.stage);
      for (let r = 0; r < this.board.rows; r++) for (let c = 0; c < this.board.cols; c++) this.board.grid[r][c].color = s.colors[r][c];
      this.board.version++;
      this.board.ensureMove(null);
    }

    /** Everything the results screen and the mission/XP/coin code need. */
    summary() {
      const s = this.stats;
      return {
        mode: this.mode, score: this.score, stage: this.stage, stagesCleared: s.stagesCleared, time: this.time,
        pops: s.pops, bricks: s.bricks, biggest: s.biggest, bigPops: s.bigPops, lineBlasts: s.lineBlasts,
        powerUsed: s.powerUsed, rushes: s.rushes, colors: s.colors.slice(), maxCombo: this.maxCombo,
        stageScore: this.stageScore, stageLines: s.stageLines, stageBig: s.stageBig, defused: s.defused, sparkSaves: s.sparkSaves || 0,
      };
    }

    /* ---------- internals ---------- */
    _score(points) {
      this.score += points;
      this.stageScore += points;
    }

    /** Stage-up (rush/daily): refill the fuse, freeze it briefly, speed it up. Chill leaves it to the controller. */
    _afterScore(res) {
      if (this.chill) { if (this.stageCleared()) res.roundClear = true; return; }
      if (this.stageCleared()) {
        const from = this.stage;
        this.stageScore -= this.goal;
        this.stage++;
        this.stats.stagesCleared++;
        this.goal = BR.stageGoal(this.stage);
        this.fuse = this.fuseMax;
        this.freeze = BR.CFG.fuse.stageFreeze;
        this.stats.stageLines = 0; this.stats.stageBig = 0;
        this._colorsForStage();
        res.stageUp = { from, to: this.stage, mult: BR.stageMult(this.stage) };
      }
    }

    _colorsForStage() {
      const C = BR.CFG, n = this.chill ? [C.chill.sixthColor, C.chill.seventhColor] : [C.stage.sixthColor, C.stage.seventhColor];
      this.board.colorCount = this.stage >= n[1] ? 7 : this.stage >= n[0] ? 6 : 5;
    }

    _clear(cells, tap) {
      const B = this.board;
      const removed = [];
      for (const p of cells) {
        const b = B.grid[p.r][p.c];
        if (!b) continue;
        removed.push({ id: b.id, r: p.r, c: p.c, color: b.color, fb: b.fb || 0 });
        this.stats.colors[b.color]++;
        B.grid[p.r][p.c] = null;
      }
      this.stats.bricks += removed.length;
      B.version++;
      const { moves, spawns } = B.settle('down');
      const shuffle = B.ensureMove(null);
      return { tap, removed, moves, spawns, recolors: [], shuffle, dir: 'down', movesLeft: this.movesLeft };
    }

    _addCharge(gain) {
      const gained = [];
      if (gain <= 0) return gained;
      const P = BR.CFG.power;
      this.charge += gain;
      const order = BR.BOOSTER_ORDER;
      while (this.charge >= P.charge) {
        let best = null;
        for (let i = 0; i < order.length; i++) {
          const t = order[(this.cursor + i) % order.length];
          if (this.inv[t] >= P.cap) continue;
          if (best === null || this.inv[t] < this.inv[best]) best = t;
        }
        if (best === null) { this.charge = P.charge - 1; break; }
        this.inv[best]++;
        this.cursor = (order.indexOf(best) + 1) % order.length;
        gained.push(best);
        this.charge -= P.charge;
      }
      return gained;
    }
  };
})();
