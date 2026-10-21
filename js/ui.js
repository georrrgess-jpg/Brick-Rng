/* HUD + screens + overlays + small DOM effects (floating text, callouts, combo badge). */
(function () {
  const BR = (window.BR = window.BR || {});
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  BR.icon = (core) => `<svg viewBox="0 0 24 24" aria-hidden="true">${core.icon}</svg>`;

  class UI {
    constructor() {
      this.el = {
        screens: { menu: $('menu'), game: $('game'), collection: $('collection') },
        score: $('score'), best: $('best'), menuBest: $('menuBest'),
        fuelStat: $('fuelStat'), fuelVal: $('fuelVal'), fuelBar: $('fuelBar'),
        meter: $('crateMeter'), meterFill: $('meterFill'), meterText: $('meterText'), meterIcon: $('meterIcon'),
        combo: $('combo'), comboX: $('comboX'),
        layer: $('fxlayer'), coreSlot: $('coreSlot'), gravityTag: $('gravityTag'), hint: $('hint'),
        collGrid: $('collGrid'), collProgress: $('collProgress'), collCount: $('collCount'),
        gameCol: $('gameCol'),
      };
      this.shown = { score: 0, fuel: 0 };
      this.numAnim = new WeakMap();
      this.current = null;
      this.comboVisible = false;
      this.hintTimer = 0;
    }

    /* ---------- screens & overlays ---------- */
    showScreen(name) {
      for (const [k, el] of Object.entries(this.el.screens)) el.classList.toggle('active', k === name);
      this.current = name;
    }
    overlay(id, on) {
      const el = $(id);
      el.classList.toggle('show', on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    }

    /* ---------- numbers ---------- */
    countTo(el, to, dur = 600, from = null) {
      const prev = this.numAnim.get(el);
      if (prev) cancelAnimationFrame(prev.raf);
      const start = from != null ? from : prev ? prev.value : parseInt(el.textContent.replace(/\D/g, ''), 10) || 0;
      if (start === to || BR.reducedMotion) { el.textContent = fmt(to); this.numAnim.set(el, { value: to }); return; }
      const t0 = performance.now();
      const state = { value: start, raf: 0 };
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        state.value = start + (to - start) * e;
        el.textContent = fmt(state.value);
        if (k < 1) state.raf = requestAnimationFrame(tick); else state.value = to;
      };
      state.raf = requestAnimationFrame(tick);
      this.numAnim.set(el, state);
    }
    bump(el) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }

    /* ---------- HUD ---------- */
    setScore(v, animate = true) {
      if (animate) { this.countTo(this.el.score, v, 650); this.bump(this.el.score); }
      else { this.el.score.textContent = fmt(v); this.numAnim.set(this.el.score, { value: v }); }
      this.shown.score = v;
    }
    setBest(v) { this.el.best.textContent = fmt(v); this.el.menuBest.textContent = fmt(v); }
    setFuel(v, animate = true) {
      const prev = this.shown.fuel;
      this.el.fuelVal.textContent = v;
      this.el.fuelBar.style.width = Math.max(2, (v / BR.CFG.maxFuel) * 100) + '%';
      this.el.fuelStat.classList.toggle('low', v <= 6);
      this.el.fuelStat.classList.toggle('mid', v > 6 && v <= 12);
      if (animate && v !== prev) this.bump(this.el.fuelVal);
      this.shown.fuel = v;
    }
    setMeter(charge, need, animate = true) {
      const k = Math.max(0, Math.min(1, charge / need));
      if (!animate) { this.el.meterFill.style.transition = 'none'; }
      this.el.meterFill.style.width = (k * 100).toFixed(1) + '%';
      if (!animate) { void this.el.meterFill.offsetWidth; this.el.meterFill.style.transition = ''; }
      const ready = k >= 1;
      this.el.meter.classList.toggle('ready', ready);
      this.el.meterText.textContent = ready ? 'Crate ready!' : `Next crate  ${fmt(charge)} / ${fmt(need)}`;
    }

    setCombo(streak, mult, popped) {
      const c = this.el.combo;
      if (streak >= 2) {
        this.el.comboX.textContent = 'x' + (Number.isInteger(mult) ? mult : mult.toFixed(1));
        c.classList.add('show');
        c.classList.toggle('hot', mult >= 2.5);
        c.classList.toggle('max', mult >= 4);
        if (popped) { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
        this.comboVisible = true;
      } else if (this.comboVisible) {
        c.classList.remove('show', 'hot', 'max', 'pop');
        this.comboVisible = false;
      }
    }

    setCore(engine, flash = false) {
      const slot = this.el.coreSlot;
      const core = engine.core;
      if (!core) {
        slot.className = 'core-slot empty';
        slot.innerHTML = `<div class="core-ico"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></div>
          <div class="core-txt"><div class="core-name">No Core equipped</div><div class="core-desc">Fill the crate meter to pull a Core that rewrites the rules.</div></div>`;
        this.el.gravityTag.classList.remove('show');
        return;
      }
      const r = BR.rarityById[core.rarity];
      slot.className = 'core-slot';
      slot.style.setProperty('--rc', r.color);
      const badge = core.badge ? `<span class="core-badge" id="coreBadge">${core.badge(engine)}</span>` : '';
      slot.innerHTML = `<div class="core-ico">${BR.icon(core)}</div>
        <div class="core-txt"><div class="core-name">${core.name}<span class="core-tag">${r.name}</span>${badge}</div><div class="core-desc">${core.desc}</div></div>`;
      this.el.gravityTag.classList.toggle('show', engine.gravityDir() === 'up');
      if (flash) { slot.classList.remove('flash'); void slot.offsetWidth; slot.classList.add('flash'); }
    }
    refreshCoreBadge(engine) {
      const b = $('coreBadge');
      if (b && engine.core && engine.core.badge) b.textContent = engine.core.badge(engine);
    }

    /* ---------- floating text ---------- */
    _layerPos(el, x, y) { el.style.left = x + 'px'; el.style.top = y + 'px'; }

    floatText(text, x, y, { size = 22, color = '#fff', glow = null, rise = 56, dur = 950, delay = 0 } = {}) {
      const el = document.createElement('div');
      el.className = 'float';
      el.textContent = text;
      el.style.fontSize = size + 'px';
      el.style.color = color;
      if (glow) el.style.setProperty('--fc', glow);
      this._layerPos(el, x, y);
      this.el.layer.appendChild(el);
      const reduced = BR.reducedMotion;
      const a = el.animate([
        { transform: 'translate(-50%,-50%) scale(0.4)', opacity: 0 },
        { transform: 'translate(-50%,-62%) scale(1.18)', opacity: 1, offset: 0.16 },
        { transform: 'translate(-50%,-68%) scale(1)', opacity: 1, offset: 0.4 },
        { transform: `translate(-50%,calc(-50% - ${rise}px)) scale(0.96)`, opacity: 0 },
      ], { duration: reduced ? 600 : dur, delay, easing: 'cubic-bezier(0.2,0.7,0.3,1)', fill: 'both' });
      a.onfinish = () => el.remove();
    }

    callout(text, color = '#ffd66b') {
      const el = document.createElement('div');
      el.className = 'callout';
      el.textContent = text;
      el.style.setProperty('--cc', color);
      this.el.layer.appendChild(el);
      const a = el.animate([
        { transform: 'translate(-50%,-50%) scale(0.3) rotate(-6deg)', opacity: 0 },
        { transform: 'translate(-50%,-50%) scale(1.22) rotate(2deg)', opacity: 1, offset: 0.22 },
        { transform: 'translate(-50%,-56%) scale(1) rotate(0)', opacity: 1, offset: 0.62 },
        { transform: 'translate(-50%,-110%) scale(0.9)', opacity: 0 },
      ], { duration: BR.reducedMotion ? 700 : 1100, easing: 'cubic-bezier(0.2,0.8,0.3,1)', fill: 'both' });
      a.onfinish = () => el.remove();
    }

    /* ---------- hints ---------- */
    showHint(html, ms = 4200) {
      clearTimeout(this.hintTimer);
      this.el.hint.innerHTML = html;
      this.el.hint.classList.add('show');
      if (ms) this.hintTimer = setTimeout(() => this.hideHint(), ms);
    }
    hideHint() { clearTimeout(this.hintTimer); this.el.hint.classList.remove('show'); }

    /* ---------- collection ---------- */
    renderCollection() {
      const store = BR.Storage.data.collection;
      const total = BR.CORES.length;
      const found = BR.CORES.filter((c) => store[c.id]).length;
      this.el.collProgress.textContent = `${found}/${total} found`;
      this.el.collCount.textContent = `${found}/${total}`;
      const order = BR.RARITIES.map((r) => r.id);
      const sorted = BR.CORES.slice().sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity));
      this.el.collGrid.innerHTML = sorted.map((core, i) => {
        const r = BR.rarityById[core.rarity];
        const own = store[core.id];
        return `<div class="ccard ${own ? '' : 'locked'}" style="--rc:${r.color};--i:${i}">
          ${own ? `<span class="cnt">x${own.count}</span>` : ''}
          <div class="core-ico">${own ? BR.icon(core) : '<svg viewBox="0 0 24 24"><path d="M9.5 9a2.7 2.7 0 1 1 3.6 2.5c-.8.4-1.1.9-1.1 1.7M12 17h.01"/></svg>'}</div>
          <h3>${own ? core.name : '???'}</h3>
          <span class="core-tag">${r.name}</span>
          <p>${own ? core.desc : 'Pull this Core from a crate to reveal it.'}</p>
        </div>`;
      }).join('');
    }

    /* ---------- menu decoration ---------- */
    spawnMenuBricks() {
      const host = $('menuBricks');
      host.innerHTML = '';
      for (let i = 0; i < 16; i++) {
        const d = document.createElement('div');
        d.className = 'mb brick';
        d.dataset.c = i % 7;
        d.innerHTML = '<div class="face"><i class="stud"></i></div>';
        const s = 26 + Math.random() * 38;
        d.style.cssText = `left:${Math.random() * 96}%;top:${40 + Math.random() * 55}%;--s:${s}px;font-size:${s}px;--d:${9 + Math.random() * 8}s;--delay:${-Math.random() * 14}s;--r0:${(Math.random() - 0.5) * 50}deg;--r1:${(Math.random() - 0.5) * 140}deg`;
        host.appendChild(d);
      }
    }
  }

  BR.UI = UI;
})();
