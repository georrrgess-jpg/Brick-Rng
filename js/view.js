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
      window.addEventListener('scroll', () => { this._rc = null; }, true);
    }

    /* ---------- geometry ---------- */
    layout() {
      this._rc = null;
      const w = this.field.clientWidth;
      if (!w) return;
      this._ww = this.wrap.clientWidth;
      this.cell = w / this.cols;
      this.field.style.setProperty('--cell', this.cell + 'px');
      this.bricks.forEach((rec) => this._place(rec));
      this.hintEl.style.fontSize = this.cell + 'px';
    }
    _place(rec) {
      rec.el.style.transform = `translate(${rec.c * this.cell}px,${rec.r * this.cell}px)`;
      this._rowcol(rec);
    }
    /** The brick's row and column as custom properties, for skins that draw one picture across the whole board (Moonglass). Called wherever
        rec.r or rec.c changes, because the brick's transform is animated and _place is not. */
    _rowcol(rec) {
      if (rec._pr !== rec.r) { rec._pr = rec.r; rec.el.style.setProperty('--r', rec.r); }
      if (rec._pc !== rec.c) { rec._pc = rec.c; rec.el.style.setProperty('--c', rec.c); }
    }

    /** Where the board sits on the page. Measured once and kept (it only moves when the layout does), because reading
        it in the middle of a pop forces the browser to restyle the whole board. */
    _rects() {
      if (!this._rc) { const f = this.field.getBoundingClientRect(), w = this.wrap.getBoundingClientRect(); this._rc = { fl: f.left, ft: f.top, wl: w.left, wt: w.top }; }
      return this._rc;
    }
    cellAt(clientX, clientY) {
      const rc = this._rects();
      const x = clientX - rc.fl, y = clientY - rc.ft;
      const c = Math.floor(x / this.cell), r = Math.floor(y / this.cell);
      if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return null;
      return { r, c };
    }
    /** Center of cell r,c in page coordinates (for canvas particles). */
    pagePoint(r, c) {
      const rc = this._rects();
      return { x: rc.fl + (c + 0.5) * this.cell, y: rc.ft + (r + 0.5) * this.cell };
    }
    /** Center of cell r,c relative to the fx layer (for DOM floaters). */
    layerPoint(r, c) {
      const rc = this._rects();
      return { x: rc.fl - rc.wl + (c + 0.5) * this.cell, y: rc.ft - rc.wt + (r + 0.5) * this.cell };
    }

    /* ---------- brick lifecycle ---------- */
    _make(b, r, c, atR) {
      const el = document.createElement('div');
      el.className = 'brick';
      el.dataset.c = b.color;
      el.innerHTML = '<div class="face"><i class="stud"></i><b class="deco"></b><b class="sheen"></b></div>';
      const rec = { b: { id: b.id, color: b.color, fb: b.fb || 0 }, el, face: el.firstChild, r: atR, c };
      // a Fuse brick keeps its colour (it still groups by it): the ring, the fuse stub and the countdown are drawn on top of the skin's brick
      if (b.fb) { el.classList.add('fusebrick'); el.firstChild.insertAdjacentHTML('beforeend', `<i class="fring"></i><i class="fcap"></i><em class="fcount">${b.fb}</em>`); }
      this._place(rec);
      this.field.appendChild(el);
      this.bricks.set(b.id, rec);
      rec.r = r; this._rowcol(rec);
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
    _fall(rec, fromR, toR, delay, dir, T = 172, calm = false) {
      const d = Math.abs(toR - fromR);
      if (d === 0) return { land: 0, end: 0 };
      const cell = this.cell, x = rec.c * cell;
      const y0 = fromR * cell, y1 = toR * cell;
      const fall = (this.reduced ? T * 0.6 : T * this.tune.fall) * Math.sqrt(d);
      const total = fall / 0.8;
      const sgn = dir === 'down' ? 1 : -1;
      const bounce = calm ? 0 : Math.min(0.11, 0.025 * d + 0.02) * cell;
      rec.el.style.transform = `translate(${x}px,${y1}px)`;
      if (!rec.el.animate) return { land: delay + fall, end: delay + total };
      rec.el.animate([
        { transform: `translate(${x}px,${y0}px)`, easing: QUAD, offset: 0 },
        { transform: `translate(${x}px,${y1}px)`, easing: 'cubic-bezier(0.2,0.7,0.4,1)', offset: 0.8 },
        { transform: `translate(${x}px,${y1 - sgn * bounce}px)`, easing: 'cubic-bezier(0.6,0,0.8,0.4)', offset: 0.9 },
        { transform: `translate(${x}px,${y1}px)`, offset: 1 },
      ], { duration: total, delay, fill: 'backwards' });
      if (!this.reduced && !calm) {
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
          { transform: `translate(${x}px,${y}px) rotate(0deg)`, easing: 'cubic-bezier(0.5,0,0.9,0.6)' },
          { transform: `translate(${x + (Math.random() - 0.5) * this.cell}px,${y + dy}px) rotate(${(Math.random() - 0.5) * 80}deg)` },
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
      const tags = [];   // time is green, combo is orange: they never look alike
      let tagChars = 0;
      const tag = (cls, text) => { tags.push(`<span class="fuel ${cls}">${text}</span>`); tagChars += text.length + 2; };
      if (plan.timeGain > 0) tag('plus', `+${plan.timeGain.toFixed(1)}s`);
      if (plan.line) tag('combo', 'LINE BLAST');
      else if (plan.combo > 1) tag('combo', `Combo x${plan.combo % 1 ? plan.combo.toFixed(1) : plan.combo}`);
      const pts = '+' + BR.fmt(plan.points);
      this.chip.innerHTML = `<span>${pts}</span>${tags.join('')}`;
      let minR = 99, maxR = -1, sumC = 0;
      plan.primary.forEach((p) => { minR = Math.min(minR, p.r); maxR = Math.max(maxR, p.r); sumC += p.c; });
      const top = this.layerPoint(minR, sumC / plan.primary.length);
      const bot = this.layerPoint(maxR, sumC / plan.primary.length);
      // the chip is centred by CSS on the point we give it, so its size is only needed to keep it on screen: estimated, not measured
      const cw = this._chipW(pts.length + tagChars * 0.8), ch = 30;
      const ww = this._ww || (this._ww = this.wrap.clientWidth);
      let x = Math.max(cw / 2 + 4, Math.min(ww - cw / 2 - 4, top.x));
      let y = top.y - this.cell * 0.5 - ch / 2 - 6;
      if (y < ch / 2 + 2) y = bot.y + this.cell * 0.5 + ch / 2 + 6;
      this.chip.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      this.chip.classList.add('show');
    }

    _chipW(chars) { return 26 + chars * 9.5; }
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
      const cw = this._chipW(label.length), ch = 30, ww = this._ww || (this._ww = this.wrap.clientWidth);
      const x = Math.max(cw / 2 + 4, Math.min(ww - cw / 2 - 4, mid.x));
      this.chip.style.transform = `translate(${x}px, ${Math.max(ch / 2 + 2, mid.y - ch / 2 - this.cell * 0.9)}px) translate(-50%, -50%)`;
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
      // A big group holds for a beat (the lifted bricks, then the burst) so the hit has weight. The bigger the moment, the longer the beat:
      // a group of 8 holds about 50 ms, 24 bricks about 85 ms, and a Line Blast, a Rush start or a cleared stage add a little more.
      const big = total >= 8 || (res.plan && res.plan.line) || res.stageUp || res.rushStart;
      const hitStop = big && !this.reduced ? Math.min(120, 40 + total * 1.3 + (res.plan && res.plan.line ? 24 : 0) + (res.stageUp ? 16 : 0) + (res.rushStart ? 16 : 0)) : 0;
      for (const p of res.removed) {
        const rec = this.bricks.get(p.id);
        if (!rec) continue;
        this.bricks.delete(p.id);
        const dist = Math.abs(p.r - tap.r) + Math.abs(p.c - tap.c);
        const delay = this.reduced ? 0 : Math.min(dist * 17, 150) * this.tune.pop + hitStop;
        maxDelay = Math.max(maxDelay, delay);
        this._pop(rec, delay, p, perBrick, originPt, p.fb ? (burstIds.has(p.id) ? 'burst' : 'defuse') : null, hitStop > 0);
      }
      await sleep(this.reduced ? 100 : (maxDelay + 90) * this.tune.pop);
      if (!alive()) return false;

      // 2) gravity + refill
      let land = 0, end = 0, landedCount = 0;
      const colDelay = (c) => (this.reduced ? 0 : c * 7);
      const calm = res.moves.length + res.spawns.length > 24;   // a big refill drops without the bounce, so the next move is readable sooner
      for (const m of res.moves) {
        const rec = this.bricks.get(m.id);
        if (!rec) continue;
        const t = this._fall(rec, rec.r, m.toR, colDelay(m.c), res.dir, 172, calm);
        rec.r = m.toR; this._rowcol(rec);
        land = Math.max(land, t.land); end = Math.max(end, t.end); landedCount++;
      }
      for (const s of res.spawns) {
        const rec = this._make({ id: s.id, color: s.color, fb: s.fb || 0 }, s.r, s.c, s.fromR);
        const t = this._fall(rec, s.fromR, s.r, colDelay(s.c), res.dir, 172, calm);
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

    _pop(rec, delay, p, shardCount, origin, fuseKind, held) {
      const pal = BR.PALETTE[p.color];
      const sgn = Math.random() < 0.5 ? -1 : 1;
      if (rec.face.animate) {
        const a = rec.face.animate([
          // a big pop starts where the press left the bricks (lifted and bright), holds for the hit-stop, then bursts
          held ? { transform: 'translateY(-5%) scale(1.045) rotate(0deg)', opacity: 1, filter: 'brightness(1.12) saturate(1.12)', offset: 0 } : { transform: 'scale(1) rotate(0deg)', opacity: 1, filter: 'brightness(1)', offset: 0 },
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
        if (fuseKind === 'burst') { this.fx.explosion(pt.x, pt.y, '#ff4d6d', 0.9); this.fx.flash('#ff4d6d', 0.25, 400); this.fx.shake(document.getElementById('boardWrap'), 7, 380); BR.haptic('boom'); }
        else if (fuseKind === 'defuse') { this.fx.sparks(pt.x, pt.y, '#3ddc97', 18, 1.4, 0.7); this.fx.ring(pt.x, pt.y, '#3ddc97', 80, 0.5, 4); }
        this.fx.pop(sk.pop, pt.x, pt.y, pal.glow, pal.hi, shardCount, 0.9, sk.popShine);
        if (sk.pop === 'lightning' && origin && !this.reduced && Math.random() < 0.55) this.fx.bolt(origin.x, origin.y, pt.x, pt.y, pal.hi);
      }, delay + 70);
    }

    /** A colour joined the board: every brick of that colour gives one bright pulse, so the player sees where the new colour landed. */
    pulseColor(color) {
      if (this.reduced) return;
      this.bricks.forEach((rec) => {
        if (rec.b.color !== color || !rec.face.animate) return;
        rec.face.animate([
          { transform: 'scale(1)', filter: 'brightness(1)' },
          { transform: 'scale(1.16)', filter: 'brightness(1.5) saturate(1.25)', offset: 0.35 },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ], { duration: 640, delay: (rec.c + rec.r) * 22, easing: 'ease-out' });
      });
    }

    /** Update a Fuse brick's countdown (called after every pop). */
    tickFuseBrick(id, n) {
      const rec = this.bricks.get(id);
      if (!rec) return;
      rec.b.fb = n;
      const em = rec.el.querySelector('.fcount');
      if (em) { em.textContent = n; BR.replay(em, 'tick'); }
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
