/* The five tab screens (Home, Shop, Collection, Missions, Profile) plus the shared sheets (odds, ready-to-play, item detail,
   settings), and the status bar that stays put above them. Screens re-render from state; events use delegation. */
(function () {
  const BR = (window.BR = window.BR || {});
  const { fmt, esc } = BR;
  const S = () => BR.Storage.data;
  const P = BR.Progress;
  const R = (id) => BR.rarityById[id];
  const $ = (id) => document.getElementById(id);
  const FIRST_LOCKED = 0;    // small "not found yet" tiles built up front
  const FIRST_CARDS = 4;     // cards the Collection grid builds before its first frame; the rest fill in afterwards
  const LITE = { lite: true };   // static chest art for lists: one flat SVG instead of a stack of layers
  const ringSVG = (frac, size = 44, w = 5) => {
    const r = (size - w) / 2, c = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg" stroke-width="${w}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-width="${w}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - Math.max(0, Math.min(1, frac)))).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  };
  BR.ringSVG = ringSVG;
  const setRing = (svg, frac) => { const fg = svg && svg.querySelector('.ring-fg'); if (fg) fg.style.strokeDashoffset = (parseFloat(fg.getAttribute('stroke-dasharray')) * (1 - Math.max(0, Math.min(1, frac)))).toFixed(1); };
  /** The new content of a region that a segment or filter just changed slides in from the side the thumb is moving to (a fade in Reduce Motion). */
  const swapIn = (el, dir = 0) => {
    if (!el || BR.reducedMotion || !el.animate) return;
    el.animate([{ opacity: 0.2, transform: `translate3d(${dir * 16}px, 0, 0)` }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  };

  /** A region that was redrawn inside a screen that has already arrived: its blocks are simply there (the screen's entrance is not played again). */
  const settle = (root) => root.querySelectorAll('.stg').forEach((n) => { n.style.animation = 'none'; n.style.opacity = 1; n.style.transform = 'none'; });

  /** Fill a list in after the screen's first frames, a few at a time: a long grid or track opens on its first screenful instead of
      building everything in one frame. `fill(el, i)` finishes one placeholder; hydration stops when the list is replaced. */
  function hydrate(root, sel, fill, order) {
    const els = Array.from(root.querySelectorAll(sel));
    const list = order ? order(els) : els;
    let k = 0;
    const step = () => {
      if (k >= list.length || !list[k].isConnected) return;     // a re-render replaced this list: the new one hydrates itself
      const t0 = performance.now();
      do { fill(list[k], k); k++; } while (k < list.length && list[k].isConnected && performance.now() - t0 < 5);
      requestAnimationFrame(step);
    };
    setTimeout(() => requestAnimationFrame(step), 260);
  }

  /* ------------------------------------------------------------------ the status bar */
  /** Level, title, settings and Coins. It sits above the screens and never moves when a tab changes: only the title text and the numbers do. */
  const Chrome = (BR.Chrome = {
    titles: { home: '', shop: 'Shop', collection: 'Collection', missions: 'Missions', profile: 'Profile' },
    init() {
      $('tbGear').innerHTML = BR.icon('gear');
      $('tbCoins').innerHTML = `${BR.coin()}<b class="num" data-coins>${fmt(P.coins)}</b>`;
      this.coins = P.coins;
      this.refresh();
    },
    setTitle(id) {
      const h = $('tbTitle'), t = this.titles[id] || '';
      if (h.textContent !== t) { h.textContent = t; if (t) BR.replay(h, 'swap'); }
      h.setAttribute('aria-label', t || 'Home');   // (Home shows no title, but the page still has a heading)
    },
    /** The Coin pill shows the balance. A change that happens while the bar is on screen counts up (js/ui.js refreshCoins); one made behind
        the player's back (a screen re-rendered after a restore, the first paint) is written straight in. */
    syncCoins() {
      const n = document.querySelector('#tbCoins [data-coins]');
      if (n && this.coins !== P.coins) { this.coins = P.coins; n.textContent = fmt(P.coins); }
    },
    refresh() {
      this.syncCoins();
      const L = $('tbLevel'), lv = P.level, frac = P.xp / P.need;
      if (!L.firstChild) L.innerHTML = `${ringSVG(frac, 40, 4)}<b>${lv}</b>`;
      else { setRing(L.querySelector('svg'), frac); const b = L.querySelector('b'); if (b.textContent !== String(lv)) { b.textContent = lv; BR.bump(L); } }
      const label = `Level ${lv}. Open the Pop Pass`;
      if (L.getAttribute('aria-label') !== label) L.setAttribute('aria-label', label);
    },
    onGo(id) { this.setTitle(id); this.refresh(); },
  });

  /* ------------------------------------------------------------------ shared pieces */
  /** The chest to open first: a Golden Chest, then the others in Shop order. */
  BR.nextChest = () => ['golden'].concat(BR.CHEST_ORDER).find((id) => P.chestCount(id) > 0 && !P.chestStatus(id).complete) || null;

  /** One list of ways to earn Coins, for the Shop and the Coins sheet. Free chests come first: they cost nothing. */
  BR.earnListHTML = () => {
    const n = P.openableChests();
    const rows = [];
    if (n) rows.push(['gift', `<b>${n} free chest${n > 1 ? 's' : ''} waiting.</b> Open ${n > 1 ? 'them' : 'it'} before you spend a Coin.`]);
    rows.push(['play', 'Finish runs: points and every stage you clear'], ['sun', 'Daily Rush adds a bonus, and so does your first run each day'], ['missions', 'Daily and weekly missions'], ['trophy', 'Trophies and the Pop Pass']);
    return `<ul class="earn-list">${rows.map(([ic, t]) => `<li><span>${BR.icon(ic)}</span><p>${t}</p></li>`).join('')}</ul>`;
  };

  /** Tap the Coin pill: what you have, how to earn more, and the next thing in reach (a free chest first). */
  BR.coinSheet = function () {
    const free = BR.nextChest();
    const cheapest = BR.CHEST_ORDER.map((id) => ({ id, c: BR.CHESTS[id], st: P.chestStatus(id) })).filter((x) => !x.st.complete && x.c.cost != null).sort((a, b) => a.c.cost - b.c.cost)[0];
    let next = '';
    if (free) next = `<div class="cs-next free"><span class="rw-ico chest">${BR.chestSVG(free, LITE)}</span><p><b>A ${BR.CHESTS[free].name} is waiting.</b> It is free to open.</p></div>`;
    else if (cheapest) next = P.coins >= cheapest.c.cost
      ? `<div class="cs-next ok"><span class="rw-ico chest">${BR.chestSVG(cheapest.id, LITE)}</span><p><b>You can open a ${cheapest.c.name}</b> for <span class="nw">${BR.coin()} ${cheapest.c.cost}</span>.</p></div>`
      : `<div class="cs-next"><span class="rw-ico chest">${BR.chestSVG(cheapest.id, LITE)}</span><p><b>${fmt(cheapest.c.cost - P.coins)} more Coins</b> opens a ${cheapest.c.name} (<span class="nw">${BR.coin()} ${cheapest.c.cost}</span>).</p></div>`;
    const actions = [];
    if (free) actions.push({ label: `${BR.icon('gift')} Open it`, cls: 'btn-green', onClick: () => BR.App.openChest(free) });
    else if (BR.Router.current !== 'shop') actions.push({ label: 'Go to the Shop', cls: '', onClick: () => BR.Router.go('shop') });   // (on the Shop already, the button would do nothing)
    BR.Sheet.open({
      title: 'Your Coins', cls: 'coins',
      body: `<div class="cs-bal">${BR.coin()}<b class="num">${fmt(P.coins)}</b></div>${next}<h3 class="sec-title">Ways to earn Coins</h3>${BR.earnListHTML()}`,
      actions: actions.length ? actions : null,
    });
  };

  const resetsIn = () => { const n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); const s = Math.max(0, Math.floor((m - n) / 1000)); const h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60); return `${h}h ${String(mi).padStart(2, '0')}m`; };

  /** Reward art/label for the Pass, missions and sheets. */
  function rewardChip(r, big) {
    if (r.kind === 'coins') return `<span class="rw-ico coins">${BR.coin()}</span><span class="rw-txt"><b>${r.amount}</b> Coins</span>`;
    if (r.kind === 'chest') return `<span class="rw-ico chest">${BR.chestSVG(r.chest, LITE)}</span><span class="rw-txt"><b>${BR.CHESTS[r.chest].name}</b></span>`;
    const it = BR.itemById[r.itemId];
    return `<span class="rw-ico item" style="--rc:${R(it.rarity).color}">${BR.Badge.html(it, { shine: r.shine, seed: 7 }, { size: 48, still: true })}</span><span class="rw-txt"><b>${it.name}</b> ${R(it.rarity).name} ${BR.ITEM_TYPES[it.type].name}</span>`;
  }
  /** Big art for a reward (the Pop Pass track and the next-reward spotlight). */
  function rewardArt(r, size) {
    if (r.kind === 'coins') return `<span class="pt-coin" style="--sz:${size}px">${BR.coin()}</span>`;
    if (r.kind === 'chest') return `<span class="pt-chest" style="--sz:${size}px">${BR.chestSVG(r.chest, LITE)}</span>`;
    return BR.Badge.html(BR.itemById[r.itemId], { shine: r.shine, seed: 7 }, { size, still: true });
  }
  BR.rewardChip = rewardChip;

  /* ------------------------------------------------------------------ odds panel (shared) */
  /** The odds panel: plain sentence, one stacked bar, a row per rarity, and the full item list. */
  BR.oddsHTML = function oddsHTML(chestId, type, opts = {}) {
    const chest = BR.CHESTS[chestId];
    const rows = BR.chestOdds(chestId, type, P.ownedIds());
    const live = rows.filter((r) => r.pct > 0);
    const done = rows.filter((r) => r.pct === 0 && r.total > 0);
    const bar = live.map((r) => `<div class="ob-seg" style="--rc:${r.rarity.color};flex:${r.pct}">${r.pct >= 8 ? `<span>${Math.round(r.pct)}%</span>` : ''}</div>`).join('');
    const list = live.map((r) => `<div class="odds-row" style="--rc:${r.rarity.color}">
        <i class="od-chip"></i><div class="od-name"><b>${r.rarity.name}</b><small>${r.missing === 0 ? `You own all ${r.total}` : `${r.missing} of ${r.total} left to find`}</small></div>
        <div class="od-pct"><b>${fmtPct(r.pct)}</b>${oneIn(r)}</div></div>`).join('') + done.map((r) => `<div class="odds-row done" style="--rc:${r.rarity.color}"><i class="od-chip"></i><div class="od-name"><b>${r.rarity.name}</b><small>You own all ${r.total}</small></div><div class="od-pct"><b>${BR.icon('check')}</b></div></div>`).join('');
    const inside = rows.filter((r) => r.total > 0).map((r) => `<div class="inside-grp" style="--rc:${r.rarity.color}"><h4>${r.rarity.name}</h4><div class="inside-items">${r.items.map((x) => `<div class="inside-item ${P.owns(x.id) ? 'own' : ''}">${P.owns(x.id) ? BR.icon('check') : ''}<span>${x.name}</span></div>`).join('')}</div></div>`).join('');
    const chips = opts.compact ? `<div class="odds-chips">${live.map((r) => `<div class="oc" style="--rc:${r.rarity.color}"><b>${fmtPct(r.pct)}</b><span>${r.rarity.name}</span>${oneIn(r, true)}</div>`).join('')}</div>` : '';
    return `<div class="odds ${opts.compact ? 'compact' : ''}">
      <p class="odds-sentence">${BR.oddsSentence(chestId, type, P.ownedIds(), opts.pityIn)}</p>
      <div class="odds-bar" role="img" aria-label="Odds bar">${bar}</div>${chips}
      ${opts.compact ? '' : `<div class="odds-rows">${list}</div>
      <button class="odds-more" data-act="toggle-inside" type="button" aria-expanded="false">See everything inside <i>${BR.icon('arrow')}</i></button>
      <div class="inside">${inside}</div>`}</div>`;
  };
  /** "1 in N" only reads well for rare odds: 60% is not "1 in 2". */
  const oneIn = (r, chip) => (r.pct < 20 && r.oneIn > 1 ? `<small>1 in ${r.oneIn}</small>` : (chip ? '<small>&nbsp;</small>' : ''));
  /** Open or close the full item list and bring it into view, so the tap visibly does something. */
  const toggleInside = (odds) => {
    odds.classList.toggle('open');
    const open = odds.classList.contains('open');
    const btn = odds.querySelector('.odds-more'); if (btn) btn.setAttribute('aria-expanded', open);
    if (open) setTimeout(() => { const el = odds.querySelector('.inside'); if (el) el.scrollIntoView({ block: 'start', behavior: BR.reducedMotion ? 'auto' : 'smooth' }); }, 60);
  };
  const fmtPct = (p) => (p >= 10 ? Math.round(p) : p.toFixed(p < 1 ? 1 : 0)) + '%';

  BR.showOdds = function (chestId) {
    let type = BR.CHESTS[chestId].type;
    const sh = BR.Sheet.open({ title: `${BR.CHESTS[chestId].name} odds`, cls: 'odds-sheet', body: `<div class="chest-mini">${BR.chestSVG(chestId, LITE)}</div>${BR.oddsHTML(chestId, type || 'skin', { pityIn: P.chestStatus(chestId).pityIn })}` });
    sh.el.addEventListener('click', (e) => { if (e.target.closest('[data-act="toggle-inside"]')) { toggleInside(sh.el.querySelector('.odds')); } });
  };

  /* ------------------------------------------------------------------ Home */
  const bombArt = `<svg class="bomb-art" viewBox="0 0 160 160" aria-hidden="true"><defs>
      <radialGradient id="hbBody" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#6a5a8a"/><stop offset=".45" stop-color="#2c2347"/><stop offset="1" stop-color="#0d0919"/></radialGradient>
      <linearGradient id="hbCap" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe58a"/><stop offset="1" stop-color="#c47a10"/></linearGradient></defs>
      <ellipse cx="78" cy="148" rx="46" ry="7" fill="#000" opacity=".35"/>
      <circle cx="78" cy="94" r="50" fill="url(#hbBody)" stroke="#4a3d70" stroke-width="3"/>
      <path d="M44 74a38 38 0 0 1 26-22" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none" opacity=".35"/>
      <rect x="62" y="36" width="32" height="18" rx="5" fill="url(#hbCap)" stroke="#8a560f" stroke-width="2"/>
      <path class="ba-fuse" d="M78 36 C78 22 92 24 94 12 C95 6 102 4 108 6" fill="none" stroke="#8a6a3a" stroke-width="5" stroke-linecap="round"/>
      <g class="ba-spark" transform="translate(108 6)"><circle r="9" fill="#ff9a3d" opacity=".4"/><circle r="5.5" fill="#ffd24a"/><circle r="2.4" fill="#fff"/><path d="M0 -14v6M0 8v6M-14 0h6M8 0h6M-10 -10l4 4M6 6l4 4M10 -10l-4 4M-6 6l-4 4" stroke="#ffd24a" stroke-width="2" stroke-linecap="round"/></g>
      <text x="78" y="106" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="30" fill="#ff5a7a" opacity=".92">POP</text></svg>`;

  /** The Boosts chosen at the last Rush start (ids), remembered so a returning player can start again in one tap. null = never chosen. */
  BR.lastBoosts = () => {
    const ids = S().boostsLast, cfg = BR.CFG.boosts;
    if (!Array.isArray(ids)) return null;
    const list = ids.filter((id) => cfg[id]);
    return { ids: list, cost: list.reduce((a, id) => a + cfg[id].cost, 0), names: list.map((id) => cfg[id].name) };
  };
  const rememberBoosts = (ids) => { S().boostsLast = ids.slice(); BR.Storage.save(); };
  /** Rush from Home. The first runs start at once (Boosts need Coins, and a new player has not played yet). After that the Boosts sheet
      comes first, unless the last start chose none: then Play is one tap and the chip beside it opens the sheet. */
  const playRush = () => {
    const last = BR.lastBoosts();
    if (S().runs < BR.CFG.boostsFromRun || (last && !last.ids.length)) BR.App.startRun({ mode: 'rush', boosts: {} });
    else BR.readySheet('rush');
  };
  /** Start again with the same Boosts, paying for them: one tap, and the chip says exactly what it costs. */
  const repeatBoosts = () => {
    const last = BR.lastBoosts();
    if (!last || !last.ids.length || last.cost > P.coins) { BR.readySheet('rush'); return; }
    if (!P.spend(last.cost)) { BR.readySheet('rush'); return; }
    const chosen = {}; last.ids.forEach((id) => { chosen[id] = true; });
    if (BR.audio.coin) BR.audio.coin(1);
    BR.App.startRun({ mode: 'rush', boosts: chosen });
  };

  const Home = {
    render() {
      const st = S(), today = BR.dayKey();
      const par = (rec) => (rec && rec.length ? Math.round(rec.reduce((a, b) => a + b, 0) / rec.length) : 0);
      const dailyDone = st.daily.day === today;
      const chillOpen = P.level >= BR.CFG.chill.unlockLevel;
      const nextTier = P.level, reward = BR.passReward(nextTier);
      const m = BR.Missions.ensure();
      const resume = BR.Storage.loadRun();
      const owned = P.openableChests();
      const logo = ['P', 'O', 'P'].map((ch, i) => `<div class="brick lb" data-c="${[0, 3, 1][i]}" style="--i:${i}"><div class="face"><i class="stud"></i><b class="deco"></b><b class="sheen"></b><span class="ltr">${ch}</span></div></div>`).join('');
      const sk = BR.Streak.status();
      const dots = Array.from({ length: BR.Streak.LEN }, (_, i) => {
        const day = i + 1, lit = day <= sk.ring, today = sk.playedToday && day === sk.ring;
        const prize = day === 3 ? `<small>${BR.coin()}${BR.CFG.streak.day3}</small>` : day === 7 ? `<small>${BR.icon('gift')}</small>` : '<small>&nbsp;</small>';
        return `<span class="sk-day ${lit ? 'on' : ''} ${today ? 'today' : ''} ${day === 3 || day === 7 ? 'prize' : ''}"><i>${lit ? BR.icon('check') : day}</i>${prize}</span>`;
      }).join('');
      const weekDone = sk.playedToday && sk.ring >= BR.Streak.LEN;
      const skNote = sk.playedToday ? (weekDone ? 'Week complete! A new one starts tomorrow.' : `Day ${sk.ring} done. Come back tomorrow for day ${sk.ring + 1}.`)
        : !sk.alive ? 'Play today to start a new week. The weeks you finished stay.'
        : sk.ring === 0 ? 'Finish a run today to light the first day.'
        : `Finish a run today for day ${sk.ring + 1}${sk.ring + 1 === 3 ? `: ${BR.CFG.streak.day3} Coins` : sk.ring + 1 === 7 ? `: ${BR.CFG.streak.day7Coins} Coins and a Golden Chest` : ''}.`;
      const shieldNote = sk.shield && sk.ring > 0 && sk.alive && !weekDone ? ' One missed day is forgiven.' : '';
      const weeksNote = sk.weeks > 0 ? `<span class="sk-weeks">${BR.icon('trophy')} ${sk.weeks} week${sk.weeks > 1 ? 's' : ''} finished</span>` : '';
      const streakCard = `<article class="card streak-card stg" data-i="5"><div class="pc-head"><span class="pc-title display">Daily streak</span><span class="tag ${sk.playedToday ? '' : 'gold'}">${sk.playedToday ? BR.icon('check') + ' Today done' : 'Play today'}</span></div><div class="sk-row" role="img" aria-label="Streak: ${sk.ring} of 7 days">${dots}</div><p class="sk-note">${skNote}${shieldNote}</p>${weeksNote}</article>`;
      const first = !st.best.rush && !par(st.recent.rush);
      const stats = first
        ? `<span class="hero-first">Your first score is waiting. One run is about two minutes.</span>`
        : `<span><small>Best</small><b class="num">${fmt(st.best.rush)}</b></span><span><small>Stage</small><b class="num">${st.bestStage.rush || '-'}</b></span>${par(st.recent.rush) ? `<span title="Average of your recent runs"><small>Avg</small><b class="num">${fmt(par(st.recent.rush))}</b></span>` : ''}`;
      // the chip under Play: what the last start chose. Boosts spend Coins, so a chip that starts a run says its price.
      const last = BR.lastBoosts(), canBoost = st.runs >= BR.CFG.boostsFromRun;
      let chip = '';
      if (canBoost && last && last.ids.length && last.cost <= P.coins) chip = `<button class="chip-boost spend" data-act="play-last" type="button" aria-label="Start again with ${last.names.join(' and ')} for ${last.cost} Coins"><span class="cb-ico">${BR.icon('bolt')}</span><span class="cb-txt">${last.names.join(' + ')}</span><span class="cb-price">${BR.coin()}${last.cost}</span></button>`;
      else if (canBoost && last && !last.ids.length) chip = `<button class="chip-boost" data-act="open-boosts" type="button" aria-label="Choose Boosts for this run"><span class="cb-ico">${BR.icon('plus')}</span><span class="cb-txt">Add Boosts</span></button>`;
      this.el.innerHTML = `<div class="scroll home"><div class="hcol a">
        <div class="logo stg" data-i="0" aria-label="Pop Rush">
          <div class="logo-pop" data-skin-host>${logo}</div>
          <div class="logo-rush"><span>RUSH</span></div>
          <div class="fuse-line"><i></i><b></b></div>
        </div>
        <article class="hero stg" data-i="2" data-act="play-rush">
          <span class="hero-glow"></span>
          <span class="hero-art">${bombArt}</span>
          <div class="hero-body">
            <span class="tag hot">${BR.icon('fire')} Main mode</span>
            <h2 class="hero-title display">Rush</h2>
            <p class="hero-sub">Pop fast to keep the fuse lit. Chain big pops for Rush Mode.</p>
          </div>
          <div class="hero-stats">${stats}</div>
          <div class="hero-cta"><button class="btn btn-xl hero-play" data-act="play-rush" type="button" aria-label="Play Rush">Play</button>${chip}</div>
        </article>
      </div><div class="hcol b">
        ${resume ? `<button class="resume stg" data-i="1" data-act="resume" type="button"><span class="rs-ico">${BR.icon('bolt')}</span><span class="rs-txt"><b>Resume your run</b><small>Stage ${resume.stage} · ${fmt(resume.score)} points</small></span><span class="rs-go">${BR.icon('arrow')}</span></button>` : ''}
        ${owned ? `<button class="banner stg" data-i="3" data-act="open-chest" type="button"><span class="bn-ico">${BR.icon('gift')}</span><span class="bn-txt"><b>You have ${owned} chest${owned > 1 ? 's' : ''} to open</b><small>Free. Tap to open ${owned > 1 ? 'one' : 'it'}.</small></span><span class="bn-go">${BR.icon('arrow')}</span></button>` : ''}
        <div class="row2 stg" data-i="4">
          <button class="mode-card daily ${dailyDone ? 'done' : ''}" data-act="play-daily" type="button">
            <span class="mc-ico"><span class="cal"><small>${new Date().toLocaleString('en-US', { month: 'short' })}</small><b>${new Date().getDate()}</b></span></span>
            <span class="mc-title display">Daily Rush</span>
            <span class="mc-sub">${dailyDone ? `Done · ${fmt(st.daily.score)}` : par(st.recent.daily) ? `Recent average: ${fmt(par(st.recent.daily))}` : 'Same board for everyone. Bonus Coins.'}</span>
            <span class="tag ${dailyDone ? '' : 'gold'}">${dailyDone ? BR.icon('check') + ' Come back tomorrow' : '+15 Coins'}</span>
          </button>
          <button class="mode-card chill ${chillOpen ? '' : 'locked'}" data-act="play-chill" type="button">
            <span class="mc-ico">${BR.icon('leaf')}</span>
            <span class="mc-title display">Chill</span>
            <span class="mc-sub">20 moves a round. No clock.</span>
            ${chillOpen ? `<span class="tag">${st.best.chill > 0 ? 'Best ' + fmt(st.best.chill) : 'New'}</span>` : `<span class="lock-badge">${BR.icon('lock')} Level ${BR.CFG.chill.unlockLevel}</span>`}
          </button>
        </div>
        ${streakCard}
        <button class="card pass-card stg" data-i="6" data-act="go-pass" type="button">
          <div class="pc-head"><span class="pc-title display">Pop Pass</span><span class="tag">Lv ${P.level}</span></div>
          <div class="pc-body"><div class="pc-reward">${rewardChip(reward)}</div><div class="pc-next"><small>Next: Pass level ${P.level + 1}</small><div class="bar cyan"><i style="width:${(P.xp / P.need) * 100}%"></i></div><small>${fmt(P.need - P.xp)} XP to go</small></div></div>
        </button>
        <button class="card mission-card stg" data-i="7" data-act="go-missions" type="button">
          <div class="pc-head"><span class="pc-title display">Today's missions</span><span class="tag">${m.list.filter((x) => x.done).length}/3 done</span></div>
          ${m.list.map((x) => `<div class="mrow ${x.done ? 'done' : ''}"><span class="mr-text">${x.done ? BR.icon('check') : ''}${esc(x.text)}</span><div class="bar green"><i style="width:${(x.progress / x.target) * 100}%"></i></div></div>`).join('')}
        </button>
      </div></div>`;
      BR.Skins.apply();
    },
  };

  /* ------------------------------------------------------------------ Ready sheet (boosts) */
  const BOOST_ICON = { longFuse: 'clock', headStart: 'bolt', rushStart: 'fire' };
  /**
   * The step before a run. Boosts are a purchase: each card shows its price, the summary shows the total and what
   * you will have left, and the button says how many Coins it takes. Nothing is charged until you press it.
   */
  BR.readySheet = function (mode) {
    const picked = new Set();
    const cfg = BR.CFG.boosts;
    const titles = { rush: ['Before you start', 'Keep the fuse lit. Pop fast. Chain big pops for Rush Mode.'], daily: ['Daily Rush', 'Everyone gets the same board today. One try, bonus Coins. No Boosts, so scores compare fairly.'], chill: ['Chill', '20 moves a round. Reach the goal. No clock, no Boosts.'] };
    const boostHTML = mode !== 'rush' ? '' : `<div class="boosts">
        <div class="bo-head"><h3 class="sec-title">Boosts <small>Pay once, last one run</small></h3><span class="pill gold bal">${BR.coin()}<b class="num" id="boBal">${fmt(P.coins)}</b></span></div>
        ${Object.values(cfg).map((b) => `<button class="boost ${b.cost > P.coins ? 'short' : ''}" data-boost="${b.id}" aria-pressed="false" type="button"><span class="bo-ico">${BR.icon(BOOST_ICON[b.id])}</span><span class="bo-txt"><b>${b.name}</b><small>${b.desc}</small></span><span class="bo-price">${BR.coin()}<b>${b.cost}</b></span><i class="bo-check">${BR.icon('check')}</i></button>`).join('')}
        <div class="bo-sum" id="boSum" hidden></div>
        <p class="tiny">Boosts cost Coins. Skip them and the run is free.</p></div>`;
    const sh = BR.Sheet.open({ title: titles[mode][0], cls: 'ready', body: `<p class="ready-sub">${titles[mode][1]}</p>${boostHTML}` });
    const start = BR.el(`<div class="sheet-actions"><button class="btn btn-xl" id="goBtn" type="button">${BR.icon('play')} <span id="goLabel">Start</span></button></div>`);
    sh.el.appendChild(start);
    const total = () => [...picked].reduce((a, id) => a + cfg[id].cost, 0);
    const refresh = () => {
      const t = total(), sum = sh.el.querySelector('#boSum');
      if (sum) {
        sum.hidden = !picked.size;
        sum.innerHTML = `<div><span>${picked.size} Boost${picked.size > 1 ? 's' : ''}</span><b>${BR.coin()} ${t}</b></div><div><span>You will have</span><b>${BR.coin()} ${fmt(P.coins - t)}</b></div>`;
      }
      sh.el.querySelectorAll('.boost').forEach((b) => { const on = picked.has(b.dataset.boost); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.classList.toggle('short', !on && cfg[b.dataset.boost].cost + t > P.coins); });
      const go = sh.el.querySelector('#goBtn'); go.classList.toggle('pay', t > 0);
      sh.el.querySelector('#goLabel').innerHTML = t > 0 ? `Pay ${BR.coin()} ${t} and start` : 'Start';
      if (sh.edge) sh.edge();
    };
    sh.el.addEventListener('click', (e) => {
      const b = e.target.closest('.boost');
      if (!b) return;
      const id = b.dataset.boost;
      if (picked.has(id)) picked.delete(id);
      else { picked.add(id); if (total() > P.coins) { picked.delete(id); BR.toast(`You need ${cfg[id].cost - (P.coins - total())} more Coins for that Boost`, 'bad'); BR.haptic('err'); BR.audio.deny(); return; } }
      BR.audio.ui(); BR.haptic('tick'); refresh();
    });
    let paid = false;
    start.querySelector('button').addEventListener('click', (ev) => {
      if (paid) return;
      paid = true; ev.currentTarget.disabled = true;   // a quick double tap must not charge twice or start two runs
      const chosen = {};
      picked.forEach((id) => { chosen[id] = true; });
      const t = total();
      if (t > 0) { if (!P.spend(t)) { BR.toast('Not enough Coins', 'bad'); paid = false; ev.currentTarget.disabled = false; return; } BR.audio.coin && BR.audio.coin(1); }
      if (mode === 'rush') rememberBoosts([...picked]);
      sh.close();
      BR.App.startRun({ mode, boosts: chosen });   // straight away: the sheet slides off over the run, with no flash of Home in between
    });
    refresh();
  };

  const live0 = (odds) => { const l = odds.filter((r) => r.pct > 0); if (!l.length) return 'Complete'; const a = l[0], b = l[l.length - 1]; if (a === b) return `${a.rarity.name} 100%`; return `${a.rarity.name} ${Math.round(a.pct)}% · ${b.rarity.name} ${Math.round(b.pct)}%`; };

  /* ------------------------------------------------------------------ Shop */
  const Shop = {
    render() {
      const order = (P.chestCount('golden') ? ['golden'] : []).concat(BR.CHEST_ORDER);
      const cards = order.map((id) => {
        const c = BR.CHESTS[id], n = P.chestCount(id), can = P.canOpen(id), st = P.chestStatus(id);
        const odds = BR.chestOdds(id, c.type || 'skin', P.ownedIds());
        const mini = odds.filter((r) => r.pct > 0).map((r) => `<i style="flex:${r.pct};background:${r.rarity.color}"></i>`).join('');
        let action;
        // colour roles: green = free, gold = spends Coins. A chest you cannot afford yet says how many Coins are missing.
        if (st.complete) action = `<span class="btn btn-dark btn-sm done-badge">${BR.icon('check')} Complete</span>`;
        else if (n > 0) action = `<button class="btn btn-green btn-sm" data-act="open" data-chest="${id}" type="button">Open free${n > 1 ? ` <b>x${n}</b>` : ''}</button>`;
        else action = c.cost != null ? (can ? `<button class="btn btn-gold btn-sm" data-act="open" data-chest="${id}" type="button">${BR.coin()} ${c.cost}</button>` : `<button class="btn btn-gold btn-sm short" data-act="open" data-chest="${id}" type="button" aria-disabled="true">${BR.coin()} Need ${fmt(c.cost - P.coins)} more</button>`) : '';
        const N = BR.CFG.pityEvery, filled = st.pityIn ? N - st.pityIn : 0;
        const pity = st.pityIn ? `<div class="pity" role="img" aria-label="An Epic or better is guaranteed within ${st.pityIn} chest${st.pityIn === 1 ? '' : 's'}"><span class="pips">${Array.from({ length: N }, (_, k) => `<i class="${k < filled ? 'on' : ''}"></i>`).join('')}</span><small>Epic or better guaranteed within ${st.pityIn} chest${st.pityIn === 1 ? '' : 's'}</small></div>` : '';
        const left = c.golden ? '' : st.complete ? `<small class="cc-left">You own all ${st.total} ${c.sub}</small>` : `<small class="cc-left">${st.left} of ${st.total} ${c.sub} left to find</small>${pity}`;
        return `<article class="chest-card stg cc-${id} ${st.complete ? 'complete' : ''}" data-chestcard="${id}" style="--ac:${c.accent}">
          <div class="cc-art"><span class="cc-halo"></span>${BR.chestSVG(id, LITE)}</div>
          <div class="cc-info">
            <div class="cc-top"><h3 class="display">${c.name}</h3><button class="info-btn" data-act="odds" data-chest="${id}" aria-label="Odds for ${c.name}" type="button">${BR.icon('info')}</button></div>
            <p class="cc-blurb">${c.blurb}</p>
            <div class="odds-mini" title="Odds"><div class="om-bar">${mini}</div><small>${live0(odds)}</small></div>${left}
            <div class="cc-act">${action}</div>
          </div></article>`;
      }).join('');
      this.el.innerHTML = `<div class="scroll">
        ${BR.Coach.banner('shop')}
        ${cards}
        <h2 class="sec-title stg">How to earn Coins</h2>
        <div class="card card-pad earn stg">${BR.earnListHTML()}</div>
      </div>`;
    },
    /** Scroll to a chest and pulse it: "Go to the Shop" from an item you have not found lands on the chest that holds it. */
    reveal(id) {
      const card = this.el.querySelector(`[data-chestcard="${id}"]`), sc = this.el.querySelector('.scroll');
      if (!card || !sc) return;
      const top = card.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
      sc.scrollTo({ top: Math.max(0, top - Math.max(8, (sc.clientHeight - card.offsetHeight) / 2)), behavior: BR.reducedMotion ? 'auto' : 'smooth' });
      card.classList.remove('pulse'); void card.offsetWidth; card.classList.add('pulse');
      setTimeout(() => card.classList.remove('pulse'), 2600);
    },
    onRetap() { const sc = this.el.querySelector('.scroll'); if (sc) sc.scrollTo({ top: 0, behavior: BR.reducedMotion ? 'auto' : 'smooth' }); },
  };
  /** Open the Shop at the chest that holds something (from a locked item). */
  const goShopChest = (chestId) => {
    if (BR.Router.current === 'shop') { Shop.reveal(chestId); return; }
    BR.Router.onArrive('shop', () => setTimeout(() => Shop.reveal(chestId), 380));
    BR.Router.go('shop');
  };

  /* ------------------------------------------------------------------ Collection */
  const Collection = {
    type: 'skin', filter: null,
    render(arrive) {
      const type = this.type;
      const segs = BR.TYPE_ORDER.map((t) => `<button data-type="${t}" class="${t === type ? 'on' : ''}" type="button" aria-pressed="${t === type}">${BR.ITEM_TYPES[t].plural}</button>`).join('');
      this.arrive = !!arrive;
      this.el.innerHTML = `<div class="scroll">
        ${BR.Coach.banner('collection')}
        <div class="seg stg" id="colSeg" style="--n:${BR.TYPE_ORDER.length};--si:${BR.TYPE_ORDER.indexOf(type)}">${segs}<i class="thumb"></i></div>
        <div class="col-body" id="colBody">${this.bodyHTML()}</div>
        <p class="tiny center">Tap an item to see it. Tap the circle to wear it. Every chest gives something new.</p>
      </div>`;
      this.hydrateGrid();
    },
    /** Everything under the type switch: what you wear, the count ring, the rarity filter and the grid. */
    bodyHTML() {
      const type = this.type;
      const have = new Set(S().profile.vault.filter((i) => BR.itemById[i.itemId].type === type).map((i) => i.itemId)).size;
      const total = BR.ITEMS.filter((i) => i.type === type).length;
      const eq = P.equipped(type);
      const f = this.filter;
      const filters = `<button class="chip-btn ${f ? '' : 'on'}" data-rar="" type="button" aria-pressed="${!f}">All</button>` + BR.RARITIES.map((r) => `<button class="chip-btn ${f === r.id ? 'on' : ''}" data-rar="${r.id}" style="--rc:${r.color}" type="button" aria-pressed="${f === r.id}">${r.name}</button>`).join('');
      return `<div class="col-head stg"><div class="eq-now" style="--rc:${R(eq.item.rarity).color}"><span class="eq-prev">${BR.Skins.previewHTML(eq.item, eq.inst)}</span><span class="eq-txt"><small>Wearing</small><b class="display">${esc(eq.item.name)}</b></span></div>
          <div class="col-prog" role="img" aria-label="${have} of ${total} found">${ringSVG(have / total, 60, 6)}<b>${have}<small>/${total}</small></b></div></div>
        <div class="filters stg" role="group" aria-label="Rarity">${filters}</div>
        <div class="col-grid stg ${this.arrive ? 'enter' : ''}" id="colGrid">${this.gridHTML()}</div>`;
    },
    /** Switch the type: the thumb slides, and the content under it slides the same way. Nothing else is rebuilt. */
    setType(t) {
      const from = BR.TYPE_ORDER.indexOf(this.type), to = BR.TYPE_ORDER.indexOf(t);
      if (from === to) return;
      this.type = t; this.filter = null; this.arrive = false;
      const seg = this.el.querySelector('#colSeg');
      seg.style.setProperty('--si', to);
      seg.querySelectorAll('button').forEach((b) => { const on = b.dataset.type === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      const body = this.el.querySelector('#colBody');
      body.innerHTML = this.bodyHTML();
      settle(body);
      this.hydrateGrid();
      swapIn(body, to > from ? 1 : -1);
    },
    setFilter(r) {
      this.filter = r || null; this.arrive = false;
      this.el.querySelectorAll('.chip-btn').forEach((b) => { const on = (b.dataset.rar || null) === this.filter; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      const grid = this.el.querySelector('#colGrid');
      grid.classList.remove('enter');
      grid.innerHTML = this.gridHTML();
      this.hydrateGrid();
      swapIn(grid, 0);
    },
    gridHTML() {
      const type = this.type, vault = S().profile.vault;
      const order = BR.RARITIES.map((r) => r.id);
      const byR = (a, b) => order.indexOf(b.rarity) - order.indexOf(a.rarity) || a.name.localeCompare(b.name);
      const byRasc = (a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity) || a.name.localeCompare(b.name);
      const out = [];
      let i = 0;
      const def = BR.DEFAULTS[type];
      if (!this.filter || this.filter === def.rarity) out.push(card(def, null, { i: i++, eq: P.equipped(type).inst === null }));
      const owned = vault.map((inst) => ({ inst, item: BR.itemById[inst.itemId] })).filter((x) => x.item.type === type).sort((a, b) => byR(a.item, b.item));
      for (const o of owned) {
        if (this.filter && this.filter !== o.item.rarity) continue;
        const eqd = P.isEquipped(o.inst.uid);
        out.push(card(o.item, o.inst, { i: i++, eq: eqd }));
      }
      const have = new Set(owned.map((o) => o.item.id));
      // what is left to find: Common first, so the first thing a player sees is something they can actually get
      const missing = BR.itemsOfType(type).filter((item) => !have.has(item.id) && (!this.filter || this.filter === item.rarity)).sort(byRasc);
      this._rest = out;
      this._lockedTiles = missing.map((item) => lockedTile(item));
      const lockedBlock = missing.length
        ? `<div class="col-locked-head col-span"><h3>Not found yet <small>${missing.length}</small></h3><p>Tap a shape to see where it comes from.</p></div><div class="col-locked-grid col-span" id="colLocked">${this._lockedTiles.slice(0, FIRST_LOCKED).join('')}${missing.slice(FIRST_LOCKED).map((_, k) => `<div class="lk ph" data-k="${k + FIRST_LOCKED}"></div>`).join('')}</div>`
        : '';
      if (!out.length && !missing.length) return `<div class="empty-state col-span">${BR.icon('collection')}<p>Nothing here yet.<br>Open chests in the Shop to fill your collection.</p></div>`;
      return out.slice(0, FIRST_CARDS).join('') + out.slice(FIRST_CARDS).map((_, k) => `<div class="icard ph" data-k="${k + FIRST_CARDS}"></div>`).join('') + lockedBlock;
    },
    hydrateGrid() {
      const rest = this._rest, locked = this._lockedTiles;
      if (rest && rest.length > FIRST_CARDS) hydrate(this.el, '.icard.ph', (el) => { el.insertAdjacentHTML('afterend', rest[+el.dataset.k].replace('class="icard ', 'class="icard late ')); el.remove(); });
      if (locked && locked.length > FIRST_LOCKED) hydrate(this.el, '.lk.ph', (el) => { el.insertAdjacentHTML('afterend', locked[+el.dataset.k]); el.remove(); });
    },
    /** Wear an item straight from its card: Collection, then one tap. */
    equip(uid, type) {
      const inst = uid === 'default' ? null : P.instance(uid);
      const item = inst ? P.itemOf(inst) : BR.DEFAULTS[type];
      if (!item) return;
      P.equip(inst ? inst.uid : 'default', item.type); BR.Skins.apply(); BR.audio.equip(); BR.haptic('tap');
      BR.toast(`${esc(item.name)} equipped`, 'good');
      BR.Router.rerender();
      const c = this.el.querySelector(`.icard[data-uid="${uid}"]`);
      if (c) { c.classList.add('just'); const h = c.querySelector('.ic-hit'); if (h) { try { h.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
    },
    onRetap() { this.el.querySelector('.scroll').scrollTo({ top: 0, behavior: BR.reducedMotion ? 'auto' : 'smooth' }); },
  };
  /** A small tile for something you have not found: a dark silhouette in its rarity colour, never its name. */
  function lockedTile(item) {
    const r = R(item.rarity);
    return `<button class="lk" data-locked="${item.id}" style="--rc:${r.color}" aria-label="${r.name} ${BR.ITEM_TYPES[item.type].name}, not found yet" type="button"><span class="lk-prev">${BR.Badge.html(item, null, { size: 52, locked: true, still: true })}</span><small>${r.name}</small></button>`;
  }
  function card(item, inst, o) {
    const r = R(item.rarity);
    const uid = inst ? inst.uid : 'default';
    const shineName = inst && inst.shine !== 'plain' ? BR.shineById[inst.shine].name : '';
    const shine = shineName ? `<span class="tag shine-${inst.shine}">${shineName}</span>` : '';
    // the corner circle: filled and green = worn; empty = tap to wear it (a button of its own, so wearing an item is one tap)
    const flag = o.eq ? `<span class="eq-flag" aria-hidden="true">${BR.icon('check')}</span>` : `<button class="eq-btn" data-equip="${uid}" data-type="${item.type}" type="button" aria-label="Wear ${esc(item.name)}"><i>${BR.icon('check')}</i></button>`;
    // the card is a box with two buttons on it (see it, wear it), not a button holding a button
    return `<div class="icard ${o.eq ? 'eq' : ''}" data-uid="${uid}" data-type="${item.type}" style="--rc:${r.color};--i:${o.i}">
      <button class="ic-hit" data-uid="${uid}" data-type="${item.type}" type="button" aria-label="${esc(item.name)}, ${r.name}${shineName ? ', ' + shineName : ''}${o.eq ? ', worn' : ''}. See details"></button>
      ${flag}
      <span class="ic-prev" aria-hidden="true">${BR.Badge.html(item, inst, { size: 64, still: true })}</span><b class="ic-name" aria-hidden="true">${esc(item.name)}</b>
      <span class="ic-tags" aria-hidden="true"><span class="tag rar" style="--rc:${r.color}">${r.name}</span>${shine}</span></div>`;
  }

  /** Where an item you have not found comes from. */
  BR.lockedSheet = function (itemId) {
    const item = BR.itemById[itemId];
    if (!item) return;
    const r = R(item.rarity), chestId = item.pass ? null : BR.ITEM_TYPES[item.type].chest, chest = chestId ? BR.CHESTS[chestId] : null;
    const st = chest ? P.chestStatus(chestId) : null;
    const body = `<div class="detail" style="--rc:${r.color}"><div class="detail-prev locked-prev"><span class="dp-glow"></span>${BR.Badge.html(item, null, { size: 120, locked: true, still: true })}</div>
        <div class="detail-tags"><span class="tag rar" style="--rc:${r.color}">${r.name}</span><span class="tag">${BR.ITEM_TYPES[item.type].name}</span></div>
        <p class="detail-desc">${item.pass ? 'A reward on the Pop Pass. Reach its level to get it.' : `Found in the <b>${chest.name}</b>. ${st && st.left ? `${st.left} of ${st.total} ${chest.sub} are still waiting.` : ''}`}</p>
        <div class="detail-where"><small>Comes from</small><b>${item.pass ? 'Pop Pass' : chest.name}</b></div></div>`;
    BR.Sheet.open({ title: 'Not found yet', cls: 'detail-sheet', body, actions: [{ label: item.pass ? 'See the Pop Pass' : `Show me the ${chest.name}`, cls: '', onClick: () => { if (item.pass) { Missions.tab = 'pass'; BR.Router.go('missions'); } else goShopChest(chestId); } }] });
  };

  /* item detail sheet */
  BR.itemSheet = function (uid, type) {
    const inst = uid === 'default' ? null : P.instance(uid);
    const item = inst ? P.itemOf(inst) : BR.DEFAULTS[type];
    if (!item) return;
    const r = R(item.rarity);
    const equipped = inst ? P.isEquipped(inst.uid) : P.equipped(item.type).inst === null;
    const where = item.pass ? 'Pop Pass reward' : item.isDefault ? 'Always yours' : BR.CHESTS[BR.ITEM_TYPES[item.type].chest].name;
    const body = `<div class="detail" style="--rc:${r.color}">
        <div class="detail-prev"><span class="dp-glow"></span><div class="hero-host"></div></div>
        <div class="detail-tags"><span class="tag rar" style="--rc:${r.color}">${r.name}</span><span class="tag">${BR.ITEM_TYPES[item.type].name}</span>${inst && inst.shine !== 'plain' ? `<span class="tag shine-${inst.shine}">${BR.shineById[inst.shine].name}</span>` : ''}</div>
        <p class="detail-desc">${esc(item.desc)}</p>
        <div class="detail-where"><small>Comes from</small><b>${where}</b></div></div>`;
    const fxEl = $('fx');
    let demo = null, clipT = 0, sheet = null;
    // the demo's sparks are drawn on the page-wide canvas: keep them inside the preview well, never over the text and buttons below it
    const clip = () => { const well = sheet && sheet.body.querySelector('.detail-prev'); if (!well || !fxEl) return; const b = well.getBoundingClientRect(); fxEl.style.clipPath = `inset(${Math.max(0, b.top).toFixed(1)}px ${Math.max(0, innerWidth - b.right).toFixed(1)}px ${Math.max(0, innerHeight - b.bottom).toFixed(1)}px ${Math.max(0, b.left).toFixed(1)}px round 24px)`; };
    const actions = [{ label: equipped ? 'Equipped' : 'Equip', cls: equipped ? 'btn-dark' : 'btn-green', disabled: equipped, onClick: () => { P.equip(inst ? inst.uid : 'default', item.type); BR.Skins.apply(); BR.audio.equip(); BR.haptic('tap'); BR.toast(`${esc(item.name)} equipped`, 'good'); BR.Router.rerender(); } },
      { label: 'Try it', cls: 'btn-dark', onClick: () => {
        BR.audio.ui();
        // the practice board ends on the Collection: come back to this sheet, with the grid where it was
        const sc = Collection.el.querySelector('.scroll'), top = sc ? sc.scrollTop : 0, back = BR.Router.current === 'collection';
        if (back) BR.Router.onArrive('collection', () => { const s2 = Collection.el.querySelector('.scroll'); if (s2) s2.scrollTop = top; setTimeout(() => BR.itemSheet(uid, type), 120); });
        BR.Run.practiceItem(item, inst);
      } }];
    sheet = BR.Sheet.open({ title: esc(item.name), cls: 'detail-sheet', body, actions, onClose: () => { if (demo) demo.stop(); clearTimeout(clipT); window.removeEventListener('resize', clip); setTimeout(() => { if (fxEl) fxEl.style.clipPath = ''; }, 700); } });
    demo = BR.Openings.demo(sheet.body.querySelector('.hero-host'), item, inst || { shine: 'plain', seed: 0 }, { silent: true, power: 1.2 });
    clipT = setTimeout(clip, 560); window.addEventListener('resize', clip); sheet.body.addEventListener('scroll', clip, { passive: true });
  };
  /** A trophy: what it asks for, what it pays, and whether you have it. */
  BR.trophySheet = function (id) {
    const t = BR.TROPHIES.find((x) => x.id === id);
    if (!t) return;
    const got = !!S().profile.trophies[id];
    BR.Sheet.open({ title: esc(t.name), cls: 'detail-sheet', body: `<div class="detail"><div class="reward-big trophy-art ${got ? 'got' : ''}">${BR.icon(got ? (TROPHY_ICON[id] || 'trophy') : 'lock')}</div><div class="detail-tags"><span class="tag ${got ? 'gold' : ''}">${got ? 'Earned' : 'Not yet'}</span><span class="tag gold">${BR.coin()} ${t.coins}</span></div><p class="detail-desc">${esc(t.desc)}.</p><div class="detail-where"><small>${got ? 'Reward' : 'Pays'}</small><b>${got ? 'Paid when you earned it' : t.coins + ' Coins and some XP'}</b></div></div>` });
  };
  /** What a Pop Pass tier gives: tap a tier on the track. */
  BR.rewardSheet = function (tier) {
    const r = BR.passReward(tier);
    const away = tier + 1 - P.level;
    const state = tier < P.level ? 'You have this reward.' : tier === P.level ? 'Your next reward. Finish this level to get it.' : `${away} levels to go.`;
    let title = BR.rewardLabel(r), desc = '', tags = '';
    if (r.kind === 'item') { const it = BR.itemById[r.itemId]; title = it.name; desc = it.desc; tags = `<span class="tag rar" style="--rc:${R(it.rarity).color}">${R(it.rarity).name}</span><span class="tag">${BR.ITEM_TYPES[it.type].name}</span>`; }
    else if (r.kind === 'chest') desc = BR.CHESTS[r.chest].blurb;
    else desc = tier < P.level ? `Paid when you reached level ${tier + 1}.` : 'Paid the moment you reach this level.';
    BR.Sheet.open({ title: esc(title), cls: 'detail-sheet', body: `<div class="detail"><div class="reward-big">${rewardArt(r, r.kind === 'item' ? 168 : 120)}</div><div class="detail-tags"><span class="tag gold">Pass level ${tier + 1}</span>${tags}</div><p class="detail-desc">${esc(desc)}</p><div class="detail-where"><small>${tier < P.level ? 'Claimed' : tier === P.level ? 'Up next' : 'Locked'}</small><b>${state}</b></div></div>` });
  };
  /** Bigger preview for the detail sheet: a live mini board for skins/pops/boards, a burning fuse for fuses. */
  BR.detailPreview = function (item, inst) {
    if (item.type === 'fuse') return `<div class="big-fuse">${BR.Skins.previewHTML(item, inst)}</div>`;
    return `<div class="big-prev">${BR.Skins.previewHTML(item, inst)}</div>`;
  };

  /* ------------------------------------------------------------------ Missions */
  const TROPHY_ICON = { first_run: 'play', first_rush: 'fire', stage5: 'flag', stage10: 'bomb', score100k: 'star', score250k: 'star', big100: 'bolt', bricks5k: 'collection', line5: 'bolt', power25: 'bolt', defuse10: 'bomb', daily1: 'sun', chests10: 'gift', own10: 'collection', own25: 'collection', commons: 'check', mythic: 'star', complete: 'check', lv10: 'trophy' };
  const KIND_ICON = { bricks: 'collection', color: 'star', stage: 'bolt', rushRun: 'fire', big: 'star', power: 'bomb', lines: 'bolt', defuse: 'bomb', runs: 'play', dailyScore: 'sun', weeklyStage: 'bolt', weeklyBricks: 'collection' };
  const MIS_TABS = ['daily', 'pass', 'trophies'];
  const Missions = {
    tab: 'daily',
    render() {
      const seg = MIS_TABS.map((t) => `<button data-tab="${t}" class="${t === this.tab ? 'on' : ''}" type="button" aria-pressed="${t === this.tab}">${{ daily: 'Daily', pass: 'Pop Pass', trophies: 'Trophies' }[t]}</button>`).join('');
      this.el.innerHTML = `<div class="scroll">${this.tab === 'daily' ? BR.Coach.banner('missions') : ''}<div class="seg stg" id="misSeg" style="--n:3;--si:${MIS_TABS.indexOf(this.tab)}">${seg}<i class="thumb"></i></div><div class="mis-body" id="misBody">${this.bodyHTML()}</div></div>`;
      this.afterBody();
    },
    bodyHTML() {
      const m = BR.Missions.ensure();
      if (this.tab === 'daily') {
        const swap = m.rerolls >= 1 ? 'Swap used today' : `One swap a day, ${BR.CFG.rerollCost} Coins`;
        return `<div class="reset-note stg"><span class="rn-row">${BR.icon('clock')} New missions in ${resetsIn()}</span><small>${swap}</small></div>
          ${m.list.map((x, i) => this.missionCard(x, i)).join('')}
          <h2 class="sec-title stg">Weekly challenge</h2>
          <article class="mission weekly stg ${m.weekly.done ? 'done' : ''}"><span class="m-ico">${m.weekly.done ? BR.icon('check') : BR.icon(KIND_ICON[m.weekly.kind])}</span>
            <div class="m-body"><b class="m-text">${esc(m.weekly.text)}</b><div class="bar gold"><i style="width:${(m.weekly.progress / m.weekly.target) * 100}%"></i></div><small class="num">${fmt(m.weekly.progress)} / ${fmt(m.weekly.target)}</small></div>
            <div class="m-reward gold-r">${m.weekly.done ? `<b>${BR.coin()} ${m.weekly.reward}</b><small>Paid · Golden Chest in the Shop</small>` : `<span class="rw-ico chest sm">${BR.chestSVG('golden', LITE)}</span><b>${BR.coin()} ${m.weekly.reward}</b><small>+ Golden Chest</small>`}</div></article>`;
      }
      return this.tab === 'pass' ? this.passHTML() : this.trophiesHTML();
    },
    afterBody() {
      if (this.tab === 'pass') { this.centerTrack(false); this.hydrateTrack(); this.bindTrack(); }
    },
    /** Switch the tab: the thumb slides, and the content under it slides the same way. */
    setTab(t) {
      const from = MIS_TABS.indexOf(this.tab), to = MIS_TABS.indexOf(t);
      if (from === to) return;
      this.tab = t;
      const seg = this.el.querySelector('#misSeg');
      seg.style.setProperty('--si', to);
      seg.querySelectorAll('button').forEach((b) => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      const body = this.el.querySelector('#misBody');
      body.innerHTML = this.bodyHTML();
      settle(body);
      this.afterBody();
      swapIn(body, to > from ? 1 : -1);
      const sc = this.el.querySelector('.scroll'); if (sc && sc.scrollTop > 0) sc.scrollTop = 0;
      BR.Coach.onScreen('missions');
    },
    missionCard(x, i) {
      const m = BR.Missions.ensure(), can = BR.Missions.canReroll(i);
      let swap = '';
      if (x.done) swap = '<small>Paid</small>';
      else {
        const why = m.rerolls >= 1 ? 'You already swapped a mission today.' : `You need ${BR.CFG.rerollCost} Coins to swap a mission.`;
        swap = `<button class="reroll ${can ? '' : 'off'}" data-act="reroll" data-i="${i}" data-why="${why}" aria-label="${can ? `Swap this mission for ${BR.CFG.rerollCost} Coins` : `Swap unavailable. ${why}`}" ${can ? '' : 'aria-disabled="true"'} type="button">${BR.icon('reroll')}<small>${can ? BR.CFG.rerollCost : m.rerolls >= 1 ? 'Used' : BR.CFG.rerollCost}</small></button>`;
      }
      return `<article class="mission stg ${x.done ? 'done' : ''}" data-mi="${i}"><span class="m-ico">${x.done ? BR.icon('check') : BR.icon(KIND_ICON[x.kind])}</span>
        <div class="m-body"><b class="m-text">${esc(x.text)}</b><div class="bar green"><i style="width:${(x.progress / x.target) * 100}%"></i></div><small class="num">${fmt(x.progress)} / ${fmt(x.target)}</small></div>
        <div class="m-reward"><b>${BR.coin()} ${x.reward}</b>${swap}</div></article>`;
    },
    /** Swap one mission: 30 Coins, one a day. The card flips to the new one, and an Undo toast gives the Coins back. */
    reroll(i) {
      const m = BR.Missions.ensure(), before = JSON.parse(JSON.stringify(m.list[i]));
      if (!BR.Missions.reroll(i)) return false;
      BR.audio.scrap();
      this.refreshDaily(i);
      BR.toast('Mission swapped', 'good', { ms: 6000, action: { label: 'Undo', onClick: () => {
        const mm = BR.Missions.ensure();
        if (mm.rerolls < 1 || BR.Router.current === 'run') return;
        mm.list[i] = before; mm.rerolls = 0; S().profile.coins += BR.CFG.rerollCost; BR.Storage.save(); BR.refreshCoins();
        BR.audio.ui(); if (BR.Router.current === 'missions' && this.tab === 'daily') this.refreshDaily(i); else BR.Router.rerender();
      } } });
      return true;
    },
    /** Redraw the daily list in place and flip the card that changed. */
    refreshDaily(flip) {
      const body = this.el.querySelector('#misBody'); if (!body) return;
      body.innerHTML = this.bodyHTML();
      settle(body);
      const c = body.querySelector(`.mission[data-mi="${flip}"]`);
      if (c && c.animate && !BR.reducedMotion) c.animate([{ transform: 'perspective(700px) rotateX(-85deg)', opacity: 0.35 }, { transform: 'perspective(700px) rotateX(0)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    },
    passHTML() {
      const L = P.level, need = P.need, next = BR.passReward(L), S3 = BR.PASS_SEASON;
      const big = (t) => t.kind !== 'coins';
      const card = (t) => {
        const state = t.tier < L ? 'claimed' : t.tier === L ? 'next' : 'locked';
        const mark = state === 'claimed' ? `<i class="pt-ck">${BR.icon('check')}</i>` : state === 'locked' ? `<i class="pt-lk">${BR.icon('lock')}</i>` : '<span class="pt-now">Next</span>';
        return `${rewardArt(t, big(t) ? 84 : 52)}<span class="pt-label">${BR.rewardLabel(t)}</span>${mark}`;
      };
      this._passCards = {};
      const tiers = BR.PASS.map((t) => {
        const state = t.tier < L ? 'claimed' : t.tier === L ? 'next' : 'locked';
        const near = t.tier >= L - 2 && t.tier <= L + 3;     // the tiers in view when the track centres on the next reward
        if (!near) this._passCards[t.tier] = card(t);
        return `<div class="pt ${state} ${big(t) ? 'big' : ''}" data-tier="${t.tier}" role="button" tabindex="0" aria-label="Pass level ${t.tier + 1}: ${BR.rewardLabel(t)}, ${state === 'claimed' ? 'claimed' : state === 'next' ? 'up next' : 'locked'}"><span class="pt-n"><b>${t.tier + 1}</b></span>
          <div class="pt-card${near ? '' : ' ph'}">${near ? card(t) : ''}</div></div>`;
      }).join('');
      return `<article class="pass-hero stg">
          <div class="ph-head"><div><span class="ph-season">${S3.label}</span><h2 class="display">Pop Pass</h2><small>Free. Every level pays the next reward.</small></div>
            <div class="ph-lvl">${ringSVG(P.xp / need, 64, 6)}<b>${L}</b></div></div>
          <div class="ph-next"><div class="phn-art">${rewardArt(next, next.kind === 'coins' ? 64 : 92)}</div>
            <div class="phn-txt"><small>Next reward · Pass level ${L + 1}</small><b class="display">${BR.rewardLabel(next)}</b>
              <div class="bar tall cyan"><i style="width:${(P.xp / need) * 100}%"></i></div><small class="num">${fmt(need - P.xp)} XP to go</small></div></div>
          <p class="ph-how">XP comes from every run, mission and trophy.</p>
        </article>
        <div class="track-wrap stg"><button class="track-arrow l" data-act="track-prev" type="button" aria-label="Earlier rewards">${BR.icon('back')}</button><button class="track-arrow r" data-act="track-next" type="button" aria-label="Later rewards">${BR.icon('arrow')}</button><div class="track" id="passTrack" role="group" aria-label="Pop Pass rewards">${tiers}<div class="pt more"><span class="pt-n"><b>+</b></span><div class="pt-card"><span class="pt-coin" style="--sz:52px">${BR.coin()}</span><span class="pt-label">Every level after ${BR.CFG.passTiers + 1}</span></div></div></div></div>`;
    },
    trophiesHTML() {
      const got = S().profile.trophies;
      const n = Object.keys(got).length;
      return `<div class="reset-note stg"><span class="rn-row">${BR.icon('trophy')} ${n} of ${BR.TROPHIES.length} earned</span></div>` + BR.TROPHIES.map((t) => `<button class="trophy stg ${got[t.id] ? 'got' : ''}" data-trophy="${t.id}" type="button"><span class="tr-ico">${BR.icon(got[t.id] ? (TROPHY_ICON[t.id] || 'trophy') : 'lock')}</span><div class="tr-body"><b>${t.name}</b><small>${t.desc}</small></div><span class="tr-rw">${got[t.id] ? BR.icon('check') : BR.coin() + '<b>' + t.coins + '</b>'}</span></button>`).join('');
    },
    /** The far tiers of the track get their art after the first frames, nearest to the next reward first. */
    hydrateTrack() {
      const cards = this._passCards, L = P.level;
      hydrate(this.el, '.pt-card.ph', (el) => { const html = cards[el.closest('.pt').dataset.tier]; el.classList.remove('ph'); if (html) el.innerHTML = html; },
        (els) => els.sort((a, b) => Math.abs(+a.closest('.pt').dataset.tier - L) - Math.abs(+b.closest('.pt').dataset.tier - L)));
    },
    centerTrack(smooth) {
      const tr = this.el.querySelector('#passTrack'), n = tr && tr.querySelector('.pt.next');
      if (!n) return;
      const left = n.offsetLeft - (tr.clientWidth - n.offsetWidth) / 2;
      if (smooth && !BR.reducedMotion) setTimeout(() => tr.scrollTo({ left, behavior: 'smooth' }), 350); else tr.scrollLeft = left;
    },
    /** On a computer: the wheel scrolls the track sideways, the arrows page it, and the arrow keys walk from tile to tile. */
    bindTrack() {
      const tr = this.el.querySelector('#passTrack'); if (!tr) return;
      tr.addEventListener('wheel', (e) => {
        if (tr.scrollWidth <= tr.clientWidth || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;   // a trackpad's own sideways scroll needs no help
        e.preventDefault(); tr.scrollLeft += e.deltaY;
      }, { passive: false });
      tr.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const t = e.target.closest && e.target.closest('.pt[data-tier]'); if (!t) return;
        const n = e.key === 'ArrowRight' ? t.nextElementSibling : t.previousElementSibling;
        if (n && n.matches('.pt[data-tier]')) { e.preventDefault(); n.focus(); }
      });
    },
    page(dir) { const tr = this.el.querySelector('#passTrack'); if (tr) tr.scrollBy({ left: dir * Math.max(200, tr.clientWidth * 0.7), behavior: BR.reducedMotion ? 'auto' : 'smooth' }); },
    onShow() {
      const m = BR.Missions.ensure(), seen = S().seen || (S().seen = {});
      if (seen.misDay !== m.day) { seen.misDay = m.day; BR.Storage.save(); }   // the dot on the tab means "new missions you have not looked at"
      if (this.tab === 'pass') this.centerTrack(true);
    },
  };

  /** Copy text to the clipboard; falls back to selecting it so the player can copy by hand. */
  const copyText = async (text, box) => {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fall through */ }
    try { box.focus(); box.select(); return document.execCommand('copy'); } catch (e) { return false; }
  };
  /** Profile > Data: the save as one line of text, to keep or to move to another device. */
  BR.saveCodeSheet = function () {
    const code = BR.Storage.exportCode();
    BR.Sheet.open({
      title: 'Save code',
      body: `<p class="ready-sub">Your progress is saved on this device only. Copy this code and keep it somewhere safe, like a note to yourself. If the browser ever clears its data, paste it into Restore to get everything back.</p><textarea class="code-box" readonly rows="5" aria-label="Save code">${code}</textarea>`,
      actions: [{ label: 'Copy code', close: false, onClick: async (api) => { const ok = await copyText(code, api.el.querySelector('textarea')); BR.toast(ok ? 'Code copied' : 'Select the code and copy it', ok ? 'good' : ''); } }],
    });
  };
  /** Profile > Data: put a save code back. Asks twice, and changes nothing unless the code is whole and valid. */
  BR.restoreSheet = function () {
    let armed = null;
    BR.Sheet.open({
      title: 'Restore from a code',
      body: `<p class="ready-sub">Paste a save code. It replaces the progress on this device, so use it on a new device or after your data was cleared.</p><textarea class="code-box" rows="5" placeholder="POPRUSH4...." aria-label="Paste your save code" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea><p class="code-info tiny" role="status"></p>`,
      actions: [{
        label: 'Check the code', close: false,
        onClick: (api, btn) => {
          const box = api.el.querySelector('textarea'), info = api.el.querySelector('.code-info');
          if (armed) {
            BR.Storage.restore(armed); armed = null;
            BR.App.applySettings(); BR.Skins.apply(); BR.Router.go('home'); BR.Router.rerender();
            BR.toast('Progress restored', 'good'); api.close(); return;
          }
          const parsed = BR.Storage.parseCode(box.value);
          if (!parsed) { info.textContent = 'That is not a whole, valid save code. Check that you copied all of it.'; info.classList.add('bad'); BR.haptic('err'); return; }
          armed = parsed; info.classList.remove('bad');
          info.textContent = `This save: level ${parsed.profile.level}, ${BR.fmt(parsed.profile.coins)} Coins, ${parsed.profile.vault.length} items. Tap again to replace this device's progress.`;
          btn.textContent = 'Replace my progress'; btn.classList.add('btn-danger');   // destructive: red, never gold
          box.addEventListener('input', () => { armed = null; btn.textContent = 'Check the code'; btn.classList.remove('btn-danger'); info.textContent = ''; }, { once: true });
        },
      }],
    });
  };

  /** Records: the numbers worth beating, and the last 20 Rush runs so progress shows even when no run beat the best. */
  function recordsCard() {
    const r = BR.Records.list();
    const stat = (label, val) => `<div class="rec"><b class="num">${val}</b><small>${label}</small></div>`;
    const h = r.history, top = Math.max(1, ...h, r.bestScore);
    const bars = h.length >= 2 ? `<div class="rec-chart" role="img" aria-label="Your last ${h.length} Rush scores">${h.map((v) => `<i class="${v >= r.bestScore && v > 0 ? 'best' : ''}" style="height:${Math.max(6, Math.round((v / top) * 100))}%"></i>`).join('')}</div><small class="rec-cap">Your last ${h.length} Rush runs</small>` : '<small class="rec-cap">Play a few Rush runs to see your progress here.</small>';
    return `<article class="card card-pad stg"><div class="sec-title">Records</div><div class="rec-grid">${stat('Best score', fmt(r.bestScore))}${stat('Best stage', r.bestStage || '-')}${stat('Biggest pop', r.biggestPop || '-')}${stat('Best combo', r.bestCombo ? 'x' + r.bestCombo : '-')}${stat('Line Blasts in a run', r.maxLines || '-')}${stat('Rush Modes in a run', r.maxRushes || '-')}</div>${bars}</article>`;
  }

  /* ------------------------------------------------------------------ Settings (a sheet, from the gear on every screen) */
  const settingsHTML = () => {
    const set = S().settings;
    const tog = (key, label, sub) => `<label class="toggle"><span><b>${label}</b><small>${sub}</small></span><input type="checkbox" data-set="${key}" ${set[key] ? 'checked' : ''}><i></i></label>`;
    const vol = (key, gate) => `<label class="vol ${set[gate] ? '' : 'off'}"><span>Volume</span><input type="range" min="0" max="100" step="5" value="${Math.round((set[key] == null ? 1 : set[key]) * 100)}" data-vol="${key}" aria-label="${key === 'sfxVol' ? 'Sound effects' : 'Music'} volume"><b class="num">${Math.round((set[key] == null ? 1 : set[key]) * 100)}</b></label>`;
    const idx = ['auto', 'low', 'high'].indexOf(set.perf);
    return `<section class="set-grp" aria-label="Sound">${tog('sound', 'Sound effects', 'Pops, chests and the fuse')}${vol('sfxVol', 'sound')}${tog('music', 'Music', 'The beat speeds up with the fuse')}${vol('musicVol', 'music')}${tog('haptics', 'Vibration', 'Buzz on pops and chest openings')}</section>
      <section class="set-grp" aria-label="Play and display">${tog('shake', 'Screen shake', 'Impact on big pops')}${tog('shapes', 'Shape hints', 'Symbols on bricks for color-blind play')}${tog('large', 'Larger text', 'Bigger text in menus')}${tog('reduced', 'Reduce motion', 'Calmer, shorter animations')}
        <div class="perf"><div><b>Graphics</b><small>Auto lowers effects if your phone struggles and brings them back when it can. Smooth uses fewer effects. Pretty uses them all.</small></div><div class="seg mini" id="perfSeg" style="--n:3;--si:${idx}">${[['auto', 'Auto'], ['low', 'Smooth'], ['high', 'Pretty']].map(([v, l]) => `<button data-perf="${v}" class="${set.perf === v ? 'on' : ''}" type="button" aria-pressed="${set.perf === v}">${l}</button>`).join('')}<i class="thumb"></i></div></div></section>`;
  };
  /** Settings change as they are touched and are saved at once; the Graphics thumb slides from where it was. */
  function bindSettings(root) {
    root.addEventListener('input', (e) => {
      const k = e.target.dataset.vol; if (!k) return;
      const v = +e.target.value / 100; S().settings[k] = v; e.target.parentNode.querySelector('b').textContent = Math.round(v * 100);
      BR.App.applySettings();
    });
    root.addEventListener('change', (e) => {
      if (e.target.dataset.vol) { BR.Storage.save(); if (BR.audio && BR.audio.ui) BR.audio.ui(); return; }
      const k = e.target.dataset.set;
      if (!k) return;
      if (k === 'music' && e.target.checked && BR.Music) setTimeout(() => BR.Music.start('menu'), 50);
      S().settings[k] = e.target.checked; BR.Storage.save(); BR.App.applySettings(); BR.audio.ui(); BR.haptic('tap');
      if (k === 'sound' || k === 'music') { const row = root.querySelector(`[data-vol="${k === 'sound' ? 'sfxVol' : 'musicVol'}"]`); if (row) row.closest('.vol').classList.toggle('off', !e.target.checked); }
    });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-perf]'); if (!b) return;
      S().settings.perf = b.dataset.perf; BR.Storage.save(); BR.App.applySettings(); BR.audio.ui();
      const seg = b.closest('.seg'); seg.style.setProperty('--si', ['auto', 'low', 'high'].indexOf(b.dataset.perf));
      seg.querySelectorAll('button').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    });
  }
  BR.settingsSheet = function () {
    const sh = BR.Sheet.open({ title: 'Settings', cls: 'settings', body: settingsHTML() });
    bindSettings(sh.el);
    return sh;
  };

  /* ------------------------------------------------------------------ Profile */
  const Profile = {
    render() {
      const st = S(), pr = st.profile;
      const earned = BR.TROPHIES.filter((t) => pr.trophies[t.id]);
      const stat = (label, val) => `<div class="stat"><b class="num">${val}</b><small>${label}</small></div>`;
      const installRow = BR.App && BR.App.canInstall() ? `<article class="card card-pad install stg"><div><b class="display">Play it like an app</b><small>Add Pop Rush to your home screen. It works offline.</small></div><button class="btn btn-sm" data-act="install" type="button">Add</button></article>` : '';
      const badges = earned.length
        ? earned.slice(-6).map((t) => `<button class="badge-ico" data-trophy="${t.id}" type="button" title="${esc(t.name)}" aria-label="Trophy: ${esc(t.name)}">${BR.icon(TROPHY_ICON[t.id] || 'trophy')}</button>`).join('')
        : '<small class="muted">Finish runs to earn trophies.</small>';
      this.el.innerHTML = `<div class="scroll">
        ${BR.Coach.banner('profile')}
        <article class="card prof-hero stg"><div class="ph-ring">${ringSVG(P.xp / P.need, 96, 8)}<b class="display">${P.level}</b></div>
          <div class="ph-info"><div class="ph-namerow"><label class="ph-name"><span class="sr-only">Your name</span><input class="display" type="text" maxlength="14" value="${esc(pr.name || 'Player')}" data-name autocomplete="off" autocapitalize="words" spellcheck="false" aria-label="Your name"></label><button class="ph-edit" data-act="rename" type="button" aria-label="Change your name">${BR.icon('edit')}</button></div><small>Level ${P.level}</small><div class="bar cyan"><i style="width:${(P.xp / P.need) * 100}%"></i></div><small class="num">${fmt(P.need - P.xp)} XP to level ${P.level + 1}</small></div></article>
        <button class="card settings-row stg" data-act="open-settings" type="button"><span class="sr-ico">${BR.icon('gear')}</span><span class="sr-txt"><b class="display">Settings</b><small>Sound, music, vibration, text size, graphics</small></span><span class="rs-go">${BR.icon('arrow')}</span></button>
        <div class="stats-grid stg">${stat('Runs played', fmt(st.runs))}${stat('Bricks popped', fmt(pr.stats.bricks))}${stat('Best Daily', fmt(st.best.daily))}</div>
        ${recordsCard()}
        <article class="card card-pad stg"><div class="sec-title"><span>Trophies <small>${earned.length}/${BR.TROPHIES.length}</small></span><button class="link-btn" data-act="go-trophies" type="button">See all ${BR.icon('arrow')}</button></div><div class="badges">${badges}</div></article>
        ${installRow}
        <article class="card card-pad stg help-card"><div class="sec-title">Help</div><p class="tiny">New to something? Every part of the game shows a short tip the first time. Show them all again:</p><button class="btn btn-dark btn-sm" data-act="tips" type="button">Show the tips again</button></article>
        <article class="card card-pad stg"><div class="sec-title">Data</div><p class="tiny">Your progress is saved on this device. A save code lets you keep a copy or move to a new device.</p><div class="data-btns"><button class="btn btn-dark btn-sm" data-act="save-code" type="button">Save code</button><button class="btn btn-dark btn-sm" data-act="restore-code" type="button">Restore</button></div><button class="btn btn-danger btn-sm" data-act="reset" type="button">Reset all progress</button></article>
        <p class="tiny center version">Pop Rush 4.1 · Ignite</p>
      </div>`;
    },
    onShow() { },
  };

  /* ------------------------------------------------------------------ events + registration */
  function bind(screen, handler) {
    screen.el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act],[data-type],[data-rar],[data-tab],[data-uid],[data-equip],[data-tier],[data-trophy],[data-locked]');
      if (!t || !screen.el.contains(t)) return;
      handler(t, e);
    });
  }
  const common = (a, t) => {
    switch (a) {
      case 'go-profile': BR.Router.go('profile'); return true;
      case 'go-shop': BR.Router.go('shop'); return true;
      case 'go-coins': BR.coinSheet(); return true;
      case 'open-settings': BR.settingsSheet(); return true;
      case 'close-tip': BR.Coach.dismiss(t.dataset.tip); { const bar = t.closest('.tipbar'); if (bar) bar.remove(); } return true;
      case 'go-missions': Missions.tab = 'daily'; BR.Router.go('missions'); return true;
      case 'go-pass': if (BR.Router.current === 'missions') Missions.setTab('pass'); else { Missions.tab = 'pass'; BR.Router.go('missions'); } return true;
      case 'go-trophies': if (BR.Router.current === 'missions') Missions.setTab('trophies'); else { Missions.tab = 'trophies'; BR.Router.go('missions'); } return true;
      case 'odds': BR.showOdds(t.dataset.chest); return true;
    }
    return false;
  };

  BR.initScreens = function () {
    const reg = (id, obj) => BR.Router.register(id, obj);
    reg('home', Home); reg('shop', Shop); reg('collection', Collection); reg('missions', Missions); reg('profile', Profile);
    Chrome.init();

    $('topbar').addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]'); if (!t) return;
      BR.audio.ui(); BR.haptic('tick'); common(t.dataset.act, t);
    });
    // a custom control (role=button) answers Enter and Space like a real button
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('[role="button"][tabindex]:not(button)')) { e.preventDefault(); e.target.click(); }
    });

    bind(Home, (t) => {
      const a = t.dataset.act;
      if (common(a, t)) return;
      BR.audio.ui(); BR.haptic('tap');
      if (a === 'play-rush') playRush();
      else if (a === 'play-last') repeatBoosts();
      else if (a === 'open-boosts') BR.readySheet('rush');
      else if (a === 'open-chest') { const id = BR.nextChest(); if (id) BR.App.openChest(id); }
      else if (a === 'play-daily') { if (S().daily.day === BR.dayKey()) { BR.toast('Daily Rush is done. Back tomorrow!'); return; } BR.readySheet('daily'); }
      else if (a === 'play-chill') { if (P.level < BR.CFG.chill.unlockLevel) { BR.toast(`Chill unlocks at level ${BR.CFG.chill.unlockLevel}`); BR.haptic('err'); return; } BR.readySheet('chill'); }
      else if (a === 'resume') BR.App.resume();
    });
    bind(Shop, (t) => {
      const a = t.dataset.act;
      if (common(a, t)) return;
      if (a === 'open') {
        const id = t.dataset.chest;
        if (!P.canOpen(id)) { const need = BR.CHESTS[id].cost - P.coins; BR.toast(need > 0 ? `${fmt(need)} more Coins to open it` : 'Nothing left to find in it', 'bad'); BR.haptic('err'); BR.audio.deny(); return; }
        BR.audio.ui(); BR.haptic('tap'); BR.App.openChest(id);
      }
    });
    Shop.el.addEventListener('click', (e) => { if (e.target.closest('[data-act="toggle-inside"]')) toggleInside(e.target.closest('.odds')); });
    bind(Collection, (t) => {
      if (t.dataset.type && t.closest('#colSeg')) { BR.audio.ui(); Collection.setType(t.dataset.type); return; }
      if (t.dataset.rar != null && t.classList.contains('chip-btn')) { BR.audio.ui(); Collection.setFilter(t.dataset.rar); return; }
      const a = t.dataset.act;
      if (common(a, t)) return;
      if (t.dataset.equip) { Collection.equip(t.dataset.equip, t.dataset.type); return; }
      if (t.dataset.locked) { BR.audio.ui(); BR.haptic('tick'); BR.lockedSheet(t.dataset.locked); return; }
      if (t.dataset.uid) { BR.audio.ui(); BR.haptic('tick'); BR.itemSheet(t.dataset.uid, t.dataset.type); }
    });
    bind(Missions, (t) => {
      if (t.dataset.tab) { BR.audio.ui(); Missions.setTab(t.dataset.tab); return; }
      if (t.dataset.tier) { BR.audio.ui(); BR.haptic('tick'); BR.rewardSheet(+t.dataset.tier); return; }
      if (t.dataset.trophy) { BR.audio.ui(); BR.haptic('tick'); BR.trophySheet(t.dataset.trophy); return; }
      if (t.dataset.act === 'close-tip') { common('close-tip', t); return; }
      if (t.dataset.act === 'track-prev' || t.dataset.act === 'track-next') { BR.audio.ui(); Missions.page(t.dataset.act === 'track-next' ? 1 : -1); return; }
      if (t.dataset.act === 'reroll') {
        if (t.classList.contains('off')) { BR.toast(t.dataset.why || 'Not enough Coins', 'bad'); BR.haptic('err'); BR.audio.deny(); return; }
        if (!Missions.reroll(+t.dataset.i)) BR.toast('Not enough Coins', 'bad');
      }
    });
    bind(Profile, (t) => {
      const a = t.dataset.act;
      if (a === 'close-tip') { common('close-tip', t); return; }
      if (a === 'open-settings' || a === 'go-trophies') { BR.audio.ui(); common(a, t); return; }
      if (t.dataset.trophy) { BR.audio.ui(); BR.haptic('tick'); BR.trophySheet(t.dataset.trophy); return; }
      if (a === 'rename') { const inp = Profile.el.querySelector('[data-name]'); if (inp) { inp.focus(); inp.select(); } return; }
      if (a === 'install') BR.App.install();
      if (a === 'save-code') BR.saveCodeSheet();
      if (a === 'restore-code') BR.restoreSheet();
      if (a === 'tips') { BR.Coach.reset(); BR.audio.ui(); BR.toast('Tips will show again', 'good'); }
      if (a === 'reset') {
        if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = 'Tap again to erase everything'; setTimeout(() => { t.dataset.armed = ''; t.textContent = 'Reset all progress'; }, 3500); return; }
        BR.Storage.reset(); BR.App.applySettings(); BR.Skins.apply(); BR.toast('Progress reset'); BR.Router.rerender();
      }
    });
    Profile.el.addEventListener('change', (e) => {
      if (e.target.dataset.name !== undefined) { const v = e.target.value.replace(/[<>&"]/g, '').trim().slice(0, 14) || 'Player'; e.target.value = v; S().profile.name = v; BR.Storage.save(); }
    });
  };
})();
