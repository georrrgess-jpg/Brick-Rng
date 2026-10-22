# Pop Rush Update 5: "Moonwick"

**Status: built and verified (see section 9, "What shipped"). The plan below is kept as it was written; section 9 says where the build differs from it.**
The one step left is the owner's: check the build on a real iPhone and a real Android phone.

**What the update is for.** The owner asked for four phases, in this order:
1. Many new cosmetics that are creative, visually stunning and epic.
2. Every bug and visual error fixed.
3. The menus polished and made more intuitive, with better animation.
4. Better game visuals and animation, and logic that is balanced and optimised.

**How the plan was made.** Four investigations of the current build (4.1, with the tile director), each grounded in screenshots,
measurements or the code:
- **Series 4 design.** A design for the new cosmetics, checked against a gallery of all 58 existing items. The three hardest ideas
  were prototyped on the real run screen at iPhone 15 Pro size.
- **Menu audit.** Every screen and sheet outside the board, at five screen sizes plus Larger text, Reduce Motion and the low
  Graphics setting: 60 findings.
- **Run screen and cosmetics audit.** The run screen in every state, the five chest openings and all 62 cosmetics (with the
  defaults): 39 findings plus a verdict on every item.
- **Balance census and startup profile.** Bots of three skill levels played full runs on Update 4.0 and on 4.1, measuring every
  reward system (missions, run goals, Pop Pass, trophies, Coins), Rush, Last Spark, combos and power-ups. A profile showed where
  startup time goes.

The detail behind every section is in `docs/update-5/`:

| File | What it holds |
|---|---|
| `series-4-moonwick.md` | The full Series 4 design: every item, how it is built, budgets, readability, the reveal, sets, the Pass season |
| `prototypes/` | The three prototypes (Hourglass, Moonglass, Sigil) with contact sheets and the readability numbers |
| `audit-menus.md` | The 60 menu findings, with tap counts |
| `audit-run.md` | The 39 run, chest and cosmetics findings, with a verdict on every item |
| `audit-scripts/` | The scripts that produced the audits and the balance numbers, so fixes can be checked the same way |

Numbers come from the same harness as Update 4 (Chromium, no GPU, a phone-sized page, CPU slowed 4x where timing matters), so
absolute times are higher than on a phone; comparisons are what matter. Bot numbers come from simulated players of three skill
levels, each with a skill rating warmed up over 30 runs as the game does.

---

## 0. Targets: how we will know it worked

| Phase | Target | Today |
|---|---|---|
| 1 | 28 new chest items, 2 Pop Pass exclusives and 12 Fizz Hats, each passing the gallery review and the Series 4 budgets | 58 items |
| 1 | Every Series 4 skin keeps the seven brick colours at least 12.5 apart (CIEDE2000), at rest and in Rush | prototypes: 12.9 to 19.5 |
| 1 | The performance budgets still pass with the heaviest Series 4 items equipped | not measured |
| 2 | No open blocker, major or minor finding from either audit, and every polish finding fixed or recorded as a deliberate choice | 0 / 21 / 46 / 32 |
| 2 | Every class of bug found gets a test that would have caught it | none of the 7 classes in 2.5 is tested |
| 2 | Smallest colour distance on every skin, old and new, at least 12.5 | Neon 8.1, Candy 11.0, Circuit 11.6 |
| 3 | Open a waiting chest in 2 taps, equip an item in 2, see a Pass reward claimed in 1 | 5 and a scroll, 3, 0 (silent) |
| 3 | Results buttons on screen within 0.6 s; one Coins total that matches the balance change | 2.9 to 3.9 s; shows 33 of 573 |
| 3 | No blank, black or stale frame in any screen handoff | 70 to 250 ms flashes in 5 places |
| 3 | Play above the fold in landscape; keyboard focus stays inside an open sheet | below the fold; focus escapes |
| 4 | Rush covers 20 to 30% of an average player's run and at most 40% of a sharp player's | 45% and 56% |
| 4 | The 30-tier Pop Pass takes about 300 runs for a casual player and 150 for an average one | 236 and 94 |
| 4 | Last Spark saves the run in 45 to 60% of runs | 75 to 78% |
| 4 | When a run goal or mission asks for a Line Blast or a 12+ group, at least a third of runs can meet it | 1 to 9% (Line Blast), 7 to 32% (12+) |
| 4 | Runs last 130 to 160 s and reach within half a stage of today | 142 to 149 s |
| 4 | Startup to ready under 600 ms (CPU slowed 4x); first chest-reel frame under 120 ms | about 790 ms; 117 to 233 ms |
| All | Checked by hand on a real iPhone and one Android phone at the end of each phase | |

---

## 1. Phase 1: Series 4 "Moonwick" (new cosmetics)

### 1.1 The series

**Theme.** A spell-casters' tower lit by candles. Every item is one room of the tower (the Library, the Moon Garden, the Alchemy
Lab, the Time Vault, the Spire, and a few rooms of their own) and the spell cast in it. It takes the open territory in the
catalogue: magic, books, wax, sand, fabric, faceted gems, matte paper, dawn pastels, a wave across all 64 bricks, and one picture
spread over the whole board. None of these is used by the 58 items today.

**Four rules on top of the Update 3 coherence rules:**
1. **The Seven Sigils.** Each brick colour has a symbol whose outline is that colour's existing Shape hint: Ruby a circle, Sapphire
   a diamond, Emerald a triangle, Topaz a square, Amethyst a hexagon, Amber a star, Aqua a cross. Wherever a Series 4 item draws a
   symbol, it draws the colour's sigil, so the series is colour-blind friendly by design and never disagrees with Shape hints.
2. **Moon silver and candle gold.** Every item has its own palette plus these two accents. No item's main colour is violet (six
   existing items already are). Series 4 badges get a thin silver rim and a sigil corner mark, so the series is easy to find.
3. **Cast, then release.** Series 4 moments open with a short anticipation of 120 to 200 ms (a ring, glyph or line draws in),
   then release. Series 3 moments burst at once, so the two series feel different.
4. **The run shows in the scenery.** Where it fits, an item records the run: a window lights per stage (Moonwick Tower), a notch
   moves per stage (Observatory), a rune per stage (Runechain). It resets each run and never replaces the HUD.

### 1.2 What is new

| | Common | Rare | Epic | Legendary | Mythic | New | Chest after |
|---|---|---|---|---|---|---|---|
| Skins (Brick Chest) | 2 | 2 | 2 | 1 | 1 | 8 | 27 |
| Pops (Pop Chest) | 2 | 2 | 2 | 1 | 1 | 8 | 24 |
| Boards (Board Chest) | 1 | 1 | 1 | 2 | 1 | 6 | 17 |
| Fuses (Fuse Chest) | 1 | 1 | 1 | 2 | 1 | 6 | 16 |
| **Chests** | 6 | 6 | 6 | 6 | 4 | **28** | **84** |
| Pop Pass Season 4 | | | 1 pop | | 1 skin | 2 | |
| Fizz Hats (new category) | 4 | 4 | 3 | 1 | | 12 | |

Why this split: 28 is the size of Series 3, so the effort is known. The Brick and Pop Chests are already deep (19 and 16 items),
while the Board and Fuse Chests are the ones players finish and abandon, so they get proportionally more and each gains a second
Mythic. After Series 4 every chest holds 16 to 27 items and at least two Mythics.

### 1.3 The items

Each entry in `docs/update-5/series-4-moonwick.md` gives the idle look, the pop, the signature moment (Epic and up: big pop,
Line Blast, Rush, stage-up), how it is built, its budget and its readability. In short:

**Skins**

| Item | Rarity | Look and moment |
|---|---|---|
| Patchwork | Common | Quilted fabric with a stitched border and the colour's sigil embroidered in it; holds still |
| Glowcap | Common | Glossy spotted mushroom caps with a soft glow under the rim |
| Spellbook | Rare | Little leather books with gilt corners and a gold-foil sigil |
| Origami | Rare | Matte folded paper, each colour folded in its sigil's shape |
| Potion | Epic | Sigil-shaped bottles of sloshing elixir; corks pop at a stage-up, the potions boil in Rush |
| Gemcut | Epic | Each colour a gem with its own cut; a big pop fires a seven-colour prism fan across the board |
| Hourglass | Legendary | Sand runs in every brick, stops in Rush, and every hourglass flips in one diagonal wave at a stage-up |
| Sigil | Mythic | Glowing runes; a big pop draws a spell circle with a pillar of light; in Rush, eight runes around the board count down the 8 seconds |

**Pops**

| Item | Rarity | What a pop does |
|---|---|---|
| Fireflies | Common | Fireflies wander off and blink |
| Wishdust | Common | Glitter spirals upward |
| Paper Birds | Rare | The bricks fold into paper birds that flap away |
| Rune Burst | Rare | The popped colour's sigil flies out, so the pop also tells you which colour went |
| Gold Leaf | Epic | The bricks turn gold and crumble into flickering leaf |
| Sandfall | Epic | The bricks pour away as sand; in Rush the sand hangs in the air for a beat |
| Whirlgate | Legendary | A spiral vortex; big pops open a portal, and on 12+ an eye blinks inside |
| Constellation | Mythic | Each pop's exact shape is drawn in star lines; big pops summon a star creature |

**Boards**

| Item | Rarity | Scene and moment |
|---|---|---|
| Grand Library | Common | Walnut shelves and candlelight |
| Moonlit Glade | Rare | A night forest ringed by glowing mushrooms |
| Alchemy Lab | Epic | Copper and flasks; a Line Blast boils the cauldron over |
| Observatory | Legendary | A brass dome, telescope and orrery; a notch on the frame advances each stage |
| Floating Isles | Legendary | Islands in a dawn sky with waterfalls, the first light scene in the game (it needs a scrim behind the HUD) |
| Moonwick Tower | Mythic | A window lights per stage, a bell tolls on a Line Blast, the moon rises in Rush |

**Fuses** (each with its own Fizz body)

| Item | Rarity | Rope, bomb and moment |
|---|---|---|
| Candlewick | Common | A waxed wick; Fizz is a melting wax bomb |
| Star Wand | Rare | A wooden wand with a star tip; Fizz wears a starry robe |
| Elixir | Epic | A tube of potion; Fizz is a flask that drinks it when Rush starts |
| Sandglass | Legendary | Fizz is an hourglass that flips over and stops its sand in Rush |
| Runechain | Legendary | Fizz is a stone golem that wakes in Rush and gains a rune each stage |
| Moonrise | Mythic | Fizz is the moon and its phase shows the time left; the Last Spark becomes a lunar eclipse |

**Pop Pass Season 4 exclusives:** Wisps (Epic pop, tier 25: friendly ghosts float up from each brick) and Moonglass (Mythic skin,
tier 30: leaded glass bricks; in Rush the whole board becomes one window onto the full moon).

### 1.4 A new category: Fizz Hats

Fizz the bomb is on screen every second of every run and already has a personality, so a hat is the most personal thing a player
can add. Seven other categories were weighed (Rush fever themes, combo and results banners, board frames, pop trails, profile
titles, chest skins); only Rush fever themes scored well, and they are left for Update 6 because the Rush visuals are spread over
three files today (Phase 4 gathers them in one place first).

- A fifth loadout slot, **Hat**. Default: no hat. A hat changes nothing but looks.
- Hats react to Fizz's existing states with transform only: they sway when calm, tilt toward the flame when watching, slide askew
  when low, bounce on the heartbeat when critical, hover in the Last Spark, drop back with a squash on a save, get frosted in Rush,
  tip like a bow at a stage-up, and fly off when the fuse runs out.
- **12 hats, never sold, never in chests:** a Party Hat free with the update; Top Hat, Pom Beanie, Propeller Cap, Flower Crown,
  Chef's Toque and the Wizard Hat (the season hat) from the Season 4 Pass; a Night Cap and a Tricorn for the first two full
  7-day streak weeks after the update; a Halo (save 25 runs with Last Spark), a Mortarboard (complete any Moonwick set) and a
  Crown (own 75 items) from trophies.
- Build: one element inside the bomb, the hat art as data in `js/hats.js`, the poses in `css/hats.css`, an anchor per fuse body
  (the egg, dragon and hourglass bodies differ), and a "no topper" option for bodies that already wear a cap or crown. Hats show
  in the small fuse previews, get badges, a Collection row and Try it. No change to the fuse's 1.5 ms per frame budget.

### 1.5 Presentation: making players want them

- **The "Midnight" reveal** for every Series 4 Mythic. Night falls and a bell tolls; a full moon rises behind the card; a spell
  circle draws around it; the card eclipses the moon with a corona and flips in; silver-and-gold bursts; then the item's own
  moment plays on the demo board. Legendaries get a short version (moon and corona). Reduce Motion shows the card and moon still;
  a tap skips to the card as today.
- **Sets (cosmetic only).** Five sets of four (Library, Glade, Alchemy, Time Vault, Spire). Wearing a full set adds a crest by the
  stage label and one extra flourish (for example, the Library's Line Blast sends a flock of paper birds across the board). A set
  never changes points, time, odds or drops; it adds no text over the board, at most 900 ms and 30 particles, and is off in Reduce
  Motion.
- **The Tower view in the Collection.** A Series switch shows the tower with one window per Series 4 item, grouped by floor (one
  floor per set). A found item lights its window; a missing one shows its sigil and the chest it comes from. Tapping a window
  opens the item sheet with Try it. Completing a floor rings the bell and plays the set's flourish.
- **Try the set** on the item sheet: all four items on the ten-second practice board, with the set flourish.
- **In the Shop:** an "8 new" chip on each chest card, a rotating spotlight showing one new item's badge and moment, and
  completed chests that reopen with "New in Moonwick: 8 Skins".
- **The what's-new card:** "Moonwick is open", a short loop of four items, and the free Party Hat.
- **On Home:** the "next thing in reach" line also points at sets ("1 item to finish the Library set").

### 1.6 The Pop Pass gets seasons

Today a Pass tier is the player's level (tier = level), so anyone past level 30 would never see Season 4, and its exclusives would
be out of reach for exactly the players who play most. Season 4 needs a **season track**: season XP that starts at zero each
season, while the player's level stays as it is.

| Tier | Reward | Tier | Reward |
|---|---|---|---|
| 3 | Top Hat | 18 | Flower Crown |
| 5 | Brick Chest | 20 | Fuse Chest |
| 8 | Pom Beanie | 23 | Chef's Toque |
| 10 | Pop Chest | 25 | **Wisps** (Epic pop, exclusive) |
| 13 | Propeller Cap | 27 | **Wizard Hat** (Epic hat) |
| 15 | Board Chest | 28 | Golden Chest |
| | | 30 | **Moonglass** (Mythic skin, exclusive) |

The other tiers pay Coins. The label reads "Season 4 · Moonwick". Today's Pass exclusives (Chrome at tier 25, Prism Heart at tier
30) become trophies (reach level 25, reach level 30), so new players can still earn them. How fast a season fills is set in
Phase 4 (section 4.2).

### 1.7 The economy

Prices and Coins per run stay as they are, so the pace a player feels does not change: an average player still opens a chest
about every 15 minutes. Only the total grows.

| Case | Coins to spend | Casual | Average | Sharp |
|---|---|---|---|---|
| Today: 56 chest items | 19,400 | 16.2 h | 9.7 h | 8.6 h |
| After Series 4, today's prices: 84 items | 29,100 | 27.7 h | 16.7 h | 14.7 h |
| A returning player who owns the 56: Series 4 only | 9,700 | 11.6 h | 7.0 h | 6.1 h |
| ...with six new trophies and the Season 4 Pass | 9,700 | 6.2 h | 3.7 h | 3.3 h |

Holding the old 10 hours for a new player would need chest prices cut to 58% or Coin income raised 71%; both would devalue what
players have saved, so neither is recommended. Instead: six new trophies worth about 1,200 Coins once (a Series 4 item of every
type, a Moonwick set, three sets, all four Spire Mythics, 500 groups popped in a sigil skin, own 75 items), and the Season 4
Pass. For a returning player that makes Series 4 a chase of one to two weeks of normal play. Optional: the Board Chest at 400
instead of 450.

### 1.8 How it is built

- **Files.** New `css/s4-skins.css`, `js/s4-skins.js`, `js/s4-pops.js`, `css/s4-scenes.css`, `js/s4-scenes.js`, `js/hats.js`,
  `css/hats.css`; fuse tokens in `js/fuse-art.js`; badge art in `js/badges.js`; sounds in `js/audio.js`; items in
  `js/items.js` with `series: 4`.
- **Four small engine additions:** an image particle and a fading straight line in `js/fx.js` (paper birds, ghosts, glyphs, gold
  leaf, fireflies, constellation lines); row and column variables on each brick in `js/view.js` (Moonglass); `spark` and
  `sparkEnd` events from `js/run.js` (Moonrise, Sandglass, Runechain); a candle flame, six new particle kinds and six bomb bodies
  in the fuse engine.
- **Budgets** (the Update 4 cosmetic rules, extended in a new `tests/u5cosmetics.js`): only transform and opacity animate; no
  blend modes; a skin animates at most a third of the board at rest; a board runs at most two animations behind the bricks; pop
  moments end within 600 ms, Rush and stage-up moments within 900 ms; particles stay within the per-brick budget, moments add at
  most 40 particles and 3 sprites; low-end phones and Reduce Motion hold everything still; no moment adds another full-screen
  flash.
- **Readability, checked by test:** the seven colours at least 12.5 apart at rest and in Rush; the group highlight and the Fuse
  brick countdown never hidden; HUD text over every scene passes the Update 4 contrast test (Floating Isles gets a scrim).
- **Performance:** the Hourglass stage-up flips 64 bricks at once, so `tests/perfbudget.js` gains a stage-up case with Hourglass
  equipped, plus Rush cases for Moonglass and Sigil and a pop case for Constellation; `tests/fuseperf.js` covers the six new
  bodies.

**What the prototypes showed:**
- **Hourglass:** reads clearly at the real 44 px brick, and the flip reads as one wave.
- **Sigil:** the cast circle and the rune frame read on a phone, and the highlighted group stays visible under the circle.
- **Moonglass:** the moon window in Rush is still faint. Brightening it washed Sapphire and Amethyst together, and its Rush
  distance (12.9) is the closest to the 12.5 line. It needs a proper art pass, not just more brightness.

### 1.9 Phase 1 is done when

Every item is built, passes `tests/u5cosmetics.js`, the readability check and the performance cases, and has been reviewed in the
gallery (on the board at rest, in Rush, mid-pop, on its badge, in the reel and reveal) against the Update 3 review questions:
does it belong in this game, is it readable, is anything clipped or stuck, does it look like another item. The economy is re-run
with the final catalogue. The season track migrates existing saves without losing a level, an item or a claimed reward.

---

## 2. Phase 2: every bug and visual error fixed

### 2.1 What the audits found

| | Blocker | Major | Minor | Polish |
|---|---|---|---|---|
| Menus (`audit-menus.md`) | 0 | 12 | 31 | 17 |
| Run screen, chests, cosmetics (`audit-run.md`) | 0 | 9 | 15 | 15 |

Phase 2 takes every bug and visual error from both audits, plus anything Phase 1 introduces. Intuitiveness and animation findings
go to Phase 3 (menus) and Phase 4 (the game).

### 2.2 Must fix: the majors and the logic bugs

| ID | What is wrong | Fix |
|---|---|---|
| X-1 | Save and leave, then Resume, loses the current stage's score, the run time, the combo and every Fuse brick (the snapshot has no `stageScore`) | Save and restore all run state; a round-trip test that compares every engine field |
| X-2 | Try it, then Pause, Restart turns the practice into a real run: the tried item stays equipped, Coins are paid (can be farmed), the run counts and the saved run is overwritten | Restart in practice restarts the practice; a test that practice can never pay, count or change the loadout |
| M-B1, M-B2 | Two pairs of `@keyframes` share names, so Collection cards flip edge-on with mirrored text and the Home bomb's spark floats off its wick | Unique names, and a test that fails on any duplicate keyframe name |
| M-B3 | The Home hero clips its Play button and bomb on small phones and with Larger text (up to 71 px) | `minmax(0, 1fr)` in the hero grid; stats wrap |
| M-B4 | The Shop pity line always says "within 8 chests" while the pips and odds say 5 | Print the real count |
| M-B5 | In landscape the Play button is below the fold | A two-column hero in landscape |
| M-B6 | Landscape sheets show 135 to 197 px of their body, with no scroll cue | Centred, wider sheets in landscape, two columns, a fade edge |
| M-B7 | Sheets do not take or trap keyboard focus | Focus on open, trap Tab, return focus on close, page behind made `inert` |
| R-1, R-2 | Big pops and Line Blasts print five messages on the board centre at once; a pop that starts Rush and clears a stage overlaps three banners | One message slot with a priority queue; Rush, stage-up and callouts sequenced |
| R-3 | Fuse bricks hide their colour, but still group by it | Keep the brick colour; draw the countdown on top |
| R-4 | On Beach and Greenhouse the fuse readout loses its urgency colours | Boards may not set the readout colour |
| R-5 | A completed mission draws a 116 px check on the results | Size it like the other rows |
| K-1 | Every fuse badge is off-centre and clipped, and sticks 27 px out of Collection and reel cards | A box for the mini fuse sized from the badge; a badge-sheet test from 36 to 120 px |
| K-2 | Six skins make two colours hard to tell apart (Neon 8.1, Candy 11.0, Circuit 11.6, Chrome 13.7, Clockwork 13.8, Phoenix 13.9 against Classic's 18.8) | A minimum distance of 12.5 for every skin, by test; repaint the three below it, check the rest |

### 2.3 Minors and polish

Fixed in the same phase, grouped by where they live (IDs from the audit files):
- **Results and payouts:** an empty run (no pops) still pays first-of-the-day Coins and XP, counts as a run and lights the streak
  (M-B14); the level-up line drops its "+" (M-B15); the next-goal line promises a "record" that is only a tie (M-B10); the Golden
  Chest fallback banner names the chest instead of the Coins actually paid (C-3); the results are not on the Back stack (M-B9).
- **Home, Shop, Missions, Pass, Profile:** the streak card's week-complete text (M-B16); the weekly challenge's done state (M-B17);
  toasts that sit over controls or follow the player into a run (M-B18, M-B26); the Coins sheet's "Go to the Shop" on the Shop
  (M-B25); the claimed-tier text (M-B24); the odds chip wrap (M-B22); the hero stats baseline (M-B23).
- **Larger text and keyboard:** the segment overlap and chips running off screen (M-B11, M-B12); `zoom` scaling only part of the
  page (M-B13); cards, Pass tiles and trophy badges that cannot be reached by keyboard (M-B8).
- **Desktop:** full-width sheets (M-B20); the Pass track ignoring the mouse wheel (M-B21).
- **Item sheet:** demo particles drawn over the description and the Equip button (M-B19).
- **Run screen:** goal pill overflow (R-6), the RUSH banner clipped at the edges (R-7), the Last Spark flame over Pause (R-8),
  the red vignette coming back after the run ends (R-9), Chill's tip pointing at nothing (R-10), the landscape pause sheet (R-11),
  the faint "Rush over" callout (R-12), no Daily label (R-14), Stage and Round mixed in Chill (R-15), time chips over the points
  pill (R-16), the Last Spark heartbeat at double rate (X-3).
- **Chests:** a re-press during the ring drain ignored (C-1); a completed chest that can still be held (C-2); the landing ring over
  the card's name (C-4); toasts landing on the next opening (C-6).
- **Cosmetics:** pop and board badges that all look alike at 56 px (K-3, K-4); Holo washing badges grey (K-5); three look-alike
  pairs (K-6); scenes busy behind the HUD (K-7); Galaxy hazy in Rush (K-8).

### 2.4 Colour accessibility

Measured with simulated deuteranopia, Sapphire and Amethyst bricks are 0.3 to 5.2 apart on every skin that ships, which is close
to identical. Shape hints exist and are offered after early runs, but most players will never turn them on. Recommended: shift
the Amethyst base hue toward magenta in `BR.PALETTE` (a small change to every skin's purple), then re-run the colour-distance test
for normal vision and the three common colour-vision types. The decision is the owner's, because it changes the look of every
purple brick (section 8).

### 2.5 Every class of bug gets a test

| Bug class | New check |
|---|---|
| Duplicate CSS animation names | Fails on any `@keyframes` name defined twice |
| Lost run state | Snapshot, restore and compare every engine field, mid-stage and with Fuse bricks |
| Practice leaking into the real game | Practice runs never pay, count, save or change the loadout, from every exit (timer, Pause, Restart, Save and leave) |
| Empty runs | A run with no pops pays nothing, counts nothing and lights no streak |
| Badges | A badge sheet of every item at 36, 56, 72 and 120 px with a bounds check |
| Colour distance | Every skin at rest and in Rush, seven colours, normal vision and colour-blind simulation |
| Message overlap | Text elements on the board must not overlap at any moment of a 24-brick pop, a Line Blast or a Rush-plus-stage pop |

### 2.6 How the phase runs

Fix by area, run the audit scripts in `docs/update-5/audit-scripts/` again on each fixed area, take a fresh screenshot sweep at
the five sizes plus Larger text and Reduce Motion, and keep a shortfall list until it is empty. The full test suite runs after
every area.

**Phase 2 is done when** no blocker, major or minor finding is open, every polish finding is fixed or written down as a choice,
the new tests pass, and a fresh sweep of both audits finds nothing new.

---

## 3. Phase 3: menus polished, more intuitive, better animation

### 3.1 Show what is waiting

The most valuable thing a menu can do is point at the reward the player has already earned. Today waiting chests are below the
fold and nothing on the tab bar says so.
- A badge on the Shop tab when a chest is free to open, and the Missions dot switched back on (it is disabled in code).
- The "chests to open" banner moves up under the hero, and tapping it opens the chest.
- A **claim moment** for Pop Pass rewards: the next time Home or the Pass opens after a level-up, the reward is revealed with a
  short animation instead of being paid silently.
- Links land on what they name: "Go to the Shop" from a locked item scrolls to that chest and pulses it; Try it returns to the
  item sheet; the results "Chests" button opens the chest directly.

### 3.2 The results screen: fast and honest

- The action bar (Play again, Home, Chests) is on screen within 0.6 s, before the count-ups finish.
- One "Coins earned" total that includes the level, trophy, streak and mission Coins and matches the balance change, with a small
  breakdown; the top-bar pill counts up to the new balance.
- Each reward shown once: one compact banner per level-up or trophy, several trophies grouped, no duplicate rows at the bottom.
- The XP bar and the counts move into view, and each count starts when its row is on screen.
- "Play again" offers the Boosts used last time; Chill starts without an empty sheet.

### 3.3 Screen by screen

| Screen | Changes |
|---|---|
| Home | Hero grid that never clips; in landscape the hero sits beside the logo with Play above the fold; a chip with the last Boosts so a returning player starts in one tap; one level wording ("Next: Pass level 7") |
| Shop | Count shown on the button only; one shared "ways to earn Coins" list that mentions free chests first; chests you cannot afford say "Need 180 more"; Series 4 chips and spotlight (from Phase 1) |
| Collection | The count once (the ring); an "All" filter; real dark silhouettes for items not yet found; the Tower view (from Phase 1) |
| Missions | Swap buttons that stay visible and say why they are disabled; an undo toast for a swap; the weekly done state |
| Pop Pass | The Season 4 track, the claim moment, mouse wheel and arrows on desktop |
| Profile | A gear in the top bar that opens Settings as a sheet, from any screen (two taps to change the sound); trophies with their own icons, tappable; a pencil to rename |
| Coach cards | "Let's pop" starts the first run; the first-chest card becomes a hint line that does not cover the hold button; a "keep holding" hint after an early release |
| Button roles | A red danger style for "Replace my progress" and Reset; green for anything free; gold for spending Coins only |

### 3.4 Animation

| Moment | Today | Change |
|---|---|---|
| Tab switch | The old screen vanishes, 70 to 100 ms of bare background, then a stagger of up to 1 s; the top bar animates in again on every tab | The top bar lives outside the screens and never moves; the old screen cross-fades out; the stagger is capped at about 250 ms |
| Segment switch | Content snaps while the thumb slides | The list region slides or fades with the thumb |
| Shop to chest opening | About 100 ms of black | The app hides only once the opening is opaque |
| Results to Chests | The Shop shows, then black, then the opening | Straight from the results to the opening |
| "Beat it" | The old board shows for about 250 ms | The board clears before the results fade |
| Boosts sheet to run | Home flashes for 250 ms | No gap |
| Numbers | The Coin pill and level ring snap | Count with a small bump |
| Mission swap | The text changes instantly | The card flips |
| Toasts | Wrap to two lines, three stack | One line, at most two |
| Play button | Its glow flickers between pink and gold | The button's own colours |
| Reduce Motion | The stagger delays remain, so blocks pop in one by one | No delays; content appears together |

Keep what works: the sheet slide with its dim, coach cards on a spring, sliding toggles, the tab indicator and segment thumbs,
toasts springing in, the chest drop and hold ring, and the order of the results reveals.

### 3.5 Landscape, desktop, Larger text, keyboard

- Landscape: centred sheets up to 560 px wide in two columns, with a fade where they scroll; the pause sheet in two columns.
- Desktop: sheets at most 560 px wide; the Pass track scrolls with the wheel and has arrows.
- Larger text: one type scale for the whole interface instead of `zoom` on two containers; segments and chips that wrap.
- Keyboard: every card, tile and badge reachable; sheets trap focus; Escape and Back work on the results.

### 3.6 Phase 3 is done when

The tap counts in section 0 hold. Frame sheets of every handoff show no blank, black or stale frame. The results buttons appear
within 0.6 s. Every screen passes `tests/uiaudit.js` at the five sizes and with Larger text, and a keyboard-only pass reaches
every control. A fresh read of the menu audit's intuitiveness section finds nothing open.

---

## 4. Phase 4: visuals, animation, logic, balance and optimisation

### 4.1 What the balance census shows

Update 4.1's tile director removed the droughts that used to end runs, and rescaled Coins to match. The census shows the other
reward systems drifted with it:

| Measure (casual / average / sharp) | Update 4.0 | Update 4.1 | Target |
|---|---|---|---|
| Stage reached | 4.0 / 6.4 / 8.1 | 5.1 / 7.9 / 9.3 | within half a stage of 4.1 |
| Run length | 135 / 128 / 129 s | 149 / 142 / 144 s | 130 to 160 s |
| Rush: share of the run | not measured | 25 / 45 / 56% | 15 to 25 / 20 to 30 / at most 40% |
| Rushes per run | 2.8 / 4.4 / 5.7 | 3.9 / 6.3 / 7.3 | |
| Last Spark saves the run | 47 / 46 / 33% | 78 / 77 / 75% | 45 to 60% |
| Biggest combo in a run | 6.8 / 13.4 / 24.8 | 8.4 / 18.8 / 28.7 | a combo of 10 or more stays special |
| XP per run | 220 / 534 / 1013 | 334 / 845 / 1336 | |
| Runs to finish the 30-tier Pass | 355 / 149 / 79 | 236 / 94 / 60 | about 300 / 150 / 90 |
| Runs with a 12+ group | 50 / 41 / 35% | 32 / 17 / 7% | at least a third when a goal asks for it |
| Line Blasts per run | 0.05 / 0.06 / 0.05 | 0.09 / 0.06 / 0.01 | at least a third of runs when a goal asks for one |
| Runs for the "Make 2 Line Blasts" mission | 37 / 33 / 37 | 23 / 33 / 150 | 3 or fewer |
| "Reach stage 6" mission in one run | 5 / 84 / 99% | 34 / 100 / 100% | a real ask at every skill |
| Weekly "Reach stage 8" | 0 / 13 / 64% | 0 / 77 / 100% | a week's goal, not a given |
| Trophy "Score 250,000" in one run | 0 / 15 / 64% | 0 / 79 / 100% | |
| Daily "Score 120,000" mission | 4 / 84 / 98% | 8 / 100 / 100% | |
| Power-ups earned per run | 5.2 / 7.8 / 12.8 | 6.9 / 11.4 / 16.6 | |
| Bricks cleared per use: Hammer / Beam / Prism | 9 / 15 / 15 | 9 / 15 / 15 | each worth taking |
| Coins per run | 21 / 44 / 65 | 26 / 54 / 65 | unchanged |

### 4.2 The balance changes

Each is a lever with a target from 4.1 and a bot test that fails outside it. They are tuned together, because Rush, the burn and
the director all decide how long a run lasts.

1. **Rush feels special again.** Each Rush in a run needs about 30% more charge than the last; a Rush lasts at most 12 s instead
   of 14; a pop during Rush adds 0.3 s instead of 0.5. Measured on a copy of the engine, this brings Rush from 45% to 30% of an
   average run and from 56% to 41% of a sharp one. Paired with a fuse that speeds up 15% per stage again (Update 4.1 raised it
   to 20%), runs keep their length (145 to 154 s) and land within 0.3 of a stage of today.
2. **Last Spark is a save, not a formality.** The board's floor almost always offers a 4+ group, so the Last Spark (which needs
   4+) saved 75 to 78% of runs. Less director help barely changed that, and a shorter window (1.6 s) moved only the casual
   player (74 to 60%). Options: a 5+ pop from stage 5, or a Last Spark that needs a 4+ pop of the colour the bomb names.
   Target: 45 to 60%.
3. **Combos.** A combo grows with every pop of 4+ in a row, and with the floor most pops qualify, so sharp players hold combos of
   20 to 30 and sit at the x4 cap on 30% of pops. Make the step to each combo level grow (for example 4+, 4+, 5+, 5+, 6+), so a
   long combo takes planning.
4. **XP and the season track.** Points pay XP at score/600, and scores rose about 1.6 times, so the Pass fills a third faster.
   Pay points XP on a square-root curve like Coins, and tune season XP so a season of 30 tiers takes about 3 weeks of normal play
   (about 300 runs casual, 150 average).
5. **Missions and run goals that adapt.**
   - Scale targets with the skill rating, not only with level, so "reach stage 6" or "score 120,000" is a real ask at every skill.
   - Make the tile director goal-aware: when the run goal or a mission asks for a Line Blast or a 12+ group, its jackpots set
     that up (a near-line, a 12-group) instead of an 8-group. Line Blast missions also drop to 1 or 2.
   - Weekly challenges come in tiers.
6. **Trophies.** Add score trophies at 500,000 and 1,000,000 and a stage 12 trophy, plus the six Series 4 trophies. Keep the old
   ones (they only get easier to reach).
7. **Power-ups.** The Hammer clears 9 bricks where the Beam and Prism clear about 15, and scores 15 a brick against the Prism's 20.
   Give the Hammer a reason to exist: for example, 3x3 plus the whole group of the tapped colour that touches it, or a 5-cell plus
   shape that also cracks Fuse bricks.
8. **Chill and Daily.** Chill (7.5 to 9.2 rounds) and Daily stay as they are. Daily keeps the director's fair mode.

### 4.3 Game visuals and animation

| Area | Today | Change |
|---|---|---|
| Messages on the board | Five can land at once (fixed for overlap in Phase 2) | One clear hierarchy: the callout owns the centre, score floats rise from the group, time chips fly to the fuse, goals go to the message band; big moments get a brief beat of hit-stop |
| Stage-up | The wipe band hides the board for about 0.4 s while the refill lands | The band passes in front of a board that is already refilled; the new colour drops in visibly |
| Legendary and Mythic reveals | 2.5 to 3 s of near-black and an empty card before anything of the item shows | The item's badge from the first frame; the "first look on the real board" behind the card that Update 4 planned and did not build |
| The weakest older cosmetics | Neon, Candy and Slate skins; Embers and Pixels pops; Circuit, Neon Burst and Carnival Night close behind | A repaint that keeps each one's identity and lifts it to Series 3 quality: stronger colour on Neon, more saturation on Candy, a material with depth on Slate, denser Embers and longer-lived Pixels |
| Look-alikes | Glass and Snow; Basic Cord and Rope; Copper Wire and Lightning Rod | A clear difference for each pair |
| Badges | Every pop badge and every board badge looks the same at 56 px | Pop badges show the pop's own particle; board badges show the scene |
| Rush visuals | Spread over `run.js`, `fuse.js` and fuse moments | Gathered in one module, ready for Rush fever themes in Update 6 |

### 4.4 Performance

| Item | Today | Plan | Target |
|---|---|---|---|
| Startup | About 790 ms to ready (CPU slowed 4x). Script before the first screen: a run-board layout that runs before any run exists (26 ms unthrottled), the icon sprite (20 ms), reading the save (15 ms), fuse art (about 13 ms), the Home render (7 ms) | Lay out the board on the first run; build the icon sprite and the fuse art after the first paint; check the save read on a real phone | under 600 ms |
| First chest-reel frame | 117 to 233 ms | Build the reel strip during the hold; lighter particles on the burst frame | under 120 ms |
| Series 4 | not measured | The new perf cases from 1.8 | every budget passes |
| Collection with 100 entries (84 chest items, 4 Pass exclusives, 12 hats) | built in chunks today | Keep the first-frame build at two rows; check the reel and the Tower view | tab frame under 190 ms |
| Bundle | 1.29 MB | Series 4 art as CSS and baked SVG, no images | under 2 MB |
| 120 Hz | every loop uses real elapsed time | Check the new particle kinds and hats at 120 Hz | no speed difference |

### 4.5 Logic and code health

- One heartbeat clock (X-3) and one place that decides when the run is over, so no visual reacts after it (R-9).
- The run snapshot is defined once and tested by round trip (X-1).
- A test runner (`node tests/all.js`) that runs the suites in the right order and prints one summary, so a phase gate is one
  command.
- Remove the stale agent worktrees left in `.claude/worktrees/` from earlier updates (local only).

### 4.6 Phase 4 is done when

Every target in section 4.1 holds in `tests/sim.js` and `tests/director.js` (which gain the new checks), the perf budget passes
with Series 4 items equipped, the repainted items pass the gallery review, and the economy is re-run with the final catalogue.

---

## 5. Build order and process

| Phase | Contents | Gate |
|---|---|---|
| 0. Hotfix (recommended) | X-1 and X-2: resume losing progress, and the practice exploit. They hurt players today and are small | the round-trip and practice tests |
| 1. Series 4 | The engine additions first, then the hardest items (Hourglass, Moonglass, Sigil, Constellation, Moonrise), then the rest by type; hats; the Midnight reveal, sets, Tower view; the season track and its migration | section 1.9 |
| 2. Bugs and visual errors | Section 2, plus anything Phase 1 introduced | section 2.6 |
| 3. Menus | Section 3 | section 3.6 |
| 4. Game, balance, optimisation | Section 4; the balance re-tune last, once the catalogue and menus are settled | section 4.6 |

Every phase ends the way Update 4's did: all tests green, a visual review at 360x640, 393x852, 430x932, 844x390 and 1280x800, a
written shortfall list fixed until empty, a commit, a rebuilt single-file bundle and a republished Artifact so the owner can play
it.

**Dependencies.** The season track and hats need Pass and Collection screens in Phase 1, which Phase 3 then polishes. Phase 4's
balance re-tune changes run length and XP, so the season pacing in Phase 1 is provisional until Phase 4.

---

## 6. Risks

- **Scope.** Series 4 is the largest single piece: 30 items, 12 hats, a new reveal, sets, a Collection view and a season track.
  The hardest items come first so problems surface early; if time runs short, sets and the Tower view can move to Update 6
  without breaking the series.
- **Readability.** Moonglass in Rush (12.9) is close to the 12.5 line, and Floating Isles is the first light scene. Both are held
  to the automated checks, not to taste.
- **Performance.** The Hourglass flip animates 64 bricks at once. If its stage-up case fails the budget, the flip goes row by row.
- **Balance.** Rush, the burn and the director interact. They are tuned together against bot targets, and checked against the 4.1
  numbers so the game does not get harder by accident.
- **Saves.** The season track changes how Pass progress is stored. The migration keeps every level, item and claimed reward, and
  is tested on saves from every earlier version.
- **Safari.** Only Chromium is available here, so Safari-specific behaviour is covered by emulation and by the owner's hand
  check at the end of each phase.

---

## 7. Acceptance checklist

- [x] 28 Series 4 chest items, 2 Pass exclusives and 12 Fizz Hats shipped, each reviewed in the gallery.
- [x] Every skin, old and new, keeps the seven colours at least 12.5 apart, at rest and in Rush; Sapphire and Amethyst are
      distinguishable under colour-blind simulation. (tests/u5-skins.js and tests/u5-older.js)
- [~] The perf budget passes with the heaviest Series 4 items (it does, with the budgets restated in section 9.3); startup under 600 ms at 4x slowdown and the reel's first frame under 120 ms were not reached (section 9.3).
- [x] The season track works for new players and for saves from every earlier version. (tests/season.js, tests/logic.js, and tests/upgrade.js with a real 4.1 save)
- [x] No open blocker, major or minor finding from either audit; every polish finding fixed or recorded as a choice. (Open: R-16 and the last few pixels of R-8, section 9.4)
- [x] Each bug class has a test (section 2.5). (tests/u5-run.js, u5-chests.js, u5-menus.js, u5-older.js, cssclash.js, keyframes.js, uiaudit.js)
- [x] Open a waiting chest in 2 taps, equip in 2, see a Pass claim in 1; the results buttons within 0.6 s; one honest Coins total. (results buttons at 0.29 to 0.34 s)
- [x] No blank, black or stale frame in any screen handoff; Reduce Motion without staggered pop-in.
- [x] Landscape: Play above the fold and sheets readable. Keyboard: every control reachable and focus kept in sheets. (tests/u5-menus.js, tests/uiaudit.js)
- [x] Rush, Last Spark, combos, XP, missions, goals and trophies inside their targets (section 4.1), and runs as long as in 4.1. (tests/balance.js)
- [x] The weakest older cosmetics repainted; no look-alike pairs; every badge shows its own item.
- [ ] Checked by hand on a real iPhone and one Android phone. (The owner's step.)

---

## 8. Decisions for the owner

Each has a recommendation; the plan assumes the recommendation unless the owner says otherwise.

1. **Season track for the Pop Pass.** Season XP that resets each season while the level stays, so every player sees Season 4.
   Today's Pass exclusives become level trophies. *Recommended: yes.* Without it, players past level 30 never see the Season 4
   rewards.
2. **The economy with 28 more items.** Keep prices and Coins per run (time to own everything rises from about 10 to about 16
   hours for an average new player), and add six trophies and the Season 4 Pass. *Recommended: yes.* Optional: the Board Chest at
   400 Coins.
3. **Fizz Hats as the one new category,** earned only (Pass, streak, trophies), never sold. *Recommended: yes.*
4. **A hotfix before Phase 1** for the two bugs that cost players progress or let them farm Coins (X-1, X-2). *Recommended: yes.*
   This moves two Phase 2 fixes to the front.
5. **The Rush retune** (each Rush costs more, Rush lasts at most 12 s, the fuse speeds up 15% per stage again instead of 20%).
   *Recommended: yes.*
   Rush will happen less often, which players will notice.
6. **Last Spark.** Make it a real save (target 45 to 60%) with a 5+ pop from stage 5, or keep it generous as it is now.
   *Recommended: 5+ from stage 5.*
7. **The purple brick colour.** Shift Amethyst toward magenta so it cannot be confused with Sapphire, which changes every purple
   brick slightly. *Recommended: yes.*
8. **Repainting older cosmetics** that players already own (Neon, Candy, Slate, Embers, Pixels), keeping each one's identity.
   *Recommended: yes.*

---

## 9. What shipped

Update 5 is built on the branch and published as one self-contained page. All eight recommendations in section 8 were taken.

### 9.1 Phase by phase

- **Hotfix first.** Resuming a run keeps the whole run (stage score, fuse, streak, cursor), and a practice board can no longer pay,
  count a run or change the loadout.
- **Phase 1: Series 4 "Moonwick".** 30 items: 8 skins (Patchwork, Glowcap, Spellbook, Origami, Potion, Gemcut, Hourglass, Sigil),
  9 pops, 6 boards, 6 fuses and the two Pop Pass exclusives (Wisps, Moonglass). Five sets of four (Library, Glade, Alchemy, Time
  Vault, Spire) with a crest by the stage label and one flourish each. The Moonwick Tower in the Collection. The Midnight reveal
  for every Mythic and Legendary of the series (a bell tolls). A new category, 12 Fizz Hats (Collection > Hats), earned only. The
  Shop shows how many Moonwick items each chest still holds and a daily spotlight; returning players get a "Moonwick is open" card.
  The Pop Pass became a season (30 tiers, season XP from zero) so every player sees Season 4. Six new trophies. The older
  cosmetics that read worst were repainted (Neon, Candy, Slate, Circuit, Chrome, Clockwork, Phoenix, Lantern, Slime, Stained
  Glass, Prism Heart, Galaxy; Embers, Pixels, Neon Burst, Glass, Snow; badges for 17 pops and every board).
- **Phase 2: bugs.** Every finding of both audits was fixed or recorded (section 9.4). Root causes worth keeping: the run
  messages share one lane with a priority queue; the callout easing bent the key times; two files defined the same keyframes;
  `.bdg-fuse` was sized by a percentage of its own content; boards drew their bottom layer over the HUD (`inset: 0` from a base
  rule); a closing sheet still caught taps; the chest "first look" layer and the Collection's locked tile shared the class `.lk`.
- **Phase 3: menus.** One status bar outside the screens, tabs that cross-fade, one Coins total on the results with its
  breakdown, results buttons within 0.35 s, keyboard focus kept in sheets, Larger text as one type scale, a Hats tab,
  the Tower, Try the set.
- **Phase 4: balance and visuals.** Rush costs 35% more each time it comes round and lasts at most 12 s, the Last Spark needs a
  5+ pop from stage 3 and is now a real save, combos need bigger pops as the chain grows, XP is on a square-root curve, stage
  goals were rescaled, missions and run goals follow the player's skill, a goal about a big pop tells the tile director, a new
  colour arrives with the stage-up refill, the Hammer clears a diamond of 13.

### 9.2 Balance (tests/balance.js, bot players, 60 to 160 runs per skill)

| | casual | average | sharp |
|---|---|---|---|
| Stage reached | 5.3 | 7.4 | 8.7 |
| Run length | about 126 s | about 133 s | 133 to 145 s |
| Rush share of the run | 16% | 25% | 33% |
| Last Spark saves the run | 54 to 68% | 58 to 65% | 48 to 52% |

Runs to fill a season: about 117 for a sharp player. Chasing a 12+ pop with the director's help succeeds in 60 to 80% of runs;
without it 5 to 18%.

### 9.3 Performance (tests/perfbudget.js: 393x852, CPU slowed 4x, software rendering)

- Menus at rest 17 to 19 ms a frame (vsync-limited here); scrolling 17 ms; a sheet opening 18 ms.
- Tab switch: longest frame 150 to 217 ms (budget 190; 4.1 measured 83 to 183), script 23 to 48 ms.
- Run: 21 ms a frame, a pop 29 ms on average and 117 to 133 ms at worst; with the heaviest loadout (the Spire set and a hat) 22 ms,
  and a pop 46 to 74 ms on average, 150 to 200 ms at worst (budgets 80 and 220).
- The chest reel start: longest frame 180 to 370 ms (the budget was 250 before the 30 new items and is 420 now).
- Startup, unthrottled: first paint about 210 ms, app ready 250 to 335 ms (median of five loads about 305 ms). The plan's
  600 ms at 4x slowdown was not measured to be reached: roughly 800 ms at 4x, as in 4.1. The page bundle is 2.35 MB (plan: under 2 MB).
- What was found and fixed on the way: the Collection built every silhouette of what is not found yet (up to 60 badges) and
  painted the whole screen a second time under the tab fade. Silhouettes are now built near the viewport, and the Collection
  and the Shop leave at once. That took the Missions switch from 350 ms back to about 70 ms.
- Where the rest comes from: the stylesheet grew by half (about 900 more rules). A forced full-document style pass costs 62 ms
  here against 36 ms in 4.1 for the same number of elements. The next step, if it is needed, is to load the Series 4 board
  scenes only when a board that uses them is equipped or shown.

### 9.4 What is not done, and the choices made

- **Real devices:** nothing was run on an iPhone or an Android phone. Slate's baked noise (`feTurbulence`) and `color-mix` over a
  `conic-gradient` are the two things to look at first on Safari.
- **R-16** (the time chips route around the "x points" pill): the pill is opaque and above them, so they pass behind it.
  **R-8**: during Last Spark the flame now lies along the empty rope; at 360x640 its top touches the Pause button by a few pixels.
- The Great Work flourish's gold wash turns cool bricks greyish for about 300 ms. The Glade flourish still draws canvas sprites.
- The plan's "Series switch" in the Collection became a Tower card at the top of the Collection with a back button. The Time
  Vault flourish plays on a Last Spark save (not the stage-up). The Moonrise fuse shows one moon phase per urgency state.
- Rush visuals were not gathered in one place; that stays with Update 6.
- Tests that were written for the old behaviour were changed with the behaviour: Fuse bricks keep their skin, a heavy screen goes
  at once instead of fading, Pass tiers are season tiers.

### 9.5 How it was checked

`node tests/all.js` runs 33 suites (balance bots, spin physics, lifecycle and migration, an upgrade from a real 4.1 save,
chest flows, touch hit-testing, UI audit at seven sizes, keyframe and class-clash checks, audio loudness, and one suite for each
of the Moonwick skins, pops, boards, fuses, sets, Tower, the older cosmetics, the run screen, the chests and the menus).
`node tests/all.js --perf` adds the performance budget (run it on an idle machine).
