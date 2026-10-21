/* Chests: what each one holds, its price, its odds, and the drop roll (decided before any animation).
   A chest never gives something you already own: the roll skips rarities that are used up and renormalizes. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  BR.CHESTS = {
    brick: { id: 'brick', name: 'Brick Chest', type: 'skin', cost: 350, blurb: 'Skins that change how your bricks look.', sub: 'Skins', accent: '#ff6a4d' },
    pop: { id: 'pop', name: 'Pop Chest', type: 'pop', cost: 300, blurb: 'Pops that change the effect and sound of every pop.', sub: 'Pops', accent: '#ff3d8b' },
    board: { id: 'board', name: 'Board Chest', type: 'board', cost: 450, blurb: 'Boards that change the scene behind your bricks.', sub: 'Boards', accent: '#4aa8ff' },
    fuse: { id: 'fuse', name: 'Fuse Chest', type: 'fuse', cost: 300, blurb: 'Fuses that change your fuse, your bomb and Rush Mode.', sub: 'Fuses', accent: '#ffb02e' },
    golden: { id: 'golden', name: 'Golden Chest', type: null, cost: null, blurb: 'Pick any type. Epic or better, guaranteed.', sub: 'Any type', accent: '#ffd24a', golden: true },
  };
  BR.CHEST_ORDER = ['brick', 'pop', 'board', 'fuse'];

  const weightOf = (chest, r) => (chest.golden ? r.golden : r.weight);
  const asSet = (o) => (o instanceof Set ? o : new Set(o || []));

  /** Items a chest can drop for a given type (pass exclusives never drop). */
  BR.chestPool = (chestId, type) => BR.DROP_ITEMS.filter((x) => x.type === (BR.CHESTS[chestId].type || type));
  /** Items of a type that this player does not own yet. */
  BR.unowned = (chestId, type, owned) => { const o = asSet(owned); return BR.chestPool(chestId, type).filter((x) => !o.has(x.id)); };
  /** True when every droppable item of the type is owned (the chest cannot be bought or opened). */
  BR.chestComplete = (chestId, owned) => BR.unowned(chestId, null, owned).length === 0;
  /** Types a Golden Chest can still give: Epic or better items you are missing. */
  BR.goldenTypes = (owned) => BR.TYPE_ORDER.filter((t) => BR.unowned('golden', t, owned).some((x) => BR.rarityById[x.rarity].golden > 0));

  /**
   * Live odds for the odds panel and the roll: one row per rarity. Rarities with nothing left to find have
   * 0%, and the rest are renormalized, so the panel always shows the real next-chest chances.
   */
  BR.chestOdds = function chestOdds(chestId, type, ownedIds, opts = {}) {
    const chest = BR.CHESTS[chestId];
    const owned = asSet(ownedIds);
    const pool = BR.chestPool(chestId, type);
    const forceEpic = !!opts.pity;
    const rows = BR.RARITIES.map((r) => {
      const items = pool.filter((x) => x.rarity === r.id);
      const left = items.filter((x) => !owned.has(x.id));
      let w = left.length ? weightOf(chest, r) : 0;
      if (forceEpic && r.level < 3) w = 0;
      return { rarity: r, w, items, total: items.length, missing: left.length };
    });
    let total = rows.reduce((a, r) => a + r.w, 0);
    if (total === 0 && forceEpic) return chestOdds(chestId, type, ownedIds, {}); // nothing Epic+ left: fall back
    return rows.map((r) => {
      const pct = total ? (r.w / total) * 100 : 0;
      return Object.assign(r, { pct, oneIn: r.w > 0 ? Math.round(100 / pct) : null });
    });
  };

  /** One plain sentence that sums up a chest's live odds. */
  BR.oddsSentence = function oddsSentence(chestId, type, owned, pityIn) {
    const chest = BR.CHESTS[chestId];
    if (chest.golden) return 'Every Golden Chest gives an Epic or better. About 1 in 20 is a Mythic.';
    const rows = BR.chestOdds(chestId, type, owned).filter((r) => r.pct > 0);
    if (!rows.length) return 'You own everything in this chest. Nice.';
    const top = rows[rows.length - 1];
    const common = rows.reduce((a, r) => (r.pct > a.pct ? r : a), rows[0]);
    let s = rows.length === 1 ? `Every ${chest.name} now gives a ${top.rarity.name}.` : `Most ${chest.name}s give a ${common.rarity.name}. About 1 in ${top.oneIn} gives a ${top.rarity.name}.`;
    if (pityIn != null && pityIn > 0) s += ` An Epic or better is guaranteed in ${pityIn} chest${pityIn === 1 ? '' : 's'}.`;
    return s;
  };

  /**
   * Roll one drop. Everything about it (item, Shine, pattern seed) is decided here and the item is always new.
   * opts.pity forces an Epic or better. Returns null when the type is complete.
   */
  BR.rollChest = function rollChest(rng, chestId, type, owned, opts = {}) {
    const chest = BR.CHESTS[chestId];
    const t = chest.type || type;
    const rows = BR.chestOdds(chestId, t, owned, opts).filter((r) => r.w > 0);
    if (!rows.length) return null;
    const row = rng.weighted(rows, (r) => r.w);
    const o = asSet(owned);
    const item = rng.pick(row.items.filter((x) => !o.has(x.id)));
    const shine = rng.weighted(BR.SHINES, (f) => f.weight);
    return { itemId: item.id, type: t, rarity: row.rarity.id, shine: shine.id, seed: t === 'skin' ? rng.int(10000) : 0 };
  };
})();
