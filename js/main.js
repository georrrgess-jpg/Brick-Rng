/* App shell: boot, settings, install prompt, service worker, and the glue between screens, runs and chests. */
(function () {
  const BR = window.BR;
  const $ = BR.$;

  const App = {
    deferredInstall: null,

    init() {
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
      BR.reducedMotion = s.reduced;
      BR.lowEnd = s.perf === 'low' || (s.perf === 'auto' && !!BR.autoLow);
      document.documentElement.classList.toggle('low-end', BR.lowEnd);
      this.fx.settings.shake = s.shake;
      this.fx.settings.reduced = s.reduced;
      this.fx.settings.low = BR.lowEnd;
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

    bindGlobal() {
      // first touch unlocks audio
      // (the browser only lets sound start after a tap, so the menu music starts on the first one)
      ['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { BR.audioUnlocked = true; BR.audio.unlock(); if (BR.Router.current !== 'run' && BR.Music) BR.Music.start('menu'); }, { once: true, passive: true }));
      // prevent pinch / double-tap zoom and context menus on long press
      document.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('gesturestart', (e) => e.preventDefault());
      window.addEventListener('resize', () => { if (BR.Run && BR.Run.view) BR.Run.view.layout(); });
      setInterval(() => document.querySelectorAll('[data-coins]').forEach((n) => { n.textContent = BR.fmt(BR.Progress.coins); }), 1200);
    },

    /* ---------- entry points the screens call ---------- */
    startRun(opts) { return BR.Run.start(opts); },
    resume() { return BR.Run.resume(); },
    openChest(id) { return BR.Openings.open(id); },
  };

  BR.App = App;
  const boot = () => { App.init(); window.__app = App; };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot); else boot();
})();
