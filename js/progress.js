/* Progression (pure logic over Storage): XP, levels, Coins, chests, items, Pop Pass, Trophies. */
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
    earn(n) { n = Math.max(0, Math.round(n)); P().coins += n; P().stats.coinsEarned += n; BR.Storage.saveSoon(); if (BR.refreshCoins) BR.refreshCoins(); return n; },
    spend(n) { if (P().coins < n) return false; P().coins -= n; BR.Storage.saveSoon(); if (BR.refreshCoins) BR.refreshCoins(); return true; },

    /**
     * Coins for a finished run: square-root of the score plus a small bonus per cleared stage (capped).
     * `opts.firstOfDay` adds a one-off bonus, Daily Rush adds a flat bonus. Returns the rows for the results screen.
     */
    runCoins(summary, opts = {}) {
      const C = BR.CFG.coin;
      const points = Math.round(C.scale * Math.sqrt(Math.max(0, summary.score) / C.ref));
      let stages = 0;
      for (let s = 1; s <= Math.min(summary.stagesCleared, C.stageCap); s++) stages += C.stageStep * s;
      const daily = opts.daily ? C.dailyBonus : 0;
      const first = opts.firstOfDay ? C.firstOfDay : 0;
      return { points, stages, daily, first, total: points + stages + daily + first };
    },

    /* ---------- XP, levels, Rush Pass ---------- */
    runXpRows(summary, opts = {}) {
      const rows = [];
      const pts = BR.xpForScore(summary.score);
      if (pts > 0) rows.push({ label: 'Points scored', xp: pts });
      let st = 0;
      for (let s = 1; s <= summary.stagesCleared; s++) st += 20 + 4 * s;
      if (st) rows.push({ label: `${summary.stagesCleared} stage${summary.stagesCleared > 1 ? 's' : ''} cleared`, xp: st });
      if (summary.rushes) rows.push({ label: `Rush Mode x${summary.rushes}`, xp: 10 * summary.rushes });
      if (summary.lineBlasts) rows.push({ label: `Line Blast x${summary.lineBlasts}`, xp: 10 * summary.lineBlasts });
      if (summary.bigPops) rows.push({ label: `Pops of 10+ x${summary.bigPops}`, xp: 6 * summary.bigPops });
      if (opts.daily) rows.push({ label: 'Daily Rush', xp: 60 });
      if (opts.isBest) rows.push({ label: 'New best score', xp: 80 });
      if (opts.firstOfDay) rows.push({ label: 'First run of the day', xp: 60 });
      return rows;
    },

    /** Add XP. Every level-up pays Coins; the same XP also fills the season track, whose tiers pay chests, items and hats. */
    addXp(amount) {
      const p = P();
      amount = Math.max(0, Math.round(amount));
      const from = { level: p.level, xp: p.xp, need: BR.xpForLevel(p.level) };
      const ups = [];
      p.xp += amount;
      while (p.xp >= BR.xpForLevel(p.level)) {
        p.xp -= BR.xpForLevel(p.level);
        const tier = p.level;
        p.level++;
        const reward = BR.levelReward(tier);
        let paid = 0;
        if (tier > p.passTier) { p.passTier = tier; paid = this.grant(reward) || 0; }
        ups.push({ level: p.level, tier, reward, paid });
      }
      const season = this.addSeasonXp(amount);
      save();
      return { gained: amount, from, level: p.level, xp: p.xp, need: BR.xpForLevel(p.level), ups, season };
    },

    /* ---------- the season track ---------- */
    /** Where the player is on this season's track: { n, tier, xp, into (XP into the next tier), need (for the next tier), done }. */
    seasonStatus() {
      const s = P().season, C = BR.CFG.season, done = s.tier >= C.tiers;
      const base = s.tier * C.xpPerTier;
      return { n: s.n, tier: s.tier, xp: s.xp, done, into: done ? C.xpPerTier : Math.max(0, s.xp - base), need: C.xpPerTier, tiers: C.tiers };
    },
    /** Add season XP and pay every tier it finishes. Returns { from: { tier, into }, tier, into, ups: [{ tier, reward, paid }] }. */
    addSeasonXp(amount) {
      const s = P().season, C = BR.CFG.season;
      const before = this.seasonStatus(), ups = [];
      s.xp += Math.max(0, Math.round(amount));
      while (s.tier < C.tiers && s.xp >= (s.tier + 1) * C.xpPerTier) {
        s.tier++;
        const reward = BR.seasonReward(s.tier);
        ups.push({ tier: s.tier, reward, paid: this.grant(reward) || 0 });
      }
      const now = this.seasonStatus();
      return { from: { tier: before.tier, into: before.into }, tier: now.tier, into: now.into, need: now.need, done: now.done, ups };
    },

    /** Pay out a reward object (coins / chest / item). Items you already own, and chests with nothing left to find, pay Coins
     *  instead; returns those Coins (0 when the reward arrived as itself). */
    grant(r) {
      let paid = 0;
      if (r.kind === 'coins') this.earn(r.amount);
      else if (r.kind === 'chest') paid = this.addChest(r.chest, 1);
      else if (r.kind === 'item') {
        if (this.owns(r.itemId)) { paid = BR.CFG.goldenFallback / 2; this.earn(paid); }
        else this.keep({ itemId: r.itemId, shine: r.shine || 'plain', seed: 7 });
      } else if (r.kind === 'hat') {
        if (!this.grantHat(r.hatId)) { paid = 60; this.earn(paid); }   // a hat you already have pays a little instead
      }
      save();
      return paid;
    },

    /* ---------- Fizz Hats: earned only (Pass, streak weeks, trophies), never in chests ---------- */
    ownsHat(id) { return id === 'h_party' || P().hats.includes(id); },
    ownedHats() { return Array.from(new Set(['h_party'].concat(P().hats))); },
    /** Give a hat. Returns true when it is new. */
    grantHat(id) { if (!id || this.ownsHat(id)) return false; P().hats.push(id); save(); return true; },
    /** The hat Fizz wears: a hat id, or null for none. */
    equippedHat() { const h = P().loadout.hat; return h && h !== 'none' && this.ownsHat(h) ? h : null; },
    equipHat(id) {
      if (id && id !== 'none' && !this.ownsHat(id)) return false;
      P().loadout.hat = id || 'none'; save(); return true;
    },

    /* ---------- Chests ---------- */
    chestCount(id) { return P().chests[id] || 0; },
    totalChests() { return Object.values(P().chests).reduce((a, b) => a + b, 0); },
    /** What a chest that can no longer be opened is worth: a Golden Chest pays the fallback, any other chest its price. */
    chestValue(id) { const c = BR.CHESTS[id]; return c.golden ? BR.CFG.goldenFallback : (c.cost || 0); },
    /** Add chests. A chest whose pool is finished (nothing left to find) pays Coins instead (returns the Coins, else 0). */
    addChest(id, n = 1) {
      if (this.chestStatus(id).complete) { const v = this.chestValue(id) * n; this.earn(v); save(); return v; }
      P().chests[id] = (P().chests[id] || 0) + n; save();
      return 0;
    },
    /** Chests already in stock whose pool has since been finished turn into Coins, so nothing is stranded. Returns the Coins paid. */
    cashStranded() {
      let coins = 0;
      for (const id of Object.keys(P().chests)) {
        const n = P().chests[id] || 0;
        if (n > 0 && BR.CHESTS[id] && this.chestStatus(id).complete) { coins += this.chestValue(id) * n; P().chests[id] = 0; }
      }
      if (coins) { this.earn(coins); save(); }
      return coins;
    },
    /** Chests in stock that can actually be opened. */
    openableChests() { return Object.keys(P().chests).reduce((a, id) => a + (BR.CHESTS[id] && !this.chestStatus(id).complete ? (P().chests[id] || 0) : 0), 0); },
    /** Status of a chest for the Shop and the opening screen. */
    chestStatus(id) {
      const c = BR.CHESTS[id], owned = this.ownedIds();
      if (c.golden) return { complete: BR.goldenTypes(owned).length === 0, left: 0, types: BR.goldenTypes(owned), pityIn: null };
      const left = BR.unowned(id, null, owned).length;
      const since = (P().pity || {})[c.type] || 0;
      const hasEpic = BR.unowned(id, null, owned).some((x) => BR.rarityById[x.rarity].level >= 3);
      return { complete: left === 0, left, total: BR.chestPool(id).length, pityIn: hasEpic ? Math.max(1, BR.CFG.pityEvery - since) : null };
    },
    /** Can this chest be opened right now (owned or affordable, and something left to find)? */
    canOpen(id) {
      const c = BR.CHESTS[id], st = this.chestStatus(id);
      if (st.complete) return false;
      return this.chestCount(id) > 0 || (c.cost != null && P().coins >= c.cost);
    },

    /**
     * Take a chest (from inventory first, otherwise pay) and roll its drop, which is always an item you do not own.
     * Called at the burst moment of the opening, so backing out early never costs anything.
     */
    openChest(id, type) {
      const c = BR.CHESTS[id], t = c.type || type;
      if (!t) return null;
      const owned = this.ownedIds();
      if (BR.unowned(id, t, owned).length === 0) return null;
      if (c.golden && !BR.goldenTypes(owned).includes(t)) return null;
      if (this.chestCount(id) > 0) P().chests[id]--;
      else if (c.cost == null || !this.spend(c.cost)) return null;
      const pity = P().pity || (P().pity = {});
      const since = pity[t] || 0;
      const force = !c.golden && since >= BR.CFG.pityEvery - 1;
      const drop = BR.rollChest(rng(), id, t, owned, { pity: force });
      if (!drop) return null;
      pity[t] = BR.rarityById[drop.rarity].level >= 3 ? 0 : since + 1;
      drop.chest = id;
      drop.pityHit = force && BR.rarityById[drop.rarity].level >= 3;
      P().opened++; P().stats.chests++;
      save();
      return drop;
    },

    /* ---------- items ---------- */
    owns(itemId) { return P().vault.some((i) => i.itemId === itemId); },
    ownedIds() { return Array.from(new Set(P().vault.map((i) => i.itemId))); },
    keep(drop) {
      const have = P().vault.find((i) => i.itemId === drop.itemId);
      if (have) return have; // never two copies of one item
      const inst = { uid: 'i' + (++P().seq).toString(36), itemId: drop.itemId, shine: drop.shine, seed: drop.seed || 0 };
      P().vault.push(inst);
      save();
      return inst;
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

    /* ---------- run bookkeeping ---------- */
    /** Feed run stats to the lifetime stats. */
    trackRun(sum, mode) {
      const st = P().stats;
      st.runs++; st.bricks += sum.bricks; st.rushes += sum.rushes; st.bigPops += sum.bigPops; st.powerups += sum.powerUsed;
      st.lineBlasts += sum.lineBlasts; st.stages += sum.stagesCleared; st.defused += sum.defused || 0;
      st.bestCombo = Math.max(st.bestCombo, sum.maxCombo); st.maxGroup = Math.max(st.maxGroup, sum.biggest);
      if (mode === 'daily') st.dailyRuns++;
      // Moonwick counters for trophies: pops made wearing a Moonwick skin, and runs the Last Spark saved
      if (this.equipped('skin').item.series === 4) st.moonwickPops = (st.moonwickPops || 0) + (sum.pops || 0);
      if ((sum.sparkSaves || 0) > 0) st.sparkRuns = (st.sparkRuns || 0) + 1;
      save();
    },

    /* ---------- Trophies ---------- */
    checkTrophies() {
      const p = P(), got = [];
      const ctx = { profile: p, stats: p.stats, owned: new Set(p.vault.map((i) => i.itemId)), bestScore: Math.max(S().best.rush, S().best.daily), bestStage: Math.max(S().bestStage.rush, S().bestStage.daily, S().bestStage.chill) };
      for (const t of BR.TROPHIES) {
        if (p.trophies[t.id]) continue;
        if (t.test(ctx)) {
          p.trophies[t.id] = Date.now(); this.earn(t.coins); got.push(t);
          // some trophies also give an item or a hat (the Pass exclusives that left the level track, and the Fizz Hats)
          if (t.item) this.grant({ kind: 'item', itemId: t.item.itemId, shine: t.item.shine });
          if (t.hat) this.grantHat(t.hat);
          ctx.owned = new Set(p.vault.map((i) => i.itemId));   // a trophy's item can finish another trophy in the same pass
        }
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
