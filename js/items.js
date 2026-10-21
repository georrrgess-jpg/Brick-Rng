/* Item catalogue. Series 1 "Foundry": 8 Facets, 5 Bursts, 5 Arenas. Items are plain data; adding a series
   means adding objects here (plus the CSS class / fx recipe a new item names). */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  BR.ITEM_TYPES = {
    facet: { id: 'facet', name: 'Facet', plural: 'Facets', tracker: 'Bricks popped', blurb: 'Brick skin' },
    burst: { id: 'burst', name: 'Burst', plural: 'Bursts', tracker: 'Biggest group', blurb: 'Pop effect' },
    arena: { id: 'arena', name: 'Arena', plural: 'Arenas', tracker: 'Rounds cleared', blurb: 'Board scene' },
  };

  // `cls` is the CSS class the skin layer applies. Burst `recipe` names an fx.js particle recipe.
  const S1 = [
    // ---- Facets ----
    { id: 'f_candy', type: 'facet', rarity: 'rough', name: 'Candy', cls: 'facet-candy', desc: 'Glossy sugar shells with swirled studs.' },
    { id: 'f_slate', type: 'facet', rarity: 'rough', name: 'Slate Tile', cls: 'facet-slate', desc: 'Matte stone tiles with a colored ring.' },
    { id: 'f_marble', type: 'facet', rarity: 'polished', name: 'Marble', cls: 'facet-marble', desc: 'Polished stone with veins that differ per seed.' },
    { id: 'f_glass', type: 'facet', rarity: 'polished', name: 'Stained Glass', cls: 'facet-glass', desc: 'Translucent glass that catches the light.' },
    { id: 'f_neon', type: 'facet', rarity: 'prismatic', name: 'Neon Tube', cls: 'facet-neon', desc: 'Dark bricks outlined in glowing tube light.' },
    { id: 'f_lava', type: 'facet', rarity: 'radiant', name: 'Magma', cls: 'facet-lava', desc: 'Cooled rock with glowing cracks that breathe.' },
    { id: 'f_circuit', type: 'facet', rarity: 'radiant', name: 'Circuit', cls: 'facet-circuit', desc: 'Etched traces and chip studs, powered by color.' },
    { id: 'f_aurora', type: 'facet', rarity: 'celestial', name: 'Aurora', cls: 'facet-aurora', desc: 'Living light that drifts across every brick.' },
    // ---- Bursts ----
    { id: 'b_ember', type: 'burst', rarity: 'rough', name: 'Ember Shower', recipe: 'ember', color: '#ff9a3d', desc: 'Pops throw rising embers.' },
    { id: 'b_petal', type: 'burst', rarity: 'rough', name: 'Petal Drift', recipe: 'petal', color: '#ff8fc0', desc: 'Pops release slow, falling petals.' },
    { id: 'b_glass', type: 'burst', rarity: 'polished', name: 'Glass Shatter', recipe: 'glass', color: '#9fe8ff', desc: 'Bricks break into sharp glass.' },
    { id: 'b_pixel', type: 'burst', rarity: 'prismatic', name: 'Pixel Dust', recipe: 'pixel', color: '#7affc9', desc: 'Bricks dissolve into bright pixels.' },
    { id: 'b_bolt', type: 'burst', rarity: 'radiant', name: 'Stormcall', recipe: 'lightning', color: '#b9d8ff', desc: 'Lightning arcs from your tap to every brick.' },
    // ---- Arenas ----
    { id: 'a_deepsea', type: 'arena', rarity: 'rough', name: 'Deep Sea', cls: 'arena-deepsea', beam: '#7ae8ff', desc: 'Rising bubbles and drifting caustics.' },
    { id: 'a_foundry', type: 'arena', rarity: 'rough', name: 'The Foundry', cls: 'arena-foundry', beam: '#ffb35a', desc: 'Furnace glow and floating sparks.' },
    { id: 'a_market', type: 'arena', rarity: 'polished', name: 'Night Market', cls: 'arena-market', beam: '#ff7ad9', desc: 'Paper lanterns drifting in purple dusk.' },
    { id: 'a_orbit', type: 'arena', rarity: 'prismatic', name: 'Orbit', cls: 'arena-orbit', beam: '#9fb8ff', desc: 'Twinkling stars above a slow planet.' },
    { id: 'a_greenhouse', type: 'arena', rarity: 'radiant', name: 'Greenhouse', cls: 'arena-greenhouse', beam: '#b6ff7a', desc: 'Sunbeams and pollen under glass.' },
  ];

  BR.SERIES = [{ id: 1, name: 'Foundry', items: S1 }];
  BR.ITEMS = BR.SERIES.flatMap((s) => s.items.map((it) => Object.assign({ series: s.id }, it)));

  // Always-owned defaults: the look the game shipped with.
  BR.DEFAULTS = {
    facet: { id: 'default:facet', type: 'facet', rarity: 'rough', name: 'Classic', cls: 'facet-classic', desc: 'The original glossy brick.', isDefault: true },
    burst: { id: 'default:burst', type: 'burst', rarity: 'rough', name: 'Classic Pop', recipe: 'classic', color: '#ffffff', desc: 'Shards and sparks.', isDefault: true },
    arena: { id: 'default:arena', type: 'arena', rarity: 'rough', name: 'Midnight', cls: 'arena-classic', beam: '#9ff0ff', desc: 'The original night sky.', isDefault: true },
  };

  BR.itemById = Object.fromEntries(BR.ITEMS.concat(Object.values(BR.DEFAULTS)).map((it) => [it.id, it]));

  /**
   * Roll one Geode drop. `kind` is 'normal' or 'series'; `rarityIndex` forces a rarity (used by Fusion).
   * Everything about the drop (item, Finish, Tracker, pattern seed) is decided here, before any animation.
   */
  BR.rollDrop = function rollDrop(rng, kind = 'normal', rarityIndex = null) {
    const rarity = rarityIndex != null
      ? BR.RARITIES[Math.min(rarityIndex, BR.RARITIES.length - 1)]
      : rng.weighted(BR.RARITIES, (r) => (kind === 'series' ? r.series : r.weight));
    let pool = BR.ITEMS.filter((it) => it.rarity === rarity.id);
    // pick the type first so Facets, Bursts and Arenas are equally likely when a rarity has all three
    const types = Array.from(new Set(pool.map((it) => it.type)));
    const type = rng.pick(types);
    pool = pool.filter((it) => it.type === type);
    const item = rng.pick(pool);
    const finish = rng.weighted(BR.FINISHES, (f) => f.weight);
    const tracker = rng.chance(0.1) ? { stat: BR.ITEM_TYPES[type].tracker, value: 0 } : null;
    return {
      itemId: item.id, type, rarity: rarity.id, finish: finish.id,
      seed: type === 'facet' ? rng.int(10000) : 0,
      tracker,
    };
  };
})();
