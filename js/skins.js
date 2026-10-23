/* Applies the equipped Skin / Pop / Board / Fuse, renders item previews, and plays signature moments. */
(function () {
  const BR = (window.BR = window.BR || {});

  let brickN = 0;
  const clampX = (x, b) => Math.max(b.left + 20, Math.min(b.right - 20, x));
  BR.Skins = {
    pop: 'classic',
    popShine: 'plain',
    beam: '#9ff0ff',
    moments: {},      // item moment keys currently active (e.g. { fireworks: true })
    /* Series 3 plugs its signature moments in here instead of growing onEvent: handler(type, d, ctx) runs for every
       event, ctx = { M, fx, rnd, cells, n, view } (cells/n only for 'pop' and 'demo'). applyHooks(M, root) run at the end of apply(). */
    handlers: [],
    applyHooks: [],
    fuseCls: 'fuse-classic',

    /** Re-read the loadout and restyle the page. */
    apply() {
      const root = document.documentElement;
      const P = BR.Progress;
      const sk = P.equipped('skin'), po = P.equipped('pop'), bo = P.equipped('board'), fu = P.equipped('fuse');
      Array.from(root.classList).filter((c) => /^board-/.test(c)).forEach((c) => root.classList.remove(c));
      root.classList.add(bo.item.cls);
      root.dataset.ashine = bo.inst ? bo.inst.shine : 'plain';
      const seed = sk.inst ? sk.inst.seed : 0;
      document.querySelectorAll('[data-skin-host]').forEach((el) => {
        Array.from(el.classList).filter((c) => /^skin-/.test(c)).forEach((c) => el.classList.remove(c));
        el.classList.add(sk.item.cls);
        el.dataset.shine = sk.inst ? sk.inst.shine : 'plain';
        el.style.setProperty('--ang', 160 + ((seed % 41) - 20) + 'deg');
        el.style.setProperty('--sx', (seed % 97) + 'px');
      });
      document.querySelectorAll('[data-fuse-host]').forEach((el) => {
        Array.from(el.classList).filter((c) => /^fuse-/.test(c)).forEach((c) => el.classList.remove(c));
        el.classList.add(fu.item.cls);
        el.dataset.shine = fu.inst ? fu.inst.shine : 'plain';
      });
      this.pop = po.item.recipe;
      this.popShine = po.inst ? po.inst.shine : 'plain';
      this.beam = bo.item.beam;
      this.fuseCls = fu.item.cls;
      if (BR.Fuse && BR.Fuse.setHat) BR.Fuse.setHat(P.equippedHat ? P.equippedHat() : null);
      this.moments = {};
      [sk, po, bo, fu].forEach((x) => { if (x.item.moment) this.moments[x.item.moment] = true; });
      root.classList.toggle('has-nova', !!this.moments.nova);
      this.applyHooks.forEach((h) => h(this.moments, root));
    },


    /* ------------------------------------------------------------------ signature moments
       Each one is short (under 600ms) and only draws on the effects layer, so it never slows a tap. */
    popCount: 0,
    /* The decorative side of a Rush start (skies, rune rings, set flourishes...) starts two frames after the tap, under the flash: the tap frame keeps only what the player must feel at once (the pop, the Rush class and banner).
       Those hooks read the board's size, and in the tap frame that forced the Rush restyle of the whole run screen in the middle of the
       handler. A later moment (a Rush end, a stage clear, the results...) first plays what is still waiting, so their order never
       changes; the pop of the same tap does not wait for them. (Deferring the stage clear and the Last Spark the same way made the
       Spire set's pop frames longer in tests/perfbudget.js, so those still run at once.) */
    later(fn) {
      (this._later = this._later || []).push(fn);
      // (two frames: a tap is handled at the start of a frame, before its animation callbacks, so one would still run before its style)
      if (!this._laterRaf) this._laterRaf = requestAnimationFrame(() => { this._laterRaf = requestAnimationFrame(() => { this._laterRaf = 0; this.flushLater(); }); });
    },
    flushLater() {
      const q = this._later; this._later = null;
      if (this._laterRaf) { cancelAnimationFrame(this._laterRaf); this._laterRaf = 0; }
      if (q) q.forEach((f) => f());
    },
    onEvent(type, d) {
      if (this._later && type !== 'pop' && type !== 'line' && type !== 'demo') this.flushLater();
      const M = this.moments || {};
      if (BR.reducedMotion) return;
      if (!Object.keys(M).length && !this.handlers.length) return;   // moment-less loadouts still reach the Series 3 handlers (demos, skins without a moment)
      const fx = BR.App.fx, rnd = (a, b) => a + Math.random() * (b - a);
      if (type === 'pop' || type === 'demo') {
        let cells, n, view, pt;
        if (type === 'demo') {
          const rects = d.cells.map((el) => el.getBoundingClientRect());
          cells = rects.map((r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 }));
          n = 8; pt = (c) => c;
        } else {
          view = d.view; const p = d.res.plan; n = p.n;
          cells = p.primary.slice(0, 9).map((q) => view.pagePoint(q.r, q.c));
        }
        const col = (i) => BR.PALETTE[(d.res && d.res.plan.color != null ? d.res.plan.color : i) % 7];
        this.popCount++;
        const ctx = { M, fx, rnd, cells, n, view, col };
        this.handlers.forEach((h) => h(type, d, ctx));
        if (M.lava && n >= 4) cells.forEach((q) => {
          for (let i = 0; i < 3; i++) fx.emit({ kind: 'spark', x: q.x + rnd(-10, 10), y: q.y, vx: rnd(-70, 70), vy: rnd(-420, -200), g: 520, drag: 0.6, size: rnd(2.6, 5), max: rnd(0.45, 0.8), color: ['#ff9a3d', '#ffcf3f', '#ff4d2e'][i % 3] });
          fx.ring(q.x, q.y, '#ff7a2a', 34 + n * 3, 0.4, 3);
        });
        if (M.nova && n >= 3) cells.forEach((q) => {
          for (let i = 0; i < 4; i++) {
            const a = rnd(0, 6.283), sp = rnd(260, 520);
            fx.emit({ shape: 'star', x: q.x, y: q.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0, drag: 2.4, size: rnd(6, 11), max: rnd(0.4, 0.7), rot: rnd(0, 6), vr: rnd(-6, 6), color: '#ffffff' });
            fx.emit({ kind: 'spark', x: q.x, y: q.y, vx: Math.cos(a) * sp * 0.7, vy: Math.sin(a) * sp * 0.7, g: 0, drag: 3, size: rnd(2, 3.4), max: rnd(0.4, 0.7), color: '#9ff0ff' });
          }
        });
        if (M.aurora && n >= 4) cells.forEach((q, i) => fx.emit({ kind: 'spark', x: q.x + rnd(-12, 12), y: q.y, vx: rnd(-30, 30), vy: rnd(-120, -50), g: -30, drag: 0.8, size: rnd(9, 16), max: rnd(0.8, 1.2), color: ['#7affd9', '#b07aff', '#ff7ad9'][i % 3] }));
        if (M.heart && n >= 3) cells.forEach((q) => {
          const R = ['#ff6bd6', '#6bf0ff', '#fff36b', '#a56bff', '#6bffb2'];
          for (let i = 0; i < 4; i++) { const a = rnd(0, 6.283), sp = rnd(120, 300); fx.emit({ kind: 'spark', x: q.x, y: q.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 80, drag: 2, size: rnd(2, 3.6), max: rnd(0.4, 0.7), color: R[i % 5] }); }
          fx.ring(q.x, q.y, R[(Math.random() * 5) | 0], 40, 0.4, 3);
        });
        if (M.fireworks && n >= 8 && view) {
          const b = view.boardEl.getBoundingClientRect(), c0 = cells[0];
          const cols = ['#ff6b9a', '#ffd36b', '#6bffb2', '#6bb8ff', '#c08bff'];
          BR.audio.launch();
          fx.firework(c0.x, c0.y, clampX(c0.x + rnd(-80, 80), b), Math.max(60, b.top - rnd(40, 140)), cols[(Math.random() * 5) | 0], ['peony', 'ring', 'willow', 'star'][(Math.random() * 4) | 0]);
          if (n >= 12) setTimeout(() => fx.firework(b.left + b.width * rnd(0.2, 0.8), b.bottom, b.left + b.width * rnd(0.2, 0.8), Math.max(60, b.top - 60), cols[(Math.random() * 5) | 0], 'peony'), 140);
        }
        if (M.thunder && type === 'pop' && (n >= 7 || this.popCount % 5 === 0)) this.lightning(d.view.boardEl, cells[0]);
      } else if (type === 'line') {
        this.handlers.forEach((h) => h(type, d, { M, fx, rnd }));
        if (M.scan) this.scan(d.view.boardEl);
        if (M.thunder) this.lightning(d.view.boardEl, null);
      } else if (type === 'rushStart') {
        this.later(() => this.handlers.forEach((h) => h(type, d, { M, fx, rnd })));
        const run = d.run.el;
        run.classList.toggle('tint-plasma', !!M.plasma);
        if (M.dragon) this.roar(d.run);
        if (M.plasma) { BR.audio.crackle(); }
      } else if (type === 'rushEnd') {
        this.handlers.forEach((h) => h(type, d, { M, fx, rnd }));
        d.run.el.classList.remove('tint-plasma');
        if (M.ice) {
          const r = document.getElementById('fuseFill').getBoundingClientRect();
          fx.shards(r.left + r.width * 0.6, r.top + r.height / 2, '#dff7ff', 18, 1.1, { shape: 'tri', size: 4, spread: 6, life: 0.6 });
          BR.audio.glassBreak();
        }
      } else if (type === 'stageUp') {
        this.handlers.forEach((h) => h(type, d, { M, fx, rnd }));
        if (M.dragon) fx.flash('#ff7a2a', 0.2, 320);
      } else if (type === 'spark' || type === 'sparkEnd' || type === 'results') {
        // the Last Spark starting and ending, and the results opening (Moonwick fuses, boards and sets react to them)
        this.handlers.forEach((h) => h(type, d, { M, fx, rnd }));
      }
    },
    lightning(boardEl, at) {
      const fx = BR.App.fx, b = boardEl.getBoundingClientRect();
      const x = at ? at.x : b.left + b.width * (0.2 + Math.random() * 0.6);
      fx.bolt(x + (Math.random() - 0.5) * 60, 0, x, b.top + b.height * (0.2 + Math.random() * 0.3), '#cfe0ff');
      const bg = document.getElementById('bg');
      let el = bg.querySelector('.bolt-flash');
      if (!el) { el = document.createElement('i'); el.className = 'bolt-flash'; bg.appendChild(el); }
      el.style.setProperty('--bx', ((x / window.innerWidth) * 100).toFixed(0) + '%');
      el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
      BR.audio.crackle();
    },
    scan(boardEl) {
      let el = boardEl.querySelector('.scan-line');
      if (!el) { el = document.createElement('i'); el.className = 'scan-line'; boardEl.appendChild(el); }
      el.animate([{ top: '-24%', opacity: 1 }, { top: '100%', opacity: 1 }], { duration: 560, easing: 'cubic-bezier(0.4,0,0.6,1)' });
      BR.audio.whoosh();
    },
    roar(run) {
      const fx = BR.App.fx, b = run.view.boardEl.getBoundingClientRect(), bomb = document.getElementById('bomb').getBoundingClientRect();
      fx.shake(document.getElementById('app'), 12, 520);
      BR.audio.boom();
      let el = run.view.boardEl.parentNode.querySelector('.fire-sweep');
      if (!el) { el = document.createElement('i'); el.className = 'fire-sweep'; run.view.boardEl.parentNode.appendChild(el); }
      el.animate([{ transform: 'translateX(-60%)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: 'translateX(110%)', opacity: 0.9, offset: 0.8 }, { transform: 'translateX(130%)', opacity: 0 }], { duration: 900, easing: 'cubic-bezier(0.3,0.6,0.4,1)' });
      for (let i = 0; i < 22; i++) fx.emit({ kind: 'spark', x: bomb.left + bomb.width / 2, y: bomb.top + bomb.height / 2, vx: Math.random() * 640 + 80, vy: (Math.random() - 0.5) * 220, g: -60, drag: 1.5, size: 3 + Math.random() * 4, max: 0.5 + Math.random() * 0.5, color: ['#ff4d2e', '#ff9a3d', '#ffd24a'][i % 3] });
    },

    brickHTML(color, i) {
      const n = i == null ? ++brickN : i + 1;      // (the third, sixth... brick of a row of previews wears the skin's idle animation)
      return `<div class="brick${n % 3 === 0 ? ' b3' : ''}" data-c="${color}"><div class="face"><i class="stud"></i><b class="deco"></b><b class="sheen"></b></div></div>`;
    },

    /** Small live preview of an item: used on cards, sheets, the reel and the result. */
    previewHTML(item, inst, o = {}) {
      const shine = inst ? inst.shine : 'plain';
      if (item.type === 'skin') {
        const seed = inst ? inst.seed : 0;
        const style = `--ang:${160 + ((seed % 41) - 20)}deg;--sx:${seed % 97}px`;
        return `<div class="mini-bricks ${item.cls}" data-shine="${shine}" style="${style}">${[0, 1, 3].map((c, i) => this.brickHTML(c, i)).join('')}</div>`;
      }
      if (item.type === 'pop') {
        const dots = Array.from({ length: 10 }, (_, i) => `<i class="an" style="--a:${i * 36}deg"></i>`).join('');
        return `<div class="mini-burst" style="--c:${item.color}">${dots}</div>`;
      }
      if (item.type === 'board') return `<div class="mini-board ${item.cls} ${o.live ? 'live' : ''}" data-ashine="${shine}">${o.live ? '<b class="scene-fx"></b><b class="scene-fx b"></b>' : ''}<i></i></div>`;
      return `<div class="mini-fuse ${item.cls}" data-shine="${shine}"><span class="mf-bomb"></span><span class="mf-track"><i class="mf-fill"></i><b class="mf-spark"></b></span></div>`;
    },
  };
})();
