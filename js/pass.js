/* Pop Pass: a free reward track with one tier per level. Plus one-time Trophies. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  const SPECIAL = {
    5: { kind: 'chest', chest: 'brick' },
    10: { kind: 'chest', chest: 'pop' },
    15: { kind: 'chest', chest: 'board' },
    20: { kind: 'chest', chest: 'fuse' },
    25: { kind: 'item', itemId: 'f_chrome', shine: 'holo' },
    28: { kind: 'chest', chest: 'golden' },
    30: { kind: 'item', itemId: 'f_heart', shine: 'prism' },
  };

  /** Reward for finishing the given level (tier n = the climb out of level n). */
  BR.passReward = function passReward(tier) {
    if (SPECIAL[tier]) return SPECIAL[tier];
    if (tier > BR.CFG.passTiers) return { kind: 'coins', amount: 75 };
    return { kind: 'coins', amount: Math.round((25 + 3 * tier) / 5) * 5 };
  };
  BR.PASS_SEASON = { n: 3, name: 'Carnival', label: 'Season 3 · Carnival' };
  BR.PASS = Array.from({ length: BR.CFG.passTiers }, (_, i) => Object.assign({ tier: i + 1 }, BR.passReward(i + 1)));

  BR.rewardLabel = function rewardLabel(r) {
    if (r.kind === 'coins') return `${r.amount} Coins`;
    if (r.kind === 'chest') return BR.CHESTS[r.chest].name;
    if (r.kind === 'item') return BR.itemById[r.itemId].name;
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
  ];
})();
