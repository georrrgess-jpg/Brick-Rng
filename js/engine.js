/* Rules engine (pure logic, deterministic by seed): Rounds, scoring, Boosters, shatter bonus. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  BR.comboMult = (streak) => Math.min(4, 1 + 0.5 * (Math.max(streak, 1) - 1));

  BR.Engine = class Engine {
    constructor(opts = {}) {
      this.seed = opts.seed != null ? opts.seed : (Date.now() ^ 0x9e3779b9) >>> 0;
      this.reset();
    }

    reset() {
      const { CFG } = BR;
      this.rng = BR.makeRng(this.seed);
      this.board = new BR.Board(CFG.rows, CFG.cols, 5, this.rng);
      this.board.randomFill();
      this.score = 0;
      this.round = 1;
      this.movesLeft = CFG.movesPerRound;
      this.goal = BR.goalFor(1);
      this.roundScore = 0;
      this.streak = 0;
      this.maxCombo = 0;
      this.pops = 0;
      this.bricksPopped = 0;
      this.biggest = 0;
      this.roundsCleared = 0;
      this.charge = 0;
      this.boosterCursor = 0;
      this.inv = { hammer: 1, beam: 0, prism: 0 };
      this.roundStats = { lines: 0, big: 0 };
      this.over = false;
    }

    roundCleared() { return this.roundScore >= this.goal; }
    outOfMoves() { return this.movesLeft <= 0 && !this.roundCleared(); }
    bestGroup() { return this.board.bestGroup(null); }

    /** What tapping r,c would do (null if it is not a legal tap). Never changes state. */
    plan(r, c) {
      const B = this.board;
      if (!B.get(r, c) || this.movesLeft <= 0) return null;
      const primary = B.groupAt(r, c, null);
      if (primary.length < 2) return null;
      const n = primary.length;
      const k = (p) => p.r * B.cols + p.c;
      const taken = new Set(primary.map(k));

      // Edge-to-edge span = Line Blast: also clears the tapped row / column.
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
      const points = Math.round(base * combo);
      return {
        kind: 'pop', r, c, n, primary, extras: [], lineCells, line, lineH, lineV,
        cells: primary.concat(lineCells), streakAfter, combo, points,
        color: primary.color, version: B.version,
      };
    }

    /** Spend one move on a planned tap. Returns everything the renderer needs. */
    commit(plan) {
      if (this.over || this.movesLeft <= 0) return null;
      if (!plan || plan.version !== this.board.version) plan = plan && this.plan(plan.r, plan.c);
      if (!plan) return null;
      this.movesLeft--;
      this.streak = plan.streakAfter;
      this.maxCombo = Math.max(this.maxCombo, this.streak);
      this.score += plan.points;
      this.roundScore += plan.points;
      this.pops++;
      this.biggest = Math.max(this.biggest, plan.n);
      if (plan.line) this.roundStats.lines++;
      if (plan.n >= 10) this.roundStats.big++;

      const res = this._clear(plan.cells, { r: plan.r, c: plan.c });
      const gain = plan.n >= 4 ? (plan.n - 2) * 4 + this.streak : 0;
      res.plan = plan;
      res.kind = 'pop';
      res.boostersGained = this._addCharge(gain);
      return res;
    }

    boosterCells(type, r, c) {
      const b = BR.BOOSTERS[type];
      if (!b || !this.board.get(r, c)) return [];
      return b.cells(this.board, r, c);
    }

    /** Use a Booster on r,c. Costs no move. */
    applyBooster(type, r, c) {
      if (this.over || !(this.inv[type] > 0)) return null;
      const cells = this.boosterCells(type, r, c);
      if (!cells.length) return null;
      this.inv[type]--;
      const points = cells.length * BR.BOOSTERS[type].perBrick;
      this.score += points;
      this.roundScore += points;
      const res = this._clear(cells, { r, c });
      res.kind = 'booster';
      res.type = type;
      res.plan = { kind: 'booster', n: cells.length, points, r, c, primary: cells, combo: 1, line: false };
      res.boostersGained = [];
      return res;
    }

    /** Round-clear payoff: leftover moves shatter a patch of bricks for bonus points. */
    shatter() {
      const left = Math.max(0, this.movesLeft);
      const bonus = left * BR.CFG.shatterPerMove;
      const all = [];
      for (let r = 0; r < this.board.rows; r++) for (let c = 0; c < this.board.cols; c++) all.push({ r, c });
      this.rng.shuffle(all);
      const cells = left > 0 ? all.slice(0, Math.min(36, left * 3)) : [];
      this.score += bonus;
      const res = this._clear(cells, { r: 3, c: 3 });
      res.kind = 'shatter';
      res.bonus = bonus;
      res.movesLeft = left;
      res.plan = { kind: 'shatter', n: cells.length, points: bonus, r: 3, c: 3, primary: cells, combo: 1, line: false };
      return res;
    }

    nextRound() {
      this.roundsCleared++;
      this.round++;
      this.movesLeft = BR.CFG.movesPerRound;
      this.goal = BR.goalFor(this.round);
      this.roundScore = 0;
      this.streak = 0;
      this.roundStats = { lines: 0, big: 0 };
      if (this.round >= BR.CFG.seventhColorRound) this.board.colorCount = 7;
      else if (this.round >= BR.CFG.sixthColorRound) this.board.colorCount = 6;
    }

    /* ---- internals ---- */
    _clear(cells, tap) {
      const B = this.board;
      const removed = [];
      for (const p of cells) {
        const b = B.grid[p.r][p.c];
        if (!b) continue;
        removed.push({ id: b.id, r: p.r, c: p.c, color: b.color });
        B.grid[p.r][p.c] = null;
      }
      this.bricksPopped += removed.length;
      B.version++;
      const { moves, spawns } = B.settle('down');
      const shuffle = B.ensureMove(null);
      return { tap, removed, moves, spawns, recolors: [], shuffle, dir: 'down', movesLeft: this.movesLeft };
    }

    _addCharge(gain) {
      const gained = [];
      if (gain <= 0) return gained;
      this.charge += gain;
      const order = BR.BOOSTER_ORDER;
      while (this.charge >= BR.CFG.chargeNeeded) {
        let best = null;
        for (let i = 0; i < order.length; i++) {
          const t = order[(this.boosterCursor + i) % order.length];
          if (this.inv[t] >= BR.CFG.boosterCap) continue;
          if (best === null || this.inv[t] < this.inv[best]) best = t;
        }
        if (best === null) { this.charge = BR.CFG.chargeNeeded - 1; break; }
        this.inv[best]++;
        this.boosterCursor = (order.indexOf(best) + 1) % order.length;
        gained.push(best);
        this.charge -= BR.CFG.chargeNeeded;
      }
      return gained;
    }
  };
})();
