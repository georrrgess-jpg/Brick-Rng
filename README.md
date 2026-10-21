# Shardfall

Tap groups of bricks to pop them, clear rounds, level up, and crack **Geodes** that hold skins for your bricks,
your pops and your board.

**Play:** open `index.html` in any modern browser. No build step, no dependencies, works offline from `file://`.
To host it, serve the folder as-is (for example GitHub Pages). `python3 tools/bundle.py out.html` produces a
single self-contained file.

## How to play
- **Tap** a group of 2+ touching same-color bricks. On touch, press to preview, release to pop, slide away to cancel.
- Each round gives you **20 moves** and a **goal**. Reach the goal before the moves run out to clear the round.
  Moves left over shatter bricks for a bonus. Goals climb every round; new brick colors join at rounds 4 and 8.
- **Combos**: consecutive pops of 4+ add +0.5x each. A group that spans the board edge to edge is a **Line Blast**.
- **Boosters** are earned, never rolled. Big pops fill the charge bar and every full bar grants one: **Hammer**
  (smash 3x3), **Beam** (clear a row and column), **Prism** (clear every brick of one color). Tap a Booster, then the board.

## Progression
- Everything you do earns **XP** (points, rounds cleared, Line Blasts, big groups, first run of the day, new best).
- Every **level** grants a **Geode**; every 5th level grants a **Series Geode** with better odds.
- Open Geodes from the menu. Tap the Geode three times to crack it, watch the reel, then **Equip**, **Keep**, or
  **Dust** a duplicate for Shards.

## The Vault
| Type | Changes | Series 1 "Foundry" |
|---|---|---|
| **Facet** | The look of every brick | Candy, Slate Tile, Marble, Stained Glass, Neon Tube, Magma, Circuit, Aurora |
| **Burst** | Particles and sound of every pop | Ember Shower, Petal Drift, Glass Shatter, Pixel Dust, Stormcall |
| **Arena** | Board frame, scene and beam colour | Deep Sea, The Foundry, Night Market, Orbit, Greenhouse |

Rarity: Rough 60% · Polished 25% · Prismatic 10% · Radiant 4% · Celestial 1%. Each drop also rolls a **Finish**
(Matte, Gloss, Holo, Prism), a 10% chance of a **Tracker** that counts your stats, and (Facets) a pattern seed.
Duplicates become **Shards**; Shards fund **Fusion** (5 items of one rarity -> 1 of the next) and Geodes
(250 Shards). Cosmetics never change scoring, so a leaderboard stays fair.

Items are plain data in `js/items.js`; a Facet or Arena names a CSS class in `css/skins.css`, a Burst names a
particle recipe in `js/fx.js`. A new series is a list of objects plus the styles they name.

## Layout
```
index.html        screens + overlays
css/styles.css    design tokens, HUD, overlays, Vault, Geode stage
css/skins.css     Facet materials, Finish sheens, Arena scenes
js/rng.js         seeded PRNG
js/board.js       grid, flood fill, gravity + refill, reshuffle      (pure logic)
js/config.js      pacing, palette, rarity table, goal/XP curves
js/boosters.js    Hammer, Beam, Prism                                (pure logic)
js/items.js       item catalogue + drop roller                       (pure logic)
js/engine.js      rounds, scoring, boosters, shatter bonus           (pure logic)
js/storage.js     save schema v2, v1 migration
js/progress.js    XP, levels, Geodes, Shards, Vault, Fusion          (pure logic)
js/audio.js       synthesized Web Audio effects
js/fx.js          canvas particles, Burst recipes, bolts, confetti, shake
js/skins.js       applies the loadout, renders item previews
js/view.js        board renderer and every board animation (WAAPI)
js/ui.js          HUD, floating text, XP bars
js/geode.js       Geode opening: crack, shatter, reel, reveal, try-it board
js/vault.js       Vault screen
js/main.js        controller
tools/bundle.py   single-file bundle
tests/            simulation, logic tests, Playwright UI tests
```

## Tests
```
node tests/sim.js         # engine invariants + round balance with bots (no browser)
node tests/progress.js    # items, odds, XP, Geodes, Fusion, Trackers, v1 migration (no browser)
node tests/stress.js      # bot plays the real UI, checks DOM == engine after every action, opens Geodes
```
UI tests use Playwright's Chromium (paths in `tests/lib.js`). Progress is stored in `localStorage` under `shardfall.v2`.
