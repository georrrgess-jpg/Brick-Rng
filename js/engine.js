/* Game rules engine: pure state + deterministic-by-seed. The UI only replays the results it returns. */
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
      this.fuel = CFG.startFuel;
      this.streak = 0;
      this.maxCombo = 0;
      this.pops = 0;
      this.bricksPopped = 0;
      this.biggest = 0;
      this.charge = 0;
      this.need = CFG.firstCrate;
      this.cratesOpened = 0;
      this.coresPulled = 0;
      this.core = null;
      this.coreState = {};
      this.over = false;
    }

    wild() { return this.core && this.core.wild ? this.core.wild(this) : null; }
    gravityDir() { return this.core && this.core.gravity ? this.core.gravity(this) : 'down'; }
    bestGroup() { return this.board.bestGroup(this.wild()); }

    /** Describe what tapping r,c would do, without changing anything. Returns null if not a legal tap. */
    plan(r, c) {
      const B = this.board;
      if (!B.get(r, c)) return null;
      const primary = B.groupAt(r, c, this.wild());
      if (primary.length < 2) return null;
      const n = primary.length;
      const k = (p) => p.r * B.cols + p.c;
      const core = this.core;
      const ctx = { engine: this, board: B, rng: this.rng, r, c, primary, n };

      const taken = new Set(primary.map(k));
      const extras = [];
      for (const p of (core && core.extras ? core.extras(ctx) : []) || []) {
        if (!B.get(p.r, p.c) || taken.has(k(p))) continue;
        taken.add(k(p));
        extras.push({ r: p.r, c: p.c });
      }

      // Edge-to-edge span = Line Blast: also clears the tapped row / column.
      let minR = 99, maxR = -1, minC = 99, maxC = -1;
      for (const p of primary) { minR = Math.min(minR, p.r); maxR = Math.max(maxR, p.r); minC = Math.min(minC, p.c); maxC = Math.max(maxC, p.c); }
      const lineH = minC === 0 && maxC === B.cols - 1;
      const lineV = minR === 0 && maxR === B.rows - 1;
      const lineCells = [];
      const addLine = (p) => { if (!taken.has(k(p))) { taken.add(k(p)); lineCells.push(p); } };
      if (lineH) for (let cc = 0; cc < B.cols; cc++) addLine({ r, c: cc });
      if (lineV) for (let rr = 0; rr < B.rows; rr++) addLine({ r: rr, c });
      const line = lineH || lineV;

      const x = extras.length;
      let cost = 1;
      if (core && core.fuelCost) cost = core.fuelCost(ctx, cost);
      let refund = n >= 8 ? 2 : n >= 5 ? 1 : 0;
      if (core && core.fuelRefund) refund = core.fuelRefund(ctx, refund);
      if (line) refund += 3;

      const streakAfter = n >= 4 ? this.streak + 1 : 0;
      const combo = n >= 4 ? BR.comboMult(streakAfter) : 1;
      const coreMult = core && core.scoreMult ? core.scoreMult(ctx) : 1;
      const base = 10 * n * n + 20 * x + (line ? 500 : 0);
      const points = Math.round(base * combo * coreMult);

      return {
        r, c, n, x, primary, extras, lineCells, line, lineH, lineV,
        cells: primary.concat(extras, lineCells),
        cost, refund, net: refund - cost,
        streakAfter, combo, coreMult, points,
        color: primary.color,
        version: B.version,
      };
    }

    /** Apply a plan. Returns everything the renderer needs to replay the turn. */
    commit(plan) {
      if (this.over) return null;
      if (!plan || plan.version !== this.board.version) plan = plan && this.plan(plan.r, plan.c);
      if (!plan) return null;
      const B = this.board;
      const core = this.core;
      const fuelBefore = this.fuel;
      const comboBefore = this.streak;

      this.fuel = Math.max(0, Math.min(BR.CFG.maxFuel, this.fuel - plan.cost + plan.refund));
      this.streak = plan.streakAfter;
      this.maxCombo = Math.max(this.maxCombo, this.streak);
      this.score += plan.points;
      this.charge += plan.points;
      this.pops++;
      this.biggest = Math.max(this.biggest, plan.n);

      const removed = [];
      for (const p of plan.cells) {
        const b = B.grid[p.r][p.c];
        if (!b) continue;
        removed.push({ id: b.id, r: p.r, c: p.c, color: b.color });
        B.grid[p.r][p.c] = null;
      }
      this.bricksPopped += removed.length;
      B.version++;

      if (core && core.onCommit) core.onCommit({ engine: this, plan, n: plan.n });
      const dir = this.gravityDir();
      const { moves, spawns } = B.settle(dir);
      const recolors = core && core.afterRefill ? core.afterRefill({ engine: this, board: B, rng: this.rng, plan }) || [] : [];
      const shuffle = B.ensureMove(this.wild());

      return { plan, tap: { r: plan.r, c: plan.c }, removed, moves, spawns, recolors, shuffle, dir, fuelBefore, fuelAfter: this.fuel, comboBefore };
    }

    crateReady() { return this.charge >= this.need; }
    /** Consume one crate worth of charge; returns false if none is ready. */
    takeCrate() {
      if (!this.crateReady()) return false;
      this.charge -= this.need;
      this.need = Math.round(this.need * BR.CFG.crateGrowth);
      this.cratesOpened++;
      if (this.cratesOpened >= BR.CFG.seventhColorAfter) this.board.colorCount = 7;
      else if (this.cratesOpened >= BR.CFG.sixthColorAfter) this.board.colorCount = 6;
      return true;
    }

    /** Roll the next crate result (decided up front; the reel animation only reveals it). */
    rollCrate() {
      const rarity = this.rng.weighted(BR.RARITIES, (r) => r.weight);
      const pool = BR.CORES.filter((c) => c.rarity === rarity.id);
      return this.rng.pick(pool);
    }

    equip(core) {
      this.core = core;
      this.coreState = {};
      this.coresPulled++;
      if (core.onEquip) core.onEquip(this);
    }

    scrap(core) {
      const gain = BR.rarityById[core.rarity].scrap;
      this.coresPulled++;
      this.fuel = Math.min(BR.CFG.maxFuel, this.fuel + gain);
      return gain;
    }
  };
})();
