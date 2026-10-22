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
      cta: "Let's pop",
    },
    opening: {
      icon: 'gift', title: 'Opening a chest',
      lines: [
        ['bolt', 'Press and hold the big button to open the chest.'],
        ['arrow', 'The reel spins and lands on your item. Tap it to skip ahead.'],
        ['check', 'Your item is saved the moment the chest bursts open.'],
      ],
      cta: 'Open it',
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
      showing = true;
      seen()[id] = true; BR.Storage.save();
      const body = `<div class="coach-hero"><span class="ch-glow"></span><span class="ch-ico">${BR.icon(c.icon)}</span></div>
        <h2 class="coach-title display">${c.title}</h2>
        <ul class="coach-list">${c.lines.map(([ic, t]) => `<li><span class="cl-ico">${BR.icon(ic)}</span><span>${t}</span></li>`).join('')}</ul>`;
      BR.audio && BR.audio.ui && BR.audio.ui();
      BR.Sheet.open({ center: true, cls: 'coach', body, actions: [{ label: c.cta, cls: 'btn-xl' }], onClose: () => { showing = false; } });
      return true;
    },
    /** Called by the router when a tab opens. Waits a beat so the screen has settled. */
    onScreen(id) {
      const key = id === 'missions' ? (BR.Router.screens.missions.tab === 'pass' ? 'pass' : 'missions') : id;
      if (!CARDS[key] || (seen()[key] && !(id === 'home' && !seen().whatsnew4))) return;
      clearTimeout(this._t);
      this._t = setTimeout(() => { if (BR.Router.current !== id) return; if (id === 'home') this.whatsNew(); this.show(key); }, 650);
    },
    /** Players who come from an older version get one "what's new" card (new players get the Welcome card instead). */
    whatsNew() {
      const d = BR.Storage.data, n = d.notice;
      if (seen().whatsnew4 || showing) return;
      if (!(d.runs > 0 || n)) { seen().whatsnew4 = true; BR.Storage.save(); return; }
      seen().whatsnew4 = true; seen().home = true; delete d.notice; BR.Storage.save();
      const lines = [
        ['bolt', 'Menus and runs are much smoother, especially on phones.'],
        ['clock', 'A clearer run screen: the stage, the multiplier and your power-ups are all labelled.'],
        ['gift', 'A daily streak with bigger rewards, and a goal to chase in every run.'],
      ];
      if (n && n.kind === 'dupes' && n.coins) lines.splice(2, 0, ['plus', `Your spare duplicates were turned into ${BR.fmt(n.coins)} Coins.`]);
      showing = true;
      const body = `<div class="coach-hero"><span class="ch-glow"></span><span class="ch-ico">${BR.icon('gift')}</span></div><h2 class="coach-title display">Update 4: Ignite</h2><ul class="coach-list">${lines.map(([ic, t]) => `<li><span class="cl-ico">${BR.icon(ic)}</span><span>${t}</span></li>`).join('')}</ul>`;
      BR.Sheet.open({ center: true, cls: 'coach', body, actions: [{ label: 'Let\'s go', cls: 'btn-xl' }], onClose: () => { showing = false; } });
    },
    /** Marks every card, banner and run tip as seen (the tests use this so help does not cover what they check). */
    markAllSeen() { const d = seen(); Object.keys(CARDS).forEach((k) => { d[k] = true; }); Object.keys(BANNERS).forEach((k) => { d['b_' + k] = true; }); ['fuse', 'stage', 'rush', 'power'].forEach((k) => { d['rt_' + k] = true; }); d.whatsnew3 = true; d.whatsnew4 = true; },
    /** Profile > Help: every card comes back the next time its screen opens. */
    reset() { BR.Storage.data.seen = { whatsnew3: true, whatsnew4: true }; BR.Storage.save(); },
  };
})();
