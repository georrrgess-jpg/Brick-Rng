/* The tile director: decides the colors of every new brick so the board keeps offering something worth tapping.
   Pure logic, deterministic by seed (it draws from the engine's own generator), no DOM.

   How it works, in three parts:
   1. How much help right now (`assist`, 0..1). It starts from the player's skill rating (a slow average of how far their
      Rush runs go, kept on the device) and moves with the run: up when the fuse is low, the Last Spark is burning, the player
      has gone a while without a pop of 4+, or is taking long to find a move; down when they are cruising (big pops, a full
      fuse). Higher stages add a little, because the sixth and seventh colors break the board up. Daily ignores the player
      and the clock (help depends only on the stage and the board), so everyone gets the same refills for the same taps.
   2. Painting the new bricks. Holes are filled from the bricks that touch the old board outward. Each color is weighted by
      the neighbours it would join, more for neighbours that belong to a big group, so new bricks line up with the big blocks
      already on the board. A group that is already very large stops attracting more of its color, so the board never floods.
   3. Choosing between a few paintings. With more help the director paints more candidates and keeps the one whose biggest
      group lands nearest a target size, with a bonus for several good options and a penalty for a dead board or a board of
      pairs. The target rises with help; every few pops without an 8+ it sets up a big one (a "jackpot", sometimes a near
      Line Blast), so a big moment always comes round. Nothing the player has already seen ever changes colour. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  const D = {
    assistMin: 0, assistMax: 0.9,
    base: (skill) => 0.3 - 0.25 * skill,        // a new player (skill 0.25) starts near 0.24, a strong one (0.9) near 0.08
    stageStep: 0.02, stageCap: 0.12,              // more colors, a little more help
    lowFuse: 0.32, lowFuseHelp: 0.2,              // below a third of the fuse, help rises up to +0.2 at empty
    sparkHelp: 0,                                 // the Last Spark gets no extra help: the save is earned (it needs a pop of 5+)
    dryHelp: 0.06, dryCap: 0.24,                   // each pop in a row under 4 bricks
    slowThink: 2.2, slowHelp: 0.15,               // a long search for a move
    cruise: 0.15,                                 // big pops and a comfortable fuse: back off
    gentleHelp: 0.2,                              // the very first run
    // the flow channel: help runs up to about where this player usually gets to, then tapers off, so a run still ends and a new
    // best is an achievement rather than a gift. Always through stage 4, so a beginner is helped where they need it most; never
    // later than stage 7: from stage 8 the burn stops speeding up, so without the taper a run could go on for ever
    comfort: (skill) => Math.max(4, Math.min(7, 1 + 9 * skill)),
    taper: 0.12,
    // the jackpot: after this many pops without an 8+, the next refill sets one up (18 at no help, 8 at full help). Big pops are
    // where the points are (10 x n x n), so this is the strongest dial on how far a run goes
    jackEvery: 18, jackEveryHelp: 10,
  };
  BR.DIRECTOR = D;

  /** Sizes of every group on a color grid (array of rows of numbers, -1 = empty), labelled in one pass. */
  function label(grid, rows, cols) {
    const id = new Int16Array(rows * cols).fill(-1), sizes = [];
    const stack = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = r * cols + c, col = grid[r][c];
      if (id[k] !== -1 || col < 0) continue;
      const g = sizes.length; let n = 0; let minC = c, maxC = c, minR = r, maxR = r;
      id[k] = g; stack.push(k);
      while (stack.length) {
        const q = stack.pop(), qr = (q / cols) | 0, qc = q % cols; n++;
        if (qc < minC) minC = qc; if (qc > maxC) maxC = qc; if (qr < minR) minR = qr; if (qr > maxR) maxR = qr;
        for (const [dr, dc] of DIRS) {
          const nr = qr + dr, nc = qc + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          const nk = nr * cols + nc;
          if (id[nk] !== -1 || grid[nr][nc] !== col) continue;
          id[nk] = g; stack.push(nk);
        }
      }
      sizes.push({ n, line: (minC === 0 && maxC === cols - 1) || (minR === 0 && maxR === rows - 1), span: Math.max(maxC - minC, maxR - minR) + 1 });
    }
    return { id, sizes };
  }

  /** What a board offers: biggest group, groups of 4+ and 3+, any move at all, a Line Blast, the widest near-line. */
  function measure(grid, rows, cols) {
    const { sizes } = label(grid, rows, cols);
    let best = 0, n4 = 0, n3 = 0, moves = 0, line = false, span = 0;
    for (const s of sizes) {
      if (s.n > best) best = s.n;
      if (s.n >= 4) n4++; if (s.n >= 3) n3++; if (s.n >= 2) { moves++; if (s.line) line = true; if (s.span > span) span = s.span; }
    }
    return { best, n4, n3, moves, line, span };
  }

  BR.Director = class Director {
    /** engine: the run it serves. o.skill: the player's rating (0..1), o.fair: Daily (same refills for everyone). */
    constructor(engine, o = {}) {
      this.e = engine;
      this.fair = !!o.fair;
      this.skill = this.fair ? 0.5 : clamp(o.skill == null ? 0.4 : +o.skill || 0, 0, 1);
      this.gentle = !!o.gentle;
      this.ema = 4;          // recent pop sizes
      this.dry = 0;          // pops in a row under 4 bricks
      this.sinceBig = 0;     // pops since the last 8+
      this.lastPop = 0;      // engine time of the last pop
      this.think = 1;        // recent seconds between pops
      this.want = null;      // what the player is chasing right now ({ big: 12 }: a pop of 12+), set by the run from its goal and missions
    }

    /** How much help the board gives right now, 0..1. */
    assist() {
      const e = this.e;
      let a = D.base(this.skill) + Math.min(D.stageCap, D.stageStep * (e.stage - 1));
      const over = Math.max(0, e.stage - D.comfort(this.skill)), ease = Math.max(0, 1 - 0.3 * over);
      if (this.gentle && e.stage < 2) a += D.gentleHelp;
      a += Math.min(D.dryCap, D.dryHelp * this.dry);
      if (!this.fair) {
        if (e.chill) {
          // Chill: behind the pace a 20-move round needs, help more
          const need = Math.max(0, 1 - e.stageScore / e.goal), left = Math.max(1, e.movesLeft) / BR.CFG.chill.moves;
          a += clamp((need - left) * 0.6, 0, 0.3);
        } else {
          const f = e.fuse / e.fuseMax;
          if (f < D.lowFuse) a += D.lowFuseHelp * (1 - f / D.lowFuse) * ease;
          if (e.spark > 0) a += D.sparkHelp * ease;
          if (this.think > D.slowThink) a += Math.min(D.slowHelp, (this.think - D.slowThink) * 0.08);
          if (this.ema >= 6.5 && f > 0.6 && !e.rush.active) a -= D.cruise;
        }
      }
      a -= D.taper * over;
      return clamp(a, D.assistMin, D.assistMax);
    }

    /** The biggest group the next refill aims for, and whether it is a jackpot (a big pop set up on purpose). */
    target(a) {
      const every = Math.round(D.jackEvery - D.jackEveryHelp * a);
      const wantBig = this.want && this.want.big ? this.want.big : 0;
      // chasing a big pop (a goal or mission that asks for 10+ or 12+): jackpots come twice as often and aim at that size
      if (wantBig && this.sinceBig >= Math.max(5, Math.round(every / 2))) return { size: wantBig + 1, jackpot: true };
      if (this.sinceBig >= every) return { size: 8 + Math.round(3 * a), jackpot: true };
      return { size: 4 + Math.round(4 * a), jackpot: false };
    }

    /** Called by the engine when a pop is committed, before the board refills. */
    onPop(plan) {
      const e = this.e, n = plan.n;
      this.ema = this.ema * 0.7 + n * 0.3;
      this.dry = n >= 4 ? 0 : this.dry + 1;
      this.sinceBig = n >= 8 ? 0 : this.sinceBig + 1;
      if (!this.fair && !e.chill) { const dt = e.time - this.lastPop; if (dt > 0 && dt < 30) this.think = this.think * 0.6 + dt * 0.4; this.lastPop = e.time; }
    }

    /** Colors for the holes left after gravity. `holes` = [{r, c}] (all empty cells), `board` = the Board. Returns colors in hole order. */
    paint(board, holes) {
      const rows = board.rows, cols = board.cols, rng = board.rng, nColors = board.colorCount;
      const a = this.assist(), tgt = this.target(a);
      const grid = board.grid.map((row) => row.map((b) => (b ? b.color : -1)));
      // group sizes of the old board, so a new brick can see how big a block it would join
      const { id, sizes } = label(grid, rows, cols);
      const oldSize = (r, c) => (grid[r][c] >= 0 && id[r * cols + c] >= 0 ? sizes[id[r * cols + c]].n : 0);
      // fill order: holes touching the old board first (the bottom of each column's gap), then outward
      const order = holes.slice().sort((p, q) => q.r - p.r || p.c - q.c);
      const pull = 0.35 + 3 * a + (tgt.jackpot ? 2 : 0);  // how strongly a new brick joins its neighbours
      const cap = 9 + Math.round(5 * a) + (tgt.jackpot ? 4 : 0);   // a block this big stops attracting its colour
      const tries = tgt.jackpot ? 6 : 2 + Math.round(3 * a);
      let best = null, bestScore = -Infinity, floorMet = false;
      // paint `tries` candidates, and keep going until one meets the floor (harder the longer a dry spell has run)
      const limit = 10 + 4 * Math.min(this.dry, 4);
      // a colour that joins the board (stage 3 or 5) arrives with the refill that pop deals: three of it (the fullest column first), so the
      // player sees it when the stage band passes and can pop it at once (left to chance it came in on about one refill in three).
      // They are part of every candidate, so the rest of the refill is painted around them.
      const joined = this.colors && nColors > this.colors; this.colors = nColors;
      const seeds = new Set();
      if (joined) {
        const byCol = new Map();
        for (const h of order) { if (!byCol.has(h.c)) byCol.set(h.c, []); byCol.get(h.c).push(h); }
        [].concat(...Array.from(byCol.values()).sort((p, q) => q.length - p.length)).slice(0, 3).forEach((h) => seeds.add(h.r * cols + h.c));
      }
      for (let t = 0; t < tries || (!floorMet && t < limit); t++) {
        const g = grid.map((row) => row.slice());
        const fresh = new Uint8Array(rows * cols);
        for (const h of order) {
          const w = new Array(nColors).fill(1);
          for (const [dr, dc] of DIRS) {
            const nr = h.r + dr, nc = h.c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
            const col = g[nr][nc]; if (col < 0) continue;
            const size = fresh[nr * cols + nc] ? 1 : oldSize(nr, nc);
            w[col] += size >= cap ? 0.15 : pull * (1 + Math.min(size, 8) / 4);
          }
          let total = 0; for (let k = 0; k < nColors; k++) total += w[k];
          let roll = rng.next() * total, pick = nColors - 1;
          for (let k = 0; k < nColors; k++) { roll -= w[k]; if (roll < 0) { pick = k; break; } }
          if (seeds.has(h.r * cols + h.c)) pick = nColors - 1;
          g[h.r][h.c] = pick; fresh[h.r * cols + h.c] = 1;
        }
        const m = measure(g, rows, cols);
        // the floor holds at every level of help: always a move, never a board of pairs, almost always a 4+ on offer
        let s = -Math.abs(m.best - tgt.size) + 0.25 * Math.min(m.n3, 5) + a * 0.6 * Math.min(m.n4, 3);
        if (!m.moves) s -= 100;                          // a dead board means a reshuffle: avoid it
        if (m.best < 3) s -= 8;                          // nothing but pairs feels like a wall
        // after a small pop the next board offers a 4+ (and the longer the wait, the surer); right after a 4+ it is left to
        // chance, so chaining big pops into combos and Rush stays a skill and not a given
        if (m.n4 === 0 && (this.dry > 0 || a > 0.45)) s -= 2 + 1.5 * Math.min(this.dry, 3);
        if (tgt.jackpot && m.line) s += 2.5;             // a Line Blast is the best jackpot of all
        // the ceiling is what makes difficulty: with little help, big groups are rare, because big pops pay a lot of fuse
        if (!tgt.jackpot && m.best > tgt.size + 2) s -= (m.best - tgt.size - 2) * (1.6 - a);
        const floor = m.moves > 0 && m.best >= 3 && (m.n4 > 0 || this.dry === 0);
        if (floor && !floorMet) { floorMet = true; bestScore = -Infinity; }   // a candidate that meets the floor beats any that does not
        if ((floor || !floorMet) && s > bestScore) { bestScore = s; best = g; }
      }
      this.lastAssist = a; this.lastTarget = tgt;
      return order.map((h) => ({ r: h.r, c: h.c, color: best[h.r][h.c] }));
    }

    /** A first board that reads at once: a few clear groups, one of 4 to 8, never a flood. Tries a few fills. */
    shapeStart(board) {
      let keep = null, keepScore = -Infinity;
      for (let t = 0; t < 12; t++) {
        board.randomFill();
        const g = board.grid.map((row) => row.map((b) => b.color));
        const m = measure(g, board.rows, board.cols);
        const s = -Math.abs(m.best - 6) * 1.2 + Math.min(m.n4, 3) + 0.4 * Math.min(m.n3, 6) - (m.best > 9 ? 10 : 0) - (m.best < 4 ? 10 : 0);
        if (s > keepScore) { keepScore = s; keep = g; }
        if (m.best >= 5 && m.best <= 8 && m.n4 >= 2 && m.n3 >= 4) break;
      }
      for (let r = 0; r < board.rows; r++) for (let c = 0; c < board.cols; c++) board.grid[r][c].color = keep[r][c];
      board.version++;
    }

    snapshot() { return { ema: this.ema, dry: this.dry, sinceBig: this.sinceBig, think: this.think }; }
    restore(s) { if (!s) return; ['ema', 'dry', 'sinceBig', 'think'].forEach((k) => { if (Number.isFinite(s[k])) this[k] = s[k]; }); this.lastPop = this.e.time; }

    /** The skill rating after a finished run: a slow average of how far Rush runs go (stage 1 is 0, stage 10 and up is 1).
        Daily (a shared board) and Chill (no clock) leave it alone. */
    static rate(prev, sum) {
      const p = clamp(prev == null ? 0.4 : +prev || 0, 0, 1);
      if (!sum || sum.mode !== 'rush') return p;
      const r = clamp((sum.stage - 1) / 9, 0, 1);
      return Math.round(clamp(p * 0.8 + r * 0.2, 0, 1) * 1000) / 1000;
    }
  };
  BR.Director.measure = measure;
})();
