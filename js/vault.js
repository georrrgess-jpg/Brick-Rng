/* Vault screen: browse and equip Facets / Bursts / Arenas, Fusion, Shards exchange. */
(function () {
  const BR = (window.BR = window.BR || {});
  const $ = (id) => document.getElementById(id);

  class Vault {
    /** hooks: { openGeodes(), fused(drop), changed() } */
    constructor({ audio, hooks }) {
      this.audio = audio;
      this.hooks = hooks;
      this.tab = 'facet';
      this.filter = null;
      this.sel = new Set();
      $('vaultTabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) { this.tab = b.dataset.tab; this.filter = null; this.sel.clear(); this.audio.ui(); this.render(); } });
      $('vaultFilters').addEventListener('click', (e) => { const b = e.target.closest('button[data-r]'); if (b) { this.filter = this.filter === b.dataset.r ? null : b.dataset.r; this.audio.ui(); this.render(); } });
      $('vaultGrid').addEventListener('click', (e) => this.onCard(e));
      $('fusionBar').addEventListener('click', (e) => this.onFusionBar(e));
      $('vaultGeodes').addEventListener('click', (e) => { if (e.target.closest('[data-act="open"]')) this.hooks.openGeodes(); });
    }

    /* ---------- render ---------- */
    render() {
      const P = BR.Progress;
      $('shardCount').textContent = BR.fmt(P.shards);
      this.renderGeodes();
      this.renderTabs();
      this.renderFilters();
      if (this.tab === 'fusion') this.renderFusion(); else this.renderCollection();
      $('fusionBar').hidden = this.tab !== 'fusion';
    }

    renderGeodes() {
      const g = BR.Storage.data.profile.geodes, n = g.normal + g.series;
      const el = $('vaultGeodes');
      el.classList.toggle('empty', n === 0);
      el.innerHTML = n > 0
        ? `<div><b>${n} Geode${n > 1 ? 's' : ''} ready</b><small>${g.series ? g.series + ' Series · ' : ''}Crack one open for a new item</small></div><button class="btn btn-geode" data-act="open">Open</button>`
        : `<div><b>No Geodes yet</b><small>Level up to earn one. XP comes from every round you play.</small></div>`;
    }

    renderTabs() {
      const P = BR.Progress, vault = BR.Storage.data.profile.vault;
      const found = (t) => new Set(vault.filter((i) => BR.itemById[i.itemId].type === t).map((i) => i.itemId)).size;
      const total = (t) => BR.ITEMS.filter((i) => i.type === t).length;
      const tabs = ['facet', 'burst', 'arena'].map((t) => `<button role="tab" data-tab="${t}" class="${this.tab === t ? 'on' : ''}">${BR.ITEM_TYPES[t].plural} <small>${found(t)}/${total(t)}</small></button>`);
      tabs.push(`<button role="tab" data-tab="fusion" class="${this.tab === 'fusion' ? 'on' : ''}">Fusion</button>`);
      $('vaultTabs').innerHTML = tabs.join('');
      void P;
    }

    renderFilters() {
      $('vaultFilters').innerHTML = this.tab === 'fusion' ? '' : BR.RARITIES.map((r) => `<button class="chip-btn ${this.filter === r.id ? 'on' : ''}" data-r="${r.id}" style="--rc:${r.color}">${r.name}</button>`).join('');
    }

    cardHTML(item, inst, opts = {}) {
      const r = BR.rarityById[item.rarity];
      const eq = inst ? BR.Progress.isEquipped(inst.uid) : opts.defaultEquipped;
      const fin = inst && inst.finish !== 'matte' ? `<span class="badge finish-${inst.finish}">${BR.finishById[inst.finish].name}</span>` : '';
      const trk = inst && inst.tracker ? `<span class="badge tracker">${BR.fmt(inst.tracker.value)} ${inst.tracker.stat.toLowerCase()}</span>` : '';
      const cls = ['vcard', eq ? 'equipped' : '', opts.selected ? 'selected' : ''].join(' ');
      return `<div class="${cls}" style="--rc:${r.color};--i:${opts.i || 0}" data-uid="${inst ? inst.uid : 'default'}" data-type="${item.type}">
        ${eq ? '<span class="vflag">Equipped</span>' : ''}
        <div class="vprev">${BR.Skins.previewHTML(item, inst)}</div>
        <div class="vname">${item.name}</div><div class="vtag">${r.name}</div>
        <div class="vbadges">${fin}${trk}</div></div>`;
    }

    renderCollection() {
      const P = BR.Progress, type = this.tab;
      const vault = BR.Storage.data.profile.vault;
      const order = BR.RARITIES.map((r) => r.id);
      const byRarity = (a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity) || a.name.localeCompare(b.name);
      const cards = [];
      let i = 0;
      // default first
      const def = BR.DEFAULTS[type];
      if (!this.filter || this.filter === def.rarity) cards.push(this.cardHTML(def, null, { defaultEquipped: P.equipped(type).inst === null, i: i++ }));
      const owned = vault.map((inst) => ({ inst, item: BR.itemById[inst.itemId] })).filter((x) => x.item.type === type).sort((a, b) => byRarity(a.item, b.item));
      for (const o of owned) if (!this.filter || this.filter === o.item.rarity) cards.push(this.cardHTML(o.item, o.inst, { i: i++ }));
      const have = new Set(owned.map((o) => o.item.id));
      for (const item of BR.ITEMS.filter((x) => x.type === type && !have.has(x.id)).sort(byRarity)) {
        if (this.filter && this.filter !== item.rarity) continue;
        const r = BR.rarityById[item.rarity];
        cards.push(`<div class="vcard locked" style="--rc:${r.color};--i:${i++}"><div class="vprev"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#7d8bb3" stroke-width="2" stroke-linecap="round"><path d="M9.5 9a2.7 2.7 0 1 1 3.6 2.5c-.8.4-1.1.9-1.1 1.7M12 17h.01"/></svg></div><div class="vname">???</div><div class="vtag">${r.name}</div><div class="vbadges"></div></div>`);
      }
      cards.push(`<div class="vault-note">Tap an item to equip it. Duplicates can be dusted into Shards, or fused five-for-one.</div>`);
      $('vaultGrid').innerHTML = cards.join('');
    }

    renderFusion() {
      const P = BR.Progress, vault = BR.Storage.data.profile.vault;
      const cands = vault.filter((i) => !P.isEquipped(i.uid)).map((inst) => ({ inst, item: BR.itemById[inst.itemId] }));
      const order = BR.RARITIES.map((r) => r.id);
      cands.sort((a, b) => order.indexOf(a.item.rarity) - order.indexOf(b.item.rarity) || a.item.name.localeCompare(b.item.name));
      const lockRarity = this.sel.size ? BR.itemById[P.instance([...this.sel][0]).itemId].rarity : null;
      const cards = cands.map((c, i) => {
        const dim = lockRarity && c.item.rarity !== lockRarity;
        return this.cardHTML(c.item, c.inst, { selected: this.sel.has(c.inst.uid), i }).replace('class="vcard', `class="vcard${dim ? ' locked' : ''}`).replace(' equipped', '');
      });
      if (!cards.length) cards.push('<div class="vault-note">Nothing to fuse yet. Keep five items of the same rarity (not equipped) to trade up.</div>');
      $('vaultGrid').innerHTML = cards.join('');
      const n = this.sel.size, chk = P.canFuse([...this.sel]);
      const nextR = lockRarity ? BR.RARITIES[Math.min(BR.RARITIES.length - 1, order.indexOf(lockRarity) + 1)] : null;
      $('fusionBar').innerHTML = `<div class="fb-text">${lockRarity ? `Fuse <b>${n}/${BR.CFG.fusionCount}</b> ${BR.rarityById[lockRarity].name} into one <b style="color:${nextR.color}">${nextR.name}</b>` : `Pick <b>${BR.CFG.fusionCount}</b> items of one rarity to fuse into the next`}</div>
        <div style="display:flex;gap:8px"><button class="btn btn-primary" data-act="fuse" ${chk.ok ? '' : 'disabled style="opacity:.45"'}>Fuse</button>
        <button class="btn" data-act="buy" ${P.shards >= BR.CFG.shardGeodeCost ? '' : 'disabled style="opacity:.45"'} title="${BR.CFG.shardGeodeCost} Shards for a Series Geode">${BR.CFG.shardGeodeCost} <svg viewBox="0 0 24 24" width="14" height="14" fill="#7ae8ff"><path d="M12 2l6 8-6 12-6-12z"/></svg> Geode</button></div>`;
    }

    /* ---------- actions ---------- */
    onCard(e) {
      const card = e.target.closest('.vcard');
      if (!card || card.classList.contains('locked')) return;
      const P = BR.Progress, uid = card.dataset.uid;
      if (this.tab === 'fusion') {
        if (this.sel.has(uid)) this.sel.delete(uid);
        else if (this.sel.size < BR.CFG.fusionCount) this.sel.add(uid);
        this.audio.ui();
        this.renderFusion();
        return;
      }
      if (uid === 'default' ? P.equipped(card.dataset.type).inst === null : P.isEquipped(uid)) return;
      P.equip(uid, card.dataset.type);
      BR.Skins.apply();
      this.audio.equip();
      this.hooks.changed();
      this.render();
    }

    async onFusionBar(e) {
      const act = e.target.closest('[data-act]');
      if (!act || act.disabled) return;
      const P = BR.Progress;
      if (act.dataset.act === 'buy') {
        if (P.buyGeode()) { this.audio.scrap(); this.hooks.changed(); this.render(); }
        return;
      }
      if (act.dataset.act === 'fuse') {
        const uids = [...this.sel];
        const drop = P.fuse(uids);
        if (!drop) return;
        this.sel.clear();
        this.render();
        await this.hooks.fused(drop);
        this.hooks.changed();
        this.render();
      }
    }
  }

  BR.Vault = Vault;
})();
