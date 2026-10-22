/* Item catalogue (Series 2 "Arcade" 28 + 2, Series 3 "Carnival" 28, Series 4 "Moonwick" 28 + 2 Pass exclusives). Items are plain data;
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
    // ---- Series 4 "Moonwick": Skins ----
    it('f_patchwork', 'skin', 'common', 'Patchwork', 'Quilted fabric squares, each stitched with its colour\'s sigil.', { cls: 'skin-patchwork', series: 4, hero: 5 }),
    it('f_glowcap', 'skin', 'common', 'Glowcap', 'Spotted mushroom caps that glow from underneath.', { cls: 'skin-glowcap', series: 4, hero: 0, set: 'glade' }),
    it('f_spellbook', 'skin', 'rare', 'Spellbook', 'Little leather spellbooks with a gold-foil sigil.', { cls: 'skin-spellbook', series: 4, hero: 2, set: 'library' }),
    it('f_origami', 'skin', 'rare', 'Origami', 'Folded paper, each colour folded in the shape of its sigil.', { cls: 'skin-origami', series: 4, hero: 3 }),
    it('f_potion', 'skin', 'epic', 'Potion', 'Sigil-shaped bottles of sloshing elixir. They boil in Rush Mode.', { cls: 'skin-potion', moment: 'potion', series: 4, hero: 6, set: 'alchemy' }),
    it('f_gemcut', 'skin', 'epic', 'Gemcut', 'Every colour a gem with its own cut. Big pops fire a prism of light.', { cls: 'skin-gemcut', moment: 'gem', series: 4, hero: 0 }),
    it('f_hourglass', 'skin', 'legendary', 'Hourglass', 'Sand runs in every brick. At a stage-up they all turn over in a wave.', { cls: 'skin-hourglass', moment: 'hourglass', series: 4, hero: 1, set: 'vault' }),
    it('f_sigil', 'skin', 'mythic', 'Sigil', 'Glowing runes. Big pops cast a spell circle; Rush lights a ring of runes.', { cls: 'skin-sigil', moment: 'sigil', series: 4, hero: 4, set: 'spire' }),
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
    // ---- Series 4 "Moonwick": Pops ----
    it('b_fireflies', 'pop', 'common', 'Fireflies', 'Fireflies wander off and blink out.', { recipe: 'fireflies', color: '#d9ff7a', series: 4, set: 'glade' }),
    it('b_wishdust', 'pop', 'common', 'Wishdust', 'Glitter that spirals upward.', { recipe: 'wishdust', color: '#ffe9a8', series: 4 }),
    it('b_birds', 'pop', 'rare', 'Paper Birds', 'The bricks fold into paper birds that flap away.', { recipe: 'birds', color: '#f4ecd8', series: 4, set: 'library' }),
    it('b_runes', 'pop', 'rare', 'Rune Burst', 'The popped colour\'s sigil flies out of the pop.', { recipe: 'runes', color: '#cfe0ff', series: 4 }),
    it('b_goldleaf', 'pop', 'epic', 'Gold Leaf', 'Bricks turn to gold and crumble into flickering leaf.', { recipe: 'goldleaf', color: '#ffcf6b', moment: 'goldleaf', series: 4, set: 'alchemy' }),
    it('b_sandfall', 'pop', 'epic', 'Sandfall', 'Bricks pour away as sand. In Rush the sand hangs in the air.', { recipe: 'sandfall', color: '#f0cf8c', moment: 'sandfall', series: 4, set: 'vault' }),
    it('b_whirlgate', 'pop', 'legendary', 'Whirlgate', 'A spiral vortex. Big pops open a portal with an eye inside.', { recipe: 'whirlgate', color: '#27dcc6', moment: 'whirlgate', series: 4 }),
    it('b_constellation', 'pop', 'mythic', 'Constellation', 'Every pop is drawn in star lines. Big pops summon a star creature.', { recipe: 'constellation', color: '#e8f0ff', moment: 'constellation', series: 4, set: 'spire' }),
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
    // ---- Series 4 "Moonwick": Boards ----
    it('a_library', 'board', 'common', 'Grand Library', 'Walnut shelves, warm candlelight and drifting dust.', { cls: 'board-library', beam: '#ffcf6b', series: 4, set: 'library' }),
    it('a_glade', 'board', 'rare', 'Moonlit Glade', 'A night forest ringed by glowing mushrooms.', { cls: 'board-glade', beam: '#7ae8d0', series: 4, set: 'glade' }),
    it('a_alchemy', 'board', 'epic', 'Alchemy Lab', 'Copper pipes and bubbling flasks. A Line Blast boils the cauldron over.', { cls: 'board-alchemy', beam: '#6bff9e', moment: 'alchemy', series: 4, set: 'alchemy' }),
    it('a_observatory', 'board', 'legendary', 'Observatory', 'A brass dome and orrery. Each stage turns the dial one notch.', { cls: 'board-observatory', beam: '#ffe2a0', moment: 'observatory', series: 4, set: 'vault' }),
    it('a_isles', 'board', 'legendary', 'Floating Isles', 'Islands in a dawn sky, with waterfalls. The first light scene.', { cls: 'board-isles', beam: '#fff1c9', moment: 'isles', series: 4 }),
    it('a_tower', 'board', 'mythic', 'Moonwick Tower', 'A window lights every stage; the bell tolls on Line Blasts and the moon rises in Rush.', { cls: 'board-tower', beam: '#e8f0ff', moment: 'tower', series: 4, set: 'spire' }),
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
    // ---- Series 4 "Moonwick": Fuses ----
    it('u_candle', 'fuse', 'common', 'Candlewick', 'A waxed wick. Fizz is a melting wax bomb.', { cls: 'fuse-candle', glow: '#ffcf6b', series: 4, set: 'library' }),
    it('u_wand', 'fuse', 'rare', 'Star Wand', 'A wooden wand with a star tip. Fizz wears a starry robe.', { cls: 'fuse-wand', glow: '#ffe27a', series: 4, set: 'glade' }),
    it('u_elixir', 'fuse', 'epic', 'Elixir', 'A tube of potion. Fizz is a flask that drinks it when Rush starts.', { cls: 'fuse-elixir', glow: '#7affb0', moment: 'elixir', series: 4, set: 'alchemy' }),
    it('u_sandglass', 'fuse', 'legendary', 'Sandglass', 'A rope of sand. Fizz is an hourglass that stops its sand in Rush.', { cls: 'fuse-sandglass', glow: '#ffd98a', moment: 'sandglass', series: 4, set: 'vault' }),
    it('u_runechain', 'fuse', 'legendary', 'Runechain', 'A chain of runes. Fizz is a stone golem that gains a rune each stage.', { cls: 'fuse-runechain', glow: '#8fd8ff', moment: 'runechain', series: 4 }),
    it('u_moonrise', 'fuse', 'mythic', 'Moonrise', 'Fizz is the moon, and its phase shows the time left. The Last Spark is an eclipse.', { cls: 'fuse-moonrise', glow: '#e8f0ff', moment: 'moonrise', series: 4, set: 'spire' }),
    // ---- Series 4 "Moonwick": Pop Pass Season 4 exclusives (not in chests) ----
    it('b_wisps', 'pop', 'epic', 'Wisps', 'Friendly ghosts float up from every brick.', { recipe: 'wisps', color: '#cdeaff', moment: 'wisps', series: 4, pass: true }),
    it('f_moonglass', 'skin', 'mythic', 'Moonglass', 'Leaded glass bricks. In Rush the board becomes one window onto the full moon.', { cls: 'skin-moonglass', moment: 'moonglass', series: 4, hero: 1, pass: true }),
  ];

  BR.ITEMS = LIST;
  /** Moonwick sets: wearing all four items together adds a crest and one flourish (cosmetic only). */
  BR.SETS = {
    library: { id: 'library', name: 'Library', flourish: 'Bookstorm' },
    glade: { id: 'glade', name: 'Glade', flourish: 'Fairy Ring' },
    alchemy: { id: 'alchemy', name: 'Alchemy', flourish: 'Great Work' },
    vault: { id: 'vault', name: 'Time Vault', flourish: 'Time Turn' },
    spire: { id: 'spire', name: 'Spire', flourish: 'Moonwick Ascendant' },
  };
  BR.setItems = (id) => LIST.filter((x) => x.set === id);
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
