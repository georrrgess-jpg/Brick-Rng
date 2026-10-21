/* Config, palette, rarities and the Core registry. Adding a Core = adding one object to CORES. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  BR.CFG = {
    rows: 8,
    cols: 8,
    startFuel: 25,
    maxFuel: 40,
    firstCrate: 800,
    crateGrowth: 1.5,
    sixthColorAfter: 2, // crates opened before the 6th brick color appears
    seventhColorAfter: 5, // ...and the 7th
  };

  BR.PALETTE = [
    { name: 'Ruby', hi: '#ff8191', lo: '#dc2f48', glow: '#ff5468' },
    { name: 'Sapphire', hi: '#78adff', lo: '#2759dc', glow: '#4a8dff' },
    { name: 'Emerald', hi: '#68f2ac', lo: '#0f9c5d', glow: '#34d98a' },
    { name: 'Topaz', hi: '#ffe272', lo: '#e79a08', glow: '#ffcf3f' },
    { name: 'Amethyst', hi: '#cb98ff', lo: '#7d33dc', glow: '#b36bff' },
    { name: 'Amber', hi: '#ffae6e', lo: '#e55a18', glow: '#ff8a3d' },
    { name: 'Aqua', hi: '#7ae8ff', lo: '#0f9cc4', glow: '#25d0f0' },
  ];

  BR.RARITIES = [
    { id: 'common', name: 'Common', color: '#4b69ff', weight: 60, scrap: 3, level: 1 },
    { id: 'rare', name: 'Rare', color: '#8847ff', weight: 25, scrap: 5, level: 2 },
    { id: 'epic', name: 'Epic', color: '#d32ce6', weight: 10, scrap: 8, level: 3 },
    { id: 'legendary', name: 'Legendary', color: '#eb4b4b', weight: 4, scrap: 12, level: 4 },
    { id: 'mythic', name: 'Mythic', color: '#ffd700', weight: 1, scrap: 20, level: 5 },
  ];
  BR.rarityById = Object.fromEntries(BR.RARITIES.map((r) => [r.id, r]));

  const key = (b, r, c) => r * b.cols + c;
  const rowCells = (b, r) => Array.from({ length: b.cols }, (_, c) => ({ r, c }));
  const colCells = (b, c) => Array.from({ length: b.rows }, (_, r) => ({ r, c }));

  function neighborsOf(board, cells, exclude) {
    const out = [];
    const seen = new Set(exclude);
    for (const p of cells) {
      for (const [dr, dc] of BR.DIRS) {
        const nr = p.r + dr, nc = p.c + dc;
        if (!board.inBounds(nr, nc)) continue;
        const k = key(board, nr, nc);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ r: nr, c: nc });
      }
    }
    return out;
  }

  // 24x24 stroke icons (currentColor).
  const I = {
    spark: '<path d="M12 2.5l2 6.5 6.5 2-6.5 2-2 6.5-2-6.5L3.5 11l6.5-2z"/><path d="M19 3v4M17 5h4"/>',
    thrifty: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M14.6 9.6c-.5-.9-1.5-1.3-2.6-1.3-1.5 0-2.6.7-2.6 1.8 0 2.6 5.2 1.2 5.2 3.8 0 1.1-1.1 1.8-2.6 1.8-1.2 0-2.2-.5-2.7-1.4"/>',
    heavy: '<path d="M7.5 9h9l3 11h-15z"/><circle cx="12" cy="5.5" r="2.5"/><path d="M9.5 14h5"/>',
    chain: '<rect x="2.5" y="8.5" width="12" height="7" rx="3.5"/><rect x="9.5" y="8.5" width="12" height="7" rx="3.5"/>',
    painter: '<path d="M12 3c3.6 4.4 6.2 7.3 6.2 10.6a6.2 6.2 0 0 1-12.4 0C5.8 10.3 8.4 7.4 12 3z"/><path d="M9 14.5a3 3 0 0 0 2.5 2.7"/>',
    flip: '<path d="M8 20V4M8 4L4.5 7.5M8 4l3.5 3.5M16 4v16M16 20l-3.5-3.5M16 20l3.5-3.5"/>',
    bomb: '<circle cx="10.5" cy="14" r="7"/><path d="M15.5 8.8L18 6.3"/><path d="M18.5 2.5v2M21.5 5.5h-2M20.4 3.6l-1.3 1.3"/>',
    laser: '<path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="3.6"/>',
    freeze: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8L20.2 7.2"/><path d="M9.6 4.3L12 6.6l2.4-2.3M9.6 19.7L12 17.4l2.4 2.3"/>',
    rainbow: '<path d="M2.8 18a9.2 9.2 0 0 1 18.4 0M6.3 18a5.7 5.7 0 0 1 11.4 0M9.8 18a2.2 2.2 0 0 1 4.4 0"/>',
    twin: '<circle cx="8.3" cy="12" r="5.8"/><circle cx="15.7" cy="12" r="5.8"/>',
    singularity: '<circle cx="12" cy="12" r="1.8"/><path d="M12 6.2a5.8 5.8 0 1 1-5.8 5.8"/><path d="M12 2a10 10 0 1 1-10 10"/>',
    midas: '<path d="M3 18.5h18l-1.6-10-4.6 4.2L12 6.5 9.2 12.7 4.6 8.5z"/><path d="M6 21.5h12"/>',
  };

  BR.CORES = [
    {
      id: 'spark', name: 'Spark', rarity: 'common', icon: I.spark,
      desc: 'Every pop also pops 2 random bricks touching it.',
      extras(ctx) {
        const near = neighborsOf(ctx.board, ctx.primary, ctx.primary.map((p) => key(ctx.board, p.r, p.c)));
        ctx.rng.shuffle(near);
        return near.slice(0, 2);
      },
    },
    {
      id: 'thrifty', name: 'Thrifty', rarity: 'common', icon: I.thrifty,
      desc: 'Pops of 4+ refund 1 Fuel, and pops of 7+ refund 2.',
      fuelRefund(ctx) { return ctx.n >= 7 ? 2 : ctx.n >= 4 ? 1 : 0; },
    },
    {
      id: 'heavy', name: 'Heavy', rarity: 'common', icon: I.heavy,
      desc: 'Score x2, but pops under 4 bricks cost 2 Fuel.',
      scoreMult() { return 2; },
      fuelCost(ctx, base) { return ctx.n < 4 ? 2 : base; },
    },
    {
      id: 'chain', name: 'Chain', rarity: 'rare', icon: I.chain,
      desc: 'Popping a group also pops the largest group touching it.',
      extras(ctx) {
        const { board, primary } = ctx;
        const wild = ctx.engine.wild();
        const inP = new Set(primary.map((p) => key(board, p.r, p.c)));
        const seen = new Set(inP);
        let best = [];
        for (const p of neighborsOf(board, primary, inP)) {
          const k = key(board, p.r, p.c);
          if (seen.has(k)) continue;
          const g = board.groupAt(p.r, p.c, wild).filter((q) => !inP.has(key(board, q.r, q.c)));
          g.forEach((q) => seen.add(key(board, q.r, q.c)));
          if (g.length > best.length) best = g;
        }
        return best;
      },
    },
    {
      id: 'painter', name: 'Painter', rarity: 'rare', icon: I.painter,
      desc: 'After each pop, 2 bricks next to that color turn the same color.',
      afterRefill(ctx) {
        const { board, rng } = ctx;
        const color = ctx.plan.primary.color;
        const cand = [];
        for (let r = 0; r < board.rows; r++) {
          for (let c = 0; c < board.cols; c++) {
            const b = board.grid[r][c];
            if (b.color === color) continue;
            if (BR.DIRS.some(([dr, dc]) => { const n = board.get(r + dr, c + dc); return n && n.color === color; })) cand.push(b);
          }
        }
        rng.shuffle(cand);
        return cand.slice(0, 2).map((b) => { b.color = color; return { id: b.id, color }; });
      },
    },
    {
      id: 'flip', name: 'Flip', rarity: 'rare', icon: I.flip,
      desc: 'Gravity is reversed: bricks rise to the top and refill from below.',
      gravity() { return 'up'; },
    },
    {
      id: 'bomb', name: 'Bomb', rarity: 'epic', icon: I.bomb,
      desc: 'The brick you tap detonates: 3x3 blast, or 5x5 for groups of 6+. Costs 1 extra Fuel.',
      fuelCost(ctx, base) { return base + 1; },
      extras(ctx) {
        const { board, r, c, n } = ctx;
        const rad = n >= 6 ? 2 : 1;
        const out = [];
        for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) if (board.inBounds(r + dr, c + dc)) out.push({ r: r + dr, c: c + dc });
        return out;
      },
    },
    {
      id: 'laser', name: 'Laser', rarity: 'epic', icon: I.laser,
      desc: 'Pops of 6+ also fire a beam that clears the whole row and column.',
      extras(ctx) {
        if (ctx.n < 6) return [];
        return rowCells(ctx.board, ctx.r).concat(colCells(ctx.board, ctx.c));
      },
    },
    {
      id: 'freeze', name: 'Freeze', rarity: 'epic', icon: I.freeze,
      desc: 'Fuel is frozen for 10 pops. Every pop of 6+ re-freezes 5 more.',
      onEquip(engine) { engine.coreState.charges = 10; },
      fuelCost(ctx, base) { return ctx.engine.coreState.charges > 0 ? 0 : base; },
      onCommit(ctx) {
        const s = ctx.engine.coreState;
        if (s.charges > 0) s.charges--;
        if (ctx.n >= 6) s.charges += 5;
      },
      badge(engine) { return engine.coreState.charges > 0 ? engine.coreState.charges + ' left' : 'spent'; },
    },
    {
      id: 'rainbow', name: 'Rainbow', rarity: 'legendary', icon: I.rainbow,
      desc: 'One brick color is wild and matches everything it touches.',
      onEquip(engine) { engine.coreState.wild = engine.rng.int(engine.board.colorCount); },
      wild(engine) { return engine.coreState.wild; },
    },
    {
      id: 'twin', name: 'Twin', rarity: 'legendary', icon: I.twin,
      desc: 'Each tap also pops the mirror image of your group on the other side.',
      extras(ctx) {
        const { board, r, c } = ctx;
        return board.groupAt(r, board.cols - 1 - c, ctx.engine.wild());
      },
    },
    {
      id: 'singularity', name: 'Singularity', rarity: 'mythic', icon: I.singularity,
      desc: 'After every pop, colors merge into huge groups. Each pop costs 3 Fuel.',
      fuelCost(ctx, base) { return base + 2; },
      afterRefill(ctx) {
        const { board, rng } = ctx;
        const next = [];
        for (let r = 0; r < board.rows; r++) {
          for (let c = 0; c < board.cols; c++) {
            const b = board.grid[r][c];
            const tally = {};
            for (const [dr, dc] of BR.DIRS) { const n = board.get(r + dr, c + dc); if (n) tally[n.color] = (tally[n.color] || 0) + 1; }
            let top = -1, topN = 0;
            for (const col in tally) if (tally[col] > topN || (tally[col] === topN && rng.chance(0.5))) { top = +col; topN = tally[col]; }
            if (top >= 0 && top !== b.color && topN >= 2 && rng.chance(0.7)) next.push({ b, color: top });
          }
        }
        return next.map(({ b, color }) => { b.color = color; return { id: b.id, color }; });
      },
    },
    {
      id: 'midas', name: 'Midas', rarity: 'mythic', icon: I.midas,
      desc: 'All points x3, so crates arrive much faster.',
      scoreMult() { return 3; },
    },
  ];
  BR.coreById = Object.fromEntries(BR.CORES.map((c) => [c.id, c]));
})();
