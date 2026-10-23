/* App shell: boot, settings, install prompt, service worker, and the glue between screens, runs and chests. */
(function () {
  const BR = window.BR;
  const $ = BR.$;

  /** Graphics quality that looks after itself: Auto watches the frame time during runs, steps effects down one level when the
   *  phone struggles (with a short toast), and steps back up if it later runs with room to spare. The result is remembered per
   *  device, apart from the save. Smooth and Pretty in Profile pin it. */
  //  Every judgement is relative to the screen's own refresh interval, read from the fastest frames of each window and snapped to a
  //  real rate (144/120/90/60/30 Hz): a 60 Hz phone can come back up, and a 30 fps cap (iOS Low Power Mode) is "on budget", never
  //  "slow". A hidden tab, a pause or any stall over 250 ms starts the window again. Down after one slow 3-second window; back up
  //  after 7 good windows in a row (about 20 s), and twice as long each time it had to come down again within a minute of going up.
  const RATES = [1 / 144, 1 / 120, 1 / 90, 1 / 60, 1 / 30];
  BR.Gfx = {
    KEY: 'poprush.gfx', st: { low: false, flips: 0, upNeed: 7 }, buf: [], good: 0, refresh: 1 / 60, lastUp: -1e9, WINDOW: 180,
    load() { try { const o = JSON.parse(localStorage.getItem(this.KEY)); if (o && typeof o === 'object') this.st = Object.assign(this.st, o); } catch (e) { /* ignore */ } BR.autoLow = !!this.st.low; },
    save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.st)); } catch (e) { /* ignore */ } },
    /** One run frame on Auto: dt = raw seconds since the previous frame. */
    frame(dt) {
      if (!(dt > 0)) return;
      if (dt > 0.25 || document.hidden) { this.buf.length = 0; return; }
      this.buf.push(dt);
      if (this.buf.length >= this.WINDOW) { const b = this.buf; this.buf = []; this.window(b); }
    },
    reset() { this.buf.length = 0; },
    /** A full window of frame times: the refresh interval from its fastest tenth, then the average against it. */
    window(b) {
      const s = b.slice().sort((x, y) => x - y), p10 = s[Math.floor(s.length * 0.1)];
      let r = RATES[0]; for (const x of RATES) if (Math.abs(x - p10) < Math.abs(r - p10)) r = x;
      this.refresh = r;
      this.sample(b.reduce((a, x) => a + x, 0) / b.length, r);
    },
    /** avg = seconds per frame over the last 3 seconds of a run; refresh = the screen's frame interval (default: the last detected). */
    sample(avg, refresh) {
      const r = refresh || this.refresh || 1 / 60, was = !!this.st.low;
      if (r > 0.025) { this.good = 0; return; }                    // a 30 fps cap: on budget, and no reason to step up either
      const slow = avg > Math.max(0.026, r * 1.55), good = avg < r * 1.2, now = (window.performance && performance.now()) || Date.now();
      if (!this.st.upNeed) this.st.upNeed = 7;
      if (!was) {
        if (slow) { this.st.low = true; this.st.flips++; this.good = 0; if (now - this.lastUp < 60000) this.st.upNeed = Math.min(56, this.st.upNeed * 2); }
      } else {
        this.good = good ? this.good + 1 : 0;
        if (this.good >= this.st.upNeed) { this.st.low = false; this.st.flips++; this.good = 0; this.lastUp = now; }
      }
      if (this.st.low === was) return;
      BR.autoLow = this.st.low; this.save(); BR.App.applySettings();
      BR.toast(this.st.low ? 'Effects lowered to keep it smooth' : 'Effects are back to full', this.st.low ? '' : 'good');
    },
  };

  const App = {
    deferredInstall: null,

    init() {
      BR.Gfx.load();
      BR.audio = BR.Audio;
      BR.mountSprite();
      BR.applyPalette();
      BR.Missions.ensure();
      this.fx = BR.fx = new BR.FX($('fx'));
      BR.Router.mountTabs();
      BR.initScreens();
      this.applySettings();
      BR.Skins.apply();
      this.spawnBgBricks();
      this.bindGlobal();
      BR.Router.go('home', { instant: true });
      const cashed = BR.Progress.cashStranded();   // older saves can hold chests of a type that is already complete
      if (cashed) setTimeout(() => BR.toast(`Spare chests became ${BR.fmt(cashed)} Coins`, 'good'), 1800);
      this.registerSW();
      if (BR.Run && BR.Run.init) BR.Run.init(this);
    },

    /* ---------- settings ---------- */
    applySettings() {
      const s = BR.Storage.data.settings;
      BR.audio.setEnabled(s.sound);
      if (BR.audio.setVolume) BR.audio.setVolume(s.sfxVol == null ? 1 : s.sfxVol);
      if (BR.Music) { BR.Music.setEnabled(s.music); if (BR.Music.setVolume) BR.Music.setVolume(s.musicVol == null ? 0.7 : s.musicVol); }
      document.documentElement.classList.toggle('shapes', s.shapes);
      document.documentElement.classList.toggle('reduced', s.reduced);
      document.documentElement.classList.toggle('large-text', !!s.large);
      BR.reducedMotion = s.reduced;
      // Performance mode is Smooth and then some (css/perf.css): no moving backgrounds, sheens, rays or stars, fewer sparks
      const wasPerf = !!BR.perfMode;
      BR.perfMode = !!s.perfMode;
      BR.lowEnd = BR.perfMode || s.perf === 'low' || (s.perf === 'auto' && !!BR.autoLow);
      BR.gfxFull = !BR.lowEnd && s.perf === 'high';
      document.documentElement.classList.toggle('low-end', BR.lowEnd);
      document.documentElement.classList.toggle('perf-mode', BR.perfMode);
      this.fx.settings.shake = s.shake;
      this.fx.settings.perf = BR.perfMode;
      this.fx.settings.reduced = s.reduced;
      const wasLow = this.fx.settings.low;
      this.fx.settings.low = BR.lowEnd;
      if (wasLow !== BR.lowEnd || wasPerf !== BR.perfMode) this.fx.resize();
      if (wasPerf !== BR.perfMode && $('bgBricks') && $('bgBricks').childElementCount !== this.bgCount()) this.spawnBgBricks();
      if (BR.Run && BR.Run.view) { BR.Run.view.reduced = s.reduced; }
    },

    /* ---------- background bricks (wear the equipped Skin) ---------- */
    bgCount() { return BR.perfMode ? 0 : BR.lowEnd ? 8 : 14; },
    spawnBgBricks() {
      const host = $('bgBricks');
      host.setAttribute('data-skin-host', '');
      host.innerHTML = '';
      const n = this.bgCount();
      for (let i = 0; i < n; i++) {
        const d = BR.el(BR.Skins.brickHTML(i % 7, i));
        d.classList.add('mb');
        const s = 24 + Math.random() * 44;
        d.style.cssText = `left:${Math.random() * 100}%;top:${30 + Math.random() * 80}%;--s:${s}px;--d:${10 + Math.random() * 9}s;--delay:${-Math.random() * 16}s;--r0:${(Math.random() - 0.5) * 50}deg;--r1:${(Math.random() - 0.5) * 160}deg`;
        host.appendChild(d);
      }
    },

    /* ---------- install / service worker ---------- */
    canInstall() { return !!this.deferredInstall || (/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone && BR.Storage.data.runs >= 2); },
    async install() {
      if (this.deferredInstall) { this.deferredInstall.prompt(); try { await this.deferredInstall.userChoice; } catch (e) { /* ignore */ } this.deferredInstall = null; BR.Router.rerender(); }
      else BR.Sheet.open({ title: 'Add to Home Screen', body: '<p class="ready-sub">Tap the Share button in Safari, then choose <b>Add to Home Screen</b>. Pop Rush opens full screen and works offline.</p>', actions: [{ label: 'Got it', cls: '' }] });
    },
    registerSW() {
      window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); this.deferredInstall = e; if (BR.Router.current === 'profile') BR.Router.rerender(); });
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
      }
    },

    /** Nothing should leave the player on a stuck screen: an unexpected error closes whatever is open, goes Home and keeps the save. */
    guardErrors() {
      let n = 0, t0 = 0;
      const recover = (what) => {
        console.error('Pop Rush:', what);
        const now = Date.now(); if (now - t0 > 60000) { t0 = now; n = 0; }
        if (++n > 2) return;                                   // two recoveries a minute at most, so a repeating error cannot loop
        try {
          BR.Storage.save();
          for (let i = 0; i < 10 && BR.Back && BR.Back.depth; i++) BR.Back.closeTop();
          if (BR.Openings && BR.Openings.current && !BR.Openings.current.closed) BR.Openings.current.close(true);
          if (BR.Run && BR.Run.resultsEl) BR.Run.closeResults();
          if (BR.Router.current === 'run' && BR.Run && !BR.Run.over && BR.Run.busy) { BR.Run.busy = false; }
          else if (BR.Router.current !== 'run') BR.Router.go('home');
          BR.toast('Something went wrong. Progress is safe.', 'bad');
        } catch (e) { /* the recovery must never throw */ }
      };
      window.addEventListener('error', (e) => { if (e && e.message && /ResizeObserver/.test(e.message)) return; recover(e && e.message); });
      window.addEventListener('unhandledrejection', (e) => recover(e && e.reason && (e.reason.message || e.reason)));
    },

    /** Menus stop animating after 20 seconds without a touch (saves battery); any touch brings them back. */
    watchIdle() {
      let t = 0;
      const wake = () => { clearTimeout(t); document.documentElement.classList.remove('menu-idle'); t = setTimeout(() => { if (BR.Router.current !== 'run') document.documentElement.classList.add('menu-idle'); }, 20000); };
      ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'].forEach((ev) => window.addEventListener(ev, wake, { passive: true, capture: true }));
      wake();
    },

    bindGlobal() {
      this.guardErrors(); this.watchIdle();
      // first touch unlocks audio
      // (the browser only lets sound start after a tap, so the menu music starts on the first one)
      ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { BR.audioUnlocked = true; BR.audio.unlock(); if (BR.Router.current !== 'run' && BR.Music) BR.Music.start('menu'); }, { once: true, passive: true }));
      // prevent pinch / double-tap zoom and context menus on long press
      document.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('gesturestart', (e) => e.preventDefault());
      window.addEventListener('resize', () => { if (BR.Run && BR.Run.view) BR.Run.view.layout(); });
    },

    /* ---------- entry points the screens call ---------- */
    startRun(opts) { return BR.Run.start(opts); },
    resume() { return BR.Run.resume(); },
    openChest(id) { return BR.Openings.open(id); },
  };

  BR.App = App;
  // the splash stays until the fonts are in (so no text jumps when they arrive) or 1.5 seconds have passed
  const reveal = () => requestAnimationFrame(() => requestAnimationFrame(() => { document.body.classList.add('ready'); setTimeout(() => { const sp = document.getElementById('splash'); if (sp) sp.remove(); }, 600); }));
  const boot = () => {
    App.init(); window.__app = App;
    const fonts = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('700 24px Fredoka'), document.fonts.load('700 16px Nunito')]).catch(() => {}) : Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 1500))]).then(reveal);
  };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot); else boot();
})();
