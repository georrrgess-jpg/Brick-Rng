/* Help for new players, kept short. Three moments get a card (Welcome, the first chest, the Pop Pass); every other screen
   gets a one-line banner at its top with a close button, so nothing blocks the screen. Each is shown once (remembered in
   Storage.data.seen) and can be brought back from Profile. Cards use the normal centered Sheet, so the Back button and
   tapping outside both close them. Never shown during a run or while a chest is open. */
(function () {
  const BR = (window.BR = window.BR || {});

  const CARDS = {
    home: {
      icon: 'play', title: 'Welcome to Pop Rush',
      lines: [
        ['star', 'Tap a group of 2 or more bricks of the same color to pop it.'],
        ['clock', 'Every pop adds time to the fuse. Keep it lit as long as you can.'],
        ['fire', 'Chain big pops to charge Rush Mode, where points count triple.'],
        ['trophy', 'Beat your best score. Every run earns Coins and XP.'],
      ],
      cta: "Let's pop", go: () => (BR.Storage.data.runs === 0 ? BR.App.startRun({ mode: 'rush', boosts: {} }) : null),   // the first run starts from the card (a player who only asked to see the tips again just closes it)
    },
    opening: {
      icon: 'gift', title: 'Opening a chest',
      lines: [
        ['bolt', 'Press and hold the big button to open the chest.'],
        ['arrow', 'The reel spins and lands on your item. Tap it to skip ahead.'],
        ['check', 'Your item is saved the moment the chest bursts open.'],
      ],
      cta: 'Open it', hint: true,   // a line on the opening screen, not a card over the chest and its hold button
    },
    pass: {
      icon: 'flag', title: 'The Pop Pass',
      lines: [
        ['gift', 'It is free. Every level you reach pays the next reward on the track.'],
        ['bolt', 'XP comes from every run, mission and trophy.'],
        ['star', 'The big cards are milestones: chests and exclusive items.'],
      ],
      cta: 'Got it',
    },
  };

  /** One-line tips: [icon, text]. */
  const BANNERS = {
    shop: ['gift', 'Every chest gives one item you do not own yet. The odds are on every card, and Coins come from playing.'],
    collection: ['check', 'Tap an item to see it and equip it. Dark shapes are items you have not found yet.'],
    missions: ['check', 'Three new missions every day, each paying Coins. Swap one you do not like.'],
    profile: ['info', 'Sound, vibration and Reduce Motion live here. Help brings every tip back.'],
  };

  let showing = false;
  const seen = () => { const d = BR.Storage.data; if (!d.seen) d.seen = {}; return d.seen; };

  // every chest opening gets the "keep holding" watcher, whichever file mounts it
  const layer = document.getElementById('layer-opening');
  if (layer && window.MutationObserver) new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => { if (n.classList && n.classList.contains('opening') && BR.Coach) BR.Coach.watchHold(n); }))).observe(layer, { childList: true });

  BR.Coach = {
    CARDS,
    has(id) { return !!seen()[id]; },
    /** The one-line banner for a screen, or '' once the player has closed it. */
    banner(id) {
      const b = BANNERS[id];
      if (!b || seen()['b_' + id]) return '';
      return `<div class="tipbar" data-tip="${id}"><span class="tb-ico">${BR.icon(b[0])}</span><p>${b[1]}</p><button class="tb-x" data-act="close-tip" data-tip="${id}" aria-label="Close this tip">${BR.icon('close')}</button></div>`;
    },
    dismiss(id) { seen()['b_' + id] = true; BR.Storage.save(); },
    /** Show a card once. Returns false if it was already seen or something else is on screen. */
    show(id, o = {}) {
      const c = CARDS[id];
      if (!c || showing) return false;
      if (!o.force && seen()[id]) return false;
      if (BR.Router.current === 'run') return false;
      if (id !== 'opening' && id !== 'boosts' && BR.Openings && BR.Openings.current && !BR.Openings.current.closed) return false;
      if (c.hint) { seen()[id] = true; BR.Storage.save(); return this.hint(id); }
      showing = true;
      seen()[id] = true; BR.Storage.save();
      const body = `<div class="coach-hero"><span class="ch-glow"></span><span class="ch-ico">${BR.icon(c.icon)}</span></div>
        <h2 class="coach-title display">${c.title}</h2>
        <ul class="coach-list">${c.lines.map(([ic, t]) => `<li><span class="cl-ico">${BR.icon(ic)}</span><span>${t}</span></li>`).join('')}</ul>`;
      BR.audio && BR.audio.ui && BR.audio.ui();
      const cta = id === 'home' && BR.Storage.data.runs > 0 ? 'Got it' : c.cta;
      BR.Sheet.open({ center: true, cls: 'coach', body, actions: [{ label: cta, cls: 'btn-xl', onClick: () => { if (c.go) setTimeout(c.go, 60); } }], onClose: () => { showing = false; } });
      return true;
    },
    /** A one-line hint on the chest-opening screen: it sits under the title, never over the chest or the hold button, and goes when the player starts to hold. */
    hint(id, text, ms) {
      const o = BR.Openings && BR.Openings.current, root = o && !o.closed && o.root;
      if (!root) return false;
      const c = CARDS[id];
      const line = text || 'Press and hold the big button until the ring fills.';
      let el = root.querySelector('.coach-hint');
      if (!el) { el = BR.el(`<div class="coach-hint" role="status"><span class="tb-ico">${BR.icon(c ? 'bolt' : 'info')}</span><p></p><button class="tb-x" type="button" aria-label="Close this tip">${BR.icon('close')}</button></div>`); root.appendChild(el); el.querySelector('.tb-x').addEventListener('click', () => this.hideHint(root)); }
      el.querySelector('p').textContent = line;
      clearTimeout(el._rm);   // (a hint asked for while the last one is still fading out stays)
      requestAnimationFrame(() => el.classList.add('on'));
      clearTimeout(el._t); el._t = setTimeout(() => this.hideHint(root), ms || 7000);
      return true;
    },
    hideHint(root) { const el = root && root.querySelector('.coach-hint'); if (el) { clearTimeout(el._t); el.classList.remove('on'); clearTimeout(el._rm); el._rm = setTimeout(() => el.remove(), 320); } },
    /** Watch a chest opening for an early release: a press that lets go before the ring fills gets a line saying to keep holding. */
    watchHold(root) {
      if (root._watched) return; root._watched = true;
      let t0 = 0, down = false;
      root.addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('[data-hold], .op-chest-wrap')) { t0 = performance.now(); down = true; this.hideHint(root); } }, true);
      const up = () => {
        if (!down) return; down = false;
        const dt = performance.now() - t0;
        setTimeout(() => { const o = BR.Openings && BR.Openings.current; if (o && !o.closed && o.root === root && o.state === 'ready' && dt < 900) this.hint(null, 'Keep holding until the ring fills.', 2400); }, 140);
      };
      root.addEventListener('pointerup', up, true); root.addEventListener('pointercancel', up, true);
    },
    /** Called by the router when a tab opens. Waits a beat so the screen has settled. */
    onScreen(id) {
      const key = id === 'missions' ? (BR.Router.screens.missions.tab === 'pass' ? 'pass' : 'missions') : id;
      if (!CARDS[key] || (seen()[key] && !(id === 'home' && !seen().whatsnew5))) return;
      clearTimeout(this._t);
      this._t = setTimeout(() => { if (BR.Router.current !== id) return; if (id === 'home') this.whatsNew(); this.show(key); }, 650);
    },
    /** Players who come from an older version get one "what's new" card (new players get the Welcome card instead). */
    whatsNew() {
      const d = BR.Storage.data, n = d.notice;
      if (seen().whatsnew5 || showing) return;
      if (!(d.runs > 0 || n)) { seen().whatsnew5 = true; seen().whatsnew4 = true; BR.Storage.save(); return; }
      seen().whatsnew5 = true; seen().whatsnew4 = true; seen().home = true; delete d.notice; BR.Storage.save();
      const lines = [
        ['gift', '30 new cosmetics in five sets, made of candlelight, sand and stars.'],
        ['flag', 'Season 4 on the Pop Pass: 30 tiers of chests, items and hats.'],
        ['star', 'Fizz wears hats now. The Party Hat is free: find it in the Collection.'],
        ['bolt', 'Smoother menus and a fairer run.'],
      ];
      if (n && n.kind === 'dupes' && n.coins) lines.splice(3, 0, ['plus', `Your spare duplicates were turned into ${BR.fmt(n.coins)} Coins.`]);
      showing = true;
      const hat = BR.hatArt ? BR.hatArt('h_party', 76) : BR.icon('gift');
      const body = `<div class="coach-hero moon"><span class="ch-glow"></span><span class="ch-ico">${hat}</span></div><h2 class="coach-title display">Moonwick is open</h2><ul class="coach-list">${lines.map(([ic, t]) => `<li><span class="cl-ico">${BR.icon(ic)}</span><span>${t}</span></li>`).join('')}</ul>`;
      BR.Sheet.open({ center: true, cls: 'coach', body, actions: [{ label: 'Let\'s go', cls: 'btn-xl' }, { label: 'See the Collection', cls: 'btn-dark', onClick: () => { BR.Router.go('collection'); } }], onClose: () => { showing = false; } });
    },
    /** Marks every card, banner and run tip as seen (the tests use this so help does not cover what they check). */
    markAllSeen() { const d = seen(); Object.keys(CARDS).forEach((k) => { d[k] = true; }); Object.keys(BANNERS).forEach((k) => { d['b_' + k] = true; }); ['fuse', 'stage', 'rush', 'power'].forEach((k) => { d['rt_' + k] = true; }); d.whatsnew3 = true; d.whatsnew4 = true; d.whatsnew5 = true; },
    /** Profile > Help: every card comes back the next time its screen opens. */
    reset() { BR.Storage.data.seen = { whatsnew3: true, whatsnew4: true, whatsnew5: true }; BR.Storage.save(); },
  };
})();
