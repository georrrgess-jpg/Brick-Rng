/* Board renderer: owns the brick DOM and every board animation (WAAPI, transform-only). */
(function () {
  const BR = (window.BR = window.BR || {});
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  BR.sleep = sleep;

  // Exact t^2 easing: constant gravity, so bricks in a column never overlap while falling together.
  const QUAD = 'cubic-bezier(0.3333, 0, 0.6667, 0.3333)';

  /** Inject the brick color CSS from the single palette definition. */
  BR.applyPalette = function () {
    const css = BR.PALETTE.map((p, i) => `[data-c="${i}"]{--hi:${p.hi};--lo:${p.lo};--glow:${p.glow}}`).join('');
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
  };

  class BoardView {
    constructor({ boardEl, field, wrap, layer, fx, audio }) {
      this.boardEl = boardEl;
      this.field = field;
      this.wrap = wrap;
      this.layer = layer;
      this.fx = fx;
      this.audio = audio;
      this.rows = BR.CFG.rows;
      this.cols = BR.CFG.cols;
      this.cell = 40;
      this.bricks = new Map();
      this.gen = 0;
      this.reduced = false;
      this.tune = { fall: 1, pop: 1 };

      this.chip = document.createElement('div');
      this.chip.className = 'chip';
      this.layer.appendChild(this.chip);
      this.hintEl = document.createElement('div');
      this.hintEl.className = 'tap-hint';
      this.hintEl.innerHTML = '<i></i><i></i><b></b>';
      this.field.appendChild(this.hintEl);

      this.layout();
      if (window.ResizeObserver) new ResizeObserver(() => this.layout()).observe(this.field);
      window.addEventListener('resize', () => this.layout());
    }

    /* ---------- geometry ---------- */
    layout() {
      const w = this.field.clientWidth;
      if (!w) return;
      this.cell = w / this.cols;
      this.field.style.setProperty('--cell', this.cell + 'px');
      this.bricks.forEach((rec) => this._place(rec));
      this.hintEl.style.fontSize = this.cell + 'px';
    }
    _place(rec) { rec.el.style.transform = `translate3d(${rec.c * this.cell}px,${rec.r * this.cell}px,0)`; }

    cellAt(clientX, clientY) {
      const rect = this.field.getBoundingClientRect();
      const x = clientX - rect.left, y = clientY - rect.top;
      const c = Math.floor(x / this.cell), r = Math.floor(y / this.cell);
      if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return null;
      return { r, c };
    }
    /** Center of cell r,c in page coordinates (for canvas particles). */
    pagePoint(r, c) {
      const rect = this.field.getBoundingClientRect();
      return { x: rect.left + (c + 0.5) * this.cell, y: rect.top + (r + 0.5) * this.cell };
    }
    /** Center of cell r,c relative to the fx layer (for DOM floaters). */
    layerPoint(r, c) {
      const f = this.field.getBoundingClientRect(), w = this.wrap.getBoundingClientRect();
      return { x: f.left - w.left + (c + 0.5) * this.cell, y: f.top - w.top + (r + 0.5) * this.cell };
    }

    /* ---------- brick lifecycle ---------- */
    _make(b, r, c, atR) {
      const el = document.createElement('div');
      el.className = 'brick';
      el.dataset.c = b.color;
      el.innerHTML = '<div class="face"><i class="stud"></i><b class="deco"></b><b class="sheen"></b></div>';
      const rec = { b: { id: b.id, color: b.color, fb: b.fb || 0 }, el, face: el.firstChild, r: atR, c };
      if (b.fb) { el.classList.add('fusebrick'); el.firstChild.insertAdjacentHTML('beforeend', `<em class="fcount">${b.fb}</em>`); }
      this._place(rec);
      this.field.appendChild(el);
      this.bricks.set(b.id, rec);
      rec.r = r;
      return rec;
    }

    reset() {
      this.gen++;
      this.bricks.forEach((rec) => rec.el.remove());
      this.bricks.clear();
      this.setHighlight(null);
      this.hideHint();
    }

    /** Move a brick with constant-acceleration fall, a tiny rebound and a squash on landing. */
    _fall(rec, fromR, toR, delay, dir, T = 172) {
      const d = Math.abs(toR - fromR);
      if (d === 0) return { land: 0, end: 0 };
      const cell = this.cell, x = rec.c * cell;
      const y0 = fromR * cell, y1 = toR * cell;
      const fall = (this.reduced ? T * 0.6 : T * this.tune.fall) * Math.sqrt(d);
      const total = fall / 0.8;
      const sgn = dir === 'down' ? 1 : -1;
      const bounce = Math.min(0.11, 0.025 * d + 0.02) * cell;
      rec.el.style.transform = `translate3d(${x}px,${y1}px,0)`;
      if (!rec.el.animate) return { land: delay + fall, end: delay + total };
      rec.el.animate([
        { transform: `translate3d(${x}px,${y0}px,0)`, easing: QUAD, offset: 0 },
        { transform: `translate3d(${x}px,${y1}px,0)`, easing: 'cubic-bezier(0.2,0.7,0.4,1)', offset: 0.8 },
        { transform: `translate3d(${x}px,${y1 - sgn * bounce}px,0)`, easing: 'cubic-bezier(0.6,0,0.8,0.4)', offset: 0.9 },
        { transform: `translate3d(${x}px,${y1}px,0)`, offset: 1 },
      ], { duration: total, delay, fill: 'backwards' });
      if (!this.reduced) {
        const s = Math.min(1, 0.45 + d * 0.16);
        rec.face.style.transformOrigin = dir === 'down' ? '50% 100%' : '50% 0%';
        rec.face.animate([
          { transform: 'scale(1,1)' },
          { transform: `scale(${1 + 0.11 * s},${1 - 0.15 * s})`, offset: 0.3 },
          { transform: `scale(${1 - 0.03 * s},${1 + 0.05 * s})`, offset: 0.65 },
          { transform: 'scale(1,1)' },
        ], { duration: 320, delay: delay + fall, easing: 'ease-out' });
      }
      return { land: delay + fall, end: delay + total };
    }

    /** Initial board: bricks rain in column by column, bottom row first. */
    async build(board) {
      this.reset();
      const gen = this.gen;
      const rows = this.rows;
      let end = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const b = board.grid[r][c];
          const rec = this._make(b, r, c, r - rows);
          const delay = this.reduced ? 0 : (rows - 1 - r) * 42 + c * 24;
          const t = this._fall(rec, r - rows, r, delay, 'down', 150);
          end = Math.max(end, t.land);
        }
      }
      await sleep(end + 60);
      return gen === this.gen;
    }

    /** Instantly rebuild the DOM from engine state (error recovery). */
    syncTo(board) {
      this.reset();
      for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) this._make(board.grid[r][c], r, c, r);
    }

    /** Game over: the whole board crumbles away. */
    async crumble() {
      const gen = this.gen;
      if (this.reduced) { await sleep(250); return; }
      let end = 0;
      this.bricks.forEach((rec) => {
        const delay = (this.rows - rec.r) * 40 + Math.random() * 120;
        const dy = (this.rows + 2 - rec.r) * this.cell;
        const dur = 520 + Math.random() * 240;
        const x = rec.c * this.cell, y = rec.r * this.cell;
        rec.el.animate([
          { transform: `translate3d(${x}px,${y}px,0) rotate(0deg)`, easing: 'cubic-bezier(0.5,0,0.9,0.6)' },
          { transform: `translate3d(${x + (Math.random() - 0.5) * this.cell}px,${y + dy}px,0) rotate(${(Math.random() - 0.5) * 80}deg)` },
        ], { duration: dur, delay, fill: 'forwards' });
        end = Math.max(end, delay + dur);
      });
      await sleep(end);
      return gen === this.gen;
    }

    /* ---------- hover preview ---------- */
    _posMap() {
      const m = new Map();
      this.bricks.forEach((rec) => m.set(rec.r * this.cols + rec.c, rec));
      return m;
    }

    setHighlight(plan) {
      if (this._hl) this._hl.forEach((el) => el.classList.remove('hl', 'hlx'));
      this._hl = [];
      if (!plan) {
        this.field.classList.remove('has-hl');
        this.chip.classList.remove('show');
        return;
      }
      const pos = this._posMap();
      const mark = (list, cls) => list.forEach((p) => {
        const rec = pos.get(p.r * this.cols + p.c);
        if (rec) { rec.el.classList.add(cls); this._hl.push(rec.el); }
      });
      mark(plan.extras, 'hlx');
      mark(plan.lineCells, 'hlx');
      mark(plan.primary, 'hl');
      this.field.classList.add('has-hl');

      // preview chip: points, plus time / combo / Line Blast tags
      const tags = [];
      if (plan.timeGain > 0) tags.push(`<span class="fuel plus">+${plan.timeGain.toFixed(1)}s</span>`);
      if (plan.line) tags.push('<span class="fuel plus">LINE BLAST</span>');
      else if (plan.combo > 1) tags.push(`<span class="fuel plus">x${plan.combo % 1 ? plan.combo.toFixed(1) : plan.combo}</span>`);
      this.chip.innerHTML = `<span>+${plan.points.toLocaleString()}</span>${tags.join('')}`;
      let minR = 99, maxR = -1, sumC = 0;
      plan.primary.forEach((p) => { minR = Math.min(minR, p.r); maxR = Math.max(maxR, p.r); sumC += p.c; });
      const top = this.layerPoint(minR, sumC / plan.primary.length);
      const bot = this.layerPoint(maxR, sumC / plan.primary.length);
      const cw = this.chip.offsetWidth || 120, ch = this.chip.offsetHeight || 28;
      const ww = this.wrap.clientWidth;
      let x = Math.max(cw / 2 + 4, Math.min(ww - cw / 2 - 4, top.x));
      let y = top.y - this.cell * 0.5 - ch / 2 - 6;
      if (y < ch / 2 + 2) y = bot.y + this.cell * 0.5 + ch / 2 + 6;
      this.chip.style.transform = `translate(${x - cw / 2}px, ${y - ch / 2}px)`;
      this.chip.classList.add('show');
    }

    /** Highlight an arbitrary cell set (Booster aim preview). */
    setCellHighlight(cells, label) {
      if (this._hl) this._hl.forEach((el) => el.classList.remove('hl', 'hlx'));
      this._hl = [];
      if (!cells || !cells.length) { this.field.classList.remove('has-hl'); this.chip.classList.remove('show'); return; }
      const pos = this._posMap();
      cells.forEach((p) => { const rec = pos.get(p.r * this.cols + p.c); if (rec) { rec.el.classList.add('hl'); this._hl.push(rec.el); } });
      this.field.classList.add('has-hl');
      let sr = 0, sc = 0;
      cells.forEach((p) => { sr += p.r; sc += p.c; });
      const mid = this.layerPoint(sr / cells.length, sc / cells.length);
      this.chip.innerHTML = `<span>${label}</span>`;
      const cw = this.chip.offsetWidth || 90, ch = this.chip.offsetHeight || 28, ww = this.wrap.clientWidth;
      const x = Math.max(cw / 2 + 4, Math.min(ww - cw / 2 - 4, mid.x));
      this.chip.style.transform = `translate(${x - cw / 2}px, ${Math.max(2, mid.y - ch - this.cell * 0.9)}px)`;
      this.chip.classList.add('show');
    }

    /** Idle hint: pulsing rings on the best available group. */
    showHint(cells) {
      if (!cells || !cells.length) return;
      let sr = 0, sc = 0;
      cells.forEach((p) => { sr += p.r; sc += p.c; });
      sr /= cells.length; sc /= cells.length;
      let best = cells[0], bd = 1e9;
      cells.forEach((p) => { const d = (p.r - sr) ** 2 + (p.c - sc) ** 2; if (d < bd) { bd = d; best = p; } });
      this.hintEl.style.transform = `translate(${best.c * this.cell}px,${best.r * this.cell}px)`;
      this.hintEl.style.width = this.hintEl.style.height = this.cell + 'px';
      this.hintEl.classList.add('show');
      const pos = this._posMap();
      this._hinted = cells.map((p) => pos.get(p.r * this.cols + p.c)).filter(Boolean).map((rec) => { rec.el.classList.add('hinting'); return rec.el; });
    }
    hideHint() {
      this.hintEl.classList.remove('show');
      if (this._hinted) { this._hinted.forEach((el) => el.classList.remove('hinting')); this._hinted = null; }
    }

    reject(r, c) {
      const rec = this._posMap().get(r * this.cols + c);
      if (!rec || !rec.face.animate) return;
      rec.face.animate([
        { transform: 'translateX(0)' }, { transform: 'translateX(-7%) rotate(-4deg)' }, { transform: 'translateX(6%) rotate(3deg)' },
        { transform: 'translateX(-4%)' }, { transform: 'translateX(0)' },
      ], { duration: 300, easing: 'ease-out' });
      rec.face.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(0.55) saturate(0.7)' }, { filter: 'brightness(1)' }], { duration: 300 });
    }

    /* ---------- the main turn animation ---------- */
    async playResult(res) {
      const gen = this.gen;
      const alive = () => gen === this.gen;
      const { tap } = res;
      const total = res.removed.length;

      // 1) pop wave, rippling out from the tapped brick
      (res.ticks || []).forEach((t) => this.tickFuseBrick(t.id, t.fb));
      const burstIds = new Set((res.bursts || []).map((b) => b.id));
      const originPt = this.pagePoint(tap.r, tap.c);
      let maxDelay = 0;
      const perBrick = total > 28 ? 3 : total > 14 ? 5 : total > 6 ? 7 : 9;
      for (const p of res.removed) {
        const rec = this.bricks.get(p.id);
        if (!rec) continue;
        this.bricks.delete(p.id);
        const dist = Math.abs(p.r - tap.r) + Math.abs(p.c - tap.c);
        const delay = this.reduced ? 0 : Math.min(dist * 17, 150) * this.tune.pop;
        maxDelay = Math.max(maxDelay, delay);
        this._pop(rec, delay, p, perBrick, originPt, p.fb ? (burstIds.has(p.id) ? 'burst' : 'defuse') : null);
      }
      await sleep(this.reduced ? 100 : (maxDelay + 90) * this.tune.pop);
      if (!alive()) return false;

      // 2) gravity + refill
      let land = 0, end = 0, landedCount = 0;
      const colDelay = (c) => (this.reduced ? 0 : c * 7);
      for (const m of res.moves) {
        const rec = this.bricks.get(m.id);
        if (!rec) continue;
        const t = this._fall(rec, rec.r, m.toR, colDelay(m.c), res.dir);
        rec.r = m.toR;
        land = Math.max(land, t.land); end = Math.max(end, t.end); landedCount++;
      }
      for (const s of res.spawns) {
        const rec = this._make({ id: s.id, color: s.color, fb: s.fb || 0 }, s.r, s.c, s.fromR);
        const t = this._fall(rec, s.fromR, s.r, colDelay(s.c), res.dir);
        land = Math.max(land, t.land); end = Math.max(end, t.end); landedCount++;
      }
      if (landedCount) setTimeout(() => alive() && this.audio.land(Math.min(1, landedCount / 10)), 160);
      await sleep(land + 40);
      if (!alive()) return false;

      // 3) core-driven recolors, then forced reshuffle if the board died
      if (res.recolors.length) { this.audio.recolor(); await this._recolor(res.recolors, 'pulse'); if (!alive()) return false; }
      if (res.shuffle.length) { this.audio.shuffle(); await this._recolor(res.shuffle, 'wave'); if (!alive()) return false; }
      return true;
    }

    _pop(rec, delay, p, shardCount, origin, fuseKind) {
      const pal = BR.PALETTE[p.color];
      const sgn = Math.random() < 0.5 ? -1 : 1;
      if (rec.face.animate) {
        const a = rec.face.animate([
          { transform: 'scale(1) rotate(0deg)', opacity: 1, filter: 'brightness(1)', offset: 0 },
          { transform: `scale(1.24) rotate(${sgn * 6}deg)`, opacity: 1, filter: 'brightness(1.7)', offset: 0.34, easing: 'ease-in' },
          { transform: `scale(0.05) rotate(${sgn * 22}deg)`, opacity: 0, filter: 'brightness(2)', offset: 1 },
        ], { duration: this.reduced ? 160 : 270, delay, fill: 'both', easing: 'ease-out' });
        a.onfinish = () => rec.el.remove();
      } else {
        setTimeout(() => rec.el.remove(), delay + 200);
      }
      setTimeout(() => {
        const pt = this.pagePoint(p.r, p.c);
        const sk = BR.Skins;
        if (fuseKind === 'burst') { this.fx.explosion(pt.x, pt.y, '#ff4d6d', 0.9); this.fx.flash('#ff4d6d', 0.25, 400); this.fx.shake(document.getElementById('app'), 9, 380); BR.haptic('boom'); }
        else if (fuseKind === 'defuse') { this.fx.sparks(pt.x, pt.y, '#3ddc97', 18, 1.4, 0.7); this.fx.ring(pt.x, pt.y, '#3ddc97', 80, 0.5, 4); }
        this.fx.pop(sk.pop, pt.x, pt.y, pal.glow, pal.hi, shardCount, 0.9, sk.popShine);
        if (sk.pop === 'lightning' && origin && !this.reduced && Math.random() < 0.55) this.fx.bolt(origin.x, origin.y, pt.x, pt.y, pal.hi);
      }, delay + 70);
    }

    /** Update a Fuse brick's countdown (called after every pop). */
    tickFuseBrick(id, n) {
      const rec = this.bricks.get(id);
      if (!rec) return;
      rec.b.fb = n;
      const em = rec.el.querySelector('.fcount');
      if (em) { em.textContent = n; em.classList.remove('tick'); void em.offsetWidth; em.classList.add('tick'); }
      rec.el.classList.toggle('danger', n <= 2);
    }

    _recolor(list, mode) {
      let maxEnd = 0;
      list.forEach((it, i) => {
        const rec = this.bricks.get(it.id);
        if (!rec) return;
        const delay = mode === 'wave' ? (rec.r + rec.c) * 28 : i * 26;
        const dur = 380;
        maxEnd = Math.max(maxEnd, delay + dur);
        if (rec.face.animate) {
          rec.face.animate([
            { transform: 'scaleX(1) scaleY(1)', filter: 'brightness(1)' },
            { transform: 'scaleX(0.04) scaleY(1.1)', filter: 'brightness(1.8)', offset: 0.5 },
            { transform: 'scaleX(1) scaleY(1)', filter: 'brightness(1)' },
          ], { duration: dur, delay, easing: 'ease-in-out' });
        }
        setTimeout(() => {
          rec.b.color = it.color;
          rec.el.dataset.c = it.color;
          }, delay + dur / 2);
      });
      return sleep(maxEnd + 30);
    }
  }

  BR.BoardView = BoardView;
})();
