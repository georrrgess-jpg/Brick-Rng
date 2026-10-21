/* HUD, screens, overlays and small DOM effects (floating text, callouts, combo badge, XP bars). */
(function () {
  const BR = (window.BR = window.BR || {});
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  BR.fmt = fmt;

  BR.svgIcon = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;

  class UI {
    constructor() {
      this.el = {
        screens: { menu: $('menu'), game: $('game'), vault: $('vault') },
        score: $('score'), best: $('best'), menuBest: $('menuBest'),
        movesStat: $('movesStat'), movesVal: $('movesVal'), roundLbl: $('roundLbl'),
        goalBar: $('goalBar'), goalFill: $('goalFill'), goalText: $('goalText'),
        chargeFill: $('chargeFill'), slots: $('slots'),
        combo: $('combo'), comboX: $('comboX'),
        layer: $('fxlayer'), hint: $('hint'), aim: $('aimBanner'), wrap: $('boardWrap'),
      };
      this.numAnim = new WeakMap();
      this.current = null;
      this.comboVisible = false;
      this.hintTimer = 0;
      this.buildSlots();
    }

    buildSlots() {
      this.el.slots.innerHTML = BR.BOOSTER_ORDER.map((id) => {
        const b = BR.BOOSTERS[id];
        return `<button class="bslot empty" data-b="${id}" aria-label="${b.name}: ${b.desc}">${BR.svgIcon(b.icon)}<span class="bname">${b.name}</span><em class="bcount">0</em></button>`;
      }).join('');
      this.slotEls = {};
      this.el.slots.querySelectorAll('.bslot').forEach((el) => { this.slotEls[el.dataset.b] = el; });
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
      if (prev && prev.raf) cancelAnimationFrame(prev.raf);
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
    bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

    /* ---------- run HUD ---------- */
    setScore(v, animate = true) {
      if (animate) { this.countTo(this.el.score, v, 650); this.bump(this.el.score); }
      else { this.el.score.textContent = fmt(v); this.numAnim.set(this.el.score, { value: v }); }
    }
    setBest(v) { this.el.best.textContent = fmt(v); this.el.menuBest.textContent = fmt(v); }
    setRound(n) { this.el.roundLbl.textContent = 'Round ' + n; }
    setMoves(n, animate = true) {
      const prev = this.el.movesVal.textContent;
      this.el.movesVal.textContent = n;
      this.el.movesStat.classList.toggle('low', n <= 3 && n > 0);
      if (animate && String(n) !== prev) this.bump(this.el.movesVal);
    }
    setGoal(progress, goal, animate = true) {
      const k = Math.max(0, Math.min(1, progress / goal));
      if (!animate) this.el.goalFill.style.transition = 'none';
      this.el.goalFill.style.width = (k * 100).toFixed(1) + '%';
      if (!animate) { void this.el.goalFill.offsetWidth; this.el.goalFill.style.transition = ''; }
      this.el.goalText.textContent = progress >= goal ? 'Goal reached!' : `${fmt(progress)} / ${fmt(goal)}`;
      this.el.goalBar.classList.toggle('done', progress >= goal);
    }
    setCharge(charge, animate = true) {
      const k = Math.max(0, Math.min(1, charge / BR.CFG.chargeNeeded));
      if (!animate) this.el.chargeFill.style.transition = 'none';
      this.el.chargeFill.style.width = (k * 100).toFixed(1) + '%';
      if (!animate) { void this.el.chargeFill.offsetWidth; this.el.chargeFill.style.transition = ''; }
    }
    renderBoosters(inv, armed, gained) {
      for (const id of BR.BOOSTER_ORDER) {
        const el = this.slotEls[id];
        el.querySelector('.bcount').textContent = inv[id];
        el.classList.toggle('empty', inv[id] <= 0);
        el.classList.toggle('armed', armed === id);
        if (gained && gained.includes(id)) { el.classList.remove('gain'); void el.offsetWidth; el.classList.add('gain'); }
      }
    }
    aimBanner(text, color) {
      this.el.aim.textContent = text || '';
      this.el.aim.style.setProperty('--bc', color || '');
      this.el.aim.classList.toggle('show', !!text);
      this.el.wrap.classList.toggle('aiming', !!text);
      this.el.wrap.style.setProperty('--bc', color || '');
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

    /* ---------- floating text ---------- */
    floatText(text, x, y, { size = 22, color = '#fff', glow = null, rise = 56, dur = 950, delay = 0 } = {}) {
      const el = document.createElement('div');
      el.className = 'float';
      el.textContent = text;
      el.style.fontSize = size + 'px';
      el.style.color = color;
      if (glow) el.style.setProperty('--fc', glow);
      el.style.left = x + 'px'; el.style.top = y + 'px';
      this.el.layer.appendChild(el);
      const a = el.animate([
        { transform: 'translate(-50%,-50%) scale(0.4)', opacity: 0 },
        { transform: 'translate(-50%,-62%) scale(1.18)', opacity: 1, offset: 0.16 },
        { transform: 'translate(-50%,-68%) scale(1)', opacity: 1, offset: 0.4 },
        { transform: `translate(-50%,calc(-50% - ${rise}px)) scale(0.96)`, opacity: 0 },
      ], { duration: BR.reducedMotion ? 600 : dur, delay, easing: 'cubic-bezier(0.2,0.7,0.3,1)', fill: 'both' });
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

    /* ---------- XP + profile ---------- */
    xpBar(fillId, textId, levelId, level, xp, need, animate = true) {
      const fill = $(fillId);
      if (!animate) fill.style.transition = 'none';
      fill.style.width = Math.min(100, (xp / need) * 100).toFixed(1) + '%';
      if (!animate) { void fill.offsetWidth; fill.style.transition = ''; }
      $(textId).textContent = `${fmt(xp)} / ${fmt(need)}`;
      $(levelId).textContent = 'Lv ' + level;
    }

    /** Render XP rows with a staggered reveal and a tick sound per row. */
    renderRows(container, rows, audio) {
      container.innerHTML = rows.map((r, i) => `<div class="rc-row" style="--i:${i}"><span>${r.label}</span><b>+${fmt(r.xp)} XP</b></div>`).join('');
      if (audio && !BR.reducedMotion) rows.forEach((_, i) => setTimeout(() => audio.xpTick(i), 90 + i * 110));
    }

    refreshMenu() {
      const P = BR.Progress;
      const need = P.need, xp = P.xp;
      $('menuLevel').textContent = P.level;
      $('lcTitle').textContent = 'Level ' + P.level;
      const nextSeries = (P.level + 1) % BR.CFG.geodeSeriesEvery === 0;
      $('lcSub').textContent = `${fmt(need - xp)} XP to your next ${nextSeries ? 'Series ' : ''}Geode`;
      $('ringFg').style.strokeDashoffset = (169.65 * (1 - Math.min(1, xp / need))).toFixed(2);
      const n = P.geodeCount();
      $('geodeBadge').textContent = n;
      $('btnGeodes').classList.toggle('has', n > 0);
      const c = P.counts();
      $('vaultCount').textContent = `${c.found}/${c.total}`;
      $('shardCount').textContent = fmt(P.shards);
    }

    /* ---------- menu decoration ---------- */
    spawnMenuBricks() {
      const host = $('menuBricks');
      host.innerHTML = '';
      for (let i = 0; i < 16; i++) {
        const d = document.createElement('div');
        d.className = 'mb brick';
        d.dataset.c = i % 7;
        d.innerHTML = '<div class="face"><i class="stud"></i><b class="deco"></b><b class="sheen"></b></div>';
        const s = 26 + Math.random() * 38;
        d.style.cssText = `left:${Math.random() * 96}%;top:${40 + Math.random() * 55}%;--s:${s}px;font-size:${s}px;--d:${9 + Math.random() * 8}s;--delay:${-Math.random() * 14}s;--r0:${(Math.random() - 0.5) * 50}deg;--r1:${(Math.random() - 0.5) * 140}deg`;
        host.appendChild(d);
      }
    }
  }

  BR.UI = UI;
})();
