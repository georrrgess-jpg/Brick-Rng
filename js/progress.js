/* Progression (pure logic over Storage): XP, levels, Coins, chests, items, Trade-up, Rush Pass, Trophies. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});
  const S = () => BR.Storage.data;
  const P = () => BR.Storage.data.profile;
  const save = () => BR.Storage.save();
  let rngCounter = 0;
  const rng = () => BR.makeRng((Date.now() ^ (++rngCounter * 2654435761)) >>> 0);

  BR.Progress = {
    get level() { return P().level; },
    get xp() { return P().xp; },
    get need() { return BR.xpForLevel(P().level); },
    get coins() { return P().coins; },

    /* ---------- Coins ---------- */
    earn(n) { n = Math.max(0, Math.round(n)); P().coins += n; P().stats.coinsEarned += n; BR.Storage.saveSoon(); return n; },
    spend(n) { if (P().coins < n) return false; P().coins -= n; BR.Storage.saveSoon(); return true; },

    /** Coins for a finished run. Daily Rush and the Double Coins boost add +1x each. */
    runCoins(summary, opts = {}) {
      const base = Math.floor(summary.score / BR.CFG.coinsPerScore);
      let stages = 0;
      for (let s = 1; s <= summary.stagesCleared; s++) stages += BR.CFG.coinsPerStage * s;
      const mult = 1 + (opts.daily ? 1 : 0) + (opts.double ? 1 : 0);
      return { base, stages, mult, total: (base + stages) * mult };
    },

    /* ---------- XP, levels, Rush Pass ---------- */
    runXpRows(summary, opts = {}) {
      const rows = [];
      const pts = Math.floor(summary.score / 250);
      if (pts > 0) rows.push({ label: 'Points scored', xp: pts });
      let st = 0;
      for (let s = 1; s <= summary.stagesCleared; s++) st += 40 + 8 * s;
      if (st) rows.push({ label: `${summary.stagesCleared} stage${summary.stagesCleared > 1 ? 's' : ''} cleared`, xp: st });
      if (summary.rushes) rows.push({ label: `Rush Mode x${summary.rushes}`, xp: 20 * summary.rushes });
      if (summary.lineBlasts) rows.push({ label: `Line Blast x${summary.lineBlasts}`, xp: 25 * summary.lineBlasts });
      if (summary.bigPops) rows.push({ label: `Pops of 10+ x${summary.bigPops}`, xp: 15 * summary.bigPops });
      if (opts.daily) rows.push({ label: 'Daily Rush', xp: 100 });
      if (opts.isBest) rows.push({ label: 'New best score', xp: 200 });
      if (opts.firstOfDay) rows.push({ label: 'First run of the day', xp: 150 });
      return rows;
    },

    /** Add XP. Every level-up finishes a Pass tier and pays its reward. */
    addXp(amount) {
      const p = P();
      const from = { level: p.level, xp: p.xp, need: BR.xpForLevel(p.level) };
      const ups = [];
      p.xp += Math.max(0, Math.round(amount));
      while (p.xp >= BR.xpForLevel(p.level)) {
        p.xp -= BR.xpForLevel(p.level);
        const tier = p.level;
        p.level++;
        const reward = BR.passReward(tier);
        if (tier > p.passTier) { p.passTier = tier; this.grant(reward); }
        ups.push({ level: p.level, tier, reward });
      }
      save();
      return { gained: amount, from, level: p.level, xp: p.xp, need: BR.xpForLevel(p.level), ups };
    },

    /** Pay out a reward object (coins / chest / item). */
    grant(r) {
      if (r.kind === 'coins') this.earn(r.amount);
      else if (r.kind === 'chest') this.addChest(r.chest, 1);
      else if (r.kind === 'item') this.keep({ itemId: r.itemId, shine: r.shine || 'plain', seed: 7, counter: null });
      save();
    },

    /* ---------- Chests ---------- */
    chestCount(id) { return P().chests[id] || 0; },
    totalChests() { return Object.values(P().chests).reduce((a, b) => a + b, 0); },
    addChest(id, n = 1) { P().chests[id] = (P().chests[id] || 0) + n; save(); },
    /** Can this chest be opened right now (owned, or affordable)? */
    canOpen(id) { const c = BR.CHESTS[id]; return this.chestCount(id) > 0 || (c.cost != null && P().coins >= c.cost); },

    /**
     * Take a chest (from inventory first, otherwise pay) and roll its drop.
     * Called at the burst moment of the opening, so backing out early never costs anything.
     */
    openChest(id, type) {
      const c = BR.CHESTS[id];
      if (this.chestCount(id) > 0) P().chests[id]--;
      else if (c.cost == null || !this.spend(c.cost)) return null;
      const drop = BR.rollChest(rng(), id, type);
      drop.chest = id;
      drop.dup = this.owns(drop.itemId);
      P().opened++; P().stats.chests++;
      save();
      return drop;
    },

    /* ---------- items ---------- */
    owns(itemId) { return P().vault.some((i) => i.itemId === itemId); },
    ownedIds() { return Array.from(new Set(P().vault.map((i) => i.itemId))); },
    keep(drop) {
      const inst = { uid: 'i' + (++P().seq).toString(36), itemId: drop.itemId, shine: drop.shine, seed: drop.seed || 0, counter: drop.counter ? Object.assign({}, drop.counter) : null };
      P().vault.push(inst);
      save();
      return inst;
    },
    /** Sell a drop that has not been kept. */
    sellDrop(drop) { const n = BR.rarityById[drop.rarity].sell; this.earn(n); save(); return n; },
    sellInstance(uid) {
      const inst = this.instance(uid);
      if (!inst || this.isEquipped(uid)) return 0;
      const n = BR.rarityById[BR.itemById[inst.itemId].rarity].sell;
      P().vault = P().vault.filter((i) => i.uid !== uid);
      this.earn(n); save();
      return n;
    },
    instance(uid) { return P().vault.find((i) => i.uid === uid) || null; },
    itemOf(inst) { return BR.itemById[inst.itemId]; },
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

    /* ---------- Trade-up: 5 items of one rarity and type -> 1 of the next ---------- */
    canTradeUp(uids) {
      const n = BR.CFG.tradeUpCount;
      if (uids.length !== n) return { ok: false, reason: `Pick ${n} items` };
      if (new Set(uids).size !== n) return { ok: false, reason: 'Pick different items' };
      const insts = uids.map((u) => this.instance(u));
      if (insts.some((i) => !i)) return { ok: false, reason: 'Item missing' };
      if (uids.some((u) => this.isEquipped(u))) return { ok: false, reason: 'Take it off first' };
      const items = insts.map((i) => this.itemOf(i));
      if (new Set(items.map((x) => x.rarity)).size !== 1) return { ok: false, reason: 'Same rarity only' };
      if (new Set(items.map((x) => x.type)).size !== 1) return { ok: false, reason: 'Same type only' };
      const idx = BR.RARITIES.findIndex((r) => r.id === items[0].rarity);
      if (idx >= BR.RARITIES.length - 1) return { ok: false, reason: 'Mythic is the top' };
      return { ok: true, rarityIndex: idx + 1, type: items[0].type };
    },
    tradeUp(uids) {
      const chk = this.canTradeUp(uids);
      if (!chk.ok) return null;
      P().vault = P().vault.filter((i) => !uids.includes(i.uid));
      const chestId = BR.ITEM_TYPES[chk.type].chest;
      const drop = BR.rollChest(rng(), chestId, chk.type, chk.rarityIndex);
      drop.chest = chestId; drop.dup = false; drop.fromTradeUp = true;
      drop.inst = this.keep(drop);
      return drop;
    },

    /* ---------- run bookkeeping ---------- */
    /** Feed run stats to equipped items that carry a Counter, and to the lifetime stats. */
    trackRun(sum, mode) {
      const st = P().stats;
      st.runs++; st.bricks += sum.bricks; st.rushes += sum.rushes; st.bigPops += sum.bigPops; st.powerups += sum.powerUsed;
      st.lineBlasts += sum.lineBlasts; st.stages += sum.stagesCleared; st.defused += sum.defused || 0;
      st.bestCombo = Math.max(st.bestCombo, sum.maxCombo); st.maxGroup = Math.max(st.maxGroup, sum.biggest);
      if (mode === 'daily') st.dailyRuns++;
      const bump = (type, fn) => { const e = this.equipped(type); if (e.inst && e.inst.counter) fn(e.inst.counter); };
      bump('skin', (c) => { c.value += sum.bricks; });
      bump('pop', (c) => { c.value = Math.max(c.value, sum.biggest); });
      bump('board', (c) => { c.value += sum.stagesCleared + 1; });
      bump('fuse', (c) => { c.value += sum.rushes; });
      save();
    },

    /* ---------- Trophies ---------- */
    checkTrophies() {
      const p = P(), got = [];
      const ctx = { profile: p, stats: p.stats, owned: new Set(p.vault.map((i) => i.itemId)), bestStage: Math.max(S().bestStage.rush, S().bestStage.daily, S().bestStage.chill) };
      for (const t of BR.TROPHIES) {
        if (p.trophies[t.id]) continue;
        if (t.test(ctx)) { p.trophies[t.id] = Date.now(); this.earn(t.coins); got.push(t); }
      }
      if (got.length) save();
      return got;
    },

    counts() {
      const have = new Set(P().vault.map((i) => i.itemId));
      const dropHave = BR.DROP_ITEMS.filter((x) => have.has(x.id)).length;
      return { found: BR.ITEMS.filter((x) => have.has(x.id)).length, total: BR.ITEMS.length, dropFound: dropHave, dropTotal: BR.DROP_ITEMS.length };
    },
  };
})();
