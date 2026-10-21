/* Rush Pass: a free reward track with one tier per level. Plus one-time Trophies. */
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
    if (tier > BR.CFG.passTiers) return { kind: 'coins', amount: 100 };
    return { kind: 'coins', amount: Math.round((40 + 6 * tier) / 5) * 5 };
  };
  BR.PASS = Array.from({ length: BR.CFG.passTiers }, (_, i) => Object.assign({ tier: i + 1 }, BR.passReward(i + 1)));

  BR.rewardLabel = function rewardLabel(r) {
    if (r.kind === 'coins') return `${r.amount} Coins`;
    if (r.kind === 'chest') return BR.CHESTS[r.chest].name;
    if (r.kind === 'item') return BR.itemById[r.itemId].name;
    return '';
  };

  // ---- Trophies: one-time goals with a Coin reward ----
  BR.TROPHIES = [
    { id: 'first_run', name: 'First Pop', desc: 'Finish your first run', coins: 100, test: (c) => c.stats.runs >= 1 },
    { id: 'first_rush', name: 'Feeling the Rush', desc: 'Trigger Rush Mode', coins: 100, test: (c) => c.stats.rushes >= 1 },
    { id: 'stage5', name: 'Hot Streak', desc: 'Reach stage 5', coins: 150, test: (c) => c.bestStage >= 5 },
    { id: 'stage10', name: 'Fuse Master', desc: 'Reach stage 10', coins: 400, test: (c) => c.bestStage >= 10 },
    { id: 'big100', name: 'Big Popper', desc: 'Pop 100 groups of 10 or more', coins: 300, test: (c) => c.stats.bigPops >= 100 },
    { id: 'bricks5k', name: 'Brick Breaker', desc: 'Pop 5,000 bricks in total', coins: 250, test: (c) => c.stats.bricks >= 5000 },
    { id: 'line5', name: 'Line Boss', desc: 'Make 5 Line Blasts', coins: 200, test: (c) => c.stats.lineBlasts >= 5 },
    { id: 'power25', name: 'Power Player', desc: 'Use 25 power-ups', coins: 150, test: (c) => c.stats.powerups >= 25 },
    { id: 'defuse10', name: 'Bomb Squad', desc: 'Defuse 10 Fuse bricks', coins: 200, test: (c) => c.stats.defused >= 10 },
    { id: 'daily1', name: 'Daily Rusher', desc: 'Finish a Daily Rush', coins: 100, test: (c) => c.stats.dailyRuns >= 1 },
    { id: 'chests10', name: 'Chest Fan', desc: 'Open 10 chests', coins: 200, test: (c) => c.profile.opened >= 10 },
    { id: 'own10', name: 'Collector', desc: 'Own 10 different items', coins: 250, test: (c) => new Set(c.profile.vault.map((i) => i.itemId)).size >= 10 },
    { id: 'commons', name: 'Common Ground', desc: 'Own every Common skin', coins: 200, test: (c) => BR.DROP_ITEMS.filter((x) => x.type === 'skin' && x.rarity === 'common').every((x) => c.owned.has(x.id)) },
    { id: 'mythic', name: 'Something Special', desc: 'Own a Mythic item', coins: 500, test: (c) => c.profile.vault.some((i) => BR.itemById[i.itemId].rarity === 'mythic') },
    { id: 'lv10', name: 'Level 10', desc: 'Reach level 10', coins: 300, test: (c) => c.profile.level >= 10 },
  ];
})();
