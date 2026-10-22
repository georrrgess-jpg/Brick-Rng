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
  /** Series 2 "Arcade" shipped 28 chest items and 2 Pass items; Series 3 "Carnival" adds 28 more. */

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
    // ---- Series 3 "Carnival": Skins ----
    it('f_gumdrop', 'skin', 'common', 'Gumdrop', 'Soft jelly sweets with a wet shine and sugar crystals.', { cls: 'skin-gumdrop', series: 3, hero: 0 }),
    it('f_wood', 'skin', 'common', 'Wood Block', 'Painted toy blocks with real wood grain.', { cls: 'skin-wood', series: 3, hero: 3 }),
    it('f_bubble', 'skin', 'rare', 'Bubble', 'Thin, shiny soap bubbles with a drifting glint.', { cls: 'skin-bubble', series: 3, hero: 4 }),
    it('f_bean', 'skin', 'rare', 'Jelly Bean', 'Glossy speckled beans. Some stand up and some lie down.', { cls: 'skin-bean', series: 3, hero: 2 }),
    it('f_lantern', 'skin', 'epic', 'Lantern', 'Paper lanterns with a flame that flickers inside.', { cls: 'skin-lantern', moment: 'lantern', series: 3, hero: 5 }),
    it('f_icecube', 'skin', 'epic', 'Ice Cube', 'Clear ice with frozen bubbles. Pops shatter into frost.', { cls: 'skin-icecube', moment: 'frost', series: 3, hero: 6 }),
    it('f_clock', 'skin', 'legendary', 'Clockwork', 'Brass gears that turn. Big pops spin every gear.', { cls: 'skin-clock', moment: 'gears', series: 3, hero: 3 }),
    it('f_slime', 'skin', 'legendary', 'Slime', 'Living goo with eyes that follow your finger.', { cls: 'skin-slime', moment: 'slime', series: 3, hero: 2 }),
    it('f_galaxy', 'skin', 'mythic', 'Galaxy', 'A tiny nebula in every brick. Rush Mode lights the whole board.', { cls: 'skin-galaxy', moment: 'galaxy', series: 3, hero: 4 }),
    it('f_phoenix', 'skin', 'mythic', 'Phoenix', 'Feathers of flame. Big pops send a phoenix across the board.', { cls: 'skin-phoenix', moment: 'phoenix', series: 3, hero: 3 }),
    // ---- Pops ----
    it('b_ember', 'pop', 'common', 'Embers', 'Pops throw rising sparks.', { recipe: 'ember', color: '#ff9a3d' }),
    it('b_petal', 'pop', 'common', 'Petals', 'Pops release soft falling petals.', { recipe: 'petal', color: '#ff8fc0' }),
    it('b_glass', 'pop', 'rare', 'Glass', 'Bricks shatter into sharp glass.', { recipe: 'glass', color: '#9fe8ff' }),
    it('b_pixel', 'pop', 'epic', 'Pixels', 'Bricks break into glowing pixels.', { recipe: 'pixel', color: '#7affc9' }),
    it('b_bolt', 'pop', 'legendary', 'Lightning', 'Bolts of lightning jump from your tap.', { recipe: 'lightning', color: '#b9d8ff' }),
    it('b_fire', 'pop', 'mythic', 'Fireworks', 'Big pops launch real fireworks over the board.', { recipe: 'fireworks', color: '#ffd24a', moment: 'fireworks' }),
    // ---- Series 3 "Carnival": Pops ----
    it('b_confetti', 'pop', 'common', 'Confetti', 'A puff of bright paper squares.', { recipe: 'confetti', color: '#ff5fa8', series: 3 }),
    it('b_bubbles', 'pop', 'common', 'Bubbles', 'Soap bubbles that drift up and pop.', { recipe: 'bubbles', color: '#7fd8ff', series: 3 }),
    it('b_coins', 'pop', 'rare', 'Coins', 'Spinning gold coins and a cash-register chime.', { recipe: 'coins', color: '#ffc83d', series: 3 }),
    it('b_leaves', 'pop', 'rare', 'Leaves', 'Autumn leaves that tumble down.', { recipe: 'leaves', color: '#ff8a3d', series: 3 }),
    it('b_neon', 'pop', 'epic', 'Neon Burst', 'Bright outline bursts and a laser zap.', { recipe: 'neon', color: '#3dffd0', series: 3 }),
    it('b_snow', 'pop', 'epic', 'Snow', 'Snowflakes drift slowly with a soft chime.', { recipe: 'snow', color: '#bfe8ff', series: 3 }),
    it('b_thunder', 'pop', 'legendary', 'Thunder', 'A crack of lightning and a rolling boom.', { recipe: 'thunder', color: '#9fb8ff', series: 3, moment: 'thunderpop' }),
    it('b_ink', 'pop', 'legendary', 'Ink Splash', 'Ink splatters behind the group, then fades.', { recipe: 'ink', color: '#a56bff', series: 3, moment: 'ink' }),
    it('b_nova', 'pop', 'mythic', 'Nova Burst', 'Every pop implodes into a flash. Big pops ripple the board.', { recipe: 'supernova', color: '#fff2a8', series: 3, moment: 'novapop' }),
    it('b_dragon', 'pop', 'mythic', 'Dragon Fire', 'Flame sweeps out of the group. Big pops roar.', { recipe: 'dragonfire', color: '#ff7a2a', series: 3, moment: 'firepop' }),
    // ---- Boards ----
    it('a_deepsea', 'board', 'common', 'Deep Sea', 'Bubbles rise through blue water.', { cls: 'board-deepsea', beam: '#7ae8ff' }),
    it('a_foundry', 'board', 'common', 'Foundry', 'Furnace glow and floating sparks.', { cls: 'board-foundry', beam: '#ffb35a' }),
    it('a_market', 'board', 'rare', 'Night Market', 'Paper lanterns in purple dusk.', { cls: 'board-market', beam: '#ff7ad9' }),
    it('a_orbit', 'board', 'epic', 'Orbit', 'Twinkling stars above a slow planet.', { cls: 'board-orbit', beam: '#9fb8ff' }),
    it('a_greenhouse', 'board', 'legendary', 'Greenhouse', 'Sunbeams and pollen under glass.', { cls: 'board-greenhouse', beam: '#b6ff7a' }),
    it('a_storm', 'board', 'legendary', 'Thunderhead', 'A storm rolls in. Lightning flashes behind the board.', { cls: 'board-storm', beam: '#cfe0ff', moment: 'thunder' }),
    it('a_holo', 'board', 'mythic', 'Hologrid', 'A floating hologram. Line Blasts scan the grid.', { cls: 'board-holo', beam: '#5dffd9', moment: 'scan' }),
    // ---- Series 3 "Carnival": Boards ----
    it('a_carnival', 'board', 'common', 'Carnival Night', 'String lights and a slow ferris wheel.', { cls: 'board-carnival', beam: '#ffd36b', series: 3 }),
    it('a_beach', 'board', 'rare', 'Beach', 'Sun, sand and waves rolling in.', { cls: 'board-beach', beam: '#7fe8ff', series: 3 }),
    it('a_volcano', 'board', 'epic', 'Volcano', 'Lava glow and drifting ash.', { cls: 'board-volcano', beam: '#ff7a3d', series: 3 }),
    it('a_aurora', 'board', 'legendary', 'Aurora Sky', 'Northern lights that ripple on every Line Blast.', { cls: 'board-aurora', beam: '#7affd9', moment: 'auroraSky', series: 3 }),
    // ---- Fuses ----
    it('u_rope', 'fuse', 'common', 'Rope', 'A thick braided rope fuse.', { cls: 'fuse-rope', glow: '#ffb347' }),
    it('u_wire', 'fuse', 'common', 'Copper Wire', 'A shiny copper wire fuse.', { cls: 'fuse-wire', glow: '#ff9a5a' }),
    it('u_neon', 'fuse', 'rare', 'Neon Tube', 'A glowing glass tube that burns down.', { cls: 'fuse-neon', glow: '#3de1ff' }),
    it('u_ice', 'fuse', 'epic', 'Ice', 'A frosty fuse. In Rush Mode it freezes solid.', { cls: 'fuse-ice', moment: 'ice', glow: '#bfe8ff' }),
    it('u_plasma', 'fuse', 'legendary', 'Plasma', 'Electric arcs crawl along it. Rush Mode turns the board violet.', { cls: 'fuse-plasma', moment: 'plasma', glow: '#b36bff' }),
    it('u_candy', 'fuse', 'common', 'Candy Cane', 'A striped candy cane that burns down sweet.', { cls: 'fuse-candy', glow: '#ff5fa8', series: 3 }),
    it('u_vine', 'fuse', 'rare', 'Vine', 'A leafy vine. Leaves fall as it burns.', { cls: 'fuse-vine', glow: '#6bff9e', series: 3 }),
    it('u_rod', 'fuse', 'epic', 'Lightning Rod', 'Copper rod with arcs that crackle in Rush Mode.', { cls: 'fuse-rod', glow: '#9fd8ff', moment: 'rod', series: 3 }),
    it('u_phoenix', 'fuse', 'legendary', 'Phoenix Tail', 'Feathers burn down the fuse. The bomb hatches at Rush start.', { cls: 'fuse-phoenix', glow: '#ff9a3d', moment: 'hatch', series: 3 }),
    it('u_dragon', 'fuse', 'mythic', 'Dragon', 'Dragon breath burns the fuse. Rush Mode roars.', { cls: 'fuse-dragon', moment: 'dragon', glow: '#ff7a2a' }),
  ];

  BR.ITEMS = LIST;
  BR.DROP_ITEMS = LIST.filter((x) => !x.pass);
  BR.DEFAULTS = {
    skin: { id: 'default:skin', type: 'skin', rarity: 'common', name: 'Classic', cls: 'skin-classic', desc: 'The original glossy brick.', isDefault: true },
    pop: { id: 'default:pop', type: 'pop', rarity: 'common', name: 'Classic Pop', recipe: 'classic', color: '#ffffff', desc: 'Shards and sparks.', isDefault: true },
    board: { id: 'default:board', type: 'board', rarity: 'common', name: 'Midnight', cls: 'board-classic', beam: '#9ff0ff', desc: 'The original night sky.', isDefault: true },
    fuse: { id: 'default:fuse', type: 'fuse', rarity: 'common', name: 'Basic Cord', cls: 'fuse-classic', glow: '#ffb347', desc: 'A plain fuse.', isDefault: true },
  };
  BR.itemById = Object.fromEntries(LIST.concat(Object.values(BR.DEFAULTS)).map((x) => [x.id, x]));
  BR.itemsOfType = (type) => LIST.filter((x) => x.type === type);
})();
