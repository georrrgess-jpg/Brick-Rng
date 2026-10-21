/* Shared configuration: pacing, economy, palette, rarity table. Tuned with tests/sim.js. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  BR.NAME = 'Pop Rush';

  BR.CFG = {
    rows: 8,
    cols: 8,
    // ---- the Fuse ----
    fuse: {
      start: 30,          // seconds of fuse at the start of a stage
      popBase: 0.8,       // seconds added by any pop
      popPerExtra: 0.4,   // ...plus this for each brick beyond the second
      lineBonus: 5,       // Line Blast
      powerBonus: 2,      // using a power-up
      burnGrowth: 1.15,   // burn speed multiplier per stage
      defuse: 3,          // popping a Fuse brick
      burstPenalty: 5,    // a Fuse brick that runs out
      stageFreeze: 1.4,   // fuse holds still during the stage-up wipe
      lowFrac: 0.25,
      critical: 5,
    },
    stage: { goal: 8000, growth: 1.5, multStep: 0.5, sixthColor: 3, seventhColor: 6 },
    fuseBrick: { fromStage: 4, count: 5, chance: 0.2, max: 2 },
    // ---- Rush Mode ----
    rush: { time: 8, mult: 3, gainBase: 9, gainPerExtra: 3, gainStreak: 2, drain: 2.5, drainDelay: 1.5, popExtend: 0.5, maxTime: 14 },
    // ---- Chill mode (the original 20-move rounds) ----
    chill: { moves: 20, goalBase: 1500, growth: 1.35, unlockLevel: 3, sixthColor: 4, seventhColor: 8, shatterPerMove: 100 },
    power: { cap: 3, charge: 100 },
    boosts: {
      longFuse: { id: 'longFuse', name: 'Long Fuse', desc: '+10 seconds of fuse all run', cost: 150 },
      headStart: { id: 'headStart', name: 'Head Start', desc: 'Start with a free Hammer', cost: 100 },
      doubleCoins: { id: 'doubleCoins', name: 'Double Coins', desc: 'Twice the Coins from this run', cost: 200 },
    },
    coinsPerScore: 600,    // 1 Coin per this many points
    coinsPerStage: 12,     // x the stage number, for each stage cleared
    startCoins: 200,
    rerollCost: 50,
    tradeUpCount: 5,
    passTiers: 30,
  };

  BR.stageGoal = (stage) => Math.round((BR.CFG.stage.goal * Math.pow(BR.CFG.stage.growth, stage - 1)) / 50) * 50;
  BR.stageMult = (stage) => 1 + BR.CFG.stage.multStep * (stage - 1);
  BR.burnRate = (stage) => Math.pow(BR.CFG.fuse.burnGrowth, stage - 1);
  BR.chillGoal = (round) => Math.round((BR.CFG.chill.goalBase * Math.pow(BR.CFG.chill.growth, round - 1)) / 50) * 50;
  /** XP needed to climb out of `level`: gentle and linear so a 30-tier pass is reachable in a few weeks. */
  BR.xpForLevel = (level) => 400 + 120 * (level - 1);
  /** Fuse seconds added by a pop of n bricks. */
  BR.popTime = (n) => BR.CFG.fuse.popBase + BR.CFG.fuse.popPerExtra * Math.max(0, n - 2);

  /** Deterministic seed for Daily Rush from a date key like 2026-10-21. */
  BR.dailySeed = (key) => { let h = 2166136261; for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) || 1; };
  BR.dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  BR.weekKey = (d = new Date()) => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return BR.dayKey(t); };

  BR.PALETTE = [
    { name: 'Ruby', hi: '#ff8191', lo: '#dc2f48', glow: '#ff5468' },
    { name: 'Sapphire', hi: '#78adff', lo: '#2759dc', glow: '#4a8dff' },
    { name: 'Emerald', hi: '#68f2ac', lo: '#0f9c5d', glow: '#34d98a' },
    { name: 'Topaz', hi: '#ffe272', lo: '#e79a08', glow: '#ffcf3f' },
    { name: 'Amethyst', hi: '#cb98ff', lo: '#7d33dc', glow: '#b36bff' },
    { name: 'Amber', hi: '#ffae6e', lo: '#e55a18', glow: '#ff8a3d' },
    { name: 'Aqua', hi: '#7ae8ff', lo: '#0f9cc4', glow: '#25d0f0' },
  ];
  BR.COLOR_NAMES = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'aqua'];

  // One rarity scale for every chest. `weight` = normal chests, `golden` = Golden Chest.
  BR.RARITIES = [
    { id: 'common', name: 'Common', color: '#9fb0d6', weight: 60, golden: 0, sell: 40, level: 1 },
    { id: 'rare', name: 'Rare', color: '#43a0ff', weight: 25, golden: 0, sell: 100, level: 2 },
    { id: 'epic', name: 'Epic', color: '#b565ff', weight: 10, golden: 70, sell: 250, level: 3 },
    { id: 'legendary', name: 'Legendary', color: '#ffb02e', weight: 4, golden: 25, sell: 600, level: 4 },
    { id: 'mythic', name: 'Mythic', color: '#ff4d6d', weight: 1, golden: 5, sell: 1500, level: 5 },
  ];
  BR.rarityById = Object.fromEntries(BR.RARITIES.map((r) => [r.id, r]));

  BR.SHINES = [
    { id: 'plain', name: 'Plain', weight: 55 },
    { id: 'glossy', name: 'Glossy', weight: 30 },
    { id: 'holo', name: 'Holo', weight: 12 },
    { id: 'prism', name: 'Prism', weight: 3 },
  ];
  BR.shineById = Object.fromEntries(BR.SHINES.map((f) => [f.id, f]));
})();
