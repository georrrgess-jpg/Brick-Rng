/* App shell: boot, settings, install prompt, service worker, and the glue between screens, runs and chests. */
(function () {
  const BR = window.BR;
  const $ = BR.$;

  /** Graphics quality that looks after itself: Auto watches the frame time during runs, steps effects down one level when the
   *  phone struggles (with a short toast), and steps back up if it later runs with room to spare. The result is remembered per
   *  device, apart from the save. Smooth and Pretty in Profile pin it. */
  BR.Gfx = {
    KEY: 'poprush.gfx', st: { low: false, flips: 0 },
    load() { try { const o = JSON.parse(localStorage.getItem(this.KEY)); if (o && typeof o === 'object') this.st = Object.assign(this.st, o); } catch (e) { /* ignore */ } BR.autoLow = !!this.st.low; },
    save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.st)); } catch (e) { /* ignore */ } },
    /** avg = seconds per frame over the last 3 seconds of a run. */
    sample(avg) {
      const was = !!this.st.low;
      if (!was && avg > 0.026) { this.st.low = true; this.st.flips++; }
      else if (was && avg < 0.0125 && this.st.flips < 3) { this.st.low = false; this.st.flips++; this._upCount = (this._upCount || 0) + 1; }
      if (this.st.low === was) return;
      BR.autoLow = this.st.low; this.save(); BR.App.applySettings();
      BR.toast(this.st.low ? 'Effects lowered to keep the game smooth' : 'Effects are back to full', this.st.low ? '' : 'good');
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
      if (cashed) setTimeout(() => BR.toast(`Your spare chests of a finished set became ${BR.fmt(cashed)} Coins`, 'good'), 1800);
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
      BR.lowEnd = s.perf === 'low' || (s.perf === 'auto' && !!BR.autoLow);
      document.documentElement.classList.toggle('low-end', BR.lowEnd);
      this.fx.settings.shake = s.shake;
      this.fx.settings.reduced = s.reduced;
      const wasLow = this.fx.settings.low;
      this.fx.settings.low = BR.lowEnd;
      if (wasLow !== BR.lowEnd) this.fx.resize();
      if (BR.Run && BR.Run.view) { BR.Run.view.reduced = s.reduced; }
    },

    /* ---------- background bricks (wear the equipped Skin) ---------- */
    spawnBgBricks() {
      const host = $('bgBricks');
      host.setAttribute('data-skin-host', '');
      host.innerHTML = '';
      const n = BR.lowEnd ? 8 : 14;
      for (let i = 0; i < n; i++) {
        const d = BR.el(BR.Skins.brickHTML(i % 7));
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
          while (BR.Back && BR.Back.depth) BR.Back.closeTop();
          if (BR.Openings && BR.Openings.current && !BR.Openings.current.closed) BR.Openings.current.close(true);
          if (BR.Run && BR.Run.resultsEl) BR.Run.closeResults();
          if (BR.Router.current === 'run' && BR.Run && !BR.Run.over && BR.Run.busy) { BR.Run.busy = false; }
          else if (BR.Router.current !== 'run') BR.Router.go('home');
          BR.toast('Something went wrong. Your progress is safe.', 'bad');
        } catch (e) { /* the recovery must never throw */ }
      };
      window.addEventListener('error', (e) => { if (e && e.message && /ResizeObserver/.test(e.message)) return; recover(e && e.message); });
      window.addEventListener('unhandledrejection', (e) => recover(e && e.reason && (e.reason.message || e.reason)));
    },

    bindGlobal() {
      this.guardErrors();
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
