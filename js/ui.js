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
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14 7l3 3"/>',
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
  /** Coin counters follow the balance when it changes (once per frame), instead of being rewritten on a timer.
      The top bar's pill counts up (or down) to the new balance with a small bump; the others just show it. */
  let coinRaf = 0;
  /** U-9: on a 320-wide phone the status bar's pill shows big balances short (12.3k), so the screen title keeps its room. */
  BR.fmtBar = (v) => (innerWidth < 340 && v >= 1e4 ? (v >= 1e6 ? (v / 1e6).toFixed(v < 1e7 ? 1 : 0) + 'M' : (v / 1e3).toFixed(v < 1e5 ? 1 : 0) + 'k') : BR.fmt(v));
  BR.refreshCoins = () => {
    if (coinRaf) return;
    coinRaf = requestAnimationFrame(() => {
      coinRaf = 0;
      const bal = BR.Progress.coins;
      document.querySelectorAll('[data-coins]').forEach((n) => {
        const bar = n.closest('#topbar'), t = bar ? BR.fmtBar(bal) : BR.fmt(bal);
        if (bar && BR.Chrome) BR.Chrome.coins = bal;
        if (n.textContent === t) return;
        if (bar && t === BR.fmt(bal) && !bar.classList.contains('hidden') && !BR.reducedMotion && BR.Router.current !== 'run') { BR.countTo(n, bal, 600); BR.bump(n.closest('.pill')); }
        else { n.textContent = t; if (bar) BR.bump(n.closest('.pill')); }
      });
      if (BR.Chrome) BR.Chrome.refresh();
    });
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
   * Play a CSS animation class again from the start without reading layout or style: add the class the first time; after
   * that take it off and put it back two frames later, so one style pass runs without it. (`void el.offsetWidth` forces a
   * layout and `getAnimations()` forces a style pass, each on every pop, which is what made popping stutter on phones.)
   */
  const replaying = new WeakMap();
  BR.replay = (el, cls) => {
    if (!el) return;
    let wait = replaying.get(el);
    if (wait && wait.has(cls)) return;                     // a restart is already on its way
    if (!el.classList.contains(cls)) { el.classList.add(cls); return; }
    el.classList.remove(cls);
    if (!wait) replaying.set(el, (wait = new Set()));
    wait.add(cls);
    requestAnimationFrame(() => requestAnimationFrame(() => { wait.delete(cls); el.classList.add(cls); }));
  };
  BR.bump = (el) => BR.replay(el, 'bump');

  /** Give every .stg child inside root a stagger index (document order). */
  BR.stagger = function (root) { root.querySelectorAll('.stg').forEach((n, i) => n.style.setProperty('--i', n.dataset.i != null ? n.dataset.i : i)); };   // (a screen whose columns are not in reading order sets data-i)

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
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const BEHIND = ['screens', 'tabbar', 'layer-overlays', 'layer-opening'];   // everything a sheet covers: not reachable by keyboard or screen reader while it is open
  const openSheets = [];   // top of the stack last: { el, opener, key }
  let sheetSeq = 0;
  /** A selector that finds the same control again after its screen re-rendered (Equip redraws the grid): data attributes first. */
  const keyOf = (el) => {
    if (!el || !el.getAttribute) return '';
    const tag = el.tagName.toLowerCase();
    for (const a of ['data-equip', 'data-equiphat', 'data-uid', 'data-hat', 'data-hatlock', 'data-locked', 'data-tier', 'data-trophy', 'data-chest', 'data-tab', 'data-type', 'data-rar', 'data-act', 'data-boost', 'id']) {
      const v = el.getAttribute(a);
      if (v) return a === 'id' ? '#' + v : `${tag}[${a}="${v}"]` + (a === 'data-chest' && el.dataset.act ? `[data-act="${el.dataset.act}"]` : '');
    }
    return '';
  };
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  // `inert` restyles everything under it (about 1,000 elements, the whole tap frame on a slow phone). Opening: screen readers lose the
  // page at once (aria-hidden, no restyle; Tab is already trapped and the backdrop takes every touch) and inert follows once the sheet
  // has slid in. Closing: both go at once, so focus can return to the opener.
  let behindT = 0;
  const setBehind = (on) => {
    clearTimeout(behindT); behindT = 0;
    const each = (fn) => BEHIND.forEach((id) => { const el = $(id); if (el) fn(el); });
    if (!on) { each((el) => { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }); return; }
    each((el) => el.setAttribute('aria-hidden', 'true'));
    behindT = setTimeout(() => { behindT = 0; if (openSheets.length) each((el) => el.setAttribute('inert', '')); }, 450);
  };
  /** Tab cycles inside the top sheet (the page behind is inert, so the cycle is the only place focus can go). */
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Tab' || !openSheets.length) return;
    const top = openSheets[openSheets.length - 1].el;
    const list = Array.from(top.querySelectorAll(FOCUSABLE)).filter(visible);
    if (!list.length) { ev.preventDefault(); top.focus({ preventScroll: true }); return; }
    const first = list[0], last = list[list.length - 1], a = document.activeElement;
    if (!top.contains(a) || a === top) { ev.preventDefault(); (ev.shiftKey ? last : first).focus({ preventScroll: true }); }
    else if (ev.shiftKey && a === first) { ev.preventDefault(); last.focus({ preventScroll: true }); }
    else if (!ev.shiftKey && a === last) { ev.preventDefault(); first.focus({ preventScroll: true }); }
  }, true);

  // U-5: an on-screen keyboard that covers the page instead of resizing it (iOS): --kb is the covered height, and a sheet lifts above it
  if (window.visualViewport) {
    const vv = window.visualViewport, de = document.documentElement;
    const kb = () => { const h = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)); de.style.setProperty('--kb', h + 'px'); de.classList.toggle('kb', h > 80); };
    vv.addEventListener('resize', kb); vv.addEventListener('scroll', kb);
  }

  BR.Sheet = {
    /**
     * open({ title, body, actions:[{label, cls, onClick, close:true}], center, onClose })
     * body is an HTML string or a Node. Returns { el, body, close() }.
     * A sheet takes keyboard focus, keeps Tab inside itself, makes the page behind it inert and gives focus back when it closes.
     */
    open(o) {
      const layer = $('layer-sheets');
      const back_ = BR.el('<div class="sheet-back"></div>');
      const sid = 'sheet-t' + (++sheetSeq);
      const sheet = BR.el(`<div class="sheet ${o.center ? 'center' : ''} ${o.cls || ''}" role="dialog" aria-modal="true" ${o.title ? `aria-labelledby="${sid}"` : 'aria-label="Dialog"'} tabindex="-1">
        ${o.center ? '' : '<div class="sheet-handle"></div>'}
        ${o.title ? `<div class="sheet-head"><h2 id="${sid}">${o.title}</h2><button class="icon-btn" data-close aria-label="Close" type="button">${BR.icon('close')}</button></div>` : ''}
        <div class="sheet-body"></div>
        ${o.actions ? '<div class="sheet-actions' + (o.row ? ' row' : '') + '"></div>' : ''}
      </div>`);
      const bodyEl = sheet.querySelector('.sheet-body');
      if (typeof o.body === 'string') bodyEl.innerHTML = o.body; else if (o.body) bodyEl.appendChild(o.body);
      const opener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
      const rec = { el: sheet, opener, key: keyOf(opener), screen: BR.Router.current };
      const below = openSheets[openSheets.length - 1];
      if (below) below.el.setAttribute('inert', '');
      openSheets.push(rec);
      layer.style.pointerEvents = 'auto'; layer._open = (layer._open || 0) + 1;
      layer.append(back_, sheet);
      setBehind(true);
      BR.under(1);
      let closed = false;
      const api = { el: sheet, body: bodyEl };
      let entry;
      const close = (fromBack) => {
        if (closed) return; closed = true;
        if (!fromBack && entry) BR.Back.release(entry);
        back_.classList.remove('on'); sheet.classList.remove('on'); BR.under(-1);
        // a closing sheet fades for half a second, but taps go through to what is underneath from the first moment:
        // a quick tap on the board after Resume must never land on the Restart button that is still fading out
        back_.style.pointerEvents = 'none'; sheet.style.pointerEvents = 'none';
        if (--layer._open <= 0) layer.style.pointerEvents = 'none';
        // keyboard: the page behind is reachable again at once, and focus goes back to the control that opened the sheet
        const at = openSheets.indexOf(rec); if (at >= 0) openSheets.splice(at, 1);
        sheet.setAttribute('inert', '');
        const now = openSheets[openSheets.length - 1];
        if (now) now.el.removeAttribute('inert'); else setBehind(false);
        let back2 = rec.opener && rec.opener.isConnected ? rec.opener : null;
        if (!back2 && rec.key) back2 = document.querySelector(rec.key);
        if (back2 && !back2.closest('[inert]') && visible(back2)) { try { back2.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
        setTimeout(() => { back_.remove(); sheet.remove(); if (!layer.children.length) layer.style.pointerEvents = 'none'; }, 480);
        if (o.onClose) o.onClose();
      };
      api.close = () => close(false);
      entry = BR.Back.push(close);
      if (o.actions) {
        const bar = sheet.querySelector('.sheet-actions');
        o.actions.forEach((a) => {
          const b = BR.el(`<button class="btn ${a.cls || ''}" type="button">${a.label}</button>`);
          if (a.disabled) b.disabled = true;
          b.addEventListener('click', () => { if (a.onClick) a.onClick(api, b); if (a.close !== false) api.close(); });
          bar.appendChild(b);
        });
      }
      sheet.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => api.close()));
      back_.addEventListener('click', () => { if (o.dismissable !== false) api.close(); });
      // U-15: a bottom sheet follows a finger dragged down on its handle or its head, and closes past 30% of its height or on a
      // quick flick (otherwise it springs back). The body keeps its own scrolling; the centred dialogs (landscape, wide screens) do not drag.
      if (!o.center && o.dismissable !== false) {
        let pid = null, y0 = 0, dy = 0, hgt = 1, trail = [];
        const down = (ev) => {
          if (pid !== null || closed || ev.button > 0 || ev.target.closest('button, a, input, textarea')) return;
          const r = sheet.getBoundingClientRect(); if (r.bottom < innerHeight - 4) return;   // (a centred dialog)
          pid = ev.pointerId; y0 = ev.clientY; dy = 0; hgt = Math.max(1, r.height); trail = [[performance.now(), 0]];
          try { ev.currentTarget.setPointerCapture(pid); } catch (e) { /* ignore */ }
          sheet.style.transition = 'none';
        };
        const move = (ev) => {
          if (ev.pointerId !== pid) return;
          dy = Math.max(0, ev.clientY - y0); sheet.style.transform = dy ? `translateY(${dy}px)` : '';
          const now = performance.now(); trail.push([now, dy]); while (trail.length > 2 && now - trail[0][0] > 120) trail.shift();
        };
        const up = (ev) => {
          if (ev.pointerId !== pid) return; pid = null;
          const [t1, d1] = trail[0], v = (dy - d1) / Math.max(16, performance.now() - t1);   // px/ms over the last ~120ms: a flick
          sheet.style.transition = ''; sheet.style.transform = '';
          if (ev.type !== 'pointercancel' && (dy > hgt * 0.3 || (v > 0.4 && dy > 24))) api.close();
        };
        sheet.querySelectorAll('.sheet-handle, .sheet-head').forEach((g) => {
          g.style.touchAction = 'none';
          g.addEventListener('pointerdown', down); g.addEventListener('pointermove', move);
          g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
        });
      }
      // where the body scrolls, its edge fades: a cue that there is more (and none where the list ends)
      const edge = () => { const t = bodyEl.scrollTop > 2, b = bodyEl.scrollHeight - bodyEl.clientHeight - bodyEl.scrollTop > 2; const v = (t ? 't' : '') + (b ? 'b' : ''); if (v) bodyEl.dataset.fade = v; else delete bodyEl.dataset.fade; };
      api.edge = edge;
      bodyEl.addEventListener('scroll', edge, { passive: true });
      sheet.addEventListener('click', () => requestAnimationFrame(edge));
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (closed) return;
        back_.classList.add('on'); sheet.classList.add('on'); edge();
        if (!sheet.contains(document.activeElement)) sheet.focus({ preventScroll: true });
      }));
      return api;
    },
  };

  /* ---------- toasts ---------- */
  /** The slot that covers nothing in use: above the tab bar on a tab screen, at the very top over a sheet, a run or the results. */
  const toastSlot = () => {
    const sheets = $('layer-sheets');
    if (BR.Router.current === 'run' || (sheets && sheets._open > 0) || $('layer-overlays').childElementCount || document.body.classList.contains('in-opening')) return 'toastsTop';
    return 'toastsBottom';
  };
  const liveRun = () => BR.Router && BR.Router.current === 'run' && BR.Run && !BR.Run.resultsEl;
  const runHeld = [];
  let runTimer = 0;
  const holdForRun = () => {
    if (runTimer) return;
    const check = () => { if (liveRun()) { runTimer = setTimeout(check, 600); return; } runTimer = 0; setTimeout(() => runHeld.splice(0).forEach(([m, k]) => BR.toast(m, k)), 900); };
    runTimer = setTimeout(check, 600);
  };
  /**
   * One line, two at most per slot. opts.action = { label, onClick } adds a button (an Undo); opts.ms sets how long it stays.
   * Returns { close() }.
   */
  BR.toast = function (msg, kind = '', opts = {}) {
    // a chest opening owns the screen: toasts wait until it closes instead of covering its title
    if (document.body.classList.contains('in-opening')) { (BR._heldToasts = BR._heldToasts || []).push([msg, kind]); return { close() {} }; }
    // U-14: a run in play owns the top of the screen (the score and Pause): a message waits for the results or for the player to leave
    if (!opts.action && liveRun()) { runHeld.push([msg, kind]); holdForRun(); return { close() {} }; }
    const act = opts.action;
    const t = BR.el(`<div class="toast ${kind} ${act ? 'has-act' : ''}"><span class="t-msg">${msg}</span>${act ? `<button class="t-act" type="button">${act.label}</button>` : ''}</div>`);
    const box = $(toastSlot());
    while (box.children.length >= 2) box.firstChild.remove();
    box.appendChild(t);
    const kill = () => { if (t._gone) return; t._gone = true; clearTimeout(t._timer); t.classList.add('out'); setTimeout(() => t.remove(), 320); };
    if (act) t.querySelector('.t-act').addEventListener('click', () => { kill(); act.onClick(); });
    t._timer = setTimeout(kill, opts.ms || (act ? 5000 : 2400));
    return { close: kill };
  };
  /** Menu toasts do not follow the player into a run. */
  BR.clearToasts = () => document.querySelectorAll('#toasts .toast').forEach((t) => t.remove());

  /* ---------- screens + tab router ---------- */
  const TAB_ORDER = ['shop', 'collection', 'home', 'missions', 'profile'];
  const TAB_ICON = { shop: 'shop', collection: 'collection', home: 'home', missions: 'missions', profile: 'profile' };
  const hideScreen = (el) => { el._leaveTok = null; el.classList.remove('leaving'); el.inert = false; };
  /** The screen being left fades out under the new one and is hidden when that fade has really finished on screen (animationend), not
      after a timer: a slow frame (a long render) must never remove it before the new screen has been seen, which was a blank frame. */
  const leaveScreen = (el) => {
    const tok = {}; el._leaveTok = tok;
    el.classList.add('leaving'); el.inert = true;
    const fin = () => { if (el._leaveTok !== tok) return; el.removeEventListener('animationend', onEnd); clearTimeout(el._leave); hideScreen(el); };
    const onEnd = (e) => { if (e.target === el && e.animationName === 'scrOut') fin(); };
    el.addEventListener('animationend', onEnd);
    el._leave = setTimeout(fin, 1600);   // an animation that is paused (a sheet opened on top) or never starts cannot leave a screen stuck
  };
  BR.Router = {
    screens: {}, current: null, busy: 0, _arrive: null,
    register(id, obj) { this.screens[id] = obj; obj.el = $('s-' + id); },
    mountTabs() {
      document.querySelectorAll('#tabbar .tab').forEach((b) => {
        const svg = b.querySelector('svg');
        svg.innerHTML = I[TAB_ICON[b.dataset.tab]];
        b.addEventListener('click', () => { BR.audio && BR.audio.ui(); BR.haptic('tick'); this.go(b.dataset.tab); });
      });
    },
    setTabs(visible) { $('tabbar').classList.toggle('hidden', !visible); $('topbar').classList.toggle('hidden', !visible); },
    placeIndicator(id) {
      const ind = $('tabInd'), tab = document.querySelector(`#tabbar .tab[data-tab="${id}"]`);
      document.querySelectorAll('#tabbar .tab').forEach((b) => { const on = b === tab; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
      if (!tab) { ind.style.opacity = 0; return; }
      ind.style.opacity = id === 'home' ? 0 : 1;   // the Play disc is its own "you are here"; the line would cut across it
      ind.style.setProperty('--i', TAB_ORDER.indexOf(id));   // placed by CSS from the index: nothing is measured
    },
    /** The numbers on the tab bar: chests waiting in the Shop, and new missions. Cheap enough to call after anything changes. */
    refreshBadges() {
      const P = BR.Progress, n = P.openableChests();
      const b = $('badgeShop'), tab = b && b.closest('.tab');
      if (b) {
        const t = n > 9 ? '9+' : n > 0 ? String(n) : '';
        if (b.textContent !== t) { b.textContent = t; b.classList.toggle('show', !!t); if (t) BR.replay(b, 'pop'); }
        if (tab) tab.setAttribute('aria-label', n > 0 ? `Shop, ${n} chest${n > 1 ? 's' : ''} to open` : 'Shop');
      }
      const dot = $('dotMissions');
      if (dot) {
        const m = BR.Missions.ensure(), seen = BR.Storage.data.seen || {};
        const fresh = seen.misDay !== m.day && this.current !== 'missions';
        dot.classList.toggle('show', fresh);
        const mt = dot.closest('.tab'); if (mt) mt.setAttribute('aria-label', fresh ? 'Missions, new missions today' : 'Missions');
      }
    },
    /** Run `fn` once the next visit to screen `id` has rendered (Try it returns to the item sheet it came from). Any other tab visit drops it. */
    onArrive(id, fn) { this._arrive = { id, fn }; },
    go(id, opts = {}) {
      const next = this.screens[id];
      if (!next) return;
      const prev = this.current ? this.screens[this.current] : null;
      if (prev === next) { if (next.onRetap) next.onRetap(); return; }
      const dir = prev && TAB_ORDER.includes(this.current) && TAB_ORDER.includes(id) ? (TAB_ORDER.indexOf(id) > TAB_ORDER.indexOf(this.current) ? 'fwd' : 'back') : 'none';
      // the run screen comes and goes at once (it is heavy and has its own transitions); menus cross-fade
      const quick = !!opts.instant || BR.reducedMotion || id === 'run' || this.current === 'run';
      if (id === 'run') BR.clearToasts();
      if (this._arrive && this._arrive.id !== id && id !== 'run') this._arrive = null;
      if (prev) {
        const el = prev.el;
        const psc = el.querySelector('.scroll'); el._scrolled = !!(psc && psc.scrollTop > 0);   // (layout is clean here, so this read is free)
        el.classList.remove('on', 'from-left', 'from-right');
        clearTimeout(el._leave);
        if (quick || !prev.render || prev.heavy) hideScreen(el);   // (a heavy screen, the Collection with its hundreds of badge parts, is not painted a second time under the fade: it just goes)
        else leaveScreen(el);   // pointer-events are off and the screen is inert while it fades
        // a tab that is not showing keeps no content (every visit renders it again), so its nodes and memory are freed
        if (prev.render) { clearTimeout(el._purge); el._purge = setTimeout(() => { if (!el.classList.contains('on') && !el.classList.contains('leaving')) el.textContent = ''; }, 800); }
        if (prev.onHide) prev.onHide();
      }
      // show first (a screen that is not displayed has no layout), then fill it
      const nel = next.el;
      clearTimeout(nel._purge); clearTimeout(nel._leave); hideScreen(nel);
      nel.classList.remove('from-left', 'from-right');
      nel.classList.toggle('instant', !!opts.instant);
      if (dir !== 'none' && !quick) nel.classList.add(dir === 'fwd' ? 'from-right' : 'from-left');
      nel.classList.add('on');
      this.current = id;
      if (next.render) next.render(true);
      BR.stagger(nel);
      this.placeIndicator(TAB_ORDER.includes(id) ? id : null);
      this.setTabs(TAB_ORDER.includes(id));
      document.getElementById('app').classList.toggle('run-active', id === 'run');
      if (BR.Chrome) BR.Chrome.onGo(id);
      if (next.onShow) next.onShow();
      this.refreshBadges();
      if (nel._scrolled && !opts.keepScroll) { const sc = nel.querySelector('.scroll'); if (sc) sc.scrollTop = 0; nel._scrolled = false; }   // writing scrollTop forces a layout, so only when it matters
      if (BR.Coach) BR.Coach.onScreen(id);
      if (id !== 'run' && BR.audioUnlocked && BR.Music && BR.Music.start) BR.Music.start('menu');   // (the browser creates the audio context only after the first tap)
      if (this._arrive && this._arrive.id === id) { const a = this._arrive; this._arrive = null; a.fn(); }
    },
    rerender() {
      const s = this.screens[this.current];
      if (s && s.render) {
        const sc = s.el.querySelector('.scroll'); const top = sc ? sc.scrollTop : 0;
        s.render(false);
        const sc2 = s.el.querySelector('.scroll'); if (sc2) sc2.scrollTop = top;
        s.el.querySelectorAll('.stg').forEach((n) => { n.style.animation = 'none'; n.style.opacity = 1; n.style.transform = 'none'; });
      }
      if (BR.Chrome) BR.Chrome.refresh();
      this.refreshBadges();
    },
  };
})();
