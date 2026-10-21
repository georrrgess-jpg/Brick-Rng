/* Chest openings: arrive, hold to open, themed burst, the spin, the reveal. One state machine per chest.
   The drop is rolled and saved at the burst moment, so backing out before that costs nothing. */
(function () {
  const BR = (window.BR = window.BR || {});
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const P = () => BR.Progress;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ORIENT = { skin: 'h', fuse: 'h', pop: 'v', board: 'v' };
  const HOLD_TIME = 1.2;
  const TYPES = [['skin', 'Skins'], ['pop', 'Pops'], ['board', 'Boards'], ['fuse', 'Fuses']];
  const LEVEL_NAME = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythic'];
  const fx = () => BR.App.fx;
  const reduced = () => !!BR.reducedMotion;

  /* ===================================================================== hero demos */
  /** A live, looping mini demo of an item. Returns { stop() }. Pops use the real particle recipes. */
  function heroDemo(host, item, inst, o = {}) {
    let alive = true;
    const timers = [];
    const later = (fn, ms) => { const id = setTimeout(() => { if (alive) fn(); }, ms); timers.push(id); };
    const shine = inst ? inst.shine : 'plain';
    const pal = (c) => BR.PALETTE[c];
    const power = o.power || 1;
    const popAt = (el, recipe, c, big) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      fx().pop(recipe, r.left + r.width / 2, r.top + r.height / 2, pal(c).glow, pal(c).hi, big ? 12 : 8, big ? 1.6 : 1, shine);
      if (recipe === 'lightning') fx().bolt(r.left + r.width / 2, Math.max(60, r.top - 220), r.left + r.width / 2, r.top + r.height / 2);
    };
    const recipe = item.type === 'pop' ? item.recipe : BR.Skins.pop;
    const flavor = item.type === 'pop' ? shine : BR.Skins.popShine;
    const colors = [0, 0, 4, 2, 3, 4, 2, 3, 5];
    const groups = [[0, 1], [2, 5], [3, 6], [4, 7]];

    if (item.type === 'pop') {
      host.innerHTML = '<div class="hero-pop"><div class="hp-brick"></div></div>';
      const slot = host.querySelector('.hp-brick');
      let n = 0;
      const cycle = () => {
        slot.className = 'hp-brick re';
        slot.innerHTML = BR.Skins.brickHTML([3, 0, 2, 4][n % 4]);
        const c = [3, 0, 2, 4][n % 4];
        later(() => { slot.classList.add('pop'); popAt(slot, recipe, c, n % 3 === 2); if (!o.silent) BR.audio.pop(n % 3 === 2 ? 9 : 4, 1, recipe === 'classic' ? null : recipe); n++; }, 850);
        later(cycle, 1900);
      };
      later(cycle, 350);
    } else {
      let gridHTML;
      const bricks = colors.map((c) => BR.Skins.brickHTML(c)).join('');
      if (item.type === 'skin') {
        const seed = inst ? inst.seed : 0;
        host.innerHTML = `<div class="hero-bricks ${item.cls}" data-shine="${shine}" style="--ang:${160 + ((seed % 41) - 20)}deg;--sx:${seed % 97}px">${bricks}</div>`;
      } else if (item.type === 'board') {
        host.innerHTML = `<div class="hero-board ${item.cls}" data-ashine="${shine}"><b class="scene-fx"></b><b class="scene-fx b"></b><div class="hb-board" data-skin-host>${bricks}</div></div>`;
      } else {
        host.innerHTML = `<div class="hero-fuse"><div class="mini-fuse ${item.cls}" data-shine="${shine}"><span class="mf-bomb"></span><span class="mf-track"><i class="mf-fill"></i><b class="mf-spark"></b></span></div></div>`;
        return { stop() { alive = false; } };
      }
      const cells = Array.from(host.querySelectorAll('.brick'));
      let n = 0;
      const step = () => {
        const g = groups[n++ % groups.length];
        g.forEach((i) => cells[i].classList.add('hpop'));
        later(() => {
          g.forEach((i) => popAt(cells[i], recipe, +cells[i].dataset.c, n % 4 === 0));
          if (!o.silent) BR.audio.pop(3, 1, recipe === 'classic' ? null : recipe);
          if (item.type === 'skin' && BR.Skins.onEvent) BR.Skins.onEvent('demo', { item, cells: g.map((i) => cells[i]) });
        }, 90);
        later(() => g.forEach((i) => {
          const c = Math.floor(Math.random() * 6); cells[i].dataset.c = c; cells[i].classList.remove('hpop'); cells[i].classList.remove('hp'); void cells[i].offsetWidth; cells[i].classList.add('hp');
        }), 330);
        later(step, 1550);
      };
      later(step, 700);
    }
    return { stop() { alive = false; timers.forEach(clearTimeout); } };
  }

  /* ===================================================================== rituals */
  /* Each ritual moves the chest's parts (see js/chestart.js): hold(ch, p, t, ctx) every frame while pressed, burst(ch, c) once.
     `ch` is the .chest element; parts are found by data-p. Everything is a CSS transform or opacity on a part div. */
  const part = (ch, name) => ch.querySelector(`[data-p="${name}"]`);
  const parts = (ch, name) => Array.from(ch.querySelectorAll(`[data-p="${name}"]`));
  const fly = (el, kf, ms, ease) => el && el.animate(kf, { duration: ms, fill: 'forwards', easing: ease || 'cubic-bezier(0.3,0.6,0.4,1)' });
  const fade = (el, ms, delay = 0) => el && el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, delay, fill: 'forwards' });
  const rattle = (t, p, k = 1) => Math.sin(t * 61) * p * p * k;

  const Rituals = {
    brick: {
      init() { },
      hold(ch, p, t) {
        parts(ch, 'piece').forEach((el, i) => { const a = p * p * 2.4; el.style.transform = `translate(${(Math.sin(t * 61 + i * 2.3) * a).toFixed(2)}px, ${(Math.cos(t * 53 + i * 1.7) * a).toFixed(2)}px)`; });
        const lid = part(ch, 'lid'); if (lid) lid.style.transform = `translate(${(rattle(t, p, 1.2)).toFixed(2)}px, ${(-p * p * 9).toFixed(1)}px) rotate(${(Math.sin(t * 47) * p * p * 1.1).toFixed(2)}deg)`;
      },
      burst(ch, c) {
        parts(ch, 'piece').forEach((el) => {
          const dx = rnd(-250, 250), dy = -rnd(160, 340), r = rnd(-480, 480);
          el.style.transform = '';
          fly(el, [{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${dx * 0.6}px, ${dy}px) rotate(${r * 0.5}deg)`, offset: 0.4, easing: 'cubic-bezier(0.4,0,0.9,0.6)' }, { transform: `translate(${dx}px, ${dy + 600}px) rotate(${r}deg)`, opacity: 0 }], rnd(900, 1300), 'cubic-bezier(0.2,0.7,0.4,1)');
        });
        const lid = part(ch, 'lid');
        if (lid) { lid.style.transform = ''; fly(lid, [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-250px) rotate(-24deg)', opacity: 1, offset: 0.5 }, { transform: 'translateY(300px) rotate(-62deg)', opacity: 0 }], 1250); }
        ['body', 'straps', 'leak'].forEach((n) => { const el = part(ch, n); if (el) fly(el, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.05, 0.92)', opacity: 1, offset: 0.2 }, { transform: 'scale(0.8, 0.3) translateY(10%)', opacity: 0 }], 650, 'ease-in'); });
        c.explode('#ff6a4d', '#ffc83d', 1.2);
        BR.audio.brickBurst();
      },
    },
    pop: {
      init(ch) {
        ch.querySelectorAll('.c-fusewire').forEach((w) => { w._len = w.getTotalLength(); w.style.strokeDasharray = `${w._len} ${w._len}`; w.style.strokeDashoffset = 0; });
      },
      hold(ch, p, t) {
        const ws = ch.querySelectorAll('.c-fusewire'); if (!ws.length) return;
        const w = ws[0], rem = w._len * (1 - p);
        ws.forEach((x) => { x.style.strokeDasharray = `${rem} ${w._len}`; });
        const pt = w.getPointAtLength(rem);
        ch.querySelectorAll('.c-spark, .c-spark2').forEach((s) => { s.setAttribute('cx', pt.x); s.setAttribute('cy', pt.y); s.setAttribute('r', (s.classList.contains('c-spark2') ? 10 : 6) * (1 + p * 0.8 + Math.sin(t * 40) * 0.14)); });
        const l = part(ch, 'half-l'), r = part(ch, 'half-r'), lid = part(ch, 'lid');
        const sp = p * p * 3.2, sh = Math.sin(t * 50) * p * p * 1.2;
        if (l) l.style.transform = `translate(${(-sp + sh).toFixed(2)}px, 0) scale(${1 + p * p * 0.02}, ${1 - p * p * 0.015})`;
        if (r) r.style.transform = `translate(${(sp + sh).toFixed(2)}px, 0) scale(${1 + p * p * 0.02}, ${1 - p * p * 0.015})`;
        if (lid) lid.style.transform = `translate(${sh.toFixed(2)}px, ${(-p * p * 6).toFixed(1)}px)`;
      },
      burst(ch, c) {
        const l = part(ch, 'half-l'), r = part(ch, 'half-r'), lid = part(ch, 'lid');
        [l, r, lid].forEach((el) => { if (el) el.style.transform = ''; });
        fly(l, [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(-70px,-30px) rotate(-14deg)', opacity: 1, offset: 0.3 }, { transform: 'translate(-190px, 150px) rotate(-38deg)', opacity: 0 }], 1100, 'cubic-bezier(0.2,0.7,0.3,1)');
        fly(r, [{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(70px,-30px) rotate(14deg)', opacity: 1, offset: 0.3 }, { transform: 'translate(190px, 150px) rotate(38deg)', opacity: 0 }], 1100, 'cubic-bezier(0.2,0.7,0.3,1)');
        fly(lid, [{ transform: 'translateY(0) rotate(0)', opacity: 1 }, { transform: 'translateY(-240px) rotate(40deg)', opacity: 1, offset: 0.45 }, { transform: 'translateY(200px) rotate(90deg)', opacity: 0 }], 1200, 'cubic-bezier(0.2,0.8,0.3,1)');
        c.explode('#ff3d8b', '#ffd24a', 1.1);
        BR.audio.bang();
        const rc = c.rect, cols = ['#ff6b9a', '#ffd36b', '#6bffb2', '#6bb8ff', '#c08bff'];
        for (let i = 0; i < 4; i++) setTimeout(() => { BR.audio.launch(); fx().firework(rc.x, rc.y, rc.x + rnd(-120, 120), rc.y - rnd(150, 300), cols[i % 5], ['peony', 'ring', 'star', 'willow'][i]); }, 120 + i * 140);
      },
    },
    board: {
      init() { },
      hold(ch, p, t) {
        // frost comes from --hold in css; the cracks draw themselves in from the middle
        const q = clamp((p - 0.18) / 0.82, 0, 1);
        ch.querySelectorAll('.cp-cracks path').forEach((el, i) => { el.style.strokeDashoffset = (100 * (1 - clamp(q * 1.7 - i * 0.2, 0, 1))).toFixed(1); });
        const cr = part(ch, 'cracks'); if (cr) cr.style.opacity = q > 0 ? 1 : 0;
        const g = part(ch, 'glass'), f = part(ch, 'frost'), b = part(ch, 'board');
        const sh = `translate(${(Math.sin(t * 70) * p * p * 1.8).toFixed(2)}px, ${(-p * p * 3).toFixed(1)}px)`;
        [g, f, cr].forEach((el) => { if (el) el.style.transform = sh; });
        if (b) b.style.transform = `translateY(${(-p * p * 2).toFixed(1)}px) scale(${1 + p * 0.04})`;
      },
      burst(ch, c) {
        const g = part(ch, 'glass'), f = part(ch, 'frost'), cr = part(ch, 'cracks'), b = part(ch, 'board'), body = part(ch, 'body');
        [g, f, cr, b].forEach((el) => { if (el) el.style.transform = ''; });
        [g, f, cr].forEach((el) => fade(el, 130));
        if (b) fly(b, [{ transform: 'translateY(0) scale(1)', opacity: 1 }, { transform: 'translateY(-70px) scale(1.25)', opacity: 1, offset: 0.35 }, { transform: 'translateY(-40px) scale(0.2)', opacity: 0 }], 900, 'ease-out');
        if (body) fly(body, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 1, transform: 'translateY(2%)', offset: 0.3 }, { opacity: 0, transform: 'translateY(10%) scale(0.9)' }], 800, 'ease-in');
        const wrap = c.wrap, box = wrap.getBoundingClientRect();
        for (let i = 0; i < 24; i++) {
          const sh = document.createElement('i'); sh.className = 'op-shard';
          const sx = box.width * rnd(0.2, 0.8), sy = box.height * rnd(0.26, 0.58);
          sh.style.left = sx + 'px'; sh.style.top = sy + 'px'; sh.style.width = rnd(14, 34) + 'px'; sh.style.height = rnd(16, 38) + 'px';
          wrap.appendChild(sh);
          const dx = (sx - box.width / 2) * rnd(1.4, 3.2) + rnd(-40, 40), dy = -rnd(60, 240);
          sh.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) rotate(${rnd(-300, 300)}deg)`, opacity: 1, offset: 0.45, easing: 'cubic-bezier(0.4,0,0.9,0.6)' }, { transform: `translate(${dx * 1.3}px, ${dy + 520}px) rotate(${rnd(-540, 540)}deg)`, opacity: 0 }], { duration: rnd(900, 1300), fill: 'forwards', easing: 'cubic-bezier(0.2,0.7,0.4,1)' }).onfinish = () => sh.remove();
        }
        const rc = c.rect;
        fx().shards(rc.x, rc.y - 20, '#dff7ff', 30, 1.3, { shape: 'tri', size: 5, spread: 9, life: 0.7, g: 1300 });
        fx().ring(rc.x, rc.y - 10, '#bfe9ff', 190, 0.7, 6);
        c.explode('#4aa8ff', '#ffffff', 1.0);
        BR.audio.glassBreak();
      },
    },
    fuse: {
      init() { },
      hold(ch, p, t, ctx) {
        const nd = part(ch, 'needle'); if (nd) nd.style.transform = `rotate(${(-120 + p * 240 + Math.sin(t * 30) * p * 5).toFixed(1)}deg)`;
        const lid = part(ch, 'lid'); if (lid) lid.style.transform = `translate(${(Math.sin(t * 62) * p * p * 1.4).toFixed(2)}px, ${(-p * p * 5).toFixed(1)}px)`;
        const body = part(ch, 'body'); if (body) body.style.transform = `scale(${1 + p * p * 0.025}, ${1 - p * p * 0.02})`;
        // steam from the side vents, faster as the pressure rises
        if (p > 0.15 && Math.random() < p * 0.4) ctx.steam(Math.random() < 0.5 ? 0.2 : 0.8, 0.66, 0.4 + p);
      },
      burst(ch, c) {
        const nd = part(ch, 'needle'); if (nd) { nd.style.transform = 'rotate(128deg)'; }
        const lid = part(ch, 'lid'), body = part(ch, 'body');
        if (lid) { lid.style.transform = ''; fly(lid, [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-340px) rotate(360deg)', opacity: 1, offset: 0.45, easing: 'cubic-bezier(0.2,0.8,0.4,1)' }, { transform: 'translateY(220px) rotate(780deg)', opacity: 0 }], 1300, 'linear'); }
        if (body) { body.style.transform = ''; fly(body, [{ transform: 'scale(1,1)', opacity: 1 }, { transform: 'scale(1.1, 0.92)', opacity: 1, offset: 0.2 }, { transform: 'scale(0.7, 0.2) translateY(30%)', opacity: 0 }], 700, 'ease-in'); }
        if (nd) fade(nd, 400, 150);
        for (let i = 0; i < 10; i++) setTimeout(() => c.steam(rnd(0.25, 0.75), 0.4, 1.6), i * 40);
        c.explode('#ffb02e', '#ffe58a', 1.2);
        BR.audio.steam(); BR.audio.boom();
      },
    },
    golden: {
      init() { },
      hold(ch, p, t) {
        const lid = part(ch, 'lid'); if (lid) lid.style.transform = `translate(${(Math.sin(t * 53) * p * p * 1.2).toFixed(2)}px, ${(-p * p * 10).toFixed(1)}px) rotate(${(Math.sin(t * 50) * p * 0.9).toFixed(2)}deg)`;
        const g = part(ch, 'glints'); if (g) g.style.transform = `scale(${1 + p * 0.25})`;
      },
      burst(ch, c) {
        const lid = part(ch, 'lid'), body = part(ch, 'body'), leak = part(ch, 'leak');
        if (lid) { lid.style.transform = ''; fly(lid, [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-280px) rotate(-30deg)', opacity: 1, offset: 0.5 }, { transform: 'translateY(300px) rotate(-70deg)', opacity: 0 }], 1300); }
        if (body) fly(body, [{ opacity: 1, filter: 'brightness(1)' }, { opacity: 1, filter: 'brightness(2.4)', offset: 0.25 }, { opacity: 0, filter: 'brightness(4)' }], 760, 'ease-out');
        fade(leak, 300);
        c.explode('#ffd24a', '#ffffff', 1.5);
        fx().confetti(['#ffd24a', '#fff0a8', '#ffb21e', '#ffffff'], 90, -20);
        const rc = c.rect;
        for (let i = 0; i < 14; i++) setTimeout(() => { BR.audio.coin(i); fx().sparks(rc.x + rnd(-60, 60), rc.y - rnd(0, 120), '#ffe58a', 8, 1.2, 0.8); }, i * 50);
        BR.audio.bang();
      },
    },
  };

  /* ===================================================================== the opening */
  class Opening {
    constructor(chestId) {
      this.id = chestId;
      this.chest = BR.CHESTS[chestId];
      this.type = this.chest.type;
      this.golden = !!this.chest.golden;
      this.state = 'boot';
      this.hold = 0; this.pressed = false;
      this.demo = null; this.reel = null; this.drop = null;
      this.count = 0;
      this.closed = false;
      this.done = new Promise((r) => { this._resolve = r; });
    }

    /* ---------- build ---------- */
    mount() {
      const c = this.chest, id = this.id;
      const root = BR.el(`<div class="opening" data-chest="${id}">
        <div class="op-bg"><i class="op-glow"></i><i class="op-rays"></i><i class="op-dust"></i><i class="op-vig"></i></div>
        <header class="op-top">
          <button class="icon-btn" data-act="close" aria-label="Close">${BR.icon('close')}</button>
          <div class="op-title"><b>${c.name}</b><span>${c.blurb}</span></div>
          <span class="pill gold">${BR.coin()}<b class="num" data-coins>${BR.fmt(P().coins)}</b></span>
        </header>
        <div class="op-stage">
          <div class="op-chest-wrap">
            <i class="op-pedestal"></i>
            <div class="op-shake"><div class="op-chest" data-chestbox>${BR.chestSVG(id)}</div></div>
            <div class="op-steam"></div>
          </div>
        </div>
        <div class="op-reel"><div class="op-reel-caption">Opening<small>${c.name}</small></div><div class="op-reel-frame"><div class="reel-host"></div></div></div>
        ${this.golden ? `<div class="op-picker" role="radiogroup" aria-label="Pick a type">${TYPES.map(([t, n]) => `<button data-type="${t}" role="radio" aria-checked="false">${n}</button>`).join('')}</div>` : ''}
        <div class="op-odds">${BR.oddsHTML(id, this.type || 'skin', { compact: true })}<button class="op-see" data-act="odds">See everything inside ${BR.icon('arrow')}</button></div>
        <footer class="op-foot">
          <div class="hold off" data-hold role="button" aria-label="Hold to open the chest">
            <svg class="ring" viewBox="0 0 112 112" aria-hidden="true"><defs><linearGradient id="holdGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${c.accent}"/></linearGradient></defs><circle class="ring-bg" cx="56" cy="56" r="50"/><circle class="ring-fg" cx="56" cy="56" r="50"/></svg>
            <div class="hold-disc"><svg viewBox="0 0 24 24"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.2a5 5 0 0 1-4.2-2.3L4.6 15a1.5 1.5 0 0 1 2.4-1.8L9 15.5"/></svg></div>
          </div>
          <div class="hold-label" data-label>Hold to open</div>
          <div class="hold-sub" data-sub></div>
        </footer>
        <div class="op-skip" data-skip>Tap to skip</div>
        <div class="rv" data-rv>
          <div class="rv-bg"></div><i class="rv-rays"></i><i class="rv-spot"></i><i class="rv-flare"></i>
          <i class="rv-ring"></i><i class="rv-ring"></i><i class="rv-ring"></i>
          <div class="rv-banner"></div>
          <div class="rv-stage"><div class="rv-card"></div></div>
          <div class="rv-info"></div>
          <div class="rv-actions"></div>
          <div class="rv-black"></div>
        </div>
      </div>`);
      this.root = root;
      const q = (s) => root.querySelector(s);
      Object.assign(this, {
        chestBox: q('.op-chest'), shake: q('.op-shake'), wrap: q('.op-chest-wrap'), svg: q('.chest'), holdEl: q('[data-hold]'),
        label: q('[data-label]'), sub: q('[data-sub]'), reelWrap: q('.op-reel'), reelHost: q('.reel-host'), skipEl: q('[data-skip]'), rv: q('[data-rv]'),
      });
      document.body.classList.add('in-opening');
      document.getElementById('layer-opening').appendChild(root);
      document.getElementById('layer-opening').style.pointerEvents = 'auto';
      this.backEntry = BR.Back.push((fromBack) => this.requestClose(true));
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('on')));
      this.bind();
    }

    bind() {
      const root = this.root;
      root.addEventListener('click', (e) => {
        const a = e.target.closest('[data-act]');
        if (a) {
          if (a.dataset.act === 'close') { BR.audio.ui(); this.requestClose(false); }
          else if (a.dataset.act === 'odds') { BR.audio.ui(); BR.showOdds(this.id); }
          return;
        }
        const t = e.target.closest('[data-type]');
        if (t && this.state === 'ready') this.pickType(t.dataset.type);
        if (e.target.closest('.op-reel') && this.state === 'spin' && this.reel && this.reel.t > 1.5) { this.reel.skip(); this.skipEl.classList.remove('on'); }
      });
      const start = (e) => { if (e.button != null && e.button > 0) return; this.press(true); try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } };
      const end = () => this.press(false);
      [this.holdEl, this.wrap].forEach((el) => {
        el.addEventListener('pointerdown', start);
        el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
      });
      this.holdEl.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.press(true); } });
      this.holdEl.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') this.press(false); });
      this.holdEl.tabIndex = 0;
    }

    /* ---------- states ---------- */
    async arrive(first) {
      this.state = 'arrive';
      this.hold = 0; this.setHold(0);
      this.root.classList.remove('spinning', 'revealing', 'bursting');
      this.reelWrap.classList.remove('on');
      this.rv.classList.remove('on');
      this.rv.querySelectorAll('.rv-info, .rv-actions').forEach((x) => x.classList.remove('on'));
      this.skipEl.classList.remove('on');
      // fresh chest art every time
      this.chestBox.className = 'op-chest';
      this.chestBox.innerHTML = BR.chestSVG(this.id);
      this.svg = this.chestBox.querySelector('.chest');
      this.ritual = Rituals[this.id];
      this.ritual.init(this.svg);
      this.refreshFoot();
      if (!reduced()) {
        void this.chestBox.offsetWidth;
        this.chestBox.classList.add('drop');
        await sleep(520);
        if (this.closed) return;
        BR.audio.crateDrop(); BR.haptic('boom');
        const r = this.wrap.getBoundingClientRect();
        fx().ring(r.left + r.width / 2, r.bottom - r.height * 0.1, '#ffffff', 140, 0.5, 4);
        fx().sparks(r.left + r.width / 2, r.bottom - r.height * 0.08, '#ffffff', 14, 0.9, 0.5);
        fx().shake(this.root, 7, 300);
        await sleep(480);
      }
      if (this.closed) return;
      this.chestBox.classList.remove('drop');
      this.chestBox.classList.add('idle');
      this.state = 'ready';
      this.refreshFoot();
    }

    refreshFoot() {
      const owned = P().chestCount(this.id), cost = this.chest.cost;
      const coins = P().coins;
      let sub = '', can = true;
      if (this.golden && !this.type) { sub = 'Pick a type first'; can = false; }
      else if (owned > 0) sub = `You have <b>${owned}</b> to open`;
      else if (cost != null) {
        if (coins >= cost) sub = `${BR.coin()}<b>${BR.fmt(cost)}</b> Coins`;
        else { sub = `Need ${BR.coin()}<b>${BR.fmt(cost - coins)}</b> more Coins`; can = false; }
      }
      this.sub.innerHTML = sub;
      this.sub.classList.toggle('warn', !can && !(this.golden && !this.type));
      this.label.textContent = can ? (reduced() ? 'Tap to open' : 'Hold to open') : (this.golden && !this.type ? 'Pick a type' : 'Not enough Coins');
      this.holdEl.classList.toggle('off', !can || this.state !== 'ready');
      this.canOpen = can;
      if (this.golden) this.root.querySelectorAll('.op-picker button').forEach((b) => { const on = b.dataset.type === this.type; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    }

    pickType(t) {
      this.type = t; BR.audio.ui(); BR.haptic('tick');
      this.refreshFoot();
    }

    press(down) {
      if (down) {
        if (this.state !== 'ready' || !this.canOpen) { if (this.state === 'ready' && !this.canOpen) { BR.audio.deny(); BR.haptic('err'); this.holdEl.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 220 }); } return; }
        BR.audio.unlock();
        this.pressed = true; this.state = 'holding'; this.holdEl.classList.add('down'); this.chestBox.classList.remove('idle');
        this.lastT = performance.now(); this.pulse = 0;
        if (reduced()) { this.hold = 1; this.commit(); return; }
        this.raf = requestAnimationFrame((n) => this.holdLoop(n));
      } else {
        this.pressed = false; this.holdEl.classList.remove('down');
      }
    }

    setHold(p) {
      this.root.style.setProperty('--hold', p.toFixed(3));
      this.holdEl.style.setProperty('--hold', p.toFixed(3));
    }

    holdLoop(now) {
      if (this.state !== 'holding') return;
      const dt = clamp((now - this.lastT) / 1000, 0, 0.12); this.lastT = now;
      this.time = (this.time || 0) + dt;
      this.hold = this.pressed ? this.hold + dt / HOLD_TIME : this.hold - dt * 2.4;
      if (!this.pressed && this.hold <= 0) { this.hold = 0; this.state = 'ready'; this.setHold(0); this.shake.style.transform = ''; this.ritual.hold(this.svg, 0, 0, this.ctx()); this.chestBox.classList.add('idle'); return; }
      const p = clamp(this.hold, 0, 1);
      this.setHold(p);
      const a = p * p;
      this.shake.style.transform = `translate(${(Math.sin(this.time * 47) * a * 6 + Math.sin(this.time * 83) * a * 3).toFixed(2)}px, ${(Math.cos(this.time * 41) * a * 4).toFixed(2)}px) rotate(${(Math.sin(this.time * 59) * a * 2.2).toFixed(2)}deg)`;
      this.ritual.hold(this.svg, p, this.time, this.ctx());
      // sound + haptics rise with pressure
      this.pulse -= dt;
      if (this.pulse <= 0 && this.pressed) {
        this.pulse = 0.34 - 0.26 * p;
        BR.audio.holdTick(p);
        BR.haptic(6 + Math.round(p * 20));
        if (p > 0.15) { const r = this.wrap.getBoundingClientRect(); fx().sparks(r.left + r.width / 2 + rnd(-40, 40), r.top + r.height * 0.5, this.chest.accent, 3 + Math.round(p * 5), 0.6 + p, 0.35); }
      }
      if (this.hold >= 1) { this.commit(); return; }
      this.raf = requestAnimationFrame((n) => this.holdLoop(n));
    }

    ctx() {
      const r = this.wrap.getBoundingClientRect();
      const self = this;
      return {
        wrap: this.wrap, rect: { x: r.left + r.width / 2, y: r.top + r.height * 0.5 },
        explode(c1, c2, power) {
          const p = { x: r.left + r.width / 2, y: r.top + r.height * 0.5 };
          fx().explosion(p.x, p.y, c1, power); fx().sparks(p.x, p.y, c2, 36, 2.2, 1);
          fx().flash(c2, 0.26, 360); fx().shake(self.root, 16, 520); BR.haptic('boom');
        },
        steam(fx_, fy, k) {
          const wrap = self.root.querySelector('.op-steam'); const i = document.createElement('i');
          i.style.left = (fx_ * 100) + '%'; i.style.top = (fy * 100) + '%';
          wrap.appendChild(i);
          i.animate([{ transform: 'translate(0,0) scale(0.4)', opacity: 0.8 * k }, { transform: `translate(${rnd(-30, 30) + (fx_ < 0.5 ? -26 : 26)}px, ${-rnd(70, 150)}px) scale(${rnd(1.6, 2.8)})`, opacity: 0 }], { duration: rnd(600, 1000), easing: 'ease-out' }).onfinish = () => i.remove();
        },
      };
    }

    /* ---------- the moment of truth ---------- */
    async commit() {
      if (this.state === 'burst') return;
      this.state = 'burst'; cancelAnimationFrame(this.raf);
      this.pressed = false; this.holdEl.classList.remove('down');
      const drop = P().openChest(this.id, this.type);
      if (!drop) { BR.toast('Could not open that chest', 'bad'); this.state = 'ready'; this.hold = 0; this.setHold(0); this.refreshFoot(); return; }
      drop.inst = P().keep(drop);   // saved immediately: closing the screen can never lose the item
      this.drop = drop; this.count++;
      const newly = P().checkTrophies();
      if (newly.length) setTimeout(() => BR.toast(`Trophy: ${newly[0].name}`, 'good'), 1200);
      this.root.querySelector('[data-coins]').textContent = BR.fmt(P().coins);
      this.holdEl.classList.add('off');
      this.root.classList.add('bursting');
      this.setHold(1);
      const c = this.ctx();
      this.shake.style.transform = '';
      if (reduced()) { this.chestBox.classList.add('gone'); await sleep(250); }
      else {
        this.ritual.burst(this.svg, c);
        const glow = this.svg.querySelector('[data-p="glow"]');
        if (glow) glow.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 1, transform: 'scale(1.7)', offset: 0.4 }, { opacity: 0, transform: 'scale(2.2)' }], { duration: 900, fill: 'forwards' });
        await sleep(800);
        this.chestBox.classList.add('gone');
        await sleep(420);
      }
      if (this.closed) return;
      await this.spin(drop);
    }

    /* ---------- the spin ---------- */
    async spin(drop) {
      this.state = 'spin';
      this.root.classList.remove('bursting'); this.root.classList.add('spinning');
      const type = drop.type;
      const orient = ORIENT[type] || 'h';
      const { cards, target } = BR.buildStrip(BR.makeRng((Date.now() ^ (drop.seed || 0) * 977) >>> 0), this.id, type, drop, 44);
      this.reelWrap.classList.add('on');
      const frame = this.root.querySelector('.op-reel-frame');
      frame.dataset.orient = orient;
      let lastHaptic = 0;
      this.reelHost.className = 'reel-host';
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const reel = new BR.Reel(this.reelHost, {
        orient, cards, target, jitter: rnd(-0.34, 0.34), reduced: reduced(),
        onTick: (spd, idx, skipping) => {
          BR.audio.tick(spd);
          const now = performance.now();
          if (now - lastHaptic > (spd > 0.6 ? 90 : 55)) { lastHaptic = now; BR.haptic(spd < 0.2 ? 14 : 6); }
        },
        onLand: () => this.landed(drop),
      });
      this.reel = reel;
      reel.measure(); reel.park(3);
      BR.audio.whoosh();
      await sleep(reduced() ? 120 : 520);
      if (this.closed) return;
      const dur = reel.start(3);
      setTimeout(() => { if (this.state === 'spin') this.skipEl.classList.add('on'); }, 1500);
      this.spinPromise = new Promise((r) => { this._spinDone = r; });
      await this.spinPromise;
    }

    async landed(drop) {
      this.skipEl.classList.remove('on');
      this.reelHost.classList.add('landed');
      BR.audio.thud(1.2); BR.haptic('big');
      const r = this.reelHost.getBoundingClientRect();
      fx().ring(r.left + r.width / 2, r.top + r.height / 2, BR.rarityById[drop.rarity].color, 160, 0.6, 5);
      await sleep(reduced() ? 250 : 800);
      if (this._spinDone) this._spinDone();
      if (this.closed) return;
      await this.reveal(drop);
    }

    /* ---------- the reveal ---------- */
    async reveal(drop, o = {}) {
      this.state = 'reveal';
      const item = BR.itemById[drop.itemId], R = BR.rarityById[drop.rarity];
      const level = BR.RARITIES.findIndex((r) => r.id === drop.rarity);
      const inst = drop.inst || { shine: drop.shine, seed: drop.seed, counter: drop.counter, uid: null };
      const rv = this.rv;
      rv.style.setProperty('--rc', R.color);
      rv.className = 'rv';
      this.root.classList.remove('spinning'); this.root.classList.add('revealing');
      if (this.demo) this.demo.stop();
      const shineTag = inst.shine && inst.shine !== 'plain' ? `<span class="tag shine-${inst.shine}">${BR.shineById[inst.shine].name}</span>` : '';
      rv.querySelector('.rv-card').innerHTML = `<div class="rv-face"><div class="rv-rar">${R.name}</div><div class="rv-art"></div><div class="rv-name">${item.name}</div><div class="rv-type">${BR.ITEM_TYPES[item.type].name}</div></div>`;
      rv.querySelector('.rv-info').innerHTML = `<div class="rv-tags"><span class="rv-badge">New</span>${shineTag}</div><p class="rv-desc">${item.desc}</p>`;
      this.renderActions(drop, item, inst);
      rv.querySelector('.rv-card').className = 'rv-card';
      rv.querySelector('.rv-info').classList.remove('on');
      rv.querySelector('.rv-actions').classList.remove('on');
      const banner = rv.querySelector('.rv-banner'); banner.className = 'rv-banner'; banner.textContent = level >= 3 ? R.name : '';
      rv.querySelectorAll('.rv-ring').forEach((x) => x.classList.remove('go'));
      rv.querySelector('.rv-flare').classList.remove('go');
      rv.querySelector('.rv-black').classList.remove('go');
      const card = rv.querySelector('.rv-card');
      const art = rv.querySelector('.rv-art');
      const cardCenter = () => { const r = card.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
      const rings = () => rv.querySelectorAll('.rv-ring');
      const lvl = level + 1;
      void rv.offsetWidth;
      rv.classList.add('on');
      this.reelWrap.classList.remove('on');
      const R_ = reduced();
      const startDemo = () => { this.demo = heroDemo(art, item, inst, { power: level >= 3 ? 1.5 : 1 }); };

      if (R_) {
        card.classList.add('in'); BR.audio.reveal(lvl); await sleep(300); startDemo();
      } else if (level === 0) {
        card.classList.add('in'); BR.audio.reveal(1); await sleep(520); startDemo();
      } else if (level === 1) {
        card.classList.add('in'); BR.audio.reveal(2); fx().flash('#43a0ff', 0.35, 420);
        await sleep(420); rings()[0].classList.add('go'); const c = cardCenter(); fx().ring(c.x, c.y, R.color, 180, 0.7, 5); startDemo();
      } else if (level === 2) {
        rv.classList.add('fx-rays'); card.classList.add('in-pop'); BR.audio.reveal(3); fx().flash('#b565ff', 0.45, 480); BR.haptic('big');
        await sleep(380); const c = cardCenter(); fx().explosion(c.x, c.y, R.color, 1.2); rings()[0].classList.add('go'); rings()[1].classList.add('go');
        fx().confetti([R.color, '#ffffff', '#e0c8ff'], 70, -20); fx().shake(this.root, 9, 380); startDemo();
      } else if (level === 3) {
        BR.audio.sting(); BR.haptic('boom');
        rv.querySelector('.rv-black').classList.add('go');
        await sleep(900);
        if (this.closed) return;
        rv.classList.add('fx-rays', 'fx-rays-hot'); rv.querySelector('.rv-flare').classList.add('go'); card.classList.add('in-slow'); banner.classList.add('go');
        BR.audio.reveal(4); fx().flash('#ffb02e', 0.36, 520); fx().shake(this.root, 14, 700);
        rings().forEach((x, i) => setTimeout(() => x.classList.add('go'), i * 260));
        startDemo();
        await sleep(900); const c = cardCenter(); fx().explosion(c.x, c.y, '#ffb02e', 1.6); fx().confetti(['#ffb02e', '#ff4d6d', '#ffe58a', '#ffffff'], 110, -20);
        await sleep(700);
      } else {
        BR.audio.sting(); BR.haptic('boom');
        rv.querySelector('.rv-black').classList.add('go');
        await sleep(780);
        if (this.closed) return;
        rv.classList.add('fx-rays', 'fx-rays-hot', 'fx-spot'); rv.querySelector('.rv-flare').classList.add('go'); card.classList.add('in-slow'); banner.classList.add('go');
        BR.audio.reveal(5); fx().flash(R.color, 0.32, 600); fx().shake(this.root, 18, 900);
        rings().forEach((x, i) => setTimeout(() => x.classList.add('go'), i * 220));
        const c = cardCenter();
        [0, 380, 760, 1140].forEach((d, i) => setTimeout(() => { if (this.closed) return; fx().explosion(c.x + rnd(-90, 90), c.y + rnd(-110, 80), ['#ff4d6d', '#ffe58a', '#43e0ff', '#c08bff'][i], 1.4); BR.audio.launch(); BR.haptic('big'); }, d));
        [0, 700, 1500].forEach((d) => setTimeout(() => { if (!this.closed) fx().confetti(['#ff4d6d', '#ffe58a', '#ffffff', '#43e0ff', '#c08bff'], 80, -20); }, d));
        await sleep(1500); startDemo();
      }
      if (this.closed) return;
      rv.querySelector('.rv-info').classList.add('on');
      await sleep(R_ ? 80 : 320);
      rv.querySelector('.rv-actions').classList.add('on');
      this.state = 'done';
    }

    renderActions(drop, item, inst) {
      const box = this.rv.querySelector('.rv-actions');
      const again = P().canOpen(this.id);
      const equipped = inst.uid && P().isEquipped(inst.uid);
      box.innerHTML = `
        ${inst.uid ? `<button class="btn btn-xl" data-a="equip" ${equipped ? 'disabled' : ''}>${equipped ? 'Equipped' : 'Equip'}</button>` : ''}
        <div class="row">
          <button class="btn btn-dark" data-a="done">${again ? 'Done' : 'Continue'}</button>
          ${again ? '<button class="btn btn-green" data-a="again">Open another</button>' : ''}
        </div>`;
      box.onclick = (e) => {
        const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
        const a = b.dataset.a;
        if (a === 'equip') {
          P().equip(inst.uid, item.type); BR.Skins.apply(); BR.audio.equip(); BR.haptic('win');
          b.textContent = 'Equipped'; b.disabled = true; fx().sparks(b.getBoundingClientRect().left + b.offsetWidth / 2, b.getBoundingClientRect().top, '#ffffff', 16, 1.2, 0.6);
        } else if (a === 'done') { BR.audio.ui(); this.requestClose(false); }
        else if (a === 'again') { BR.audio.ui(); this.again(); }
      };
    }

    async again() {
      if (this.demo) this.demo.stop();
      this.rv.classList.remove('on');
      if (this.golden) { this.type = null; }
      this.root.querySelector('[data-coins]').textContent = BR.fmt(P().coins);
      await sleep(350);
      this.reelHost.className = 'reel-host';
      await this.arrive(false);
    }

    /* ---------- leaving ---------- */
    requestClose(fromBack) {
      if (this.closed) return;
      const keep = () => { if (fromBack) this.backEntry = BR.Back.push(() => this.requestClose(true)); };
      if (this.state === 'burst') { keep(); return; } // half a second; the result is already saved
      if (this.state === 'spin' && this.reel && !this.reel.done) { this.reel.skip(); this.skipEl.classList.remove('on'); keep(); return; }
      this.close(fromBack);
    }
    close(fromBack) {
      if (this.closed) return;
      this.closed = true;
      cancelAnimationFrame(this.raf);
      if (this.reel) this.reel.stop();
      if (this.demo) this.demo.stop();
      if (!fromBack && this.backEntry) BR.Back.release(this.backEntry);
      this.root.classList.remove('on');
      document.body.classList.remove('in-opening');
      setTimeout(() => { this.root.remove(); const l = document.getElementById('layer-opening'); if (!l.children.length) l.style.pointerEvents = 'none'; }, 450);
      if (BR.Music && BR.Music.duck) BR.Music.duck(false);
      BR.Router.rerender();
      this._resolve(this.count);
    }
  }

  /* ===================================================================== public API */
  BR.Openings = {
    current: null,
    /** Open a chest screen. Resolves with how many chests were opened in this visit. */
    async open(chestId) {
      if (this.current && !this.current.closed) return this.current.done;
      const o = new Opening(chestId);
      this.current = o;
      o.mount();
      await sleep(260);
      o.arrive(true);
      return o.done;
    },
    demo: heroDemo,
  };
})();
