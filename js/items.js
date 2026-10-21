/* Item catalogue (Series 2 "Arcade"): 28 chest items + 2 Rush Pass exclusives. Items are plain data;
   `cls` names a CSS class in css/skins.css, `recipe` names an fx.js pop recipe, `moment` names a
   signature moment in js/skins.js. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const BR = (G.BR = G.BR || {});

  BR.ITEM_TYPES = {
    skin: { id: 'skin', name: 'Skin', plural: 'Skins', counter: 'Bricks popped', blurb: 'How your bricks look', chest: 'brick' },
    pop: { id: 'pop', name: 'Pop', plural: 'Pops', counter: 'Biggest pop', blurb: 'The effect and sound of every pop', chest: 'pop' },
    board: { id: 'board', name: 'Board', plural: 'Boards', counter: 'Stages reached', blurb: 'The frame and scene behind your bricks', chest: 'board' },
    fuse: { id: 'fuse', name: 'Fuse', plural: 'Fuses', counter: 'Rush Modes', blurb: 'How your fuse and bomb look', chest: 'fuse' },
  };
  BR.TYPE_ORDER = ['skin', 'pop', 'board', 'fuse'];

  const it = (id, type, rarity, name, desc, extra) => Object.assign({ id, type, rarity, name, desc, series: 2 }, extra || {});

  const LIST = [
    // ---- Skins ----
    it('f_candy', 'skin', 'common', 'Candy', 'Shiny sweets with swirly tops.', { cls: 'skin-candy' }),
    it('f_slate', 'skin', 'common', 'Slate', 'Flat stone tiles with a bright ring.', { cls: 'skin-slate' }),
    it('f_marble', 'skin', 'rare', 'Marble', 'Polished stone. Every one has its own veins.', { cls: 'skin-marble' }),
    it('f_glass', 'skin', 'rare', 'Stained Glass', 'See-through colored glass that catches the light.', { cls: 'skin-glass' }),
    it('f_neon', 'skin', 'epic', 'Neon', 'Dark bricks outlined in glowing light.', { cls: 'skin-neon' }),
    it('f_lava', 'skin', 'legendary', 'Magma', 'Glowing cracks that breathe. Pops erupt with lava.', { cls: 'skin-lava', moment: 'lava' }),
    it('f_circuit', 'skin', 'legendary', 'Circuit', 'Etched lines and a chip on top, powered by color.', { cls: 'skin-circuit' }),
    it('f_nova', 'skin', 'mythic', 'Supernova', 'Bricks pulse with light. Pops leave star trails.', { cls: 'skin-nova', moment: 'nova' }),
    it('f_aurora', 'skin', 'mythic', 'Aurora', 'Soft northern lights drift across every brick.', { cls: 'skin-aurora', moment: 'aurora' }),
    it('f_chrome', 'skin', 'epic', 'Chrome', 'Mirror metal with a moving shine.', { cls: 'skin-chrome', pass: true }),
    it('f_heart', 'skin', 'mythic', 'Prism Heart', 'Crystal bricks that bend the light behind them.', { cls: 'skin-heart', moment: 'heart', pass: true }),
    // ---- Pops ----
    it('b_ember', 'pop', 'common', 'Embers', 'Pops throw rising sparks.', { recipe: 'ember', color: '#ff9a3d' }),
    it('b_petal', 'pop', 'common', 'Petals', 'Pops release soft falling petals.', { recipe: 'petal', color: '#ff8fc0' }),
    it('b_glass', 'pop', 'rare', 'Glass', 'Bricks shatter into sharp glass.', { recipe: 'glass', color: '#9fe8ff' }),
    it('b_pixel', 'pop', 'epic', 'Pixels', 'Bricks break into glowing pixels.', { recipe: 'pixel', color: '#7affc9' }),
    it('b_bolt', 'pop', 'legendary', 'Lightning', 'Bolts of lightning jump from your tap.', { recipe: 'lightning', color: '#b9d8ff' }),
    it('b_fire', 'pop', 'mythic', 'Fireworks', 'Big pops launch real fireworks over the board.', { recipe: 'fireworks', color: '#ffd24a', moment: 'fireworks' }),
    // ---- Boards ----
    it('a_deepsea', 'board', 'common', 'Deep Sea', 'Bubbles rise through blue water.', { cls: 'board-deepsea', beam: '#7ae8ff' }),
    it('a_foundry', 'board', 'common', 'Foundry', 'Furnace glow and floating sparks.', { cls: 'board-foundry', beam: '#ffb35a' }),
    it('a_market', 'board', 'rare', 'Night Market', 'Paper lanterns in purple dusk.', { cls: 'board-market', beam: '#ff7ad9' }),
    it('a_orbit', 'board', 'epic', 'Orbit', 'Twinkling stars above a slow planet.', { cls: 'board-orbit', beam: '#9fb8ff' }),
    it('a_greenhouse', 'board', 'legendary', 'Greenhouse', 'Sunbeams and pollen under glass.', { cls: 'board-greenhouse', beam: '#b6ff7a' }),
    it('a_storm', 'board', 'legendary', 'Thunderhead', 'A storm rolls in. Lightning flashes behind the board.', { cls: 'board-storm', beam: '#cfe0ff', moment: 'thunder' }),
    it('a_holo', 'board', 'mythic', 'Hologrid', 'A floating hologram. Line Blasts scan the grid.', { cls: 'board-holo', beam: '#5dffd9', moment: 'scan' }),
    // ---- Fuses ----
    it('u_rope', 'fuse', 'common', 'Rope', 'A thick braided rope fuse.', { cls: 'fuse-rope' }),
    it('u_wire', 'fuse', 'common', 'Copper Wire', 'A shiny copper wire fuse.', { cls: 'fuse-wire' }),
    it('u_neon', 'fuse', 'rare', 'Neon Tube', 'A glowing glass tube that burns down.', { cls: 'fuse-neon' }),
    it('u_ice', 'fuse', 'epic', 'Ice', 'A frosty fuse. In Rush Mode it freezes solid.', { cls: 'fuse-ice', moment: 'ice' }),
    it('u_plasma', 'fuse', 'legendary', 'Plasma', 'Electric arcs crawl along it. Rush Mode turns the board violet.', { cls: 'fuse-plasma', moment: 'plasma' }),
    it('u_dragon', 'fuse', 'mythic', 'Dragon', 'Dragon breath burns the fuse. Rush Mode roars.', { cls: 'fuse-dragon', moment: 'dragon' }),
  ];

  BR.ITEMS = LIST;
  BR.DROP_ITEMS = LIST.filter((x) => !x.pass);
  BR.DEFAULTS = {
    skin: { id: 'default:skin', type: 'skin', rarity: 'common', name: 'Classic', cls: 'skin-classic', desc: 'The original glossy brick.', isDefault: true },
    pop: { id: 'default:pop', type: 'pop', rarity: 'common', name: 'Classic Pop', recipe: 'classic', color: '#ffffff', desc: 'Shards and sparks.', isDefault: true },
    board: { id: 'default:board', type: 'board', rarity: 'common', name: 'Midnight', cls: 'board-classic', beam: '#9ff0ff', desc: 'The original night sky.', isDefault: true },
    fuse: { id: 'default:fuse', type: 'fuse', rarity: 'common', name: 'Basic Cord', cls: 'fuse-classic', desc: 'A plain fuse.', isDefault: true },
  };
  BR.itemById = Object.fromEntries(LIST.concat(Object.values(BR.DEFAULTS)).map((x) => [x.id, x]));
  BR.itemsOfType = (type) => LIST.filter((x) => x.type === type);
})();
