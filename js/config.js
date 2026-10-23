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
      burnGrowth: 1.15,   // burn speed multiplier per stage ...
      burnCap: 8,         // ... which stops growing at this stage, so a long run is never lost to the clock alone
      floorFrom: 6,       // from this stage a pop of 3+ always pays at least floorTime seconds
      floorTime: 1.4,
      shuffleRefund: 2,   // a reshuffle (no moves left) gives a little time back
      spark: 2.5,         // Last Spark: seconds you get to land a bigger pop after the fuse hits zero ...
      sparkNeed: 4,       // ... a pop of this many bricks ...
      sparkNeedFrom: 3,   // ... and from this stage on it takes sparkNeedBig, so the save is earned (it used to save 3 runs in 4)
      sparkNeedBig: 5,
      sparkNeedFrom2: 99, // (a second step is available: from this stage on, one more brick)
      sparkNeedBig2: 6,
      sparkFuse: 6,       // ...and the fuse you get back
      defuse: 3,          // popping a Fuse brick
      burstPenalty: 5,    // a Fuse brick that runs out
      resumeGrace: 6,     // (unused since Update 7: a resumed run keeps its fuse and the clock waits for the first pop)
      stageFreeze: 1.4,   // fuse holds still during the stage-up wipe
      lowFrac: 0.25,
      critical: 5,
    },
    stage: { goal: 4500, growth: 1.5, multStep: 0.5, sixthColor: 3, seventhColor: 6 },
    fuseBrick: { fromStage: 4, count: 5, chance: 0.2, max: 2 },
    // ---- Rush Mode ----
    // escalate: each Rush in a run needs this much more charge than the one before (+35%), so Rush stays a moment and not a state
    rush: { time: 8, mult: 3, gainBase: 9, gainPerExtra: 3, gainStreak: 2, escalate: 0.35, drain: 2.5, drainDelay: 1.5, popExtend: 0.3, maxTime: 12 },
    // ---- Chill mode (the original 20-move rounds) ----
    chill: { moves: 20, goalBase: 1200, growth: 1.3, unlockLevel: 2, sixthColor: 4, seventhColor: 8, shatterPerMove: 100 },
    power: { cap: 3, charge: 100 },
    streak: { day3: 120, day7Coins: 200, day7Chest: 'golden' },   // the 7-day ring: day 3 pays Coins, day 7 pays Coins and a Golden Chest
    boostsFromRun: 3,      // the Boosts sheet appears before a Rush run once the player has finished this many runs
    // Run Boosts are bought with Coins before a run (see the Boosts sheet). Priced against a typical run's Coins
    // (about 45 before run Coins were doubled in Update 6, about 90 now) so each one is a real choice and none of them pays for itself.
    boosts: {
      longFuse: { id: 'longFuse', name: 'Long Fuse', desc: '+10 seconds on every fuse', cost: 25 },
      headStart: { id: 'headStart', name: 'Head Start', desc: 'Start with a Hammer ready', cost: 15 },
      rushStart: { id: 'rushStart', name: 'Rush Start', desc: 'Rush bar starts 60% full', cost: 20 },
    },
    // Coins for a finished run = scale * sqrt(score / ref) + stageStep * (1 + 2 + .. + stages cleared, capped).
    // Square-root growth keeps sharp players ahead without letting them run away from everyone else.
    // ref 50000 and stageCap 8 before the tile director: players now go further and score more, so the same Coins need more.
    // Update 6: scale 14 -> 16 (about 10% more), then every part doubled (scale 32, stage step 2, first run 40, Daily 30): a typical run pays about 90
    coin: { scale: 32, ref: 45000, stageStep: 2, stageCap: 7, firstOfDay: 40, dailyBonus: 30 },
    xp: { scale: 150, ref: 80000 },   // XP for points = scale * sqrt(score / ref)
    startCoins: 200,
    rerollCost: 30,
    pityEvery: 8,          // every 8th chest of a type without an Epic or better guarantees one
    goldenFallback: 600,   // a Golden Chest pays this when nothing Epic or better is left to find
    passTiers: 30,         // the level track's old Pass length (levels keep paying Coins)
    // The Pop Pass is a season: 30 tiers filled by season XP, which starts at zero each season while the player's level stays.
    // xpPerTier is set against the bots (tests/balance.js): a season takes about 250 casual runs, 150 average, 120 sharp.
    season: { n: 4, name: 'Moonwick', tiers: 30, xpPerTier: 2400 },
  };

  /** Pass levels: gentle, so the 30 tiers take a few weeks of casual play. */
  BR.xpForLevel = (level) => 500 + 150 * (level - 1);
  /** XP for the points scored in a run: a square root like Coins, so a sharp player's run is worth about twice a casual one's, not six times. */
  BR.xpForScore = (score) => Math.round(BR.CFG.xp.scale * Math.sqrt(Math.max(0, score) / BR.CFG.xp.ref));

  /** The Last Spark needs a pop of at least this many bricks at this stage. */
  BR.sparkNeed = (stage) => { const F = BR.CFG.fuse; return stage >= F.sparkNeedFrom2 ? F.sparkNeedBig2 : stage >= F.sparkNeedFrom ? F.sparkNeedBig : F.sparkNeed; };
  /** A pop must reach this size to grow the combo: 4 at first, one more brick every two links of the chain (cap 8). */
  BR.comboNeed = (streak) => Math.min(8, 4 + Math.floor(Math.max(0, streak) / 2));
  BR.stageGoal = (stage) => Math.round((BR.CFG.stage.goal * Math.pow(BR.CFG.stage.growth, stage - 1)) / 50) * 50;
  BR.stageMult = (stage) => 1 + BR.CFG.stage.multStep * (stage - 1);
  BR.burnRate = (stage) => Math.pow(BR.CFG.fuse.burnGrowth, Math.min(stage, BR.CFG.fuse.burnCap) - 1);
  BR.chillGoal = (round) => Math.round((BR.CFG.chill.goalBase * Math.pow(BR.CFG.chill.growth, round - 1)) / 50) * 50;
  /** Fuse seconds added by a pop of n bricks. */
  BR.popTime = (n, stage = 1) => {
    const F = BR.CFG.fuse, t = F.popBase + F.popPerExtra * Math.max(0, n - 2);
    return stage >= F.floorFrom && n >= 3 ? Math.max(t, F.floorTime) : t;
  };

  /** Deterministic seed for Daily Rush from a date key like 2026-10-21. */
  BR.dailySeed = (key) => { let h = 2166136261; for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) || 1; };
  BR.dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  BR.weekKey = (d = new Date()) => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return BR.dayKey(t); };

  BR.PALETTE = [
    { name: 'Ruby', hi: '#ff8191', lo: '#dc2f48', glow: '#ff5468' },
    { name: 'Sapphire', hi: '#78adff', lo: '#2759dc', glow: '#4a8dff' },
    { name: 'Emerald', hi: '#68f2ac', lo: '#0f9c5d', glow: '#34d98a' },
    { name: 'Topaz', hi: '#ffe272', lo: '#e79a08', glow: '#ffcf3f' },
    // Amethyst was a blue-violet that merged with Sapphire for colour-blind players (CIEDE2000 1.9 to 3.9 under deuteranopia and protanopia);
    // it is now an orchid magenta (7.5 and 9.5, and 27.6 for everyone else). Shape hints still tell them apart by outline.
    { name: 'Amethyst', hi: '#d98cf0', lo: '#9a1f94', glow: '#d46bf2' },
    { name: 'Amber', hi: '#ffae6e', lo: '#e55a18', glow: '#ff8a3d' },
    { name: 'Aqua', hi: '#7ae8ff', lo: '#0f9cc4', glow: '#25d0f0' },
  ];
  BR.COLOR_NAMES = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'aqua'];

  // One rarity scale for every chest. `weight` = normal chests, `golden` = Golden Chest.
  BR.RARITIES = [
    { id: 'common', name: 'Common', color: '#9fb0d6', weight: 60, golden: 0, refund: 40, level: 1 },
    { id: 'rare', name: 'Rare', color: '#43a0ff', weight: 25, golden: 0, refund: 100, level: 2 },
    { id: 'epic', name: 'Epic', color: '#b565ff', weight: 10, golden: 70, refund: 250, level: 3 },
    { id: 'legendary', name: 'Legendary', color: '#ffb02e', weight: 4, golden: 25, refund: 600, level: 4 },
    { id: 'mythic', name: 'Mythic', color: '#ff4d6d', weight: 1, golden: 5, refund: 1500, level: 5 },
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
