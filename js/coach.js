/* Coach cards: a short help card the first time the player opens each part of the game. Each one is shown once
   (remembered in Storage.data.seen) and can be brought back from Profile. They use the normal centered Sheet,
   so the Back button and tapping outside both close them. Never shown during a run or while a chest is open. */
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
    boosts: {
      icon: 'bolt', title: 'Boosts cost Coins',
      lines: [
        ['plus', 'A Boost is bought with Coins and lasts for one run.'],
        ['check', 'You see the total and what you will have left before you pay.'],
        ['play', 'Nothing is charged until you press the Start button. Skipping Boosts is always free.'],
      ],
      cta: 'Got it',
    },
    shop: {
      icon: 'shop', title: 'How chests work',
      lines: [
        ['gift', 'Every chest gives one item you do not own yet. No duplicates, ever.'],
        ['info', 'The odds are on every card. Tap the (i) to see everything inside.'],
        ['star', 'About every 8th chest of a type gives an Epic or better.'],
        ['bolt', 'Coins come from playing: points, stages, missions and the Pop Pass.'],
      ],
      cta: 'Got it',
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
    collection: {
      icon: 'collection', title: 'Your collection',
      lines: [
        ['check', 'Tap an item to watch it in action and equip it.'],
        ['lock', 'Dark shapes are items you have not found yet. They tell you which chest has them.'],
        ['star', 'Use the rarity buttons to filter. Finish a set to see Complete in the Shop.'],
      ],
      cta: 'Got it',
    },
    missions: {
      icon: 'missions', title: 'Missions',
      lines: [
        ['check', 'Three new missions every day. Each one pays Coins.'],
        ['reroll', `Not feeling one? Swap it for ${BR.CFG ? BR.CFG.rerollCost : 30} Coins.`],
        ['gift', 'The weekly challenge pays Coins and a Golden Chest.'],
      ],
      cta: 'Got it',
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
    profile: {
      icon: 'profile', title: 'Profile and settings',
      lines: [
        ['sound', 'Set music and sound volume, vibration and screen shake.'],
        ['leaf', 'Reduce Motion makes every animation calmer and shorter.'],
        ['info', 'You can show all of these tips again from the Help card.'],
      ],
      cta: 'Got it',
    },
  };

  let showing = false;
  const seen = () => { const d = BR.Storage.data; if (!d.seen) d.seen = {}; return d.seen; };

  BR.Coach = {
    CARDS,
    has(id) { return !!seen()[id]; },
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
      if (!CARDS[key] || seen()[key]) return;
      clearTimeout(this._t);
      this._t = setTimeout(() => { if (BR.Router.current === id) this.show(key); }, 650);
    },
    /** Profile > Help: every card comes back the next time its screen opens. */
    reset() { BR.Storage.data.seen = {}; BR.Storage.save(); },
  };
})();
