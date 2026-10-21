/* The five tab screens (Play, Shop, Collection, Missions, Profile) plus the shared sheets
   (odds, ready-to-play, item detail). Screens re-render from state; events use delegation. */
(function () {
  const BR = (window.BR = window.BR || {});
  const { fmt, esc } = BR;
  const S = () => BR.Storage.data;
  const P = BR.Progress;
  const R = (id) => BR.rarityById[id];
  const ringSVG = (frac, size = 44, w = 5) => {
    const r = (size - w) / 2, c = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg" stroke-width="${w}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-width="${w}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - Math.max(0, Math.min(1, frac)))).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  };
  BR.ringSVG = ringSVG;

  const topbar = (title) => `<header class="topbar">
      <button class="lvl-badge" data-act="go-profile" aria-label="Level ${P.level}">${ringSVG(P.xp / P.need, 48, 5)}<b>${P.level}</b></button>
      ${title ? `<h1>${title}</h1>` : '<div style="flex:1"></div>'}
      <button class="pill gold coin-btn" data-act="go-shop" aria-label="Coins">${BR.coin()}<b class="num" data-coins>${fmt(P.coins)}</b><i>${BR.icon('plus')}</i></button>
    </header>`;

  const resetsIn = () => { const n = new Date(), m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); const s = Math.max(0, Math.floor((m - n) / 1000)); const h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60); return `${h}h ${String(mi).padStart(2, '0')}m`; };

  /** Reward art/label for the Pass, missions and sheets. */
  function rewardChip(r, big) {
    if (r.kind === 'coins') return `<span class="rw-ico coins">${BR.coin()}</span><span class="rw-txt"><b>${r.amount}</b> Coins</span>`;
    if (r.kind === 'chest') return `<span class="rw-ico chest">${BR.chestSVG(r.chest)}</span><span class="rw-txt"><b>${BR.CHESTS[r.chest].name}</b></span>`;
    const it = BR.itemById[r.itemId];
    return `<span class="rw-ico item" style="--rc:${R(it.rarity).color}">${BR.Skins.previewHTML(it, { shine: r.shine, seed: 7 })}</span><span class="rw-txt"><b>${it.name}</b> ${R(it.rarity).name} ${BR.ITEM_TYPES[it.type].name}</span>`;
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
        <div class="od-pct"><b>${fmtPct(r.pct)}</b><small>1 in ${r.oneIn}</small></div></div>`).join('') + done.map((r) => `<div class="odds-row done" style="--rc:${r.rarity.color}"><i class="od-chip"></i><div class="od-name"><b>${r.rarity.name}</b><small>You own all ${r.total}</small></div><div class="od-pct"><b>${BR.icon('check')}</b></div></div>`).join('');
    const inside = rows.filter((r) => r.total > 0).map((r) => `<div class="inside-grp" style="--rc:${r.rarity.color}"><h4>${r.rarity.name}</h4><div class="inside-items">${r.items.map((x) => `<div class="inside-item ${P.owns(x.id) ? 'own' : ''}">${P.owns(x.id) ? BR.icon('check') : ''}<span>${x.name}</span></div>`).join('')}</div></div>`).join('');
    const chips = opts.compact ? `<div class="odds-chips">${live.map((r) => `<div class="oc" style="--rc:${r.rarity.color}"><b>${fmtPct(r.pct)}</b><span>${r.rarity.name}</span><small>1 in ${r.oneIn}</small></div>`).join('')}</div>` : '';
    return `<div class="odds ${opts.compact ? 'compact' : ''}">
      <p class="odds-sentence">${BR.oddsSentence(chestId, type, P.ownedIds(), opts.pityIn)}</p>
      <div class="odds-bar" role="img" aria-label="Odds bar">${bar}</div>${chips}
      ${opts.compact ? '' : `<div class="odds-rows">${list}</div>
      <button class="odds-more" data-act="toggle-inside">See everything inside <i>${BR.icon('arrow')}</i></button>
      <div class="inside">${inside}</div>`}</div>`;
  };
  const fmtPct = (p) => (p >= 10 ? Math.round(p) : p.toFixed(p < 1 ? 1 : 0)) + '%';

  BR.showOdds = function (chestId) {
    let type = BR.CHESTS[chestId].type;
    const sh = BR.Sheet.open({ title: `${BR.CHESTS[chestId].name} odds`, body: `<div class="chest-mini">${BR.chestSVG(chestId)}</div>${BR.oddsHTML(chestId, type || 'skin', { pityIn: P.chestStatus(chestId).pityIn })}` });
    sh.el.addEventListener('click', (e) => { if (e.target.closest('[data-act="toggle-inside"]')) sh.el.querySelector('.odds').classList.toggle('open'); });
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
      const dailyDone = st.daily.day === today;
      const chillOpen = P.level >= BR.CFG.chill.unlockLevel;
      const nextTier = P.level, reward = BR.passReward(nextTier);
      const m = BR.Missions.ensure();
      const resume = BR.Storage.loadRun();
      const owned = P.totalChests();
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
            <span class="hero-stats"><span><small>Best</small><b class="num">${fmt(st.best.rush)}</b></span><span><small>Stage</small><b class="num">${st.bestStage.rush || '-'}</b></span></span>
          </span>
          <span class="btn btn-gold btn-xl hero-play">Play</span>
        </button>
        <div class="row2 stg">
          <button class="mode-card daily ${dailyDone ? 'done' : ''}" data-act="play-daily">
            <span class="mc-ico"><span class="cal"><small>${new Date().toLocaleString('en-US', { month: 'short' })}</small><b>${new Date().getDate()}</b></span></span>
            <span class="mc-title display">Daily Rush</span>
            <span class="mc-sub">${dailyDone ? `Done · ${fmt(st.daily.score)}` : 'Same board for everyone. Bonus Coins.'}</span>
            <span class="tag ${dailyDone ? '' : 'gold'}">${dailyDone ? BR.icon('check') + ' Come back tomorrow' : '+15 Coins'}</span>
          </button>
          <button class="mode-card chill ${chillOpen ? '' : 'locked'}" data-act="play-chill">
            <span class="mc-ico">${BR.icon('leaf')}</span>
            <span class="mc-title display">Chill</span>
            <span class="mc-sub">20 moves a round. No clock.</span>
            ${chillOpen ? `<span class="tag">Best ${fmt(st.best.chill)}</span>` : `<span class="lock-badge">${BR.icon('lock')} Level ${BR.CFG.chill.unlockLevel}</span>`}
          </button>
        </div>
        ${owned ? `<button class="banner stg" data-act="go-shop"><span class="bn-ico">${BR.icon('gift')}</span><span class="bn-txt"><b>You have ${owned} chest${owned > 1 ? 's' : ''} to open</b><small>Free to open. Tap to see.</small></span><span class="bn-go">${BR.icon('arrow')}</span></button>` : ''}
        <button class="card pass-card stg" data-act="go-pass">
          <div class="pc-head"><span class="pc-title display">Pop Pass</span><span class="tag">Level ${P.level}</span></div>
          <div class="pc-body"><div class="pc-reward">${rewardChip(reward)}</div><div class="pc-next"><small>Next reward</small><div class="bar"><i style="width:${(P.xp / P.need) * 100}%"></i></div><small>${fmt(P.need - P.xp)} XP to go</small></div></div>
        </button>
        <button class="card mission-card stg" data-act="go-missions">
          <div class="pc-head"><span class="pc-title display">Today's missions</span><span class="tag">${m.list.filter((x) => x.done).length}/3 done</span></div>
          ${m.list.map((x) => `<div class="mrow ${x.done ? 'done' : ''}"><span class="mr-text">${x.done ? BR.icon('check') : ''}${esc(x.text)}</span><div class="bar green"><i style="width:${(x.progress / x.target) * 100}%"></i></div></div>`).join('')}
        </button>
      </div>`;
      BR.Skins.apply();
    },
    onShow() { this.tick = setInterval(() => this.refreshCoins(), 1500); },
    onHide() { clearInterval(this.tick); },
    refreshCoins() { document.querySelectorAll('[data-coins]').forEach((n) => { n.textContent = fmt(P.coins); }); },
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
    start.querySelector('button').addEventListener('click', () => {
      const chosen = {};
      picked.forEach((id) => { chosen[id] = true; });
      const t = total();
      if (t > 0) { if (!P.spend(t)) { BR.toast('Not enough Coins', 'bad'); return; } BR.audio.coin && BR.audio.coin(1); BR.toast(`Paid ${t} Coins for ${[...picked].map((id) => cfg[id].name).join(' and ')}`, 'good'); }
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
        const left = c.golden ? '' : st.complete ? `<small class="cc-left">You own all ${st.total} ${c.sub}</small>` : `<small class="cc-left">${st.left} of ${st.total} ${c.sub} left to find${st.pityIn ? ` · Epic or better in ${st.pityIn}` : ''}</small>`;
        return `<article class="chest-card stg cc-${id} ${st.complete ? 'complete' : ''}" style="--ac:${c.accent}">
          <div class="cc-art"><span class="cc-halo"></span>${BR.chestSVG(id)}${n > 0 ? `<em class="cc-badge">${n}</em>` : ''}</div>
          <div class="cc-info">
            <div class="cc-top"><h3 class="display">${c.name}</h3><button class="info-btn" data-act="odds" data-chest="${id}" aria-label="Odds for ${c.name}">${BR.icon('info')}</button></div>
            <span class="tag" style="--rc:${c.accent}">${c.sub}</span>
            <p class="cc-blurb">${c.blurb}</p>
            <div class="odds-mini" title="Odds"><div class="om-bar">${mini}</div><small>${live0(odds)}</small></div>${left}
            <div class="cc-act">${action}</div>
          </div></article>`;
      }).join('');
      this.el.innerHTML = `${topbar('Shop')}<div class="scroll">
        <p class="shop-intro stg">Every chest holds one item you do not own yet. The odds are always shown, and Coins come from playing.</p>
        ${cards}
        <h2 class="sec-title stg">Run boosts <small>Pick them before a run</small></h2>
        <div class="boost-info stg">${Object.values(BR.CFG.boosts).map((b) => `<div class="bi"><span class="bo-ico">${BR.icon(BOOST_ICON[b.id])}</span><b>${b.name}</b><small>${b.desc}</small><span class="bo-cost">${BR.coin()}<b>${b.cost}</b></span></div>`).join('')}</div>
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
        <div class="seg stg" id="colSeg">${segs}<i class="thumb"></i></div>
        <div class="col-head stg"><div class="eq-now" style="--rc:${R(eq.item.rarity).color}"><span class="eq-prev">${BR.Skins.previewHTML(eq.item, eq.inst)}</span><span class="eq-txt"><small>Equipped</small><b class="display">${eq.item.name}</b></span></div>
          <div class="col-prog" aria-label="Collected">${ringSVG(have(type) / total(type), 52, 6)}<b>${have(type)}<small>/${total(type)}</small></b></div></div>
        <div class="filters stg">${filters}</div>
        <div class="col-grid stg" id="colGrid">${this.gridHTML()}</div>
        <p class="tiny center">Tap an item to see it or equip it. Every chest gives something new.</p>
      </div>`;
      this.placeThumb();
    },
    placeThumb() {
      const seg = this.el.querySelector('#colSeg'); if (!seg) return;
      const on = seg.querySelector('button.on'), th = seg.querySelector('.thumb');
      th.style.width = on.offsetWidth + 'px'; th.style.transform = `translateX(${on.offsetLeft - 4}px)`;
    },
    gridHTML() {
      const type = this.type, vault = S().profile.vault;
      const order = BR.RARITIES.map((r) => r.id);
      const byR = (a, b) => order.indexOf(b.rarity) - order.indexOf(a.rarity) || a.name.localeCompare(b.name);
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
      for (const item of BR.itemsOfType(type).sort(byR)) {
        if (have.has(item.id) || (this.filter && this.filter !== item.rarity)) continue;
        out.push(card(item, null, { i: i++, locked: true }));
      }
      if (!out.length) return `<div class="empty-state col-span">${BR.icon('collection')}<p>Nothing here yet.<br>Open chests in the Shop to fill your collection.</p></div>`;
      return out.join('');
    },
    onRetap() { this.el.querySelector('.scroll').scrollTo({ top: 0, behavior: 'smooth' }); },
    onShow() { this.placeThumb(); },
  };
  function card(item, inst, o) {
    const r = R(item.rarity);
    const shine = inst && inst.shine !== 'plain' ? `<span class="tag shine-${inst.shine}">${BR.shineById[inst.shine].name}</span>` : '';
    if (o.locked) return `<div class="icard locked" style="--rc:${r.color};--i:${o.i}"><div class="ic-prev"><span class="q">?</span></div><b class="ic-name">???</b><span class="tag rar" style="--rc:${r.color}">${r.name}</span><small class="ic-hint">${BR.CHESTS[BR.ITEM_TYPES[item.type].chest].name}${item.pass ? ' · Pop Pass' : ''}</small></div>`;
    return `<div class="icard ${o.eq ? 'eq' : ''}" data-uid="${inst ? inst.uid : 'default'}" data-type="${item.type}" style="--rc:${r.color};--i:${o.i}">
      ${o.eq ? `<span class="eq-flag">${BR.icon('check')}</span>` : ''}
      <div class="ic-prev">${BR.Skins.previewHTML(item, inst)}</div><b class="ic-name">${esc(item.name)}</b>
      <div class="ic-tags"><span class="tag rar" style="--rc:${r.color}">${r.name}</span>${shine}</div></div>`;
  }

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
  /** Bigger preview for the detail sheet: a live mini board for skins/pops/boards, a burning fuse for fuses. */
  BR.detailPreview = function (item, inst) {
    if (item.type === 'fuse') return `<div class="big-fuse">${BR.Skins.previewHTML(item, inst)}</div>`;
    return `<div class="big-prev">${BR.Skins.previewHTML(item, inst)}</div>`;
  };

  /* ------------------------------------------------------------------ Missions */
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
            <div class="m-reward gold-r"><span class="rw-ico chest sm">${BR.chestSVG('golden')}</span><b>${BR.coin()} ${m.weekly.reward}</b><small>+ Golden Chest</small></div></article>`;
      } else if (this.tab === 'pass') body = this.passHTML();
      else body = this.trophiesHTML();
      this.el.innerHTML = `${topbar('Missions')}<div class="scroll"><div class="seg stg" id="misSeg">${seg}<i class="thumb"></i></div>${body}</div>`;
      this.placeThumb();
      BR.Router.screens.missions.hasDot();
    },
    missionCard(x, i) {
      const can = BR.Missions.canReroll(i);
      return `<article class="mission stg ${x.done ? 'done' : ''}"><span class="m-ico">${x.done ? BR.icon('check') : BR.icon(KIND_ICON[x.kind])}</span>
        <div class="m-body"><b class="m-text">${esc(x.text)}</b><div class="bar green"><i style="width:${(x.progress / x.target) * 100}%"></i></div><small class="num">${fmt(x.progress)} / ${fmt(x.target)}</small></div>
        <div class="m-reward"><b>${BR.coin()} ${x.reward}</b>${x.done ? '<small>Paid</small>' : can ? `<button class="reroll" data-act="reroll" data-i="${i}" aria-label="Swap this mission for ${BR.CFG.rerollCost} Coins">${BR.icon('reroll')}<small>${BR.CFG.rerollCost}</small></button>` : ''}</div></article>`;
    },
    passHTML() {
      const tiers = BR.PASS.map((t) => {
        const state = t.tier < P.level ? 'claimed' : t.tier === P.level ? 'next' : 'locked';
        return `<div class="tier ${state}" data-tier="${t.tier}"><span class="t-node"><b>${t.tier}</b></span><div class="t-card">${BR.rewardChip(t)}${state === 'claimed' ? `<i class="t-ck">${BR.icon('check')}</i>` : state === 'locked' ? `<i class="t-lk">${BR.icon('lock')}</i>` : `<span class="tag hot">Next</span>`}</div></div>`;
      }).join('');
      return `<article class="card pass-head stg"><div><span class="display ph-t">Pop Pass</span><small>Free. One reward for every level.</small></div><div class="ph-lvl">${ringSVG(P.xp / P.need, 64, 6)}<b>${P.level}</b></div></article>
        <div class="xp-line stg"><div class="bar tall cyan"><i style="width:${(P.xp / P.need) * 100}%"></i></div><small class="num">${fmt(P.xp)} / ${fmt(P.need)} XP to level ${P.level + 1}</small></div>
        <div class="tiers stg">${tiers}<div class="tier more"><span class="t-node"><b>+</b></span><div class="t-card"><span class="rw-txt"><b>Every level after 30</b> 100 Coins</span></div></div></div>`;
    },
    trophiesHTML() {
      const got = S().profile.trophies;
      const n = Object.keys(got).length;
      return `<div class="reset-note stg">${BR.icon('trophy')} ${n} of ${BR.TROPHIES.length} earned</div>` + BR.TROPHIES.map((t) => `<article class="trophy stg ${got[t.id] ? 'got' : ''}"><span class="tr-ico">${BR.icon(got[t.id] ? 'trophy' : 'lock')}</span><div class="tr-body"><b>${t.name}</b><small>${t.desc}</small></div><span class="tr-rw">${BR.coin()}<b>${t.coins}</b></span></article>`).join('');
    },
    placeThumb() {
      const seg = this.el.querySelector('#misSeg'); if (!seg) return;
      const on = seg.querySelector('button.on'), th = seg.querySelector('.thumb');
      th.style.width = on.offsetWidth + 'px'; th.style.transform = `translateX(${on.offsetLeft - 4}px)`;
    },
    hasDot() { const m = BR.Missions.ensure(); document.getElementById('dotMissions').classList.toggle('show', false && m.list.some((x) => !x.done)); },
    onShow() {
      this.placeThumb();
      if (this.tab === 'pass') setTimeout(() => { const t = this.el.querySelector('.tier.next'); if (t) t.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 450);
    },
  };

  /* ------------------------------------------------------------------ Profile */
  const Profile = {
    render() {
      const st = S(), pr = st.profile, set = st.settings;
      const tog = (key, label, sub) => `<label class="toggle"><span><b>${label}</b><small>${sub}</small></span><input type="checkbox" data-set="${key}" ${set[key] ? 'checked' : ''}><i></i></label>`;
      const earned = BR.TROPHIES.filter((t) => pr.trophies[t.id]);
      const stat = (label, val) => `<div class="stat"><b class="num">${val}</b><small>${label}</small></div>`;
      const installRow = BR.App && BR.App.canInstall() ? `<article class="card card-pad install stg"><div><b class="display">Play it like an app</b><small>Add Pop Rush to your home screen. It works offline.</small></div><button class="btn btn-sm" data-act="install">Add</button></article>` : '';
      this.el.innerHTML = `${topbar('Profile')}<div class="scroll">
        <article class="card prof-hero stg"><div class="ph-ring">${ringSVG(P.xp / P.need, 96, 8)}<b class="display">${P.level}</b></div>
          <div class="ph-info"><span class="display ph-name">Player</span><small>Level ${P.level}</small><div class="bar cyan"><i style="width:${(P.xp / P.need) * 100}%"></i></div><small class="num">${fmt(P.need - P.xp)} XP to level ${P.level + 1}</small></div></article>
        <div class="stats-grid stg">${stat('Best Rush', fmt(st.best.rush))}${stat('Best stage', st.bestStage.rush || '-')}${stat('Best Daily', fmt(st.best.daily))}${stat('Runs played', fmt(st.runs))}${stat('Bricks popped', fmt(pr.stats.bricks))}${stat('Biggest pop', pr.stats.maxGroup || '-')}</div>
        <article class="card card-pad stg"><div class="sec-title">Trophies <small>${earned.length}/${BR.TROPHIES.length}</small></div><div class="badges">${earned.length ? earned.slice(-6).map((t) => `<span class="badge-ico" title="${t.name}">${BR.icon('trophy')}</span>`).join('') : '<small class="muted">Finish runs to earn trophies.</small>'}</div></article>
        ${installRow}
        <article class="card card-pad stg"><div class="sec-title">Settings</div>
          ${tog('sound', 'Sound effects', 'Pops, chests and the fuse')}${tog('music', 'Music', 'The fuse gets faster, so does the beat')}${tog('haptics', 'Vibration', 'Buzz on pops and chest openings')}${tog('shake', 'Screen shake', 'Impact on big pops')}${tog('shapes', 'Shape hints', 'Symbols on bricks for color-blind play')}${tog('reduced', 'Reduce motion', 'Calmer, shorter animations')}
          <div class="perf"><div><b>Performance</b><small>Auto lowers effects if your phone struggles</small></div><div class="seg mini" id="perfSeg">${['auto', 'high', 'low'].map((p) => `<button data-perf="${p}" class="${set.perf === p ? 'on' : ''}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}<i class="thumb"></i></div></div>
        </article>
        <article class="card card-pad stg"><div class="sec-title">Data</div><p class="tiny">Your progress is saved on this device.</p><button class="btn btn-dark btn-sm danger" data-act="reset">Reset all progress</button></article>
        <p class="tiny center version">Pop Rush 2.0</p>
      </div>`;
      const seg = this.el.querySelector('#perfSeg');
      if (seg) { const on = seg.querySelector('button.on'), th = seg.querySelector('.thumb'); requestAnimationFrame(() => { th.style.width = on.offsetWidth + 'px'; th.style.transform = `translateX(${on.offsetLeft - 4}px)`; }); }
    },
    onShow() { const seg = this.el.querySelector('#perfSeg'); if (seg) { const on = seg.querySelector('button.on'), th = seg.querySelector('.thumb'); th.style.width = on.offsetWidth + 'px'; th.style.transform = `translateX(${on.offsetLeft - 4}px)`; } },
  };

  /* ------------------------------------------------------------------ events + registration */
  function bind(screen, handler) {
    screen.el.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act],[data-type],[data-rar],[data-tab],[data-uid],[data-perf]');
      if (!t || !screen.el.contains(t)) return;
      handler(t, e);
    });
  }
  const common = (a, t) => {
    switch (a) {
      case 'go-profile': BR.Router.go('profile'); return true;
      case 'go-shop': BR.Router.go('shop'); return true;
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
      if (a === 'play-rush') BR.readySheet('rush');
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
    Shop.el.addEventListener('click', (e) => { if (e.target.closest('[data-act="toggle-inside"]')) e.target.closest('.odds').classList.toggle('open'); });
    bind(Collection, (t) => {
      if (t.dataset.type && t.closest('#colSeg')) { Collection.type = t.dataset.type; Collection.filter = null; BR.audio.ui(); BR.Router.rerender(); Collection.placeThumb(); return; }
      if (t.dataset.rar) { Collection.filter = Collection.filter === t.dataset.rar ? null : t.dataset.rar; BR.audio.ui(); BR.Router.rerender(); return; }
      const a = t.dataset.act;
      if (common(a, t)) return;
      if (t.dataset.uid) { BR.audio.ui(); BR.haptic('tick'); BR.itemSheet(t.dataset.uid, t.dataset.type); }
    });
    bind(Missions, (t) => {
      if (t.dataset.tab) { Missions.tab = t.dataset.tab; BR.audio.ui(); BR.Router.rerender(); Missions.placeThumb(); Missions.onShow(); return; }
      if (t.dataset.act === 'reroll') {
        if (BR.Missions.reroll(+t.dataset.i)) { BR.audio.scrap(); BR.toast('New mission!', 'good'); BR.Router.rerender(); } else BR.toast('Not enough Coins', 'bad');
      }
    });
    bind(Profile, (t) => {
      if (t.dataset.perf) { S().settings.perf = t.dataset.perf; BR.Storage.save(); BR.App.applySettings(); BR.Router.rerender(); return; }
      const a = t.dataset.act;
      if (a === 'install') BR.App.install();
      if (a === 'reset') {
        if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = 'Tap again to erase everything'; setTimeout(() => { t.dataset.armed = ''; t.textContent = 'Reset all progress'; }, 3500); return; }
        BR.Storage.reset(); BR.App.applySettings(); BR.Skins.apply(); BR.toast('Progress reset'); BR.Router.rerender();
      }
    });
    Profile.el.addEventListener('change', (e) => {
      const k = e.target.dataset.set;
      if (!k) return;
      S().settings[k] = e.target.checked; BR.Storage.save(); BR.App.applySettings(); BR.audio.ui(); BR.haptic('tap');
    });
  };
})();
