/* Shared configuration: board size, round pacing, brick palette, rarity table. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  BR.NAME = 'Shardfall';

  BR.CFG = {
    rows: 8,
    cols: 8,
    movesPerRound: 20,
    goalBase: 1500,
    goalGrowth: 1.35,
    sixthColorRound: 4,
    seventhColorRound: 8,
    boosterCap: 3,
    chargeNeeded: 100,
    shatterPerMove: 100, // bonus points for each move left when a round clears
    geodeSeriesEvery: 5, // every Nth level grants a Series Geode
    fusionCount: 5,
    shardGeodeCost: 250,
  };

  /** Round goal: 1,500 then x1.35 each round, rounded to 50. */
  BR.goalFor = (round) => Math.round((BR.CFG.goalBase * Math.pow(BR.CFG.goalGrowth, round - 1)) / 50) * 50;
  /** XP needed to climb out of `level`. */
  BR.xpForLevel = (level) => Math.round(500 * Math.pow(1.2, level - 1));

  BR.PALETTE = [
    { name: 'Ruby', hi: '#ff8191', lo: '#dc2f48', glow: '#ff5468' },
    { name: 'Sapphire', hi: '#78adff', lo: '#2759dc', glow: '#4a8dff' },
    { name: 'Emerald', hi: '#68f2ac', lo: '#0f9c5d', glow: '#34d98a' },
    { name: 'Topaz', hi: '#ffe272', lo: '#e79a08', glow: '#ffcf3f' },
    { name: 'Amethyst', hi: '#cb98ff', lo: '#7d33dc', glow: '#b36bff' },
    { name: 'Amber', hi: '#ffae6e', lo: '#e55a18', glow: '#ff8a3d' },
    { name: 'Aqua', hi: '#7ae8ff', lo: '#0f9cc4', glow: '#25d0f0' },
  ];

  // One rarity scale for every item type. `weight` = normal Geode, `series` = Series Geode.
  BR.RARITIES = [
    { id: 'rough', name: 'Rough', color: '#8da0cf', weight: 60, series: 40, dust: 10, level: 1 },
    { id: 'polished', name: 'Polished', color: '#3d8bff', weight: 25, series: 30, dust: 25, level: 2 },
    { id: 'prismatic', name: 'Prismatic', color: '#b45cff', weight: 10, series: 17, dust: 60, level: 3 },
    { id: 'radiant', name: 'Radiant', color: '#ff4f6d', weight: 4, series: 9, dust: 150, level: 4 },
    { id: 'celestial', name: 'Celestial', color: '#ffd34a', weight: 1, series: 4, dust: 400, level: 5 },
  ];
  BR.rarityById = Object.fromEntries(BR.RARITIES.map((r) => [r.id, r]));

  BR.FINISHES = [
    { id: 'matte', name: 'Matte', weight: 55 },
    { id: 'gloss', name: 'Gloss', weight: 30 },
    { id: 'holo', name: 'Holo', weight: 12 },
    { id: 'prism', name: 'Prism', weight: 3 },
  ];
  BR.finishById = Object.fromEntries(BR.FINISHES.map((f) => [f.id, f]));
})();
