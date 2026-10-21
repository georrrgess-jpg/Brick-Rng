/* Chests: what each one holds, its price, its odds, and the drop roll (decided before any animation). */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  BR.CHESTS = {
    brick: { id: 'brick', name: 'Brick Chest', type: 'skin', cost: 300, blurb: 'Skins that change how your bricks look.', sub: 'Skins', accent: '#ff6a4d' },
    pop: { id: 'pop', name: 'Pop Chest', type: 'pop', cost: 250, blurb: 'Pops that change the effect and sound of every pop.', sub: 'Pops', accent: '#ff3d8b' },
    board: { id: 'board', name: 'Board Chest', type: 'board', cost: 400, blurb: 'Boards that change the scene behind your bricks.', sub: 'Boards', accent: '#4aa8ff' },
    fuse: { id: 'fuse', name: 'Fuse Chest', type: 'fuse', cost: 250, blurb: 'Fuses that change your fuse, your bomb and Rush Mode.', sub: 'Fuses', accent: '#ffb02e' },
    golden: { id: 'golden', name: 'Golden Chest', type: null, cost: null, blurb: 'Pick any type. Epic or better, guaranteed.', sub: 'Any type', accent: '#ffd24a', golden: true },
  };
  BR.CHEST_ORDER = ['brick', 'pop', 'board', 'fuse'];

  const weightOf = (chest, r) => (chest.golden ? r.golden : r.weight);

  /** Items a chest can drop for a given type (pass exclusives never drop). */
  BR.chestPool = (chestId, type) => BR.DROP_ITEMS.filter((x) => x.type === (BR.CHESTS[chestId].type || type));

  /** Odds table for the odds panel: one row per rarity with percent, "1 in N" and item counts. */
  BR.chestOdds = function chestOdds(chestId, type, ownedIds) {
    const chest = BR.CHESTS[chestId];
    const pool = BR.chestPool(chestId, type);
    const total = BR.RARITIES.reduce((a, r) => a + weightOf(chest, r), 0);
    const owned = new Set(ownedIds || []);
    return BR.RARITIES.map((r) => {
      const w = weightOf(chest, r);
      const items = pool.filter((x) => x.rarity === r.id);
      const pct = (w / total) * 100;
      return {
        rarity: r, pct, oneIn: w > 0 ? Math.round(100 / pct) : null,
        items, total: items.length, missing: items.filter((x) => !owned.has(x.id)).length,
      };
    });
  };

  /** One plain sentence that sums up a chest's odds. */
  BR.oddsSentence = function oddsSentence(chestId) {
    const chest = BR.CHESTS[chestId];
    if (chest.golden) return 'Every Golden Chest gives an Epic or better. About 1 in 20 is a Mythic.';
    const rows = BR.chestOdds(chestId, null, []);
    const top = rows[rows.length - 1];
    return `Most ${chest.name}s give a Common. About 1 in ${top.oneIn} gives a Mythic.`;
  };

  /**
   * Roll one drop. Everything about it (item, Shine, Counter, pattern seed) is decided here.
   * `rarityIndex` forces a rarity (used by Trade-up).
   */
  BR.rollChest = function rollChest(rng, chestId, type, rarityIndex = null) {
    const chest = BR.CHESTS[chestId];
    const t = chest.type || type;
    const rarity = rarityIndex != null
      ? BR.RARITIES[Math.min(rarityIndex, BR.RARITIES.length - 1)]
      : rng.weighted(BR.RARITIES.filter((r) => weightOf(chest, r) > 0), (r) => weightOf(chest, r));
    const pool = BR.DROP_ITEMS.filter((x) => x.type === t && x.rarity === rarity.id);
    const item = rng.pick(pool);
    const shine = rng.weighted(BR.SHINES, (f) => f.weight);
    const counter = rng.chance(0.1) ? { stat: BR.ITEM_TYPES[t].counter, value: 0 } : null;
    return { itemId: item.id, type: t, rarity: rarity.id, shine: shine.id, seed: t === 'skin' ? rng.int(10000) : 0, counter };
  };
})();
