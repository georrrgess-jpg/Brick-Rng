/* Pure board logic: grid state, flood-fill groups, gravity + refill, shuffle. No DOM. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  BR.DIRS = DIRS;

  BR.Board = class Board {
    constructor(rows, cols, colorCount, rng) {
      this.rows = rows;
      this.cols = cols;
      this.colorCount = colorCount;
      this.rng = rng;
      this.nextId = 1;
      this.version = 0;
      this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    }

    inBounds(r, c) { return r >= 0 && r < this.rows && c >= 0 && c < this.cols; }
    get(r, c) { return this.inBounds(r, c) ? this.grid[r][c] : null; }
    newBrick(color) { return { id: this.nextId++, color }; }

    /** Random starting board with mild clustering so the first moves are always readable. */
    randomFill() {
      for (let tries = 0; tries < 50; tries++) {
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            let color = this.rng.int(this.colorCount);
            if (this.rng.chance(0.22)) {
              const up = this.get(r - 1, c);
              const left = this.get(r, c - 1);
              const src = up && left ? (this.rng.chance(0.5) ? up : left) : up || left;
              if (src) color = src.color;
            }
            this.grid[r][c] = this.newBrick(color);
          }
        }
        if (this.hasMove(null)) break;
      }
      this.version++;
    }

    /** Connected group (orthogonal) that the brick at r,c belongs to. `wild` is an optional wildcard color. */
    groupAt(r, c, wild) {
      const start = this.get(r, c);
      if (!start) return [];
      if (wild == null || start.color !== wild) return this._flood(r, c, start.color, wild);
      // Tapped a wild brick: choose whichever base color yields the biggest group.
      let best = [];
      for (let col = 0; col < this.colorCount; col++) {
        const g = this._flood(r, c, col, wild);
        if (g.length > best.length) best = g;
      }
      return best;
    }

    _flood(r, c, base, wild) {
      const seen = new Uint8Array(this.rows * this.cols);
      const out = [];
      const stack = [[r, c]];
      seen[r * this.cols + c] = 1;
      while (stack.length) {
        const [cr, cc] = stack.pop();
        out.push({ r: cr, c: cc });
        for (const [dr, dc] of DIRS) {
          const nr = cr + dr, nc = cc + dc;
          if (!this.inBounds(nr, nc) || seen[nr * this.cols + nc]) continue;
          const b = this.grid[nr][nc];
          if (!b) continue;
          if (b.color === base || (wild != null && b.color === wild)) {
            seen[nr * this.cols + nc] = 1;
            stack.push([nr, nc]);
          }
        }
      }
      out.color = base;
      return out;
    }

    /** True if at least one adjacent pair matches. */
    hasMove(wild) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const a = this.grid[r][c];
          if (!a) continue;
          const right = c + 1 < this.cols ? this.grid[r][c + 1] : null;
          const down = r + 1 < this.rows ? this.grid[r + 1][c] : null;
          for (const b of [right, down]) {
            if (b && (a.color === b.color || (wild != null && (a.color === wild || b.color === wild)))) return true;
          }
        }
      }
      return false;
    }

    /** Largest available group (used for hints). */
    bestGroup(wild) {
      const seen = new Set();
      let best = [];
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (seen.has(r * this.cols + c) || !this.grid[r][c]) continue;
          const g = this.groupAt(r, c, wild);
          if (wild == null) g.forEach((p) => seen.add(p.r * this.cols + p.c));
          if (g.length > best.length) best = g;
        }
      }
      return best;
    }

    /**
     * Compact every column toward `dir` ('down' | 'up') then fill the holes with new bricks.
     * Returns the bookkeeping the renderer needs to animate the change.
     */
    settle(dir) {
      const { rows, cols } = this;
      const moves = [];
      const spawns = [];
      const missingBy = new Array(cols).fill(0);
      for (let c = 0; c < cols; c++) {
        const col = [];
        if (dir === 'down') {
          for (let r = rows - 1; r >= 0; r--) if (this.grid[r][c]) col.push({ b: this.grid[r][c], r });
        } else {
          for (let r = 0; r < rows; r++) if (this.grid[r][c]) col.push({ b: this.grid[r][c], r });
        }
        missingBy[c] = rows - col.length;
        for (let r = 0; r < rows; r++) this.grid[r][c] = null;
        col.forEach((e, i) => {
          const nr = dir === 'down' ? rows - 1 - i : i;
          this.grid[nr][c] = e.b;
          if (nr !== e.r) moves.push({ id: e.b.id, fromR: e.r, toR: nr, c });
        });
      }
      // the holes left after gravity; a painter (the tile director) chooses all their colors at once, otherwise one by one
      const holes = [];
      for (let c = 0; c < cols; c++) {
        const missing = missingBy[c];
        for (let k = 0; k < missing; k++) holes.push({ r: dir === 'down' ? missing - 1 - k : rows - missing + k, c, missing });
      }
      const painted = this.painter && holes.length ? this.painter.paint(this, holes) : null;
      const colorAt = painted ? new Map(painted.map((h) => [h.r * cols + h.c, h.color])) : null;
      for (const h of holes) {
        const b = this.newBrick(colorAt ? colorAt.get(h.r * cols + h.c) : this._pickColor(h.r, h.c));
        this.grid[h.r][h.c] = b;
        spawns.push({ id: b.id, color: b.color, r: h.r, c: h.c, fromR: dir === 'down' ? h.r - h.missing : h.r + h.missing });
      }
      this.version++;
      return { moves, spawns };
    }

    _pickColor(r, c) {
      const near = [];
      for (const [dr, dc] of DIRS) {
        const b = this.get(r + dr, c + dc);
        if (b) near.push(b.color);
      }
      if (near.length && this.rng.chance(0.3)) return this.rng.pick(near);
      return this.rng.int(this.colorCount);
    }

    /** If the board is dead, reshuffle colors (keeping counts). Returns the recolor list. */
    ensureMove(wild) {
      if (this.hasMove(wild)) return [];
      const bricks = [];
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) bricks.push(this.grid[r][c]);
      const before = new Map(bricks.map((b) => [b.id, b.color]));
      for (let t = 0; t < 60 && !this.hasMove(wild); t++) {
        const colors = this.rng.shuffle(bricks.map((b) => b.color));
        bricks.forEach((b, i) => (b.color = colors[i]));
      }
      if (!this.hasMove(wild)) this.grid[0][1].color = this.grid[0][0].color;
      this.version++;
      return bricks.filter((b) => b.color !== before.get(b.id)).map((b) => ({ id: b.id, color: b.color }));
    }
  };
})();
