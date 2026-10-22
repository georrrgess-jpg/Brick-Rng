/* UI toolkit: icons, helpers, bottom sheets with a back stack, toasts, haptics, count-ups, tab router. */
(function () {
  const BR = (window.BR = window.BR || {});
  const $ = (id) => document.getElementById(id);
  BR.$ = $;
  const NF = typeof Intl !== 'undefined' ? new Intl.NumberFormat('en-US') : null;   // built once: the first toLocaleString call alone cost 75 ms on a slowed phone
  BR.fmt = (n) => (NF ? NF.format(Math.round(n)) : String(Math.round(n)));
  BR.el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  BR.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- icons (24x24, stroke) ---------- */
  const I = {
    play: '<path d="M8 5.5v13l11-6.5z"/>',
    home: '<path d="M4 11.5L12 4.5l8 7"/><path d="M6.2 10v8.8a1 1 0 0 0 1 1h3.3v-5.3h3v5.3h3.3a1 1 0 0 0 1-1V10"/>',
    shop: '<path d="M5 8h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    collection: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    missions: '<path d="M6 21V4"/><path d="M6 5h11l-2.5 4L17 13H6"/>',
    profile: '<circle cx="12" cy="8.5" r="3.7"/><path d="M4.5 20c.8-3.8 3.8-5.8 7.5-5.8s6.7 2 7.5 5.8"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z"/>',
    chest: '<path d="M4 11h16v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/><path d="M4 11V8.5A3.5 3.5 0 0 1 7.5 5h9A3.5 3.5 0 0 1 20 8.5V11"/><path d="M10 11v3h4v-3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.01"/>',
    share: '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v6.5h14V13"/>',
    reroll: '<path d="M20 11a8 8 0 0 0-14-4.5L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14 4.5L20 15"/><path d="M20 20v-5h-5"/>',
    bolt: '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8.5 20.5h7M9.5 17h5"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4.5L17 13H5"/>',
    bomb: '<circle cx="11" cy="14" r="7"/><path d="M16 8.5l2.5-2.5"/><path d="M19 3v2M22 6h-2M20.8 4.2l-1.4 1.4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19l7-7"/>',
    fire: '<path d="M12 2.5c1 3.5 4.5 5 4.5 9.5a4.5 4.5 0 0 1-9 0c0-2 1-3.2 2-4.2 0 2 1 2.7 2 2.7 0-3-.5-5 .5-8z"/>',
    sound: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    swap: '<path d="M7 4L3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M12 9v11M3.5 9h17v-3h-17zM12 6c-1-3-5-3-5 0M12 6c1-3 5-3 5 0"/>',
  };
  BR.icons = I;
  BR.icon = (name, cls) => `<svg viewBox="0 0 24 24" class="ico ${cls || ''}" aria-hidden="true">${I[name] || ''}</svg>`;
  BR.powerIcon = (id) => `<svg viewBox="0 0 24 24" aria-hidden="true">${BR.BOOSTERS[id].icon}</svg>`;

  /** Shared gradients so every coin looks identical. */
  BR.mountSprite = function () {
    if ($('sprite')) return;
    const s = BR.el(`<svg id="sprite" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <linearGradient id="gCoin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0a8"/><stop offset=".5" stop-color="#ffc83d"/><stop offset="1" stop-color="#e08a0a"/></linearGradient>
      <linearGradient id="gCoinIn" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#f2a21a"/><stop offset="1" stop-color="#ffe38a"/></linearGradient>
    </defs></svg>`);
    document.body.appendChild(s);
  };
  BR.coin = (cls) => `<svg viewBox="0 0 24 24" class="coin ${cls || ''}" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="url(#gCoin)" stroke="#a8620a" stroke-width="1.2"/><circle cx="12" cy="12" r="7.4" fill="url(#gCoinIn)" stroke="#c97a10" stroke-width="1"/><path d="M12 7.2l1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z" fill="#fff4c4" stroke="#b86d0c" stroke-width=".6" stroke-linejoin="round"/></svg>`;
  /** Coin counters follow the balance when it changes (once per frame), instead of being rewritten on a timer. */
  let coinRaf = 0;
  BR.refreshCoins = () => {
    if (coinRaf) return;
    coinRaf = requestAnimationFrame(() => { coinRaf = 0; const t = BR.fmt(BR.Progress.coins); document.querySelectorAll('[data-coins]').forEach((n) => { if (n.textContent !== t) n.textContent = t; }); });
  };
  BR.coinPill = (n) => `<span class="pill gold">${BR.coin()}<b class="num" data-coins>${BR.fmt(n)}</b></span>`;

  /* ---------- haptics ---------- */
  const PAT = { tick: 6, tap: 10, pop: 14, big: [18, 24, 30], rush: [24, 30, 24, 30, 60], stage: [20, 40, 20], open: [10, 20, 14, 20, 18, 20, 24], boom: [40, 30, 90], win: [20, 30, 20, 30, 60], err: [30, 50, 30] };
  // iPhone Safari has no navigator.vibrate. Safari 17.4 and later plays a light haptic tick when a switch checkbox is toggled, so a
  // hidden switch stands in: one toggle per tick. (It only fires from a touch handler, which is where taps and pops call it.)
  const IOS = typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const TICKS = { tick: 1, tap: 1, pop: 1, big: 2, rush: 3, stage: 2, open: 3, boom: 2, win: 3, err: 2 };
  let swEl = null;
  const switchTick = (n) => {
    if (!swEl) {
      swEl = document.createElement('label');
      swEl.setAttribute('aria-hidden', 'true');
      swEl.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;overflow:hidden;opacity:0.01;pointer-events:none';
      const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', ''); i.tabIndex = -1;
      swEl.appendChild(i); document.body.appendChild(swEl);
    }
    swEl.click();
    for (let k = 1; k < n; k++) setTimeout(() => swEl.click(), 55 * k);
  };
  BR.haptic = function (kind) {
    const s = BR.Storage && BR.Storage.data.settings;
    if (!s || !s.haptics) return;
    if (!navigator.vibrate) { if (IOS) { try { switchTick(typeof kind === 'string' ? TICKS[kind] || 1 : 1); } catch (e) { /* ignore */ } } return; }
    try { navigator.vibrate(PAT[kind] != null ? PAT[kind] : kind); } catch (e) { /* ignore */ }
  };
  BR.hapticsAvailable = () => !!navigator.vibrate || IOS;

  /* ---------- number count-up ---------- */
  const anims = new WeakMap();
  BR.countTo = function (el, to, dur = 700, from = null, fmt = BR.fmt) {
    if (!el) return;   // the element can be gone when a screen closes mid-count
    const prev = anims.get(el);
    if (prev && prev.raf) cancelAnimationFrame(prev.raf);
    const start = from != null ? from : prev ? prev.value : parseInt(String(el.textContent).replace(/\D/g, ''), 10) || 0;
    if (start === to || BR.reducedMotion) { el.textContent = fmt(to); anims.set(el, { value: to }); return; }
    const t0 = performance.now(), st = { value: start, raf: 0 };
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      st.value = start + (to - start) * e;
      el.textContent = fmt(st.value);
      if (k < 1) st.raf = requestAnimationFrame(tick); else st.value = to;
    };
    st.raf = requestAnimationFrame(tick);
    anims.set(el, st);
  };
  /**
   * Play a CSS animation class again from the start without reading layout: add the class the first time, and after that
   * restart the running animation object. (`classList.remove; void el.offsetWidth; classList.add` forces a layout every time.)
   */
  BR.replay = (el, cls) => {
    if (!el) return;
    if (!el.classList.contains(cls)) { el.classList.add(cls); return; }
    const list = el.getAnimations ? el.getAnimations().filter((a) => a.animationName) : [];
    if (!list.length) { el.classList.remove(cls); requestAnimationFrame(() => el.classList.add(cls)); return; }
    list.forEach((a) => { a.cancel(); a.play(); });
  };
  BR.bump = (el) => BR.replay(el, 'bump');

  /** Give every .stg child inside root a stagger index (document order). */
  BR.stagger = function (root) { root.querySelectorAll('.stg').forEach((n, i) => n.style.setProperty('--i', i)); };

  /* ---------- back stack: Android back / Escape closes the top overlay ---------- */
  const back = { stack: [], ignore: 0 };
  BR.Back = {
    push(close) {
      const entry = { close };
      back.stack.push(entry);
      try { history.pushState({ pr: back.stack.length }, ''); } catch (e) { entry.noHist = true; }
      return entry;
    },
    /** Remove an entry that closed through the UI (not via back). */
    release(entry) {
      const i = back.stack.indexOf(entry);
      if (i < 0) return;
      back.stack.splice(i, 1);
      if (!entry.noHist) { back.ignore++; try { history.back(); } catch (e) { back.ignore--; } }
    },
    /** Close the top entry. Returns true if something closed. */
    closeTop() { const e = back.stack.pop(); if (!e) return false; e.close(true); if (!e.noHist) { back.ignore++; try { history.back(); } catch (x) { back.ignore--; } } return true; },
    get depth() { return back.stack.length; },
  };
  window.addEventListener('popstate', () => {
    if (back.ignore > 0) { back.ignore--; return; }
    const e = back.stack.pop();
    if (e) e.close(true);
  });
  window.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && BR.Back.depth) { ev.preventDefault(); BR.Back.closeTop(); } });

  /** Something opaque or modal sits over the app (a sheet, a chest opening): everything under it holds its animations still. */
  let underN = 0;
  BR.under = (d) => { underN = Math.max(0, underN + d); document.documentElement.classList.toggle('under-overlay', underN > 0); };

  /* ---------- bottom sheets ---------- */
  BR.Sheet = {
    /**
     * open({ title, body, actions:[{label, cls, onClick, close:true}], center, onClose })
     * body is an HTML string or a Node. Returns { el, body, close() }.
     */
    open(o) {
      const layer = $('layer-sheets');
      const back_ = BR.el('<div class="sheet-back"></div>');
      const sheet = BR.el(`<div class="sheet ${o.center ? 'center' : ''} ${o.cls || ''}" role="dialog" aria-modal="true">
        ${o.center ? '' : '<div class="sheet-handle"></div>'}
        ${o.title ? `<div class="sheet-head"><h2>${o.title}</h2><button class="icon-btn" data-close aria-label="Close">${BR.icon('close')}</button></div>` : ''}
        <div class="sheet-body"></div>
        ${o.actions ? '<div class="sheet-actions' + (o.row ? ' row' : '') + '"></div>' : ''}
      </div>`);
      const bodyEl = sheet.querySelector('.sheet-body');
      if (typeof o.body === 'string') bodyEl.innerHTML = o.body; else if (o.body) bodyEl.appendChild(o.body);
      layer.style.pointerEvents = 'auto';
      layer.append(back_, sheet);
      BR.under(1);
      let closed = false;
      const api = { el: sheet, body: bodyEl };
      let entry;
      const close = (fromBack) => {
        if (closed) return; closed = true;
        if (!fromBack && entry) BR.Back.release(entry);
        back_.classList.remove('on'); sheet.classList.remove('on'); BR.under(-1);
        setTimeout(() => { back_.remove(); sheet.remove(); if (!layer.children.length) layer.style.pointerEvents = 'none'; }, 480);
        if (o.onClose) o.onClose();
      };
      api.close = () => close(false);
      entry = BR.Back.push(close);
      if (o.actions) {
        const bar = sheet.querySelector('.sheet-actions');
        o.actions.forEach((a) => {
          const b = BR.el(`<button class="btn ${a.cls || ''}">${a.label}</button>`);
          if (a.disabled) b.disabled = true;
          b.addEventListener('click', () => { if (a.onClick) a.onClick(api, b); if (a.close !== false) api.close(); });
          bar.appendChild(b);
        });
      }
      sheet.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close()));
      back_.addEventListener('click', () => { if (o.dismissable !== false) api.close(); });
      requestAnimationFrame(() => requestAnimationFrame(() => { back_.classList.add('on'); sheet.classList.add('on'); }));
      return api;
    },
  };

  /* ---------- toasts ---------- */
  BR.toast = function (msg, kind = '') {
    // a chest opening owns the screen: toasts wait until it closes instead of covering its title
    if (document.body.classList.contains('in-opening')) { (BR._heldToasts = BR._heldToasts || []).push([msg, kind]); return; }
    const t = BR.el(`<div class="toast ${kind}">${msg}</div>`);
    const box = $('toasts');
    while (box.children.length > 2) box.firstChild.remove();
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2400);
  };

  /* ---------- screens + tab router ---------- */
  const TAB_ORDER = ['shop', 'collection', 'home', 'missions', 'profile'];
  const TAB_ICON = { shop: 'shop', collection: 'collection', home: 'home', missions: 'missions', profile: 'profile' };
  BR.Router = {
    screens: {}, current: null, busy: 0,
    register(id, obj) { this.screens[id] = obj; obj.el = $('s-' + id); },
    mountTabs() {
      document.querySelectorAll('#tabbar .tab').forEach((b) => {
        const svg = b.querySelector('svg');
        svg.innerHTML = I[TAB_ICON[b.dataset.tab]];
        b.addEventListener('click', () => { BR.audio && BR.audio.ui(); BR.haptic('tick'); this.go(b.dataset.tab); });
      });
    },
    setTabs(visible) { $('tabbar').classList.toggle('hidden', !visible); },
    placeIndicator(id) {
      const ind = $('tabInd'), tab = document.querySelector(`#tabbar .tab[data-tab="${id}"]`);
      document.querySelectorAll('#tabbar .tab').forEach((b) => b.classList.toggle('on', b === tab));
      if (!tab) { ind.style.opacity = 0; return; }
      ind.style.opacity = id === 'home' ? 0 : 1;   // the Play disc is its own "you are here"; the line would cut across it
      ind.style.setProperty('--i', TAB_ORDER.indexOf(id));   // placed by CSS from the index: nothing is measured
    },
    go(id, opts = {}) {
      const next = this.screens[id];
      if (!next) return;
      const prev = this.current ? this.screens[this.current] : null;
      if (prev === next) { if (next.onRetap) next.onRetap(); return; }
      const dir = prev && TAB_ORDER.includes(this.current) && TAB_ORDER.includes(id) ? (TAB_ORDER.indexOf(id) > TAB_ORDER.indexOf(this.current) ? 'fwd' : 'back') : 'none';
      if (prev) {
        const el = prev.el;
        const psc = el.querySelector('.scroll'); el._scrolled = !!(psc && psc.scrollTop > 0);   // (layout is clean here, so this read is free)
        el.classList.remove('on', 'from-left', 'from-right');   // the screen being left just goes: animating it out would repaint all of it
        // a tab that is not showing keeps no content (every visit renders it again), so its nodes and memory are freed
        if (prev.render) { clearTimeout(el._purge); el._purge = setTimeout(() => { if (!el.classList.contains('on')) el.textContent = ''; }, 800); }
        if (prev.onHide) prev.onHide();
      }
      // show first (a screen that is not displayed has no layout), then fill it
      const nel = next.el;
      clearTimeout(nel._purge);
      nel.classList.remove('from-left', 'from-right');
      nel.classList.toggle('instant', !!opts.instant);
      if (dir !== 'none' && !opts.instant) nel.classList.add(dir === 'fwd' ? 'from-right' : 'from-left');
      nel.classList.add('on');
      if (next.render) next.render();
      BR.stagger(nel);
      this.current = id;
      this.placeIndicator(TAB_ORDER.includes(id) ? id : null);
      this.setTabs(TAB_ORDER.includes(id));
      document.getElementById('app').classList.toggle('run-active', id === 'run');
      if (next.onShow) next.onShow();
      if (nel._scrolled && !opts.keepScroll) { const sc = nel.querySelector('.scroll'); if (sc) sc.scrollTop = 0; nel._scrolled = false; }   // writing scrollTop forces a layout, so only when it matters
      if (BR.Coach) BR.Coach.onScreen(id);
      if (id !== 'run' && BR.audioUnlocked && BR.Music && BR.Music.start) BR.Music.start('menu');   // (the browser creates the audio context only after the first tap)
    },
    rerender() { const s = this.screens[this.current]; if (s && s.render) { const sc = s.el.querySelector('.scroll'); const top = sc ? sc.scrollTop : 0; s.render(); const sc2 = s.el.querySelector('.scroll'); if (sc2) sc2.scrollTop = top; s.el.querySelectorAll('.stg').forEach((n) => { n.style.animation = 'none'; n.style.opacity = 1; n.style.transform = 'none'; }); } },
  };
})();
