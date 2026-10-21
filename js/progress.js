/* Progression (pure logic over Storage): XP, levels, Geodes, Shards, Vault, Fusion, loadout, Trackers. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});
  const S = () => BR.Storage.data;
  const P = () => BR.Storage.data.profile;
  const save = () => BR.Storage.save();
  let rngCounter = 0;
  const rng = () => BR.makeRng((Date.now() ^ (++rngCounter * 2654435761)) >>> 0);

  const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };

  BR.Progress = {
    get level() { return P().level; },
    get xp() { return P().xp; },
    get need() { return BR.xpForLevel(P().level); },
    get shards() { return P().shards; },
    geodeCount() { return P().geodes.normal + P().geodes.series; },

    /**
     * Add XP. Each level-up grants one Geode (a Series Geode on every 5th level).
     * Returns what happened so the UI can animate it.
     */
    addXp(amount) {
      const p = P();
      const from = { level: p.level, xp: p.xp, need: BR.xpForLevel(p.level) };
      const ups = [];
      p.xp += Math.max(0, Math.round(amount));
      while (p.xp >= BR.xpForLevel(p.level)) {
        p.xp -= BR.xpForLevel(p.level);
        p.level++;
        const kind = p.level % BR.CFG.geodeSeriesEvery === 0 ? 'series' : 'normal';
        p.geodes[kind]++;
        ups.push({ level: p.level, kind });
      }
      save();
      return { gained: amount, from, level: p.level, xp: p.xp, need: BR.xpForLevel(p.level), ups };
    },

    /** XP rows for finishing a round (or the remainder of a run when `partial`). */
    roundRows(engine, partial) {
      const rows = [];
      const pts = Math.floor(engine.roundScore / 100);
      if (pts > 0) rows.push({ label: 'Points scored', xp: pts });
      if (!partial) rows.push({ label: 'Round ' + engine.round + ' cleared', xp: 50 + 10 * engine.round });
      if (engine.roundStats.lines) rows.push({ label: 'Line Blast x' + engine.roundStats.lines, xp: 25 * engine.roundStats.lines });
      if (engine.roundStats.big) rows.push({ label: 'Groups of 10+ x' + engine.roundStats.big, xp: 15 * engine.roundStats.big });
      return rows;
    },

    /** Once-per-run bonuses, added at the end of the first round or run. */
    dailyRow() {
      const t = todayKey();
      if (S().lastDay === t) return null;
      S().lastDay = t; save();
      return { label: 'First run of the day', xp: 150 };
    },

    // ---------- Geodes ----------
    /** Next Geode to open: Series Geodes first (better odds). null if none. */
    nextGeodeKind() { const g = P().geodes; return g.series > 0 ? 'series' : g.normal > 0 ? 'normal' : null; },

    /** Consume a Geode and roll its drop. The drop is not in the Vault until keep() / equip(). */
    openGeode() {
      const kind = this.nextGeodeKind();
      if (!kind) return null;
      P().geodes[kind]--;
      P().opened++;
      const drop = BR.rollDrop(rng(), kind);
      drop.kind = kind;
      drop.dup = this.owns(drop.itemId);
      save();
      return drop;
    },

    owns(itemId) { return P().vault.some((i) => i.itemId === itemId); },

    keep(drop) {
      const inst = { uid: 'i' + (++P().seq).toString(36), itemId: drop.itemId, finish: drop.finish, seed: drop.seed, tracker: drop.tracker ? Object.assign({}, drop.tracker) : null };
      P().vault.push(inst);
      save();
      return inst;
    },

    dust(drop) {
      const amt = BR.rarityById[drop.rarity].dust;
      P().shards += amt;
      save();
      return amt;
    },

    // ---------- Vault ----------
    instance(uid) { return P().vault.find((i) => i.uid === uid) || null; },
    itemOf(inst) { return BR.itemById[inst.itemId]; },

    /** Resolve the currently equipped item for a type: { item, inst|null }. */
    equipped(type) {
      const uid = P().loadout[type];
      const inst = uid && uid !== 'default' ? this.instance(uid) : null;
      return inst ? { item: this.itemOf(inst), inst } : { item: BR.DEFAULTS[type], inst: null };
    },

    equip(uid, type) {
      if (uid === 'default') P().loadout[type] = 'default';
      else { const inst = this.instance(uid); if (!inst) return false; P().loadout[BR.itemById[inst.itemId].type] = uid; }
      save();
      return true;
    },
    isEquipped(uid) { return Object.values(P().loadout).includes(uid); },

    // ---------- Fusion ----------
    /** Validate a fusion selection. Returns { ok, reason, rarityIndex }. */
    canFuse(uids) {
      if (uids.length !== BR.CFG.fusionCount) return { ok: false, reason: 'Pick ' + BR.CFG.fusionCount + ' items' };
      if (new Set(uids).size !== uids.length) return { ok: false, reason: 'Duplicate pick' };
      const insts = uids.map((u) => this.instance(u));
      if (insts.some((i) => !i)) return { ok: false, reason: 'Item missing' };
      if (uids.some((u) => this.isEquipped(u))) return { ok: false, reason: 'Unequip first' };
      const rars = new Set(insts.map((i) => this.itemOf(i).rarity));
      if (rars.size !== 1) return { ok: false, reason: 'Same rarity only' };
      const idx = BR.RARITIES.findIndex((r) => r.id === [...rars][0]);
      if (idx >= BR.RARITIES.length - 1) return { ok: false, reason: 'Celestial is the top' };
      return { ok: true, rarityIndex: idx + 1 };
    },

    /** Trade 5 items of one rarity for 1 item of the next. The new item goes straight into the Vault. */
    fuse(uids) {
      const chk = this.canFuse(uids);
      if (!chk.ok) return null;
      P().vault = P().vault.filter((i) => !uids.includes(i.uid));
      const drop = BR.rollDrop(rng(), 'normal', chk.rarityIndex);
      drop.kind = 'fusion';
      drop.dup = this.owns(drop.itemId);
      drop.inst = this.keep(drop);
      return drop;
    },

    buyGeode() {
      if (P().shards < BR.CFG.shardGeodeCost) return false;
      P().shards -= BR.CFG.shardGeodeCost;
      P().geodes.series++;
      save();
      return true;
    },

    // ---------- Trackers ----------
    /** Feed run stats to equipped items that carry a Tracker. */
    trackRun(stats) {
      const bump = (type, fn) => { const e = this.equipped(type); if (e.inst && e.inst.tracker) fn(e.inst.tracker); };
      bump('facet', (t) => { t.value += stats.bricks || 0; });
      bump('burst', (t) => { t.value = Math.max(t.value, stats.biggest || 0); });
      bump('arena', (t) => { t.value += stats.rounds || 0; });
      save();
    },

    counts() {
      const have = new Set(P().vault.map((i) => i.itemId));
      return { found: have.size, total: BR.ITEMS.length };
    },
  };
})();
