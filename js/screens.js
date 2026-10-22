/* The five tab screens (Play, Shop, Collection, Missions, Profile) plus the shared sheets
   (odds, ready-to-play, item detail). Screens re-render from state; events use delegation. */
(function () {
  const BR = (window.BR = window.BR || {});
  const { fmt, esc } = BR;
  const S = () => BR.Storage.data;
  const P = BR.Progress;
  const R = (id) => BR.rarityById[id];
  const FIRST_LOCKED = 9;    // small "not found yet" tiles built up front
  const FIRST_CARDS = 8;     // cards the Collection grid builds before its first frame; the rest fill in afterwards
  const LITE = { lite: true };   // static chest art for lists: one flat SVG instead of a stack of layers
  const ringSVG = (frac, size = 44, w = 5) => {
    const r = (size - w) / 2, c = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg" stroke-width="${w}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-width="${w}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - Math.max(0, Math.min(1, frac)))).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  };
  BR.ringSVG = ringSVG;
  /** The sliding highlight of a segmented control is placed by CSS from --i (the index) and --n (the count): nothing is measured. */
  const slideThumb = (seg) => { if (seg) requestAnimationFrame(() => seg.style.setProperty('--i', seg.dataset.i)); };

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

  const topbar = (title) => `<header class="topbar">
      <button class="lvl-badge" data-act="go-pass" aria-label="Level ${P.level}. Open the Pop Pass">${ringSVG(P.xp / P.need, 36, 4)}<b>Lv ${P.level}</b></button>
      ${title ? `<h1>${title}</h1>` : '<div style="flex:1"></div>'}
      <button class="pill gold coin-btn" data-act="go-coins" aria-label="Your Coins">${BR.coin()}<b class="num" data-coins>${fmt(P.coins)}</b></button>
    </header>`;

  /** Tap the Coin pill: what you have, how to earn more, and the cheapest chest you could open. */
  BR.coinSheet = function () {
    const cheapest = BR.CHEST_ORDER.map((id) => ({ id, c: BR.CHESTS[id], st: P.chestStatus(id) })).filter((x) => !x.st.complete && x.c.cost != null).sort((a, b) => a.c.cost - b.c.cost)[0];
    const next = cheapest
      ? (P.coins >= cheapest.c.cost
        ? `<div class="cs-next ok"><span class="rw-ico chest">${BR.chestSVG(cheapest.id, LITE)}</span><p><b>You can open a ${cheapest.c.name}</b> for <span class="nw">${BR.coin()} ${cheapest.c.cost}</span>.</p></div>`
        : `<div class="cs-next"><span class="rw-ico chest">${BR.chestSVG(cheapest.id, LITE)}</span><p><b>${fmt(cheapest.c.cost - P.coins)} more Coins</b> opens a ${cheapest.c.name} (<span class="nw">${BR.coin()} ${cheapest.c.cost}</span>).</p></div>`)
      : '';
    BR.Sheet.open({
      title: 'Your Coins',
      body: `<div class="cs-bal">${BR.coin()}<b class="num">${fmt(P.coins)}</b></div>${next}
        <h3 class="sec-title">Ways to earn Coins</h3>
        <ul class="cs-list"><li><span>${BR.icon('play')}</span>Finish runs: points and every stage you clear</li><li><span>${BR.icon('sun')}</span>Daily Rush, and your first run each day</li><li><span>${BR.icon('missions')}</span>Daily and weekly missions</li><li><span>${BR.icon('trophy')}</span>Trophies and the Pop Pass</li></ul>`,
      actions: [{ label: 'Go to the Shop', cls: '', onClick: () => BR.Router.go('shop') }],
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
      <button class="odds-more" data-act="toggle-inside">See everything inside <i>${BR.icon('arrow')}</i></button>
      <div class="inside">${inside}</div>`}</div>`;
  };
  /** "1 in N" only reads well for rare odds: 60% is not "1 in 2". */
  const oneIn = (r, chip) => (r.pct < 20 && r.oneIn > 1 ? `<small>1 in ${r.oneIn}</small>` : (chip ? '<small>&nbsp;</small>' : ''));
  /** Open or close the full item list and bring it into view, so the tap visibly does something. */
  const toggleInside = (odds) => {
    odds.classList.toggle('open');
    if (odds.classList.contains('open')) setTimeout(() => { const el = odds.querySelector('.inside'); if (el) el.scrollIntoView({ block: 'start', behavior: BR.reducedMotion ? 'auto' : 'smooth' }); }, 60);
  };
  const fmtPct = (p) => (p >= 10 ? Math.round(p) : p.toFixed(p < 1 ? 1 : 0)) + '%';

  BR.showOdds = function (chestId) {
    let type = BR.CHESTS[chestId].type;
    const sh = BR.Sheet.open({ title: `${BR.CHESTS[chestId].name} odds`, body: `<div class="chest-mini">${BR.chestSVG(chestId, LITE)}</div>${BR.oddsHTML(chestId, type || 'skin', { pityIn: P.chestStatus(chestId).pityIn })}` });
    sh.el.addEventListener('click', (e) => { if (e.target.closest('[data-act="toggle-inside"]')) toggleInside(sh.el.querySelector('.odds')); });
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
      this.el.innerHTML = `${topbar()}<div class="scroll">
        <div class="logo stg" aria-label="Pop Rush">
          <div class="logo-pop" data-skin-host>${logo}</div>
          <div class="logo-rush"><span>RUSH</span></div>
          <div class="fuse-line"><i></i><b></b></div>
        </div>
        ${resume ? `<button class="resume stg" data-act="resume"><span class="rs-ico">${BR.icon('bolt')}</span><span class="rs-txt"><b>Resume your run</b><small>Stage ${resume.stage} · ${fmt(resume.score)} points</small></span><span class="rs-go">${BR.icon('arrow')}</span></button>` : ''}
        <button class="hero stg" data-act="play-rush" aria-label="Play Rush">
          <span class="hero-glow"></span>
          <span class="hero-art">${bombArt}</span>
          <span class="hero-body">
            <span class="tag hot">${BR.icon('fire')} Main mode</span>
            <span class="hero-title display">Rush</span>
            <span class="hero-sub">Pop fast to keep the fuse lit. Chain big pops for Rush Mode.</span>
            <span class="hero-stats"><span><small>Best</small><b class="num">${fmt(st.best.rush)}</b></span><span><small>Stage</small><b class="num">${st.bestStage.rush || '-'}</b></span>${par(st.recent.rush) ? `<span><small>Recent avg</small><b class="num">${fmt(par(st.recent.rush))}</b></span>` : ''}</span>
          </span>
          <span class="btn btn-xl hero-play">Play</span>
        </button>
        <div class="row2 stg">
          <button class="mode-card daily ${dailyDone ? 'done' : ''}" data-act="play-daily">
            <span class="mc-ico"><span class="cal"><small>${new Date().toLocaleString('en-US', { month: 'short' })}</small><b>${new Date().getDate()}</b></span></span>
            <span class="mc-title display">Daily Rush</span>
            <span class="mc-sub">${dailyDone ? `Done · ${fmt(st.daily.score)}` : par(st.recent.daily) ? `Recent average: ${fmt(par(st.recent.daily))}` : 'Same board for everyone. Bonus Coins.'}</span>
            <span class="tag ${dailyDone ? '' : 'gold'}">${dailyDone ? BR.icon('check') + ' Come back tomorrow' : '+15 Coins'}</span>
          </button>
          <button class="mode-card chill ${chillOpen ? '' : 'locked'}" data-act="play-chill">
            <span class="mc-ico">${BR.icon('leaf')}</span>
            <span class="mc-title display">Chill</span>
            <span class="mc-sub">20 moves a round. No clock.</span>
            ${chillOpen ? `<span class="tag">${st.best.chill > 0 ? 'Best ' + fmt(st.best.chill) : 'New'}</span>` : `<span class="lock-badge">${BR.icon('lock')} Level ${BR.CFG.chill.unlockLevel}</span>`}
          </button>
        </div>
        ${owned ? `<button class="banner stg" data-act="go-shop"><span class="bn-ico">${BR.icon('gift')}</span><span class="bn-txt"><b>You have ${owned} chest${owned > 1 ? 's' : ''} to open</b><small>Free to open. Tap to see.</small></span><span class="bn-go">${BR.icon('arrow')}</span></button>` : ''}
        <button class="card pass-card stg" data-act="go-pass">
          <div class="pc-head"><span class="pc-title display">Pop Pass</span><span class="tag">Level ${P.level}</span></div>
          <div class="pc-body"><div class="pc-reward">${rewardChip(reward)}</div><div class="pc-next"><small>Next reward</small><div class="bar cyan"><i style="width:${(P.xp / P.need) * 100}%"></i></div><small>${fmt(P.need - P.xp)} XP to go</small></div></div>
        </button>
        <button class="card mission-card stg" data-act="go-missions">
          <div class="pc-head"><span class="pc-title display">Today's missions</span><span class="tag">${m.list.filter((x) => x.done).length}/3 done</span></div>
          ${m.list.map((x) => `<div class="mrow ${x.done ? 'done' : ''}"><span class="mr-text">${x.done ? BR.icon('check') : ''}${esc(x.text)}</span><div class="bar green"><i style="width:${(x.progress / x.target) * 100}%"></i></div></div>`).join('')}
        </button>
      </div>`;
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
        ${Object.values(cfg).map((b) => `<button class="boost ${b.cost > P.coins ? 'short' : ''}" data-boost="${b.id}" aria-pressed="false"><span class="bo-ico">${BR.icon(BOOST_ICON[b.id])}</span><span class="bo-txt"><b>${b.name}</b><small>${b.desc}</small></span><span class="bo-price">${BR.coin()}<b>${b.cost}</b></span><i class="bo-check">${BR.icon('check')}</i></button>`).join('')}
        <div class="bo-sum" id="boSum" hidden></div>
        <p class="tiny">Boosts cost Coins. Skip them and the run is free.</p></div>`;
    const sh = BR.Sheet.open({ title: titles[mode][0], body: `<p class="ready-sub">${titles[mode][1]}</p>${boostHTML}` });
    const start = BR.el(`<div class="sheet-actions"><button class="btn btn-xl" id="goBtn">${BR.icon('play')} <span id="goLabel">Start</span></button></div>`);
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
      if (t > 0) { if (!P.spend(t)) { BR.toast('Not enough Coins', 'bad'); paid = false; ev.currentTarget.disabled = false; return; } BR.audio.coin && BR.audio.coin(1); BR.toast(`Paid ${t} Coins for ${[...picked].map((id) => cfg[id].name).join(' and ')}`, 'good'); }
      sh.close();
      setTimeout(() => BR.App.startRun({ mode, boosts: chosen }), 250);
    });
    refresh();
    if (BR.Coach) BR.Coach.show('boosts');
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
        if (st.complete) action = `<span class="btn btn-dark btn-sm done-badge">${BR.icon('check')} Complete</span>`;
        else if (n > 0) action = `<button class="btn btn-green btn-sm" data-act="open" data-chest="${id}">Open free${n > 1 ? ` <b>x${n}</b>` : ''}</button>`;
        else action = c.cost != null ? `<button class="btn btn-gold btn-sm ${can ? '' : 'short'}" data-act="open" data-chest="${id}">${BR.coin()} ${c.cost}</button>` : '';
        const N = BR.CFG.pityEvery, filled = st.pityIn ? N - st.pityIn : 0;
        const pity = st.pityIn ? `<div class="pity" role="img" aria-label="An Epic or better is guaranteed within ${st.pityIn} chest${st.pityIn === 1 ? '' : 's'}"><span class="pips">${Array.from({ length: N }, (_, k) => `<i class="${k < filled ? 'on' : ''}"></i>`).join('')}</span><small>Epic or better guaranteed within ${N} chests</small></div>` : '';
        const left = c.golden ? '' : st.complete ? `<small class="cc-left">You own all ${st.total} ${c.sub}</small>` : `<small class="cc-left">${st.left} of ${st.total} ${c.sub} left to find</small>${pity}`;
        return `<article class="chest-card stg cc-${id} ${st.complete ? 'complete' : ''}" style="--ac:${c.accent}">
          <div class="cc-art"><span class="cc-halo"></span>${BR.chestSVG(id, LITE)}${n > 0 ? `<em class="cc-badge">${n}</em>` : ''}</div>
          <div class="cc-info">
            <div class="cc-top"><h3 class="display">${c.name}</h3><button class="info-btn" data-act="odds" data-chest="${id}" aria-label="Odds for ${c.name}">${BR.icon('info')}</button></div>
            <p class="cc-blurb">${c.blurb}</p>
            <div class="odds-mini" title="Odds"><div class="om-bar">${mini}</div><small>${live0(odds)}</small></div>${left}
            <div class="cc-act">${action}</div>
          </div></article>`;
      }).join('');
      this.el.innerHTML = `${topbar('Shop')}<div class="scroll">
        ${BR.Coach.banner('shop')}
        ${cards}
        <h2 class="sec-title stg">How to earn Coins</h2>
        <div class="card card-pad earn stg"><ul>
          <li><span>${BR.icon('play')}</span>Finish runs: points and every stage you clear</li>
          <li><span>${BR.icon('sun')}</span>Daily Rush adds a bonus, and so does your first run each day</li>
          <li><span>${BR.icon('missions')}</span>Daily and weekly missions</li>
          <li><span>${BR.icon('trophy')}</span>Trophies and the Pop Pass</li>
        </ul></div>
      </div>`;
    },
  };

  /* ------------------------------------------------------------------ Collection */
  const Collection = {
    type: 'skin', filter: null,
    render() {
      const type = this.type;
      const have = (t) => new Set(S().profile.vault.filter((i) => BR.itemById[i.itemId].type === t).map((i) => i.itemId)).size;
      const total = (t) => BR.ITEMS.filter((i) => i.type === t).length;
      const eq = P.equipped(type);
      const segs = BR.TYPE_ORDER.map((t) => `<button data-type="${t}" class="${t === type ? 'on' : ''}">${BR.ITEM_TYPES[t].plural}<small>${have(t)}/${total(t)}</small></button>`).join('');
      const filters = BR.RARITIES.map((r) => `<button class="chip-btn ${this.filter === r.id ? 'on' : ''}" data-rar="${r.id}" style="--rc:${r.color}">${r.name}</button>`).join('');
      this.el.innerHTML = `${topbar('Collection')}<div class="scroll">
        ${BR.Coach.banner('collection')}
        <div class="seg stg" id="colSeg" style="--n:${BR.TYPE_ORDER.length};--i:${this._prev != null ? this._prev : BR.TYPE_ORDER.indexOf(type)}" data-i="${BR.TYPE_ORDER.indexOf(type)}">${segs}<i class="thumb"></i></div>
        <div class="col-head stg"><div class="eq-now" style="--rc:${R(eq.item.rarity).color}"><span class="eq-prev">${BR.Skins.previewHTML(eq.item, eq.inst)}</span><span class="eq-txt"><small>Equipped</small><b class="display">${eq.item.name}</b></span></div>
          <div class="col-prog" aria-label="Collected">${ringSVG(have(type) / total(type), 52, 6)}<b>${have(type)}<small>/${total(type)}</small></b></div></div>
        <div class="filters stg">${filters}</div>
        <div class="col-grid stg" id="colGrid">${this.gridHTML()}</div>
        <p class="tiny center">Tap an item to see it or equip it. Every chest gives something new.</p>
      </div>`;
      this.placeThumb();
      this.hydrateGrid();
    },
    placeThumb() { const seg = this.el.querySelector('#colSeg'); this._prev = BR.TYPE_ORDER.indexOf(this.type); slideThumb(seg); },
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
        ? `<div class="col-locked-head col-span"><h3>Not found yet <small>${missing.length}</small></h3><p>Tap one to see where it comes from.</p></div><div class="col-locked-grid col-span" id="colLocked">${this._lockedTiles.slice(0, FIRST_LOCKED).join('')}${missing.slice(FIRST_LOCKED).map((_, k) => `<div class="lk ph" data-k="${k + FIRST_LOCKED}"></div>`).join('')}</div>`
        : '';
      if (!out.length && !missing.length) return `<div class="empty-state col-span">${BR.icon('collection')}<p>Nothing here yet.<br>Open chests in the Shop to fill your collection.</p></div>`;
      return out.slice(0, FIRST_CARDS).join('') + out.slice(FIRST_CARDS).map((_, k) => `<div class="icard ph" data-k="${k + FIRST_CARDS}"></div>`).join('') + lockedBlock;
    },
    hydrateGrid() {
      const rest = this._rest, locked = this._lockedTiles;
      if (rest && rest.length > FIRST_CARDS) hydrate(this.el, '.icard.ph', (el) => { el.insertAdjacentHTML('afterend', rest[+el.dataset.k].replace('class="icard ', 'class="icard late ')); el.remove(); });
      if (locked && locked.length > FIRST_LOCKED) hydrate(this.el, '.lk.ph', (el) => { el.insertAdjacentHTML('afterend', locked[+el.dataset.k]); el.remove(); });
    },
    onRetap() { this.el.querySelector('.scroll').scrollTo({ top: 0, behavior: 'smooth' }); },
    onShow() { this.placeThumb(); },
  };
  /** A small tile for something you have not found: its silhouette and rarity, never its name. */
  function lockedTile(item) {
    const r = R(item.rarity);
    return `<button class="lk" data-locked="${item.id}" style="--rc:${r.color}" aria-label="${r.name} ${BR.ITEM_TYPES[item.type].name}, not found yet"><span class="lk-prev">${BR.Badge.html(item, null, { size: 52, locked: true, still: true })}</span><small>${r.name}</small></button>`;
  }
  function card(item, inst, o) {
    const r = R(item.rarity);
    const shine = inst && inst.shine !== 'plain' ? `<span class="tag shine-${inst.shine}">${BR.shineById[inst.shine].name}</span>` : '';
    return `<div class="icard ${o.eq ? 'eq' : ''}" data-uid="${inst ? inst.uid : 'default'}" data-type="${item.type}" style="--rc:${r.color};--i:${o.i}">
      ${o.eq ? `<span class="eq-flag">${BR.icon('check')}</span>` : ''}
      <div class="ic-prev">${BR.Badge.html(item, inst, { size: 64, still: true })}</div><b class="ic-name">${esc(item.name)}</b>
      <div class="ic-tags"><span class="tag rar" style="--rc:${r.color}">${r.name}</span>${shine}</div></div>`;
  }

  /** Where an item you have not found comes from. */
  BR.lockedSheet = function (itemId) {
    const item = BR.itemById[itemId];
    if (!item) return;
    const r = R(item.rarity), chest = item.pass ? null : BR.CHESTS[BR.ITEM_TYPES[item.type].chest];
    const st = chest ? P.chestStatus(BR.ITEM_TYPES[item.type].chest) : null;
    const body = `<div class="detail" style="--rc:${r.color}"><div class="detail-prev locked-prev"><span class="dp-glow"></span>${BR.Badge.html(item, null, { size: 120, locked: true, still: true })}</div>
        <div class="detail-tags"><span class="tag rar" style="--rc:${r.color}">${r.name}</span><span class="tag">${BR.ITEM_TYPES[item.type].name}</span></div>
        <p class="detail-desc">${item.pass ? 'A reward on the Pop Pass. Reach its level to get it.' : `Found in the <b>${chest.name}</b>. ${st && st.left ? `${st.left} of ${st.total} ${chest.sub} are still waiting.` : ''}`}</p>
        <div class="detail-where"><small>Comes from</small><b>${item.pass ? 'Pop Pass' : chest.name}</b></div></div>`;
    BR.Sheet.open({ title: 'Not found yet', body, actions: [{ label: item.pass ? 'See the Pop Pass' : 'Go to the Shop', cls: '', onClick: () => { if (item.pass) { Missions.tab = 'pass'; } BR.Router.go(item.pass ? 'missions' : 'shop'); } }] });
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
    const actions = [{ label: equipped ? 'Equipped' : 'Equip', cls: equipped ? 'btn-dark' : 'btn-green', disabled: equipped, onClick: () => { P.equip(inst ? inst.uid : 'default', item.type); BR.Skins.apply(); BR.audio.equip(); BR.haptic('tap'); BR.toast(`${esc(item.name)} equipped`, 'good'); BR.Router.rerender(); } }];
    let demo = null;
    const sheet = BR.Sheet.open({ title: esc(item.name), body, actions, onClose: () => { if (demo) demo.stop(); } });
    demo = BR.Openings.demo(sheet.body.querySelector('.hero-host'), item, inst || { shine: 'plain', seed: 0 }, { silent: true, power: 1.2 });
  };
  /** A trophy: what it asks for, what it pays, and whether you have it. */
  BR.trophySheet = function (id) {
    const t = BR.TROPHIES.find((x) => x.id === id);
    if (!t) return;
    const got = !!S().profile.trophies[id];
    BR.Sheet.open({ title: esc(t.name), body: `<div class="detail"><div class="reward-big trophy-art ${got ? 'got' : ''}">${BR.icon(got ? (TROPHY_ICON[id] || 'trophy') : 'lock')}</div><div class="detail-tags"><span class="tag ${got ? 'gold' : ''}">${got ? 'Earned' : 'Not yet'}</span><span class="tag gold">${BR.coin()} ${t.coins}</span></div><p class="detail-desc">${esc(t.desc)}.</p><div class="detail-where"><small>${got ? 'Reward' : 'Pays'}</small><b>${got ? 'Paid when you earned it' : t.coins + ' Coins and some XP'}</b></div></div>` });
  };
  /** What a Pop Pass tier gives: tap a tier on the track. */
  BR.rewardSheet = function (tier) {
    const r = BR.passReward(tier);
    const away = tier + 1 - P.level;
    const state = tier < P.level ? 'You have this reward.' : tier === P.level ? 'Your next reward. Finish this level to get it.' : `${away} levels to go.`;
    let title = BR.rewardLabel(r), desc = '', tags = '';
    if (r.kind === 'item') { const it = BR.itemById[r.itemId]; title = it.name; desc = it.desc; tags = `<span class="tag rar" style="--rc:${R(it.rarity).color}">${R(it.rarity).name}</span><span class="tag">${BR.ITEM_TYPES[it.type].name}</span>`; }
    else if (r.kind === 'chest') desc = BR.CHESTS[r.chest].blurb;
    else desc = 'Coins go into your balance right away.';
    BR.Sheet.open({ title: esc(title), body: `<div class="detail"><div class="reward-big">${rewardArt(r, r.kind === 'item' ? 168 : 120)}</div><div class="detail-tags"><span class="tag gold">Pass level ${tier + 1}</span>${tags}</div><p class="detail-desc">${esc(desc)}</p><div class="detail-where"><small>${tier < P.level ? 'Claimed' : tier === P.level ? 'Up next' : 'Locked'}</small><b>${state}</b></div></div>` });
  };
  /** Bigger preview for the detail sheet: a live mini board for skins/pops/boards, a burning fuse for fuses. */
  BR.detailPreview = function (item, inst) {
    if (item.type === 'fuse') return `<div class="big-fuse">${BR.Skins.previewHTML(item, inst)}</div>`;
    return `<div class="big-prev">${BR.Skins.previewHTML(item, inst)}</div>`;
  };

  /* ------------------------------------------------------------------ Missions */
  const TROPHY_ICON = { first_run: 'play', first_rush: 'fire', stage5: 'flag', stage10: 'bomb', score100k: 'star', score250k: 'star', big100: 'bolt', bricks5k: 'collection', line5: 'bolt', power25: 'bolt', defuse10: 'bomb', daily1: 'sun', chests10: 'gift', own10: 'collection', own25: 'collection', commons: 'check', mythic: 'star', complete: 'check', lv10: 'trophy' };
  const KIND_ICON = { bricks: 'collection', color: 'star', stage: 'bolt', rushRun: 'fire', big: 'star', power: 'bomb', lines: 'bolt', defuse: 'bomb', runs: 'play', dailyScore: 'sun', weeklyStage: 'bolt', weeklyBricks: 'collection' };
  const Missions = {
    tab: 'daily',
    render() {
      const m = BR.Missions.ensure();
      const seg = ['daily', 'pass', 'trophies'].map((t) => `<button data-tab="${t}" class="${t === this.tab ? 'on' : ''}">${{ daily: 'Daily', pass: 'Pop Pass', trophies: 'Trophies' }[t]}</button>`).join('');
      let body = '';
      if (this.tab === 'daily') {
        body = `<div class="reset-note stg">${BR.icon('clock')} New missions in ${resetsIn()}</div>
          ${m.list.map((x, i) => this.missionCard(x, i)).join('')}
          <h2 class="sec-title stg">Weekly challenge</h2>
          <article class="mission weekly stg ${m.weekly.done ? 'done' : ''}"><span class="m-ico">${BR.icon(KIND_ICON[m.weekly.kind])}</span>
            <div class="m-body"><b class="m-text">${esc(m.weekly.text)}</b><div class="bar gold"><i style="width:${(m.weekly.progress / m.weekly.target) * 100}%"></i></div><small class="num">${fmt(m.weekly.progress)} / ${fmt(m.weekly.target)}</small></div>
            <div class="m-reward gold-r"><span class="rw-ico chest sm">${BR.chestSVG('golden', LITE)}</span><b>${BR.coin()} ${m.weekly.reward}</b><small>+ Golden Chest</small></div></article>`;
      } else if (this.tab === 'pass') body = this.passHTML();
      else body = this.trophiesHTML();
      this.el.innerHTML = `${topbar('Missions')}<div class="scroll">${this.tab === 'daily' ? BR.Coach.banner('missions') : ''}<div class="seg stg" id="misSeg" style="--n:3;--i:${this._prev != null ? this._prev : ['daily', 'pass', 'trophies'].indexOf(this.tab)}" data-i="${['daily', 'pass', 'trophies'].indexOf(this.tab)}">${seg}<i class="thumb"></i></div>${body}</div>`;
      this.placeThumb();
      if (this.tab === 'pass') { this.centerTrack(false); this.hydrateTrack(); }
      BR.Router.screens.missions.hasDot();
    },
    missionCard(x, i) {
      const can = BR.Missions.canReroll(i);
      return `<article class="mission stg ${x.done ? 'done' : ''}"><span class="m-ico">${x.done ? BR.icon('check') : BR.icon(KIND_ICON[x.kind])}</span>
        <div class="m-body"><b class="m-text">${esc(x.text)}</b><div class="bar green"><i style="width:${(x.progress / x.target) * 100}%"></i></div><small class="num">${fmt(x.progress)} / ${fmt(x.target)}</small></div>
        <div class="m-reward"><b>${BR.coin()} ${x.reward}</b>${x.done ? '<small>Paid</small>' : can ? `<button class="reroll" data-act="reroll" data-i="${i}" aria-label="Swap this mission for ${BR.CFG.rerollCost} Coins">${BR.icon('reroll')}<small>${BR.CFG.rerollCost}</small></button>` : ''}</div></article>`;
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
        return `<div class="pt ${state} ${big(t) ? 'big' : ''}" data-tier="${t.tier}"><span class="pt-n"><b>${t.tier + 1}</b></span>
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
        <div class="track-wrap stg"><div class="track" id="passTrack">${tiers}<div class="pt more"><span class="pt-n"><b>+</b></span><div class="pt-card"><span class="pt-coin" style="--sz:52px">${BR.coin()}</span><span class="pt-label">Every level after ${BR.CFG.passTiers + 1}</span></div></div></div></div>`;
    },
    trophiesHTML() {
      const got = S().profile.trophies;
      const n = Object.keys(got).length;
      return `<div class="reset-note stg">${BR.icon('trophy')} ${n} of ${BR.TROPHIES.length} earned</div>` + BR.TROPHIES.map((t) => `<button class="trophy stg ${got[t.id] ? 'got' : ''}" data-trophy="${t.id}"><span class="tr-ico">${BR.icon(got[t.id] ? (TROPHY_ICON[t.id] || 'trophy') : 'lock')}</span><div class="tr-body"><b>${t.name}</b><small>${t.desc}</small></div><span class="tr-rw">${got[t.id] ? BR.icon('check') : BR.coin() + '<b>' + t.coins + '</b>'}</span></button>`).join('');
    },
    placeThumb() { const seg = this.el.querySelector('#misSeg'); this._prev = ['daily', 'pass', 'trophies'].indexOf(this.tab); slideThumb(seg); },
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
    hasDot() { const m = BR.Missions.ensure(); document.getElementById('dotMissions').classList.toggle('show', false && m.list.some((x) => !x.done)); },
    onShow() {
      this.placeThumb();
      if (this.tab === 'pass') this.centerTrack(true);
    },
  };

  /* ------------------------------------------------------------------ Profile */
  const Profile = {
    render() {
      const st = S(), pr = st.profile, set = st.settings;
      const tog = (key, label, sub) => `<label class="toggle"><span><b>${label}</b><small>${sub}</small></span><input type="checkbox" data-set="${key}" ${set[key] ? 'checked' : ''}><i></i></label>`;
      const earned = BR.TROPHIES.filter((t) => pr.trophies[t.id]);
      const vol = (key, gate) => `<label class="vol ${set[gate] ? '' : 'off'}"><span>Volume</span><input type="range" min="0" max="100" step="5" value="${Math.round((set[key] == null ? 1 : set[key]) * 100)}" data-vol="${key}" aria-label="${key === 'sfxVol' ? 'Sound effects' : 'Music'} volume"><b class="num">${Math.round((set[key] == null ? 1 : set[key]) * 100)}</b></label>`;
      const stat = (label, val) => `<div class="stat"><b class="num">${val}</b><small>${label}</small></div>`;
      const installRow = BR.App && BR.App.canInstall() ? `<article class="card card-pad install stg"><div><b class="display">Play it like an app</b><small>Add Pop Rush to your home screen. It works offline.</small></div><button class="btn btn-sm" data-act="install">Add</button></article>` : '';
      this.el.innerHTML = `${topbar('Profile')}<div class="scroll">
        ${BR.Coach.banner('profile')}
        <article class="card prof-hero stg"><div class="ph-ring">${ringSVG(P.xp / P.need, 96, 8)}<b class="display">${P.level}</b></div>
          <div class="ph-info"><label class="ph-name"><span class="sr-only">Your name</span><input class="display" type="text" maxlength="14" value="${esc(pr.name || 'Player')}" data-name autocomplete="off" autocapitalize="words" spellcheck="false" aria-label="Your name"></label><small>Level ${P.level}</small><div class="bar cyan"><i style="width:${(P.xp / P.need) * 100}%"></i></div><small class="num">${fmt(P.need - P.xp)} XP to level ${P.level + 1}</small></div></article>
        <div class="stats-grid stg">${stat('Best Rush', fmt(st.best.rush))}${stat('Best stage', st.bestStage.rush || '-')}${stat('Best Daily', fmt(st.best.daily))}${stat('Runs played', fmt(st.runs))}${stat('Bricks popped', fmt(pr.stats.bricks))}${stat('Biggest pop', pr.stats.maxGroup || '-')}</div>
        <article class="card card-pad stg"><div class="sec-title">Trophies <small>${earned.length}/${BR.TROPHIES.length}</small></div><div class="badges">${earned.length ? earned.slice(-6).map((t) => `<span class="badge-ico" title="${t.name}">${BR.icon('trophy')}</span>`).join('') : '<small class="muted">Finish runs to earn trophies.</small>'}</div></article>
        ${installRow}
        <article class="card card-pad stg"><div class="sec-title">Settings</div>
          ${tog('sound', 'Sound effects', 'Pops, chests and the fuse')}${vol('sfxVol', 'sound')}${tog('music', 'Music', 'The beat speeds up with the fuse')}${vol('musicVol', 'music')}${tog('haptics', 'Vibration', 'Buzz on pops and chest openings')}${tog('shake', 'Screen shake', 'Impact on big pops')}${tog('shapes', 'Shape hints', 'Symbols on bricks for color-blind play')}${tog('reduced', 'Reduce motion', 'Calmer, shorter animations')}
          <div class="perf"><div><b>Performance</b><small>Auto lowers effects if your phone struggles</small></div><div class="seg mini" id="perfSeg" style="--n:3;--i:${['auto', 'high', 'low'].indexOf(set.perf)}">${['auto', 'high', 'low'].map((p) => `<button data-perf="${p}" class="${set.perf === p ? 'on' : ''}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}<i class="thumb"></i></div></div>
        </article>
        <article class="card card-pad stg help-card"><div class="sec-title">Help</div><p class="tiny">New to something? Every part of the game shows a short tip the first time. Show them all again:</p><button class="btn btn-dark btn-sm" data-act="tips">Show the tips again</button></article>
        <article class="card card-pad stg"><div class="sec-title">Data</div><p class="tiny">Your progress is saved on this device.</p><button class="btn btn-dark btn-sm danger" data-act="reset">Reset all progress</button></article>
        <p class="tiny center version">Pop Rush 3.0 · Carnival</p>
      </div>`;
    },
    onShow() { },
  };

  /* ------------------------------------------------------------------ events + registration */
  function bind(screen, handler) {
    screen.el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act],[data-type],[data-rar],[data-tab],[data-uid],[data-perf],[data-tier],[data-trophy],[data-locked]');
      if (!t || !screen.el.contains(t)) return;
      handler(t, e);
    });
  }
  const common = (a, t) => {
    switch (a) {
      case 'go-profile': BR.Router.go('profile'); return true;
      case 'go-shop': BR.Router.go('shop'); return true;
      case 'go-coins': BR.coinSheet(); return true;
      case 'close-tip': BR.Coach.dismiss(t.dataset.tip); { const bar = t.closest('.tipbar'); if (bar) bar.remove(); } return true;
      case 'go-missions': Missions.tab = 'daily'; BR.Router.go('missions'); return true;
      case 'go-pass': Missions.tab = 'pass'; BR.Router.go('missions'); return true;
      case 'odds': BR.showOdds(t.dataset.chest); return true;
    }
    return false;
  };

  BR.initScreens = function () {
    const reg = (id, obj) => BR.Router.register(id, obj);
    reg('home', Home); reg('shop', Shop); reg('collection', Collection); reg('missions', Missions); reg('profile', Profile);

    bind(Home, (t) => {
      const a = t.dataset.act;
      if (common(a, t)) return;
      BR.audio.ui(); BR.haptic('tap');
      if (a === 'play-rush') { if (S().runs < BR.CFG.boostsFromRun) BR.App.startRun({ mode: 'rush', boosts: {} }); else BR.readySheet('rush'); }   // the first runs start at once: Boosts need Coins, and a new player has not played yet
      else if (a === 'play-daily') { if (S().daily.day === BR.dayKey()) { BR.toast('You already played today. Come back tomorrow!'); return; } BR.readySheet('daily'); }
      else if (a === 'play-chill') { if (P.level < BR.CFG.chill.unlockLevel) { BR.toast(`Chill unlocks at level ${BR.CFG.chill.unlockLevel}`); BR.haptic('err'); return; } BR.readySheet('chill'); }
      else if (a === 'resume') BR.App.resume();
    });
    bind(Shop, (t) => {
      const a = t.dataset.act;
      if (common(a, t)) return;
      if (a === 'open') {
        const id = t.dataset.chest;
        if (!P.canOpen(id)) { BR.toast('Not enough Coins. Play a run to earn more!', 'bad'); BR.haptic('err'); BR.audio.deny(); return; }
        BR.audio.ui(); BR.haptic('tap'); BR.App.openChest(id);
      }
    });
    Shop.el.addEventListener('click', (e) => { if (e.target.closest('[data-act="toggle-inside"]')) toggleInside(e.target.closest('.odds')); });
    bind(Collection, (t) => {
      if (t.dataset.type && t.closest('#colSeg')) { Collection.type = t.dataset.type; Collection.filter = null; BR.audio.ui(); BR.Router.rerender(); Collection.placeThumb(); return; }
      if (t.dataset.rar) { Collection.filter = Collection.filter === t.dataset.rar ? null : t.dataset.rar; BR.audio.ui(); BR.Router.rerender(); return; }
      const a = t.dataset.act;
      if (common(a, t)) return;
      if (t.dataset.locked) { BR.audio.ui(); BR.haptic('tick'); BR.lockedSheet(t.dataset.locked); return; }
      if (t.dataset.uid) { BR.audio.ui(); BR.haptic('tick'); BR.itemSheet(t.dataset.uid, t.dataset.type); }
    });
    bind(Missions, (t) => {
      if (t.dataset.tab) { Missions.tab = t.dataset.tab; BR.audio.ui(); BR.Router.rerender(); Missions.placeThumb(); Missions.onShow(); BR.Coach.onScreen('missions'); return; }
      if (t.dataset.tier) { BR.audio.ui(); BR.haptic('tick'); BR.rewardSheet(+t.dataset.tier); return; }
      if (t.dataset.trophy) { BR.audio.ui(); BR.haptic('tick'); BR.trophySheet(t.dataset.trophy); return; }
      if (t.dataset.act === 'close-tip') { common('close-tip', t); return; }
      if (t.dataset.act === 'reroll') {
        if (BR.Missions.reroll(+t.dataset.i)) { BR.audio.scrap(); BR.toast('New mission!', 'good'); BR.Router.rerender(); } else BR.toast('Not enough Coins', 'bad');
      }
    });
    bind(Profile, (t) => {
      if (t.dataset.act === 'close-tip') { common('close-tip', t); return; }
      if (t.dataset.perf) { S().settings.perf = t.dataset.perf; BR.Storage.save(); BR.App.applySettings(); BR.Router.rerender(); return; }
      const a = t.dataset.act;
      if (a === 'install') BR.App.install();
      if (a === 'tips') { BR.Coach.reset(); BR.audio.ui(); BR.toast('Tips will show again as you visit each screen', 'good'); }
      if (a === 'reset') {
        if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = 'Tap again to erase everything'; setTimeout(() => { t.dataset.armed = ''; t.textContent = 'Reset all progress'; }, 3500); return; }
        BR.Storage.reset(); BR.App.applySettings(); BR.Skins.apply(); BR.toast('Progress reset'); BR.Router.rerender();
      }
    });
    Profile.el.addEventListener('input', (e) => {
      const k = e.target.dataset.vol; if (!k) return;
      const v = +e.target.value / 100; S().settings[k] = v; e.target.parentNode.querySelector('b').textContent = Math.round(v * 100);
      BR.App.applySettings();
    });
    Profile.el.addEventListener('change', (e) => {
      if (e.target.dataset.name !== undefined) { const v = e.target.value.replace(/[<>&"]/g, '').trim().slice(0, 14) || 'Player'; e.target.value = v; S().profile.name = v; BR.Storage.save(); return; }
      if (e.target.dataset.vol) { BR.Storage.save(); if (BR.audio && BR.audio.ui) BR.audio.ui(); return; }
      if (e.target.dataset.set === 'music' && e.target.checked && BR.Music) setTimeout(() => BR.Music.start('menu'), 50);
      const k = e.target.dataset.set;
      if (!k) return;
      S().settings[k] = e.target.checked; BR.Storage.save(); BR.App.applySettings(); BR.audio.ui(); BR.haptic('tap');
    });
  };
})();
