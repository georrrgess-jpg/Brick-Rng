/* Pop Pass: a free reward track with one tier per level. Plus one-time Trophies. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  /* The level track: every level-up pays Coins. The chests, items and hats moved to the season track (below), so
     they can be earned again each season by players who are already past level 30. */
  /** Reward for finishing the given level (tier n = the climb out of level n). */
  BR.levelReward = function levelReward(tier) {
    if (tier > BR.CFG.passTiers) return { kind: 'coins', amount: 75 };
    return { kind: 'coins', amount: Math.round((25 + 3 * tier) / 5) * 5 };
  };
  BR.passReward = BR.levelReward;   // the older name
  BR.PASS = Array.from({ length: BR.CFG.passTiers }, (_, i) => Object.assign({ tier: i + 1 }, BR.levelReward(i + 1)));

  /* ---- The season track (Season 4 "Moonwick"): 30 tiers of season XP ---- */
  const SEASON_SPECIAL = {
    3: { kind: 'hat', hatId: 'h_top' },
    5: { kind: 'chest', chest: 'brick' },
    8: { kind: 'hat', hatId: 'h_pom' },
    10: { kind: 'chest', chest: 'pop' },
    13: { kind: 'hat', hatId: 'h_propeller' },
    15: { kind: 'chest', chest: 'board' },
    18: { kind: 'hat', hatId: 'h_flower' },
    20: { kind: 'chest', chest: 'fuse' },
    23: { kind: 'hat', hatId: 'h_toque' },
    25: { kind: 'item', itemId: 'b_wisps', shine: 'holo' },
    27: { kind: 'hat', hatId: 'h_wizard' },
    28: { kind: 'chest', chest: 'golden' },
    30: { kind: 'item', itemId: 'f_moonglass', shine: 'prism' },
  };
  BR.seasonReward = function seasonReward(tier) {
    if (SEASON_SPECIAL[tier]) return SEASON_SPECIAL[tier];
    return { kind: 'coins', amount: Math.round((25 + 3 * tier) / 5) * 5 };
  };
  BR.PASS_SEASON = { n: BR.CFG.season.n, name: BR.CFG.season.name, label: `Season ${BR.CFG.season.n} · ${BR.CFG.season.name}` };
  BR.SEASON = Array.from({ length: BR.CFG.season.tiers }, (_, i) => Object.assign({ tier: i + 1 }, BR.seasonReward(i + 1)));
  /** Season XP needed to finish tier n (1-based). */
  BR.seasonNeed = (tier) => tier * BR.CFG.season.xpPerTier;

  BR.rewardLabel = function rewardLabel(r) {
    if (r.kind === 'coins') return `${r.amount} Coins`;
    if (r.kind === 'chest') return BR.CHESTS[r.chest].name;
    if (r.kind === 'item') return BR.itemById[r.itemId].name;
    if (r.kind === 'hat') return (BR.Hats && BR.Hats.byId(r.hatId) ? BR.Hats.byId(r.hatId).name : 'Hat') + ' (Fizz Hat)';
    return '';
  };

  // ---- Trophies: one-time goals with a Coin reward ----
  BR.TROPHIES = [
    { id: 'first_run', name: 'First Pop', desc: 'Finish your first run', coins: 50, test: (c) => c.stats.runs >= 1 },
    { id: 'first_rush', name: 'Feeling the Rush', desc: 'Trigger Rush Mode', coins: 50, test: (c) => c.stats.rushes >= 1 },
    { id: 'stage5', name: 'Hot Streak', desc: 'Reach stage 5', coins: 75, test: (c) => c.bestStage >= 5 },
    { id: 'stage10', name: 'Fuse Master', desc: 'Reach stage 10', coins: 200, test: (c) => c.bestStage >= 10 },
    { id: 'score100k', name: 'Six Figures', desc: 'Score 100,000 in one run', coins: 100, test: (c) => c.bestScore >= 100000 },
    { id: 'score250k', name: 'Quarter Million', desc: 'Score 250,000 in one run', coins: 200, test: (c) => c.bestScore >= 250000 },
    { id: 'big100', name: 'Big Popper', desc: 'Pop 100 groups of 10 or more', coins: 150, test: (c) => c.stats.bigPops >= 100 },
    { id: 'bricks5k', name: 'Brick Breaker', desc: 'Pop 5,000 bricks in total', coins: 125, test: (c) => c.stats.bricks >= 5000 },
    { id: 'line5', name: 'Line Boss', desc: 'Make 5 Line Blasts', coins: 100, test: (c) => c.stats.lineBlasts >= 5 },
    { id: 'power25', name: 'Power Player', desc: 'Use 25 power-ups', coins: 75, test: (c) => c.stats.powerups >= 25 },
    { id: 'defuse10', name: 'Bomb Squad', desc: 'Defuse 10 Fuse bricks', coins: 100, test: (c) => c.stats.defused >= 10 },
    { id: 'daily1', name: 'Daily Rusher', desc: 'Finish a Daily Rush', coins: 50, test: (c) => c.stats.dailyRuns >= 1 },
    { id: 'chests10', name: 'Chest Fan', desc: 'Open 10 chests', coins: 100, test: (c) => c.profile.opened >= 10 },
    { id: 'own10', name: 'Collector', desc: 'Own 10 different items', coins: 125, test: (c) => c.owned.size >= 10 },
    { id: 'own25', name: 'Curator', desc: 'Own 25 different items', coins: 200, test: (c) => c.owned.size >= 25 },
    { id: 'commons', name: 'Common Ground', desc: 'Own every Common skin', coins: 100, test: (c) => BR.DROP_ITEMS.filter((x) => x.type === 'skin' && x.rarity === 'common').every((x) => c.owned.has(x.id)) },
    { id: 'mythic', name: 'Something Special', desc: 'Own a Mythic item', coins: 250, test: (c) => c.profile.vault.some((i) => BR.itemById[i.itemId].rarity === 'mythic') },
    { id: 'complete', name: 'Full Set', desc: 'Own every item of one type', coins: 300, test: (c) => BR.TYPE_ORDER.some((t) => BR.DROP_ITEMS.filter((x) => x.type === t).every((x) => c.owned.has(x.id))) },
    { id: 'lv10', name: 'Level 10', desc: 'Reach level 10', coins: 150, test: (c) => c.profile.level >= 10 },
    // ---- Update 5: bigger scores and stages, the Pass exclusives that left the level track, and Moonwick ----
    { id: 'score500k', name: 'Half a Million', desc: 'Score 500,000 in one run', coins: 150, test: (c) => c.bestScore >= 500000 },
    { id: 'score1m', name: 'Seven Figures', desc: 'Score 1,000,000 in one run', coins: 300, test: (c) => c.bestScore >= 1000000 },
    { id: 'stage12', name: 'Beyond the Fuse', desc: 'Reach stage 12', coins: 250, test: (c) => c.bestStage >= 12 },
    { id: 'lv25', name: 'Level 25', desc: 'Reach level 25', coins: 100, item: { itemId: 'f_chrome', shine: 'holo' }, test: (c) => c.profile.level >= 25 },
    { id: 'lv30', name: 'Level 30', desc: 'Reach level 30', coins: 100, item: { itemId: 'f_heart', shine: 'prism' }, test: (c) => c.profile.level >= 30 },
    { id: 's4types', name: 'Moonwick Arrives', desc: 'Own a Moonwick item of every type', coins: 150, test: (c) => BR.TYPE_ORDER.every((t) => BR.DROP_ITEMS.some((x) => x.series === 4 && x.type === t && c.owned.has(x.id))) },
    { id: 'set1', name: 'Room Complete', desc: 'Complete any Moonwick set', coins: 200, hat: 'h_mortar', test: (c) => BR.completeSets(c.owned).length >= 1 },
    { id: 'set3', name: 'Three Floors', desc: 'Complete three Moonwick sets', coins: 250, test: (c) => BR.completeSets(c.owned).length >= 3 },
    { id: 'spire4', name: 'Spire Master', desc: 'Own all four Spire Mythics', coins: 300, test: (c) => BR.setItems('spire').every((x) => c.owned.has(x.id)) },
    { id: 'sigilpops', name: 'Spellcaster', desc: 'Pop 500 groups wearing a Moonwick skin', coins: 150, test: (c) => (c.stats.moonwickPops || 0) >= 500 },
    { id: 'own75', name: 'Archivist', desc: 'Own 75 different items', coins: 150, hat: 'h_crown', test: (c) => c.owned.size >= 75 },
    { id: 'spark25', name: 'Spark Keeper', desc: 'Save 25 runs with the Last Spark', coins: 100, hat: 'h_halo', test: (c) => (c.stats.sparkRuns || 0) >= 25 },
  ];
  /** The Moonwick sets whose four items are all owned. */
  BR.completeSets = (owned) => Object.keys(BR.SETS).filter((id) => BR.setItems(id).every((x) => owned.has(x.id)));
})();
